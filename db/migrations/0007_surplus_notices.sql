CREATE TABLE IF NOT EXISTS surplus_notices (
 id TEXT PRIMARY KEY, agency_id INTEGER NOT NULL, lot_id TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('donation','destruction')), expiration_date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(lot_id,kind,expiration_date)
);
CREATE TABLE IF NOT EXISTS surplus_notice_reads (notice_id TEXT NOT NULL,user_id INTEGER NOT NULL,read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY(notice_id,user_id));
CREATE TABLE IF NOT EXISTS surplus_forms (id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('donation','destruction')),file_name TEXT NOT NULL,storage_key TEXT NOT NULL,uploaded_by INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
