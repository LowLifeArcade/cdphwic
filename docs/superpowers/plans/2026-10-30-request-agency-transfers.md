# Request-linked Agency Transfers

**Goal:** Implement the approved Shipment Source preview using existing agencies and surplus inventory, without distributor duplicates or duplicate receipt entry.
**Architecture:** Link existing surplus_transfers to a request shipment with a durable transfer ID. Extend transfer storage with request reference, packaging, ETA, destination snapshot and actual receipts. Reserve/debit inventory and write request JSON in the same D1 batch, guarded by request revision and inventory/status predicates. Sending agency sees a transfer-only projection via the surplus page, not participant details.
**Scope:** Distributor flow remains supported. Reserved transfers are locked to their authorized lot and quantity. Deleting an unshipped authorized transfer releases its reservation; dispatched transfers stay linked to their physical stock movement. Destination receipt corrections update actual transfer receipt totals and the same issue, without adding destination surplus.

- [x] Add migration, shared source/lot matching types and tests for reserve/ship/receive/cancel, authorization, stale revisions and rollback.
- [x] Implement inventory statement preparation plus request transfer services/routes; block legacy tracker commands from processing linked transfers independently.
- [x] Add source/agency/lot selectors and Authorize & Reserve Transfer in the request shipment editor; preserve trusted transfer metadata and lock authorized plans.
- [x] Add sending-agency shipment entry to existing Formula Surplus transfers, including destination address, ETA and tracking/delivery reference.
- [x] Connect unified receipt confirmation and corrections to actual linked transfer totals; no automatic destination surplus.
- [x] Verify full suite, build, isolated browser workflow, cross-agency privacy and failed-write rollback.

Review focus: expiry after reservation; competing reservations; duplicate sends; partial/damaged receipt correction; replacement/reference indexes; stale clients forging or erasing transfer metadata; sender cannot see participant fields.

Verification: 268 tests pass and production build succeeds. Local dev and isolated test migrations applied; no remote migration or deployment. Isolated browser authorized a 12-unit transfer from 48 units on hand, confirmed source shipment (36 on hand, zero reserved), recorded a partial receipt (6 received), then corrected to 12 received on the same transfer. No destination surplus was created. Source user gets transfer logistics only and a 404 for the participant request. Review regressions cover legacy dispatch/history, legacy completed requests, and unrelated private draft preservation.
