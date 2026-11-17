# Issuance transfer allocation workflow

Approved design: staff choose monthly approved quantities, assign local stock, inspect matching surplus at other agencies, reserve transfer stock, then use the live distributor order recommendation. Shipping handles logistics.

1. Add tested shared filtering and draft transfer quantity selection. Exclude own-agency, expired, unavailable, and nonmatching stock. Prevent duplicate drafts and protect reserved transfers.
2. Add an Issuance stock panel with agency, clinic, available units, expiration, quantity, reservation action and transfer status. Feed selected quantities into the existing Supply plan.
3. Save current issuance fields before reserving via the existing reservation API, preserving draft shipment selections across that save. Refresh inventory afterwards. Route surplus shortcuts to Issuance.
4. Make agency source selection/quantity in Shipping read-only, with a pointer back to Issuance. Keep logistics and tracking controls.
5. Verify focused tests, build, and the rendered staff workflow.
