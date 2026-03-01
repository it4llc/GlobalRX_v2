-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "assignedVendorId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "vendorId" TEXT;

-- CreateTable
CREATE TABLE "vendor_organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_organizations_code_key" ON "vendor_organizations"("code");

-- CreateIndex
CREATE INDEX "vendor_organizations_isActive_idx" ON "vendor_organizations"("isActive");

-- CreateIndex
CREATE INDEX "vendor_organizations_isPrimary_idx" ON "vendor_organizations"("isPrimary");

-- CreateIndex
CREATE INDEX "orders_assignedVendorId_idx" ON "orders"("assignedVendorId");

-- CreateIndex
CREATE INDEX "users_vendorId_idx" ON "users"("vendorId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendor_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_assignedVendorId_fkey" FOREIGN KEY ("assignedVendorId") REFERENCES "vendor_organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;