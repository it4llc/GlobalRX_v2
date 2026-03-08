# Service Comments API Documentation

## Overview
The Service Comments API provides endpoints for managing comments on service fulfillment items. Comments use templates as **fully editable starting points** - users can modify any part of the template text, with brackets treated as regular text characters. This represents a major change from previous placeholder-based validation. The API supports role-based visibility and maintains a complete audit trail for all edits.

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

#### Parameters
- `orderId` (path) - UUID of the order

#### Response
- **200 OK** - Comments retrieved successfully
```json
{
  "serviceComments": {
    "service-uuid-1": {
      "serviceName": "Background Check",
      "serviceStatus": "Processing",
      "comments": [
        {
          "id": "uuid",
          "serviceId": "service-uuid-1",
          "templateId": "uuid",
          "finalText": "string",
          "isInternalOnly": boolean,
          "createdBy": "uuid",
          "createdAt": "2026-03-06T10:00:00Z",
          "template": {
            "shortName": "string",
            "longName": "string"
          },
          "createdByUser": {
            "name": "string",
            "email": "string"
          }
        }
      ],
      "total": 2
    },
    "service-uuid-2": {
      "serviceName": "Drug Test",
      "serviceStatus": "Completed",
      "comments": [],
      "total": 0
    }
  }
}
```
- **401 Unauthorized** - No authentication
- **403 Forbidden** - No access to order

#### Access Rules
- **Internal users**: Access all orders
- **Vendor users**: Access orders with assigned services
- **Customer users**: Access only their orders

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