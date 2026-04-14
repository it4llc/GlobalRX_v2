# Feature Specification: Order View Tracking Phase 2D - "New Activity" Visual Indicators
**Spec file:** `docs/specs/order-view-tracking-phase-2d-new-activity-indicators.md`
**Date:** 2026-04-13
**Requested by:** Andy
**Status:** Draft

## Summary
Phase 2D adds visual "new activity" indicators (red dots) to customer dashboard order tables and order detail item lists. These indicators appear when order-level or item-level activity has occurred since the customer last viewed that order or item. This phase extends existing Prisma queries to include view-tracking data and implements client-side comparison logic to show red dots where appropriate.

## Findings

### Schema Reference
From `/Users/andyhellman/Projects/GlobalRx_v2/prisma/schema.prisma`:

**Order Model Relations:**
```prisma
model Order {
  // ... other fields
  lastActivityAt      DateTime?
  lastInternalActivityAt DateTime?
  orderViews          OrderView[]
  // ... rest of model
}
```

**OrderItem Model Relations:**
```prisma
model OrderItem {
  // ... other fields
  lastActivityAt     DateTime?
  lastInternalActivityAt DateTime?
  orderItemViews     OrderItemView[]
  // ... rest of model
}
```

**OrderView Table:**
```prisma
model OrderView {
  id           String   @id @default(uuid())
  userId       String
  orderId      String
  lastViewedAt DateTime @default(now())
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  order Order @relation(fields: [orderId], references: [id], onDelete: Cascade)
  @@unique([userId, orderId])
  @@index([userId])
  @@index([orderId])
  @@map("order_views")
}
```

**OrderItemView Table:**
```prisma
model OrderItemView {
  id           String    @id @default(uuid())
  userId       String
  orderItemId  String
  lastViewedAt DateTime  @default(now())
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  orderItem OrderItem @relation(fields: [orderItemId], references: [id], onDelete: Cascade)
  @@unique([userId, orderItemId])
  @@index([userId])
  @@index([orderItemId])
  @@map("order_item_views")
}
```

### API Findings
- **Phase 2A view-tracking endpoints** exist at `/api/orders/[id]/view`, `/api/order-items/[id]/view`, and `/api/orders/[id]/views`
- **Customer-only pattern**: All view-tracking endpoints skip recording for non-customer users (return `{ skipped: true }`)
- **Activity tracking service** exists in `/src/lib/services/activity-tracking.service.ts` with rules for updating `lastActivityAt` and `lastInternalActivityAt`

### Data Fetching Query Findings
- **Customer orders query** (`getCustomerOrders` in `/src/lib/services/order-core.service.ts` around line 745): Returns orders with nested items but no view-tracking includes
- **Order details query** (`/src/app/api/fulfillment/orders/[id]/route.ts` around line 162): Returns full order with items but no view-tracking includes

### Frontend Component Findings
- **Dashboard** (`/src/app/portal/dashboard/page.tsx`): Uses `ServiceStatusList` component in order table rows
- **ServiceStatusList** (`/src/components/orders/ServiceStatusList.tsx`): Displays individual service rows with status badges
- **ServiceFulfillmentTable** (`/src/components/fulfillment/ServiceFulfillmentTable.tsx`): Expandable table on order details page
- **Existing Badge component** (`/src/components/ui/badge.tsx`): Available for styling consistency

## Who Uses This
- **Customer Users** - See red dot indicators next to orders and services with new activity since their last view
- **Admin/Vendor Users** - Never see indicators (view-tracking data not loaded for these user types)

## User Stories
1. **As a customer**, when I view my dashboard order table, I see a small red dot next to order numbers that have new activity since I last viewed that order, so I can quickly identify which orders need my attention.
2. **As a customer**, when I view an order details page, I see red dots next to service names that have new activity since I last viewed that specific service, so I know which services have updates.
3. **As a customer**, when I view an order or service that shows a red dot, after viewing the content, the red dot disappears on subsequent visits (handled by existing Phase 2A/2C view tracking).

## Business Rules
1. Red dots appear only for customer user sessions - admin and vendor users never see indicators
2. Order-level indicator compares `Order.lastActivityAt` to `OrderView.lastViewedAt` for current user
3. Item-level indicator compares `OrderItem.lastActivityAt` to `OrderItemView.lastViewedAt` for current user
4. Use `lastActivityAt` fields ONLY - never compare against `lastInternalActivityAt`
5. If no OrderView record exists (user never viewed order), show indicator
6. If no OrderItemView record exists (user never viewed item), show indicator
7. Order-level and item-level indicators are independent signals
8. Indicators appear immediately without requiring page refresh
9. View-record includes are added ONLY for customer role sessions
10. Admin/vendor sessions return existing query shape unchanged (no extra includes)

## Data-Fetching Approach

### Customer Orders Query Enhancement
Extend the `getCustomerOrders` query in `order-core.service.ts` to conditionally include OrderView records:

