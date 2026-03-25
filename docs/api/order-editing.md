# Order Editing API Documentation

## Overview

The Order Editing API provides functionality for retrieving and updating draft orders. This API handles complex address block field persistence, ensuring that structured data like addresses maintain their object structure when saved and restored.

## Address Block Persistence

**CRITICAL FEATURE:** Address block fields (like "Current Address" or "Residence Address") are stored as JSON strings in the database but must be parsed back to objects when loading draft orders.

### Address Block Data Flow

1. **User Input:** Address blocks entered as objects `{street1: "123 Main", city: "Boston"}`
2. **Storage:** Saved as JSON strings in `order_data.fieldValue`
3. **Retrieval:** JSON strings parsed back to objects for form display
4. **Types:** Both search-level and subject-level address blocks supported

### Why This Matters

Address blocks contain multiple fields (street1, city, state, postalCode) that must remain as separate properties for the `AddressBlockInput` component to display them correctly. Without proper parsing, users see JSON strings instead of editable address fields.

## GET /api/portal/orders/[id]

Retrieves a specific order by ID for viewing or editing.

### Authentication
**Required:** Yes - Valid session with customer access

### Permissions Required
- **Customer Users:** Must own the order being retrieved
- **Internal Users:** Can access any order with proper permissions

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | The order ID |

### Response

```typescript
{
  id: string;
  statusCode: string;
  orderNumber?: string;
  customerId: string;
  userId: string;
  assignedVendorId?: string;
  subject: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
  items: Array<{
    id: string;
    service: {
      id: string;
      name: string;
      category?: string;
    };
    location: {
      id: string;
      name: string;
    };
    data?: Array<{
      fieldName: string;
      fieldValue: string; // May be JSON string for address blocks
      fieldType?: 'search' | 'subject';
    }>;
  }>;
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
}
```

### Error Scenarios

| Error | Status Code | Description |
|-------|-------------|-------------|
| Unauthorized | 401 | User not authenticated |
| Order Not Found | 404 | Order doesn't exist or user lacks access |
| Server Error | 500 | Database error during retrieval |

## PUT /api/portal/orders/[id]

Updates a draft order with service items, subject information, and field values.

### Authentication
**Required:** Yes - Valid session with customer access

### Permissions Required
- **Customer Users:** Must own the order being updated
- **Internal Users:** Can update any order with proper permissions

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | The order ID |

### Request Body

```typescript
{
  serviceItems?: Array<{
    serviceId: string;
    serviceName: string;
    locationId: string;
    locationName: string;
    itemId: string; // Temporary client-side ID for field mapping
  }>;
  subject?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    dateOfBirth?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  subjectFieldValues?: Record<string, any>; // Subject fields by field UUID
  searchFieldValues?: Record<string, Record<string, any>>; // Search fields by itemId then field UUID
  uploadedDocuments?: Record<string, File>;
  notes?: string;
  status?: 'draft' | 'submitted';
}
```

### Address Block Field Handling

#### Subject-Level Address Blocks
Subject fields like "Residence Address" are stored in the `order_data` table with `fieldType: 'subject'`:

```typescript
// Example subject field value
subjectFieldValues: {
  "field-uuid-123": {
    street1: "123 Main Street",
    street2: "Apt 4B",
    city: "Boston",
    state: "MA",
    postalCode: "02134",
    country: "USA"
  }
}
```

#### Search-Level Address Blocks
Search fields like "School Address" are stored per service item:

```typescript
// Example search field values
searchFieldValues: {
  "service-location-item-id": {
    "field-uuid-456": {
      street1: "456 University Ave",
      city: "Cambridge",
      state: "MA",
      postalCode: "02138"
    }
  }
}
```

### Response

```typescript
{
  id: string;
  statusCode: string;
  // ... other order fields
}
```

### Business Rules

