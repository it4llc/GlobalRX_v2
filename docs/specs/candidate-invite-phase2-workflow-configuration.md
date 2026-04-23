# Candidate Invite — Phase 2: Workflow Configuration

**Spec Type:** Business Analyst
**Created:** April 21, 2026
**Status:** Draft — Awaiting Review
**Phase:** 2 of 8
**Prerequisites:** Phase 1 (Database Infrastructure) — ✅ Complete

---

## Overview

Phase 2 adds the ability to configure workflow sections, email templates, and validation settings on workflows. When this phase is complete, an internal user will be able to open a workflow, add custom content sections (text or uploaded documents) placed before or after the auto-generated service sections, write an email template for candidate invitations, and set a gap tolerance for employment/address history validation.

This phase also replaces the existing broken workflow section code (route files and UI components) with a clean rewrite built against the current data model and permission system.

---

## What Exists Today (Phase 1 Completed State)

### Workflow Model — Current Fields

The Workflow model currently has these fields (from the Prisma schema and Data Dictionary):

- `id` — UUID primary key
- `name` — workflow name
- `description` — optional description
- `status` — draft, active, etc.
- `defaultLanguage` — default language
- `expirationDays` — days until workflow expires (already exists)
- `autoCloseEnabled` — whether workflow auto-closes (already exists)
- `extensionAllowed` — whether expiration can be extended (already exists)
- `extensionDays` — number of days for extension (already exists)
- `disabled` — whether workflow is currently disabled
- `reminderEnabled` — whether reminders are sent
- `reminderFrequency` — days between reminders
- `maxReminders` — maximum number of reminders
- `customerId` — links workflow to a customer (added in Phase 1)
- `createdById` / `updatedById` — audit fields
- `createdAt` / `updatedAt` — timestamps

**Phase 1 changes already completed:**

- `packageId` was removed from the workflows table
- `workflowId` was added to the packages table (one workflow → many packages)
- `customerId` was added to the workflows table
- "idv" was added as a functionality type

### WorkflowSection Model — Current Fields

The WorkflowSection model currently has these fields:

- `id` — UUID primary key
- `workflowId` — parent workflow
- `name` — section name
- `displayOrder` — order in which section appears
- `isRequired` — whether section must be completed
- `dependsOnSection` — optional, section that must complete first
- `dependencyLogic` — optional, logic for conditional dependencies
- `createdAt` / `updatedAt` — timestamps

**Status:** Marked as PLACEHOLDER in the Data Dictionary. The table exists but has never been used with real data.

### Existing Broken Code (To Be Rewritten)

The following files exist but have significant TypeScript errors and are built against the pre-Phase-1 data model. They will be **fully rewritten** in this phase:

**API Route Files:**

- `src/app/api/workflows/[id]/sections/route.ts` — GET (list) and POST (create) for workflow sections
- `src/app/api/workflows/[id]/sections/[sectionId]/route.ts` — GET, PUT, DELETE for individual sections

**Problems with existing routes:**

- Use `customer_config` and `admin` permission checks that don't exist on the current permissions type
- Try to include a `dependentOn` relation that doesn't exist in the Prisma schema
- Don't handle null returns from `findUnique` (causes type errors)
- Built before Phase 1 changed how permissions work

**UI Component Files:**

- `src/components/modules/workflows/sections/workflow-section-dialog.tsx`
- `src/components/modules/workflows/sections/workflow-section-list.tsx`
- `src/components/modules/workflows/sections/permission-debug.tsx`

**Problems with existing UI components:**

- Hardcoded section type list ("form", "summary", "documents", "idInfo", etc.) that doesn't match the design
- Wrong function signatures (wrong number of arguments)
- Type mismatches with the WorkflowSection model
- Logger calls with wrong argument types

---

## What Phase 2 Will Add

### 1. Database Changes

#### 1a. New Fields on `workflow_sections` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `placement` | String | Yes | None | Where this section appears in the candidate application. Values: `before_services` or `after_services` |
| `type` | String | Yes | `text` | What kind of content this section holds. Starting values: `text` or `document` |
| `content` | Text | No | null | The actual text content for sections of type `text`. Stored as plain text with basic formatting (to be defined in implementation) |
| `fileUrl` | String | No | null | Path/URL to the uploaded file for sections of type `document` |
| `fileName` | String | No | null | Original filename of the uploaded document (for display purposes) |

