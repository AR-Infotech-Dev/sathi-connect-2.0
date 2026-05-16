import fs from "node:fs";
import path from "node:path";

const LOG_DIR = process.env.SATHI_LOG_DIR || "logs";
const LOG_FILE = path.join(LOG_DIR, "errors.json");
const MAX_ERRORS = 100;

export function readErrors() {
  const absolutePath = path.resolve(LOG_FILE);
  if (!fs.existsSync(absolutePath)) return [];

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch {
    return [];
  }
}

export function recordError(source, error, context = {}) {
  const errors = readErrors();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source,
    message: error?.message || String(error),
    context,
    at: new Date().toISOString()
  };

  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify([entry, ...errors].slice(0, MAX_ERRORS), null, 2));
  return entry;
}

export function clearErrors() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "[]\n");
}
