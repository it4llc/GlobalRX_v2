# Service Comments API Documentation

## Overview
The Service Comments API provides endpoints for managing comments on service fulfillment items and changing service status (Phase 2d). Comments use templates as **fully editable starting points** - users can modify any part of the template text, with brackets treated as regular text characters. This represents a major change from previous placeholder-based validation. The API supports role-based visibility, order-level locking for concurrent access control, and maintains a complete audit trail for all edits and status changes.

## Authentication
All endpoints require authentication via NextAuth session. Users must have the `fulfillment` permission to create or edit comments.

## Endpoints

### 1. Create Service Comment
**POST** `/api/services/{serviceId}/comments`

Creates a new comment for a specific service.

#### Parameters
- `serviceId` (path) - UUID of the service

#### Request Body
```json
{
  "templateId": "uuid",           // Required: Template ID (for tracking origin)
  "finalText": "string",          // Required: Final comment text (1-1000 chars)
                                  // Can be completely different from template
                                  // Brackets [ ] are treated as regular text
                                  // No placeholder validation performed
  "isInternalOnly": boolean       // Optional: Default true
}
```

#### Response
- **201 Created** - Comment created successfully
```json
{
  "id": "uuid",
  "serviceId": "uuid",
  "templateId": "uuid",
  "finalText": "string",
  "isInternalOnly": boolean,
  "createdBy": "uuid",
  "createdAt": "2026-03-06T10:00:00Z",
  "updatedBy": null,
  "updatedAt": null,
  "template": {
    "shortName": "string",
    "longName": "string"
  },
  "createdByUser": {
    "name": "string",
    "email": "string"
  }
}
```
- **400 Bad Request** - Invalid input or business rule violation
- **401 Unauthorized** - No authentication
- **403 Forbidden** - Lacks fulfillment permission or service access
- **404 Not Found** - Service not found

#### Business Rules
- Template must be active and available for the service type and status
- Text cannot be empty or exceed 1000 characters (enforced at API level)
- **Text can be completely different from template** - no similarity requirements
- **No validation on brackets** - they're treated as regular text characters
- **No placeholder replacement** - final text is saved exactly as entered by user
- Text is sanitized for XSS/injection security before storage
- isInternalOnly defaults to true for safety (external visibility must be explicit)

---

### 2. Get Service Comments
**GET** `/api/services/{serviceId}/comments`

Retrieves all comments for a service with visibility filtering.

#### Parameters
- `serviceId` (path) - UUID of the service

#### Response
- **200 OK** - Comments retrieved successfully
```json
{
  "comments": [
    {
      "id": "uuid",
      "serviceId": "uuid",
      "templateId": "uuid",
      "finalText": "string",
      "isInternalOnly": boolean,
      "createdBy": "uuid",
      "createdAt": "2026-03-06T10:00:00Z",
      "updatedBy": "uuid",
      "updatedAt": "2026-03-06T11:00:00Z",
      "template": {
        "shortName": "string",
        "longName": "string"
      },
      "createdByUser": {
        "name": "string",
        "email": "string"
      },
      "updatedByUser": {
        "name": "string",
        "email": "string"
      }
    }
  ],
  "total": 5
}
```
- **401 Unauthorized** - No authentication
- **403 Forbidden** - No access to service

#### Visibility Rules
- **Internal users**: See all comments
- **Vendor users**: See all comments for assigned services
- **Customer users**: See only external comments (isInternalOnly = false)

---

### 3. Update Service Comment
**PUT** `/api/services/{serviceId}/comments/{commentId}`

Updates an existing comment. Only internal users can edit comments.

#### Parameters
- `serviceId` (path) - UUID of the service
- `commentId` (path) - UUID of the comment

#### Request Body
```json
{
  "finalText": "string",          // Optional: Updated text (1-1000 chars)
  "isInternalOnly": boolean       // Optional: Updated visibility
}
```

#### Response
- **200 OK** - Comment updated successfully
```json
{
  "id": "uuid",
  "serviceId": "uuid",
  "templateId": "uuid",
  "finalText": "string",
  "isInternalOnly": boolean,
  "createdBy": "uuid",
  "createdAt": "2026-03-06T10:00:00Z",
  "updatedBy": "uuid",
  "updatedAt": "2026-03-06T11:00:00Z",
  "template": {
    "shortName": "string",
    "longName": "string"
  },
  "createdByUser": {
    "name": "string",
    "email": "string"
  },
  "updatedByUser": {
    "name": "string",
    "email": "string"
  }
}
```
- **400 Bad Request** - Invalid input
- **401 Unauthorized** - No authentication
- **403 Forbidden** - Not an internal user or no service access
- **404 Not Found** - Comment not found

