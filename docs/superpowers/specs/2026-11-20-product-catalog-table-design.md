# Product catalog spreadsheet table

The user selected a simple Excel-style list and excluded McKesson PO, McKesson Price, McKesson Cases, FDA Class, WIC Category, S/T and Infant/Toddler. Render columns in approved upload order: Formula Description, Manufacturer, Formula Name, Form, Flavor, Packaging, Product Number, Units Per Case, Yield, Covered by Medi-Cal; add a clearly aligned Edit action column. Preserve the existing detailed product editor and stored quantities.

Use one semantic table with compact rows, cell borders, horizontally scrollable overflow, and a sticky header. Replace grid/list toggling with the requested single list. Retain search and Form filtering. Remove WIC badges and the WIC filter. Show a Medi-Cal badge only when Covered by Medi-Cal is true; when that field is unspecified, retain compatibility with legacy medical coverage. Explicit false overrides legacy coverage. Use the same predicate for the filter and badge. Retain leading zeroes, zero numeric values and human-readable form names. Blank cells display an em dash. Product links and a dedicated Edit link open the existing individual editor.

## Approach
A real HTML table keeps headings and cells in the same columns and supports accessible table navigation. The previous separate CSS grid header/rows allowed missing action cells and text stacking to misalign information. Keeping both card and list layouts would retain duplicate rendering and the obsolete fields the user wants removed; use the table alone.

## Approved filter follow-up
Replace Form and Coverage selectors with McKesson PO and WIC Category filters, each including All and Not specified. Filters combine with text search. McKesson PO options come from existing catalog values; WIC Category includes only the four defined choices: Exempt, Nutritional, Contract and SNC; existing legacy values must not add filter options. Keep matches alphabetically ordered by Formula Name with natural numeric comparison, then description and Product Number. Keep compact laptop column layout and Medi-Cal badges.
