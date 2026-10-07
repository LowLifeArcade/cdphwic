# CDPHWIC Nuxt + Cloudflare Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Nuxt 4 + Cloudflare Workers + D1 scaffold for CDPHWIC that follows the StepThrough project structure and scripts.

**Architecture:** Use Nuxt 4 with Nitro's `cloudflare_module` preset. Keep client code in `app/`, server code in `server/`, shared contracts in `shared/`, static files in `public/`, and D1 assets in `db/`. Configure production and dev Cloudflare environments around a `CDPHWIC` D1 binding.

**Tech Stack:** Nuxt 4, Vue 3, Nitro, Cloudflare Workers, Wrangler, Cloudflare D1, Vitest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-07-cdphwic-scaffold-design.md`

## Global Constraints

- Package and Worker name: `cdphwic`.
- D1 binding: `CDPHWIC`.
- Production database name: `cdphwic-db`.
- Development database name: `cdphwic-db-dev`.
- Nitro preset: `cloudflare_module`.
- Cloudflare compatibility flag: `nodejs_compat`.
- Do not add authentication, R2, business APIs, or product-specific UI.
- Do not commit credentials or real Cloudflare database IDs.

## Review Focus

- A fresh checkout must be installable without Cloudflare credentials; cover with `npm install` and `nuxt prepare`.
- The minimal Nuxt route must render; cover with a smoke test and Nuxt build.
- The production and dev Wrangler environments must use the same binding name with separate database names; cover with config inspection and build validation.
- Local D1 commands must have predictable paths and binding names; cover with the documented scripts and migration layout.
- Cloudflare deployment output must target the Worker preset; cover with `npm run build` and Wrangler preview configuration.

---

### Task 1: Create the Nuxt application foundation

**Files:**

- Create: `package.json`
- Create: `nuxt.config.ts`
- Create: `tsconfig.json`
- Create: `app/pages/index.vue`
- Create: `app/layouts/default.vue`
- Create: `app/assets/css/main.css`
- Create: `public/robots.txt`

**Interfaces:**

- Produces a Nuxt 4 application with a minimal index page, default layout, global stylesheet, and Cloudflare Nitro configuration.

- [ ] **Step 1: Add the package manifest and scripts**

Use the StepThrough script conventions adapted to `cdphwic`, including `dev`, `build`, `generate`, `test`, `preview`, `deploy`, `postinstall`, `cf-typegen`, and D1 helper scripts. Use Nuxt 4, Vue 3, Wrangler, Nitro Cloudflare development support, Workers types, and Vitest dependencies.

- [ ] **Step 2: Add Nuxt configuration**

Configure the `cloudflare_module` preset, `nodejs_compat`, compatibility date `2026-10-07`, global CSS, and Nitro Cloudflare D1 connectors using binding `CDPHWIC`.

- [ ] **Step 3: Add the minimal app shell**

Create a default layout and index page with a small scaffold-status message, plus a neutral base stylesheet and `robots.txt`.

- [ ] **Step 4: Add Nuxt TypeScript project references**

Create the root `tsconfig.json` referencing Nuxt-generated app, server, shared, and node configs.

- [ ] **Step 5: Install dependencies and prepare Nuxt**

Run `npm install` from the repository root. Confirm Nuxt prepare creates the generated type configuration without application errors.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json nuxt.config.ts tsconfig.json app public package-lock.json
git commit -m "chore: scaffold Nuxt application"
```

### Task 2: Add Cloudflare and D1 configuration

**Files:**

- Create: `wrangler.jsonc`
- Create: `.env.example`
- Create: `db/migrations/.gitkeep`
- Create: `db/dev/reset.sql`
- Create: `db/dev/seed.sql`

**Interfaces:**

- Produces Wrangler configuration with production and `dev` environments, both exposing `CDPHWIC`; produces stable local D1 fixture paths used by package scripts.

- [ ] **Step 1: Write the Wrangler configuration**

Configure Worker entry `./.output/server/index.mjs`, static assets from `./.output/public/`, observability, preview URLs, `nodejs_compat`, `ENV` variables, and D1 entries for `cdphwic-db` and `cdphwic-db-dev`. Use explicit placeholder database IDs that are clearly documented as requiring replacement.

- [ ] **Step 2: Add environment and local database fixtures**

Document local-only variables in `.env.example`. Add empty-safe reset and seed SQL files that can be used before product tables exist.

- [ ] **Step 3: Verify configuration shape**

Run `npx wrangler --config wrangler.jsonc deploy --dry-run` or the closest non-deploying Wrangler configuration validation available in the installed version. Confirm both environments use `CDPHWIC` and distinct database names.

- [ ] **Step 4: Commit Cloudflare configuration**

```bash
git add wrangler.jsonc .env.example db
git commit -m "chore: configure Cloudflare Worker and D1"
```

### Task 3: Add tests and project documentation

**Files:**

- Create: `vitest.config.ts`
- Create: `test/smoke.test.ts`
- Create: `README.md`
- Create: `worker-configuration.d.ts`
- Create: `env.d.ts`

**Interfaces:**

- Produces a Vitest command that passes for the initial project and documentation covering local development, D1 setup, preview, and deployment.

- [ ] **Step 1: Write the failing smoke test**

Add a test that asserts the scaffold identity and expected D1 binding contract through a small exported shared constant or equivalent configuration-safe test surface.

- [ ] **Step 2: Run the smoke test to verify it fails**

Run `npm test -- --run test/smoke.test.ts`. Expected: FAIL because the scaffold contract is not yet exposed.

- [ ] **Step 3: Implement the minimal testable scaffold contract**

Add the smallest shared TypeScript module needed for the test, without introducing product behavior or runtime dependencies.

- [ ] **Step 4: Add Vitest configuration and type declarations**

Configure Vitest for TypeScript and Cloudflare worker-compatible types. Add generated-type placeholders/declarations in the same role as StepThrough, without committing generated secrets.

- [ ] **Step 5: Run the smoke test to verify it passes**

Run `npm test -- --run test/smoke.test.ts`. Expected: PASS.

- [ ] **Step 6: Write the README**

Document the folder structure, install/setup commands, local D1 migration and reset commands, preview, deployment, placeholder database IDs, and future extension boundaries.

- [ ] **Step 7: Commit tests and documentation**

```bash
git add vitest.config.ts test README.md worker-configuration.d.ts env.d.ts shared
git commit -m "docs: add scaffold validation and setup guide"
```

### Task 4: Run full verification

**Files:**

- Modify: any scaffold files required by verification output

**Interfaces:**

- Produces a locally installable, tested, and Cloudflare-buildable project.

- [ ] **Step 1: Run the full test suite**

Run `npm test`. Expected: exit code 0 with all tests passing.

- [ ] **Step 2: Run the production build**

Run `npm run build`. Expected: exit code 0 and Cloudflare Worker output under `.output/`.

- [ ] **Step 3: Inspect the final project state**

Run `git status --short` and inspect the generated output and config-relevant files. Confirm no credentials, accidental generated directories, or unrelated files are staged.

- [ ] **Step 4: Commit verification-only corrections if needed**

```bash
git add <corrected-files>
git commit -m "fix: finish scaffold verification"
```
