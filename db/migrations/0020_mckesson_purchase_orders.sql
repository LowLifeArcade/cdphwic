CREATE TABLE mckesson_purchase_orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 number TEXT NOT NULL UNIQUE,
 start_date TEXT NOT NULL,
 end_date TEXT NOT NULL CHECK(end_date>=start_date),
 created_by INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE mckesson_po_allocations (
 po_id INTEGER NOT NULL REFERENCES mckesson_purchase_orders(id),
 product_code TEXT NOT NULL,
 product_name TEXT NOT NULL,
 formula_description TEXT,
 cases_approved INTEGER NOT NULL CHECK(cases_approved>=0),
 cases_already_used INTEGER NOT NULL CHECK(cases_already_used>=0 AND cases_already_used<=cases_approved),
 mc_kesson_price REAL CHECK(mc_kesson_price IS NULL OR mc_kesson_price>=0),
 PRIMARY KEY(po_id,product_code)
);
CREATE TABLE mckesson_po_orders (
 id TEXT PRIMARY KEY,
 po_id INTEGER NOT NULL,
 product_code TEXT NOT NULL,
 request_id INTEGER NOT NULL,
 cases INTEGER NOT NULL CHECK(cases>0),
 order_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('placed','cancelled')),
 created_by INTEGER NOT NULL,
 updated_by INTEGER NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 version INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(po_id,product_code) REFERENCES mckesson_po_allocations(po_id,product_code)
);
CREATE INDEX mckesson_po_orders_allocation ON mckesson_po_orders(po_id,product_code,status);
CREATE TABLE mckesson_po_order_audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL REFERENCES mckesson_po_orders(id),
 cases INTEGER NOT NULL,
 status TEXT NOT NULL,
 actor_id INTEGER NOT NULL,
 recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER mckesson_po_order_insert_guard BEFORE INSERT ON mckesson_po_orders BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM mckesson_purchase_orders WHERE id=NEW.po_id AND NEW.order_date BETWEEN start_date AND end_date) THEN RAISE(ABORT,'Order date is outside this PO period.') END;
 SELECT CASE WHEN NEW.status='placed' AND NEW.cases > (SELECT cases_approved-cases_already_used-COALESCE((SELECT SUM(cases) FROM mckesson_po_orders WHERE po_id=NEW.po_id AND product_code=NEW.product_code AND status='placed'),0) FROM mckesson_po_allocations WHERE po_id=NEW.po_id AND product_code=NEW.product_code) THEN RAISE(ABORT,'Insufficient cases remaining on this PO.') END;
END;
CREATE TRIGGER mckesson_po_order_update_guard BEFORE UPDATE ON mckesson_po_orders BEGIN
 SELECT CASE WHEN NEW.po_id<>OLD.po_id OR NEW.product_code<>OLD.product_code OR NEW.order_date<>OLD.order_date OR NEW.request_id<>OLD.request_id THEN RAISE(ABORT,'An order must retain its original PO, product, request and date.') END;
 SELECT CASE WHEN OLD.status='cancelled' AND NEW.status<>'cancelled' THEN RAISE(ABORT,'Cancelled orders cannot be reopened. Place a new order.') END;
 SELECT CASE WHEN NEW.status='placed' AND NEW.cases > (SELECT cases_approved-cases_already_used-COALESCE((SELECT SUM(cases) FROM mckesson_po_orders WHERE po_id=NEW.po_id AND product_code=NEW.product_code AND status='placed' AND id<>OLD.id),0) FROM mckesson_po_allocations WHERE po_id=NEW.po_id AND product_code=NEW.product_code) THEN RAISE(ABORT,'Insufficient cases remaining on this PO.') END;
END;
CREATE TRIGGER mckesson_po_order_insert_audit AFTER INSERT ON mckesson_po_orders BEGIN
 INSERT INTO mckesson_po_order_audit(order_id,cases,status,actor_id) VALUES(NEW.id,NEW.cases,NEW.status,NEW.updated_by);
END;
CREATE TRIGGER mckesson_po_order_update_audit AFTER UPDATE ON mckesson_po_orders BEGIN
 INSERT INTO mckesson_po_order_audit(order_id,cases,status,actor_id) VALUES(NEW.id,NEW.cases,NEW.status,NEW.updated_by);
END;
