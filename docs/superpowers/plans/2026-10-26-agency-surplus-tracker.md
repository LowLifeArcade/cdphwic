# Agency Surplus Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maintain verified agency surplus, deductions, transfers, and anticipated-surplus confirmations without double-counting or overspending inventory.

**Architecture:** Use the existing D1 binding for durable reports, forecasts, lots, transfers, movements, and idempotency. Surplus reports are reviewed stock counts; forecasts remain separate until an agency count is reviewed. Request and tracker screens call shared inventory services; mutations run through database-guarded atomic commands.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Cloudflare Workers/D1, existing R2 attachment storage, Vitest and local Wrangler integration tests. Preserve installed dependency versions.

**Spec:** `docs/superpowers/specs/2026-10-26-surplus-tracker-design.md`

## Global Constraints

- Duration is a whole number from 1 through 6 months.
- Quantity is measured in individual units throughout this first version.
- Reserved must never exceed on hand.
- Saving an incomplete form does not change inventory.
- A confirmed count cannot be below active reservations; resolve those reservations first.
- Admin and FPU record shipment and receipt after confirmation from the agencies.
- Transfer quantity is fixed after reservation.
- Donation notices are in-app only, as selected by the user. Donation notification delivery is implemented by the companion plan.
- Inventory operations must remain correct across Worker restarts.
- Prepare and test migrations locally; do not migrate production or deploy during implementation.

## Review Focus

- Concurrent reservations for the last units must not overspend; Task 2 tests two competing reservations.
- An agency's repeated report is a stock count, not new stock; Task 3 tests repeated submission and stale reports.
- Blank/Other formula variants, case differences, and distinct expiration dates must not accidentally merge; Task 1 pins normalization.
- A physically received order is not confirmed redistributable surplus; Task 4 tests receipt without surplus confirmation.
- Failed request attachment/report handoff must preserve a recoverable incomplete form and prevent duplicate reports; Task 3 injects failures at each boundary.

## File map

Create `shared/surplus.ts` for domain types and pure rules; `db/migrations/0006_surplus_inventory.sql` for durable inventory; `server/utils/surplusStore.ts` for database commands; `server/utils/surplusAccess.ts` for permissions; `server/utils/surplusReports.ts` for report/submission handoff; `server/utils/surplusForecasts.ts` for anticipated/actual confirmation. Add API routes under `server/api/surplus/`. Create `app/pages/surplus.vue`, `SurplusLotTable.vue`, `SurplusActionDialog.vue`, `RequestSurplusPanel.vue`, and `AgencySurplusConfirmation.vue`. Keep the existing request detail component focused by mounting the new panel rather than embedding the tracker.

### Task 1: Inventory model, migration, and pure rules

**Files:** create `shared/surplus.ts`, `db/migrations/0006_surplus_inventory.sql`, `test/surplusRules.test.ts`, `test/surplusSchema.test.ts`.

**Interfaces:** export `SurplusVariant { formulaName: string; form: ProductForm; flavor: string; expirationDate: string }`, `SurplusLot { id: string; agencyId: number; variant: SurplusVariant; onHand: number; reserved: number; version: number }`, `SurplusActor { userId: number; role: 'admin'|'fpu'|'agency'; agencyId?: number }`, and `TransferState = 'reserved'|'shipped'|'received'|'cancelled'`. Export `variantKey(variant): string`, `availableUnits(lot): number`, `validateUnits(value): string`, `canAllocate(lot, quantity, today): boolean`.

- [ ] Write rule tests: identical canonical variants normalize consistently; powder and RTF do not merge; Vanilla and Chocolate do not merge; different expiration dates do not merge; quantities 0, -1, 1.5, NaN fail; available(10 on hand, 3 reserved) equals 7; 8 cannot be allocated; expired or undated stock cannot allocate.
- [ ] Run `npm test -- test/surplusRules.test.ts`; confirm new tests fail before implementation.
- [ ] Implement the exported rules and tables for lots, reports, forecasts, transfers, movements, submission snapshots, and idempotency. Use UUID text IDs and integer unit constraints. Preserve original entered names for display; canonical matching uses catalog names and normalized Other names.
- [ ] Write schema tests using a fresh `node:sqlite` database loaded from the migration: invalid negative balances and reserved > on hand are rejected; duplicate source-report IDs and operation keys are rejected. Do not rely on seeded request IDs as foreign keys because submitted requests currently use the demo store.
- [ ] Run both test files and commit only task files with `feat: define durable surplus inventory`.

