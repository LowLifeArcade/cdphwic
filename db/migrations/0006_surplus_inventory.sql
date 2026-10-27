CREATE TABLE IF NOT EXISTS surplus_request_ids (id INTEGER PRIMARY KEY AUTOINCREMENT);
CREATE TABLE IF NOT EXISTS surplus_lots (
 id TEXT PRIMARY KEY, agency_id INTEGER NOT NULL, variant_key TEXT NOT NULL,
 formula_name TEXT NOT NULL, form TEXT NOT NULL, flavor TEXT NOT NULL DEFAULT '', expiration_date TEXT NOT NULL,
 on_hand INTEGER NOT NULL DEFAULT 0 CHECK(on_hand>=0 AND typeof(on_hand)='integer'),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand AND typeof(reserved)='integer'),
 expired_units INTEGER NOT NULL DEFAULT 0 CHECK(expired_units>=0 AND typeof(expired_units)='integer'),
 version INTEGER NOT NULL DEFAULT 0, UNIQUE(agency_id,variant_key)
);
CREATE TABLE IF NOT EXISTS surplus_commands (
 id TEXT PRIMARY KEY, actor_id INTEGER NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', result TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS surplus_guard (ok INTEGER CHECK(ok=1));
CREATE TABLE IF NOT EXISTS surplus_movements (
 id TEXT PRIMARY KEY, operation_id TEXT NOT NULL REFERENCES surplus_commands(id), lot_id TEXT NOT NULL,
 kind TEXT NOT NULL, quantity INTEGER NOT NULL, actor_id INTEGER NOT NULL, request_ref TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
 on_hand INTEGER NOT NULL, reserved INTEGER NOT NULL, expired_units INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS surplus_transfers (
 id TEXT PRIMARY KEY, source_lot_id TEXT NOT NULL REFERENCES surplus_lots(id), source_agency_id INTEGER NOT NULL, destination_agency_id INTEGER NOT NULL,
 formula_name TEXT NOT NULL, form TEXT NOT NULL, flavor TEXT NOT NULL DEFAULT '', expiration_date TEXT NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity>0 AND typeof(quantity)='integer'), request_ref TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('reserved','shipped','received','cancelled','blocked-expired')),
 shipped_date TEXT, received_date TEXT, tracking_reference TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS surplus_submissions (
 id TEXT PRIMARY KEY, agency_id INTEGER NOT NULL, request_json TEXT NOT NULL, payload TEXT NOT NULL, actor_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS surplus_reports (
 id TEXT PRIMARY KEY, submission_id TEXT, row_id TEXT NOT NULL, agency_id INTEGER NOT NULL,
 formula_name TEXT NOT NULL, form TEXT NOT NULL, flavor TEXT NOT NULL DEFAULT '', expiration_date TEXT NOT NULL DEFAULT '',
 reported_units INTEGER NOT NULL CHECK(reported_units>=0 AND typeof(reported_units)='integer'), status TEXT NOT NULL DEFAULT 'pending',
 request_ref TEXT NOT NULL DEFAULT '', reporter_id INTEGER NOT NULL, counted_at TEXT NOT NULL, confirmer_name TEXT NOT NULL DEFAULT '', reason TEXT NOT NULL DEFAULT '',
 forecast_id TEXT, reviewed_by INTEGER, reviewed_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(submission_id,row_id)
);
CREATE TABLE IF NOT EXISTS surplus_forecasts (
 id TEXT PRIMARY KEY, agency_id INTEGER NOT NULL, request_ref TEXT NOT NULL, formula_name TEXT NOT NULL, form TEXT NOT NULL, flavor TEXT NOT NULL DEFAULT '',
 expected_units INTEGER NOT NULL CHECK(expected_units>=0 AND typeof(expected_units)='integer'), due_date TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'awaiting-count' CHECK(status IN ('awaiting-count','pending-review','reconciled')),
 actual_units INTEGER, report_id TEXT, actor_id INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS surplus_lots_agency ON surplus_lots(agency_id,expiration_date);
CREATE INDEX IF NOT EXISTS surplus_reports_pending ON surplus_reports(agency_id,status);
CREATE INDEX IF NOT EXISTS surplus_forecasts_due ON surplus_forecasts(agency_id,status,due_date);
