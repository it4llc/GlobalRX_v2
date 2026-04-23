# Technical Plan: Candidate Invite Phase 2 — Workflow Configuration

**Based on specification:** candidate-invite-phase2-workflow-configuration.md (April 21, 2026)
**Date:** April 21, 2026
**Created by:** Architect Agent
**Revised:** April 22, 2026 - Integrated CandidateInvitation table and additional business rules

## Database Changes

### Migration Rationale
This migration includes both Phase 2 workflow configuration changes and the Phase 3 CandidateInvitation table to minimize database migrations. Creating the CandidateInvitation table now is more efficient from a database management perspective - it avoids a second migration later and ensures all foreign key relationships are properly established. The table will remain unused until Phase 3 APIs are implemented.

### Migration SQL
```sql
-- Add new fields to workflow_sections table (Phase 2)
ALTER TABLE workflow_sections
ADD COLUMN placement VARCHAR(20) NOT NULL DEFAULT 'before_services',
ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'text',
ADD COLUMN content TEXT,
ADD COLUMN file_url VARCHAR(500),
ADD COLUMN file_name VARCHAR(255);

-- Add constraint for placement values
ALTER TABLE workflow_sections
ADD CONSTRAINT check_placement CHECK (placement IN ('before_services', 'after_services'));

-- Add constraint for type values
ALTER TABLE workflow_sections
ADD CONSTRAINT check_type CHECK (type IN ('text', 'document'));

-- Note: No unique constraint on name field - section names CAN be duplicated

-- Add new fields to workflows table (Phase 2)
ALTER TABLE workflows
ADD COLUMN email_subject VARCHAR(200),
ADD COLUMN email_body TEXT,
ADD COLUMN gap_tolerance_days INTEGER;

-- Add constraint for gap_tolerance_days
ALTER TABLE workflows
ADD CONSTRAINT check_gap_tolerance CHECK (gap_tolerance_days IS NULL OR (gap_tolerance_days >= 1 AND gap_tolerance_days <= 365));

-- Create CandidateInvitation table (Phase 3 - created now for efficiency)
-- This table will store invitation data when customers invite candidates to complete applications
CREATE TABLE candidate_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone_country_code VARCHAR(10),
  phone_number VARCHAR(50),
  password_hash VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  completed_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_invitation_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitation_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_invitation_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT check_invitation_status CHECK (status IN ('draft', 'sent', 'accessed', 'completed', 'expired'))
);

-- Create indexes for CandidateInvitation table for future query performance
CREATE INDEX idx_candidate_invitations_token ON candidate_invitations(token);
CREATE INDEX idx_candidate_invitations_order_id ON candidate_invitations(order_id);
CREATE INDEX idx_candidate_invitations_customer_id ON candidate_invitations(customer_id);
CREATE INDEX idx_candidate_invitations_email ON candidate_invitations(email);
CREATE INDEX idx_candidate_invitations_status ON candidate_invitations(status);
CREATE INDEX idx_candidate_invitations_expires_at ON candidate_invitations(expires_at);
```

### Prisma Schema Changes

#### Update WorkflowSection model
In `prisma/schema.prisma`, update the `WorkflowSection` model:
```prisma
model WorkflowSection {
  id               String   @id @default(uuid())
  workflowId       String
  name             String   // Not unique - duplicates allowed
  displayOrder     Int
  isRequired       Boolean  @default(true)
  dependsOnSection String?
  dependencyLogic  String?
  placement        String   @default("before_services")  // New field
  type             String   @default("text")             // New field
  content          String?  @db.Text                     // New field
  fileUrl          String?  @map("file_url")             // New field
  fileName         String?  @map("file_name")            // New field
  createdAt        DateTime @default(now()) @db.Timestamptz(6)
  updatedAt        DateTime @default(now()) @updatedAt @db.Timestamptz(6)
  workflow         Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)

  @@map("workflow_sections")
}
```

#### Update Workflow model
In the `Workflow` model, add:
```prisma
  emailSubject      String?   @map("email_subject")      // New field
  emailBody         String?   @db.Text @map("email_body") // New field
  gapToleranceDays  Int?      @map("gap_tolerance_days") // New field
```