### Task 2: Atomic deductions and transfers

**Files:** create `server/utils/surplusStore.ts`, `server/utils/surplusAccess.ts`, `test/surplusStore.test.ts`, `test/surplusAccess.test.ts`, and `scripts/verify-surplus-local.mjs`.

**Interfaces:** `executeSurplusCommand(db: D1Database, actor: SurplusActor, command: SurplusCommand): Promise<SurplusCommandResult>`; `getSurplusLots(db, actor, filters): Promise<SurplusLot[]>`; `getSurplusHistory(db, actor, lotId): Promise<SurplusMovement[]>`. Commands are `reconcile {lotId, countedUnits, expectedVersion, reportId, reason, operationId}`, `deduct {lotId, quantity, requestRef, reason, operationId}`, `reserve {lotId, destinationAgencyId, quantity, requestRef, operationId}`, `ship {transferId, shippedDate, trackingReference?, operationId}`, `receive {transferId, receivedDate, operationId}`, and `cancel {transferId, reason, operationId}`. Define command/result/history types in `shared/surplus.ts`.

- [ ] Write tests for Admin/FPU mutations, agency read isolation, and agency mutation rejection. Admin/FPU may inspect all source agencies.
- [ ] Write transaction tests: start 10 units, reserve 4 => (onHand 10, reserved 4, available 6); ship => (6,0,6); receive => destination gains 4 once. Cancel an unshipped reservation restores availability; cancelling after shipping fails without mutation. A deduction cannot consume reserved stock.
- [ ] Run tests and confirm failure before implementing commands.
- [ ] Implement guarded atomic SQL and append-only history. Every balance mutation and its event/idempotency result commit together or roll back together. Treat affected-row mismatches as conflicts. Returning a stored result on an operation-ID retry must not mutate balances again.
- [ ] Add local Wrangler integration assertions for two concurrent reservations against the last units, stale reconciliation, duplicate transitions, restart persistence, and insufficient balance. Keep all test data in local storage; never target remote D1.
- [ ] Run unit tests plus the local integration script against the migrated local dev environment. Commit with `feat: add atomic surplus deductions and transfers`.

### Task 3: Request surplus reports and reliable handoff

**Files:** create `server/utils/surplusReports.ts`, `test/surplusReports.test.ts`; modify `server/api/requests/index.post.ts`, `app/pages/requests/new.vue`, and `server/utils/requestDraftStore.ts` only for durable submission/report references.

**Interfaces:** `recordSurplusSubmission(db, actor, input: { submissionId: string; requestSnapshot: RequestRecord; rows: SurplusReportInput[] }): Promise<SurplusSubmissionResult>`; `reviewSurplusReport(db, actor, input: { reportId: string; action: 'confirm-count'|'already-accounted'|'reject'; expectedVersion?: number; countedUnits?: number; reason: string; operationId: string }): Promise<SurplusCommandResult>`. A report row has stable `rowId`, variant, reportedUnits, reportedAt, and agencyId. Submission ID is a UUID created once and preserved through incomplete-form saves/retries.

- [ ] Write tests: incomplete Save creates no inventory report; submitted rows create pending reports with zero balance effect; retrying the same submission/row IDs creates no duplicates; a count of 6 against a verified 6 does not make 12; stale review is rejected; a missing expiration remains unallocatable.
- [ ] Add injected-failure tests around attachment promotion, report persistence, and draft cleanup: unsuccessful handoff preserves the draft/temp upload; successful retry returns the original submission result, not a duplicate request/report. Durable inventory references remain meaningful after the demo request store resets.
- [ ] Run tests, confirm failure, then implement the report service and handoff. Persist a request snapshot sufficient to return the original submission result and show inventory history even after Worker restart. Do not delete temporary attachments/incomplete copies until the durable handoff succeeds.
- [ ] Integrate report review with Task 2 reconciliation. A count confirmation explicitly shows existing balance and reserved stock; it is not an additive receipt.
- [ ] Run report/attachment/draft tests and commit with `feat: collect and reconcile agency surplus reports`.

### Task 4: Anticipated surplus and agency actual counts

**Files:** create `server/utils/surplusForecasts.ts`, `test/surplusForecasts.test.ts`, `app/components/AgencySurplusConfirmation.vue`; modify `app/components/RequestDetailDrawer.vue` to mount the confirmation panel and retain existing ordering fields.

