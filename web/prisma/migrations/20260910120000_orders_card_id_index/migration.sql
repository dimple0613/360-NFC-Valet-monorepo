-- Bounds the card-list "last order per card" lateral
-- (WHERE card_id = ? ORDER BY id DESC LIMIT 1). Backward-scanable index so the
-- query stays O(log n) per card however large the orders table grows.
CREATE INDEX IF NOT EXISTS "orders_card_id_id_idx" ON "orders" ("card_id", "id");