**Note about `expirationDays`:** The phase plan lists adding `expirationDays` to the workflows table, but this field already exists. No action needed.

#### 1b. New Fields on `workflows` Table

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `emailSubject` | String | No | null | Email subject line template for candidate invitations |
| `emailBody` | Text | No | null | Email body template for candidate invitations |
| `gapToleranceDays` | Int | No | null | Maximum allowed gap in days between employment or address history entries. When null, no gap validation is performed |

#### 1c. Migration Notes

- The migration must be safe to run on the existing (empty) `workflow_sections` table
- New fields on `workflow_sections` should have defaults where possible to avoid breaking existing data (though the table is empty)
- New fields on `workflows` should be nullable since existing workflows won't have these values yet
- Follow the migration safety patterns from DATABASE_STANDARDS.md (idempotent, logged, verified)

### 2. API Changes

#### 2a. Rewrite: `/api/workflows/[id]/sections` (GET, POST)

**GET — List all sections for a workflow**

- Returns all sections belonging to the specified workflow
- Sections are sorted by `placement` (before_services first, then after_services), then by `displayOrder` within each placement group
- Only accessible to authenticated users with appropriate permissions
- Uses centralized permission functions from `auth-utils.ts`

**Response shape:**

```
{
  sections: [
    {
      id: "uuid",
      name: "Notice of Processing (EU)",
      placement: "before_services",
      type: "text",
      content: "This notice informs you that...",
      fileUrl: null,
      fileName: null,
      displayOrder: 1,
      isRequired: true,
      createdAt: "2026-04-21T...",
      updatedAt: "2026-04-21T..."
    },
    ...
  ]
}
```

**POST — Create a new section**

- Creates a new section for the specified workflow
- Required fields in request body: `name`, `placement`, `type`
- Optional fields: `content`, `isRequired`, `displayOrder`
- If `displayOrder` is not provided, the section is added at the end of its placement group (one higher than the current highest displayOrder in that group)
- Validates that `placement` is one of: `before_services`, `after_services`
- Validates that `type` is one of: `text`, `document`
- If type is `document`, the file upload is handled separately (see 2c below)
- Returns the created section with status 201

#### 2b. Rewrite: `/api/workflows/[id]/sections/[sectionId]` (GET, PUT, DELETE)

**GET — Get a single section**

- Returns the specified section if it belongs to the specified workflow
- Returns 404 if section not found or doesn't belong to this workflow

**PUT — Update a section**

- Updates any editable fields on the section
- Editable fields: `name`, `placement`, `type`, `content`, `displayOrder`, `isRequired`
- If `placement` changes, the section's `displayOrder` should be adjusted to the end of the new placement group (unless a specific `displayOrder` is also provided)
- Validates placement and type values same as POST
- Returns the updated section

**DELETE — Delete a section**

- Deletes the specified section
- After deletion, remaining sections in the same placement group should have their `displayOrder` values compacted (no gaps in ordering) — this is a "nice to have" that can be deferred if complex
- Returns 200 with a success message

#### 2c. New: `/api/workflows/[id]/sections/[sectionId]/upload` (POST)

**POST — Upload a document file for a section**

- Accepts a file upload (PDF, DOCX, or image) for a section of type `document`
- Updates the section's `fileUrl` and `fileName` fields
- Returns 400 if the section type is not `document`
- Returns the updated section with the file information

**Implementation note — reuse existing upload patterns:**

The app already has file uploads working in two places, and this endpoint should follow the same approach rather than inventing something new:

1. **Service attachments upload** at `/api/services/[id]/attachments/route.ts` — this is the closest match. It accepts a FormData upload, writes the file to disk, and stores metadata (fileName, filePath, fileSize) in a database record. The workflow section upload should follow this same structure, just storing the metadata on the WorkflowSection record instead of the ServiceAttachment table.

2. **Draft document uploads** in the order creation flow — files go to `uploads/draft-documents/` on disk. Workflow section documents should use a similar storage path, such as `uploads/workflow-documents/`, to keep them organized separately from order-related uploads.

