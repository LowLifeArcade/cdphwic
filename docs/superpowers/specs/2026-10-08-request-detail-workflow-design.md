# Request Detail Workflow Redesign

## Goal

Reorganize the request detail drawer into clearer participant, request, CDPH/WIC processing, local-agency follow-up, local-agency information, and shipment sections while adding persisted benefit-month, ordering, receipt, issue, and surplus workflows.

## Scope

This change applies to the request detail drawer and its existing request update flow. Formula/product selection remains manual; prescription parsing must not select or match an existing product.

## User Interface

### Participant summary

Keep the participant name in the drawer header. Place these values in a summary area to the right of the name:

- WIC Family ID
- WIC Individual ID
- Date of Birth
- Medi-Cal
- Benefits Start Date

Use the exact label capitalization requested above.
The summary remains editable by staff for Benefits Start Date so moving the
field does not remove the existing update capability.

### Request overview

Keep the requested formula/form, prescribed amount, and duration. Move Diagnosis into this section. Remove Benefits Start Date from this section. Add a multi-select Benefit Month(s) Requested control storing month values in `YYYY-MM` form and displaying labels such as `October 2026`.
Staff can select and remove requested months; other identities see the saved
months read-only.

### CDPH/WIC Use Only

Rename Staff processing to CDPH/WIC Use Only. Keep status, special-order, staff notes, denial, authorization-form, and existing benefit-issuance behavior. Rename Amount prescribed in this section to Amount Approved and add:

- Approved cases
- Approved months
- Cases ordered
- Expected surplus, measured in units
- A visible instruction: `Please provide X units of product on hand.`

Show the approval counts together as `___ Case(s) for ___ Month(s)` in the
staff section. The instruction uses the entered expected-surplus value.

### LA Follow-Up

Rename Agency follow-up to LA Follow-Up. Keep notes and received photos. Add explicit receipt actions:

- Mark shipment received
- Report damaged shipment
- Report missing shipment

These actions update the existing received-status workflow; marking received also completes the request as the current flow does. Issue actions must remain distinguishable from successful receipt.

Add a repeatable Surplus editor. Each row contains:

- Product Name
- Number of Units
- Expiration Date

Rows represent one formula and expiration date combination. Rows can be added and removed before saving.

### Local Agency Info

Rename Local agency and representative to Local Agency Info. Rename fields as follows:

- Local agency → Local Agency
- Address → Shipping Address
- LA representative → Contact

Keep email and phone information.

### Shipment

Rename Delivery to Shipment. Display ETA as `MM-DD-YYYY` while preserving the existing date value format for inputs and storage. Display carrier alongside tracking information, using the carrier already associated with each tracking number.

## Data Model

Extend `RequestRecord` with:

```ts
benefitMonthsRequested?: string[];
approvedCases?: number;
approvedMonths?: number;
casesOrdered?: number;
expectedSurplus?: number;
surplusItems?: Array<{
    productName: string;
    units: number;
    expirationDate: string;
}>;
```

Use the existing `receivedStatus` values for receipt state and issue state. Use the existing `trackingNumbers` carrier field for Shipment carrier display. Keep `benefitIssuances` separate from `benefitMonthsRequested`: requested months identify the request period, while benefit issuances represent staff allocation quantities.

## Persistence and Permissions

Use the existing `PUT /api/requests/:id` request update path and in-memory request record flow. Staff-only fields remain available to admin/internal identities. LA Follow-Up and surplus fields remain available to admin/agency identities. Read-only summaries remain visible according to the existing drawer permissions.

## Validation

- Requested month values must be unique `YYYY-MM` values.
- Approved cases, approved months, cases ordered, expected surplus, and surplus units must be non-negative numbers; values that represent a positive allocation/order should remain positive where the existing UI already enforces `min="1"`.
- Surplus expiration dates use the native date input and are stored as `YYYY-MM-DD`.
- A surplus row requires product name, units, and expiration date before saving.
- Shipment receipt actions must save the corresponding `receivedStatus` and preserve issue states rather than treating every update as received.

## Testing

Add or extend tests to cover:

- Exact section and label changes in the drawer.
- Requested-month add/remove behavior and unique `YYYY-MM` values.
- Staff approval/order/surplus fields and on-hand guidance.
- LA receipt, damaged, and missing actions.
- Repeatable surplus rows and validation.
- Shipment ETA display formatting and carrier display.
- Request update payloads containing the new fields.

## Out of Scope

- Automatic formula/product matching from prescription PDFs.
- New R2 objects or database tables.
- Changes to the new-request formula selection workflow.
- Changes to unrelated profile or signup phone fields.
