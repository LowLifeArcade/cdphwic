# CDPHWIC Dashboard and Request Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a simple Nova-inspired CDPHWIC dashboard with role-aware request views, auth/profile stubs, seeded summary data, request creation, and extensible D1/API boundaries.

**Architecture:** Use typed shared domain models and seeded records as the first data source, with server API routes shaped for D1-backed replacement. Use a single Nuxt dashboard shell with role-aware navigation and reusable list/detail/form components. Store the initial relational model in one numbered D1 migration and keep local auth/session behavior explicitly stubbed.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Cloudflare Workers, D1, Nitro server routes, Vitest, SheetJS (`xlsx`) for the initial report download.

**Spec:** `docs/superpowers/specs/2026-10-07-cdphwic-dashboard-design.md`

## Global Constraints

- Role values are `admin | member`.
- Member types are `internal | agency`.
- Agency `Requests` shows all requests for that agency; agency `My Requests` shows that rep's requests.
- Internal FPU `Requests` shows all agencies with agency/rep filters; internal `My Requests` shows handled agencies and explicitly related reps.
- Unknown business fields use nullable columns or generic labeled inputs.
- Production auth, email delivery, AI prescription validation, R2 storage, and final business rules remain extension points.
- Preserve the existing Cloudflare resource IDs and environment configuration in `wrangler.jsonc`.

## Review Focus

- Agency users must not see another agency's requests; cover with scope tests and API filtering tests.
- FPU `My Requests` must differ from all-agency Requests; cover with assignment tests.
- Admin-only navigation and report/accounting endpoints must remain hidden/forbidden for members; cover with role tests.
- Optional generic fields and missing dates must not block request creation; cover with validation tests.
- Empty, filtered, and seeded list states must render without layout breakage; cover with component/API fixtures and build verification.

---

### Task 1: Add shared domain models and scope rules

**Files:**

- Create: `shared/domain.ts`
- Create: `shared/requestScope.ts`
- Modify: `shared/scaffold.ts`
- Test: `test/requestScope.test.ts`

**Interfaces:**

- Produces `UserRole`, `MemberType`, `SessionUser`, `RequestRecord`, `RequestScope`, `filterRequestsByScope()`, and `canAccessAdminFeatures()` for UI and server consumers.

- [ ] **Step 1: Write failing scope tests**

Test agency-member all vs mine behavior, internal staff handled-agency behavior, rep filtering, and admin access.

- [ ] **Step 2: Run the scope tests and verify they fail**

Run `npm test -- --run test/requestScope.test.ts`. Expected: FAIL because the domain and scope helpers do not exist.

- [ ] **Step 3: Implement the minimal domain types and scope helpers**

Implement deterministic in-memory filtering using `agencyId`, `agencyMemberId`, `handledAgencyIds`, `handledRepIds`, `scope`, and optional agency/rep filters.

- [ ] **Step 4: Run the scope tests and full suite**

Run `npm test`. Expected: PASS.

### Task 2: Add D1 migration and seeded domain data

**Files:**

- Create: `db/migrations/0001_initial_schema.sql`
- Modify: `db/dev/reset.sql`
- Modify: `db/dev/seed.sql`
- Create: `server/data/seed.ts`
- Test: `test/seedData.test.ts`

**Interfaces:**

- Produces SQL tables from the approved spec and `SEED_USERS`, `SEED_AGENCIES`, `SEED_MEMBERS`, `SEED_PRODUCTS`, `SEED_PARTICIPANTS`, and `SEED_REQUESTS` for the first dashboard.

- [ ] **Step 1: Write failing seed-data tests**

Assert that seeded users include one admin, one agency member, and one internal member; seeded requests cover multiple agencies, reps, statuses, and products.

- [ ] **Step 2: Run the seed tests and verify they fail**

Run `npm test -- --run test/seedData.test.ts`. Expected: FAIL because seed data is not defined.

- [ ] **Step 3: Implement typed seed data**

Add realistic but clearly synthetic data matching the shared domain models.

- [ ] **Step 4: Add the initial D1 schema**

Create the users, signup tokens, agencies, agency members, internal members, staff assignments, participants, products, requests, attachments, and McKesson tables with indexes for agency, rep, assigned staff, status, and dates.

- [ ] **Step 5: Add deterministic local reset and seed SQL**

Reset the initial tables in dependency-safe order and insert a minimal set of matching records for local D1 exploration.

- [ ] **Step 6: Run tests and local migration verification**

Run `npm test` and `npm run db:migrate:local:dev`. Expected: PASS; the migration applies without SQL errors.

### Task 3: Add auth, profile, request, summary, and report server routes

**Files:**

- Create: `server/utils/session.ts`
- Create: `server/utils/authorization.ts`
- Create: `server/api/auth/login.post.ts`
- Create: `server/api/auth/signup.post.ts`
- Create: `server/api/invitations.post.ts`
- Create: `server/api/profile.get.ts`
- Create: `server/api/profile.put.ts`
- Create: `server/api/requests/index.get.ts`
- Create: `server/api/requests/index.post.ts`
- Create: `server/api/requests/[id].get.ts`
- Create: `server/api/summary.get.ts`
- Create: `server/api/reports/requests.get.ts`
- Create: `server/api/products/index.get.ts`
- Create: `server/api/participants/index.get.ts`
- Create: `server/api/agencies/index.get.ts`
- Test: `test/apiContracts.test.ts`

**Interfaces:**

- Produces development session selection through `X-Demo-User` or a safe default, role checks, request list/create/detail contracts, profile assignment updates, summary data, and report download data.

- [ ] **Step 1: Write failing API contract tests**

Test request list scope, request creation with optional generic fields, admin-only invitation access, profile assignment update, and summary response shape.

