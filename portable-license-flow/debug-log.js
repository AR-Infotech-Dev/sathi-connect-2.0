import fs from "node:fs";
import path from "node:path";

export function createDebugLogger(options = {}) {
  const logFile = path.resolve(options.logFile || "logs/server.log");

  function debugLog(event, details = {}) {
    try {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      fs.appendFileSync(logFile, `${JSON.stringify({
        at: new Date().toISOString(),
        event,
        ...normalize(details)
      })}\n`, "utf8");
    } catch {
      // Logging must never break the app.
    }
  }

  function debugError(event, error, details = {}) {
    debugLog(event, {
      ...details,
      error: {
        name: error?.name || "Error",
        message: error?.message || String(error || ""),
        code: error?.code || error?.status || "",
        stack: error?.stack || ""
      }
    });
  }

  return { debugLog, debugError };
}

function normalize(details) {
  if (!details || typeof details !== "object") return { message: String(details || "") };
  return JSON.parse(JSON.stringify(details, (_, value) => (
    typeof value === "bigint" ? value.toString() : value
  )));
}
