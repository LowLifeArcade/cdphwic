-- Product Number identifies variants; Formula Name is intentionally not unique.
ALTER TABLE products ADD COLUMN product_code TEXT;
CREATE UNIQUE INDEX products_product_code_unique ON products(product_code);
ALTER TABLE products ADD COLUMN flavor TEXT;
ALTER TABLE products ADD COLUMN yield REAL;
ALTER TABLE products ADD COLUMN formula_description TEXT;
ALTER TABLE products ADD COLUMN manufacturer TEXT;
ALTER TABLE products ADD COLUMN mckesson_po TEXT;
ALTER TABLE products ADD COLUMN mckesson_price REAL;
ALTER TABLE products ADD COLUMN covered_by_medi_cal INTEGER;
ALTER TABLE products ADD COLUMN fda_class TEXT;
ALTER TABLE products ADD COLUMN wic_class TEXT;
ALTER TABLE products ADD COLUMN st TEXT;
ALTER TABLE products ADD COLUMN infant_toddler TEXT;
ALTER TABLE products ADD COLUMN packaging TEXT;
