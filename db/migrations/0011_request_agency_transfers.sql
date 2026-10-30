ALTER TABLE surplus_transfers ADD COLUMN request_id INTEGER;
ALTER TABLE surplus_transfers ADD COLUMN units_per_case INTEGER;
ALTER TABLE surplus_transfers ADD COLUMN eta TEXT;
ALTER TABLE surplus_transfers ADD COLUMN carrier TEXT;
ALTER TABLE surplus_transfers ADD COLUMN destination_shipping TEXT;
ALTER TABLE surplus_transfers ADD COLUMN received_units INTEGER;
ALTER TABLE surplus_transfers ADD COLUMN damaged_units INTEGER;
CREATE INDEX IF NOT EXISTS surplus_transfers_request ON surplus_transfers(request_id);
