import fs from "node:fs";
import path from "node:path";

const LOG_DIR = process.env.SATHI_LOG_DIR || "logs";
const LOG_FILE = path.join(LOG_DIR, "errors.json");
const MAX_ERRORS = 100;
const TECH_KEYS = new Set(["payload", "request", "headers", "body", "signature", "keyHash", "apiKey", "clientSecret", "clientsecret", "xmlPreview", "response", "xml", "rawPreview", "tallyResponse"]);

export function readErrors() {
  const absolutePath = path.resolve(LOG_FILE);
  if (!fs.existsSync(absolutePath)) return [];

  try {
    const rawErrors = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
    const errors = Array.isArray(rawErrors)
      ? rawErrors.map((entry) => ({
        ...entry,
        context: sanitizeContext(entry.context || {})
      }))
      : [];
    if (JSON.stringify(rawErrors) !== JSON.stringify(errors)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
      fs.writeFileSync(LOG_FILE, JSON.stringify(errors.slice(0, MAX_ERRORS), null, 2));
    }
    return errors;
  } catch {
    return [];
  }
}

export function recordError(source, error, context = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source,
    message: error?.message || String(error),
    context: sanitizeContext(context),
    at: new Date().toISOString()
  };

  try {
    const errors = readErrors();
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, JSON.stringify([entry, ...errors].slice(0, MAX_ERRORS), null, 2));
  } catch {
    // Error logging should never interrupt the original request path.
  }
  return entry;
}

function sanitizeContext(value) {
  if (Array.isArray(value)) return value.map(sanitizeContext);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isTechnicalKey(key))
    .map(([key, nested]) => [key, sanitizeContext(nested)]));
}

function isTechnicalKey(key) {
  const normalized = String(key || "").trim();
  const lower = normalized.toLowerCase();
  return TECH_KEYS.has(normalized)
    || lower.includes("xml")
    || lower.includes("rawpreview")
    || lower.includes("responsepreview")
    || lower.includes("tallyresponse")
    || lower.includes("requestpreview");
}

export function clearErrors() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "[]\n");
}