3. **COMPONENT_STANDARDS.md Section 4** defines the rules the UI side must follow: always upload the file immediately when the user selects it (not deferred to form save), use FormData to send the file (never JSON), and store only JSON-serializable metadata (fileName, filePath, fileSize) in component state — never the File object itself.

The implementer should read the existing service attachments route and the component standards section on file uploads before writing this endpoint.

#### 2d. Modified: `/api/workflows/[id]` (PUT)

The existing workflow PUT endpoint needs to handle the new fields:

- `emailSubject` — optional string
- `emailBody` — optional text
- `gapToleranceDays` — optional integer (must be positive if provided)

These are just additional fields in the existing update operation. The endpoint already exists; it just needs to accept and save these new fields.

### 3. UI Changes

#### 3a. Rewrite: Workflow Section Management

**Location:** `src/components/modules/workflows/sections/`

Replace the existing broken section list and dialog components with a clean implementation that provides:

**Section List View:**

- Displays all sections for a workflow, grouped by placement (before_services and after_services)
- Each group has a clear heading: "Before Services" and "After Services"
- Sections within each group are shown in display order
- Each section row shows: name, type (text/document), required indicator
- Actions on each section: Edit, Delete
- "Add Section" button for each group (so the placement is pre-selected)
- Drag-and-drop reordering within each group would be ideal but can be deferred — simple up/down arrows are acceptable for Phase 2

**Section Dialog (Add/Edit):**

- Name field (required)
- Placement dropdown: Before Services / After Services (pre-selected if "Add" was clicked from a specific group)
- Type dropdown: Text / Document
- If type is "text": a text area for entering content (basic text input is fine for Phase 2 — a richer text editor can come later)
- If type is "document": a file upload control
- Required checkbox
- Save and Cancel buttons

#### 3b. Rewrite: Permission Debug Component

The `permission-debug.tsx` component has TypeScript errors. If this component is only used for development debugging and isn't shown to users, it can be removed or fixed minimally. The decision on this can be made during implementation.

#### 3c. New: Email Template Configuration

**Location:** Within the existing workflow dialog/edit UI

Add a new section or tab to the workflow edit interface for email template configuration:

- **Email Subject** — a single-line text input where the user types the subject line
- **Email Body** — a multi-line text area where the user types the email body
- A reference panel or help text showing the available placeholder variables:
  - `{{candidateFirstName}}` — candidate's first name
  - `{{candidateLastName}}` — candidate's last name
  - `{{candidateEmail}}` — candidate's email address
  - `{{candidatePhone}}` — candidate's phone number (formatted with country code)
  - `{{companyName}}` — the customer's company name
  - `{{inviteLink}}` — the invitation URL
  - `{{expirationDate}}` — when the link expires
- The placeholders are typed manually by the user into the text fields — no insertion buttons needed for Phase 2
- These fields save as part of the normal workflow save operation

#### 3d. New: Gap Tolerance Setting

**Location:** Within the existing workflow dialog/edit UI

Add a gap tolerance field to the workflow edit interface:

- **Gap Tolerance (Days)** — a number input field
- Help text explaining what it does: "Maximum number of days allowed between employment or address history entries. Leave empty to skip gap validation."
- This field saves as part of the normal workflow save operation

### 4. Validation Rules

#### 4a. Section Validation

- `name` is required and cannot be empty
- `placement` must be exactly `before_services` or `after_services`
- `type` must be exactly `text` or `document`
- If `type` is `text`, `content` should be provided (can be empty but warn the user)
- If `type` is `document`, a file must be uploaded (can happen after section creation)
- `displayOrder` must be a positive integer

#### 4b. Email Template Validation

- `emailSubject` and `emailBody` are optional — a workflow can exist without an email template configured
- No validation on the placeholder variables — if the user types `{{wrongVariable}}`, it will just appear literally in the email. Validation of variables can come in a later phase.
- Maximum length: emailSubject 200 characters, emailBody 5000 characters

#### 4c. Gap Tolerance Validation

- `gapToleranceDays` must be a positive integer if provided
- Null/empty means no gap validation will be performed
- Minimum value: 1 day
- Maximum value: 365 days (reasonable upper bound)

### 5. Permission Model

All workflow section operations use the same permission model as the existing workflow endpoints:

