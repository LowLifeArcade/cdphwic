# Shipment feature flags

Detailed shipment quantity tracking is disabled by default. Set `NUXT_PUBLIC_SHIPMENT_QUANTITY_TRACKING=true` to enable it.

When disabled, shipment case/unit entry, actual receipt counts, quantity summaries, replacement/closure controls, reconciliation and overage alerts are hidden. Numeric receipt and case-tracking API commands are also rejected. Local Agencies can still Confirm Receipt, Edit Receipt, report damage and supply distributor-required evidence. Simple confirmation does not infer actual quantities from the shipment plan. Existing counts and audit history are preserved.

The master flag also gates these optional features (both default false):

- `NUXT_PUBLIC_SHIPMENT_CASE_RECONCILIATION=true`
- `NUXT_PUBLIC_SHIPMENT_POTENTIAL_OVER_DELIVERY=true`

Authorization/issuance and surplus inventory quantities remain available. Agency-to-agency transfers retain the quantities needed to reserve and deduct stock. Simple destination receipt marks the transfer received without inventing actual received unit counts or creating destination surplus.

Changing a flag does not delete stored data. After re-enabling quantity tracking, a simple confirmation has no new actual count; use Edit Receipt to enter verified quantities.
