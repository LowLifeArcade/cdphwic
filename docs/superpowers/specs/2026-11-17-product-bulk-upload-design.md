# Product spreadsheet import and staff product selection

## Approved behavior

Local agencies select the familiar Formula Name, plus Form and Flavor when known. CDPH/WIC and Admin select the exact product during review using Formula Description, Packaging, and Product Number. Formula Name remains the main display name. Product Number uniquely identifies a catalog product; names, forms, and flavors may repeat. Ambiguous matches remain unresolved rather than selecting the first row.

## Spreadsheet contract

Replace the documented internal headers with Formula Name → name, Formula Form → form, Flavor → flavor, Product Number → productCode, Units Per Case → unitsPerCase, and Yield → yield. Include Formula Description, Manufacturer, McKesson PO, McKesson Price, Covered by Medi-Cal, FDA Class, WIC Class, S/T, Infant/Toddler, and Packaging as stored product fields available to reports and logs.

Implementation defaults: all six mapped headers must be present; Flavor may be blank for unflavored products. Additional metadata columns are optional. Product Number is text, preserving leading zeroes. Generate the legacy productId from Product Number for imported products and retain existing legacy IDs. Use the existing standard category default internally because the new spreadsheet has no Category column; do not interpret WIC Class as that category. Preserve McKesson PO and classification labels as text; store McKesson Price as a nonnegative number and Covered by Medi-Cal as an optional boolean. Do not infer WIC coverage from WIC Class. Keep legacy header support for existing spreadsheets. Bulk upload creates products and rejects existing Product Numbers, as the current workflow does; it does not silently replace products.

## Approach

Extend the existing catalog and review workflow, with a shared import normalizer and shared product matching helpers. This keeps agency selection familiar and gives staff explicit control over variant resolution. Using Formula Description as the agency selector was considered and rejected because agencies do not know the detailed product variants. Selecting the first matching product was rejected because names are not unique.

## Scope and constraints

Update upload guidance, validation, catalog fields, product editing preservation, formula-name options, and staff selection/autopopulation. Retain metadata through API and catalog edits for future reporting/log use; do not invent a new report layout or interpret S/T or Infant/Toddler values. Existing financial and quantity fields must remain compatible. The current product store is a seeded in-memory demo store; extending it does not introduce durable database-backed persistence. Keep the SQL product schema compatible with the new fields for future persistence.

## Verification

Exercise CSV and XLSX import, repeated names, duplicate Product Numbers, leading zeroes, invalid numbers, optional metadata, empty files, atomic failure, ambiguous variants, exact staff selection, edit preservation, and agency-facing short names. Run the full test suite and production build.
