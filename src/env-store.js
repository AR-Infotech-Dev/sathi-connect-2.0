import fs from "node:fs";
import path from "node:path";

const ENV_FILE = process.env.SATHI_ENV_FILE || ".env";
const DEFAULT_SAATHI_BASE_URL = "https://seedtrace.nic.in/inv-apis2";

export function readEnv(filePath = ENV_FILE) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) return {};

  const values = {};
  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    values[key] = stripQuotes(value);
  }

  return values;
}

export function writeEnv(updates, filePath = ENV_FILE) {
  const current = readEnv(filePath);
  const next = { ...current, ...updates };
  const lines = Object.entries(next)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${String(value)}`);

  fs.writeFileSync(path.resolve(filePath), `${lines.join("\n")}\n`);
  return next;
}

export function publicConfig(env = readEnv()) {
  return {
    ui: {
      theme: env.UI_THEME || "green"
    },
    saathi: {
      baseUrl: env.SAATHI_BASE_URL || DEFAULT_SAATHI_BASE_URL,
      clientId: env.SAATHI_CLIENT_ID || "",
      clientSecretMode: env.SAATHI_CLIENT_SECRET_MODE || "plain",
      ownerCode: env.SAATHI_DEFAULT_OWNER_CODE || "",
      locationCode: env.SAATHI_DEFAULT_LOCATION_CODE || "",
      stateCode: env.SAATHI_DEFAULT_STATE_CODE || "27",
      timeoutMs: env.SAATHI_TIMEOUT_MS || "30000",
      retryCount: env.SAATHI_RETRY_COUNT || "2",
      apiKeyConfigured: Boolean(env.SAATHI_API_KEY),
      clientSecretConfigured: Boolean(env.SAATHI_CLIENT_SECRET)
    },
    tally: {
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      companyName: env.TALLY_COMPANY_NAME || "",
      timeoutMs: env.TALLY_TIMEOUT_MS || "15000",
      voucherTypeName: env.TALLY_VOUCHER_TYPE_NAME || "Purchase",
      salesVoucherTypeName: env.TALLY_SALES_VOUCHER_TYPE_NAME || "Sales",
      purchaseLedgerName: env.TALLY_PURCHASE_LEDGER_NAME || "Purchase",
      partyMode: env.TALLY_PARTY_MODE || "sellerName",
      stockItemMode: env.TALLY_STOCK_ITEM_MODE || "varietyName",
      quantityMode: env.TALLY_QUANTITY_MODE || "totalBags",
      unitName: env.TALLY_UNIT_NAME || "Bag",
      godownName: env.TALLY_GODOWN_NAME || "Main Location",
      gstRegistrationName: env.TALLY_GST_REGISTRATION_NAME || "",
      companyRegistrationType: env.TALLY_COMPANY_REGISTRATION_TYPE || "Regular",
      partyRegistrationType: env.TALLY_PARTY_REGISTRATION_TYPE || "Regular",
      cgstLedgerName: env.TALLY_CGST_LEDGER_NAME || "CGST",
      sgstLedgerName: env.TALLY_SGST_LEDGER_NAME || "SGST",
      igstLedgerName: env.TALLY_IGST_LEDGER_NAME || "IGST"
    }
  };
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