#### Add CandidateInvitation model (Phase 3 - added now for efficiency)
Add this new model to `prisma/schema.prisma`:
```prisma
model CandidateInvitation {
  id               String    @id @default(uuid())
  orderId          String    @map("order_id")
  customerId       String    @map("customer_id")
  token            String    @unique
  firstName        String    @map("first_name")
  lastName         String    @map("last_name")
  email            String
  phoneCountryCode String?   @map("phone_country_code")
  phoneNumber      String?   @map("phone_number")
  passwordHash     String?   @map("password_hash")
  status           String    @default("draft")
  expiresAt        DateTime  @db.Timestamptz(6) @map("expires_at")
  createdAt        DateTime  @default(now()) @db.Timestamptz(6) @map("created_at")
  createdBy        String    @map("created_by")
  completedAt      DateTime? @db.Timestamptz(6) @map("completed_at")
  lastAccessedAt   DateTime? @db.Timestamptz(6) @map("last_accessed_at")
  updatedAt        DateTime  @default(now()) @updatedAt @db.Timestamptz(6) @map("updated_at")

  order            Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  customer         Customer  @relation(fields: [customerId], references: [id], onDelete: Cascade)
  creator          User      @relation(fields: [createdBy], references: [id])

  @@index([token])
  @@index([orderId])
  @@index([customerId])
  @@index([email])
  @@index([status])
  @@index([expiresAt])
  @@map("candidate_invitations")
}
```

Also update the related models to include the relation:
- In `Order` model: `candidateInvitations CandidateInvitation[]`
- In `Customer` model: `candidateInvitations CandidateInvitation[]`
- In `User` model: `createdCandidateInvitations CandidateInvitation[]`

## New Files to Create

### 1. `/src/app/api/workflows/[id]/sections/[sectionId]/upload/route.ts`
**Purpose:** Handle document upload for workflow sections
**Contains:** POST endpoint for uploading PDF/Word/DOC files to sections of type `document`
**Pattern to follow:** Same as `/src/app/api/services/[id]/attachments/route.ts` but:
- Allowed file types: `.pdf`, `.docx`, `.doc` only (no images per business rule)
- Store files in `uploads/workflow-documents/[workflowId]/[sectionId]/`
- Update WorkflowSection record with fileUrl and fileName
- Use FormData for file upload (per COMPONENT_STANDARDS Section 4)
- Validate section type is "document" before accepting upload
- Files cascade delete with workflow (handled by filesystem cleanup)

### 2. `/src/types/workflow-section.ts`
**Purpose:** TypeScript types for workflow sections with proper validation
**Contains:**
```typescript
import { z } from 'zod';

// Placement enum
export const PlacementEnum = z.enum(['before_services', 'after_services']);

// Section type enum  
export const SectionTypeEnum = z.enum(['text', 'document']);

// Section count limits per business rules
export const MAX_SECTIONS_PER_PLACEMENT = 10;

// Updated section schemas
export const workflowSectionSchema = z.object({
  name: z.string().min(1).max(100), // No uniqueness requirement
  placement: PlacementEnum,
  type: SectionTypeEnum,
  content: z.string().max(50000).optional(), // 50K char limit
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  displayOrder: z.number().int().nonnegative(),
  isRequired: z.boolean().default(true),
});

export const workflowSectionCreateSchema = workflowSectionSchema;
export const workflowSectionUpdateSchema = workflowSectionSchema.partial();

export type WorkflowSection = z.infer<typeof workflowSectionSchema>;
```

## Existing Files to Modify

### 1. `/src/app/api/workflows/[id]/sections/route.ts`
**Current state:** Has TypeScript errors, references non-existent relations (`dependentOn`, `translations`), wrong permission model
**Changes needed:** Complete rewrite following the pattern of the workflow route
- Remove all references to `dependentOn` and `translations` relations that don't exist
- Add `placement`, `type`, `content`, `fileUrl`, `fileName` to returned data
- Sort by `placement` first, then `displayOrder`
- Use proper permission checks with `hasPermission` from permission-utils
- Validate `placement` and `type` on POST
- **Business rule:** Enforce maximum 10 sections per placement (20 total)
- **Business rule:** Section names CAN be duplicated - no uniqueness validation
- Auto-assign displayOrder if not provided (highest + 1 within placement group)
- **Read existing workflow route first to match permission pattern**

### 2. `/src/app/api/workflows/[id]/sections/[sectionId]/route.ts`
**Current state:** Has similar errors as the list route, circular dependency checking that references wrong fields
**Changes needed:** Complete rewrite
- Remove dependency checking logic (not used in Phase 2)
- Handle new fields in PUT operation
- **Business rule:** Check if workflow has active orders before allowing modifications
  - Query orders table for any orders with this workflow in draft/processing status
  - Return 409 Conflict if active orders exist with message about workflow being locked
