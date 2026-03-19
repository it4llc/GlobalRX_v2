# Feature Specification: Auto-Create ServiceFulfillment Records
**Spec file:** `docs/specs/auto-create-servicefulfillment.md`
**Date:** 2026-03-19
**Requested by:** Andy
**Status:** Confirmed

## Summary
Automatically create a ServiceFulfillment record whenever an OrderItem is created, establishing the 1:1 relationship between OrderItem and ServiceFulfillment within the same database transaction. This ensures every OrderItem has a corresponding ServiceFulfillment record for tracking vendor assignments and fulfillment status.

## Who Uses This
- **System** - Automatically creates ServiceFulfillment records when OrderItems are created
- **Internal Admin Users** - Will see ServiceFulfillment records already existing for all new OrderItems
- **Fulfillment Users** - Can immediately assign vendors and track fulfillment for any OrderItem

## Business Requirements

### Core Requirement
Every OrderItem must have exactly one ServiceFulfillment record. This relationship is enforced at the database level through a unique constraint on `orderItemId` in the ServicesFulfillment table. The auto-creation ensures this relationship is established immediately when an OrderItem is created, preventing orphaned OrderItems.

### Implementation Scope
- **Phase 1 (This spec)**: Auto-create ServiceFulfillment for all new OrderItems going forward
- **Phase 2 (Future)**: Backfill existing OrderItems that don't have ServiceFulfillment records

## Technical Requirements

### Transaction Integrity
- ServiceFulfillment creation must occur within the same database transaction as OrderItem creation
- If ServiceFulfillment creation fails, the entire OrderItem creation must be rolled back
- This ensures data consistency and prevents orphaned records

### Methods to Update
1. **OrderCoreService.createCompleteOrder()** - When creating orders with items
2. **OrderCoreService.addOrderItem()** - When adding individual items to existing orders

### Error Handling
- Use try-catch within the transaction to handle any database errors
- Log errors with structured logging (no PII)
- Return meaningful error messages to the API layer

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Order ID | orderId | text | Required | Must match parent OrderItem's orderId | From OrderItem |
| Order Item ID | orderItemId | text | Required | Must be unique, matches OrderItem.id | From OrderItem |
| Service ID | serviceId | text | Required | Must match OrderItem's serviceId | From OrderItem |
| Location ID | locationId | text | Required | Must match OrderItem's locationId | From OrderItem |
| Assigned Vendor | assignedVendorId | text | Optional | Valid vendor ID or null | null |
| Vendor Notes | vendorNotes | text | Optional | Max 1000 characters | null |
| Internal Notes | internalNotes | text | Optional | Max 1000 characters | null |
| Assigned At | assignedAt | datetime | Optional | Valid datetime or null | null |
| Assigned By | assignedBy | text | Optional | Valid user ID or null | null |
| Completed At | completedAt | datetime | Optional | Valid datetime or null | null |
| Created At | createdAt | datetime | Required | Auto-set by Prisma | now() |
| Updated At | updatedAt | datetime | Required | Auto-updated by Prisma | now() |
| Results | results | text | Optional | Unlimited text | null |
| Results Added By | resultsAddedBy | text | Optional | Valid user ID or null | null |
| Results Added At | resultsAddedAt | datetime | Optional | Valid datetime or null | null |
| Results Last Modified By | resultsLastModifiedBy | text | Optional | Valid user ID or null | null |
| Results Last Modified At | resultsLastModifiedAt | datetime | Optional | Valid datetime or null | null |

## Business Rules

