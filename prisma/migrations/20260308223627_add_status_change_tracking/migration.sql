-- Add status change fields to service_comments
ALTER TABLE "service_comments"
ADD COLUMN "isStatusChange" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "statusChangedFrom" VARCHAR(50),
ADD COLUMN "statusChangedTo" VARCHAR(50),
ADD COLUMN "comment" TEXT;

-- Add updatedAt and updatedById to order_items
ALTER TABLE "order_items"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedById" TEXT;

-- CreateTable for OrderLock
CREATE TABLE "order_locks" (
    "orderId" TEXT NOT NULL,
    "lockedBy" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockExpires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_locks_pkey" PRIMARY KEY ("orderId")
);

-- CreateIndex for OrderLock
CREATE INDEX "order_locks_lockedBy_idx" ON "order_locks"("lockedBy");
CREATE INDEX "order_locks_lockExpires_idx" ON "order_locks"("lockExpires");

-- AddForeignKey for OrderLock
ALTER TABLE "order_locks" ADD CONSTRAINT "order_locks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_locks" ADD CONSTRAINT "order_locks_lockedBy_fkey" FOREIGN KEY ("lockedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey for OrderItem updatedBy
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;