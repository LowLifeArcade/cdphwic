# CDPHWIC Closed B2B Access Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the closed B2B authentication and invitation flow with admin-managed access requests, email verification, and role-specific signup.

**Architecture:** Keep the current development session stub, but move invitation and access-request state into typed server stores backed by the existing D1 schema shape. The token route exposes only masked invitation metadata, verification creates a short-lived signup session, and completion persists the correct agency/member records. The UI keeps `/` as sign-in, uses an unlinked token route for signup, and adds admin-only signup-request and invitation screens.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Cloudflare Workers/Nitro, D1/SQLite schema, Vitest, Prettier.

**Spec:** `docs/superpowers/specs/2026-10-07-cdphwic-dashboard-design.md`

## Global Constraints

- The home route `/` is the sign-in page; there is no public signup navigation.
- Signup is reachable only through an admin-issued tokenized invitation link.
- An invitation link first shows email verification; a one-time code is required before signup is revealed.
- Verification must not expose the full invited email or whether an arbitrary email belongs to an invitation.
- Admin and member roles remain separate from internal and agency member types.
- Keep production password hashing, real email, R2, AI validation, OAuth, 2FA, and passkeys as extension points only.
- Preserve the existing dashboard, request filtering, mobile layout, tests, and build behavior.

## Review Focus

- Shared invitation links: verify the code is required and the token cannot be completed after use or expiry. Test in Task 2.
- Invitation enumeration: invalid tokens and verification requests must return safe responses without revealing a full email. Test in Task 2.
- Agency representative scope: signup may edit the invited agency but cannot switch agency or create one. Test in Task 3.
- Staff agency selection: staff signup can select existing agencies or create one while preserving assignments. Test in Task 3.
- Role visibility: members must not see signup requests or invitations, while admins can process them. Test in Task 4.

---

### Task 1: Shared access-flow contracts and persistence shape

**Files:**

- Create: `shared/accessFlow.ts`
- Modify: `shared/domain.ts`
- Modify: `server/data/seed.ts`
- Modify: `db/migrations/0001_initial_schema.sql`
- Create: `db/migrations/0002_closed_access_flow.sql`
- Modify: `db/dev/reset.sql`
- Modify: `db/dev/seed.sql`
- Test: `test/accessFlow.test.ts`

**Interfaces:**

- Produces `AccessRequest`, `AccessRequestStatus`, `InvitationType`, `SignupTokenPreview`, `SignupCompletionInput`, and safe helpers for masking/validation.
- Produces migration fields for `access_requests` plus verification and request-link fields on `signup_tokens`.

- [ ] Write tests for email masking, access-request validation, allowed invitation types, and safe token preview output.
- [ ] Run `npm test -- test/accessFlow.test.ts` and verify it fails because the contracts/helpers do not exist.
- [ ] Implement the shared types/helpers and update seed/schema definitions with the new access-flow fields.
- [ ] Run the focused test and the full suite; verify both pass.
- [ ] Run `npx prettier --write` on changed TypeScript, SQL, and test files.

### Task 2: Invitation token verification and signup completion APIs

**Files:**

- Create: `server/utils/signupTokens.ts`
- Create: `server/api/signup-tokens/[token].get.ts`
- Create: `server/api/signup-tokens/[token]/verify/start.post.ts`
- Create: `server/api/signup-tokens/[token]/verify/complete.post.ts`
- Create: `server/api/signup-tokens/[token]/complete.post.ts`
- Modify: `server/utils/session.ts`
- Modify: `server/api/auth/login.post.ts`
- Test: `test/signupTokens.test.ts`
- Test: `test/authContracts.test.ts`

**Interfaces:**

- Consumes `SignupTokenPreview` and validation helpers from Task 1.
- Produces `GET /api/signup-tokens/:token`, `POST /api/signup-tokens/:token/verify/start`, `POST /api/signup-tokens/:token/verify/complete`, and `POST /api/signup-tokens/:token/complete`.
- Development verification start returns a non-production `developmentCode`; completion returns a short-lived signup session token.

