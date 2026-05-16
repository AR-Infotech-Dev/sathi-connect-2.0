import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SATHI_DATA_DIR || "data";
const ARCHIVE_FILE = path.join(DATA_DIR, "sathi-response-archive.json");
const MAX_ARCHIVE_ITEMS = 300;

export function readArchive() {
  const filePath = path.resolve(ARCHIVE_FILE);
  if (!fs.existsSync(filePath)) return [];

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return [];
  }
}

export function saveSathiResponse(action, request, response) {
  const archive = readArchive();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action,
    voucherNumber: extractVoucherNumber(request, response),
    status: response?.status || response?.statusCode || "",
    message: response?.message || "",
    savedAt: new Date().toISOString(),
    request,
    response
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify([entry, ...archive].slice(0, MAX_ARCHIVE_ITEMS), null, 2));

  if (entry.voucherNumber) {
    const safeVoucher = entry.voucherNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
    fs.writeFileSync(
      path.join(DATA_DIR, `${action}-${safeVoucher}.json`),
      JSON.stringify(entry, null, 2)
    );
  }

  return entry;
}

export function clearArchive() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ARCHIVE_FILE, "[]\n");
}

function extractVoucherNumber(request, response) {
  if (request?.body?.voucherNumber) return String(request.body.voucherNumber);
  if (request?.voucherNumber) return String(request.voucherNumber);
  if (response?.data?.voucherNumber) return String(response.data.voucherNumber);
  if (Array.isArray(response?.data)) {
    const found = response.data.find((item) => item?.voucherNumber || item?.billNumber);
    if (found?.voucherNumber) return String(found.voucherNumber);
    if (found?.billNumber) return String(found.billNumber);
  }
  return "";
}
