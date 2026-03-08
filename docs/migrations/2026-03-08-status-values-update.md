# Status Values Migration Guide

**Date:** March 8, 2026
**Feature:** Service Status Standardization
**Impact:** Database and UI updates

## Overview

This migration standardizes service status values across the system, moving from lowercase to title-case values and expanding from 5 to 7 status options.

## Status Value Changes

### Old Status Values (Lowercase)
- `draft`
- `submitted`
- `processing`
- `completed`
- `cancelled`

### New Status Values (Title Case)
- `Draft` - Initial state, not yet submitted
- `Submitted` - Service request submitted for processing
- `Processing` - Actively being worked on
- `Missing Information` - On hold pending additional data (NEW)
- `Completed` - Service successfully completed
- `Cancelled` - Service cancelled by customer/internal
- `Cancelled-DNB` - Cancelled as "Did Not Book" (NEW)

## Migration Steps

### 1. Database Updates

Run the following SQL scripts in order:

#### Step 1: Sync Service Statuses with Orders
```sql
-- scripts/sync-order-item-statuses.sql
UPDATE order_items oi
SET status = o."statusCode"
FROM orders o
WHERE oi."orderId" = o.id
AND oi.status != o."statusCode";
```

#### Step 2: Populate Services Fulfillment Table
```sql
-- scripts/populate-services-fulfillment.sql
INSERT INTO services_fulfillment (
    id, "orderId", "orderItemId", "serviceId",
    "locationId", status, "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid(),
    oi."orderId",
    oi.id,
    oi."serviceId",
    oi."locationId",
    oi.status,
    oi."createdAt",
    CURRENT_TIMESTAMP
FROM order_items oi
LEFT JOIN services_fulfillment sf ON sf."orderItemId" = oi.id
WHERE sf.id IS NULL;
```

#### Step 3: Update Status Values to Title Case
```sql
-- Update order_items table
UPDATE order_items
SET status =
  CASE status
    WHEN 'draft' THEN 'Draft'
    WHEN 'submitted' THEN 'Submitted'
    WHEN 'processing' THEN 'Processing'
    WHEN 'completed' THEN 'Completed'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE status
  END
WHERE status IN ('draft', 'submitted', 'processing', 'completed', 'cancelled');

-- Update services_fulfillment table
UPDATE services_fulfillment
SET status =
  CASE status
    WHEN 'draft' THEN 'Draft'
    WHEN 'submitted' THEN 'Submitted'
    WHEN 'processing' THEN 'Processing'
    WHEN 'completed' THEN 'Completed'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE status
  END
WHERE status IN ('draft', 'submitted', 'processing', 'completed', 'cancelled');

-- Update orders table
UPDATE orders
SET "statusCode" =
  CASE "statusCode"
    WHEN 'draft' THEN 'Draft'
    WHEN 'submitted' THEN 'Submitted'
    WHEN 'processing' THEN 'Processing'
    WHEN 'completed' THEN 'Completed'
    WHEN 'cancelled' THEN 'Cancelled'
    ELSE "statusCode"
  END
WHERE "statusCode" IN ('draft', 'submitted', 'processing', 'completed', 'cancelled');
```

### 2. Code Updates

All TypeScript/JavaScript code has been updated to use the new constants:

```typescript
// src/constants/service-status.ts
export const SERVICE_STATUSES = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PROCESSING: 'Processing',
  MISSING_INFO: 'Missing Information',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  CANCELLED_DNB: 'Cancelled-DNB'
} as const;
```

### 3. Component Updates

The following components have been updated to use the new status values:
- `ServiceFulfillmentTable.tsx` - Status display and dropdowns
- `OrderStatusDropdown.tsx` - Status selection options
- `CommentTemplateGrid.tsx` - Template availability configuration

### 4. API Updates

All API endpoints now expect and return title-case status values:
- `/api/services-fulfillment/*` - Service fulfillment endpoints
- `/api/comment-templates/*` - Template availability filtering

## Rollback Plan

If rollback is needed:

1. Revert code changes to previous commit
2. Run reverse SQL to change back to lowercase:

```sql
-- Rollback order_items
UPDATE order_items
SET status = LOWER(status)
WHERE status IN ('Draft', 'Submitted', 'Processing', 'Completed', 'Cancelled');

-- Rollback services_fulfillment
UPDATE services_fulfillment
SET status = LOWER(status)
WHERE status IN ('Draft', 'Submitted', 'Processing', 'Completed', 'Cancelled');

-- Rollback orders
UPDATE orders
SET "statusCode" = LOWER("statusCode")
WHERE "statusCode" IN ('Draft', 'Submitted', 'Processing', 'Completed', 'Cancelled');
```

## Testing Checklist

- [ ] Verify all services display correct status in fulfillment table
- [ ] Test status dropdown shows all 7 options
- [ ] Confirm status changes are saved correctly
- [ ] Check audit logs capture status changes
- [ ] Verify comment templates filter by new status values
- [ ] Test vendor view shows correct statuses
- [ ] Confirm API responses use title-case values

## Notes

- The new statuses `Missing Information` and `Cancelled-DNB` are additive and don't require migration
- All existing data has been preserved with only case changes
- The system maintains backward compatibility through the constants file