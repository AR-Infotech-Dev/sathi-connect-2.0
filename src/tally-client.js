

import http from "node:http";
import https from "node:https";
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

  async checkVoucherExists(companyName, voucherNumber, options = {}) {
    await this.ensurePortReachable();
    const response = await this.request(voucherLookupEnvelope(companyName, voucherNumber));
    const lookup = parseVoucherLookup(response, voucherNumber, options);
    return {
      exists: lookup.exists,
      voucherFound: lookup.voucherFound,
      exactMatch: lookup.exactMatch,
      partial: lookup.partial,
      matches: lookup.matches,
      expectedRows: lookup.expectedRows,
      matchedRows: lookup.matchedRows,
      missingRows: lookup.missingRows,
      voucherCount: lookup.vouchers.length,
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
    const grnScopes = voucherTypes.filter((entry) => entry.scopeType === "grn");
    const salesByClientId = new Map();
    for (const sales of salesScopes) {
      const key = normalizeScopeClientId(sales.clientId);
      if (!key) continue;
      const mapped = salesByClientId.get(key) || [];
      mapped.push(sales);
      salesByClientId.set(key, mapped);
    }
    const grnByClientId = new Map();
    for (const grn of grnScopes) {
      const key = normalizeScopeClientId(grn.clientId);
      if (!key) continue;
      const mapped = grnByClientId.get(key) || [];
      mapped.push(grn);
      grnByClientId.set(key, mapped);
    }
    const licences = purchaseScopes.map((purchase) => {
      const sales = salesByClientId.get(normalizeScopeClientId(purchase.clientId)) || [];
      const grn = grnByClientId.get(normalizeScopeClientId(purchase.clientId)) || [];
      const salesVoucherTypeNames = [...new Set(sales.map((entry) => entry.name).filter(Boolean))];
      const grnVoucherTypeNames = [...new Set(grn.map((entry) => entry.name).filter(Boolean))];
      const licenceType = voucherTypeLicenceType(purchase.fields);
      const isCottonLicence = licenceType === "cotton";
      return {
        clientId: purchase.clientId,
        licenceType,
        isCottonLicence,
        purchaseVoucherTypeName: purchase.name,
        salesVoucherTypeName: salesVoucherTypeNames[0] || "",
        salesVoucherTypeNames,
        grnVoucherTypeName: grnVoucherTypeNames[0] || "",
        grnVoucherTypeNames,
        fields: normalizeScopeFields(purchase.fields),
        purchase,
        sales,
        grn,
        missingSales: !salesVoucherTypeNames.length
      };
    }).filter((entry) => entry.clientId || entry.purchaseVoucherTypeName);

    return {
      companyName,
      licences,
      purchaseScopes,
      salesScopes,
      grnScopes,
      voucherTypes,
      rawPreview: response.slice(0, 3000)
    };
  }

  async fetchVoucherTypes(companyName) {
    await this.ensurePortReachable();
    const response = await this.request(allVoucherTypeEnvelope(companyName));
    return {
      companyName,
      voucherTypes: parseAllVoucherTypes(response),
      rawPreview: response.slice(0, 2000)
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

  async fetchLedgers(companyName) {
    await this.ensurePortReachable();
    const response = await this.request(ledgerListEnvelope(companyName));
    return {
      companyName,
      ledgers: parseLedgers(response),
      rawPreview: response.slice(0, 2000)
    };
  }

  async fetchGodowns(companyName) {
    await this.ensurePortReachable();
    const response = await this.request(godownListEnvelope(companyName));
    return {
      companyName,
      godowns: parseGodowns(response),
      rawPreview: response.slice(0, 2000)
    };
  }

  async fetchPortalSalesVouchers(companyName, voucherTypeName, period = {}, options = {}) {
    await this.ensurePortReachable();
    const response = await this.request(salesVoucherListEnvelope(companyName, voucherTypeName));
    const stockItems = await this.readCurrentStockItems(companyName);
    const activeLicenceCode = normalizeScopeClientId(options.activeLicenceCode);
    const activeLicenceType = normalizeLicenceType(options.licenceType, options.isCottonSale);
    const vouchers = enrichSaleQuantitiesFromStockItems(
      filterVouchersByPeriod(parseSalesVouchers(response), period),
      stockItems
    ).map((voucher) => {
      const sathiRows = (voucher.inventory || []).filter(isSathiInventoryRow);
      const unassignedInventory = sathiRows.filter((row) => !normalizeScopeClientId(row.sathiCompanyLicenceNoS));
      const inventory = sathiRows.filter((row) => salesBatchMatchesScope(row, activeLicenceCode, activeLicenceType));
      return {
        ...voucher,
        inventory,
        unassignedInventory,
        licenceScopeBlocked: !inventory.length && unassignedInventory.length > 0,
        licenceScopeIssue: unassignedInventory.length ? `${unassignedInventory.length} SATHI batch row(s) have no assigned licence.` : ""
      };
    }).filter((voucher) => voucher.inventory.length || voucher.unassignedInventory.length);
    const ledgerResponse = await this.request(partyLedgerLicenseEnvelope(companyName));
    const partyDetails = parsePartyDetails(ledgerResponse);
    const isCottonSale = activeLicenceType === "cotton";
    return {
      companyName,
      voucherTypeName,
      isCottonSale,
      vouchers: vouchers.map((voucher) => {
        const buyerPartyName = String(voucher.partyName || "").trim();
        const partyNameKey = normalizeLookupValue(buyerPartyName);
        const matchedPartyEntry = Object.entries(partyDetails).find(([name]) => normalizeLookupValue(name) === partyNameKey);
        const party = partyDetails[buyerPartyName] || matchedPartyEntry?.[1] || {};
        const partyNameLedgerFound = Boolean(buyerPartyName && (partyDetails[buyerPartyName] || matchedPartyEntry));
        const licenceDecision = resolveSalesBuyerLicence(voucher, party, {
          isCottonSale,
          forceFarmer: !partyNameLedgerFound
        });
        return {
          ...voucher,
          activeLicenceCode,
          activeLicenceType,
          partyNameLedgerFound,
          cashFarmerSale: !partyNameLedgerFound,
          isCottonSale: licenceDecision.isCottonSale,
          buyerLicense: licenceDecision.buyerLicense,
          buyerCottonLicense: licenceDecision.buyerCottonLicense,
          buyerLicenseSource: licenceDecision.source,
          buyerLicenseStatus: licenceDecision.status,
          buyerLicenseNeedsSelection: licenceDecision.needsSelection,
          buyerLicenseMissing: licenceDecision.missing,
          buyerLicenseOptions: licenceDecision.seedOptions,
          buyerCottonLicenseOptions: licenceDecision.cottonOptions,
          buyerPartyType: licenceDecision.buyerType || party.partyType || "",
          partyDetails: party
        };
      }),
      rawPreview: response.slice(0, 2000)
    };
  }

  async fetchPortalSalesVouchersForTypes(companyName, voucherTypeNames = [], period = {}, options = {}) {
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
        isCottonSale: options.licenceType
          ? String(options.licenceType).toLowerCase() === "cotton"
          : Boolean(typeFlags[normalizeVoucherTypeName(name)]?.isCottonSale),
        activeLicenceCode: options.activeLicenceCode,
        licenceType: options.licenceType
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

  async fetchPurchaseLotTrace(companyName, voucherTypeName, lotNum) {
    await this.ensurePortReachable();
    const response = await this.request(purchaseLotTraceEnvelope(companyName, voucherTypeName));
    const trace = parsePurchaseLotTrace(response, lotNum);
    return {
      companyName,
      voucherTypeName,
      lotNum,
      trace,
      found: Boolean(trace),
      rawPreview: response.slice(0, 2000)
    };
  }

  async fetchGrnLotRows(companyName, voucherTypeName) {
    await this.ensurePortReachable();
    const response = await this.request(purchaseLotTraceEnvelope(companyName, voucherTypeName || "Receipt Note"));
    const rows = parsePurchaseLotTraceRows(response);
    return {
      companyName,
      voucherTypeName,
      rows,
      count: rows.length,
      rawPreview: response.slice(0, 2000)
    };
  }

  async fetchRojmelReport(companyName, period = {}, options = {}) {
    await this.ensurePortReachable();
    const filters = {
      companyName,
      fromDate: period.fromDate || "",
      toDate: period.toDate || "",
      rojmelLedgerMode: options.rojmelLedgerMode || "both",
      rojmelSearch: options.rojmelSearch || "",
      rojmelVoucherFilter: options.rojmelVoucherFilter || ""
    };
    const openingFromDate = options.rojmelOpeningFromDate || "2000-04-01";
    const [cashBankLedgers, vouchers] = await Promise.all([
      this.fetchRojmelCashBankLedgers(companyName, options),
      this.fetchRojmelVouchers(companyName, { fromDate: openingFromDate, toDate: filters.toDate || period.toDate || "" })
    ]);
    return buildRojmelReport({ filters, cashBankLedgers, vouchers });
  }

  async fetchRojmelCashBankLedgers(companyName, options = {}) {
    const roots = Array.isArray(options.rojmelLedgerGroups) && options.rojmelLedgerGroups.length
      ? options.rojmelLedgerGroups
      : ["Cash-in-Hand", "Bank Accounts", "Bank OCC A/c", "Bank OD A/c"];
    const [groupXml, ledgerXml] = await Promise.all([
      this.request(rojmelLedgerGroupsEnvelope(companyName)),
      this.request(rojmelLedgerMastersEnvelope(companyName))
    ]);
    const groups = parseRojmelGroups(groupXml);
    const ledgers = parseRojmelLedgerMasters(ledgerXml);
    const validGroups = new Set(roots.map(rojmelNormalizeName));
    for (const group of groups) {
      if (validGroups.has(rojmelNormalizeName(group.parent))) validGroups.add(rojmelNormalizeName(group.name));
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const group of groups) {
        const key = rojmelNormalizeName(group.name);
        if (!validGroups.has(key) && validGroups.has(rojmelNormalizeName(group.parent))) {
          validGroups.add(key);
          changed = true;
        }
      }
    }

    return ledgers.filter((ledger) => validGroups.has(rojmelNormalizeName(ledger.parent)));
  }

  async fetchRojmelVouchers(companyName, period = {}) {
    const response = await this.request(rojmelVoucherEnvelope(companyName, period.fromDate, period.toDate));
    return parseRojmelVouchers(response);
  }

  async fetchBatchExpiryReport(companyName, period = {}, options = {}) {
    await this.ensurePortReachable();
    const stockItems = await this.readCurrentStockItems(companyName);
    const voucherTypes = [
      { name: options.purchaseVoucherTypeName || "", movement: "in" },
      ...uniqueTextValues(options.grnVoucherTypeNames || []).map((name) => ({ name, movement: "in" })),
      ...uniqueTextValues(options.salesVoucherTypeNames || []).map((name) => ({ name, movement: "out" }))
    ].filter((item) => item.name);

    const results = [];
    for (const item of voucherTypes) {
      const response = await this.request(purchaseLotTraceEnvelope(companyName, item.name));
      results.push(...parseBatchExpiryVoucherRows(response, item.movement));
    }

    if (!results.length) {
      const response = await this.request(batchExpiryVoucherEnvelope(companyName));
      results.push(...parseBatchExpiryVoucherRows(response, ""));
    }

    const openingRows = parseStockItemOpeningBatchRows(stockItems);

    return buildBatchExpiryReport({
      rows: filterBatchExpiryRowsByPeriod([...openingRows, ...results], period),
      stockItems,
      period,
      voucherTypes
    });
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
            isCottonSale: voucherTypeCottonFlag(entry.fields)
          }
        ]));
    } catch {
      return {};
    }
  }

  async updateVoucherSathiFields(companyName, voucher = {}) {
    await this.ensurePortReachable();
    const masterId = String(voucher.masterId || "").trim();
    if (!masterId) {
      return {
        updated: false,
        skipped: true,
        usedHelper: false,
        message: "Tally master ID is required for SATHI sales status update.",
        summary: {
          created: 0,
          altered: 0,
          deleted: 0,
          errors: 1,
          lineErrors: ["Tally master ID is required for SATHI sales status update."],
          lastVoucher: "",
          lastMaster: ""
        },
        response: "",
        xmlPreview: ""
      };
    }

    const xml = voucherSathiFieldsEnvelope(companyName, {
      ...voucher,
      masterId
    });
    const response = await this.request(xml);
    const summary = parseImportSummary(response);
    const importConfirmed = summary.altered > 0 && summary.errors === 0 && !summary.lineErrors.length;
    const verificationResponse = importConfirmed
      ? await this.request(voucherSathiFieldsLookupEnvelope(companyName, masterId))
      : "";
    const verification = parseVoucherSathiFields(verificationResponse);
    const expectedStatus = String(voucher.sathiStatus || "").trim();
    const expectedVoucherNumber = String(voucher.sathiVchNo || "").trim();
    const verified = importConfirmed
      && (!expectedStatus || verification.sathiStatus === expectedStatus)
      && (!expectedVoucherNumber || verification.sathiVchNo === expectedVoucherNumber);

    return {
      updated: verified,
      usedHelper: false,
      method: "master-id-alter",
      message: verified
        ? "SATHI status and voucher number updated in Tally."
        : importConfirmed
          ? "Tally altered the voucher, but UDF read-back verification did not match."
          : "Tally did not confirm voucher alteration.",
      summary,
      verification
    };
  }

  async updateVoucherPortalPushRows(companyName, voucher = {}) {
    await this.ensurePortReachable();
    const masterId = String(voucher.masterId || "").trim();
    const rows = Array.isArray(voucher.rows) ? voucher.rows : [];
    if (!masterId) {
      return { updated: false, skipped: true, message: "Tally master ID is required for portal push row update.", matchedRows: 0 };
    }
    if (!rows.length) {
      return { updated: false, skipped: true, message: "No selected portal rows were provided for Tally update.", matchedRows: 0 };
    }

    const sourceResponse = await this.request(voucherForAlterEnvelope(companyName, masterId));
    const source = extractVoucherForAlter(sourceResponse, masterId);
    if (!source) throw new Error(`Voucher master ID ${masterId} was not found in Tally.`);

    const mutation = mutateVoucherPortalPushRowsXml(source, {
      rows,
      orderNo: voucher.sathiVchNo || voucher.portalOrderNo || "",
      pushedAt: voucher.pushedAt || new Date().toISOString(),
      result: voucher.sathiStatus || voucher.portalPushResult || "Success"
    });
    if (!mutation.changed) {
      return {
        updated: false,
        verified: false,
        matchedRows: mutation.matchedRows,
        message: "Selected sales batch rows were not found in this Tally voucher."
      };
    }

    const response = await this.request(voucherAlterImportEnvelope(companyName, source, mutation.innerXml));
    const summary = parseImportSummary(response);
    const updated = summary.altered > 0 && summary.created === 0 && summary.errors === 0 && !summary.lineErrors.length;
    if (!updated) {
      return {
        updated: false,
        verified: false,
        matchedRows: mutation.matchedRows,
        message: "Tally did not confirm portal push row update.",
        summary
      };
    }

    const verificationResponse = await this.request(voucherForAlterEnvelope(companyName, masterId));
    const verificationSource = extractVoucherForAlter(verificationResponse, masterId);
    const verifiedRows = countVerifiedPortalPushRows(verificationSource, rows, voucher.sathiVchNo || voucher.portalOrderNo || "");
    return {
      updated: true,
      verified: verifiedRows >= mutation.matchedRows,
      matchedRows: mutation.matchedRows,
      verifiedRows,
      message: verifiedRows >= mutation.matchedRows
        ? `${verifiedRows} selected sales batch row(s) marked as uploaded in Tally.`
        : `${mutation.matchedRows} row(s) altered in Tally. Read-back confirmed ${verifiedRows}; refresh if status looks stale.`,
      summary
    };
  }

  async fetchHistoricalBatchCandidates(companyName, options = {}) {
    await this.ensurePortReachable();
    const initialVoucherTypeNames = [...new Set((options.voucherTypeNames || [options.voucherTypeName])
      .map((name) => String(name || "").trim())
      .filter(Boolean))];
    const mode = String(options.mode || "purchase").trim().toLowerCase();
    const fallbackVoucherTypeName = mode === "sales" ? "Sales" : "Purchase";
    const voucherTypeNames = initialVoucherTypeNames.length ? initialVoucherTypeNames : [fallbackVoucherTypeName];
    const rows = [];
    for (const voucherTypeName of voucherTypeNames) {
      const response = await this.request(batchCorrectionCandidateEnvelope(companyName, voucherTypeName));
      rows.push(...parseBatchCorrectionCandidates(response));
    }

    const partyKey = normalizeLookupValue(options.partyLedgerName);
    const itemKeys = new Set((options.stockItemNames || [options.stockItemName]).map(normalizeItemLookupValue).filter(Boolean));
    const oldBatchKey = normalizeLookupValue(options.oldBatchName);
    const targetBatchKey = normalizeLookupValue(options.targetBatchName);
    const fromDate = normalizeTallyDateForCompare(options.fromDate);
    const toDate = normalizeTallyDateForCompare(options.toDate);
    const expectedQuantityByItem = new Map((options.expectedQuantities || [])
      .map((row) => [normalizeItemLookupValue(row.stockItemName || row.itemName || row.name), Number(row.quantity)])
      .filter(([key, quantity]) => key && Number.isFinite(quantity)));
    const eligibleRows = rows.filter((row) => {
      if (itemKeys.size && !itemKeys.has(normalizeItemLookupValue(row.stockItemName))) return false;
      if (oldBatchKey && normalizeLookupValue(row.batchName) !== oldBatchKey) return false;
      if (fromDate && normalizeTallyDateForCompare(row.date) < fromDate) return false;
      if (toDate && normalizeTallyDateForCompare(row.date) > toDate) return false;
      if (oldBatchKey) return true;
      if (targetBatchKey && normalizeLookupValue(row.batchName) === targetBatchKey) return false;
      if (mode === "purchase") return true;
      if (mode === "sales" && row.salesSathiFieldsPresent && !targetBatchKey) return false;
      if (targetBatchKey) return true;
      return mode === "sales" ? !row.salesSathiFieldsPresent : !row.purchaseSathiFieldsPresent;
    });
    const exactPartyRows = partyKey
      ? eligibleRows.filter((row) => normalizeLookupValue(row.partyLedgerName) === partyKey)
      : eligibleRows;
    const effectiveRows = exactPartyRows;
    const enrichedRows = effectiveRows.map((row) => {
      const expectedQuantity = expectedQuantityByItem.get(normalizeItemLookupValue(row.stockItemName));
      const quantityDifference = Number.isFinite(expectedQuantity) ? Number(row.quantity || 0) - expectedQuantity : null;
      const quantityMatched = Number.isFinite(expectedQuantity) ? Math.abs(quantityDifference) < 0.000001 : false;
      return {
        ...row,
        partyMatch: !partyKey || normalizeLookupValue(row.partyLedgerName) === partyKey,
        expectedQuantity: Number.isFinite(expectedQuantity) ? expectedQuantity : null,
        quantityDifference,
        quantityMatched
      };
    }).sort((a, b) => {
      if (a.quantityMatched !== b.quantityMatched) return a.quantityMatched ? -1 : 1;
      return String(b.date || "").localeCompare(String(a.date || ""));
    });
    const existingTargetQuantityByItem = mode === "sales" && targetBatchKey
      ? rows.reduce((totals, row) => {
          const itemKey = normalizeItemLookupValue(row.stockItemName);
          if (itemKeys.size && !itemKeys.has(itemKey)) return totals;
          if (normalizeLookupValue(row.batchName) !== targetBatchKey) return totals;
          totals[itemKey] = Number(totals[itemKey] || 0) + Math.abs(Number(row.quantity || 0));
          return totals;
        }, {})
      : {};
    return {
      companyName,
      mode,
      voucherTypeNames,
      scannedRows: rows.length,
      partyFallbackUsed: false,
      existingTargetQuantityByItem,
      rows: enrichedRows
    };
  }

  async relatedHistoricalVoucherTypeNames(companyName, mode, names = []) {
    const cleanedNames = uniqueTextValues(names);
    const related = [];
    try {
      const result = await this.fetchVoucherTypes(companyName);
      for (const row of result.voucherTypes || []) {
        const text = [row.name, row.parent, row.typeOfVoucher, row.basicVoucherTypeName].join(" ").toLowerCase();
        const isPurchaseType = mode === "purchase" && (
          normalizeLookupValue(row.basicVoucherTypeName) === "PURCHASE" ||
          normalizeLookupValue(row.typeOfVoucher) === "PURCHASE" ||
          normalizeLookupValue(row.parent) === "PURCHASE" ||
          /\bpurchase\b/.test(text)
        );
        const isSalesType = mode === "sales" && (
          normalizeLookupValue(row.basicVoucherTypeName) === "SALES" ||
          normalizeLookupValue(row.typeOfVoucher) === "SALES" ||
          normalizeLookupValue(row.parent) === "SALES" ||
          /\bsales?\b/.test(text)
        );
        if (isPurchaseType || isSalesType) related.push(row.name);
      }
    } catch {
      // Keep the selected voucher type path if Tally does not expose voucher type list.
    }
    const fallbackNames = mode === "purchase" ? ["Purchase", "Purchase New"] : ["Sales", "Sathi Sales"];
    return uniqueTextValues([...cleanedNames, ...related, ...fallbackNames]);
  }

  async alterVoucherBatch(companyName, change = {}) {
    await this.ensurePortReachable();
    const masterId = String(change.masterId || "").trim();
    if (!masterId) throw new Error("Tally master ID is required for batch alteration.");

    const sourceResponse = await this.request(voucherForAlterEnvelope(companyName, masterId));
    const source = extractVoucherForAlter(sourceResponse, masterId);
    if (!source) throw new Error(`Voucher master ID ${masterId} was not found in Tally.`);
    if (change.expectedAlterId && String(source.alterId || "") !== String(change.expectedAlterId)) {
      throw new Error("Voucher changed in Tally after it was loaded. Refresh the candidate list and try again.");
    }

    const mutation = mutateVoucherBatchXml(source, change);
    if (!mutation.changed) {
      if (mutation.blockedReason) throw new Error(mutation.blockedReason);
      throw new Error("The selected item and old batch were not found together in this voucher.");
    }

    const xml = voucherAlterImportEnvelope(companyName, source, mutation.innerXml);
    const response = await this.request(xml);
    const summary = parseImportSummary(response);
    const updated = summary.altered > 0 && summary.created === 0 && summary.errors === 0 && !summary.lineErrors.length;
    if (!updated) {
      return {
        updated: false,
        message: "Tally did not confirm the voucher alteration.",
        summary
      };
    }

    let verificationSource = null;
    let verified = false;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (attempt > 0) await delay(350 * attempt);
      const verificationResponse = await this.request(voucherForAlterEnvelope(companyName, masterId));
      verificationSource = extractVoucherForAlter(verificationResponse, masterId);
      verified = verifyVoucherBatchMutation(verificationSource, change);
      if (verified) break;
    }
    if (!verified) {
      const targetBatchFound = voucherBatchTargetFound(verificationSource, change);
      if (targetBatchFound) {
        return {
          updated: true,
          verified: true,
          weakVerification: true,
          message: "Voucher batch updated in Tally. Target batch was found on read-back; detailed UDF confirmation may need refresh.",
          summary,
          verification: {
            masterId,
            alterId: verificationSource?.alterId || "",
            voucherNumber: verificationSource?.voucherNumber || "",
            batchName: change.newBatchName || "",
            targetBatchFound
          }
        };
      }
      return {
        updated: false,
        verified: false,
        message: "Tally altered the voucher, but SATHI batch fields were not found on read-back. Do not treat this row as updated; refresh and retry.",
        summary,
        verification: {
          masterId,
          alterId: verificationSource?.alterId || "",
          voucherNumber: verificationSource?.voucherNumber || "",
          batchName: change.newBatchName || ""
        }
      };
    }
    return {
      updated: true,
      verified,
      message: "Voucher batch and SATHI fields updated in Tally.",
      summary,
      verification: {
        masterId,
        alterId: verificationSource?.alterId || "",
        voucherNumber: verificationSource?.voucherNumber || "",
        batchName: change.newBatchName || ""
      }
    };
  }

  async alterVoucherBuyerFields(companyName, change = {}) {
    await this.ensurePortReachable();
    const masterId = String(change.masterId || "").trim();
    if (!masterId) throw new Error("Tally master ID is required for buyer licence update.");

    const sourceResponse = await this.request(voucherForAlterEnvelope(companyName, masterId));
    const source = extractVoucherForAlter(sourceResponse, masterId);
    if (!source) throw new Error(`Voucher master ID ${masterId} was not found in Tally.`);

    const mutation = mutateVoucherBuyerFieldsXml(source, change);
    if (!mutation.changed) {
      return {
        updated: true,
        verified: true,
        message: "Buyer licence fields were already correct in Tally.",
        summary: { created: 0, altered: 0, deleted: 0, errors: 0, lineErrors: [] },
        verification: {
          masterId,
          voucherNumber: source.voucherNumber || ""
        }
      };
    }

    const xml = voucherAlterImportEnvelope(companyName, source, mutation.innerXml);
    const response = await this.request(xml);
    const summary = parseImportSummary(response);
    const updated = summary.altered > 0 && summary.created === 0 && summary.errors === 0 && !summary.lineErrors.length;
    if (!updated) {
      return {
        updated: false,
        verified: false,
        message: "Tally did not confirm buyer licence update.",
        summary
      };
    }

    const verificationResponse = await this.request(voucherForAlterEnvelope(companyName, masterId));
    const verificationSource = extractVoucherForAlter(verificationResponse, masterId);
    const verified = verifyVoucherBuyerFields(verificationSource, change);
    return {
      updated: true,
      verified,
      message: verified
        ? "Buyer type and licence fields updated in Tally."
        : "Voucher altered in Tally. Buyer licence read-back needs refresh.",
      summary,
      verification: {
        masterId,
        voucherNumber: verificationSource?.voucherNumber || source.voucherNumber || "",
        buyerType: change.buyerType || "",
        buyerLicence: change.buyerLicence || "",
        buyerCottonLicence: change.buyerCottonLicence || ""
      }
    };
  }

  async alterLedgerLicence(companyName, change = {}) {
    await this.ensurePortReachable();
    const ledgerName = String(change.ledgerName || "").trim();
    const kind = String(change.kind || "seed").trim().toLowerCase() === "cotton" ? "cotton" : "seed";
    const licence = cleanLicenceValue(change.licence);
    const site = String(change.site || "").trim();
    if (!ledgerName) throw new Error("Tally party ledger name is required for licence update.");
    if (!licence) throw new Error(`${kind === "cotton" ? "Cotton" : "Seed"} licence number is required.`);

    const mergedLicences = normaliseLicenceOptions([
      ...(Array.isArray(change.existingLicences) ? change.existingLicences : []),
      { licNo: licence, site }
    ]);
    const response = await this.request(ledgerLicenceAlterEnvelope(companyName, {
      ledgerName,
      kind,
      licences: mergedLicences
    }));
    const summary = parseImportSummary(response);
    const updated = summary.altered > 0 && summary.errors === 0 && !summary.lineErrors.length;
    if (!updated) {
      return {
        updated: false,
        verified: false,
        message: "Tally did not confirm party ledger licence update.",
        summary
      };
    }

    const verificationResponse = await this.request(partyLedgerLicenseEnvelope(companyName));
    const partyMap = parsePartyDetails(verificationResponse);
    const ledger = partyMap[ledgerName]
      || Object.values(partyMap).find((party) => normalizeLookupValue(party.name) === normalizeLookupValue(ledgerName))
      || {};
    const verified = normaliseLicenceOptions(kind === "cotton" ? ledger.cottonLicences : ledger.seedLicences)
      .some((option) => option.licNo.toUpperCase() === licence.toUpperCase());
    return {
      updated: true,
      verified,
      message: verified
        ? `${kind === "cotton" ? "Cotton" : "Seed"} licence saved in party ledger.`
        : "Party ledger altered in Tally. Licence read-back needs refresh.",
      summary,
      licences: mergedLicences
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
      stockUnitOverrides: Object.fromEntries((masterResult.items || []).map((item) => [item.name, item.unitName]).filter(([, unitName]) => unitName)),
      stockItemUnitPlans: Object.fromEntries((masterResult.items || []).map((item) => [item.name, item]).filter(([name]) => name))
    };
    const discountAmount = resolveDiscountAmount(bill);
    if (discountAmount > 0 && !mappingWithMasters.discountLedgerName) {
      mappingWithMasters.discountLedgerName = await this.findSathiDiscountLedger(companyName).catch(() => "");
    }
    if (discountAmount > 0 && !mappingWithMasters.discountLedgerName) {
      return {
        imported: false,
        summary: {
          created: 0,
          altered: 0,
          deleted: 0,
          errors: 1,
          lineErrors: ["Discount is present, but no Tally discount ledger with SATHI in Narration/Description was found."],
          lastVoucher: "",
          lastMaster: ""
        },
        masterResult,
        lineErrors: ["Discount is present, but no Tally discount ledger with SATHI in Narration/Description was found."],
        response: "",
        xmlPreview: ""
      };
    }
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

  async findSathiDiscountLedger(companyName) {
    const response = await this.request(sathiDiscountLedgerEnvelope(companyName));
    return parseSathiDiscountLedgerName(response);
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

    const cachedStockItems = Array.isArray(mapping.stockItems) ? mapping.stockItems.filter((item) => item?.name) : [];
    const currentStockItems = cachedStockItems.length ? cachedStockItems : await this.readCurrentStockItems(companyName);
    const items = lots.map((lot) => {
      const itemName = resolveStockItem(lot, mapping);
      const mapped = resolveMappedStockItemEntry(lot, mapping);
      const mappedTallyItemName = mappedExistingTallyItemName(lot, mapping);
      const currentItem = findStockItemExact(currentStockItems, itemName);
      const unitPlan = resolveItemUnitPlan(lot, mapped, currentItem, false);
      const sourceTaxDetails = currentItem || {};
      return {
        name: itemName,
        aliases: [...new Set([...(currentItem?.aliases || [])].filter(Boolean))],
        unitName: unitPlan.baseUnit,
        additionalUnit: "",
        conversion: unitPlan.conversion,
        denominator: unitPlan.denominator,
        quantityUnitName: unitPlan.quantityUnitName,
        existingMasterAliasOnly: false,
        hsnCode: sourceTaxDetails.hsnCode || "",
        hsnDetailsXml: sourceTaxDetails.hsnDetailsXml || "",
        gstRate: sourceTaxDetails.gstRate || 0,
        gstTaxability: sourceTaxDetails.gstTaxability || "Nil Rated",
        gstDetailsXml: sourceTaxDetails.gstDetailsXml || "",
        stockGroupName: currentItem?.parent || "",
        isPerishable: Boolean(currentItem?.isPerishable),
        createNew: false,
        isSathiItem: true,
        mappedTallyItemName,
        exists: Boolean(currentItem),
        skipMasterUpdate: false,
        createNameConflict: null,
        billDate: bill.billDate,
        expiryDate: lot.expiryDate || ""
      };
    });
    const createNameConflicts = items.map((item) => item.createNameConflict).filter(Boolean);
    const unitRequirementErrors = items.flatMap((item) => {
      if (!item.exists) {
        return [{
          itemName: item.name,
          message: `Mapped Tally item '${item.name}' was not found. Select an existing Tally stock item before push.`
        }];
      }
      if (!isCountUnit(item.unitName)) {
        return [{
          itemName: item.name,
          unitName: item.unitName,
          message: `Mapped Tally item '${item.name}' must use a count-based primary unit such as Nos, Pcs, No, Nug or Qty.`
        }];
      }
      return [];
    });
    if (createNameConflicts.length || unitRequirementErrors.length) {
      return {
        ok: false,
        stockGroups: [],
        units: [],
        items: items.map((item) => ({
          name: item.name,
          unitName: item.quantityUnitName || item.unitName,
          baseUnit: item.unitName,
          additionalUnit: item.additionalUnit,
          conversion: item.conversion,
          denominator: item.denominator
        })),
        groupSummary: null,
        unitSummary: null,
        stockSummary: null,
        createNameConflicts,
        unitRequirementErrors,
        aliasConflicts: [],
        groupResponsePreview: "",
        unitResponsePreview: "",
        stockResponsePreview: ""
      };
    }

    const units = [];
    const stockGroups = [];
    const groupResponse = "";
    const unitResponse = "";
    const stockResponse = "";
    const groupSummary = null;
    const unitSummary = null;
    const stockSummary = null;

    return {
      ok: true,
      stockGroups,
      units,
      items: items.map((item) => ({
        name: item.name,
        unitName: item.quantityUnitName || item.unitName,
        baseUnit: item.unitName,
        additionalUnit: item.additionalUnit,
        conversion: item.conversion,
        denominator: item.denominator
      })),
      groupSummary,
      unitSummary,
      stockSummary,
      aliasConflicts: [],
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
    return postXml(this.url, xml, this.timeoutMs);
  }

  async ensurePortReachable() {
    return true;
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
  "SATHI_TALLY_PURCHASE_LEDGER",
  "SATHI_TALLY_PURCHASE_GODOWN"
];

export const SATHI_VOUCHER_TYPE_UDF_NAMES = [
  "SATHI_VCHTYPE",
  "SATHI_VCHTYPESEED",
  "SATHI_VCHTYPESEEDS",
  "SATHI_VCHTYPESD",
  "SATHI_VCHTYPECTN",
  "SATHI_VCHTYPECOTTON",
  "SATHI_VCHTYPECOT",
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
  "SATHI_TALLY_PURCHASE_GODOWN",
  "SathiTxtFileLoc",
  "ISCottonSaleVTYP"
];

const SATHI_SEED_VOUCHER_TYPE_FLAG_NAMES = [
  "SATHI_VCHTYPESEED",
  "SATHI_VCHTYPESEEDS",
  "SATHI_VCHTYPESD",
  "SATHI_VCHTYPE"
];

const SATHI_COTTON_VOUCHER_TYPE_FLAG_NAMES = [
  "SATHI_VCHTYPECTN",
  "SATHI_VCHTYPECOTTON",
  "SATHI_VCHTYPECOT",
  "ISCottonSaleVTYP"
];

const PORTAL_SALE_TYPE_UDF_NAMES = [
  "SathiVchBuyerType",
  "SathiVchLicNo",
  "SathiVchLicNoCtn",
  "SathiVchLicNoCTN",
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

function allVoucherTypeEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = [
    "Name",
    "Parent",
    "VoucherTypeName",
    "TypeOfVoucher",
    "BasicVoucherTypeName"
  ].join(",");
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi All Voucher Types</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi All Voucher Types" ISMODIFY="No">
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

function parseAllVoucherTypes(xml) {
  const rows = [];
  const regex = /<VOUCHERTYPE\b([^>]*)>([\s\S]*?)<\/VOUCHERTYPE>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const attrs = match[1] || "";
    const block = match[2] || "";
    const name = decodeXml(attributeValue(attrs, "NAME") || extractTagValues(block, "NAME")[0] || extractTagValues(block, "VOUCHERTYPENAME")[0] || "").trim();
    if (!name) continue;
    rows.push({
      name,
      parent: extractTagValues(block, "PARENT")[0] || "",
      typeOfVoucher: extractTagValues(block, "TYPEOFVOUCHER")[0] || "",
      basicVoucherTypeName: extractTagValues(block, "BASICVOUCHERTYPENAME")[0] || ""
    });
  }

  return rows;
}

function resolveVoucherScopeType(entry) {
  const text = [entry.name, entry.parent, entry.typeOfVoucher, entry.basicType].join(" ").toLowerCase();
  if (text.includes("receipt") || text.includes("grn") || text.includes("delivery note")) return "grn";
  if (entry.fields.SATHI_CLIENTID && !entry.fields.SATHI_CLIENT_ID) return "sales";
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
    godownName: fields.SATHI_TALLY_PURCHASE_GODOWN || "",
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

function uniqueTextValues(values = []) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .map((value) => String(value || "").trim())
    .filter(Boolean))];
}

