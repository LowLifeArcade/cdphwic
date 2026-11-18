# Product catalog storage and deployment

Products are stored in the `products` table through the `CDPHWIC` D1 binding. All product APIs, spreadsheet imports and updates, PDF formula recognition, request validation, shipping packaging lookups, and product-dependent reports read this repository. No production product path falls back to the legacy JavaScript catalog; the old synchronous fixture is confined to tests. A missing D1 binding is a service error.

The repository explicitly maps domain properties to snake_case SQL columns. `coverage` and `generic_fields` are JSON text; `covered_by_medi_cal` is nullable 0/1; unknown numeric values are SQL NULL. Product Numbers remain text, including leading zeroes. Deletes set `active=0` and retain historical IDs. Unique indexes apply to active nonblank identifiers, allowing replacement products without rewriting old requests. Product writes use atomic D1 batches and version guards against overwriting concurrent changes.

## Bulk update

Supply Product Number (or legacy productId) and the columns to change. Omitted columns are preserved; included blank values clear those fields. Every row must identify one existing active product. Invalid or duplicate rows reject the entire batch before saving. Existing quantity-only spreadsheets remain supported.

## Deployment

`npm run deploy` runs the test suite and production build, then `npm run db:migrate:prod`, then deploys the Worker. The migration command explicitly selects `CDPHWIC --remote --config wrangler.jsonc --env=""`; a failure prevents deployment. The production build clears inherited `CLOUDFLARE_ENV` so a dev shell cannot select dev bindings.

The user's zsh `push` function performs Git add/commit/push and then runs `npm run deploy`, so it picks up this migration step automatically. A plain `git push` alone does not deploy or migrate.

Migration 0019 preserves existing SQL product rows, identifiers and metadata, permits nullable case sizes, adds durable financial/coverage fields and optimistic versions, and keeps precisely identified legacy dummy entries inactive. It does not insert demo products into production. Existing entries that only ever existed in an old JavaScript process are not automatically available in SQL: export them before the old process is stopped and import them once, or re-upload their source spreadsheet.

Local verification uses `--local --env dev` and a backup before migration. Production migrations run during deployment or when explicitly requested; editing code or running tests does not apply them. Wrangler tracks previously applied migration files.


## Spreadsheet column mapping

| Spreadsheet | App property | SQL column |
| --- | --- | --- |
| Formula Name | name | name |
| Formula Form | form | form |
| Flavor | flavor | flavor |
| Product Number | productCode | product_code |
| Units Per Case | unitsPerCase | units_per_case |
| Yield | yield | yield |
| Formula Description | formulaDescription | formula_description |
| Manufacturer | manufacturer | manufacturer |
| McKesson PO | mcKessonPo | mckesson_po |
| McKesson Price | mcKessonPrice | mckesson_price |
| Covered by Medi-Cal | coveredByMediCal | covered_by_medi_cal |
| FDA Class | fdaClass | fda_class |
| WIC Class | wicClass | wic_class |
| S/T | st | st |
| Infant/Toddler | infantToddler | infant_toddler |
| Packaging | packaging | packaging |

The internal legacy Product ID is separate (`productId` -> `product_id`); Product Number remains the public unique catalog key. McKesson Price, Unit Price, and PO Price have separate SQL columns and are not conflated.

After pulling this change, restart an already-running development server with `npm run dev` to refresh Nuxt imports after removal of the old server-side JavaScript product store.
