/*
  Warnings:

  - You are about to drop the column `deletedAt` on the `organizations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "organizations" DROP COLUMN "deletedAt",
ADD COLUMN     "deletionScheduledFor" TIMESTAMP(3);
