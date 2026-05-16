export async function getLicenseStatus() {
  const result = await api("/api/license/status");
  return result.license;
}

export async function importLicenseFile(file) {
  if (!file) throw new Error("Select a license file first.");
  const content = await file.text();
  const result = await api("/api/license/activate", {
    method: "POST",
    body: { content }
  });
  return result.license;
}

export async function clearLicense() {
  const result = await api("/api/license", { method: "DELETE" });
  return result.license;
}

export function isLicenseActive(license) {
  return Boolean(license?.activated && !license?.expired);
}

export function licenseBannerText(license) {
  if (license?.expired || license?.status === "expired") {
    return { title: "License expired", text: "Import a renewed license file to continue." };
  }
  if (!isLicenseActive(license)) {
    return { title: "License not activated", text: "Import a valid license file to continue." };
  }
  return { title: "License active", text: license.expiresAt ? `Valid until ${license.expiresAt}.` : "Ready." };
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || data.error?.message || "Request failed");
    error.license = data.license || null;
    throw error;
  }
  return data;
}
