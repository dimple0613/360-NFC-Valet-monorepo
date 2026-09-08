-- printed_by holds the platform user id (cuid string), not a numeric FK.
-- The column is already nullable with no rows using the default 0 in dev.
ALTER TABLE nfc_cards ALTER COLUMN printed_by DROP NOT NULL;
ALTER TABLE nfc_cards ALTER COLUMN printed_by TYPE TEXT USING printed_by::TEXT;
