import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import tls from "node:tls";
// import { fileURLToPath } from "node:url";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadConfig } from "./config.js";
import { companySettingsToEnv, getCompanySettings, pickCompanySettings, saveCompanySettings } from "./company-settings.js";
import { readEnv, publicConfig, writeEnv } from "./env-store.js";
import { readErrors, recordError, clearErrors } from "./error-log.js";
import { getItemMappings, saveItemMappings } from "./item-mappings.js";
import { getPartyMappings, savePartyMappings } from "./party-mappings.js";
import { clearArchive, readArchive, saveSathiResponse } from "./response-archive.js";
import { SaathiBillingClient, BILLING_PATHS } from "./saathi-billing-client.js";
import { createKeyHash, createSignature, createSignedPayload, resolveClientSecret } from "./saathi-signing.js";
import { SATHI_COMPANY_UDF_NAMES, TallyClient } from "./tally-client.js";
import { clearTallyLogs, readTallyLogs, recordTallyLog } from "./tally-log.js";
import {
  authenticateDemoMode,
  defaultDemoBills,
  demoModeStatus,
  demoSaathiResponse,
  demoSeedResponse,
  isDemoModeEnabled,
  requireDemoSession,
  resetDemoMode,
  setDemoSeedBills,
  setDemoModeEnabled
} from "./demo-mode.js";
import {
  clearDemoSathiOrderQueue,
  flushDbWrites,
  findGrnLotMatches,
  findLotTracesForSale,
  listGrnLotCache,
  listLotTraceReport,
  listPortalPushReport,
  listSathiOrderQueue,
  markSathiOrderQueueStatus,
  recordPortalPush,
  replaceGrnLotCache,
  upsertLotTraces,
  upsertSathiOrderQueue
} from "./app-db.js";

// License 
import { createDebugLogger } from "../portable-license-flow/debug-log.js";
import { createLicenseService } from "../portable-license-flow/license-core.js";
import { sendLicenseError } from "../portable-license-flow/node-http-routes.js";


