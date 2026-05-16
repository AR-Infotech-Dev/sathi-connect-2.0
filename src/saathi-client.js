import fs from "node:fs";
import path from "node:path";
import { firstByPaths, getByPath } from "./json-path.js";

export class SaathiClient {
  constructor(config) {
    this.config = config;
    this.token = "";
    this.cookie = "";
  }

  async login() {
    const { login } = this.config;

    if (!login.username || !login.password) {
      throw new Error("SAATHI_USERNAME and SAATHI_PASSWORD are required for login.");
    }

    const body = {
      ...login.extraFields,
      [login.usernameField]: login.username,
      [login.passwordField]: login.password
    };

    const response = await this.request(login.path, {
      method: login.method,
      body,
      skipAuth: true
    });

    this.captureAuth(response);

    return {
      authenticated: Boolean(this.token || this.cookie || this.config.auth.apiKey),
      tokenDetected: Boolean(this.token),
      cookieDetected: Boolean(this.cookie),
      response: response.data
    };
  }

  async fetchResource(resourceName, params = {}) {
    const resource = this.config.resources[resourceName];
    if (!resource) {
      const names = Object.keys(this.config.resources).join(", ") || "none configured";
      throw new Error(`Unknown resource "${resourceName}". Available resources: ${names}`);
    }

    const allItems = [];
    let page = resource.pagination?.startPage || 1;
    let keepGoing = true;

    while (keepGoing) {
      const requestParams = { ...params };

      if (resource.pagination?.type === "page") {
        requestParams[resource.pagination.pageParam || "page"] = page;
        if (resource.pagination.pageSizeParam) {
          requestParams[resource.pagination.pageSizeParam] = resource.pagination.pageSize || 100;
        }
      }

      const response = await this.request(resource.path, {
        method: resource.method || "GET",
        query: requestParams
      });

      const dataItems = getByPath(response.data, resource.itemsPath);
      const pageItems = Array.isArray(dataItems) ? dataItems : dataItems ? [dataItems] : [];
      allItems.push(...pageItems);

      if (resource.pagination?.type !== "page") {
        keepGoing = false;
      } else {
        const totalPages = getByPath(response.data, resource.pagination.totalPagesPath);
        keepGoing = totalPages ? page < Number(totalPages) : pageItems.length > 0;
        page += 1;
      }
    }

    return allItems;
  }

  async exportResource(resourceName, params = {}, outputDir = "data") {
    const items = await this.fetchResource(resourceName, params);
    fs.mkdirSync(outputDir, { recursive: true });

    const fileName = `${resourceName}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    const filePath = path.resolve(outputDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2));

    return { filePath, count: items.length };
  }

  async request(endpoint, options = {}) {
    const method = options.method || "GET";
    const url = buildUrl(this.config.baseUrl, endpoint, options.query);
    const headers = {
      Accept: "application/json",
      ...this.authHeaders(options.skipAuth),
      ...(options.headers || {})
    };

    const init = {
      method,
      headers,
      signal: AbortSignal.timeout(this.config.runtime.timeoutMs)
    };

    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    const response = await withRetries(
      () => fetch(url, init),
      this.config.runtime.retryCount
    );

    const data = await parseResponse(response);
    const setCookie = response.headers.get("set-cookie");

    return {
      status: response.status,
      headers: response.headers,
      setCookie,
      data
    };
  }

  captureAuth(response) {
    const token = firstByPaths(response.data, this.config.auth.tokenJsonPaths);
    if (token) this.token = String(token);
    if (response.setCookie) this.cookie = response.setCookie;
  }

  authHeaders(skipAuth) {
    if (skipAuth) return {};

    const { auth } = this.config;
    const headers = {};

    if ((auth.mode === "apiKey" || auth.mode === "auto") && auth.apiKey) {
      headers[auth.apiKeyHeader] = auth.apiKey;
    }

    if ((auth.mode === "bearer" || auth.mode === "auto") && this.token) {
      headers[auth.tokenHeader] = auth.tokenPrefix
        ? `${auth.tokenPrefix} ${this.token}`
        : this.token;
    }

    if ((auth.mode === "cookie" || auth.mode === "auto") && this.cookie) {
      headers.Cookie = this.cookie;
    }

    return headers;
  }
}

function buildUrl(baseUrl, endpoint, query = {}) {
  const url = new URL(endpoint, ensureSlash(baseUrl));

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

async function parseResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") && text ? JSON.parse(text) : text;

  if (!response.ok) {
    throw new Error(`Saathi request failed: HTTP ${response.status} ${JSON.stringify(data)}`);
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

function ensureSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}
