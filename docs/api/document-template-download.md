# Document Template Download API

## Endpoint

`GET /api/portal/documents/[id]/download-template`

## Description

Downloads a PDF template file for a specific document requirement. This endpoint provides secure access to template files that customers can download to understand what forms need to be completed during the order process.

## Authentication

- **Required**: Yes (session-based authentication)
- **User Type**: Customer users only
- **Permissions**: Authenticated customer access (no specific permission required beyond customer user type)

## Parameters

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | Yes | UUID of the document requirement |

### Example Request

```http
GET /api/portal/documents/550e8400-e29b-41d4-a716-446655440000/download-template
Authorization: [session cookie]
```

## Response

### Success Response (200 OK)

**Content-Type**: `application/pdf`

**Headers**:
```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="Background Check Form.pdf"
Content-Length: 2048000
Cache-Control: no-cache, no-store, must-revalidate
```

**Body**: Binary PDF file content

### Error Responses

#### 401 Unauthorized
```json
{
  "error": "Unauthorized"
}
```

#### 403 Access Denied
```json
{
  "error": "Access denied"
}
```

#### 404 Document Not Found
```json
{
  "error": "Document not found"
}
```

#### 404 Template Not Available
```json
{
  "error": "No template available for this document"
}
```

#### 404 Template File Not Found
```json
{
  "error": "Template file not found. Please contact support."
}
```

#### 400 Invalid Template Path
```json
{
  "error": "Invalid template path"
}
```

#### 413 File Too Large
```json
{
  "error": "Template file is too large"
}
```

#### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

## Business Rules

### Access Control
1. Only authenticated users with `userType: 'customer'` can access this endpoint
2. Document ID must be a valid UUID format
3. Document requirement must exist and not be disabled

### Template Availability
1. Document must have `documentData` containing valid `pdfPath`
2. Template file must exist on the file system
3. File must be a PDF (`.pdf` extension required)
4. File size must be under 50MB limit

### Security Validations
1. **Path Traversal Prevention**: Paths containing `..` or `~` are rejected
2. **Directory Containment**: Resolved file paths must be within application directory
3. **File Type Validation**: Only PDF files are allowed
4. **Size Limits**: Maximum file size of 50MB to prevent DoS attacks

## Implementation Details

### Database Query
```sql
SELECT id, documentData, disabled
FROM DSXRequirement
WHERE id = $1
```

### Template Metadata Structure
The `documentData` field contains JSON with template information:
```json
{
  "pdfPath": "/templates/background-check-form.pdf",
  "pdfFilename": "Background Check Form.pdf",
  "pdfFileSize": 2048000,
  "instructions": "Complete all sections..."
}
```

### File Path Resolution
1. Remove leading slash from `pdfPath` if present
2. Join with application root using `path.join()`
3. Resolve to absolute path using `path.resolve()`
4. Validate resolved path is within application directory

## Security Considerations

### Path Traversal Protection
```typescript
// Reject dangerous path components
if (documentData.pdfPath.includes('..') || documentData.pdfPath.includes('~')) {
  return 400; // Invalid template path
}

// Ensure resolved path stays within app directory
const resolvedPath = path.resolve(filePath);
const baseDir = path.resolve(process.cwd());
if (!resolvedPath.startsWith(baseDir)) {
  return 404; // Template file not found
}
```

### File Validation
```typescript
// Only PDF files allowed
if (!documentData.pdfPath.toLowerCase().endsWith('.pdf')) {
  return 400; // Template must be a PDF file
}

// Size limit enforcement
if (stats.size > MAX_FILE_SIZE) {
  return 413; // Template file is too large
}
```

## Error Logging

All errors are logged with structured metadata:
```typescript
logger.warn('Template file not found', {
  documentId: params.id,
  resolvedPath,
  error: error.message
});
```

Sensitive information (full file paths) is not exposed to clients but is logged for debugging.

## Rate Limiting

Currently no specific rate limiting is implemented. Consider adding rate limiting based on:
- IP address for anonymous access attempts
- User ID for authenticated requests
- File size for bandwidth management

## Caching Strategy

Templates are served with no-cache headers to ensure customers always get current versions:
```http
Cache-Control: no-cache, no-store, must-revalidate
```

This prevents browsers from caching potentially outdated templates.

## Example Usage

### JavaScript/Fetch
```javascript
const response = await fetch(`/api/portal/documents/${documentId}/download-template`);

if (response.ok) {
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  // Create download link
  const a = document.createElement('a');
  a.href = url;
  a.download = 'template.pdf';
  a.click();

  URL.revokeObjectURL(url);
} else {
  const error = await response.json();
  console.error('Download failed:', error.error);
}
```

### React Component Integration
```typescript
import { DocumentTemplateButton } from '@/components/portal/orders/DocumentTemplateButton';

<DocumentTemplateButton
  documentId="550e8400-e29b-41d4-a716-446655440000"
  hasTemplate={true}
  filename="Background Check Form.pdf"
  fileSize={2048000}
/>
```

## Testing

### Unit Tests
- UUID validation
- Path traversal prevention
- File existence checking
- Error response formatting

### Integration Tests
- Full download flow with valid template
- Authentication requirement enforcement
- Permission checking for user types
- Error scenarios (missing files, invalid paths)

### Security Tests
- Path traversal attack attempts
- Large file handling
- Unauthorized access attempts
- Malformed UUID handling