# Agency formula surplus tracker

Status: core tracker design approved by the user on 2026-10-26; additions below record the subsequent requirements and implementation proposals. The user selected reserving transfer stock when requested and deducting it when shipped. Other decisions below are implementation proposals, not additional user approvals.

## Purpose and scope

Local agencies report formula surplus through New Request. Admin and FPU reviewers need to see usable surplus at each agency, apply it while reviewing requests, and arrange transfers between agencies. Stock must remain accurate when several reviewers act at once.

Duration is a whole number from 1 through 6 months. The New Request selector now exposes only those values; existing submission validation also rejects values outside that range.

## Existing application and approach

The application uses Nuxt on Cloudflare Workers, an existing D1 database, and R2 for attachments and incomplete forms. Submitted requests currently live in a module-level demo store. Surplus is currently a request field, without a shared balance or movement history.

Use D1 for inventory, reports, reservations, and movements. The chosen transfer behavior requires atomic changes and durable history. Extending the module-level store would lose balances across Worker instances. A shared R2 JSON balance would require an additional coordination mechanism to prevent competing writes. D1 already exists and provides the needed database primitives.

Keep the current request fields for compatibility. Inventory receives durable report records and a small request-reference snapshot; it does not rely on the demo request remaining in memory. Replacing the application's general request persistence or authentication is outside this feature.

## Inventory identity and quantities

A stock lot belongs to one agency and one formula variant: canonical formula name (or entered Other name), form, applicable flavor, and expiration date. Different forms, flavors, and expiration dates have separate balances. Quantity is measured in individual units throughout this first version. Do not infer case conversions for products without configured case sizes.

Each lot exposes:

- On hand: physical units currently at the agency.
- Reserved: on-hand units committed to transfers that have not shipped.
- Available: on hand minus reserved.

Quantities are nonnegative whole units. Reserved must never exceed on hand. Expired stock is shown separately and cannot be newly reserved or deducted for request fulfillment. Reports without an expiration date remain pending until the reviewer supplies the date; do not guess one.

## Surplus reporting and reconciliation

Submitting a request records its surplus rows as pending agency reports. Saving an incomplete form does not change inventory. A report includes agency, formula variant, reported quantity, expiration date, source request reference, reporting time, and reporter.

Reported surplus describes a count of stock already at the agency. It is not automatically added to an existing balance. This prevents two requests reporting the same six units from creating twelve units.

Admin or FPU reviews each report against current inventory and movement history. They may reject it, mark it as already accounted for, or confirm an absolute stock count for the matching lot. Confirmation displays the existing balance, reservations, report time, and proposed change. It records the adjustment and reason. A confirmed count cannot be below active reservations; resolve those reservations first. If inventory changed after the reviewer loaded it, require review of the new balance before accepting the count.

A request submission token and a stable per-row report ID make repeated submission/retry idempotent. Processing or revisiting a report cannot add stock twice. Historical demo surplus is not automatically treated as verified inventory; it can be reviewed as an opening count.

## Deductions during request review

Admin and FPU can select an agency lot and deduct units used to fulfill the current request. The operation requires a positive quantity, a request reference, and a reason. It cannot consume reserved units or exceed the available balance. Each deduction records who made it, when, the agency and variant, the request, the quantity, and resulting balance.

A submitted operation has a stable idempotency key. Repeated clicks and retries return the original result rather than deducting twice. Corrections use a documented adjustment with a reason; the movement history is never edited or deleted.

## Agency-to-agency transfers

The user selected the following lifecycle:

1. Requested/reserved: Admin or FPU chooses source lot, receiving agency, quantity, and related request. Source reserved increases; source on hand does not change. Available decreases immediately.
2. Shipped: record shipment date and optional tracking/reference. Source on hand and reserved both decrease by the transfer quantity. The transfer is now in transit and is not available at either agency.
3. Received: record receipt. The receiving agency's matching lot gains the quantity, preserving formula, form, flavor, and expiration. Source stock is not deducted again.
4. Cancelled before shipment: release the reservation; physical on hand remains unchanged.

The source and destination must differ. Transfer quantity is fixed after reservation. Change it by cancelling and reserving again before shipment. This initial version records full shipment and full receipt; partial shipment, loss in transit, and returns require a separately logged correction rather than an ambiguous automatic balance change.

Admin and FPU record shipment and receipt after confirmation from the agencies. Agency users can view their own balance and incoming/outgoing transfers but cannot create deductions, approve reports, or change transfer status. Allowing agency users to confirm transitions directly can be added later if desired.

All transitions are authorized and atomic. Duplicate or out-of-order transitions cannot alter balances again. A cancelled transfer cannot ship, a shipped transfer cannot be cancelled, and a transfer can be received only once. A reservation made before expiration cannot be marked shipped after expiration; release it through cancellation.

The app records transfer instructions and agency contact/address details. Donation notices are in-app only, as selected by the user. No email delivery is included.

## Screens and permissions

Add a Surplus tracker accessible to Admin and internal/FPU users. They can inspect all agencies to locate source stock, filter by agency and formula variant, inspect lot expiration, see pending reports, and inspect movement and transfer history. Agency users see only their agency's inventory and transfers involving their agency. The API enforces the same access rules, using the application's existing role/session mechanism.

In request review, show matching lots with source agency, expiration, on hand, reserved, and available. Admin and FPU can use local surplus, reserve another agency's surplus, or open the tracker. Show the request's linked deductions and transfers so reviewers can see what has already been allocated.

Use the existing dark UI, field labels, confirmation dialogs, and agency/formula catalogs. Operation dialogs show the source, destination when relevant, quantity, and resulting availability before confirmation. Saving a form or editing text does not itself deduct inventory.

## Persistence and operational rules

