import fs from "node:fs";
import path from "node:path";

const LOG_DIR = process.env.SATHI_LOG_DIR || "logs";
const LOG_FILE = path.join(LOG_DIR, "tally-operations.json");
const MAX_LOGS = 250;
const TECH_KEYS = new Set([
  "xmlPreview",
  "xml",
  "rawPreview",
  "requestXml",
  "tallyXml",
  "tallyResponse",
  "response",
  "request",
  "requestHeaders",
  "requestBody",
  "stockItems",
  "headers",
  "body",
  "signature",
  "keyHash",
  "apiKey",
  "clientSecret",
  "clientsecret"
]);

export function readTallyLogs() {
  const absolutePath = path.resolve(LOG_FILE);
  if (!fs.existsSync(absolutePath)) return [];

  try {
    const rawLogs = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    const logs = Array.isArray(rawLogs) ? rawLogs.map(sanitizeLogDetails) : [];
    if (JSON.stringify(rawLogs) !== JSON.stringify(logs)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.writeFileSync(LOG_FILE, JSON.stringify(logs.slice(0, MAX_LOGS), null, 2));
    }
    return logs;
  } catch {
    return [];
  }
}

export function recordTallyLog(action, status, details = {}) {
  const logs = readTallyLogs();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    action,
    status,
    at: new Date().toISOString(),
    ...sanitizeLogDetails(details)
  };

  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify([entry, ...logs].slice(0, MAX_LOGS), null, 2));
  return entry;
}

function sanitizeLogDetails(value) {
  if (Array.isArray(value)) return value.map(sanitizeLogDetails);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isTechnicalArtifactKey(key))
    .map(([key, nested]) => [key, sanitizeLogDetails(nested)]));
}

function isTechnicalArtifactKey(key) {
  const normalized = String(key || "").trim();
  const lower = normalized.toLowerCase();
  return TECH_KEYS.has(normalized)
    || lower.includes("xml")
    || lower.includes("rawpreview")
    || lower.includes("responsepreview")
    || lower.includes("tallyresponse")
    || lower.includes("requestpreview");
}

export function clearTallyLogs() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "[]\n");
}