function isYes(value) {
  return ["YES", "Y", "TRUE", "1"].includes(String(value || "").trim().toUpperCase());
}

function firstTruthyField(fields = {}, names = []) {
  return names.some((name) => isYes(fields?.[name]));
}

function voucherTypeCottonFlag(fields = {}) {
  return firstTruthyField(fields, SATHI_COTTON_VOUCHER_TYPE_FLAG_NAMES);
}

function voucherTypeSeedFlag(fields = {}) {
  return firstTruthyField(fields, SATHI_SEED_VOUCHER_TYPE_FLAG_NAMES);
}

function voucherTypeLicenceType(fields = {}) {
  if (voucherTypeCottonFlag(fields)) return "cotton";
  if (voucherTypeSeedFlag(fields)) return "seed";
  return "seed";
}

function extractCompanyUdfValue(xml, name) {
  return extractAllUdfValues(xml, name)[0] || "";
}

function extractAllUdfValues(xml, name) {
  const escapedName = escapeRegExp(name);
  const patterns = [
    new RegExp(`<UDF:${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)</UDF:${escapedName}>`, "gi"),
    new RegExp(`<${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedName}>`, "gi"),
    new RegExp(`<UDF:[^>]+\\bDESC="[^"]*${escapedName}[^"]*"[^>]*>([\\s\\S]*?)</UDF:[^>]+>`, "gi")
  ];

  const values = [];
  for (const pattern of patterns) {
    let match = pattern.exec(xml);
    while (match) {
      values.push(decodeXml(match[1].trim()));
      match = pattern.exec(xml);
    }
  }

  return values;
}