- Workflow configuration is an internal/admin function
- Uses the centralized permission functions from `auth-utils.ts`
- The exact permission function to use should match whatever the existing workflow routes use (to be confirmed during implementation by reading the current workflow route files)
- Customer users should not have access to workflow section CRUD operations

### 6. Data Dictionary Updates

After Phase 2 is complete, the Data Dictionary (`docs/DATA_DICTIONARY.md`) needs to be updated:

- **Workflow model:** Remove `packageId` reference (Phase 1 change not yet reflected), add `customerId`, add `emailSubject`, `emailBody`, `gapToleranceDays`
- **WorkflowSection model:** Change status from PLACEHOLDER to ACTIVE, add `placement`, `type`, `content`, `fileUrl`, `fileName` fields

---

## What's Testable at the End of Phase 2

1. Can create a workflow section with a name, placement (before/after services), and type (text/document)
2. Can add text content to a text-type section
3. Can upload a document file to a document-type section
4. Sections display grouped by placement (before services group, then after services group)
5. Sections display in correct display order within their placement group
6. Can reorder sections within a placement group
7. Can move a section from one placement group to another
8. Can edit and delete sections
9. Can configure email subject and body on a workflow with placeholder variables typed in manually
10. Can set gap tolerance (in days) on a workflow
11. All existing workflow functionality still works (no regressions)
12. No TypeScript errors in the rewritten section files (resolving the existing baseline errors for these files)

---

## What Phase 2 Does NOT Include

These items are explicitly out of scope and will be handled in later phases:

- **Email sending** — Phase 2 only stores the template; actually sending emails happens in Phase 4
- **Variable substitution** — replacing `{{candidateFirstName}}` with actual values happens when emails are sent in Phase 4
- **Variable insertion UI** — buttons/dropdowns to insert template variables; the user types them manually for now
- **Rich text editor** — Phase 2 uses a basic text area for section content; a full rich text editor is a future enhancement
- **Section dependency logic** — the `dependsOnSection` and `dependencyLogic` fields exist on the model but are not used in Phase 2
- **Gap validation enforcement** — Phase 2 only stores the setting; actual gap detection and enforcement happens in Phase 7
- **Candidate-facing rendering** — how sections are displayed to the candidate is Phase 6

---

## Key Design Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Full rewrite of existing section code | Existing files have 20+ TypeScript errors, wrong permission model, wrong data includes, and wrong section types. Fixing would mean replacing most of the code anyway. |
| 2 | Start with two section types: `text` and `document` | These cover the immediate need (typed instructions and uploaded compliance docs like PDF notices). More types can be added later. |
| 3 | Section type field included even though only two values | The type field drives different UI behavior (text area vs file upload) and will eventually drive different rendering and validation. Including it now avoids a schema migration later. |
| 4 | `gapToleranceDays` is a single setting for both employment and address history | Keeps configuration simple. If different tolerances are needed per history type, the field can be split later. |
| 5 | Expiration fields are NOT added (already exist) | The phase plan listed `expirationDays` as a database change, but the Workflow model already has `expirationDays`, `autoCloseEnabled`, `extensionAllowed`, and `extensionDays`. No action needed. |
| 6 | Email template uses plain text with manual placeholder typing | The design doc says "future enhancement: full template editor with variable insertion." Phase 2 is the simple version. |
| 7 | File upload for document sections uses a separate endpoint | Keeps the section create/update as a JSON operation and handles file upload separately, following the existing upload patterns in the codebase. |
| 8 | Document upload reuses existing upload patterns, not built from scratch | The service attachments upload route (`/api/services/[id]/attachments`) and the draft document upload in the order creation flow already solve the same problem (accept file via FormData, write to disk, store metadata). The workflow section upload follows the same approach with a different storage path (`uploads/workflow-documents/`) and database target (WorkflowSection instead of ServiceAttachment). |

---

## Files That Will Be Created or Modified

