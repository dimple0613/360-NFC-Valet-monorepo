-- AlterTable
ALTER TABLE "processed_webhook_events" ADD COLUMN     "eventType" TEXT,
ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "payload" JSONB;

-- CreateIndex
CREATE INDEX "processed_webhook_events_organizationId_processedAt_idx" ON "processed_webhook_events"("organizationId", "processedAt");
