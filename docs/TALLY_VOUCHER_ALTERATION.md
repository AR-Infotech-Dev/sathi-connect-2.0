# Tally Voucher Alteration - Proven Working Pattern

## Safe identity

Alter an existing voucher using `TAGNAME="MASTER ID"`, `TAGVALUE`, `ACTION="Alter"`, and the original voucher type.

Do not combine this identity with the exported root `REMOTEID` or `VCHKEY`. That combination previously created a duplicate voucher.

## Minimal UDF update

`SathiStatus` and `SathiVchNo` can be updated with a minimal Master ID alter request.

Success requires:

- `ALTERED > 0`
- `CREATED = 0`
- `ERRORS = 0`
- Read-back values match

## Nested inventory or batch update

1. Export the complete voucher by Master ID.
2. Fetch nested inventory, batch, accounting, ledger, bill, address, and invoice collections.
3. Remove `MASTERID`, `ALTERID`, `GUID`, `REMOTEID`, and `VCHKEY` from the exported body.
4. Change only the selected inventory and batch block.
5. Import the complete body using Master ID alteration.
6. Reject a stale update when `AlterID` changed after loading.
7. Read the voucher again and verify the batch and UDF values.

## SATHI fields

Purchase batch:

- `ISSATHI_BatchNo`
- `SATHI_ORIGINAL_OWNER`
- `SATHI_PACKING`

Sales batch:

- `SATHI_BatchNoS`
- `SATHI_ORIGINAL_OWNERS`
- `SATHI_PACKINGS`

Sales voucher:

- `SathiVchBuyerType`
- `SathiVchLicNo`
- `SathiStatus`
- `SathiVchNo`

## Safety rules

- Never log or persist proprietary raw Tally XML.
- Never report success from HTTP status alone.
- Never allow `CREATED > 0` during alteration.
- Compare Alter ID before a full voucher write.
- Always perform read-back verification.

## Proven test

Company `Sai Enterprises`, Master ID `5223`:

- Minimal UDF alteration succeeded.
- Full voucher batch and godown alteration succeeded.
- Voucher number, date, quantities, amounts, and ledger values remained unchanged.
