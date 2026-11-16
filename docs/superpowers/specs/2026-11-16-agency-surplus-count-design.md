# Local Agency Surplus Count Design

## Intent

Let a Local Agency start and attest to its own physical surplus count, including initial launch inventory, without waiting for CDPH/WIC to create an anticipated forecast. Agency-attested quantities become available immediately; each count is recorded in inventory history.

## Goals and constraints

- Add a Local Agency action in Formula Surplus to submit a count for a formula and clinic.
- Capture form, flavor, whole units, expiration date, count date, and staff name; allow an optional reason.
- Validate that the signed-in agency owns the selected clinic and that the count date is not in the future.
- Save the count as an agency-authorized reconciliation of that agency's inventory, making the counted usable quantity available immediately.
- Record the authenticated agency actor, staff name, count date, clinic, expiration date, and optional reason in the inventory movement history.
- Prevent an agency from reconciling another agency's stock or using this action for deductions, reservations, expiry corrections, or other inventory commands.
- Keep the existing CDPH/WIC review and reconciliation workflow for pending reports created from other flows.
- Group the inventory display by agency, formula, form, flavor, and clinic. For groups with multiple expiration lots, show combined totals and the next expiration, with an expandable per-expiration breakdown and lot-specific actions.
- Keep expiration lots separate in storage and history; matching formula, form, flavor, clinic, and expiration counts continue updating the same lot.
- Preserve the existing CDPH/WIC forecast and count-confirmation workflow.

## Approaches

- **Agency-attested count (selected):** records the agency's physical count as an audited inventory reconciliation and makes it available immediately. It matches the agency's responsibility for counting and attesting to its own stock.
- **Agency report, reviewer reconciliation:** records the count as pending and waits for CDPH/WIC. Rejected because launch counts would require a second party to approve stock the agency already owns and attests to.
- **Require a forecast first:** preserves the present process but does not let agencies initiate unplanned counts.

## Implementation notes

Add an agency-only count action and endpoint. Validate the authenticated agency, its active clinic, formula, count, staff attestation, count date, and expiration; then update only that agency's lot through the existing versioned inventory command so the movement audit captures the actor and attestation details. The existing reviewer report/reconcile workflow remains unchanged.

## Acceptance

An agency can submit a valid count and immediately see the attested usable balance in its inventory; the count appears in lot history with the agency actor and attestation details; invalid or cross-agency data and non-reconcile agency commands are rejected; reviewer pending-count reconciliation remains available for existing reports. Multiple expiration lots for the same agency/formula/form/flavor/clinic display as one summary with an expandable expiration breakdown, while distinct clinics or agencies remain separate.
