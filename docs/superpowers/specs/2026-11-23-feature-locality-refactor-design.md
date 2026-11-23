# Requests and products: feature locality refactor

## Intent

**Number one goal:** reduce the context needed for future request, product, and related data changes. Preserving application behavior is a hard constraint. The user selected broader feature organization and explicitly requires thorough regression tests. Token reduction is a design objective, not a measured guarantee: future prompts and agent behavior also affect usage.

## Approaches

1. Extract only the largest files. Less work, but ownership and feature discovery remain scattered.
2. Organize requests and products around cohesive feature boundaries, with focused components, explicit composable interfaces, workflow-specific server modules, and concise navigation instructions. **Selected approach.**
3. Rewrite the application architecture. Rejected: unnecessary behavior and migration risk, and more abstractions to read.

## Constraints and compatibility

- Preserve visible UI, routes, HTTP payloads, authorization, validation messages, stored JSON, D1 schema, and transaction semantics.
- Preserve optimistic concurrency, request identity fields, revisions, shipment/inventory atomicity, and agency visibility.
- Preserve Nuxt SSR behavior and reactivity; never share request-specific reactive state at module scope.
- Preserve draft reset, save/error state, document cleanup, message polling cleanup, and protection against overwriting unsaved edits.
- Use the existing Nuxt/Vue/TypeScript/Vitest stack. Add test dependencies only if runtime component coverage cannot reasonably use existing packages.
- No production migrations, deployment, data writes, or unrelated visual changes.
- Avoid catch-all context objects, generic workflow frameworks, duplicate sources of truth, and excessive tiny files.

## Proposed structure and responsibilities

### Client requests

Keep pages and `RequestDetailDrawer.vue` as orchestration entry points. Move cohesive request functionality to explicitly imported modules under `app/features/requests/`, with `components/` and `composables/` beneath it. Retain existing public component entry points to avoid changing consumers unnecessarily.

Split the new-request page by ownership: form sections; diagnosis interaction; prescription upload/removal; draft/edit restoration; submission construction and validation. Split request detail by ownership: read-only/editable request details; review decisions and more-info conversation; authorizations; shipment editing and actions. Use props/emits or typed composable arguments with explicit getters/refs. Functions that coordinate multiple workflows stay in the orchestrator. Exact boundaries follow the state dependencies found during implementation; moving an entire script behind one giant export is not an acceptable substitute.

Keep pure business rules in shared modules rather than importing client feature code into the server. Do not relocate every existing shared helper merely for naming consistency.

### Products

Place shared create/edit field rendering and client editor behavior under `app/features/products/`. Keep page-specific loading, create/update/delete actions and navigation explicit. Preserve existing shared field definitions, normalization, bulk-import contracts, and product repository boundaries; extract only responsibilities that currently mix unrelated concerns or duplicate behavior. Product changes should have a clear path from page to field definitions to validation to repository and migration.

### Server requests and data

Decompose `server/utils/submittedRequests.ts` into modules under `server/features/requests/`: persistence/concurrency primitives; submission editing; review/conversation commands; shipment commands and receipt/catalog packaging. Retain its existing exports as a compatibility facade while migrating internal consumers where helpful. Lower-level persistence must not import workflow modules. Workflow modules may use persistence primitives and existing inventory/catalog helpers. Preserve batch ordering, guard statements, inventory updates, and error translation exactly.

Keep seed-memory request storage distinct from persisted D1 submissions. Document which path routes use rather than merging the two stores. Keep product repository/database/import modules as canonical data owners; introduce no second product store or cache.

### Discovery and targeted checks

Add a short root `AGENTS.md` with entry points, invariants, and a link to a compact feature map. The map lists common request/product change types, relevant client/server/shared files, data ownership, and targeted test commands. Add a maintained test selector or npm scripts if that makes focused checks reliable. Instructions should direct future agents to targeted searches and reads, then broader tests when shared contracts change. Avoid duplicating detailed implementation descriptions that will go stale.

## Regression strategy

1. Run and record the existing full suite before extraction. Distinguish baseline failures from introduced failures.
2. Add executable characterization tests before moving high-risk logic. Cover request revision/immutable fields and stale updates; agency visibility; review and message transitions; shipment publication/receipt and transfer inventory behavior; request form submission and draft/edit restoration; product editor normalization and persistence errors.
3. Add runtime Vue tests for extracted stateful composables/components, using isolated refs and stubbed network/router dependencies. Cover request switching and unsaved draft protection, success/failure cleanup, and unmount cleanup where the extracted boundary owns timers/resources. Reuse meaningful existing D1 integration tests.
4. Update source-layout assertions to follow extracted files only when those tests still express useful UI requirements. Add behavioral assertions for moved stateful logic rather than replacing source assertions with concatenated whole-directory reads.
5. Validate Vue SFC compilation and production build in addition to the full test suite. Use targeted checks during each extraction; run the full suite and build after integration. Record actual results and any unavailable checks.
6. Review imports for cycles and accidental client/server coupling. Report before/after sizes for the main orchestrators and identify which workflows can now be read independently. Do not claim a percentage token saving without a reproducible measurement.

## Execution and completion

Implement incrementally: baseline and navigation; server persistence/workflows; product editor; request creation; request detail; integration review. Each extraction must leave working imports and passing relevant tests. The implementation plan will specify exact interfaces and test cases after tracing the relevant state relationships.

Done means the selected request/product boundaries are extracted, compatibility exports and callers work, regression coverage exercises moved behavior, the full suite and build have been run, and concise navigation makes common changes discoverable without reading whole orchestrators. Any remaining large orchestration sections or unverified behavior must be reported explicitly.

Implementation choices left to the builder: precise section granularity, typed interface names, fixture reuse, and whether a small Vue test dependency is necessary. The default execution choice is to implement in the current chat to avoid repeated context loading; this is a proposal, not a user-selected method.
