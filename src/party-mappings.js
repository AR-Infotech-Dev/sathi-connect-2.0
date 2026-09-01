import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SATHI_DATA_DIR || "data";
const STORE_FILE = path.join(DATA_DIR, "party-mappings.json");

export function readPartyMappings() {
  const filePath = path.resolve(STORE_FILE);
  if (!fs.existsSync(filePath)) return {};

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

export function getPartyMappings(companyName) {
  if (!companyName) return {};
  return readPartyMappings()[companyName] || {};
}

export function savePartyMappings(companyName, mappings) {
  if (!companyName) return readPartyMappings();
  const store = readPartyMappings();
  const current = store[companyName] || {};
  store[companyName] = {
    ...current,
    ...Object.fromEntries(Object.entries(mappings || {}).map(([key, value]) => [
      key,
      {
        ...(current[key] || {}),
        ...(typeof value === "string" ? { tallyLedgerName: value } : value),
        updatedAt: new Date().toISOString()
      }
    ]))
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.resolve(STORE_FILE), JSON.stringify(store, null, 2));
  return store[companyName];
}
