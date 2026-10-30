# Apply request-specific surplus

## Intent and approach
The Local Agency reports surplus for the current request. Agency Units on Hand displays it automatically. CDPH/WIC grants permission to use it; there is no Reject action. The user clarified that only the quantity needed for issuance should be removed, leaving excess surplus available.

The existing app stores request surplus separately from a manually edited Agency Units on Hand field and has a persistent surplus inventory ledger. Reuse that ledger and make the on-hand display derived. Merely copying the number would leave permission and balance tracking disconnected; applying the entire reported quantity would incorrectly remove leftover stock. The selected approach caps application at the issuance need and preserves the rest.

## Behavior
- Display request-specific surplus automatically under Agency Units on Hand, in individual units, with formula/form/flavor and expiration details. Keep different formulas separate. Clearly distinguish Reported, Authorized/Applied to This Request, and Remaining.
- Before permission, show Awaiting CDPH/WIC Authorization. Only CDPH/WIC/Admin can authorize application. No agency self-approval or rejection action.
- Apply at most the lesser of available usable surplus and the units issued for the matching formula, less surplus already applied. For example, 20 surplus units with 12 units issued applies 12 and leaves 8. If 5 surplus units are available for 12 issued, apply 5 and show 7 units still needed from shipment.
- Units issued remains the total approved for the participant. Surplus reduces the amount still needed from shipment; it does not reduce the participant's issuance total. Do not silently rewrite existing shipment quantities.
- Preserve the original reported surplus and record an audited inventory movement for only the quantity applied. Leftover stock stays available in the agency tracker. Prevent repeat clicks or concurrent requests from consuming the same units twice.
- Exclude expired or otherwise unavailable/reserved stock; require an exact formula/form/flavor match. Reuse existing stock verification, without creating a duplicate lot for a report already in the tracker. Legacy saved request entries remain visible; missing form/verification must be completed before applying them.
- If issuance is edited later, retain applied history and flag any mismatch for CDPH/WIC review; never silently delete or restore stock. A later authorization can apply additional remaining need, within current availability.

## Constraints and scope
Replace the unlabeled surplus readout below Save Shipments with a clearly labeled authorization/display near Agency Units on Hand. Preserve receipt workflows and keep over-delivery/case-reconciliation feature flags off. Changes to general agency inventories, shipments from other agencies, and automatically editing existing shipping plans are outside this change. Server permissions, quantity validation, inventory movement and request update must be atomic and stale-protected.

## Verification
Cover surplus above/below issuance, repeated/concurrent authorizations, remaining stock, distinct products, expired/reserved stock, agency permission denial, issuance edits and legacy entries. Verify both role views using isolated local fixtures. No push/deploy without a separate request.

## Status
Cap and remainder behavior clarified by user. Written design awaiting approval.
