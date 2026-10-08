# Request Operations and Authorization Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add richer request review/editing, monthly benefit allocations, request-type/date context, agency/rep details, and an on-demand Authorization Form PDF.

**Architecture:** Extend the shared request model with structured monthly allocations. Keep agency/member lookup in the request list and pass resolved records to the drawer. Generate the PDF in a focused server utility using `pdf-lib`, exposed through a gated request endpoint.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest, pdf-lib.

**Spec:** `docs/superpowers/specs/2026-10-07-request-operations-design.md`

## Global Constraints

- Authorization Form availability requires `status === 'approved'` and a present `dateOrdered`.
- The new UI writes `benefitIssuances`; legacy start/end fields remain optional compatibility fields.
- Staff-only edits use the existing request update endpoint and preserve inline errors.
- No signature field is added.

## Review Focus

- Missing agency/member IDs must render safe placeholders and must not break the drawer.
- Month rows must reject duplicates, non-positive quantities, and out-of-order additions.
- PDF generation must reject unapproved or unordered requests with HTTP 409.
- Dates must render as `MM/DD/YYYY` without changing stored ISO values.
- Denial reason must be visible only for denied status and required before denial.

### Task 1: Model and request-domain helpers

**Files:**
- Modify: `shared/domain.ts`
- Create: `shared/requestOperations.ts`
- Test: `test/requestOperations.test.ts`

- [ ] Write failing tests for month-row validation/next-month sequencing and Authorization Form eligibility.
- [ ] Run the focused test and verify it fails because the helpers/model do not exist.
- [ ] Add `benefitIssuances` and implement typed helpers for validation, chronological next-month selection, and PDF eligibility.
- [ ] Run the focused test and verify it passes.

### Task 2: Request list and detail workflow

**Files:**
- Modify: `app/components/RequestList.vue`
- Modify: `app/components/RequestDetailDrawer.vue`
- Modify: `app/assets/css/main.css` if needed
- Test: `test/requestOperationsUi.test.ts`

- [ ] Write failing UI contract tests for list labels/chips, removed identifiers, detail agency/rep fields, editable staff inputs, monthly allocation controls, denial-only reason, and PDF gating.
- [ ] Run the focused test and verify it fails.
- [ ] Implement resolved agency/member props, list formatting/chips, drawer editing, ordered month rows with plus behavior, denial-only reason, and gated PDF action.
- [ ] Run focused UI tests and verify they pass.

### Task 3: Authorization Form PDF endpoint

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `server/utils/authorizationForm.ts`
- Create: `server/api/requests/[id]/authorization-form.pdf.get.ts`
- Test: `test/authorizationForm.test.ts`

- [ ] Write failing tests for PDF content generation, response metadata, unknown request 404, and ineligible request 409.
- [ ] Run the focused tests and verify they fail because the generator/endpoint do not exist.
- [ ] Add `pdf-lib`, implement a static multi-section PDF generator, and expose it through the gated endpoint.
- [ ] Run focused PDF tests, extract text, and render a representative PDF with Poppler for visual inspection.

### Task 4: Full verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check` and inspect the final diff for unrelated changes.

