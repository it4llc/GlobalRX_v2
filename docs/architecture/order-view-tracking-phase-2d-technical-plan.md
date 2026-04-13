# Technical Plan: Order View Tracking Phase 2D - New Activity Visual Indicators
**Based on specification:** order-view-tracking-phase-2d-new-activity-indicators.md
**Date:** 2026-04-13

## Findings

### Schema Reference
From `prisma/schema.prisma`, I confirmed:
- Order model has `lastActivityAt`, `lastInternalActivityAt`, and `orderViews` relation
- OrderItem model has `lastActivityAt`, `lastInternalActivityAt`, and `orderItemViews` relation
- OrderView table exists with `userId`, `orderId`, `lastViewedAt` fields
- OrderItemView table exists with `userId`, `orderItemId`, `lastViewedAt` fields

### Order-Core Service Analysis
From `src/lib/services/order-core.service.ts` line 745:
- `getCustomerOrders` method executes Prisma query with items include
- Currently includes service and location data but NO view-tracking includes
- Method is called via OrderService facade from `/api/portal/orders`
- No session context passed to this service method

### Fulfillment Route Analysis
From `src/app/api/fulfillment/orders/[id]/route.ts` lines 72-75:
- Role detection: `const userType = session.user.userType`
- Customer check: `const isCustomer = userType === 'customer'`
- Query starts at line 162 with full order includes but NO view-tracking data

### Dashboard Analysis
From `src/app/portal/dashboard/page.tsx`:
- Fetches orders via `/api/portal/orders?limit=50`
- Renders order table with ServiceStatusList component in each row
- handleViewOrder navigates to `/fulfillment/orders/${orderId}`
- Order number displayed around line 350
- **Translation convention:** This file does NOT use translations - all strings are hardcoded in English

### ServiceStatusList Analysis
From `src/components/orders/ServiceStatusList.tsx`:
- Pure presentational component receiving items array
- Renders service name, location, and status badge
- No knowledge of view-tracking data (good)
- **Translation convention:** This file DOES use translations via `useTranslation()` hook from TranslationContext

### ServiceFulfillmentTable Analysis
From `src/components/fulfillment/ServiceFulfillmentTable.tsx`:
- Expandable table with row expansion tracking
- Already fires `/api/order-items/${orderItemId}/view` on expand (line 472)
- Pure presentational component receiving services array
- **Translation convention:** This file does NOT use translations - all aria-label strings are hardcoded in English

### View Tracking Integration
From `src/app/fulfillment/orders/[id]/page.tsx`:
- Order view tracking fires POST to `/api/orders/${orderId}/view` (line 171)
- Item view tracking fires in ServiceFulfillmentTable on row expand

### UI Component Patterns
From `src/components/ui/` directory:
- `src/lib/utils.ts` exports a `cn()` helper for className merging using clsx + tailwind-merge
- Many UI components use cn() for className prop handling
- Badge component uses cva instead of cn()

## Database Changes
**No database changes needed** - All required schema elements exist from Phase 2A:
- OrderView and OrderItemView tables already present
- lastActivityAt fields already on Order and OrderItem models

## New Files to Create

### 1. `/src/components/ui/NewActivityDot.tsx`
- **Purpose:** Reusable red dot indicator component
- **Contains:** React component with show prop, aria-label, optional className
- **Implementation:** 8px red circle with Tailwind classes, returns null when hidden, uses cn() helper

### 2. `/src/lib/utils/activity-comparison.ts`
- **Purpose:** Date comparison utility for activity checking
- **Contains:** `hasNewActivity` function that safely compares dates
- **Implementation:** Convert to Date objects, handle nulls, compare timestamps

## Existing Files to Modify

### 1. `/src/lib/services/order-core.service.ts`
- **Current:** getCustomerOrders at line 745 with basic includes
- **Change:** Add conditional view-tracking includes based on explicit boolean parameter
- **Note:** Must add optional `includeViews` boolean parameter to method signature

### 2. `/src/app/api/portal/orders/route.ts`
- **Current:** Calls OrderService.getCustomerOrders without view-tracking context
- **Change:** Check if session.user exists (customer context), pass `includeViews: true` to service

### 3. `/src/app/api/fulfillment/orders/[id]/route.ts`
- **Current:** Query at line 162 without view-tracking
- **Change:** Add conditional orderViews/orderItemViews includes based on `isCustomer` boolean

