# McKesson PO Implementation Plan

Goal: Implement the user-approved PO workflow on Products, with effective dates, previewed allocations, opening usage and explicit order placement.
Architecture: Separate PO, allocation and order records in D1. Balances derive from opening usage plus noncancelled order quantities. Orders retain their original PO; edits/cancellations adjust that PO. Approval/shipping never implies placement.
Tech stack: Nuxt/Vue, existing XLSX parser dependency, D1 and Vitest.

- [x] Backend: migration, upload parser and validation, atomic activation and order ledger, reviewer-only APIs, tests for dates/duplicates/usage/cancellation/concurrency.
- [x] UI: Products links, PO upload preview and activation, history and allocation view, order placement/edit/cancellation component on request review.
- [x] Integration: show current PO balances on Products and request product detail; no guessed legacy balance.
- [x] Verify full tests/build, review implementation and address findings.

Rulings: Allow overlapping periods but require explicit PO selection when ambiguous. Date comparisons use America/Los_Angeles calendar dates. Start/end dates inclusive. CSV/XLS/XLSX has Product Number, Cases Approved, Cases Already Used (explicit required value). No automatic historical backfill. Preserve old PO history and ledger. Prevent spending beyond remaining cases; cancelled orders retain their history. Do not deploy without a new request.

Validation: 625 tests across 110 files pass; production build succeeds. Local migration 0020 applied. Live local checks: Admin PO API 200, Agency 403, PO page 200, internal CSV preview matched a catalog product and calculated 100 approved minus 12 opening usage = 88 remaining. No PO was activated by the smoke check.

Review corrections: preserve pending operation IDs across uncertain retries, require expected order versions on updates, preserve cancellation quantities, and accept existing Y/N flags alongside Yes/No. Dedicated tests cover these cases.
