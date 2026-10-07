# CDPHWIC Nuxt + Cloudflare Scaffold Design

## Goal

Create a clean Nuxt 4 application scaffold for CDPHWIC that follows the
structure and operational conventions of `/Users/<user>/apps/stepthrough`,
with Cloudflare Workers/Nitro and D1 ready for application development.

## Scope

The initial scaffold includes project configuration, application/server/shared
directory boundaries, Cloudflare deployment configuration, D1 migration
folders, test configuration, environment documentation, and basic project
documentation.

It does not include product-specific pages, authentication, R2 storage,
business APIs, database tables, or application UI beyond the minimum Nuxt
entry point required to validate the scaffold.

## Architecture

Nuxt 4 provides the Vue application and server routes. Nitro targets the
`cloudflare_module` preset so the same application can run locally and deploy
as a Cloudflare Worker. Cloudflare D1 is exposed through a `CDPHWIC` binding;
the production and development environments use separate named databases.

The repository uses Nuxt's standard boundaries:

- `app/` contains pages, layouts, components, client utilities, and CSS.
- `server/` contains API routes, server routes, and server-only utilities.
- `shared/` contains types and utilities safe for both client and server.
- `db/` contains D1 migrations and local development SQL fixtures.
- `public/` contains static assets served directly.

## Configuration

The project will use:

- Package name and Worker name: `cdphwic`
- D1 binding: `CDPHWIC`
- Production database name: `cdphwic-db`
- Development database name: `cdphwic-db-dev`
- Nitro preset: `cloudflare_module`
- Cloudflare compatibility flag: `nodejs_compat`
- Cloudflare compatibility date: the current scaffold date, `2026-10-07`

Database IDs remain explicit placeholders until the databases are created in
Cloudflare. No credentials or secrets are committed; `.env.example` documents
local configuration names only.

## Scripts

The package scripts will provide the following workflows:

- `dev` for local Nuxt development with the dev Cloudflare environment
- `build` and `generate` for Nuxt output
- `preview` for the built Worker through Wrangler
- `deploy` for tests, build, and production deployment
- `test` for Vitest
- `cf-typegen` for Worker binding types
- D1 create/list/info, migration, query, reset, seed, fresh, shell, and type
  generation commands matching the StepThrough conventions

## Validation

The scaffold is valid when:

1. Dependencies install and Nuxt prepare completes.
2. Vitest runs with the initial scaffold test suite.
3. Nuxt builds successfully for the Cloudflare preset.
4. Wrangler configuration parses and references the expected `CDPHWIC`
   binding without requiring real Cloudflare database IDs locally.
5. The README documents local setup, database setup, and deployment placeholders.

## Future extension points

Product features should add focused files under the existing boundaries. D1
tables belong in numbered migrations, server-only access belongs in
`server/`, reusable contracts belong in `shared/`, and browser-facing UI
belongs in `app/`. Authentication, R2, queues, or other Cloudflare resources
should be added only when a product requirement establishes their need.
