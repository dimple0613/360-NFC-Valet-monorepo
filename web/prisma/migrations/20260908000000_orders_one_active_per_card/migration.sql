-- #31: at most one ACTIVE order per card.
-- The driver-orders POST serializes the check-in with SELECT ... FOR UPDATE on
-- the card row; this partial unique index is the authoritative backstop so two
-- concurrent check-ins on the same card (double-tap, two drivers at once) can
-- never both end up with an ACTIVE order in the queue.
--
-- Existing duplicates (from before the fix): keep the oldest active order for a
-- card and drop the newer duplicates. Their validations go too (FK is RESTRICT).

DELETE FROM validations
WHERE order_id IN (
  SELECT o.id
  FROM orders o
  JOIN (
    SELECT card_id, MIN(id) AS keep_id
    FROM orders
    WHERE status = 'active' AND card_id IS NOT NULL
    GROUP BY card_id
    HAVING COUNT(*) > 1
  ) d ON o.card_id = d.card_id AND o.status = 'active' AND o.id <> d.keep_id
);

DELETE FROM orders o
USING (
  SELECT card_id, MIN(id) AS keep_id
  FROM orders
  WHERE status = 'active' AND card_id IS NOT NULL
  GROUP BY card_id
  HAVING COUNT(*) > 1
) d
WHERE o.card_id = d.card_id AND o.status = 'active' AND o.id <> d.keep_id;

CREATE UNIQUE INDEX "orders_one_active_per_card"
ON "orders" ("card_id")
WHERE status = 'active';