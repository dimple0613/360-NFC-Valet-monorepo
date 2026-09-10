-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('FREE', 'TRIAL', 'MONTHLY', 'YEARLY', 'LIFETIME', 'ENTERPRISE', 'USAGE_BASED', 'CUSTOM_PRICING', 'INVITE_ONLY', 'HIDDEN');

-- CreateEnum
CREATE TYPE "PlanVisibility" AS ENUM ('PUBLIC', 'INVITE_ONLY', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PlanType" NOT NULL,
    "visibility" "PlanVisibility" NOT NULL DEFAULT 'PUBLIC',
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "billingCycle" "BillingCycle",
    "trialDays" INTEGER,
    "gracePeriodDays" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_resources" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "resourceTypeKey" TEXT NOT NULL,
    "limit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_features" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "add_ons" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "add_on_resources" (
    "id" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "resourceTypeKey" TEXT NOT NULL,
    "grantAmount" INTEGER NOT NULL,

    CONSTRAINT "add_on_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "add_on_features" (
    "id" TEXT NOT NULL,
    "addOnId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,

    CONSTRAINT "add_on_features_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "plans_key_idx" ON "plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_version_key" ON "plans"("key", "version");

-- CreateIndex
CREATE UNIQUE INDEX "plan_resources_planId_resourceTypeKey_key" ON "plan_resources"("planId", "resourceTypeKey");

-- CreateIndex
CREATE UNIQUE INDEX "plan_features_planId_featureKey_key" ON "plan_features"("planId", "featureKey");

-- CreateIndex
CREATE UNIQUE INDEX "add_ons_key_key" ON "add_ons"("key");

-- CreateIndex
CREATE UNIQUE INDEX "add_on_resources_addOnId_resourceTypeKey_key" ON "add_on_resources"("addOnId", "resourceTypeKey");

-- CreateIndex
CREATE UNIQUE INDEX "add_on_features_addOnId_featureKey_key" ON "add_on_features"("addOnId", "featureKey");

-- AddForeignKey
ALTER TABLE "plan_resources" ADD CONSTRAINT "plan_resources_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_features" ADD CONSTRAINT "plan_features_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "add_on_resources" ADD CONSTRAINT "add_on_resources_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "add_ons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "add_on_features" ADD CONSTRAINT "add_on_features_addOnId_fkey" FOREIGN KEY ("addOnId") REFERENCES "add_ons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
