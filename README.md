# Saathi Setu

Suggested app name: **Saathi Setu**. It means a bridge between the Saathi government seed-trade portal and Tally.

This repository currently contains the first integration layer: a dependency-free Node.js connector for SATHI billing APIs. It signs every request with SATHI's `keyHash` and `signature` rules, sends the required headers, and exports API responses to JSON so the data can later be mapped into Tally.

## Name Options

- Saathi Setu
- Tally Saathi
- Seed Setu
- Krushi Setu
- Saathi Bridge

## SATHI API Mechanism

1. `src/config.js` loads local `.env` settings.
2. `src/saathi-signing.js` creates:
   - `keyHash = SHA512(apiKey + ts)`
   - `signature = HMAC-SHA512(JSON.stringify(bodyWithTsAndKeyHash), apiKey)`
3. `src/saathi-billing-client.js` calls the SATHI billing APIs:
   - `getOrderDetailsByBuyerCode`
   - `pullLotDetailsByBuyerCode`
   - `fetchLotDetailsByBuyerCode`
   - `craeteSathiOrder` as written in the SOP endpoint
4. `src/index.js` provides a CLI so we can test the portal fetch before building the desktop UI.

## Setup

Copy `.env.example` to `.env` and fill values from the API documentation.

```powershell
Copy-Item .env.example .env
```

Then update:

- `SAATHI_BASE_URL`
- `SAATHI_API_KEY`
- `SAATHI_CLIENT_ID`
- `SAATHI_CLIENT_SECRET`
- `SAATHI_DEFAULT_OWNER_CODE`
- `SAATHI_DEFAULT_LOCATION_CODE`
- `SAATHI_DEFAULT_STATE_CODE`

Do not hardcode real API keys or secrets in source files.

## Commands

```powershell
npm run check
node src/index.js pending-orders
node src/index.js pull-lot --voucherNumber=B2710811773048485700 --ownerCode=LCCD2021120007 --locationCode=LCCD2021120007
node src/index.js fetch-lot --file=examples/pull-lot-request.json
node src/index.js create-order --file=examples/create-order-request.json
```

API exports are written to `data/*.json`.

## Notes From SOP

- `pending-orders` gets seller-created orders not yet received.
- `pull-lot` fetches lot/order details and marks the order as received in SATHI.
- `fetch-lot` re-fetches already received orders without changing status.
- `create-order` sends a completed Tally sale to SATHI.

## Next Step

After confirming the credentials in local `.env`, run `pending-orders` against the live portal. Then we will map the returned order and lot fields into Tally voucher structures and wrap this in an Electron desktop application.
