ALTER TABLE surplus_transfers ADD COLUMN requested_label_count INTEGER CHECK(requested_label_count IS NULL OR (typeof(requested_label_count)='integer' AND requested_label_count>0));
UPDATE surplus_transfers
SET requested_label_count=MAX(1,(SELECT COUNT(*) FROM transfer_shipping_labels WHERE transfer_id=surplus_transfers.id))
WHERE stock_confirmed_at IS NOT NULL;
