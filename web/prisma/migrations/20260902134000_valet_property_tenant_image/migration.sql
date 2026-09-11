-- Add the two properties columns the legacy tenant-admin data layer expects:
--   tenant_id: vestigial (no valet `tenants` table in the merged DB; kept NULL,
--              auth/tenant come from the platform tables instead)
--   image_url: used by getLocations / createLocation / updateLocation
ALTER TABLE "properties" ADD COLUMN "tenant_id" INTEGER;
ALTER TABLE "properties" ADD COLUMN "image_url" TEXT;
