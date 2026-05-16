import fs from "node:fs";
import path from "node:path";

const LOG_DIR = process.env.SATHI_LOG_DIR || "logs";
const LOG_FILE = path.join(LOG_DIR, "tally-operations.json");
const MAX_LOGS = 250;

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
    ...details
  };

  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, JSON.stringify([entry, ...logs].slice(0, MAX_LOGS), null, 2));
  return entry;
}

export function clearTallyLogs() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "[]\n");
}
