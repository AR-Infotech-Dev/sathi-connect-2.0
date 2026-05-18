import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function createLicenseService(options = {}) {
  const licenseFile = path.resolve(options.licenseFile || "data/license.lic");
  const runtimeFile = path.resolve(options.runtimeFile || "data/license-runtime.json");
  const publicKeyFile = path.resolve(options.publicKeyFile || "keys/public.pem");
  const secret = options.secret || "AR-INFOTECH-LICENSE-GENERATOR-2026";
  const salt = options.salt || "ar-infotech-license-salt-v1";
  const clockRollbackToleranceMs = options.clockRollbackToleranceMs ?? 5 * 60 * 1000;
  const maxForwardJumpMs = options.maxForwardJumpMs ?? 366 * 24 * 60 * 60 * 1000;
  const debugLog = options.debugLog || (() => {});
  const debugError = options.debugError || (() => {});
  const getIdentityExtras = options.getIdentityExtras || (() => ({}));

  function getIdentity() {
    return {
      tallyLicenseNumber: "",
      saathiClientId: "",
      machineId: "",
      ...getIdentityExtras()
    };
  }

  function getMachineId() {
    const macAddress = getMacAddress();
    const source = [os.hostname(), macAddress].filter(Boolean).join("|");
    return source ? digest(source) : "";
  }

  function getMacAddress() {
    const interfaces = os.networkInterfaces();
    for (const entries of Object.values(interfaces)) {
      for (const entry of entries || []) {
        if (!entry.internal && entry.mac && entry.mac !== "00:00:00:00:00:00") {
          return entry.mac;
        }
      }
    }
    return "";
  }

  async function getStatus(identityOverride = null) {
    const identity = identityOverride || getIdentity();
    const rawLicense = readStoredLicenseText();
    debugLog("license.status.check", { hasStoredLicense: Boolean(rawLicense), ...identity });

    if (!rawLicense) {
      return makeStatus(identity, { activated: false, status: "not_activated", message: "License not activated." });
    }

    try {
      const clock = resolveTrustedClock();
      const verified = verifyLicenseText(rawLicense, identity, clock);
      return makeStatus(identity, { activated: true, status: "active", message: "License activated.", license: verified.license });
    } catch (error) {
      debugError("license.status.invalid", error, identity);
      const parsed = tryReadLicensePayload(rawLicense);
      return makeStatus(identity, {
        activated: false,
        expired: error.code === "expired",
        status: error.code || "invalid",
        message: error.message || "Stored license is invalid.",
        license: parsed?.license || {}
      });
    }
  }

  async function activateFromContent(content, identityOverride = null) {
    const identity = identityOverride || getIdentity();
    debugLog("license.import.verify.start", { contentLength: String(content || "").length, ...identity });
    const clock = resolveTrustedClock();
    verifyLicenseText(content, identity, clock);
    fs.mkdirSync(path.dirname(licenseFile), { recursive: true });
    fs.writeFileSync(licenseFile, String(content || ""), "utf8");
    debugLog("license.import.saved", { licenseFile });
    return getStatus();
  }

  async function clear() {
    if (fs.existsSync(licenseFile)) fs.unlinkSync(licenseFile);
    debugLog("license.clear", { licenseFile });
    return getStatus();
  }

  async function requireActive(identityOverride = null) {
    const status = await getStatus(identityOverride);
    if (!status.activated) {
      const error = new Error(status.message || (status.expired ? "License expired. Renew the license." : "License not activated."));
      error.statusCode = 403;
      error.licenseStatus = status;
      throw error;
    }
    return status;
  }

  function filterScopes(scopes = [], matchScope) {
    return getStatus().then((status) => {
      const ids = activeLicenseIds(status);
      if (!status.activated || !ids.length) return scopes;
      return scopes.filter((scope) => ids.some((id) => matchScope(scope, id)));
    });
  }

  function verifyLicenseText(rawLicense, identity = getIdentity(), clock = null) {
    const { file, payload } = parseLicenseFile(rawLicense);

    // if (identity.tallyLicenseNumber && payload.tallyLicense && String(payload.tallyLicense) !== String(identity.tallyLicenseNumber)) {
    //   throw licenseError("tally_mismatch", "This license does not match this Tally license number.");
    // }
    const payloadMachineId = payload.machineId || payload.machineID || payload.machine_id || "";
    if (payloadMachineId && identity.machineId && normalizeIdentityValue(payloadMachineId) !== normalizeIdentityValue(identity.machineId)) {
      throw licenseError("machine_mismatch", "This license does not match this machine ID.");
    }
    const trustedNow = clock?.now instanceof Date ? clock.now : new Date();
    const expiryDate = getEndOfLicenseDate(payload.endDate);
    if (!expiryDate) throw licenseError("invalid_expiry", "The license expiry date is invalid.");
    if (trustedNow > expiryDate) throw licenseError("expired", "License expired. Renew the license.");
    recordTrustedSeenAt(clock);

    return {
      activated: true,
      license: {
        licenseNumber: payload.licenseNumber || "",
        licenseNumbers: parseLicenseNumbers(payload.licenseNumber),
        tallyLicense: payload.tallyLicense || "",
        machineId: payloadMachineId,
        startDate: payload.startDate || "",
        endDate: payload.endDate || "",
        issuedAt: payload.issuedAt || "",
        issuer: payload.issuer || "",
        algorithm: file.algorithm || ""
      }
    };
  }

  function parseLicenseFile(rawLicense) {
    let file;
    try {
      file = JSON.parse(String(rawLicense || ""));
    } catch {
      throw licenseError("invalid_file", "The selected file is not a valid license file.");
    }
    if (file.type !== "AR_INFOTECH_LICENSE" || !file.licenseKey || !file.payloadHash) {
      throw licenseError("invalid_type", "The selected file is not an AR Infotech license.");
    }

    const [encodedIv, encryptedPayload, signature] = String(file.licenseKey).split(".");
    if (!encodedIv || !encryptedPayload || !signature) throw licenseError("invalid_format", "The license key format is invalid.");
    if (signature !== file.signature) throw licenseError("signature_mismatch", "The license signature does not match the license file.");

    const signData = `${encodedIv}.${encryptedPayload}.${file.payloadHash}`;
    const signatureOk = crypto.verify("sha256", Buffer.from(signData, "utf8"), getPublicKey(), fromBase64Url(signature));
    if (!signatureOk) throw licenseError("invalid_signature", "The license signature could not be verified.");

    const payload = decryptPayload(encodedIv, encryptedPayload);
    const payloadHash = digest(canonicalize(payload));
    if (payloadHash !== file.payloadHash) throw licenseError("payload_changed", "The license payload has been changed.");
    return { file, payload };
  }

  function tryReadLicensePayload(rawLicense) {
    try {
      const { file, payload } = parseLicenseFile(rawLicense);
      return {
        license: {
          licenseNumber: payload.licenseNumber || "",
          licenseNumbers: parseLicenseNumbers(payload.licenseNumber),
          tallyLicense: payload.tallyLicense || "",
          machineId: payload.machineId || payload.machineID || payload.machine_id || "",
          startDate: payload.startDate || "",
          endDate: payload.endDate || "",
          issuedAt: payload.issuedAt || "",
          issuer: payload.issuer || "",
          algorithm: file.algorithm || ""
        }
      };
    } catch {
      return null;
    }
  }

  function decryptPayload(encodedIv, encryptedPayload) {
    const encryptedBytes = fromBase64Url(encryptedPayload);
    if (encryptedBytes.length <= 16) throw licenseError("invalid_payload", "The license payload is invalid.");
    const authTag = encryptedBytes.subarray(encryptedBytes.length - 16);
    const ciphertext = encryptedBytes.subarray(0, encryptedBytes.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", crypto.pbkdf2Sync(secret, salt, 150000, 32, "sha256"), fromBase64Url(encodedIv));
    decipher.setAuthTag(authTag);
    try {
      return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"));
    } catch (error) {
      debugError("license.decrypt.failed", error);
      throw licenseError("decrypt_failed", "The license payload could not be decrypted.");
    }
  }

  function getPublicKey() {
    if (!fs.existsSync(publicKeyFile)) throw licenseError("missing_public_key", "License public key is missing.");
    return fs.readFileSync(publicKeyFile, "utf8");
  }

  function readStoredLicenseText() {
    if (!fs.existsSync(licenseFile)) return "";
    return fs.readFileSync(licenseFile, "utf8");
  }

  function resolveTrustedClock() {
    const runtime = readRuntime();
    const systemNow = Date.now();
    const lastVerifiedAt = Date.parse(runtime.lastVerifiedAt || runtime.lastSeenAt || "");

    if (systemNow + clockRollbackToleranceMs < lastVerifiedAt) {
      throw licenseError("clock_rollback", "System date/time was moved backward. Correct the date and time.");
    }
    if (Number.isFinite(lastVerifiedAt) && systemNow - lastVerifiedAt > maxForwardJumpMs) {
      throw licenseError("suspicious_forward_jump", "Date jumped too far ahead. Correct the date/time and verify again.");
    }
    return { now: new Date(systemNow), source: "system", online: false };
  }

  function recordTrustedSeenAt(clock = null) {
    const now = (clock?.now instanceof Date ? clock.now : new Date()).toISOString();
    const runtime = readRuntime();
    const lastSeenAt = Date.parse(runtime.lastSeenAt || "");
    const patch = {
      ...runtime,
      lastSeenAt: !Number.isFinite(lastSeenAt) || Date.parse(now) > lastSeenAt ? now : runtime.lastSeenAt,
      lastDateSource: clock?.source || runtime.lastDateSource || ""
    };
    patch.lastVerifiedAt = now;
    writeRuntime(patch);
  }

  function readRuntime() {
    if (!fs.existsSync(runtimeFile)) return {};
    try {
      return JSON.parse(fs.readFileSync(runtimeFile, "utf8"));
    } catch {
      return {};
    }
  }

  function writeRuntime(runtime) {
    fs.mkdirSync(path.dirname(runtimeFile), { recursive: true });
    fs.writeFileSync(runtimeFile, JSON.stringify(runtime, null, 2), "utf8");
  }

  return {
    getMachineId,
    getMacAddress,
    getIdentity,
    getStatus,
    activateFromContent,
    clear,
    requireActive,
    verifyLicenseText,
    filterScopes
  };
}

export function activeLicenseIds(status = {}) {
  const values = Array.isArray(status.licenseNumbers) && status.licenseNumbers.length
    ? status.licenseNumbers
    : String(status.licenseNumber || status.saathiClientId || "").split(",");
  return values.map((item) => String(item || "").trim().toUpperCase()).filter(Boolean);
}

function makeStatus(identity, result = {}) {
  const license = result.license || {};
  const licenseNumbers = Array.isArray(license.licenseNumbers) ? license.licenseNumbers : parseLicenseNumbers(license.licenseNumber);
  return {
    ...identity,
    activated: Boolean(result.activated),
    expired: Boolean(result.expired || result.status === "expired"),
    status: result.status || "invalid",
    message: result.message || "",
    expiresAt: license.endDate || "",
    activatedAt: license.issuedAt || "",
    customerName: license.issuer || "",
    licenseNumber: license.licenseNumber || "",
    licenseNumbers,
    saathiClientId: license.licenseNumber || identity.saathiClientId || "",
    tallyLicenseNumber: license.tallyLicense || identity.tallyLicenseNumber || "",
    machineId: license.machineId || identity.machineId || "",
    license: { ...license, licenseNumbers }
  };
}

function getEndOfLicenseDate(dateValue) {
  if (!dateValue) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? `${dateValue}T23:59:59.999` : dateValue;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseLicenseNumbers(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function digest(value) {
  return toBase64Url(crypto.createHash("sha256").update(value).digest());
}

function normalizeIdentityValue(value) {
  return String(value || "").replace(/\s+/g, "").trim().toUpperCase();
}

function canonicalize(value) {
  return JSON.stringify(Object.keys(value).sort().reduce((acc, key) => {
    acc[key] = value[key];
    return acc;
  }, {}));
}

function toBase64Url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  return Buffer.from(normalized + padding, "base64");
}

function licenseError(code, message) {
  const error = new Error(message);
  error.code = code;
  error.status = code;
  return error;
}
