/*
  Warnings:

  - You are about to drop the column `code` on the `vendor_organizations` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "vendor_organizations_code_key";

-- AlterTable
ALTER TABLE "vendor_organizations" DROP COLUMN "code";