function stripXmlTags(value) {
  return decodeXml(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function cleanLicenceValue(value) {
  const raw = String(value || "").trim();
  if (!raw || /<\s*\/?\s*UDF:/i.test(raw)) return "";
  const text = stripXmlTags(raw);
  const upper = text.toUpperCase();
  if (!text || ["YES", "Y", "TRUE", "1", "NO", "N", "FALSE", "0", "NOT APPLICABLE", "NA", "N/A", "-", "LIC NO.", "LIC NO", "SITE"].includes(upper)) return "";
  return text;
}

function cleanLicenceSiteValue(value) {
  const raw = String(value || "").trim();
  if (!raw || /<\s*\/?\s*UDF:/i.test(raw)) return "";
  const text = stripXmlTags(raw);
  const upper = text.toUpperCase();
  if (!text || ["YES", "Y", "TRUE", "1", "NO", "N", "FALSE", "0", "NOT APPLICABLE", "NA", "N/A", "-", "LIC NO.", "LIC NO", "SITE"].includes(upper)) return "";
  return text;
}

function normaliseLicenceOptions(options = []) {
  const seen = new Set();
  const values = Array.isArray(options) ? options : [options];
  return values.map((option) => {
    const licNo = cleanLicenceValue(typeof option === "string" ? option : option.licNo);
    if (!licNo) return null;
    const key = licNo.toUpperCase();
    if (seen.has(key)) return null;
    seen.add(key);
    return {
      licNo,
      site: cleanLicenceSiteValue(typeof option === "string" ? "" : option.site || "")
    };
  }).filter(Boolean);
}

function extractAggregateBlocks(xml, aggregateName) {
  const safeName = escapeRegExp(String(aggregateName || "").replace(/\.LIST$/i, ""));
  if (!safeName) return [];
  const pattern = new RegExp(`<(?:UDF:)?${safeName}(?:\\.LIST)?\\b[^>]*>([\\s\\S]*?)<\\/(?:UDF:)?${safeName}(?:\\.LIST)?>`, "gi");
  return [...String(xml || "").matchAll(pattern)].map((match) => match[1] || "");
}

function extractDirectUdfListValue(xml, name) {
  const escapedName = escapeRegExp(name);
  const listPattern = new RegExp(`<UDF:${escapedName}\\.LIST\\b[^>]*>([\\s\\S]*?)<\\/UDF:${escapedName}\\.LIST>`, "i");
  const listMatch = String(xml || "").match(listPattern);
  const source = listMatch ? listMatch[1] : String(xml || "");
  const valuePattern = new RegExp(`<UDF:${escapedName}\\b[^>]*>([\\s\\S]*?)<\\/UDF:${escapedName}>`, "i");
  const valueMatch = source.match(valuePattern);
  return valueMatch ? decodeXml(valueMatch[1].trim()) : "";
}

function extractLedgerLicenceOptions(block, aggregateName, licTag, siteTag, fallbackTag) {
  const options = [];
  for (const listBlock of extractAggregateBlocks(block, aggregateName)) {
    const licNo = cleanLicenceValue(extractDirectUdfListValue(listBlock, licTag) || firstNonEmpty(extractTagValues(listBlock, licTag)));
    const site = cleanLicenceSiteValue(extractDirectUdfListValue(listBlock, siteTag) || firstNonEmpty(extractTagValues(listBlock, siteTag)));
    if (licNo) options.push({ licNo, site });
  }

  const fallback = cleanLicenceValue(extractCompanyUdfValue(block, fallbackTag));
  if (fallback) options.push({ licNo: fallback, site: "" });
  return normaliseLicenceOptions(options);
}

function ledgerSathiLicenceInfo(block) {
  const seedOptions = extractLedgerLicenceOptions(block, "LedSeedsLicAggr", "SeedLicNo", "SeedLicSite", "SATHI_TALLY_PARTY_LIC");
  const cottonOptions = extractLedgerLicenceOptions(block, "LedCtnLicAggr", "CtnLicNo", "CtnLicSite", "SATHI_TALLY_PARTY_COTTON_LIC");
  const gstin = firstNonEmpty([
    ...extractTagValues(block, "PARTYGSTIN"),
    ...extractTagValues(block, "GSTIN"),
    ...extractTagValues(block, "GSTREGISTRATION"),
    extractCompanyUdfValue(block, "PARTYGSTIN"),
    extractCompanyUdfValue(block, "GSTIN")
  ]);
  const gstRegistrationType = firstNonEmpty([
    ...extractTagValues(block, "GSTREGISTRATIONTYPE"),
    ...extractTagValues(block, "PARTYGSTREGISTRATIONTYPE")
  ]);
  return {
    license: seedOptions[0]?.licNo || "",
    cottonLicense: cottonOptions[0]?.licNo || "",
    seedLicences: seedOptions,
    cottonLicences: cottonOptions,
    gstin: cleanLicenceValue(gstin),
    gstRegistrationType,
    hasGstin: Boolean(cleanLicenceValue(gstin)) || /regular/i.test(gstRegistrationType)
  };
}

function resolveSalesBuyerLicence(voucher = {}, party = {}, options = {}) {
  const itemText = (voucher.inventory || []).map((row) => [row.stockItemName, row.stockGroupName, row.stockCategory].filter(Boolean).join(" ")).join(" ");
  const itemLooksCotton = /\b(ctn|cotton|cottn)\b/i.test(itemText);
  const isCottonSale = Object.prototype.hasOwnProperty.call(options, "isCottonSale")
    ? Boolean(options.isCottonSale)
    : itemLooksCotton;
  const voucherBuyerType = String(voucher.voucherBuyerType || "").trim().toUpperCase();
  const partyType = String(party.partyType || "").trim().toUpperCase();
  const seedOptions = normaliseLicenceOptions(party.seedLicences || party.license || []);
  const cottonOptions = normaliseLicenceOptions(party.cottonLicences || party.cottonLicense || []);
  const voucherSeed = cleanLicenceValue(voucher.voucherBuyerLicense);
  const voucherCotton = cleanLicenceValue(voucher.voucherBuyerCottonLicense);
  const dealerEvidence = Boolean(party.hasGstin || seedOptions.length || cottonOptions.length || voucherSeed || voucherCotton);
  const isFarmer = Boolean(options.forceFarmer) || (!dealerEvidence && (voucherBuyerType === "FARMER" || partyType === "FARMER"));
  const buyerType = isFarmer ? "FARMER" : "DEALER";

  if (buyerType === "FARMER") {
    return {
      isCottonSale,
      buyerType,
      buyerLicense: "",
      buyerCottonLicense: "",
      source: "Farmer sale",
      status: "not-required",
      needsSelection: false,
      missing: false,
      seedOptions,
      cottonOptions
    };
  }

  const optionsForSale = isCottonSale ? cottonOptions : seedOptions;
  const voucherLicence = isCottonSale ? voucherCotton : voucherSeed;
  const autoLicence = voucherLicence || (optionsForSale.length === 1 ? optionsForSale[0].licNo : "");
  const needsSelection = !autoLicence && optionsForSale.length > 1;
  const missing = !autoLicence && optionsForSale.length === 0;
  return {
    isCottonSale,
    buyerType,
    buyerLicense: isCottonSale ? autoLicence : (voucherSeed || autoLicence),
    buyerCottonLicense: isCottonSale ? (voucherCotton || autoLicence) : voucherCotton,
    source: voucherLicence ? (isCottonSale ? "SathiVchLicNoCtn" : "SathiVchLicNo") : (autoLicence ? "Ledger licence list" : (needsSelection ? "Multiple ledger licences" : "Ledger licence missing")),
    status: autoLicence ? "ready" : (needsSelection ? "multiple" : "missing"),
    needsSelection,
    missing,
    seedOptions,
    cottonOptions
  };
}

function salesVoucherListEnvelope(companyName, voucherTypeName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = [
    "Date",
    "VoucherNumber",
    "Reference",
    "VoucherTypeName",
    "PartyName",
    "PartyLedgerName",
    "Address",
    "BasicBuyerAddress",
    "Amount",
    "RemoteID",
    "MasterID",
    "AlterID",
    "InventoryEntries",
    "AllInventoryEntries",
    "BatchAllocations",
    "SATHI_BatchNoS",
    "SATHI_ORIGINAL_OWNERS",
    "SATHI_PACKINGS",
    "SATHIIsCottonS",
    "SATHICMPLicNoS",
    "SATHI_PORTAL_PUSHED",
    "SATHI_PORTAL_ORDER_NO",
    "SATHI_PORTAL_PUSHED_AT",
    "SATHI_PORTAL_PUSH_RESULT",
    "SathiCustMobNo",
    "SathiStatus",
    "SathiVchNo",
    "SATHI_STATUS",
    "SATHI_BILL_NO",
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
            <FETCH>Name,Parent,GSTRegistrationType,PartyGSTIN,GSTIN,SATHI_TALLY_PARTY_LIC,LedSeedsLicAggr,SeedLicNo,SeedLicSite,SATHI_TALLY_PARTY_COTTON_LIC,LedCtnLicAggr,CtnLicNo,CtnLicSite,SATHI_TALLY_PARTY_TYPE,LEDBlockCode,LEDBlockName,LEDDisCode,LEDDiscName,LEDPlotNo,LEDVillCode,LEDVillName</FETCH>
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
  const masterId = String(voucher.masterId || "").trim();
  const date = tallyDate(voucher.date || new Date().toISOString().slice(0, 10));
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Import</TALLYREQUEST>
    <TYPE>Data</TYPE>
    <ID>Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>${companyBlock}</STATICVARIABLES>
    </DESC>
    <DATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER DATE="${date}" TAGNAME="MASTER ID" TAGVALUE="${escapeXml(masterId)}" ACTION="Alter" VCHTYPE="${escapeXml(voucherTypeName)}">
            ${voucherNumber ? `<VOUCHERNUMBER>${escapeXml(voucherNumber)}</VOUCHERNUMBER>` : ""}
            ${tallyStringUdfXml("SathiStatus", voucher.sathiStatus || "")}
            ${tallyStringUdfXml("SathiVchNo", voucher.sathiVchNo || "")}
          </VOUCHER>
        </TALLYMESSAGE>
    </DATA>
  </BODY>
</ENVELOPE>`;
}

function ledgerLicenceAlterEnvelope(companyName, change = {}) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const cotton = change.kind === "cotton";
  const logicalName = cotton ? "SATHI_TALLY_PARTY_COTTON_LIC" : "SATHI_TALLY_PARTY_LIC";
  const aggregateName = cotton ? "LedCtnLicAggr" : "LedSeedsLicAggr";
  const licenceName = cotton ? "CtnLicNo" : "SeedLicNo";
  const siteName = cotton ? "CtnLicSite" : "SeedLicSite";
  const aggregateTag = aggregateName.toUpperCase();
  const licenceTag = licenceName.toUpperCase();
  const siteTag = siteName.toUpperCase();
  const aggregateIndex = cotton ? "1621" : "1521";
  const licenceIndex = cotton ? "1623" : "1522";
  const siteIndex = cotton ? "1622" : "1523";
  const aggregateRows = normaliseLicenceOptions(change.licences || []).map((option) => `
            <UDF:${aggregateTag}.LIST DESC="\`${aggregateName}\`" INDEX="${aggregateIndex}">
              <UDF:${licenceTag}.LIST DESC="\`${licenceName}\`" ISLIST="YES" TYPE="String" INDEX="${licenceIndex}">
                <UDF:${licenceTag} DESC="\`${licenceName}\`">${escapeXml(option.licNo)}</UDF:${licenceTag}>
              </UDF:${licenceTag}.LIST>
              <UDF:${siteTag}.LIST DESC="\`${siteName}\`" ISLIST="YES" TYPE="String" INDEX="${siteIndex}">
                <UDF:${siteTag} DESC="\`${siteName}\`">${escapeXml(option.site || "")}</UDF:${siteTag}>
              </UDF:${siteTag}.LIST>
            </UDF:${aggregateTag}.LIST>`).join("");
  return `
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>${companyBlock}</STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${escapeXml(change.ledgerName)}" ACTION="Alter">
            <NAME>${escapeXml(change.ledgerName)}</NAME>
            ${tallyLogicalUdfXml(logicalName, true)}
            ${aggregateRows}
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function voucherSathiFieldsLookupEnvelope(companyName, masterId) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Voucher UDF Verification</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Voucher UDF Verification" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>MasterID,AlterID,VoucherNumber,VoucherTypeName,SathiStatus,SathiVchNo</FETCH>
            <FILTER>SathiVoucherMasterIdFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SathiVoucherMasterIdFilter">$MasterID = ${escapeXml(masterId)}</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseVoucherSathiFields(xml) {
  const voucherBlocks = [...String(xml || "").matchAll(/<VOUCHER\b[^>]*>([\s\S]*?)<\/VOUCHER>/gi)]
    .map((match) => match[1] || "");
  const voucherBlock = voucherBlocks.find((block) => (
    extractTagValues(block, "MASTERID").length
    || extractAllUdfValues(block, "SathiStatus").length
    || extractAllUdfValues(block, "SathiVchNo").length
  )) || "";
  return {
    found: Boolean(voucherBlock),
    masterId: firstNonEmpty(extractTagValues(voucherBlock, "MASTERID")).trim(),
    alterId: firstNonEmpty(extractTagValues(voucherBlock, "ALTERID")).trim(),
    voucherNumber: firstNonEmpty(extractTagValues(voucherBlock, "VOUCHERNUMBER")),
    voucherTypeName: firstNonEmpty(extractTagValues(voucherBlock, "VOUCHERTYPENAME")),
    sathiStatus: firstUdfValue(voucherBlock, ["SathiStatus"]),
    sathiVchNo: firstUdfValue(voucherBlock, ["SathiVchNo"])
  };
}

function batchCorrectionCandidateEnvelope(companyName, voucherTypeName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = [
    "MasterID",
    "AlterID",
    "Date",
    "VoucherNumber",
    "Reference",
    "VoucherTypeName",
    "PartyName",
    "PartyLedgerName",
    "PartyGSTIN",
    "ConsigneeGSTIN",
    "GSTRegistrationType",
    "PartyGSTRegistrationType",
    "PartyName",
    "AllInventoryEntries",
    "BatchAllocations",
    "StockItemName",
    "BilledQty",
    "ActualQty",
    "Rate",
    "Amount",
    "BatchName",
    "GodownName",
    "SATHI_ORIGINAL_OWNER",
    "SATHI_PACKING",
    "ISSATHI_BatchNo",
    "SATHIIsCotton",
    "SATHICMPLicNo",
    "SATHI_BatchNoS",
    "SATHI_ORIGINAL_OWNERS",
    "SATHI_PACKINGS",
    "SATHIIsCottonS",
    "SATHICMPLicNoS"
  ].join(",");
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Batch Correction Candidates</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Batch Correction Candidates" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>${escapeXml(fetchFields)}</FETCH>
            <FILTER>SathiBatchCorrectionVoucherTypeFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SathiBatchCorrectionVoucherTypeFilter">$VoucherTypeName = "${escapeXml(voucherTypeName)}"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseBatchCorrectionCandidates(xml) {
  const rows = [];
  const regex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[2] || "";
    const masterId = firstNonEmpty(extractTagValues(block, "MASTERID")).trim();
    if (!masterId) continue;
    const base = {
      masterId,
      alterId: firstNonEmpty(extractTagValues(block, "ALTERID")).trim(),
      voucherNumber: firstNonEmpty(extractTagValues(block, "VOUCHERNUMBER")) || firstNonEmpty(extractTagValues(block, "REFERENCE")),
      voucherTypeName: firstNonEmpty(extractTagValues(block, "VOUCHERTYPENAME")),
      date: firstNonEmpty(extractTagValues(block, "DATE")),
      partyName: firstNonEmpty(extractTagValues(block, "PARTYNAME")),
      partyLedgerName: firstNonEmpty(extractTagValues(block, "PARTYLEDGERNAME")) || firstNonEmpty(extractTagValues(block, "PARTYNAME"))
    };
    const inventoryBlocks = [...block.matchAll(/<(?:ALL)?INVENTORYENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/(?:ALL)?INVENTORYENTRIES\.LIST>/gi)]
      .map((entry) => entry[1] || "");
    for (const inventoryBlock of inventoryBlocks) {
      const stockItemName = firstNonEmpty(extractTagValues(inventoryBlock, "STOCKITEMNAME"));
      for (const batchBlock of extractListBlocks(inventoryBlock, "BATCHALLOCATIONS.LIST")) {
        const purchaseOriginalOwner = firstUdfValue(batchBlock, ["SATHI_ORIGINAL_OWNER"]);
        const purchasePacking = firstUdfValue(batchBlock, ["SATHI_PACKING", "SATHI_PACKING_SIZE"]);
        const purchaseFlag = firstUdfValue(batchBlock, ["ISSATHI_BatchNo"]);
        const purchaseIsCotton = firstUdfValue(batchBlock, ["SATHIIsCotton"]);
        const purchaseCompanyLicenceNo = firstUdfValue(batchBlock, ["SATHICMPLicNo"]);
        const salesBatchNo = firstUdfValue(batchBlock, ["SATHI_BatchNoS"]);
        const salesOriginalOwner = firstUdfValue(batchBlock, ["SATHI_ORIGINAL_OWNERS"]);
        const salesPacking = firstUdfValue(batchBlock, ["SATHI_PACKINGS"]);
        const salesIsCotton = firstUdfValue(batchBlock, ["SATHIIsCottonS"]);
        const salesCompanyLicenceNo = firstUdfValue(batchBlock, ["SATHICMPLicNoS"]);
        rows.push({
          ...base,
          stockItemName,
          batchName: firstNonEmpty(extractTagValues(batchBlock, "BATCHNAME")),
          godownName: firstNonEmpty(extractTagValues(batchBlock, "GODOWNNAME")),
          quantityText: firstNonEmpty(extractTagValues(batchBlock, "BILLEDQTY")) || firstNonEmpty(extractTagValues(batchBlock, "ACTUALQTY")),
          quantity: parseTallyQuantity(firstNonEmpty(extractTagValues(batchBlock, "BILLEDQTY")) || firstNonEmpty(extractTagValues(batchBlock, "ACTUALQTY"))),
          rate: firstNonEmpty(extractTagValues(inventoryBlock, "RATE")),
          amount: firstNonEmpty(extractTagValues(batchBlock, "AMOUNT")) || firstNonEmpty(extractTagValues(inventoryBlock, "AMOUNT")),
          purchaseSathiFieldsPresent: Boolean(purchaseOriginalOwner || purchasePacking || isYes(purchaseFlag) || purchaseCompanyLicenceNo || isYes(purchaseIsCotton)),
          salesSathiFieldsPresent: Boolean(salesBatchNo || salesOriginalOwner || salesPacking || salesCompanyLicenceNo || isYes(salesIsCotton)),
          purchaseIsCotton: isYes(purchaseIsCotton),
          purchaseCompanyLicenceNo,
          salesIsCotton: isYes(salesIsCotton),
          salesCompanyLicenceNo
        });
      }
    }
  }
  return rows;
}

function voucherForAlterEnvelope(companyName, masterId) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = [
    "*",
    "AllLedgerEntries",
    "LedgerEntries",
    "AllInventoryEntries",
    "InventoryEntries",
    "BatchAllocations",
    "AccountingAllocations",
    "BillAllocations",
    "Address",
    "BasicBuyerAddress",
    "InvoiceDeliveryNotes",
    "InvoiceOrderList",
    "ISSATHI_BatchNo",
    "SATHI_ORIGINAL_OWNER",
    "SATHI_PACKING",
    "SATHIIsCotton",
    "SATHICMPLicNo",
    "SATHI_BatchNoS",
    "SATHI_ORIGINAL_OWNERS",
    "SATHI_PACKINGS",
    "SATHIIsCottonS",
    "SATHICMPLicNoS"
  ].join(",");
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Voucher For Safe Alter</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Voucher For Safe Alter" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>${escapeXml(fetchFields)}</FETCH>
            <FILTER>SathiVoucherForAlterMasterIdFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SathiVoucherForAlterMasterIdFilter">$MasterID = ${escapeXml(masterId)}</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function extractVoucherForAlter(xml, masterId) {
  const wanted = String(masterId || "").trim();
  const matches = [...String(xml || "").matchAll(/<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi)];
  for (const match of matches) {
    const innerXml = match[2] || "";
    if (firstNonEmpty(extractTagValues(innerXml, "MASTERID")).trim() !== wanted) continue;
    return {
      attributes: match[1] || "",
      innerXml,
      masterId: wanted,
      alterId: firstNonEmpty(extractTagValues(innerXml, "ALTERID")).trim(),
      date: firstNonEmpty(extractTagValues(innerXml, "DATE")),
      voucherNumber: firstNonEmpty(extractTagValues(innerXml, "VOUCHERNUMBER")),
      voucherTypeName: firstNonEmpty(extractTagValues(innerXml, "VOUCHERTYPENAME")) || attributeValue(match[1], "VCHTYPE")
    };
  }
  return null;
}

function mutateVoucherBatchXml(source, change = {}) {
  const wantedItem = normalizeItemLookupValue(change.stockItemName);
  const wantedBatch = normalizeLookupValue(change.oldBatchName);
  let changed = false;
  let blockedReason = "";
  let innerXml = stripVoucherIdentityTags(source.innerXml);
  innerXml = innerXml.replace(/<(?:ALL)?INVENTORYENTRIES\.LIST\b[^>]*>[\s\S]*?<\/(?:ALL)?INVENTORYENTRIES\.LIST>/gi, (inventoryXml) => {
    if (normalizeItemLookupValue(firstNonEmpty(extractTagValues(inventoryXml, "STOCKITEMNAME"))) !== wantedItem) return inventoryXml;
    return inventoryXml.replace(/<BATCHALLOCATIONS\.LIST\b[^>]*>[\s\S]*?<\/BATCHALLOCATIONS\.LIST>/gi, (batchXml) => {
      const currentBatch = firstNonEmpty(extractTagValues(batchXml, "BATCHNAME"));
      if (wantedBatch && normalizeLookupValue(currentBatch) !== wantedBatch) return batchXml;
      const mode = String(change.mode || "purchase").trim().toLowerCase();
      const alreadyTagged = mode === "sales"
        ? Boolean(
            firstUdfValue(batchXml, ["SATHI_BatchNoS"]) ||
            firstUdfValue(batchXml, ["SATHI_ORIGINAL_OWNERS"]) ||
            firstUdfValue(batchXml, ["SATHI_PACKINGS"]) ||
            firstUdfValue(batchXml, ["SATHICMPLicNoS"]) ||
            isYes(firstUdfValue(batchXml, ["SATHIIsCottonS"]))
          )
        : Boolean(
            firstUdfValue(batchXml, ["SATHI_ORIGINAL_OWNER"]) ||
            firstUdfValue(batchXml, ["SATHI_PACKING", "SATHI_PACKING_SIZE"]) ||
            firstUdfValue(batchXml, ["SATHICMPLicNo"]) ||
            isYes(firstUdfValue(batchXml, ["SATHIIsCotton"])) ||
            isYes(firstUdfValue(batchXml, ["ISSATHI_BatchNo"]))
          );
      if (alreadyTagged && !change.allowOverwriteSathiBatch) {
        blockedReason = "This batch already has SATHI fields. Existing SATHI batch data was not overwritten.";
        return batchXml;
      }
      changed = true;
      let next = batchXml.replace(/<BATCHNAME\b[^>]*>[\s\S]*?<\/BATCHNAME>/i, `<BATCHNAME>${escapeXml(change.newBatchName || currentBatch)}</BATCHNAME>`);
      const udfValues = mode === "sales"
        ? [
            ["SATHI_BatchNoS", change.newBatchName || currentBatch, "string"],
            ["SATHI_ORIGINAL_OWNERS", change.originalOwner || "", "string"],
            ["SATHI_PACKINGS", change.packingSize || "", "string"],
            ["SATHIIsCottonS", Boolean(change.sathiIsCotton), "logical"],
            ["SATHICMPLicNoS", change.sathiCompanyLicenceNo || "", "string"]
          ]
        : [
            ["SATHI_ORIGINAL_OWNER", change.originalOwner || "", "string"],
            ["SATHI_PACKING", change.packingSize || "", "string"],
            ["ISSATHI_BatchNo", true, "logical"],
            ["SATHIIsCotton", Boolean(change.sathiIsCotton), "logical"],
            ["SATHICMPLicNo", change.sathiCompanyLicenceNo || "", "string"]
          ];
      for (const [name, value, type] of udfValues) {
        next = removeUdfXml(next, name);
        const udfXml = type === "logical" ? tallyLogicalUdfXml(name, value) : tallyStringUdfXml(name, value);
        next = next.replace(/<\/BATCHALLOCATIONS\.LIST>\s*$/i, `${udfXml}</BATCHALLOCATIONS.LIST>`);
      }
      return next;
    });
  });
  if (changed && String(change.mode || "").toLowerCase() === "sales") {
    if (Object.prototype.hasOwnProperty.call(change, "buyerType")) {
      innerXml = removeUdfXml(innerXml, "SathiVchBuyerType");
      if (change.buyerType) innerXml += tallyStringUdfXml("SathiVchBuyerType", change.buyerType);
    }
    if (Object.prototype.hasOwnProperty.call(change, "buyerLicence")) {
      innerXml = removeUdfXml(innerXml, "SathiVchLicNo");
      if (change.buyerLicence) innerXml += tallyStringUdfXml("SathiVchLicNo", change.buyerLicence);
    }
    if (Object.prototype.hasOwnProperty.call(change, "buyerCottonLicence")) {
      innerXml = removeUdfXml(innerXml, "SathiVchLicNoCtn");
      innerXml = removeUdfXml(innerXml, "SathiVchLicNoCTN");
      if (change.buyerCottonLicence) innerXml += tallyStringUdfXml("SathiVchLicNoCtn", change.buyerCottonLicence);
    }
  }
  if (changed && String(change.mode || "purchase").toLowerCase() === "purchase") {
    if (change.sathiStatus) {
      innerXml = removeUdfXml(innerXml, "SathiStatus");
      innerXml += tallyStringUdfXml("SathiStatus", change.sathiStatus);
    }
    if (change.sathiVchNo) {
      const mergedSathiVchNo = mergeCsvValue(firstUdfValue(innerXml, ["SathiVchNo"]), change.sathiVchNo);
      innerXml = removeUdfXml(innerXml, "SathiVchNo");
      innerXml += tallyStringUdfXml("SathiVchNo", mergedSathiVchNo);
    }
  }
  return { changed, innerXml, blockedReason };
}

function mutateVoucherBuyerFieldsXml(source, change = {}) {
  let changed = false;
  let innerXml = stripVoucherIdentityTags(source.innerXml);
  const updates = [
    ["SathiVchBuyerType", change.buyerType],
    ["SathiVchLicNo", change.buyerLicence]
  ];

  for (const [name, value] of updates) {
    const nextValue = String(value || "").trim();
    const currentValue = String(firstDirectUdfValue(innerXml, [name]) || "").trim();
    if (currentValue === nextValue) continue;
    innerXml = removeUdfXml(innerXml, name);
    if (nextValue) innerXml += tallyStringUdfXml(name, nextValue);
    changed = true;
  }

  const cottonValue = String(change.buyerCottonLicence || "").trim();
  const currentCotton = String(firstDirectUdfValue(innerXml, ["SathiVchLicNoCtn", "SathiVchLicNoCTN"]) || "").trim();
  if (currentCotton !== cottonValue) {
    innerXml = removeUdfXml(innerXml, "SathiVchLicNoCtn");
    innerXml = removeUdfXml(innerXml, "SathiVchLicNoCTN");
    if (cottonValue) innerXml += tallyStringUdfXml("SathiVchLicNoCtn", cottonValue);
    changed = true;
  }

  return { changed, innerXml };
}

function mutateVoucherPortalPushRowsXml(source, update = {}) {
  const wantedRows = (Array.isArray(update.rows) ? update.rows : [])
    .map((row) => ({
      itemKey: normalizeItemLookupValue(row.stockItemName),
      batchKey: normalizeLookupValue(row.batchName || row.lotNum || row.salesBatchNo),
      orderNo: update.orderNo || row.portalOrderNo || "",
      pushedAt: update.pushedAt || "",
      result: update.result || ""
    }))
    .filter((row) => row.itemKey && row.batchKey);
  let changed = false;
  let matchedRows = 0;
  let innerXml = stripVoucherIdentityTags(source.innerXml);
  innerXml = innerXml.replace(/<(?:ALL)?INVENTORYENTRIES\.LIST\b[^>]*>[\s\S]*?<\/(?:ALL)?INVENTORYENTRIES\.LIST>/gi, (inventoryXml) => {
    const itemKey = normalizeItemLookupValue(firstNonEmpty(extractTagValues(inventoryXml, "STOCKITEMNAME")));
    const matchesForItem = wantedRows.filter((row) => row.itemKey === itemKey);
    if (!matchesForItem.length) return inventoryXml;
    return inventoryXml.replace(/<BATCHALLOCATIONS\.LIST\b[^>]*>[\s\S]*?<\/BATCHALLOCATIONS\.LIST>/gi, (batchXml) => {
      const batchKey = normalizeLookupValue(firstNonEmpty(extractTagValues(batchXml, "BATCHNAME")));
      const match = matchesForItem.find((row) => row.batchKey === batchKey);
      if (!match) return batchXml;
      matchedRows += 1;
      changed = true;
      let next = batchXml;
      const udfValues = [
        ["SATHI_PORTAL_PUSHED", true, "logical"],
        ["SATHI_PORTAL_ORDER_NO", match.orderNo || "", "string"],
        ["SATHI_PORTAL_PUSHED_AT", match.pushedAt || "", "string"],
        ["SATHI_PORTAL_PUSH_RESULT", match.result || "", "string"]
      ];
      for (const [name, value, type] of udfValues) {
        next = removeUdfXml(next, name);
        const udfXml = type === "logical" ? tallyLogicalUdfXml(name, value) : tallyStringUdfXml(name, value);
        next = next.replace(/<\/BATCHALLOCATIONS\.LIST>\s*$/i, `${udfXml}</BATCHALLOCATIONS.LIST>`);
      }
      return next;
    });
  });
  return { changed, innerXml, matchedRows };
}

function countVerifiedPortalPushRows(source, rows = [], orderNo = "") {
  if (!source) return 0;
  const wantedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      itemKey: normalizeItemLookupValue(row.stockItemName),
      batchKey: normalizeLookupValue(row.batchName || row.lotNum || row.salesBatchNo)
    }))
    .filter((row) => row.itemKey && row.batchKey);
  let verified = 0;
  const inventoryBlocks = [...source.innerXml.matchAll(/<(?:ALL)?INVENTORYENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/(?:ALL)?INVENTORYENTRIES\.LIST>/gi)]
    .map((entry) => entry[1] || "");
  for (const wanted of wantedRows) {
    const found = inventoryBlocks.some((inventoryBlock) => {
      if (normalizeItemLookupValue(firstNonEmpty(extractTagValues(inventoryBlock, "STOCKITEMNAME"))) !== wanted.itemKey) return false;
      return extractListBlocks(inventoryBlock, "BATCHALLOCATIONS.LIST").some((batchBlock) => (
        normalizeLookupValue(firstNonEmpty(extractTagValues(batchBlock, "BATCHNAME"))) === wanted.batchKey
        && isYes(firstUdfValue(batchBlock, ["SATHI_PORTAL_PUSHED"]))
        && (!orderNo || firstUdfValue(batchBlock, ["SATHI_PORTAL_ORDER_NO"]) === String(orderNo || ""))
      ));
    });
    if (found) verified += 1;
  }
  return verified;
}

