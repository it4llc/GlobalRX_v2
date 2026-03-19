# Order Creation API Documentation

## Overview

The Order Creation API provides endpoints for creating new orders and adding items to existing orders. This API automatically creates ServicesFulfillment records for every OrderItem to ensure data integrity and prevent fulfillment system bugs.

## Auto-Creation of ServicesFulfillment Records

**BUSINESS REQUIREMENT:** Every OrderItem must have exactly one ServicesFulfillment record created in the same database transaction. This 1:1 relationship is enforced at the database level and prevents the cascading ID mismatch bugs that occur when ServicesFulfillment records are created separately or delayed.

### Why Auto-Creation is Critical

1. **Data Integrity:** Prevents orphaned OrderItems that cause display issues in fulfillment views
2. **Bug Prevention:** Eliminates ID mismatch bugs where OrderItems exist without corresponding ServicesFulfillment records
3. **Atomicity:** Transaction rollback ensures either both records are created or neither is created
4. **Consistency:** Every OrderItem immediately has fulfillment tracking available

## POST /api/portal/orders

Creates a complete order with multiple service items.

### Authentication
**Required:** Yes - Valid session with customer access

### Permissions Required
- **Customer Users:** Must be creating order for their own customer account
- **Internal Users:** Can create orders for any customer with proper permissions

### Request Body

```typescript
{
  customerId: string;
  userId: string;
  serviceItems: Array<{
    serviceId: string;
    serviceName: string;
    locationId: string;
    locationName: string;
    itemId: string;
  }>;
  subject: {
    firstName: string;
    lastName: string;
    email?: string;
    // ... other subject fields
  };
  subjectFieldValues?: Record<string, any>;
  searchFieldValues?: Record<string, Record<string, any>>;
  uploadedDocuments?: Record<string, any>;
  notes?: string;
  status?: 'draft' | 'submitted';
}
```

### Response

```typescript
{
  success: true;
  order: {
    id: string;
    orderNumber: string;
    customerId: string;
    userId: string;
    statusCode: string;
    subject: object;
    notes?: string;
    assignedVendorId?: string;
    createdAt: string;
    updatedAt: string;
    customer: {
      id: string;
      name: string;
    };
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
    validationResult?: {
      isValid: boolean;
      missingRequirements: string[];
    };
  };
}
```

### ServicesFulfillment Auto-Creation

For each service item in the request:
1. An OrderItem record is created
2. A ServicesFulfillment record is immediately created with:
   - `orderId`: Matches the order ID
   - `orderItemId`: Matches the OrderItem ID
   - `serviceId`: Matches the service ID
   - `locationId`: Matches the location ID
   - `assignedVendorId`: null (explicitly not inherited from order)

### Business Rules

1. **Vendor Assignment Independence:** ServicesFulfillment.assignedVendorId is explicitly null, not inherited from Order.assignedVendorId. This allows each service to have its own vendor assignment independent of the order-level vendor.

2. **Transaction Integrity:** Both OrderItem and ServicesFulfillment creation happen in the same database transaction. If either fails, both are rolled back.

3. **Immediate Availability:** ServicesFulfillment records are immediately available for fulfillment workflows without additional processing.

### Error Scenarios

| Error | Status Code | Description |
|-------|-------------|-------------|
| Unauthorized | 401 | User not authenticated |
| Forbidden | 403 | User lacks permission for this customer |
| Invalid Customer | 400 | Customer ID does not exist |
| Invalid Service | 400 | Service ID does not exist |
| Invalid Location | 400 | Location ID does not exist |
| Database Error | 500 | Transaction rollback occurred |

### Example Request

```http
POST /api/portal/orders
Content-Type: application/json
Authorization: Bearer {session-token}

{
  "customerId": "customer-123",
  "userId": "user-456",
  "serviceItems": [
    {
      "serviceId": "service-789",
      "serviceName": "Background Check",
      "locationId": "location-101",
      "locationName": "California",
      "itemId": "item-1"
    }
  ],
  "subject": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com"
  },
  "status": "draft"
}
```

### Example Response

