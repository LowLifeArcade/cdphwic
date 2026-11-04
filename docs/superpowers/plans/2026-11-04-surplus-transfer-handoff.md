# Surplus Transfer Handoff Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task with regression tests.

**Goal:** Make Request Shipment the primary reservation workspace and enforce sending-agency stock confirmation before shipping.
**Architecture:** Extend request-linked transfers with stock confirmation metadata. Reuse existing request transactions, label storage, shipment publication, inventory accounting, and notices. Surplus becomes a focused inventory/agency-action workspace with a request shortcut.
**Tech Stack:** Nuxt/Vue, TypeScript, D1 SQLite, R2, Vitest.
**Spec:** docs/superpowers/specs/2026-11-04-surplus-transfer-confirmation-design.md

## Global Constraints

- Only sending agencies confirm stock and pickup; only reviewers publish shipping details and labels.
- Deduct stock only at pickup; preserve dispatched histories and participant privacy.
- Existing reservations need confirmation; shipped and received records remain unchanged.
- Both entry points use request-linked authorization, never the legacy free-text reservation form.
- No deployment or push in this implementation.

## Review Focus

- Wrong-agency and reviewer confirmation attempts must fail without modifying inventory.
- Repeated confirmations and racing expiry/cancellation must not advance invalid transfers.
- Label and shipping readiness notices must use separate read identities from stock confirmation.
- A stock shortcut must match the selected request formula and survive asynchronous inventory loading.
- Existing legacy transfer history remains visible without exposing misleading reviewer confirmation actions.

### Task 1: Agency confirmation and handoff notices

**Files:** db/migrations/0013_transfer_stock_confirmation.sql; shared/domain.ts; shared/surplus.ts; server/utils/requestTransfers.ts; server/utils/requestTransferInventory.ts; server/utils/surplusNotices.ts; server/utils/requestNotices.ts; server/utils/transferShippingLabels.ts; server/api/request-transfers/[id]/confirm-stock.post.ts; test/helpers/surplusDb.ts; test/requestAgencyTransfers.test.ts; test/transferShippingLabels.test.ts.
**Interfaces:** `confirmRequestTransferStock(db,id,user)` records trusted confirmation and returns transfer logistics. `saveRequestTransferEta` requires confirmation and labels. `shipRequestTransfer` requires confirmation, labels and sent logistics.
- [x] Add tests proving immediate source-only notice, confirmation permissions/idempotency, reviewer handoff, label readiness, stock unchanged until pickup, invalid/expired transitions.
- [x] Run focused tests and observe missing workflow failures.
- [x] Add migration, transactional confirmation, server gates and distinct notice stages; adapt existing lifecycle fixtures to the required steps.
- [x] Run transfer and label tests; expect all passing.

### Task 2: Shipment workspace and Use in Request shortcut

**Files:** shared/requestTransfers.ts; app/components/RequestDetailDrawer.vue; app/components/AgencyTransferShipment.vue; app/components/TransferShippingLabels.vue; app/components/NotificationInbox.vue; app/pages/surplus.vue; test/requestTransferShortcut.test.ts.
**Interfaces:** A reviewer-only Surplus shortcut selects a request, navigates to `/requests?request=ID&surplusLot=ID#shipments-ID`, and preselects matching stock in an unsent agency shipment. Confirmation and labels readiness appear in the corresponding workspace.
- [x] Add failing tests for compatible shortcut selection and rejection of wrong agency/formula/expired or unavailable lots.
- [x] Implement pure shortcut draft selection and connect route, inventory and product data in the drawer.
- [x] Rename Authorize to Reserve Stock; show stock status and disable shipping until confirmed/labels uploaded. Update agency confirmation and pickup actions.
- [x] Run shortcut/transfer tests and production build.

### Task 3: Surplus cleanup and final verification

**Files:** app/pages/surplus.vue; docs/superpowers/plans/2026-11-04-surplus-transfer-handoff.md.
**Interfaces:** Inventory / Transfers / Counts & Forecasts navigation preserves transfer deep links. Reviewer transfer cards link to Shipment; agency cards own confirmation/pickup. Inventory corrections use a row action menu.
- [x] Separate views, put inventory first, add request shortcut, remove standalone reservation creation and misleading legacy reviewer confirmation actions while preserving records/history/cancellation.
- [x] Run `npm test` and `npm run build`; review final diff and server authorization paths.
- [x] Record verification results and any deployment prerequisites.

## Execution notes

- Continue in the existing feature branch to keep this user-directed change in the shared checkout. No worktree, push, or deployment is required.
- The user approved the design and primary Shipment approach with the Use in Request shortcut. Execute the plan inline without another approval round.

## Verification results

- Full suite: 70 test files, 352 tests passed.
- Production build: passed (Nuxt/Nitro Cloudflare module).
- Browser check: Inventory / Transfers navigation works; Use in Request lists compatible requests and opens Shipment with source lot/formula preselected and no automatic reservation. Shipment deep link scroll verified after mount.
- Independent code review: no actionable findings in permissions, participant privacy, inventory/revision transactions, notice handoffs, or shortcut selection.
- Applied pending migrations 0012 and 0013 only to the local dev database for verification. Migration 0013 must be applied to each deployed environment before serving the new code; apply any other pending migrations as usual.
- Existing unlinked legacy transfers remain visible with history and unshipped cancellation. New reservations use the request Shipment section.
- Changes remain uncommitted in the existing feature branch; no push or deployment performed.
