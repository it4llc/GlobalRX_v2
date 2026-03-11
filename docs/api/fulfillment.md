# Fulfillment API Documentation

## GET /api/fulfillment

Retrieves orders for fulfillment dashboard with user-type-specific filtering and statistics.

### Authentication
**Required:** Yes - Valid session with fulfillment permission or customer access

### Permissions Required
- **Internal/Admin Users:** `fulfillment.*` or `fulfillment: true`
- **Vendor Users:** `fulfillment.*` with valid `vendorId`
- **Customer Users:** Valid `customerId` (automatically granted fulfillment access for their orders)

### User Type Access Patterns

#### Internal Users (`userType: 'internal'` or `userType: 'admin'`)
- **Sees:** ALL orders (both assigned and unassigned to vendors)
- **Business Reason:** Internal users manage vendor assignments and need to see unassigned orders
- **Filter Applied:** None (full access)

#### Vendor Users (`userType: 'vendor'`)
- **Sees:** Only orders assigned to their specific vendor
- **Business Reason:** Vendors should only access orders they're responsible for fulfilling
- **Filter Applied:** `assignedVendorId = session.user.vendorId`

#### Customer Users (`userType: 'customer'`)
- **Sees:** Only their own orders
- **Business Reason:** Customers can track fulfillment status of their orders
- **Filter Applied:** `customerId = session.user.customerId`

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | null | Filter by order status code |
| `search` | string | null | Search in order number, subject first/last name |
| `limit` | number | 50 | Number of orders per page (1-100) |
| `offset` | number | 0 | Pagination offset |

### Request Example

```http
GET /api/fulfillment?status=submitted&search=john&limit=25&offset=0
Authorization: Bearer {session-token}
```

### Response Format

```typescript
{
  orders: Order[],
  total: number,
  limit: number,
  offset: number,
  stats: {
    totalOrders: number,
    totalServices: number,
    inProgress: number
  }
}
```

### Response Fields

#### Order Object
```typescript
{
  id: string,
  orderNumber: string,
  statusCode: string,
  subject: {
    firstName?: string,
    lastName?: string,
    // ... other subject fields
  } | null,
  customer?: {
    id: string,
    name: string
  },
  assignedVendor?: {
    id: string,
    name: string
  } | null,
  items: Array<{
    id: string,
    service: {
      id: string,
      name: string
    },
    location: {
      id: string,
      name: string
    }
  }>,
  createdAt: string,
  updatedAt: string,
  notes?: string | null
}
```

#### Statistics Object
```typescript
{
  totalOrders: number,      // Count of all orders visible to user
  totalServices: number,    // Count of all order items across visible orders
  inProgress: number        // Orders not in 'draft', 'completed', or 'cancelled' status
}
```

### Status Codes

- **200 OK:** Success with orders and statistics
- **401 Unauthorized:** Missing or invalid authentication
- **403 Forbidden:** Insufficient permissions for fulfillment access
- **500 Internal Server Error:** Database or server error

### Error Response Format

```typescript
{
  error: string  // Error message describing the issue
}
```

### Business Rules

1. **User Type Validation:** Only internal, admin, vendor, and customer user types can access fulfillment
2. **Order Visibility:** Each user type sees only orders appropriate to their role
3. **Unassigned Orders:** Only internal/admin users can see orders without vendor assignments
4. **Statistics Accuracy:** Stats reflect only orders visible to the requesting user
5. **Search Scope:** Search applies to order number, subject names, and customer names
6. **Status Filtering:** When combined with search, both filters apply (AND logic)

### Recent Bug Fixes

#### March 9, 2026: Internal Users Unassigned Orders Fix
**Problem:** Internal/admin users were incorrectly filtered to only see orders with assigned vendors, preventing them from managing unassigned orders.

**Solution:** Removed vendor assignment filter for internal/admin users so they can see ALL orders (both assigned and unassigned).

**Impact:**
- Internal users can now properly manage vendor assignments
- Fulfillment workflow restored to intended functionality
- Dashboard statistics now accurate for all user types

#### March 9, 2026: Dashboard Statistics Standardization
**Problem:** Different user types showed different numbers of dashboard cards (5 for internal/vendor, 4 for customers).

**Solution:** Standardized all user types to show exactly 3 statistics cards: Total Orders, Total Services, and In Progress.

**Impact:**
- Consistent user experience across all user types
- Simplified dashboard layout and maintenance
- Unified business metrics reporting

### Implementation Notes

- Query filters are built dynamically based on user type
- All database queries use pagination for performance
- Statistics require separate query without pagination for accuracy
- Logging includes user context for audit trails
- Database includes necessary joins for customer and vendor information

### Related Endpoints

- `PUT /api/fulfillment` - Update order status for fulfillment
- `GET /api/fulfillment/orders/[id]` - Get specific order details
- `POST /api/fulfillment/services/bulk-assign` - Bulk assign services to vendors

---

## GET /api/fulfillment/orders/[id]

Retrieves detailed order information for all user types with appropriate data filtering based on user permissions. This endpoint supports the customer order view-only feature by allowing customers to view their orders on the same fulfillment interface as internal users.

### Authentication
**Required:** Yes - Valid session with appropriate permissions

