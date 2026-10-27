# Surplus Donation and Destruction Notices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Notify local agencies inside the app when verified formula stock has at least 60 calendar days remaining until expiration, and notify them to destroy expired stock, with the appropriate Formula Donation or Formula Destruction form once uploaded.

**Architecture:** Build on the D1 inventory and forecasts from the companion tracker plan. A daily Worker check and inventory-change evaluation upsert durable agency notices. Store separately versioned donation and destruction PDFs in private R2 and expose authorized downloads through notification routes.

**Tech Stack:** Existing Nuxt/Vue/TypeScript, Cloudflare Workers scheduled hook, D1, R2, and Vitest. No email service, desktop automation, or new dependency.

**Spec:** `docs/superpowers/specs/2026-10-26-surplus-tracker-design.md`

## Global Constraints

- Donation notices are in-app only, as selected by the user.
- Compare date-only expiration against the current date in America/Los_Angeles.
- For positive on-hand stock with 60 calendar days or more remaining until expiration, create or update one active notice for the owning agency and lot.
- Reserved stock is explicitly excluded from donation availability.
- Acknowledging a notice does not deduct stock or establish that donation happened.
- The Formula Donation form will be uploaded later; never invent an attachment or silently suppress time-sensitive notices while it is missing.
- Expired-stock notices instruct destruction and include the Formula Destruction Form; never attach the donation form to a destruction notice.
- Acknowledging a destruction notice does not change stock; verified destruction debits only the Expired/Quarantined bucket.
- Expiration first moves remaining units to Expired/Quarantined and blocks/releases unshipped reservations; it does not reduce total physical stock.
- Agency members see their agency's notices; Admin/FPU can see notices across agencies.
- Production migration and deployment are later release steps.

## Review Focus

- Calendar boundaries at days 59, 60, and 61, midnight, and daylight-saving changes must not shift eligibility; Task 1 tests explicit instants.
- Daily cron and balance-change processing may run concurrently; Task 2 tests one active notice and stable unread counts.
- Each form may be missing at first and published later; Task 3 tests the notice remains visible and the attachment becomes downloadable without a duplicate notice.
- A reserved lot approaches expiry; Tasks 1 and 2 test the notice excludes reserved stock from donation availability and does not change balances.
- A notification ID or attachment URL is guessed by another agency; Tasks 3 and 4 assert 403/404 and no content disclosure.

## File map and dependencies

Requires Tasks 1–5 of `2026-10-26-agency-surplus-tracker.md`, specifically `SurplusLot`, role helpers, inventory mutation hooks, forecast tasks, and `getSurplusLots`. Create `shared/surplusNotices.ts`, `server/utils/surplusNotices.ts`, `server/utils/surplusFormStore.ts`, `server/plugins/surplusScheduled.ts`, `db/migrations/0007_surplus_notifications.sql`, API routes under `server/api/notifications/` and `server/api/surplus/forms/[kind]/`, `app/components/NotificationInbox.vue`, and `app/components/SurplusFormSettings.vue`. Mount the inbox in the existing topbar and the form settings in the Admin tracker view.

### Task 1: Calendar-date and notice content rules

**Files:** create `shared/surplusNotices.ts`, `test/surplusNoticeRules.test.ts`.

**Interfaces:** export `losAngelesDate(now: Date): string`, `expirationNotice(lot: SurplusLot, now: Date): NoticeContent | undefined`, and `NoticeContent { kind: 'donation-needed'|'expired-stock'; title: string; message: string; agencyId: number; lotId: string; daysRemaining: number; availableDonationUnits: number }`. Compute day differences from calendar dates, not elapsed 24-hour blocks.

- [ ] Write tests: 90, 61, and exactly 60 days => donation-needed; 59, 1, and 0 => no donation notice; -1 => expired-stock; zero usable and zero expired units => no notice; positive expiredUnits => destruction notice; on hand 10/reserved 4 => available donation 6; fully reserved stock => message directs coordination with Admin/FPU and available donation 0.
- [ ] Add tests at LA midnight and spring/fall daylight-saving transitions. An agency with an undated lot receives no invented expiration; unresolved report expiration is visible in the tracker instead.
- [ ] Run `npm test -- test/surplusNoticeRules.test.ts`; confirm failures before implementation.
- [ ] Implement the functions and message content, including formula/form/flavor/expiration, on-hand, reserved, and available quantities. For expired stock, instruct the agency to complete the Formula Destruction Form and report actual destruction; include the destruction attachment status and do not instruct donation.
- [ ] Run tests and commit with `feat: define surplus expiry notice rules`.

### Task 2: Durable notices, scheduling, and forecast tasks

**Files:** create `db/migrations/0007_surplus_notifications.sql`, `server/utils/surplusNotices.ts`, `server/plugins/surplusScheduled.ts`, `test/surplusNotices.test.ts`; modify inventory command service to enqueue/re-evaluate affected lots and `wrangler.jsonc` to add the daily trigger.

**Interfaces:** `evaluateSurplusNotices(db: D1Database, now: Date): Promise<{created: number; updated: number; closed: number}>`; `evaluateLotNotice(db, lotId, now): Promise<void>`; `listAgencyNotices(db, actor, {unreadOnly?}): Promise<AgencyNotice[]>`; `markNoticeRead(db, actor, noticeId): Promise<void>`. `AgencyNotice` stores agencyId, source lot/forecast, content, active/resolved status, created/updated times, and current attachment availability. Read state is per user, not a global acknowledgement.

