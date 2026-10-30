# Shipment feature flags

Detailed shipment tracking is disabled by default. Set `NUXT_PUBLIC_SHIPMENT_QUANTITY_TRACKING=true` to enable replacement/closure controls and advanced quantity tracking.

Distributor **Cases Shipped** entry and display are controlled independently by `NUXT_PUBLIC_SHIPMENT_CASES_SHIPPED` (default **true**). Turning this on does not enable advanced tracking, reconciliation, or overage alerts. Turning it off hides the field without deleting saved quantities.

Local Agency actual receipt quantities are controlled separately by `NUXT_PUBLIC_SHIPMENT_RECEIPT_QUANTITIES` (default **true**). Local Agencies can enter received cases, loose units, and damaged quantities and still report damage and supply required evidence. Units per Case remains available to reviewers to support accurate receipt entry. Receipt entry does not enable overage alerts or case reconciliation.

The master tracking flag also gates these optional features (both default false):

- `NUXT_PUBLIC_SHIPMENT_CASE_RECONCILIATION=true`
- `NUXT_PUBLIC_SHIPMENT_POTENTIAL_OVER_DELIVERY=true`

Set `NUXT_PUBLIC_SHIPMENT_RECEIPT_QUANTITIES=false` for simple Confirm Receipt / Edit Receipt without counts. Numeric receipt API commands are then rejected. Simple confirmation does not infer actual quantities from the shipment plan. Existing counts and audit history are preserved. After re-enabling receipt quantities, use Edit Receipt to enter verified counts for a simple receipt.

Authorization/issuance and surplus inventory quantities remain available. Agency-to-agency transfers retain quantities needed to reserve and deduct stock. Simple destination receipt marks the transfer received without inventing actual received unit counts or creating destination surplus.

Changing flags does not delete stored data.