- Adjust displayOrder when placement changes
- Compact displayOrder values after DELETE (within placement group)
- Use proper permission checks
- **Read existing workflow route first to match permission pattern**

### 3. `/src/app/api/workflows/[id]/route.ts`
**Current state:** Working correctly
**Changes needed:** Handle new fields in PUT operation
- **Business rule:** Check if workflow has active orders before allowing modifications
  - Query orders via packages that reference this workflow
  - Return 409 Conflict if any orders in draft/processing status
- Accept and validate `emailSubject`, `emailBody`, `gapToleranceDays`
- Add validation: emailSubject max 200 chars, emailBody max 5000 chars
- Add validation: gapToleranceDays must be 1-365 if provided
- Return new fields in GET response

### 4. `/src/components/modules/workflows/sections/workflow-section-dialog.tsx`
**Current state:** Complex with many unused section types, wrong field references
**Changes needed:** Complete rewrite with simpler structure
- Add placement dropdown (Before Services / After Services)
- Add type dropdown (Text / Document)
- Show content textarea when type is "text" with 50K character limit
- Show file upload when type is "document"
  - **Business rule:** Accept only .pdf, .docx, .doc files
  - Display clear file type restrictions to user
- Remove all the complex configuration options (signatures, checkboxes, etc.)
- Remove dependency logic (not used in Phase 2)
- Use proper `useAuth` from contexts
- **Must follow COMPONENT_STANDARDS Section 4 for file uploads**

### 5. `/src/components/modules/workflows/sections/workflow-section-list.tsx`
**Current state:** Has drag-and-drop, but no placement grouping
**Changes needed:** Complete rewrite
- Group sections by placement with clear headings
- **Business rule:** Show section count for each placement (e.g., "Before Services (3/10)")
- **Business rule:** Disable "Add Section" button when placement has 10 sections
- Keep drag-and-drop but only within placement groups
- Show section type badge (text/document)
- Add "Add Section" button for each placement group
- Remove dependency-related UI
- Show file name for document sections
- **Read first to understand the drag-drop implementation**

### 6. `/src/components/modules/workflows/workflow-dialog.tsx`
**Current state:** Working for basic workflow fields
**Changes needed:** Add new sections
- **Business rule:** Check if workflow has active orders and show warning/lock icon if so
- Add "Email Template" section with subject and body fields
- Add help text showing available variables
- Add "Gap Tolerance" number input with validation (1-365)
- Keep all existing functionality intact
- If workflow has active orders, show read-only mode with message

### 7. `/src/types/workflow.ts`
**Current state:** Has old section types that don't match spec
**Changes needed:**
- Update `SectionTypeEnum` to only have `['text', 'document']`
- Remove unused section types
- Add placement and new fields to section schemas
- Add email and gap fields to workflow schemas
- Add validation for section limits

## API Routes

### POST `/api/workflows/[id]/sections`
- **Auth:** customer_config.edit or admin permission required
- **Validation:** 
  - Check workflow doesn't have active orders (draft/processing status)
  - Check placement doesn't already have 10 sections
- **Input:**
  ```typescript
  {
    name: string, // Can be duplicate
    placement: 'before_services' | 'after_services',
    type: 'text' | 'document',
    content?: string, // Max 50K chars
    isRequired?: boolean,
    displayOrder?: number
  }
  ```
- **Returns:** Created section with 201 status
- **Errors:** 
  - 400 for validation
  - 403 for permissions
  - 404 if workflow not found
  - 409 if workflow has active orders or section limit reached

### GET `/api/workflows/[id]/sections`
- **Auth:** customer_config.view or admin
- **Returns:** Array of sections sorted by placement then displayOrder
- **Response includes:** All section fields including new ones
- **Additional info:** Include count per placement in metadata

### PUT `/api/workflows/[id]/sections/[sectionId]`
- **Auth:** customer_config.edit or admin
- **Validation:** Check workflow doesn't have active orders
- **Input:** Partial section update
- **Special logic:** If placement changes, adjust displayOrder
- **Returns:** Updated section
- **Errors:** 409 if workflow has active orders

### DELETE `/api/workflows/[id]/sections/[sectionId]`
- **Auth:** customer_config.edit or admin
- **Validation:** Check workflow doesn't have active orders
- **After deletion:** Compact displayOrder within placement group
- **Returns:** 200 with success message
- **Errors:** 409 if workflow has active orders

