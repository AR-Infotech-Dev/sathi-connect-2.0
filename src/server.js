import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { companySettingsToEnv, getCompanySettings, pickCompanySettings, saveCompanySettings } from "./company-settings.js";
import { readEnv, publicConfig, writeEnv } from "./env-store.js";
import { readErrors, recordError, clearErrors } from "./error-log.js";
import { getItemMappings, saveItemMappings } from "./item-mappings.js";
import { clearArchive, readArchive, saveSathiResponse } from "./response-archive.js";
import { SaathiBillingClient, BILLING_PATHS } from "./saathi-billing-client.js";
import { createKeyHash, createSignature, createSignedPayload, resolveClientSecret } from "./saathi-signing.js";
import { SATHI_COMPANY_UDF_NAMES, TallyClient } from "./tally-client.js";
import { clearTallyLogs, readTallyLogs, recordTallyLog } from "./tally-log.js";
import {
  findLotTracesForSale,
  listLotTraceReport,
  listPortalPushReport,
  listSathiOrderQueue,
  recordPortalPush,
  upsertLotTraces,
  upsertSathiOrderQueue
} from "./app-db.js";

// License 
import { createDebugLogger } from "../portable-license-flow/debug-log.js";
import { createLicenseService } from "../portable-license-flow/license-core.js";
import { sendLicenseError } from "../portable-license-flow/node-http-routes.js";


const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.resolve(__dirname, "..", "public");
const DEFAULT_PORT = Number(process.env.PORT || 5173);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const { debugLog, debugError } = createDebugLogger({
  logFile: process.env.SATHI_LOG_FILE || path.join(APP_ROOT, "logs", "server.log")
});

const licenseService = createLicenseService({
  publicKeyFile: process.env.SATHI_PUBLIC_KEY_FILE || path.join(APP_ROOT, "keys", "public.pem"),
  licenseFile: process.env.SATHI_LICENSE_FILE || path.join(APP_ROOT, "data", "license.lic"),
  runtimeFile: process.env.SATHI_LICENSE_RUNTIME_FILE || path.join(APP_ROOT, "data", "license-runtime.json"),
  debugLog,
  debugError,
  getIdentityExtras() {
    const env = readEnv();
    return {
      tallyLicenseNumber: "",
      saathiClientId: env.SAATHI_CLIENT_ID || process.env.SAATHI_CLIENT_ID || ""
    };
  }
});

export function startServer(options = {}) {
  const port = Number(options.port || DEFAULT_PORT);
  const server = createServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, () => {
      server.off("error", reject);
      if (!options.silent) console.log(`Sathi-Connect UI running at http://127.0.0.1:${port}`);
      resolve({ server, port });
    });
  });
}

function createServer() {
  return http.createServer(async (request, response) => {
    try {
      if (request.url.startsWith("/api/license")) {
        const handled = await handleLicenseRequest(request, response);
        if (handled) return;
      }
      if (request.url.startsWith("/api/")) {
        await handleApi(request, response);
        return;
      }

      serveStatic(request, response);
    } catch (error) {
      debugError("request.failed", error, { url: request.url, method: request.method });
      if (error.licenseStatus) {
        sendLicenseError(response, error);
        return;
      }
      if (error.status) {
        sendJson(response, 400, { ok: false, message: error.message, status: error.status });
        return;
      }
      const entry = recordError("server", error, { url: request.url, method: request.method });
      sendJson(response, 500, { ok: false, error: entry });
    }
  });
}

async function handleLicenseRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (request.method === "GET" && url.pathname === "/api/license/status") {
    const license = await checkedLicenseStatus();
    sendJson(response, 200, { ok: true, license });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/license/activation-request") {
    const body = await readJson(request);
    const result = await sendActivationRequestEmail(body);
    sendJson(response, 200, { ok: true, ...result });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/license/activate") {
    const body = await readJson(request);
    try {
      await licenseService.activateFromContent(body.content || "");
      const license = await checkedLicenseStatus({ throwOnInvalid: true });
      sendJson(response, 200, { ok: true, license });
      return true;
    } catch (error) {
      await licenseService.clear();
      throw error;
    }
  }

  if (request.method === "DELETE" && url.pathname === "/api/license") {
    const license = await licenseService.clear();
    sendJson(response, 200, { ok: true, license });
    return true;
  }

  return false;
}

async function checkedLicenseStatus(options = {}) {
  const status = await licenseService.getStatus();
  if (!status.activated) return status;

  try {
    await assertRuntimeLicenseMatches(status);
    return status;
  } catch (error) {
    if (options.throwOnInvalid) throw error;
    return error.licenseStatus || {
      ...status,
      activated: false,
      status: error.status || "license_error",
      message: error.message
    };
  }
}

