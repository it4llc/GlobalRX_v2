# Feature Specification: Service Comments Database and API (Phase 2b)

**Date:** March 5, 2026
**Requested by:** Andy
**Status:** In Development
**Phase:** 2b of 6 (Fulfillment System)

## Summary

The Service Comments system enables users to add comments to individual services within orders using the comment templates created in Phase 1. Comments are attached at the SERVICE level (not order level) since fulfillment happens per service. Comments can be edited by internal users (with full audit trail), support internal/external visibility filtering, and maintain a complete audit trail. Internal comments are hidden from customers only - both vendors and internal users can see them. This is Phase 2b of the fulfillment system, building on the template foundation from Phase 1.

## Who Uses This

- **Internal GlobalRx Users** - Add and view both internal and external comments on services
- **Vendor Users** - Add and view both internal and external comments on services they're assigned to fulfill
- **Customers** - View only external comments (isInternalOnly = false) on their services
- **System Administrators** - Full access to all comments for audit and support purposes

## Business Rules

1. **Comments are editable** - Internal users can edit any comment after creation (tracks updatedBy, updatedAt)
2. **Template required** - Every comment must reference a valid, active comment template
3. **Final text required** - The finalText field must contain the actual comment content (template with placeholders filled in)
4. **Character limit enforced** - finalText limited to 1000 characters maximum
5. **Internal flag defaults to true** - Comments are internal-only by default for safety
6. **Visibility filtering** - GET endpoints filter comments based on user role and isInternalOnly flag:
   - Internal users see all comments
   - Vendor users see all comments
   - Customers see only comments where isInternalOnly = false
7. **Service must exist** - Comment can only be added to existing services within orders
8. **User must be authenticated** - Anonymous users cannot create or view comments
9. **Permission required** - Users need `fulfillment` permission (from User Admin page) to create comments
10. **Audit trail maintained** - createdBy, createdAt, updatedBy, updatedAt tracked for every comment
11. **No bulk operations** - Comments must be added one at a time for audit clarity
12. **Template validation** - System verifies templateId references an active template
13. **Service access validation** - User must have access to the service's parent order to add/view comments
14. **Timestamp precision** - createdAt and updatedAt use database timestamp with timezone
15. **No comment threading** - Comments are flat list, not nested/threaded (Phase 2b scope)
16. **Template availability** - Only templates configured for the service type and status can be selected
17. **Edit permissions** - Only internal users can edit comments, vendors cannot edit

## User Interface Context

### Order Details Page Structure

The order details page will need to display multiple services with their individual comments. While the exact UI implementation may evolve, the expected approach is:

1. **Service Organization** - Services displayed as tabs within the order details page
   - Each tab represents one service (e.g., "Background Check", "Education Verification", "Drug Test")
   - Tab shows service name and status indicator (Draft, Submitted, Processing, Completed)
   - Badge on tab shows comment count if comments exist

2. **Service Tab Content** - When a service tab is selected:
   - Service details (type, status, dates, assigned vendor)
   - Comments section with all comments for that service
   - Add Comment button/form
   - Comment history in chronological order

3. **Typical Order Sizes**:
   - Most common: 2-5 services per order
   - Maximum expected: 10+ services (rare but supported)
   - Minimum: 1 service

4. **Alternative UI Approaches** (for future consideration):
   - Accordion view with expandable service sections
   - Card-based layout with services as cards
   - Split view with service list on left, details on right
   - Timeline view showing service progression

## User Flow

### Adding a Comment to a Service

1. **Navigate to service** - User opens order details, then selects the service tab
2. **Select comment template** - User chooses from dropdown of available templates (filtered by service type and current status)
3. **Template text appears** - Selected template's text displays with [placeholders] highlighted
4. **Fill placeholders** - User replaces placeholder text with actual values
5. **Set visibility** - User toggles "Internal Only" checkbox (defaults to checked)
6. **Preview comment** - User sees final text that will be saved
7. **Submit comment** - User clicks "Add Comment" button
8. **Success feedback** - Comment appears in service's comment list immediately
9. **Edit available** - Internal users see "Edit" button on comments

### Viewing Service Comments