### New or Rewritten Files

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/workflows/[id]/sections/route.ts` | Rewrite | GET (list) and POST (create) for workflow sections |
| `src/app/api/workflows/[id]/sections/[sectionId]/route.ts` | Rewrite | GET, PUT, DELETE for individual sections |
| `src/app/api/workflows/[id]/sections/[sectionId]/upload/route.ts` | New | POST for document file upload |
| `src/components/modules/workflows/sections/workflow-section-list.tsx` | Rewrite | Section list grouped by placement |
| `src/components/modules/workflows/sections/workflow-section-dialog.tsx` | Rewrite | Add/edit section dialog |
| `prisma/migrations/YYYYMMDD_add_workflow_section_fields/migration.sql` | New | Schema migration |

### Modified Files

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add new fields to Workflow and WorkflowSection models |
| `src/app/api/workflows/[id]/route.ts` | Modify | Handle new emailSubject, emailBody, gapToleranceDays fields in PUT |
| `src/components/modules/workflows/workflow-dialog.tsx` | Modify | Add email template section and gap tolerance field |

### Possibly Removed Files

| File | Action | Description |
|------|--------|-------------|
| `src/components/modules/workflows/sections/permission-debug.tsx` | Remove or fix | Development-only debug component with TypeScript errors. Remove if not needed. |

### Documentation Updates

| File | Action | Description |
|------|--------|-------------|
| `docs/DATA_DICTIONARY.md` | Update | Reflect Phase 1 and Phase 2 schema changes |
| `docs/TS_BASELINE.md` | Update | Remove resolved TypeScript errors for rewritten files |

---

## Open Questions

None — all questions have been resolved during the business analysis review.

---

## Design Decisions for Future Phases

The following decisions were resolved during Phase 2 analysis and apply to Phase 3 (Candidate Invitation Foundation) and Phase 4 (Customer-Side Invite Creation). They are documented here so they are not lost between phases.

### Candidate Name Fields — Hardcoded fieldKey Mapping

**Decision:** The candidate's first name and last name entered by the customer at invitation time will be hardcoded to map to the DSX requirement records with fieldKeys `firstName` and `lastName`.

**Rationale:** The basic data fields (First Name, Last Name, etc.) are created by backend configuration, not by customers. There is currently no scenario where multiple versions of the name fields would be needed. The fieldKeys `firstName` and `lastName` are predictable and consistent across all customers. If a future scenario requires different name field mappings, additional work will be needed at that time.

**Reference:** The `generateFieldKey()` function at `src/lib/utils/field-key.ts` generates camelCase keys from field labels with collision detection. "First Name" → `firstName`, "Last Name" → `lastName`. These keys are immutable after creation per DATABASE_STANDARDS.md.

### Candidate Fields Are Read-Only

**Decision:** When the candidate opens their application, the following fields will be pre-filled from the CandidateInvitation record and **locked** (visible but not editable):

- First name
- Last name
- Email address
- Phone number (country code + number)

**Rationale:** The name that is background checked should be the name the candidate used to apply for the job. Allowing the candidate to change their name would create a mismatch. The email is already verified (the candidate received the invite and clicked the link). The phone number was provided by the customer as part of the candidate's contact information and should remain consistent.

### CandidateInvitation Phone Number — Two Fields

**Decision:** The phone number on the CandidateInvitation record will be stored as two separate fields:

- `phoneCountryCode` — the country dialing code (e.g., "1" for US, "44" for UK)
- `phoneNumber` — the phone number without the country code

**Rationale:** When SMS sending is added in a future phase, the delivery service will need the country code separately to route the message. Storing them together and parsing them apart later is error-prone. The country code field will use a dropdown tied to the countries table (filtered to country-level entries only), preventing typos and ensuring valid codes.

### Data Flow Summary (for Phase 3/4 Implementation)

1. Customer creates a candidate invite → enters firstName, lastName, email, phoneCountryCode, phoneNumber
2. System stores those values on the CandidateInvitation record
3. System uses firstName/lastName for email template variable substitution (Phase 4)
4. When the candidate opens their application, name/email/phone fields appear pre-filled and locked
5. At submission, those values flow into order data mapped to the DSX requirements with fieldKeys `firstName`, `lastName`, and `email`
6. The `phoneCountryCode` and `phoneNumber` mapping to DSX requirements (if applicable) will be determined in Phase 3

---

## Estimated Complexity

**Medium** — Consistent with the phase plan estimate. The database changes are straightforward (adding fields). The API work is a clean rewrite of existing broken code with new fields added. The UI work involves rewriting two components and adding sections to an existing dialog.