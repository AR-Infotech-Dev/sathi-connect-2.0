import crypto from "node:crypto";

export function createSignedPayload(payload, apiKey, timestamp = Date.now()) {
  const body = {
    ...payload,
    keyHash: createKeyHash(apiKey, timestamp),
    ts: timestamp
  };

  return {
    body,
    signature: createSignature(body, apiKey)
  };
}

export function createKeyHash(apiKey, timestamp) {
  return crypto
    .createHash("sha512")
    .update(`${apiKey}${timestamp}`)
    .digest("hex");
}

export function createSignature(body, apiKey) {
  return crypto
    .createHmac("sha512", apiKey)
    .update(JSON.stringify(body))
    .digest("hex");
}

export function resolveClientSecret(secret, mode = "plain") {
  if (!secret) return "";
  if (mode !== "sha512") return secret;

  return crypto
    .createHash("sha512")
    .update(secret)
    .digest("hex");
}
