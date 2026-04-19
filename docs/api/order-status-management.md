# Order Status Management API Documentation

## Overview

The Order Status Management feature allows internal GlobalRx users to change order statuses through a dropdown interface and automatically progresses orders when all services are submitted. This implements standardized status values and comprehensive audit trails.

## API Endpoints

### PATCH /api/fulfillment/orders/[id]/status

Updates an order's status and creates an audit trail entry.

#### Authentication
**Required:** Yes - Valid session with fulfillment permissions

#### Permissions Required
- **Required Permission:** `fulfillment.*` or `admin.*`
- **User Type:** Internal users only (vendors and customers cannot change order status)

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Order ID to update |

#### Request Body

```typescript
{
  status: 'draft' | 'submitted' | 'processing' | 'missing_info' | 'completed' | 'cancelled' | 'cancelled_dnb',
  notes?: string,        // Optional context for the status change
  comments?: string      // Required for 'closed' status (legacy support)
}
```

#### Status Values

The API supports seven standardized status values that match service statuses:

- **draft** - Initial state, order being prepared
- **submitted** - Order ready for processing
- **processing** - Order being fulfilled
- **missing_info** - Additional information needed
- **completed** - Order fulfillment finished
- **cancelled** - Order cancelled by customer/admin
- **cancelled_dnb** - Order cancelled due to do not bill

#### Business Rules

1. **No Transition Restrictions:** Any status can change to any other status (Phase 2a design)
2. **Audit Trail:** All changes create OrderStatusHistory entries with user and timestamp
3. **User Context:** Changes are attributed to the authenticated user
4. **Same Status:** Selecting the same status returns success without creating duplicate history
5. **Order Closure:** Special handling for 'closed' status requires all services to be complete

#### Request Examples

```http
PATCH /api/fulfillment/orders/123e4567-e89b-12d3-a456-426614174000/status
Content-Type: application/json
Authorization: Bearer {session-token}

{
  "status": "processing",
  "notes": "All documents received, beginning verification"
}
```

#### Response Format

```typescript
{
  id: string,
  orderNumber: string,
  statusCode: string,
  customerId: string,
  customer: {
    id: string,
    name: string
  },
  items: Array<{
    id: string,
    serviceId: string,
    locationId: string,
    status: string
  }>,
  message: string
}
```

#### Status Codes

- **200 OK:** Status updated successfully
- **400 Bad Request:** Invalid status value or missing required fields
- **401 Unauthorized:** Missing or invalid authentication
- **403 Forbidden:** Insufficient permissions (non-internal user or missing fulfillment permission)
- **404 Not Found:** Order not found
- **500 Internal Server Error:** Database transaction failed

#### Error Response Format

```typescript
{
  error: string,
  details?: Array<{
    path: string[],
    message: string
  }>
}
```

### PUT /api/services/[id]/status

Updates individual service status with automatic order progression when applicable.

#### Automatic Order Progression

When a service is updated to "Submitted" status, the system automatically checks if ALL services in the order are now submitted. If so, and the order is currently in "draft" status, the order automatically progresses to "submitted" status.

#### Business Logic

1. **Service Status Update:** Individual service (OrderItem) status is updated
2. **Progression Check:** System checks if all services in the order are "submitted"
3. **Order Progression:** If all submitted AND order is "draft", auto-progress to "submitted"
4. **Audit Trail:** Creates automatic status history entry with system attribution

#### Request Body

```typescript
{
  status: 'Draft' | 'Submitted' | 'Processing' | 'Missing Information' | 'Completed' | 'Cancelled' | 'Cancelled-DNB',
  comment?: string,
  confirmReopenTerminal?: boolean  // Required when changing FROM terminal status
}
```

#### Terminal Status Protection

Services in terminal statuses (Completed, Cancelled, Cancelled-DNB) require explicit confirmation to reopen:

```typescript
{
  status: "Processing",
  confirmReopenTerminal: true  // Must be explicitly true
}
```

Without confirmation, the API returns 409 status with confirmation requirements.

## Order Status History

### Database Schema

```sql
CREATE TABLE OrderStatusHistory (
  id                String    @id @default(uuid())
  orderId           String
  fromStatus        String?
  toStatus          String
  changedBy         String
  notes             String?
  reason            String?
  isAutomatic       Boolean   @default(false)
  createdAt         DateTime  @default(now())

  order             Order     @relation(fields: [orderId], references: [id])
  @@map("order_status_history")
)
```

### Audit Trail Features