- [ ] Write tests for upsert idempotency across scheduled runs and inventory updates, zero-physical-stock notice closure, notice retention while expiredUnits remains positive, closure when remaining life drops from 60 to 59 days, expiry correction, transition to expired-stock warning, and agency-scoped read/unread state. Concurrent evaluation must create one active notice per agency/lot and notice kind; notice evaluation does not change quantities; the preceding idempotent expiration step may reclassify units without changing the physical total.
- [ ] Add tests for forecast confirmation tasks: due and overdue forecasts link to the agency confirmation screen and disappear only when resolved by the tracker workflow, not merely when read.
- [ ] Run failing tests, implement the migration and services, run `expireSurplusLots` before evaluating notices, then hook the existing Nitro `cloudflare:scheduled` event. Use a daily `0 16 * * *` Worker trigger; eligibility still uses America/Los_Angeles dates. Call the hook's `context.waitUntil` correctly when scheduling work. Check installed Wrangler help/schema before finalizing the trigger.
- [ ] Verify scheduled evaluation locally using the Worker's local scheduled-handler facility, then repeat the same event to verify no duplicates. Do not configure an external email service or Codex automation.
- [ ] Run tests and commit with `feat: schedule in-app surplus and confirmation notices`.

### Task 3: Donation/destruction form upload and protected attachments

**Files:** create `server/utils/surplusFormStore.ts`, `server/api/surplus/forms/[kind]/index.post.ts`, `index.get.ts`, `[version].get.ts`, `app/components/SurplusFormSettings.vue`, `test/surplusFormStore.test.ts`, `test/surplusFormApi.test.ts`.

**Interfaces:** `publishSurplusForm(db, bucket, actor, kind: 'donation'|'destruction', file: {name: string; contentType: string; bytes: Uint8Array}): Promise<SurplusFormVersion>`; `getActiveSurplusForm(db, kind): Promise<SurplusFormVersion | undefined>`; `downloadSurplusForm(db, bucket, actor, kind, versionId): Promise<{body: ReadableStream; fileName: string; contentType: string}>`. `SurplusFormVersion` stores kind ('donation' or 'destruction'); each kind has an independent active version. A version has a UUID, private storage key, display name, uploader ID, created timestamp, and active flag. Upload route is Admin-only; agency download authorization follows the related notice's agency.

- [ ] Write tests for missing form, genuine PDF signature, 10 MiB limit, rejecting non-PDF content, unauthorized publication/download, and version publication rollback if storage or metadata write fails. Reuse existing prescription upload validation primitives where appropriate, not its temporary-key lifecycle.
- [ ] Test that donation and destruction notices select their own form kind and never substitute the other attachment. Test that an existing active notice shows a clear missing-form message before publication and can download the published form afterward without creating a second notice. Publishing a replacement preserves prior version metadata.
- [ ] Run failing tests, then implement versioned private R2 storage and authorized streaming downloads with a safe Content-Disposition filename. Keep object keys private and do not use unauthenticated public R2 links.
- [ ] Build Admin upload/publish controls and a persistent configuration warning while no form exists. The agency notice remains actionable as an expiring-stock warning while the attachment is missing.
- [ ] Run tests and commit with `feat: attach versioned donation forms to agency notices`.

### Task 4: In-app inbox and tracker visibility

**Files:** create `server/api/notifications/index.get.ts`, `[id]/read.post.ts`, `app/components/NotificationInbox.vue`, `test/notificationApi.test.ts`; modify `app/components/AppTopbar.vue` and `app/pages/surplus.vue`.

**Interfaces:** GET `/api/notifications` returns `{unreadCount, notices}` through `listAgencyNotices`; POST `/api/notifications/:id/read` delegates to `markNoticeRead`. `NotificationInbox` mounts from the existing Notifications button and refreshes on identity change and after read actions.

- [ ] Write route tests for agency cross-scope denial, Admin/FPU all-agency visibility, per-user read state, stale/deleted notice IDs, and attachment access through an authorized notice.
- [ ] Run failing tests, implement routes, then wire the topbar bell to a dark inbox with unread badge, formula/agency/expiration details, available donation units, protected attachment, and links to relevant lots and confirmation tasks. Marking read never changes an inventory balance or a confirmation's completion status.
- [ ] Verify in a local browser with agency and Admin/FPU identities: 60-day notice, fully reserved lot, expired lot, missing form, newly published PDF, and a forecast confirmation task. Check keyboard focus, empty/error states, and unread-count refresh.
- [ ] Run tests and commit with `feat: add agency surplus notification inbox`.

### Task 5: End-to-end and release documentation

**Files:** extend `scripts/verify-surplus-local.mjs`, update `docs/surplus-operations.md`.

- [ ] Run `npm test` and `npm run build`; require exit 0.
- [ ] Verify two repeated scheduled checks produce one notice, zero total physical stock closes it, and quarantined units keep the destruction notice active until verified destruction, a published form is accessible only to authorized agency users, and acknowledgement leaves balances unchanged for both donation and destruction notices. Verify a completed donation is recorded through the tracker's audited deduction, not through an inbox action. Recheck that at least 60 calendar days remain when recording the donation; reject it at 59 days even if a notice was issued earlier.
- [ ] Document the two local migrations, daily trigger, LA date rules, donation/destruction form upload, missing-form behavior, and overdue-forecast handling. Record release prerequisites without running remote migration/deployment.
- [ ] Include this subsystem in the whole-feature review and commit verification documentation with `docs: document surplus donation notices`.

## Self-review

The spec's 60-day rule, user-selected in-app channel, future attachment, reserved-stock protection, and per-agency visibility are covered by Tasks 1–5. All five Review Focus conditions have explicit tests. The core tracker plan owns stock mutations (including verified destruction) and forecast reconciliation; this plan owns notices and attachment availability only.
