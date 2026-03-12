# Service Results Block Feature Specification

## Overview

The Service Results Block feature enables internal fulfillment staff and assigned vendors to record search results and attach supporting PDF documents for each service they are fulfilling. This is a core MVP feature that enhances the fulfillment workflow by providing a structured way to document the outcomes of service searches and investigations.

## Business Context

When fulfilling services (background checks, medication sourcing, etc.), internal staff and vendors need to:
- Document what they found during their search/investigation
- Attach relevant PDF reports or documentation
- Provide transparency to customers about the work performed
- Maintain an audit trail of fulfillment activities

## User Stories

### As an internal fulfillment user:
- I want to record detailed search results for each service I'm working on
- I want to attach PDF documents that support my findings
- I want to edit results if I discover additional information
- I want to delete outdated attachments and upload new ones

### As a vendor assigned to a service:
- I want to add search results for services I'm fulfilling
- I want to upload PDF reports and documentation
- I want to update results as I find more information
- I want to manage attachments for my assigned services

### As a customer:
- I want to view the results of services performed for my order
- I want to download PDF attachments related to my services
- I want to understand what work was done to fulfill my request

### As an admin:
- I want to see audit logs of who added/modified results
- I want to ensure only authorized staff can modify results
- I want results to be permanently associated with each service

## Data Requirements

### ServicesFulfillment Table Updates

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Search Results | results | TEXT | No | None (unlimited length) | NULL |
| Added By | resultsAddedBy | INTEGER (User ID) | No | Must be valid user ID | NULL |
| Added At | resultsAddedAt | TIMESTAMP | No | Valid timestamp | NULL |
| Last Modified By | resultsLastModifiedBy | INTEGER (User ID) | No | Must be valid user ID | NULL |
| Last Modified At | resultsLastModifiedAt | TIMESTAMP | No | Valid timestamp | NULL |

### ServiceAttachment Table (New)

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Attachment ID | id | INTEGER | Yes | Auto-increment | Auto |
| Service Fulfillment ID | serviceFulfillmentId | INTEGER | Yes | FK to ServicesFulfillment | - |
| File Name | fileName | VARCHAR(255) | Yes | Not empty, valid filename | - |
| File Path | filePath | VARCHAR(500) | Yes | Valid file system path | - |
| File Size | fileSize | INTEGER | Yes | > 0, <= 5MB | - |
| Uploaded By | uploadedBy | INTEGER | Yes | FK to User | - |
| Uploaded At | uploadedAt | TIMESTAMP | Yes | Valid timestamp | NOW() |

## API Endpoints

### 1. Get Service Results
- **Method**: GET
- **Path**: `/api/services/[id]/results`
- **Parameters**: `[id]` is the OrderItem ID
- **Permissions**:
  - Requires `fulfillment.view` OR `fulfillment.edit` permission for internal users
  - Vendors can view results for their assigned services
  - Customers can view results for their own orders
- **Response**:
  ```json
  {
    "results": "string (search results text) or null",
    "resultsAddedBy": { "email": "string", "firstName": "string", "lastName": "string" },
    "resultsAddedAt": "ISO timestamp or null",
    "resultsLastModifiedBy": { "email": "string", "firstName": "string", "lastName": "string" },
    "resultsLastModifiedAt": "ISO timestamp or null",
    "assignedVendorId": "string or null",
    "status": "string (service status)"
  }
  ```
- **Status Codes**:
  - 200: Success
  - 401: Unauthorized (not authenticated)
  - 403: Forbidden (lacks permission)
  - 404: Service not found or no results exist yet
  - 500: Internal server error

### 2. Update Service Results
- **Method**: PUT
- **Path**: `/api/services/[id]/results`
- **Parameters**: `[id]` is the OrderItem ID
- **Permissions**: Requires `fulfillment.edit` permission OR vendor assigned to the service
- **Request Body**:
  ```json
  {
    "results": "string (search results text)"
  }
  ```
- **Response**: Updated ServicesFulfillment record
- **Validation**: Returns 409 error if service is in terminal status (completed, cancelled, etc.)
- **Audit**: Creates audit log entry for result modification

### 3. Upload PDF Attachment
- **Method**: POST
- **Path**: `/api/services/[id]/attachments`
- **Parameters**: `[id]` is the OrderItem ID
- **Permissions**: Requires `fulfillment.edit` permission OR vendor assigned to the service
- **Request**: Multipart form data with PDF file
- **Validation**:
  - File type must be PDF
  - File size <= 5MB
  - Service must not be in terminal status
- **Response**: Created ServiceAttachment record
- **Storage**: Files saved to `uploads/service-results/[order-id]/[service-id]/`

