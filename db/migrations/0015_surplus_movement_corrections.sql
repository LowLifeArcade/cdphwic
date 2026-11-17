ALTER TABLE surplus_movements ADD COLUMN corrects_movement_id TEXT REFERENCES surplus_movements(id);
ALTER TABLE surplus_movements ADD COLUMN corrected_quantity INTEGER;
CREATE INDEX IF NOT EXISTS surplus_movements_corrects ON surplus_movements(corrects_movement_id);
