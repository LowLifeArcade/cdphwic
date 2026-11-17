# Local Agency Surplus Entry Corrections Design

## Intent

Let a Local Agency correct a previously entered physical count, donation, or destruction while preserving an auditable record of both the original entry and the correction.

## Scope and constraints

- A correction appends a linked inventory movement; it never changes or deletes the original movement.
- Agencies may correct only entries from lots owned by their authenticated agency and only agency-entered counts or Donation/Destruction movements.
- The agency may change the recorded quantity and must give a correction explanation. The original attestation staff name and date stay visible; the correction records the current actor and correction date.
- Apply only the quantity difference to the current inventory balance. For counts, the corrected count changes the current balance by the difference. For donations and destruction, lowering the recorded deduction restores that amount to the appropriate current balance; raising it removes the difference.
- Reject corrections that would make available stock negative, exceed the expired balance, or violate current reservations. The original entry remains in history even when a correction is blocked.
- CDPH/WIC reviewer report reconciliations and unrelated inventory movements are not eligible for agency correction.

## Approaches

- **Linked correction movement (selected):** records the correction as a new movement referencing the original and applies its balance difference through the versioned inventory command. This preserves the original audit record and current inventory history.
- **Edit the original movement:** simpler to present, but erases what was first entered and makes the history unreliable.
- **Recount the lot only:** changes the current balance but does not identify or correct a mistaken donation/destruction entry.

## Implementation notes

Add a correction reference and corrected quantity to movement history, plus an agency-scoped command that validates the original movement and applies a guarded balance delta. In the Inventory History dialog, show which entry was corrected, the latest corrected quantity, explanation, correcting actor, and correction date. Allow a later correction of the same original by comparing against the prior correction's effective quantity.

## Acceptance

An agency can correct its own physical count, donation, or destruction entry with a new quantity and explanation. Inventory changes only by the difference from the currently effective quantity. Each correction is linked and auditable; originals remain visible. Cross-agency, reviewer-report, unsupported movement, invalid quantity, stale version, and balance-conflicting corrections are rejected without changing inventory.