**Interfaces:** `createSurplusForecast(db, actor, {requestRef, agencyId, variant, expectedUnits, confirmationDueDate, operationId}): Promise<SurplusForecast>`; `confirmActualSurplus(db, actor, {forecastId, actualUnits, expirationDate, countedAt, confirmerName, varianceReason, operationId}): Promise<SurplusReport>`; `listSurplusForecasts(db, actor, filters): Promise<SurplusForecast[]>`. A forecast progresses `awaiting-count -> pending-review -> reconciled`; a new/revised forecast preserves prior versions and never mutates verified balances. Task 3 review links a confirmed report back to its forecast.

- [ ] Write tests: forecast 8 changes available balance by zero; delivery acknowledgement alone leaves it awaiting-count; agency confirms 5 with explanation => pending-review with variance -3 and still no balance change; zero is valid; a nonzero variance without explanation fails; only successful reviewer reconciliation closes the forecast.
- [ ] Run tests, confirm failure, then implement due-date/overdue queries, agency ownership checks, variance validation, and forecast/report links. Count confirmations must represent uncommitted redistributable units, not the whole delivered order.
- [ ] Build the agency confirmation form with actual quantity, count date, expiration, staff name, and variance explanation. Show anticipated and actual separately and keep outstanding/overdue confirmations visible.
- [ ] Run tests and commit with `feat: reconcile anticipated surplus with agency counts`.

### Task 5: Authorized API and review/tracker screens

**Files:** create `server/api/surplus/index.get.ts`, `commands.post.ts`, `reports.get.ts`, `reports/review.post.ts`, `forecasts.get.ts`, `forecasts/index.post.ts`, `forecasts/confirm.post.ts`; create `app/pages/surplus.vue`, `SurplusLotTable.vue`, `SurplusActionDialog.vue`, `RequestSurplusPanel.vue`; modify `shared/navigation.ts`, `app/components/RequestDetailDrawer.vue`; test `test/surplusApi.test.ts` and `test/surplusNavigation.test.ts`.

**Interfaces:** routes delegate to the exact services above. GET `/api/surplus` returns `{lots, pendingReports, forecasts, transfers}` filtered by authorized scope. POST `/api/surplus/commands` accepts `SurplusCommand`. The request panel consumes `{requestRef, requestedFormulas, agencyId}` and emits `changed` after a successful mutation.

- [ ] Write API tests for agency cross-scope reads/mutations, Admin/FPU all-agency reads, invalid quantities, stale versions, repeated operation IDs, and expired lots. Return 403 for unauthorized actions and 409 for inventory conflicts.
- [ ] Run failing tests, then implement thin routes and Surplus navigation. Display agency, formula variant, expiry, on hand, reserved, available, forecasts, reports, transfers, and history. Agency users see their own balance and relevant transfer/confirmation records.
- [ ] Add request review actions for using local surplus and reserving stock from another agency. Confirm dialogs display quantity, source/destination, resulting availability, and the request reference. Record shipment/receipt/cancellation through the same shared commands.
- [ ] Verify in a local browser: report -> reviewed count -> deduction -> reservation -> ship -> receive, and agency forecast confirmation. Verify a second reviewer receives a conflict instead of overspending. Verify errors preserve entered values.
- [ ] Run API/navigation tests and commit with `feat: expose agency surplus tracker and review actions`.

### Task 6: Whole-feature verification and release preparation

**Files:** update `scripts/verify-surplus-local.mjs`; create `docs/surplus-operations.md` with local migration and release commands, role behavior, forecast/count meanings, and recovery guidance.

- [ ] Run `npm test` and `npm run build`; confirm zero failures and exit 0.
- [ ] Run the isolated local migration/inventory verification script and repeat after restarting the local Worker. Check saved incomplete forms, attachments, two-formula variants, and month selections continue working.
- [ ] Review the diff for hidden direct inventory mutations, additive treatment of stock reports, missing role checks, lost retry keys, stale read-modify-write operations, and remote migration/deployment commands.
- [ ] Record evidence and migration prerequisites. Obtain a fresh whole-feature review before integration. Commit documentation/verification changes with `docs: document surplus operations and local verification`.

## Self-review

Core spec coverage is assigned to Tasks 1–6, including all five Review Focus conditions. Forecast reconciliation is Task 4; time-based donation notices and the future attachment are in the companion donation-notices plan. No new external service or dependency is assumed. Production migrations and deployment remain release actions, not implementation steps.
