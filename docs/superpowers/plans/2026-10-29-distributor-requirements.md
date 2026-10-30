# Distributor Requirements Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show distributor damage requirements at receipt and support evidence and exact-unit replacements.
**Architecture:** Persistent D1 distributor profiles supply versioned shipment snapshots at Send ETA. Trusted commands maintain policy overrides/evidence separately from generic edits; private R2 stores images. Unit math extends shipment plans while preserving legacy case data.
**Tech Stack:** Nuxt/Vue, TypeScript, D1, R2, Vitest.
**Spec:** docs/superpowers/specs/2026-10-29-manufacturer-issue-requirements-design.md

## Global Constraints
Preserve existing uncommitted work; no push/deploy. Local Agency reads defaults and provides evidence; CDPH/WIC/Admin manage policies and replacements. Evidence never changes inventory. Snapshot dispatched policies and packaging, retain audit/deleted issues and original approval limits.

## Review Focus
Legacy free-text suppliers must not acquire invented policies. Profile changes must not rewrite dispatched snapshots. Scope image access to the request and retain deleted issue evidence. Changing replacement basis must preserve dispatched exact-unit quantities. Stale evidence/policy edits must not overwrite other updates.

### Task 1: Profiles and policy snapshots
Files: shared/distributors.ts; shared/domain.ts; db/migrations; server/utils/distributors.ts; server/api/distributors; server/utils/submittedRequests.ts; test/distributors.test.ts.
- [x] Write failing validation/snapshot tests: policy booleans, name, replacement basis, legacy supplier, dispatched snapshot preservation.
- [x] Run focused tests to confirm failure, implement profile validation and versioned D1 CRUD with reviewer authorization and CAS revisions.
- [x] Implement Send ETA snapshot and trusted audited override command; protect metadata from generic updates.
- [x] Add Distributors management page/sidebar and shipment supplier selection; run focused tests.

### Task 2: Exact-unit replacement shipping
Files: shared/requestShipments.ts; shipmentQuantities.ts; shipmentReceipts.ts; shipmentCaseTracking.ts; RequestDetailDrawer.vue; test/shipmentPartialReceipts.test.ts.
- [x] Write failing tests for individual-unit expected/missing quantities, whole-case enforcement and unchanged historical snapshot.
- [x] Add looseUnitsShipped and durable originating issue/basis metadata to replacements; update exact expected-unit calculations, receipt keys and immutable guards.
- [x] Add reviewer shipping inputs and exact-quantity displays; verify approval-cap accounting includes retained original good units.

### Task 3: Evidence and requirement UI
Files: shared/shipmentEvidence.ts; server/utils/shipmentEvidence.ts; server/api/requests/[id]/evidence; app/components/ShipmentRequirementsPanel.vue; ShipmentReceiptPanel.vue; ShipmentIssuePanel.vue; tests.
- [x] Write failing tests for image signatures, scoped attachment lookup including deleted audits, missing-only exemption and inventory invariance.
- [x] Implement trusted label-sent command and bounded private image upload (JPEG/PNG/WebP, 10MB, max10 per issue), CAS writes and cleanup on failure.
- [x] Add requirements panel above receipt, reviewer override controls, agency labels/date/reference and image upload/view within issue; preserve evidence when requirements change.
- [x] Run full tests/build; independently review changes and fix findings; verify isolated browser workflows. Record results without pushing.

## Completion ledger
Ruling: Continue in the existing feature checkout and preserve all prior pending edits — the shipment work already lives here and depends on them. No commit, push or deployment performed.
Ruling: Explicit shipment overrides survive later Save/Send ETA; profile updates refresh ordinary undispatched defaults only. A replacement using the same distributor inherits the original shipment policy, including exceptions.
Ruling: Historical records with a known packaging snapshot freeze Units per Case; unknown-packaging legacy case records may acquire confirmed packaging without changing their case totals.
Review fixed overridden-policy reset, replacement report evidence loss, and mutable known legacy packaging. Regression tests cover each.
Verification: 228 tests across 54 files pass; production build passes; git diff --check clean. Local-only migration 0010 applied to both normal dev and isolated review state. Isolated browser verified profile creation, immediate agency requirements, label reference, private image upload/view, CDPH/WIC agency-control removal, and a 2-can replacement retaining 4 good original cans. No production data changed.

## Follow-up: immediate distributor preview
Root cause: selection updated the shipment draft while the requirements panel read the persisted request. Added a non-mutating preview helper that follows existing snapshot/override rules, supports new shipments, and labels unsaved policies. Override controls remain unavailable until the selected requirements are saved. Watched three regression tests fail before implementing the helper, then verified 231 tests across 55 files and a successful production build. Isolated CDPH/WIC browser verification showed requirements immediately on both an existing and a newly added shipment, with no request writes. Independent review found no material issues. Not pushed.

## Follow-up: damage-only Local Agency display
User removed the preview requirement. Removed the CDPH/WIC shipment requirements panel and obsolete preview helper/tests. Requirements now display only in Local Agency damage reports or when entering damaged receipt quantities; missing-only and ordinary receipts do not show them. CDPH/WIC retains submitted evidence access. Verified 229 tests across 55 files, production build, and isolated browser checks: CDPH requirements0/evidence1; agency damaged shipment1; opening a second damage report2; switching that report to Missing returns1. No changes saved during UI verification. Not pushed.