1. **Draft Only:** Only orders with `statusCode: 'draft'` can be edited
2. **Complete Replacement:** Updates replace all existing service items and field values
3. **Address Block Persistence:** Empty/null values preserved for optional address blocks
4. **JSON Storage:** Address blocks stored as JSON strings, parsed on retrieval
5. **Field Type Separation:** Subject fields stored with `fieldType: 'subject'`, search fields with `fieldType: 'search'`

### Error Scenarios

| Error | Status Code | Description |
|-------|-------------|-------------|
| Unauthorized | 401 | User not authenticated |
| Order Not Found | 404 | Order doesn't exist, not owned, or not draft |
| Invalid Data | 400 | Request body validation failed |
| Server Error | 500 | Database error during update |

## DELETE /api/portal/orders/[id]

Deletes a draft order and all associated data.

### Authentication
**Required:** Yes - Valid session with customer access

### Permissions Required
- **Customer Users:** Must own the order being deleted
- **Internal Users:** Can delete any order with proper permissions

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | The order ID |

### Response

```typescript
{
  message: string; // "Order deleted successfully"
}
```

### Business Rules

1. **Draft Only:** Only orders with `statusCode: 'draft'` can be deleted
2. **Cascade Delete:** Deletes order items, order data, and fulfillment records
3. **Transaction Safety:** All deletions happen atomically

### Error Scenarios

| Error | Status Code | Description |
|-------|-------------|-------------|
| Unauthorized | 401 | User not authenticated |
| Order Not Found | 404 | Order doesn't exist, not owned, or not draft |
| Server Error | 500 | Database error during deletion |

## Implementation Details

### Address Block Bug Fix

The critical bug fix implemented in March 2026 addresses address block field persistence:

#### Problem
- Address blocks stored as JSON strings: `'{"street1":"123 Main","city":"Boston"}'`
- Frontend expected objects: `{street1:"123 Main",city:"Boston"}`
- Without parsing, users saw JSON strings instead of editable fields

#### Solution
1. **Storage:** Continue storing as JSON strings for database efficiency
2. **Parsing:** Parse JSON strings back to objects when loading for editing
3. **Graceful Handling:** If parsing fails, keep original value
4. **Type Detection:** Only parse strings that look like JSON objects

#### Code Pattern
```typescript
if (field.dataType === 'address_block') {
  if (typeof fieldValue === 'string' &&
      fieldValue.startsWith('{') &&
      fieldValue.endsWith('}')) {
    try {
      processedValue = JSON.parse(fieldValue);
    } catch {
      processedValue = fieldValue; // Keep original on parse failure
    }
  }
}
```

### Database Schema

Address block data is stored in the `order_data` table:

```sql
CREATE TABLE order_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  field_name TEXT NOT NULL,
  field_value TEXT, -- JSON string for address blocks
  field_type TEXT, -- 'search' or 'subject'
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Transaction Pattern

All order updates use atomic transactions:

```typescript
await prisma.$transaction(async (tx) => {
  // 1. Verify order is draft and owned by user
  // 2. Delete existing order items and data
  // 3. Create new order items
  // 4. Save field values with proper JSON encoding
  // 5. Update order record
});
```

## Frontend Integration

The order editing functionality integrates with the `useOrderFormState` hook:

1. **Loading:** `loadOrderForEdit()` fetches order and parses address blocks
2. **Temporary Storage:** Uses sessionStorage during field mapping process
3. **Field Mapping:** Maps field names to field UUIDs after requirements load
4. **Parsing:** Converts JSON strings back to objects for form display

## Testing

Comprehensive regression tests ensure address block persistence:

- **Search-level blocks:** Verifies parsing of service-specific address fields
- **Subject-level blocks:** Verifies parsing of order-wide address fields
- **Mixed scenarios:** Tests orders with multiple address block types
- **Error handling:** Tests malformed JSON graceful degradation
- **Edge cases:** Tests null, empty, and invalid values

Test files:
- `useOrderFormState.address-block-bug.test.ts` - Primary regression test
- `useOrderFormState.subject-address-block.test.ts` - Subject field focus

This API ensures that address block fields maintain their structure and usability throughout the order creation, editing, and persistence workflow.