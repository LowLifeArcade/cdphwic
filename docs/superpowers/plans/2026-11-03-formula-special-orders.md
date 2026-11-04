# Per-formula Special Order Implementation Plan

**Goal:** Support the approved mixed request display: each formula has its own order type, mixed requests remain In Progress, all-special requests show Special Order, and ETA pending applies to unsent standard formulas.

**Architecture:** Store independently editable formulaOrders keyed by formula name, form, and flavor in request JSON. Shared helpers derive legacy fallback and list presentation. Reviewer-only updates validate complete selections and revision; no database migration is needed.

**Tech Stack:** Nuxt/Vue, TypeScript, D1 request JSON, Vitest.

- [x] Test mixed/all-special/legacy matching, list filters, pending ETA, role checks, invalid selections, and persistence.
- [x] Implement shared helpers and request field; validate and normalize reviewer updates. Preserve explicit formula flags when saving issuance; retain existing legacy issuance behavior.
- [x] Add reviewer controls beside Status; display every requested formula with its own tag in list, and update request-wide indicators/filter/ETA behavior.
- [x] Run tests and production build; inspect final diff. Leave changes unpushed.

Verification: 344 tests passed; production build passed. Browser verified mixed/all-special list statuses, Special Order filtering, immediate updates, and preservation of unfinished issuance edits using isolated synthetic Request #9910.