### 4. `/src/app/portal/dashboard/page.tsx`
- **Current:** Renders orders table, passes items to ServiceStatusList
- **Change:** Compute hasNewActivity flags, render order-level dots, enhance items
- **Note:** aria-label strings must use hardcoded English to match existing file convention

### 5. `/src/components/orders/ServiceStatusList.tsx`
- **Current:** Renders service list without activity indicators
- **Change:** Add NewActivityDot before service name based on item.hasNewActivity
- **Note:** aria-label strings must use translation keys to match existing file convention

### 6. `/src/components/fulfillment/ServiceFulfillmentTable.tsx`
- **Current:** Renders expandable service table
- **Change:** Add NewActivityDot in service name column based on service.hasNewActivity
- **Note:** aria-label strings must use hardcoded English to match existing file convention

### 7. `/src/components/fulfillment/OrderDetailsView.tsx`
- **Current:** Maps order items to services for ServiceFulfillmentTable
- **Change:** Compute and attach hasNewActivity boolean to each service

## API Routes

### GET `/api/portal/orders`
- **Path:** `/src/app/api/portal/orders/route.ts`
- **Methods:** GET (existing)
- **Authentication:** Required (customer only)
- **Changes:** Pass `includeViews: true` to OrderCoreService (customers always need views)
- **Returns:** Orders with orderViews/orderItemViews for customers

### GET `/api/fulfillment/orders/[id]`
- **Path:** `/src/app/api/fulfillment/orders/[id]/route.ts`
- **Methods:** GET (existing)
- **Authentication:** Required (all user types)
- **Changes:** Add conditional view-tracking includes based on `isCustomer` check
- **Returns:** Order with view data for customers, unchanged for others

## Zod Validation Schemas
**No new schemas needed** - Using existing order/item shapes with optional view arrays

## TypeScript Types
**No new types file needed** - Types will be declared inline where used:
- Dashboard page will inline type the enhanced orders with `hasNewOrderActivity` and items with `hasNewActivity`
- OrderDetailsView will inline type the enhanced services with `hasNewActivity`

This avoids creating a new file when only two locations need these types, keeping the codebase simpler.

## UI Components

### `/src/components/ui/NewActivityDot.tsx`
- **Type:** Client component (`"use client"`)
- **Renders:** Red circular dot or null
- **Uses:** cn() helper from `/src/lib/utils`
- **Props:** show: boolean, aria-label: string, className?: string

### `/src/app/portal/dashboard/page.tsx` (modified)
- **Type:** Client component (already)
- **Renders:** Order table with activity dots
- **Uses:** NewActivityDot component
- **API calls:** `/api/portal/orders` (existing)

### `/src/components/orders/ServiceStatusList.tsx` (modified)
- **Type:** Client component (already)
- **Renders:** Service list with activity dots
- **Uses:** NewActivityDot component
- **API calls:** None (presentational)

### `/src/components/fulfillment/ServiceFulfillmentTable.tsx` (modified)
- **Type:** Client component (already)
- **Renders:** Expandable table with activity dots
- **Uses:** NewActivityDot component
- **API calls:** `/api/order-items/[id]/view` (existing)

## Order of Implementation

1. **Utility function** - Create `/src/lib/utils/activity-comparison.ts`
2. **UI component** - Create `/src/components/ui/NewActivityDot.tsx`
3. **Backend query updates**:
   - Modify `order-core.service.ts` to accept `includeViews` boolean and conditionally include views
   - Update `/api/portal/orders` route to pass `includeViews: true`
   - Update `/api/fulfillment/orders/[id]` route to add conditional includes
4. **Frontend integration**:
   - Update dashboard page to compute flags and render order dots
   - Update ServiceStatusList to render item dots
   - Update OrderDetailsView to compute flags
   - Update ServiceFulfillmentTable to render item dots

## Prisma Queries

### Customer Session Query (getCustomerOrders with includeViews: true)
```typescript
// When includeViews is true
include: {
  items: {
    include: {
      service: { /* existing */ },
      location: { /* existing */ },
      orderItemViews: {
        where: { userId },
        select: { lastViewedAt: true },
        take: 1
      }
    },
    orderBy: [/* existing */]
  },
  statusHistory: { /* existing */ },
  orderViews: {
    where: { userId },
    select: { lastViewedAt: true },
    take: 1
  }
}
```

### Non-Customer Session Query (includeViews: false or undefined)
```typescript
// Existing query unchanged - no view includes
include: {
  items: {
    include: {
      service: { /* existing */ },
      location: { /* existing */ }
    },
    orderBy: [/* existing */]
  },
  statusHistory: { /* existing */ }
}
```

