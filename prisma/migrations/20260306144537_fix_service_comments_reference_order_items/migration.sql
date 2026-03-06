-- Fix ServiceComment to reference OrderItem instead of ServicesFulfillment
-- This aligns with the business requirement that comments are attached to services within orders

-- Step 1: Drop existing foreign key constraint
ALTER TABLE "service_comments" DROP CONSTRAINT IF EXISTS "service_comments_serviceId_fkey";

-- Step 2: Rename column from serviceId to orderItemId
ALTER TABLE "service_comments" RENAME COLUMN "serviceId" TO "orderItemId";

-- Step 3: Add new foreign key constraint to order_items table
ALTER TABLE "service_comments"
ADD CONSTRAINT "service_comments_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 4: Update indexes
DROP INDEX IF EXISTS "service_comments_serviceId_idx";
DROP INDEX IF EXISTS "service_comments_serviceId_createdAt_idx";

CREATE INDEX "service_comments_orderItemId_idx" ON "service_comments"("orderItemId");
CREATE INDEX "service_comments_orderItemId_createdAt_idx" ON "service_comments"("orderItemId", "createdAt");