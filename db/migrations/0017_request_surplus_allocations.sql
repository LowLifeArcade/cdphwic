CREATE TABLE IF NOT EXISTS surplus_request_allocations (
 request_id INTEGER NOT NULL,
 formula_index INTEGER NOT NULL CHECK(formula_index>=0),
 lot_id TEXT NOT NULL REFERENCES surplus_lots(id),
 units INTEGER NOT NULL CHECK(units>0 AND typeof(units)='integer'),
 issued_units INTEGER NOT NULL DEFAULT 0 CHECK(issued_units>=0 AND issued_units<=units AND typeof(issued_units)='integer'),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(request_id,formula_index,lot_id)
);
CREATE INDEX IF NOT EXISTS surplus_request_allocations_lot ON surplus_request_allocations(lot_id);
CREATE TABLE IF NOT EXISTS surplus_request_issuances (
 request_id INTEGER NOT NULL,
 formula_index INTEGER NOT NULL,
 month TEXT NOT NULL,
 units INTEGER NOT NULL CHECK(units>0 AND typeof(units)='integer'),
 actor_id INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(request_id,formula_index,month)
);
