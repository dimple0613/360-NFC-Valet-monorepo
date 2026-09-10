-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "paypalCaptureId" TEXT;

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "paypalSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "invoices_paypalCaptureId_key" ON "invoices"("paypalCaptureId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_paypalSubscriptionId_key" ON "subscriptions"("paypalSubscriptionId");
