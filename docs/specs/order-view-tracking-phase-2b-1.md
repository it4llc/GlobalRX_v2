# Order View Tracking Phase 2B-1: Activity Tracking Schema

**Date:** April 9, 2026
**Author:** Architecture Team
**Status:** SPECIFICATION - Awaiting Review

---

## Executive Summary

This specification defines Phase 2B-1 of the order view tracking feature, which adds `lastActivityAt` fields to the `Order` and `OrderItem` models. These fields will track when activity occurs on orders and their items, enabling the frontend to show "new activity" indicators to customer users. This phase covers ONLY the schema changes, migration, and backfill — no application logic.

---

## 1. Schema Design

### 1.1 Prisma Model Changes

```prisma
model Order {
  // ... existing fields ...
  lastActivityAt      DateTime?
  // ... existing fields ...
  @@map("orders")
}

model OrderItem {
  // ... existing fields ...
  lastActivityAt      DateTime?
  // ... existing fields ...
  @@map("order_items")
}
```

### 1.2 Field Specifications

**Field Name:** `lastActivityAt`

**Type:** `DateTime?` (nullable timestamp)

**Default:** No default value in schema — will be backfilled via migration

**Justification:**
- **Nullable:** Allows gradual rollout and makes it clear when no activity has occurred
- **DateTime:** Consistent with other timestamp fields (`createdAt`, `updatedAt`)
- **No @default:** Backfill strategy requires explicit control over initial values

### 1.3 Index Strategy

No additional indexes will be created for `lastActivityAt` fields.

**Justification:**
- Queries will compare `lastActivityAt` against per-user view timestamps row-by-row
- No WHERE clauses will filter on `lastActivityAt` directly
- No ORDER BY on `lastActivityAt` expected
- Indexes would add overhead without query benefit

---

## 2. Migration Plan

### 2.1 Migration File Location

```
prisma/migrations/20260409HHMMSS_add_activity_tracking_fields/migration.sql
```

### 2.2 SQL Migration Content

```sql
-- /GlobalRX_v2/prisma/migrations/20260409HHMMSS_add_activity_tracking_fields/migration.sql

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
```

### 2.3 Migration Characteristics

- **Idempotent:** Uses column existence checks and NULL checks to prevent duplicate operations
- **Comprehensive Logging:** Provides detailed progress and verification messages
- **Transaction Safety:** DDL operations are atomic in PostgreSQL
- **CamelCase Columns:** Properly quoted to preserve casing in PostgreSQL
- **Correct Table Names:** Uses `orders` and `order_items` (database names), not Prisma model names

---

## 3. Backfill Strategy

### 3.1 Chosen Strategy

**Set `lastActivityAt = updatedAt` for all existing records**

### 3.2 Reasoning

- **Prevents False Positives:** Using `updatedAt` ensures existing orders don't all appear as "new" when the feature launches
- **Best Available Approximation:** `updatedAt` is our closest proxy for "last activity" in the current schema
- **Consistent User Experience:** Orders that haven't been modified recently won't show activity indicators
- **Graceful Rollout:** Users will only see activity indicators for genuinely recent changes

### 3.3 Alternative Strategies Considered and Rejected

- **Using `createdAt`:** Would make very old orders never show as having activity, even when they do
- **Using `now()`:** Would make ALL existing orders appear as "new" immediately after deployment
- **Leaving as NULL:** Would require special handling in application code and could cause confusion

---

## 4. Naming and Standards Compliance

### 4.1 Field Naming

`lastActivityAt` follows the project's naming conventions:
- CamelCase for Prisma model fields ✓
- Descriptive name indicating purpose ✓
- Consistent with other timestamp fields (`createdAt`, `updatedAt`, `submittedAt`) ✓

### 4.2 Database Column Mapping

- Prisma field `lastActivityAt` maps to PostgreSQL column `"lastActivityAt"` (quoted to preserve case)
- Consistent with existing camelCase columns in the database

### 4.3 Documentation Updates Required (Phase 2B-1)

