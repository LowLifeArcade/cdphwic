# Shipment deletion

CDPH/WIC and Admin can delete a shipment after confirming. Local Agency cannot delete shipments. User confirmed deletion is limited to shipments without receipt or issue history.

Delete removes the active shipment and its private draft, recalculates published shipping totals and ETA, and retains a private snapshot with deletion time and actor. Received shipments, any current/archived issue, and disposition history remain protected. Replacement references are adjusted when preceding rows are deleted; originals with linked replacements remain protected. Saved private drafts can also be deleted. Unsaved rows are removed locally after confirmation.

Use the existing request revision and atomic D1 write to reject stale deletion. Both UI and server enforce history restrictions; server enforces reviewer role. The last shipment can be removed without creating a phantom blank shipment. The existing Add another shipment action creates a new row when needed.

Approach: explicit delete command rather than treating arbitrary shorter draft arrays as deletion, so normal Save Shipments cannot erase history. Preserve an audit snapshot rather than permanently erasing the record.

Verified: 253 tests pass and production build succeeds. Browser check confirms the reviewer confirmation dialog and absence of Delete Shipment in Local Agency view. Test coverage includes authorization, stale revisions, last-shipment deletion, private drafts, protected histories, replacement links, and sending a new ETA after deletion.
