# Local Agency Surplus Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Local Agencies record audited donations of near-expiry stock and destruction of expired stock from Available Inventory.

**Architecture:** Extend the existing deduction command with tightly scoped agency authorization and attestation. Add agency actions to lot rows and reuse the current modal and movement history.

**Tech Stack:** Nuxt/Vue, TypeScript, Cloudflare D1, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-16-agency-surplus-adjustments-design.md`

## Global Constraints

- Agencies may adjust only lots owned by their authenticated agency.
- Donation reductions are allowed only for unexpired lots expiring in 30–60 days, inclusive.
- Destruction reductions apply only to expired units and require a staff name and date of destruction.
- Both actions record the quantity and reason in the existing inventory movement history.
- CDPH/WIC retains its existing inventory adjustment capabilities.

## Review Focus

- Boundary dates at 29, 30, 60, and 61 days; test donation eligibility at each boundary.
- A user must not adjust another agency's lot or use another adjustment reason; test both rejections.
- Destruction quantity must not exceed expired units, and donation must not exceed unreserved on-hand units; test balance protection.
- Missing staff/date attestation must fail for agency destruction; test validation.
- Agencies must see only actions currently allowed for the selected lot; test UI visibility and existing reviewer actions.

---

### Task 1: Agency donation and destruction adjustments

**Files:**
- Modify: `server/utils/surplusStore.ts`
- Modify: `app/pages/surplus.vue`
- Test: `test/surplusStore.test.ts`
- Test: `test/surplusCountUi.test.ts`

**Interfaces:**
- Consumes: existing `executeSurplusCommand` with `kind: 'deduct'`, `reason`, `quantity`, `confirmerName`, and `date`.
- Produces: agency users may use `deduct` only for eligible own-lot `Donation` or `Destruction` actions; no new endpoint.

- [ ] Add server tests for 29/30/60/61-day donation boundaries, own-lot restrictions, destruction of expired balance with staff/date attestation, and rejection of ineligible quantities.
- [ ] Run `npm test -- --run test/surplusStore.test.ts` and confirm new cases fail for the missing agency authorization.
- [ ] Extend `executeSurplusCommand` agency authorization to allow only eligible donations and destructions, require attestation, and preserve existing reviewer handling.
- [ ] Add agency-visible per-lot Donation and Record destruction actions only when eligibility conditions are met; collect staff/date and submit through the existing command.
- [ ] Update UI tests to assert action wording and eligibility guards.
- [ ] Run focused tests, full `npm test`, `npm run build`, and `git diff --check`.
