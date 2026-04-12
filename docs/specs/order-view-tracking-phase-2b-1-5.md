# Order View Tracking Phase 2B-1.5: Internal Activity Tracking Schema

**Date:** April 10, 2026
**Author:** Architecture Team
**Status:** SPECIFICATION - Awaiting Review

---

## Executive Summary

This specification defines Phase 2B-1.5 of the order view tracking feature, which adds `lastInternalActivityAt` fields to the `Order` and `OrderItem` models. These fields will track when internal activity (visible to admin/vendor users but not customers) occurs on orders and their items, enabling differentiated activity indicators for internal vs customer-facing activity. This phase covers ONLY the schema changes, migration, and backfill — no application logic.

---

## 1. Schema Design

### 1.1 Prisma Model Changes

```prisma
model Order {
  // ... existing fields ...
  lastActivityAt         DateTime?
  lastInternalActivityAt DateTime?
  // ... existing fields ...
  @@map("orders")
}

model OrderItem {
  // ... existing fields ...
  lastActivityAt         DateTime?
  lastInternalActivityAt DateTime?
  // ... existing fields ...
  @@map("order_items")
}
```

### 1.2 Field Specifications

**Field Name:** `lastInternalActivityAt`

**Type:** `DateTime?` (nullable timestamp)

**Default:** No default value in schema — will be backfilled via migration

**Justification:**
- **Nullable:** Allows gradual rollout and makes it clear when no internal activity has occurred
- **DateTime:** Consistent with other timestamp fields (`createdAt`, `updatedAt`, `lastActivityAt`)
- **No @default:** Backfill strategy requires explicit control over initial values
- **Parallel to lastActivityAt:** Maintains symmetry with the customer-visible activity tracking field

**Activity Type Distinctions:**
- **lastActivityAt:** Customer-visible events (comments, status changes, order updates)
- **lastInternalActivityAt:** All activity including internal-only events (vendor assignments, internal comments, admin actions)
- **Customer events update BOTH fields:** When customers see activity, internal users should also see it
- **Internal-only events update ONLY lastInternalActivityAt:** Vendor assignments, internal comments, admin-only status changes

### 1.3 Index Strategy

No additional indexes will be created for `lastInternalActivityAt` fields.

**Justification:**
- Queries will compare `lastInternalActivityAt` against per-user view timestamps row-by-row
- No WHERE clauses will filter on `lastInternalActivityAt` directly
- No ORDER BY on `lastInternalActivityAt` expected
- Indexes would add overhead without query benefit
- Mirrors the indexing strategy from Phase 2B-1 for consistency

---

## 2. Migration Plan

### 2.1 Migration File Location

```
prisma/migrations/20260410HHMMSS_add_internal_activity_tracking_fields/migration.sql
```

### 2.2 SQL Migration Content

```sql
-- /GlobalRX_v2/prisma/migrations/20260410HHMMSS_add_internal_activity_tracking_fields/migration.sql

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
```

### 2.3 Migration Characteristics

- **Idempotent:** Uses column existence checks and NULL checks to prevent duplicate operations
- **Comprehensive Logging:** Provides detailed progress and verification messages
- **Transaction Safety:** DDL operations are atomic in PostgreSQL
- **CamelCase Columns:** Properly quoted to preserve casing in PostgreSQL
- **Correct Table Names:** Uses `orders` and `order_items` (database names), not Prisma model names
- **Mirrors Phase 2B-1 Pattern:** Uses identical structure and verification logic for consistency

---

## 3. Backfill Strategy

### 3.1 Chosen Strategy

**Set `lastInternalActivityAt = updatedAt` for all existing records**

### 3.2 Reasoning

- **Prevents False Positives:** Using `updatedAt` ensures existing orders don't all appear as "new" when internal activity indicators launch
- **Best Available Approximation:** `updatedAt` is our closest proxy for "last internal activity" in the current schema
- **Consistent User Experience:** Orders that haven't been modified recently won't show internal activity indicators
- **Graceful Rollout:** Internal users will only see activity indicators for genuinely recent changes
- **Matches Phase 2B-1:** Maintains consistency with the customer-visible activity field backfill strategy

### 3.3 Alternative Strategies Considered and Rejected

- **Using `createdAt`:** Would make very old orders never show as having internal activity, even when they do
- **Using `now()`:** Would make ALL existing orders appear as "new" immediately after deployment to internal users
- **Leaving as NULL:** Would require special handling in application code and could cause confusion
- **Using `lastActivityAt`:** Would create artificial dependency between customer and internal activity tracking

---

## 4. Naming and Standards Compliance

### 4.1 Field Naming

`lastInternalActivityAt` follows the project's naming conventions:
- CamelCase for Prisma model fields ✓
- Descriptive name indicating purpose ✓
- Consistent with other timestamp fields (`createdAt`, `updatedAt`, `submittedAt`, `lastActivityAt`) ✓
- Clear distinction from `lastActivityAt` for different activity types ✓

### 4.2 Database Column Mapping

- Prisma field `lastInternalActivityAt` maps to PostgreSQL column `"lastInternalActivityAt"` (quoted to preserve case)
- Consistent with existing camelCase columns in the database
- Follows the same pattern as `lastActivityAt` from Phase 2B-1

