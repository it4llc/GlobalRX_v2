-- /GlobalRX_v2/prisma/migrations/20260409102635_add_activity_tracking_fields/migration.sql

-- Business requirement: Track activity on orders and order items separately to show
-- "new activity" indicators in the customer portal. This migration adds lastActivityAt
-- fields to both tables to track when each record had meaningful activity.
--
-- Data integrity: These fields are independent - activity on an item does NOT cascade
-- to its parent order. They track different types of activity for different UI indicators.
--
-- Safe to run multiple times (idempotent)

-- Start logging
DO $$
BEGIN
  RAISE NOTICE 'Starting add_activity_tracking_fields migration...';
END $$;

-- Add lastActivityAt column to orders table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'orders'
    AND column_name = 'lastActivityAt'
  ) THEN
    ALTER TABLE orders ADD COLUMN "lastActivityAt" TIMESTAMP(3);
    RAISE NOTICE 'Added lastActivityAt column to orders table';
  ELSE
    RAISE NOTICE 'lastActivityAt column already exists on orders table';
  END IF;
END $$;

-- Add lastActivityAt column to order_items table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'order_items'
    AND column_name = 'lastActivityAt'
  ) THEN
    ALTER TABLE order_items ADD COLUMN "lastActivityAt" TIMESTAMP(3);
    RAISE NOTICE 'Added lastActivityAt column to order_items table';
  ELSE
    RAISE NOTICE 'lastActivityAt column already exists on order_items table';
  END IF;
END $$;

-- Backfill lastActivityAt for existing orders
-- Strategy: Use updatedAt as the initial value for existing records
-- Reasoning: updatedAt represents the last time the record itself changed,
-- which is our best approximation of "last activity" for historical data.
-- This prevents all existing orders from appearing as "new" to users.
UPDATE orders
SET "lastActivityAt" = "updatedAt"
WHERE "lastActivityAt" IS NULL
  AND "updatedAt" IS NOT NULL;

-- Log backfill results for orders
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM orders
  WHERE "lastActivityAt" IS NOT NULL;

  RAISE NOTICE 'Backfilled lastActivityAt for % orders', updated_count;
END $$;

-- Backfill lastActivityAt for existing order items
-- Strategy: Use updatedAt for the same reasoning as orders
UPDATE order_items
SET "lastActivityAt" = "updatedAt"
WHERE "lastActivityAt" IS NULL
  AND "updatedAt" IS NOT NULL;

-- Log backfill results for order items
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count
  FROM order_items
  WHERE "lastActivityAt" IS NOT NULL;

  RAISE NOTICE 'Backfilled lastActivityAt for % order items', updated_count;
END $$;

-- Verification: Ensure all records have been processed
DO $$
DECLARE
  orders_null_count INTEGER;
  items_null_count INTEGER;
  orders_total INTEGER;
  items_total INTEGER;
BEGIN
  -- Count records with null lastActivityAt
  SELECT COUNT(*) INTO orders_null_count
  FROM orders
  WHERE "lastActivityAt" IS NULL;

  SELECT COUNT(*) INTO items_null_count
  FROM order_items
  WHERE "lastActivityAt" IS NULL;

  -- Get total counts
  SELECT COUNT(*) INTO orders_total FROM orders;
  SELECT COUNT(*) INTO items_total FROM order_items;

  -- Report results
  IF orders_null_count > 0 THEN
    RAISE WARNING 'Found % orders with NULL lastActivityAt out of % total',
      orders_null_count, orders_total;
  ELSE
    RAISE NOTICE 'Verification passed: All % orders have lastActivityAt set',
      orders_total;
  END IF;

  IF items_null_count > 0 THEN
    RAISE WARNING 'Found % order items with NULL lastActivityAt out of % total',
      items_null_count, items_total;
  ELSE
    RAISE NOTICE 'Verification passed: All % order items have lastActivityAt set',
      items_total;
  END IF;
END $$;

-- Final summary
DO $$
BEGIN
  RAISE NOTICE 'add_activity_tracking_fields migration completed successfully';
END $$;