- **Complete History:** Every status change is recorded
- **User Attribution:** Links to the user who made the change
- **Automatic vs Manual:** Distinguishes between user actions and system automation
- **Context Notes:** Optional notes provide reasoning for status changes
- **Chronological Order:** Newest changes first for easy reference

## Implementation Details

### OrderStatusDropdown Component

Located at `src/components/fulfillment/OrderStatusDropdown.tsx`

**Key Features:**
- Unrestricted status transitions (Phase 2a business requirement)
- Optimistic UI updates with error rollback
- Loading states to prevent duplicate submissions
- Keyboard navigation support for accessibility
- Status-specific color coding (colors centralized in `src/lib/status-colors.ts`)

**Status Colors:**

| Status | Background | Text |
|---|---|---|
| draft | bg-gray-100 | text-gray-800 |
| submitted | bg-blue-100 | text-blue-800 |
| processing | bg-green-50 | text-green-600 |
| completed | bg-green-200 | text-green-900 |
| missing information | bg-red-100 | text-red-800 |
| cancelled | bg-purple-100 | text-purple-800 |
| cancelled-dnb | bg-purple-100 | text-purple-800 |

**Error Handling:**
- Network error recovery
- Permission validation
- Order not found scenarios
- Server error feedback

### Order Status Progression Service

Located at `src/lib/services/order-status-progression.service.ts`

**Responsibilities:**
- Checks if all services in an order are submitted
- Automatically progresses order from draft to submitted
- Handles concurrent updates through database transactions
- Creates audit trail entries for automatic changes

**Business Logic:**
```typescript
// Only progress if:
// 1. Order has at least one service
// 2. Order is currently in 'draft' status
// 3. ALL services have 'submitted' status
shouldProgressOrder(services: OrderItem[], currentOrderStatus: string): boolean
```

## Security Considerations

### Permission Validation

1. **Authentication Required:** All endpoints require valid session
2. **User Type Restriction:** Only internal users can change order status
3. **Permission Check:** Must have `fulfillment.*` or `admin.*` permissions
4. **Vendor Exclusion:** Vendors cannot change order status (only service status)

### Data Integrity

1. **Database Transactions:** All status changes use transactions for consistency
2. **Concurrent Update Protection:** Re-validation within transactions
3. **Audit Trail Integrity:** Every change is permanently logged
4. **Case-Insensitive Comparison:** Status matching handles case variations

## Error Scenarios and Handling

### Common Error Cases

1. **Permission Denied:** User lacks fulfillment permissions
   - Response: 403 Forbidden
   - Message: "Insufficient permissions to update order status"

2. **Order Not Found:** Invalid order ID or deleted order
   - Response: 404 Not Found
   - Message: "Order not found"

3. **Same Status:** User selects current status
   - Response: 200 OK
   - Message: "Order already has this status"

4. **Network Failure:** API request fails
   - UI: Error toast with retry option
   - No UI state change until success

5. **Concurrent Modification:** Another user changed status simultaneously
   - Response: 500 Internal Server Error
   - UI: Error message, page refresh recommended

## Testing Coverage

The feature includes 72 comprehensive tests covering:

### Frontend Tests (22 tests)
- Dropdown rendering and interaction
- Status selection and API calls
- Error handling and user feedback
- Accessibility features
- Loading states

### Backend Tests (50 tests)
- Authentication and permission validation
- Status update transactions
- Audit trail creation
- Edge case handling
- Automatic order progression
- Service status integration

### Test Categories
- **Unit Tests:** Component behavior, service logic
- **Integration Tests:** API endpoint functionality
- **Security Tests:** Permission enforcement
- **Business Logic Tests:** Status progression rules

## Future Enhancements

### Phase 3 Planned Features

1. **Status Transition Rules:** Implement workflow restrictions based on learned patterns
2. **Bulk Status Updates:** Allow changing multiple order statuses simultaneously
3. **Status Change Notifications:** Email/SMS alerts for status changes
4. **Advanced Audit Reports:** Detailed status change analytics
5. **Workflow Automation:** Rules engine for complex status logic

### Configuration Options

Future versions will support configurable:
- Status transition restrictions per customer
- Required approval workflows for certain changes
- Automatic progression rules customization
- Status change notification preferences

---

## Related Documentation

- [Business Specification](/docs/specs/order-status-management.md) - Complete requirements
- [Fulfillment API](/docs/api/fulfillment.md) - Related endpoints
- [Service Status Change](/docs/api/service-status-change.md) - Individual service management
- [Audit Reports](/docs/features/audit-trails.md) - Status history analysis