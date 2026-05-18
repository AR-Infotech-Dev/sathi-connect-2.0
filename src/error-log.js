import fs from "node:fs";
import path from "node:path";
import { getDb } from "./app-db.js";

const LOG_DIR = process.env.SATHI_LOG_DIR || "logs";
const LOG_FILE = path.join(LOG_DIR, "errors.json");
const MAX_ERRORS = 100;
const KEEP_TECH_ARTIFACTS = process.env.SATHI_KEEP_TECH_ARTIFACTS === "1";
const TECH_KEYS = new Set(["payload", "request", "headers", "body", "signature", "keyHash", "apiKey", "clientSecret", "clientsecret", "xmlPreview", "response"]);

export function readErrors() {
  const dbErrors = readDbErrors();
  if (dbErrors.length) return dbErrors;

  const absolutePath = path.resolve(LOG_FILE);
  if (!fs.existsSync(absolutePath)) return [];

  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch {
    return [];
  }
}

export function recordError(source, error, context = {}) {
  const entry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    source,
    message: error?.message || String(error),
    context: KEEP_TECH_ARTIFACTS ? context : sanitizeContext(context),
    at: new Date().toISOString()
  };

  try {
    const db = errorDb();
    db.prepare(`
      INSERT INTO error_log (id, source, message, context_json, at)
      VALUES (?, ?, ?, ?, ?)
    `).run(entry.id, entry.source, entry.message, JSON.stringify(entry.context || {}), entry.at);
    db.exec(`DELETE FROM error_log WHERE id NOT IN (SELECT id FROM error_log ORDER BY at DESC LIMIT ${MAX_ERRORS})`);
  } catch {
    const errors = readErrors();
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(LOG_FILE, JSON.stringify([entry, ...errors].slice(0, MAX_ERRORS), null, 2));
  }
  return entry;
}

function sanitizeContext(value) {
  if (Array.isArray(value)) return value.map(sanitizeContext);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !TECH_KEYS.has(key))
    .map(([key, nested]) => [key, sanitizeContext(nested)]));
}

export function clearErrors() {
  try {
    errorDb().exec("DELETE FROM error_log");
  } catch {
    // Keep the JSON fallback below available if the database cannot be opened.
  }
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.writeFileSync(LOG_FILE, "[]\n");
}

function readDbErrors() {
  try {
    const rows = errorDb().prepare(`
      SELECT id, source, message, context_json, at
      FROM error_log
      ORDER BY at DESC
      LIMIT ?
    `).all(MAX_ERRORS);
    return rows.map((row) => ({
      id: row.id,
      source: row.source,
      message: row.message,
      context: parseContext(row.context_json),
      at: row.at
    }));
  } catch {
    return [];
  }
}

function errorDb() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS error_log (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      context_json TEXT NOT NULL DEFAULT '{}',
      at TEXT NOT NULL
    )
  `);
  return db;
}

function parseContext(value) {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}
