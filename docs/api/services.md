# Services API Documentation

**Endpoint:** `/api/services`
**Authentication:** Required
**Required permissions:** `admin` role

## Overview

The Services API allows administrators to create and retrieve background screening services that can be offered to customers. Services define what type of screening will be performed (e.g., background checks, drug tests, employment verification).

## GET /api/services

Retrieves a paginated list of services with filtering and search capabilities.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number for pagination |
| `pageSize` | number | 10 | Number of services per page |
| `search` | string | "" | Search term to filter by service name or description |
| `category` | string | "" | Filter by service category |
| `functionalityType` | string | "" | Filter by functionality type |
| `includeDisabled` | boolean | false | Whether to include disabled services |

### Response Schema

```typescript
{
  services: Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    functionalityType: 'verification-idv' | 'record' | 'verification-edu' | 'verification-emp' | 'other';
    code: string; // Auto-generated alphanumeric code
    disabled: boolean;
    usage: number; // Placeholder, always 0 currently
    createdAt: string;
    updatedAt: string;
    createdBy: {
      firstName: string;
      lastName: string;
      email: string;
    };
    updatedBy: {
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;
  totalCount: number;
  totalPages: number;
  currentPage: number;
  categories: string[]; // All available categories
  functionalityTypes: string[]; // All valid functionality types — ['verification-idv', 'record', 'verification-edu', 'verification-emp', 'other']
}
```

### Example Request

```bash
GET /api/services?page=1&pageSize=10&search=background&category=Criminal&functionalityType=record
```

### Example Response

```json
{
  "services": [
    {
      "id": "service-123",
      "name": "Background Check Service",
      "category": "Criminal",
      "description": "Comprehensive criminal background check",
      "functionalityType": "record",
      "code": "BGCHECK",
      "disabled": false,
      "usage": 0,
      "createdAt": "2026-03-25T10:00:00Z",
      "updatedAt": "2026-03-25T10:00:00Z",
      "createdBy": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "admin@example.com"
      },
      "updatedBy": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "admin@example.com"
      }
    }
  ],
  "totalCount": 1,
  "totalPages": 1,
  "currentPage": 1,
  "categories": ["Criminal", "Employment", "Education"],
  "functionalityTypes": ["verification-idv", "record", "verification-edu", "verification-emp", "other"]
}
```

## POST /api/services

Creates a new service with auto-generated service code.

### Request Body Schema

```typescript
{
  name: string; // Required - Service display name
  category: string; // Required - Service category
  description?: string; // Optional - Service description
  functionalityType?: 'verification-idv' | 'record' | 'verification-edu' | 'verification-emp' | 'other'; // Optional, defaults to 'other'. Unknown values (including the legacy bare string 'idv') are rejected with HTTP 400.
}
```

### Response Schema

```typescript
{
  id: string;
  name: string;
  category: string;
  description: string | null;
  functionalityType: string;
  code: string; // Auto-generated from service name
  disabled: boolean; // Always false for new services
  createdById: string;
  updatedById: string;
  createdAt: string;
  updatedAt: string;
}
```

### Business Rules

1. **Auto-Generated Codes**: Service codes are automatically generated from the service name:
   - Converted to uppercase
   - Special characters and spaces removed
   - Truncated to 20 characters maximum
   - Numeric suffix added if code already exists (e.g., BGCHECK1, BGCHECK2)

2. **Required Fields**: `name` and `category` are required. Missing these fields returns 400 Bad Request.

3. **Functionality Types**: Must be one of the valid types (`verification-idv`, `record`, `verification-edu`, `verification-emp`, `other`), sourced from `src/constants/functionality-types.ts`. Unknown values — including the legacy bare string `'idv'` — are rejected with HTTP 400 `{ "error": "Unknown functionality type" }`. There is no silent coercion to `"other"`. This validation applies to POST, PUT, and PATCH (PATCH only when `functionalityType` is present in the request body).

4. **Uniqueness**: Service codes must be unique. The API handles conflicts automatically with numeric suffixes.

### Example Request

```bash
POST /api/services
Content-Type: application/json

{
  "name": "Background Check Service",
  "category": "Criminal",
  "description": "Comprehensive criminal background check",
  "functionalityType": "record"
}
```

### Example Response

```json
{
  "id": "service-456",
  "name": "Background Check Service",
  "category": "Criminal",
  "description": "Comprehensive criminal background check",
  "functionalityType": "record",
  "code": "BACKGROUNDCHECKSERVICE",
  "disabled": false,
  "createdById": "user-123",
  "updatedById": "user-123",
  "createdAt": "2026-03-25T10:30:00Z",
  "updatedAt": "2026-03-25T10:30:00Z"
}
```

## PUT /api/services/[id]

Full update of an existing service.

### Request Body Schema

```typescript
{
  name: string;          // Required
  category: string;      // Required
  description?: string;  // Optional
  functionalityType: 'verification-idv' | 'record' | 'verification-edu' | 'verification-emp' | 'other'; // Required. Unknown values are rejected with HTTP 400.
}
```

### Business Rules

- All the same `functionalityType` validation rules as POST apply. Unknown values — including the legacy bare string `'idv'` — return 400 `{ "error": "Unknown functionality type" }`.
- Returns 404 if the service does not exist.

## PATCH /api/services/[id]

Partial update of an existing service, or toggles the disabled flag.

**Toggle disabled:** send `{ "action": "toggleDisabled" }` — no other fields processed.

**Partial field update:** send any combination of `name`, `category`, `description`, `functionalityType`. All omitted fields retain their current stored values.

### Business Rules

- When `functionalityType` is present in the request body it must be in the allow-list; unknown values return 400 `{ "error": "Unknown functionality type" }`.
- When `functionalityType` is absent the existing stored value is left untouched — no validation is triggered.

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

### 400 Bad Request - Missing Required Fields
```json
{
  "error": "Missing required fields"
}
```

### 400 Bad Request - Unknown Functionality Type
```json
{
  "error": "Unknown functionality type"
}
```

Returned by POST, PUT, and PATCH (when `functionalityType` is present) when the submitted value is not in the allow-list defined by `src/constants/functionality-types.ts`. Prior to the `verification-idv-conversion` feature, unknown values were silently coerced to `"other"`. That behavior has been removed — callers that still send the legacy bare string `"idv"` will receive this error.

### 500 Internal Server Error
```json
{
  "error": "Error creating service"
}
```

## Bug Fix Documentation

**Issue Fixed (March 25, 2026):** The POST endpoint was returning 500 errors because the required `code` field was missing from the service creation data.

**Root Cause:** The Prisma Service model requires a non-null unique `code` field, but the API endpoint didn't provide one.

**Solution:** Implemented auto-generation of service codes from service names with uniqueness conflict resolution using numeric suffixes.

**Files Modified:**
- `/src/app/api/services/route.ts` - Added `generateServiceCode()` function and retry logic
- `/src/app/api/services/__tests__/route.test.ts` - Added regression tests for code generation

## Related Documentation

- [Database Standards - Required Field Validation](/docs/DATABASE_STANDARDS.md#section-7-required-field-validation-standard)
- [Coding Standards - API Route Standards](/docs/CODING_STANDARDS.md#section-5-api-route-standards)