-- /GlobalRX_v2/prisma/migrations/20260410161850_add_internal_activity_tracking_fields/migration.sql

-- Business requirement: Track internal activity separately from customer-visible activity
-- on orders and order items. This enables differentiated "new activity" indicators for
-- admin/vendor users vs customer users. Internal activity includes vendor assignments,
-- internal comments, and admin actions that customers cannot see.
--
-- Data integrity: These fields are independent of existing lastActivityAt fields.
-- Customer-visible activity will update BOTH lastActivityAt and lastInternalActivityAt.
-- Internal-only activity will update ONLY lastInternalActivityAt.
--
-- Safe to run multiple times (idempotent)

-- Start logging
DO $$
BEGIN
  RAISE NOTICE 'Starting add_internal_activity_tracking_fields migration...';
END $$;

-- Add lastInternalActivityAt column to orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'lastInternalActivityAt'
  ) THEN
    ALTER TABLE orders ADD COLUMN "lastInternalActivityAt" TIMESTAMP(3);
    RAISE NOTICE 'Added lastInternalActivityAt column to orders table';
  ELSE
    RAISE NOTICE 'lastInternalActivityAt column already exists on orders table';
  END IF;
END $$;

-- Add lastInternalActivityAt column to order_items table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'order_items'
    AND column_name = 'lastInternalActivityAt'
  ) THEN
    ALTER TABLE order_items ADD COLUMN "lastInternalActivityAt" TIMESTAMP(3);
    RAISE NOTICE 'Added lastInternalActivityAt column to order_items table';
  ELSE
    RAISE NOTICE 'lastInternalActivityAt column already exists on order_items table';
  END IF;
END $$;

-- Backfill lastInternalActivityAt for existing orders
-- Strategy: Use updatedAt as the initial value for existing records
-- Reasoning: updatedAt represents the last time the record itself changed,
-- which is our best approximation of "last internal activity" for historical data.
-- This prevents all existing orders from appearing as "new" to internal users.
UPDATE orders
SET "lastInternalActivityAt" = "updatedAt"
WHERE "lastInternalActivityAt" IS NULL
  AND "updatedAt" IS NOT NULL;

-- Log backfill results for orders
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM orders
  WHERE "lastInternalActivityAt" IS NOT NULL;

  RAISE NOTICE 'Backfilled lastInternalActivityAt for % orders', updated_count;
END $$;

-- Backfill lastInternalActivityAt for existing order items
-- Strategy: Use updatedAt for the same reasoning as orders
UPDATE order_items
SET "lastInternalActivityAt" = "updatedAt"
WHERE "lastInternalActivityAt" IS NULL
  AND "updatedAt" IS NOT NULL;

-- Log backfill results for order items
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM order_items
  WHERE "lastInternalActivityAt" IS NOT NULL;

  RAISE NOTICE 'Backfilled lastInternalActivityAt for % order items', updated_count;
END $$;

-- Verification: Ensure all records have been processed
DO $$
DECLARE
  orders_null_count INTEGER;
  items_null_count INTEGER;
  orders_total INTEGER;
  items_total INTEGER;
BEGIN
  -- Count records with null lastInternalActivityAt
  SELECT COUNT(*) INTO orders_null_count
  FROM orders
  WHERE "lastInternalActivityAt" IS NULL;

  SELECT COUNT(*) INTO items_null_count
  FROM order_items
  WHERE "lastInternalActivityAt" IS NULL;

  -- Get total counts
  SELECT COUNT(*) INTO orders_total FROM orders;
  SELECT COUNT(*) INTO items_total FROM order_items;

  -- Report results
  IF orders_null_count > 0 THEN
    RAISE WARNING 'Found % orders with NULL lastInternalActivityAt out of % total',
      orders_null_count, orders_total;
  ELSE
    RAISE NOTICE 'Verification passed: All % orders have lastInternalActivityAt set',
      orders_total;
  END IF;

  IF items_null_count > 0 THEN
    RAISE WARNING 'Found % order items with NULL lastInternalActivityAt out of % total',
      items_null_count, items_total;
  ELSE
    RAISE NOTICE 'Verification passed: All % order items have lastInternalActivityAt set',
      items_total;
  END IF;
END $$;

-- Final summary
DO $$
BEGIN
  RAISE NOTICE 'add_internal_activity_tracking_fields migration completed successfully';
END $$;