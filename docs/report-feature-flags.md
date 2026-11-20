# Report feature flags

The McKesson Log is disabled by default because it currently contains sample data. Set `NUXT_PUBLIC_MCKESSON_REPORT=true` in Nuxt runtime configuration to enable it.

When disabled, the Reports page omits the McKesson section and download links and does not request its data. Its JSON, CSV and Excel endpoints return 404, including when accessed directly. The Master Log remains available.

This flag is independent of shipment quantity tracking, Cases Shipped, receipt quantities, and product quantities. It neither disables those workflows nor deletes their stored values. Enabling the report still displays sample data; it does not connect the log to live orders.
