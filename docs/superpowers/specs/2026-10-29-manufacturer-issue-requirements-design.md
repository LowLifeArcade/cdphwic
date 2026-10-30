# Distributor requirements and replacement shipments

## Intent and user decisions
Local Agencies need to know what a distributor requires when confirming receipt, before creating a damage report. Distributor profiles provide defaults for returned labels, damage images, and replacement by individual can/carton or whole case. The user selected distributor defaults on October 29, 2026 and confirmed that replacement basis should default from the distributor too. CDPH/WIC can make shipment-specific exceptions. Existing issue deletion and CDPH/WIC view cleanup are already implemented.

## Approaches
Per-issue manual requirements avoid profile management but do not inform agencies early enough. Distributor profiles with shipment snapshots provide immediate instructions and consistent defaults while retaining exceptions. The user selected distributor profiles. Extend the existing Nuxt/Vue app, D1 storage and private R2 attachments.

## Distributor profiles
- CDPH/WIC and Admin manage a Distributors page containing name, Labels must be sent back, Images required as proof of damage, Replacement Basis (Individual units or Whole case), and instructions. Local Agency can view requirements but cannot edit profiles.
- Connect the existing Supplier field in shipment editing to the distributor list. Preserve existing free-text supplier names on older shipments; unidentified distributors display Requirements not specified, not an assumed policy.
- Snapshot the selected distributor ID/name, profile version and requirements on the shipment when Send ETA is used. Display these to the Local Agency above receipt entry and in the issue panel. A later profile edit applies to new/undispatched shipments and leaves dispatched snapshots unchanged.
- CDPH/WIC and Admin can explicitly override a shipment's requirements with a reason; retain previous settings and actor/date in history. Profile changes and overrides preserve evidence and existing receipts.

## Agency evidence workflow
- Label/image evidence is required only when damage is reported or damaged quantities are recorded. An undamaged receipt or missing-only report does not require damage evidence.
- Within a shipment issue, Local Agency records Labels sent with a date/reference and uploads damage images when required. Show outstanding requirements clearly during receipt confirmation and issue review. Agency can acknowledge actual product quantities even if evidence is still pending.
- Store images privately in R2; authorize upload and viewing against the request's agency. Validate image content, size and type. Never trust generic request updates to supply attachment storage metadata.
- Sending labels and uploading images do not change inventory quantities. Physical damaged product remains in Damaged Held, excluded from usable stock, until separately documented return or destruction. Returning the cans is not required by default; shipment instructions can describe exceptions.
- CDPH/WIC views evidence alongside the report and can respond through the existing issue response workflow.

## Replacement shipments and counts
- Replacement editing supports whole cases plus loose units. Confirmed units per case converts both to exact quantities for shipping, receipt, missing quantities, and usable inventory.
- Whole-case basis requires zero loose units; individual-unit basis permits them. CDPH/WIC enters/reviews quantities. Good original cans remain usable when a whole case is replaced; existing approval-limit alerts count original and replacement usable quantities together.
- Each replacement retains a durable originating-issue link and a snapshot of its replacement basis. Requirement changes apply to editable replacement plans; dispatched/received shipment snapshots and historical quantities are preserved. Deleting/re-reporting the original issue must not break linkage or rewrite history.
- Preserve case-only legacy records, immutable original approval limits, packaging snapshots and concurrent-edit protection.

## Existing explicit changes
Local Agency/Admin can delete an issue after confirmation; retain report/responses in audit history, keep receipt/disposition quantities, and recompute status. Shipments with deleted audit records cannot be removed or rewritten. CDPH/WIC cannot delete reports. Agency Notes and Report Surplus are absent from CDPH/WIC view.

## Verification and builder choices
Test profile permissions, snapshot/default/override behavior, scoped image access and validation, evidence-only inventory invariance, individual-unit replacement arithmetic, whole-case validation, immutable dispatched history, audit retention and overage alerts. Verify screens using isolated local fixtures. Exact image size/count limits and compact panel arrangement are builder decisions. Do not push or deploy without a user request.

## Status
Approved by the user on October 29, 2026. Distributor profiles, evidence uploads, audited exceptions and individual-unit replacements implemented and verified; see the implementation plan ledger.
