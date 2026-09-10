/*
  Warnings:

  - You are about to drop the column `workspaceId` on the `resource_usage_events` table. All the data in the column will be lost.
  - You are about to drop the `team_memberships` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `teams` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspace_memberships` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `workspaces` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "team_memberships" DROP CONSTRAINT "team_memberships_teamId_fkey";

-- DropForeignKey
ALTER TABLE "team_memberships" DROP CONSTRAINT "team_memberships_userId_fkey";

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "teams" DROP CONSTRAINT "teams_parentTeamId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_userId_fkey";

-- DropForeignKey
ALTER TABLE "workspace_memberships" DROP CONSTRAINT "workspace_memberships_workspaceId_fkey";

-- DropForeignKey
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "workspaces" DROP CONSTRAINT "workspaces_teamId_fkey";

-- AlterTable
ALTER TABLE "resource_usage_events" DROP COLUMN "workspaceId";

-- DropTable
DROP TABLE "team_memberships";

-- DropTable
DROP TABLE "teams";

-- DropTable
DROP TABLE "workspace_memberships";

-- DropTable
DROP TABLE "workspaces";
