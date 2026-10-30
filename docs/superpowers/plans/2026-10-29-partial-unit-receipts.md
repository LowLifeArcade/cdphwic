# Supplier and Partial Unit Receipts Implementation Plan

**Goal:** Require actual receipt quantities, allow partial delivery confirmations without closing missing quantities, and count loose/damaged units accurately.
**Architecture:** Store supplier and a units-per-case snapshot per shipment, prefilled from catalog with reviewer override before unit counts are recorded. Store exact physical received units, damaged units and unit-based dispositions; retain legacy whole-case data. Receipt entry uses cumulative whole cases plus loose units and separately identifies the damaged subset. Partial/damaged quantities create an issue and keep the request open while preserving valid received quantities. Damaged units are excluded from usable inventory; dispositions identify how many damaged units they remove to avoid subtracting them twice.
**Tech Stack:** Nuxt/Vue, TypeScript, D1, Vitest.

User clarified: uploaded product list will contain confirmed units per case; use it as the default but CDPH/WIC may override. Source defaults apply only when product/form mapping is unambiguous. Existing shipments retain packaging snapshots; unit-bearing receipts freeze packaging to prevent reinterpretation of historical counts. Legacy whole-case records may acquire packaging without changing case totals.

- [x] Add quantity/partial receipt and supplier tests, including 30 sent/20 received/10 missing and 2 damaged loose cans.
- [x] Implement exact unit arithmetic, audited damaged/disposition handling, explicit and stale-protected receipt command, partial lifecycle and safe compatibility.
- [x] Add Supplier and editable catalog-prefilled Units per Case to ETA editing; require packaging for new Send ETA.
- [x] Add individual receipt quantity forms; remove implicit full-shipment confirmation. Update issue resolve-and-receive to require quantities too.
- [x] Tests/build, independent review, isolated UI examples; no push/deploy.

Verification: 213 tests across 52 files pass; production build passes. Isolated browser examples confirmed 20 of 30 cases leaves 10 missing, later receipt completes the shipment, supplier edits persist, and destroying 2 damaged loose units leaves 2 cases + 2 usable units unchanged (6 units/case). Review fixes cover stale resolve-and-receive commands and fully damaged replacement eligibility. No push or deployment.