The following document MUST be updated as part of Phase 2B-1 by the documentation-writer agent:

- `docs/DATA_DICTIONARY.md` — Add `lastActivityAt` to both the Order and OrderItem entries, including the field name, type (DateTime, optional), and a description explaining that it tracks when the record itself last had meaningful activity, and that Order and OrderItem activity are tracked independently (item activity does NOT cascade to the parent order).

---

## 5. Explicitly Out of Scope for Phase 2B-1

The following items are NOT part of this phase:

- **Mutation Code:** No changes to service layer, API routes, or any code that writes to the database
- **API Response Changes:** Order and OrderItem responses will not include `lastActivityAt` yet
- **Frontend Changes:** No UI components or view logic modifications
- **Read Logic:** No queries will use `lastActivityAt` for filtering or display
- **Business Logic:** No code to determine what constitutes "activity" or when to update the fields
- **View Comparison Logic:** No code to compare `lastActivityAt` against `lastViewedAt`

**Phase 2B-1 deliverables:**
1. Schema with new fields
2. Executed migration
3. Backfilled database
4. This specification document
5. Updated `docs/DATA_DICTIONARY.md` reflecting the new fields

---

## 6. Test Strategy for Phase 2B-1

### 6.1 Why No Automated Tests

Per the project's test-writer agent guidance:
- Pure DDL phases (schema + migration only) should SKIP Pass 1 pre-implementation tests
- No application logic exists to test
- Schema changes are verified through manual database inspection
- Migration success is confirmed through its own verification logic

### 6.2 Test Writer Output

The test-writer should produce a report stating:
```
Phase 2B-1: No Tests Required

This phase contains only DDL changes (ALTER TABLE statements) and data
backfill operations. There is no application logic to test.

Manual verification should confirm:
- Columns exist in the database
- Columns are properly typed (TIMESTAMP(3))
- Existing records have been backfilled
- Migration verification messages show success
```

### 6.3 Manual Verification Checklist

After migration, verify using TablePlus or psql:

```sql
-- Check columns exist
\d orders
\d order_items

-- Verify backfill completed
SELECT COUNT(*) AS total,
       COUNT("lastActivityAt") AS with_activity,
       COUNT(*) - COUNT("lastActivityAt") AS without_activity
FROM orders;

SELECT COUNT(*) AS total,
       COUNT("lastActivityAt") AS with_activity,
       COUNT(*) - COUNT("lastActivityAt") AS without_activity
FROM order_items;

-- Sample some records
SELECT id, "orderNumber", "createdAt", "updatedAt", "lastActivityAt"
FROM orders
LIMIT 10;
```

---

## 7. Risks and Open Questions

### 7.1 Identified Risks

**Risk:** Column names might conflict with future Prisma features
- **Mitigation:** `lastActivityAt` follows established patterns and is unlikely to conflict

**Risk:** Backfill strategy might not match user expectations
- **Mitigation:** Using `updatedAt` is the safest, most conservative approach

### 7.2 Open Questions

None. The specification is complete as designed.

---

## 8. Migration Execution Plan

### 8.1 Development Environment

```bash
# 1. Update schema.prisma with new fields
# 2. Create migration directory
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_activity_tracking_fields

# 3. Save the SQL migration content to:
#    prisma/migrations/[timestamp]_add_activity_tracking_fields/migration.sql

# 4. Apply migration
pnpm prisma migrate deploy

# 5. Generate Prisma client
pnpm prisma generate

# 6. Verify in TablePlus
```

### 8.2 Success Criteria

- [ ] Both columns added to database
- [ ] All existing records backfilled with `updatedAt` values
- [ ] Migration logs show no warnings
- [ ] Prisma client regenerated without errors
- [ ] Schema.prisma includes new fields
- [ ] `docs/DATA_DICTIONARY.md` updated with `lastActivityAt` for Order and OrderItem

---

## Approval

**Status:** Awaiting review and approval from Andy before proceeding to implementation.

**Next Phase:** Phase 2B-2 will implement the mutation logic to update these fields when relevant activity occurs.