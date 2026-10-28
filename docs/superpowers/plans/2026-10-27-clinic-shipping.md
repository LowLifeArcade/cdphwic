# Clinic Shipping Implementation Plan
> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.
**Goal:** Agency-scoped address books and required request shipping, including Attention.
**Architecture:** D1 clinic_addresses persists address books. Shared shipping validation handles manual addresses; server resolves saved IDs within the submitting agency and stores immutable snapshots in existing request JSON. Reusable editor component manages each agency's address book.
**Tech Stack:** Nuxt/Vue, D1, existing XLSX import library, Vitest.
**Spec:** docs/superpowers/specs/2026-10-27-clinic-shipping.md

- [x] Test and implement address validation, scope enforcement, persistent CRUD/import, and migration 0008.
- [x] Implement manual and CSV/XLSX address-book UI on Agencies, with proper user scope and failures.
- [x] Implement Shipping form with agency/clinic selection, new-address entry, Attention, required validation, drafts, edits, canonical snapshot verification, and reviewer display.
- [x] Run tests/build, migrate local database only, verify browser flows using disposable data, request independent review and fix findings.

No remote migration, push, or deployment until requested. Preserve existing uncommitted Requests list edits.

## Verification
141 tests passed. Production build passed. Migration 0008 applied locally only. Browser verified agency clinic creation, dropdown selection, Attention, incomplete Save and reload. Live API verified foreign-agency denial, CDPH/WIC write denial, ZIP validation and CSV import preserving leading zeroes. Test draft deleted and test clinics archived. Independent review findings fixed and re-reviewed.

Ruling: New/draft submissions cannot select archived clinics; existing submitted request edits may retain their saved snapshot. Inline addresses stay request-specific. Admin may Save an unassigned draft for an agency with no representatives, but Submit requires a representative of that agency.
