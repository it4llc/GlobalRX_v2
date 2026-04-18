# Technical Plan: Uploaded Document Access
**Based on specification:** docs/specs/uploaded-document-access.md (2026-04-17)
**Date:** 2026-04-17
**Implementation Status:** COMPLETED (2026-04-18)

## Database Changes
No database changes were needed. The existing order_data table already stores document metadata in the fieldValue column as JSON containing storagePath, originalName, mimeType, and size fields.

**Implementation Note:** The hydration service was enhanced to include the `orderDataId` field in `HydratedOrderDataRecord` objects to enable document linking.

## New Files to Create

### 1. /src/lib/services/document-download.service.ts ✅ CREATED
- **Purpose:** Shared utility for document download logic used by both API endpoints
- **Implementation:**
  - `validateFilePath(filePath: string)`: Prevents path traversal attacks
  - `getDocumentFromOrderData(orderDataId: string, session: Session | null)`: Fetches document metadata with access control
  - `streamFile(filePath: string, mimeType: string)`: Creates NextResponse with file stream and proper headers
  - Full error handling for missing files and access violations
  - Structured logging using Winston logger

### 2. /src/app/api/portal/documents/[id]/route.ts ✅ CREATED
- **Purpose:** API endpoint for customer portal document downloads
- **Implementation:** GET handler that validates customer ownership before allowing download
- **Folder name:** Used `[id]` instead of `[documentId]` for consistency with other routes

### 3. /src/app/api/fulfillment/documents/[id]/route.ts ✅ CREATED
- **Purpose:** API endpoint for internal/admin/vendor document downloads
- **Implementation:** GET handler that allows internal/admin full access, vendors only to assigned orders
- **Folder name:** Used `[id]` instead of `[documentId]` for consistency with other routes

### 4. /src/app/api/vendor/documents/[documentId]/route.ts ❌ NOT CREATED
- **Decision:** Vendor access was consolidated into the fulfillment endpoint since vendors are part of the fulfillment workflow
- **Rationale:** Reduces code duplication and maintains clearer separation between customer and non-customer access

## Existing Files to Modify

### 1. /src/components/services/ServiceRequirementsDisplay.tsx ✅ MODIFIED
- **Implementation:**
  - Added `userType` prop to determine which API endpoint to use
  - Wrapped document filenames in anchor tags with download links
  - Added blue text styling (`text-blue-600 hover:underline`)
  - Links use `target="_blank"` and `rel="noopener noreferrer"` for security
  - Uses `orderDataId` from hydrated data to construct download URLs
  - Removed debug console.log statements

### 2. /src/components/fulfillment/ServiceFulfillmentTable.tsx ✅ MODIFIED
- **Implementation:**
  - Imported and used useAuth hook to get userType
  - Passes userType prop to ServiceRequirementsDisplay
  - Note: orderId was not needed as the orderDataId is included in hydrated data

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

### 3. GET /api/vendor/documents/[documentId] ❌ NOT IMPLEMENTED
- **Reason:** Vendor access was consolidated into the /api/fulfillment/documents/[id] endpoint
- **How it works:** The fulfillment endpoint checks if user is vendor type and validates assignment

## Zod Validation Schemas ❌ NOT IMPLEMENTED

**Decision:** Zod validation was not needed as the API routes only use path parameters which are validated through database queries. The document ID validation happens implicitly when querying the order_data table.

## TypeScript Types ✅ UPDATED

Enhanced existing types in order-data-hydration.ts:
- Added `orderDataId?: string` field to `HydratedOrderDataRecord` interface
- This field is populated in all hydration paths to enable document download linking

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

## Order of Implementation ✅ COMPLETED

1. ✅ Created shared document download service
2. ✅ Created portal documents API route (as [id] not [documentId])
3. ✅ Created fulfillment documents API route (as [id] not [documentId])
4. ❌ Skipped vendor route (consolidated into fulfillment)
5. ✅ Modified ServiceRequirementsDisplay component
6. ✅ Modified ServiceFulfillmentTable component
7. ❌ Translation keys were not needed (using existing error handling)

## Risks and Considerations

1. **Path traversal security:** The shared utility must validate that file paths don't contain ".." or absolute paths that could access files outside the uploads directory
2. **Large file handling:** Files are streamed rather than loaded entirely into memory to prevent OOM for large documents
3. **MIME type accuracy:** The mimeType from order_data should be trusted over file extension detection
4. **Missing files:** If a file exists in the database but not on disk (e.g., accidentally deleted), show user-friendly error rather than 500
5. **Browser compatibility:** Using target="_blank" means PDFs will open in new tabs on modern browsers, but behavior may vary
6. **Performance:** Consider adding caching headers for document downloads since they're immutable once uploaded

## documentId Clarification

The `documentId` parameter in the API routes is the primary key ID (UUID) of the order_data record. Each order_data record represents a single field submission, and for document-type fields, the fieldValue column contains a JSON object with the document metadata. The documentId directly identifies which order_data row to fetch, and from that row's fieldValue JSON, we extract the storagePath to locate the actual file on disk.

## Implementation Notes

### Additional Work Completed
1. **Bug fix in order-core.service.ts:** Fixed issue where `uploadedDocuments` parameter was accepted but never saved to order_data. Documents are now properly persisted with `fieldType: 'document'`.

2. **Hydration service enhancement:** Modified `order-data-hydration.service.ts` to populate the `orderDataId` field in all hydration code paths (with fallback, without fallback, and vendor paths).

3. **Service fulfillment fix:** Corrected the relation name from `servicesFulfillment` to `serviceFulfillment` in the document download service.

### Deviations from Plan
1. **Two endpoints instead of three:** Vendor endpoint was not created separately; vendor access is handled through the fulfillment endpoint.
2. **Folder naming:** Used `[id]` instead of `[documentId]` for consistency with other API routes.
3. **No Zod schemas:** Path parameter validation happens through database queries rather than explicit schema validation.
4. **No translation keys:** Existing error handling patterns were sufficient.

## Final Implementation Check

- [x] Document links are clickable and blue in the UI
- [x] Customer access control is enforced
- [x] Vendor access control is enforced (only assigned orders)
- [x] Internal/admin users have full access
- [x] Files stream properly with correct headers
- [x] Path traversal attacks are prevented
- [x] Missing files return 404 errors
- [x] All existing tests continue to pass
