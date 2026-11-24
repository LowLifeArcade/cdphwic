ALTER TABLE surplus_lots ADD COLUMN packaging TEXT NOT NULL DEFAULT '';
ALTER TABLE surplus_transfers ADD COLUMN packaging TEXT NOT NULL DEFAULT '';
ALTER TABLE surplus_reports ADD COLUMN packaging TEXT NOT NULL DEFAULT '';
ALTER TABLE surplus_forecasts ADD COLUMN packaging TEXT NOT NULL DEFAULT '';
