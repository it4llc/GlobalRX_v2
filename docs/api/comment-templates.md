# Comment Templates API Documentation

## Overview
The Comment Templates API provides endpoints for managing comment templates used in the service fulfillment system. Templates serve as starting points for creating service comments and can be filtered by service type and status to show only relevant templates.

## Authentication
All endpoints require authentication via NextAuth session. Template management requires `comment_management` permission. Template retrieval for commenting requires `fulfillment` permission.

## Endpoints

### 1. Get Comment Templates
**GET** `/api/comment-templates`

Retrieves all active comment templates with optional filtering by service type and status.

#### Query Parameters
- `serviceType` (optional) - Filter templates by service code (e.g., "BGC", "DRUG")
- `serviceStatus` (optional) - Filter templates by service status (e.g., "SUBMITTED", "PROCESSING")

#### Response
- **200 OK** - Templates retrieved successfully
```json
{
  "templates": [
    {
      "id": "uuid",
      "shortName": "REQ_DOCS",
      "longName": "Request Additional Documents",
      "templateText": "We need additional documentation to complete this service.",
      "isActive": true,
      "createdBy": "uuid",
      "updatedBy": "uuid",
      "createdAt": "2026-03-01T10:00:00Z",
      "updatedAt": "2026-03-01T10:00:00Z",
      "availabilities": [
        {
          "id": "uuid",
          "templateId": "uuid",
          "serviceCode": "BGC",
          "status": "Processing"
        }
      ]
    }
  ],
  "services": [
    {
      "code": "BGC",
      "name": "Background Check",
      "category": "Screening"
    }
  ],
  "statuses": [
    "Draft",
    "Submitted",
    "Processing",
    "Missing Information",
    "Completed",
    "Cancelled",
    "Cancelled-DNB"
  ]
}
```

#### Filtering Behavior

**BUG FIX (March 20, 2026):** Resolved critical filtering logic issue where templates were incorrectly returned when no matches existed.

When both `serviceType` and `serviceStatus` are provided:
- System searches for template availabilities matching both criteria
- **If matches found:** Returns only templates that have availability for that service type/status combination
- **If NO matches found:** Returns empty array (not all active templates)

This fix prevents unintended data exposure where all templates were returned when specific filtering criteria matched no records.

**Normal filtering:**
```
GET /api/comment-templates?serviceType=BGC&serviceStatus=PROCESSING
→ Returns templates available for Background Check services in Processing status
```

**Empty results (fixed behavior):**
```
GET /api/comment-templates?serviceType=INVALID&serviceStatus=INVALID
→ Returns empty templates array (not all active templates)
```

#### Status Normalization

**BUG FIX (March 20, 2026):** Fixed status case mismatch causing empty results.

The API automatically normalizes status values to handle case differences:
- **Input:** "MISSING INFORMATION", "CANCELLED-DNB" (uppercase from frontend)
- **Database:** "Missing Information", "Cancelled-Dnb" (title case storage)
- **Normalization:** Converts segments to proper title case, preserving hyphens

This ensures consistent matching between frontend status values and database records.

- **401 Unauthorized** - No authentication
- **403 Forbidden** - Insufficient permissions (requires fulfillment permission for filtering, comment_management for management)

#### Access Control
- **Template Management (no query params):** Requires `comment_management` permission, internal users only
- **Template Filtering (with serviceType/serviceStatus):** Requires `fulfillment` permission

---

### 2. Create Comment Template
**POST** `/api/comment-templates`

Creates a new comment template. Only internal users with comment_management permission can create templates.

#### Request Body
```json
{
  "shortName": "string",      // Required: 1-50 chars, unique among active templates
  "longName": "string",       // Required: 1-100 chars, descriptive name
  "templateText": "string"    // Required: 1-1000 chars, template content
}
```

#### Response
- **201 Created** - Template created successfully
```json
{
  "id": "uuid",
  "shortName": "REQ_DOCS",
  "longName": "Request Additional Documents",
  "templateText": "We need additional documentation to complete this service.",
  "isActive": true,
  "createdBy": "uuid",
  "updatedBy": "uuid",
  "createdAt": "2026-03-01T10:00:00Z",
  "updatedAt": "2026-03-01T10:00:00Z",
  "availabilities": []
}
```
- **400 Bad Request** - Invalid input or duplicate short name
- **401 Unauthorized** - No authentication
- **403 Forbidden** - Not an internal user or lacks comment_management permission

#### Business Rules
- Short name must be unique among active templates (inactive templates don't count)
- Template text supports any content - no special placeholder validation
- Templates start with empty availability configuration
- Audit trail maintained with createdBy/updatedBy

---

## Data Models

### CommentTemplate
```typescript
{
  id: string;
  shortName: string;          // Short identifier (e.g., "REQ_DOCS")
  longName: string;           // Display name
  templateText: string;       // Template content
  isActive: boolean;          // Active/inactive status
  createdBy: string;         // User ID who created
  updatedBy: string;         // User ID who last updated
  createdAt: string;         // ISO timestamp
  updatedAt: string;         // ISO timestamp
  availabilities: CommentTemplateAvailability[];
}
```

### CommentTemplateAvailability
```typescript
{
  id: string;
  templateId: string;        // FK to CommentTemplate
  serviceCode: string;       // Service type code
  status: string;           // Service status value
}
```

## Error Responses

All endpoints return consistent error formats:

```json
{
  "error": "Error message describing the issue",
  "details": [] // For validation errors
}
```

Common error scenarios:
- **400**: Validation errors or duplicate short name
- **401**: "Unauthorized" - no session
- **403**: "Insufficient permissions" - wrong user type or missing permissions
- **500**: "Internal server error" - database or system error

## Security Considerations

1. **Authentication**: All endpoints require valid NextAuth session
2. **Authorization**: Permission checks based on endpoint usage (management vs filtering)
3. **Input Validation**: Zod schemas validate all request data
4. **User Type Restrictions**: Template management restricted to internal users only
5. **Audit Trail**: All creation/modification actions tracked with user ID and timestamp

## Bug Fixes Implemented

### March 20, 2026 - Comment Template Filtering Bugs

**Bug 1: Empty Filter Results Logic**
- **Issue:** When filtering by serviceType/serviceStatus returned no matching template availabilities, API returned ALL active templates instead of empty array
- **Root Cause:** Missing else clause to handle zero matches scenario
- **Fix:** Added `templateWhere.id = { in: [] }` to force empty results when no matches found
- **Impact:** Prevents unintended data exposure when specific filter criteria match no records

**Bug 2: Status Case Normalization**
- **Issue:** Frontend sends uppercase status values ("MISSING INFORMATION") but database stores title case ("Missing Information"), causing lookup failures
- **Root Cause:** Direct status value comparison without case normalization
- **Fix:** Added normalization logic to convert status to proper title case with hyphen preservation
- **Impact:** Ensures consistent matching between frontend and database status values

**Code Location:** `/src/app/api/comment-templates/route.ts` lines 98-105 (normalization), 134-143 (empty results handling)

## Implementation Status
- **Backend**: ✅ Complete with bug fixes (March 20, 2026)
- **Frontend**: ✅ Complete - Global Config template management
- **API Documentation**: ✅ Complete
- **Bug Fixes**: ✅ Complete - filtering and normalization issues resolved