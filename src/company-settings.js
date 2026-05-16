import fs from "node:fs";
import path from "node:path";

const DATA_DIR = process.env.SATHI_DATA_DIR || "data";
const STORE_FILE = path.join(DATA_DIR, "company-settings.json");

export function readCompanySettings() {
  const filePath = path.resolve(STORE_FILE);
  if (!fs.existsSync(filePath)) return {};

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

export function getCompanySettings(companyName) {
  if (!companyName) return {};
  return readCompanySettings()[companyName] || {};
}

export function saveCompanySettings(companyName, settings) {
  if (!companyName) return readCompanySettings();

  const store = readCompanySettings();
  store[companyName] = {
    ...(store[companyName] || {}),
    ...settings,
    updatedAt: new Date().toISOString()
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.resolve(STORE_FILE), JSON.stringify(store, null, 2));
  return store;
}

export function companySettingsToEnv(settings) {
  if (!settings) return {};

  const env = {};
  if (settings.saathiBaseUrl) env.SAATHI_BASE_URL = settings.saathiBaseUrl;
  if (settings.saathiApiKey) env.SAATHI_API_KEY = settings.saathiApiKey;
  if (settings.saathiClientId) env.SAATHI_CLIENT_ID = settings.saathiClientId;
  if (settings.saathiClientSecret) env.SAATHI_CLIENT_SECRET = settings.saathiClientSecret;
  if (settings.saathiClientSecretMode) env.SAATHI_CLIENT_SECRET_MODE = settings.saathiClientSecretMode;
  if (settings.saathiOwnerCode) env.SAATHI_DEFAULT_OWNER_CODE = settings.saathiOwnerCode;
  if (settings.saathiLocationCode) env.SAATHI_DEFAULT_LOCATION_CODE = settings.saathiLocationCode;
  if (settings.saathiStateCode) env.SAATHI_DEFAULT_STATE_CODE = settings.saathiStateCode;
  if (settings.saathiTimeoutMs) env.SAATHI_TIMEOUT_MS = settings.saathiTimeoutMs;
  if (settings.saathiRetryCount) env.SAATHI_RETRY_COUNT = settings.saathiRetryCount;
  if (settings.tallyVoucherTypeName) env.TALLY_VOUCHER_TYPE_NAME = settings.tallyVoucherTypeName;
  if (settings.tallySalesVoucherTypeName) env.TALLY_SALES_VOUCHER_TYPE_NAME = settings.tallySalesVoucherTypeName;
  if (settings.tallyPurchaseLedgerName) env.TALLY_PURCHASE_LEDGER_NAME = settings.tallyPurchaseLedgerName;
  if (settings.tallyPartyMode) env.TALLY_PARTY_MODE = settings.tallyPartyMode;
  if (settings.tallyStockItemMode) env.TALLY_STOCK_ITEM_MODE = settings.tallyStockItemMode;
  if (settings.tallyQuantityMode) env.TALLY_QUANTITY_MODE = settings.tallyQuantityMode;
  if (settings.tallyUnitName) env.TALLY_UNIT_NAME = settings.tallyUnitName;
  if (settings.tallyGodownName) env.TALLY_GODOWN_NAME = settings.tallyGodownName;
  if (settings.tallyGstRegistrationName) env.TALLY_GST_REGISTRATION_NAME = settings.tallyGstRegistrationName;
  if (settings.tallyCompanyRegistrationType) env.TALLY_COMPANY_REGISTRATION_TYPE = settings.tallyCompanyRegistrationType;
  if (settings.tallyPartyRegistrationType) env.TALLY_PARTY_REGISTRATION_TYPE = settings.tallyPartyRegistrationType;
  if (settings.tallyCgstLedgerName) env.TALLY_CGST_LEDGER_NAME = settings.tallyCgstLedgerName;
  if (settings.tallySgstLedgerName) env.TALLY_SGST_LEDGER_NAME = settings.tallySgstLedgerName;
  if (settings.tallyIgstLedgerName) env.TALLY_IGST_LEDGER_NAME = settings.tallyIgstLedgerName;
  return env;
}

export function pickCompanySettings(body) {
  const settings = {
    saathiBaseUrl: body.saathiBaseUrl,
    saathiClientId: body.saathiClientId,
    saathiClientSecretMode: body.saathiClientSecretMode,
    saathiOwnerCode: body.saathiOwnerCode,
    saathiLocationCode: body.saathiLocationCode,
    saathiStateCode: body.saathiStateCode,
    saathiTimeoutMs: body.saathiTimeoutMs,
    saathiRetryCount: body.saathiRetryCount,
    tallyVoucherTypeName: body.tallyVoucherTypeName,
    tallySalesVoucherTypeName: body.tallySalesVoucherTypeName,
    tallyPurchaseLedgerName: body.tallyPurchaseLedgerName,
    tallyPartyMode: body.tallyPartyMode,
    tallyStockItemMode: body.tallyStockItemMode,
    tallyQuantityMode: body.tallyQuantityMode,
    tallyUnitName: body.tallyUnitName,
    tallyGodownName: body.tallyGodownName,
    tallyGstRegistrationName: body.tallyGstRegistrationName,
    tallyCompanyRegistrationType: body.tallyCompanyRegistrationType,
    tallyPartyRegistrationType: body.tallyPartyRegistrationType,
    tallyCgstLedgerName: body.tallyCgstLedgerName,
    tallySgstLedgerName: body.tallySgstLedgerName,
    tallyIgstLedgerName: body.tallyIgstLedgerName
  };

  if (body.saathiApiKey) settings.saathiApiKey = body.saathiApiKey;
  if (body.saathiClientSecret) settings.saathiClientSecret = body.saathiClientSecret;
  return removeEmpty(settings);
}

function removeEmpty(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
  );
}
