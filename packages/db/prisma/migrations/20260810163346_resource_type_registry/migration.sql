-- CreateEnum
CREATE TYPE "ResourceAggregation" AS ENUM ('COUNTER', 'GAUGE', 'METERED');

-- CreateEnum
CREATE TYPE "ResourceResetCycle" AS ENUM ('NEVER', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'BILLING_CYCLE');

-- CreateEnum
CREATE TYPE "ResourceOveragePolicy" AS ENUM ('BLOCK', 'ALLOW', 'BILL');

-- CreateTable
CREATE TABLE "resource_types" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "aggregation" "ResourceAggregation" NOT NULL,
    "resetCycle" "ResourceResetCycle" NOT NULL,
    "overagePolicy" "ResourceOveragePolicy" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resource_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resource_types_key_key" ON "resource_types"("key");

-- CreateIndex
CREATE INDEX "resource_types_module_idx" ON "resource_types"("module");
