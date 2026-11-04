# Surplus transfer confirmation and shipping handoff

## Intended workflow

1. CDPH/WIC reserves surplus at a sending Local Agency for a request.
2. The sending agency immediately receives a notice to confirm that it physically has the reserved formula and quantity. Only that agency can confirm availability.
3. Once confirmed, CDPH/WIC receives a notice to prepare shipping. CDPH/WIC supplies the shipping labels, ETA, and tracking details through the existing transfer tools.
4. When labels and shipping details are available, the sending agency receives a separate notice to download and print the labels and arrange carrier pickup.
5. After the carrier collects the formula, the sending agency confirms pickup. This deducts the reserved inventory and notifies CDPH/WIC. The receiving agency's existing receipt workflow continues unchanged.

## Approach

Extend the existing request-linked transfer with a recorded availability confirmation and distinct notices for each handoff. Retain the existing reservation, label storage, shipment details, pickup confirmation, and receipt records. A parallel transfer workflow would duplicate these records and create inconsistent inventory and permissions.

## Rules and presentation

- The Shipment section in the Requests item is the primary place for CDPH/WIC to reserve surplus, review stock confirmation, and provide shipping labels and details.
- Proposed secondary entry: the Surplus menu offers a shortcut to select a destination request and continue in its Shipment section with the stock preselected, rather than a separate reservation form.
- Both entry points use the same availability checks and inventory reservation transaction to prevent duplicate allocation. A free-text request reference is not a substitute for linking the actual request.
- CDPH/WIC sees the sending agency's confirmation status, without an action to confirm stock or pickup on its behalf.
- The sending agency sees formula, quantity, expiration, destination, and shipping information without access to the participant request.
- Stock confirmation does not deduct inventory. Pickup confirmation remains the deduction point.
- Shipping cannot be published before stock confirmation. Pickup cannot be confirmed before stock confirmation, shipping details, and at least one shipping label are present.
- Existing unshipped transfers require availability confirmation; shipped and received transfers retain their history.
- Each handoff has a distinct notice identity so reading the reservation notice does not hide the later shipping notice.
- Existing cancellation and expiry behavior continues to release or block reservations.

## Scope and verification

Update transfer persistence, server permissions and transition checks, notice routing, and agency/reviewer controls. Test the full handoff, incorrect-role attempts, premature actions, repeated confirmations, cancellation, expiry, and unchanged inventory until pickup. No deployment is included in this change.

## Surplus menu cleanup proposal

- Lead with available inventory, with formula and agency filters.
- Separate Inventory, Transfers, and Counts & Forecasts into focused views rather than stacking every section on one page.
- Keep the sending agency's product confirmation, labels, pickup instructions, and pickup confirmation in Transfers.
- For CDPH/WIC, show transfer progress and a link to the corresponding request Shipment section for shipping tasks.
- Put inventory corrections and infrequent operations in a row action menu; keep reservation quantities and history accessible.
- Replace the standalone legacy Request transfer form with the Shipment shortcut described above. Preserve existing transfer records and history; do not silently remove active legacy transfers.

## Implementation choices

Use the existing Nuxt, D1, and R2 implementation. Keep reservation status separate from the availability-confirmed timestamp so existing inventory accounting remains compatible. If an agency cannot confirm the full quantity, it leaves the transfer pending for CDPH/WIC to cancel or revise; partial confirmations are outside this change.