### POST `/api/workflows/[id]/sections/[sectionId]/upload`
- **Auth:** customer_config.edit or admin
- **Input:** FormData with 'file' field
- **Validation:**
  - Section type must be 'document'
  - File type must be .pdf, .docx, or .doc only
  - Max size 10MB
  - Workflow doesn't have active orders
- **Storage:** `uploads/workflow-documents/[workflowId]/[sectionId]/[uniqueId]_[filename]`
- **Returns:** Updated section with fileUrl and fileName
- **Errors:** 409 if workflow has active orders

### PUT `/api/workflows/[id]`
- **Existing endpoint, add support for:**
  - emailSubject (max 200 chars)
  - emailBody (max 5000 chars)
  - gapToleranceDays (1-365 or null)
- **Validation:** Check workflow doesn't have active orders before allowing edit
- **Errors:** 409 if workflow has active orders

## Zod Validation Schemas

### WorkflowSectionSchema
```typescript
{
  name: z.string().min(1).max(100), // No uniqueness
  placement: z.enum(['before_services', 'after_services']),
  type: z.enum(['text', 'document']),
  content: z.string().max(50000).optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().optional(),
  displayOrder: z.number().int().nonnegative(),
  isRequired: z.boolean().default(true)
}
```

### WorkflowUpdateSchema (addition)
```typescript
{
  emailSubject: z.string().max(200).optional(),
  emailBody: z.string().max(5000).optional(),
  gapToleranceDays: z.number().int().min(1).max(365).optional().nullable()
}
```

### File Upload Validation
```typescript
{
  allowedTypes: ['.pdf', '.docx', '.doc'],
  maxSize: 10 * 1024 * 1024, // 10MB
  mimeTypes: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
}
```

## TypeScript Types

In `/src/types/workflow-section.ts`:
- `Placement`: 'before_services' | 'after_services'
- `SectionType`: 'text' | 'document'
- `WorkflowSection`: Full section type with all fields
- `WorkflowSectionCreateInput`: z.infer of create schema
- `WorkflowSectionUpdateInput`: z.infer of update schema
- `MAX_SECTIONS_PER_PLACEMENT`: const = 10

## UI Components

### WorkflowSectionDialog (rewrite)
- **Type:** Client component with "use client"
- **Renders:** Modal dialog for add/edit section
- **Uses:** ModalDialog (per COMPONENT_STANDARDS Section 3.1)
- **Form components:** FormTable, FormRow (per Section 3.3)
- **File upload:** 
  - Immediate upload on selection, store only metadata
  - Show clear message: "Accepted formats: PDF, Word (.pdf, .docx, .doc)"
- **Content field:** Show character count (x/50000)
- **API calls:** POST/PUT to sections endpoints

### WorkflowSectionList (rewrite)
- **Type:** Client component
- **Renders:** Two groups with headers showing counts
  - "Before Services (3/10)" 
  - "After Services (5/10)"
- **Uses:** Shadcn table components, ActionDropdown for actions
- **Drag-drop:** react-beautiful-dnd within placement groups only
- **Section limit:** Disable "Add Section" when limit reached
- **API calls:** GET sections, PATCH for reorder, DELETE

### WorkflowDialog (modify)
- **Add:** Workflow lock indicator if active orders exist
- **Add:** Email template section with subject/body textareas
- **Add:** Gap tolerance number input (1-365)
- **Add:** Help text showing template variables
- **Keep:** All existing workflow configuration fields
- **Behavior:** Read-only mode if workflow has active orders

## Translation Keys

```typescript
// New keys needed:
'module.workflows.sections.placement': 'Placement'
'module.workflows.sections.placement.before': 'Before Services'
'module.workflows.sections.placement.after': 'After Services'
'module.workflows.sections.type': 'Section Type'
'module.workflows.sections.type.text': 'Text Content'
'module.workflows.sections.type.document': 'Document Upload'
'module.workflows.sections.content': 'Content'
'module.workflows.sections.uploadDocument': 'Upload Document'
'module.workflows.sections.fileName': 'File Name'
'module.workflows.sections.fileTypes': 'Accepted: PDF, Word (.pdf, .docx, .doc)'
'module.workflows.sections.maxSections': 'Maximum {0} sections allowed'
'module.workflows.sections.sectionCount': '{0}/{1} sections'
'module.workflows.emailTemplate': 'Email Template'
'module.workflows.emailSubject': 'Email Subject'
'module.workflows.emailBody': 'Email Body'
'module.workflows.gapTolerance': 'Gap Tolerance (Days)'
'module.workflows.templateVariables': 'Available Variables'
'module.workflows.variables.help': 'Type these variables in your template:'
'module.workflows.locked': 'Workflow is locked (active orders exist)'
'module.workflows.cannotEdit': 'Cannot edit workflow with active orders'
```

