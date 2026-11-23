# McKesson purchasing periods and order balances

The user approved a separate Upload New McKesson PO action and Manage POs on Products, restricted to CDPH/WIC and Admin. Each PO has a number and inclusive effective dates, with allocations linked by exact Product Number. Uploads accept CSV/XLS/XLSX, preview product matches and errors before activation, and require approved cases plus explicit opening usage. Old purchasing periods remain available.

Separate PO allocation and order records preserve history; overwriting catalog quantities was rejected because it loses purchasing-period identity. A full procurement integration is outside scope. An explicit Place order action records usage at placement, never at approval, shipment or delivery. Orders retain their original PO on later edits; cancellation restores that PO's balance. Cases cannot exceed its remaining allocation. No legacy usage is guessed or backfilled.

Current balances are meaningful only when exactly one effective PO applies to the product, or staff explicitly select one. Missing or overlapping periods require a choice, never a guessed balance. Product details and request issuance stay distinct from ordering. Implementation uses the existing Nuxt UI, D1 binding and XLSX dependency. Upload activation and order adjustments require atomic validation, reviewer authorization, retained history and retry protection.
