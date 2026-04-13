# Order View Tracking Phase 2C - UI Wiring Specification

## Summary

Phase 2C wires the existing Phase 2A view-tracking API endpoints into the frontend. When customers view orders and order items, the frontend silently records these views by calling the tracking endpoints. This phase focuses exclusively on recording views — it does not display any visual indicators.

## Who Uses This

- **Customers**: Their order and order item views are recorded when they navigate the order details page
- **Admin/Vendor users**: The frontend calls the same endpoints, but the server silently skips recording for these user types
- **Support staff**: Will use the recorded view data in Phase 2D to see which orders/items customers have viewed

## Business Rules

### Order View Recording
1. **Single call per mount**: POST `/api/orders/[id]/view` fires exactly once per orderId per page mount
2. **Ref-based deduplication**: Uses a `useRef` to track which orderId has been recorded, preventing duplicate calls when the order object reference changes
3. **Silent failure**: Tracking errors are logged to console but never shown to users

### Order Item View Recording
1. **Expand-only trigger**: POST `/api/order-items/[id]/view` fires only when expanding a row, never when collapsing
2. **No client-side deduplication**: Each expand action fires a call, even for the same item (server handles deduplication via upsert)
3. **Silent failure**: Tracking errors are logged to console but never shown to users

## User Flow

### Order View Flow
1. User navigates to `/fulfillment/orders/[orderId]`
2. Page loads and fetches order data
3. Once order data loads, a useEffect fires the view tracking call
4. The ref guard ensures this only happens once per orderId per mount
5. If tracking fails, a warning is logged but the page functions normally

### Order Item View Flow
1. User is on the order details page viewing the ServiceFulfillmentTable
2. User clicks the expand chevron (▶) next to a service row
3. The `toggleRowExpansion` function adds the serviceId to expandedRows
4. In the same function, POST `/api/order-items/[orderItemId]/view` is fired
5. The row expands to show requirements, results, and comments
6. If tracking fails, a warning is logged but the row expands normally
7. When user collapses the row, no tracking call is made

## Technical Implementation

### Files to Modify

1. **src/app/fulfillment/orders/[id]/page.tsx**
   - Add new useEffect for order view tracking
   - Add useRef to track recorded orderIds

2. **src/components/fulfillment/ServiceFulfillmentTable.tsx**
   - Modify `toggleRowExpansion` function at line 459
   - Add tracking call in the expand branch only

### Required Patterns

#### Order View Tracking Pattern
```typescript
const trackedOrderIdRef = useRef<string | null>(null);

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

**Why this pattern is required**: A simple dependency on `[order, orderId]` would re-fire every time the order object reference changes (such as when `fetchOrderDetails` updates state), which would spam the endpoint. The ref pattern ensures the call fires exactly once per orderId per mount and is immune to object identity changes.

#### Order Item View Tracking Pattern
Inside `toggleRowExpansion` at line 459, in the else branch where item is added to expandedRows:
```typescript
const toggleRowExpansion = (serviceId: string) => {
  const newExpanded = new Set(expandedRows);
  if (newExpanded.has(serviceId)) {
    newExpanded.delete(serviceId);
    // NO tracking call on collapse
  } else {
    newExpanded.add(serviceId);
    // Add tracking call here for the orderItemId
    fetch(`/api/order-items/${orderItemId}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).catch((err) => {
      console.warn('Order item view tracking failed:', err);
    });
  }
  setExpandedRows(newExpanded);
};
```

### API Call Requirements
- Use plain `fetch()` with method POST and Content-Type application/json
- Do NOT use `api-client.ts` (it exists but is unused in the codebase)
- All tracking calls must be wrapped in try/catch
- Errors are caught and logged with `console.warn`
- Errors must NEVER surface to the user
- Errors must NEVER prevent page rendering or row expansion

## Data Requirements

### Order View Tracking
- **Endpoint**: POST `/api/orders/[id]/view`
- **Request body**: Empty (endpoint uses session for user identification)
- **Response**: Success status or error (ignored by frontend)

### Order Item View Tracking
- **Endpoint**: POST `/api/order-items/[id]/view`
- **Request body**: Empty (endpoint uses session for user identification)
- **Response**: Success status or error (ignored by frontend)

## Edge Cases

1. **Tracking endpoint returns 500**
   - Page and row expansion continue working normally
   - Warning logged to console

2. **Network failure during tracking call**
   - Page and row expansion continue working normally
   - Warning logged to console

3. **User rapidly expands and collapses the same row**
   - Each expand fires a tracking call
   - Each collapse does nothing
   - Server handles deduplication via upsert

4. **User opens same order in two browser tabs**
   - Each tab fires one order view call on mount
   - This is correct behavior — last write wins at the server

5. **User navigates away and returns to same order**
   - Fresh mount means fresh ref
   - Tracking call fires again
   - This is correct behavior

6. **Order data refreshes after status change**
   - The ref guard prevents duplicate tracking calls
   - Only the initial load triggers tracking

## Out of Scope

The following items are explicitly NOT part of Phase 2C:

1. **Visual indicators** (red dots, badges, "new" labels, highlights) — deferred to Phase 2D
2. **Customer portal changes** — no modifications to `/portal/orders/` page
3. **API endpoint changes** — Phase 2A endpoints are used as-is
4. **Database schema changes** — no new fields or tables
5. **Client-side user type checks** — server already handles admin/vendor silent-skip
6. **Rate limiting** — tracked as TD-022, not included in this phase
7. **ServiceFulfillmentTable refactoring** — only add tracking call to existing function
8. **Migration to api-client.ts** — continue using plain fetch as per existing patterns

## Impact

### Performance
- Minimal: Two lightweight POST requests per order page visit
- Async calls don't block UI rendering
- No impact on page load time

### User Experience
- Completely transparent to users
- No visible changes
- No error messages even if tracking fails

### System
- Populates OrderView and OrderItemView tables for Phase 2D
- Enables "new" indicator feature in next phase

## Definition of Done

1. ✅ Order details page fires POST `/api/orders/[id]/view` exactly once per orderId per page mount
2. ✅ Expanding a row in ServiceFulfillmentTable fires POST `/api/order-items/[id]/view` for that item's id
3. ✅ Collapsing a row does not fire any tracking call
4. ✅ Both tracking calls fail silently with console.warn on error
5. ✅ Tracking failures never block page rendering or row expansion
6. ✅ No inline styles are introduced
7. ✅ No new dependencies or libraries are added
8. ✅ Unit tests cover:
   - Successful order view call on mount
   - Successful item view call on expand
   - Silent failure handling for both endpoints
   - No call on collapse
   - No duplicate calls on order state refresh
9. ✅ This spec file exists at `docs/specs/order-view-tracking-phase-2c.md`

## Open Questions

All open questions from planning have been resolved:

1. **Q: What pattern for "run once on page load"?**
   A: Use useEffect with ref guard pattern as specified above

2. **Q: Shared API client or plain fetch?**
   A: Use plain fetch following existing patterns

3. **Q: Where is expand state managed?**
   A: Inside ServiceFulfillmentTable using useState

4. **Q: Risk of refetch causing duplicate calls?**
   A: Mitigated by ref guard pattern

## Notes

- Phase 2A already built and tested the API endpoints
- Phase 2B added the lastActivityAt fields and backend tracking logic
- Phase 2C (this phase) only adds frontend calls to existing endpoints
- Phase 2D will add visual indicators using the tracked view data