import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SATHI_DATA_DIR || "data";
const STATE_FILE = process.env.SATHI_DEMO_STATE_FILE || path.join(DATA_DIR, "demo-mode.json");
const DEFAULT_PASSWORD = "AR-Sathi@Demo#2026";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();

export function demoModeStatus() {
  const state = readState();
  const savedBills = arrayOf(state.demoBills);
  return {
    enabled: Boolean(state.enabled),
    updatedAt: state.updatedAt || "",
    seededAt: state.seededAt || "",
    sampleCount: isLegacyDemoBillSet(savedBills) ? defaultDemoBills().length : savedBills.length || defaultDemoBills().length
  };
}

export function authenticateDemoMode(password) {
  if (!safeEqual(hashPassword(password), configuredPasswordHash())) return "";
  const token = crypto.randomBytes(24).toString("hex");
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

export function requireDemoSession(token) {
  const key = String(token || "");
  const expiresAt = sessions.get(key);
  if (!expiresAt || expiresAt < Date.now()) {
    sessions.delete(key);
    const error = new Error("Demo Mode password is required again.");
    error.status = "demo_auth_required";
    throw error;
  }
}

export function setDemoModeEnabled(enabled) {
  writeState({ ...readState(), enabled: Boolean(enabled), updatedAt: new Date().toISOString() });
  return demoModeStatus();
}

export function resetDemoMode() {
  const next = {
    ...readState(),
    pulledVouchers: [],
    createdOrders: [],
    sequence: 1,
    demoBills: [],
    seededAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  writeState(next);
  return next;
}

export function isDemoModeEnabled() {
  return Boolean(readState().enabled);
}

export function setDemoSeedBills(bills = []) {
  const usable = Array.isArray(bills) ? bills.filter((bill) => bill?.billNumber && bill?.lotData?.length) : [];
  writeState({ ...readState(), demoBills: usable, seededAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  return usable;
}

export function demoSaathiResponse(action, payload = {}, scope = {}) {
  const state = readState();
  const clientId = clean(scope?.clientId || scope?.fields?.clientId || payload.ownerCode || payload.locationCode || "DEMO-LICENCE");
  const bills = demoBills(clientId);

  if (action === "pendingOrders") {
    const pulled = new Set(arrayOf(state.pulledVouchers).map(clean));
    return success("Order details fetched successfully", bills.filter((bill) => !pulled.has(clean(bill.billNumber))).map(orderFromBill));
  }

  if (action === "pullLot" || action === "fetchLot") {
    const voucherNumber = clean(payload.voucherNumber);
    const bill = bills.find((entry) => clean(entry.billNumber) === voucherNumber);
    if (!bill) return failure("Order details were not found.", 409);
    if (action === "pullLot") {
      const pulledVouchers = new Set(arrayOf(state.pulledVouchers).map(clean));
      pulledVouchers.add(voucherNumber);
      writeState({ ...state, pulledVouchers: [...pulledVouchers], updatedAt: new Date().toISOString() });
    }
    return success("Lot details fetched and updated successfully", [bill]);
  }

  if (action === "createOrder") {
    const sequence = Number(state.sequence || 1);
    const voucherNumber = `DEMO-${clientId.replace(/[^A-Z0-9]/gi, "").slice(-10)}-${String(sequence).padStart(4, "0")}`;
    const createdOrders = [...arrayOf(state.createdOrders)];
    createdOrders.push({
      voucherNumber,
      sourceVoucherNumber: payload.sourceVoucherNumber || "",
      buyerCode: payload.buyerCode || "",
      createdAt: new Date().toISOString()
    });
    writeState({ ...state, sequence: sequence + 1, createdOrders, updatedAt: new Date().toISOString() });
    return success("Demo order created successfully", { voucherNumber, voucherDate: formatDate(new Date()) });
  }

  return failure(`Unsupported demo action: ${action}`, 400);
}

export function demoSeedResponse(scope = {}) {
  const clientId = clean(scope?.clientId || scope?.fields?.clientId || "DEMO-LICENCE");
  return success("Demo orders prepared", demoBills(clientId).map(orderFromBill));
}

function demoBills(clientId = "DEMO-LICENCE") {
  const saved = arrayOf(readState().demoBills);
  if (saved.length && !isLegacyDemoBillSet(saved)) {
    return ensureDemoBillCount(saved, clientId);
  }
  return defaultDemoBills(clientId);
}

function isLegacyDemoBillSet(bills = []) {
  const legacy = new Set(["DEMO-INWARD-1001", "DEMO-INWARD-1002", "DEMO-INWARD-1003"]);
  return bills.length > 0 && bills.length <= 3 && bills.every((bill) => legacy.has(String(bill?.billNumber || "")));
}

function ensureDemoBillCount(bills = [], clientId = "DEMO-LICENCE") {
  const cleaned = arrayOf(bills)
    .filter(Boolean)
    .map((bill) => ({ ...bill, buyerCode: clientId }));
  if (cleaned.length >= 10) return cleaned.slice(0, 10);
  const seen = new Set(cleaned.map((bill) => String(bill?.billNumber || "").trim().toUpperCase()).filter(Boolean));
  const filler = defaultDemoBills(clientId).filter((bill) => {
    const key = String(bill?.billNumber || "").trim().toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...cleaned, ...filler].slice(0, 10);
}

export function defaultDemoBills(clientId = "DEMO-LICENCE") {
  const buyerName = "Demo Seeds & Agro Centre";
  return [
    demoBill({ billNumber: "DEMO-INWARD-1001", billDate: daysAgo(4), sellerCode: "LCCD-DEMO-SELLER-01", sellerName: "GREEN GOLD SEEDS PVT LTD", buyerCode: clientId, buyerName, totalBillPrice: "2500", lotNum: "TL-LOT-DEMO-17", cropName: "MAIZE (HYBRID)", cropCode: "A0201", varietyCode: "PDKV-AARAMBHA", varietyName: "PDKV AARAMBHA", unitPrice: "500", packingSize: "4", totalBags: 5, totalQty: 0.2, certificationClass: "CERTIFIED I", expiryDate: daysAfter(300) }),
    demoBill({ billNumber: "DEMO-INWARD-1002", billDate: daysAgo(3), sellerCode: "271081", sellerName: "MSSC AKOLA", buyerCode: clientId, buyerName, totalBillPrice: "4200", lotNum: "JUN26-DEMO-009-7", cropName: "GREEN GRAM (MOONG BEAN)", cropCode: "A0304", varietyCode: "IPM-410-3", varietyName: "IPM 410-3 (Shikha)", unitPrice: "420", packingSize: "2", totalBags: 10, totalQty: 0.2, certificationClass: "CERTIFIED I", expiryDate: daysAfter(220) }),
    demoBill({ billNumber: "DEMO-INWARD-1003", billDate: daysAgo(2), sellerCode: "LCSD-DEMO-SELLER-03", sellerName: "DEEPAK KRUSHI SEVA KENDRA", buyerCode: clientId, buyerName, totalBillPrice: "1000", lotNum: "JUN26-DEMO-058-241", cropName: "WHEAT (GEHON)", cropCode: "A0101", varietyCode: "LOK-1", varietyName: "LOK-1", unitPrice: "200", packingSize: "40", totalBags: 5, totalQty: 2, certificationClass: "CERTIFIED I", expiryDate: daysAfter(180) }),
    demoBill({ billNumber: "DEMO-INWARD-1004", billDate: daysAgo(7), sellerCode: "LCSD-DEMO-SELLER-04", sellerName: "OM FERTILIZERS UJANI", buyerCode: clientId, buyerName, totalBillPrice: "8800", lotNum: "MAR26-DEMO-065-542", cropName: "BENGAL GRAM (CHANA)", cropCode: "A0302", varietyCode: "VIJAY", varietyName: "VIJAY", unitPrice: "1760", packingSize: "20", totalBags: 5, totalQty: 1, certificationClass: "CERTIFIED I", expiryDate: daysAfter(260) }),
    demoBill({ billNumber: "DEMO-INWARD-1005", billDate: daysAgo(6), sellerCode: "LCSD-DEMO-SELLER-05", sellerName: "MAHARASHTRA SEEDS CORPORATION", buyerCode: clientId, buyerName, totalBillPrice: "6900", lotNum: "KH26-DEMO-SOY-118", cropName: "SOYBEAN", cropCode: "A0601", varietyCode: "MAUS-71", varietyName: "MAUS-71", unitPrice: "1380", packingSize: "30", totalBags: 5, totalQty: 1.5, certificationClass: "CERTIFIED I", expiryDate: daysAfter(240) }),
    demoBill({ billNumber: "DEMO-INWARD-1006", billDate: daysAgo(5), sellerCode: "LCSD-DEMO-SELLER-06", sellerName: "KRUSHIDHAN SEEDS PVT LTD", buyerCode: clientId, buyerName, totalBillPrice: "3600", lotNum: "KH26-DEMO-PDY-044", cropName: "PADDY", cropCode: "A0401", varietyCode: "INDRAYANI", varietyName: "INDRAYANI", unitPrice: "900", packingSize: "10", totalBags: 4, totalQty: 0.4, certificationClass: "CERTIFIED I", expiryDate: daysAfter(280) }),
    demoBill({ billNumber: "DEMO-INWARD-1007", billDate: daysAgo(4), sellerCode: "LCSD-DEMO-SELLER-07", sellerName: "SUNRISE AGRO SEEDS", buyerCode: clientId, buyerName, totalBillPrice: "4800", lotNum: "KH26-DEMO-SUN-031", cropName: "SUNFLOWER", cropCode: "A0701", varietyCode: "KBSH-44", varietyName: "KBSH-44", unitPrice: "600", packingSize: "2", totalBags: 8, totalQty: 0.16, certificationClass: "CERTIFIED I", expiryDate: daysAfter(210) }),
    demoBill({ billNumber: "DEMO-INWARD-1008", billDate: daysAgo(3), sellerCode: "LCSD-DEMO-SELLER-08", sellerName: "COTTON KING SEEDS", buyerCode: clientId, buyerName, totalBillPrice: "7500", lotNum: "CTN26-DEMO-777", cropName: "COTTON", cropCode: "A0801", varietyCode: "BT-777", varietyName: "BT COTTON 777", unitPrice: "750", packingSize: "0.45", totalBags: 10, totalQty: 0.045, certificationClass: "TLSEED", expiryDate: daysAfter(190) }),
    demoBill({ billNumber: "DEMO-INWARD-1009", billDate: daysAgo(2), sellerCode: "LCSD-DEMO-SELLER-09", sellerName: "VEGTECH SEEDS INDIA", buyerCode: clientId, buyerName, totalBillPrice: "27500", lotNum: "TL26-DEMO-TOM-045", cropName: "TOMATO", cropCode: "H0705", varietyCode: "AROV-5008", varietyName: "AROV-5008", unitPrice: "550", packingSize: "0.01", totalBags: 50, totalQty: 0.005, certificationClass: "TLSEED", expiryDate: daysAfter(320) }),
    demoBill({ billNumber: "DEMO-INWARD-1010", billDate: daysAgo(1), sellerCode: "LCSD-DEMO-SELLER-10", sellerName: "NATIONAL HORTICULTURE SEEDS", buyerCode: clientId, buyerName, totalBillPrice: "9600", lotNum: "TL26-DEMO-ONI-082", cropName: "ONION", cropCode: "H0102", varietyCode: "N-53", varietyName: "N-53", unitPrice: "1200", packingSize: "0.5", totalBags: 8, totalQty: 0.04, certificationClass: "TLSEED", expiryDate: daysAfter(270) })
  ];
}

function demoBill(values) {
  return {
    totalBillPrice: values.totalBillPrice, discountType: null, discount: 0,
    billNumber: values.billNumber, billDate: values.billDate,
    sellerCode: values.sellerCode, buyerCode: values.buyerCode,
    sellerName: values.sellerName, buyerName: values.buyerName,
    stateName: "Maharashtra", stateCode: "27", districtName: "AKOLA", districtCode: "501",
    blockName: "AKOLA", pin: "444001", villageName: "Akola", plotNo: "",
    sellerUserType: "DEALER", demoRecord: true,
    lotData: [{
      lotNum: values.lotNum, cropName: values.cropName, cropCode: values.cropCode,
      varietyCode: values.varietyCode, varietyName: values.varietyName, unitPrice: values.unitPrice,
      packingSize: values.packingSize, packingUnit: "kg", totalBags: values.totalBags,
      totalQty: values.totalQty, certificationClass: values.certificationClass,
      season: "KHARIF (2026)", year: "2026-27", expiryDate: values.expiryDate,
      tax: { cropRegCode: null, hsnCode: 1209, cgst: 0, sgst: 0, igst: 0 }
    }]
  };
}

function orderFromBill(bill) {
  return {
    voucherNumber: bill.billNumber, voucherDate: bill.billDate,
    sellerCode: bill.sellerCode, sellerName: bill.sellerName,
    buyerCode: bill.buyerCode, buyerName: bill.buyerName,
    totalBillPrice: bill.totalBillPrice, status: "Pending", demoRecord: true
  };
}

function success(message, data) { return { statusCode: 200, status: "Success", message, data }; }
function failure(message, statusCode) { return { statusCode, status: "Error", message, data: [] }; }

function readState() {
  const filePath = path.resolve(STATE_FILE);
  if (!fs.existsSync(filePath)) return defaultState();
  try { return { ...defaultState(), ...JSON.parse(fs.readFileSync(filePath, "utf8")) }; }
  catch { return defaultState(); }
}

function writeState(state) {
  const filePath = path.resolve(STATE_FILE);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function defaultState() { return { enabled: false, pulledVouchers: [], createdOrders: [], demoBills: [], sequence: 1, updatedAt: "", seededAt: "" }; }
function configuredPasswordHash() { return String(process.env.SATHI_DEMO_PASSWORD_HASH || "").trim().toLowerCase() || hashPassword(process.env.SATHI_DEMO_PASSWORD || DEFAULT_PASSWORD); }
function hashPassword(value) { return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex"); }
function safeEqual(left, right) { const a = Buffer.from(String(left || "")); const b = Buffer.from(String(right || "")); return a.length === b.length && crypto.timingSafeEqual(a, b); }
function clean(value) { return String(value || "").trim().toUpperCase(); }
function arrayOf(value) { return Array.isArray(value) ? value : []; }
function daysAgo(days) { const date = new Date(); date.setDate(date.getDate() - days); return formatDate(date); }
function daysAfter(days) { const date = new Date(); date.setDate(date.getDate() + days); return formatDate(date); }
function formatDate(date) { return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date).replaceAll("/", "-"); }
