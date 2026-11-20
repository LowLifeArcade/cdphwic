# Product Formula Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Match the formula editor to the corrected upload column order and specified dropdown choices.

**Architecture:** Modify the existing Vue editor using explicit ordered fields and fixed choice arrays. Keep stored field names and legacy data, updating only visible controls and spreadsheet guidance.

**Tech Stack:** Vue, Nuxt, TypeScript, Vitest.

**Spec:** docs/superpowers/specs/2026-11-20-product-form-fields-design.md

## Global Constraints
- Use the exact order and choices in the spec.
- Preserve omitted legacy fields, internal identifiers, and existing nonstandard classification values.
- Keep optional fields clearable and Covered by Medi-Cal synchronization working.
- Retain legacy upload compatibility; no deployment.

## Review Focus
- Existing classification labels outside new choices must survive saving unrelated edits.
- Blank classification values must remain selectable.
- Removed legacy fields must survive saving.
- Covered by Medi-Cal must continue synchronizing medical coverage.
- Examples must contain the same number of cells as ordered headers.

### Task 1: Formula editor and upload guidance

**Files:** Modify app/pages/products/[id].vue, app/pages/products/bulk-upload.vue, app/pages/products/bulk-update.vue; test test/productUi.test.ts and relevant product import/store tests.

**Interfaces:** Existing ProductRecord and PUT product payload remain unchanged. Dropdowns bind to fdaClass, wicClass, st and infantToddler.

- [x] Add focused checks for field order and dropdown choices; exercise unknown and blank current choices, preservation of legacy payload fields, coverage synchronization and example cell alignment.
- [x] Run focused checks and confirm failure before implementation.
- [x] Reorder editor fields, render dropdown choices with blank and existing-value fallback, remove obsolete controls while preserving their data in save payloads.
- [x] Update upload example headers and example values to match the corrected order and valid choices; update corresponding guidance.
- [x] Run focused checks, npm test, npm run build and git diff --check; review the final diff for scope and preservation.

### Implementation refinements

Extract ordered field definitions and edit/save normalization into `shared/productEditor.ts` for behavioral testing and reuse by the editor. Existing stored keys remain unchanged.

### Task 2: McKesson report flag (additional user request)

- [x] Test default-off behavior and explicit enablement, including JSON, CSV and XLSX endpoints.
- [x] Add `mckessonReport: false` to public runtime config via shared report feature defaults.
- [x] Hide the section and skip its fetch when disabled; reject all three report endpoints with 404.
- [x] Document `NUXT_PUBLIC_MCKESSON_REPORT=true`; keep shipment quantities and the Master Log independent.
- [x] Run focused tests, the full suite and the production build.

## Verification results

Full suite: 558 tests passed across 99 files. Editor render and report render tests cover field order, dropdowns, disabled report visibility, skipped requests and export links. JSON save-path tests verify explicit numeric clears and preservation of stored case counts and prices. Direct report-handler tests verify disabled/enabled JSON, CSV and Excel access. Independent review identified the pre-existing Units Per Case clear issue; reproduced it with a failing JSON round-trip test and corrected it. Production build and final diff check are recorded at completion. No deployment performed.
