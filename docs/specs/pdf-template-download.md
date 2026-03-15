# Feature Specification: PDF Template Download for Customer Orders
**Date:** March 14, 2026
**Requested by:** Andy
**Status:** Approved

## Summary
This feature enables customer users to download PDF template files for required or optional documents while creating orders through the `/portal/orders/new` interface. PDF templates are uploaded by administrators through the Data Rx tab and made available to customers during order creation to help them prepare documents before submission.

## Who Uses This
- **Customer Users** (portal users creating orders): Can download PDF templates when available for documents in Step 4 of order creation
- **Admin Users** (Data Rx managers): Upload and manage PDF templates through the Data Rx Documents tab (existing functionality)
- **Candidates**: No direct interaction with this feature

## Business Rules
1. PDF template downloads are only available to authenticated customer users creating or editing orders
2. A download button only appears when a PDF template has been uploaded for that specific document requirement
3. If no PDF template exists for a document, no download button or indicator appears (clean interface)
4. The download button appears to the right of the document description and instructions in Step 4 "Documents & Review"
5. PDF downloads must go through a secure API endpoint that validates user authentication
6. Customer users can download templates multiple times during order creation
7. Template downloads do not count as document uploads - customers must still upload their completed documents
8. PDF templates are the same for all customers (global templates, not customer-specific)
9. Download availability is determined by the presence of a `pdfPath` value in the document's data
10. Downloads must maintain the original filename provided by the admin who uploaded the template
11. No download tracking/analytics will be implemented in this version
12. No rate limiting on downloads
13. File size will be displayed next to the download button
14. No watermarking of downloaded PDFs

## User Flow
1. The customer user logs into the portal and navigates to `/portal/orders/new`
2. The user proceeds through Steps 1-3 (Service Selection, Subject Info, Search Details)
3. Upon reaching Step 4 "Documents & Review", the user sees the list of required/optional documents
4. For each document that has a PDF template available:
   - A "Download Form" button appears to the right of the document instructions
   - The file size is displayed next to the button (e.g., "Download Form (2.3 MB)")
   - The button has a download icon and is styled consistently with other action buttons
5. The user clicks the "Download Form" button
6. The system validates the user's authentication
7. The PDF file downloads to the user's device with the original filename
8. The user can prepare the document offline using the template
9. The user returns to the form and uploads their completed document using the existing "Choose File" button
10. The user continues with order submission as normal

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Download Form | - | Button | No | Only shown if pdfPath exists | Hidden |
| PDF Path | pdfPath | String (in documentData JSON) | No | Valid file path on server | null |
| Has Template | hasTemplate | Boolean (computed) | No | Derived from pdfPath presence | false |
| Document ID | documentId | String (UUID) | Yes | Valid DSXRequirement ID | - |
| Template Filename | filename | String | No | Extracted from pdfPath | document.pdf |
| File Size | fileSize | Number | No | Bytes, converted to MB for display | 0 |

## Edge Cases and Error Scenarios
1. **PDF template file missing from server**: If the file referenced by `pdfPath` doesn't exist on the server, return 404 with message "Template file not found. Please contact support."
2. **User not authenticated**: If session expires during order creation, clicking download returns 401 and redirects to login
3. **Invalid document ID**: If someone tampers with the request to use an invalid document ID, return 404 "Document not found"
4. **Network failure during download**: Browser handles standard download retry/resume functionality
5. **Large PDF files**: Files are limited at upload time in Data Rx module
6. **Concurrent downloads**: Users can download multiple templates simultaneously without conflicts
7. **PDF path exists but empty string**: Treat as no template available (no download button shown)
8. **Document disabled in Data Rx**: If document is disabled after page load, download returns 404 "This document template is no longer available"
9. **Missing permissions**: Although all authenticated customers should have access, if permissions check fails, return 403 "Access denied"
10. **Malformed documentData JSON**: If documentData cannot be parsed, treat as no template available

## Impact on Other Modules
- **Data Rx Module**: File size limits should be enforced at upload time (existing functionality)
- **Order Creation Flow**: Visual enhancement to Step 4 only, no impact on order submission logic
- **API Routes**: New endpoint `/api/portal/documents/[id]/download-template` needs to be created
- **Order Review**: No impact - template downloads are separate from uploaded documents
- **Order Editing**: Feature should also work when editing draft orders at `/portal/orders/[id]/edit`
- **Authentication System**: Uses existing authentication - no new permissions needed

## Definition of Done
1. "Download Form" button appears for documents with PDF templates in Step 4 of order creation
2. Download button is positioned to the right of document instructions
3. File size is displayed next to the button in human-readable format (e.g., "2.3 MB")
4. No visual indicator appears for documents without templates
5. Clicking download button initiates PDF download with original filename
6. API endpoint validates user authentication before serving file
7. API endpoint returns appropriate error codes for edge cases
8. Download works for both new orders and when editing draft orders
9. Feature is tested with various file sizes
10. Network failures are handled gracefully by browser
11. Concurrent downloads of multiple templates work correctly
12. Frontend gracefully handles API errors with user-friendly messages
13. Performance is acceptable for typical PDF files
14. Mobile users can successfully download templates
15. Downloaded files open correctly in standard PDF readers

## Technical Notes
- Button text: "Download Form"
- No download tracking/analytics in this version
- No rate limiting on downloads
- File size display required next to button
- No PDF watermarking
- File size limits enforced at upload time in Data Rx module