import net from "node:net";

export class TallyClient {
  constructor(config) {
    this.url = config.url || "http://127.0.0.1:9000";
    this.timeoutMs = Number(config.timeoutMs || 15000);
  }

  async testConnection() {
    await this.ensurePortReachable();
    const response = await this.request(companyListEnvelope());
    const licenseInfo = await this.fetchLicenseInfo().catch((error) => ({
      serialNumber: "",
      error: error.message
    }));
    return {
      reachable: true,
      companies: extractCompanyNames(response),
      licenseSerialNumber: licenseInfo.serialNumber || "",
      licenseInfo,
      rawPreview: response.slice(0, 1200)
    };
  }

  async fetchLicenseInfo() {
    await this.ensurePortReachable();
    const attempts = [];
    for (const parameter of ["SerialNumber", "Serial Number"]) {
      const response = await this.request(licenseInfoEnvelope(parameter));
      const serialNumber = normalizeTallySerialNumber(parseFunctionResult(response));
      attempts.push({
        parameter,
        serialNumber,
        rawPreview: response.slice(0, 1200)
      });
      if (serialNumber) {
        return {
          serialNumber,
          parameter,
          attempts,
          rawPreview: response.slice(0, 1200)
        };
      }
    }

    const response = attempts[0]?.rawPreview || "";
    return {
      serialNumber: "",
      attempts,
      rawPreview: response
    };
  }

  async checkVoucherExists(companyName, voucherNumber) {
    await this.ensurePortReachable();
    const response = await this.request(voucherLookupEnvelope(companyName, voucherNumber));
    const lookup = parseVoucherLookup(response, voucherNumber);
    return {
      exists: lookup.exists,
      matches: lookup.matches,
      rawPreview: response.slice(0, 1200)
    };
  }

  async fetchCompanyUdfs(companyName, udfNames = SATHI_COMPANY_UDF_NAMES) {
    await this.ensurePortReachable();
    const response = await this.request(companyUdfEnvelope(companyName, udfNames));
    return {
      companyName,
      fields: parseCompanyUdfs(response, udfNames),
      rawPreview: response.slice(0, 2000)
    };
  }

  async fetchSathiVoucherTypes(companyName) {
    await this.ensurePortReachable();
    const response = await this.request(sathiVoucherTypeEnvelope(companyName));
    const voucherTypes = parseSathiVoucherTypes(response);
    const purchaseScopes = voucherTypes.filter((entry) => entry.scopeType === "purchase");
    const salesScopes = voucherTypes.filter((entry) => entry.scopeType === "sales");
    const salesByClientId = new Map();
    for (const sales of salesScopes) {
      const key = normalizeScopeClientId(sales.clientId);
      if (!key) continue;
      const mapped = salesByClientId.get(key) || [];
      mapped.push(sales);
      salesByClientId.set(key, mapped);
    }
    const licences = purchaseScopes.map((purchase) => {
      const sales = salesByClientId.get(normalizeScopeClientId(purchase.clientId)) || [];
      const salesVoucherTypeNames = [...new Set(sales.map((entry) => entry.name).filter(Boolean))];
      return {
        clientId: purchase.clientId,
        purchaseVoucherTypeName: purchase.name,
        salesVoucherTypeName: salesVoucherTypeNames[0] || "",
        salesVoucherTypeNames,
        fields: normalizeScopeFields(purchase.fields),
        purchase,
        sales,
        missingSales: !salesVoucherTypeNames.length
      };
    }).filter((entry) => entry.clientId || entry.purchaseVoucherTypeName);

    return {
      companyName,
      licences,
      purchaseScopes,
      salesScopes,
      voucherTypes,
      rawPreview: response.slice(0, 3000)
    };
  }

  async fetchStockItems(companyName) {
    await this.ensurePortReachable();
    const response = await this.request(stockItemListEnvelope(companyName));
    return {
      companyName,
      items: parseStockItems(response),
      rawPreview: response.slice(0, 2000)
    };
  }

  async fetchPortalSalesVouchers(companyName, voucherTypeName, period = {}, options = {}) {
    await this.ensurePortReachable();
    const response = await this.request(salesVoucherListEnvelope(companyName, voucherTypeName));
    const vouchers = filterVouchersByPeriod(parseSalesVouchers(response), period);
    const ledgerResponse = await this.request(partyLedgerLicenseEnvelope(companyName));
    const partyDetails = parsePartyDetails(ledgerResponse);
    const isCottonSale = Boolean(options.isCottonSale);
    return {
      companyName,
      voucherTypeName,
      isCottonSale,
      vouchers: vouchers.map((voucher) => {
        const party = partyDetails[voucher.partyLedgerName] || {};
        return {
          ...voucher,
          isCottonSale,
          buyerLicense: isCottonSale ? party.cottonLicense || "" : party.license || "",
          buyerLicenseSource: isCottonSale ? "SATHI_TALLY_PARTY_COTTON_LIC" : "SATHI_TALLY_PARTY_LIC",
          buyerPartyType: party.partyType || "",
          partyDetails: party
        };
      }),
      rawPreview: response.slice(0, 2000)
    };
  }

  async fetchPortalSalesVouchersForTypes(companyName, voucherTypeNames = [], period = {}) {
    const uniqueNames = [...new Set((voucherTypeNames || []).map((name) => String(name || "").trim()).filter(Boolean))];
    const names = uniqueNames;
    if (!names.length) {
      return {
        companyName,
        voucherTypeName: "",
        voucherTypeNames: [],
        vouchers: [],
        rawPreview: ""
      };
    }
    const typeFlags = await this.fetchSalesVoucherTypeFlags(companyName, names);
    const results = [];

    for (const name of names) {
      results.push(await this.fetchPortalSalesVouchers(companyName, name, period, {
        isCottonSale: Boolean(typeFlags[normalizeVoucherTypeName(name)]?.isCottonSale)
      }));
    }

    const vouchers = results.flatMap((result) => result.vouchers || []);
    return {
      companyName,
      voucherTypeName: names[0] || "",
      voucherTypeNames: names,
      voucherTypeFlags: typeFlags,
      vouchers,
      rawPreview: results.map((result) => result.rawPreview).filter(Boolean).join("\n\n").slice(0, 2000)
    };
  }

  async fetchSalesVoucherTypeFlags(companyName, voucherTypeNames = []) {
    try {
      const result = await this.fetchSathiVoucherTypes(companyName);
      const wanted = new Set(voucherTypeNames.map((name) => normalizeVoucherTypeName(name)));
      return Object.fromEntries((result.salesScopes || [])
        .filter((entry) => !wanted.size || wanted.has(normalizeVoucherTypeName(entry.name)))
        .map((entry) => [
          normalizeVoucherTypeName(entry.name),
          {
            name: entry.name,
            isCottonSale: isYes(entry.fields?.ISCottonSaleVTYP)
          }
        ]));
    } catch {
      return {};
    }
  }

  async updateVoucherSathiFields(companyName, voucher = {}) {
    await this.ensurePortReachable();
    const xml = voucherSathiFieldsEnvelope(companyName, voucher);
    const response = await this.request(xml);
    const summary = parseImportSummary(response);
    return {
      updated: importSucceeded(summary, response),
      summary,
      response,
      xmlPreview: xml.slice(0, 2000)
    };
  }

  async pushPurchaseVoucher(companyName, bill, mapping = {}) {
    await this.ensurePortReachable();
    const masterResult = await this.ensureInventoryMasters(companyName, bill, mapping);
    if (!masterResult.ok) {
      return {
        imported: false,
        summary: {
          created: 0,
          altered: 0,
          deleted: 0,
          errors: 1,
          lineErrors: masterLineErrors(masterResult),
          lastVoucher: "",
          lastMaster: ""
        },
        masterResult,
        lineErrors: masterLineErrors(masterResult),
        response: "",
        xmlPreview: ""
      };
    }

    const mappingWithMasters = {
      ...mapping,
      stockUnitOverrides: Object.fromEntries((masterResult.items || []).map((item) => [item.name, item.unitName]).filter(([, unitName]) => unitName))
    };
    const xml = purchaseVoucherEnvelope(companyName, bill, mappingWithMasters);
    const response = await this.request(xml);
    const summary = parseImportSummary(response);
    return {
      imported: importSucceeded(summary, response),
      summary,
      masterResult,
      lineErrors: summary.lineErrors,
      response,
      xmlPreview: xml.slice(0, 4000)
    };
  }

