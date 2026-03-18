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
      name: string,
      code?: string    // Country code for display preference
    },
    status: string     // Service status for ServiceStatusList component
  }>,    // Items are always ordered by service name (asc), then creation date (asc) for consistent display
  createdAt: string,
  updatedAt: string,
  notes?: string | null
}
```

**Note:** The `items` array is consumed by the `ServiceStatusList` component to display individual services within orders tables. Each item includes service name, location data (with optional country code), and status for consistent display across portal pages.

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

#### March 14, 2026: Order Items Display Order Stability Fix
**Problem:** Services within an order were changing display order when their status was updated because there was no explicit orderBy clause when fetching order items.

**Solution:** Added explicit ordering `orderBy: [{ service: { name: 'asc' } }, { createdAt: 'asc' }]` to all order item queries.

**Impact:**
- Services now always display in consistent alphabetical order by service name
- UI stability improved - services no longer "jump around" after status updates
- Consistent ordering across all fulfillment endpoints

### Implementation Notes

- Query filters are built dynamically based on user type
- All database queries use pagination for performance
- Statistics require separate query without pagination for accuracy
- Logging includes user context for audit trails
- Database includes necessary joins for customer and vendor information

### Related Endpoints

- `PATCH /api/fulfillment/orders/[id]/status` - Update order status (NEW: Order Status Management)
- `PUT /api/fulfillment` - Update order status for fulfillment (legacy)
- `GET /api/fulfillment/orders/[id]` - Get specific order details
- `GET /api/fulfillment/services/[id]` - Get individual service details with order data
- `PUT /api/services/[id]/status` - Update individual service status with automatic order progression
- `POST /api/fulfillment/services/bulk-assign` - Bulk assign services to vendors

---

## POST /api/fulfillment/services/bulk-assign

Assigns multiple services to a vendor in a single operation for efficient workflow management.

### Authentication
**Required:** Yes - Valid session with fulfillment management permissions

### Permissions Required
- **Internal Users Only:** `fulfillment.manage` or equivalent permissions
- **Vendors/Customers:** Cannot perform bulk assignments (403 Forbidden)

### Request Body

```typescript
{
  serviceFulfillmentIds: string[],  // Array of service fulfillment record IDs
  vendorId: string                  // Vendor to assign services to
}
```

**CRITICAL:** The `serviceFulfillmentIds` field must contain service fulfillment record IDs (from the ServiceFulfillment table), NOT service type IDs. This ensures the API assigns the specific service instances rather than service types.

### Request Example

```http
POST /api/fulfillment/services/bulk-assign
Content-Type: application/json
Authorization: Bearer {session-token}

