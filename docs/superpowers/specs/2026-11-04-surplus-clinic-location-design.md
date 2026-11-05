# Clinic locations for surplus inventory

## Intent

Show where surplus is physically located and let CDPH/WIC request stock from any clinic in a different Local Agency. Transfers between clinics within the same Local Agency are excluded.

## Approach

Extend the existing inventory lots with a clinic location rather than creating a second clinic inventory system. Each agency, clinic, formula, form, flavor, and expiration combination has its own balance. Merely adding a clinic label to an agency-wide balance would incorrectly combine stock held at different clinics.

## Inventory and reporting

- Show the clinic beneath the agency in the compact inventory row and support filtering by clinic.
- Select a clinic from the chosen agency's clinic address book when recording physical counts or anticipated surplus. Validate agency ownership on the server.
- Carry the reported clinic into count review and reconciliation so quantities are recorded at the correct location.
- Request-based surplus reports may suggest the request's clinic, but allow the actual storage clinic to be selected. A request's receiving address alone does not prove where surplus is physically held.
- Existing lots and reports retain their quantities, reservations, and history and display “Clinic not specified.” Do not guess a clinic or move existing reserved stock automatically.
- Allow a reviewer to assign an unspecified, unreserved lot to a clinic. If matching stock already exists there, require an explicit reconciliation rather than silently merging balances.

## Request Shipment and transfers

- Shipment remains the primary reservation workspace. Select a sending agency, then a clinic and its matching available surplus.
- The Surplus “Use in Request” shortcut carries the exact selected lot and clinic into Shipment.
- Keep the existing rule excluding stock from the receiving request's own Local Agency.
- Reserve and deduct against the selected clinic's lot, preserving existing concurrency checks.
- Store the sending clinic and pickup address on the transfer as a snapshot. Show that location in the agency transfer view and shipping details so labels and pickup arrangements refer to the correct clinic.
- Preserve the existing handoff: sending agency confirms stock; CDPH/WIC supplies labels and shipping details; sending agency arranges and confirms pickup.
- All users of the sending Local Agency can view its transfer actions. Clinic location does not introduce a new user access boundary.

## Verification and scope

Test separate balances for identical formula held at two clinics; cross-agency clinic validation; same-agency transfer rejection; exact-lot reservations; unchanged legacy stock and reservations; and clinic/address snapshots after address-book edits. Verify the compact inventory and transfer layouts with clinic names.

This change requires a database migration. Implement and verify locally; production migration, push, and deployment are separate steps.