function verifyVoucherBuyerFields(source, change = {}) {
  if (!source) return false;
  const block = source.innerXml || "";
  const expectedBuyerType = String(change.buyerType || "").trim();
  const expectedSeed = String(change.buyerLicence || "").trim();
  const expectedCotton = String(change.buyerCottonLicence || "").trim();
  const actualBuyerType = String(firstDirectUdfValue(block, ["SathiVchBuyerType"]) || "").trim();
  const actualSeed = String(firstDirectUdfValue(block, ["SathiVchLicNo"]) || "").trim();
  const actualCotton = String(firstDirectUdfValue(block, ["SathiVchLicNoCtn", "SathiVchLicNoCTN"]) || "").trim();
  return actualBuyerType === expectedBuyerType && actualSeed === expectedSeed && actualCotton === expectedCotton;
}

function mergeCsvValue(current, next) {
  const values = String(current || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const incoming = String(next || "").trim();
  if (incoming && !values.includes(incoming)) values.push(incoming);
  return values.join(", ");
}

function stripVoucherIdentityTags(xml) {
  return String(xml || "").replace(/<(MASTERID|ALTERID|GUID|REMOTEID|VCHKEY)\b[^>]*>[\s\S]*?<\/\1>/gi, "");
}

function removeUdfXml(xml, name) {
  const escaped = escapeRegExp(name);
  return String(xml || "")
    .replace(new RegExp(`<UDF:${escaped}\\.LIST\\b[^>]*>[\\s\\S]*?<\\/UDF:${escaped}\\.LIST>`, "gi"), "")
    .replace(new RegExp(`<UDF:${escaped}\\b[^>]*>[\\s\\S]*?<\\/UDF:${escaped}>`, "gi"), "")
    .replace(new RegExp(`<${escaped}\\.LIST\\b[^>]*>[\\s\\S]*?<\\/${escaped}\\.LIST>`, "gi"), "")
    .replace(new RegExp(`<${escaped}\\b[^>]*>[\\s\\S]*?<\\/${escaped}>`, "gi"), "");
}

function voucherAlterImportEnvelope(companyName, source, innerXml) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>${companyBlock}</STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER DATE="${escapeXml(source.date)}" TAGNAME="MASTER ID" TAGVALUE="${escapeXml(source.masterId)}" ACTION="Alter" VCHTYPE="${escapeXml(source.voucherTypeName)}">${innerXml}</VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

function verifyVoucherBatchMutation(source, change = {}) {
  if (!source) return false;
  const wantedItem = normalizeItemLookupValue(change.stockItemName);
  const wantedBatch = normalizeLookupValue(change.newBatchName);
  const inventoryBlocks = [...source.innerXml.matchAll(/<(?:ALL)?INVENTORYENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/(?:ALL)?INVENTORYENTRIES\.LIST>/gi)]
    .map((entry) => entry[1] || "");
  for (const inventoryBlock of inventoryBlocks) {
    if (normalizeItemLookupValue(firstNonEmpty(extractTagValues(inventoryBlock, "STOCKITEMNAME"))) !== wantedItem) continue;
    for (const batchBlock of extractListBlocks(inventoryBlock, "BATCHALLOCATIONS.LIST")) {
      if (normalizeLookupValue(firstNonEmpty(extractTagValues(batchBlock, "BATCHNAME"))) !== wantedBatch) continue;
      const mode = String(change.mode || "purchase").trim().toLowerCase();
      if (mode === "sales") {
        return firstUdfValue(batchBlock, ["SATHI_BatchNoS"]) === String(change.newBatchName || "")
          && firstUdfValue(batchBlock, ["SATHI_ORIGINAL_OWNERS"]) === String(change.originalOwner || "")
          && firstUdfValue(batchBlock, ["SATHI_PACKINGS"]) === String(change.packingSize || "")
          && isYes(firstUdfValue(batchBlock, ["SATHIIsCottonS"])) === Boolean(change.sathiIsCotton)
          && firstUdfValue(batchBlock, ["SATHICMPLicNoS"]) === String(change.sathiCompanyLicenceNo || "");
      }
      const batchVerified = firstUdfValue(batchBlock, ["SATHI_ORIGINAL_OWNER"]) === String(change.originalOwner || "")
        && firstUdfValue(batchBlock, ["SATHI_PACKING"]) === String(change.packingSize || "")
        && isYes(firstUdfValue(batchBlock, ["ISSATHI_BatchNo"]))
        && isYes(firstUdfValue(batchBlock, ["SATHIIsCotton"])) === Boolean(change.sathiIsCotton)
        && firstUdfValue(batchBlock, ["SATHICMPLicNo"]) === String(change.sathiCompanyLicenceNo || "");
      const statusVerified = !change.sathiStatus || firstUdfValue(source.innerXml, ["SathiStatus"]) === String(change.sathiStatus);
      const voucherVerified = !change.sathiVchNo || firstUdfValue(source.innerXml, ["SathiVchNo"]) === String(change.sathiVchNo);
      return batchVerified && statusVerified && voucherVerified;
    }
  }
  return false;
}

function voucherBatchTargetFound(source, change = {}) {
  if (!source) return false;
  const wantedItem = normalizeItemLookupValue(change.stockItemName);
  const wantedBatch = normalizeLookupValue(change.newBatchName);
  if (!wantedItem || !wantedBatch) return false;
  const inventoryBlocks = [...source.innerXml.matchAll(/<(?:ALL)?INVENTORYENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/(?:ALL)?INVENTORYENTRIES\.LIST>/gi)]
    .map((entry) => entry[1] || "");
  return inventoryBlocks.some((inventoryBlock) => {
    if (normalizeItemLookupValue(firstNonEmpty(extractTagValues(inventoryBlock, "STOCKITEMNAME"))) !== wantedItem) return false;
    return extractListBlocks(inventoryBlock, "BATCHALLOCATIONS.LIST").some((batchBlock) => (
      normalizeLookupValue(firstNonEmpty(extractTagValues(batchBlock, "BATCHNAME"))) === wantedBatch
    ));
  });
}

function purchaseLotTraceEnvelope(companyName, voucherTypeName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = [
    "Date",
    "VoucherNumber",
    "Reference",
    "VoucherTypeName",
    "PartyLedgerName",
    "AllInventoryEntries",
    "BatchAllocations",
    "StockItemName",
    "BilledQty",
    "ActualQty",
    "Rate",
    "Amount",
    "GodownName",
    "DestinationGodownName",
    "BatchName",
    "ExpiryPeriod",
    "MfdOn",
    "SATHI_ORIGINAL_OWNER",
    "SATHI_PACKING",
    "SATHI_PACKING_SIZE",
    "SATHI_PACKINGSIZE",
    "SATHIIsCotton",
    "SATHICMPLicNo"
  ].join(",");
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Purchase Lot Trace</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Purchase Lot Trace" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>${escapeXml(fetchFields)}</FETCH>
            <FILTER>SathiPurchaseLotTraceVoucherTypeFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SathiPurchaseLotTraceVoucherTypeFilter">$VoucherTypeName = "${escapeXml(voucherTypeName || "Purchase")}"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseSalesVouchers(xml) {
  const vouchers = [];
  const regex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[2];
    const vchKey = attributeValue(match[1], "VCHKEY") || "";
    const remoteId = attributeValue(match[1], "REMOTEID") || extractTagValues(block, "REMOTEID")[0] || "";
    const masterId = extractTagValues(block, "MASTERID")[0] || "";
    const voucherNumber = extractTagValues(block, "VOUCHERNUMBER")[0] || vchKey || "";
    const inventory = parseVoucherInventory(block);
    const buyerAddressLines = uniqueTextValues([
      ...extractTagValues(block, "BASICBUYERADDRESS"),
      ...extractTagValues(block, "ADDRESS")
    ]);
    vouchers.push({
      voucherNumber,
      voucherKey: vchKey,
      remoteId,
      masterId: String(masterId || "").trim(),
      reference: extractTagValues(block, "REFERENCE")[0] || "",
      date: extractTagValues(block, "DATE")[0] || "",
      voucherTypeName: extractTagValues(block, "VOUCHERTYPENAME")[0] || "",
      partyName: extractTagValues(block, "PARTYNAME")[0] || "",
      partyLedgerName: extractTagValues(block, "PARTYLEDGERNAME")[0] || "",
      buyerAddress: buyerAddressLines[0] || "",
      buyerAddressLines,
      partyGstin: firstNonEmpty([
        ...extractTagValues(block, "PARTYGSTIN"),
        ...extractTagValues(block, "CONSIGNEEGSTIN"),
        ...extractTagValues(block, "GSTIN")
      ]),
      partyGstRegistrationType: firstNonEmpty([
        ...extractTagValues(block, "PARTYGSTREGISTRATIONTYPE"),
        ...extractTagValues(block, "GSTREGISTRATIONTYPE")
      ]),
      amount: firstNonEmpty(extractTagValues(block, "AMOUNT")) || "",
      sathiStatus: firstUdfValue(block, ["SathiStatus", "SATHI_STATUS"]),
      sathiVchNo: firstUdfValue(block, ["SathiVchNo", "SATHI_BILL_NO"]),
      sellerRole: firstUdfValue(block, ["SATHI_SELLER_TYPE", "SATHI_SELLER_ROLE"]),
      customerMobileNo: firstUdfValue(block, ["SathiCustMobNo", "SATHI_CUST_MOB_NO", "SATHI_CUSTOMER_MOBILE_NO"]),
      voucherBuyerType: firstUdfValue(block, ["SathiVchBuyerType"]),
      voucherBuyerLicense: firstDirectUdfValue(block, ["SathiVchLicNo", "SATHI_VCH_LIC_NO", "SATHI_BUYER_LIC_NO"]),
      voucherBuyerCottonLicense: firstDirectUdfValue(block, ["SathiVchLicNoCtn", "SathiVchLicNoCTN", "SATHI_VCH_LIC_NO_CTN", "SATHI_BUYER_COTTON_LIC_NO"]),
      buyerRole: firstUdfValue(block, ["SathiVchBuyerType", "SATHI_BUYER_TYPE", "SATHI_BUYER_ROLE"]),
      saleType: firstUdfValue(block, ["SATHI_SALE_TYPE"]),
      isRetailSell: firstUdfValue(block, ["SATHI_IS_RETAIL_SELL", "SATHI_RETAIL_SELL"]),
      inventory,
      status: inventory.length ? "Ready" : "Needs item details"
    });
  }

  return vouchers.filter((voucher) => voucher.voucherNumber || voucher.reference || voucher.partyLedgerName);
}

