# Portable AR Infotech License Flow

Copy this folder into another Node/Electron app and wire it to that app's server.

## Files

- `license-core.js` - verification, import, clear, expiry, machine ID, Tally license check, clock rollback guard.
- `debug-log.js` - JSON-line logger for `logs/server.log`.
- `node-http-routes.js` - optional plain Node HTTP routes.
- `browser-license-client.js` - optional browser helper for status/import/clear.

## Required app files

Place the public key here, or pass a custom path:

```text
keys/public.pem
```

Stored files default to:

```text
data/license.lic
data/license-runtime.json
logs/server.log
```

## Server setup

```js
import http from "node:http";
import { createDebugLogger } from "./portable-license-flow/debug-log.js";
import { createLicenseService } from "./portable-license-flow/license-core.js";
import { createLicenseHttpHandler, sendLicenseError } from "./portable-license-flow/node-http-routes.js";

const { debugLog, debugError } = createDebugLogger({ logFile: "logs/server.log" });

const licenseService = createLicenseService({
  publicKeyFile: "keys/public.pem",
  licenseFile: "data/license.lic",
  runtimeFile: "data/license-runtime.json",
  debugLog,
  debugError,
  getIdentityExtras() {
    return {
      tallyLicenseNumber: process.env.TALLY_LICENSE_NUMBER || "",
      saathiClientId: process.env.SAATHI_CLIENT_ID || ""
    };
  }
});

const handleLicenseRequest = createLicenseHttpHandler(licenseService);

http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/license")) {
      const handled = await handleLicenseRequest(req, res);
      if (handled) return;
    }

    if (req.url.startsWith("/api/protected")) {
      await licenseService.requireActive();
      // continue protected API work
    }
  } catch (error) {
    debugError("request.failed", error, { url: req.url, method: req.method });
    return sendLicenseError(res, error);
  }
}).listen(5173);
```

## Browser setup

```js
import {
  getLicenseStatus,
  importLicenseFile,
  clearLicense,
  licenseBannerText
} from "./portable-license-flow/browser-license-client.js";

async function refreshLicenseUi() {
  const license = await getLicenseStatus();
  const banner = licenseBannerText(license);
  document.querySelector("#licenseTitle").textContent = banner.title;
  document.querySelector("#licenseText").textContent = banner.text;
}

document.querySelector("#licenseFile").addEventListener("change", async (event) => {
  await importLicenseFile(event.target.files[0]);
  await refreshLicenseUi();
});

document.querySelector("#clearLicense").addEventListener("click", async () => {
  await clearLicense();
  await refreshLicenseUi();
});
```

## License payload rules

The encrypted payload should include:

```json
{
  "machineId": "machine hash",
  "licenseNumber": "SATHI1,SATHI2",
  "tallyLicense": "755791371",
  "startDate": "2026-05-15",
  "endDate": "2027-05-15",
  "issuedAt": "2026-05-15T09:16:23.798Z",
  "issuer": "AR Infotech"
}
```

`licenseNumber` can be comma-separated. Use `activeLicenseIds(status)` from `license-core.js` to filter allowed scopes.
