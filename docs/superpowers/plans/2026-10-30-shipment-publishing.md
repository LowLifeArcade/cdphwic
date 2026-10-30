# Shipment Publishing Implementation Plan

**Goal:** Save Shipments keeps CDPH/WIC drafts private; Send ETA and Send Update publish one shipment.
**Architecture:** Store staff draft rows separately from published shipments in the existing request JSON. Published aggregates, receipt keys, and agency views continue using published rows. Publishing one row retains other drafts and existing receipt history.
**Approval:** User approved the interactive preview and requested implementation.

- [x] Add regression tests for private draft saves, single-row publishing, incomplete new drafts, and preserved receipt history.
- [x] Add draft storage and publishing utility with revision protection; exclude drafts from agency API responses.
- [x] Update shipment editor to restore saved drafts, show Unsent changes, Send Update, and private-save feedback.
- [x] Run focused tests, full suite, production build, and inspect rendered behavior.

Review focus: legacy shipments; draft rows after received shipments; simultaneous receipt changes; removal of sent rows; publishing one row without exposing other drafts.

Verification: 245 tests passed; production build passed. Isolated app check confirmed saved draft survives reload, agency API excludes shipmentDrafts and retains previous tracking, Send Update publishes the new tracking. Replacement regression covers insertion before unrelated private drafts.
