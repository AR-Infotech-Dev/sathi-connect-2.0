export function createLicenseHttpHandler(licenseService) {
  return async function handleLicenseRequest(request, response) {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === "/api/license/status") {
      return sendJson(response, 200, { ok: true, license: await licenseService.getStatus() });
    }

    if (request.method === "POST" && url.pathname === "/api/license/activate") {
      const body = await readJson(request);
      const license = await licenseService.activateFromContent(body.content || "");
      return sendJson(response, 200, { ok: true, license });
    }

    if (request.method === "DELETE" && url.pathname === "/api/license") {
      const license = await licenseService.clear();
      return sendJson(response, 200, { ok: true, license });
    }

    return false;
  };
}

export function sendLicenseError(response, error) {
  if (error.licenseStatus) {
    return sendJson(response, error.statusCode || 403, {
      ok: false,
      message: error.message,
      license: error.licenseStatus
    });
  }

  return sendJson(response, 400, {
    ok: false,
    message: error.message || "License request failed.",
    status: error.status || error.code || "license_error"
  });
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
  return true;
}
