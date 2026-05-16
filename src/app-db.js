import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = process.env.SATHI_DATA_DIR || "data";
const DB_FILE = process.env.SATHI_DB_FILE || path.join(DATA_DIR, "saathi-connect.sqlite");

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  dbInstance = new DatabaseSync(path.resolve(DB_FILE));
  dbInstance.exec("PRAGMA journal_mode = WAL");
  dbInstance.exec("PRAGMA foreign_keys = ON");
  migrate(dbInstance);
  return dbInstance;
}

export function upsertLotTraces(companyName, bill = {}, mapping = {}) {
  const lots = Array.isArray(bill.lotData) ? bill.lotData : [];
  if (!companyName || !lots.length) return [];

  const db = getDb();
  const statement = db.prepare(`
    INSERT INTO lot_trace (
      company_name,
      lot_num,
      stock_item_name,
      portal_item_name,
      packing_size,
      original_owner,
      supplier_name,
      inward_voucher_number,
      inward_date,
      buyer_code,
      raw_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(company_name, lot_num, stock_item_name) DO UPDATE SET
      portal_item_name = excluded.portal_item_name,
      packing_size = excluded.packing_size,
      original_owner = excluded.original_owner,
      supplier_name = excluded.supplier_name,
      inward_voucher_number = excluded.inward_voucher_number,
      inward_date = excluded.inward_date,
      buyer_code = excluded.buyer_code,
      raw_json = excluded.raw_json,
      updated_at = datetime('now')
  `);

  const saved = [];
  db.exec("BEGIN");
  try {
    for (const lot of lots) {
      const row = lotTraceRow(companyName, bill, lot, mapping);
      if (!row.lotNum || !row.originalOwner) continue;
      statement.run(
        row.companyName,
        row.lotNum,
        row.stockItemName,
        row.portalItemName,
        row.packingSize,
        row.originalOwner,
        row.supplierName,
        row.inwardVoucherNumber,
        row.inwardDate,
        row.buyerCode,
        JSON.stringify(row.raw)
      );
      saved.push(row);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return saved;
}

export function findLotTrace(companyName, lotNum, stockItemName = "") {
  if (!companyName || !lotNum) return null;
  const db = getDb();
  const exact = stockItemName
    ? db.prepare(`
        SELECT * FROM lot_trace
        WHERE company_name = ? AND lot_num = ? AND stock_item_name = ?
        ORDER BY updated_at DESC
        LIMIT 1
      `).get(companyName, lotNum, stockItemName)
    : null;
  const row = exact || db.prepare(`
    SELECT * FROM lot_trace
    WHERE company_name = ? AND lot_num = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(companyName, lotNum);
  return row ? mapLotTrace(row) : null;
}

export function findLotTracesForSale(companyName, inventoryRows = []) {
  return Object.fromEntries((inventoryRows || []).map((row) => {
    const trace = findLotTrace(companyName, row.lotNum, row.stockItemName);
    return [lotTraceKey(row), trace];
  }));
}

export function recordPortalPush(companyName, payload, response, status = "created") {
  const db = getDb();
  const voucherNumber = response?.response?.data?.voucherNumber || response?.data?.voucherNumber || "";
  const statement = db.prepare(`
    INSERT INTO portal_push_log (
      company_name,
      tally_voucher_number,
      sathi_voucher_number,
      buyer_code,
      original_owner,
      status,
      payload_json,
      response_json,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  statement.run(
    companyName || "",
    payload?.sourceVoucherNumber || "",
    voucherNumber,
    payload?.buyerCode || "",
    payload?.originalOwner || "",
    status,
    JSON.stringify(payload || {}),
    JSON.stringify(response || {})
  );
}

export function upsertSathiOrderQueue(companyName, licenceCode, action, data) {
  const rows = sathiQueueRowsFromResponse(data);
  if (!companyName || !licenceCode || !rows.length) return [];

  const db = getDb();
  const statement = db.prepare(`
    INSERT INTO sathi_order_queue (
      company_name,
      licence_code,
      voucher_number,
      voucher_date,
      seller_code,
      seller_name,
      buyer_code,
      buyer_name,
      total_bill_price,
      queue_status,
      source_action,
      order_json,
      lot_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(company_name, licence_code, voucher_number) DO UPDATE SET
      voucher_date = CASE WHEN excluded.voucher_date != '' THEN excluded.voucher_date ELSE sathi_order_queue.voucher_date END,
      seller_code = CASE WHEN excluded.seller_code != '' THEN excluded.seller_code ELSE sathi_order_queue.seller_code END,
      seller_name = CASE WHEN excluded.seller_name != '' THEN excluded.seller_name ELSE sathi_order_queue.seller_name END,
      buyer_code = CASE WHEN excluded.buyer_code != '' THEN excluded.buyer_code ELSE sathi_order_queue.buyer_code END,
      buyer_name = CASE WHEN excluded.buyer_name != '' THEN excluded.buyer_name ELSE sathi_order_queue.buyer_name END,
      total_bill_price = CASE WHEN excluded.total_bill_price != '' THEN excluded.total_bill_price ELSE sathi_order_queue.total_bill_price END,
      queue_status = CASE
        WHEN excluded.lot_json != '{}' THEN excluded.queue_status
        WHEN sathi_order_queue.lot_json != '{}' THEN sathi_order_queue.queue_status
        ELSE excluded.queue_status
      END,
      source_action = excluded.source_action,
      order_json = excluded.order_json,
      lot_json = CASE WHEN excluded.lot_json != '{}' THEN excluded.lot_json ELSE sathi_order_queue.lot_json END,
      updated_at = datetime('now')
  `);

  const saved = [];
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      const normalized = sathiQueueRow(companyName, licenceCode, action, row);
      if (!normalized.voucherNumber) continue;
      statement.run(
        normalized.companyName,
        normalized.licenceCode,
        normalized.voucherNumber,
        normalized.voucherDate,
        normalized.sellerCode,
        normalized.sellerName,
        normalized.buyerCode,
        normalized.buyerName,
        normalized.totalBillPrice,
        normalized.queueStatus,
        normalized.sourceAction,
        JSON.stringify(normalized.order),
        JSON.stringify(normalized.lot)
      );
      saved.push(normalized);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return saved;
}

export function listSathiOrderQueue(filters = {}) {
  const db = getDb();
  const clauses = [];
  const params = [];

  if (filters.companyName) {
    clauses.push("company_name = ?");
    params.push(filters.companyName);
  }
  if (filters.licenceCode) {
    clauses.push("licence_code = ?");
    params.push(filters.licenceCode);
  }

  const rows = db.prepare(`
    SELECT * FROM sathi_order_queue
    ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
    ORDER BY updated_at DESC, created_at DESC
  `).all(...params);

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
  const db = getDb();
  const where = filters.companyName ? "WHERE company_name = ?" : "";
  const params = filters.companyName ? [filters.companyName] : [];
  return db.prepare(`
    SELECT * FROM lot_trace
    ${where}
    ORDER BY inward_date DESC, updated_at DESC, lot_num ASC
  `).all(...params).filter((row) => reportDateMatches(row.inward_date || row.updated_at, filters)).filter((row) => {
    const lotQuery = String(filters.lotNum || "").trim().toUpperCase();
    if (!lotQuery) return true;
    return String(row.lot_num || "").toUpperCase().includes(lotQuery);
  }).map((row) => {
    const mapped = mapLotTrace(row);
    return {
      ...mapped,
      raw: parseJson(row.raw_json, {})
    };
  });
}

export function listPortalPushReport(filters = {}) {
  const db = getDb();
  const { where, params } = reportWhere(filters, "created_at", "company_name");
  return db.prepare(`
    SELECT * FROM portal_push_log
    ${where}
    ORDER BY created_at DESC, id DESC
  `).all(...params).map((row) => ({
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

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_settings (
      company_name TEXT NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (company_name, setting_key)
    );

    CREATE TABLE IF NOT EXISTS item_mappings (
      company_name TEXT NOT NULL,
      item_key TEXT NOT NULL,
      portal_name TEXT,
      tally_item_name TEXT,
      create_new INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (company_name, item_key)
    );

    CREATE TABLE IF NOT EXISTS lot_trace (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      lot_num TEXT NOT NULL,
      stock_item_name TEXT NOT NULL DEFAULT '',
      portal_item_name TEXT NOT NULL DEFAULT '',
      packing_size TEXT NOT NULL DEFAULT '',
      original_owner TEXT NOT NULL DEFAULT '',
      supplier_name TEXT NOT NULL DEFAULT '',
      inward_voucher_number TEXT NOT NULL DEFAULT '',
      inward_date TEXT NOT NULL DEFAULT '',
      buyer_code TEXT NOT NULL DEFAULT '',
      raw_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(company_name, lot_num, stock_item_name)
    );

    CREATE INDEX IF NOT EXISTS idx_lot_trace_lookup
      ON lot_trace(company_name, lot_num, stock_item_name);

    CREATE TABLE IF NOT EXISTS sathi_response_archive (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      request_json TEXT NOT NULL DEFAULT '{}',
      response_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tally_operation_log (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT '',
      company_name TEXT NOT NULL DEFAULT '',
      voucher_number TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      raw_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS portal_push_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL DEFAULT '',
      tally_voucher_number TEXT NOT NULL DEFAULT '',
      sathi_voucher_number TEXT NOT NULL DEFAULT '',
      buyer_code TEXT NOT NULL DEFAULT '',
      original_owner TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      response_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sathi_order_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL DEFAULT '',
      licence_code TEXT NOT NULL DEFAULT '',
      voucher_number TEXT NOT NULL DEFAULT '',
      voucher_date TEXT NOT NULL DEFAULT '',
      seller_code TEXT NOT NULL DEFAULT '',
      seller_name TEXT NOT NULL DEFAULT '',
      buyer_code TEXT NOT NULL DEFAULT '',
      buyer_name TEXT NOT NULL DEFAULT '',
      total_bill_price TEXT NOT NULL DEFAULT '',
      queue_status TEXT NOT NULL DEFAULT '',
      source_action TEXT NOT NULL DEFAULT '',
      order_json TEXT NOT NULL DEFAULT '{}',
      lot_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(company_name, licence_code, voucher_number)
    );

    CREATE INDEX IF NOT EXISTS idx_sathi_order_queue_scope
      ON sathi_order_queue(company_name, licence_code, updated_at);
  `);
  ensureColumn(db, "lot_trace", "packing_size", "TEXT NOT NULL DEFAULT ''");
}

function ensureColumn(db, tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
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

function reportWhere(filters = {}, dateColumn, companyColumn) {
  const clauses = [];
  const params = [];

  if (filters.companyName) {
    clauses.push(`${companyColumn} = ?`);
    params.push(filters.companyName);
  }
  if (filters.fromDate) {
    clauses.push(`date(${dateColumn}) >= date(?)`);
    params.push(filters.fromDate);
  }
  if (filters.toDate) {
    clauses.push(`date(${dateColumn}) <= date(?)`);
    params.push(filters.toDate);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "",
    params
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
