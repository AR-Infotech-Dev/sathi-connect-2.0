import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";


const DATA_DIR = process.env.SATHI_DATA_DIR || "data";
const STORE_FILE = process.env.SATHI_DB_JSON_FILE || path.join(DATA_DIR, "saathi-connect-store.json");
const SQLITE_FILE = process.env.SATHI_DB_FILE || path.join(DATA_DIR, "saathi-connect.sqlite");

const EMPTY_STORE = {
  lotTrace: [],
  portalPushLog: [],
  sathiOrderQueue: [],
  grnLotCache: []
};

let storeCache = null;
let sqliteMirrorQueue = Promise.resolve();
let sqlJsPromise = null;

// const require = createRequire(import.meta.url);
const moduleUrl = typeof __filename !== "undefined" ? pathToFileURL(__filename).href : import.meta.url;
const require = createRequire(moduleUrl);

export function getDb() {
  throw new Error("Direct SQLite handles are not exposed; app-db mirrors writes to the configured SQLite file.");
}

export function flushDbWrites() {
  return sqliteMirrorQueue;
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
  const matchingLotRows = readStore().lotTrace
    .filter((row) => row.company_name === companyName && row.lot_num === lotNum);
  const rows = matchingLotRows
    .filter((row) => !stockItemName || row.stock_item_name === stockItemName);
  const fallbackRows = rows.length ? rows : matchingLotRows;
  fallbackRows.sort((a, b) => String(b.updated_at || "").localeCompare(String(a.updated_at || "")));
  return fallbackRows[0] ? mapLotTrace(fallbackRows[0]) : null;
}

export function findLotTracesForSale(companyName, inventoryRows = []) {
  return Object.fromEntries((inventoryRows || []).map((row) => {
    const trace = findLotTrace(companyName, row.lotNum, row.stockItemName);
    return [lotTraceKey(row), trace];
  }));
}

export function replaceGrnLotCache(companyName, licenceCode, rows = []) {
  if (!companyName) return [];
  const store = readStore();
  const activeLicence = normalizeCode(licenceCode);
  store.grnLotCache = (store.grnLotCache || []).filter((row) => (
    row.company_name !== companyName
    || (activeLicence && normalizeCode(row.licence_code) !== activeLicence)
  ));

  const now = new Date().toISOString();
  const startId = nextId(store.grnLotCache);
  const saved = rows.map((row, index) => ({
    id: startId + index,
    company_name: companyName,
    licence_code: licenceCode || "",
    grn_voucher_number: row.voucherNumber || "",
    grn_voucher_type: row.voucherTypeName || "",
    grn_date: row.date || "",
    party_name: row.partyLedgerName || "",
    lot_num: row.lotNum || "",
    stock_item_name: row.stockItemName || "",
    quantity_text: row.quantityText || "",
    quantity: row.quantity || 0,
    original_owner: row.originalOwner || "",
    packing_size: row.packingSize || "",
    raw_json: JSON.stringify(row || {}),
    cached_at: now
  })).filter((row) => row.lot_num);

  store.grnLotCache.push(...saved);
  writeStore(store);
  return saved.map(mapGrnLotCache);
}

export function listGrnLotCache(filters = {}) {
  const activeLicence = normalizeCode(filters.licenceCode);
  return (readStore().grnLotCache || [])
    .filter((row) => !filters.companyName || row.company_name === filters.companyName)
    .filter((row) => !activeLicence || normalizeCode(row.licence_code) === activeLicence)
    .filter((row) => reportDateMatches(row.grn_date || row.cached_at, filters))
    .filter((row) => {
      const lotQuery = normalizeCode(filters.lotNum);
      return !lotQuery || normalizeCode(row.lot_num).includes(lotQuery);
    })
    .sort((a, b) =>
      String(b.grn_date || b.cached_at || "").localeCompare(String(a.grn_date || a.cached_at || ""))
      || String(a.lot_num || "").localeCompare(String(b.lot_num || ""))
    )
    .map(mapGrnLotCache);
}

export function findGrnLotMatches(companyName, licenceCode, lotNums = []) {
  const wanted = new Set((lotNums || []).map(normalizeCode).filter(Boolean));
  if (!wanted.size) return {};
  return listGrnLotCache({ companyName, licenceCode })
    .filter((row) => wanted.has(normalizeCode(row.lotNum)))
    .reduce((acc, row) => {
      const key = normalizeCode(row.lotNum);
      if (!acc[key]) acc[key] = [];
      acc[key].push(row);
      return acc;
    }, {});
}