### 4.3 Documentation Updates Required (Phase 2B-1.5)

The following document MUST be updated as part of Phase 2B-1.5 by the documentation-writer agent:

- `docs/DATA_DICTIONARY.md` — Add `lastInternalActivityAt` to both the Order and OrderItem entries, including the field name, type (DateTime, optional), and a description explaining that it tracks when the record itself last had meaningful internal activity (visible to admin/vendor users but not customers), and that Order and OrderItem internal activity are tracked independently (item internal activity does NOT cascade to the parent order). The documentation should clearly distinguish this field from `lastActivityAt` which tracks customer-visible activity.

---

## 5. Explicitly Out of Scope for Phase 2B-1.5

The following items are NOT part of this phase:

- **Mutation Code:** No changes to service layer, API routes, or any code that writes to the database
- **API Response Changes:** Order and OrderItem responses will not include `lastInternalActivityAt` yet
- **Frontend Changes:** No UI components or view logic modifications
- **Read Logic:** No queries will use `lastInternalActivityAt` for filtering or display
- **Business Logic:** No code to determine what constitutes "internal activity" or when to update the fields
- **View Comparison Logic:** No code to compare `lastInternalActivityAt` against user view timestamps
- **Activity Type Logic:** No code to decide when to update both fields vs only `lastInternalActivityAt`

**Phase 2B-1.5 deliverables:**
1. Schema with new `lastInternalActivityAt` fields
2. Executed migration
3. Backfilled database
4. This specification document
5. Updated `docs/DATA_DICTIONARY.md` reflecting the new fields

---

## 6. Test Strategy for Phase 2B-1.5

### 6.1 Why No Automated Tests

Per the project's test-writer agent guidance:
- Pure DDL phases (schema + migration only) should SKIP Pass 1 pre-implementation tests
- No application logic exists to test
- Schema changes are verified through manual database inspection
- Migration success is confirmed through its own verification logic

### 6.2 Test Writer Output

The test-writer should produce a report stating:
```
Phase 2B-1.5: No Tests Required

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
       COUNT("lastInternalActivityAt") AS with_internal_activity,
       COUNT(*) - COUNT("lastActivityAt") AS without_activity,
       COUNT(*) - COUNT("lastInternalActivityAt") AS without_internal_activity
FROM orders;

SELECT COUNT(*) AS total,
       COUNT("lastActivityAt") AS with_activity,
       COUNT("lastInternalActivityAt") AS with_internal_activity,
       COUNT(*) - COUNT("lastActivityAt") AS without_activity,
       COUNT(*) - COUNT("lastInternalActivityAt") AS without_internal_activity
FROM order_items;

-- Sample some records to verify both activity fields
SELECT id, "orderNumber", "createdAt", "updatedAt", "lastActivityAt", "lastInternalActivityAt"
FROM orders
LIMIT 10;

-- Verify both activity timestamps match updatedAt (they should be equal after backfill)
SELECT COUNT(*) AS mismatched_orders
FROM orders
WHERE "lastActivityAt" != "lastInternalActivityAt"
  AND "lastActivityAt" IS NOT NULL
  AND "lastInternalActivityAt" IS NOT NULL;
```

---

## 7. Risks and Open Questions

### 7.1 Identified Risks

**Risk:** Column names might conflict with future Prisma features
- **Mitigation:** `lastInternalActivityAt` follows established patterns and is unlikely to conflict

**Risk:** Backfill strategy might not match user expectations
- **Mitigation:** Using `updatedAt` is the safest, most conservative approach and matches Phase 2B-1

**Risk:** Confusion between `lastActivityAt` and `lastInternalActivityAt` purposes
- **Mitigation:** Clear naming convention and documentation will distinguish customer vs internal activity tracking

### 7.2 Open Questions

None. The specification is complete as designed.

---

## 8. Migration Execution Plan

### 8.1 Development Environment

```bash
# 1. Update schema.prisma with new lastInternalActivityAt fields
# 2. Create migration directory
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_internal_activity_tracking_fields

# 3. Save the SQL migration content to:
#    prisma/migrations/[timestamp]_add_internal_activity_tracking_fields/migration.sql

# 4. Apply migration
pnpm prisma migrate deploy

# 5. Generate Prisma client
pnpm prisma generate

# 6. Verify in TablePlus
```

### 8.2 Success Criteria

- [ ] Both `lastInternalActivityAt` columns added to database
- [ ] All existing records backfilled with `updatedAt` values
- [ ] Migration logs show no warnings
- [ ] Prisma client regenerated without errors
- [ ] Schema.prisma includes new fields
- [ ] `docs/DATA_DICTIONARY.md` updated with `lastInternalActivityAt` for Order and OrderItem
- [ ] Both activity fields (`lastActivityAt` and `lastInternalActivityAt`) exist and are properly typed

---

## Approval

**Status:** Awaiting review and approval from Andy before proceeding to implementation.

**Next Phase:** Phase 2B-2 will implement the mutation logic to update these fields when relevant activity occurs, including the business logic to determine when to update both fields vs only `lastInternalActivityAt`.