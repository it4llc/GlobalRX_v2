# Technical Plan: Order View Tracking Phase 2C - UI Wiring
**Based on specification:** order-view-tracking-phase-2c.md
**Date:** 2026-04-13

## Database Changes
No database changes are needed. The OrderView and OrderItemView tables already exist from Phase 2A.

## New Files to Create
No new files need to be created. All changes will be made to existing files.

## Existing Files to Modify

### 1. /src/app/fulfillment/orders/[id]/page.tsx
**Current state:** 
- Lines 1-255 contain the order details page component
- Has useEffect that calls `fetchOrderDetails()` when orderId changes (line 128)
- Already has `order` and `orderId` state variables available

**What needs to change:**
- Add `useRef` import from React
- Add a new `trackedOrderIdRef` to track which orderId has been recorded
- Add a new useEffect after line 156 to fire the order view tracking call
- The useEffect should check if order exists and orderId is different from ref
- Use plain fetch() with POST method and Content-Type header
- Catch and log errors with console.warn

### 2. /src/components/fulfillment/ServiceFulfillmentTable.tsx
**Current state:**
- Line 459 has the `toggleRowExpansion` function
- Lines 460-467 contain the expand/collapse logic
- Each service has an `orderItemId` property available

**What needs to change:**
- Inside `toggleRowExpansion` function, add tracking call in the else branch (after line 464)
- The tracking call should fire POST to `/api/order-items/[orderItemId]/view`
- Use the `service.orderItemId` from the services array to get the correct ID
- Need to find the service object that matches the serviceId parameter
- Use plain fetch() with POST method and Content-Type header
- Catch and log errors with console.warn

## API Routes
Both API routes already exist from Phase 2A and require no changes:

### POST /api/orders/[id]/view
- Full path: /src/app/api/orders/[id]/view/route.ts
- Already implemented in Phase 2A
- Accepts empty body
- Returns success or skips for non-customers
- No changes needed

### POST /api/order-items/[id]/view
- Full path: /src/app/api/order-items/[id]/view/route.ts
- Already implemented in Phase 2A
- Accepts empty body
- Returns success or skips for non-customers
- No changes needed

## Zod Validation Schemas
No new Zod schemas are needed. The API endpoints accept empty request bodies.

## TypeScript Types
No new types are needed. All existing types are sufficient.

## UI Components

### /src/app/fulfillment/orders/[id]/page.tsx (Client Component)
**Component type:** Client component (already has `"use client"` directive)
**What it renders:** Order details page with sidebar
**Existing UI components used:** OrderDetailsView, OrderDetailsSidebar
**API routes it calls:** 
- Already calls: `/api/fulfillment/orders/${orderId}` (GET)
- Will add: `/api/orders/${orderId}/view` (POST)

### /src/components/fulfillment/ServiceFulfillmentTable.tsx (Client Component)
**Component type:** Client component (already has `"use client"` directive)
**What it renders:** Table of services for an order with expandable rows
**Existing UI components used:** Various UI components for table rendering
**API routes it calls:**
- Already calls: `/api/services/${orderItemId}/status` (PUT), others
- Will add: `/api/order-items/${orderItemId}/view` (POST)

## Translation Keys
No new translation keys are needed. Tracking errors are only logged to console, never shown to users.

## Order of Implementation
1. Modify `/src/app/fulfillment/orders/[id]/page.tsx` to add order view tracking
2. Modify `/src/components/fulfillment/ServiceFulfillmentTable.tsx` to add item view tracking
3. Manual testing to verify tracking calls fire correctly
4. Verify no visual changes occur in the UI

## Risks and Considerations

### 1. Finding the correct orderItemId in toggleRowExpansion
The `toggleRowExpansion` function receives a `serviceId` parameter, but the API needs `orderItemId`. The services array contains both fields, so we need to find the matching service object to get its orderItemId.

### 2. Ref pattern importance for order tracking
The order object reference may change when `fetchOrderDetails` updates state. Without the ref guard, this would cause duplicate tracking calls. The ref pattern specified in the spec is critical to prevent this.

### 3. No client-side deduplication for items
The spec explicitly states that order item views should NOT have client-side deduplication. Each expand action should fire a tracking call, relying on the server's upsert to handle deduplication.

### 4. Silent failure requirement
Both tracking implementations must use try/catch with console.warn for errors. Tracking failures must never surface to users or prevent normal functionality.

### 5. Customer vs non-customer users
The API endpoints already handle the user type check and return `{ skipped: true }` for non-customers. The frontend doesn't need to check user type before making the calls.

---

## Implementation Notes

### Order View Tracking Pattern (page.tsx)
```typescript
// Add after imports (around line 19)
import React, { useState, useEffect, useRef } from 'react';

// Add after state declarations (around line 105)
const trackedOrderIdRef = useRef<string | null>(null);

// Add new useEffect after fetchOrderDetails definition (around line 157)
useEffect(() => {
  if (!order || !orderId) return;
  if (trackedOrderIdRef.current === orderId) return;
  trackedOrderIdRef.current = orderId;

  fetch(`/api/orders/${orderId}/view`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }).catch((err) => {
    console.warn('Order view tracking failed:', err);
  });
}, [order, orderId]);
```

### Order Item View Tracking Pattern (ServiceFulfillmentTable.tsx)
```typescript
// Modify toggleRowExpansion function (line 459)
const toggleRowExpansion = (serviceId: string) => {
  const newExpanded = new Set(expandedRows);
  if (newExpanded.has(serviceId)) {
    newExpanded.delete(serviceId);
    // NO tracking call on collapse
  } else {
    newExpanded.add(serviceId);
    // Add tracking call here
    const service = services.find(s => s.id === serviceId);
    if (service && service.orderItemId) {
      fetch(`/api/order-items/${service.orderItemId}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }).catch((err) => {
        console.warn('Order item view tracking failed:', err);
      });
    }
  }
  setExpandedRows(newExpanded);
};
```

---

## Confirmation
This technical plan is ready for the test-writer agent to proceed with creating tests for the Phase 2C implementation.