#### Business Rules
- Only internal users can edit
- Maintains audit trail (updatedBy, updatedAt)
- At least one field must be provided
- Text is sanitized for security

---

### 4. Delete Service Comment
**DELETE** `/api/services/{serviceId}/comments/{commentId}`

Deletes an existing comment. Only internal users can delete comments.

#### Parameters
- `serviceId` (path) - UUID of the service
- `commentId` (path) - UUID of the comment

#### Response
- **200 OK** - Comment deleted successfully
```json
{
  "success": true
}
```
- **401 Unauthorized** - No authentication
- **403 Forbidden** - Not an internal user or no service access
- **404 Not Found** - Comment not found

#### Business Rules
- Only internal users can delete (vendors and customers cannot)
- Must have access to the parent service
- Comment is permanently removed from database
- Maintains referential integrity

---

### 5. Get Order Service Comments
**GET** `/api/orders/{orderId}/services/comments`

Retrieves comments for all services in an order (bulk operation).

**IMPORTANT BUG FIX:** This endpoint was updated (March 9, 2026) to fix an ID mismatch that prevented comments from displaying. The endpoint now properly handles the relationship between ServicesFulfillment IDs and OrderItem IDs.

#### Parameters
- `orderId` (path) - UUID of the order

#### Response
- **200 OK** - Comments retrieved successfully
```json
{
  "commentsByService": {
    "servicefulfillment-uuid-1": {
      "serviceName": "Background Check",
      "serviceStatus": "Processing",
      "comments": [
        {
          "id": "uuid",
          "serviceId": "orderitem-uuid-1",
          "templateId": "uuid",
          "finalText": "string",
          "isInternalOnly": boolean,
          "isStatusChange": false,
          "statusChangedFrom": null,
          "statusChangedTo": null,
          "createdBy": "uuid",
          "createdAt": "2026-03-06T10:00:00Z",
          "template": {
            "shortName": "string",
            "longName": "string"
          },
          "createdByUser": {
            "name": "string"
          },
          "createdByName": "John Smith",
          "updatedByUser": {
            "name": "string"
          },
          "updatedByName": "John Smith"
        }
      ],
      "total": 2
    },
    "servicefulfillment-uuid-2": {
      "serviceName": "Drug Test",
      "serviceStatus": "Completed",
      "comments": [],
      "total": 0
    }
  }
}
```

#### Bug Fix Details (March 9, 2026)
- **Response key changed:** `serviceComments` → `commentsByService`
- **ID mapping fixed:** Response is now keyed by ServicesFulfillment.id (not OrderItem.id)
- **Security enhancement:** Email addresses removed from response (only names included)
- **Additional fields:** Added `isStatusChange`, `statusChangedFrom`, `statusChangedTo`, `createdByName`, `updatedByName`
- **Database relation fixed:** Properly queries ServicesFulfillment → OrderItem → ServiceComment chain

- **401 Unauthorized** - No authentication
- **403 Forbidden** - No access to order

#### Access Rules
- **Internal users**: Access all orders
- **Vendor users**: Access orders with assigned services
- **Customer users**: Access only their orders

---

## Phase 2d - Service Status Change Endpoints

### 6. Update Service Status
**PUT** `/api/services/{serviceId}/status`

Updates the status of a service with audit trail and locking (Phase 2d).

#### Parameters
- `serviceId` (path) - UUID of the service (OrderItem)

#### Request Body
```json
{
  "status": "Draft" | "Submitted" | "Processing" | "Missing Information" | "Completed" | "Cancelled" | "Cancelled-DNB",
  "comment": "string",           // Optional: Context for status change (max 1000 chars)
  "confirmReopenTerminal": boolean // Required: true when changing from terminal status
}
```

