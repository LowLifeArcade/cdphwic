# Three-Column Shipment Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show two formula-specific shipment columns beside Local Agency details on two-formula authorizations and enlarge Next Steps text slightly.

**Architecture:** Update the existing PDF generator and its Vitest coverage. Preserve the current two-column flow for one formula; render two formula-specific shipment panels and the agency panel in three columns when there are two formulas.

**Tech Stack:** TypeScript, pdf-lib, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-three-column-shipment-layout-design.md`

## Global Constraints

- Keep the existing two-column Shipment Details / Local Agency layout when there is only one formula.
- For two formulas, show each formula's shipment information in its own column, with Local Agency details in a third column.
- Do not change shipment calculations, authorization metrics, or receipt signatures.
- Do not force long tracking data or other variable text to fit by clipping or shrinking it excessively; it may wrap and continue onto another page.
- Set Next Steps body text to 11 pt with line spacing adjusted for the larger text.

## Review Focus

- Shipments whose formula association matches each authorization appear in the correct column; test distinct tracking labels and their horizontal positions.
- A missing formula association remains compatible with the one-formula path; preserve existing one-formula shipment coverage.
- Long shipment text and Next Steps continue wrapping safely; preserve the existing long-content test.
- Shipment-confirmation received/damaged details remain present; preserve the existing shipment-confirmation test.

---

### Task 1: Formula-specific shipment columns and larger Next Steps

**Files:**
- Modify: `server/utils/authorizationForm.ts`
- Test: `test/authorizationForm.test.ts`

**Interfaces:**
- Consumes and produces the existing `createAuthorizationFormPdf(request, agency, rep, kind)` PDF output.

- [x] **Step 1: Add a regression test** with two formula-associated shipments; assert the two shipment headings and Local Agency heading appear in three left-to-right columns, and Next Steps body text is 11 pt.
- [x] **Step 2: Run the focused test and confirm it fails** on the missing three-column headings and current 10 pt Next Steps.
- [x] **Step 3: Implement the conditional three-column layout** while retaining the current one-formula renderer, and change Next Steps body text to 11 pt with 15 pt line spacing.
- [x] **Step 4: Run focused tests and inspect one- and two-formula PDF renders**, including long wrapped content.
- [x] **Step 5: Run the full test suite, production build, and `git diff --check`.**
