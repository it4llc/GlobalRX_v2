# Document Upload API Documentation

## Overview

The Document Upload API provides immediate file upload capabilities for draft orders. This API was created to solve the document persistence issue where File objects could not be JSON serialized when saving draft orders.

## Problem Solved

**Original Issue:** When customers uploaded documents in draft orders, the files would be lost upon saving because File objects cannot be JSON serialized. When `JSON.stringify()` was called on form data containing File objects, they became empty `{}` objects.

**Solution:** Immediate upload pattern where files are uploaded to disk when selected, returning JSON-serializable metadata instead of File objects. This metadata can then be safely stored in draft orders.

## POST /api/portal/uploads

Uploads a document file immediately when selected, returning metadata for storage in order state.

### Authentication
**Required:** Yes - Valid customer portal session

### Permissions Required
- **Customer Users:** Must be authenticated to upload documents for their orders

### Content Type
**Required:** `multipart/form-data` (automatically set when using FormData)

### Request Body (FormData)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | The document file to upload |
| `documentId` | string | Yes | The requirement/field ID this document fulfills |
| `previousFile` | string | No | Path to existing file if replacing (for cleanup) |

### File Restrictions

- **Max Size:** 10MB
- **Allowed Types:** PDF, PNG, JPG, JPEG, DOC, DOCX
- **Filename:** Sanitized to remove special characters, preserves extension

### Response Format

#### Success Response (200)

```typescript
{
  success: true,
  metadata: {
    documentId: string;           // The requirement ID
    filename: string;             // Sanitized filename
    originalName: string;         // Original filename from user
    storagePath: string;          // Relative path for file access
    mimeType: string;            // File MIME type
    size: number;                // File size in bytes
    uploadedAt: string;          // ISO timestamp
    uploadedBy: string;          // User ID who uploaded
  }
}
```

#### Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `Unauthorized` | User not authenticated |
| 400 | `No file provided` | Missing file in FormData |
| 400 | `Document ID is required` | Missing documentId field |
| 400 | `File type not allowed` | File type not in allowed list |
| 400 | `File size exceeds limit` | File larger than 10MB |
| 500 | `Failed to upload file` | Server error during file save |

### File Storage Structure

Files are stored on disk in the following structure:
```
uploads/
└── draft-documents/
    └── [userId]/
        └── [documentId]/
            └── [uniqueId]_[sanitizedFilename]
```

### Integration with Order System

1. **File Selection:** User selects a file in the DocumentsReviewStep component
2. **Immediate Upload:** File is uploaded via this endpoint using FormData
3. **Metadata Storage:** Component stores returned metadata in state (not File object)
4. **Draft Persistence:** When order is saved, metadata is stored in `order_data` table with `fieldType='document'`
5. **Edit Draft:** When editing draft, metadata is loaded back from `order_data` and displayed

### Example Usage

```typescript
const handleFileSelect = async (file: File, documentId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', documentId);

  // If replacing existing file
  if (existingDocument?.storagePath) {
    formData.append('previousFile', existingDocument.storagePath);
  }

  const response = await fetch('/api/portal/uploads', {
    method: 'POST',
    body: formData  // Don't set Content-Type - let browser handle it
  });

  if (response.ok) {
    const result = await response.json();
    // Store metadata in component state
    setUploadedDocuments(prev => ({
      ...prev,
      [documentId]: result.metadata
    }));
  } else {
    const error = await response.json();
    console.error('Upload failed:', error.error);
  }
};
```

### Security Considerations

1. **Authentication:** All uploads require valid session
2. **File Type Validation:** Both MIME type and extension are checked
3. **File Size Limits:** 10MB maximum to prevent abuse
4. **Filename Sanitization:** Special characters removed to prevent path traversal
5. **User Isolation:** Files stored in user-specific directories
6. **Cleanup:** Previous files are deleted when replaced

### Error Handling

- **Client-side:** Handle upload errors gracefully, show user-friendly messages
- **Server-side:** Comprehensive error logging for debugging
- **File Cleanup:** Failed uploads don't leave partial files on disk
- **Rollback:** If file save fails, no database changes are made

## Related Endpoints

- **Order Creation:** `POST /api/portal/orders` - References uploaded document metadata
- **Order Updates:** `PUT /api/portal/orders/[id]` - Saves document metadata to order_data
- **Order Retrieval:** `GET /api/portal/orders/[id]` - Loads document metadata for editing

## Migration Notes

This endpoint was introduced to fix document persistence in draft orders. No existing data migration is required as this addresses a bug where documents weren't persisting at all.