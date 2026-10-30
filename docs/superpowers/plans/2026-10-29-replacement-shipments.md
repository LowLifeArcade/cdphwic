# Replacement Shipments and Case Reconciliation Implementation Plan

**Goal:** Link replacements to their original shipment; compact list summaries; warn reviewers when usable cases kept exceed original approval.
**Architecture:** Store replacement parent index, actual cumulative cases received, and audited return/destruction dispositions per shipment in existing request JSON. Reviewer-only append command creates replacements and freezes original approved cases if available; preserve the approval baseline once shipping begins. Shared totals include every original/replacement receipt and subtract only documented dispositions. Keep recording truth possible even above approval; show alerts rather than blocking accurate receipt. Compare counts to baseline, and warn if approval baseline is missing. List uses receipt counts and earliest outstanding dispatched ETA, with overdue indication, no tracking-number dump.
**Tech Stack:** Nuxt/Vue, TypeScript, D1, Vitest.

Approved: replacements remain in the original request, link back to affected shipment, independent receipt/issues, original issue stays open until explicitly resolved. User chose usable cases kept after documented returns/destruction for approval comparison. Actual counts may exceed shipped quantities; this should alert reviewers, never silently cap receipts.

- [x] Add tests for replacements, immutable links/baseline, actual receipt quantities, audited deductions and excess totals, permissions and stale updates, compact summary/next ETA.
- [x] Implement shared case/replacement commands plus server persistence/auth. Preserve shipment case metadata against stale saves.
- [x] Add per-shipment receipt/count/disposition/replacement controls and reviewer totals/alert.
- [x] Compact list status/ETA, use outstanding ETA sort, and add reviewer case-count tag.
- [x] Run tests/build, independent review, isolated browser checks. No push/deploy until requested.

Verification: 205 tests and production build pass. Independent review findings resolved with tests: duplicate replacement retries rejected by expected child count; ETA candidates exclude unsent drafts; shipment plan saves require current revision; completion recognizes originals closed as replaced. Isolated CDPH/WIC/Local Agency browser flow verified replacement creation + Send ETA, replacement receipt, closing missing original without false receipt, late original arrival (20 received/retained vs10 original approval) alert and list tag, then documented return10 clears excess while preserving20physical receipts. Compact list full date measured unclipped. No push/deploy performed.

Rulings: Actual cumulative counts may exceed planned shipment quantity; record truth and alert rather than cap. Approval baseline is server-managed/frozen once shipping starts; changing current Approved Cases does not erase original comparison. Original missing delivery can close as replaced only after a linked replacement is received (or closed through a replacement chain); close resolves its issue explicitly and records actor/date/notes. Physical receipt remains separate. Returns/destruction require positive case counts within cases received and a nonempty document reference/notes. All scoped users may record actual quantities/dispositions; only reviewers may create replacements, close originals as replaced, or edit shipment plans/approval limits.