  async ensureInventoryMasters(companyName, bill, mapping = {}) {
    const lots = Array.isArray(bill?.lotData) ? bill.lotData : [];
    if (!lots.length) {
      return {
        ok: true,
        skipped: true,
        message: "No lot rows available for stock item master sync."
      };
    }

    const currentStockItems = await this.readCurrentStockItems(companyName);
    const items = lots.map((lot) => {
      const meta = resolveQuantityMeta(lot, mapping);
      const itemName = resolveStockItem(lot, mapping);
      const mapped = resolveMappedStockItemEntry(lot, mapping);
      const createNew = Boolean(mapped?.createNew);
      const currentItem = createNew ? findStockItemExact(currentStockItems, itemName) : findStockItem(currentStockItems, itemName);
      const aliasOwner = createNew && !currentItem ? findStockItemByAlias(currentStockItems, itemName) : null;
      return {
        name: itemName,
        aliases: [...new Set([portalItemName(lot), lot.cropName].filter(Boolean))],
        unitName: createNew && !currentItem ? "Nos" : currentItem?.baseUnits || meta.unitName,
        hsnCode: createNew ? "" : lot.tax?.hsnCode ? String(lot.tax.hsnCode) : "",
        gstRate: createNew ? 0 : gstRateDetails(lot).total,
        gstTaxability: createNew ? "Nil Rated" : "Taxable",
        stockGroupName: createNew ? "Seeds" : currentItem?.parent || "Primary",
        isPerishable: true,
        createNew,
        exists: Boolean(currentItem),
        skipMasterUpdate: createNew && Boolean(currentItem),
        createNameConflict: aliasOwner ? {
          itemName,
          existingItemName: aliasOwner.name,
          message: `Cannot create '${itemName}' because it is already an alias of stock item '${aliasOwner.name}'. Choose that existing item or remove the alias in Tally first.`
        } : null,
        billDate: bill.billDate,
        expiryDate: lot.expiryDate || ""
      };
    });
    const createNameConflicts = items.map((item) => item.createNameConflict).filter(Boolean);
    if (createNameConflicts.length) {
      return {
        ok: false,
        stockGroups: [],
        units: [],
        items: items.map((item) => ({ name: item.name, unitName: item.unitName })),
        groupSummary: null,
        unitSummary: null,
        stockSummary: null,
        createNameConflicts,
        aliasConflicts: [],
        groupResponsePreview: "",
        unitResponsePreview: "",
        stockResponsePreview: ""
      };
    }

    const units = [...new Set(items.map((item) => item.unitName).filter(Boolean))];

    const stockGroups = [...new Set(items.filter((item) => item.createNew && !item.exists).map((item) => item.stockGroupName).filter(Boolean))];
    const groupXml = stockGroupMasterEnvelope(stockGroups, companyName);
    const groupResponse = groupXml ? await this.request(groupXml) : "";
    const unitXml = unitMasterEnvelope(units, companyName);
    const unitResponse = unitXml ? await this.request(unitXml) : "";
    const aliasPlan = planStockAliases(items, currentStockItems);
    const stockXml = stockItemMasterEnvelope(aliasPlan.items, companyName);
    const stockResponse = stockXml ? await this.request(stockXml) : "";
    const groupSummary = groupResponse ? parseImportSummary(groupResponse) : null;
    const unitSummary = unitResponse ? parseImportSummary(unitResponse) : null;
    const stockSummary = stockResponse ? parseImportSummary(stockResponse) : null;

    return {
      ok: (!groupSummary || importSucceeded(groupSummary, groupResponse)) && (!unitSummary || importSucceeded(unitSummary, unitResponse)) && (!stockSummary || importSucceeded(stockSummary, stockResponse)),
      stockGroups,
      units,
      items: items.map((item) => ({ name: item.name, unitName: item.unitName })),
      groupSummary,
      unitSummary,
      stockSummary,
      aliasConflicts: aliasPlan.conflicts,
      groupResponsePreview: groupResponse.slice(0, 1200),
      unitResponsePreview: unitResponse.slice(0, 1200),
      stockResponsePreview: stockResponse.slice(0, 1200)
    };
  }

  async readCurrentStockItems(companyName) {
    try {
      return parseStockItems(await this.request(stockItemListEnvelope(companyName)));
    } catch {
      return [];
    }
  }

