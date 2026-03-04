-- AlterTable
ALTER TABLE "services" ADD COLUMN "code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "services_code_key" ON "services"("code");