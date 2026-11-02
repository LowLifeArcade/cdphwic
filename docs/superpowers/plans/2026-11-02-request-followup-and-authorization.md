# Request Follow-up and Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Return requests to LA for corrections and publish complete printable authorizations with ETA notices.

**Architecture:** Reuse needs_info as Pending LA, the complete-form submission editor, and durable request JSON with revision guards. Store sent authorization snapshots in request history and derive in-app notices from durable events. Extend the existing PDF endpoint and generator.

**Tech Stack:** Nuxt/Vue, TypeScript, D1, R2, pdf-lib, Vitest.

- [x] Add tested reviewer follow-up command and Pending LA status; enforce permissions, revisions and historical notes.
- [x] Enable LA save/correction/resubmit and replacement uploads using existing submission endpoint; keep required validation on Resubmit and preserve history.
- [x] Add More Info Requested panel after provider; expose correction link and status labels.
- [x] Add tested sent authorization snapshots for distributor and transfer ETA publication, protecting fields from arbitrary writes.
- [x] Extend scoped in-app notices with follow-up and ETA events; provide versioned PDF links.
- [x] Revise PDF with wrapped fields, both formulas, all request details, Next Steps, shipping/ETA, and final three signature/date rows.
- [x] Verify workflows, security, notifications and PDF text; render a synthetic sample for visual review; run complete tests and build. Do not push without user request.

## Verification record

- 306 tests pass, including reviewer-only return actions, immutable sent versions, per-agency notice isolation/read state, incomplete correction saving, replacement attachments, resubmission, and reconciled-surplus preservation.
- Production build succeeds. Rendered and inspected all three pages of a synthetic long-content PDF; signature block stays together.
- Isolated preview at port 8791: sent reviewer notes for synthetic request 9906, verified Pending LA, Local Agency notification, full correction editor, Resubmit action, and Save staying open. No normal local or production request data was changed.
- Review finding resolved: preserve unchanged reconciled surplus reports across resubmission; compare corrections against the surplus snapshot captured when information was requested.
- Ruling: use the current simple blue PDF layout until the user's sample is supplied. PDF reference: /tmp/cdphwic-authorization-draft.pdf.

## Follow-up conversation and approval accordion

- Added Local Agency responses beneath each active note, with reviewer notifications and role/agency/revision checks. Replies preserve the return workflow and Update and Resubmit remains available.
- More Info Requested uses a distinct purple conversation panel. Reviewer note edits and deletions remain supported.
- Approved requests collapse Participant, Prescription, WIC Food Restrictions, and Health Care Provider into an accessible accordion for Admin/CDPH only. More Info Requested stays visible so follow-up is not hidden.
- Verified against isolated sample request 9906: LA response saves, remains visible to reviewer, and the accordion closes after approval and opens/closes on demand.
- Final verification: 308 tests pass; production build passes. Review caught and resolved a conditional rendering issue hiding Resubmit after a reply; request detail refresh also retains the latest server response when views change.
