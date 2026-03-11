-- Remove ServicesFulfillment.status field as OrderItem.status is the single source of truth
-- This consolidates service status tracking to prevent data inconsistency
-- Status is now managed exclusively on OrderItem via /api/services/[id]/status

-- Step 1: Drop the index on status column
DROP INDEX IF EXISTS "services_fulfillment_status_idx";

-- Step 2: Remove the status column from services_fulfillment table
ALTER TABLE "services_fulfillment" DROP COLUMN IF EXISTS "status";

-- Note: Any existing status data will be lost, but OrderItem.status contains the authoritative status
-- All status updates should now go through OrderItem, not ServicesFulfillment