function parsePurchaseLotTrace(xml, lotNum) {
  const wantedLot = normalizeLookupValue(lotNum);
  if (!wantedLot) return null;

  const matches = [];
  const regex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[2];
    const voucherNumber = extractTagValues(block, "VOUCHERNUMBER")[0] || extractTagValues(block, "REFERENCE")[0] || attributeValue(match[1], "VCHKEY") || "";
    const voucherDate = extractTagValues(block, "DATE")[0] || "";
    const partyLedgerName = extractTagValues(block, "PARTYLEDGERNAME")[0] || extractTagValues(block, "PARTYNAME")[0] || "";
    const inventory = parseVoucherInventory(block);

    for (const item of inventory) {
      if (normalizeLookupValue(item.lotNum) !== wantedLot) continue;
      matches.push({
        companyName: "",
        lotNum: item.lotNum,
        stockItemName: item.stockItemName,
        portalItemName: item.stockItemName,
        packingSize: item.packingSize || "",
        originalOwner: item.originalOwner || "",
        supplierName: partyLedgerName,
        inwardVoucherNumber: voucherNumber,
        inwardDate: voucherDate,
        buyerCode: "",
        source: "tally-purchase-voucher"
      });
    }
  }

  return matches.find((row) => row.originalOwner || row.packingSize) || matches[0] || null;
}

function parsePurchaseLotTraceRows(xml) {
  const rows = [];
  const regex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[2];
    const voucherNumber = extractTagValues(block, "VOUCHERNUMBER")[0] || extractTagValues(block, "REFERENCE")[0] || attributeValue(match[1], "VCHKEY") || "";
    const date = extractTagValues(block, "DATE")[0] || "";
    const voucherTypeName = extractTagValues(block, "VOUCHERTYPENAME")[0] || "";
    const partyLedgerName = extractTagValues(block, "PARTYLEDGERNAME")[0] || extractTagValues(block, "PARTYNAME")[0] || "";
    const inventory = parseVoucherInventory(block);

    for (const item of inventory) {
      if (!item.lotNum) continue;
      rows.push({
        voucherNumber,
        date,
        voucherTypeName,
        partyLedgerName,
        lotNum: item.lotNum,
        stockItemName: item.stockItemName,
        quantityText: item.quantityText,
        quantity: item.quantity,
        originalOwner: item.originalOwner || "",
        packingSize: item.packingSize || "",
        amount: item.amount || "",
        rate: item.rate || ""
      });
    }
  }

  return rows;
}

function parseVoucherInventory(xml) {
  const rows = [];
  const regex = /<(?:ALL)?INVENTORYENTRIES\.LIST\b[^>]*>([\s\S]*?)<\/(?:ALL)?INVENTORYENTRIES\.LIST>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[1];
    const batchBlocks = extractListBlocks(block, "BATCHALLOCATIONS.LIST");
    if (batchBlocks.length) {
      rows.push(...batchBlocks.map((batchBlock) => voucherInventoryRow(block, batchBlock)));
    } else {
      rows.push(voucherInventoryRow(block, ""));
    }
  }

  return rows.filter((row) => row.stockItemName || row.lotNum || row.quantityText);
}

function voucherInventoryRow(block, batchBlock = "") {
  const billedQtyText = extractTagValues(batchBlock, "BILLEDQTY")[0] || extractTagValues(block, "BILLEDQTY")[0] || "";
  const actualQtyText = extractTagValues(batchBlock, "ACTUALQTY")[0] || extractTagValues(block, "ACTUALQTY")[0] || "";
  const quantityText = billedQtyText || actualQtyText;
  const quantity = parseTallyQuantity(quantityText);
  const purchaseBatchFlag = firstUdfValue(batchBlock, ["ISSATHI_BatchNo", "ISSATHI_BATCHNO"]);
  const salesBatchNo = firstUdfValue(batchBlock, ["SATHI_BatchNoS"]);
  const sathiIsCottonValue = firstUdfValue(batchBlock, ["SATHIIsCotton"]);
  const sathiIsCottonSValue = firstUdfValue(batchBlock, ["SATHIIsCottonS"]);
  const portalPushedValue = firstUdfValue(batchBlock, ["SATHI_PORTAL_PUSHED"]);
  return {
    stockItemName: extractTagValues(block, "STOCKITEMNAME")[0] || "",
    lotNum: extractTagValues(batchBlock, "BATCHNAME")[0] || "",
    originalOwner: firstUdfValue(batchBlock, ["SATHI_ORIGINAL_OWNER", "SATHI_ORIGINALOWNER", "SATHI_ORIGINAL_OWNERS"]),
    packingSize: firstUdfValue(batchBlock, ["SATHI_PACKING", "SATHI_PACKING_SIZE", "SATHI_PACKINGSIZE", "SATHI_PACKINGS"]),
    salesBatchNo,
    sathiCompanyLicenceNo: firstUdfValue(batchBlock, ["SATHICMPLicNo"]),
    sathiCompanyLicenceNoS: firstUdfValue(batchBlock, ["SATHICMPLicNoS"]),
    sathiIsCottonValue,
    sathiIsCottonSValue,
    sathiIsCotton: isYes(sathiIsCottonValue),
    sathiIsCottonS: isYes(sathiIsCottonSValue),
    portalPushedValue,
    portalPushed: isYes(portalPushedValue),
    portalOrderNo: firstUdfValue(batchBlock, ["SATHI_PORTAL_ORDER_NO"]),
    portalPushedAt: firstUdfValue(batchBlock, ["SATHI_PORTAL_PUSHED_AT"]),
    portalPushResult: firstUdfValue(batchBlock, ["SATHI_PORTAL_PUSH_RESULT"]),
    isSathiBatch: Boolean(isYes(purchaseBatchFlag) || salesBatchNo),
    expiryDate: firstNonEmpty(extractTagValues(batchBlock, "EXPIRYPERIOD")) || firstNonEmpty(extractTagValues(batchBlock, "EXPIRYDATE")),
    godownName: firstNonEmpty(extractTagValues(batchBlock, "GODOWNNAME")) || firstNonEmpty(extractTagValues(batchBlock, "DESTINATIONGODOWNNAME")),
    quantityText,
    billedQtyText,
    actualQtyText,
    quantity,
    quantityQtl: tallyQuantityToQtl([actualQtyText, billedQtyText].filter(Boolean).join(" = ")),
    rate: extractTagValues(block, "RATE")[0] || "",
    amount: firstNonEmpty(extractTagValues(batchBlock, "AMOUNT")) || firstNonEmpty(extractTagValues(block, "AMOUNT")) || ""
  };
}

function parsePartyDetails(xml) {
  const ledgers = {};
  const regex = /<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const name = decodeXml(attributeValue(match[1], "NAME") || extractTagValues(match[2], "NAME")[0] || "").trim();
    const licenceInfo = ledgerSathiLicenceInfo(match[2]);
    const partyType = extractCompanyUdfValue(match[2], "SATHI_TALLY_PARTY_TYPE");
    if (name) {
      ledgers[name] = {
        ...licenceInfo,
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

function tallyQuantityToQtl(quantityText) {
  const text = String(quantityText || "");
  const kgMatch = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:kg|kgs|kilogram|kilograms)\b/gi)].pop();
  if (kgMatch) return formatQuantity(Number(kgMatch[1]) / 100);

  const gmMatch = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:gm|gms|gram|grams|g)\b/gi)].pop();
  if (gmMatch) return formatQuantity(Number(gmMatch[1]) / 100000);

  const qtlMatch = [...text.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:qtl|qtls|quintal|quintals)\b/gi)].pop();
  if (qtlMatch) return formatQuantity(Number(qtlMatch[1]));

  return "";
}

function enrichSaleQuantitiesFromStockItems(vouchers = [], stockItems = []) {
  return vouchers.map((voucher) => ({
    ...voucher,
    inventory: (voucher.inventory || []).map((row) => {
      if (row.quantityQtl) return row;
      const stockItem = findStockItem(stockItems, row.stockItemName);
      const quantityQtl = saleCountQuantityToQtl(row, stockItem);
      return quantityQtl ? { ...row, quantityQtl } : row;
    })
  }));
}

function saleCountQuantityToQtl(row = {}, stockItem = null) {
  const quantity = Number(row.quantity || 0);
  if (!Number.isFinite(quantity) || quantity <= 0 || !stockItem) return "";
  const unitName = quantityUnitFromText(row.quantityText || row.billedQtyText || row.actualQtyText);
  if (isKgUnit(unitName)) return formatQuantity(quantity / 100);
  if (isGramUnit(unitName)) return formatQuantity(quantity / 100000);
  if (!isCountUnit(unitName)) return "";
  const conversion = Number(stockItem.conversion || 0);
  const denominator = Number(stockItem.denominator || 1) || 1;
  if (!Number.isFinite(conversion) || conversion <= 0 || !isKgUnit(stockItem.additionalUnits)) return "";
  return formatQuantity((quantity * conversion / denominator) / 100);
}

function quantityUnitFromText(value) {
  const match = String(value || "").match(/-?\d+(?:\.\d+)?\s*([A-Za-z]+)/);
  return match ? match[1] : "";
}

function firstNonEmpty(values) {
  return (values || []).find((value) => String(value || "").trim() !== "") || "";
}

function firstUdfValue(xml, names = []) {
  for (const name of names) {
    const value = extractCompanyUdfValue(xml, name);
    const cleaned = cleanUdfText(value);
    if (String(cleaned || "").trim()) return cleaned;
  }
  return "";
}

function firstDirectUdfValue(xml, names = []) {
  for (const name of names) {
    const value = extractDirectUdfValue(xml, name);
    if (String(value || "").trim()) return value;
  }
  return "";
}

function extractDirectUdfValue(xml, name) {
  const escapedName = escapeRegExp(name);
  const patterns = [
    new RegExp(`<UDF:${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)</UDF:${escapedName}>`, "i"),
    new RegExp(`<${escapedName}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedName}>`, "i")
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(xml);
    if (!match) continue;
    const value = decodeXml(match[1].trim()).replace(/<[^>]+>/g, "").trim();
    if (value) return value;
  }
  return "";
}

function cleanUdfText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return stripXmlTags(text);
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
  const fetchFields = [
    "MasterID",
    "AlterID",
    "VoucherNumber",
    "Reference",
    "SathiVchNo",
    "Date",
    "VoucherTypeName",
    "PartyLedgerName",
    "AllInventoryEntries",
    "InventoryEntries",
    "BatchAllocations",
    "StockItemName",
    "BilledQty",
    "ActualQty",
    "Rate",
    "Amount",
    "BatchName",
    "ISSATHI_BatchNo",
    "SATHI_ORIGINAL_OWNER",
    "SATHI_PACKING",
    "SATHIIsCotton",
    "SATHICMPLicNo"
  ].join(",");
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
            <FETCH>${escapeXml(fetchFields)}</FETCH>
            <FILTER>SaathiVoucherFilter</FILTER>
          </COLLECTION>
          <SYSTEM TYPE="Formulae" NAME="SaathiVoucherFilter">$SathiVchNo = "${escapeXml(voucherNumber)}"</SYSTEM>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseVoucherLookup(xml, voucherNumber, options = {}) {
  const expected = normalizeLookupValue(voucherNumber);
  if (!expected) return {
    exists: false,
    voucherFound: false,
    exactMatch: false,
    partial: false,
    matches: [],
    vouchers: [],
    expectedRows: [],
    matchedRows: [],
    missingRows: []
  };

  const expectedRows = normalizeVoucherExpectedRows(options.expectedRows || options.billRows || []);
  const vouchers = [...String(xml || "").matchAll(/<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi)]
    .map((match) => {
      const block = match[2] || "";
      return {
        masterId: firstNonEmpty(extractTagValues(block, "MASTERID")).trim(),
        alterId: firstNonEmpty(extractTagValues(block, "ALTERID")).trim(),
        voucherNumber: firstNonEmpty(extractTagValues(block, "VOUCHERNUMBER")) || firstNonEmpty(extractTagValues(block, "REFERENCE")),
        voucherTypeName: firstNonEmpty(extractTagValues(block, "VOUCHERTYPENAME")),
        partyLedgerName: firstNonEmpty(extractTagValues(block, "PARTYLEDGERNAME")),
        sathiVchNo: firstUdfValue(block, ["SathiVchNo"]),
        inventory: parseVoucherInventory(block)
      };
    })
    .filter((voucher) => normalizeLookupValue(voucher.sathiVchNo) === expected);
  const matches = vouchers.map((voucher) => voucher.sathiVchNo).filter(Boolean);
  const voucherFound = matches.length > 0;
  const verification = verifyVoucherExpectedRows(vouchers, expectedRows);
  const exactMatch = voucherFound && (!expectedRows.length || verification.missingRows.length === 0);
  const partial = voucherFound && expectedRows.length > 0 && verification.missingRows.length > 0;

  return {
    exists: exactMatch,
    voucherFound,
    exactMatch,
    partial,
    matches,
    vouchers,
    expectedRows,
    matchedRows: verification.matchedRows,
    missingRows: verification.missingRows
  };
}

function normalizeVoucherExpectedRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const stockItemNames = [
        row.stockItemName,
        row.tallyItemName,
        row.itemName,
        ...(Array.isArray(row.stockItemNames) ? row.stockItemNames : [])
      ].map((value) => String(value || "").trim()).filter(Boolean);
      const batchName = String(row.batchName || row.newBatchName || row.lotNum || "").trim();
      if (!stockItemNames.length || !batchName) return null;
      return {
        stockItemNames: [...new Set(stockItemNames)],
        batchName,
        quantity: Number(row.quantity || row.totalBags || 0) || 0
      };
    })
    .filter(Boolean);
}

function verifyVoucherExpectedRows(vouchers = [], expectedRows = []) {
  const inventory = vouchers.flatMap((voucher) => voucher.inventory || []);
  const usedIndexes = new Set();
  const matchedRows = [];
  const missingRows = [];

  for (const expected of expectedRows) {
    const itemKeys = new Set(expected.stockItemNames.map(normalizeItemLookupValue).filter(Boolean));
    const batchKey = normalizeLookupValue(expected.batchName);
    const index = inventory.findIndex((row, rowIndex) => {
      if (usedIndexes.has(rowIndex)) return false;
      return itemKeys.has(normalizeItemLookupValue(row.stockItemName)) && normalizeLookupValue(row.lotNum) === batchKey;
    });
    if (index >= 0) {
      usedIndexes.add(index);
      matchedRows.push({
        expected,
        actual: {
          stockItemName: inventory[index].stockItemName || "",
          batchName: inventory[index].lotNum || "",
          quantity: inventory[index].quantity || 0,
          quantityText: inventory[index].quantityText || ""
        }
      });
    } else {
      missingRows.push(expected);
    }
  }

  return { matchedRows, missingRows };
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
            <FETCH>Name,BaseUnits,AdditionalUnits,Conversion,Denominator,Parent,Category,StockCategory,OpeningBalance,ClosingBalance,OpeningValue,ClosingValue,BatchAllocations,GodownName,BatchName,OpeningBalance,OpeningValue,OpeningRate,ExpiryPeriod,MfdOn,IsSathiItem,TallyItem,GSTDetails,HSNDetails</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
</BODY>
</ENVELOPE>`;
}

function ledgerListEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Ledger List</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Ledger List" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,Parent,OpeningBalance,GSTRegistrationType,PartyGSTIN,GSTIN,SATHI_TALLY_PARTY_LIC,LedSeedsLicAggr,SeedLicNo,SeedLicSite,SATHI_TALLY_PARTY_COTTON_LIC,LedCtnLicAggr,CtnLicNo,CtnLicSite,SATHI_TALLY_PARTY_TYPE,LEDBlockCode,LEDBlockName,LEDDisCode,LEDDiscName,LEDPlotNo,LEDVillCode,LEDVillName</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function batchExpiryVoucherEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const fetchFields = [
    "Date",
    "VoucherNumber",
    "Reference",
    "VoucherTypeName",
    "PartyName",
    "PartyLedgerName",
    "AllInventoryEntries",
    "BatchAllocations",
    "SATHI_BatchNoS",
    "SATHI_ORIGINAL_OWNERS",
    "SATHI_PACKINGS",
    "SATHIIsCottonS",
    "SATHICMPLicNoS",
    "StockItemName",
    "BilledQty",
    "ActualQty",
    "Rate",
    "Amount",
    "GodownName",
    "DestinationGodownName",
    "BatchName",
    "ExpiryPeriod",
    "MfdOn",
    "SATHI_ORIGINAL_OWNER",
    "SATHI_PACKING",
    "SATHI_PACKING_SIZE",
    "SATHI_PACKINGSIZE",
    "SATHIIsCotton",
    "SATHICMPLicNo"
  ].join(",");
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Batch Expiry Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Batch Expiry Vouchers" ISMODIFY="No">
            <TYPE>Voucher</TYPE>
            <FETCH>${fetchFields}</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function rojmelLedgerGroupsEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Rojmel Ledger Groups</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        ${companyBlock}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Rojmel Ledger Groups" ISMODIFY="No">
            <TYPE>Group</TYPE>
            <FETCH>Name,Parent</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function rojmelLedgerMastersEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Rojmel Ledger Masters</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        ${companyBlock}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Rojmel Ledger Masters" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,Parent,OpeningBalance</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function rojmelVoucherEnvelope(companyName, fromDate, toDate) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const from = tallyDate(fromDate || "2000-04-01");
  const to = tallyDate(toDate || new Date().toISOString().slice(0, 10));
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Rojmel Vouchers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        ${companyBlock}
        <SVFROMDATE TYPE="Date">${from}</SVFROMDATE>
        <SVTODATE TYPE="Date">${to}</SVTODATE>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Rojmel Vouchers" ISMODIFY="No" ISINITIALIZE="Yes">
            <TYPE>Voucher</TYPE>
            <FETCH>Date,Reference,VoucherNumber,VoucherTypeName,PartyLedgerName,Narration,LedgerEntries.*,AllLedgerEntries.*</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function godownListEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>Sathi Godown List</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        ${companyBlock}
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="Sathi Godown List" ISMODIFY="No">
            <TYPE>Godown</TYPE>
            <FETCH>Name,Parent</FETCH>
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
    const gstDetailsXml = extractListXml(match[2], "GSTDETAILS.LIST");
    const hsnDetailsXml = extractListXml(match[2], "HSNDETAILS.LIST");
    items.push({
      name,
      aliases: aliases.filter((alias) => alias !== name),
      baseUnits: extractTagValues(match[2], "BASEUNITS")[0] || "",
      additionalUnits: extractTagValues(match[2], "ADDITIONALUNITS")[0] || "",
      conversion: extractTagValues(match[2], "CONVERSION")[0] || "",
      denominator: extractTagValues(match[2], "DENOMINATOR")[0] || "",
      parent: extractTagValues(match[2], "PARENT")[0] || "",
      stockCategory: firstNonEmpty(extractTagValues(match[2], "CATEGORY")) || firstNonEmpty(extractTagValues(match[2], "STOCKCATEGORY")),
      isSathiItem: isYes(extractCompanyUdfValue(match[2], "IsSathiItem")),
      mappedTallyItemName: extractCompanyUdfValue(match[2], "TallyItem"),
      hsnCode: extractTagValues(hsnDetailsXml, "HSNCODE")[0] || "",
      hsnDetailsXml,
      gstTaxability: extractTagValues(gstDetailsXml, "TAXABILITY")[0] || "",
      gstRate: parseGstRateFromDetails(gstDetailsXml),
      gstDetailsXml,
      openingBatches: parseStockItemOpeningBatches(match[2])
    });
  }

  return items;
}

function parseStockItemOpeningBatches(stockItemXml) {
  const batches = [];
  for (const batchBlock of extractListBlocks(stockItemXml, "BATCHALLOCATIONS.LIST")) {
    const quantityText = firstNonEmpty(extractTagValues(batchBlock, "OPENINGBALANCE"))
      || firstNonEmpty(extractTagValues(batchBlock, "CLOSINGBALANCE"));
    const quantity = parseTallyQuantity(quantityText);
    const batchName = firstNonEmpty(extractTagValues(batchBlock, "BATCHNAME"));
    if (!batchName && !quantity) continue;
    batches.push({
      batchName: batchName || "Primary Batch",
      godownName: firstNonEmpty(extractTagValues(batchBlock, "GODOWNNAME")) || "Main Location",
      quantityText,
      quantity,
      openingValue: firstNonEmpty(extractTagValues(batchBlock, "OPENINGVALUE")),
      openingRate: firstNonEmpty(extractTagValues(batchBlock, "OPENINGRATE")),
      expiryDate: firstNonEmpty(extractTagValues(batchBlock, "EXPIRYPERIOD")) || firstNonEmpty(extractTagValues(batchBlock, "EXPIRYDATE")),
      mfdOn: firstNonEmpty(extractTagValues(batchBlock, "MFDON"))
    });
  }
  return batches;
}

function parseGodowns(xml) {
  const godowns = [];
  const regex = /<GODOWN\b([^>]*)>([\s\S]*?)<\/GODOWN>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[2] || "";
    const name = decodeXml(attributeValue(match[1], "NAME") || extractTagValues(block, "NAME")[0] || "").trim();
    if (!name) continue;
    godowns.push({
      name,
      parent: extractTagValues(block, "PARENT")[0] || ""
    });
  }

  return godowns;
}

function parseLedgers(xml) {
  const ledgers = [];
  const regex = /<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[2] || "";
    const aliases = [...new Set(extractTagValues(block, "NAME").filter(Boolean))];
    const name = decodeXml(attributeValue(match[1], "NAME") || aliases[0] || "").trim();
    if (!name) continue;
    ledgers.push({
      name,
      aliases: aliases.filter((alias) => alias !== name),
      parent: extractTagValues(block, "PARENT")[0] || "",
      ...ledgerSathiLicenceInfo(block),
      partyType: extractCompanyUdfValue(block, "SATHI_TALLY_PARTY_TYPE"),
      blockCode: extractCompanyUdfValue(block, "LEDBlockCode"),
      blockName: extractCompanyUdfValue(block, "LEDBlockName"),
      districtCode: extractCompanyUdfValue(block, "LEDDisCode"),
      districtName: extractCompanyUdfValue(block, "LEDDiscName"),
      plotNo: extractCompanyUdfValue(block, "LEDPlotNo"),
      villageCode: extractCompanyUdfValue(block, "LEDVillCode"),
      villageName: extractCompanyUdfValue(block, "LEDVillName")
    });
  }

  return ledgers;
}

function attributeValue(text, name) {
  const match = String(text || "").match(new RegExp(`${name}="([^"]*)"`, "i"));
  return match ? match[1] : "";
}

