import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SATHI_DATA_DIR || "data";
const STORE_FILE = path.join(DATA_DIR, "item-mappings.json");

export function readItemMappings() {
  const filePath = path.resolve(STORE_FILE);
  if (!fs.existsSync(filePath)) return {};

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

export function getItemMappings(companyName) {
  if (!companyName) return {};
  return readItemMappings()[companyName] || {};
}

export function saveItemMappings(companyName, mappings) {
  if (!companyName) return readItemMappings();
  const store = readItemMappings();
  const current = store[companyName] || {};
  store[companyName] = {
    ...current,
    ...Object.fromEntries(Object.entries(mappings || {}).map(([key, value]) => [
      key,
      {
        ...(current[key] || {}),
        ...(typeof value === "string" ? { tallyItemName: value } : value),
        updatedAt: new Date().toISOString()
      }
    ]))
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.resolve(STORE_FILE), JSON.stringify(store, null, 2));
  return store[companyName];
}
