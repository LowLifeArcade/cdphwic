# Product spreadsheet import and staff product selection

## Approved behavior

Local agencies select the familiar Formula Name, plus Form and Flavor when known. CDPH/WIC and Admin select the exact product during review using Formula Description, Packaging, and Product Number. Formula Name remains the main display name. Product Number uniquely identifies a catalog product; names, forms, and flavors may repeat. Ambiguous matches remain unresolved rather than selecting the first row.

## Spreadsheet contract

Replace the documented internal headers with Formula Name → name, Formula Form → form, Flavor → flavor, Product Number → productCode, Units Per Case → unitsPerCase, and Yield → yield. Include Formula Description, Manufacturer, McKesson PO, McKesson Price, Covered by Medi-Cal, FDA Class, WIC Class, S/T, Infant/Toddler, and Packaging as stored product fields available to reports and logs.

Implementation defaults: all six mapped headers must be present; all cell values may be blank. Formula Form also accepts Other. Completely empty rows are ignored. Additional metadata columns are optional. Product Number is text, preserving leading zeroes. Generate the legacy productId from Product Number for imported products and retain existing legacy IDs. When Product Number is blank, generate an internal ID, retain a blank Product Number, and require staff to supply a number before exact product selection. Blank Units Per Case remains unknown rather than becoming zero. Use the existing standard category default internally because the new spreadsheet has no Category column; do not interpret WIC Class as that category. Preserve McKesson PO and classification labels as text; store McKesson Price as a nonnegative number and Covered by Medi-Cal as an optional boolean. Do not infer WIC coverage from WIC Class. Keep legacy header support for existing spreadsheets. Bulk upload creates products and rejects existing Product Numbers, as the current workflow does; it does not silently replace products.

## Approach

Extend the existing catalog and review workflow, with a shared import normalizer and shared product matching helpers. This keeps agency selection familiar and gives staff explicit control over variant resolution. Using Formula Description as the agency selector was considered and rejected because agencies do not know the detailed product variants. Selecting the first matching product was rejected because names are not unique.

## Scope and constraints

Update upload guidance, validation, catalog fields, product editing preservation, formula-name options, and staff selection/autopopulation. Retain metadata through API and catalog edits for future reporting/log use; do not invent a new report layout or interpret S/T or Infant/Toddler values. Existing financial and quantity fields must remain compatible. Updated November 18: the user requested durable D1 persistence. The product catalog now uses the CDPHWIC D1 repository for all production reads and writes; the legacy JavaScript store is only a test fixture. Keep the SQL product schema compatible with the new fields for future persistence.

## Verification

Exercise CSV and XLSX import, repeated names, duplicate Product Numbers, leading zeroes, invalid numbers, optional metadata, empty files, atomic failure, ambiguous variants, exact staff selection, edit preservation, and agency-facing short names. Run the full test suite and production build.


## November 18 correction

Allow blank spreadsheet cells in every column, including name, form, Product Number, Units Per Case, and Yield; accept Other in Formula Form. Preserve uniqueness for nonblank Product Numbers. Count incomplete variants when deciding whether automatic selection or case-size inference is safe. Staff can explicitly select numbered products whose catalog form is unknown.

Validation errors travel in the JSON response body and appear as separate table rows with spreadsheet row/cell, Formula Name, column, original value, and corrective instructions. Collect all invalid cells; identify missing/duplicate headers and Excel formula errors. Do not report both generated Product ID and Product Number for the same duplicate number.


## November 18 persistence follow-up

D1 is now the authoritative product catalog, including metadata edits, bulk updates, soft deletion and historical lookups. Bulk updates preserve omitted columns and clear included blanks. Migration 0019 and production deployment wiring are documented in `docs/product-deployment.md`; the implementation checklist is `docs/superpowers/plans/2026-11-18-product-d1-persistence.md`.