#### Response
- **200 OK** - Status updated successfully
```json
{
  "service": {
    "id": "uuid",
    "status": "Processing",
    "updatedAt": "2026-03-09T10:00:00Z",
    "updatedById": "uuid"
  },
  "auditEntry": {
    "id": "uuid",
    "orderItemId": "uuid",
    "isStatusChange": true,
    "statusChangedFrom": "Draft",
    "statusChangedTo": "Processing",
    "comment": "Status changed from Draft to Processing. Additional context: Ready for vendor assignment",
    "createdBy": "uuid",
    "createdAt": "2026-03-09T10:00:00Z"
  }
}
```
- **401 Unauthorized** - No authentication
- **403 Forbidden** - Not internal user or insufficient permissions
- **404 Not Found** - Service not found
- **409 Conflict** - Terminal status confirmation required
```json
{
  "error": "Terminal status confirmation required",
  "requiresConfirmation": true,
  "currentStatus": "Completed",
  "newStatus": "Processing",
  "message": "This service is currently Completed. Are you sure you want to re-open it by changing the status to Processing?"
}
```
- **423 Locked** - Order locked by another user
```json
{
  "error": "Order is locked by another user",
  "lockedBy": "user-uuid"
}
```

#### Business Rules
- **Phase 2d**: Internal GlobalRx users only (vendors excluded)
- Requires `fulfillment` permission
- Terminal statuses (Completed/Cancelled/Cancelled-DNB) require `confirmReopenTerminal: true`
- Order must be locked by requesting user
- Creates ServiceComment audit entry with `isStatusChange: true`
- Logs all status changes with structured logging

### 7. Acquire Order Lock
**POST** `/api/orders/{orderId}/lock`

Acquires a lock on an order to prevent concurrent service modifications.

#### Parameters
- `orderId` (path) - UUID of the order

#### Request Body
No body required.

#### Response
- **200 OK** - Lock acquired successfully
```json
{
  "success": true,
  "lock": {
    "orderId": "uuid",
    "lockedBy": "uuid",
    "lockedAt": "2026-03-09T10:00:00Z",
    "lockExpires": "2026-03-09T10:15:00Z"
  }
}
```
- **423 Locked** - Order already locked by another user
```json
{
  "error": "Order is locked by another user",
  "lockedBy": "user-uuid"
}
```

#### Business Rules
- 15-minute automatic expiration
- Auto-extends if same user requests lock again
- Only one user can hold lock per order
- Covers ALL services within the order

### 8. Release Order Lock
**DELETE** `/api/orders/{orderId}/lock`

Releases a lock on an order.

#### Parameters
- `orderId` (path) - UUID of the order
- `force` (query) - Optional: `true` for admin force release

#### Response
- **200 OK** - Lock released successfully
```json
{
  "success": true,
  "message": "Lock released successfully"
}
```
- **403 Forbidden** - Not authorized to release this lock
- **404 Not Found** - No lock exists for this order

#### Business Rules
- Only lock holder can release normally
- Admin users can force-release with `?force=true`
- Automatic cleanup happens on lock expiration

### 9. Check Order Lock Status
**GET** `/api/orders/{orderId}/lock`

Checks the lock status for an order.

#### Parameters
- `orderId` (path) - UUID of the order

#### Response
- **200 OK** - Lock status retrieved
```json
{
  "isLocked": true,
  "lock": {
    "orderId": "uuid",
    "lockedBy": "uuid",
    "lockedAt": "2026-03-09T10:00:00Z",
    "lockExpires": "2026-03-09T10:15:00Z"
  },
  "canEdit": true  // true if current user holds the lock
}
```

#### Business Rules
- Expired locks are treated as unlocked
- `canEdit` indicates if current user can modify services
- Used by frontend to show/hide edit controls

---

## Error Responses

All endpoints return consistent error formats:

```json
{
  "error": "Error message describing the issue"
}
```

Common error scenarios:
- **401**: "Authentication required"
- **403**: "You do not have permission to perform this action"
- **404**: "Resource not found"
- **400**: Specific validation or business rule error
- **500**: "Internal server error"

## Security Considerations

1. **Authentication**: All endpoints require valid session
2. **Authorization**: Permission and access checks on every request
3. **Input Validation**: Zod schemas validate all inputs
4. **Text Sanitization**: Comments are sanitized to prevent XSS/injection
5. **Rate Limiting**: Consider implementing rate limits in production
6. **Audit Trail**: All changes tracked with user and timestamp

## Implementation Status
- **Backend**: ✅ Complete (March 6, 2026) - Phase 2b
- **Frontend**: ✅ Complete (March 6, 2026) - Phase 2c
- **Tests**: ✅ 48+ frontend tests + 120+ backend tests passing
- **Documentation**: ✅ Complete