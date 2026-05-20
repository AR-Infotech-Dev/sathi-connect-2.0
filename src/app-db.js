import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SATHI_DATA_DIR || "data";
const STORE_FILE = process.env.SATHI_DB_JSON_FILE || path.join(DATA_DIR, "saathi-connect-store.json");

const EMPTY_STORE = {
  lotTrace: [],
  portalPushLog: [],
  sathiOrderQueue: []
};

let storeCache = null;

export function getDb() {
  throw new Error("The SQLite runtime is not available in this Windows-compatible build.");
}

export function upsertLotTraces(companyName, bill = {}, mapping = {}) {
  const lots = Array.isArray(bill.lotData) ? bill.lotData : [];
  if (!companyName || !lots.length) return [];

  const store = readStore();
  const saved = [];
  for (const lot of lots) {
    const row = lotTraceRow(companyName, bill, lot, mapping);
    if (!row.lotNum || !row.originalOwner) continue;
    const now = new Date().toISOString();
    const index = store.lotTrace.findIndex((entry) =>
      entry.company_name === row.companyName
      && entry.lot_num === row.lotNum
      && entry.stock_item_name === row.stockItemName
    );
    const record = {
      id: index >= 0 ? store.lotTrace[index].id : nextId(store.lotTrace),
      company_name: row.companyName,
      lot_num: row.lotNum,
      stock_item_name: row.stockItemName,
      portal_item_name: row.portalItemName,
      packing_size: row.packingSize,
      original_owner: row.originalOwner,
      supplier_name: row.supplierName,
      inward_voucher_number: row.inwardVoucherNumber,
      inward_date: row.inwardDate,
      buyer_code: row.buyerCode,
      raw_json: JSON.stringify(row.raw),
      created_at: index >= 0 ? store.lotTrace[index].created_at : now,
      updated_at: now
    };
    if (index >= 0) store.lotTrace[index] = record;
    else store.lotTrace.push(record);
    saved.push(row);
  }
  writeStore(store);
  return saved;
}

export function findLotTrace(companyName, lotNum, stockItemName = "") {
  if (!companyName || !lotNum) return null;
  const rows = readStore().lotTrace
    .filter((row) => row.company_name === companyName && row.lot_num === lotNum)
    .filter((row) => !stockItemName || row.stock_item_name === stockItemName)
    .sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return rows[0] ? mapLotTrace(rows[0]) : null;
}

export function findLotTracesForSale(companyName, inventoryRows = []) {
  return Object.fromEntries((inventoryRows || []).map((row) => {
    const trace = findLotTrace(companyName, row.lotNum, row.stockItemName);
    return [lotTraceKey(row), trace];
  }));
}

export function recordPortalPush(companyName, payload, response, status = "created") {
  const store = readStore();
  const voucherNumber = response?.response?.data?.voucherNumber || response?.data?.voucherNumber || "";
  const storedPayload = shouldKeepTechArtifacts() ? payload || {} : summarizePortalPayload(payload);
  store.portalPushLog.push({
    id: nextId(store.portalPushLog),
    company_name: companyName || "",
    tally_voucher_number: payload?.sourceVoucherNumber || "",
    sathi_voucher_number: voucherNumber,
    buyer_code: payload?.buyerCode || "",
    original_owner: payload?.originalOwner || "",
    status,
    payload_json: JSON.stringify(storedPayload),
    response_json: JSON.stringify(response || {}),
    created_at: new Date().toISOString()
  });
  writeStore(store);
}

function shouldKeepTechArtifacts() {
  return process.env.SATHI_KEEP_TECH_ARTIFACTS === "1";
}

function summarizePortalPayload(payload = {}) {
  return {
    sourceVoucherNumber: payload.sourceVoucherNumber || "",
    sourceReference: payload.sourceReference || "",
    sourceVoucherDate: payload.sourceVoucherDate || "",
    buyerCode: payload.buyerCode || "",
    ownerCode: payload.ownerCode || "",
    locationCode: payload.locationCode || "",
    originalOwner: payload.originalOwner || "",
    isRetailSell: payload.isRetailSell || "",
    sellerRole: payload.sellerRole || "",
    buyerRole: payload.buyerRole || "",
    lotTypeStockDetails: Array.isArray(payload.lotTypeStockDetails)
      ? payload.lotTypeStockDetails.map((lot) => ({
          lotNum: lot.lotNum || "",
          certificationClass: lot.certificationClass || "",
          packingSize: lot.packingSize || "",
          quantity: lot.quantity ?? ""
        }))
      : []
  };
}