## Role Detection

### In `/src/lib/services/order-core.service.ts`:
```typescript
static async getCustomerOrders(
  customerId: string,
  filters?: { /* existing */ },
  includeViews?: boolean,  // NEW optional parameter
  userId?: string  // NEW optional parameter (needed for WHERE clause)
) {
  // Build conditional include based on includeViews flag
  // If includeViews is true, must also have userId for the WHERE clause
}
```

### In API routes:
```typescript
// Portal route - customers always need views
const includeViews = true;
const userId = session.user.id;
OrderService.getCustomerOrders(customerId, filters, includeViews, userId);

// Fulfillment route - check userType
const isCustomer = session.user.userType === 'customer';
// Then use isCustomer to conditionally add view includes to Prisma query
```

## Utility Function

### `/src/lib/utils/activity-comparison.ts`:
```typescript
export function hasNewActivity(
  lastActivityAt: Date | string | null,
  lastViewedAt: Date | string | null | undefined
): boolean {
  // No activity = no indicator
  if (!lastActivityAt) return false;

  // Never viewed = show indicator
  if (!lastViewedAt) return true;

  // Compare timestamps safely
  const activityTime = new Date(lastActivityAt).getTime();
  const viewTime = new Date(lastViewedAt).getTime();
  return activityTime > viewTime;
}
```

## NewActivityDot Component

### `/src/components/ui/NewActivityDot.tsx`:
```typescript
'use client';

import { cn } from '@/lib/utils';

interface NewActivityDotProps {
  show: boolean;
  'aria-label': string;
  className?: string;
}

export function NewActivityDot({
  show,
  'aria-label': ariaLabel,
  className
}: NewActivityDotProps): JSX.Element | null {
  if (!show) return null;

  return (
    <span
      className={cn(
        "inline-block w-2 h-2 bg-red-500 rounded-full",
        className
      )}
      aria-label={ariaLabel}
      role="status"
    />
  );
}
```

## Item Shape Changes

### Enhanced OrderItem shape (computed in fetching pages):
```typescript
interface EnhancedOrderItem {
  // ... existing OrderItem fields
  hasNewActivity?: boolean;  // Added by dashboard/OrderDetailsView
}
```

## Dashboard Changes

In `/src/app/portal/dashboard/page.tsx` after fetching orders:
```typescript
import { hasNewActivity } from '@/lib/utils/activity-comparison';
import { NewActivityDot } from '@/components/ui/NewActivityDot';

// After fetching orders, enhance with activity flags
const enhancedOrders = ordersData.orders.map(order => ({
  ...order,
  hasNewOrderActivity: hasNewActivity(
    order.lastActivityAt,
    order.orderViews?.[0]?.lastViewedAt
  ),
  items: order.items?.map(item => ({
    ...item,
    hasNewActivity: hasNewActivity(
      item.lastActivityAt,
      item.orderItemViews?.[0]?.lastViewedAt
    )
  }))
}));

// In render, next to order number:
<div className="flex items-center gap-2">
  <NewActivityDot
    show={order.hasNewOrderActivity || false}
    aria-label="Order has new activity"  // Hardcoded English per file convention
    className="mr-1"
  />
  <div className="text-sm font-medium text-gray-900">
    {order.orderNumber}
  </div>
</div>
```

## Order Details Changes

In `/src/components/fulfillment/OrderDetailsView.tsx`:
```typescript
import { hasNewActivity } from '@/lib/utils/activity-comparison';

// When mapping items to services:
const enhancedService = {
  ...mappedService,
  hasNewActivity: hasNewActivity(
    item.lastActivityAt,
    item.orderItemViews?.[0]?.lastViewedAt
  )
};
```

## Test Strategy

### New test files:
- `/src/lib/utils/__tests__/activity-comparison.test.ts` - Unit tests for date comparison
- `/src/components/ui/__tests__/NewActivityDot.test.tsx` - Component tests

### Modified test files:
- `/src/lib/services/__tests__/order-core.service.test.ts` - Test conditional includes
- `/src/app/api/portal/orders/__tests__/route.test.ts` - Verify view data for customers
- `/src/app/api/fulfillment/orders/[id]/__tests__/route.test.ts` - Test role-based includes
- `/src/components/orders/__tests__/ServiceStatusList.test.tsx` - Test dot rendering
- `/src/components/fulfillment/__tests__/ServiceFulfillmentTable.test.tsx` - Test dot in table

