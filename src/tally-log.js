import fs from "node:fs";
import path from "node:path";

const LOG_DIR = process.env.SATHI_LOG_DIR || "logs";
const LOG_FILE = path.join(LOG_DIR, "tally-operations.json");
const MAX_LOGS = 250;
const KEEP_TECH_ARTIFACTS = process.env.SATHI_KEEP_TECH_ARTIFACTS === "1";
const TECH_KEYS = new Set([
  "xmlPreview",
  "rawPreview",
  "response",
  "request",
  "requestHeaders",
  "requestBody",
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
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
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
    ...(KEEP_TECH_ARTIFACTS ? details : sanitizeLogDetails(details))
  };

  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify([entry, ...logs].slice(0, MAX_LOGS), null, 2));
  return entry;
}

function sanitizeLogDetails(value) {
  if (Array.isArray(value)) return value.map(sanitizeLogDetails);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !TECH_KEYS.has(key))
    .map(([key, nested]) => [key, sanitizeLogDetails(nested)]));
}

export function clearTallyLogs() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "[]\n");
}
