# Review Decision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Put reviewer decisions before conditional messaging and authorization.
**Architecture:** Dedicated revision-checked reviewer command with persisted denial reason; existing conversation and authorization components retain their data.
**Tech Stack:** Nuxt, Vue, TypeScript, D1, Vitest.
**Spec:** docs/superpowers/specs/2026-11-02-review-decision-design.md

## Global Constraints
Three buttons; reviewer-only decisions; deny requires reason; closed until reviewer reopens; preserve histories; no push/deploy.

## Review Focus
Stale decisions reject; LA cannot decide/reopen; denial reason cannot be blank; pending conversations cannot override final decisions; existing approved records retain authorization.

### Task 1: Persist decisions
- [x] Add route tests for permission, required denial reason, stale revision, closed mutation protection, reopen, and pending conversation preservation. Run failing tests.
- [x] Implement reviewDecision command in submittedRequests and PUT; add denialReason to RequestRecord. Run tests.

### Task 2: Reorganize drawer
- [x] Add Review Decision after provider, remove duplicate decision controls, conditionally reveal conversation and authorization, add required denial reason and explicit reopen.
- [x] Run full tests/build, inspect browser with synthetic records and obtain fresh review.

Ruling: execute inline in existing workspace to preserve the user's pending label edits. No commit until requested.

Verification: new command route tests failed before implementation and passed afterward. Full suite: 329 tests across 68 files passed. Production build passed (28.1 seconds). Fresh review identified and verified fixes for generic LA approval/status bypass and legacy status-approved UI compatibility. Isolated request #9907 verified all three actions, required denial reason, denied read-only Local Agency view, reviewer reopening and approval opening authorization. Screenshot /tmp/cdphwic-review-decision.jpg. No push/deploy.

Decision editing refinement completed: reviewer-only direct revision of approval/denial plus request-info from denied; saved decision summary and explicit Edit/Cancel; unsent information draft cancellation; distinct navy header. Regression test failed before the change and passed afterward. Full suite 334 tests across 68 files and production build passed. Fresh review found no material issues. Isolated UI verified Approve hides buttons, Edit permits Deny, Deny hides buttons, and canceled information drafts leave the saved decision unchanged. Screenshot /tmp/cdphwic-review-decision-edit.jpg. No push/deploy.