- [ ] **Step 2: Run API tests and verify they fail**

Run `npm test -- --run test/apiContracts.test.ts`. Expected: FAIL because route helpers/contracts do not exist.

- [ ] **Step 3: Implement session and authorization helpers**

Provide a typed development session with admin, agency member, and internal member fixtures; centralize `requireSession()` and `requireAdmin()`.

- [ ] **Step 4: Implement request endpoints**

Return filtered seeded data for GET, validate known fields while accepting optional generic fields for POST, and return 404 for unknown IDs.

- [ ] **Step 5: Implement profile/invitation endpoints**

Return and update preferred analyst, handled agencies, and handled reps in the development session model; limit invitations to admins.

- [ ] **Step 6: Implement summary, catalog, and report endpoints**

Return typed aggregate metrics for the selected date/category/product filters and generate a basic XLSX response from request-log columns.

- [ ] **Step 7: Run API tests and full suite**

Run `npm test`. Expected: PASS.

### Task 4: Build the dashboard shell and core pages

**Files:**

- Modify: `app/layouts/default.vue`
- Modify: `app/assets/css/main.css`
- Replace: `app/pages/index.vue`
- Create: `app/components/AppSidebar.vue`
- Create: `app/components/AppTopbar.vue`
- Create: `app/components/StatusBadge.vue`
- Create: `app/components/RequestList.vue`
- Create: `app/components/RequestDetailDrawer.vue`
- Create: `app/components/MetricCard.vue`
- Create: `app/components/SummaryChartCard.vue`
- Create: `app/pages/requests/index.vue`
- Create: `app/pages/requests/new.vue`
- Create: `app/pages/summary.vue`
- Create: `app/pages/products/index.vue`
- Create: `app/pages/participants/index.vue`
- Create: `app/pages/agencies/index.vue`
- Create: `app/pages/reports.vue`
- Create: `app/pages/mckesson-log.vue`
- Test: `test/dashboardVisibility.test.ts`

**Interfaces:**

- Consumes shared domain/session data and server endpoint contracts. Produces the responsive dark dashboard and role-aware navigation/list/detail experience.

- [ ] **Step 1: Write failing dashboard visibility tests**

Test that admin navigation includes Reports/McKesson Log, agency navigation excludes them, and request labels switch between Requests and My Requests.

- [ ] **Step 2: Run dashboard tests and verify they fail**

Run `npm test -- --run test/dashboardVisibility.test.ts`. Expected: FAIL because the dashboard components/pages do not exist.

- [ ] **Step 3: Implement the app shell**

Create sidebar/topbar layout with responsive collapse, search field, user badge, New Request button, and dark Nova-inspired CSS tokens.

- [ ] **Step 4: Implement requests list and detail drawer**

Show status, submission/decision dates, ETA, agency, participant, product, and expandable request details with generic fields and attachment placeholders.

- [ ] **Step 5: Implement new request form**

Add known participant/request fields, formula autocomplete/select, diagnosis, extension toggle, generic fields, and prescription upload placeholder with validation-pending messaging.

- [ ] **Step 6: Implement summary, catalog, reports, and McKesson placeholder pages**

Render metric cards, CSS/SVG-friendly chart cards, date/category/product filters, list placeholders, and admin-only report/accounting actions.

- [ ] **Step 7: Run tests and build**

Run `npm test` and `npm run build`. Expected: PASS.

### Task 5: Add login, signup, invitations, and profile assignment UI

**Files:**

- Create: `app/pages/auth/login.vue`
- Create: `app/pages/auth/signup.vue`
- Create: `app/pages/profile.vue`
- Create: `app/pages/invitations.vue`
- Create: `app/components/AuthForm.vue`
- Create: `app/components/AssignmentForm.vue`
- Modify: `app/components/AppSidebar.vue`
- Test: `test/authUi.test.ts`

**Interfaces:**

- Consumes auth/profile/invitation APIs. Produces development login/signup and editable preferred analyst/handled agency/rep controls.

- [ ] **Step 1: Write failing auth/profile UI tests**

Test the role/member-type fields, profile assignment controls, and admin-only invitation action.

- [ ] **Step 2: Run tests and verify they fail**

Run `npm test -- --run test/authUi.test.ts`. Expected: FAIL because auth/profile pages do not exist.

- [ ] **Step 3: Implement auth and signup forms**

Use the local session stub and clearly label the demo behavior; signup supports admin/member and internal/agency choices only where appropriate.

- [ ] **Step 4: Implement profile assignment controls**

Agency members edit preferred analyst; internal members edit handled agencies/reps; admins can select a target member.

- [ ] **Step 5: Implement admin invitation form**

Support agency and internal invitations with email, member type, agency, and optional assignment fields.

- [ ] **Step 6: Run tests and full build**

Run `npm test` and `npm run build`. Expected: PASS.

### Task 6: Final verification and documentation

**Files:**

- Modify: `README.md`
- Modify: `db/dev/seed.sql`
- Modify: `docs/superpowers/specs/2026-10-07-cdphwic-dashboard-design.md` only if implementation decisions require clarification

- [ ] **Step 1: Document demo users and navigation scopes**

Add local development login identities, role/member-type behavior, D1 setup, report behavior, and future integration boundaries.

- [ ] **Step 2: Run the complete verification set**

Run `npm test`, `npm run build`, `npm run cf-typegen`, `npx wrangler deploy --config wrangler.jsonc --env=\"\" --dry-run`, and `npx wrangler deploy --config wrangler.jsonc --env dev --dry-run`. Expected: all exit successfully.

- [ ] **Step 3: Inspect final file and secret state**

Confirm only intended source/config/docs changes exist and no credentials or generated runtime directories are added.
