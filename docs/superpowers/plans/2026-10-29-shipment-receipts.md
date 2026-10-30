# Shipment Receipts Implementation Plan

**Goal:** Let Local Agency select individual delivered shipments across requests and confirm them together, with delivery/tag filters and sorting.
**Architecture:** Persist receipt time and actor on each shipment in existing request JSON. Submit shipment index plus a content fingerprint to the existing authenticated request endpoint; validate against current data, preserve other shipments, and mark Complete only when all are received. Existing whole-request confirmations remain recognized. List and drawer share receipt utilities.
**Tech Stack:** Nuxt/Vue, TypeScript, D1, Vitest.

Approved design: unchecked shipment checkboxes; Confirm Selected Receipts; Awaiting Receipt, Partially Received, Fully Received, Shipment Issue categories; New, Extension, Approved, Special Order tags; ETA, Submitted Date, Participant Name sorts. Receipt controls are Local Agency/Admin as existing; filters initially shared across user types.

- [x] Add failing tests for individual receipts, completion, legacy records, stale selections and delivery filtering/sorting.
- [x] Implement receipt utilities and authenticated server command, preserving concurrent-write guards and agency access.
- [x] Replace whole-request receipt controls in list and drawer with individual selection; bulk results retain failed selections.
- [x] Add delivery/tag filters and sorting, clear hidden selections when changing filters.
- [x] Run tests/build and verify the full Local Agency flow using isolated data; review diff. Do not push until requested.

Verification: 180 tests passed; production build passed; isolated Local Agency browser flow verified partial receipts persisted after reload, final receipt from item, bulk confirmation across two requests, combined delivery/tag filters and ETA sort. Independent code review findings resolved with regression tests for stale staff saves, stale agency aggregate values, identical shipments, and issue resolution. No push/deploy performed.

Ruling: Receipt metadata stays attached to its existing shipment index and content. Received shipment details cannot be changed or removed; this prevents stale staff screens from erasing or transferring confirmations. Existing aggregate receipt confirmations are retained with a legacy marker when shipping data is next saved. Dates and actors remain absent for historical receipts rather than invented.

User revision: Removed shipment checkboxes, inline shipment rows, and bulk receipt actions from the Requests list. Receipt confirmation remains per shipment inside the request item. Delivery/tag filters, sorting, ETA formatting, and shipped-request navigation remain.
