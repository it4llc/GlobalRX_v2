# Technical Plan: MVP Completion with Code Cleanup
**Date:** March 10, 2026
**Architect:** Technical Planning Team
**Based on:** docs/specs/mvp-status-audit.md and docs/MVP_STATUS_AUDIT.md

## Overview
This technical plan addresses three phases:
1. **Phase A:** Clean up orphan code from old Order/Service architecture
2. **Phase B:** Implement Service Results Block
3. **Phase C:** Implement Order Status Management

---

## Phase A: Code Cleanup (1-2 days)

### Identified Issues
After analyzing the codebase, I found duplicate order management interfaces:
- `/portal/orders` - Customer portal for order management
- `/fulfillment` - Internal fulfillment dashboard
- `/fulfillment/orders/[id]` - Fulfillment order details

This duplication causes confusion and maintenance overhead.

### Files to REMOVE (Orphan Code)
None identified for complete removal. The dual structure appears intentional:
- Portal is for customers (read-only as of March 10)
- Fulfillment is for internal users (full management)

### Files to CLEAN UP
1. **src/app/fulfillment/page.tsx**
   - Remove any TODO/FIXME comments
   - Clean up unused imports
   - Ensure using latest Order/Service relationship model

2. **src/app/api/fulfillment/orders/[id]/status/route.ts**
   - Verify this handles SERVICE status, not order status
   - May need renaming to avoid confusion

3. **src/app/portal/orders/page.tsx**
   - Remove any edit capabilities (should be read-only for customers)
   - Clean up status management code if present

### Architecture Clarification
The current architecture is:
```
/portal/orders - Customer view (read-only)
/fulfillment - Internal view (full management)
/api/orders - Order-level operations
/api/services - Service-level operations
/api/fulfillment - Fulfillment-specific operations
```

---

## Phase B: Service Results Block (3-4 days)

### Database Changes
1. **Migration: Add results to ServicesFulfillment**
   ```sql
   ALTER TABLE ServicesFulfillment
   ADD COLUMN results TEXT,
   ADD COLUMN results_updated_at TIMESTAMP,
   ADD COLUMN results_updated_by VARCHAR(255);
   ```

2. **Migration: Create ServiceAttachments table**
   ```sql
   CREATE TABLE ServiceAttachments (
     id VARCHAR(36) PRIMARY KEY,
     service_fulfillment_id VARCHAR(36) NOT NULL,
     filename VARCHAR(255) NOT NULL,
     file_path TEXT NOT NULL,
     file_size INTEGER,
     mime_type VARCHAR(100),
     uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     uploaded_by VARCHAR(255),
     FOREIGN KEY (service_fulfillment_id)
       REFERENCES ServicesFulfillment(id) ON DELETE CASCADE
   );
   ```

### New API Endpoints
1. **PUT /api/services/[id]/results**
   - Update results text for a service
   - Auth: Requires fulfillment.edit permission
   - Input validation with Zod
   - Audit trail in results_updated_by/at

2. **POST /api/services/[id]/attachments**
   - Upload PDF attachment
   - Max file size: 10MB
   - Allowed types: application/pdf only
   - Store in: /uploads/services/[serviceId]/

3. **GET /api/services/[id]/attachments**
   - List all attachments for a service
   - Returns metadata only

4. **GET /api/services/[id]/attachments/[attachmentId]**
   - Download specific attachment
   - Stream file response

5. **DELETE /api/services/[id]/attachments/[attachmentId]**
   - Remove attachment
   - Soft delete recommended

### UI Components
1. **Update: src/app/fulfillment/orders/[id]/page.tsx**
   - Add ResultsSection component
   - Include textarea for results entry
   - Add file upload area for PDFs
   - Display list of attached files

2. **Create: src/components/services/ResultsSection.tsx**
   ```tsx
   - Textarea with auto-save
   - Character count
   - Last saved indicator
   - PDF upload dropzone
   - Attachment list with download/delete
   ```

3. **Create: src/components/services/AttachmentUploader.tsx**
   ```tsx
   - Drag-and-drop interface
   - Progress indicator
   - File validation
   - Error handling
   ```

### Files to Create
- `prisma/migrations/XXX_add_service_results.sql`
- `src/app/api/services/[id]/results/route.ts`
- `src/app/api/services/[id]/attachments/route.ts`
- `src/app/api/services/[id]/attachments/[attachmentId]/route.ts`
- `src/components/services/ResultsSection.tsx`
- `src/components/services/AttachmentUploader.tsx`
- `src/lib/file-storage.ts` (file handling utilities)

### Files to Modify
- `src/app/fulfillment/orders/[id]/page.tsx` - Add results section
- `prisma/schema.prisma` - Add new fields and table
- `.env.example` - Add UPLOAD_DIR variable

---

## Phase C: Order Status Management (1-2 days)

### Database Changes
1. **Verify orders table has status field**
   - Check if exists: status, statusCode, or status_code
   - If missing, add migration

