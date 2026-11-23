# Working efficiently

Primary goal: keep feature changes local and minimize the code needed in context.

- Start with [docs/feature-map.md](docs/feature-map.md). Choose the relevant workflow; read its owner and direct dependencies only.
- Search with `rg` for a symbol or route before reading a whole file. Do not load every component, test, migration, or historical design/plan.
- Keep request/product changes in focused feature modules. Pages and drawers coordinate workflows; do not add business rules to them when a mapped owner exists.
- Use `#shared/…` for shared imports inside client features so Nuxt preserves resolvable SSR externals.
- Use explicit imports for `app/features/` components/composables. Nuxt auto-discovery applies to `app/components/`, not this feature directory.
- Extend the closest behavioral test and run the mapped focused checks while editing. Before finishing a refactor or changing shared contracts, run `npm test` and `npm run build`.
- Preserve UI, HTTP payloads, authorization, request revisions and immutable identity, D1 JSON format, and inventory transaction boundaries unless explicitly changing them.
- Update the feature map when ownership changes. Keep instructions short; reference code instead of copying it into documentation.

See README.md for setup and formatting. Do not deploy, migrate a remote database, or change production data for a refactor.
