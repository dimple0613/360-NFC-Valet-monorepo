/*
  Warnings:

  - Added the required column `organizationId` to the `team_memberships` table without a default value. This is not possible if the table is not empty.
  - Added the required column `organizationId` to the `workspace_memberships` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "team_memberships" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "workspace_memberships" ADD COLUMN     "organizationId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "team_memberships_organizationId_idx" ON "team_memberships"("organizationId");

-- CreateIndex
CREATE INDEX "workspace_memberships_organizationId_idx" ON "workspace_memberships"("organizationId");