export function recordPortalPush(companyName, payload, response, status = "created") {
  const store = readStore();
  const voucherNumber = response?.response?.data?.voucherNumber || response?.data?.voucherNumber || "";
  const storedPayload = summarizePortalPayload(payload);
  store.portalPushLog.push({
    id: nextId(store.portalPushLog),
    company_name: companyName || "",
    tally_voucher_number: payload?.sourceVoucherNumber || "",
    tally_master_id: payload?.sourceMasterId || "",
    tally_voucher_type: payload?.sourceVoucherTypeName || "",
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

function summarizePortalPayload(payload = {}) {
  return {
      sourceVoucherNumber: payload.sourceVoucherNumber || "",
      sourceMasterId: payload.sourceMasterId || "",
      sourceReference: payload.sourceReference || "",
      sourceVoucherDate: payload.sourceVoucherDate || "",
      sourceVoucherTypeName: payload.sourceVoucherTypeName || "",
    buyerCode: payload.buyerCode || "",
    ownerCode: payload.ownerCode || "",
    locationCode: payload.locationCode || "",
    originalOwner: payload.originalOwner || "",
    demoRecord: Boolean(payload.demoRecord),
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

export function markSathiOrderQueueStatus(companyName, licenceCode, voucherNumber, status, metadata = {}) {
  const store = readStore();
  const wantedCompany = String(companyName || "");
  const wantedLicence = String(licenceCode || "");
  const wantedVoucher = String(voucherNumber || "");
  const nextStatus = String(status || "").trim();
  if (!wantedCompany || !wantedLicence || !wantedVoucher || !nextStatus) return null;

  const index = store.sathiOrderQueue.findIndex((row) =>
    row.company_name === wantedCompany
    && row.licence_code === wantedLicence
    && row.voucher_number === wantedVoucher
  );
  if (index < 0) return null;

  const existingOrder = parseJson(store.sathiOrderQueue[index].order_json, {});
  const nextOrder = Object.keys(metadata || {}).length
    ? {
        ...existingOrder,
        historicalPurchaseUpdate: {
          ...(existingOrder.historicalPurchaseUpdate || {}),
          ...metadata,
          status: nextStatus,
          updatedAt: new Date().toISOString()
        }
      }
    : existingOrder;

  store.sathiOrderQueue[index] = {
    ...store.sathiOrderQueue[index],
    queue_status: nextStatus,
    order_json: JSON.stringify(nextOrder),
    updated_at: new Date().toISOString()
  };
  writeStore(store);
  return store.sathiOrderQueue[index];
}

export function clearDemoSathiOrderQueue(companyName, licenceCode) {
  const store = readStore();
  const wantedCompany = String(companyName || "");
  const wantedLicence = String(licenceCode || "");
  const before = store.sathiOrderQueue.length;
  store.sathiOrderQueue = store.sathiOrderQueue.filter((row) => {
    const sameCompany = !wantedCompany || row.company_name === wantedCompany;
    const sameLicence = !wantedLicence || row.licence_code === wantedLicence;
    const isDemo = Boolean(parseJson(row.order_json, {}).demoRecord);
    return !(sameCompany && sameLicence && isDemo);
  });
  if (store.sathiOrderQueue.length !== before) writeStore(store);
  return before - store.sathiOrderQueue.length;
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
    .filter((row) => filters.demoMode === undefined || Boolean(parseJson(row.payload_json, {}).demoRecord) === Boolean(filters.demoMode))
    .filter((row) => reportDateMatches(row.created_at, filters))
    .sort((a, b) =>
      String(b.created_at || "").localeCompare(String(a.created_at || ""))
      || Number(b.id || 0) - Number(a.id || 0)
    )
    .map((row) => ({
      id: row.id,
      companyName: row.company_name,
      tallyVoucherNumber: row.tally_voucher_number,
      tallyMasterId: row.tally_master_id || "",
      tallyVoucherType: row.tally_voucher_type || "",
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
  mirrorStoreToSqlite(storeCache);
}

function mirrorStoreToSqlite(store) {
  sqliteMirrorQueue = sqliteMirrorQueue
    .then(() => writeSqliteMirror(store))
    .catch((error) => {
      console.warn(`SQLite mirror failed: ${error.message}`);
    });
}

async function writeSqliteMirror(store) {
  const absolutePath = path.resolve(SQLITE_FILE);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const SQL = await loadSqlJs();
  const db = fs.existsSync(absolutePath)
    ? new SQL.Database(fs.readFileSync(absolutePath))
    : new SQL.Database();

  try {
    ensureSqliteTables(db);
    for (const row of store.lotTrace || []) upsertSqliteLotTrace(db, row);
    for (const row of store.portalPushLog || []) upsertSqlitePortalPush(db, row);
    for (const row of store.sathiOrderQueue || []) upsertSqliteOrderQueue(db, row);
    for (const row of store.grnLotCache || []) upsertSqliteGrnLotCache(db, row);
    fs.writeFileSync(absolutePath, Buffer.from(db.export()));
  } finally {
    db.close();
  }
}

function loadSqlJs() {
  if (!sqlJsPromise) {
    const initSqlJs = require("sql.js/dist/sql-asm.js");
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

function ensureSqliteTables(db) {
  db.run(`
CREATE TABLE IF NOT EXISTS lot_trace (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT,
  lot_num TEXT,
  stock_item_name TEXT,
  portal_item_name TEXT,
  original_owner TEXT,
  supplier_name TEXT,
  inward_voucher_number TEXT,
  inward_date TEXT,
  buyer_code TEXT,
  raw_json TEXT,
  created_at TEXT,
  updated_at TEXT,
  packing_size TEXT
);
CREATE TABLE IF NOT EXISTS portal_push_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT,
  tally_voucher_number TEXT,
  tally_master_id TEXT,
  tally_voucher_type TEXT,
  sathi_voucher_number TEXT,
  buyer_code TEXT,
  original_owner TEXT,
  status TEXT,
  payload_json TEXT,
  response_json TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS sathi_order_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT,
  licence_code TEXT,
  voucher_number TEXT,
  voucher_date TEXT,
  seller_code TEXT,
  seller_name TEXT,
  buyer_code TEXT,
  buyer_name TEXT,
  total_bill_price TEXT,
  queue_status TEXT,
  source_action TEXT,
  order_json TEXT,
  lot_json TEXT,
  created_at TEXT,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS grn_lot_cache (
  id INTEGER PRIMARY KEY,
  company_name TEXT,
  licence_code TEXT,
  grn_voucher_number TEXT,
  grn_voucher_type TEXT,
  grn_date TEXT,
  party_name TEXT,
  lot_num TEXT,
  stock_item_name TEXT,
  quantity_text TEXT,
  quantity REAL,
  original_owner TEXT,
  packing_size TEXT,
  raw_json TEXT,
  cached_at TEXT
);`);
  ensureSqliteColumn(db, "lot_trace", "packing_size", "TEXT");
  ensureSqliteColumn(db, "portal_push_log", "tally_master_id", "TEXT");
  ensureSqliteColumn(db, "portal_push_log", "tally_voucher_type", "TEXT");
}

function ensureSqliteColumn(db, tableName, columnName, definition) {
  const result = db.exec(`PRAGMA table_info(${tableName})`);
  const columns = result[0]?.values?.map((row) => row[1]) || [];
  if (!columns.includes(columnName)) db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function upsertSqliteLotTrace(db, row) {
  const existingId = firstSqliteValue(db, `
SELECT id FROM lot_trace
WHERE company_name = ? AND lot_num = ? AND stock_item_name = ?
ORDER BY updated_at DESC, id DESC
LIMIT 1`, [row.company_name, row.lot_num, row.stock_item_name]);
  const values = [
    row.company_name || "",
    row.lot_num || "",
    row.stock_item_name || "",
    row.portal_item_name || "",
    row.original_owner || "",
    row.supplier_name || "",
    row.inward_voucher_number || "",
    row.inward_date || "",
    row.buyer_code || "",
    row.raw_json || "{}",
    row.created_at || new Date().toISOString(),
    row.updated_at || new Date().toISOString(),
    row.packing_size || ""
  ];
  if (existingId) {
    runSqlite(db, `
UPDATE lot_trace SET
  company_name = ?, lot_num = ?, stock_item_name = ?, portal_item_name = ?, original_owner = ?,
  supplier_name = ?, inward_voucher_number = ?, inward_date = ?, buyer_code = ?, raw_json = ?,
  created_at = ?, updated_at = ?, packing_size = ?
WHERE id = ?`, [...values, existingId]);
  } else {
    runSqlite(db, `
INSERT INTO lot_trace (
  company_name, lot_num, stock_item_name, portal_item_name, original_owner,
  supplier_name, inward_voucher_number, inward_date, buyer_code, raw_json,
  created_at, updated_at, packing_size
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);
  }
}

function upsertSqlitePortalPush(db, row) {
  if (row.id && firstSqliteValue(db, "SELECT id FROM portal_push_log WHERE id = ?", [row.id])) return;
  runSqlite(db, `
INSERT INTO portal_push_log (
  company_name, tally_voucher_number, tally_master_id, tally_voucher_type, sathi_voucher_number, buyer_code, original_owner,
  status, payload_json, response_json, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    row.company_name || "",
    row.tally_voucher_number || "",
    row.tally_master_id || "",
    row.tally_voucher_type || "",
    row.sathi_voucher_number || "",
    row.buyer_code || "",
    row.original_owner || "",
    row.status || "",
    row.payload_json || "{}",
    row.response_json || "{}",
    row.created_at || new Date().toISOString()
  ]);
}

function upsertSqliteOrderQueue(db, row) {
  const existingId = firstSqliteValue(db, `
SELECT id FROM sathi_order_queue
WHERE company_name = ? AND licence_code = ? AND voucher_number = ?
LIMIT 1`, [row.company_name, row.licence_code, row.voucher_number]);
  const values = [
    row.company_name || "",
    row.licence_code || "",
    row.voucher_number || "",
    row.voucher_date || "",
    row.seller_code || "",
    row.seller_name || "",
    row.buyer_code || "",
    row.buyer_name || "",
    row.total_bill_price || "",
    row.queue_status || "",
    row.source_action || "",
    row.order_json || "{}",
    row.lot_json || "{}",
    row.created_at || new Date().toISOString(),
    row.updated_at || new Date().toISOString()
  ];
  if (existingId) {
    runSqlite(db, `
UPDATE sathi_order_queue SET
  company_name = ?, licence_code = ?, voucher_number = ?, voucher_date = ?, seller_code = ?,
  seller_name = ?, buyer_code = ?, buyer_name = ?, total_bill_price = ?, queue_status = ?,
  source_action = ?, order_json = ?, lot_json = ?, created_at = ?, updated_at = ?
WHERE id = ?`, [...values, existingId]);
  } else {
    runSqlite(db, `
INSERT INTO sathi_order_queue (
  company_name, licence_code, voucher_number, voucher_date, seller_code,
  seller_name, buyer_code, buyer_name, total_bill_price, queue_status,
  source_action, order_json, lot_json, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, values);
  }
}

function upsertSqliteGrnLotCache(db, row) {
  if (row.id && firstSqliteValue(db, "SELECT id FROM grn_lot_cache WHERE id = ?", [row.id])) return;
  runSqlite(db, `
INSERT INTO grn_lot_cache (
  id, company_name, licence_code, grn_voucher_number, grn_voucher_type, grn_date,
  party_name, lot_num, stock_item_name, quantity_text, quantity, original_owner,
  packing_size, raw_json, cached_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    row.id || null,
    row.company_name || "",
    row.licence_code || "",
    row.grn_voucher_number || "",
    row.grn_voucher_type || "",
    row.grn_date || "",
    row.party_name || "",
    row.lot_num || "",
    row.stock_item_name || "",
    row.quantity_text || "",
    Number(row.quantity || 0),
    row.original_owner || "",
    row.packing_size || "",
    row.raw_json || "{}",
    row.cached_at || ""
  ]);
}

function firstSqliteValue(db, sql, values = []) {
  const statement = db.prepare(sql);
  try {
    statement.bind(values);
    return statement.step() ? statement.get()[0] : null;
  } finally {
    statement.free();
  }
}

function runSqlite(db, sql, values = []) {
  const statement = db.prepare(sql);
  try {
    statement.run(values);
  } finally {
    statement.free();
  }
}

function normalizeStore(store = {}) {
  return {
    lotTrace: Array.isArray(store.lotTrace) ? store.lotTrace : [],
    portalPushLog: Array.isArray(store.portalPushLog) ? store.portalPushLog : [],
    sathiOrderQueue: Array.isArray(store.sathiOrderQueue) ? store.sathiOrderQueue : [],
    grnLotCache: Array.isArray(store.grnLotCache) ? store.grnLotCache : []
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
    portalItemName: portalItemName(lot),
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
  return portalItemName(lot);
}

function portalItemName(lot = {}) {
  return [
    cleanItemNamePart(lot.cropName),
    cleanItemNamePart(stripBracketText(lot.varietyName || lot.varietyCode)),
    formatPackingForItemName(lot)
  ].filter(Boolean).join(" ") || lot.lotNum || "";
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
  if (packingSize < 1) return `${formatStoreQuantity(packingSize * 1000)} gm`;
  return `${formatStoreQuantity(packingSize)} kg`;
}

function formatStoreQuantity(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : String(Number(parsed.toFixed(3)));
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

function mapGrnLotCache(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    licenceCode: row.licence_code,
    grnVoucherNumber: row.grn_voucher_number,
    grnVoucherType: row.grn_voucher_type,
    grnDate: row.grn_date,
    partyName: row.party_name,
    lotNum: row.lot_num,
    stockItemName: row.stock_item_name,
    quantityText: row.quantity_text,
    quantity: row.quantity,
    originalOwner: row.original_owner,
    packingSize: row.packing_size,
    cachedAt: row.cached_at,
    raw: parseJson(row.raw_json, {})
  };
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
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
  const compactYmd = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactYmd) return new Date(`${compactYmd[1]}-${compactYmd[2]}-${compactYmd[3]}T12:00:00`);
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T12:00:00`);
  const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T12:00:00`);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
