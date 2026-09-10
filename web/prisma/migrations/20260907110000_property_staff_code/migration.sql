-- Property-level guest validation (GitHub issue #46): a venue can enable
-- "guest validation" at the property (location) level with its own staff
-- code, and record property-level validations on orders.

-- properties: per-venue validation flag + write-only staff code (4 digits,
-- never serialized to the client; NULL = validation disabled for the venue).
ALTER TABLE "properties" ADD COLUMN "validates_valet" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "properties" ADD COLUMN "staff_code" TEXT;

-- validations: allow a validation to be recorded against a property instead of
-- an individual offer (offer_id stays NULL for property-level validations).
ALTER TABLE "validations" ADD COLUMN "property_id" INTEGER;
CREATE INDEX "validations_property_id_idx" ON "validations"("property_id");
ALTER TABLE "validations" ADD CONSTRAINT "validations_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;