2. **Create OrderStatusHistory table**
   ```sql
   CREATE TABLE OrderStatusHistory (
     id VARCHAR(36) PRIMARY KEY,
     order_id VARCHAR(36) NOT NULL,
     old_status VARCHAR(50),
     new_status VARCHAR(50) NOT NULL,
     changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     changed_by VARCHAR(255) NOT NULL,
     notes TEXT,
     FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE
   );
   ```

### API Endpoints
1. **PUT /api/orders/[id]/status**
   - Update order-level status
   - Auth: Requires orders.edit or admin permission
   - Input: { status: string, notes?: string }
   - Create audit entry in OrderStatusHistory
   - Trigger any status-based business logic

2. **GET /api/orders/[id]/status-history**
   - Retrieve status change history
   - Auth: Requires orders.view permission
   - Paginated response

### UI Components
1. **Update: src/app/fulfillment/orders/[id]/page.tsx**
   - Add OrderStatusDropdown component
   - Position prominently (top of page)
   - Show current status with color coding
   - Add change confirmation dialog

2. **Create: src/components/orders/OrderStatusDropdown.tsx**
   ```tsx
   - Status select dropdown
   - Color-coded options
   - Confirmation modal
   - Optional notes field
   - Loading state during update
   ```

3. **Create: src/components/orders/StatusHistory.tsx**
   ```tsx
   - Timeline view of status changes
   - Show who changed and when
   - Display notes if present
   ```

### Status Options
```typescript
const ORDER_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'submitted', label: 'Submitted', color: 'blue' },
  { value: 'in_progress', label: 'In Progress', color: 'yellow' },
  { value: 'completed', label: 'Completed', color: 'green' },
  { value: 'cancelled', label: 'Cancelled', color: 'red' },
  { value: 'on_hold', label: 'On Hold', color: 'orange' }
];
```

### Files to Create
- `prisma/migrations/XXX_add_order_status_history.sql`
- `src/app/api/orders/[id]/status/route.ts`
- `src/app/api/orders/[id]/status-history/route.ts`
- `src/components/orders/OrderStatusDropdown.tsx`
- `src/components/orders/StatusHistory.tsx`

### Files to Modify
- `src/app/fulfillment/orders/[id]/page.tsx` - Add status dropdown
- `prisma/schema.prisma` - Add OrderStatusHistory model
- `src/lib/constants.ts` - Add ORDER_STATUSES constant

---

## Implementation Order

### Day 1-2: Phase A - Code Cleanup
1. Review and clean up fulfillment/page.tsx
2. Clarify service vs order status endpoints
3. Ensure portal/orders is read-only
4. Document the architecture clearly
5. Run tests to ensure nothing breaks

### Day 3-5: Phase B - Service Results Block
1. Create database migrations
2. Implement results API endpoint
3. Build ResultsSection component
4. Add to fulfillment order details page
5. Test results saving/loading
6. Implement attachment upload API
7. Build AttachmentUploader component
8. Test PDF upload/download
9. Add comprehensive tests

### Day 6-7: Phase C - Order Status Management
1. Verify/add status field to orders
2. Create status history table
3. Implement status update API
4. Build OrderStatusDropdown component
5. Add to fulfillment order details
6. Implement status history API
7. Add status history display
8. Test complete flow
9. Add comprehensive tests

---

## Testing Requirements

### Phase A Tests
- Verify no broken links after cleanup
- Ensure customer portal remains read-only
- Confirm fulfillment dashboard works

### Phase B Tests
- Results save and retrieve correctly
- PDF upload with size validation
- PDF download works
- Multiple attachments handling
- Permission checks enforced
- Audit trail maintained

### Phase C Tests
- Status changes save correctly
- History tracks all changes
- Permissions enforced (internal only)
- Status colors display correctly
- Confirmation dialog works
- Invalid status transitions blocked

---

## Dependencies
- No external library dependencies needed
- Uses existing NextAuth for permissions
- Uses existing Prisma for database
- Uses existing UI components library

---

## Risks and Mitigations
1. **File Upload Security**
   - Mitigation: Validate file types, scan for malware, limit size

2. **Status Transition Logic**
   - Mitigation: Start simple, add rules post-MVP if needed

3. **Performance with Large Files**
   - Mitigation: Stream files, implement chunked uploads if needed

4. **Orphan Code Confusion**
   - Mitigation: Clear documentation of portal vs fulfillment purpose

---

## Definition of Done
- [ ] All orphan code cleaned up or documented
- [ ] Service results can be entered and saved
- [ ] PDFs can be uploaded and downloaded
- [ ] Order status can be changed by internal users
- [ ] Status history is tracked
- [ ] All new code has tests
- [ ] All new endpoints have auth checks
- [ ] Documentation updated
- [ ] No TypeScript errors introduced
- [ ] Existing tests still pass