# Product formula screen fields

Use this exact order: Formula Description, Manufacturer, Formula Name, Form, Flavor, Packaging, Product Number, Units Per Case, Yield, Covered by Medi-Cal, McKesson PO, McKesson Price, FDA Class, WIC Category, S/T, Infant/Toddler.

FDA Class choices: Exempt, Non-exempt, Not infant. WIC Category choices: Exempt, Nutritional, Contract, SNC. S/T choices: Standard, Therapeutic. Infant/Toddler choices: Infant, Toddler, Adult. Include Not specified. Preserve existing values outside these lists until explicitly changed.

Remove Product ID and legacy Unit price, PO price, Cases approved, Cases used, Supplier reference and Coverage controls from the individual formula editor. Preserve existing stored values and identifiers; maintain Covered by Medi-Cal coverage synchronization. Retain Manufacturer immediately after Formula Description. Update upload guidance and example column order and values to match. Retain legacy spreadsheet header compatibility.

## Approach
Use explicit ordered fields in the existing editor and fixed dropdown options, preserving unfamiliar existing values as selectable current values. Reusing free-text inputs would not provide the requested set options; deleting database fields would unnecessarily affect compatibility and historical calculations. Keep existing database keys, including wicClass.

## Scope
Individual existing-product editor and upload guidance. No deployment, database deletion, or change to legacy price calculations. The new-product form and catalog totals remain outside this change unless requested.

## McKesson report flag (additional user request)
The McKesson Log uses sample data and must be behind a default-off runtime feature flag. Hide the report section and download links, skip its data request, and return 404 from its JSON, CSV and Excel endpoints when disabled. Explicit enablement restores the existing report. The Master Log and shipment case tracking remain independent. No changes to report data sourcing in this task.
