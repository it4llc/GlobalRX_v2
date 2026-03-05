-- AlterTable - Add order closure fields
ALTER TABLE "orders" ADD COLUMN "closedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "closedBy" TEXT;
ALTER TABLE "orders" ADD COLUMN "closureComments" TEXT;

-- CreateIndex
CREATE INDEX "orders_closedBy_idx" ON "orders"("closedBy");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;