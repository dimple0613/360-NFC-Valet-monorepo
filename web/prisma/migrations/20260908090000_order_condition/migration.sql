-- #32: vehicle condition capture on orders — pre-existing damage / mileage /
-- notes plus who recorded it and when. The order's condition is a JSONB blob
-- (shape { damage: string[], mileageKm: number?, notes: string? }); the audit
-- pair lets a damage claim be tied back to a capture event. Tenant-admin
-- records it today; driver-app / guest-web capture flows land later.

ALTER TABLE "orders"
  ADD COLUMN "condition" JSONB,
  ADD COLUMN "condition_updated_at" TIMESTAMP(3),
  ADD COLUMN "condition_updated_by" TEXT;