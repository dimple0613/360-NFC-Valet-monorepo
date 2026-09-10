-- CreateTable
CREATE TABLE "resource_usage_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resourceTypeKey" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "resource_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resource_usage_events_organizationId_resourceTypeKey_record_idx" ON "resource_usage_events"("organizationId", "resourceTypeKey", "recordedAt");

-- AddForeignKey
ALTER TABLE "resource_usage_events" ADD CONSTRAINT "resource_usage_events_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
