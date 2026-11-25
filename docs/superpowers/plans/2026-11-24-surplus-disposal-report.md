# Surplus Disposal Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an agency-scoped report of donated and destroyed surplus formula searchable by staff-entered event date, with cross-agency access for Admin and CDPH/WIC.

**Architecture:** A server report helper will validate inclusive date filters, query donation/destruction movement history, decorate corrections and actor/agency labels, and enforce scope from the current user. JSON and CSV endpoints will call that helper; a dedicated page and shared navigation entry will display and export the filtered data.

**Tech Stack:** Nuxt 3, Vue, TypeScript, H3, Cloudflare D1, SQLite JSON functions, Vitest, existing XLSX CSV export helper.

**Spec:** `docs/superpowers/specs/2026-11-24-surplus-disposal-report-design.md`

## Global Constraints

- "Search by the donation or destruction date entered by staff, inclusive of both selected dates."
- "Limit agency users to their own agency. Admin and CDPH/WIC users may view all agencies."
- "Provide an on-screen table and CSV download for the same filtered results."
- "Preserve correction history: report the effective corrected quantity for corrected disposal entries, and retain the original event as identified in inventory history."
- "Follow the existing surplus persistence and role helpers; do not change D1 schema or inventory transaction boundaries."

## Review Focus

- An agency caller must not widen scope with a query parameter — pin this with API tests for own versus foreign lots.
- Missing date bounds must be inclusive unbounded filters, not an empty result — pin this in the report service test.
- Invalid or reversed dates must be rejected — pin this in API tests.
- Staff event date, not movement timestamp, controls date membership — pin this with rows where those dates differ.
- Corrected disposal quantity must be exported once and reflect the current effective quantity — pin this in report service tests.

---

### Task 1: Scoped disposal report query and API

**Files:**
- Create: `server/utils/surplusDisposalReport.ts`
- Create: `server/api/surplus/dispositions.get.ts`
- Create: `server/api/surplus/dispositions.csv.get.ts`
- Create: `shared/surplusDisposalReport.ts`
- Test: `test/surplusDisposalReport.test.ts`
- Test: `test/surplusDisposalReportRoute.test.ts`

**Interfaces:**
- Produces: `listSurplusDispositions(db: D1Database, user: SessionUser, from?: string, to?: string): Promise<SurplusDisposalRow[]>`
- Both endpoints accept `from` and `to` query parameters as `YYYY-MM-DD`; CSV endpoint returns the same rows and columns as JSON.

- [x] **Step 1: Write failing helper tests** for donation and destruction rows; inclusive filtering on the staff-entered `reason.date`; agency scoping versus Admin/internal all-agency scope; independent missing bounds; invalid/reversed bounds; non-disposal movements excluded; corrected disposal quantity represented once; event date distinct from `created_at`; undated entries included only without a date filter.
- [x] **Step 2: Run** `npx vitest run test/surplusDisposalReport.test.ts` and confirm failure because report helper is missing.
- [x] **Step 3: Implement** `listSurplusDispositions` with validated bounds, `isReviewer` scope, donation/destruction movement selection, formula/packaging/clinic/agency joins, actor name, entered attestation fields, separate movement timestamp, and effective correction handling.
- [x] **Step 4: Write failing endpoint tests** for agency access, reviewer cross-agency access, query validation, and CSV headers/content matching JSON rows.
- [x] **Step 5: Run** `npx vitest run test/surplusDisposalReportRoute.test.ts` and confirm expected failures.
- [x] **Step 6: Implement** read-only JSON and CSV handlers using `surplusContext`, the helper, and `csvResponse`; reject invalid/reversed ranges with 400.
- [x] **Step 7: Run** `npx vitest run test/surplusDisposalReport.test.ts test/surplusDisposalReportRoute.test.ts`; expect all tests pass.

### Task 2: Report page, navigation, and feature map

**Files:**
- Create: `app/pages/surplus-dispositions.vue`
- Create: `app/features/surplus/composables/useSurplusDisposalReport.ts`
- Modify: `shared/navigation.ts`
- Modify: `docs/feature-map.md`
- Test: `test/surplusDisposalReportUi.test.ts`
- Test: `test/surplusDisposalReportClient.test.ts`
- Test: closest navigation test, or create `test/surplusDisposalNavigation.test.ts` if none covers role-aware navigation.

**Interfaces:**
- Consumes: Task 1 JSON response row type and `/api/surplus/dispositions?from=&to=`; CSV endpoint with the same query parameters.
- Produces: A dedicated page at `/surplus-dispositions`, reachable to all user types; agency role sees only server-scoped own-agency rows, reviewer roles see cross-agency rows.

- [x] **Step 1: Write failing UI and navigation tests** asserting date controls, search action, results columns, empty state, filtered CSV link, and navigation availability to agency, Admin, and internal users.
- [x] **Step 2: Run** `npx vitest run test/surplusDisposalReportUi.test.ts test/dashboardVisibility.test.ts` and confirm the new page/link are absent.
- [x] **Step 3: Implement** the date-filter form and results table on the dedicated page; show agency and clinic columns; make the CSV action use the active date filters; add an accessible Formula Surplus child link for all roles; add a surplus report row to the feature map.
- [x] **Step 4: Run** the focused UI, navigation, and report endpoint tests; expect all pass.

### Task 3: Integration verification

**Files:**
- Verify repository state and commands only.

- [x] **Step 1: Run** `npm test` and resolve any failures caused by the change.
- [x] **Step 2: Run** `npm run build` and confirm the Nuxt build completes.
- [x] **Step 3: Review** final diff for role-scope enforcement, SQL-bound query values, inclusive bounds, consistent CSV columns, and no changes to inventory writes.