```json
{
  "success": true,
  "order": {
    "id": "order-abc123",
    "orderNumber": "20250319-XK7-0001",
    "customerId": "customer-123",
    "userId": "user-456",
    "statusCode": "draft",
    "subject": {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com"
    },
    "assignedVendorId": "primary-vendor-xyz",
    "createdAt": "2026-03-19T15:30:00.000Z",
    "updatedAt": "2026-03-19T15:30:00.000Z",
    "customer": {
      "id": "customer-123",
      "name": "Acme Corporation"
    },
    "user": {
      "id": "user-456",
      "email": "user@acme.com",
      "firstName": "Jane",
      "lastName": "Smith"
    }
  }
}
```

## POST /api/portal/orders/[id]/items

Adds a new item to an existing draft order.

### Authentication
**Required:** Yes - Valid session with customer access

### Permissions Required
- **Customer Users:** Must own the order being modified
- **Internal Users:** Can modify any order with proper permissions

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | The order ID |

### Request Body

```typescript
{
  serviceId: string;
  locationId: string;
  price?: number;
}
```

### Response

```typescript
{
  success: true;
  orderItem: {
    id: string;
    orderId: string;
    serviceId: string;
    locationId: string;
    status: string;
    price?: number;
    createdAt: string;
    updatedAt: string;
    service: {
      id: string;
      name: string;
      category: string;
    };
    location: {
      id: string;
      name: string;
      code2: string;
    };
  };
}
```

### ServicesFulfillment Auto-Creation

When a new OrderItem is added:
1. The OrderItem record is created
2. A ServicesFulfillment record is immediately created in the same transaction
3. Both operations are atomic - if either fails, both are rolled back

### Business Rules

1. **Order Status Validation:** Can only add items to orders in 'draft' status
2. **Duplicate Prevention:** Cannot add the same service+location combination to an order
3. **Vendor Assignment Independence:** New ServicesFulfillment record has null assignedVendorId
4. **Transaction Safety:** Both creates happen atomically

### Error Scenarios

| Error | Status Code | Description |
|-------|-------------|-------------|
| Order Not Found | 404 | Order doesn't exist or user lacks access |
| Order Not Editable | 400 | Order status is not 'draft' |
| Duplicate Item | 409 | Service+location combination already exists |
| Invalid Service | 400 | Service ID does not exist |
| Invalid Location | 400 | Location ID does not exist |

## Implementation Details

### Database Transaction Pattern

All order creation operations use this transaction pattern:

```typescript
return prisma.$transaction(async (tx) => {
  // 1. Create OrderItem
  const orderItem = await tx.orderItem.create({
    data: { /* OrderItem data */ }
  });

  // 2. Immediately create ServicesFulfillment
  await tx.servicesFulfillment.create({
    data: {
      orderId: order.id,
      orderItemId: orderItem.id,
      serviceId: item.serviceId,
      locationId: item.locationId,
      assignedVendorId: null, // Explicit business rule
    },
  });

  return orderItem;
});
```

### Logging

All ServicesFulfillment auto-creation is logged at INFO level:

```typescript
logger.info('ServiceFulfillment auto-created for OrderItem', {
  orderId: order.id,
  orderItemId: orderItem.id,
  serviceId: item.serviceId,
  locationId: item.locationId,
});
```

### Impact on Other Systems

1. **Fulfillment Module:** Immediately sees ServicesFulfillment records for all new OrderItems
2. **Vendor Assignment:** Can assign vendors to services immediately after order creation
3. **Comments System:** Can attach comments to services without ID mismatch issues
4. **Status Tracking:** Service-level status tracking available immediately

## Migration and Backward Compatibility

### Phase 1 (Current): Auto-Creation for New Orders
- All new OrderItems automatically get ServicesFulfillment records
- Existing OrderItems without ServicesFulfillment records remain unchanged
- No breaking changes to existing functionality

### Phase 2 (Future): Backfill Existing Records
- One-time migration to create ServicesFulfillment records for existing OrderItems
- Idempotent migration safe to run multiple times
- Batch processing to handle large datasets

This auto-creation feature resolves the cascading ID mismatch bugs that previously occurred in the fulfillment module and ensures data consistency across the platform.