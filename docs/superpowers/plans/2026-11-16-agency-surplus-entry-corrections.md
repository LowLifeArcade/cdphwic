# Local Agency Surplus Entry Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let Local Agencies correct their own prior surplus counts, donations, and destruction entries without removing the original audit history.

**Architecture:** Add movement linkage fields and a `correct-entry` versioned inventory command that applies only the balance difference from the currently effective quantity. Expose correction actions in the lot History dialog for eligible agency movements.

**Tech Stack:** Nuxt/Vue, TypeScript, Cloudflare D1, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-agency-surplus-entry-corrections-design.md`

## Global Constraints

- A correction appends a linked inventory movement; it never changes or deletes the original movement.
- Agencies may correct only entries from lots owned by their authenticated agency and only agency-entered counts or Donation/Destruction movements.
- The agency may change the recorded quantity and must give a correction explanation. The original attestation staff name and date stay visible; the correction records the current actor and correction date.
- Apply only the quantity difference to the current inventory balance.
- Reject corrections that would make available stock negative, exceed the expired balance, or violate current reservations.
- CDPH/WIC reviewer report reconciliations and unrelated inventory movements are not eligible for agency correction.

## Review Focus

- Count correction uses `new count - current effective count`; test increase, decrease, and repeated correction.
- Donation/destruction correction reverses or adds to the deduction in the correct current balance bucket; test each action and repeated correction.
- A correction cannot reduce below available stock or expired units, and must preserve reservations; test both guards.
- Cross-agency, reviewer-report, and unsupported movements are rejected; test authorization.
- History preserves the original and shows the latest correction link/details; test API/UI formatting.

---

### Task 1: Linked correction command and history workflow

**Files:**
- Create: `db/migrations/0015_surplus_movement_corrections.sql`
- Modify: `shared/surplus.ts`
- Modify: `server/utils/surplusStore.ts`
- Modify: `server/api/surplus/history.get.ts`
- Modify: `app/pages/surplus.vue`
- Modify: `test/helpers/surplusDb.ts`
- Test: `test/surplusStore.test.ts`
- Test: `test/surplusCountUi.test.ts`
- Test: `test/surplusInventoryGroups.test.ts`

**Interfaces:**
- Add `corrects_movement_id` and `corrected_quantity` to `surplus_movements`.
- Extend `SurplusCommand.kind` with `correct-entry`; carry `correctionOf` as the original movement ID.
- The correction command receives corrected `quantity`, `reason` as correction explanation, `confirmerName` as correcting staff name, `date` as correction date, and `expectedVersion`.
- History responses expose eligibility and latest effective corrected quantity while retaining all original and correction movements.

- [ ] Test corrections for own-lot agency counts, donations, and destruction; test repeated correction uses the prior effective quantity.
- [ ] Test rejection for wrong agency, reviewer-reconciled reports, unsupported movement kinds, reserved-balance conflicts, insufficient expired stock, and stale versions.
- [ ] Run `npm test -- --run test/surplusStore.test.ts test/surplusCountUi.test.ts test/surplusInventoryGroups.test.ts` and confirm new tests fail.
- [ ] Add the migration and apply it in the in-memory test database.
- [ ] Implement agency-only `correct-entry` validation, difference-based balance updates, optimistic version checks, and appended linked movements.
- [ ] Extend the history endpoint to identify eligible original movements, attach latest corrected quantity, and retain correction linkage.
- [ ] Add a **Correct entry** action to eligible history rows with corrected quantity, required explanation, correcting staff, and date; show original and correction details together.
- [ ] Run focused tests, full `npm test`, `npm run build`, and `git diff --check`.
