# Transfer Labels and Pickup Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan inline.

**Goal:** CDPH/WIC uploads labels; sending LA prints them, schedules GSO collection, and confirms pickup with reviewer notification.

**Architecture:** Store transfer-specific file metadata in D1 and file bodies in R2. Authorize reviewers to upload and participating agencies to read without exposing participant requests to the sending agency. Reuse the existing atomic ship/reservation operation for the user-approved single Confirm Pickup action.

**Tech Stack:** Nuxt/Vue, D1 migration 0012, R2, Vitest.

- [x] Add file signature/size validation, scoped label storage/list/download routes, rollback cleanup, and concurrency tests.
- [x] Add shared label upload/download/open-print UI to CDPH Shipment and LA Transfer cards.
- [x] Add concise GSO pickup instructions using the verified GLS phone and official link.
- [x] Rename Confirm Transfer to Confirm Pickup; derive reviewer pickup notifications from the committed transfer shipment record; test single deduction and permissions.
- [x] Run tests/build and verify isolated preview. No production data changes or deployment.

User confirmed: Confirm Pickup replaces Confirm Transfer and is used after carrier collection. It marks In Transit, deducts reserved inventory, and notifies CDPH/WIC. Receipt confirmation stays with the destination request.

Source checked 2026-11-02: https://gls-group.com/US/en/home/ lists 1-800-322-5555 and links its pickup portal. Instructions ask LA to have pickup address, contact, packages, tracking numbers and requested collection window ready, without asserting carrier-specific requirements or exposing CDPH billing credentials.

Verification: 311 tests passed across 68 files; production build passed. Isolated Wrangler preview confirmed reviewer upload, sending-agency byte-identical PDF download, pickup instructions, Confirm Pickup → In Transit, one inventory deduction, and reviewer pickup notification. Screenshots: /tmp/cdphwic-transfer-labels-la.jpg and /tmp/cdphwic-pickup-confirmed.jpg. Migration 0012 applied to isolated preview only; apply to target database before deploying. No push or deployment performed.
