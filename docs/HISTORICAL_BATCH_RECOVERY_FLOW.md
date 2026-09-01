# Historical Batch Recovery Flow

This flow is optional and runs before a new SATHI purchase voucher is created.

## Purchase check

Before creating a new voucher, the app asks whether the purchase was already entered. It searches the configured existing purchase voucher type for:

- The mapped Tally supplier ledger
- The mapped existing Tally stock items
- Batch rows where SATHI purchase fields are empty

The operator sees voucher number, date, type, party, item, old batch, quantity, rate, and amount.

`Update Batch / Lot` replaces only the selected batch and sets:

- `ISSATHI_BatchNo`
- `SATHI_ORIGINAL_OWNER`
- `SATHI_PACKING`
- `SATHIIsCotton`
- `SATHICMPLicNo`
- `SathiStatus`
- `SathiVchNo`

When an existing purchase is updated successfully, the app skips new voucher creation.

## Sales check

After a purchase row is updated, the app can search configured sales voucher types for the same item and old batch.

The operator explicitly selects each sales voucher to update. The app replaces the old batch and sets:

- `SATHI_BatchNoS`
- `SATHI_ORIGINAL_OWNERS`
- `SATHI_PACKINGS`
- `SATHIIsCottonS`
- `SATHICMPLicNoS`

The sales voucher-level buyer type and buyer licence fields remain supported by the alteration API when values are supplied.

Before sales alteration, the app compares absolute cumulative sales quantity for the same item and target batch against the absolute inward quantity. An excess requires an explicit critical-warning acknowledgement.

Purchase candidates where party, item, and quantity all match are highlighted as **My Strong Suggestion**.

Sales buyer identity and licence lookup use voucher `$PartyName`. `$PartyLedgerName` remains an accounting reference only. If `$PartyName` has no matching Ledger master, the voucher is treated as a cash farmer sale with no licence-selection option.

## Portal step

After sales correction, the operator can open the existing Tally-to-SATHI screen. Corrected sales are fetched through the normal portal queue and pushed manually.

## Guardrails

- Existing manual working remains available.
- No historical voucher is changed automatically.
- Every write uses Master ID and expected Alter ID.
- Every write requires `CREATED=0`, `ALTERED>0`, and `ERRORS=0`.
- Every change is verified by reading the voucher again.
- Raw Tally XML is not logged or stored.
