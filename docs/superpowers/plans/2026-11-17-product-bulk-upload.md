# Product Bulk Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Import the user's product spreadsheet and let staff resolve exact products while agencies use familiar formula names.

**Architecture:** Extend ProductRecord and the existing product store; normalize spreadsheet headers in a separate server utility. Share matching rules across agency submission and staff review, using Product Number for exact selection and leaving ambiguous matches unresolved.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, SheetJS, Vitest, existing SQL migrations.

**Spec:** `docs/superpowers/specs/2026-11-17-product-bulk-upload-design.md`

## Global Constraints

- Product Number uniquely identifies a catalog product; names, forms, and flavors may repeat.
- Formula Name remains the main display name.
- Ambiguous matches remain unresolved rather than selecting the first row.
- Bulk upload creates products and rejects existing Product Numbers.
- Retain metadata through API and catalog edits for future reporting/log use; do not invent a new report layout or interpret S/T or Infant/Toddler values.
- The current product store is a seeded in-memory demo store; extending it does not introduce durable database-backed persistence.

## Review Focus

- Spreadsheet product numbers with leading zeroes must survive normalization.
- Missing headers, invalid rows, and duplicate numbers must fail without partially creating products.
- Multiple products with identical name/form/flavor must not autopopulate an arbitrary variant.
- Clearing or changing an exact selection must not leave stale Units Per Case or Yield.
- Editing imported products must preserve metadata used by reports and logs.

### Task 1: Spreadsheet normalization and catalog fields

**Files:** Create `server/utils/productImport.ts`, `test/productImport.test.ts`, and a product metadata SQL migration. Modify `shared/domain.ts`, `server/utils/productStore.ts`, `server/api/products/bulk.post.ts`, `test/productStore.test.ts`, and `app/pages/products/bulk-upload.vue`.

**Interfaces:** `parseProductWorkbook(data: Uint8Array): ProductInput[]` normalizes spreadsheet rows before `createProducts`. ProductRecord gains flavor, formulaDescription, manufacturer, mcKessonPo, mcKessonPrice, coveredByMediCal, fdaClass, wicClass, st, infantToddler, and packaging.

- [x] Write tests using real CSV/XLSX workbooks for the six mapped headers and all metadata, numeric conversions, leading zeroes, blank Flavor, missing headers, empty files, and legacy headers. Add store tests for repeated names, duplicate Product Numbers, metadata preservation, and atomic invalid batches.
- [x] Run `npm test -- test/productImport.test.ts test/productStore.test.ts`; confirm new assertions fail for missing behavior.
- [x] Implement import normalization and explicit row-number errors, metadata types/storage, Product Number uniqueness, and compatible SQL fields. Keep existing productId uniqueness for legacy workflow compatibility. Update upload copy and example headers.
- [x] Run the targeted tests and update existing upload-copy expectations in `test/productUi.test.ts`.

### Task 2: Shared matching and role-specific selection

**Files:** Create `shared/productMatching.ts` and `test/productMatching.test.ts`. Modify `app/pages/requests/new.vue`, `app/components/RequestDetailDrawer.vue`, and formula selection helpers/components that consume the static catalog.

**Interfaces:** `matchingProducts(products: ProductRecord[], selection: {name: string; form?: string; flavor?: string; packaging?: string}): ProductRecord[]` returns compatible variants; `resolveProduct` returns only an exact Product Number match or a single unambiguous candidate. Keep existing formula/PDF catalog metadata and merge uploaded names/forms for selection.

- [x] Write tests for repeated names, form/flavor/packaging narrowing, ambiguous candidates, exact Product Number selection, invalid product numbers, and imported formula-name options.
- [x] Run `npm test -- test/productMatching.test.ts test/formulaSelection.test.ts`; confirm new assertions fail.
- [x] Implement shared matching and agency short-name options. Remove first-match product assignment. Add a staff-only exact-product selector labeled with description, packaging, and Product Number. On selection, populate Product Number, Units Per Case, and Yield; on clearing/changing selection, clear dependent values. Preserve editable request processing fields and saved exact selection.
- [x] Run targeted matching and request authorization tests, including selection changes and unresolved variants.

### Task 3: Catalog preservation and verification

**Files:** Modify `app/pages/products/[id].vue`, `app/pages/products/index.vue`, and associated product tests as required.

**Interfaces:** Existing product APIs return the extended ProductRecord. Product editing sends all imported metadata unchanged unless explicitly edited; catalog display keeps Formula Name primary and exposes enough description/number/packaging to distinguish variants.

- [x] Add regression coverage that editing an imported product does not erase metadata and that the staff selector is unavailable to agencies.
- [x] Run the focused tests and confirm failures before implementation.
- [x] Update catalog display and editing to retain imported fields. Review request save paths so selected Product Number survives reload.
- [x] Run `npm test` and `npm run build`; inspect failures and correct any introduced regressions.
- [x] Review the diff against the approved design, report test/build evidence and the existing in-memory storage limitation, and leave changes ready for user review without deployment.


## Implementation verification

- Completed all three tasks, including the agency issuance summary and PDF-written formula recognition so uploaded names work across the existing request flow.
- Added regression coverage for explicit cleared selections surviving request serialization, manual uncatalogued product details, agency summary ambiguity, editable price clearing, malformed numbers, accurate worksheet row references, and leading-zero IDs in both import and bulk quantity updates.
- Shared `authorizationCatalogProduct` keeps staff review and agency summaries consistent; an empty Product Number records a deliberate cleared selection, while an absent value allows safe legacy single-candidate inference.
- Final full test run: **498 passed across 88 files**. Earlier baseline failures were recorded before implementation; separate workspace test updates appeared during this task and were left intact.
- All 18 SQL migrations apply in an in-memory SQLite database; repeated formula names are permitted and duplicate Product Numbers fail the unique index.
- Final production build and diff checks are recorded in the execution ledger. No deployment or database migration against a running environment was performed.
- Existing limitation: catalog products are still held in the seeded in-memory demo store; metadata is available through product APIs for reports/logs but does not survive server restarts.
