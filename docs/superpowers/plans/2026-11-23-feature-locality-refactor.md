# Feature locality implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make future request/product feature work require the smallest practical reading context; behavior preservation is mandatory.

**Architecture:** Keep public pages, component names and server exports stable. Extract cohesive state owners and UI sections with explicit interfaces into feature folders; document direct entry points instead of introducing generic frameworks.

**Tech Stack:** Existing Nuxt 4, Vue 3, TypeScript, Vitest, Cloudflare D1.

**Spec:** docs/superpowers/specs/2026-11-23-feature-locality-refactor-design.md

## Global Constraints

- Token-efficient future feature changes are the number one goal.
- Preserve UI, HTTP contracts, stored JSON, authorization, revisions and atomic inventory writes.
- No production migration, deployment or unrelated visual changes.
- Use existing dependencies where possible; no giant exported script/context replacing a giant component.

## Review Focus

- Request switching must not reuse form edits from another request.
- Stale writes must fail without mutating persisted requests or inventory.
- Background message reads must not replace protected edits.
- Failed upload/save and unmount must release owned resources.
- Blank, zero and legacy product values must retain normalization and display behavior.

### Task 1: Request persistence and workflow ownership

**Files:** server/features/requests/{persistence,submission,review,shipments}.ts; server/utils/submittedRequests.ts; test/requestPersistence.test.ts.
**Interfaces:** Preserve every existing submittedRequests export and signature. Export internal conflict/nextRecord/writeRecord primitives only from persistence; workflow modules depend on these, never vice versa.
- [x] Add tests for immutable identity/revision, opened timestamp, optimistic guard/batch ordering, error translation and visibility; run before moving code.
- [x] Extract existing functions unchanged, assign imports only to modules that need them, keep facade explicit.
- [x] Run persistence, follow-up, shipment, transfer and full existing tests; inspect failures before proceeding.

### Task 2: Product client boundaries

**Files:** app/features/products/components/ProductEditorFields.vue; app/features/products/composables/useProductMutation.ts; product pages; test/productFeature.test.ts; existing editor tests.
**Interfaces:** Field component takes the existing editor model. Mutation composable owns busy/error lifecycle, accepts typed operation callbacks and error fallback, leaving HTTP payload construction/navigation visible in pages.
- [x] Add runtime component/composable tests covering field ordering and legacy values, mutations, failure and busy lifecycle; observe missing-module failure.
- [x] Extract field rendering and mutation lifecycle without changing create/edit field differences.
- [x] Update existing layout tests to render explicit extracted children; run product tests.

### Task 3: Request creation boundaries

**Files:** app/features/requests/composables/ and components/ for diagnosis, prescription, submission and form sections; app/pages/requests/new.vue; corresponding request creation tests.
**Interfaces:** Use explicit refs/getters, no bag of untyped page state. Serialization stays pure where feasible; asynchronous document ownership has explicit lifecycle cleanup.
- [x] Characterize diagnosis edits, payload construction, draft/edit differences and document removal/cancellation before extraction.
- [x] Extract cohesive state and UI sections, retaining shared form state ownership in the page where necessary.
- [x] Update affected source assertions to target owning files; run request creation and full tests.

### Task 4: Request detail boundaries

**Files:** app/features/requests/components/ and composables/ for conversation, review, detail sections and authorizations/shipment presentation; app/components/RequestDetailDrawer.vue; corresponding tests.
**Interfaces:** Props/emits for sections, typed refs/getters for stateful composables. Save orchestration and cross-feature dependencies remain explicit in drawer.
- [x] Characterize background message merge protections, identity/request switching and cleanup; add section rendering tests before moving logic.
- [x] Extract cohesive UI/state owners. Avoid interface explosion; keep tightly coupled operations together.
- [x] Adapt affected tests without concatenating entire folders; run targeted and full suite.

### Task 5: Discovery, integration and independent review

**Files:** AGENTS.md; docs/feature-map.md; package.json if focused scripts help; test/helpers for narrowly scoped component compilation where needed.
**Interfaces:** Feature map points to actual code owners and actual test commands, not an additional architecture layer.
- [x] Add concise routing instructions, workflow/file/test map and invariants.
- [x] Run full tests, compile all SFCs and production build; inspect imports/cycles and before/after main-file sizes.
- [x] Independent final review, address substantive findings with regression tests and repeat relevant checks.
- [x] Report verified outcomes, limitations and remaining hotspots; leave all changes available in the user's checkout.

## Execution ledger

- Baseline: 110 files, 626 tests passed (2026-11-23); existing unresolved-component warnings and Vite transform deprecations.
- Decision: execute in the current authorized checkout, already on codex/agency-surplus-tracker; no worktree or branch changes needed for this refactor.
- Decision: no automatic commits during implementation; preserve a reviewable working diff in the shared checkout.

## Implementation results

- All five tasks completed in the shared checkout; no automatic commits, remote migrations or deployments.
- Server ownership is further focused than the initial four-module sketch: persistence, submission, review decisions, conversation commands, message reads, shipment plans, shipment receipts, shipment actions. Public exports remain compatible.
- Independent review found no introduced behavioral bug and compared all 30 moved backend function ASTs against HEAD: runtime logic preserved apart from equivalent braces/formatting.
- Review follow-up: late prescription parses now skip applying fields after scope disposal and remove their otherwise orphaned temporary upload. Regression test observed failing before the fix and passing afterward. Already-saved upload keys are not deleted on navigation.
- Integration fix: Nuxt/Rolldown preserved a relative external for a newly extracted shared dependency. Client feature imports now use the explicit `#shared/` alias; Vitest resolves the same alias. Production build verified this boundary.
- Verification: full suite 121 files / 664 tests passed (baseline 110 / 626); all 62 Vue scripts/templates/styles compile; production build passed; git diff whitespace check passed.
- Additional check: vue-tsc against the existing generated app configuration reports 94 diagnostics, compared with 157 for a temporary archived HEAD using the same configuration/dependencies. Every remaining diagnostic also occurs in the baseline (normalized file/diagnostic/message comparison); none occur in new feature modules. This is not a clean project-wide type check.
- Locality evidence: request-creation entry point 1,313 -> 825 lines; request drawer 1,386 -> 1,116; persistence facade 552 -> 11. Medical display now starts in an 18.5 KB owner; catalog/issuance edits start in two owners totaling 16.3 KB, compared with the original 135.7 KB drawer. These are source-size comparisons, not promised token percentages.
- Decision: retain route/draft restoration coordination in the new-request page and cross-workflow review/transfer/shipment coordination in the drawer. Extracted state owners and the feature map isolate common changes; a larger split here would currently require passing extensive shared mutable state. Cost: cross-workflow changes can still need these larger entry points.
- Verification limit: actual SSR component rendering and composable behavior are covered, but browser layout, focus/scroll behavior and interactive DOM events have not been independently exercised in a browser.
