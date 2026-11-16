# Local Agency Surplus Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Local Agencies attest to their own physical surplus counts, make those counts available immediately, and reduce inventory-list clutter while preserving lot-level expiration tracking.

**Architecture:** Add an agency-scoped count endpoint that updates owned inventory through the existing versioned reconcile command. Group the inventory display by agency, formula, form, flavor, and clinic; show aggregate totals for multi-expiration groups and expand to the original per-lot rows for expiration details and actions.

**Tech Stack:** Nuxt/Vue, TypeScript, Cloudflare D1, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-agency-surplus-count-design.md`

## Global Constraints

- An agency count changes only inventory belonging to the authenticated agency and becomes available immediately after a successful save.
- Count history records authenticated actor, staff name, count date, clinic, expiration, and optional reason.
- An agency cannot use the count action for deductions, reservations, expiry corrections, or reviewer report reconciliation.
- Existing CDPH/WIC pending-report reconciliation remains unchanged.
- Display groups include agency and clinic; lots remain separate by expiration date and keep their existing actions.

## Review Focus

- A count below reserved units must fail without changing inventory; test in Task 1.
- Invalid, future, or missing count date and invalid/foreign clinic must fail; test in Task 1.
- Agency commands on another agency's lot or non-reconcile actions must fail; test in Task 1.
- Group summaries must sum lot counts correctly, and same formula at another clinic/agency must stay in a separate group; test in Task 2.
- Agencies must see the count form and a multi-expiration group must expose per-lot actions; test in Task 3.

---

### Task 1: Agency-attested count service and authorization

**Files:**
- Modify: `server/utils/surplusReports.ts`
- Modify: `server/utils/surplusStore.ts`
- Create: `server/api/surplus/counts.post.ts`
- Test: `test/surplusReports.test.ts`
- Test: `test/surplusStore.test.ts`

**Interfaces:**
- Add `submitAgencySurplusCount(db: D1Database, user: SessionUser, input: AgencySurplusCountInput, today?: string)` to `surplusReports.ts`.
- Input fields: `operationId`, `formulaName`, `form`, optional `flavor`, optional `clinicId`, `quantity`, `expirationDate`, `date`, `confirmerName`, optional `reason`.
- The handler reads user identity through `surplusContext` and passes the request body to the service.
- `executeSurplusCommand` allows an agency only to reconcile its own lot without `reportId`, and validates date/staff attestation for that path.

- [x] Test that an agency count creates or updates its own lot immediately and records actor, staff, date, and reason in movement history.
- [x] Test invalid count fields, reserved-balance protection, foreign clinics/lots, and non-reconcile actions.
- [x] Run `npm test -- --run test/surplusReports.test.ts test/surplusStore.test.ts` and confirm the new tests fail before implementation.
- [x] Implement `submitAgencySurplusCount` with agency/form/count/date/staff/clinic validation, lot creation, and a versioned `reconcile` command.
- [x] Restrict agency use of `executeSurplusCommand` to the validated own-lot reconciliation path; preserve reviewer operations.
- [x] Add `POST /api/surplus/counts` wired to the service.
- [x] Run focused tests and confirm they pass.

### Task 2: Group inventory lots for display

**Files:**
- Create: `shared/surplusInventoryGroups.ts`
- Test: `test/surplusInventoryGroups.test.ts`

**Interfaces:**
- Add `groupSurplusLots(lots: SurplusLot[]): SurplusLotGroup[]`.
- Each group is keyed by agency, normalized formula name, form, normalized flavor, and clinic; it carries its sorted lots and aggregate on-hand, reserved, available, expired, total, and earliest-expiration values.
- Lots remain unchanged and individually addressable in the returned group.

- [x] Test aggregation, expiration ordering, and separation by agency and clinic.
- [x] Run the focused test and confirm it fails before implementation.
- [x] Implement the pure grouping helper and verify the test passes.

### Task 3: Agency count form and compact inventory view

**Files:**
- Modify: `app/pages/surplus.vue`
- Create: `shared/surplusMovement.ts`
- Create: `test/surplusCountUi.test.ts`

**Interfaces:**
- The Counts view exposes **Record physical count** to reviewers and **Record surplus count** to agencies.
- Agency submission posts to `/api/surplus/counts`; reviewer count/reconcile behavior remains unchanged.
- Multi-lot groups show a summary row and expandable per-expiration rows; single-lot groups retain their current direct row and actions.

- [x] Test the agency count action, clinic/date/staff attestation fields, and multi-lot expansion with lot-specific actions.
- [x] Run the focused test and confirm it fails before implementation.
- [x] Add the agency form, default agency from the authenticated session, and route agency submissions to the new endpoint.
- [x] Replace the flat list with grouped summaries and expandable lot rows; keep single-lot display/actions intact.
- [x] Update inventory helper text to explain agency-attested counts become available immediately.
- [x] Format count attestation details into readable inventory history.
- [x] Run focused tests, full `npm test`, `npm run build`, and `git diff --check`.