For **customer sessions only**, add to the existing include:
```typescript
include: {
  // existing includes...
  orderViews: {
    where: { userId: currentUserId },
    select: { lastViewedAt: true }
  },
  items: {
    include: {
      // existing service/location includes...
      orderItemViews: {
        where: { userId: currentUserId },
        select: { lastViewedAt: true }
      }
    }
  }
}
```

For **admin/vendor sessions**, the query remains unchanged.

### Order Details Query Enhancement
Extend the fulfillment order details query at `/api/fulfillment/orders/[id]/route.ts` line 162:

For **customer sessions only**, add to the existing include:
```typescript
include: {
  // existing includes...
  orderViews: {
    where: { userId: session.user.id },
    select: { lastViewedAt: true }
  },
  items: {
    include: {
      // existing includes...
      orderItemViews: {
        where: { userId: session.user.id },
        select: { lastViewedAt: true }
      }
    }
  }
}
```

## Data Shape After Changes

### Customer Sessions - Enhanced Order Shape
```typescript
interface EnhancedOrder {
  id: string;
  lastActivityAt: DateTime | null;
  orderViews: Array<{ lastViewedAt: DateTime }>;  // length 0 or 1
  items: Array<{
    id: string;
    lastActivityAt: DateTime | null;
    hasNewActivity?: boolean;  // Computed in data-fetching page
    orderItemViews: Array<{ lastViewedAt: DateTime }>;  // length 0 or 1
    service: { name: string; /* ... */ };
    // ... other item fields
  }>;
  // ... other order fields
}
```

### Admin/Vendor Sessions - Unchanged Order Shape
```typescript
interface StandardOrder {
  id: string;
  lastActivityAt: DateTime | null;
  // NO orderViews field
  items: Array<{
    id: string;
    lastActivityAt: DateTime | null;
    // NO orderItemViews field
    service: { name: string; /* ... */ };
    // ... other item fields
  }>;
  // ... other order fields
}
```

## Comparison Logic in Plain Language

### Order-Level Comparison
"Show red dot if the order has a lastActivityAt timestamp AND either the user has never viewed this order OR the order's lastActivityAt is more recent than when the user last viewed it."

### Item-Level Comparison
"Show red dot if the order item has a lastActivityAt timestamp AND either the user has never viewed this specific item OR the item's lastActivityAt is more recent than when the user last viewed that item."

### Date Comparison Rule
All date comparisons in the comparison logic must convert values to Date objects (or numeric timestamps via .getTime()) before comparing. Do not compare ISO date strings lexicographically even when they happen to work — this is a footgun and must be prevented in the initial implementation.

### Null Handling
- If `lastActivityAt` is null: Never show indicator (no activity to flag)
- If `lastViewedAt` is missing: Show indicator (user never viewed, so any activity is "new")
- If both exist: Show indicator only if activity is more recent than last view

## NewActivityDot Component

Create a reusable component at `/src/components/ui/NewActivityDot.tsx`:

```typescript
interface NewActivityDotProps {
  /** Controls visibility - returns null when false */
  show: boolean;
  /** Accessibility label describing what the indicator represents */
  'aria-label': string;
  /** Additional CSS classes to apply */
  className?: string;
}

export function NewActivityDot({ show, 'aria-label': ariaLabel, className = '' }: NewActivityDotProps): JSX.Element | null
```

**Visual Specifications:**
- 8px diameter filled red circle (`w-2 h-2 bg-red-500 rounded-full`)
- Positioned to the left of text content
- Returns `null` when `show` is `false` to avoid conditional rendering in callers
- Includes required `aria-label` prop for accessibility
- Accepts optional `className` for positioning adjustments

## Integration Points and Changes

### 1. Dashboard Order Table Integration
**File:** `/src/app/portal/dashboard/page.tsx`

**Changes:**
- Import and use `NewActivityDot` component
- For each order, compute `hasNewActivity` using comparison logic against `order.lastActivityAt` and `order.orderViews[0]?.lastViewedAt`
- For each order item, compute `hasNewActivity` boolean and attach to item before passing to ServiceStatusList
- Render order-level red dot directly in the dashboard table next to order number: `<NewActivityDot show={hasNewActivity} aria-label="Order has new activity" />`
- Pass enhanced order data with computed item-level `hasNewActivity` booleans to `ServiceStatusList`

**Example integration:**
```typescript
// In dashboard page data preparation:
const enhancedOrders = orders.map(order => ({
  ...order,
  items: order.items?.map(item => ({
    ...item,
    hasNewActivity: computeItemNewActivity(item) // computed boolean
  }))
}));
```

### 2. ServiceStatusList Enhancement (Presentational Only)
**File:** `/src/components/orders/ServiceStatusList.tsx`

**Changes:**
- Component remains presentational - does NOT perform view-tracking computations
- For each service item, read the pre-computed `hasNewActivity` boolean from the item
- Render `<NewActivityDot show={item.hasNewActivity} aria-label="Service has new activity" />` before service name
- Remove any dependency on view-tracking schema (`orderItemViews`, `lastActivityAt`, etc.) from this component

