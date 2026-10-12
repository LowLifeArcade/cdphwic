# Request Detail Workflow Redesign Implementation Plan

> **Implementation note:** Execute this plan task-by-task, keeping the existing request-detail behavior intact unless a task explicitly changes it.

**Goal:** Reorganize the request detail drawer into the requested participant, request, CDPH/WIC, LA follow-up, local agency, and shipment sections, while persisting requested months, approval/order values, receipt states, and surplus inventory rows.

**Architecture:** Extend the shared `RequestRecord` shape and reuse the existing request `PUT` endpoint and in-memory store. Keep participant/request display data in the drawer, keep staff-only editing behind the existing identity checks, and keep agency follow-up edits behind the existing agency/admin checks. Reuse existing tracking carrier and received-status fields.

**Testing:** Vitest tests in `test/`, followed by the project’s full test suite and production build.

## Task 1: Extend the request domain model and validation helpers

**Files:**
- Modify `/Users/Sonny/apps/cdphwic/shared/domain.ts`
- Modify or create the focused request validation/helper module under `/Users/Sonny/apps/cdphwic/shared/`
- Add tests under `/Users/Sonny/apps/cdphwic/test/`

1. Add optional fields to `RequestRecord`:
   - `benefitMonthsRequested?: string[]`
   - `approvedCases?: number`
   - `approvedMonths?: number`
   - `casesOrdered?: number`
   - `expectedSurplus?: number`
   - `surplusItems?: { productName: string; units: number; expirationDate: string }[]`
2. Add pure validation/normalization helpers for unique `YYYY-MM` requested months and non-negative numeric staff/surplus values.
3. Validate surplus rows as a complete unit: product name, units, and expiration date are required; units must be non-negative.
4. Add unit tests for valid values, duplicate/invalid months, negative numbers, and incomplete surplus rows.

## Task 2: Add request-detail state and save payload support

**Files:**
- Modify `/Users/Sonny/apps/cdphwic/app/components/RequestDetailDrawer.vue`
- Modify `/Users/Sonny/apps/cdphwic/server/api/requests/[id].put.ts` only if request payload handling needs explicit normalization
- Add/update tests in `/Users/Sonny/apps/cdphwic/test/`

1. Initialize the new draft fields from the request without sharing mutable arrays with props.
2. Add requested-month state and staff-only add/remove controls; store canonical `YYYY-MM` values and render month labels such as `October 2026`.
3. Preserve Benefits Start Date editing after moving its display into the participant summary.
4. Include all new fields in the staff and LA save payloads, preserving existing fields and avoiding accidental overwrites when one section saves.
5. Add tests that assert update payloads include requested months, approval/order values, and surplus rows.

## Task 3: Rebuild participant and request overview presentation

**File:**
- Modify `/Users/Sonny/apps/cdphwic/app/components/RequestDetailDrawer.vue`

1. Add the participant summary beside the participant name with exact labels:
   - WIC Family ID
   - WIC Individual ID
   - Date of Birth
   - Medi-Cal
   - Benefits Start Date
2. Remove those identity fields from their old locations where duplication would occur.
3. Move Diagnosis into Request overview.
4. Remove Benefits Start Date from Request overview.
5. Add Benefit Month(s) Requested selection/display behavior with staff editing and read-only non-staff display.
6. Rename the requested labels exactly, including Medi-Cal and WIC capitalization.

## Task 4: Replace Staff processing with CDPH/WIC Use Only

**File:**
- Modify `/Users/Sonny/apps/cdphwic/app/components/RequestDetailDrawer.vue`

1. Rename the section to CDPH/WIC Use Only.
2. Rename Amount prescribed to Amount Approved in the staff section.
3. Add approved cases and approved months, displaying them together as `___ Case(s) for ___ Month(s)`.
4. Add Cases Ordered and Expected Surplus numeric inputs.
5. Show `Please provide X units of product on hand.` using the expected-surplus value.
6. Preserve current status, special-order, staff-note, denial, authorization, and benefit-issuance behavior.
7. Keep staff-only permissions and existing minimum/required constraints consistent with the current drawer.

## Task 5: Replace Agency follow-up with LA Follow-Up and add surplus inventory

**File:**
- Modify `/Users/Sonny/apps/cdphwic/app/components/RequestDetailDrawer.vue`

1. Rename the section to LA Follow-Up.
2. Add explicit receipt actions for received, damaged, and missing shipments, preserving the existing completion behavior only for received shipments.
3. Add repeatable Surplus rows with Product Name, Number of Units, and Expiration Date.
4. Add row add/remove controls and a confirmation flow if removal is destructive to an already-saved row, using the existing application modal rather than browser alerts.
5. Preserve notes and photo upload behavior.
6. Add tests for each receipt state and surplus-row editing/validation.

## Task 6: Rename Local Agency Info and Shipment sections

**File:**
- Modify `/Users/Sonny/apps/cdphwic/app/components/RequestDetailDrawer.vue`

1. Rename Local agency and representative to Local Agency Info.
2. Rename Local agency to Local Agency, Address to Shipping Address, and LA representative to Contact.
3. Rename Delivery to Shipment.
4. Display ETA in `MM-DD-YYYY` form while retaining the existing input/storage representation.
5. Display carrier values next to tracking information, supporting existing tracking-number arrays and carrier values.
6. Add focused tests for label changes, ETA formatting, and carrier display.

## Task 7: Verify compatibility and integration behavior

**Files:**
- Update affected tests under `/Users/Sonny/apps/cdphwic/test/`
- Update `/Users/Sonny/apps/cdphwic/server/utils/authorizationForm.ts` only if the renamed request-detail labels are intentionally shared by the generated authorization form

1. Run the focused request-detail and domain tests.
2. Run the complete Vitest suite.
3. Run the production build/type checks.
4. Review the diff for accidental changes to PDF parsing, formula selection, R2 handling, phone normalization, and unrelated request flows.
5. Verify that old request records without the optional fields still render and save safely.

