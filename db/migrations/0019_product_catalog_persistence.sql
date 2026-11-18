-- Preserve existing product IDs and metadata while allowing unknown case sizes.
CREATE TABLE products_persistent (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 product_id TEXT NOT NULL,
 product_code TEXT,
 name TEXT NOT NULL DEFAULT '',
 form TEXT NOT NULL DEFAULT '',
 category TEXT NOT NULL DEFAULT 'standard' CHECK(category IN ('standard','exempt','nutritional')),
 units_per_case INTEGER,
 bottles_per_case INTEGER NOT NULL DEFAULT 1,
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 unit_price REAL,
 supplier_reference TEXT,
 generic_fields TEXT,
 coverage TEXT NOT NULL DEFAULT '["wic"]',
 po_price REAL,
 cases_approved INTEGER NOT NULL DEFAULT 0,
 cases_used INTEGER NOT NULL DEFAULT 0,
 yield REAL,
 flavor TEXT,
 formula_description TEXT,
 manufacturer TEXT,
 mckesson_po TEXT,
 mckesson_price REAL,
 covered_by_medi_cal INTEGER,
 fda_class TEXT,
 wic_class TEXT,
 st TEXT,
 infant_toddler TEXT,
 packaging TEXT,
 version INTEGER NOT NULL DEFAULT 0
);
INSERT INTO products_persistent(id,product_id,product_code,name,form,category,units_per_case,bottles_per_case,active,created_at,unit_price,supplier_reference,generic_fields,yield,flavor,formula_description,manufacturer,mckesson_po,mckesson_price,covered_by_medi_cal,fda_class,wic_class,st,infant_toddler,packaging)
SELECT id,COALESCE(NULLIF(product_code,''),'PROD-'||id),NULLIF(product_code,''),name,
 CASE lower(trim(form)) WHEN 'ready to feed' THEN 'ready-to-feed' WHEN 'liquid concentrate' THEN 'concentrate' ELSE lower(trim(form)) END,
 category,units_per_case,bottles_per_case,active,created_at,unit_price,supplier_reference,generic_fields,yield,flavor,formula_description,manufacturer,mckesson_po,mckesson_price,covered_by_medi_cal,fda_class,wic_class,st,infant_toddler,packaging FROM products;
DROP TABLE products;
ALTER TABLE products_persistent RENAME TO products;
-- Identify legacy demo records only; never overwrite identifiers on real catalog rows.
UPDATE products SET product_code='166802' WHERE id=301 AND name='Nutramigen' AND product_code IS NULL;
UPDATE products SET product_code='166803',active=0 WHERE id=302 AND name='EleCare' AND (product_code IS NULL OR product_code='166803');
UPDATE products SET product_code='166804',active=0 WHERE id=303 AND name='Enfamil Infant' AND (product_code IS NULL OR product_code='166804');
UPDATE products SET product_code='166805',active=0 WHERE id=304 AND name='Neocate Splash' AND (product_code IS NULL OR product_code='166805');
CREATE UNIQUE INDEX products_active_product_code ON products(product_code) WHERE active=1 AND product_code IS NOT NULL AND product_code<>'';
CREATE UNIQUE INDEX products_active_product_id ON products(product_id) WHERE active=1 AND product_id<>'';
CREATE TABLE product_write_guard(ok INTEGER NOT NULL CHECK(ok=1));
