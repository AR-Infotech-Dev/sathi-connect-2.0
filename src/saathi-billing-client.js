import fs from "node:fs";
import path from "node:path";
import { createSignedPayload, resolveClientSecret } from "./saathi-signing.js";

export const BILLING_PATHS = {
  pendingOrders: "/billing/getOrderDetailsByBuyerCode",
  pullLot: "/billing/pullLotDetailsByBuyerCode",
  fetchLot: "/billing/fetchLotDetailsByBuyerCode",
  createOrder: "/billing/createSathiOrder"
};

export class SaathiBillingClient {
  constructor(config) {
    this.config = config;
  }

  async getOrderDetailsByBuyerCode(payload = {}) {
    return this.postSigned(BILLING_PATHS.pendingOrders, {
      ownerCode: this.required(payload.ownerCode || this.config.defaults.ownerCode, "ownerCode"),
      stateCode: payload.stateCode || this.config.defaults.stateCode
    });
  }

  async pullLotDetailsByBuyerCode(payload = {}) {
    return this.lotDetails(BILLING_PATHS.pullLot, payload);
  }

  async fetchLotDetailsByBuyerCode(payload = {}) {
    return this.lotDetails(BILLING_PATHS.fetchLot, payload);
  }

  async createSathiOrder(payload) {
    if (!payload || Object.keys(payload).length === 0) {
      throw new Error("createSathiOrder requires a JSON payload.");
    }

    return this.postSigned(BILLING_PATHS.createOrder, {
      ...payload,
      apiKey: payload.apiKey || this.config.apiKey
    });
  }

  async exportResponse(name, response, outputDir = "data") {
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const filePath = path.resolve(outputDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(response, null, 2));

    return { filePath, statusCode: response.statusCode, status: response.status };
  }

  async lotDetails(endpoint, payload = {}) {
    return this.postSigned(endpoint, {
      voucherNumber: this.required(payload.voucherNumber, "voucherNumber"),
      ownerCode: this.required(payload.ownerCode || this.config.defaults.ownerCode, "ownerCode"),
      stateCode: payload.stateCode || this.config.defaults.stateCode,
      locationCode: this.required(
        payload.locationCode || this.config.defaults.locationCode || payload.ownerCode,
        "locationCode"
      )
    });
  }

  async postSigned(endpoint, payload) {
    const { body, signature } = createSignedPayload(
      payload,
      this.required(this.config.apiKey, "SAATHI_API_KEY")
    );

    const response = await this.request(endpoint, {
      method: "POST",
      headers: {
        clientid: this.required(this.config.clientId, "SAATHI_CLIENT_ID"),
        clientsecret: this.required(
          resolveClientSecret(this.config.clientSecret, this.config.clientSecretMode),
          "SAATHI_CLIENT_SECRET"
        ),
        signature,
        "Content-Type": "application/json"
      },
      body
    });

    return response.data;
  }

  async request(endpoint, options) {
    const url = buildApiUrl(this.config.baseUrl, endpoint);
    const init = {
      method: options.method,
      headers: {
        Accept: "application/json",
        ...options.headers
      },
      body: JSON.stringify(options.body),
      signal: AbortSignal.timeout(this.config.runtime.timeoutMs)
    };

    const response = await withRetries(
      () => fetch(url, init),
      this.config.runtime.retryCount
    );

    const data = await parseResponse(response);
    return {
      status: response.status,
      data
    };
  }

  required(value, name) {
    if (value === undefined || value === null || value === "") {
      throw new Error(`${name} is required.`);
    }

    return value;
  }
}

async function parseResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") && text ? JSON.parse(text) : text;

  if (!response.ok) {
    throw new Error(`SATHI billing request failed: HTTP ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

async function withRetries(operation, retryCount) {
  let lastError;

  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === retryCount) break;
      await sleep(500 * (attempt + 1));
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildApiUrl(baseUrl, endpoint) {
  const cleanBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  return new URL(`${cleanBase}/${cleanEndpoint}`);
}