### 4. List Attachments
- **Method**: GET
- **Path**: `/api/services/[id]/attachments`
- **Parameters**: `[id]` is the OrderItem ID
- **Permissions**:
  - `fulfillment.view` for internal users
  - Vendors can view attachments for their assigned services
  - Customers can view their own order attachments
- **Response**: Array of ServiceAttachment records

### 5. Download Attachment
- **Method**: GET
- **Path**: `/api/services/[id]/attachments/[attachmentId]`
- **Permissions**:
  - `fulfillment.view` for internal users
  - Vendors can download attachments for their assigned services
  - Customers can download their own order attachments
- **Response**: PDF file stream

### 6. Delete Attachment
- **Method**: DELETE
- **Path**: `/api/services/[id]/attachments/[attachmentId]`
- **Permissions**: Requires `fulfillment.edit` permission OR vendor assigned to the service
- **Validation**: Returns 409 error if service is in terminal status
- **Response**: Success/failure status
- **Behavior**: Deletes both database record and file

## UI Components

### Service Fulfillment Table Enhancement
1. Add expandable section to each service row
2. Display results in a readonly textarea for customers
3. Display editable textarea for internal users with `fulfillment.edit` or vendors assigned to the service (disabled if service is in terminal status)
4. Show attachment list with download links
5. Add upload button for internal users and assigned vendors (disabled if service is in terminal status)
6. Show visual indicator (icon/badge) when results or attachments exist

### Results Section Layout
```
[Service Name - Expandable Row]
  ├── Results (textarea)
  │   └── [Multi-line text area, 5 rows default]
  │   └── [Save] [Cancel] buttons (internal users and assigned vendors, disabled if service is in terminal status)
  │
  └── Attachments
      ├── [List of PDF files with download links]
      └── [Upload PDF] button (internal users and assigned vendors, disabled if service is in terminal status)
```

## Business Rules

1. **Permissions**:
   - Users with `fulfillment.edit` can add/edit results for any service
   - Vendors assigned to a service can add/edit results for that service only
   - Users with `fulfillment.edit` can upload/delete attachments for any service
   - Vendors assigned to a service can upload/delete attachments for that service only
   - Customers can view results and download attachments for their own orders only (read-only)

2. **Data Integrity**:
   - Results can be edited multiple times
   - Track who added/modified results and when
   - Attachments are linked to ServicesFulfillment, not directly to OrderItem
   - Deleting a ServicesFulfillment should cascade delete its attachments

3. **File Management**:
   - PDF files only for attachments
   - Maximum 5MB per file
   - Files stored in structured directory: `uploads/service-results/[order-id]/[service-id]/`
   - Original filename preserved but stored with unique identifier

4. **Audit Trail**:
   - Log all result modifications (add/edit)
   - Log all attachment operations (upload/delete)
   - Include user ID, timestamp, and action type

5. **Workflow**:
   - Adding results does NOT automatically change service status
   - Results are optional (service can be completed without results)
   - Results and attachments persist even after service completion
   - Results and attachments cannot be edited when service is in terminal status (completed, cancelled)
   - To edit results/attachments for a completed service, user must first change service status back to non-terminal status

## Security Considerations

1. **Authentication**: All endpoints require authenticated user
2. **Authorization**: Strict permission checks based on user role
3. **File Security**:
   - Validate file type (PDF only)
   - Sanitize filenames
   - Store outside web root
   - Serve through controlled endpoint
4. **Data Access**: Customer can only access their own order data
5. **Input Validation**: Sanitize results text to prevent XSS

## Testing Requirements

### Unit Tests
- Results field CRUD operations
- Attachment upload/download/delete
- Permission checks for each role
- File validation (type, size)

### Integration Tests
- Full workflow: add results → upload PDF → edit results → delete PDF
- Customer view permissions (own orders only)
- Audit logging for all operations

### End-to-End Tests
- Internal user adds results and attachments
- Vendor adds results and attachments for assigned service
- Customer views and downloads attachments
- Permission denial for unauthorized access (vendor trying to edit non-assigned service)
- Edit prevention when service is in terminal status

## Migration Plan

1. Add results fields to ServicesFulfillment table
2. Create ServiceAttachment table
3. Create file storage directory structure
4. No data migration needed (new feature)

## Success Criteria

- Internal users and assigned vendors can successfully add/edit results for services
- Results cannot be edited when service is in terminal status
- PDF attachments can be uploaded and downloaded
- Customers can view results and download PDFs for their orders
- All operations are properly logged for audit
- File uploads are secure and validated
- UI clearly shows which services have results/attachments

## Future Enhancements (Post-MVP)

- Rich text editor for results
- Support for other file types (images, documents)
- Versioning of results and attachments
- Bulk operations for multiple services
- Email notifications when results are added
- Search within results text