CREATE TABLE IF NOT EXISTS transfer_shipping_labels (
 id TEXT PRIMARY KEY,
 transfer_id TEXT NOT NULL REFERENCES surplus_transfers(id),
 file_name TEXT NOT NULL,
 content_type TEXT NOT NULL,
 storage_key TEXT NOT NULL UNIQUE,
 file_size INTEGER NOT NULL CHECK(file_size>0 AND file_size<=10485760),
 uploaded_at TEXT NOT NULL,
 uploaded_by INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS transfer_shipping_labels_transfer ON transfer_shipping_labels(transfer_id);
