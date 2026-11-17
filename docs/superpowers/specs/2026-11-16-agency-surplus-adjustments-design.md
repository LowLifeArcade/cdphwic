# Local Agency Surplus Adjustments Design

## Intent

Let Local Agencies keep Available Inventory accurate when they donate formula nearing expiration or destroy expired formula. These are audited stock reductions performed by the agency responsible for the inventory.

## Scope and constraints

- Agencies may adjust only lots owned by their authenticated agency.
- Donation reductions are allowed only for unexpired lots expiring in 30–60 days, inclusive.
- Destruction reductions apply only to expired units and require a staff name and date of destruction.
- Both actions record the quantity and reason in the existing inventory movement history.
- The existing shared deduction command and inventory audit trail remain the single adjustment path.
- CDPH/WIC retains its existing inventory adjustment capabilities.

## Approaches

- **Extend the existing audited deduction path (selected):** permit agency-owned donations and destruction with server-side lot, reason, quantity, and attestation checks. This preserves one ledger and movement history.
- **Create a separate agency count-update workflow:** would duplicate stock reduction behavior and produce a parallel interaction to maintain.

## Implementation notes

Expose agency-appropriate actions from each own-agency lot in Available Inventory. Require quantity, reason, staff name, and date for agency reductions. Enforce donation expiry and destruction eligibility in the server command so direct API calls cannot bypass the UI. Keep agency commands for reservations, reconciliation, expiry corrections, and other lots prohibited.

## Acceptance

An agency can donate a positive whole-unit quantity from its own unexpired lot with 30–60 days remaining, inclusive, or destroy a positive whole-unit quantity from its own expired balance. Reductions exceeding the applicable available balance, outside the allowed expiry window, or from another agency's lot fail without changing inventory. Successful movements record agency actor, reason, staff, and date.
