-- /GlobalRX_v2/prisma/migrations/20260319000000_backfill_services_fulfillment/migration.sql

-- One-time backfill migration: Create missing ServicesFulfillment records for existing OrderItems
-- This ensures every OrderItem has a corresponding ServicesFulfillment record
-- Safe to run multiple times (idempotent)

-- Start logging
DO $$
BEGIN
  RAISE NOTICE 'Starting ServicesFulfillment backfill migration...';
END $$;

-- Create ServicesFulfillment records for OrderItems that don't have one
INSERT INTO "services_fulfillment" (
  "id",
  "orderId",
  "orderItemId",
  "serviceId",
  "locationId",
  "assignedVendorId",
  "vendorNotes",
  "internalNotes",
  "assignedAt",
  "assignedBy",
  "completedAt",
  "results",
  "resultsAddedBy",
  "resultsAddedAt",
  "resultsLastModifiedBy",
  "resultsLastModifiedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  oi."orderId",
  oi."id",
  oi."serviceId",
  oi."locationId",
  NULL, -- assignedVendorId
  NULL, -- vendorNotes
  NULL, -- internalNotes
  NULL, -- assignedAt
  NULL, -- assignedBy
  NULL, -- completedAt
  NULL, -- results
  NULL, -- resultsAddedBy
  NULL, -- resultsAddedAt
  NULL, -- resultsLastModifiedBy
  NULL, -- resultsLastModifiedAt
  NOW(),
  NOW()
FROM "order_items" oi
LEFT JOIN "services_fulfillment" sf ON sf."orderItemId" = oi."id"
WHERE sf."id" IS NULL
ON CONFLICT ("orderItemId") DO NOTHING;

-- Log the number of records backfilled
DO $$
DECLARE
  backfilled_count INTEGER;
  order_items_count INTEGER;
  fulfillments_count INTEGER;
BEGIN
  -- Get the count of rows just inserted
  GET DIAGNOSTICS backfilled_count = ROW_COUNT;

  RAISE NOTICE 'Backfilled % ServicesFulfillment records', backfilled_count;

  -- Get current counts for verification
  SELECT COUNT(*) INTO order_items_count FROM "order_items";
  SELECT COUNT(DISTINCT "orderItemId") INTO fulfillments_count FROM "services_fulfillment";

  RAISE NOTICE 'Current state: % OrderItems, % unique ServicesFulfillment records', order_items_count, fulfillments_count;
END $$;

-- Verification: Ensure every OrderItem now has a ServicesFulfillment record
DO $$
DECLARE
  order_items_count INTEGER;
  fulfillments_count INTEGER;
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO order_items_count FROM "order_items";
  SELECT COUNT(DISTINCT "orderItemId") INTO fulfillments_count FROM "services_fulfillment";

  -- Check for any OrderItems still missing ServicesFulfillment
  SELECT COUNT(*) INTO missing_count
  FROM "order_items" oi
  LEFT JOIN "services_fulfillment" sf ON sf."orderItemId" = oi."id"
  WHERE sf."id" IS NULL;

  IF missing_count > 0 THEN
    RAISE WARNING 'Verification failed: % OrderItems still missing ServicesFulfillment records', missing_count;
  ELSIF order_items_count != fulfillments_count THEN
    RAISE WARNING 'Count mismatch: % OrderItems but % unique ServicesFulfillment records', order_items_count, fulfillments_count;
  ELSE
    RAISE NOTICE 'Verification passed: All % OrderItems have ServicesFulfillment records', order_items_count;
  END IF;
END $$;

-- Final summary
DO $$
BEGIN
  RAISE NOTICE 'ServicesFulfillment backfill migration completed successfully';
END $$;