export function upsertSathiOrderQueue(companyName, licenceCode, action, data) {
  const rows = sathiQueueRowsFromResponse(data);
  if (!companyName || !licenceCode || !rows.length) return [];

  const store = readStore();
  const saved = [];
  for (const row of rows) {
    const normalized = sathiQueueRow(companyName, licenceCode, action, row);
    if (!normalized.voucherNumber) continue;
    const now = new Date().toISOString();
    const index = store.sathiOrderQueue.findIndex((entry) =>
      entry.company_name === normalized.companyName
      && entry.licence_code === normalized.licenceCode
      && entry.voucher_number === normalized.voucherNumber
    );
    const existing = index >= 0 ? store.sathiOrderQueue[index] : {};
    const record = {
      id: existing.id || nextId(store.sathiOrderQueue),
      company_name: normalized.companyName,
      licence_code: normalized.licenceCode,
      voucher_number: normalized.voucherNumber,
      voucher_date: normalized.voucherDate || existing.voucher_date || "",
      seller_code: normalized.sellerCode || existing.seller_code || "",
      seller_name: normalized.sellerName || existing.seller_name || "",
      buyer_code: normalized.buyerCode || existing.buyer_code || "",
      buyer_name: normalized.buyerName || existing.buyer_name || "",
      total_bill_price: normalized.totalBillPrice || existing.total_bill_price || "",
      queue_status: Object.keys(normalized.lot).length ? normalized.queueStatus : (existing.queue_status || normalized.queueStatus),
      source_action: normalized.sourceAction,
      order_json: JSON.stringify(normalized.order),
      lot_json: Object.keys(normalized.lot).length ? JSON.stringify(normalized.lot) : (existing.lot_json || "{}"),
      created_at: existing.created_at || now,
      updated_at: now
    };
    if (index >= 0) store.sathiOrderQueue[index] = record;
    else store.sathiOrderQueue.push(record);
    saved.push(normalized);
  }
  writeStore(store);
  return saved;
}

export function listSathiOrderQueue(filters = {}) {
  const rows = readStore().sathiOrderQueue
    .filter((row) => !filters.companyName || row.company_name === filters.companyName)
    .filter((row) => !filters.licenceCode || row.licence_code === filters.licenceCode)
    .sort((a, b) =>
      String(b.updated_at || "").localeCompare(String(a.updated_at || ""))
      || String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );

  const orders = [];
  const lotBills = [];
  for (const row of rows) {
    const order = {
      ...parseJson(row.order_json, {}),
      voucherNumber: row.voucher_number,
      voucherDate: row.voucher_date,
      sellerCode: row.seller_code,
      sellerName: row.seller_name,
      buyerCode: row.buyer_code,
      buyerName: row.buyer_name,
      totalBillPrice: row.total_bill_price,
      licenceCode: row.licence_code,
      queueStatus: row.queue_status,
      sourceAction: row.source_action,
      updatedAt: row.updated_at
    };
    orders.push(order);

    const lot = parseJson(row.lot_json, {});
    if (lot && Object.keys(lot).length) {
      lotBills.push({
        ...lot,
        billNumber: lot.billNumber || row.voucher_number,
        voucherNumber: lot.voucherNumber || row.voucher_number,
        buyerCode: lot.buyerCode || row.buyer_code || row.licence_code,
        sellerCode: lot.sellerCode || row.seller_code,
        sellerName: lot.sellerName || row.seller_name,
        buyerName: lot.buyerName || row.buyer_name,
        totalBillPrice: lot.totalBillPrice || row.total_bill_price,
        licenceCode: row.licence_code
      });
    }
  }

  return { orders, lotBills };
}

export function listLotTraceReport(filters = {}) {
  return readStore().lotTrace
    .filter((row) => !filters.companyName || row.company_name === filters.companyName)
    .sort((a, b) =>
      String(b.inward_date || b.updated_at || "").localeCompare(String(a.inward_date || a.updated_at || ""))
      || String(a.lot_num || "").localeCompare(String(b.lot_num || ""))
    )
    .filter((row) => reportDateMatches(row.inward_date || row.updated_at, filters))
    .filter((row) => {
      const lotQuery = String(filters.lotNum || "").trim().toUpperCase();
      if (!lotQuery) return true;
      return String(row.lot_num || "").toUpperCase().includes(lotQuery);
    })
    .map((row) => ({
      ...mapLotTrace(row),
      raw: parseJson(row.raw_json, {})
    }));
}

export function listPortalPushReport(filters = {}) {
  return readStore().portalPushLog
    .filter((row) => !filters.companyName || row.company_name === filters.companyName)
    .filter((row) => reportDateMatches(row.created_at, filters))
    .sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
      || Number(b.id || 0) - Number(a.id || 0)
    )
    .map((row) => ({
      id: row.id,
      companyName: row.company_name,
      tallyVoucherNumber: row.tally_voucher_number,
      sathiVoucherNumber: row.sathi_voucher_number,
      buyerCode: row.buyer_code,
      originalOwner: row.original_owner,
      status: row.status,
      payload: parseJson(row.payload_json, {}),
      response: parseJson(row.response_json, {}),
      createdAt: row.created_at
    }));
}

