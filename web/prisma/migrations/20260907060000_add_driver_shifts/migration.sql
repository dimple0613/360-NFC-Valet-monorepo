-- CreateTable: driver_shifts — persisted per-shift history for the driver activity report.
CREATE TABLE "driver_shifts" (
    "id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "organization_id" TEXT,
    "property_id" INTEGER,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),

    CONSTRAINT "driver_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_shifts_driverId_startedAt_idx" ON "driver_shifts"("driver_id", "started_at");

-- CreateIndex
CREATE INDEX "driver_shifts_organizationId_idx" ON "driver_shifts"("organization_id");

-- AddForeignKey
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_driverId_fkey"
  FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_shifts" ADD CONSTRAINT "driver_shifts_propertyId_fkey"
  FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
