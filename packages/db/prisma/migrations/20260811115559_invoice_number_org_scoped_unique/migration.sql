-- DropIndex
DROP INDEX "credit_notes_number_key";
-- DropIndex
DROP INDEX "invoices_number_key";
-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_organizationId_number_key" ON "credit_notes"("organizationId", "number");
-- CreateIndex
CREATE UNIQUE INDEX "invoices_organizationId_number_key" ON "invoices"("organizationId", "number");
