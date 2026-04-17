# Technical Plan: Uploaded Document Access
**Based on specification:** docs/specs/uploaded-document-access.md (2026-04-17)
**Date:** 2026-04-17

## Database Changes
No database changes are needed. The existing order_data table already stores document metadata in the fieldValue column as JSON containing storagePath, originalName, mimeType, and size fields.

## New Files to Create

### 1. /src/lib/services/document-download.service.ts
- **Purpose:** Shared utility for document download logic used by all three API endpoints
- **Contents:**
  - `getDocumentFromOrderData(orderDataId: string)`: Fetches document metadata from order_data record
  - `validateFilePath(filePath: string)`: Prevents path traversal attacks
  - `streamFile(filePath: string, filename: string, mimeType: string)`: Creates NextResponse with file stream
  - Error handling for missing files
  - Logging for audit trail

### 2. /src/app/api/portal/documents/[documentId]/route.ts
- **Purpose:** API endpoint for customer portal document downloads
- **Contents:** GET handler for downloading documents from order_data

### 3. /src/app/api/fulfillment/documents/[documentId]/route.ts
- **Purpose:** API endpoint for internal/admin fulfillment document downloads
- **Contents:** GET handler for downloading documents from order_data

### 4. /src/app/api/vendor/documents/[documentId]/route.ts
- **Purpose:** API endpoint for vendor document downloads
- **Contents:** GET handler for downloading documents from order_data

## Existing Files to Modify

### 1. /src/components/services/ServiceRequirementsDisplay.tsx
- **Currently exists:** Renders document fields as plain text with filename and file size
- **What needs to change:** 
  - Add new props: `userType` (from useAuth), `orderId` (from parent)
  - For document fields, wrap filename in an anchor tag that links to appropriate download endpoint
  - Add blue text color and underline on hover styling
  - Add target="_blank" and rel="noopener noreferrer" attributes
  - Handle missing documents with error toast
- **Confirmed:** File was read and analyzed (lines 162-187 contain document rendering logic)

### 2. /src/components/fulfillment/ServiceFulfillmentTable.tsx
- **Currently exists:** Renders ServiceRequirementsDisplay without passing userType or orderId props (line 1153)
- **What needs to change:**
  - Import useAuth hook to get userType
  - Get orderId from the service object (service.orderId)
  - Pass both userType and orderId props to ServiceRequirementsDisplay
- **Confirmed:** File was read and analyzed (line 1153 shows the component usage)

## API Routes

### 1. GET /api/portal/documents/[documentId]
- **HTTP methods:** GET
- **Authentication:** Customer portal user required (session.user.userType === 'customer')
- **Authorization:** Customer must own the order containing this document
- **Input:** documentId path parameter (the order_data record ID)
- **Validation:** 
  - documentId must be valid UUID
  - Document must belong to customer's order
- **Success response:** File stream with appropriate Content-Type and Content-Disposition headers
- **Error handling:**
  - 401: Not authenticated
  - 403: Not authorized (document belongs to different customer)
  - 404: Document not found or file missing on disk
  - 500: Server error

### 2. GET /api/fulfillment/documents/[documentId]
- **HTTP methods:** GET
- **Authentication:** Internal or admin user required
- **Authorization:** Must have fulfillment.view permission
- **Input:** documentId path parameter (the order_data record ID)
- **Validation:**
  - documentId must be valid UUID
  - User must have fulfillment.view permission
- **Success response:** File stream with appropriate Content-Type and Content-Disposition headers
- **Error handling:**
  - 401: Not authenticated
  - 403: Insufficient permissions
  - 404: Document not found or file missing on disk
  - 500: Server error

### 3. GET /api/vendor/documents/[documentId]
- **HTTP methods:** GET
- **Authentication:** Vendor user required (session.user.userType === 'vendor')
- **Authorization:** Service must be assigned to vendor's organization
- **Input:** documentId path parameter (the order_data record ID)
- **Validation:**
  - documentId must be valid UUID
  - Service must be assigned to vendor's vendorId
- **Success response:** File stream with appropriate Content-Type and Content-Disposition headers
- **Error handling:**
  - 401: Not authenticated
  - 403: Service not assigned to vendor
  - 404: Document not found or file missing on disk
  - 500: Server error

## Zod Validation Schemas

### documentIdSchema
- **Field:** documentId
- **Type:** string
- **Validation:** UUID format check using z.string().uuid()

## TypeScript Types

No new types needed. Existing types from order-data-hydration.ts are sufficient (DocumentMetadata, HydratedOrderDataRecord).

## UI Components

### ServiceRequirementsDisplay (modified)
- **File path:** /src/components/services/ServiceRequirementsDisplay.tsx
- **Type:** Client component (already has "use client" based on React.memo usage)
- **New props:**
  - userType: 'customer' | 'vendor' | 'internal' | 'admin'
  - orderId: string
- **Renders:** 
  - For document fields: anchor tag wrapping filename
  - Link href built from userType, orderId, and document requirementId
  - Blue text (text-blue-600) with hover underline (hover:underline)
- **Uses:** useToast hook for error messages
- **API routes called:** 
  - /api/portal/documents/[id] (for customers)
  - /api/fulfillment/documents/[id] (for internal/admin)
  - /api/vendor/documents/[id] (for vendors)

## Translation Keys

### serviceRequirements.document.notAvailable
- **Key:** serviceRequirements.document.notAvailable
- **English value:** "Document not available"

### serviceRequirements.document.downloadError
- **Key:** serviceRequirements.document.downloadError
- **English value:** "Failed to download document"

## Order of Implementation

1. Create shared document download service (/src/lib/services/document-download.service.ts)
2. Create portal documents API route (/src/app/api/portal/documents/[documentId]/route.ts)
3. Create fulfillment documents API route (/src/app/api/fulfillment/documents/[documentId]/route.ts)
4. Create vendor documents API route (/src/app/api/vendor/documents/[documentId]/route.ts)
5. Modify ServiceRequirementsDisplay component to add download links
6. Modify ServiceFulfillmentTable to pass required props to ServiceRequirementsDisplay
7. Add translation keys to the translation system

## Risks and Considerations

1. **Path traversal security:** The shared utility must validate that file paths don't contain ".." or absolute paths that could access files outside the uploads directory
2. **Large file handling:** Files are streamed rather than loaded entirely into memory to prevent OOM for large documents
3. **MIME type accuracy:** The mimeType from order_data should be trusted over file extension detection
4. **Missing files:** If a file exists in the database but not on disk (e.g., accidentally deleted), show user-friendly error rather than 500
5. **Browser compatibility:** Using target="_blank" means PDFs will open in new tabs on modern browsers, but behavior may vary
6. **Performance:** Consider adding caching headers for document downloads since they're immutable once uploaded

## documentId Clarification

The `documentId` parameter in the API routes is the primary key ID (UUID) of the order_data record. Each order_data record represents a single field submission, and for document-type fields, the fieldValue column contains a JSON object with the document metadata. The documentId directly identifies which order_data row to fetch, and from that row's fieldValue JSON, we extract the storagePath to locate the actual file on disk.

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] All parent components that render ServiceRequirementsDisplay are included in modifications
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table (field names match)
- [x] documentId is clearly defined as the order_data record's primary key
- [x] Shared utility for file streaming is included to avoid code duplication