  async request(xml) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml"
      },
      body: xml,
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Tally request failed: HTTP ${response.status} ${text.slice(0, 300)}`);
    }

    return text;
  }

  async ensurePortReachable() {
    const url = new URL(this.url);
    const host = url.hostname || "127.0.0.1";
    const port = Number(url.port || 9000);

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error(tallySetupMessage(this.url)));
      }, Math.min(this.timeoutMs, 5000));

      socket.once("connect", () => {
        clearTimeout(timeout);
        socket.end();
        resolve();
      });

      socket.once("error", () => {
        clearTimeout(timeout);
        reject(new Error(tallySetupMessage(this.url)));
      });
    });
  }
}

export const SATHI_COMPANY_UDF_NAMES = [
  "SATHI_API_KEY",
  "SATHI_CLIENT_ID",
  "SATHI_CLIENT_SECRET",
  "SATHI_OWNER_CODE",
  "SATHI_LOCATION_CODE",
  "SATHI_STATE_CODE",
  "SATHI_BASE_URL",
  "SATHI_TALLY_VOUCHER_TYPE",
  "SATHI_TALLY_VOUCHER_TYPE_SALES",
  "SATHI_TALLY_PURCHASE_LEDGER"
];

export const SATHI_VOUCHER_TYPE_UDF_NAMES = [
  "SATHI_VCHTYPE",
  "SATHI_API_KEY",
  "SATHI_APIKEY",
  "SATHIAPIKEY",
  "SATHI_CLIENT_ID",
  "SATHI_CLIENTID",
  "SATHICLIENTID",
  "SATHI_CLIENT_SECRET",
  "SATHI_OWNER_CODE",
  "SATHI_LOCATION_CODE",
  "SATHI_STATE_CODE",
  "SATHI_BASE_URL",
  "SATHI_TALLY_PURCHASE_LEDGER",
  "ISCottonSaleVTYP"
];

const PORTAL_SALE_TYPE_UDF_NAMES = [
  "SATHI_SELLER_TYPE",
  "SATHI_SELLER_ROLE",
  "SATHI_BUYER_TYPE",
  "SATHI_BUYER_ROLE",
  "SATHI_SALE_TYPE",
  "SATHI_IS_RETAIL_SELL",
  "SATHI_RETAIL_SELL"
];

function companyUdfEnvelope(companyName, udfNames) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = ["Name", ...udfNames].join(",");
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Company UDF Config</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Company UDF Config" ISMODIFY="No">
            <TYPE>Company</TYPE>
            <FETCH>${escapeXml(fetchFields)}</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseCompanyUdfs(xml, udfNames) {
  return Object.fromEntries(udfNames.map((name) => [name, extractCompanyUdfValue(xml, name)]));
}

function sathiVoucherTypeEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = [
    "Name",
    "Parent",
    "VoucherTypeName",
    "TypeOfVoucher",
    "BasicVoucherTypeName",
    ...SATHI_VOUCHER_TYPE_UDF_NAMES
  ].join(",");
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Voucher Type Scopes</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Voucher Type Scopes" ISMODIFY="No">
            <TYPE>VoucherType</TYPE>
            <FETCH>${escapeXml(fetchFields)}</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseSathiVoucherTypes(xml) {
  const rows = [];
  const regex = /<VOUCHERTYPE\b([^>]*)>([\s\S]*?)<\/VOUCHERTYPE>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const attrs = match[1] || "";
    const block = match[2] || "";
    const fields = Object.fromEntries(SATHI_VOUCHER_TYPE_UDF_NAMES.map((name) => [name, extractCompanyUdfValue(block, name)]));
    if (!isYes(fields.SATHI_VCHTYPE)) continue;

    const name = decodeXml(attributeValue(attrs, "NAME") || extractTagValues(block, "NAME")[0] || extractTagValues(block, "VOUCHERTYPENAME")[0] || "").trim();
    const parent = extractTagValues(block, "PARENT")[0] || "";
    const typeOfVoucher = extractTagValues(block, "TYPEOFVOUCHER")[0] || "";
    const basicType = extractTagValues(block, "BASICVOUCHERTYPENAME")[0] || "";
    const clientId = firstField(fields, ["SATHI_CLIENT_ID", "SATHI_CLIENTID", "SATHICLIENTID", "SATHI_OWNER_CODE", "SATHI_LOCATION_CODE"]);
    const scopeType = resolveVoucherScopeType({ name, parent, typeOfVoucher, basicType, fields });

    rows.push({
      name,
      parent,
      typeOfVoucher,
      basicType,
      clientId,
      scopeType,
      fields,
      maskedFields: maskVoucherTypeFields(fields)
    });
  }

  return rows;
}

function resolveVoucherScopeType(entry) {
  if (entry.fields.SATHI_CLIENTID && !entry.fields.SATHI_CLIENT_ID) return "sales";
  const text = [entry.name, entry.parent, entry.typeOfVoucher, entry.basicType].join(" ").toLowerCase();
  if (text.includes("sales") || text.includes("sale")) return "sales";
  return "purchase";
}

function normalizeScopeFields(fields = {}) {
  const clientId = firstField(fields, ["SATHI_CLIENT_ID", "SATHI_CLIENTID", "SATHICLIENTID", "SATHI_OWNER_CODE", "SATHI_LOCATION_CODE"]);
  return {
    apiKey: firstField(fields, ["SATHI_API_KEY", "SATHI_APIKEY", "SATHIAPIKEY"]),
    clientId,
    clientSecret: fields.SATHI_CLIENT_SECRET || "",
    ownerCode: fields.SATHI_OWNER_CODE || clientId,
    locationCode: fields.SATHI_LOCATION_CODE || fields.SATHI_OWNER_CODE || clientId,
    stateCode: fields.SATHI_STATE_CODE || "",
    baseUrl: fields.SATHI_BASE_URL || "",
    purchaseLedgerName: fields.SATHI_TALLY_PURCHASE_LEDGER || "",
    raw: fields
  };
}

function firstField(fields = {}, names = []) {
  for (const name of names) {
    const value = String(fields[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function maskVoucherTypeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key,
    key === "SATHI_API_KEY" || key === "SATHI_CLIENT_SECRET" ? maskInlineSecret(value || "") : value
  ]));
}

function maskInlineSecret(value) {
  if (!value) return "";
  if (value.length <= 6) return "*".repeat(value.length);
  return `${value.slice(0, 2)}${"*".repeat(Math.min(value.length - 4, 18))}${value.slice(-2)}`;
}

function normalizeScopeClientId(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeVoucherTypeName(value) {
  return String(value || "").trim().toUpperCase();
}

function isYes(value) {
  return ["YES", "Y", "TRUE", "1"].includes(String(value || "").trim().toUpperCase());
}

function extractCompanyUdfValue(xml, name) {
  const escapedName = escapeRegExp(name);
  const patterns = [
    new RegExp(`<UDF:${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)</UDF:${escapedName}>`, "i"),
    new RegExp(`<${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedName}>`, "i"),
    new RegExp(`<UDF:[^>]+\\bDESC="[^"]*${escapedName}[^"]*"[^>]*>([\\s\\S]*?)</UDF:[^>]+>`, "i")
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) return decodeXml(match[1].trim());
  }

  return "";
}

function salesVoucherListEnvelope(companyName, voucherTypeName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = [
    "Date",
    "VoucherNumber",
    "Reference",
    "VoucherTypeName",
    "PartyLedgerName",
    "Amount",
    "InventoryEntries",
    "AllInventoryEntries",
    "BatchAllocations",
    "SathiStatus",
    "SathiVchNo",
    ...PORTAL_SALE_TYPE_UDF_NAMES
  ].join(",");
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Portal Sales Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Portal Sales Vouchers" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>${escapeXml(fetchFields)}</FETCH>
            <FILTER>SathiSalesVoucherTypeFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SathiSalesVoucherTypeFilter">$VoucherTypeName = "${escapeXml(voucherTypeName || "Sales")}"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function partyLedgerLicenseEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Party Licences</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Party Licences" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,SATHI_TALLY_PARTY_LIC,SATHI_TALLY_PARTY_COTTON_LIC,SATHI_TALLY_PARTY_TYPE,LEDBlockCode,LEDBlockName,LEDDisCode,LEDDiscName,LEDPlotNo,LEDVillCode,LEDVillName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function voucherSathiFieldsEnvelope(companyName, voucher = {}) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const voucherTypeName = voucher.voucherTypeName || "Sales";
  const voucherNumber = voucher.voucherNumber || voucher.reference || "";
  const date = tallyDate(voucher.date || new Date().toISOString().slice(0, 10));
  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>${companyBlock}</STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeXml(voucherTypeName)}" ACTION="Alter" OBJVIEW="Invoice Voucher View">
            <DATE>${date}</DATE>
            <VOUCHERTYPENAME>${escapeXml(voucherTypeName)}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>${escapeXml(voucherNumber)}</VOUCHERNUMBER>
            ${voucher.reference ? `<REFERENCE>${escapeXml(voucher.reference)}</REFERENCE>` : ""}
            ${tallyStringUdfXml("SathiStatus", voucher.sathiStatus || "")}
            ${tallyStringUdfXml("SathiVchNo", voucher.sathiVchNo || "")}
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function parseSalesVouchers(xml) {
  const vouchers = [];
  const regex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[2];
    const voucherNumber = extractTagValues(block, "VOUCHERNUMBER")[0] || attributeValue(match[1], "VCHKEY") || "";
    const inventory = parseVoucherInventory(block);
    vouchers.push({
      voucherNumber,
      reference: extractTagValues(block, "REFERENCE")[0] || "",
      date: extractTagValues(block, "DATE")[0] || "",
      voucherTypeName: extractTagValues(block, "VOUCHERTYPENAME")[0] || "",
      partyLedgerName: extractTagValues(block, "PARTYLEDGERNAME")[0] || extractTagValues(block, "PARTYNAME")[0] || "",
      amount: firstNonEmpty(extractTagValues(block, "AMOUNT")) || "",
      sathiStatus: extractCompanyUdfValue(block, "SathiStatus"),
      sathiVchNo: extractCompanyUdfValue(block, "SathiVchNo"),
      sellerRole: firstUdfValue(block, ["SATHI_SELLER_TYPE", "SATHI_SELLER_ROLE"]),
      buyerRole: firstUdfValue(block, ["SATHI_BUYER_TYPE", "SATHI_BUYER_ROLE"]),
      saleType: firstUdfValue(block, ["SATHI_SALE_TYPE"]),
      isRetailSell: firstUdfValue(block, ["SATHI_IS_RETAIL_SELL", "SATHI_RETAIL_SELL"]),
      inventory,
      status: inventory.length ? "Ready" : "Needs item details"
    });
  }

  return vouchers.filter((voucher) => voucher.voucherNumber || voucher.reference || voucher.partyLedgerName);
}

function parseVoucherInventory(xml) {
  const rows = [];
  const regex = /<(?:ALL)?INVENTORYENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/(?:ALL)?INVENTORYENTRIES\.LIST>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[1];
    const batchBlock = (block.match(/<BATCHALLOCATIONS\.LIST\b[^>]*>([\s\S]*?)<\/BATCHALLOCATIONS\.LIST>/i) || [])[1] || "";
    rows.push({
      stockItemName: extractTagValues(block, "STOCKITEMNAME")[0] || "",
      lotNum: extractTagValues(batchBlock, "BATCHNAME")[0] || "",
      originalOwner: extractCompanyUdfValue(batchBlock, "SATHI_ORIGINAL_OWNER") || extractCompanyUdfValue(batchBlock, "SATHI_ORIGINALOWNER"),
      packingSize: extractCompanyUdfValue(batchBlock, "SATHI_PACKING_SIZE") || extractCompanyUdfValue(batchBlock, "SATHI_PACKINGSIZE"),
      quantityText: extractTagValues(block, "BILLEDQTY")[0] || extractTagValues(block, "ACTUALQTY")[0] || "",
      quantity: parseTallyQuantity(extractTagValues(block, "BILLEDQTY")[0] || extractTagValues(block, "ACTUALQTY")[0] || ""),
      rate: extractTagValues(block, "RATE")[0] || "",
      amount: firstNonEmpty(extractTagValues(block, "AMOUNT")) || ""
    });
  }

  return rows.filter((row) => row.stockItemName || row.lotNum || row.quantityText);
}

function parsePartyDetails(xml) {
  const ledgers = {};
  const regex = /<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const name = decodeXml(attributeValue(match[1], "NAME") || extractTagValues(match[2], "NAME")[0] || "").trim();
    const license = extractCompanyUdfValue(match[2], "SATHI_TALLY_PARTY_LIC");
    const cottonLicense = extractCompanyUdfValue(match[2], "SATHI_TALLY_PARTY_COTTON_LIC");
    const partyType = extractCompanyUdfValue(match[2], "SATHI_TALLY_PARTY_TYPE");
    if (name) {
      ledgers[name] = {
        license,
        cottonLicense,
        partyType,
        blockCode: extractCompanyUdfValue(match[2], "LEDBlockCode"),
        blockName: extractCompanyUdfValue(match[2], "LEDBlockName"),
        districtCode: extractCompanyUdfValue(match[2], "LEDDisCode"),
        districtName: extractCompanyUdfValue(match[2], "LEDDiscName"),
        plotNo: extractCompanyUdfValue(match[2], "LEDPlotNo"),
        villageCode: extractCompanyUdfValue(match[2], "LEDVillCode"),
        villageName: extractCompanyUdfValue(match[2], "LEDVillName")
      };
    }
  }

  return ledgers;
}

function parseTallyQuantity(value) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function firstNonEmpty(values) {
  return (values || []).find((value) => String(value || "").trim() !== "") || "";
}

function firstUdfValue(xml, names = []) {
  for (const name of names) {
    const value = extractCompanyUdfValue(xml, name);
    if (String(value || "").trim()) return value;
  }
  return "";
}

function filterVouchersByPeriod(vouchers, period = {}) {
  const from = period.fromDate ? new Date(`${period.fromDate}T00:00:00`) : null;
  const to = period.toDate ? new Date(`${period.toDate}T23:59:59`) : null;
  if (!from && !to) return vouchers;

  return vouchers.filter((voucher) => {
    const date = parseTallyDateValue(voucher.date);
    if (!date) return false;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}

function parseTallyDateValue(value) {
  const text = String(value || "").trim();
  if (/^\d{8}$/.test(text)) {
    return new Date(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T12:00:00`);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function voucherLookupEnvelope(companyName, voucherNumber) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Saathi Voucher Lookup</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Saathi Voucher Lookup" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>VoucherNumber,Reference,Date,VoucherTypeName,PartyLedgerName</FETCH>
            <FILTER>SaathiVoucherFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SaathiVoucherFilter">$VoucherNumber = "${escapeXml(voucherNumber)}" OR $Reference = "${escapeXml(voucherNumber)}"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseVoucherLookup(xml, voucherNumber) {
  const expected = normalizeLookupValue(voucherNumber);
  if (!expected) return { exists: false, matches: [] };

  const candidates = [
    ...extractTagValues(xml, "VOUCHERNUMBER"),
    ...extractTagValues(xml, "REFERENCE")
  ].filter(Boolean);
  const matches = candidates.filter((value) => normalizeLookupValue(value) === expected);

  return {
    exists: matches.length > 0,
    matches
  };
}

function stockItemListEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Stock Item List</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Stock Item List" ISMODIFY="No">
            <TYPE>StockItem</TYPE>
            <FETCH>Name,BaseUnits,Parent</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseStockItems(xml) {
  const items = [];
  const regex = /<STOCKITEM\b([^>]*)>([\s\S]*?)<\/STOCKITEM>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const aliases = [...new Set(extractTagValues(match[2], "NAME").filter(Boolean))];
    const name = decodeXml(attributeValue(match[1], "NAME") || aliases[0] || "").trim();
    if (!name) continue;
    items.push({
      name,
      aliases: aliases.filter((alias) => alias !== name),
      baseUnits: extractTagValues(match[2], "BASEUNITS")[0] || "",
      parent: extractTagValues(match[2], "PARENT")[0] || ""
    });
  }

  return items;
}

function attributeValue(text, name) {
  const match = String(text || "").match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? match[1] : "";
}

function normalizeLookupValue(value) {
  return String(value || "").trim().toUpperCase();
}

function planStockAliases(items, currentStockItems) {
  const ownerByName = new Map();
  for (const item of currentStockItems || []) {
    const names = [item.name, ...(item.aliases || [])].filter(Boolean);
    for (const name of names) ownerByName.set(normalizeAliasName(name), item.name);
  }

  const conflicts = [];
  const plannedItems = items.map((item) => {
    const itemKey = normalizeAliasName(item.name);
    const aliases = [];
    for (const alias of item.aliases || []) {
      const aliasKey = normalizeAliasName(alias);
      if (!aliasKey || aliasKey === itemKey) continue;
      const owner = ownerByName.get(aliasKey);
      if (owner && normalizeAliasName(owner) !== itemKey) {
        conflicts.push({
          itemName: item.name,
          alias,
          existingItemName: owner,
          message: `Alias '${alias}' already belongs to stock item '${owner}'.`
        });
        continue;
      }
      aliases.push(alias);
    }
    return {
      ...item,
      aliases: [...new Set(aliases)]
    };
  });

  return { items: plannedItems, conflicts };
}

function findStockItem(items, name) {
  const key = normalizeAliasName(name);
  return (items || []).find((item) => (
    normalizeAliasName(item.name) === key ||
    (item.aliases || []).some((alias) => normalizeAliasName(alias) === key)
  ));
}

function findStockItemExact(items, name) {
  const key = normalizeAliasName(name);
  return (items || []).find((item) => normalizeAliasName(item.name) === key);
}

function findStockItemByAlias(items, aliasName) {
  const key = normalizeAliasName(aliasName);
  return (items || []).find((item) => (
    normalizeAliasName(item.name) !== key &&
    (item.aliases || []).some((alias) => normalizeAliasName(alias) === key)
  ));
}

function normalizeAliasName(value) {
  return String(value || "").trim().toUpperCase();
}

