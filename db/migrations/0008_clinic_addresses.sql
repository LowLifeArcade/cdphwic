CREATE TABLE IF NOT EXISTS clinic_addresses (
    id TEXT PRIMARY KEY,
    agency_id INTEGER NOT NULL,
    address_json TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS clinic_addresses_agency ON clinic_addresses(agency_id,active);