## Business Rules Implementation

### 1. Section Name Duplicates
- No uniqueness constraint in database or validation
- Users can create multiple sections with the same name
- UI should handle display of duplicate names gracefully

### 2. Workflow Locking
- Before any edit operation, check for active orders:
  ```sql
  SELECT COUNT(*) FROM orders o
  JOIN packages p ON o.package_id = p.id
  WHERE p.workflow_id = $1
  AND o.status IN ('draft', 'processing')
  ```
- Return 409 Conflict if count > 0
- Show lock icon and message in UI

### 3. File Type Restrictions
- Backend validates file extension and MIME type
- Frontend shows clear message about accepted formats
- Reject any file not matching .pdf, .docx, or .doc

### 4. Document Retention
- Documents stored in `uploads/workflow-documents/`
- When workflow deleted, cascade delete removes sections
- File cleanup job should remove orphaned files
- Documents tied to workflow lifecycle

### 5. Section Limits
- Maximum 10 sections per placement (20 total)
- Enforce in POST endpoint
- Show count in UI
- Disable add button when limit reached

## Order of Implementation

1. **Database schema changes** — Update Prisma schema with new fields for Phase 2 AND Phase 3 (CandidateInvitation)
2. **Prisma migration** — Create timestamped migration with SQL above, run `pnpm prisma migrate deploy` then `pnpm prisma generate`
3. **TypeScript types** — Create workflow-section.ts with limits, update workflow.ts (Phase 2 only)
4. **Zod schemas** — Update validation schemas with new fields and limits
5. **API route rewrites** — Rewrite section routes with workflow locking logic
6. **API route modifications** — Update workflow PUT with locking check
7. **Document upload endpoint** — Create with file type restrictions
8. **UI component rewrites** — Rewrite with section limits and lock indicators
9. **UI modifications** — Add email template, gap tolerance, and lock status
10. **Translation keys** — Add all new user-facing text strings
11. **Testing** — Verify all functionality including business rules

**Note:** The CandidateInvitation table is created in step 2 but will not have any APIs or UI until Phase 3. This is intentional to minimize database migrations and ensure proper foreign key relationships are established early.

## Risks and Considerations

### High Risk Areas
1. **File upload implementation** — Must follow COMPONENT_STANDARDS Section 4 exactly. Files must be uploaded immediately on selection, not stored in component state. Only PDF and Word files allowed.
2. **Workflow locking** — Critical to prevent data corruption. Must check for active orders before any modification. Consider adding database trigger as backup.
3. **Section limits** — Must be enforced at API level to prevent database bloat. UI enforcement alone is insufficient.

### Medium Risk Areas
1. **Display order management** — When placement changes, need to correctly reassign displayOrder to avoid gaps or conflicts within placement groups.
2. **File cleanup** — Orphaned files could accumulate if delete operations fail. Need periodic cleanup job.
3. **Migration safety** — The CandidateInvitation table has foreign keys that must be properly configured. Test rollback scenarios.

### Decisions for Implementer
1. **Workflow lock granularity** — Lock entire workflow or allow some fields to be edited? Recommendation: Lock everything for consistency.
2. **File naming** — Use UUID prefix to prevent collisions when files have same name.
3. **Drag-drop with limits** — How to handle drag-drop when target placement is at limit? Recommendation: Show error, cancel drag.

### TypeScript Baseline Impact
The two section route files being rewritten likely contribute errors to the baseline. After rewriting:
- Expected to resolve ~20-40 TypeScript errors based on the problems identified
- New baseline should be calculated after implementation
- No new errors should be introduced

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified (except tests)
- [x] All Zod schemas, types, and translation keys are listed
- [x] Business rules are clearly specified with implementation details
- [x] CandidateInvitation table properly integrated with rationale
- [x] File type restrictions specified (.pdf, .docx, .doc only)
- [x] Section limits defined (10 per placement)
- [x] Workflow locking logic detailed for active orders
- [x] Implementation order accounts for dependencies between tasks
- [x] Risk areas are clearly identified with mitigation strategies
- [x] Patterns to follow are specified with reference files

The technical plan is complete and ready for the test-writer to proceed.