### Permissions Required
- **Internal/Admin Users:** `fulfillment.*` or `candidate_workflow.*` permissions
- **Vendor Users:** Order must be assigned to user's vendor
- **Customer Users:** Order must belong to user's customer account

### User Type Access Patterns

#### Customer Users (`userType: 'customer'`)
- **Access Rule:** Can only view orders where `order.customerId = session.user.customerId`
- **Data Filtering:** All sensitive internal information is filtered out:
  - Vendor names and assignments removed
  - Internal notes and vendor notes hidden
  - Pricing information excluded
  - User identity information anonymized
  - Internal comments filtered out (only external comments visible)
  - Status history shows timestamps but no user information

#### Internal/Admin Users
- **Access Rule:** Can view any order with appropriate fulfillment permissions
- **Data Filtering:** No filtering - sees all data including vendor details, internal notes, and all comments

#### Vendor Users
- **Access Rule:** Can only view orders assigned to their vendor
- **Data Filtering:** Internal notes filtered out, but vendor information preserved

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Order ID to retrieve |

### Request Example

```http
GET /api/fulfillment/orders/123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {session-token}
```

### Response Format

The response structure varies based on user type:

#### For Internal/Admin Users (Full Data)
```typescript
{
  id: string,
  orderNumber: string,
  customerId: string,
  statusCode: string,
  subject: {
    firstName: string,
    lastName: string,
    email?: string,
    // ... other subject fields
  },
  customer: {
    id: string,
    name: string,
    code?: string
  },
  assignedVendor?: {
    id: string,
    name: string
  },
  vendorNotes?: string,
  internalNotes?: string,
  user: {
    firstName: string,
    lastName: string,
    email: string
  },
  items: Array<{
    id: string,
    service: {
      id: string,
      name: string,
      category?: string
    },
    location: {
      id: string,
      name: string,
      code2?: string
    },
    serviceFulfillment: {
      id: string,
      status: string,
      assignedVendorId?: string,
      vendorNotes?: string,
      internalNotes?: string,
      assignedAt?: string,
      completedAt?: string
    }
  }>,
  statusHistory: Array<{
    id: string,
    fromStatus?: string,
    toStatus: string,
    createdAt: string,
    user: {
      firstName: string,
      lastName: string,
      email: string
    }
  }>,
  comments: Array<{
    id: string,
    finalText: string,
    isInternalOnly: boolean,
    createdAt: string,
    createdByName: string
  }>,
  commentCount: number,
  serviceFulfillments: Array<{
    // Full service fulfillment data
  }>,
  createdAt: string,
  updatedAt: string
}
```

#### For Customer Users (Filtered Data)
```typescript
{
  id: string,
  orderNumber: string,
  customerId: string,
  statusCode: string,
  subject: {
    firstName: string,
    lastName: string,
    email?: string,
    // ... other subject fields (no SSN masking changes)
  },
  customer: {
    id: string,
    name: string,
    code?: string
  },
  // NO vendor information
  // NO internal/vendor notes
  // NO pricing information
  // NO user identity fields
  items: Array<{
    id: string,
    service: {
      id: string,
      name: string,
      category?: string
    },
    location: {
      id: string,
      name: string,
      code2?: string
    },
    serviceFulfillment: {
      id: string,
      status: string,
      assignedAt?: string,
      completedAt?: string
      // NO vendor assignments
      // NO internal/vendor notes
    }
  }>,
  statusHistory: Array<{
    id: string,
    fromStatus?: string,
    toStatus: string,
    createdAt: string
    // NO user information
  }>,
  comments: Array<{
    id: string,
    finalText: string,
    // Only external comments (isInternalOnly = false)
    createdAt: string
    // NO author information
  }>,
  commentCount: number, // Only external comments counted
  serviceFulfillments: Array<{
    // Filtered service fulfillment data
  }>,
  createdAt: string,
  updatedAt: string
}
```

### Status Codes

- **200 OK:** Success with order details (filtered based on user type)
- **400 Bad Request:** Invalid order ID format
- **401 Unauthorized:** Missing or invalid authentication
- **403 Forbidden:** Insufficient permissions or access denied
- **404 Not Found:** Order not found or user lacks access
- **500 Internal Server Error:** Database or server error

### Error Response Format

```typescript
{
  error: string  // Error message describing the issue
}
```

### Business Rules

1. **Customer Access Control:** Customers can only access orders belonging to their customer account
2. **Data Security:** Sensitive vendor and internal information is filtered out for customers
3. **Comment Filtering:** Customers see only external comments (isInternalOnly = false)
4. **Status History:** Customers see status changes but not who made them
5. **Vendor Assignment:** Vendor information is completely hidden from customers
6. **Audit Trail:** All access attempts are logged for security monitoring

### Implementation Notes

- Uses utility functions from `@/lib/utils/customer-order-permissions` for data filtering
- Implements comprehensive security filtering to prevent information leakage
- Maintains backward compatibility with existing internal/vendor access patterns
- Cache prevention headers set for sensitive data
- Structured logging includes user context for audit trails

### Security Features

1. **Access Validation:** Multi-layer permission checking before data access
2. **Data Filtering:** Comprehensive removal of sensitive information for customers
3. **Comment Security:** Internal comments completely filtered out from customer view
4. **Identity Protection:** User identity information anonymized in customer responses
5. **Vendor Privacy:** All vendor-related information hidden from customers