1. **Open service details** - User navigates to specific service within an order
2. **Comments section loads** - System fetches and displays filtered comments
3. **Visibility indicator** - Each comment shows:
   - Comment text (finalText)
   - Template name used
   - Created by (user's name)
   - Created at (formatted timestamp)
   - Updated by (if edited)
   - Updated at (if edited)
   - Internal/External badge
4. **Filtered by role** - Customers see only external comments, vendors and internal users see all
5. **Chronological order** - Comments displayed newest first by default
6. **No pagination in Phase 2b** - All comments load at once (pagination in later phase if needed)

### Editing a Comment (Internal Users Only)

1. **Click Edit button** - Internal user clicks "Edit" on an existing comment
2. **Edit form appears** - Modal or inline editor shows current finalText
3. **Modify text** - User updates the comment text (1000 char limit still applies)
4. **Save changes** - User clicks "Save" button
5. **Audit trail updated** - System records updatedBy and updatedAt
6. **Success feedback** - Updated comment displays with "Edited" indicator and timestamp

## Data Requirements

### ServiceComment Table

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Service Reference | serviceId | UUID | Yes | Must exist in Services table | - |
| Template Used | templateId | UUID | Yes | Must exist and be active in CommentTemplate table | - |
| Comment Text | finalText | Text | Yes | 1-1000 characters, non-empty | - |
| Internal Only | isInternalOnly | Boolean | Yes | true/false | true |
| Created By | createdBy | UUID | Yes | Must exist in Users table | Current user |
| Created Date | createdAt | Timestamp with TZ | Yes | Valid timestamp | Current timestamp |
| Updated By | updatedBy | UUID | No | Must exist in Users table if set | - |
| Updated Date | updatedAt | Timestamp with TZ | No | Valid timestamp | - |

### Indexes

- Primary key: id (UUID)
- Index on serviceId for fast comment retrieval by service
- Index on createdBy for audit queries
- Index on createdAt for chronological sorting
- Composite index on (serviceId, createdAt) for efficient service comment lists

## API Endpoints

### GET /api/orders/[orderId]/services/comments
Retrieves all comments for all services in an order (for initial page load efficiency)

**Response (200 OK):**
```json
{
  "serviceComments": {
    "[serviceId1]": {
      "serviceName": "Background Check",
      "serviceStatus": "Processing",
      "comments": [...],  // Same structure as individual service endpoint
      "total": 5
    },
    "[serviceId2]": {
      "serviceName": "Education Verification",
      "serviceStatus": "Completed",
      "comments": [...],
      "total": 3
    }
  }
}
```

**Use Case**: Efficiently load all comments when opening order details page with multiple service tabs

**Permissions Required:**
- Must be authenticated
- Must have access to view the order

**Note**: This bulk endpoint is optional - the UI could also call individual service endpoints as tabs are selected.

### POST /api/services/[serviceId]/comments
Creates a new comment for a service

**Request Body:**
```json
{
  "templateId": "uuid",
  "finalText": "string (1-1000 chars)",
  "isInternalOnly": boolean // optional, defaults to true
}
```

**Response (201 Created):**
```json
{
  "id": "uuid",
  "serviceId": "uuid",
  "templateId": "uuid",
  "finalText": "string",
  "isInternalOnly": boolean,
  "createdBy": "uuid",
  "createdAt": "ISO 8601 timestamp",
  "updatedBy": "uuid or null",
  "updatedAt": "ISO 8601 timestamp or null",
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
  } // only if updatedBy exists
}
```

**Permissions Required:**
- Must be authenticated
- Must have `fulfillment` permission
- Must have access to the service

**Validation:**
- Service must exist
- Template must exist and be active
- Template must be available for service type and current status
- finalText must be 1-1000 characters
- finalText cannot be empty or whitespace only

### PUT /api/services/[serviceId]/comments/[commentId]
Updates an existing comment (internal users only)

**Request Body:**
```json
{
  "finalText": "string (1-1000 chars)",
  "isInternalOnly": boolean // optional
}
```

**Response (200 OK):**
```json
{
  "id": "uuid",
  "serviceId": "uuid",
  "templateId": "uuid",
  "finalText": "string",
  "isInternalOnly": boolean,
  "createdBy": "uuid",
  "createdAt": "ISO 8601 timestamp",
  "updatedBy": "uuid",
  "updatedAt": "ISO 8601 timestamp",
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

**Permissions Required:**
- Must be authenticated
- Must be an internal user (not vendor)
- Must have access to the service

**Validation:**
- Comment must exist
- finalText must be 1-1000 characters
- finalText cannot be empty or whitespace only

### GET /api/services/[serviceId]/comments
Retrieves filtered comments for a service

**Response (200 OK):**
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
      "createdAt": "ISO 8601 timestamp",
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
      } // only if updatedBy exists
    }
  ],
  "total": number
}
```

**Visibility Filtering:**
- Internal users: See all comments
- Vendor users: See all comments
- Customers: See only comments where isInternalOnly = false
- Must have access to view the service

**Permissions Required:**
- Must be authenticated
- Must have access to view the service

**Sorting:**
- Default: Newest first (createdAt DESC)
- No pagination in Phase 2b

## Edge Cases and Error Scenarios

1. **Template not found** - 400 Bad Request: "Invalid template ID"
2. **Template inactive** - 400 Bad Request: "Selected template is no longer active"
3. **Template not available** - 400 Bad Request: "Template not available for this service type and status"
4. **Service not found** - 404 Not Found: "Service not found"
5. **No service access** - 403 Forbidden: "You do not have access to this service"
6. **Missing permission** - 403 Forbidden: "You do not have permission to add comments"
7. **Text too long** - 400 Bad Request: "Comment text cannot exceed 1000 characters"
8. **Empty text** - 400 Bad Request: "Comment text cannot be empty"
9. **Invalid serviceId format** - 400 Bad Request: "Invalid service ID format"
10. **Database error** - 500 Internal Server Error: "Failed to save comment"
11. **Vendor attempts edit** - 403 Forbidden: "Only internal users can edit comments"
12. **Comment not found** - 404 Not Found: "Comment not found"
13. **Attempting to delete** - 405 Method Not Allowed: "Comments cannot be deleted"
14. **Concurrent edits** - Last save wins (no locking in Phase 2b)

## Definition of Done

1. Database migration created for ServiceComment table with all fields and indexes
2. POST endpoint implemented with full validation and permission checks
3. PUT endpoint implemented for editing (internal users only)
4. GET endpoint implemented with visibility filtering based on user role
5. Template availability checked against service type and status
6. Zod schemas created for request/response validation
7. Unit tests cover all business rules and validations
8. Integration tests verify permission and visibility filtering
9. API routes follow authentication-first pattern per coding standards
10. Winston structured logging replaces any console statements
11. Error responses use consistent format with helpful messages
12. Template and user data properly joined in responses
13. Edit audit trail properly maintained (updatedBy, updatedAt)
14. TypeScript types properly defined (no 'any' types)
15. All text responses use translation system keys
16. Database queries optimized with proper indexes

## Technical Implementation Notes

### Files to Create/Modify

**New Files:**
- `/prisma/migrations/[timestamp]_add_service_comments.sql` - Database migration
- `/src/app/api/services/[serviceId]/comments/route.ts` - API endpoints
- `/src/lib/validations/service-comment.ts` - Zod validation schemas
- `/src/services/service-comment-service.ts` - Business logic service
- `/src/types/service-comment.ts` - TypeScript type definitions
- `/tests/unit/services/service-comment-service.test.ts` - Unit tests
- `/tests/api/services/comments.test.ts` - API integration tests

**Files to Reference:**
- `/src/lib/permission-utils.ts` - For permission checking
- `/src/services/comment-template-service.ts` - For template validation
- `/src/app/api/services/[serviceId]/route.ts` - For service access patterns

### Key Design Decisions

1. **Editable with audit trail** - Comments can be edited by internal users with full tracking
2. **Template required** - Enforces standardization, no free-form comments in Phase 2b
3. **Visibility at comment level** - Each comment has its own visibility setting
4. **Denormalized user/template data** - Include names in response for better UX
5. **No delete capability** - Comments cannot be deleted, only edited
6. **Single comment operations** - No bulk API for clear audit trail
7. **Synchronous operations** - No queue/async processing needed for Phase 2b
8. **Template availability enforced** - Only templates configured for the service type and status can be used
9. **Permission reuses existing** - Uses `fulfillment` permission from User Admin page

## Out of Scope (Phase 2b)

The following are NOT included in Phase 2b:
- Comment deletion (editing is included)
- Comment threading or replies
- File attachments on comments
- Comment notifications
- Bulk comment operations
- Comment search/filtering
- Comment templates per customer
- Free-form comments without templates
- Comment approval workflow
- Comment version history
- Rich text formatting
- @mentions or user tagging

## Dependencies

- Phase 1 Comment Templates must be completed and active
- Services table must exist with proper structure including service type field
- Orders table must exist (services belong to orders)
- Authentication system must identify user roles (internal vs vendor vs customer)
- Permission system must have `fulfillment` permission available in User Admin
- User must have access to view the service's parent order to see comments
- CommentTemplateAvailability table must link templates to service types and statuses

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Comments expose sensitive data | Data breach | isInternalOnly flag defaults to true |
| Vendors see internal comments | Information leak | Strict visibility filtering in API |
| Comments fill database | Performance | 1000 char limit, monitoring for abuse |
| Wrong template selected | Incorrect communication | Template descriptions and preview |
| Placeholders not replaced | Confusing messages | UI highlights placeholders clearly |

## Future Phases

This is Phase 2b of 6 in the fulfillment system:
- Phase 1: Comment Template Management (COMPLETE)
- Phase 2a: Template Categories and Organization
- **Phase 2b: Order Comments Database and API (CURRENT)**
- Phase 3: Records Search Results Tracking
- Phase 4: Verification Search Results with Data Rx integration
- Phase 5: Customer Notification Configuration
- Phase 6: Information Request Email Triggers

---

## Approval Status

**PENDING APPROVAL** - Please review and confirm this specification before implementation begins.