1. A ServiceFulfillment record must be created for every OrderItem, no exceptions
2. The ServiceFulfillment is created with minimal data - only required fields from the OrderItem
3. All optional fields start as null and are populated later through the fulfillment workflow
4. The `assignedVendorId` field is explicitly set to null (not inherited from Order's assignedVendorId)
5. The creation happens atomically - either both OrderItem and ServiceFulfillment are created, or neither
6. No special user permissions are required for the auto-creation (it's a system action)
7. The auto-creation is logged for debugging but requires no special monitoring or metrics

## User Flow

### When Creating a Complete Order
1. User submits order creation through the portal
2. System creates the Order record
3. For each service+location combination:
   - System creates an OrderItem record
   - System immediately creates a corresponding ServiceFulfillment record with matching IDs
   - Both creations happen in the same transaction
4. User sees the order created successfully
5. Admin users can immediately see the ServiceFulfillment records in the fulfillment module

### When Adding an Item to Existing Order
1. User adds a new service to an existing draft order
2. System creates the OrderItem record
3. System immediately creates a corresponding ServiceFulfillment record
4. Both creations happen in the same transaction
5. The new item appears in the order with its fulfillment record ready

## Implementation Notes

### Code Location
- Primary implementation: `/src/lib/services/order-core.service.ts`
- Methods to modify:
  - `createCompleteOrder()` - After line 284 where OrderItem is created
  - `addOrderItem()` - After the OrderItem.create() call

### Sample Implementation Pattern
```typescript
// Inside the transaction, after creating OrderItem:
const orderItem = await tx.orderItem.create({
  data: {
    orderId: order.id,
    serviceId: serviceItem.serviceId,
    locationId: serviceItem.locationId,
    status: 'pending',
  },
});

// Immediately create the ServiceFulfillment
await tx.servicesFulfillment.create({
  data: {
    orderId: order.id,
    orderItemId: orderItem.id,
    serviceId: serviceItem.serviceId,
    locationId: serviceItem.locationId,
    assignedVendorId: null, // Explicitly null, not inherited
  },
});
```

### Logging
- Log the auto-creation at INFO level for debugging
- Include orderId, orderItemId, serviceId, locationId in the log
- Do not log any PII (no customer names, emails, etc.)

## Edge Cases and Error Scenarios

1. **Database connection failure during transaction**
   - Entire transaction rolls back
   - Neither OrderItem nor ServiceFulfillment is created
   - Error is logged and returned to user

2. **Duplicate orderItemId constraint violation**
   - Should never happen due to UUID generation
   - If it does, transaction rolls back
   - Error logged with details for investigation

3. **Invalid serviceId or locationId**
   - Foreign key constraint will fail
   - Transaction rolls back
   - User sees error about invalid service/location

4. **Order is not in draft status (for addOrderItem)**
   - Validation happens before creation attempt
   - No ServiceFulfillment is created since no OrderItem is created
   - User sees appropriate error message

## Success Criteria

1. Every new OrderItem has a corresponding ServiceFulfillment record
2. The ServiceFulfillment has matching orderId, serviceId, and locationId
3. The orderItemId in ServiceFulfillment equals the OrderItem's id
4. All nullable fields in ServiceFulfillment start as null
5. Creation failures roll back both OrderItem and ServiceFulfillment
6. Existing functionality is not broken
7. Performance impact is minimal (single additional INSERT per OrderItem)

## Phase 2: Backfill Migration for Existing OrderItems

### Overview
After Phase 1 is deployed and verified, Phase 2 will create ServicesFulfillment records for all existing OrderItems that don't have one. This is a one-time data migration that must be idempotent and safe to run on production data.

### Migration Requirements

1. **Idempotent Execution**
   - Script must be safe to run multiple times without creating duplicates
   - Check for existing ServicesFulfillment before creating new ones
   - Use the unique constraint on orderItemId as a safeguard

2. **Batch Processing**
   - Process OrderItems in batches to avoid memory issues
   - Suggested batch size: 100-500 records at a time
   - Include progress logging after each batch

3. **Transaction Safety**
   - Each batch should be wrapped in a transaction
   - If any record in a batch fails, roll back that batch only
   - Continue processing remaining batches

4. **Data to Populate**
   - orderId: From the OrderItem's orderId
   - orderItemId: The OrderItem's id
   - serviceId: From the OrderItem's serviceId
   - locationId: From the OrderItem's locationId
   - assignedVendorId: null (no auto-assignment)
   - All other nullable fields: null

### Migration Script Location
Create as a Prisma migration file following project standards:
- Location: `prisma/migrations/[timestamp]_backfill_services_fulfillment/migration.sql`
- Use raw SQL for better control and performance
- Include rollback safety (though this migration cannot be rolled back)

### Sample Migration Pattern
```sql
-- Find OrderItems without ServicesFulfillment and create them
INSERT INTO "ServicesFulfillment" (
  "id",
  "orderId",
  "orderItemId",
  "serviceId",
  "locationId",
  "assignedVendorId",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  oi."orderId",
  oi."id",
  oi."serviceId",
  oi."locationId",
  NULL,
  NOW(),
  NOW()
FROM "OrderItem" oi
LEFT JOIN "ServicesFulfillment" sf ON sf."orderItemId" = oi."id"
WHERE sf."id" IS NULL
ON CONFLICT ("orderItemId") DO NOTHING;
```

### Migration Success Criteria
1. Every OrderItem in the database has exactly one ServicesFulfillment record
2. No duplicate ServicesFulfillment records are created
3. Migration can be run multiple times safely
4. Performance impact on production is minimal
5. Progress is logged for monitoring

### Migration Testing
1. Test on a copy of production data first
2. Verify count of OrderItems matches count of ServicesFulfillment records
3. Run migration twice to ensure idempotency
4. Check for any orphaned records

## Out of Scope

1. **Modifying existing ServiceFulfillment records** - Only creation is in scope
2. **Vendor auto-assignment logic** - ServiceFulfillment starts with null vendor
3. **Email notifications** - No emails are sent for auto-creation
4. **UI changes** - The UI already expects ServiceFulfillment to exist
5. **Special monitoring or metrics** - Standard logging only
6. **Modifying the delete flow** - Cascade delete already handles cleanup

## Impact on Other Modules

- **Fulfillment Module**: Will immediately see ServiceFulfillment records for all new OrderItems
- **Order Details Page**: No change, already expects ServiceFulfillment to exist
- **Vendor Assignment**: Can immediately assign vendors to new OrderItems
- **Reporting**: New OrderItems will appear in fulfillment reports immediately

## Definition of Done

1. ServiceFulfillment record is created for every new OrderItem in createCompleteOrder()
2. ServiceFulfillment record is created for every new OrderItem in addOrderItem()
3. All creations happen within the same database transaction
4. Transaction rollback works correctly on failure
5. Structured logging is in place for debugging
6. All existing tests still pass
7. New tests verify the auto-creation behavior
8. Manual testing confirms ServiceFulfillment records are created
9. No performance degradation observed

## Open Questions

None - all requirements have been clarified and confirmed.