export function lotTraceKey(row = {}) {
  return `${row.lotNum || ""}::${row.stockItemName || ""}`;
}

function readStore() {
  if (storeCache) return storeCache;
  const absolutePath = path.resolve(STORE_FILE);
  if (!fs.existsSync(absolutePath)) {
    storeCache = cloneStore(EMPTY_STORE);
    return storeCache;
  }
  try {
    storeCache = normalizeStore(JSON.parse(fs.readFileSync(absolutePath, "utf8")));
  } catch {
    storeCache = cloneStore(EMPTY_STORE);
  }
  return storeCache;
}

function writeStore(store) {
  storeCache = normalizeStore(store);
  fs.mkdirSync(path.dirname(path.resolve(STORE_FILE)), { recursive: true });
  fs.writeFileSync(path.resolve(STORE_FILE), `${JSON.stringify(storeCache, null, 2)}\n`);
}

function normalizeStore(store = {}) {
  return {
    lotTrace: Array.isArray(store.lotTrace) ? store.lotTrace : [],
    portalPushLog: Array.isArray(store.portalPushLog) ? store.portalPushLog : [],
    sathiOrderQueue: Array.isArray(store.sathiOrderQueue) ? store.sathiOrderQueue : []
  };
}

function cloneStore(store) {
  return JSON.parse(JSON.stringify(store));
}

function nextId(rows) {
  return rows.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0) + 1;
}

function lotTraceRow(companyName, bill, lot, mapping) {
  return {
    companyName,
    lotNum: lot.lotNum || "",
    stockItemName: resolveTraceStockItem(lot, mapping),
    portalItemName: lot.varietyName || lot.cropName || lot.lotNum || "",
    packingSize: lot.packingSize || "",
    originalOwner: bill.sellerCode || "",
    supplierName: bill.sellerName || "",
    inwardVoucherNumber: bill.billNumber || bill.voucherNumber || "",
    inwardDate: bill.billDate || "",
    buyerCode: bill.buyerCode || "",
    raw: { bill, lot }
  };
}

function resolveTraceStockItem(lot, mapping = {}) {
  const key = lot.varietyCode || lot.varietyName || lot.cropCode || lot.cropName || lot.lotNum || "";
  const stored = mapping.itemMappings?.[key] || mapping.itemMappings?.[lot.varietyName] || {};
  if (stored?.tallyItemName) return stored.tallyItemName;
  if (typeof stored === "string") return stored;
  return lot.varietyName || lot.cropName || "";
}

function mapLotTrace(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    lotNum: row.lot_num,
    stockItemName: row.stock_item_name,
    portalItemName: row.portal_item_name,
    packingSize: row.packing_size || "",
    originalOwner: row.original_owner,
    supplierName: row.supplier_name,
    inwardVoucherNumber: row.inward_voucher_number,
    inwardDate: row.inward_date,
    buyerCode: row.buyer_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function sathiQueueRowsFromResponse(data) {
  if (Array.isArray(data?.response?.data)) return data.response.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function sathiQueueRow(companyName, licenceCode, action, row = {}) {
  const isLotAction = action === "pullLot" || action === "fetchLot";
  const voucherNumber = row.voucherNumber || row.billNumber || "";
  const voucherDate = row.voucherDate || row.billDate || "";
  const buyerCode = row.buyerCode || row.buyer_code || licenceCode || "";
  const normalizedOrder = {
    ...row,
    voucherNumber,
    voucherDate,
    sellerCode: row.sellerCode || row.seller_code || "",
    sellerName: row.sellerName || row.seller_name || "",
    buyerCode,
    buyerName: row.buyerName || row.buyer_name || "",
    totalBillPrice: String(row.totalBillPrice ?? row.billPrice ?? row.totalAmount ?? row.amount ?? ""),
    licenceCode
  };

  return {
    companyName,
    licenceCode,
    voucherNumber,
    voucherDate,
    sellerCode: normalizedOrder.sellerCode,
    sellerName: normalizedOrder.sellerName,
    buyerCode,
    buyerName: normalizedOrder.buyerName,
    totalBillPrice: normalizedOrder.totalBillPrice,
    queueStatus: isLotAction ? "lot-received" : "pending",
    sourceAction: action,
    order: normalizedOrder,
    lot: isLotAction ? { ...row, licenceCode } : {}
  };
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function reportDateMatches(value, filters = {}) {
  const rowDate = parseReportDate(value);
  const fromDate = parseReportDate(filters.fromDate);
  const toDate = parseReportDate(filters.toDate);
  if (!rowDate) return true;
  if (fromDate && rowDate < fromDate) return false;
  if (toDate && rowDate > toDate) return false;
  return true;
}

function parseReportDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T12:00:00`);
  const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T12:00:00`);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
