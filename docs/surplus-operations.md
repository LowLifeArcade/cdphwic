# Formula surplus operations

The Formula Surplus page tracks physical units by agency, formula, form, flavor and expiration date. Request drafts do not affect stock. Submitted rows become pending counts; a reviewer reconciles them against current stock rather than adding the reported quantity.

Admin/FPU can reconcile counts, deduct units against a request/reference, reserve transfers, record shipment/receipt, and record verified destruction. Agency representatives see their own stock and transfers and confirm actual anticipated surplus. The application continues to use the existing demo identity/session mechanism.

## Balances and transfers

- Usable on hand includes reservations. Available is usable on hand minus reserved.
- A transfer reserves at request time, deducts from the source at shipment, and adds to the destination on receipt.
- Shipped formula/form/flavor/expiration are immutable snapshots. Arrivals after expiration enter quarantine.
- Expired/Quarantined units cannot be allocated or moved. Expiration preserves the physical total and blocks unshipped transfers. Only verified destruction removes expired units.
- Explicit verified expiration corrections require a reason and cannot change a lot with active reservations.
- Counts use a reviewed inventory version; stale counts require reopening the dialog. Repeated operation IDs return the original result. Inventory changes and their audit records commit together.

## Anticipated surplus and notices

Anticipated units never increase stock. Agencies confirm the actual usable, uncommitted quantity, count date, expiration and staff name. Differences require an explanation. Reviewers reconcile the actual count. Rejecting a count reopens agency confirmation; marking it already accounted for closes the forecast without changing stock.

Donation notices apply at **60 or more calendar days** remaining. Reserved stock requires coordination with Admin/FPU. Expired stock generates a separate destruction notice. Notices and forecast tasks are in-app only; reading a notice does not change stock. Checks run daily and when inventory/notices are read or changed, using America/Los_Angeles calendar dates.

Admin uploads the Formula Donation Form and Formula Destruction Form separately on Formula Surplus. The latest PDF of each kind is available from the corresponding notice. Actual forms have not been supplied yet; until uploaded, the app explains that the form is unavailable. Files remain in private R2 storage.

## Release

Migrations `0006_surplus_inventory.sql` and `0007_surplus_notices.sql` must be applied to the target D1 database before deploying this build. Use the repository's established release workflow and the same Wrangler environment for migration and deployment. No remote migrations or deployment were performed during implementation.

The daily schedule is `16:00 UTC`. Inventory date guards also run before allocations, so a late scheduled check cannot make expired stock available.

## Local verification

Run `npm test` and `npm run build`. The implementation was additionally verified with Wrangler using isolated local D1/R2 persistence, including request/PDF submission retries, agency scoping, reserve/ship/receive, quarantine, forecast rejection/reconfirmation, scheduled checks, separate private PDF form downloads, and browser checks of New Request and reconciliation.

The repository-wide ad hoc TypeScript check reports errors in reports/access utilities and older request code; it is not an existing package script or a release gate. Build and test checks are the project's configured checks.

Cloudflare references used to verify the runtime behavior: [D1 batch transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/) and [Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).
