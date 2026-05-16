import fs from "node:fs";
import path from "node:path";
import { companySettingsToEnv, getCompanySettings } from "./company-settings.js";

const DEFAULT_ENV_FILE = process.env.SATHI_ENV_FILE || ".env";
const DEFAULT_SAATHI_BASE_URL = "https://seedtrace.nic.in/inv-apis2";

export function loadEnvFile(filePath = DEFAULT_ENV_FILE) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) return {};

  const env = {};
  const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    env[key] = stripQuotes(value);
  }

  return env;
}

export function loadConfig() {
  const fileEnv = loadEnvFile();
  const processMerged = { ...fileEnv, ...process.env };
  const companySettings = companySettingsToEnv(getCompanySettings(processMerged.TALLY_COMPANY_NAME || ""));
  const merged = { ...processMerged, ...companySettings };

  const resourcesFile = merged.SAATHI_RESOURCES_FILE || "config/resources.example.json";

  return {
    baseUrl: merged.SAATHI_BASE_URL || DEFAULT_SAATHI_BASE_URL,
    apiKey: merged.SAATHI_API_KEY || "",
    clientId: merged.SAATHI_CLIENT_ID || "",
    clientSecret: merged.SAATHI_CLIENT_SECRET || "",
    clientSecretMode: merged.SAATHI_CLIENT_SECRET_MODE || "plain",
    defaults: {
      ownerCode: merged.SAATHI_DEFAULT_OWNER_CODE || "",
      locationCode: merged.SAATHI_DEFAULT_LOCATION_CODE || "",
      stateCode: merged.SAATHI_DEFAULT_STATE_CODE || "27"
    },
    login: {
      path: merged.SAATHI_LOGIN_PATH || "/api/login",
      method: merged.SAATHI_LOGIN_METHOD || "POST",
      username: merged.SAATHI_USERNAME || "",
      password: merged.SAATHI_PASSWORD || "",
      usernameField: merged.SAATHI_USERNAME_FIELD || "username",
      passwordField: merged.SAATHI_PASSWORD_FIELD || "password",
      extraFields: parseJson(merged.SAATHI_EXTRA_LOGIN_FIELDS, {})
    },
    auth: {
      mode: merged.SAATHI_AUTH_MODE || "auto",
      tokenJsonPaths: splitCsv(merged.SAATHI_TOKEN_JSON_PATHS || "token,access_token,data.token,data.access_token"),
      tokenHeader: merged.SAATHI_TOKEN_HEADER || "Authorization",
      tokenPrefix: merged.SAATHI_TOKEN_PREFIX || "Bearer",
      apiKey: merged.SAATHI_API_KEY || "",
      apiKeyHeader: merged.SAATHI_API_KEY_HEADER || "X-API-Key"
    },
    runtime: {
      timeoutMs: numberOrDefault(merged.SAATHI_TIMEOUT_MS, 30000),
      retryCount: numberOrDefault(merged.SAATHI_RETRY_COUNT, 2)
    },
    resources: loadResources(resourcesFile)
  };
}

function loadResources(filePath) {
  const absolutePath = path.resolve(filePath);
  if (!fs.existsSync(absolutePath)) return {};
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function required(value, name) {
  if (!value) {
    throw new Error(`${name} is required. Copy .env.example to .env and fill portal details.`);
  }

  return value;
}

function splitCsv(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Invalid JSON in env value: ${value}`);
  }
}

function numberOrDefault(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
