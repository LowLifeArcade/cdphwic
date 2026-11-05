# Surplus Clinic Locations Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development with a shared interface and a final review.

**Goal:** Identify surplus by its physical clinic and reserve exact clinic stock across different agencies.
**Architecture:** Add optional clinic snapshots to existing lots, reports, forecasts, and transfers. Include the clinic in located lots' variant keys while preserving existing unspecified keys and balances. Reuse clinic address books, inventory transactions, and request transfer handoffs.
**Tech Stack:** Nuxt/Vue, TypeScript, D1, Vitest.
**Spec:** docs/superpowers/specs/2026-11-04-surplus-clinic-location-design.md

## Global Constraints
- Transfers remain between different Local Agencies; existing same-agency rejection remains enforced.
- Unspecified existing stock retains quantities, history, and reservations.
- Validate clinic ownership on the server; snapshot addresses for transfer pickup.
- Continue in the current feature checkout, preserving the earlier uncommitted agency request visibility change.
- No push, production data changes, or deployment in this implementation.

## Shared interfaces
- `SurplusVariant` gains optional `clinicId`; `SurplusLot` also has optional `clinicName`, `clinicAddress` (ClinicAddress).
- `lotKey(v)` adds a clinic ID only when present, otherwise equals the legacy `variantKey(v)`.
- `resolveSurplusClinic(db, agencyId, clinicId?)` returns validated optional `{clinicId,clinicName,clinicAddress}`; validates the selected clinic belongs to the agency.
- Reports and forecasts gain nullable `clinic_id`, `clinic_name`, `clinic_address` columns. `clinic_address` is a JSON snapshot; API rows retain snake_case names.
- Transfers gain nullable `source_clinic_id`, `source_clinic_name`, `source_clinic_address` JSON snapshot columns. Request shipment rows gain optional `sourceClinicId`, `sourceClinicName`, `sourceClinicAddress`.
- `RequestRecord.surplusItems` gains optional `clinicId`; reporting UI must allow the actual storage clinic to be selected.
- `POST /api/surplus/lots/:id/clinic` accepts `{clinicId,expectedVersion}` and assigns only an unspecified, unreserved lot; matching target stock yields conflict rather than merging.

## Review Focus
- Identical formula/expiration at different clinics must never share balances.
- Cross-agency or archived clinic selection must be rejected for new inventory/reporting.
- Assignment must preserve balances and history and fail for active reservations, stale versions, or matching target stock.
- Shipment/source address snapshots must survive clinic address-book edits.
- Legacy counts, forecasts, lots, notices and request transfers must continue working with no clinic specified.

### Task 1: Clinic inventory and transfer persistence
**Files:** shared/surplus.ts, shared/domain.ts, shared/requestTransfers.ts, shared/shipmentPublishing.ts, server/utils/surplusClinicLocations.ts, server/utils/surplusStore.ts, server/utils/requestTransferInventory.ts, server/api/surplus/lots/[id]/clinic.post.ts, db/migrations/0014_surplus_clinic_locations.sql, test/helpers/surplusDb.ts, test/surplusClinicLocations.test.ts.
- [x] Write failing tests for two-clinic separation, ownership validation, safe assignment, exact-lot reservation, and source snapshot preservation.
- [x] Add migration, types, lot identity, snapshot validation, assignment transaction and transfer snapshot fields.
- [x] Run focused tests; expect passing plus existing transfer tests passing.

### Task 2: Clinic-aware reports and forecasts
**Files:** server/utils/surplusReports.ts, server/utils/submittedRequests.ts, test/surplusReports.test.ts and reporting-specific tests.
- [x] Add failing tests for reporting clinic retention, clinic validation and count confirmation.
- [x] Preserve validated clinic snapshots through submission, correction, forecast creation, and forecast confirmation.
- [x] Run reporting tests. Do not edit Task 1 files.

### Task 3: Inventory and Shipment UI
**Files:** app/pages/surplus.vue, app/components/RequestDetailDrawer.vue, app/components/AgencyTransferShipment.vue, app/components/RequestSurplusPanel.vue.
- [x] Show clinic labels and clinic filtering while preserving compact layout.
- [x] Add clinic selection to count/forecast/report forms and unspecified-stock assignment.
- [x] Filter source lots by clinic in Shipment; preserve exact-lot shortcut selection; show source clinic/address snapshots on transfers.
- [x] Verify build and browser behavior; no changes to server helpers owned by other tasks.

### Task 4: Integration and verification
- [x] Run complete tests and production build, inspect UI and migration compatibility.
- [x] Independent final review for agency boundaries, inventory identity, snapshots and stale/racing actions; fix findings.
- [x] Report local changes, verification, and migration requirement.

## Integration rulings and verification

- Explicit reviewer correction of a pending count's storage clinic is supported. Commands carry clinicId explicitly (including an empty string for unspecified), require it to match the selected lot, and update the report snapshot inside the reconciliation transaction. Without that explicit selection, a mismatched report/lot clinic is rejected.
- Original Request submission and drawer surplus reporting both have storage clinic selectors. Restoring a submission retains its actual storage clinic independently of its shipping clinic.
- Reviewer edits validate newly selected storage clinics; unchanged stored clinic references remain usable for unrelated edits if an address-book entry is later archived.
- Applied 0014 only to the local dev database. Verified the eight existing lots retain 54 on hand and 1 reserved, all with unspecified clinic.
- Full suite: 73 files, 372 tests passed. Production build passed. git diff --check passed.
- Browser verified clinic indicators, clinic filter, and Assign Clinic dialog restricted to the lot's agency; cancelled without assigning any existing stock.
- Independent review identified forecast clear-selection serialization and reviewer-only assignment button issues; both fixed and re-reviewed with no remaining P1/P2 findings.
- Changes remain local and uncommitted; earlier agency-wide request visibility changes are preserved. No production migration, data change, push, or deployment performed.
