# Service Results API Documentation

## Overview

The Service Results API provides endpoints for managing search results and PDF attachments for services in the fulfillment workflow. This feature enables internal fulfillment staff and assigned vendors to document their investigation findings and attach supporting documentation.

## Authentication & Authorization

All endpoints require authentication via `getServerSession()`. Authorization is role-based:

- **Internal users with `fulfillment.edit`**: Can view and edit results for any service
- **Internal users with `fulfillment.view`**: Can view results for any service (read-only)
- **Vendors**: Can only view/edit results for services assigned to their organization
- **Customers**: Can view results and download attachments for their own orders only (read-only)

## Terminal Status Rules

Services in terminal status (`COMPLETED`, `CANCELLED`, `CANCELLED_DNB`) cannot have their results or attachments modified. This business rule ensures data integrity for finalized work.

---

## GET /api/services/[id]/results

Retrieves search results for a specific service.

### Parameters

- `id` (path): OrderItem ID

### Authorization

- Internal users: Requires `fulfillment.view` OR `fulfillment.edit` permission
- Vendors: Can access services assigned to their vendor organization
- Customers: Can access their own order services only

### Response

```json
{
  "results": "Search results text or null",
  "resultsAddedBy": {
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "resultsAddedAt": "2024-03-11T10:30:00.000Z",
  "resultsLastModifiedBy": {
    "email": "modifier@example.com",
    "firstName": "Jane",
    "lastName": "Smith"
  },
  "resultsLastModifiedAt": "2024-03-11T14:15:00.000Z",
  "assignedVendorId": "vendor-123",
  "status": "PROCESSING"
}
```

### Status Codes

- `200`: Success
- `401`: Not authenticated
- `403`: Forbidden (insufficient permissions)
- `404`: Service not found or no results exist yet
- `500`: Internal server error

---

## PUT /api/services/[id]/results

Updates search results for a specific service.

### Parameters

- `id` (path): OrderItem ID

### Authorization

- Internal users: Requires `fulfillment.edit` permission
- Vendors: Can edit services assigned to their vendor organization only
- Customers: Cannot update results

### Request Body

```json
{
  "results": "Updated search results text"
}
```

### Business Rules

- If this is the first time adding results, both `resultsAddedBy` and `resultsAddedAt` are set
- For subsequent edits, only `resultsLastModifiedBy` and `resultsLastModifiedAt` are updated
- Cannot edit results when service is in terminal status
- Input is automatically sanitized to prevent XSS attacks

### Response

Returns the updated results data with audit trail information.

### Status Codes

- `200`: Success
- `400`: Invalid input (validation failed)
- `401`: Not authenticated
- `403`: Forbidden (insufficient permissions)
- `404`: Service not found
- `409`: Service in terminal status (cannot edit)
- `500`: Internal server error

---

## GET /api/services/[id]/attachments

Lists all PDF attachments for a specific service.

### Parameters

- `id` (path): OrderItem ID

### Authorization

- Internal users: Requires `fulfillment.view` permission
- Vendors: Can view attachments for assigned services
- Customers: Can view their own order attachments

### Response

```json
{
  "attachments": [
    {
      "id": 123,
      "fileName": "background_check_results.pdf",
      "fileSize": 2048576,
      "uploadedBy": 456,
      "uploadedAt": "2024-03-11T10:30:00.000Z"
    }
  ]
}
```

### Status Codes

- `200`: Success (may return empty array)
- `401`: Not authenticated
- `403`: Forbidden
- `404`: Service not found
- `500`: Internal server error

---

## POST /api/services/[id]/attachments

Uploads a new PDF attachment for a specific service.

### Parameters

- `id` (path): OrderItem ID

### Authorization

- Internal users: Requires `fulfillment.edit` permission
- Vendors: Can upload to services assigned to their vendor organization
- Customers: Cannot upload attachments

### Request Body

Multipart form data with `file` field containing PDF file.

### Validation

- File must be PDF type (`application/pdf`)
- File size must be ≤ 5MB
- Service must not be in terminal status
- Filename is sanitized and stored with unique identifier

