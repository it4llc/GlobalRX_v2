# Service Results Block Feature

## Overview

The Service Results Block is a core MVP feature that enables internal fulfillment staff and assigned vendors to record detailed search results and attach supporting PDF documents for each service they are fulfilling. This feature provides transparency to customers about work performed and maintains audit trails for compliance.

## Business Purpose

When fulfilling background check services, staff need to:
- Document what they found during searches and investigations
- Attach relevant PDF reports or documentation
- Provide transparency to customers about work performed
- Maintain comprehensive audit trails for business compliance
- Prevent unauthorized modifications of completed work

## User Experience

### For Internal Fulfillment Staff
- Can add and edit search results for any service
- Can upload, download, and delete PDF attachments
- See full audit trail of who added/modified results
- Cannot edit results for services in terminal status without changing status first

### For Assigned Vendors
- Can add and edit results for services assigned to their organization only
- Can manage attachments for their assigned services
- Cannot access or modify services assigned to other vendors
- Subject to same terminal status restrictions

### For Customers
- Can view search results for their own orders (read-only)
- Can download PDF attachments related to their services
- Cannot edit results or upload attachments
- See who performed the work and when

## Technical Implementation

### Key Components

**ServiceResultsSection Component** (`src/components/services/ServiceResultsSection.tsx`)
- Complete UI for results management
- File upload/download with progress indicators
- Permission-based editing controls
- Terminal status warnings and restrictions

**API Endpoints** (`src/app/api/services/[id]/`)
- `results/route.ts` - GET/PUT for search results
- `attachments/route.ts` - GET/POST for attachment list/upload
- `attachments/[attachmentId]/route.ts` - GET/DELETE for individual files

### Database Schema

**ServicesFulfillment Table Additions:**
- `results` (TEXT) - Search results content
- `resultsAddedBy` (INTEGER) - User ID who first added results
- `resultsAddedAt` (TIMESTAMP) - When results were first added
- `resultsLastModifiedBy` (INTEGER) - User ID who last modified results
- `resultsLastModifiedAt` (TIMESTAMP) - When results were last modified

**ServiceAttachment Table:**
- `id` (INTEGER) - Primary key
- `serviceFulfillmentId` (STRING) - Links to ServicesFulfillment
- `fileName` (STRING) - Original filename
- `filePath` (STRING) - Storage path
- `fileSize` (INTEGER) - File size in bytes
- `uploadedBy` (INTEGER) - User ID who uploaded
- `uploadedAt` (TIMESTAMP) - Upload timestamp

### Security Features

**Authentication & Authorization:**
- All endpoints require authentication via `getServerSession()`
- Role-based permissions enforced server-side
- Vendor assignment verification for data security
- Customer data isolation

**Input Validation & Sanitization:**
- XSS prevention for results text input
- PDF-only file validation
- File size limits (5MB maximum)
- Filename sanitization

**Terminal Status Protection:**
- Services in terminal status (COMPLETED, CANCELLED, CANCELLED_DNB) cannot be modified
- This prevents unauthorized changes to finalized work
- Users must change service status first if editing is required

### File Management

**Storage Structure:**
```
uploads/service-results/
  ├── [order-id]/
  │   └── [service-id]/
  │       ├── [unique-id]_[filename1].pdf
  │       └── [unique-id]_[filename2].pdf
```

**Security Measures:**
- Files stored outside web root
- Unique identifiers prevent filename conflicts
- Original filenames preserved for user experience
- Controlled access through API endpoints only

## Business Rules

### Permission Matrix

| User Type | View Results | Edit Results | View Attachments | Upload/Delete Attachments |
|-----------|--------------|--------------|------------------|---------------------------|
| Customer | Own orders only | ❌ No | Own orders only | ❌ No |
| Vendor | Assigned services | Assigned services | Assigned services | Assigned services |
| Internal (fulfillment.view) | All services | ❌ No | All services | ❌ No |
| Internal (fulfillment.edit) | All services | ✅ Yes | All services | ✅ Yes |

### Terminal Status Rules
- Results and attachments cannot be modified when service status is:
  - `COMPLETED`
  - `CANCELLED`
  - `CANCELLED_DNB`
- Users must change service status to non-terminal before editing
- This ensures data integrity for finalized work

### Audit Trail Requirements
- All result additions/modifications are tracked with user ID and timestamp
- File upload/delete operations create audit log entries
- Audit data is preserved even if users are deleted from system
- Required for compliance and business accountability

## Configuration

### Environment Variables
No additional environment variables required. Uses existing file system storage.

### File Limits
- Maximum file size: 5MB per attachment
- File types: PDF only (`application/pdf`)
- No limit on number of attachments per service

## Integration Points

### ServiceFulfillmentTable Integration
- Visual indicators show when services have results or attachments
- Expandable row sections include ServiceResultsSection component
- Comment counts and results/attachments displayed in unified interface

### Permission System Integration
- Uses existing `useAuth` hook and `checkPermission` utility
- Integrates with vendor assignment verification
- Respects existing role-based access controls

## Error Handling

### Graceful Degradation
- Failed API calls show zero counts rather than breaking UI
- Missing files handled gracefully with appropriate error messages
- Network errors logged with detailed context for debugging

### User Feedback
- Toast notifications for success/error states
- Loading indicators during file operations
- Clear error messages for validation failures

## Monitoring & Logging

### Structured Logging
All operations logged with Winston including:
- User context (ID, type, permissions)
- Action performed (view, edit, upload, delete)
- Service/attachment identifiers
- Performance metrics and error details

### Error Tracking
- API failures logged with request context
- File operation errors include path and permission details
- Client-side errors use `clientLogger` with PII filtering

## Testing Strategy

### Unit Testing
- Component rendering and interaction tests
- API endpoint authentication and authorization tests
- File validation and sanitization tests
- Permission checking logic tests

### Integration Testing
- End-to-end file upload/download workflows
- Permission enforcement across user types
- Terminal status restriction validation
- Audit trail verification

### Manual Testing Checklist
- [ ] Internal users can add/edit results for any service
- [ ] Vendors can only edit assigned services
- [ ] Customers can view but not edit their orders
- [ ] Terminal status prevents editing
- [ ] File upload/download works correctly
- [ ] Audit trails are properly recorded
- [ ] Error handling provides meaningful feedback

## Future Enhancements

### Potential Improvements
- Rich text editor for results formatting
- Support for additional file types (images, documents)
- Bulk upload functionality
- Result templates and standardized formats
- Email notifications when results are added
- Search functionality within results text
- Version history for results and attachments

### Scalability Considerations
- File storage could be moved to cloud storage (S3, etc.)
- Large file handling with streaming uploads
- Attachment preview capabilities
- Compression for better storage efficiency