**Updated Component Interface:**
```typescript
interface ServiceStatusListComponentProps {
  items: Array<{
    // ... existing item properties
    hasNewActivity?: boolean;  // Pre-computed in data-fetching page
  }>;
  preferCountryCode?: boolean;
  isMobile?: boolean;
  maxInitialDisplay?: number;
  // Note: orderHasNewActivity prop removed - order dot rendered directly in dashboard
}
```

### 3. Order Details Page Integration
**File:** Order details page that uses ServiceFulfillmentTable

**Changes:**
- Compute `hasNewActivity` boolean for each order item in the page that fetches data
- Attach computed boolean to each item before passing to ServiceFulfillmentTable
- ServiceFulfillmentTable renders dots based on item's `hasNewActivity` property

### 4. ServiceFulfillmentTable Enhancement (Presentational Only)
**File:** `/src/components/fulfillment/ServiceFulfillmentTable.tsx`

**Changes:**
- Component remains presentational - does NOT perform view-tracking computations
- For each service row, read the pre-computed `hasNewActivity` boolean from the item
- Render `<NewActivityDot show={item.hasNewActivity} aria-label="Service has new activity" />` before service name
- Remove any dependency on view-tracking schema from this component

**Updated Component Interface:**
```typescript
interface ServiceFulfillmentTableProps {
  // existing props...
  items: Array<{
    // ... existing item properties
    hasNewActivity?: boolean;  // Pre-computed in data-fetching page
  }>;
}
```

## Computed Client-side Values

The following values are computed in data-fetching pages (dashboard/page.tsx and order details pages) and are NOT database columns:

| Computed Property | Type | Logic |
|---|---|---|
| `hasNewActivity` (order-level) | boolean | `(order.lastActivityAt && (!order.orderViews?.[0]?.lastViewedAt \|\| order.lastActivityAt > order.orderViews[0].lastViewedAt)) \|\| false` |
| `hasNewActivity` (item-level) | boolean | `(item.lastActivityAt && (!item.orderItemViews?.[0]?.lastViewedAt \|\| item.lastActivityAt > item.orderItemViews[0].lastViewedAt)) \|\| false` |

These values:
- Are computed in data-fetching pages during data preparation (NOT in presentational components)
- Are attached to each item as a simple boolean before being passed to presentational components
- Are NOT added to Prisma models
- Are NOT persisted to the database
- Are NOT returned by API endpoints

## Edge Cases and Error Scenarios

### Known Race Condition
**Scenario:** User views an order/item, then immediately navigates away before the view-tracking POST request completes. Meanwhile, new activity arrives on that order/item.

**Behavior:** When user returns, they may see a red dot even though they did view the content.

**Mitigation:** This is acceptable per business requirements. The race condition is narrow (requires navigation during a POST request) and resolves itself on the next view.

### Error Handling
- View-tracking query failures: Display page without indicators rather than crashing
- Missing view data: Gracefully handle orders without `orderViews`/`orderItemViews` fields
- Type mismatches: Use optional chaining (`?.`) throughout comparison logic

## Non-Goals

- **Real-time updates**: Indicators refresh only on page load/navigation, not via websockets
- **Count badges**: Only boolean presence/absence, never "3 new items" style counters
- **Text indicators**: Only visual red dots, no "New" labels or badges
- **Schema changes**: No new tables, columns, or database modifications
- **New API endpoints**: Use only existing endpoints and data-fetching patterns
- **Admin/vendor indicators**: These user types never see any "new activity" signals
- **Performance optimization**: No specific performance metrics or caching requirements
- **Legacy page support**: `/portal/orders` page remains unchanged

## Open Questions

None - all requirements have been clarified based on the investigation of existing code and patterns.

## Definition of Done

1. **NewActivityDot component** exists in `/src/components/ui/` with `show` prop controlling visibility and proper TypeScript interfaces and accessibility support
2. **Customer orders query** conditionally includes OrderView and OrderItemView data for customer sessions only
3. **Order details query** conditionally includes view-tracking data for customer sessions only
4. **Dashboard order table** shows red dots next to order numbers with new activity (rendered directly in dashboard page, not through ServiceStatusList)
5. **ServiceStatusList component** shows red dots next to service names based on pre-computed `hasNewActivity` boolean, without knowledge of view-tracking schema
6. **ServiceFulfillmentTable** shows red dots next to service names based on pre-computed `hasNewActivity` boolean, without knowledge of view-tracking schema
7. **Comparison logic** correctly implements lastActivityAt vs lastViewedAt comparison with proper Date object conversion
8. **Data preparation** computes `hasNewActivity` booleans in data-fetching pages before passing to presentational components
9. **Admin/vendor sessions** continue working unchanged (no view data loaded, no indicators shown)
10. **Error handling** gracefully manages missing view data or query failures
11. **Type safety** maintained throughout with proper TypeScript interfaces
12. **Visual consistency** maintained with existing design patterns and color scheme
13. **Accessibility compliance** through proper aria-labels on all indicators
14. **Manual testing** confirms indicators appear and disappear correctly based on view/activity timing
15. **Edge case handling** for null values and missing records works correctly