import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { createSignedPayload, resolveClientSecret } from "./saathi-signing.js";

export const BILLING_PATHS = {
  pendingOrders: "/billing/getOrderDetailsByBuyerCode",
  pullLot: "/billing/pullLotDetailsByBuyerCode",
  fetchLot: "/billing/fetchLotDetailsByBuyerCode",
  createOrder: "/billing/createSathiOrder",
  billPdf: "/billing/getPdfByBillNumber",
  viewBill: "/billing/viewBill",
  billData: "/billing/getBillDataByBillNumber"
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

  async getPdfByBillNumber(payload = {}) {
    return this.postSignedRaw(BILLING_PATHS.billPdf, {
      receiptNo: this.required(payload.receiptNo || payload.billNumber || payload.voucherNumber, "receiptNo"),
      apiKey: payload.apiKey || this.config.apiKey
    });
  }

  async getPdfByBillNumberSimple(payload = {}) {
    return this.postRaw(BILLING_PATHS.billPdf, {
      receiptNo: this.required(payload.receiptNo || payload.billNumber || payload.voucherNumber, "receiptNo"),
      apiKey: payload.apiKey || this.config.apiKey
    });
  }

  async getBillDataByBillNumber(payload = {}) {
    return this.postSigned(BILLING_PATHS.billData, {
      voucherNumber: this.required(payload.voucherNumber || payload.billNumber || payload.receiptNo, "voucherNumber")
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

  async postSignedRaw(endpoint, payload) {
    const { body, signature } = createSignedPayload(
      payload,
      this.required(this.config.apiKey, "SAATHI_API_KEY")
    );

    return this.requestRaw(endpoint, {
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
  }

  async postRaw(endpoint, payload) {
    return this.requestRaw(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: payload
    });
  }

  async request(endpoint, options) {
    const url = buildApiUrl(this.config.baseUrl, endpoint);
    const response = await withRetries(
      () => postJson(url, {
        method: options.method,
        headers: {
          Accept: "application/json",
          ...options.headers
        },
        body: options.body,
        timeoutMs: this.config.runtime.timeoutMs
      }),
      this.config.runtime.retryCount
    );

    if (!response.ok) {
      throw new Error(`SATHI billing request failed: HTTP ${response.status} ${JSON.stringify(response.data)}`);
    }

    return {
      status: response.status,
      data: response.data
    };
  }

  async requestRaw(endpoint, options) {
    const url = buildApiUrl(this.config.baseUrl, endpoint);
    const response = await withRetries(
      () => postJson(url, {
        method: options.method,
        headers: {
          Accept: "application/pdf,application/json,text/plain,*/*",
          ...options.headers
        },
        body: options.body,
        timeoutMs: this.config.runtime.timeoutMs
      }),
      this.config.runtime.retryCount
    );

    if (!response.ok) {
      const text = response.buffer.toString("utf8");
      throw new Error(`SATHI billing request failed: HTTP ${response.status} ${text}`);
    }

    if (response.contentType.includes("application/json")) {
      return {
        status: response.status,
        contentType: response.contentType,
        data: response.data
      };
    }

    return {
      status: response.status,
      contentType: response.contentType,
      buffer: response.buffer
    };
  }

  required(value, name) {
    if (value === undefined || value === null || value === "") {
      throw new Error(`${name} is required.`);
    }

    return value;
  }
}

function postJson(url, options) {
  return new Promise((resolve, reject) => {
    const bodyText = JSON.stringify(options.body || {});
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      method: options.method || "POST",
      headers: {
        ...options.headers,
        "Content-Length": Buffer.byteLength(bodyText)
      },
      timeout: Number(options.timeoutMs || 30000)
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const contentType = response.headers["content-type"] || "";
        const text = buffer.toString("utf8");
        let data = text;
        if (String(contentType).includes("application/json") && text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }

        resolve({
          status: response.statusCode || 0,
          ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
          contentType: String(contentType),
          buffer,
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