// const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODULE_URL = typeof __filename !== "undefined" ? pathToFileURL(__filename).href : import.meta.url;
const __dirname = path.dirname(fileURLToPath(MODULE_URL));
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

  if (request.method === "POST" && url.pathname === "/api/license/machine-id") {
    const body = await readJson(request);
    const machineId = createMachineIdFromTallySerial(body.tallySerialNumber || "");
    sendJson(response, 200, { ok: true, machineId });
    return true;
  }

  if (request.method === "POST" && url.pathname === "/api/license/activate") {
    const body = await readJson(request);
    try {
      const identity = await currentLicenseIdentity();
      await licenseService.activateFromContent(body.content || "", identity);
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
  let identity = null;
  try {
    await assertTallyConnected();
    const info = await assertTallyLicensedMode({ allowEducational: allowEducationalTallyMode() });
    if (info.educationalAllowed) {
      return {
        activated: true,
        expired: false,
        status: "educational_allowed",
        tallyConnected: true,
        tallyLicenseNumber: info.serialNumber || "EDUCATIONAL",
        message: "Tally educational mode is allowed for this local working build."
      };
    }
    identity = licenseIdentityFromTallyInfo(info);
  } catch (error) {
    if (error.status === "tally_educational") {
      return {
        activated: false,
        expired: false,
        status: "tally_educational",
        tallyConnected: true,
        message: error.message
      };
    }
    return {
      activated: false,
      expired: false,
      status: "tally_not_connected",
      tallyConnected: false,
      suppressLicenseBanner: true,
      message: error.message || "Tally is not connected. Open Tally Prime and try again."
    };
  }

  const status = await licenseService.getStatus(identity);
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

  if (request.method === "GET" && url.pathname === "/api/demo-mode/status") {
    sendJson(response, 200, { ok: true, demo: demoModeStatus() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/demo-mode/authenticate") {
    const body = await readJson(request);
    const token = authenticateDemoMode(body.password);
    if (!token) {
      sendJson(response, 401, { ok: false, message: "Incorrect Demo Mode password." });
      return;
    }
    sendJson(response, 200, { ok: true, token, demo: demoModeStatus() });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/demo-mode/toggle") {
    const body = await readJson(request);
    requireDemoSession(body.token);
    const demo = setDemoModeEnabled(Boolean(body.enabled));
    let seededQueue = [];
    if (demo.enabled) {
      resetDemoMode();
      const scope = body.scope || {};
      const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "Demo Company";
      const licenceCode = scope.clientId || configWithScope(scope).clientId || "DEMO-LICENCE";
      setDemoSeedBills(await buildDemoBillsFromTally(companyName, scope, licenceCode));
      clearDemoSathiOrderQueue(companyName, licenceCode);
      seededQueue = upsertSathiOrderQueue(companyName, licenceCode, "pendingOrders", demoSeedResponse({ ...scope, clientId: licenceCode }));
    }
    sendJson(response, 200, { ok: true, demo: demoModeStatus(), seededQueue });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/demo-mode/reset") {
    const body = await readJson(request);
    requireDemoSession(body.token);
    if (!isDemoModeEnabled()) {
      sendJson(response, 400, { ok: false, message: "Enable Demo Mode before resetting demo data." });
      return;
    }
    resetDemoMode();
    const scope = body.scope || {};
    const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "Demo Company";
    const licenceCode = scope.clientId || configWithScope(scope).clientId || "DEMO-LICENCE";
    setDemoSeedBills(await buildDemoBillsFromTally(companyName, scope, licenceCode));
    clearDemoSathiOrderQueue(companyName, licenceCode);
    const seededQueue = upsertSathiOrderQueue(companyName, licenceCode, "pendingOrders", demoSeedResponse({ ...scope, clientId: licenceCode }));
    sendJson(response, 200, { ok: true, demo: demoModeStatus(), seededQueue });
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
    const payload = await readJson(request);
    if (isDemoModeEnabled()) {
      await callDemoSaathi(response, "pendingOrders", payload, payload.scope || null);
      return;
    }
    await callSaathi(response, "pendingOrders", async (client, payload) => {
      const data = await client.getOrderDetailsByBuyerCode(payload);
      return normalizeOrders(data);
    }, payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/preview") {
    await requireApiLicense();
    const body = await readJson(request);
    if (isDemoModeEnabled()) {
      sendJson(response, 200, {
        ok: true,
        preview: {
          method: "LOCAL",
          url: `demo://sathi/${body.action || "request"}`,
          headers: { "X-Demo-Mode": "true" },
          body: body.payload || {}
        }
      });
      return;
    }
    sendJson(response, 200, { ok: true, preview: buildSaathiPreview(body.action, body.payload || {}, body.scope || null) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/call") {
    await requireApiLicense();
    const body = await readJson(request);
    if (isDemoModeEnabled()) await callDemoSaathi(response, body.action, body.payload || {}, body.scope || null);
    else await callSaathiAction(response, body.action, body.payload || {});
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/raw-call") {
    await requireApiLicense();
    const body = await readJson(request);
    if (isDemoModeEnabled()) await callDemoSaathi(response, body.action, body.requestBody || {}, body.scope || null, body.requestMeta || {});
    else await callSaathiRaw(response, body.action, body.requestHeaders || {}, body.requestBody || {}, body.scope || null, body.requestMeta || {});
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
      queue: visibleSathiQueue(listSathiOrderQueue({ companyName, licenceCode }))
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/stored-queue/status") {
    await requireApiLicense();
    const body = await readJson(request);
    const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
    const scope = body.scope || null;
    const licenceCode = body.licenceCode || scope?.clientId || configWithScope(scope).clientId || "";
    const row = markSathiOrderQueueStatus(companyName, licenceCode, body.voucherNumber, body.status, body.metadata || {});
    sendJson(response, row ? 200 : 404, {
      ok: Boolean(row),
      companyName,
      licenceCode,
      row,
      message: row ? "Stored SATHI queue status updated." : "Stored SATHI queue row was not found."
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sathi/pull-lot") {
    await requireApiLicense();
    const payload = await readJson(request);
    if (isDemoModeEnabled()) {
      await callDemoSaathi(response, "pullLot", payload, payload.scope || null);
      return;
    }
    await callSaathi(response, "pullLot", async (client, payload) => {
      const data = await client.pullLotDetailsByBuyerCode(payload);
      return { raw: data, rows: Array.isArray(data?.data) ? data.data : [] };
    }, payload);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/test") {
    await callTally(response);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/raw-xml") {
    await callTallyRawXml(response, await readJson(request));
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

  if (request.method === "POST" && url.pathname === "/api/tally/voucher-types") {
    await callTallyVoucherTypes(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/stock-items") {
    await callTallyStockItems(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/ledgers") {
    await callTallyLedgers(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/godowns") {
    await callTallyGodowns(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/portal-sales") {
    await callTallyPortalSales(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/batch-correction/candidates") {
    await callTallyBatchCorrectionCandidates(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/batch-correction/update") {
    await callTallyBatchCorrectionUpdate(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/sales-buyer-fields/update") {
    await callTallySalesBuyerFieldsUpdate(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/ledger-licence/update") {
    await callTallyLedgerLicenceUpdate(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/grn-lots") {
    await callTallyGrnLots(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/sathi-sales-sync-file/status") {
    await callSathiSalesSyncFileStatus(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/tally/sathi-sales-sync-file/rebuild") {
    await callRebuildSathiSalesSyncFile(response, await readJson(request));
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

  if (request.method === "POST" && url.pathname === "/api/reports/monthly-stock") {
    await callMonthlyStockReport(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/lot-trace") {
    await callLotTraceTool(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/grn-lots") {
    await callGrnLotReport(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/rojmel") {
    await callRojmelReport(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/batch-expiry") {
    await callBatchExpiryReport(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/advanced-pack") {
    await callAdvancedReportsPack(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/audit") {
    await callAuditReport(response, await readJson(request));
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports/bill-pdf") {
    await requireApiLicense();
    await callBillPdfTool(response, await readJson(request));
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

  if (request.method === "GET" && url.pathname === "/api/party-mappings") {
    const companyName = url.searchParams.get("companyName") || readEnv().TALLY_COMPANY_NAME || "";
    sendJson(response, 200, { ok: true, companyName, mappings: getPartyMappings(companyName) });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/party-mappings") {
    const body = await readJson(request);
    const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
    const mappings = body.mappings || (body.key ? { [body.key]: body.mapping || body.value || {} } : {});
    sendJson(response, 200, { ok: true, companyName, mappings: savePartyMappings(companyName, mappings) });
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
  await assertTallyConnected();
  const info = await assertTallyLicensedMode({ allowEducational: allowEducationalTallyMode() });
  if (info.educationalAllowed) {
    return {
      activated: true,
      status: "educational_allowed",
      message: "Tally educational mode is allowed for this local working build.",
      tallyLicenseNumber: info.serialNumber || "EDUCATIONAL"
    };
  }
  const status = await licenseService.requireActive(licenseIdentityFromTallyInfo(info));
  await assertRuntimeLicenseMatches(status);
  return status;
}

async function assertTallyConnected() {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.min(Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 5000), 10000)
  });
  try {
    await client.ensurePortReachable();
  } catch (error) {
    const connectionError = new Error(error.message || "Tally is not connected. Open Tally Prime and try again.");
    connectionError.status = "tally_not_connected";
    throw connectionError;
  }
}

async function assertTallyLicensedMode(options = {}) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.min(Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 5000), 10000)
  });
  const info = await client.fetchLicenseInfo();
  if (isEducationalTallyInfo(info)) {
    if (options.allowEducational) {
      return {
        ...info,
        serialNumber: info.serialNumber || "EDUCATIONAL",
        educationalAllowed: true
      };
    }
    const error = new Error("Tally is running in educational mode. Connect a licensed Tally first.");
    error.status = "tally_educational";
    throw error;
  }
  return info;
}

function allowEducationalTallyMode() {
  return true;
}

function isEducationalTallyInfo(info = {}) {
  const serial = normalizeLicenseValue(info.serialNumber || "");
  const attempts = Array.isArray(info.attempts) ? info.attempts : [];
  const raw = String(info.rawPreview || attempts.map((attempt) => attempt.rawPreview).join(" ") || "");
  if (/\b(EDU|EDUCATIONAL)\b/i.test(serial) || /\bEDUCATIONAL\s+MODE\b/i.test(raw)) return true;
  return !serial || serial === "0";
}

async function currentLicenseIdentity() {
  await assertTallyConnected();
  const info = await assertTallyLicensedMode();
  return licenseIdentityFromTallyInfo(info);
}

function licenseIdentityFromTallyInfo(info = {}) {
  const env = readEnv();
  const tallyLicenseNumber = normalizeLicenseValue(info.serialNumber || "");
  return {
    tallyLicenseNumber,
    machineId: createMachineIdFromTallySerial(tallyLicenseNumber),
    saathiClientId: env.SAATHI_CLIENT_ID || process.env.SAATHI_CLIENT_ID || ""
  };
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
  const tallySerialNumber = String(body.tallySerialNumber || "").trim();
  const machineId = String(body.machineId || "").trim() || createMachineIdFromTallySerial(tallySerialNumber);
  return {
    customerName: String(body.customerName || "").trim(),
    companyName: String(body.companyName || "").trim(),
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    sathiLicence: String(body.sathiLicence || "").trim(),
    tallySerialNumber,
    machineId,
    partnerId: String(body.partnerId || "").trim(),
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
    sathiLicence: "SATHI licence is required.",
    partnerId: "Partner ID is required."
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
    `Machine ID: ${request.machineId || "-"}`,
    `Partner ID: ${request.partnerId || "-"}`,
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
          ${activationEmailRow("Machine ID", request.machineId || "-")}
          ${activationEmailRow("Partner ID", request.partnerId || "-")}
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

function createMachineIdFromTallySerial(value) {
  const normalized = normalizeLicenseValue(value);
  if (!normalized) return "";
  const digest = crypto
    .createHash("sha256")
    .update(`sathi-connect:tally-serial:${normalized}`)
    .digest("base64url");
  return `${digest}`;
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
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 45000)
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

async function callTallyVoucherTypes(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";

  try {
    const result = await client.fetchVoucherTypes(companyName);
    sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "voucher-types", companyName });
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
    godownName: mergedEnv.TALLY_GODOWN_NAME || "",
    raw: {
      SATHI_API_KEY: mergedEnv.SAATHI_API_KEY || "",
      SATHI_CLIENT_ID: clientId,
      SATHI_CLIENT_SECRET: mergedEnv.SAATHI_CLIENT_SECRET || "",
      SATHI_OWNER_CODE: mergedEnv.SAATHI_DEFAULT_OWNER_CODE || clientId,
      SATHI_LOCATION_CODE: mergedEnv.SAATHI_DEFAULT_LOCATION_CODE || mergedEnv.SAATHI_DEFAULT_OWNER_CODE || clientId,
      SATHI_STATE_CODE: mergedEnv.SAATHI_DEFAULT_STATE_CODE || "",
      SATHI_BASE_URL: mergedEnv.SAATHI_BASE_URL || "",
      SATHI_TALLY_PURCHASE_LEDGER: mergedEnv.TALLY_PURCHASE_LEDGER_NAME || "",
      SATHI_TALLY_PURCHASE_GODOWN: mergedEnv.TALLY_GODOWN_NAME || ""
    }
  };

  const purchaseVoucherTypeName = mergedEnv.TALLY_VOUCHER_TYPE_NAME || "Purchase";
  const salesVoucherTypeName = mergedEnv.TALLY_SALES_VOUCHER_TYPE_NAME || "";
  const salesVoucherTypeNames = salesVoucherTypeName ? [salesVoucherTypeName] : [];
  const grnVoucherTypeName = mergedEnv.TALLY_GRN_VOUCHER_TYPE_NAME || "";
  const grnVoucherTypeNames = grnVoucherTypeName ? [grnVoucherTypeName] : [];
  return {
    companyName,
    licences: [{
      clientId,
      purchaseVoucherTypeName,
      salesVoucherTypeName,
      salesVoucherTypeNames,
      grnVoucherTypeName,
      grnVoucherTypeNames,
      fields,
      purchase: { name: purchaseVoucherTypeName, clientId, fields: fields.raw, scopeType: "purchase" },
      sales: salesVoucherTypeName ? { name: salesVoucherTypeName, clientId, fields: { SATHI_CLIENTID: clientId }, scopeType: "sales" } : null,
      grn: grnVoucherTypeName ? [{ name: grnVoucherTypeName, clientId, fields: fields.raw, scopeType: "grn" }] : [],
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

async function callTallyLedgers(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";

  try {
    const result = await client.fetchLedgers(companyName);
    const log = recordTallyLog("ledgers", "success", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: `${result.ledgers.length} Tally ledger(s) fetched for party mapping.`
    });
    sendJson(response, 200, { ok: true, ...result, log });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "ledgers", companyName });
    const log = recordTallyLog("ledgers", "failed", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyGodowns(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";

  try {
    const result = await client.fetchGodowns(companyName);
    const log = recordTallyLog("godowns", "success", {
      companyName,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: `${result.godowns.length} Tally godown(s) fetched.`
    });
    sendJson(response, 200, { ok: true, ...result, log });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "godowns", companyName });
    const log = recordTallyLog("godowns", "failed", {
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
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 45000)
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  const voucherTypeNames = resolveSalesVoucherTypeNames(body, env);
  const voucherTypeName = voucherTypeNames[0] || "Sales";

  try {
    const result = await client.fetchPortalSalesVouchersForTypes(companyName, voucherTypeNames, {
      fromDate: body.fromDate || "",
      toDate: body.toDate || ""
    }, {
      activeLicenceCode: body.scope?.clientId || "",
      licenceType: body.scope?.licenceType || "seed"
    });
    const portalLogs = listPortalPushReport({ companyName, demoMode: isDemoModeEnabled() });
    const purchaseVoucherTypeName = body.scope?.purchaseVoucherTypeName || env.TALLY_VOUCHER_TYPE_NAME || "Purchase";
    const purchaseTraceCache = new Map();
    const vouchers = await Promise.all(result.vouchers.map(async (voucher) => {
      const traces = safeFindLotTracesForSale(companyName, voucher.inventory || []);
      await fillMissingLotTracesFromTally(client, companyName, purchaseVoucherTypeName, voucher.inventory || [], traces, purchaseTraceCache);
      const portalLog = findPortalSyncMarker(portalLogs, voucher);
      return {
        ...voucher,
        sathiStatus: voucher.sathiStatus || portalLog?.status || "",
        sathiVchNo: voucher.sathiVchNo || portalLog?.sathiVoucherNumber || "",
        portalSyncSource: voucher.sathiStatus || voucher.sathiVchNo ? "tally-udf" : (portalLog ? "local-db" : ""),
        traces,
        originalOwner: firstOriginalOwner(traces) || firstInventoryOriginalOwner(voucher.inventory)
      };
    }));
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

async function callTallyBatchCorrectionCandidates(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
  });
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  try {
    const result = await client.fetchHistoricalBatchCandidates(companyName, {
      mode: body.mode,
      voucherTypeName: body.voucherTypeName,
      voucherTypeNames: body.voucherTypeNames,
      partyLedgerName: body.partyLedgerName,
      stockItemName: body.stockItemName,
      stockItemNames: body.stockItemNames,
      oldBatchName: body.oldBatchName,
      targetBatchName: body.targetBatchName,
      fromDate: body.fromDate,
      expectedQuantities: body.expectedQuantities,
      toDate: body.toDate
    });
    sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    const entry = recordError("Tally", error, {
      action: "batch-correction-candidates",
      companyName,
      mode: body.mode
    });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyBatchCorrectionUpdate(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
  });
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  try {
    const result = await client.alterVoucherBatch(companyName, body.change || body);
    const savedLotTraces = result.updated && String(body.change?.mode || body.mode || "").toLowerCase() === "purchase" && body.bill
      ? upsertLotTraces(companyName, body.bill, { itemMappings: body.itemMappings || {} })
      : [];
    if (savedLotTraces.length) await flushDbWrites();
    const log = recordTallyLog("batch-correction", result.updated ? "success" : "failed", {
      companyName,
      masterId: body.change?.masterId || body.masterId || "",
      voucherNumber: body.change?.voucherNumber || body.voucherNumber || "",
      mode: body.change?.mode || body.mode || "",
      message: result.message,
      summary: result.summary,
      verification: result.verification
    });
    sendJson(response, 200, { ok: true, ...result, savedLotTraces, log });
  } catch (error) {
    const entry = recordError("Tally", error, {
      action: "batch-correction-update",
      companyName,
      masterId: body.change?.masterId || body.masterId || ""
    });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallySalesBuyerFieldsUpdate(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
  });
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  try {
    const result = await client.alterVoucherBuyerFields(companyName, body.change || body);
    const log = recordTallyLog("sales-buyer-fields", result.updated ? "success" : "failed", {
      companyName,
      masterId: body.change?.masterId || body.masterId || "",
      voucherNumber: body.change?.voucherNumber || body.voucherNumber || "",
      message: result.message,
      summary: result.summary,
      verification: result.verification
    });
    sendJson(response, 200, { ok: true, ...result, log });
  } catch (error) {
    const entry = recordError("Tally", error, {
      action: "sales-buyer-fields-update",
      companyName,
      masterId: body.change?.masterId || body.masterId || ""
    });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyLedgerLicenceUpdate(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
  });
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  try {
    const result = await client.alterLedgerLicence(companyName, body);
    const log = recordTallyLog("ledger-licence", result.updated ? "success" : "failed", {
      companyName,
      ledgerName: body.ledgerName || "",
      kind: body.kind || "seed",
      message: result.message,
      summary: result.summary
    });
    sendJson(response, 200, { ok: true, ...result, log });
  } catch (error) {
    const entry = recordError("Tally", error, {
      action: "ledger-licence-update",
      companyName,
      ledgerName: body.ledgerName || ""
    });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

async function callTallyGrnLots(response, body) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
  });

  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  const scope = body.scope || null;
  const licenceCode = scope?.clientId || configWithScope(scope).clientId || "";
  const voucherTypeNames = [
    ...(Array.isArray(body.voucherTypeNames) ? body.voucherTypeNames : []),
    ...(Array.isArray(scope?.grnVoucherTypeNames) ? scope.grnVoucherTypeNames : []),
    body.voucherTypeName,
    body.tallyGrnVoucherTypeName,
    scope?.grnVoucherTypeName,
    env.TALLY_GRN_VOUCHER_TYPE_NAME
  ].map((name) => String(name || "").trim()).filter(Boolean);
  const uniqueVoucherTypeNames = [...new Set(voucherTypeNames)];
  const effectiveVoucherTypeNames = uniqueVoucherTypeNames.length ? uniqueVoucherTypeNames : ["Receipt Note"];

  try {
    const results = [];
    for (const voucherTypeName of effectiveVoucherTypeNames) {
      results.push(await client.fetchGrnLotRows(companyName, voucherTypeName));
    }
    const rows = results.flatMap((result) => result.rows || []);
    const savedRows = replaceGrnLotCache(companyName, licenceCode, rows);
    await flushDbWrites();
    const log = recordTallyLog("grn-lots", "success", {
      companyName,
      licenceCode,
      voucherTypeName: effectiveVoucherTypeNames.join(", "),
      voucherTypeNames: effectiveVoucherTypeNames,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: `${savedRows.length} GRN lot row(s) cached from Tally.`
    });
    sendJson(response, 200, {
      ok: true,
      companyName,
      licenceCode,
      voucherTypeName: effectiveVoucherTypeNames.join(", "),
      voucherTypeNames: effectiveVoucherTypeNames,
      rows: savedRows,
      count: savedRows.length,
      log
    });
  } catch (error) {
    const cachedRows = listGrnLotCache({ companyName, licenceCode });
    const entry = recordError("Tally", error, { action: "grn-lots", companyName, voucherTypeNames: effectiveVoucherTypeNames });
    const log = recordTallyLog("grn-lots", "failed", {
      companyName,
      licenceCode,
      voucherTypeName: effectiveVoucherTypeNames.join(", "),
      voucherTypeNames: effectiveVoucherTypeNames,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      cachedRows: cachedRows.length,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, error: entry, rows: cachedRows, count: cachedRows.length });
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
    const portalLogs = listPortalPushReport({ companyName, demoMode: isDemoModeEnabled() });
    const rows = result.vouchers.map((voucher) => {
      const traces = safeFindLotTracesForSale(companyName, voucher.inventory || []);
      const portalLog = findPortalSyncMarker(portalLogs, voucher);
      return {
        ...voucher,
        voucherTypeName: voucher.voucherTypeName || voucherTypeName,
        voucherTypeNames,
        buyerLicense: voucher.buyerLicense || "",
        traces,
        originalOwner: firstOriginalOwner(traces) || firstInventoryOriginalOwner(voucher.inventory),
        portalStatus: voucher.sathiStatus || portalLog?.status || "Not pushed",
        sathiVoucherNumber: voucher.sathiVchNo || portalLog?.sathiVoucherNumber || "",
        portalSyncSource: voucher.sathiStatus || voucher.sathiVchNo ? "tally-udf" : (portalLog ? "local-db" : ""),
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

async function callMonthlyStockReport(response, body) {
  const env = readEnv();
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  const scope = body.scope || null;
  const filters = {
    companyName,
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  };
  const voucherTypeNames = resolveSalesVoucherTypeNames(body, env);
  const purchaseRowsAll = listLotTraceReport({
    companyName,
    toDate: filters.toDate
  });
  const purchaseRowsInPeriod = listLotTraceReport(filters);
  const monthRows = new Map();
  let salesWarnings = [];

  for (const row of purchaseRowsAll) {
    const reportRow = monthlyStockRow(monthRows, row);
    const quantity = purchaseReportQuantity(row);
    if (isBeforeReportDate(row.inwardDate || row.updatedAt, filters.fromDate)) {
      reportRow.openingStock += quantity;
    } else if (isReportDateInRange(row.inwardDate || row.updatedAt, filters)) {
      reportRow.purchaseStock += quantity;
    }
    reportRow.purchaseAmount += isReportDateInRange(row.inwardDate || row.updatedAt, filters)
      ? Number(row.raw?.bill?.totalBillPrice || row.raw?.lot?.unitPrice || 0) || 0
      : 0;
  }

  try {
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: env.TALLY_TIMEOUT_MS
    });
    if (filters.fromDate) {
      const beforeSales = await client.fetchPortalSalesVouchersForTypes(companyName, voucherTypeNames, {
        toDate: previousDateValue(filters.fromDate)
      });
      applyMonthlySales(monthRows, beforeSales.vouchers || [], { opening: true });
    }
    const periodSales = await client.fetchPortalSalesVouchersForTypes(companyName, voucherTypeNames, filters);
    applyMonthlySales(monthRows, periodSales.vouchers || [], { opening: false });
  } catch (error) {
    salesWarnings.push(error.message || "Sales vouchers could not be loaded from Tally.");
  }

  const rows = [...monthRows.values()]
    .filter((row) => row.openingStock || row.purchaseStock || row.saleStock || row.exportStock)
    .map((row, index) => {
      const totalStock = row.openingStock + row.purchaseStock;
      const totalOutward = row.saleStock + row.exportStock;
      const closingStock = totalStock - totalOutward;
      return {
        srNo: index + 1,
        ...row,
        openingStock: roundStock(row.openingStock),
        purchaseStock: roundStock(row.purchaseStock),
        totalStock: roundStock(totalStock),
        saleStock: roundStock(row.saleStock),
        exportStock: roundStock(row.exportStock),
        totalOutward: roundStock(totalOutward),
        closingStock: roundStock(closingStock),
        purchaseAmount: roundStock(row.purchaseAmount),
        saleAmount: roundStock(row.saleAmount),
        remarks: row.remarks || (salesWarnings.length ? "Sales data warning" : "")
      };
    })
    .sort((a, b) =>
      String(a.cropName || "").localeCompare(String(b.cropName || ""))
      || String(a.varietyName || "").localeCompare(String(b.varietyName || ""))
      || String(a.lotNum || "").localeCompare(String(b.lotNum || ""))
    );

  sendJson(response, 200, {
    ok: true,
    report: "monthly-stock",
    companyName,
    licenceCode: scope?.clientId || configWithScope(scope).clientId || "",
    filters,
    voucherTypeNames,
    rows,
    count: rows.length,
    purchaseRows: purchaseRowsInPeriod.length,
    warnings: salesWarnings,
    generatedAt: new Date().toISOString()
  });
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
    demoMode: isDemoModeEnabled(),
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

async function callBillPdfTool(response, body) {
  const receiptNo = String(body.receiptNo || body.billNumber || body.voucherNumber || "").trim();
  if (!receiptNo) {
    sendJson(response, 400, { ok: false, message: "Bill number is required." });
    return;
  }

  const scopes = buildBillPdfScopes(body);
  const failures = [];

  try {
    for (const scope of scopes) {
      const config = configWithScope(scope);
      const client = new SaathiBillingClient(config);

      for (const mode of ["signed", "simple"]) {
        try {
          const result = mode === "signed"
            ? await client.getPdfByBillNumber({ receiptNo })
            : await client.getPdfByBillNumberSimple({ receiptNo });
          if (isUnauthorizedPdfResult(result)) {
            throw new Error("Unauthorized");
          }

          const pdf = normalizeBillPdfResult(result, receiptNo);
          sendJson(response, 200, {
            ok: true,
            report: "bill-pdf",
            receiptNo,
            pdf,
            authMode: mode,
            clientId: maskSecret(config.clientId || ""),
            status: result.status,
            contentType: result.contentType || "",
            generatedAt: new Date().toISOString()
          });
          return;
        } catch (error) {
          failures.push({
            clientId: config.clientId || "",
            mode,
            message: error.message
          });
        }
      }
    }

    throw new Error(cleanPdfFailureMessage(failures));
  } catch (error) {
    const entry = recordError("Reports", error, { action: "bill-pdf", receiptNo, failures });
    sendJson(response, 502, { ok: false, error: entry });
  }
}

function buildBillPdfScopes(body = {}) {
  const scopes = [];
  const seen = new Set();
  const add = (scope) => {
    if (!scope) return;
    const key = String(scope.clientId || scope.fields?.clientId || scope.fields?.ownerCode || JSON.stringify(scope)).trim().toUpperCase();
    if (seen.has(key)) return;
    seen.add(key);
    scopes.push(scope);
  };

  const candidates = Array.isArray(body.scopeCandidates) ? body.scopeCandidates : [];
  candidates.forEach(add);
  add(body.scope || null);
  if (!scopes.length) add(null);
  return scopes;
}

function isUnauthorizedPdfResult(result = {}) {
  const text = typeof result.data === "string" ? result.data : result.data?.message || "";
  return /unauthorized/i.test(String(text || ""));
}

function cleanPdfFailureMessage(failures = []) {
  const unauthorized = failures.find((failure) => /unauthorized/i.test(failure.message || ""));
  if (unauthorized) {
    return "SATHI PDF unauthorized for available licence credentials. Check whether this bill belongs to the selected SATHI licence.";
  }
  return failures[0]?.message || "SATHI bill PDF could not be loaded.";
}

function normalizeBillPdfResult(result = {}, receiptNo = "") {
  if (result.buffer?.length) {
    return saveBillPdfBuffer(receiptNo, result.buffer, result.contentType || "application/pdf");
  }

  const data = result.data;
  const candidate = findPdfCandidate(data);
  if (!candidate) {
    return {
      type: "json",
      message: data?.message || "PDF response received, but no PDF file was found in the response.",
      data: keepTechArtifacts() ? data : summarizePdfJson(data)
    };
  }

  if (candidate.type === "url") {
    return {
      type: "url",
      url: candidate.value,
      fileName: safeBillPdfName(receiptNo)
    };
  }

  const buffer = Buffer.from(stripDataUrl(candidate.value), "base64");
  return saveBillPdfBuffer(receiptNo, buffer, "application/pdf");
}

function saveBillPdfBuffer(receiptNo, buffer, contentType) {
  const fileName = safeBillPdfName(receiptNo);
  const outputDir = path.join(APP_ROOT, "data", "bill-pdfs");
  fs.mkdirSync(outputDir, { recursive: true });
  const filePath = path.join(outputDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    type: "pdf",
    fileName,
    filePath,
    contentType: contentType || "application/pdf",
    size: buffer.length,
    dataUrl: `data:application/pdf;base64,${buffer.toString("base64")}`
  };
}

function safeBillPdfName(receiptNo) {
  const clean = String(receiptNo || "sathi-bill").replace(/[^a-z0-9._-]/gi, "_").slice(0, 120);
  return `${clean || "sathi-bill"}.pdf`;
}

function findPdfCandidate(data) {
  if (!data) return null;
  if (typeof data === "string") {
    if (isLikelyUrl(data)) return { type: "url", value: data };
    if (isLikelyPdfBase64(data)) return { type: "base64", value: data };
    return null;
  }

  const stack = [data];
  const seen = new Set();
  const likelyKeys = new Set(["pdf", "pdfdata", "pdfbase64", "base64", "file", "filedata", "billpdf", "data"]);

  while (stack.length) {
    const current = stack.shift();
    if (!current || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    for (const [key, value] of Object.entries(current)) {
      const normalizedKey = key.toLowerCase();
      if (typeof value === "string") {
        if (isLikelyUrl(value) && normalizedKey.includes("url")) return { type: "url", value };
        if ((likelyKeys.has(normalizedKey) || normalizedKey.includes("pdf")) && isLikelyPdfBase64(value)) {
          return { type: "base64", value };
        }
      } else if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return null;
}

function isLikelyUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function isLikelyPdfBase64(value) {
  const clean = stripDataUrl(value).replace(/\s/g, "");
  return clean.startsWith("JVBER") || clean.length > 500;
}

function stripDataUrl(value) {
  return String(value || "").replace(/^data:application\/pdf;base64,/i, "").trim();
}

function summarizePdfJson(data) {
  if (!data || typeof data !== "object") return data;
  return {
    statusCode: data.statusCode,
    status: data.status,
    message: data.message,
    hasData: Boolean(data.data || data.response)
  };
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
    tallyPurchaseLedgerName: fields.SATHI_TALLY_PURCHASE_LEDGER,
    tallyGodownName: fields.SATHI_TALLY_PURCHASE_GODOWN
  });
}

async function callGrnLotReport(response, body) {
  const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
  const scope = body.scope || null;
  const licenceCode = body.licenceCode || scope?.clientId || configWithScope(scope).clientId || "";
  const rows = listGrnLotCache({
    companyName,
    licenceCode,
    lotNum: body.lotNum || "",
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  });

  sendJson(response, 200, {
    ok: true,
    report: "grn-lots",
    companyName,
    licenceCode,
    rows,
    count: rows.length,
    generatedAt: new Date().toISOString()
  });
}

async function callRojmelReport(response, body) {
  const env = readEnv();
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  const filters = {
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  };

  try {
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: env.TALLY_TIMEOUT_MS
    });
    const report = await client.fetchRojmelReport(companyName, filters, {
      rojmelLedgerMode: body.rojmelLedgerMode || "both",
      rojmelSearch: body.rojmelSearch || "",
      rojmelVoucherFilter: body.rojmelVoucherFilter || ""
    });
    sendJson(response, 200, {
      ok: true,
      report: "rojmel",
      companyName,
      filters,
      rows: report.displayRows || [],
      count: report.rows?.length || 0,
      totals: report.totals || {},
      sections: report.sections || [],
      charts: report.charts || {},
      sourceStats: report.sourceStats || {},
      generatedAt: report.generatedAt || new Date().toISOString()
    });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "rojmel-report", companyName });
    sendJson(response, 502, { ok: false, error: entry, rows: [], count: 0 });
  }
}

async function callBatchExpiryReport(response, body) {
  const env = readEnv();
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  const scope = body.scope || null;
  const filters = {
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  };

  try {
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: env.TALLY_TIMEOUT_MS
    });
    const report = await client.fetchBatchExpiryReport(companyName, filters, {
      purchaseVoucherTypeName: scope?.purchaseVoucherTypeName || configWithScope(scope).tallyVoucherTypeName || "",
      grnVoucherTypeNames: scope?.grnVoucherTypeNames || (scope?.grnVoucherTypeName ? [scope.grnVoucherTypeName] : []),
      salesVoucherTypeNames: scope?.salesVoucherTypeNames || (scope?.salesVoucherTypeName ? [scope.salesVoucherTypeName] : [])
    });
    sendJson(response, 200, {
      ok: true,
      report: "batch-expiry",
      companyName,
      filters,
      rows: report.rows || [],
      count: report.rows?.length || 0,
      summary: report.summary || {},
      groups: report.groups || [],
      buckets: report.buckets || [],
      generatedAt: report.generatedAt || new Date().toISOString()
    });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "batch-expiry-report", companyName });
    sendJson(response, 502, { ok: false, error: entry, rows: [], count: 0 });
  }
}

async function callAdvancedReportsPack(response, body) {
  const env = readEnv();
  const companyName = body.companyName || env.TALLY_COMPANY_NAME || "";
  const scope = body.scope || null;
  const filters = {
    fromDate: body.fromDate || "",
    toDate: body.toDate || ""
  };

  try {
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
    });
    const cfg = configWithScope(scope);
    const purchaseVoucherTypeName = scope?.purchaseVoucherTypeName || cfg.tallyVoucherTypeName || "";
    const salesVoucherTypeNames = uniqueCleanNames([
      ...(Array.isArray(scope?.salesVoucherTypeNames) ? scope.salesVoucherTypeNames : []),
      scope?.salesVoucherTypeName,
      cfg.tallySalesVoucherTypeName
    ]);
    const grnVoucherTypeNames = uniqueCleanNames([
      ...(Array.isArray(scope?.grnVoucherTypeNames) ? scope.grnVoucherTypeNames : []),
      scope?.grnVoucherTypeName
    ]);
    const licenceCode = scope?.clientId || cfg.clientId || "";
    const licenceType = scope?.licenceType || (scope?.isCottonLicence ? "cotton" : "seed");
    const [movementReport, salesResult] = await Promise.all([
      client.fetchBatchExpiryReport(companyName, filters, {
        purchaseVoucherTypeName,
        grnVoucherTypeNames,
        salesVoucherTypeNames
      }),
      salesVoucherTypeNames.length
        ? client.fetchPortalSalesVouchersForTypes(companyName, salesVoucherTypeNames, filters, {
          activeLicenceCode: licenceCode,
          licenceType
        })
        : Promise.resolve({ vouchers: [] })
    ]);

    const pack = buildAdvancedReportsPack({
      companyName,
      filters,
      scope: {
        ...scope,
        clientId: licenceCode,
        licenceType,
        purchaseVoucherTypeName,
        salesVoucherTypeNames,
        grnVoucherTypeNames
      },
      movementRows: movementReport.rows || [],
      salesVouchers: salesResult.vouchers || []
    });
    sendJson(response, 200, {
      ok: true,
      report: "advanced-pack",
      companyName,
      filters,
      ...pack,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "advanced-reports-pack", companyName });
    sendJson(response, 502, { ok: false, error: entry, pack: {}, count: 0 });
  }
}

function buildAdvancedReportsPack({ companyName = "", filters = {}, scope = {}, movementRows = [], salesVouchers = [] }) {
  const salesRows = advancedSalesRows(salesVouchers, scope);
  const lotRows = advancedLotTraceRows(movementRows, salesRows, scope);
  const licenceRows = advancedLicenceStockRows(lotRows, salesRows, scope);
  const expiryRows = advancedExpiryRiskRows(lotRows);
  const farmerDealerRows = advancedFarmerDealerRows(salesRows);
  return {
    pack: {
      companyName,
      filters,
      scope,
      lotTrace: {
        rows: lotRows,
        summary: advancedLotSummary(lotRows)
      },
      licenceStock: {
        rows: licenceRows,
        summary: advancedLicenceSummary(licenceRows)
      },
      expiryRisk: {
        rows: expiryRows,
        summary: advancedExpirySummary(expiryRows)
      },
      farmerDealerSales: {
        rows: farmerDealerRows,
        summary: advancedSalesSummary(farmerDealerRows)
      }
    },
    count: Math.max(lotRows.length, licenceRows.length, expiryRows.length, farmerDealerRows.length)
  };
}

function advancedSalesRows(vouchers = [], scope = {}) {
  const rows = [];
  for (const voucher of vouchers || []) {
    const buyerType = advancedBuyerType(voucher);
    for (const item of voucher.inventory || []) {
      const qty = roundStock(saleReportQuantity(item));
      const licenceNo = item.sathiCompanyLicenceNoS || voucher.activeLicenceCode || scope.clientId || "";
      const licenceType = item.sathiIsCottonS ? "COTTON" : "SEED";
      const pushed = Boolean(item.portalPushed);
      rows.push({
        key: advancedRowKey(voucher.voucherNumber, item.stockItemName, item.lotNum, item.portalOrderNo),
        voucherNumber: voucher.voucherNumber || voucher.reference || "",
        masterId: voucher.masterId || "",
        date: voucher.date || "",
        dateText: displayTallyDate(voucher.date || ""),
        voucherTypeName: voucher.voucherTypeName || "",
        partyName: voucher.partyName || voucher.partyLedgerName || "",
        partyLedgerName: voucher.partyLedgerName || voucher.partyName || "",
        partyNameLedgerFound: Boolean(voucher.partyNameLedgerFound),
        buyerType,
        buyerLicense: voucher.buyerLicense || voucher.buyerCottonLicense || "",
        cashFarmerSale: Boolean(voucher.cashFarmerSale),
        stockItemName: item.stockItemName || "",
        batchName: item.lotNum || "",
        sathiBatchNo: item.salesBatchNo || item.lotNum || "",
        originalOwner: item.originalOwner || "",
        packingSize: item.packingSize || "",
        licenceNo,
        licenceType,
        quantity: qty,
        quantityText: item.quantityText || "",
        rate: item.rate || "",
        amount: Math.abs(Number(cleanAmount(item.amount || voucher.amount || 0)) || 0),
        portalPushed: pushed,
        portalOrderNo: item.portalOrderNo || "",
        portalPushedAt: item.portalPushedAt || "",
        portalPushResult: item.portalPushResult || "",
        issues: advancedSalesIssues(voucher, item, licenceNo, pushed)
      });
    }
  }
  return rows;
}

function advancedLotTraceRows(movementRows = [], salesRows = [], scope = {}) {
  return (movementRows || []).map((row, index) => {
    const vouchers = row.vouchers || [];
    const inward = vouchers.filter((voucher) => voucher.movement !== "out");
    const outward = vouchers.filter((voucher) => voucher.movement === "out");
    const linkedSales = salesRows.filter((sale) => advancedSameItemBatch(sale.stockItemName, sale.batchName, row.stockItemName, row.batchName)
      || advancedSameItemBatch(sale.stockItemName, sale.sathiBatchNo, row.stockItemName, row.batchName));
    const soldQty = roundStock(linkedSales.reduce((sum, sale) => sum + Math.abs(Number(sale.quantity || 0)), 0) || row.outQty || 0);
    const inwardQty = roundStock(row.inQty || 0);
    const balanceQty = roundStock(Math.max(0, inwardQty - soldQty));
    const licenceNo = row.sathiCompanyLicenceNo || row.sathiCompanyLicenceNoS || linkedSales.find((sale) => sale.licenceNo)?.licenceNo || scope.clientId || "";
    const licenceType = row.sathiIsCotton || row.sathiIsCottonS || linkedSales.find((sale) => sale.licenceType === "COTTON") ? "COTTON" : "SEED";
    const issues = advancedLotIssues(row, inwardQty, soldQty, licenceNo);
    return {
      key: advancedRowKey(row.stockItemName, row.batchName, index),
      stockItemName: row.stockItemName || "",
      batchName: row.batchName || "",
      sathiBatchNo: row.salesBatchNo || row.batchName || "",
      originalOwner: row.originalOwner || inward.find((voucher) => voucher.originalOwner)?.originalOwner || linkedSales.find((sale) => sale.originalOwner)?.originalOwner || "",
      packingSize: row.packingSize || inward.find((voucher) => voucher.packingSize)?.packingSize || linkedSales.find((sale) => sale.packingSize)?.packingSize || "",
      licenceNo,
      licenceType,
      godownName: row.godownName || "",
      expiryDate: row.expiryDate || "",
      expiryDateText: row.expiryDateText || row.expiryDate || "",
      daysToExpiry: row.daysToExpiry,
      bucketKey: row.bucketKey || "",
      status: issues.length ? "Needs review" : balanceQty <= 0 ? "Fully sold" : "Open",
      statusTone: issues.length ? "warn" : balanceQty <= 0 ? "ok" : "busy",
      inwardQty,
      soldQty,
      balanceQty,
      inwardAmount: advancedVoucherAmount(inward),
      salesAmount: linkedSales.reduce((sum, sale) => sum + Number(sale.amount || 0), 0),
      purchaseVouchers: inward.map(advancedMovementVoucher),
      salesVouchers: linkedSales,
      otherOutwardVouchers: outward.map(advancedMovementVoucher),
      issues
    };
  }).filter((row) => row.stockItemName || row.batchName);
}

function advancedLicenceStockRows(lotRows = [], salesRows = [], scope = {}) {
  const map = new Map();
  for (const lot of lotRows || []) {
    const licenceNo = lot.licenceNo || scope.clientId || "Missing";
    const key = `${lot.licenceType || "SEED"}::${licenceNo}::${lot.stockItemName || "ITEM"}`;
    const current = map.get(key) || {
      key,
      licenceType: lot.licenceType || "SEED",
      licenceNo,
      stockItemName: lot.stockItemName || "",
      inwardQty: 0,
      soldQty: 0,
      balanceQty: 0,
      batches: [],
      issues: []
    };
    current.inwardQty += Number(lot.inwardQty || 0);
    current.soldQty += Number(lot.soldQty || 0);
    current.balanceQty += Number(lot.balanceQty || 0);
    current.batches.push(lot);
    current.issues.push(...(lot.issues || []));
    map.set(key, current);
  }
  return [...map.values()].map((row) => {
    const matchingSales = salesRows.filter((sale) => normalizeCode(sale.licenceNo) === normalizeCode(row.licenceNo)
      && normalizeCode(sale.stockItemName) === normalizeCode(row.stockItemName));
    return {
      ...row,
      inwardQty: roundStock(row.inwardQty),
      soldQty: roundStock(row.soldQty || matchingSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0)),
      balanceQty: roundStock(row.balanceQty),
      batchCount: row.batches.length,
      activeBatchCount: row.batches.filter((batch) => Number(batch.balanceQty || 0) > 0).length,
      mismatchCount: row.issues.length,
      status: row.issues.length ? "Needs review" : row.balanceQty > 0 ? "Active" : "Closed"
    };
  }).sort((a, b) => String(a.licenceNo).localeCompare(String(b.licenceNo)) || String(a.stockItemName).localeCompare(String(b.stockItemName)));
}

function advancedExpiryRiskRows(lotRows = []) {
  return [...(lotRows || [])]
    .filter((row) => Number(row.balanceQty || 0) > 0 || row.daysToExpiry !== null)
    .map((row) => {
      const days = Number(row.daysToExpiry);
      const movementSpeed = advancedRecentSaleSpeed(row.salesVouchers || []);
      const expectedClearDays = movementSpeed > 0 ? Math.ceil(Number(row.balanceQty || 0) / movementSpeed) : null;
      const risk = advancedExpiryRisk(row, expectedClearDays);
      return {
        ...row,
        movementSpeed,
        expectedClearDays,
        riskLevel: risk.level,
        riskText: risk.text,
        riskTone: risk.tone
      };
    }).sort((a, b) => (advancedRiskRank(a.riskLevel) - advancedRiskRank(b.riskLevel)) || ((a.daysToExpiry ?? 999999) - (b.daysToExpiry ?? 999999)));
}

function advancedFarmerDealerRows(salesRows = []) {
  const map = new Map();
  for (const row of salesRows || []) {
    const key = `${row.voucherNumber || "NO-VCH"}::${row.date || ""}`;
    const current = map.get(key) || {
      key,
      voucherNumber: row.voucherNumber,
      date: row.date,
      dateText: row.dateText,
      voucherTypeName: row.voucherTypeName,
      partyName: row.partyName,
      partyLedgerName: row.partyLedgerName,
      partyNameLedgerFound: row.partyNameLedgerFound,
      buyerType: row.buyerType,
      buyerLicense: row.buyerLicense,
      itemCount: 0,
      quantity: 0,
      amount: 0,
      uploadedRows: 0,
      pendingRows: 0,
      items: [],
      issues: []
    };
    current.itemCount += 1;
    current.quantity += Number(row.quantity || 0);
    current.amount += Number(row.amount || 0);
    if (row.portalPushed) current.uploadedRows += 1;
    else current.pendingRows += 1;
    current.items.push(row);
    current.issues.push(...(row.issues || []));
    map.set(key, current);
  }
  return [...map.values()].map((row) => ({
    ...row,
    quantity: roundStock(row.quantity),
    status: row.pendingRows > 0 && row.uploadedRows > 0 ? "Partial" : row.pendingRows > 0 ? "Pending" : "Uploaded",
    issueCount: row.issues.length
  })).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
}

function advancedLotSummary(rows = []) {
  return {
    lots: rows.length,
    inwardQty: roundStock(rows.reduce((sum, row) => sum + Number(row.inwardQty || 0), 0)),
    soldQty: roundStock(rows.reduce((sum, row) => sum + Number(row.soldQty || 0), 0)),
    balanceQty: roundStock(rows.reduce((sum, row) => sum + Number(row.balanceQty || 0), 0)),
    oversold: rows.filter((row) => row.soldQty > row.inwardQty).length,
    needsReview: rows.filter((row) => row.issues?.length).length
  };
}

function advancedLicenceSummary(rows = []) {
  return {
    licences: new Set(rows.map((row) => row.licenceNo).filter(Boolean)).size,
    items: rows.length,
    inwardQty: roundStock(rows.reduce((sum, row) => sum + Number(row.inwardQty || 0), 0)),
    soldQty: roundStock(rows.reduce((sum, row) => sum + Number(row.soldQty || 0), 0)),
    balanceQty: roundStock(rows.reduce((sum, row) => sum + Number(row.balanceQty || 0), 0)),
    mismatchCount: rows.reduce((sum, row) => sum + Number(row.mismatchCount || 0), 0)
  };
}

function advancedExpirySummary(rows = []) {
  return {
    rows: rows.length,
    expired: rows.filter((row) => row.riskLevel === "expired").length,
    days30: rows.filter((row) => row.riskLevel === "critical").length,
    days90: rows.filter((row) => row.riskLevel === "watch").length,
    safe: rows.filter((row) => row.riskLevel === "safe").length,
    balanceQty: roundStock(rows.reduce((sum, row) => sum + Number(row.balanceQty || 0), 0))
  };
}

function advancedSalesSummary(rows = []) {
  return {
    vouchers: rows.length,
    farmer: rows.filter((row) => row.buyerType === "FARMER/CASH").length,
    dealer: rows.filter((row) => row.buyerType === "DEALER").length,
    uploaded: rows.filter((row) => row.status === "Uploaded").length,
    partial: rows.filter((row) => row.status === "Partial").length,
    pending: rows.filter((row) => row.status === "Pending").length,
    quantity: roundStock(rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)),
    amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  };
}

function advancedBuyerType(voucher = {}) {
  const text = String(voucher.buyerPartyType || voucher.partyDetails?.partyType || voucher.voucherBuyerType || "").toUpperCase();
  if (voucher.cashFarmerSale || !voucher.partyNameLedgerFound) return "FARMER/CASH";
  if (/FARM/.test(text)) return "FARMER";
  return "DEALER";
}

function advancedSalesIssues(voucher = {}, item = {}, licenceNo = "", pushed = false) {
  const issues = [];
  if (!voucher.partyNameLedgerFound) issues.push("Party ledger not found; treated as farmer/cash sale.");
  if (!licenceNo) issues.push("Batch licence UDF missing.");
  if (!item.originalOwner) issues.push("Original owner missing.");
  if (!item.packingSize) issues.push("Packing missing.");
  if (!item.salesBatchNo && !item.lotNum) issues.push("SATHI batch/batch no missing.");
  if (!pushed) issues.push("Portal push pending for this row.");
  return issues;
}

function advancedLotIssues(row = {}, inwardQty = 0, soldQty = 0, licenceNo = "") {
  const issues = [];
  if (soldQty > inwardQty) issues.push("Sales quantity is greater than inward quantity.");
  if (!licenceNo) issues.push("Licence UDF missing.");
  if (!row.originalOwner) issues.push("Original owner missing.");
  if (!row.packingSize) issues.push("Packing missing.");
  if (!row.sathiCompanyLicenceNo && !row.sathiCompanyLicenceNoS) issues.push("Batch has no SATHI licence link.");
  return issues;
}

function advancedMovementVoucher(voucher = {}) {
  return {
    voucherNumber: voucher.voucherNumber || "",
    voucherTypeName: voucher.voucherTypeName || "",
    date: voucher.date || "",
    dateText: displayTallyDate(voucher.date || ""),
    partyLedgerName: voucher.partyLedgerName || "",
    quantity: roundStock(voucher.quantity || 0),
    quantityText: voucher.quantityText || "",
    rate: voucher.rate || "",
    amount: voucher.amount || "",
    portalPushed: Boolean(voucher.portalPushed),
    portalOrderNo: voucher.portalOrderNo || ""
  };
}

function advancedVoucherAmount(vouchers = []) {
  return vouchers.reduce((sum, voucher) => sum + Math.abs(Number(cleanAmount(voucher.amount || 0)) || 0), 0);
}

function advancedSameItemBatch(itemA, batchA, itemB, batchB) {
  return normalizeCode(itemA) === normalizeCode(itemB) && normalizeCode(batchA) === normalizeCode(batchB);
}

function advancedRowKey(...parts) {
  return parts.map((part) => normalizeCode(part || "x")).join("::");
}

function advancedRecentSaleSpeed(sales = []) {
  const dated = (sales || []).map((sale) => ({
    qty: Number(sale.quantity || 0),
    date: parseLocalReportDate(sale.date)
  })).filter((sale) => sale.date && sale.qty > 0);
  if (!dated.length) return 0;
  dated.sort((a, b) => a.date - b.date);
  const first = dated[0].date;
  const last = dated[dated.length - 1].date;
  const days = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / 86400000) + 1);
  return roundStock(dated.reduce((sum, sale) => sum + sale.qty, 0) / days);
}

function advancedExpiryRisk(row = {}, expectedClearDays = null) {
  const days = Number(row.daysToExpiry);
  if (Number.isFinite(days) && days < 0) return { level: "expired", text: "Already expired", tone: "danger" };
  if (Number.isFinite(days) && days <= 30) return { level: "critical", text: "0-30 days risk", tone: "danger" };
  if (Number.isFinite(days) && days <= 90) return { level: "watch", text: "31-90 days watch", tone: "busy" };
  if (expectedClearDays === null) return { level: "slow", text: "No recent sales speed", tone: "warn" };
  if (Number.isFinite(days) && expectedClearDays > days) return { level: "slow", text: "May not clear before expiry", tone: "warn" };
  return { level: "safe", text: "Safe", tone: "ok" };
}

function advancedRiskRank(value) {
  return { expired: 0, critical: 1, slow: 2, watch: 3, safe: 4 }[value] ?? 9;
}

function monthlyStockRow(rows, purchaseRow = {}, saleItem = {}) {
  const lotNum = purchaseRow.lotNum || saleItem.lotNum || "";
  const stockItemName = purchaseRow.stockItemName || saleItem.stockItemName || "";
  const key = `${lotNum || "NOLOT"}::${stockItemName || purchaseRow.portalItemName || "ITEM"}`.toUpperCase();
  if (!rows.has(key)) {
    const lot = purchaseRow.raw?.lot || {};
    rows.set(key, {
      key,
      cropName: lot.cropName || saleItem.cropName || "",
      varietyName: lot.varietyName || purchaseRow.portalItemName || stockItemName || "",
      seedType: lot.certificationClass || saleItem.certificationClass || "",
      lotNum,
      producerCompany: purchaseRow.supplierName || "",
      stockItemName,
      packingSize: purchaseRow.packingSize || saleItem.packingSize || lot.packingSize || "",
      packingUnit: lot.packingUnit || "kg",
      openingStock: 0,
      purchaseStock: 0,
      totalStock: 0,
      saleStock: 0,
      exportStock: 0,
      totalOutward: 0,
      closingStock: 0,
      purchaseAmount: 0,
      saleAmount: 0,
      remarks: ""
    });
  }
  const row = rows.get(key);
  if (!row.producerCompany && purchaseRow.supplierName) row.producerCompany = purchaseRow.supplierName;
  if (!row.cropName && purchaseRow.raw?.lot?.cropName) row.cropName = purchaseRow.raw.lot.cropName;
  if (!row.varietyName && purchaseRow.raw?.lot?.varietyName) row.varietyName = purchaseRow.raw.lot.varietyName;
  if (!row.seedType && purchaseRow.raw?.lot?.certificationClass) row.seedType = purchaseRow.raw.lot.certificationClass;
  if (!row.packingSize && purchaseRow.packingSize) row.packingSize = purchaseRow.packingSize;
  return row;
}

function applyMonthlySales(rows, vouchers = [], options = {}) {
  for (const voucher of vouchers || []) {
    for (const item of voucher.inventory || []) {
      const row = findMonthlyStockSaleRow(rows, item);
      if (!row) continue;
      const quantity = saleReportQuantity(item);
      if (options.opening) row.openingStock -= quantity;
      else {
        row.saleStock += quantity;
        row.saleAmount += Math.abs(Number(cleanAmount(item.amount || voucher.amount || 0)) || 0);
      }
    }
  }
}

function findMonthlyStockSaleRow(rows, item = {}) {
  const exactKey = `${item.lotNum || "NOLOT"}::${item.stockItemName || "ITEM"}`.toUpperCase();
  if (rows.has(exactKey)) return rows.get(exactKey);
  const lotKey = String(item.lotNum || "").trim().toUpperCase();
  if (!lotKey) return null;
  return [...rows.values()].find((row) => String(row.lotNum || "").trim().toUpperCase() === lotKey) || null;
}

function purchaseReportQuantity(row = {}) {
  const lot = row.raw?.lot || {};
  const packingSize = Number(lot.packingSize || row.packingSize || 0);
  const totalBags = Number(lot.totalBags || 0);
  if (Number.isFinite(packingSize) && packingSize > 0 && Number.isFinite(totalBags) && totalBags > 0) {
    return packingSize * totalBags;
  }
  const totalQty = Number(lot.totalQty ?? 0);
  return Number.isFinite(totalQty) ? totalQty * 100 : 0;
}

function saleReportQuantity(item = {}) {
  const qtl = Number(item.quantityQtl || 0);
  if (Number.isFinite(qtl) && qtl > 0) return qtl * 100;
  const quantityText = String(item.quantityText || item.billedQtyText || item.actualQtyText || "");
  const kgMatch = [...quantityText.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:kg|kgs|kilogram|kilograms)\b/gi)].pop();
  if (kgMatch) return Math.abs(Number(kgMatch[1]) || 0);
  const gmMatch = [...quantityText.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:gm|gms|gram|grams|g)\b/gi)].pop();
  if (gmMatch) return Math.abs((Number(gmMatch[1]) || 0) / 1000);
  const count = Math.abs(Number(item.quantity || 0) || 0);
  const packingSize = Number(item.packingSize || 0);
  return count && packingSize ? count * packingSize : count;
}

function cleanAmount(value) {
  return String(value || "").replace(/,/g, "").trim();
}

function isReportDateInRange(value, filters = {}) {
  const rowDate = parseLocalReportDate(value);
  const fromDate = parseLocalReportDate(filters.fromDate);
  const toDate = parseLocalReportDate(filters.toDate);
  if (!rowDate) return true;
  if (fromDate && rowDate < fromDate) return false;
  if (toDate && rowDate > toDate) return false;
  return true;
}

function isBeforeReportDate(value, fromDateValue) {
  const rowDate = parseLocalReportDate(value);
  const fromDate = parseLocalReportDate(fromDateValue);
  return Boolean(rowDate && fromDate && rowDate < fromDate);
}

function previousDateValue(value) {
  const date = parseLocalReportDate(value);
  if (!date) return "";
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function parseLocalReportDate(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const ymd = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) return new Date(`${ymd[1]}-${ymd[2]}-${ymd[3]}T12:00:00`);
  const tally = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (tally) return new Date(`${tally[1]}-${tally[2]}-${tally[3]}T12:00:00`);
  const dmy = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmy) return new Date(`${dmy[3]}-${dmy[2]}-${dmy[1]}T12:00:00`);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function roundStock(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return 0;
  return Number(number.toFixed(3));
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

async function callDemoSaathi(response, action, payload = {}, scope = null, requestMeta = {}) {
  try {
    const data = demoSaathiResponse(action, payload, scope || {});
    if (String(data.status || "").toLowerCase() !== "success") {
      const error = new Error(data.message || "Demo SATHI request failed.");
      error.status = "demo_request_failed";
      throw error;
    }

    const savedQueue = saveSathiQueueFromResponse(action, data, scope);
    const savedLotTraces = saveLotTracesFromSaathiResponse(action, data);
    const demoPayload = { ...payload, demoRecord: true };
    const tallyRequestBody = action === "createOrder" ? { ...demoPayload, ...(requestMeta || {}) } : demoPayload;
    const tallyStatusUpdate = action === "createOrder"
      ? await updateTallySathiFieldsAfterCreateOrder(tallyRequestBody, demoPayload, data, scope)
      : null;

    sendJson(response, 200, {
      ok: true,
      demoMode: true,
      action,
      raw: data,
      saved: null,
      savedQueue,
      savedLotTraces,
      tallyStatusUpdate,
      rows: Array.isArray(data.data) ? data.data : [],
      count: Array.isArray(data.data) ? data.data.length : 0,
      status: data.status || "",
      message: data.message || "",
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    const entry = recordError("Demo", error, { action });
    sendJson(response, 400, { ok: false, error: entry });
  }
}

async function buildDemoBillsFromTally(companyName, scope = {}, licenceCode = "DEMO-LICENCE") {
  const purchaseVoucherTypeNames = uniqueCleanNames([
    ...(Array.isArray(scope.purchaseVoucherTypeNames) ? scope.purchaseVoucherTypeNames : []),
    scope.purchaseVoucherTypeName
  ]);
  if (!companyName || !purchaseVoucherTypeNames.length) return defaultDemoBills(licenceCode);

  try {
    const env = readEnv();
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: Math.max(Number(env.TALLY_TIMEOUT_MS || 0), 30000)
    });
    const purchases = await client.fetchHistoricalBatchCandidates(companyName, {
      mode: "purchase",
      voucherTypeNames: purchaseVoucherTypeNames
    });
    const salesVoucherTypeNames = uniqueCleanNames([
      ...(Array.isArray(scope.salesVoucherTypeNames) ? scope.salesVoucherTypeNames : []),
      scope.salesVoucherTypeName
    ]);
    const sales = salesVoucherTypeNames.length
      ? await client.fetchHistoricalBatchCandidates(companyName, { mode: "sales", voucherTypeNames: salesVoucherTypeNames }).catch(() => ({ rows: [] }))
      : { rows: [] };
    const salesRows = Array.isArray(sales.rows) ? sales.rows : [];
    const purchaseRows = Array.isArray(purchases.rows) ? purchases.rows : [];
    const saleKeys = new Set(salesRows.map((row) => `${normalizeCode(row.stockItemName)}::${normalizeCode(row.batchName)}`));
    const rows = [...purchaseRows]
      .sort((a, b) => Number(saleKeys.has(`${normalizeCode(b.stockItemName)}::${normalizeCode(b.batchName)}`)) - Number(saleKeys.has(`${normalizeCode(a.stockItemName)}::${normalizeCode(a.batchName)}`)))
      .filter((row, index, all) => index === all.findIndex((entry) => `${entry.masterId}::${normalizeCode(entry.stockItemName)}::${normalizeCode(entry.batchName)}` === `${row.masterId}::${normalizeCode(row.stockItemName)}::${normalizeCode(row.batchName)}`))
      .slice(0, 10);

    return padDemoBillsToTen(
      rows.map((row, index) => demoBillFromTallyCandidate(row, index, licenceCode, saleKeys, companyName)),
      licenceCode
    );
  } catch (error) {
    debugError("demo.seed.tally.failed", error, { companyName });
    return defaultDemoBills(licenceCode);
  }
}

function padDemoBillsToTen(bills = [], licenceCode = "DEMO-LICENCE") {
  const cleaned = Array.isArray(bills) ? bills.filter(Boolean) : [];
  if (cleaned.length >= 10) return cleaned.slice(0, 10);
  const seen = new Set(cleaned.map((bill) => String(bill?.billNumber || "").trim().toUpperCase()).filter(Boolean));
  const filler = defaultDemoBills(licenceCode).filter((bill) => {
    const key = String(bill?.billNumber || "").trim().toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...cleaned, ...filler].slice(0, 10);
}

function demoBillFromTallyCandidate(row = {}, index, licenceCode, saleKeys, companyName) {
  const bags = Math.max(Math.abs(Number(row.quantity || 0)), 1);
  const packingSize = demoPackingSize(row.quantityText, bags);
  const rate = Math.abs(firstNumber(row.rate)) || Math.abs(firstNumber(row.amount)) / bags || 1;
  const total = Math.abs(firstNumber(row.amount)) || rate * bags;
  const oldBatch = String(row.batchName || `BATCH-${index + 1}`).trim();
  const stockItemName = String(row.stockItemName || `Demo Seed Item ${index + 1}`).trim();
  const hasOldBatchSale = saleKeys.has(`${normalizeCode(stockItemName)}::${normalizeCode(oldBatch)}`);
  return {
    totalBillPrice: String(Number(total.toFixed(2))),
    discountType: null,
    discount: 0,
    billNumber: `DEMO-HISTORY-${row.masterId || index + 1}`,
    billDate: displayTallyDate(row.date),
    sellerCode: `DEMO-OWNER-${String(index + 1).padStart(2, "0")}`,
    buyerCode: licenceCode,
    sellerName: row.partyLedgerName || "Demo Supplier",
    buyerName: String(companyName || "Demo Company").trim(),
    stateName: "Maharashtra",
    stateCode: "27",
    districtName: "",
    districtCode: "",
    blockName: "",
    pin: "",
    villageName: "",
    plotNo: "",
    sellerUserType: "DEALER",
    demoRecord: true,
    demoHistoricalMatch: true,
    demoOldBatch: oldBatch,
    demoOldBatchSale: hasOldBatchSale,
    lotData: [{
      lotNum: `SATHI-${oldBatch}`,
      cropName: "SEED",
      cropCode: "DEMO",
      varietyCode: stockItemName,
      varietyName: stockItemName,
      unitPrice: String(Number(rate.toFixed(2))),
      packingSize: String(Number(packingSize.toFixed(3))),
      packingUnit: "kg",
      totalBags: bags,
      totalQty: Number(((bags * packingSize) / 100).toFixed(3)),
      certificationClass: "CERTIFIED I",
      season: "DEMO",
      year: String(new Date().getFullYear()),
      expiryDate: displayDateAfter(240),
      tax: { cropRegCode: null, hsnCode: 1209, cgst: 0, sgst: 0, igst: 0 }
    }]
  };
}

function demoPackingSize(quantityText, bags) {
  const text = String(quantityText || "");
  const alt = text.match(/\(?\s*([\d,.]+)\s*(?:KGS?|KG)\s*\)?/i);
  const kilograms = alt ? Number(String(alt[1]).replaceAll(",", "")) : 0;
  return kilograms > 0 ? kilograms / bags : 1;
}

function firstNumber(value) {
  const match = String(value || "").replaceAll(",", "").match(/-?[\d.]+/);
  return match ? Number(match[0]) : 0;
}

function displayTallyDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : text;
}

function displayDateAfter(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date).replaceAll("/", "-");
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

async function callSaathiRaw(response, action, requestHeaders, requestBody, scope = null, requestMeta = {}) {
  try {
    const config = configWithScope(scope);
    const endpoint = getBillingEndpoint(action);
    const apiKey = required(config.apiKey, "SAATHI_API_KEY");
    const finalBody = action === "createOrder"
      ? finalizeCreateOrderBody(requestBody, config, apiKey)
      : finalizeEditableBody(requestBody, apiKey);
    const finalHeaders = finalizeEditableHeaders(requestHeaders, finalBody, config, apiKey);

    const apiResponse = await postJsonForSaathi(buildApiUrl(config.baseUrl, endpoint), {
      method: "POST",
      headers: finalHeaders,
      body: finalBody,
      timeoutMs: config.runtime.timeoutMs
    });

    const data = apiResponse.data;

    if (!apiResponse.ok) {
      throw new Error(`SATHI billing request failed: HTTP ${apiResponse.status} ${JSON.stringify(data)}`);
    }

    const saved = saveSathiResponse(action, {
      mode: "raw",
      url: buildApiUrl(config.baseUrl, endpoint).toString(),
      headers: maskHeaders(finalHeaders),
      body: finalBody
    }, data);
    const tallyRequestBody = action === "createOrder" ? { ...(requestBody || {}), ...(requestMeta || {}) } : requestBody;
    const tallyStatusUpdate = action === "createOrder" && isCreateOrderSuccess(data)
      ? await updateTallySathiFieldsAfterCreateOrder(tallyRequestBody, finalBody, data, scope)
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
    return { updated: false, skipped: true, fileBridge: null, message: "No source Tally voucher number available." };
  }

  const sathiVoucherNumber = extractSathiVoucherNumber(data);
  const status = data.status || data.message || "Success";
  recordPortalPush(companyName, { ...finalBody, sourceVoucherNumber }, data, status);

  try {
    const client = new TallyClient({
      url: env.TALLY_URL,
      timeoutMs: env.TALLY_TIMEOUT_MS
    });
    const sourcePortalRows = Array.isArray(requestBody.sourcePortalRows)
      ? requestBody.sourcePortalRows
      : (Array.isArray(finalBody.sourcePortalRows) ? finalBody.sourcePortalRows : []);
    if (sourcePortalRows.length) {
      const rowResult = await client.updateVoucherPortalPushRows(companyName, {
        voucherNumber: sourceVoucherNumber,
        voucherKey: requestBody.sourceVoucherKey || finalBody.sourceVoucherKey || "",
        remoteId: requestBody.sourceRemoteId || finalBody.sourceRemoteId || "",
        masterId: requestBody.sourceMasterId || finalBody.sourceMasterId || "",
        reference: requestBody.sourceReference || finalBody.sourceReference || "",
        date: requestBody.sourceVoucherDate || "",
        voucherTypeName: requestBody.sourceVoucherTypeName || finalBody.sourceVoucherTypeName || scope?.salesVoucherTypeName || env.TALLY_SALES_VOUCHER_TYPE_NAME || "Sales",
        sathiStatus: status,
        sathiVchNo: sathiVoucherNumber,
        rows: sourcePortalRows
      });
      recordTallyLog("sathi-portal-row-update", rowResult.updated ? "success" : "failed", {
        companyName,
        voucherNumber: sourceVoucherNumber,
        masterId: requestBody.sourceMasterId || finalBody.sourceMasterId || "",
        rowCount: sourcePortalRows.length,
        matchedRows: rowResult.matchedRows,
        verifiedRows: rowResult.verifiedRows,
        message: rowResult.message,
        summary: rowResult.summary
      });
      return stripTechnicalArtifacts(rowResult);
    }
    const result = await client.updateVoucherSathiFields(companyName, {
      voucherNumber: sourceVoucherNumber,
      voucherKey: requestBody.sourceVoucherKey || finalBody.sourceVoucherKey || "",
      remoteId: requestBody.sourceRemoteId || finalBody.sourceRemoteId || "",
      masterId: requestBody.sourceMasterId || finalBody.sourceMasterId || "",
      reference: requestBody.sourceReference || finalBody.sourceReference || "",
      date: requestBody.sourceVoucherDate || "",
      voucherTypeName: requestBody.sourceVoucherTypeName || finalBody.sourceVoucherTypeName || scope?.salesVoucherTypeName || env.TALLY_SALES_VOUCHER_TYPE_NAME || "Sales",
      sathiStatus: status,
      sathiVchNo: sathiVoucherNumber
    });
    recordTallyLog("sathi-status-update", result.updated ? "success" : "failed", {
      companyName,
      voucherNumber: sourceVoucherNumber,
      voucherKey: requestBody.sourceVoucherKey || finalBody.sourceVoucherKey || "",
      remoteId: requestBody.sourceRemoteId || finalBody.sourceRemoteId || "",
      masterId: requestBody.sourceMasterId || finalBody.sourceMasterId || "",
      message: result.updated ? `SATHI status updated: ${sathiVoucherNumber || status}` : "SATHI status update did not confirm success.",
      summary: result.summary,
      usedHelper: result.usedHelper,
      functionName: result.functionName,
      bridgeReport: result.bridgeReport,
      functionResult: result.functionResult
    });
    return stripTechnicalArtifacts(result);
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

async function callSathiSalesSyncFileStatus(response, body = {}) {
  try {
    const result = sathiSalesSyncFileStatus(body.scope || null);
    sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "sathi-sales-sync-file-status" });
    sendJson(response, 500, { ok: false, error: entry });
  }
}

async function callRebuildSathiSalesSyncFile(response, body = {}) {
  try {
    const companyName = body.companyName || readEnv().TALLY_COMPANY_NAME || "";
    const scope = body.scope || null;
    const result = rebuildSathiSalesSyncFile(companyName, scope);
    sendJson(response, 200, { ok: true, ...result });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "sathi-sales-sync-file-rebuild" });
    sendJson(response, 500, { ok: false, error: entry });
  }
}

async function writeSathiSalesSyncFileFromVoucher(companyName, scope, entry = {}) {
  try {
    const masterId = String(entry.masterId || "").trim();
    const sathiVoucherNumber = String(entry.sathiVoucherNumber || "").trim();
    if (!masterId || !sathiVoucherNumber) {
      return {
        updated: false,
        skipped: true,
        message: "Sales sync file needs Tally master ID and SATHI bill number."
      };
    }

    const filePath = resolveSathiSalesSyncFilePath(scope);
    if (!filePath) {
      return {
        updated: false,
        skipped: true,
        message: "SathiTxtFileLoc is not configured on mapped sales voucher type."
      };
    }

    const result = upsertSathiSalesSyncFile(filePath, [{ masterId, sathiVoucherNumber }]);
    recordTallyLog("sathi-sales-sync-file", "success", {
      companyName,
      voucherNumber: entry.sourceVoucherNumber || "",
      masterId,
      message: `SATHI sales sync file updated for ${sathiVoucherNumber}.`,
      filePath: result.filePath,
      lineCount: result.lineCount
    });
    return result;
  } catch (error) {
    const entryLog = recordError("Tally", error, { action: "sathi-sales-sync-file" });
    recordTallyLog("sathi-sales-sync-file", "failed", {
      companyName,
      message: error.message,
      error: entryLog
    });
    return { updated: false, error: entryLog };
  }
}

function rebuildSathiSalesSyncFile(companyName, scope) {
  const filePath = resolveSathiSalesSyncFilePath(scope);
  if (!filePath) {
    throw new Error("SathiTxtFileLoc is not configured on mapped sales voucher type.");
  }

  const activeLicence = normalizeId(scope?.clientId || "");
  const rows = listPortalPushReport({ companyName, demoMode: isDemoModeEnabled() })
    .filter((row) => row.tallyMasterId && row.sathiVoucherNumber)
    .filter((row) => isSuccessfulPortalPush(row.status, row.response))
    .filter((row) => {
      if (!activeLicence) return true;
      const payload = row.payload || {};
      return [payload.ownerCode, payload.locationCode, payload.sourceLicenceCode, payload.clientId]
        .map(normalizeId)
        .filter(Boolean)
        .includes(activeLicence);
    });

  const seen = new Set();
  const entries = [];
  for (const row of rows) {
    const masterId = String(row.tallyMasterId || "").trim();
    if (!masterId || seen.has(masterId)) continue;
    seen.add(masterId);
    entries.push({
      masterId,
      sathiVoucherNumber: String(row.sathiVoucherNumber || "").trim()
    });
  }

  const result = writeSathiSalesSyncFile(filePath, entries);
  recordTallyLog("sathi-sales-sync-file-rebuild", "success", {
    companyName,
    message: `${result.lineCount} SATHI sales sync entr${result.lineCount === 1 ? "y" : "ies"} rebuilt from local DB.`,
    filePath: result.filePath,
    lineCount: result.lineCount
  });
  return result;
}

function sathiSalesSyncFileStatus(scope) {
  const filePath = resolveSathiSalesSyncFilePath(scope);
  if (!filePath) {
    return {
      configured: false,
      exists: false,
      lineCount: 0,
      filePath: "",
      message: "SathiTxtFileLoc is not configured on mapped sales voucher type."
    };
  }

  const absolutePath = path.resolve(filePath);
  const exists = fs.existsSync(absolutePath);
  const lineCount = exists ? readSathiSalesSyncLines(absolutePath).length : 0;
  return {
    configured: true,
    exists,
    lineCount,
    filePath: absolutePath,
    message: exists ? `${lineCount} pending sync entr${lineCount === 1 ? "y" : "ies"} in file.` : "File will be created after first successful portal push."
  };
}

function resolveSathiSalesSyncFilePath(scope = {}) {
  const rawPath = firstText([
    readFieldCaseInsensitive(scope, "SathiTxtFileLoc"),
    readFieldCaseInsensitive(scope?.fields, "SathiTxtFileLoc"),
    readFieldCaseInsensitive(scope?.fields?.raw, "SathiTxtFileLoc"),
    ...arrayFields(scope?.sales).map((entry) => readFieldCaseInsensitive(entry?.fields, "SathiTxtFileLoc")),
    ...arrayFields(scope?.sales).map((entry) => readFieldCaseInsensitive(entry?.fields?.raw, "SathiTxtFileLoc")),
    ...arrayFields(scope?.salesScopes).map((entry) => readFieldCaseInsensitive(entry?.fields, "SathiTxtFileLoc"))
  ]);
  if (!rawPath) return "";

  const trimmed = rawPath.replace(/^"+|"+$/g, "").trim();
  if (!trimmed) return "";
  if (/\.txt$/i.test(trimmed)) return path.resolve(trimmed);
  const looksLikeFile = path.extname(trimmed) && !/[\\/]$/.test(trimmed);
  return path.resolve(looksLikeFile ? trimmed : path.join(trimmed, "SathiSales.txt"));
}

function upsertSathiSalesSyncFile(filePath, entries = []) {
  const absolutePath = path.resolve(filePath);
  const existing = readSathiSalesSyncLines(absolutePath);
  const byMasterId = new Map(existing.map((line) => [line.masterId, line]));
  for (const entry of entries) {
    const masterId = cleanSyncToken(entry.masterId);
    const sathiVoucherNumber = cleanSyncToken(entry.sathiVoucherNumber);
    if (!masterId || !sathiVoucherNumber) continue;
    byMasterId.set(masterId, { masterId, sathiVoucherNumber });
  }
  return writeSathiSalesSyncFile(absolutePath, [...byMasterId.values()]);
}

function writeSathiSalesSyncFile(filePath, entries = []) {
  const absolutePath = path.resolve(filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  const lines = entries
    .map((entry) => [cleanSyncToken(entry.masterId), cleanSyncToken(entry.sathiVoucherNumber)].filter(Boolean))
    .filter((parts) => parts.length === 2)
    .map((parts) => parts.join(" "));
  fs.writeFileSync(absolutePath, lines.length ? `${lines.join("\n")}\n` : "", "utf8");
  return {
    updated: true,
    filePath: absolutePath,
    lineCount: lines.length,
    message: `SATHI sales sync file updated with ${lines.length} entr${lines.length === 1 ? "y" : "ies"}.`
  };
}

function readSathiSalesSyncLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [masterId, sathiVoucherNumber] = line.split(/\s+/);
      return {
        masterId: cleanSyncToken(masterId),
        sathiVoucherNumber: cleanSyncToken(sathiVoucherNumber)
      };
    })
    .filter((line) => line.masterId && line.sathiVoucherNumber);
}

function cleanSyncToken(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function arrayFields(value) {
  return Array.isArray(value) ? value : [];
}

function readFieldCaseInsensitive(object = {}, key = "") {
  if (!object || typeof object !== "object") return "";
  const wanted = String(key || "").toLowerCase();
  const match = Object.keys(object).find((name) => name.toLowerCase() === wanted);
  return match ? String(object[match] || "").trim() : "";
}

function firstText(values = []) {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

function normalizeId(value) {
  return String(value || "").trim().toUpperCase();
}

function isSuccessfulPortalPush(status = "", response = {}) {
  const text = String(status || response?.status || response?.response?.status || "").toLowerCase();
  const statusCode = Number(response?.statusCode || response?.response?.statusCode || 0);
  return text.includes("success") || statusCode === 200;
}

function isCreateOrderSuccess(data = {}) {
  const statusCode = Number(data?.statusCode ?? data?.response?.statusCode ?? 0);
  const status = String(data?.status || data?.response?.status || "").trim().toLowerCase();
  const voucherNumber = extractSathiVoucherNumber(data);
  return statusCode === 200 || status === "success" || Boolean(voucherNumber);
}

function findPortalSyncMarker(portalLogs = [], voucher = {}) {
  const companyRows = portalLogs || [];
  const masterId = String(voucher.masterId || "").trim();
  if (masterId) {
    const byMasterId = companyRows.find((log) => String(log.tallyMasterId || "").trim() === masterId);
    if (byMasterId) return byMasterId;
    return null;
  }

  const voucherNumber = String(voucher.voucherNumber || voucher.reference || "").trim();
  const voucherTypeName = String(voucher.voucherTypeName || "").trim().toUpperCase();
  if (!voucherNumber || !voucherTypeName) return null;
  return companyRows.find((log) =>
    String(log.tallyVoucherNumber || "").trim() === voucherNumber
    && String(log.tallyVoucherType || "").trim().toUpperCase() === voucherTypeName
  ) || null;
}

async function callTally(response) {
  const env = readEnv();
  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  try {
    const result = await client.testConnection();
    const educationalMode = isEducationalTallyInfo(result.licenseInfo);
    if (educationalMode && !allowEducationalTallyMode()) {
      const error = new Error("Tally is running in educational mode. Connect a licensed Tally first.");
      error.status = "tally_educational";
      throw error;
    }
    const machineId = createMachineIdFromTallySerial(result.licenseSerialNumber || result.licenseInfo?.serialNumber || "");
    const payload = {
      ok: true,
      ...result,
      educationalMode,
      licenseSerialNumber: educationalMode ? result.licenseSerialNumber || result.licenseInfo?.serialNumber || "EDUCATIONAL" : result.licenseSerialNumber,
      machineId,
      checkedAt: new Date().toISOString()
    };
    const log = recordTallyLog("test-connection", "success", {
      companyName: env.TALLY_COMPANY_NAME || "",
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: educationalMode
        ? `${result.companies.length} company record(s) received from Tally educational mode.`
        : `${result.companies.length} company record(s) received from Tally.`,
      result: payload
    });
    sendJson(response, 200, { ...payload, log });
  } catch (error) {
    const entry = recordError("Tally", error, { url: env.TALLY_URL || "http://127.0.0.1:9000" });
    entry.status = error.status || "";
    const log = recordTallyLog("test-connection", "failed", {
      companyName: env.TALLY_COMPANY_NAME || "",
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: error.message,
      error: entry
    });
    entry.tallyLogId = log.id;
    sendJson(response, 502, { ok: false, status: error.status || "tally_error", error: entry });
  }
}

async function callTallyRawXml(response, body = {}) {
  const env = readEnv();
  const xml = String(body.xml || "").trim();
  if (!xml) {
    sendJson(response, 400, { ok: false, message: "Tally XML request is required." });
    return;
  }
  if (!/^<ENVELOPE[\s>]/i.test(xml)) {
    sendJson(response, 400, { ok: false, message: "XML must start with an ENVELOPE element." });
    return;
  }
  if (Buffer.byteLength(xml, "utf8") > 1024 * 1024) {
    sendJson(response, 400, { ok: false, message: "XML request is too large." });
    return;
  }

  const client = new TallyClient({
    url: env.TALLY_URL,
    timeoutMs: env.TALLY_TIMEOUT_MS
  });

  try {
    const tallyResponse = await client.request(xml);
    const failed = /<LINEERROR>|<ERRORMSG>|<ERRORS>[1-9]|Function Execution Failed/i.test(tallyResponse);
    const log = recordTallyLog("raw-xml-test", failed ? "failed" : "success", {
      companyName: body.companyName || env.TALLY_COMPANY_NAME || "",
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message: failed ? "Tally returned an XML error." : "Tally XML request completed."
    });
    sendJson(response, 200, {
      ok: true,
      tallyOk: !failed,
      accepted: true,
      failed,
      response: tallyResponse,
      sentAt: new Date().toISOString(),
      log
    });
  } catch (error) {
    const entry = recordError("Tally", error, { action: "raw-xml-test" });
    const log = recordTallyLog("raw-xml-test", "failed", {
      companyName: body.companyName || env.TALLY_COMPANY_NAME || "",
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
    const expectedRows = body.expectedRows || expectedTallyRowsForBill(body.bill, body.itemMappings || {});
    const result = await client.checkVoucherExists(
      companyName,
      voucherNumber,
      { expectedRows }
    );
    const status = result.exactMatch ? "verified" : result.partial ? "partial" : result.voucherFound ? "found" : "not-found";
    const message = result.exactMatch
      ? "SATHI voucher found and item/batch rows verified in Tally."
      : result.partial
        ? "SATHI voucher found in Tally, but item/batch verification is incomplete."
        : "SATHI voucher UDF was not found in Tally export.";
    const log = recordTallyLog("voucher-status", status, {
      companyName,
      voucherNumber,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message,
      result
    });
    sendJson(response, 200, { ok: true, ...result, status, message, log });
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
    const storedPartyMappings = getPartyMappings(companyName);
    const requestItemMappings = body.itemMappings || {};
    const requestPartyMappings = body.partyLedgerMappings || {};
    if (Object.keys(requestItemMappings).length) saveItemMappings(companyName, requestItemMappings);
    if (Object.keys(requestPartyMappings).length) savePartyMappings(companyName, requestPartyMappings);
    const mapping = {
      ...tallyMappingFromEnv(env),
      ...tallyMappingFromScope(body.scope),
      stockItems: normalizeStockItemCache(body.stockItems),
      itemMappings: {
        ...storedItemMappings,
        ...requestItemMappings
      },
      partyLedgerMappings: {
        ...storedPartyMappings,
        ...requestPartyMappings
      },
      grnMatches: resolveGrnMatchesForBill(companyName, body.scope?.clientId || "", body.bill, body.grnMatches)
    };
    if (body.godownName || body.godownOverride) mapping.godownName = body.godownName || body.godownOverride;
    const expectedRows = body.expectedRows || expectedTallyRowsForBill(body.bill, mapping.itemMappings);
    let preCheck = null;
    try {
      preCheck = await client.checkVoucherExists(companyName, billNumber, { expectedRows });
    } catch (checkError) {
      preCheck = { exists: false, error: checkError.message };
    }
    if (preCheck.exists) {
      const message = "SATHI voucher UDF already exists in Tally. Push skipped to prevent duplicate entry.";
      const savedLotTraces = upsertLotTraces(companyName, body.bill, mapping);
      await flushDbWrites();
      const log = recordTallyLog("push-voucher", "skipped-existing", {
        companyName,
        voucherNumber: billNumber,
        url: env.TALLY_URL || "http://127.0.0.1:9000",
        message,
        mapping,
        billSummary: summarizeBill(body.bill),
        expectedRows,
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
    if (preCheck.partial) {
      const message = "SATHI voucher found in Tally, but exact item/batch verification failed. Push skipped to prevent duplicate entry.";
      const log = recordTallyLog("push-voucher", "partial-existing", {
        companyName,
        voucherNumber: billNumber,
        url: env.TALLY_URL || "http://127.0.0.1:9000",
        message,
        mapping,
        billSummary: summarizeBill(body.bill),
        expectedRows,
        preCheck
      });
      sendJson(response, 200, {
        ok: true,
        imported: false,
        skipped: true,
        partialExists: true,
        verification: preCheck,
        message,
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
      verification = await client.checkVoucherExists(companyName, billNumber, { expectedRows });
    } catch (verifyError) {
      verification = { exists: false, error: verifyError.message };
    }

    const status = result.imported && verification?.exists ? "pushed-and-verified" : result.imported && verification?.partial ? "pushed-partial" : result.imported ? "pushed-not-verified" : "failed";
    const message = tallyPushMessage(result, verification);
    const savedLotTraces = result.imported ? upsertLotTraces(companyName, body.bill, mappingWithAction) : [];
    await flushDbWrites();
    const log = recordTallyLog("push-voucher", status, {
      companyName,
      voucherNumber: billNumber,
      url: env.TALLY_URL || "http://127.0.0.1:9000",
      message,
      mapping: mappingWithAction,
      billSummary: summarizeBill(body.bill),
      expectedRows,
      preCheck,
      masterResult: result.masterResult,
      importSummary: result.summary,
      savedLotTraces,
      lineErrors: result.lineErrors || [],
      verification
    });

    sendJson(response, 200, {
      ok: true,
      ...stripTechnicalArtifacts(result),
      verification,
      message,
      savedLotTraces,
      log
    });
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

function keepTechArtifacts() {
  return false;
}

function normalizeStockItemCache(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object" && String(item.name || "").trim())
    .map((item) => ({
      name: String(item.name || "").trim(),
      parent: String(item.parent || "").trim(),
      aliases: Array.isArray(item.aliases) ? item.aliases.map((alias) => String(alias || "").trim()).filter(Boolean) : [],
      baseUnits: String(item.baseUnits || "").trim(),
      additionalUnits: String(item.additionalUnits || "").trim(),
      conversion: item.conversion,
      denominator: item.denominator,
      hsnCode: String(item.hsnCode || "").trim(),
      hsnDetailsXml: String(item.hsnDetailsXml || ""),
      gstRate: Number(item.gstRate || 0),
      gstTaxability: String(item.gstTaxability || "").trim(),
      gstDetailsXml: String(item.gstDetailsXml || "")
    }));
}

function tallyPushMessage(result, verification) {
  const lineError = result.lineErrors?.find(Boolean);
  if (lineError) return lineError;
  if (result.summary?.errors > 0) return `Tally import returned ${result.summary.errors} error(s).`;
  if (result.imported && verification?.exists) return "Voucher imported and verified in Tally.";
  if (result.imported && verification?.partial) return "Voucher imported, but item/batch verification is incomplete.";
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

function expectedTallyRowsForBill(bill = {}, itemMappings = {}) {
  return (Array.isArray(bill.lotData) ? bill.lotData : [])
    .map((lot) => {
      const mappingKeys = [
        lot.varietyCode,
        lot.varietyName,
        lot.cropCode,
        lot.cropName,
        lot.lotNum,
        [lot.cropName, lot.varietyName].filter(Boolean).join(" ")
      ].map((value) => String(value || "").trim()).filter(Boolean);
      const mapped = mappingKeys
        .map((key) => itemMappings[key])
        .find((entry) => entry && (typeof entry === "string" || entry.tallyItemName));
      const stockItemName = typeof mapped === "string" ? mapped : mapped?.tallyItemName || lot.tallyItemName || lot.stockItemName || lot.varietyName || "";
      const batchName = lot.lotNum || "";
      if (!stockItemName || !batchName) return null;
      return {
        stockItemName,
        stockItemNames: [stockItemName, lot.stockItemName, lot.varietyName, lot.cropName].filter(Boolean),
        batchName,
        quantity: Number(lot.totalBags || lot.quantity || 0) || 0
      };
    })
    .filter(Boolean);
}

function tallyMappingFromEnv(env) {
  return {
    voucherTypeName: env.TALLY_VOUCHER_TYPE_NAME || "Purchase",
    purchaseLedgerName: env.TALLY_PURCHASE_LEDGER_NAME || "Purchase",
    partyMode: env.TALLY_PARTY_MODE || "sellerName",
    stockItemMode: env.TALLY_STOCK_ITEM_MODE || "varietyName",
    quantityMode: env.TALLY_QUANTITY_MODE || "totalBags",
    unitName: env.TALLY_UNIT_NAME || "Bag",
    entryType: env.TALLY_ENTRY_TYPE || "regular",
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
    activeLicenceCode: scope?.clientId,
    licenceType: scope?.licenceType || (scope?.isCottonLicence ? "cotton" : "seed"),
    voucherTypeName: scope?.purchaseVoucherTypeName,
    entryType: scope?.entryType || fields.entryType || raw.TALLY_ENTRY_TYPE,
    purchaseLedgerName: fields.purchaseLedgerName || raw.SATHI_TALLY_PURCHASE_LEDGER,
    godownName: fields.godownName || raw.SATHI_TALLY_PURCHASE_GODOWN
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
  let body;
  let signature;
  if (action === "createOrder") {
    body = finalizeCreateOrderBody(payload, config, config.apiKey || "");
    signature = createSignature(body, config.apiKey || "");
  } else {
    const finalPayload = normalizeSaathiPayload(action, payload, config);
    const signed = createSignedPayload(finalPayload, config.apiKey || "");
    body = signed.body;
    signature = signed.signature;
  }
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
  delete body.sourcePortalRows;

  return body;
}

function finalizeCreateOrderBody(requestBody, config, apiKey) {
  const base = finalizeEditableBody(requestBody, apiKey);
  const lotTypeStockDetails = Array.isArray(base.lotTypeStockDetails)
    ? base.lotTypeStockDetails.map((lot) => ({
      certificationClass: lot?.certificationClass || "",
      lotNum: lot?.lotNum || "",
      quantity: Number(lot?.quantity || 0),
      packingSize: lot?.packingSize || ""
    })).filter((lot) => lot.lotNum && lot.quantity > 0)
    : [];
  return {
    keyHash: base.keyHash,
    ts: base.ts,
    buyerCode: base.buyerCode || "",
    ownerCode: config.defaults.ownerCode || config.clientId || "",
    locationCode: config.defaults.locationCode || config.defaults.ownerCode || config.clientId || "",
    sellerRole: base.sellerRole || "DEALER",
    isRetailSell: base.isRetailSell || "N",
    buyerRole: base.buyerRole || "DEALER",
    discountType: base.discountType ?? null,
    discount: base.discount ?? null,
    saleType: base.saleType || "NORMAL",
    selfTransfer: base.selfTransfer || "N",
    spaCode: base.spaCode ?? null,
    lotTypeStockDetails,
    villageName: base.villageName || "",
    buyerStateCode: base.buyerStateCode || base.stateCode || config.defaults.stateCode || "",
    schemeId: base.schemeId ?? null,
    schemeName: base.schemeName ?? null,
    sector: base.sector ?? null,
    phoneNumber: base.phoneNumber || "",
    userName: base.userName || "",
    stateCode: base.stateCode || config.defaults.stateCode || "",
    blockCode: base.blockCode || "",
    districtCode: base.districtCode || "",
    villageCode: base.villageCode || "",
    stateName: base.stateName || "Maharashtra",
    blockName: base.blockName || "",
    districtName: base.districtName || ""
  };
}

function resolveCreateOrderBuyerName(requestBody = {}) {
  const direct = String(requestBody.buyerName || "").trim();
  if (direct) return direct;

  const rows = Array.isArray(requestBody.sourcePortalRows) ? requestBody.sourcePortalRows : [];
  for (const row of rows) {
    const name = String(row?.partyName || row?.partyLedgerName || "").trim();
    if (name) return name;
  }

  return "";
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

async function fillMissingLotTracesFromTally(client, companyName, purchaseVoucherTypeName, inventoryRows = [], traces = {}, cache = new Map()) {
  for (const item of inventoryRows || []) {
    const lotNum = String(item.lotNum || "").trim();
    if (!lotNum) continue;
    const exactKey = `${lotNum}::${item.stockItemName || ""}`;
    const lotOnlyKey = `${lotNum}::`;
    const current = traces[exactKey] || traces[lotOnlyKey];
    if (current?.originalOwner && current?.packingSize) continue;

    const cacheKey = `${companyName}::${purchaseVoucherTypeName}::${lotNum}`.toUpperCase();
    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, client.fetchPurchaseLotTrace(companyName, purchaseVoucherTypeName, lotNum)
        .then((result) => result.trace || null)
        .catch(() => null));
    }
    const trace = await cache.get(cacheKey);
    if (!trace) continue;

    traces[exactKey] = {
      ...trace,
      companyName,
      stockItemName: trace.stockItemName || item.stockItemName || "",
      lotNum
    };
    traces[lotOnlyKey] = traces[exactKey];
    item.originalOwner = item.originalOwner || trace.originalOwner || "";
    item.packingSize = item.packingSize || trace.packingSize || "";
  }
}

function safeFindLotTracesForSale(companyName, inventoryRows) {
  try {
    return findLotTracesForSale(companyName, inventoryRows);
  } catch {
    return {};
  }
}

function resolveGrnMatchesForBill(companyName, licenceCode, bill = {}, requestMatches = {}) {
  const lots = Array.isArray(bill?.lotData) ? bill.lotData : [];
  const lotNums = lots.map((lot) => String(lot.lotNum || "").trim()).filter(Boolean);
  const normalizedRequest = normalizeGrnMatches(requestMatches);
  const missingLotNums = lotNums.filter((lotNum) => !normalizedRequest[normalizeCode(lotNum)]?.length);

  let cachedMatches = {};
  if (missingLotNums.length) {
    try {
      cachedMatches = findGrnLotMatches(companyName, licenceCode, missingLotNums);
    } catch {
      cachedMatches = {};
    }
  }

  const resolved = {};
  for (const lotNum of lotNums) {
    const key = normalizeCode(lotNum);
    resolved[lotNum] = normalizedRequest[key] || cachedMatches[lotNum] || cachedMatches[key] || [];
  }
  return resolved;
}

function normalizeGrnMatches(value = {}) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([lotNum, rows]) => [
    normalizeCode(lotNum),
    Array.isArray(rows) ? rows : []
  ]));
}

function normalizeCode(value) {
  return String(value || "").trim().toUpperCase();
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
      apiKey: config.apiKey || "",
      ownerCode: config.defaults.ownerCode || config.clientId || "",
      locationCode: config.defaults.locationCode || config.defaults.ownerCode || config.clientId || "",
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
    SAATHI_APPLICABILITY_DATE: body.saathiApplicabilityDate,
    SAATHI_TIMEOUT_MS: body.saathiTimeoutMs,
    SAATHI_RETRY_COUNT: body.saathiRetryCount,
    TALLY_URL: body.tallyUrl,
    TALLY_COMPANY_NAME: body.tallyCompanyName,
    TALLY_TIMEOUT_MS: body.tallyTimeoutMs,
    TALLY_ENTRY_TYPE: body.tallyEntryType,
    TALLY_VOUCHER_TYPE_NAME: body.tallyVoucherTypeName,
    TALLY_SALES_VOUCHER_TYPE_NAME: body.tallySalesVoucherTypeName,
    TALLY_GRN_VOUCHER_TYPE_NAME: body.tallyGrnVoucherTypeName,
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

function visibleSathiQueue(queue = {}) {
  const demoMode = isDemoModeEnabled();
  const matchesMode = (row) => Boolean(row?.demoRecord) === demoMode;
  return {
    orders: (queue.orders || []).filter(matchesMode),
    lotBills: (queue.lotBills || []).filter(matchesMode)
  };
}

function stripTechnicalArtifacts(value) {
  if (Array.isArray(value)) return value.map(stripTechnicalArtifacts);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isTechnicalArtifactKey(key))
    .map(([key, nested]) => [key, stripTechnicalArtifacts(nested)]));
}

function isTechnicalArtifactKey(key) {
  const normalized = String(key || "").trim();
  const lower = normalized.toLowerCase();
  return [
    "xml",
    "xmlpreview",
    "requestxml",
    "tallyxml",
    "rawpreview",
    "stockitems",
    "response",
    "tallyresponse"
  ].includes(lower)
    || lower.includes("xml")
    || lower.includes("rawpreview")
    || lower.includes("responsepreview")
    || lower.includes("tallyresponse")
    || lower.includes("requestpreview");
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

function postJsonForSaathi(url, options) {
  return new Promise((resolve, reject) => {
    const bodyText = JSON.stringify(options.body || {});
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      method: options.method || "POST",
      headers: {
        Accept: "application/json",
        ...options.headers,
        "Content-Length": Buffer.byteLength(bodyText)
      },
      timeout: Number(options.timeoutMs || 30000)
    }, (apiResponse) => {
      const chunks = [];
      apiResponse.on("data", (chunk) => chunks.push(chunk));
      apiResponse.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = String(apiResponse.headers["content-type"] || "");
        const text = buffer.toString("utf8");
        let data = text;
        if (contentType.includes("application/json") && text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        resolve({
          status: apiResponse.statusCode || 0,
          ok: (apiResponse.statusCode || 0) >= 200 && (apiResponse.statusCode || 0) < 300,
          contentType,
          data
        });
      });
    });

    request.on("timeout", () => {
      request.destroy(new Error(`SATHI request timed out after ${options.timeoutMs || 30000} ms.`));
    });
    request.on("error", reject);
    request.write(bodyText);
    request.end();
  });
}

function buildApiUrl(baseUrl, endpoint) {
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return new URL(`${cleanBase}/${cleanEndpoint}`);
}

// function isMainModule() {
//   return path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url);
// }

function isMainModule() {
  return path.resolve(process.argv[1] || "") === fileURLToPath(MODULE_URL);
}