function normalizeLookupValue(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeItemLookupValue(value) {
  return normalizeLookupValue(value).replace(/\s+/g, "");
}

function normalizeTallyDateForCompare(value) {
  const text = String(value || "").trim();
  if (/^\d{8}$/.test(text)) return text;
  const parts = text.split(/[-/]/);
  if (parts.length !== 3) return "";
  if (parts[0].length === 4) return `${parts[0]}${parts[1].padStart(2, "0")}${parts[2].padStart(2, "0")}`;
  return `${parts[2]}${parts[1].padStart(2, "0")}${parts[0].padStart(2, "0")}`;
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
  const isOptionalVoucher = String(mapping.entryType || mapping.tallyEntryType || "regular").trim().toLowerCase() === "optional";
  const partyLedger = resolvePartyLedger(bill, mapping);
  const sathiVoucherNumber = mapping.sathiVchNo || bill.billNumber || "";
  const date = tallyDate(bill.billDate);
  const effectiveDate = date;
  const entries = (bill.lotData || []).map((lot) => inventoryEntryXml(lot, bill, mapping)).join("");
  const taxTotals = totalTaxAmounts(bill);
  const discountAmount = resolveDiscountAmount(bill);
  const discountLedgerName = discountAmount > 0 ? mapping.discountLedgerName || "" : "";
  const lineTotal = purchaseLineTotal(bill);
  const partyAmount = amount(Math.max(0, lineTotal + taxTotals.cgst + taxTotals.sgst + taxTotals.igst - discountAmount));
  const placeOfSupply = bill.stateName || "Maharashtra";
  const country = "India";
  const gstRegistrationName = mapping.gstRegistrationName || "";
  const partyRegistrationType = mapping.partyRegistrationType || "Regular";
  const companyRegistrationType = mapping.companyRegistrationType || "Regular";
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  const partyGstin = partyGstinFromBill(bill);
  const invoiceDeliveryNotes = invoiceDeliveryNotesXml(bill, mapping);

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
            <PARTYNAME>${escapeXml(partyLedger)}</PARTYNAME>
            ${partyGstin ? `<PARTYGSTIN>${escapeXml(partyGstin)}</PARTYGSTIN>` : ""}
            ${gstRegistrationName ? `<GSTREGISTRATION TAXTYPE="GST" TAXREGISTRATION="">${escapeXml(gstRegistrationName)}</GSTREGISTRATION>` : ""}
            ${companyBlock}
            <PARTYLEDGERNAME>${escapeXml(partyLedger)}</PARTYLEDGERNAME>
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
            <ISOPTIONAL>${isOptionalVoucher ? "Yes" : "No"}</ISOPTIONAL>
            <ISINVOICE>Yes</ISINVOICE>
            ${tallyStringUdfXml("SathiStatus", mapping.sathiStatus || "Imported to Tally")}
            ${tallyStringUdfXml("SathiVchNo", sathiVoucherNumber)}
            <NARRATION>Imported from SATHI. Seller: ${escapeXml(bill.sellerName || "")}; Buyer: ${escapeXml(bill.buyerName || "")}</NARRATION>
            ${emptyVoucherCollections()}
            <CONTRITRANS.LIST>      </CONTRITRANS.LIST>
            <EWAYBILLERRORLIST.LIST>      </EWAYBILLERRORLIST.LIST>
            <IRNERRORLIST.LIST>      </IRNERRORLIST.LIST>
            <HARYANAVAT.LIST>      </HARYANAVAT.LIST>
            <SUPPLEMENTARYDUTYHEADDETAILS.LIST>      </SUPPLEMENTARYDUTYHEADDETAILS.LIST>
            ${invoiceDeliveryNotes}
            <INVOICEORDERLIST.LIST>      </INVOICEORDERLIST.LIST>
            <INVOICEINDENTLIST.LIST>      </INVOICEINDENTLIST.LIST>
            <ATTENDANCEENTRIES.LIST>      </ATTENDANCEENTRIES.LIST>
            <ORIGINVOICEDETAILS.LIST>      </ORIGINVOICEDETAILS.LIST>
            <INVOICEEXPORTLIST.LIST>      </INVOICEEXPORTLIST.LIST>
            ${entries}
            ${partyLedgerEntry(partyLedger, partyAmount, sathiVoucherNumber, date)}
            ${discountLedgerName ? discountLedgerEntry(discountLedgerName, discountAmount) : ""}
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
  const quantityMeta = resolveQuantityMeta(lot, mapping, bill);
  const qtyText = quantityMeta.quantityText;
  const unitName = quantityMeta.rateUnitName;
  const rate = amount(quantityMeta.rate);
  const lineAmount = amount(quantityMeta.lineAmount);
  const godownName = mapping.godownName || "Main Location";
  const purchaseLedger = mapping.purchaseLedgerName || "Purchase";
  const hsnCode = lot.tax?.hsnCode ? String(lot.tax.hsnCode) : "";
  const gstRates = gstRateDetails(lot, bill);
  const taxability = "Nil Rated";
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
              <ACTUALQTY> ${escapeXml(qtyText)}</ACTUALQTY>
              <BILLEDQTY> ${escapeXml(qtyText)}</BILLEDQTY>
              <BATCHALLOCATIONS.LIST>
                <GODOWNNAME>${escapeXml(godownName)}</GODOWNNAME>
                <BATCHNAME>${escapeXml(batchName)}</BATCHNAME>
                <MFDON>${batchDate}</MFDON>
                <DESTINATIONGODOWNNAME>${escapeXml(godownName)}</DESTINATIONGODOWNNAME>
                <INDENTNO>Not Applicable</INDENTNO>
                <ORDERNO>Not Applicable</ORDERNO>
                <TRACKINGNUMBER>&#4; Not Applicable</TRACKINGNUMBER>
                <DYNAMICCSTISCLEARED>No</DYNAMICCSTISCLEARED>
                <AMOUNT>-${lineAmount}</AMOUNT>
                <ACTUALQTY> ${escapeXml(qtyText)}</ACTUALQTY>
                <BILLEDQTY> ${escapeXml(qtyText)}</BILLEDQTY>
                ${expiryDate ? `<EXPIRYPERIOD>${escapeXml(expiryDate)}</EXPIRYPERIOD>` : ""}
                ${tallyStringUdfXml("SATHI_ORIGINAL_OWNER", originalOwner)}
                ${tallyStringUdfXml("SATHI_PACKING", lot.packingSize || "")}
                ${tallyStringUdfXml("SATHI_PACKING_SIZE", lot.packingSize || "")}
                ${tallyStringUdfXml("SATHI_PACKING_UNIT", lot.packingUnit || "")}
                ${tallyStringUdfXml("SATHI_TOTAL_BAGS", lot.totalBags ?? "")}
                ${tallyStringUdfXml("SATHI_PORTAL_QTY", lot.totalQty ?? "")}
                ${tallyLogicalUdfXml("ISSATHI_BatchNo", true)}
                ${tallyLogicalUdfXml("SATHIIsCotton", String(mapping.licenceType || "seed").toLowerCase() === "cotton")}
                ${tallyStringUdfXml("SATHICMPLicNo", mapping.activeLicenceCode || "")}
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

function invoiceDeliveryNotesXml(bill = {}, mapping = {}) {
  const rows = grnDeliveryNoteRowsForBill(bill, mapping);
  if (!rows.length) return "<INVOICEDELNOTES.LIST>      </INVOICEDELNOTES.LIST>";
  return rows.map((row) => `
            <INVOICEDELNOTES.LIST>
              <BASICSHIPPINGDATE>${escapeXml(row.date)}</BASICSHIPPINGDATE>
              <BASICSHIPDELIVERYNOTE>${escapeXml(row.number)}</BASICSHIPDELIVERYNOTE>
            </INVOICEDELNOTES.LIST>`).join("");
}

function grnDeliveryNoteRowsForBill(bill = {}, mapping = {}) {
  const lots = Array.isArray(bill.lotData) ? bill.lotData : [];
  const rows = [];
  const seen = new Set();
  for (const lot of lots) {
    const match = grnMatchForLot(lot, mapping);
    const number = grnVoucherNumberFromMatch(match);
    if (!number || seen.has(number)) continue;
    seen.add(number);
    rows.push({
      number,
      date: tallyDate(match?.grnDate || match?.date || bill.billDate)
    });
  }
  return rows;
}

function grnVoucherNumberForLot(lot = {}, mapping = {}) {
  const match = grnMatchForLot(lot, mapping);
  return grnVoucherNumberFromMatch(match);
}

function grnVoucherNumberFromMatch(match = null) {
  return String(match?.grnVoucherNumber || match?.voucherNumber || match?.inwardVoucherNumber || "").trim();
}

function grnMatchForLot(lot = {}, mapping = {}) {
  const lotNum = String(lot.lotNum || "").trim();
  if (!lotNum || !mapping.grnMatches || typeof mapping.grnMatches !== "object") return null;
  const direct = mapping.grnMatches[lotNum];
  if (Array.isArray(direct) && direct.length) return direct[0];

  const normalizedLot = lotNum.toUpperCase();
  for (const [key, rows] of Object.entries(mapping.grnMatches)) {
    if (String(key || "").trim().toUpperCase() === normalizedLot && Array.isArray(rows) && rows.length) {
      return rows[0];
    }
  }
  return null;
}

function partyLedgerEntry(party, amountValue, referenceNumber, referenceDate) {
  const creditAmount = String(amountValue || "0").replace(/^-/, "");
  return `
            <LEDGERENTRIES.LIST>
              <OLDAUDITENTRYIDS.LIST TYPE="Number"><OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS></OLDAUDITENTRYIDS.LIST>
              <LEDGERNAME>${escapeXml(party)}</LEDGERNAME>
              <GSTCLASS>Not Applicable</GSTCLASS>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <LEDGERFROMITEM>No</LEDGERFROMITEM>
              <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
              <GSTOVERRIDDEN>No</GSTOVERRIDDEN>
              <ISGSTASSESSABLEVALUEOVERRIDDEN>No</ISGSTASSESSABLEVALUEOVERRIDDEN>
              <STRDISGSTAPPLICABLE>No</STRDISGSTAPPLICABLE>
              <STRDGSTISPARTYLEDGER>No</STRDGSTISPARTYLEDGER>
              <STRDGSTISDUTYLEDGER>No</STRDGSTISDUTYLEDGER>
              <CONTENTNEGISPOS>No</CONTENTNEGISPOS>
              <ISLASTDEEMEDPOSITIVE>No</ISLASTDEEMEDPOSITIVE>
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

function parseSathiDiscountLedgerName(xml) {
  const regex = /<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[2];
    const name = decodeXml(attributeValue(match[1], "NAME") || extractTagValues(block, "NAME")[0] || "").trim();
    const narration = [
      ...extractTagValues(block, "NARRATION"),
      ...extractTagValues(block, "DESCRIPTION"),
      ...extractTagValues(block, "NOTES")
    ].join(" ");
    if (name && /\bSATHI\b/i.test(narration)) return name;
  }

  return "";
}

function discountLedgerEntry(ledgerName, amountValue) {
  const discountAmount = String(amount(amountValue)).replace(/^-/, "");
  return `
            <LEDGERENTRIES.LIST>
              <OLDAUDITENTRYIDS.LIST TYPE="Number"><OLDAUDITENTRYIDS>-1</OLDAUDITENTRYIDS></OLDAUDITENTRYIDS.LIST>
              <LEDGERNAME>${escapeXml(ledgerName)}</LEDGERNAME>
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
              <ISCAPVATTAXALTERED>No</ISCAPVATTAXALTERED>
              <ISCAPVATNOTCLAIMED>No</ISCAPVATNOTCLAIMED>
              <AMOUNT>${discountAmount}</AMOUNT>
              <VATEXPAMOUNT>${discountAmount}</VATEXPAMOUNT>
              <SERVICETAXDETAILS.LIST>       </SERVICETAXDETAILS.LIST>
              <BANKALLOCATIONS.LIST>       </BANKALLOCATIONS.LIST>
              <BILLALLOCATIONS.LIST>       </BILLALLOCATIONS.LIST>
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

function resolveDiscountAmount(bill = {}) {
  const value = Number(bill.discount || 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
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
    const gstDetailsXml = normalizeCopiedListXml(item.gstDetailsXml, "GSTDETAILS.LIST");
    const hsnDetailsXml = normalizeCopiedListXml(item.hsnDetailsXml, "HSNDETAILS.LIST");
    const nameList = [...new Set([item.name, ...(item.aliases || [])]
      .map((name) => String(name || "").trim())
      .filter(Boolean))]
      .map((name) => `<NAME>${escapeXml(name)}</NAME>`)
      .join("");

    if (item.exists) {
      return `
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <STOCKITEM NAME="${escapeXml(item.name)}" RESERVEDNAME="" ACTION="Alter">
            <LANGUAGENAME.LIST><NAME.LIST TYPE="String">${nameList}</NAME.LIST><LANGUAGEID> 1033</LANGUAGEID></LANGUAGENAME.LIST>
            ${tallyLogicalUdfXml("IsSathiItem", true)}
            ${tallyStringUdfXml("TallyItem", item.mappedTallyItemName || "")}
          </STOCKITEM>
        </TALLYMESSAGE>
    `;
    }

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
            ${stockItemAdditionalUnitXml(item)}
            ${item.additionalUnit && !isNotApplicableUnit(item.additionalUnit) ? `<CONVERSION>${escapeXml(item.conversion || "1")}</CONVERSION><DENOMINATOR>${escapeXml(item.denominator || "1")}</DENOMINATOR>` : ""}
            <VATBASEUNIT>${escapeXml(item.unitName)}</VATBASEUNIT>
            <ISBATCHWISEON>Yes</ISBATCHWISEON>
            <ISPERISHABLEON>${item.isPerishable ? "Yes" : "No"}</ISPERISHABLEON>
            <ISDELETED>No</ISDELETED>
            ${tallyLogicalUdfXml("IsSathiItem", true)}
            ${tallyStringUdfXml("TallyItem", item.mappedTallyItemName || "")}
            ${gstDetailsXml || `<GSTDETAILS.LIST>
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
            </GSTDETAILS.LIST>`}
            ${hsnDetailsXml || (item.hsnCode ? `<HSNDETAILS.LIST><APPLICABLEFROM>${applicableFrom}</APPLICABLEFROM><HSNCODE>${escapeXml(item.hsnCode)}</HSNCODE><SRCOFHSNDETAILS>Specify Details Here</SRCOFHSNDETAILS></HSNDETAILS.LIST>` : "<HSNDETAILS.LIST>      </HSNDETAILS.LIST>")}
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

function tallyLogicalUdfXml(name, value) {
  if (value === undefined || value === null || value === "") return "";
  const logicalValue = isYes(value) || value === true ? "Yes" : "No";
  return `
                <UDF:${escapeXml(name)}.LIST DESC="${escapeXml(name)}" ISLIST="YES" TYPE="Logical">
                  <UDF:${escapeXml(name)} DESC="${escapeXml(name)}">${logicalValue}</UDF:${escapeXml(name)}>
                </UDF:${escapeXml(name)}.LIST>`;
}

function stockItemAdditionalUnitXml(item = {}) {
  if (!item.additionalUnit || isNotApplicableUnit(item.additionalUnit)) {
    return "<ADDITIONALUNITS>&#4; Not Applicable</ADDITIONALUNITS>";
  }
  return `<ADDITIONALUNITS>${escapeXml(item.additionalUnit)}</ADDITIONALUNITS>`;
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

function resolveItemUnitPlan(lot = {}, mapped = {}, currentItem = null, createNew = false) {
  const packingSize = formatQuantity(Number(lot.packingSize || mapped?.conversion || 1) || 1);

  if (currentItem) {
    const baseUnit = currentItem.baseUnits || mapped?.baseUnit || mapped?.mainUnit || "Kgs";
    const additionalUnit = !isNotApplicableUnit(currentItem.additionalUnits) ? currentItem.additionalUnits : mapped?.additionalUnit || mapped?.altUnit || "";
    return {
      baseUnit,
      additionalUnit,
      conversion: currentItem.conversion || mapped?.conversion || packingSize,
      denominator: currentItem.denominator || mapped?.denominator || "1",
      quantityUnitName: chooseStockQuantityUnit(baseUnit, additionalUnit)
    };
  }

  const baseUnit = createNew ? mapped?.baseUnit || mapped?.mainUnit || "Kgs" : mapped?.baseUnit || mapped?.mainUnit || "Kgs";
  const additionalUnit = createNew ? mapped?.additionalUnit || mapped?.altUnit || mapped?.countUnit || "Nos" : mapped?.additionalUnit || mapped?.altUnit || "";

  return {
    baseUnit,
    additionalUnit,
    conversion: mapped?.conversion || packingSize,
    denominator: mapped?.denominator || "1",
    quantityUnitName: chooseStockQuantityUnit(baseUnit, additionalUnit)
  };
}

function resolveSathiItemUnitPlan(lot = {}, mapped = {}, currentItem = null) {
  const packingSize = formatQuantity(Number(lot.packingSize || mapped?.conversion || 1) || 1);

  if (currentItem) {
    const baseUnit = currentItem.baseUnits || "Nos";
    const additionalUnit = !isNotApplicableUnit(currentItem.additionalUnits) ? currentItem.additionalUnits : "Kgs";
    return {
      baseUnit,
      additionalUnit,
      conversion: currentItem.conversion || packingSize,
      denominator: currentItem.denominator || "1",
      quantityUnitName: baseUnit || "Nos"
    };
  }

  return {
    baseUnit: "Nos",
    additionalUnit: "Kgs",
    conversion: packingSize,
    denominator: "1",
    quantityUnitName: "Nos"
  };
}

function chooseStockQuantityUnit(baseUnit, additionalUnit) {
  if (isKgUnit(baseUnit)) return baseUnit;
  if (isKgUnit(additionalUnit)) return additionalUnit;
  if (isGramUnit(baseUnit)) return baseUnit;
  if (isGramUnit(additionalUnit)) return additionalUnit;
  return baseUnit || additionalUnit || "Nos";
}

function physicalKgQuantity(lot = {}) {
  const packingSize = Number(lot.packingSize || 0);
  const totalBags = Number(lot.totalBags || 0);
  if (Number.isFinite(packingSize) && packingSize > 0 && Number.isFinite(totalBags) && totalBags > 0) {
    return packingSize * totalBags;
  }
  const totalQty = Number(lot.totalQty || 0);
  // SATHI reports totalQty in quintals. Convert qtl -> kg when packing/bag data is absent.
  return Number.isFinite(totalQty) && totalQty > 0 ? totalQty * 100 : totalBags || 1;
}

function isKgUnit(unitName) {
  return /^(kg|kgs|kilogram|kilograms)$/i.test(normalizeUnitName(unitName));
}

function isGramUnit(unitName) {
  return /^(gm|gms|gram|grams|g)$/i.test(normalizeUnitName(unitName));
}

function isCountUnit(unitName) {
  return /^(bag|bags|nos|no|pcs|pc|piece|pieces|nug|qty|packet|pkt)$/i.test(normalizeUnitName(unitName));
}

function hasWeightUnit(...unitNames) {
  return unitNames.some((unitName) => isKgUnit(unitName) || isGramUnit(unitName));
}

function isNotApplicableUnit(unitName) {
  const unit = normalizeUnitName(unitName);
  return !unit || unit.includes("not applicable");
}

function normalizeUnitName(unitName) {
  return String(unitName || "").replace(/\u0004/g, "").trim().toLowerCase();
}

function resolveQuantityMeta(lot, mapping = {}, bill = {}) {
  const lineAmount = resolveLotLineAmount(lot, bill);
  const itemName = resolveStockItem(lot, mapping);
  const unitPlan = mapping.stockItemUnitPlans?.[itemName] || {};
  const physicalKg = physicalKgQuantity(lot);
  const totalBags = Number(lot.totalBags || 0);
  const planBaseUnit = unitPlan.baseUnit || unitPlan.baseUnits || "";
  const planAdditionalUnit = unitPlan.additionalUnit || unitPlan.additionalUnits || "";
  const planConversion = Number(unitPlan.conversion || 0);
  const planDenominator = Number(unitPlan.denominator || 1) || 1;
  const hasValidCompoundConversion = Number.isFinite(planConversion) && planConversion > 0 && Number.isFinite(planDenominator) && planDenominator > 0;
  const primaryUnit = cleanQuantityUnit(planBaseUnit || mapping.stockUnitOverrides?.[itemName] || unitPlan.quantityUnitName || mapping.unitName || "Kgs");
  const secondaryUnit = hasValidCompoundConversion ? cleanQuantityUnit(planAdditionalUnit || "") : "";
  const primaryQuantity = quantityForUnit(lot, primaryUnit, physicalKg, totalBags);
  const secondaryQuantity = quantityForUnit(lot, secondaryUnit, physicalKg, totalBags);
  const hasSecondary = secondaryUnit
    && !isNotApplicableUnit(secondaryUnit)
    && secondaryUnit !== primaryUnit
    && Number.isFinite(secondaryQuantity)
    && secondaryQuantity > 0
    && shouldUseCompoundQuantity(primaryUnit, secondaryUnit);
  const finalPrimaryQuantity = Number.isFinite(primaryQuantity) && primaryQuantity > 0 ? primaryQuantity : physicalKg || totalBags || 1;
  const quantityText = hasSecondary
    ? `${formatQuantity(finalPrimaryQuantity)} ${primaryUnit} = ${formatQuantity(secondaryQuantity)} ${secondaryUnit}`
    : `${formatQuantity(finalPrimaryQuantity)} ${primaryUnit}`;
  const rate = finalPrimaryQuantity > 0 ? lineAmount / finalPrimaryQuantity : Number(lot.unitPrice || 0);

  return {
    quantity: formatQuantity(finalPrimaryQuantity),
    quantityText,
    unitName: primaryUnit,
    rateUnitName: primaryUnit,
    secondaryQuantity: hasSecondary ? formatQuantity(secondaryQuantity) : "",
    secondaryUnitName: hasSecondary ? secondaryUnit : "",
    rate,
    lineAmount
  };
}

function resolveLotLineAmount(lot = {}, bill = {}) {
  const unitPrice = Number(lot.unitPrice || 0);
  const totalBags = Number(lot.totalBags || 0);
  if (Number.isFinite(unitPrice) && unitPrice > 0 && Number.isFinite(totalBags) && totalBags > 0) {
    return unitPrice * totalBags;
  }
  if (Number.isFinite(unitPrice) && unitPrice > 0) return unitPrice;

  const lots = Array.isArray(bill.lotData) ? bill.lotData : [];
  const billTotal = Number(bill.totalBillPrice || 0);
  if (lots.length === 1 && Number.isFinite(billTotal) && billTotal > 0) return billTotal;
  return 0;
}

function purchaseLineTotal(bill = {}) {
  const lots = Array.isArray(bill.lotData) ? bill.lotData : [];
  const lineTotal = lots.reduce((total, lot) => total + Number(resolveLotLineAmount(lot, bill) || 0), 0);
  if (Number.isFinite(lineTotal) && lineTotal > 0) return lineTotal;
  const billTotal = Number(bill.totalBillPrice || 0);
  return Number.isFinite(billTotal) && billTotal > 0 ? billTotal : 0;
}

function cleanQuantityUnit(unitName) {
  const unit = String(unitName || "").replace(/\u0004/g, "").trim();
  return unit && !isNotApplicableUnit(unit) ? unit : "Kgs";
}

function quantityForUnit(lot = {}, unitName, physicalKg, totalBags) {
  if (!unitName || isNotApplicableUnit(unitName)) return 0;
  if (isGramUnit(unitName)) return physicalKg * 1000;
  if (isKgUnit(unitName)) return physicalKg;
  if (isCountUnit(unitName)) return Number.isFinite(totalBags) && totalBags > 0 ? totalBags : 1;
  return physicalKg;
}

function shouldUseCompoundQuantity(primaryUnit, secondaryUnit) {
  const primaryIsWeight = isKgUnit(primaryUnit) || isGramUnit(primaryUnit);
  const secondaryIsWeight = isKgUnit(secondaryUnit) || isGramUnit(secondaryUnit);
  const primaryIsCount = isCountUnit(primaryUnit);
  const secondaryIsCount = isCountUnit(secondaryUnit);
  return (primaryIsCount && secondaryIsWeight) || (primaryIsWeight && secondaryIsCount);
}

function formatQuantity(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(6)));
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
  const mappings = mapping.partyLedgerMappings || {};
  const keys = [
    partyMappingKey(bill),
    bill.sellerCode,
    bill.sellerName
  ].filter(Boolean);

  for (const key of keys) {
    const mapped = mappings[key];
    if (typeof mapped === "string" && mapped.trim()) return mapped.trim();
    if (mapped?.tallyLedgerName) return String(mapped.tallyLedgerName).trim();
    if (mapped?.ledgerName) return String(mapped.ledgerName).trim();
  }

  if (mapping.partyMode === "sellerCode") return bill.sellerCode || bill.sellerName || "SATHI Seller";
  return bill.sellerName || bill.sellerCode || "SATHI Seller";
}

function partyMappingKey(bill = {}) {
  return bill.sellerCode || bill.sellerName || "";
}

function resolveStockItem(lot, mapping) {
  return resolveMappedStockItem(lot, mapping);
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

function mappedExistingTallyItemName(lot, mapping = {}) {
  const mapped = resolveMappedStockItemEntry(lot, mapping);
  if (typeof mapped === "string") return mapped.trim();
  if (mapped?.createNew) return "";
  return String(mapped?.tallyItemName || "").trim();
}

function portalItemKey(lot = {}) {
  return lot.varietyCode || lot.varietyName || lot.cropCode || lot.cropName || lot.lotNum || "";
}

function portalItemName(lot = {}) {
  return [
    cleanItemNamePart(lot.cropName),
    cleanItemNamePart(stripBracketText(lot.varietyName || lot.varietyCode)),
    formatPackingForItemName(lot)
  ].filter(Boolean).join(" ") || lot.lotNum || "SATHI Seed";
}

function stripBracketText(value) {
  return String(value || "").replace(/\s*\([^)]*\)/g, "").replace(/\s*\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
}

function cleanItemNamePart(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function formatPackingForItemName(lot = {}) {
  const packingSize = Number(lot.packingSize || 0);
  if (!Number.isFinite(packingSize) || packingSize <= 0) return "";
  if (packingSize < 1) return `${formatQuantity(packingSize * 1000)} gm`;
  return `${formatQuantity(packingSize)} kg`;
}

function tallyDate(value) {
  if (!value) return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const parts = String(value).split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      const [year, month, day] = parts;
      return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
    }
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
    ...(masterResult.unitRequirementErrors || []),
    ...(masterResult.groupSummary?.lineErrors || []),
    ...(masterResult.unitSummary?.lineErrors || []),
    ...(masterResult.stockSummary?.lineErrors || [])
  ].filter(Boolean);
}

function extractListXml(xml, listName) {
  const safeTag = escapeRegExp(listName);
  const pattern = new RegExp(`<${safeTag}\\b[^>]*>[\\s\\S]*?</${safeTag}>`, "gi");
  return [...String(xml || "").matchAll(pattern)].map((match) => match[0]).join("\n");
}

function extractListBlocks(xml, listName) {
  const safeTag = escapeRegExp(listName);
  const pattern = new RegExp(`<${safeTag}\\b[^>]*>([\\s\\S]*?)</${safeTag}>`, "gi");
  return [...String(xml || "").matchAll(pattern)].map((match) => match[1] || "");
}

function normalizeCopiedListXml(xml, listName) {
  const text = String(xml || "").trim();
  if (!text || /^<[^>]+>\s*<\/[^>]+>$/i.test(text)) return "";
  return extractListXml(text, listName) || "";
}

function parseGstRateFromDetails(xml) {
  const rates = extractTagValues(xml, "GSTRATE")
    .map((value) => Number(value || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const igst = rates.find((value) => value > 0 && !rates.includes(value / 2));
  if (igst) return igst;
  const maxRate = Math.max(0, ...rates);
  return maxRate > 0 ? maxRate * 2 : 0;
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
  return /<LINEERROR>|<ERRORMSG>|<ERRORS>[1-9]|Function Execution Failed/i.test(xml);
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

function postXml(urlValue, xml, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlValue);
    const body = Buffer.from(xml, "utf8");
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request({
      method: "POST",
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: `${url.pathname || "/"}${url.search || ""}`,
      headers: {
        "Content-Type": "text/xml",
        "Content-Length": body.length
      },
      timeout: timeoutMs
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Tally request failed: HTTP ${response.statusCode} ${text.slice(0, 300)}`));
          return;
        }
        resolve(text);
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error(tallySetupMessage(urlValue)));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function sathiDiscountLedgerEnvelope(companyName) {
  const companyBlock = companyName ? `<SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>` : "";
  return `
<ENVELOPE>
  <HEADER>
    <VERSION>1</VERSION>
    <TALLYREQUEST>Export</TALLYREQUEST>
    <TYPE>Collection</TYPE>
    <ID>SATHI Discount Ledgers</ID>
  </HEADER>
  <BODY>
    <DESC>
      <STATICVARIABLES>
        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>
        ${companyBlock}
      </STATICVARIABLES>
      <TDL>
        <TDLMESSAGE>
          <COLLECTION NAME="SATHI Discount Ledgers" ISMODIFY="No">
            <TYPE>Ledger</TYPE>
            <FETCH>Name,Parent,Narration,Description,Notes</FETCH>
          </COLLECTION>
        </TDLMESSAGE>
      </TDL>
    </DESC>
  </BODY>
</ENVELOPE>`;
}

function parseRojmelGroups(xml) {
  const groups = [];
  const regex = /<GROUP\b([^>]*)>([\s\S]*?)<\/GROUP>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[2] || "";
    const name = decodeXml(attributeValue(match[1], "NAME") || extractTagValues(block, "NAME")[0] || "").trim();
    if (!name) continue;
    groups.push({
      name,
      parent: extractTagValues(block, "PARENT")[0] || ""
    });
  }
  return groups;
}

function parseRojmelLedgerMasters(xml) {
  const ledgers = [];
  const regex = /<LEDGER\b([^>]*)>([\s\S]*?)<\/LEDGER>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[2] || "";
    const name = decodeXml(attributeValue(match[1], "NAME") || extractTagValues(block, "NAME")[0] || "").trim();
    if (!name) continue;
    ledgers.push({
      name,
      parent: extractTagValues(block, "PARENT")[0] || "",
      openingBalance: parseSignedNumber(firstNonEmpty(extractTagValues(block, "OPENINGBALANCE")))
    });
  }
  return ledgers;
}

function parseRojmelVouchers(xml) {
  const vouchers = [];
  const regex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const voucher = parseRojmelVoucherBlock(match[2] || "");
    if (voucher) vouchers.push(voucher);
  }
  return vouchers;
}

function parseRojmelVoucherBlock(block) {
  const allLedgerBlocks = extractListBlocks(block, "ALLLEDGERENTRIES.LIST");
  const ledgerBlocks = allLedgerBlocks.length ? allLedgerBlocks : extractListBlocks(block, "LEDGERENTRIES.LIST");
  const ledgerEntries = ledgerBlocks.map((entryBlock) => ({
    ledgerName: firstLedgerNameForRojmel(entryBlock),
    amount: parseSignedNumber(firstNonEmpty(extractTagValues(entryBlock, "AMOUNT")))
  })).filter((entry) => entry.ledgerName);

  const voucherNumber = firstNonEmpty(extractTagValues(block, "VOUCHERNUMBER")) || firstNonEmpty(extractTagValues(block, "REFERENCE"));
  const date = firstNonEmpty(extractTagValues(block, "DATE"));
  if (!voucherNumber && !date && !ledgerEntries.length) return null;

  return {
    date,
    reference: firstNonEmpty(extractTagValues(block, "REFERENCE")),
    voucherNumber,
    voucherType: firstNonEmpty(extractTagValues(block, "VOUCHERTYPENAME")),
    partyLedgerName: firstNonEmpty(extractTagValues(block, "PARTYLEDGERNAME")) || firstNonEmpty(extractTagValues(block, "PARTYNAME")),
    narration: firstNonEmpty(extractTagValues(block, "NARRATION")),
    ledgerEntries
  };
}

function isSathiInventoryRow(row = {}) {
  return Boolean(
    row.isSathiBatch
    || String(row.salesBatchNo || "").trim()
    || String(row.originalOwner || "").trim()
    || String(row.packingSize || "").trim()
    || String(row.sathiCompanyLicenceNoS || "").trim()
  );
}

function normalizeLicenceType(value, cottonFallback = false) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "cotton") return "cotton";
  if (text === "seed") return "seed";
  return cottonFallback ? "cotton" : "seed";
}

function salesBatchMatchesScope(row = {}, activeLicenceCode = "", activeLicenceType = "seed") {
  if (!activeLicenceCode) return true;
  if (normalizeScopeClientId(row.sathiCompanyLicenceNoS) !== activeLicenceCode) return false;
  return activeLicenceType === "cotton" ? Boolean(row.sathiIsCottonS) : !row.sathiIsCottonS;
}

function firstLedgerNameForRojmel(block) {
  return firstNonEmpty([
    ...extractTagValues(block, "LEDGERNAME"),
    ...extractTagValues(block, "PARTYLEDGERNAME")
  ]);
}

function parseSignedNumber(value) {
  const cleaned = String(value || "")
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildRojmelReport({ filters = {}, cashBankLedgers = [], vouchers = [] }) {
  const ledgerMode = filters.rojmelLedgerMode || "both";
  const searchText = rojmelNormalizeName(filters.rojmelSearch || "");
  const voucherFilter = rojmelNormalizeName(filters.rojmelVoucherFilter || "");
  const cashBankMap = new Map(cashBankLedgers.map((ledger) => [rojmelNormalizeName(ledger.name), ledger]));
  const ledgerStates = new Map();

  for (const ledger of cashBankLedgers) {
    const openingBalance = Number(ledger.openingBalance || 0);
    ledgerStates.set(rojmelNormalizeName(ledger.name), {
      ledger,
      openingBalance,
      receipt: 0,
      payment: 0,
      closingBalance: openingBalance,
      balance: openingBalance,
      rows: []
    });
  }

  for (const voucher of vouchers) {
    const voucherDate = parseTallyDateValue(voucher.date);
    if (!voucherDate) continue;
    const inSelectedPeriod = rojmelInPeriod(voucherDate, filters.fromDate, filters.toDate);
    const beforeFromDate = filters.fromDate ? voucherDate < new Date(`${filters.fromDate}T00:00:00`) : false;
    for (const entry of voucher.ledgerEntries || []) {
      const ledgerKey = rojmelNormalizeName(entry.ledgerName);
      const ledger = cashBankMap.get(ledgerKey);
      if (!ledger) continue;
      const state = ledgerStates.get(ledgerKey);
      const effect = Number(entry.amount || 0);
      if (!state || !Number.isFinite(effect)) continue;
      if (beforeFromDate) {
        state.openingBalance += effect;
        state.closingBalance += effect;
        state.balance += effect;
        continue;
      }
      if (!inSelectedPeriod) continue;

      const flowType = rojmelFlowType(voucher.voucherType, effect);
      const value = Math.abs(effect);
      if (flowType === "receipt") state.receipt += value;
      else state.payment += value;
      state.balance += effect;
      state.closingBalance = state.balance;

      const againstLedgers = (voucher.ledgerEntries || [])
        .filter((item) => rojmelNormalizeName(item.ledgerName) !== ledgerKey)
        .map((item) => item.ledgerName)
        .filter(Boolean);
      const row = {
        type: "transaction",
        date: rojmelLocalIsoDate(voucherDate),
        voucherNumber: voucher.voucherNumber || voucher.reference || "",
        reference: voucher.reference || "",
        voucherType: voucher.voucherType || "",
        cashBankLedger: ledger.name,
        againstLedger: againstLedgers.join(", ") || voucher.partyLedgerName || "",
        narration: voucher.narration || "",
        receipt: flowType === "receipt" ? value : 0,
        payment: flowType === "payment" ? value : 0,
        entrySide: flowType,
        balance: state.balance
      };
      if (voucherFilter && !rojmelNormalizeName(row.voucherType).includes(voucherFilter)) continue;
      if (searchText) {
        const haystack = rojmelNormalizeName([
          row.cashBankLedger,
          row.againstLedger,
          row.voucherNumber,
          row.reference,
          row.voucherType,
          row.narration
        ].join(" "));
        if (!haystack.includes(searchText)) continue;
      }
      state.rows.push(row);
    }
  }

  for (const state of ledgerStates.values()) {
    state.closingBalance = state.balance;
  }

  const displayLedgerStates = [...ledgerStates.values()].filter((state) => {
    const category = rojmelLedgerCategory(state.ledger);
    if (ledgerMode !== "both" && category !== ledgerMode) return false;
    return state.rows.length || state.openingBalance || state.receipt || state.payment || state.closingBalance;
  });
  const sections = buildRojmelSections(displayLedgerStates);
  const totals = summarizeRojmelSection({ ledgers: displayLedgerStates });
  const rows = displayLedgerStates.flatMap((state) => state.rows);

  return {
    reportType: "rojmel_report",
    companyName: filters.companyName || "",
    fromDate: filters.fromDate || "",
    toDate: filters.toDate || "",
    ledgerMode,
    rows,
    sections,
    displayRows: buildRojmelDisplayRows(sections),
    totals,
    charts: buildRojmelCharts(rows),
    sourceStats: {
      cashBankLedgers: cashBankLedgers.length,
      vouchers: vouchers.length,
      displayedRows: rows.length
    },
    generatedAt: new Date().toISOString()
  };
}

function rojmelLedgerCategory(ledger = {}) {
  const parent = rojmelNormalizeName(ledger.parent);
  return parent.includes("cash") ? "cash" : "bank";
}

function rojmelFlowType(voucherType, effect) {
  const signedEffect = Number(effect || 0);
  if (signedEffect < 0) return "receipt";
  if (signedEffect > 0) return "payment";
  const text = rojmelNormalizeName(voucherType);
  if (/receipt|rcpt/.test(text)) return "receipt";
  if (/payment|pymt|pay/.test(text)) return "payment";
  return "payment";
}

function buildRojmelSections(ledgerStates) {
  const sections = [
    { key: "cash", title: "Cash", ledgers: [] },
    { key: "bank", title: "Bank", ledgers: [] }
  ];
  for (const state of ledgerStates) {
    const section = sections.find((item) => item.key === rojmelLedgerCategory(state.ledger)) || sections[1];
    section.ledgers.push(state);
  }
  return sections
    .filter((section) => section.ledgers.length)
    .map((section) => ({ ...section, totals: summarizeRojmelSection(section) }));
}

function summarizeRojmelSection(section = {}) {
  const ledgers = section.ledgers || [];
  return ledgers.reduce((total, ledger) => ({
    openingBalance: total.openingBalance + Number(ledger.openingBalance || 0),
    receipt: total.receipt + Number(ledger.receipt || 0),
    payment: total.payment + Number(ledger.payment || 0),
    closingBalance: total.closingBalance + Number(ledger.closingBalance || 0)
  }), { openingBalance: 0, receipt: 0, payment: 0, closingBalance: 0 });
}

function buildRojmelDisplayRows(sections) {
  const rows = [];
  for (const section of sections) {
    rows.push({
      type: "category",
      key: section.key,
      title: section.title,
      ledgerCount: section.ledgers.length,
      totals: section.totals
    });
    for (const ledger of section.ledgers) {
      rows.push({
        type: "ledger",
        key: ledger.ledger.name,
        ledgerName: ledger.ledger.name,
        parent: ledger.ledger.parent,
        openingBalance: ledger.openingBalance,
        receipt: ledger.receipt,
        payment: ledger.payment,
        closingBalance: ledger.closingBalance,
        balance: ledger.balance
      });
      rows.push(...ledger.rows.map((row) => ({ ...row, ledgerName: ledger.ledger.name })));
    }
  }
  return rows;
}

function parseBatchExpiryVoucherRows(xml, movement) {
  const rows = [];
  const regex = /<VOUCHER\b([^>]*)>([\s\S]*?)<\/VOUCHER>/gi;
  let match;

  while ((match = regex.exec(xml)) !== null) {
    const block = match[2] || "";
    const voucherNumber = extractTagValues(block, "VOUCHERNUMBER")[0] || extractTagValues(block, "REFERENCE")[0] || attributeValue(match[1], "VCHKEY") || "";
    const date = extractTagValues(block, "DATE")[0] || "";
    const voucherTypeName = extractTagValues(block, "VOUCHERTYPENAME")[0] || "";
    const partyLedgerName = extractTagValues(block, "PARTYLEDGERNAME")[0] || extractTagValues(block, "PARTYNAME")[0] || "";
    const inventory = parseVoucherInventory(block);

    for (const item of inventory) {
      if (!item.stockItemName && !item.lotNum) continue;
      const rowMovement = movement || inferBatchExpiryMovement(voucherTypeName, item.amount);
      rows.push({
        voucherNumber,
        date,
        voucherTypeName,
        partyLedgerName,
        movement: rowMovement,
        stockItemName: item.stockItemName,
        batchName: item.lotNum || "Primary Batch",
        originalOwner: item.originalOwner || "",
        salesBatchNo: item.salesBatchNo || "",
        sathiCompanyLicenceNo: item.sathiCompanyLicenceNo || "",
        sathiCompanyLicenceNoS: item.sathiCompanyLicenceNoS || "",
        sathiIsCotton: Boolean(item.sathiIsCotton),
        sathiIsCottonS: Boolean(item.sathiIsCottonS),
        sathiIsCottonValue: item.sathiIsCottonValue || "",
        sathiIsCottonSValue: item.sathiIsCottonSValue || "",
        portalPushed: Boolean(item.portalPushed),
        portalPushedValue: item.portalPushedValue || "",
        portalOrderNo: item.portalOrderNo || "",
        portalPushedAt: item.portalPushedAt || "",
        portalPushResult: item.portalPushResult || "",
        isSathiBatch: Boolean(item.isSathiBatch),
        quantityText: item.quantityText,
        quantity: Number(item.quantity || 0),
        quantityQtl: Number(item.quantityQtl || 0),
        rate: item.rate || "",
        amount: item.amount || "",
        expiryDate: item.expiryDate || "",
        godownName: item.godownName || "",
        packingSize: item.packingSize || ""
      });
    }
  }

  return rows;
}

function parseStockItemOpeningBatchRows(stockItems = []) {
  const rows = [];
  for (const stockItem of stockItems) {
    for (const batch of stockItem.openingBatches || []) {
      if (!batch.batchName && !batch.quantity) continue;
      rows.push({
        voucherNumber: "Opening Stock",
        date: "",
        voucherTypeName: "Opening Stock",
        partyLedgerName: "",
        movement: "in",
        stockItemName: stockItem.name,
        batchName: batch.batchName || "Primary Batch",
        quantityText: batch.quantityText || "",
        quantity: Number(batch.quantity || 0),
        rate: batch.openingRate || "",
        amount: batch.openingValue || "",
        expiryDate: batch.expiryDate || "",
        godownName: batch.godownName || "Main Location",
        packingSize: "",
        source: "opening"
      });
    }
  }
  return rows;
}

function inferBatchExpiryMovement(voucherTypeName, amount) {
  const text = rojmelNormalizeName(voucherTypeName);
  if (/sales|sale|delivery|outward|issue/.test(text)) return "out";
  if (/purchase|receipt|grn|inward|receive/.test(text)) return "in";
  return parseSignedNumber(amount) < 0 ? "out" : "in";
}

function filterBatchExpiryRowsByPeriod(rows = [], period = {}) {
  const from = period.fromDate ? new Date(`${period.fromDate}T00:00:00`) : null;
  const to = period.toDate ? new Date(`${period.toDate}T23:59:59`) : null;
  if (!from && !to) return rows;
  return rows.filter((row) => {
    const date = parseTallyDateValue(row.date);
    if (!date) return true;
    if (from && date < from) return false;
    if (to && date > to) return false;
    return true;
  });
}

function buildBatchExpiryReport({ rows = [], stockItems = [], period = {}, voucherTypes = [] }) {
  const stockMap = new Map(stockItems.map((item) => [normalizeLookupValue(item.name), item]));
  const batchMap = new Map();

  for (const row of rows) {
    const stockItem = stockMap.get(normalizeLookupValue(row.stockItemName)) || {};
    const stockGroup = stockItem.parent || "";
    const stockCategory = stockItem.stockCategory || "";
    const category = batchExpiryCategory(row.stockItemName, stockGroup, stockCategory);
    const companyName = batchExpiryCompanyName(stockGroup, stockCategory, category.key);
    const key = [
      normalizeLookupValue(row.stockItemName),
      normalizeLookupValue(row.batchName),
      normalizeLookupValue(row.godownName)
    ].join("::");
    if (!batchMap.has(key)) {
      batchMap.set(key, {
        stockItemName: row.stockItemName,
        stockGroup,
        stockCategory,
        companyName,
        category: category.label,
        categoryKey: category.key,
        categoryColor: category.color,
        batchName: row.batchName,
        godownName: row.godownName,
        expiryDate: normalizeBatchExpiryDate(row.expiryDate),
        expiryDateText: row.expiryDate || "",
        packingSize: row.packingSize || "",
        inQty: 0,
        outQty: 0,
        balanceQty: 0,
        vouchers: []
      });
    }
    const current = batchMap.get(key);
    if (!current.expiryDate && row.expiryDate) {
      current.expiryDate = normalizeBatchExpiryDate(row.expiryDate);
      current.expiryDateText = row.expiryDate;
    }
    const qty = Math.abs(Number(row.quantity || 0));
    if (row.movement === "out") current.outQty += qty;
    else current.inQty += qty;
    current.vouchers.push({
      voucherNumber: row.voucherNumber,
      voucherTypeName: row.voucherTypeName,
      date: row.date,
      partyLedgerName: row.partyLedgerName,
      movement: row.movement,
      quantity: qty,
      quantityText: row.quantityText || "",
      rate: row.rate || "",
      amount: row.amount || "",
      originalOwner: row.originalOwner || "",
      salesBatchNo: row.salesBatchNo || "",
      sathiCompanyLicenceNo: row.sathiCompanyLicenceNo || "",
      sathiCompanyLicenceNoS: row.sathiCompanyLicenceNoS || "",
      sathiIsCotton: Boolean(row.sathiIsCotton),
      sathiIsCottonS: Boolean(row.sathiIsCottonS),
      portalPushed: Boolean(row.portalPushed),
      portalOrderNo: row.portalOrderNo || "",
      portalPushedAt: row.portalPushedAt || "",
      portalPushResult: row.portalPushResult || "",
      isSathiBatch: Boolean(row.isSathiBatch)
    });
  }

  const today = new Date();
  const rowsOut = [...batchMap.values()].map((row) => {
    const daysToExpiry = row.expiryDate ? Math.ceil((row.expiryDate.getTime() - today.getTime()) / 86400000) : null;
    const bucket = batchExpiryBucket(daysToExpiry);
    const balanceQty = Math.max(0, Number(row.inQty || 0) - Number(row.outQty || 0));
    const firstWith = (field) => (row.vouchers || []).find((voucher) => String(voucher[field] || "").trim())?.[field] || "";
    const firstBoolean = (field) => Boolean((row.vouchers || []).find((voucher) => Boolean(voucher[field])));
    return {
      ...row,
      balanceQty,
      originalOwner: firstWith("originalOwner"),
      salesBatchNo: firstWith("salesBatchNo"),
      sathiCompanyLicenceNo: firstWith("sathiCompanyLicenceNo"),
      sathiCompanyLicenceNoS: firstWith("sathiCompanyLicenceNoS"),
      sathiIsCotton: firstBoolean("sathiIsCotton"),
      sathiIsCottonS: firstBoolean("sathiIsCottonS"),
      portalPushed: firstBoolean("portalPushed"),
      portalOrderNo: firstWith("portalOrderNo"),
      portalPushedAt: firstWith("portalPushedAt"),
      portalPushResult: firstWith("portalPushResult"),
      isSathiBatch: firstBoolean("isSathiBatch"),
      daysToExpiry,
      bucketKey: bucket.key,
      bucketLabel: bucket.label,
      status: bucket.status,
      statusTone: bucket.tone,
      expiryDate: row.expiryDate ? rojmelLocalIsoDate(row.expiryDate) : "",
      expiryDateText: row.expiryDate ? batchExpiryReadableDate(row.expiryDate) : row.expiryDateText
    };
  }).filter((row) => row.balanceQty > 0 || row.inQty > 0 || row.outQty > 0)
    .sort((a, b) => {
      const aDays = a.daysToExpiry ?? 99999;
      const bDays = b.daysToExpiry ?? 99999;
      return aDays - bDays || String(a.stockItemName).localeCompare(String(b.stockItemName));
    });

  return {
    reportType: "batch_expiry_report",
    rows: rowsOut,
    summary: summarizeBatchExpiryRows(rowsOut),
    groups: summarizeBatchExpiryGroups(rowsOut),
    buckets: summarizeBatchExpiryBuckets(rowsOut),
    voucherTypes,
    period,
    generatedAt: new Date().toISOString()
  };
}

function summarizeBatchExpiryRows(rows = []) {
  return rows.reduce((total, row) => ({
    totalBatches: total.totalBatches + 1,
    totalInQty: total.totalInQty + Number(row.inQty || 0),
    totalOutQty: total.totalOutQty + Number(row.outQty || 0),
    totalBalanceQty: total.totalBalanceQty + Number(row.balanceQty || 0),
    expired: total.expired + (row.bucketKey === "expired" ? 1 : 0),
    expiringSoon: total.expiringSoon + (["days30"].includes(row.bucketKey) ? 1 : 0)
  }), { totalBatches: 0, totalInQty: 0, totalOutQty: 0, totalBalanceQty: 0, expired: 0, expiringSoon: 0 });
}

function summarizeBatchExpiryGroups(rows = []) {
  const order = ["Seeds", "Pesticides", "Fertilizers", "Others"];
  const map = new Map();
  for (const row of rows) {
    const key = row.category || "Others";
    const current = map.get(key) || {
      group: key,
      color: row.categoryColor || "#0ea5e9",
      count: 0,
      balanceQty: 0,
      expired: 0,
      expiringSoon: 0
    };
    current.count += 1;
    current.balanceQty += Number(row.balanceQty || 0);
    current.expired += row.bucketKey === "expired" ? 1 : 0;
    current.expiringSoon += row.bucketKey === "days30" ? 1 : 0;
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
}

function summarizeBatchExpiryBuckets(rows = []) {
  const definitions = [
    { key: "expired", label: "Expired", tone: "danger" },
    { key: "days30", label: "0-30 days", tone: "warn" },
    { key: "days90", label: "31-90 days", tone: "busy" },
    { key: "safe", label: "90+ days", tone: "ok" },
    { key: "noExpiry", label: "No expiry", tone: "muted" }
  ];
  return definitions.map((definition) => {
    const matches = rows.filter((row) => row.bucketKey === definition.key);
    return {
      ...definition,
      count: matches.length,
      balanceQty: matches.reduce((sum, row) => sum + Number(row.balanceQty || 0), 0)
    };
  });
}

function batchExpiryCategory(itemName, stockGroup, stockCategory = "") {
  const text = rojmelNormalizeName(`${itemName || ""} ${stockGroup || ""} ${stockCategory || ""}`);
  if (/seed|sathi seed|seeds|beej|biyan|bij/.test(text)) return { key: "seeds", label: "Seeds", color: "#16a34a" };
  if (/pesticide|insecticide|fungicide|herbicide|weedicide|chemical|spray/.test(text)) return { key: "pesticides", label: "Pesticides", color: "#0ea5e9" };
  if (/fertilizer|fertiliser|khad|npk|dap|urea|micronutrient/.test(text)) return { key: "fertilizers", label: "Fertilizers", color: "#f59e0b" };
  return { key: "others", label: "Others", color: "#8b5cf6" };
}

function batchExpiryCompanyName(stockGroup = "", stockCategory = "", categoryKey = "") {
  const groupType = batchExpiryCategory("", stockGroup, "").key;
  const categoryType = batchExpiryCategory("", "", stockCategory).key;
  if (stockCategory && categoryType !== categoryKey) return stockCategory;
  if (stockGroup && groupType !== categoryKey) return stockGroup;
  return stockCategory || stockGroup || "";
}

function batchExpiryBucket(daysToExpiry) {
  if (daysToExpiry === null || daysToExpiry === undefined || !Number.isFinite(Number(daysToExpiry))) {
    return { key: "noExpiry", label: "No expiry", status: "No expiry date", tone: "busy" };
  }
  if (daysToExpiry < 0) return { key: "expired", label: "Expired", status: "Expired", tone: "danger" };
  if (daysToExpiry <= 30) return { key: "days30", label: "0-30 days", status: "Expiring soon", tone: "danger" };
  if (daysToExpiry <= 90) return { key: "days90", label: "31-90 days", status: "Watch", tone: "busy" };
  return { key: "safe", label: "90+ days", status: "Safe", tone: "ok" };
}

function normalizeBatchExpiryDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const tallyDateValue = parseTallyDateValue(text);
  if (tallyDateValue) return tallyDateValue;
  const match = text.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{4})$/);
  if (match) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = monthNames.indexOf(match[2].slice(0, 3).toLowerCase());
    if (month >= 0) return new Date(Number(match[3]), month, Number(match[1]), 12, 0, 0);
  }
  return null;
}

function batchExpiryReadableDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function buildRojmelCharts(rows) {
  const today = rows.reduce((total, row) => ({
    receipt: total.receipt + Number(row.receipt || 0),
    payment: total.payment + Number(row.payment || 0)
  }), { receipt: 0, payment: 0 });
  const voucherTypeMap = new Map();
  for (const row of rows) {
    const key = row.voucherType || "Other";
    const current = voucherTypeMap.get(key) || { name: key, receipt: 0, payment: 0 };
    current.receipt += Number(row.receipt || 0);
    current.payment += Number(row.payment || 0);
    voucherTypeMap.set(key, current);
  }
  const voucherTypes = [...voucherTypeMap.values()]
    .sort((a, b) => (b.receipt + b.payment) - (a.receipt + a.payment));
  return { today, voucherTypes };
}

function rojmelNormalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function rojmelInPeriod(date, fromDate, toDate) {
  const from = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
  const to = toDate ? new Date(`${toDate}T23:59:59`) : null;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function rojmelLocalIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
