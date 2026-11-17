# Source-based Supply Plan

Use On Hand for assigned stock at the requesting agency, individual Transfer from <agency> rows for incoming agency transfers, and Shipped from <distributor> rows with units plus cases for recorded distributor shipments. Expected Surplus is the final row. Replace aggregate transfer/order arithmetic with source rows in the PDF and request summaries. Retain a small approved-total caption and pending-order guidance for staff before fulfillment is recorded.

1. Add a shared source-row projection and tests for multiple transfer/distributor rows, formula matching, draft visibility, replacements, and unknown sizes.
2. Use source rows in both request summaries and the PDF Supply Plan, retaining aligned PDF unit columns and safe wrapping.
3. Regenerate/render the sample and verify focused tests and build.

Workflow correction: keep the named source rows on staff screens, but always show a prominent Recommended Order card before Expected Surplus. Calculate additional whole cases from approved units minus local assignments, selected transfers, and recorded distributor shipments. Show projected surplus after that recommendation. Keep the recommendation visible when no extra order is required; do not label recommendations as shipped. Selected unreserved transfers remain explicitly marked. The Authorization PDF continues to show recorded supply only.

Distributor lifecycle: staff see Planned from <distributor> for unsent drafts, ETA sent for <distributor> for published ETA records without order evidence, Ordered from <distributor> where the request's Date Ordered is recorded, and Shipped from <distributor> only with explicit dispatch/receipt evidence. Draft quantities do not reduce confirmed pending supply; display their coverage beside the live recommendation. For unsent updates to an existing shipment, keep the published snapshot as confirmed and show the draft update separately, counting only the added draft quantity toward coverage. PDFs and agency summaries continue to omit unsent drafts.