function purchaseVoucherEnvelope(companyName, bill, mapping = {}) {
  const voucherType = mapping.voucherTypeName || "Purchase";
  const voucherAction = mapping.voucherAction || "Create";
  const partyLedger = resolvePartyLedger(bill, mapping);
  const voucherNumber = bill.billNumber || "";
  const date = tallyDate(bill.billDate);
  const effectiveDate = date;
  const entries = (bill.lotData || []).map((lot) => inventoryEntryXml(lot, bill, mapping)).join("");
  const taxTotals = totalTaxAmounts(bill);
  const partyAmount = amount(Number(bill.totalBillPrice || 0) + taxTotals.cgst + taxTotals.sgst + taxTotals.igst);
  const placeOfSupply = bill.stateName || "Maharashtra";
  const country = "India";
  const gstRegistrationName = mapping.gstRegistrationName || "";
  const partyRegistrationType = mapping.partyRegistrationType || "Regular";
  const companyRegistrationType = mapping.companyRegistrationType || "Regular";
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const partyGstin = partyGstinFromBill(bill);

  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          ${companyBlock}
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="${escapeXml(voucherType)}" ACTION="${escapeXml(voucherAction)}" OBJVIEW="Invoice Voucher View">
            ${buyerAddressXml(bill)}
            <OLDAUDITENTRYIDS.LIST TYPE="Number"><OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS></OLDAUDITENTRYIDS.LIST>
            <DATE>${date}</DATE>
            <VCHSTATUSDATE>${effectiveDate}</VCHSTATUSDATE>
            <GSTREGISTRATIONTYPE>${escapeXml(partyRegistrationType)}</GSTREGISTRATIONTYPE>
            <PARTYGSTREGISTRATIONTYPE>${escapeXml(partyRegistrationType)}</PARTYGSTREGISTRATIONTYPE>
            <VATDEALERTYPE>Unknown</VATDEALERTYPE>
            <STATENAME>${escapeXml(placeOfSupply)}</STATENAME>
            <PARTYSTATENAME>${escapeXml(placeOfSupply)}</PARTYSTATENAME>
            <COUNTRYOFRESIDENCE>${escapeXml(country)}</COUNTRYOFRESIDENCE>
            <PARTYCOUNTRYNAME>${escapeXml(country)}</PARTYCOUNTRYNAME>
            <PLACEOFSUPPLY>${escapeXml(placeOfSupply)}</PLACEOFSUPPLY>
            ${bill.pin ? `<PARTYPINCODE>${escapeXml(bill.pin)}</PARTYPINCODE><CONSIGNEEPINCODE>${escapeXml(bill.pin)}</CONSIGNEEPINCODE>` : ""}
            <VOUCHERTYPENAME>${escapeXml(voucherType)}</VOUCHERTYPENAME>
            <REFERENCE>${escapeXml(voucherNumber)}</REFERENCE>
            <REFERENCEDATE>${date}</REFERENCEDATE>
            <PARTYNAME>${escapeXml(partyLedger)}</PARTYNAME>
            ${partyGstin ? `<PARTYGSTIN>${escapeXml(partyGstin)}</PARTYGSTIN>` : ""}
            ${gstRegistrationName ? `<GSTREGISTRATION TAXTYPE="GST" TAXREGISTRATION="">${escapeXml(gstRegistrationName)}</GSTREGISTRATION>` : ""}
            ${companyBlock}
            <PARTYLEDGERNAME>${escapeXml(partyLedger)}</PARTYLEDGERNAME>
            <VOUCHERNUMBER>${escapeXml(voucherNumber)}</VOUCHERNUMBER>
            ${companyName ? `<BASICBUYERNAME>${escapeXml(companyName)}</BASICBUYERNAME><CONSIGNEEMAILINGNAME>${escapeXml(companyName)}</CONSIGNEEMAILINGNAME>` : ""}
            <CMPGSTREGISTRATIONTYPE>${escapeXml(companyRegistrationType)}</CMPGSTREGISTRATIONTYPE>
            <PARTYMAILINGNAME>${escapeXml(partyLedger)}</PARTYMAILINGNAME>
            <CURRSTATENAME>${escapeXml(placeOfSupply)}</CURRSTATENAME>
            <CURRPARTYLEDGERNAME>${escapeXml(partyLedger)}</CURRPARTYLEDGERNAME>
            <CURRBASICBUYERNAME>${escapeXml(partyLedger)}</CURRBASICBUYERNAME>
            <CURRPARTYNAME>${escapeXml(partyLedger)}</CURRPARTYNAME>
            <BASICBASEPARTYNAME>${escapeXml(partyLedger)}</BASICBASEPARTYNAME>
            <NUMBERINGSTYLE>Auto Retain</NUMBERINGSTYLE>
            <FBTPAYMENTTYPE>Default</FBTPAYMENTTYPE>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <VCHSTATUSTAXADJUSTMENT>Default</VCHSTATUSTAXADJUSTMENT>
            <VCHSTATUSVOUCHERTYPE>${escapeXml(voucherType)}</VCHSTATUSVOUCHERTYPE>
            ${gstRegistrationName ? `<VCHSTATUSTAXUNIT>${escapeXml(gstRegistrationName)}</VCHSTATUSTAXUNIT>` : ""}
            <VCHGSTCLASS>Not Applicable</VCHGSTCLASS>
            <VCHENTRYMODE>Item Invoice</VCHENTRYMODE>
            <DIFFACTUALQTY>No</DIFFACTUALQTY>
            <ISDELETED>No</ISDELETED>
            <EFFECTIVEDATE>${effectiveDate}</EFFECTIVEDATE>
            <ISGSTOVERRIDDEN>No</ISGSTOVERRIDDEN>
            <ISCANCELLED>No</ISCANCELLED>
            <ISINVOICE>Yes</ISINVOICE>
            ${tallyStringUdfXml("SathiStatus", mapping.sathiStatus || "Imported to Tally")}
            ${tallyStringUdfXml("SathiVchNo", mapping.sathiVchNo || voucherNumber)}
            <NARRATION>Imported from SATHI. Seller: ${escapeXml(bill.sellerName || "")}; Buyer: ${escapeXml(bill.buyerName || "")}</NARRATION>
            ${emptyVoucherCollections()}
            <CONTRITRANS.LIST>      </CONTRITRANS.LIST>
            <EWAYBILLERRORLIST.LIST>      </EWAYBILLERRORLIST.LIST>
            <IRNERRORLIST.LIST>      </IRNERRORLIST.LIST>
            <HARYANAVAT.LIST>      </HARYANAVAT.LIST>
            <SUPPLEMENTARYDUTYHEADDETAILS.LIST>      </SUPPLEMENTARYDUTYHEADDETAILS.LIST>
            <INVOICEDELNOTES.LIST>      </INVOICEDELNOTES.LIST>
            <INVOICEORDERLIST.LIST>      </INVOICEORDERLIST.LIST>
            <INVOICEINDENTLIST.LIST>      </INVOICEINDENTLIST.LIST>
            <ATTENDANCEENTRIES.LIST>      </ATTENDANCEENTRIES.LIST>
            <ORIGINVOICEDETAILS.LIST>      </ORIGINVOICEDETAILS.LIST>
            <INVOICEEXPORTLIST.LIST>      </INVOICEEXPORTLIST.LIST>
            ${entries}
            ${partyLedgerEntry(partyLedger, partyAmount, voucherNumber, date)}
            ${taxTotals.cgst > 0 ? ledgerEntry(mapping.cgstLedgerName || "CGST", -taxTotals.cgst) : ""}
            ${taxTotals.sgst > 0 ? ledgerEntry(mapping.sgstLedgerName || "SGST", -taxTotals.sgst) : ""}
            ${taxTotals.igst > 0 ? ledgerEntry(mapping.igstLedgerName || "IGST", -taxTotals.igst) : ""}
            <GST.LIST>      </GST.LIST>
            <STKJRNLADDLCOSTDETAILS.LIST>      </STKJRNLADDLCOSTDETAILS.LIST>
            <PAYROLLMODEOFPAYMENT.LIST>      </PAYROLLMODEOFPAYMENT.LIST>
            <ATTDRECORDS.LIST>      </ATTDRECORDS.LIST>
            <GSTEWAYCONSIGNORADDRESS.LIST>      </GSTEWAYCONSIGNORADDRESS.LIST>
            <GSTEWAYCONSIGNEEADDRESS.LIST>      </GSTEWAYCONSIGNEEADDRESS.LIST>
            <TEMPGSTRATEDETAILS.LIST>      </TEMPGSTRATEDETAILS.LIST>
            <TEMPGSTADVADJUSTED.LIST>      </TEMPGSTADVADJUSTED.LIST>
            ${gstBuyerAddressList(bill)}
            <GSTCONSIGNEEADDRESS.LIST>      </GSTCONSIGNEEADDRESS.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function inventoryEntryXml(lot, bill, mapping) {
  const itemName = resolveStockItem(lot, mapping);
  const quantityMeta = resolveQuantityMeta(lot, mapping);
  const qty = quantityMeta.quantity;
  const unitName = quantityMeta.unitName;
  const rate = amount(quantityMeta.rate);
  const lineAmount = amount(quantityMeta.lineAmount);
  const godownName = mapping.godownName || "Main Location";
  const purchaseLedger = mapping.purchaseLedgerName || "Purchase";
  const hsnCode = lot.tax?.hsnCode ? String(lot.tax.hsnCode) : "";
  const gstRates = gstRateDetails(lot, bill);
  const mapped = resolveMappedStockItemEntry(lot, mapping);
  const taxability = mapped?.createNew ? "Nil Rated" : gstRates.total > 0 ? "Taxable" : "Nil Rated";
  const batchName = lot.lotNum || "Primary Batch";
  const batchDate = tallyDate(bill.billDate);
  const expiryDate = lot.expiryDate ? tallyReadableDate(lot.expiryDate) : "";
  const originalOwner = bill.sellerCode || "";

  return `
            <ALLINVENTORYENTRIES.LIST>
              <STOCKITEMNAME>${escapeXml(itemName)}</STOCKITEMNAME>
              <BASICNUMPACKAGES></BASICNUMPACKAGES>
              <GSTOVRDNINELIGIBLEITC>Not Applicable</GSTOVRDNINELIGIBLEITC>
              <GSTOVRDNISREVCHARGEAPPL>Not Applicable</GSTOVRDNISREVCHARGEAPPL>
              <GSTOVRDNTAXABILITY>${escapeXml(taxability)}</GSTOVRDNTAXABILITY>
              <GSTSOURCETYPE>Stock Item</GSTSOURCETYPE>
              <GSTITEMSOURCE>${escapeXml(itemName)}</GSTITEMSOURCE>
              <HSNSOURCETYPE>Stock Item</HSNSOURCETYPE>
              <HSNITEMSOURCE>${escapeXml(itemName)}</HSNITEMSOURCE>
              <GSTOVRDNTYPEOFSUPPLY>Goods</GSTOVRDNTYPEOFSUPPLY>
              <GSTRATEINFERAPPLICABILITY>As per Masters/Company</GSTRATEINFERAPPLICABILITY>
              ${hsnCode ? `<GSTHSNNAME>${escapeXml(hsnCode)}</GSTHSNNAME>` : ""}
              <GSTHSNINFERAPPLICABILITY>As per Masters/Company</GSTHSNINFERAPPLICABILITY>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>
              <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>
              <CONTENTNEGISPOS>No</CONTENTNEGISPOS>
              <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
              <ISAUTONEGATE>No</ISAUTONEGATE>
              <ISCUSTOMSCLEARANCE>No</ISCUSTOMSCLEARANCE>
              <ISTRACKCOMPONENT>No</ISTRACKCOMPONENT>
              <ISTRACKPRODUCTION>No</ISTRACKPRODUCTION>
              <ISPRIMARYITEM>No</ISPRIMARYITEM>
              <ISSCRAP>No</ISSCRAP>
              <RATE>${rate}/${escapeXml(unitName)}</RATE>
              <AMOUNT>-${lineAmount}</AMOUNT>
              <ACTUALQTY> ${qty} ${escapeXml(unitName)}</ACTUALQTY>
              <BILLEDQTY> ${qty} ${escapeXml(unitName)}</BILLEDQTY>
              <BATCHALLOCATIONS.LIST>
                <GODOWNNAME>${escapeXml(godownName)}</GODOWNNAME>
                <BATCHNAME>${escapeXml(batchName)}</BATCHNAME>
                <MFDON>${batchDate}</MFDON>
                <DESTINATIONGODOWNNAME>${escapeXml(godownName)}</DESTINATIONGODOWNNAME>
                <INDENTNO>Not Applicable</INDENTNO>
                <ORDERNO>Not Applicable</ORDERNO>
                <TRACKINGNUMBER>Not Applicable</TRACKINGNUMBER>
                <DYNAMICCSTISCLEARED>No</DYNAMICCSTISCLEARED>
                <AMOUNT>-${lineAmount}</AMOUNT>
                <ACTUALQTY> ${qty} ${escapeXml(unitName)}</ACTUALQTY>
                <BILLEDQTY> ${qty} ${escapeXml(unitName)}</BILLEDQTY>
                ${expiryDate ? `<EXPIRYPERIOD>${escapeXml(expiryDate)}</EXPIRYPERIOD>` : ""}
                ${tallyStringUdfXml("SATHI_ORIGINAL_OWNER", originalOwner)}
                ${tallyStringUdfXml("SATHI_PACKING_SIZE", lot.packingSize || "")}
                <ADDITIONALDETAILS.LIST>        </ADDITIONALDETAILS.LIST>
                <VOUCHERCOMPONENTLIST.LIST>        </VOUCHERCOMPONENTLIST.LIST>
              </BATCHALLOCATIONS.LIST>
              <ACCOUNTINGALLOCATIONS.LIST>
                <OLDAUDITENTRYIDS.LIST TYPE="Number"><OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS></OLDAUDITENTRYIDS.LIST>
                <LEDGERNAME>${escapeXml(purchaseLedger)}</LEDGERNAME>
                <GSTCLASS>Not Applicable</GSTCLASS>
                <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
                <LEDGERFROMITEM>No</LEDGERFROMITEM>
                <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
                <ISPARTYLEDGER>No</ISPARTYLEDGER>
                <GSTOVERRIDDEN>No</GSTOVERRIDDEN>
                <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>
                <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>
                <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>
                <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>
                <CONTENTNEGISPOS>No</CONTENTNEGISPOS>
                <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
                <AMOUNT>-${lineAmount}</AMOUNT>
                <SERVICETAXDETAILS.LIST>        </SERVICETAXDETAILS.LIST>
                <BANKALLOCATIONS.LIST>        </BANKALLOCATIONS.LIST>
                <BILLALLOCATIONS.LIST>        </BILLALLOCATIONS.LIST>
                <INTERESTCOLLECTION.LIST>        </INTERESTCOLLECTION.LIST>
                <OLDAUDITENTRIES.LIST>        </OLDAUDITENTRIES.LIST>
                <ACCOUNTAUDITENTRIES.LIST>        </ACCOUNTAUDITENTRIES.LIST>
                <AUDITENTRIES.LIST>        </AUDITENTRIES.LIST>
                <INPUTCRALLOCS.LIST>        </INPUTCRALLOCS.LIST>
                <DUTYHEADDETAILS.LIST>        </DUTYHEADDETAILS.LIST>
                <EXCISEDUTYHEADDETAILS.LIST>        </EXCISEDUTYHEADDETAILS.LIST>
                <RATEDETAILS.LIST>        </RATEDETAILS.LIST>
                <SUMMARYALLOCS.LIST>        </SUMMARYALLOCS.LIST>
                <CENVATDUTYALLOCATIONS.LIST>        </CENVATDUTYALLOCATIONS.LIST>
                <STPYMTDETAILS.LIST>        </STPYMTDETAILS.LIST>
                <EXCISEPAYMENTALLOCATIONS.LIST>        </EXCISEPAYMENTALLOCATIONS.LIST>
                <TAXBILLALLOCATIONS.LIST>        </TAXBILLALLOCATIONS.LIST>
                <TAXOBJECTALLOCATIONS.LIST>        </TAXOBJECTALLOCATIONS.LIST>
                <TDSEXPENSEALLOCATIONS.LIST>        </TDSEXPENSEALLOCATIONS.LIST>
                <VATSTATUTORYDETAILS.LIST>        </VATSTATUTORYDETAILS.LIST>
                <COSTTRACKALLOCATIONS.LIST>        </COSTTRACKALLOCATIONS.LIST>
                <REFVOUCHERDETAILS.LIST>        </REFVOUCHERDETAILS.LIST>
                <INVOICEWISEDETAILS.LIST>        </INVOICEWISEDETAILS.LIST>
                <VATITCDETAILS.LIST>        </VATITCDETAILS.LIST>
                <ADVANCETAXDETAILS.LIST>        </ADVANCETAXDETAILS.LIST>
                <TAXTYPEALLOCATIONS.LIST>        </TAXTYPEALLOCATIONS.LIST>
              </ACCOUNTINGALLOCATIONS.LIST>
              <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>
              ${inventoryRateDetails(gstRates.cgst, gstRates.sgst, gstRates.igst)}
              <SUPPLEMENTARYDUTYHEADDETAILS.LIST>       </SUPPLEMENTARYDUTYHEADDETAILS.LIST>
              <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>
              <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>
              <EXCISEALLOCATIONS.LIST>       </EXCISEALLOCATIONS.LIST>
              <EXPENSEALLOCATIONS.LIST>       </EXPENSEALLOCATIONS.LIST>
            </ALLINVENTORYENTRIES.LIST>`;
}

function partyLedgerEntry(party, amountValue, referenceNumber, referenceDate) {
  const creditAmount = `-${String(amountValue || "0").replace(/^-/, "")}`;
  return `
            <LEDGERENTRIES.LIST>
              <OLDAUDITENTRYIDS.LIST TYPE="Number"><OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS></OLDAUDITENTRYIDS.LIST>
              <LEDGERNAME>${escapeXml(party)}</LEDGERNAME>
              <GSTCLASS>Not Applicable</GSTCLASS>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <GSTOVERRIDDEN>No</GSTOVERRIDDEN>
              <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>
              <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>
              <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>
              <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>
              <CONTENTNEGISPOS>No</CONTENTNEGISPOS>
              <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
              <AMOUNT>${creditAmount}</AMOUNT>
              <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>
              <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>
              <BILLALLOCATIONS.LIST>
                <NAME>${escapeXml(referenceNumber)}</NAME>
                <BILLTYPE>New Ref</BILLTYPE>
                <TDSDEDUCTEEISSPECIALRATE>No</TDSDEDUCTEEISSPECIALRATE>
                <AMOUNT>${amountValue}</AMOUNT>
                <INTERESTCOLLECTION.LIST>        </INTERESTCOLLECTION.LIST>
                <STBILLCATEGORIES.LIST>        </STBILLCATEGORIES.LIST>
              </BILLALLOCATIONS.LIST>
              <INTERESTCOLLECTION.LIST>       </INTERESTCOLLECTION.LIST>
              <OLDAUDITENTRIES.LIST>       </OLDAUDITENTRIES.LIST>
              <ACCOUNTAUDITENTRIES.LIST>       </ACCOUNTAUDITENTRIES.LIST>
              <AUDITENTRIES.LIST>       </AUDITENTRIES.LIST>
              <INPUTCRALLOCS.LIST>       </INPUTCRALLOCS.LIST>
              <DUTYHEADDETAILS.LIST>       </DUTYHEADDETAILS.LIST>
              <EXCISEDUTYHEADDETAILS.LIST>       </EXCISEDUTYHEADDETAILS.LIST>
              <RATEDETAILS.LIST>       </RATEDETAILS.LIST>
              <SUMMARYALLOCS.LIST>       </SUMMARYALLOCS.LIST>
              <CENVATDUTYALLOCATIONS.LIST>       </CENVATDUTYALLOCATIONS.LIST>
              <STPYMTDETAILS.LIST>       </STPYMTDETAILS.LIST>
              <EXCISEPAYMENTALLOCATIONS.LIST>       </EXCISEPAYMENTALLOCATIONS.LIST>
              <TAXBILLALLOCATIONS.LIST>       </TAXBILLALLOCATIONS.LIST>
              <TAXOBJECTALLOCATIONS.LIST>       </TAXOBJECTALLOCATIONS.LIST>
              <TDSEXPENSEALLOCATIONS.LIST>       </TDSEXPENSEALLOCATIONS.LIST>
              <VATSTATUTORYDETAILS.LIST>       </VATSTATUTORYDETAILS.LIST>
              <COSTTRACKALLOCATIONS.LIST>       </COSTTRACKALLOCATIONS.LIST>
              <REFVOUCHERDETAILS.LIST>       </REFVOUCHERDETAILS.LIST>
              <INVOICEWISEDETAILS.LIST>       </INVOICEWISEDETAILS.LIST>
              <VATITCDETAILS.LIST>       </VATITCDETAILS.LIST>
              <ADVANCETAXDETAILS.LIST>       </ADVANCETAXDETAILS.LIST>
              <TAXTYPEALLOCATIONS.LIST>       </TAXTYPEALLOCATIONS.LIST>
            </LEDGERENTRIES.LIST>`;
}

function ledgerEntry(ledgerName, amountValue) {
  return `
            <LEDGERENTRIES.LIST>
              <OLDAUDITENTRYIDS.LIST TYPE="Number"><OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS></OLDAUDITENTRYIDS.LIST>
              <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>
              <GSTCLASS>Not Applicable</GSTCLASS>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <AMOUNT>${amount(amountValue)}</AMOUNT>
              <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>
            </LEDGERENTRIES.LIST>`;
}

function buyerAddressXml(bill) {
  const lines = addressLines(bill);
  if (!lines.length) return "";
  return [
    '<ADDRESS.LIST TYPE="String">',
    lines.map((line) => `<ADDRESS>${escapeXml(line)}</ADDRESS>`).join(""),
    "</ADDRESS.LIST>",
    '<BASICBUYERADDRESS.LIST TYPE="String">',
    lines.map((line) => `<BASICBUYERADDRESS>${escapeXml(line)}</BASICBUYERADDRESS>`).join(""),
    "</BASICBUYERADDRESS.LIST>"
  ].join("");
}

function gstBuyerAddressList(bill) {
  const lines = addressLines(bill);
  if (!lines.length) return "<GSTBUYERADDRESS.LIST>      </GSTBUYERADDRESS.LIST>";
  return [
    "<GSTBUYERADDRESS.LIST>",
    lines.map((line) => `<GSTBUYERADDRESS>${escapeXml(line)}</GSTBUYERADDRESS>`).join(""),
    "</GSTBUYERADDRESS.LIST>"
  ].join("");
}

function addressLines(bill) {
  return [
    bill.plotNo,
    bill.villageName,
    bill.blockName,
    bill.districtName,
    bill.stateName,
    bill.pin
  ].filter(Boolean);
}

function partyGstinFromBill(bill = {}) {
  return [
    bill.sellerGstin,
    bill.sellerGSTIN,
    bill.sellerGstNumber,
    bill.sellerGSTNumber,
    bill.partyGstin,
    bill.partyGSTIN,
    bill.gstNumber
  ].find((value) => String(value || "").trim()) || "";
}

function totalTaxAmounts(bill) {
  return (bill.lotData || []).reduce((totals, lot) => {
    const bags = Number(lot.totalBags || 0);
    totals.cgst += Number(lot.tax?.cgst || 0) * bags;
    totals.sgst += Number(lot.tax?.sgst || 0) * bags;
    totals.igst += Number(lot.tax?.igst || 0) * bags;
    return totals;
  }, { cgst: 0, sgst: 0, igst: 0 });
}

function unitMasterEnvelope(units, companyName) {
  const unique = [...new Set(units.filter(Boolean))];
  if (!unique.length) return "";
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const messages = unique.map((unit) => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <UNIT NAME="${escapeXml(unit)}" RESERVEDNAME="" ACTION="Create">
            <NAME>${escapeXml(unit)}</NAME>
            <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
            <GSTREPUOM>OTH-Others</GSTREPUOM>
            <DECIMALPLACES>${unitAllowsDecimals(unit) ? "3" : "0"}</DECIMALPLACES>
          </UNIT>
        </TALLYMESSAGE>
  `).join("");

  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>${companyBlock}</STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${messages}</REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function stockGroupMasterEnvelope(groups, companyName) {
  const unique = [...new Set(groups.filter(Boolean))];
  if (!unique.length) return "";
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const messages = unique.map((group) => `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKGROUP NAME="${escapeXml(group)}" RESERVEDNAME="" ACTION="Alter">
            <NAME>${escapeXml(group)}</NAME>
            <PARENT>Primary</PARENT>
            <ISADDABLE>Yes</ISADDABLE>
            <ISDELETED>No</ISDELETED>
            <LANGUAGENAME.LIST><NAME.LIST TYPE="String"><NAME>${escapeXml(group)}</NAME></NAME.LIST><LANGUAGEID> 1033</LANGUAGEID></LANGUAGENAME.LIST>
          </STOCKGROUP>
        </TALLYMESSAGE>
  `).join("");

  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>${companyBlock}</STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${messages}</REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function stockItemMasterEnvelope(items, companyName) {
  const unique = [];
  const seen = new Set();
  for (const item of items.filter((entry) => !entry.skipMasterUpdate)) {
    const key = item.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    } else {
      const existing = unique.find((entry) => entry.name.toLowerCase() === key);
      existing.aliases = [...new Set([...(existing.aliases || []), ...(item.aliases || [])])];
    }
  }

  if (!unique.length) return "";

  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const messages = unique.map((item) => {
    const gstRate = Number(item.gstRate || 0);
    const halfRate = amount(gstRate / 2);
    const fullRate = amount(gstRate);
    const taxability = item.gstTaxability || "Taxable";
    const applicableFrom = financialYearStartDate(item.billDate);
    const nameList = [...new Set([item.name, ...(item.aliases || [])]
      .map((name) => String(name || "").trim())
      .filter(Boolean))]
      .map((name) => `<NAME>${escapeXml(name)}</NAME>`)
      .join("");

    return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${escapeXml(item.name)}" RESERVEDNAME="" ACTION="${item.createNew && !item.exists ? "Create" : "Alter"}">
            <OLDAUDITENTRYIDS.LIST TYPE="Number"><OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS></OLDAUDITENTRYIDS.LIST>
            <PARENT>${escapeXml(item.stockGroupName || "Primary")}</PARENT>
            <CATEGORY>&#4; Not Applicable</CATEGORY>
            <GSTAPPLICABLE>&#4; Applicable</GSTAPPLICABLE>
            <GSTTYPEOFSUPPLY>Goods</GSTTYPEOFSUPPLY>
            <COSTINGMETHOD>Avg. Cost</COSTINGMETHOD>
            <VALUATIONMETHOD>Avg. Price</VALUATIONMETHOD>
            <BASEUNITS>${escapeXml(item.unitName)}</BASEUNITS>
            <ADDITIONALUNITS>&#4; Not Applicable</ADDITIONALUNITS>
            <VATBASEUNIT>${escapeXml(item.unitName)}</VATBASEUNIT>
            <ISBATCHWISEON>Yes</ISBATCHWISEON>
            <ISPERISHABLEON>${item.isPerishable ? "Yes" : "No"}</ISPERISHABLEON>
            <ISDELETED>No</ISDELETED>
            <GSTDETAILS.LIST>
              <APPLICABLEFROM>${applicableFrom}</APPLICABLEFROM>
              <CALCULATIONTYPE>On Value</CALCULATIONTYPE>
              <TAXABILITY>${taxability}</TAXABILITY>
              <SRCOFGSTDETAILS>Specify Details Here</SRCOFGSTDETAILS>
              <ISREVERSECHARGEAPPLICABLE>No</ISREVERSECHARGEAPPLICABLE>
              <ISNONGSTGOODS>No</ISNONGSTGOODS>
              <GSTINELIGIBLEITC>No</GSTINELIGIBLEITC>
              <STATEWISEDETAILS.LIST>
                <STATENAME>&#4; Any</STATENAME>
                <RATEDETAILS.LIST><GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE><GSTRATE>${halfRate}</GSTRATE></RATEDETAILS.LIST>
                <RATEDETAILS.LIST><GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE><GSTRATE>${halfRate}</GSTRATE></RATEDETAILS.LIST>
                <RATEDETAILS.LIST><GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE><GSTRATE>${fullRate}</GSTRATE></RATEDETAILS.LIST>
                <RATEDETAILS.LIST><GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>&#4; Not Applicable</GSTRATEVALUATIONTYPE></RATEDETAILS.LIST>
                <RATEDETAILS.LIST><GSTRATEDUTYHEAD>State Cess</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE></RATEDETAILS.LIST>
              </STATEWISEDETAILS.LIST>
            </GSTDETAILS.LIST>
            ${item.hsnCode ? `<HSNDETAILS.LIST><APPLICABLEFROM>${applicableFrom}</APPLICABLEFROM><HSNCODE>${escapeXml(item.hsnCode)}</HSNCODE><SRCOFHSNDETAILS>Specify Details Here</SRCOFHSNDETAILS></HSNDETAILS.LIST>` : "<HSNDETAILS.LIST>      </HSNDETAILS.LIST>"}
            <LANGUAGENAME.LIST><NAME.LIST TYPE="String">${nameList}</NAME.LIST><LANGUAGEID> 1033</LANGUAGEID></LANGUAGENAME.LIST>
          </STOCKITEM>
        </TALLYMESSAGE>
    `;
  }).join("");

  return `
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>${companyBlock}</STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>${messages}</REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function tallyStringUdfXml(name, value) {
  if (!value) return "";
  return `
                <UDF:${escapeXml(name)}.LIST DESC="${escapeXml(name)}" ISLIST="YES" TYPE="String">
                  <UDF:${escapeXml(name)} DESC="${escapeXml(name)}">${escapeXml(value)}</UDF:${escapeXml(name)}>
                </UDF:${escapeXml(name)}.LIST>`;
}

function financialYearStartDate(value) {
  const tally = tallyDate(value);
  const year = Number(tally.slice(0, 4)) || new Date().getFullYear();
  const month = Number(tally.slice(4, 6)) || 4;
  return `${month >= 4 ? year : year - 1}0401`;
}

function unitAllowsDecimals(unitName) {
  return !/^(bag|bags|nos|no|pcs|piece|packet|pkt)$/i.test(String(unitName || "").trim());
}

function emptyVoucherCollections() {
  return [
    "<EWAYBILLDETAILS.LIST>      </EWAYBILLDETAILS.LIST>",
    "<EXCLUDEDTAXATIONS.LIST>      </EXCLUDEDTAXATIONS.LIST>",
    "<OLDAUDITENTRIES.LIST>      </OLDAUDITENTRIES.LIST>",
    "<ACCOUNTAUDITENTRIES.LIST>      </ACCOUNTAUDITENTRIES.LIST>",
    "<AUDITENTRIES.LIST>      </AUDITENTRIES.LIST>",
    "<DUTYHEADDETAILS.LIST>      </DUTYHEADDETAILS.LIST>",
    "<GSTADVADJDETAILS.LIST>      </GSTADVADJDETAILS.LIST>"
  ].join("");
}

function gstRateDetails(lot) {
  const cgst = Number(lot.tax?.cgst || 0);
  const sgst = Number(lot.tax?.sgst || 0);
  const igst = Number(lot.tax?.igst || 0);

  return {
    cgst: cgst > 0 && cgst <= 100 ? cgst : 0,
    sgst: sgst > 0 && sgst <= 100 ? sgst : 0,
    igst: igst > 0 && igst <= 100 ? igst : 0,
    total: cgst + sgst + igst
  };
}

function resolveQuantityMeta(lot, mapping = {}) {
  const mode = mapping.quantityMode || "totalBags";
  const lineAmount = Number(lot.unitPrice || 0) * Number(lot.totalBags || 0);
  let quantity = Number(lot.totalBags || 0);
  let unitName = mapping.unitName || "Bag";

  if (mode === "packingQty") {
    quantity = Number(lot.packingSize || 0) * Number(lot.totalBags || 0);
    unitName = mapping.unitName || lot.packingUnit || "kg";
  }

  if (mode === "totalQty") {
    quantity = Number(lot.totalQty || 0);
    unitName = mapping.unitName || lot.packingUnit || "kg";
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = Number(lot.totalBags || 1);
  }

  const itemName = resolveStockItem(lot, mapping);
  if (mapping.stockUnitOverrides?.[itemName]) {
    unitName = mapping.stockUnitOverrides[itemName];
  }

  const rate = quantity > 0 ? lineAmount / quantity : Number(lot.unitPrice || 0);

  return {
    quantity: formatQuantity(quantity),
    unitName,
    rate,
    lineAmount
  };
}

function formatQuantity(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(3)));
}

function inventoryRateDetails(cgstRate, sgstRate, igstRate) {
  return [
    `<RATEDETAILS.LIST><GSTRATEDUTYHEAD>CGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE><GSTRATE>${amount(cgstRate)}</GSTRATE></RATEDETAILS.LIST>`,
    `<RATEDETAILS.LIST><GSTRATEDUTYHEAD>SGST/UTGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE><GSTRATE>${amount(sgstRate)}</GSTRATE></RATEDETAILS.LIST>`,
    `<RATEDETAILS.LIST><GSTRATEDUTYHEAD>IGST</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE><GSTRATE>${amount(igstRate)}</GSTRATE></RATEDETAILS.LIST>`,
    "<RATEDETAILS.LIST><GSTRATEDUTYHEAD>Cess</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Not Applicable</GSTRATEVALUATIONTYPE></RATEDETAILS.LIST>",
    "<RATEDETAILS.LIST><GSTRATEDUTYHEAD>State Cess</GSTRATEDUTYHEAD><GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE></RATEDETAILS.LIST>"
  ].join("");
}

function resolvePartyLedger(bill, mapping) {
  if (mapping.partyMode === "sellerCode") return bill.sellerCode || bill.sellerName || "SATHI Seller";
  return bill.sellerName || bill.sellerCode || "SATHI Seller";
}

function resolveStockItem(lot, mapping) {
  const mapped = resolveMappedStockItem(lot, mapping);
  if (mapped) return mapped;
  if (mapping.stockItemMode === "lotNum") return lot.lotNum || lot.varietyName || lot.cropName || "SATHI Seed";
  if (mapping.stockItemMode === "cropName") return lot.cropName || lot.varietyName || lot.lotNum || "SATHI Seed";
  return lot.varietyName || lot.cropName || lot.lotNum || "SATHI Seed";
}

function resolveMappedStockItem(lot, mapping = {}) {
  const mapped = resolveMappedStockItemEntry(lot, mapping);
  if (typeof mapped === "string") return mapped.trim();
  if (mapped?.tallyItemName) return String(mapped.tallyItemName).trim();
  return "";
}

function resolveMappedStockItemEntry(lot, mapping = {}) {
  const mappings = mapping.itemMappings || {};
  const keys = [
    portalItemKey(lot),
    portalItemName(lot),
    lot.varietyCode,
    lot.varietyName,
    lot.cropCode,
    lot.cropName,
    lot.lotNum
  ].filter(Boolean);

  for (const key of keys) {
    const mapped = mappings[key];
    if (typeof mapped === "string" && mapped.trim()) return mapped;
    if (mapped?.tallyItemName) return mapped;
  }

  return null;
}

function portalItemKey(lot = {}) {
  return lot.varietyCode || lot.varietyName || lot.cropCode || lot.cropName || lot.lotNum || "";
}

function portalItemName(lot = {}) {
  return lot.varietyName || lot.cropName || lot.lotNum || "SATHI Seed";
}

function tallyDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const parts = String(value).split(/[-/]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
  }
  return String(value).slice(0, 10).replace(/-/g, "");
}

function tallyReadableDate(value) {
  if (!value) return "";
  const parts = String(value).split(/[-/]/);
  if (parts.length !== 3) return String(value);
  const [day, month, year] = parts;
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthName = monthNames[Number(month) - 1];
  return monthName ? `${Number(day)}-${monthName}-${year}` : String(value);
}

function amount(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

function parseImportSummary(xml) {
  const created = Number(extractTagValues(xml, "CREATED")[0] || 0);
  const altered = Number(extractTagValues(xml, "ALTERED")[0] || 0);
  const deleted = Number(extractTagValues(xml, "DELETED")[0] || 0);
  const errors = Number(extractTagValues(xml, "ERRORS")[0] || 0);
  const lineErrors = extractTagValues(xml, "LINEERROR").filter(Boolean);
  const lastVoucher = extractTagValues(xml, "LASTVCHID")[0] || "";
  const lastMaster = extractTagValues(xml, "LASTMID")[0] || "";

  return {
    created,
    altered,
    deleted,
    errors,
    lineErrors,
    lastVoucher,
    lastMaster
  };
}

function importSucceeded(summary, xml) {
  if (summary.errors > 0 || summary.lineErrors.length) return false;
  if (summary.created > 0 || summary.altered > 0) return true;
  return !hasTallyErrors(xml);
}

function masterLineErrors(masterResult = {}) {
  return [
    ...(masterResult.createNameConflicts || []).map((item) => item.message),
    ...(masterResult.groupSummary?.lineErrors || []),
    ...(masterResult.unitSummary?.lineErrors || []),
    ...(masterResult.stockSummary?.lineErrors || [])
  ].filter(Boolean);
}

function extractTagValues(xml, tagName) {
  const safeTag = escapeRegExp(tagName);
  const pattern = new RegExp(`<${safeTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${safeTag}>`, "gi");
  const values = [];
  let match = pattern.exec(xml);

  while (match) {
    values.push(decodeXml(match[1].trim()));
    match = pattern.exec(xml);
  }

  return values;
}

function hasTallyErrors(xml) {
  return /<LINEERROR>|<ERRORS>[1-9]/i.test(xml);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function companyListEnvelope() {
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Company List</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Company List" ISMODIFY="No">
            <TYPE>Company</TYPE>
            <FETCH>Name</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
</BODY>
</ENVELOPE>`;
}

function licenseInfoEnvelope(parameter) {
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Function</TYPE>
    <ID>$$LicenseInfo</ID>
  </HEADER>
  <BODY>
    <DESC>
      <FUNCPARAMLIST>
        <PARAM>${escapeXml(parameter)}</PARAM>
      </FUNCPARAMLIST>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseFunctionResult(xml) {
  return extractTagValues(xml, "RESULT")[0] || "";
}

function normalizeTallySerialNumber(value) {
  const serialNumber = String(value || "").trim();
  return serialNumber && serialNumber !== "0" ? serialNumber : "";
}

function extractCompanyNames(xml) {
  const names = [];
  const regex = /<NAME(?:\s[^>]*)?>(.*?)<\/NAME>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const value = decodeXml(match[1]).trim();
    if (value && !names.includes(value)) names.push(value);
  }

  return names;
}

function decodeXml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function tallySetupMessage(url) {
  return `Tally is not reachable at ${url}. Open Tally Prime, keep the target company loaded, and enable HTTP/XML access on port 9000.`;
}