### File Storage

Files are stored in: `uploads/service-results/[order-id]/[service-id]/[unique-id]_[filename]`

### Response

Returns the created attachment record.

### Status Codes

- `201`: Created successfully
- `400`: Invalid file (wrong type/size) or no file provided
- `401`: Not authenticated
- `403`: Forbidden (insufficient permissions)
- `404`: Service not found
- `409`: Service in terminal status (cannot upload)
- `500`: Internal server error

---

## GET /api/services/[id]/attachments/[attachmentId]

Downloads a specific PDF attachment.

### Parameters

- `id` (path): OrderItem ID
- `attachmentId` (path): Attachment ID

### Authorization

- Internal users: Requires `fulfillment.view` permission
- Vendors: Can download attachments for assigned services
- Customers: Can download their own order attachments

### Response

Returns PDF file stream with appropriate headers:
- `Content-Type`: `application/pdf`
- `Content-Disposition`: `attachment; filename="original_name.pdf"`
- `Content-Length`: File size

### Status Codes

- `200`: File downloaded successfully
- `400`: Invalid attachment ID
- `401`: Not authenticated
- `403`: Forbidden
- `404`: Service or attachment not found, or file missing from disk
- `500`: Internal server error

---

## DELETE /api/services/[id]/attachments/[attachmentId]

Deletes a specific PDF attachment.

### Parameters

- `id` (path): OrderItem ID
- `attachmentId` (path): Attachment ID

### Authorization

- Internal users: Requires `fulfillment.edit` permission
- Vendors: Can delete attachments for assigned services
- Customers: Cannot delete attachments

### Business Rules

- Cannot delete attachments when service is in terminal status
- Deletes both database record and physical file
- Creates audit log entry for compliance

### Response

```json
{
  "success": true,
  "message": "Attachment deleted successfully"
}
```

### Status Codes

- `200`: Deleted successfully
- `400`: Invalid attachment ID
- `401`: Not authenticated
- `403`: Forbidden (insufficient permissions)
- `404`: Service or attachment not found
- `409`: Service in terminal status (cannot delete)
- `500`: Internal server error

---

## Data Models

### ServiceAttachment

```typescript
interface ServiceAttachment {
  id: number;
  serviceFulfillmentId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  uploadedBy: number;
  uploadedAt: Date;
}
```

### ServiceResults

```typescript
interface ServiceResults {
  results: string | null;
  resultsAddedBy?: { email: string; firstName: string; lastName: string };
  resultsAddedAt?: string;
  resultsLastModifiedBy?: { email: string; firstName: string; lastName: string };
  resultsLastModifiedAt?: string;
  assignedVendorId?: string;
  status: string;
}
```

---

## Security Features

### Input Sanitization

All results text input is automatically sanitized to prevent XSS attacks:
- Script tags and event handlers removed
- JavaScript protocols stripped
- Iframe and object tags blocked

### File Security

- Only PDF files accepted
- File size limited to 5MB
- Files stored outside web root
- Original filenames sanitized
- Unique identifiers prevent conflicts

### Access Control

- Server-side permission checks on all endpoints
- Vendor assignments verified at API level
- Customer data isolation enforced
- Terminal status rules prevent unauthorized modifications

### Audit Trail

All operations create audit log entries with:
- Entity type and ID
- Action performed (create, update, upload, delete)
- User ID and timestamp
- Automatic audit trail for compliance requirements

---

## Error Handling

All endpoints follow consistent error response format:

```json
{
  "error": "Human readable error message"
}
```

Detailed error logging includes:
- Request context (user, service, action)
- Error details and stack traces
- Performance metrics for troubleshooting

## Integration Notes

### Frontend Integration

The Service Results API integrates with:
- `ServiceResultsSection` component for UI
- `ServiceFulfillmentTable` for visual indicators
- File upload/download utilities
- Permission checking via `useAuth` hook

### Database Relations

- Results stored in `servicesFulfillment` table with audit fields
- Attachments in separate `serviceAttachment` table
- Foreign key relationships ensure data integrity
- Cascade deletes prevent orphaned records