Add a D1 migration for lots, surplus reports, transfers, inventory movements, and idempotency records. Persist actor IDs and timestamps on every inventory operation. Use database constraints and atomic guarded operations so simultaneous deductions/reservations cannot overspend stock or record a movement without its balance change.

The concrete schema, indexes, guarded SQL, route names, and component boundaries are left to the implementer. All compound inventory writes must either commit together or leave all balances unchanged. Inventory operations must remain correct across Worker restarts.

Prepare and test the migration locally. Applying it to production and deploying are later release steps through the user's established workflow. Keep existing submitted-request behavior available while integrating the report handoff. A durable report handoff must succeed before treating the surplus report as recorded; failed submissions retain the incomplete form and upload for retry. Reuse stable submission/report IDs on retry.

## Acceptance checks

- Duration permits only integer values 1–6.
- Two agencies' stock stays separate; different forms/flavors/expiration dates do not merge.
- Saving an incomplete request changes no inventory; submitted surplus becomes a pending report.
- Repeated reports and retries cannot inflate a balance.
- Reviewer reconciliation is explicit, audited, and rejected if stale or below reserved stock.
- A deduction reduces available and on-hand stock once and links to its request/reviewer.
- Concurrent reservations cannot allocate more than available stock.
- Reserving reduces availability without reducing physical on hand.
- Shipping reduces source on hand and reserved once; receiving increases destination stock once.
- Cancellation releases only unshipped reservations; invalid transitions leave balances unchanged.
- Expired or undated stock cannot be newly allocated.
- Unauthorized users cannot mutate inventory or view other agencies' restricted inventory.
- Refresh/restart retains reports, balances, reservations, and history.
- Existing New Request saves, attachments, two-formula validation, and request review continue to work.

## Proposed decisions for review

The implementation proposals to review are: pending reports followed by explicit stock-count reconciliation; individual units only; Admin/FPU-controlled shipment/receipt confirmation; no partial-transfer workflow in the initial version; expiration required before stock becomes allocatable; and the existing role/session model retained.


## Anticipated surplus and confirmation

Anticipated surplus entered by Admin/FPU when ordering is a forecast, not verified inventory. Keep it in a separate forecast record linked to the order/request and formula variant. Forecasts never increase on-hand or available inventory and cannot be transferred or donated.

Proposed confirmation workflow: when Admin/FPU records an anticipated surplus, select a confirmation due date reflecting when the agency expects to have dispensed the participant's allocation. An agency task asks staff to confirm actual usable, uncommitted stock, formula variant, expiration date, count date, and their name. Delivery confirmation records receipt only and cannot confirm surplus. Zero actual surplus is a valid response.

Compare the agency's actual count with the forecast and show any variance. A discrepancy requires an explanation from the agency. Admin/FPU then reconciles the actual count using the report-review mechanism above. Only that review changes verified inventory. The forecast's completion status records confirmation and review separately; an agency acknowledgement alone does not mark it reconciled. After a later stock movement, older confirmations do not overwrite current stock. Outstanding and overdue confirmations remain visible to the agency and Admin/FPU until resolved. Revising the forecast preserves history and does not change verified inventory.

This establishes an accountable confirmation process; the app cannot independently measure stock physically held at an agency. The counted quantity must exclude stock already committed to participant dispensing, and any transfer reservations remain protected by inventory constraints.

## Donation notices at 60 days

User requirement: local agencies receive in-app-only donation notices for formula stock with 60 days or fewer until expiration. The Formula Donation form will be uploaded later and must be available with the notice once provided.

Proposed behavior: run a daily Worker check, and also evaluate a lot when its verified balance or expiration changes. Compare date-only expiration against the current date in America/Los_Angeles. For positive on-hand stock expiring in 0 through 60 calendar days inclusive, create or update one active notice for the owning agency and lot. Include formula, form, flavor, expiration, on-hand quantity, reservations, and the available donation quantity. Reserved stock is explicitly excluded from donation availability. If all units are reserved, the notice directs the agency to coordinate with Admin/FPU rather than donate reserved units.

Do not send donation instructions for already-expired stock; use a separate expired-stock alert visible to the agency and Admin/FPU and prevent allocation. A lot reduced to zero closes its active notice. Revising the expiry updates that lot's existing notice and eligibility. Daily retries, manual balance updates, and restarts cannot create duplicate active notices. Acknowledging a notice does not deduct stock or establish that donation happened. Record an actual donation through an audited deduction with reason Donation.

Admin can upload/version the Formula Donation PDF in private R2 storage and select the active version. In-app notices provide an authorized attachment download. Until the form is uploaded, issue the time-sensitive notice with an explicit 'Formula Donation form not yet available' message and an Admin/FPU configuration warning; do not invent an attachment or silently suppress expiring-stock notices. Publishing the form makes it available from active notices. Version metadata and download history references remain auditable.

Add agency-scoped in-app notifications to the existing bell with unread counts, a list of notices and confirmation tasks, and acknowledgement/read state per user. Agency members see their agency's notices; Admin/FPU can see notices across agencies. These are application notifications, not Codex desktop automations. The later production release must configure the Worker scheduled trigger.

## Additional acceptance checks

- Anticipated quantities never increase verified on hand or available stock.
- Receipt confirmation alone cannot resolve a surplus forecast.
- Agency actual counts, including zero, preserve count date and confirmer; variances require explanation.
- Reviewer reconciliation closes the forecast only after successful stock-count processing.
- Donation notices cover days 60, 1, and 0, but not day 61 or already-expired stock.
- Date boundaries and daylight-saving changes use America/Los_Angeles calendar dates.
- A notice never encourages donating reserved stock, never duplicates on retries, and never changes a balance on acknowledgement.
- Notice attachments remain agency-authorized and clearly unavailable until a real donation form is published.
