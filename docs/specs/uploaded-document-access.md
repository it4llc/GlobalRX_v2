# Feature Specification: Uploaded Document Access

**Spec file:** `docs/specs/uploaded-document-access.md`
**Date:** 2026-04-17
**Requested by:** Andy
**Status:** Approved

## Summary
Make document filenames clickable links in the order item details view, allowing users to directly download documents that were uploaded during order submission or fulfillment. This applies to both documents attached at order creation (stored in order_data table) and documents added during fulfillment (stored in service_attachments table).

## Who Uses This
- **Internal admins** - Can view and download all documents for any order
- **Customer users** - Can view and download documents for their own orders only
- **Vendor users** - Can view and download documents for services assigned to them

## Business Rules
1. Document filenames must be displayed as clickable links with visual styling to indicate they are interactive (blue text color, underline on hover)
2. Access control follows existing view permissions - if you can see the order item details, you can download its documents
3. Clicking a document opens it in a new browser tab when the browser can display it (PDFs, images), otherwise triggers a download
4. Documents from order_data table (uploaded at order creation) must be accessible via their storagePath
5. Documents from service_attachments table (uploaded during fulfillment) must be accessible via existing attachment download API
6. If a document file is missing from the server, display an error message instead of breaking the UI
7. The download functionality must work for all file types that were accepted during upload (PDFs, images, etc.)
8. Document links must include the file size in parentheses next to the filename for user reference

## User Flow
1. The user navigates to the order details page or fulfillment page
2. The user expands an order item row to see its details
3. In the "Submitted Information" section, document fields show the filename as blue underlined text instead of plain text
4. The user hovers over a document filename and sees the cursor change to a pointer
5. The user clicks on a document filename
6. If the document is a PDF or image:
   - A new browser tab opens displaying the document
   - The user can use browser controls to save, print, or close the document
7. If the document is another file type:
   - The browser's download dialog appears
   - The user chooses where to save the file
8. If the document file cannot be found:
   - An error toast appears saying "Document not available"
   - The user remains on the same page

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Document Filename | filename | text | Required | From document.filename in hydrated data | — |
| File Size | size | number | Required | From document.size in hydrated data | — |
| Storage Path | storagePath | text | Required | From document.storagePath in hydrated data | — |
| MIME Type | mimeType | text | Required | From document.mimeType in hydrated data | — |
| Download URL | downloadUrl | text | Generated | Built from storagePath or attachment ID | — |
| Link Target | target | text | Required | Always "_blank" for new tab | _blank |
| Link Rel | rel | text | Required | "noopener noreferrer" for security | noopener noreferrer |

## Edge Cases and Error Scenarios
1. **File not found on server** - Show error toast "Document not available", log error to console
2. **User lacks permission** - Links should not be rendered if user cannot view the order item (handled by existing access control)
3. **Network failure during download** - Browser handles this with its standard download error messaging
4. **Corrupt or invalid file** - Browser handles this when attempting to display/download
5. **Storage path is null/empty** - Render as plain text without link
6. **Document metadata is malformed** - Render as plain text without link, log warning to console
7. **User clicks while previous download in progress** - Browser handles multiple downloads normally

## Impact on Other Modules
- **ServiceRequirementsDisplay component** - Must be updated to render document fields as links
- **Order data hydration** - Already provides document metadata, no changes needed
- **Download API endpoints** - May need new endpoint for order_data documents if not already available
- **Security/permissions** - Leverages existing view permissions, no new permission checks needed

## Definition of Done
1. Document filenames appear as blue clickable links in the Submitted Information section
2. Clicking a document link opens it in a new tab (for viewable types) or downloads it
3. Links include file size in parentheses (e.g., "document.pdf (271 KB)")
4. Links have proper hover effects (underline, pointer cursor)
5. Error handling shows toast message for missing files
6. Works for both order_data documents (from order creation) and service_attachments (from fulfillment)
7. Existing permission model is maintained - users can only download documents they can view
8. All existing tests continue to pass
9. New tests cover the link rendering and error cases
10. No console errors or warnings in normal operation

## Open Questions
None - all requirements have been clarified.