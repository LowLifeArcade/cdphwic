# Individual Shipment Issues Implementation Plan

**Goal:** Local Agency can report and resolve an issue independently for each shipment while confirming other shipments.
**Architecture:** Add a shipment issue object to existing request JSON with type, notes, reporting/resolution actor and time. A dedicated authenticated command validates shipment content and expected issue state. Shared aggregate logic keeps requests incomplete while issues remain, preserves receipts and issue records against stale saves, and feeds existing Shipment Issue filter. Replace request-wide new issue reporting with inline per-shipment reporting, retaining old request-wide history.
**Tech Stack:** Nuxt/Vue, TypeScript, D1, Vitest.

- [x] Test independent reports, confirming unaffected shipments, active issue confirmation blocking, resolution, invalid/stale reports, permissions, and stale shipping saves.
- [x] Implement shared issue commands, trusted persistence, aggregate status and generic-update protection.
- [x] Add Report Issue, issue details and resolution controls to each shipment. Keep list free of checkboxes.
- [x] Run tests/build, review, and verify isolated Local Agency UI flow. Do not push.

Verification: 188 tests pass and production build succeeds. Independent review findings fixed: issue status must not alter sent/unsent eligibility, and request navigation must destroy old issue editors. Added dispatch-state regression tests and keyed panels by request identity. Isolated Local Agency UI verified Incomplete report for Shipment 2, receipt of unaffected Shipment 3, issue resolution, final receipt/completion, and draft isolation across next/previous navigation. Requests list remains free of shipment checkboxes. No push/deploy performed.

Ruling: Existing report types (Damaged, Missing, Incomplete) and optional notes are used per shipment. Resolving an issue does not imply receipt; an unreceived shipment still requires confirmation. Legacy received/shipped state is materialized without inventing receipt dates or actors. Reported shipment details are preserved during staff saves.

Follow-up: Add CDPH/WIC/Admin responses saved as a dated response history under each active shipment issue, visible to both views. Local Agency/Admin may Resolve and Mark Received in one atomic command; other shipments and unresolved issues remain untouched. Responses do not resolve the issue. Preserve response history when the local agency updates an open report. Validate permissions and stale issue state on the server.

Follow-up verification: 191 tests and production build pass. Independent review found no actionable response/resolution bugs. Isolated browser verified Local Agency Missing report, CDPH/WIC response persisted and visible to Local Agency, and atomic Resolve and Mark Received completion. No push/deploy performed.

All-user follow-up: Existing issues can be updated by Local Agency, CDPH/WIC and Admin; resolved reports remain resolved when edited. Reopen Issue requires a resolved issue, clears its active resolution and records reopening actor/date while preserving responses and receipts. Agency access and issue fingerprints remain enforced. Verified all three roles through API tests and CDPH/WIC update/reopen in isolated browser, including restored Shipping Issue list tag. 195 tests and build pass; review found no actionable regressions. No push/deploy performed.
