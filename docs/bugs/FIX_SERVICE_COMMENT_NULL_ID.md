# Bug Fix: Service Comment NULL ServiceId Error

**Date Fixed:** March 10, 2026
**Severity:** High - Prevented users from creating comments in order details view

## The Bug

When viewing order details and attempting to add a comment to a service, users encountered:
```
Failed to load resource: the server responded with a status of 404 (Not Found)
POST http://localhost:3001/api/services/null/comments 404
```

## Root Cause

There was a mismatch between ID types:
1. The API endpoint `/api/services/[id]/comments` expects a **ServiceFulfillment ID**
2. The frontend was passing an **OrderItem ID**
3. When in order mode, the hook was setting serviceId to `null`, but CRUD operations still needed a valid ID

## The Fix

### Files Modified:
1. **`/src/hooks/useServiceComments.ts`**
   - Modified `createComment`, `updateComment`, and `deleteComment` to accept serviceId as a parameter
   - Added logic to update the correct state (`commentsByService` vs `comments`) based on mode

2. **`/src/components/services/ServiceCommentSection.tsx`**
   - Updated to pass the correct ID type for API calls:
     - In order mode: uses `serviceFulfillmentId` for API calls
     - In single service mode: uses `serviceId` directly

## Key Code Changes:

### Before (broken):
```typescript
// ServiceCommentSection.tsx
await createComment({ ...data, serviceId }); // This was OrderItem ID
```

### After (fixed):
```typescript
// ServiceCommentSection.tsx
const apiServiceId = orderId && serviceFulfillmentId ? serviceFulfillmentId : serviceId;
await createComment({ ...data, serviceId: apiServiceId }); // Now uses correct ID type
```

## ID Mapping Explanation

The application uses two different IDs:
- **OrderItem ID**: Used for storing comments in the database (`comments.orderItemId`)
- **ServiceFulfillment ID**: Used as the API route parameter and for grouping comments by service

The API handles the mapping:
1. Receives ServiceFulfillment ID in URL
2. Looks up the associated OrderItem ID
3. Creates/updates/deletes the comment using OrderItem ID

## Testing the Fix

To verify the fix works:
1. Navigate to Order Details view
2. Expand a service to see comments
3. Click "Add Comment"
4. Enter comment text and save
5. Comment should appear immediately without page refresh

## Prevention

To prevent similar issues:
- Always verify what ID type an API expects
- Document ID usage clearly in component props
- Add integration tests that verify actual API calls with correct parameters
- Use TypeScript to enforce correct ID types where possible