{
  "serviceFulfillmentIds": [
    "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "a47ac10b-58cc-4372-a567-0e02b2c3d480"
  ],
  "vendorId": "vendor-789"
}
```

### Response Format

```typescript
{
  updated: number  // Count of services successfully assigned
}
```

### Status Codes

- **200 OK:** Success with count of updated services
- **400 Bad Request:** Invalid input data or deactivated vendor
- **401 Unauthorized:** Missing or invalid authentication
- **403 Forbidden:** Insufficient permissions (requires fulfillment.manage)
- **404 Not Found:** Vendor not found
- **500 Internal Server Error:** Database or server error

### Business Rules

1. **Permission Restriction:** Only internal/admin users can perform bulk assignments
2. **Vendor Validation:** Vendor must exist and be active (not deactivated)
3. **Service Validation:** All service fulfillment IDs must be valid and accessible
4. **Atomic Operation:** Either all services are assigned or none are (transaction-based)
5. **Audit Trail:** Each assignment is logged for compliance tracking

### Recent Bug Fixes

#### March 18, 2026: Field Name Standardization Bug Fix
**Problem:** Frontend was sending `serviceIds` field instead of `serviceFulfillmentIds`, causing 400 Bad Request errors during bulk vendor assignment.

**Root Cause:** Field name mismatch between frontend component and API expectation - the API correctly expects service fulfillment record IDs, not service type IDs.

**Solution:** Fixed field name in `ServiceFulfillmentTable.tsx` line 675 from `serviceIds` to `serviceFulfillmentIds` and added regression test to prevent recurrence.

**Impact:**
- Bulk vendor assignment feature now works correctly
- Added code comments explaining critical field name requirement
- Comprehensive regression test ensures bug cannot reoccur

---

## PATCH /api/fulfillment/orders/[id]/status

Updates order status with comprehensive audit trails and automatic progression logic.

### Authentication
**Required:** Yes - Valid session with fulfillment permissions

### Permissions Required
- **Internal Users Only:** `fulfillment.*` or `admin.*` permissions required
- **Vendors/Customers:** Cannot change order status (403 Forbidden)

### Business Rules

1. **Standardized Status Values:** Uses seven consistent values matching service statuses
2. **No Transition Restrictions:** Any status can change to any other (Phase 2a design)
3. **Audit Trail Creation:** Every change logged in OrderStatusHistory table
4. **Automatic Progression:** Integration with service status changes for workflow automation

### Request Body

```typescript
{
  status: 'draft' | 'submitted' | 'processing' | 'missing_info' | 'completed' | 'cancelled' | 'cancelled_dnb',
  notes?: string
}
```

### Response Example

```typescript
{
  id: "order-123",
  orderNumber: "20260313-ABC-0001",
  statusCode: "processing",
  customerId: "customer-456",
  customer: {
    id: "customer-456",
    name: "Acme Corporation"
  },
  items: [...],
  message: "Order status updated successfully"
}
```

### Integration with Service Status Changes

When individual services are updated via `PUT /api/services/[id]/status`, the system automatically:

1. **Checks Service Status:** Monitors all services in the order
2. **Triggers Progression:** If ALL services become "submitted" and order is "draft"
3. **Auto-Updates Order:** Changes order status to "submitted" automatically
4. **Creates Audit Trail:** Logs automatic change with system attribution

This prevents orders from remaining in draft when all services are ready for processing.

**See:** [Order Status Management API Documentation](./order-status-management.md) for complete details.

---

## GET /api/fulfillment/services/[id]

Retrieves detailed information about a specific service fulfillment record, including all order data collected during the original order submission process.

### Authentication
**Required:** Yes - Valid session with fulfillment permissions

### Permissions Required
- **Internal Users:** `fulfillment.view` or `fulfillment.*`
- **Vendor Users:** Service must be assigned to user's vendor
- **Customer Users:** Service must belong to user's customer

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string (UUID) | Yes | Service fulfillment ID |

### Request Example

```http
GET /api/fulfillment/services/srv_123e4567-e89b-12d3-a456-426614174000
Authorization: Bearer {session-token}
```

### Response Format

```typescript
{
  id: string,
  orderItemId: string,
  serviceId: string,
  locationId: string,
  status: 'pending' | 'submitted' | 'processing' | 'completed' | 'cancelled',
  assignedVendorId?: string | null,
  vendorNotes?: string | null,
  internalNotes?: string | null,
  assignedAt?: Date | null,
  assignedBy?: string | null,
  completedAt?: Date | null,
  createdAt: Date,
  updatedAt: Date,

  // Related data
  order: {
    id: string,
    orderNumber: string,
    subject: {
      firstName: string,
      lastName: string,
      // ... other subject fields
    }
  },
  orderItem: {
    id: string,
    service: {
      id: string,
      name: string,
      category: string
    },
    location: {
      id: string,
      name: string,
      code_2: string
    }
  },

  // NEW: Order data collected during order submission
  orderData: {
    [fieldLabel: string]: string | null
    // Example:
    // "School Name": "University of Michigan",
    // "Degree Type": "Bachelor's",
    // "Graduation Date": "2020-05-15",
    // "Major/Field of Study": "Computer Science"
  }
}
```

### Order Data Field

The `orderData` object contains all form fields that were collected when the customer originally submitted their order, formatted as key-value pairs with human-readable labels.

#### Field Characteristics:
- **Keys:** Human-readable field labels (e.g., "School Name", "Degree Type")
- **Values:** Exact data as entered by customer (strings, may be null)
- **Excluded:** Personal information that duplicates `order.subject` (firstName, lastName, email, DOB, SSN, phone)
- **Fallback:** If workflow configuration is deleted, raw field names are used with underscore-to-space conversion

#### Example Order Data by Service Type:

**Education Verification:**
```json
{
  "School Name": "University of Michigan",
  "Degree Type": "Bachelor's Degree",
  "Major/Field of Study": "Computer Science",
  "Graduation Date": "2020-05-15",
  "Student ID": "123456789",
  "Additional Instructions": "Contact registrar directly"
}
```

**Employment Verification:**
```json
{
  "Company Name": "Tech Solutions Inc",
  "Job Title": "Software Engineer",
  "Employment Start Date": "2020-06-01",
  "Employment End Date": "2024-01-15",
  "Supervisor Name": "Jane Smith",
  "HR Contact Phone": "(555) 123-4567"
}
```

**Criminal Background Check:**
```json
{
  "Search Scope": "County and Federal",
  "Additional Counties": "Wayne County, MI; Cook County, IL",
  "Years to Search": "7 years"
}
```

### Business Rules

1. **Data Inclusion:** Order data is included for ALL service types without exception
2. **Field Filtering:** Personal information fields are excluded to prevent duplication with `order.subject`
3. **Access Control:** All users who can view a service can see all its order data fields
4. **Error Handling:** If order data cannot be retrieved, an empty object is returned (service details still load)
5. **Label Formatting:** Field labels come from original workflow configuration when available
6. **Fallback Display:** If workflow is deleted, raw field names are formatted (underscores become spaces)

### Status Codes

- **200 OK:** Success with service details and order data
- **400 Bad Request:** Invalid service ID format
- **401 Unauthorized:** Missing or invalid authentication
- **403 Forbidden:** Access denied - user cannot view this service
- **404 Not Found:** Service not found
- **500 Internal Server Error:** Database or server error

### Error Response Format

```typescript
{
  error: string  // Error message describing the issue
}
```

### Implementation Notes

- Uses `ServiceOrderDataService` for consistent order data formatting
- Handles missing workflow configurations gracefully
- Logs all database errors while maintaining service availability
- Includes duplicate field detection to prevent information redundancy
- Supports graceful degradation - service details work even if order data fails

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