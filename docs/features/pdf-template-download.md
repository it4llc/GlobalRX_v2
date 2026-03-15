# PDF Template Download Feature

## Overview

The PDF Template Download feature enables customers to download PDF form templates during the order creation process. This feature provides secure, authenticated access to template files associated with document requirements, helping customers understand what forms they need to complete and submit.

## Business Value

- **Customer Self-Service**: Customers can download forms immediately without contacting support
- **Process Efficiency**: Clear templates reduce form completion errors and processing delays
- **Transparency**: Customers know exactly what documentation is required upfront
- **Compliance**: Ensures customers have access to current, approved form templates

## User Guide

### For Customers

1. **Accessing Templates**: During order creation, navigate to the Documents Review step
2. **Download Button**: Templates appear as "Download Form" buttons next to relevant document requirements
3. **File Information**: File size is displayed to help with download planning
4. **Download Process**: Click the button to automatically download the PDF template
5. **Form Completion**: Fill out the downloaded template and upload the completed form

### Template Availability

- Templates are only visible when configured for specific document requirements
- Not all document types have associated templates
- Templates are customer-specific based on package configuration

## Technical Details

### Key Files

- **Component**: `src/components/portal/orders/DocumentTemplateButton.tsx`
- **Hook**: `src/hooks/useDocumentTemplate.ts`
- **API Endpoint**: `src/app/api/portal/documents/[id]/download-template/route.ts`
- **Utilities**: `src/lib/utils/documentTemplateUtils.ts`
- **Schemas**: `src/lib/schemas/documentTemplateSchemas.ts`
- **Integration**: `src/components/portal/orders/steps/DocumentsReviewStep.tsx`

### Database Schema

Templates are stored in the `DSXRequirement` table:
```sql
{
  id: string,              -- UUID for the document requirement
  documentData: string,    -- JSON containing template metadata
  disabled: boolean        -- Whether the requirement is active
}
```

Template metadata structure in `documentData`:
```json
{
  "pdfPath": "/path/to/template.pdf",
  "pdfFilename": "Template Name.pdf",
  "pdfFileSize": 2048000,
  "instructions": "Complete and upload this form..."
}
```

### Security Features

1. **Authentication Required**: Only authenticated customer users can download templates
2. **UUID Validation**: Document IDs are validated as proper UUIDs
3. **File Path Security**:
   - Path traversal prevention (`..` and `~` rejected)
   - Files must be within application directory
   - Only `.pdf` files allowed
4. **File Size Limits**: Maximum 50MB per template to prevent DoS attacks
5. **Access Control**: Users can only access templates for their own requirements

### API Endpoint Details

**Endpoint**: `GET /api/portal/documents/[id]/download-template`

**Parameters**:
- `id` (path): UUID of the document requirement

**Authentication**: Required (customer users only)

**Response Headers**:
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="[template-name].pdf"`
- `Content-Length: [file-size]`
- `Cache-Control: no-cache, no-store, must-revalidate`

**Error Responses**:
- `401 Unauthorized`: Not authenticated
- `403 Access denied`: Not a customer user
- `404 Document not found`: Invalid ID or template not available
- `400 Invalid template path`: Security validation failed
- `413 Template file is too large`: File exceeds size limits
- `500 Internal server error`: Server-side error

### Business Rules

1. **Template Availability**: Templates are only shown when `pdfPath` is present and not empty
2. **Disabled Requirements**: Disabled document requirements don't serve templates (404 error)
3. **File Validation**: Templates must be PDF files with valid paths
4. **Customer Scope**: Only customer-type users can access the download endpoint
5. **Error Handling**: User-friendly error messages for all failure scenarios

## Configuration

### Environment Variables

No specific environment variables required. Templates use the application's file system.

### File Storage

- Templates are stored in the application directory structure
- Paths are relative to the application root
- PDF files only (enforced by validation)

### Admin Configuration

Templates are configured through the DSX Requirements management:
1. Set `pdfPath` in the `documentData` field
2. Optionally set `pdfFilename` for custom download names
3. Include `pdfFileSize` for user display
4. Ensure template files exist at the specified paths

## Testing

### Manual Testing

1. **Valid Template Download**:
   - Login as a customer user
   - Navigate to order creation → Documents step
   - Verify template button appears for configured requirements
   - Click download and verify PDF is downloaded correctly

2. **Security Testing**:
   - Attempt access without authentication (should get 401)
   - Try accessing as internal user (should get 403)
   - Test with invalid UUID (should get 404)
   - Test with missing template file (should get 404)

3. **Error Scenarios**:
   - Template with path traversal attempt
   - Template with non-PDF file
   - Disabled document requirement
   - Very large template file

### Automated Testing

The feature includes comprehensive test coverage:
- Component tests for `DocumentTemplateButton`
- Hook tests for `useDocumentTemplate`
- API endpoint tests for security and functionality
- Utility function tests for validation and formatting
- Integration tests for the full download flow

## Error Handling

### User-Facing Errors

- **Template not found**: "Template file not found. Please contact support."
- **Download failed**: "Failed to download template. Please try again."
- **Server error**: Generic error message with logging for support

### Technical Logging

All errors are logged with structured logging including:
- Document ID for traceability
- User ID for security auditing
- Error details for debugging
- File paths for validation issues (without exposing sensitive data)

## Monitoring

### Key Metrics

- Template download success/failure rates
- Most frequently downloaded templates
- Download errors by type (404, 403, 500, etc.)
- File size distribution of downloaded templates

### Alerts

Consider monitoring for:
- High 404 error rates (missing templates)
- 413 errors (files too large)
- Security violations (path traversal attempts)
- Authentication failures on download endpoint

## Future Enhancements

### Planned Improvements

1. **Template Versioning**: Track template versions and update notifications
2. **Download Analytics**: Track which templates are most/least used
3. **Template Previews**: Show template previews without full download
4. **Bulk Downloads**: Allow downloading multiple templates as a ZIP
5. **Custom Templates**: Allow customers to upload custom templates per package

### Integration Opportunities

1. **Document Management**: Integration with document storage systems
2. **Template Editor**: In-app PDF form editor for admin users
3. **Template Validation**: Automated checking for template completeness
4. **Mobile Optimization**: Enhanced mobile download experience