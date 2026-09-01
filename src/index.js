import { loadConfig } from "./config.js";
import fs from "node:fs";
import { SaathiClient } from "./saathi-client.js";
import { SaathiBillingClient } from "./saathi-billing-client.js";

async function main() {
  const [command = "help", ...args] = process.argv.slice(2);

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const config = loadConfig();
  const billingClient = new SaathiBillingClient(config);

  if (command === "login") {
    const client = new SaathiClient(config);
    const result = await client.login();
    console.log(JSON.stringify({
      authenticated: result.authenticated,
      tokenDetected: result.tokenDetected,
      cookieDetected: result.cookieDetected
    }, null, 2));
    return;
  }

  if (command === "fetch") {
    const client = new SaathiClient(config);
    const resourceName = args[0] || "seedTrades";
    await client.login();
    const result = await client.exportResource(resourceName, parseCliParams(args.slice(1)));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "pending-orders") {
    const response = await billingClient.getOrderDetailsByBuyerCode(parseCliParams(args));
    const result = await billingClient.exportResponse("pending-orders", response);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "pull-lot") {
    const payload = readPayload(args);
    const response = await billingClient.pullLotDetailsByBuyerCode(payload);
    const result = await billingClient.exportResponse("pull-lot", response);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "fetch-lot") {
    const payload = readPayload(args);
    const response = await billingClient.fetchLotDetailsByBuyerCode(payload);
    const result = await billingClient.exportResponse("fetch-lot", response);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (command === "create-order") {
    const payload = readPayload(args);
    const response = await billingClient.createSathiOrder(payload);
    const result = await billingClient.exportResponse("create-order", response);
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(`Unknown command "${command}". Run: node src/index.js help`);
}

function parseCliParams(args) {
  const params = {};

  for (const arg of args) {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    if (!key || rest.length === 0) continue;
    params[key] = rest.join("=");
  }

  return params;
}

function readPayload(args) {
  const params = parseCliParams(args);

  if (params.file) {
    return {
      ...JSON.parse(fs.readFileSync(params.file, "utf8")),
      ...withoutKey(params, "file")
    };
  }

  return params;
}

function withoutKey(value, keyToRemove) {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== keyToRemove)
  );
}

function printHelp() {
  console.log(`
Saathi Setu fetch connector

Commands:
  node src/index.js pending-orders
  node src/index.js pull-lot --voucherNumber=B271... --ownerCode=LCCD... --locationCode=LCCD...
  node src/index.js fetch-lot --file=examples/pull-lot-request.json
  node src/index.js create-order --file=examples/create-order-request.json

Setup:
  1. Copy .env.example to .env.
  2. Fill SATHI API key, client id, client secret, owner code, and location code.
  3. Run pending-orders first, then pull/fetch lot details using voucherNumber.
`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
