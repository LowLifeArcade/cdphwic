# Product catalog D1 persistence and bulk update

User-authorized implementation: D1 is the source of truth for all product API CRUD, uploads, spreadsheet updates, product matching in requests, receipt/transfer lookups, PDF parsing, reports, and summary product lookups. No production fallback to a mutable JavaScript array. The legacy store remains a fixture only; pure validation/normalization are reusable.

- [x] Add and verify data-preserving SQL migration with nullable units, all metadata/financial fields, coverage JSON, active soft deletion, optimistic versions, and partial uniqueness for active identifiers. Wire production deploy to apply migrations after tests/build and before deploying. No remote migration/deployment during implementation.
- [x] Add async D1 repository with explicitly mapped SQL columns, SQL-to-domain decoding, transactional create/update batches, optimistic guards, and historical lookup of inactive products. Test using real SQLite/D1-style bindings, including independent repository reads and rollback.
- [x] Expand bulk update to all spreadsheet fields. Product Number (or legacy Product ID) identifies existing records; omitted columns stay unchanged; present blank values clear fields. Validate all rows before atomic write and provide structured row/cell errors.
- [x] Route every production product caller through D1. Pass SQL product records into synchronous formula/report presentation helpers. Missing binding fails clearly rather than silently using seed data.
- [x] Verify API integration, spreadsheet->SQL->app roundtrip, restart/read persistence, null/boolean/identifier preservation, delete history, and full tests/build. Apply migrations only to local development during verification; keep prod changes pending for the deployment workflow.

Parallel ownership: spreadsheet parser/UI and migration/deployment tasks are isolated; main agent owns repository, route/service wiring and integration tests. Existing work remains uncommitted and preserved.


Verification: 536 tests across 95 files passed; production build passed. Local migration 0019 applied after a Wrangler SQL backup. A saved local catalog was copied into local SQL, retaining deleted seed records as inactive. A synthetic spreadsheet upload and metadata update were checked independently through the API, a Wrangler SQL query, and the actual product editor; the synthetic record was then archived. Remote production migrations/deployment were not performed. The prior synchronous product fixture now lives only under test/helpers.

Production release November 18: migration 0019 was explicitly applied to production database cdphwic after tests/build, authenticated target verification, and a Cloudflare Time Travel recovery bookmark. Production product row count remained zero; the new nullable schema and foreign-key integrity were checked before code deployment. A full SQL export was blocked by automatic approval review; no production records were exported.