- [ ] Write tests for valid/invalid/expired/used tokens, bounded verification attempts, code expiry, safe masked output, and completion requiring a verified session.
- [ ] Run the focused tests and verify they fail for missing routes/services.
- [ ] Implement token lookup, one-time six-digit code generation/hash/expiry, verification session creation, and completion guards. Keep development storage compatible with the current seeded stub while shaping the D1 records for migration.
- [ ] Replace the login role selector contract with email/password input mapped to the seeded users; keep password checking explicitly stubbed for development.
- [ ] Run focused and full tests; verify all pass.

### Task 3: Access-request, admin invitation, and agency APIs

**Files:**

- Create: `server/api/access-requests/index.post.ts`
- Create: `server/api/access-requests/index.get.ts`
- Create: `server/api/access-requests/[id]/approve.post.ts`
- Create: `server/api/access-requests/[id]/deny.post.ts`
- Create: `server/api/agencies/index.post.ts`
- Modify: `server/api/invitations.post.ts`
- Modify: `server/utils/authorization.ts`
- Test: `test/accessRequestApi.test.ts`

**Interfaces:**

- Consumes session/admin checks from existing authorization utilities and token creation from Task 2.
- Produces access-request create/list/approve/deny endpoints and agency creation for staff/admin signup.
- Approval creates an invitation tied to the requested email and member type, returning a development invitation URL; denial records a reason.

- [ ] Write tests for public access-request submission, admin-only list/process behavior, approval link creation, denial blocking signup, and staff agency creation.
- [ ] Run focused tests and verify the expected missing-route failures.
- [ ] Implement consistent `{ message, fieldErrors? }` error responses, admin guards, request status transitions, and invitation creation.
- [ ] Run focused and full tests; verify all pass.

### Task 4: Closed-auth and admin UI

**Files:**

- Modify: `app/pages/index.vue`
- Modify: `app/pages/auth/login.vue`
- Create: `app/pages/request-access.vue`
- Create: `app/pages/signup/[token].vue`
- Modify: `app/pages/invitations.vue`
- Create: `app/pages/signup-requests.vue`
- Modify: `app/components/AppSidebar.vue`
- Modify: `shared/navigation.ts`
- Modify: `app/assets/css/main.css`
- Test: `test/authUi.test.ts`
- Test: `test/dashboardVisibility.test.ts`

**Interfaces:**

- Consumes the API contracts from Tasks 2 and 3.
- Produces a sign-in-only home page, linked request-access form, token route with verification-first state, role-specific completion fields, admin signup-request queue, and admin invitation link generation.

- [ ] Write UI contract tests for sign-in-only home content, no public signup link, verification-first token flow, request-access fields, and admin/member navigation visibility.
- [ ] Run focused UI tests and verify they fail against the current redirect/open-signup UI.
- [ ] Implement the forms and state transitions. Agency reps can edit only the invited agency; staff can select existing agencies or add one. Keep the invite URL out of navigation and display development codes/links only where the current stub requires it.
- [ ] Add responsive styles for verification, request-access, and admin queue screens without regressing the existing mobile dashboard.
- [ ] Run focused and full tests; verify all pass.

### Task 5: Integration verification and documentation

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-10-07-cdphwic-dashboard-design.md` only if implementation details require clarification.

- [ ] Run `npx prettier --check` across all changed app, server, shared, test, config, SQL, and documentation files.
- [ ] Run `npm test` and verify the complete suite passes.
- [ ] Run `npm run build` and verify Nuxt/Cloudflare output succeeds.
- [ ] Run `npm run cf-typegen` and verify Cloudflare types remain valid.
- [ ] Run the local D1 migration/reset path if available and verify migrations apply without SQL errors.
- [ ] Update README with the closed B2B flow, development verification-code behavior, seeded admin/member emails, and production email/auth caveat.