### Test coverage needed:
- **Happy paths:** Dots appear when activity > view time
- **Edge cases:** Null dates, missing view records, non-customer sessions
- **Role gating:** Admin/vendor don't get view data or dots
- **Date safety:** Various date formats handled correctly

### Test Fixtures

#### For activity-comparison tests:
```typescript
const fixtures = {
  // Happy path - activity newer than view
  newActivity: {
    lastActivityAt: '2024-01-15T10:00:00Z',
    lastViewedAt: '2024-01-14T10:00:00Z',
    expected: true
  },
  // Activity older than view
  oldActivity: {
    lastActivityAt: '2024-01-13T10:00:00Z',
    lastViewedAt: '2024-01-14T10:00:00Z',
    expected: false
  },
  // Never viewed
  neverViewed: {
    lastActivityAt: '2024-01-15T10:00:00Z',
    lastViewedAt: null,
    expected: true
  },
  // No activity
  noActivity: {
    lastActivityAt: null,
    lastViewedAt: '2024-01-14T10:00:00Z',
    expected: false
  },
  // Both null
  bothNull: {
    lastActivityAt: null,
    lastViewedAt: null,
    expected: false
  },
  // Equal timestamps
  equalTimestamps: {
    lastActivityAt: '2024-01-14T10:00:00.000Z',
    lastViewedAt: '2024-01-14T10:00:00.000Z',
    expected: false
  }
};
```

#### For role-based gating tests:
```typescript
const customerSession = {
  user: {
    id: 'user-123',
    userType: 'customer',
    customerId: 'cust-123'
  }
};

const adminSession = {
  user: {
    id: 'admin-456',
    userType: 'admin'
  }
};

const vendorSession = {
  user: {
    id: 'vendor-789',
    userType: 'vendor',
    vendorId: 'vend-123'
  }
};
```

### Test-Writer Critical Instructions

1. **MUST read `prisma/schema.prisma`** before writing any test that references Prisma fields
2. **NEVER write early-exit stub tests** like `throw new Error('EXPECTED PASS 1 FAILURE')`
3. **Check for global Prisma mocking** in `src/test/setup.ts` before importing PrismaClient
4. **If blocked on fixtures**, STOP and report the blocker instead of writing fake tests
5. **Test both customer and non-customer sessions** for all role-gated functionality
6. **Use the actual field names** from schema (e.g., `orderViews` not `orderViewRecords`)

## Commit Sequence

1. **Commit 1:** Add activity comparison utility and NewActivityDot component with tests
2. **Commit 2:** Update order-core.service to support conditional view includes
3. **Commit 3:** Update API routes to pass includeViews flag and check roles
4. **Commit 4:** Integrate dots in dashboard page with order-level indicators
5. **Commit 5:** Add dots to ServiceStatusList component
6. **Commit 6:** Integrate dots in order details flow and ServiceFulfillmentTable
7. **Commit 7:** Add comprehensive test coverage for all modified components

Each commit should:
- Leave the codebase in a working state
- Have tests passing
- Be on the `feature/order-view-tracking-phase-2d` branch
- Follow the commit message format from the repository

## Risks and Considerations

1. **Performance Impact:** Adding view includes increases query size. Mitigated by using `take: 1` to limit to single record per user.

2. **Race Condition:** Known and accepted - user may see dot after viewing if activity arrives during view POST. This is documented in the spec as acceptable behavior.

3. **Type Safety:** Optional chaining needed throughout since view arrays may be undefined for non-customers. TypeScript will enforce this.

4. **Backward Compatibility:** All changes are additive - non-customer flows remain completely unchanged.

5. **Testing Complexity:** Need to mock Prisma includes differently based on includeViews presence. Test fixtures provided to handle this.

6. **Migration Path:** No database migration needed since all schema elements exist from Phase 2A.

7. **Session Context:** The order-core.service currently doesn't receive session context. Adding optional includeViews and userId parameters maintains backward compatibility.

## Open Questions

None - all requirements have been addressed based on the specification and code investigation.

## Success Criteria

The implementation is complete when:
1. Customer users see red dots next to new/updated orders and items
2. Admin and vendor users see no visual changes (no dots)
3. All date comparisons handle nulls safely
4. Tests cover all edge cases and role scenarios
5. No performance regression in order list loading
6. Accessibility labels properly describe the visual indicators

---

**Ready for test-writer agent to proceed with TDD implementation.**