if (isMainModule()) {
  startServer().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

async function handleApi(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === "GET" && url.pathname === "/api/config") {
    sendJson(response, 200, { ok: true, config: getEffectivePublicConfig() });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/company-config") {
    const companyName = url.searchParams.get("companyName") || "";
    sendJson(response, 200, { ok: true, settings: getCompanySettings(companyName) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/config") {
    const body = await readJson(request);
    const saved = saveConfig(body);
    sendJson(response, 200, { ok: true, config: getEffectivePublicConfig(saved) });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/errors") {
    sendJson(response, 200, { ok: true, errors: readErrors() });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/errors") {
    clearErrors();
    sendJson(response, 200, { ok: true, errors: [] });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/archive") {
    sendJson(response, 200, { ok: true, archive: readArchive() });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/archive") {
    clearArchive();
    sendJson(response, 200, { ok: true, archive: [] });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/tally/logs") {
    sendJson(response, 200, { ok: true, logs: readTallyLogs() });
    return;
  }

  if (request.method === "DELETE" && url.pathname === "/api/tally/logs") {
    clearTallyLogs();
    sendJson(response, 200, { ok: true, logs: [] });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/pending-orders") {
    await requireApiLicense();
    await callSaathi(response, "pendingOrders", async (client, payload) => {
      const data = await client.getOrderDetailsByBuyerCode(payload);
      return normalizeOrders(data);
    }, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/preview") {
    await requireApiLicense();
    const body = await readJson(request);
    sendJson(response, 200, { ok: true, preview: buildSaathiPreview(body.action, body.payload || {}, body.scope || null) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/call") {
    await requireApiLicense();
    const body = await readJson(request);
    await callSaathiAction(response, body.action, body.payload || {});
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/raw-call") {
    await requireApiLicense();
    const body = await readJson(request);
    await callSaathiRaw(response, body.action, body.requestHeaders || {}, body.requestBody || {}, body.scope || null);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/stored-queue") {
    await requireApiLicense();
    const body = await readJson(request);
    const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
    const scope = body.scope || null;
    const licenceCode = scope?.clientId || configWithScope(scope).clientId || "";
    backfillSathiQueueFromArchive(companyName, licenceCode);
    sendJson(response, 200, {
      ok: true,
      companyName,
      licenceCode,
      queue: listSathiOrderQueue({ companyName, licenceCode })
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/pull-lot") {
    await requireApiLicense();
    await callSaathi(response, "pullLot", async (client, payload) => {
      const data = await client.pullLotDetailsByBuyerCode(payload);
      return { raw: data, rows: Array.isArray(data?.data) ? data.data : [] };
    }, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/test") {
    await callTally(response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/voucher-status") {
    await callTallyVoucherStatus(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/company-udfs") {
    await callTallyCompanyUdfs(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/licence-scopes") {
    await callTallyLicenceScopes(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/stock-items") {
    await callTallyStockItems(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/portal-sales") {
    await callTallyPortalSales(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/purchase") {
    await callPurchaseReport(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/sales") {
    await callSalesReport(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/lot-trace") {
    await callLotTraceTool(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/audit") {
    await callAuditReport(response, await readJson(request));
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/item-mappings") {
    const companyName = url.searchParams.get("companyName") || readEnv().TALLY_COMPANY_NAME || "";
    sendJson(response, 200, { ok: true, companyName, mappings: getItemMappings(companyName) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/item-mappings") {
    const body = await readJson(request);
    const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
    const mappings = body.mappings || (body.key ? { [body.key]: body.mapping || body.value || {} } : {});
    sendJson(response, 200, { ok: true, companyName, mappings: saveItemMappings(companyName, mappings) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/push-voucher") {
    await requireApiLicense();
    await callTallyPushVoucher(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/bulk-push") {
    await requireApiLicense();
    await callTallyBulkPush(response, await readJson(request));
    return;
  }

  sendJson(response, 404, { ok: false, message: "API route not found." });
}

async function requireApiLicense() {
  const status = await licenseService.requireActive();
  await assertRuntimeLicenseMatches(status);
  return status;
}

async function assertRuntimeLicenseMatches(status) {
  const expectedTallyLicense = normalizeLicenseValue(status.tallyLicenseNumber || status.license?.tallyLicense || "");
  if (!expectedTallyLicense) return;

  let actualTallyLicense = "";
  try {
    const env = readEnv();
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
    });
    const info = await client.fetchLicenseInfo();
    actualTallyLicense = normalizeLicenseValue(info.serialNumber || "");
  } catch (error) {
    throw licenseGuardError(status, "Unable to verify Tally license number. Keep Tally open and try again.", {
      tallyVerificationError: error.message
    });
  }

  if (!actualTallyLicense) return;

  if (actualTallyLicense !== expectedTallyLicense) {
    throw licenseGuardError(status, `This license does not match the current Tally license number. Expected ${expectedTallyLicense || "-"}, current ${actualTallyLicense || "-"}.`, {
      expectedTallyLicense,
      actualTallyLicense
    });
  }
}

function licenseGuardError(status, message, details = {}) {
  const error = new Error(message);
  error.statusCode = 403;
  error.licenseStatus = {
    ...status,
    ...details,
    activated: false,
    status: "tally_mismatch",
    message
  };
  return error;
}

function normalizeLicenseValue(value) {
  return String(value || "").replace(/\s+/g, "").trim().toUpperCase();
}

async function sendActivationRequestEmail(body = {}) {
  const request = normalizeActivationRequest(body);
  validateActivationRequest(request);

  const env = readEnv();
  debugLog('env : ',{env});
  const smtp = {
    host: env.ACTIVATION_EMAIL_SMTP_HOST || "smtp.gmail.com",
    port: Number(env.ACTIVATION_EMAIL_SMTP_PORT || 465),
    user: env.ACTIVATION_EMAIL_USER || "",
    pass: env.ACTIVATION_EMAIL_APP_PASSWORD || env.ACTIVATION_EMAIL_PASSWORD || "",
    to: env.ACTIVATION_EMAIL_TO || env.ACTIVATION_EMAIL_USER || "",
    from: env.ACTIVATION_EMAIL_FROM || env.ACTIVATION_EMAIL_USER || ""
  };

  if (!smtp.user || !smtp.pass || !smtp.to || !smtp.from) {
    const error = new Error("Activation email is not configured. Add ACTIVATION_EMAIL_USER, ACTIVATION_EMAIL_APP_PASSWORD, and ACTIVATION_EMAIL_TO in settings .env.");
    error.status = "activation_email_not_configured";
    throw error;
  }

  const detailsText = activationRequestDetailsText(request);
  const message = buildActivationEmailMessage({
    from: smtp.from,
    to: smtp.to,
    subject: activationRequestSubject(request),
    request,
    detailsText
  });

  await sendSmtpMail(smtp, message);
  return { message: "Activation request email sent." };
}

function normalizeActivationRequest(body = {}) {
  return {
    customerName: String(body.customerName || "").trim(),
    companyName: String(body.companyName || "").trim(),
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    sathiLicence: String(body.sathiLicence || "").trim(),
    tallySerialNumber: String(body.tallySerialNumber || "").trim(),
    referenceId: String(body.referenceId || "").trim(),
    requestedAt: new Date().toISOString()
  };
}

function validateActivationRequest(request) {
  const required = {
    customerName: "Customer name is required.",
    companyName: "Company name is required.",
    email: "Email is required.",
    phone: "Phone number is required.",
    sathiLicence: "SATHI licence is required."
  };

  for (const [key, message] of Object.entries(required)) {
    if (!request[key]) {
      const error = new Error(message);
      error.status = "invalid_activation_request";
      throw error;
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) {
    const error = new Error("Valid email is required.");
    error.status = "invalid_activation_request";
    throw error;
  }

  if (!/^[+\d][\d\s()+-]{6,}$/.test(request.phone)) {
    const error = new Error("Valid phone number is required.");
    error.status = "invalid_activation_request";
    throw error;
  }
}

function activationRequestDetailsText(request) {
  return [
    "New Activation Request",
    "",
    `Customer name: ${request.customerName}`,
    `Company name: ${request.companyName}`,
    `Email: ${request.email}`,
    `Phone number: ${request.phone}`,
    `SATHI licence: ${request.sathiLicence}`,
    `Tally serial number: ${request.tallySerialNumber || "-"}`,
    `Reference ID: ${request.referenceId || "-"}`,
    `Requested at: ${request.requestedAt}`
  ].join("\n");
}

function activationRequestSubject(request) {
  const companyName = request.companyName || "Unknown Company";
  const tallySerial = request.tallySerialNumber || "-";
  return `New Activation Request - ${companyName} - Tally ${tallySerial}`;
}

function buildActivationEmailMessage({ from, to, subject, request, detailsText }) {
  const detailsHtml = detailsText.split("\n").map(escapeHtmlText).join("<br>");
  const attachmentText = wrapBase64(Buffer.from(detailsText, "utf8").toString("base64"));
  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f5f7fb;font-family:Arial,sans-serif;color:#172033;">
    <div style="max-width:720px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #dbe4ef;border-radius:8px;padding:22px;">
        <h2 style="margin:0 0 12px;font-size:20px;">New Activation Request</h2>
        <p style="margin:0 0 18px;color:#536273;">A customer has requested license activation.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${activationEmailRow("Customer name", request.customerName)}
          ${activationEmailRow("Company name", request.companyName)}
          ${activationEmailRow("Email", request.email)}
          ${activationEmailRow("Phone number", request.phone)}
          ${activationEmailRow("SATHI licence", request.sathiLicence)}
          ${activationEmailRow("Tally serial number", request.tallySerialNumber || "-")}
          ${activationEmailRow("Reference ID", request.referenceId || "-")}
          ${activationEmailRow("Requested at", request.requestedAt)}
        </table>
        <div id="activation-details" style="margin-top:18px;padding:14px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;font-family:Consolas,monospace;font-size:12px;line-height:1.55;">
          ${detailsHtml}
        </div>
        <p style="margin:14px 0 0;color:#536273;font-size:13px;">Copy the block above, or open the attached activation-request.txt file.</p>
      </div>
    </div>
  </body>
</html>`;

  return [
    `From: ${formatEmailAddress(from)}`,
    `To: ${formatEmailAddress(to)}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: multipart/mixed; boundary=\"activation-request-mixed\"",
    "",
    "--activation-request-mixed",
    "Content-Type: multipart/alternative; boundary=\"activation-request-boundary\"",
    "",
    "--activation-request-boundary",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    detailsText,
    "",
    "--activation-request-boundary",
    "Content-Type: text/html; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    html,
    "",
    "--activation-request-boundary--",
    "",
    "--activation-request-mixed",
    "Content-Type: text/plain; charset=utf-8; name=\"activation-request.txt\"",
    "Content-Transfer-Encoding: base64",
    "Content-Disposition: attachment; filename=\"activation-request.txt\"",
    "",
    attachmentText,
    "",
    "--activation-request-mixed--"
  ].join("\r\n");
}

function activationEmailRow(label, value) {
  return `<tr>
    <td style="width:190px;padding:9px 0;border-top:1px solid #eef2f7;color:#64748b;font-weight:700;">${escapeHtmlText(label)}</td>
    <td style="padding:9px 0;border-top:1px solid #eef2f7;color:#172033;">${escapeHtmlText(value || "-")}</td>
  </tr>`;
}

async function sendSmtpMail(smtp, message) {
  const socket = tls.connect({
    host: smtp.host,
    port: smtp.port,
    servername: smtp.host,
    timeout: 30000
  });

  const read = createSmtpReader(socket);
  const command = async (line, expected = [250]) => {
    if (line) socket.write(`${line}\r\n`);
    const response = await read();
    const code = Number(response.slice(0, 3));
    if (!expected.includes(code)) {
      throw new Error(`SMTP command failed (${line || "connect"}): ${response}`);
    }
    return response;
  };

  try {
    await command("", [220]);
    await command("EHLO sathi-connect.local", [250]);
    await command("AUTH LOGIN", [334]);
    await command(Buffer.from(smtp.user).toString("base64"), [334]);
    await command(Buffer.from(smtp.pass).toString("base64"), [235]);
    await command(`MAIL FROM:<${smtp.from}>`, [250]);
    await command(`RCPT TO:<${smtp.to}>`, [250, 251]);
    await command("DATA", [354]);
    socket.write(`${message}\r\n.\r\n`);
    await command("", [250]);
    await command("QUIT", [221]);
  } finally {
    socket.end();
  }
}

function createSmtpReader(socket) {
  let buffer = "";
  const waiters = [];
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    buffer += chunk;
    flushSmtpWaiters();
  });
  socket.on("error", (error) => {
    while (waiters.length) waiters.shift().reject(error);
  });
  socket.on("timeout", () => {
    const error = new Error("SMTP connection timed out.");
    socket.destroy(error);
  });

  return function read() {
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
      flushSmtpWaiters();
    });
  };

  function flushSmtpWaiters() {
    while (waiters.length) {
      const response = nextSmtpResponse();
      if (!response) return;
      waiters.shift().resolve(response);
    }
  }

  function nextSmtpResponse() {
    const lines = buffer.split(/\r?\n/);
    if (lines.length < 2) return null;

    let consumed = 0;
    for (let index = 0; index < lines.length - 1; index += 1) {
      consumed = index + 1;
      if (/^\d{3}\s/.test(lines[index])) {
        const response = lines.slice(0, consumed).join("\n");
        buffer = lines.slice(consumed).join("\n");
        return response;
      }
    }
    return null;
  }
}

function formatEmailAddress(value) {
  return String(value || "").replace(/[\r\n<>]/g, "").trim();
}

function escapeHtmlText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapBase64(value) {
  return String(value || "").replace(/.{1,76}/g, "$&\r\n").trim();
}

async function callTallyCompanyUdfs(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";

  try {
    const result = await client.fetchCompanyUdfs(companyName, SATHI_COMPANY_UDF_NAMES);
    const mapped = mapCompanyUdfsToConfig(result.fields);
    const log = recordTallyLog("company-udfs", "success", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: `${Object.values(result.fields).filter(Boolean).length} SATHI company UDF value(s) fetched.`,
      fields: maskCompanyUdfs(result.fields)
    });
    sendJson(response, 200, { ok: true, ...result, mapped, maskedFields: maskCompanyUdfs(result.fields), log });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "company-udfs", companyName });
    const log = recordTallyLog("company-udfs", "failed", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyLicenceScopes(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";

  try {
    const result = await client.fetchSathiVoucherTypes(companyName);
    const effectiveResult = result.licences.length ? result : fallbackLicenceScopesFromConfig(companyName, "No SATHI voucher type UDF was found. Using saved licence configuration.");
    const log = recordTallyLog("licence-scopes", "success", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: effectiveResult.fallback
        ? effectiveResult.message
        : `${effectiveResult.licences.length} SATHI licence scope(s) fetched from voucher types.`,
      purchaseCount: effectiveResult.purchaseScopes.length,
      salesCount: effectiveResult.salesScopes.length,
      fallback: Boolean(effectiveResult.fallback)
    });
    sendJson(response, 200, { ok: true, ...effectiveResult, log });
  } catch (error) {
    const fallback = fallbackLicenceScopesFromConfig(companyName, "Tally took too long to return voucher type UDFs. Using saved licence configuration.");
    if (fallback.licences.length) {
      const log = recordTallyLog("licence-scopes", "success", {
        companyName,
        url: env.TALLY_URL || "http://127.0.0.1:9000",
        message: fallback.message,
        originalError: error.message,
        fallback: true
      });
      sendJson(response, 200, { ok: true, ...fallback, log });
      return;
    }

    const entry = recordError("Tally", error, { action: "licence-scopes", companyName });
    const log = recordTallyLog("licence-scopes", "failed", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry });
  }
}

function fallbackLicenceScopesFromConfig(companyName, message) {
  const env = readEnv();
  const companyEnv = companySettingsToEnv(getCompanySettings(companyName));
  const mergedEnv = { ...env, ...companyEnv };
  const clientId = mergedEnv.SAATHI_CLIENT_ID || mergedEnv.SAATHI_DEFAULT_OWNER_CODE || mergedEnv.SAATHI_DEFAULT_LOCATION_CODE || "";
  if (!clientId) {
    return {
      companyName,
      licences: [],
      purchaseScopes: [],
      salesScopes: [],
      voucherTypes: [],
      fallback: true,
      message
    };
  }

  const fields = {
    apiKey: mergedEnv.SAATHI_API_KEY || "",
    clientId,
    clientSecret: mergedEnv.SAATHI_CLIENT_SECRET || "",
    ownerCode: mergedEnv.SAATHI_DEFAULT_OWNER_CODE || clientId,
    locationCode: mergedEnv.SAATHI_DEFAULT_LOCATION_CODE || mergedEnv.SAATHI_DEFAULT_OWNER_CODE || clientId,
    stateCode: mergedEnv.SAATHI_DEFAULT_STATE_CODE || "",
    baseUrl: mergedEnv.SAATHI_BASE_URL || "",
    purchaseLedgerName: mergedEnv.TALLY_PURCHASE_LEDGER_NAME || "",
    raw: {
      SATHI_API_KEY: mergedEnv.SAATHI_API_KEY || "",
      SATHI_CLIENT_ID: clientId,
      SATHI_CLIENT_SECRET: mergedEnv.SAATHI_CLIENT_SECRET || "",
      SATHI_OWNER_CODE: mergedEnv.SAATHI_DEFAULT_OWNER_CODE || clientId,
      SATHI_LOCATION_CODE: mergedEnv.SAATHI_DEFAULT_LOCATION_CODE || mergedEnv.SAATHI_DEFAULT_OWNER_CODE || clientId,
      SATHI_STATE_CODE: mergedEnv.SAATHI_DEFAULT_STATE_CODE || "",
      SATHI_BASE_URL: mergedEnv.SAATHI_BASE_URL || "",
      SATHI_TALLY_PURCHASE_LEDGER: mergedEnv.TALLY_PURCHASE_LEDGER_NAME || ""
    }
  };

  const purchaseVoucherTypeName = mergedEnv.TALLY_VOUCHER_TYPE_NAME || "Purchase";
  const salesVoucherTypeName = mergedEnv.TALLY_SALES_VOUCHER_TYPE_NAME || "";
  const salesVoucherTypeNames = salesVoucherTypeName ? [salesVoucherTypeName] : [];
  return {
    companyName,
    licences: [{
      clientId,
      purchaseVoucherTypeName,
      salesVoucherTypeName,
      salesVoucherTypeNames,
      fields,
      purchase: { name: purchaseVoucherTypeName, clientId, fields: fields.raw, scopeType: "purchase" },
      sales: salesVoucherTypeName ? { name: salesVoucherTypeName, clientId, fields: { SATHI_CLIENTID: clientId }, scopeType: "sales" } : null,
      missingSales: !salesVoucherTypeName,
      fallback: true
    }],
    purchaseScopes: [],
    salesScopes: [],
    voucherTypes: [],
    fallback: true,
    message
  };
}

async function callTallyStockItems(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";

  try {
    const result = await client.fetchStockItems(companyName);
    const log = recordTallyLog("stock-items", "success", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: `${result.items.length} Tally stock item(s) fetched for mapping.`
    });
    sendJson(response, 200, { ok: true, ...result, log });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "stock-items", companyName });
    const log = recordTallyLog("stock-items", "failed", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyPortalSales(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  const voucherTypeNames = resolveSalesVoucherTypeNames(body, env);
  const voucherTypeName = voucherTypeNames[0] || "Sales";

  try {
    const result = await client.fetchPortalSalesVouchersForTypes(companyName, voucherTypeNames, {
      fromDate: body.fromDate || "",
      toDate: body.toDate || ""
    });
    const vouchers = result.vouchers.map((voucher) => {
      const traces = safeFindLotTracesForSale(companyName, voucher.inventory || []);
      return {
        ...voucher,
        traces,
        originalOwner: firstOriginalOwner(traces) || firstInventoryOriginalOwner(voucher.inventory)
      };
    });
    const log = recordTallyLog("portal-sales", "success", {
      companyName,
      voucherTypeName,
      voucherTypeNames,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: `${vouchers.length} Tally sales voucher(s) fetched for portal push.`
    });
    sendJson(response, 200, { ok: true, ...result, vouchers, log });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "portal-sales", companyName, voucherTypeName });
    const log = recordTallyLog("portal-sales", "failed", {
      companyName,
      voucherTypeName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callPurchaseReport(response, body) {
  const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
  const filters = {
    companyName,
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  };
  const rows = listLotTraceReport(filters).map((row) => {
    const bill = row.raw?.bill || {};
    const lot = row.raw?.lot || {};
    return {
      companyName: row.companyName,
      billNumber: row.inwardVoucherNumber,
      billDate: row.inwardDate,
      sellerName: row.supplierName,
      sellerCode: row.originalOwner,
      buyerCode: row.buyerCode,
      lotNum: row.lotNum,
      stockItemName: row.stockItemName,
      portalItemName: row.portalItemName,
      packingSize: row.packingSize || lot.packingSize || "",
      packingUnit: lot.packingUnit || "",
      certificationClass: lot.certificationClass || "",
      cropName: lot.cropName || "",
      varietyName: lot.varietyName || row.portalItemName,
      totalBags: lot.totalBags ?? "",
      totalQty: lot.totalQty ?? "",
      unitPrice: lot.unitPrice || "",
      totalBillPrice: bill.totalBillPrice || "",
      expiryDate: lot.expiryDate || "",
      hsnCode: lot.tax?.hsnCode ?? "",
      cgst: lot.tax?.cgst ?? 0,
      sgst: lot.tax?.sgst ?? 0,
      igst: lot.tax?.igst ?? 0,
      sathiStatus: "Imported to Tally",
      sathiVchNo: row.inwardVoucherNumber,
      updatedAt: row.updatedAt,
      source: "local-lot-trace"
    };
  });

  sendJson(response, 200, {
    ok: true,
    report: "purchase",
    companyName,
    filters,
    rows,
    count: rows.length,
    generatedAt: new Date().toISOString()
  });
}

async function callSalesReport(response, body) {
  const env = readEnv();
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  const scope = body.scope || null;
  const voucherTypeNames = resolveSalesVoucherTypeNames(body, env);
  const voucherTypeName = voucherTypeNames[0] || "Sales";
  const filters = {
    companyName,
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  };

  try {
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: env.TALLY_TIMEOUT_MS
    });
    const result = await client.fetchPortalSalesVouchersForTypes(companyName, voucherTypeNames, filters);
    const portalLogs = listPortalPushReport(filters);
    const logByVoucher = Object.fromEntries(portalLogs.map((log) => [log.tallyVoucherNumber, log]));
    const rows = result.vouchers.map((voucher) => {
      const traces = safeFindLotTracesForSale(companyName, voucher.inventory || []);
      const portalLog = logByVoucher[voucher.voucherNumber] || logByVoucher[voucher.reference] || null;
      return {
        ...voucher,
        voucherTypeName: voucher.voucherTypeName || voucherTypeName,
        voucherTypeNames,
        buyerLicense: voucher.buyerLicense || "",
        traces,
        originalOwner: firstOriginalOwner(traces) || firstInventoryOriginalOwner(voucher.inventory),
        portalStatus: voucher.sathiStatus || portalLog?.status || "Not pushed",
        sathiVoucherNumber: voucher.sathiVchNo || portalLog?.sathiVoucherNumber || "",
        portalResponse: portalLog?.response || null,
        source: "tally-sales"
      };
    });

    sendJson(response, 200, {
      ok: true,
      report: "sales",
      companyName,
      voucherTypeName,
      voucherTypeNames,
      filters,
      rows,
      portalLogs,
      count: rows.length,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const entry = recordError("Reports", error, { action: "sales-report", companyName, voucherTypeName });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

function resolveSalesVoucherTypeNames(body = {}, env = readEnv()) {
  const explicitList = [
    ...(Array.isArray(body.voucherTypeNames) ? body.voucherTypeNames : []),
    ...(Array.isArray(body.scope?.salesVoucherTypeNames) ? body.scope.salesVoucherTypeNames : [])
  ];
  if (explicitList.length) {
    return uniqueCleanNames(explicitList);
  }

  const explicitSingle = uniqueCleanNames([body.voucherTypeName, body.scope?.salesVoucherTypeName]);
  if (explicitSingle.length) return explicitSingle;

  return uniqueCleanNames([env.TALLY_SALES_VOUCHER_TYPE_NAME, "Sales"]);
}

function uniqueCleanNames(names = []) {
  return [...new Set(names.map((name) => String(name || "").trim()).filter(Boolean))];
}

async function callLotTraceTool(response, body) {
  const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
  const rows = listLotTraceReport({
    companyName,
    lotNum: body.lotNum || "",
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  });

  sendJson(response, 200, {
    ok: true,
    report: "lot-trace",
    companyName,
    rows,
    count: rows.length,
    generatedAt: new Date().toISOString()
  });
}

async function callAuditReport(response, body) {
  const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
  const tallyLogs = readTallyLogs()
    .filter((log) => !companyName || !log.companyName || log.companyName === companyName)
    .slice(0, 100);
  const portalLogs = listPortalPushReport({
    companyName,
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  });
  const rows = [
    ...tallyLogs.map((log) => ({
      source: "Tally",
      action: log.action,
      status: log.status,
      voucherNumber: log.voucherNumber || "",
      message: log.message || "",
      createdAt: log.createdAt || log.created_at || "",
      raw: log
    })),
    ...portalLogs.map((log) => ({
      source: "Portal",
      action: "createSathiOrder",
      status: log.status,
      voucherNumber: log.tallyVoucherNumber,
      message: log.sathiVoucherNumber ? `SATHI voucher ${log.sathiVoucherNumber}` : "Portal push recorded",
      createdAt: log.createdAt,
      raw: log
    }))
  ].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));

  sendJson(response, 200, {
    ok: true,
    report: "audit",
    companyName,
    rows,
    count: rows.length,
    generatedAt: new Date().toISOString()
  });
}

function mapCompanyUdfsToConfig(fields = {}) {
  return removeEmpty({
    saathiApiKey: fields.SATHI_API_KEY,
    saathiClientId: fields.SATHI_CLIENT_ID,
    saathiClientSecret: fields.SATHI_CLIENT_SECRET,
    saathiOwnerCode: fields.SATHI_OWNER_CODE,
    saathiLocationCode: fields.SATHI_LOCATION_CODE,
    saathiStateCode: fields.SATHI_STATE_CODE,
    saathiBaseUrl: fields.SATHI_BASE_URL,
    tallyVoucherTypeName: fields.SATHI_TALLY_VOUCHER_TYPE,
    tallySalesVoucherTypeName: fields.SATHI_TALLY_VOUCHER_TYPE_SALES,
    tallyPurchaseLedgerName: fields.SATHI_TALLY_PURCHASE_LEDGER
  });
}

function maskCompanyUdfs(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [
    key,
    isSensitiveCompanyUdf(key) ? maskSecret(value || "") : value
  ]));
}

function isSensitiveCompanyUdf(key) {
  return key === "SATHI_API_KEY" || key === "SATHI_CLIENT_SECRET";
}

async function callSaathi(response, action, handler, payload) {
  try {
    const client = new SaathiBillingClient(loadConfig());
    const result = await handler(client, payload || {});
    saveSathiResponse(action, { mode: "mapped", body: payload || {} }, result.raw || result);
    const savedQueue = saveSathiQueueFromResponse(action, result.raw || result, null);
    sendJson(response, 200, { ok: true, action, ...result, savedQueue, fetchedAt: new Date().toISOString() });
  } catch (error) {
    const entry = recordError("SATHI", error, { action });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callSaathiAction(response, action, payload) {
  try {
    const client = new SaathiBillingClient(loadConfig());
    let data;

    if (action === "pendingOrders") data = await client.getOrderDetailsByBuyerCode(payload);
    else if (action === "pullLot") data = await client.pullLotDetailsByBuyerCode(payload);
    else if (action === "fetchLot") data = await client.fetchLotDetailsByBuyerCode(payload);
    else if (action === "createOrder") data = await client.createSathiOrder(payload);
    else throw new Error(`Unsupported SATHI action: ${action}`);

    const saved = saveSathiResponse(action, { mode: "mapped", body: payload }, data);
    const savedQueue = saveSathiQueueFromResponse(action, data, null);
    const savedLotTraces = saveLotTracesFromSaathiResponse(action, data);

    sendJson(response, 200, {
      ok: true,
      action,
      raw: data,
      saved,
      savedQueue,
      savedLotTraces,
      rows: Array.isArray(data?.data) ? data.data : [],
      count: Array.isArray(data?.data) ? data.data.length : 0,
      status: data?.status || "",
      message: data?.message || "",
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const entry = recordError("SATHI", error, { action, payload });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callSaathiRaw(response, action, requestHeaders, requestBody, scope = null) {
  try {
    const config = configWithScope(scope);
    const endpoint = getBillingEndpoint(action);
    const apiKey = required(config.apiKey, "SAATHI_API_KEY");
    const finalBody = finalizeEditableBody(requestBody, apiKey);
    const finalHeaders = finalizeEditableHeaders(requestHeaders, finalBody, config, apiKey);

    const fetchResponse = await fetch(buildApiUrl(config.baseUrl, endpoint), {
      method: "POST",
      headers: finalHeaders,
      body: JSON.stringify(finalBody),
      signal: AbortSignal.timeout(config.runtime.timeoutMs)
    });

    const rawText = await fetchResponse.text();
    const contentType = fetchResponse.headers.get("content-type") || "";
    const data = contentType.includes("application/json") && rawText ? JSON.parse(rawText) : rawText;

    if (!fetchResponse.ok) {
      throw new Error(`SATHI billing request failed: HTTP ${fetchResponse.status} ${JSON.stringify(data)}`);
    }

    const saved = saveSathiResponse(action, {
      mode: "raw",
      url: buildApiUrl(config.baseUrl, endpoint).toString(),
      headers: maskHeaders(finalHeaders),
      body: finalBody
    }, data);
    const tallyStatusUpdate = action === "createOrder" && data?.statusCode === 200
      ? await updateTallySathiFieldsAfterCreateOrder(requestBody, finalBody, data, scope)
      : null;
    const savedQueue = saveSathiQueueFromResponse(action, data, scope);
    const savedLotTraces = saveLotTracesFromSaathiResponse(action, data);

    sendJson(response, 200, {
      ok: true,
      action,
      raw: data,
      saved,
      tallyStatusUpdate,
      savedQueue,
      savedLotTraces,
      sent: {
        url: buildApiUrl(config.baseUrl, endpoint).toString(),
        headers: maskHeaders(finalHeaders),
        body: finalBody
      },
      rows: Array.isArray(data?.data) ? data.data : [],
      count: Array.isArray(data?.data) ? data.data.length : 0,
      status: data?.status || "",
      message: data?.message || "",
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const entry = recordError("SATHI", error, { action, mode: "raw-call" });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function updateTallySathiFieldsAfterCreateOrder(requestBody = {}, finalBody = {}, data = {}, scope = null) {
  const env = readEnv();
  const companyName = env.TALLY_COMPANY_NAME || "";
  const sourceVoucherNumber = requestBody.sourceVoucherNumber || finalBody.sourceVoucherNumber || "";
  if (!sourceVoucherNumber) {
    recordPortalPush(companyName, finalBody, data, data.status || "Success");
    return { updated: false, skipped: true, message: "No source Tally voucher number available." };
  }

  const sathiVoucherNumber = extractSathiVoucherNumber(data);
  const status = data.status || data.message || "Success";
  recordPortalPush(companyName, { ...finalBody, sourceVoucherNumber }, data, status);

  try {
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: env.TALLY_TIMEOUT_MS
    });
    const result = await client.updateVoucherSathiFields(companyName, {
      voucherNumber: sourceVoucherNumber,
      reference: requestBody.sourceReference || "",
      date: requestBody.sourceVoucherDate || "",
      voucherTypeName: scope?.salesVoucherTypeName || env.TALLY_SALES_VOUCHER_TYPE_NAME || "Sales",
      sathiStatus: status,
      sathiVchNo: sathiVoucherNumber
    });
    recordTallyLog("sathi-status-update", result.updated ? "success" : "failed", {
      companyName,
      voucherNumber: sourceVoucherNumber,
      message: result.updated ? `SATHI status updated: ${sathiVoucherNumber || status}` : "SATHI status update did not confirm success.",
      summary: result.summary
    });
    return result;
  } catch (error) {
    const entry = recordError("Tally", error, { action: "sathi-status-update", voucherNumber: sourceVoucherNumber });
    recordTallyLog("sathi-status-update", "failed", {
      companyName,
      voucherNumber: sourceVoucherNumber,
      message: error.message,
      error: entry
    });
    return { updated: false, error: entry };
  }
}

function extractSathiVoucherNumber(data = {}) {
  return data?.response?.data?.voucherNumber || data?.data?.voucherNumber || data?.voucherNumber || "";
}

async function callTally(response) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  try {
    const result = await client.testConnection();
    const payload = { ok: true, ...result, checkedAt: new Date().toISOString() };
    const log = recordTallyLog("test-connection", "success", {
      companyName: env.TALLY_COMPANY_NAME || "",
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: `${result.companies.length} company record(s) received from Tally.`,
      result: payload
    });
    sendJson(response, 200, { ...payload, log });
  } catch (error) {
    const entry = recordError("Tally", error, { url: env.TALLY_URL || "http://127.0.0.1:9000" });
    const log = recordTallyLog("test-connection", "failed", {
      companyName: env.TALLY_COMPANY_NAME || "",
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyVoucherStatus(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  try {
    const companyName = env.TALLY_COMPANY_NAME || body.companyName || "";
    const voucherNumber = body.voucherNumber || "";
    const result = await client.checkVoucherExists(
      companyName,
      voucherNumber
    );
    const log = recordTallyLog("voucher-status", result.exists ? "found" : "not-found", {
      companyName,
      voucherNumber,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: result.exists ? "Voucher/reference found in Tally export." : "Voucher/reference was not found in Tally export.",
      result
    });
    sendJson(response, 200, { ok: true, ...result, log });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "voucher-status", voucherNumber: body.voucherNumber });
    const log = recordTallyLog("voucher-status", "failed", {
      companyName: env.TALLY_COMPANY_NAME || body.companyName || "",
      voucherNumber: body.voucherNumber || "",
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyPushVoucher(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  try {
    const companyName = env.TALLY_COMPANY_NAME || body.companyName || "";
    const billNumber = body.bill?.billNumber || body.bill?.voucherNumber || "";
    const storedItemMappings = getItemMappings(companyName);
    const requestItemMappings = body.itemMappings || {};
    if (Object.keys(requestItemMappings).length) saveItemMappings(companyName, requestItemMappings);
    const mapping = {
      ...tallyMappingFromEnv(env),
      ...tallyMappingFromScope(body.scope),
      itemMappings: {
        ...storedItemMappings,
        ...requestItemMappings
      }
    };
    let preCheck = null;
    try {
      preCheck = await client.checkVoucherExists(companyName, billNumber);
    } catch (checkError) {
      preCheck = { exists: false, error: checkError.message };
    }
    if (preCheck.exists) {
      const message = "Voucher already exists in Tally. Push skipped to prevent duplicate entry.";
      const savedLotTraces = upsertLotTraces(companyName, body.bill, mapping);
      const log = recordTallyLog("push-voucher", "skipped-existing", {
        companyName,
        voucherNumber: billNumber,
        url: env.TALLY_URL || "http://127.0.0.1:9000",
        message,
        mapping,
        billSummary: summarizeBill(body.bill),
        preCheck,
        savedLotTraces
      });
      sendJson(response, 200, {
        ok: true,
        imported: false,
        skipped: true,
        alreadyExists: true,
        verification: preCheck,
        message,
        savedLotTraces,
        log
      });
      return;
    }
    const mappingWithAction = {
      ...mapping,
      voucherAction: "Create"
    };
    const result = await client.pushPurchaseVoucher(
      companyName,
      body.bill,
      mappingWithAction
    );
    let verification = null;
    try {
      verification = await client.checkVoucherExists(companyName, billNumber);
    } catch (verifyError) {
      verification = { exists: false, error: verifyError.message };
    }

    const status = result.imported && verification?.exists ? "pushed-and-verified" : result.imported ? "pushed-not-verified" : "failed";
    const message = tallyPushMessage(result, verification);
    const savedLotTraces = result.imported ? upsertLotTraces(companyName, body.bill, mappingWithAction) : [];
    const log = recordTallyLog("push-voucher", status, {
      companyName,
      voucherNumber: billNumber,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message,
      mapping: mappingWithAction,
      billSummary: summarizeBill(body.bill),
      preCheck,
      masterResult: result.masterResult,
      importSummary: result.summary,
      savedLotTraces,
      lineErrors: result.lineErrors || [],
      verification,
      xmlPreview: result.xmlPreview,
      response: result.response
    });

    sendJson(response, 200, { ok: true, ...result, verification, message, savedLotTraces, log });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "push-voucher", billNumber: body.bill?.billNumber });
    const log = recordTallyLog("push-voucher", "failed", {
      companyName: env.TALLY_COMPANY_NAME || body.companyName || "",
      voucherNumber: body.bill?.billNumber || body.bill?.voucherNumber || "",
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      billSummary: summarizeBill(body.bill),
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyBulkPush(response, body) {
  const bills = Array.isArray(body.bills) ? body.bills : [];
  const results = [];

  for (const bill of bills) {
    const capture = createCaptureResponse();
    await callTallyPushVoucher(capture, { ...body, bill });
    results.push({ billNumber: bill.billNumber, ...capture.body });
  }

  const log = recordTallyLog("bulk-push", "completed", {
    companyName: body.companyName || "",
    message: `${results.length} voucher(s) processed in bulk push.`,
    results
  });

  sendJson(response, 200, { ok: true, results, log });
}

function tallyPushMessage(result, verification) {
  const lineError = result.lineErrors?.find(Boolean);
  if (lineError) return lineError;
  if (result.summary?.errors > 0) return `Tally import returned ${result.summary.errors} error(s).`;
  if (result.imported && verification?.exists) return "Voucher imported and verified in Tally.";
  if (result.imported && verification?.error) return `Voucher imported, but verification failed: ${verification.error}`;
  if (result.imported) return "Voucher import returned success, but voucher was not found during verification.";
  return "Tally did not confirm voucher creation. Check import summary and raw response.";
}

function saveLotTracesFromSaathiResponse(action, data) {
  if (action !== "pullLot" && action !== "fetchLot") return [];
  const env = readEnv();
  const companyName = env.TALLY_COMPANY_NAME || "";
  const rows = Array.isArray(data?.response?.data) ? data.response.data : Array.isArray(data?.data) ? data.data : [];
  return rows.flatMap((bill) => upsertLotTraces(companyName, bill, {}));
}

function saveSathiQueueFromResponse(action, data, scope = null) {
  if (!["pendingOrders", "pullLot", "fetchLot"].includes(action)) return [];
  const env = readEnv();
  const companyName = env.TALLY_COMPANY_NAME || "";
  const config = configWithScope(scope);
  const licenceCode = config.clientId || scope?.clientId || "";
  if (!companyName || !licenceCode) return [];
  return upsertSathiOrderQueue(companyName, licenceCode, action, data);
}

function backfillSathiQueueFromArchive(companyName, licenceCode) {
  if (!companyName || !licenceCode) return [];
  const activeCode = String(licenceCode || "").trim().toUpperCase();
  const saved = [];
  for (const entry of readArchive()) {
    if (!["pendingOrders", "pullLot", "fetchLot"].includes(entry.action)) continue;
    if (!archiveEntryMatchesLicence(entry, activeCode)) continue;
    saved.push(...upsertSathiOrderQueue(companyName, licenceCode, entry.action, entry.response));
  }
  return saved;
}

function archiveEntryMatchesLicence(entry, activeCode) {
  const rows = Array.isArray(entry.response?.response?.data)
    ? entry.response.response.data
    : Array.isArray(entry.response?.data)
      ? entry.response.data
      : [];
  const candidates = [
    entry.request?.headers?.clientid,
    entry.request?.body?.ownerCode,
    entry.request?.body?.locationCode,
    ...rows.flatMap((row) => [
      row.buyerCode,
      row.ownerCode,
      row.locationCode,
      row.buyer_code,
      row.owner_code,
      row.location_code
    ])
  ].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean);
  return candidates.includes(activeCode);
}

function summarizeBill(bill = {}) {
  return {
    billNumber: bill.billNumber || bill.voucherNumber || "",
    billDate: bill.billDate || "",
    sellerCode: bill.sellerCode || "",
    sellerName: bill.sellerName || "",
    buyerName: bill.buyerName || "",
    totalBillPrice: bill.totalBillPrice || "",
    lotCount: Array.isArray(bill.lotData) ? bill.lotData.length : 0
  };
}

function tallyMappingFromEnv(env) {
  return {
    voucherTypeName: env.TALLY_VOUCHER_TYPE_NAME || "Purchase",
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
  };
}

function tallyMappingFromScope(scope = null) {
  const fields = scope?.fields || {};
  const raw = fields.raw || {};
  return removeEmpty({
    voucherTypeName: scope?.purchaseVoucherTypeName,
    purchaseLedgerName: fields.purchaseLedgerName || raw.SATHI_TALLY_PURCHASE_LEDGER
  });
}

function createCaptureResponse() {
  return {
    body: null,
    writeHead() { },
    end(value) {
      this.body = JSON.parse(value);
    }
  };
}

function normalizeOrders(data) {
  const rows = Array.isArray(data?.data) ? data.data : [];
  return {
    raw: data,
    rows,
    count: rows.length,
    status: data?.status || "",
    message: data?.message || ""
  };
}

function configWithScope(scope = null) {
  let config = loadConfig();
  config = applyCompanyConfig(config, scope?.companyName || readEnv().TALLY_COMPANY_NAME || "");
  const fields = scope?.fields || {};
  const raw = fields.raw || {};
  const clientId = cleanConfigValue(fields.clientId || raw.SATHI_CLIENT_ID || raw.SATHI_CLIENTID || raw.SATHICLIENTID || scope?.clientId || config.clientId || "");
  const ownerCode = cleanConfigValue(fields.ownerCode || raw.SATHI_OWNER_CODE || clientId || config.defaults.ownerCode || "");
  const locationCode = cleanConfigValue(fields.locationCode || raw.SATHI_LOCATION_CODE || ownerCode || config.defaults.locationCode || "");
  const stateCode = cleanConfigValue(fields.stateCode || raw.SATHI_STATE_CODE || config.defaults.stateCode || "");

  return {
    ...config,
    baseUrl: cleanConfigValue(fields.baseUrl || raw.SATHI_BASE_URL || config.baseUrl),
    apiKey: cleanConfigValue(fields.apiKey || raw.SATHI_API_KEY || raw.SATHI_APIKEY || raw.SATHIAPIKEY || config.apiKey),
    clientId,
    clientSecret: cleanConfigValue(fields.clientSecret || raw.SATHI_CLIENT_SECRET || config.clientSecret),
    clientSecretMode: fields.clientSecret || raw.SATHI_CLIENT_SECRET ? "plain" : config.clientSecretMode,
    defaults: {
      ...config.defaults,
      ownerCode,
      locationCode,
      stateCode
    }
  };
}

function applyCompanyConfig(config, companyName) {
  const companyEnv = companySettingsToEnv(getCompanySettings(companyName));
  if (!Object.keys(companyEnv).length) return config;
  return {
    ...config,
    baseUrl: companyEnv.SAATHI_BASE_URL || config.baseUrl,
    apiKey: companyEnv.SAATHI_API_KEY || config.apiKey,
    clientId: companyEnv.SAATHI_CLIENT_ID || config.clientId,
    clientSecret: companyEnv.SAATHI_CLIENT_SECRET || config.clientSecret,
    clientSecretMode: companyEnv.SAATHI_CLIENT_SECRET_MODE || config.clientSecretMode,
    defaults: {
      ...config.defaults,
      ownerCode: companyEnv.SAATHI_DEFAULT_OWNER_CODE || config.defaults.ownerCode,
      locationCode: companyEnv.SAATHI_DEFAULT_LOCATION_CODE || config.defaults.locationCode,
      stateCode: companyEnv.SAATHI_DEFAULT_STATE_CODE || config.defaults.stateCode
    },
    runtime: {
      ...config.runtime,
      timeoutMs: Number(companyEnv.SAATHI_TIMEOUT_MS || config.runtime.timeoutMs),
      retryCount: Number(companyEnv.SAATHI_RETRY_COUNT || config.runtime.retryCount)
    }
  };
}

function cleanConfigValue(value) {
  return String(value || "").trim();
}

function buildSaathiPreview(action, payload, scope = null) {
  const config = configWithScope(scope);
  const finalPayload = normalizeSaathiPayload(action, payload, config);
  const { body, signature } = createSignedPayload(finalPayload, config.apiKey || "");
  const endpoint = getBillingEndpoint(action);

  return {
    action,
    method: "POST",
    url: buildApiUrl(config.baseUrl, endpoint).toString(),
    headers: {
      clientid: config.clientId || "",
      clientsecret: maskSecret(resolveClientSecret(config.clientSecret, config.clientSecretMode)),
      signature,
      "Content-Type": "application/json"
    },
    body,
    bodyString: JSON.stringify(body),
    notes: [
      "keyHash = SHA512(apiKey + ts)",
      "signature = HMAC-SHA512(JSON.stringify(body), apiKey)",
      "clientsecret is masked in preview; actual request sends the configured value."
    ]
  };
}

function finalizeEditableBody(requestBody, apiKey) {
  const ts = requestBody.ts || Date.now();
  const body = {
    ...requestBody,
    keyHash: createKeyHash(apiKey, ts),
    ts
  };

  if (Object.prototype.hasOwnProperty.call(requestBody, "apiKey")) {
    body.apiKey = apiKey;
  }

  return body;
}

function finalizeEditableHeaders(requestHeaders, finalBody, config, apiKey) {
  const headers = {
    ...requestHeaders,
    clientid: requestHeaders.clientid || config.clientId || "",
    clientsecret: resolveEditableClientSecret(requestHeaders.clientsecret, config),
    signature: createSignature(finalBody, apiKey),
    "Content-Type": requestHeaders["Content-Type"] || requestHeaders["content-type"] || "application/json"
  };

  if (headers["content-type"] && !headers["Content-Type"]) {
    headers["Content-Type"] = headers["content-type"];
  }

  delete headers["content-type"];
  return headers;
}

function resolveEditableClientSecret(value, config) {
  const configured = resolveClientSecret(config.clientSecret, config.clientSecretMode);
  if (!value || String(value).includes("*")) return configured;
  return value;
}

function maskHeaders(headers) {
  return {
    ...headers,
    clientsecret: maskSecret(headers.clientsecret)
  };
}

function firstOriginalOwner(traces = {}) {
  return Object.values(traces).find((trace) => trace?.originalOwner)?.originalOwner || "";
}

function firstInventoryOriginalOwner(inventory = []) {
  return (inventory || []).find((item) => item?.originalOwner)?.originalOwner || "";
}

function safeFindLotTracesForSale(companyName, inventoryRows) {
  try {
    return findLotTracesForSale(companyName, inventoryRows);
  } catch {
    return {};
  }
}

function normalizeSaathiPayload(action, payload, config) {
  if (action === "pendingOrders") {
    return {
      ownerCode: payload.ownerCode || config.defaults.ownerCode,
      stateCode: payload.stateCode || config.defaults.stateCode
    };
  }

  if (action === "pullLot" || action === "fetchLot") {
    return {
      voucherNumber: payload.voucherNumber || "",
      ownerCode: payload.ownerCode || config.defaults.ownerCode,
      stateCode: payload.stateCode || config.defaults.stateCode,
      locationCode: payload.locationCode || config.defaults.locationCode || payload.ownerCode || config.defaults.ownerCode
    };
  }

  if (action === "createOrder") {
    return {
      ...payload,
      apiKey: payload.apiKey || config.apiKey || "",
      ownerCode: payload.ownerCode || config.defaults.ownerCode || config.clientId || "",
      locationCode: payload.locationCode || config.defaults.locationCode || config.defaults.ownerCode || config.clientId || "",
      stateCode: payload.stateCode || config.defaults.stateCode || "",
      buyerStateCode: payload.buyerStateCode || payload.stateCode || config.defaults.stateCode || ""
    };
  }

  throw new Error(`Unsupported SATHI action: ${action}`);
}

function getBillingEndpoint(action) {
  if (action === "pendingOrders") return BILLING_PATHS.pendingOrders;
  if (action === "pullLot") return BILLING_PATHS.pullLot;
  if (action === "fetchLot") return BILLING_PATHS.fetchLot;
  if (action === "createOrder") return BILLING_PATHS.createOrder;
  throw new Error(`Unsupported SATHI action: ${action}`);
}

function maskSecret(value) {
  if (!value) return "";
  if (value.length <= 6) return "*".repeat(value.length);
  return `${value.slice(0, 2)}${"*".repeat(Math.min(value.length - 4, 18))}${value.slice(-2)}`;
}

function required(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function saveConfig(body) {
  const updates = {
    UI_THEME: body.uiTheme,
    SAATHI_BASE_URL: body.saathiBaseUrl,
    SAATHI_CLIENT_ID: body.saathiClientId,
    SAATHI_CLIENT_SECRET_MODE: body.saathiClientSecretMode,
    SAATHI_DEFAULT_OWNER_CODE: body.saathiOwnerCode,
    SAATHI_DEFAULT_LOCATION_CODE: body.saathiLocationCode,
    SAATHI_DEFAULT_STATE_CODE: body.saathiStateCode,
    SAATHI_TIMEOUT_MS: body.saathiTimeoutMs,
    SAATHI_RETRY_COUNT: body.saathiRetryCount,
    TALLY_URL: body.tallyUrl,
    TALLY_COMPANY_NAME: body.tallyCompanyName,
    TALLY_TIMEOUT_MS: body.tallyTimeoutMs,
    TALLY_VOUCHER_TYPE_NAME: body.tallyVoucherTypeName,
    TALLY_SALES_VOUCHER_TYPE_NAME: body.tallySalesVoucherTypeName,
    TALLY_PURCHASE_LEDGER_NAME: body.tallyPurchaseLedgerName,
    TALLY_PARTY_MODE: body.tallyPartyMode,
    TALLY_STOCK_ITEM_MODE: body.tallyStockItemMode,
    TALLY_QUANTITY_MODE: body.tallyQuantityMode,
    TALLY_UNIT_NAME: body.tallyUnitName,
    TALLY_GODOWN_NAME: body.tallyGodownName,
    TALLY_GST_REGISTRATION_NAME: body.tallyGstRegistrationName,
    TALLY_COMPANY_REGISTRATION_TYPE: body.tallyCompanyRegistrationType,
    TALLY_PARTY_REGISTRATION_TYPE: body.tallyPartyRegistrationType,
    TALLY_CGST_LEDGER_NAME: body.tallyCgstLedgerName,
    TALLY_SGST_LEDGER_NAME: body.tallySgstLedgerName,
    TALLY_IGST_LEDGER_NAME: body.tallyIgstLedgerName
  };

  if (body.saathiApiKey) updates.SAATHI_API_KEY = body.saathiApiKey;
  if (body.saathiClientSecret) updates.SAATHI_CLIENT_SECRET = body.saathiClientSecret;

  if (body.tallyCompanyName) {
    const currentEnv = readEnv();
    const companySettings = pickCompanySettings(body);
    if (!companySettings.saathiApiKey && currentEnv.SAATHI_API_KEY) {
      companySettings.saathiApiKey = currentEnv.SAATHI_API_KEY;
    }
    if (!companySettings.saathiClientSecret && currentEnv.SAATHI_CLIENT_SECRET) {
      companySettings.saathiClientSecret = currentEnv.SAATHI_CLIENT_SECRET;
    }
    saveCompanySettings(body.tallyCompanyName, companySettings);
  }

  return writeEnv(removeEmpty(updates));
}

function getEffectivePublicConfig(env = readEnv()) {
  const companyName = env.TALLY_COMPANY_NAME || "";
  const companySettings = companySettingsToEnv(getCompanySettings(companyName));
  return publicConfig({ ...env, ...companySettings });
}

function removeEmpty(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
  );
}

function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);

  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(response, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath);
  response.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(response);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  response.end(body);
}

function buildApiUrl(baseUrl, endpoint) {
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return new URL(`${cleanBase}/${cleanEndpoint}`);
}

function isMainModule() {
  return path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);
}
