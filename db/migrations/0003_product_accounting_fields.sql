ALTER TABLE products ADD COLUMN bottles_per_case INTEGER NOT NULL DEFAULT 1;
ALTER TABLE products ADD COLUMN unit_price REAL;
ALTER TABLE products ADD COLUMN supplier_reference TEXT;
ALTER TABLE products ADD COLUMN generic_fields TEXT;
