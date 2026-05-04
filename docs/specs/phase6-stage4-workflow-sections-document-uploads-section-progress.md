# Feature Specification: Phase 6, Stage 4 — Workflow Sections, Document Uploads & Section Progress

**Spec file:** `docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md`
**Date:** 2026-05-04
**Requested by:** Andy
**Status:** Confirmed
**Phase:** 6 — Dynamic Application Engine
**Stage:** 4 of 4
**Prerequisites:** Phase 6 Stage 3 complete and deployed

---

## Summary

This is the final stage of Phase 6. It delivers three things to the candidate application: (1) workflow sections — the compliance documents, consent forms, and disclosure notices the candidate reviews and acknowledges before/after the service sections; (2) working document upload components that replace the informational-only document line items added in Stage 3; and (3) visual section progress indicators in the navigation showing whether each section is not started, incomplete, or complete. It also delivers a cross-section requirement registry that lets DSX requirements triggered in one section (e.g., Address History) propagate to fields collected on a different tab (e.g., Personal Information), so the progress indicator on the target tab reflects the new requirement. After this stage the candidate application has every section type working; only the validation/submission flow remains for Phase 7.

---

## Who Uses This

**Candidate (primary user):**
- Reviews compliance documents (workflow sections) and ticks the acknowledgment checkbox.
- Uploads required documents (e.g., diploma scan, police check form) for service sections.
- Sees real-time progress indicators in the section navigation showing which sections are complete, incomplete, or not started.
- Sees a banner on a section when DSX requirements from another section have made fields on the current section required.

**Internal admin (context only — no new admin UI in this stage):**
- Workflow sections are configured by internal admins through existing tooling (`workflow_sections` table). This stage consumes that data; it does not add new admin configuration screens.
- Admins observing candidate applications benefit from clearer progress reporting, but the progress indicators are part of the candidate-facing UI, not a new admin view.

---

## Business Rules

1. Workflow sections with `placement = 'before_services'` render in Zone 1 (before all service sections), in `displayOrder`.
2. Workflow sections with `placement = 'after_services'` render in Zone 3 (after all service sections), in `displayOrder`.
3. A workflow section with `type = 'text'` renders its `content` field as sanitized HTML (no script tags, no event handlers; basic formatting such as bold, italic, lists, and links is preserved).
4. A workflow section with `type = 'document'` AND a non-null `fileUrl` renders a download/open link labelled with `fileName`, falling back to the section `name` if `fileName` is empty. No embedded PDF viewer is provided.
5. The acknowledgment checkbox label is hardcoded to "I have read and agree to the above" using the platform translation system. Custom per-workflow-section acknowledgment text is deferred to a future stage.
6. A workflow section is considered complete only when its acknowledgment checkbox has been checked (when `isRequired = true`). If `isRequired = false`, the section is always considered complete.
7. The acknowledgment for a workflow section is stored in `order_data` with `fieldName` equal to the `workflow_sections.id` (UUID). This avoids collisions with `dsx_requirements` UUIDs.
8. The acknowledgment is persisted in the auto-save form state under a per-section bucket: `formData.sections[<workflowSectionId>] = { type: 'workflow_section', acknowledged: true }`. This matches the existing per-section pattern used for service sections.
9. Document uploads are limited to a maximum file size of 10 MB and a MIME type of `application/pdf`, `image/jpeg`, or `image/png`. The component validates both client-side before upload, and the server validates again on receipt.
10. Files are stored on the server at `uploads/draft-documents/{orderId}/{timestamp}-{originalName}`. No database row is created at upload time; the metadata returned by the upload endpoint is persisted via the standard auto-save into `order_data`.
11. Document metadata storage location depends on the requirement's `documentData.scope`:
    - `per_entry` → metadata is stored inside the entry's `fields` array in `formData`, keyed by the requirement's UUID.
    - `per_search` → metadata is stored in the section's aggregated bucket (one slot per service/jurisdiction combination).
    - `per_order` → metadata is stored once globally in the section's aggregated bucket.
12. The upload component validates the candidate token on every upload and delete; the server must verify the file being deleted belongs to the order tied to that token. A candidate cannot upload to or delete from another candidate's order.
13. The candidate must be able to remove an uploaded document. Removal calls DELETE `/api/candidate/application/[token]/upload/[documentId]`, removes the file from disk, and the next auto-save persists the absence of the metadata.
14. Section progress for each section has exactly three states: `not_started` (no data entered), `incomplete` (started but missing required fields/documents/acknowledgments), or `complete` (all required items satisfied).
15. Section progress recalculates on every auto-save event (existing on-blur trigger from Stage 1). No additional API call is required; the calculation runs client-side from the form state and the section's known requirements.
16. For repeatable sections (Address History, Education, Employment), Stage 4 progress checks only that all required fields and required documents are satisfied **within the entries the candidate has already created**. Stage 4 does NOT perform scope coverage checks (e.g., "do the entries cover 7 years?") and does NOT perform gap detection. Both are Phase 7.
17. The cross-section requirement registry tracks DSX requirements whose `collectionTab` differs from the section that loaded them. For Stage 4, the only supported target is `personal_info` (Personal Information). The registry pattern is structured to allow other targets later, but Stage 4 does not implement them.
18. When a section's progress includes cross-section requirements registered against it, those requirements are evaluated alongside the section's own local fields. If any cross-section required field is empty, the target section shows incomplete (red).
19. When a repeatable entry is deleted (e.g., the candidate removes an address), all cross-section requirements that were triggered by that entry must be cleared from the registry. The registry stays in sync with the candidate's current state.
20. A cross-section requirement banner appears at the top of the target section listing the externally-triggered required fields (e.g., "Based on addresses you entered, the following fields are now required: Middle Name"). The banner is informational (info color), not an error.
21. Document uploads happen immediately on file selection — they are NOT deferred until form submission. This follows the existing internal order flow pattern (per `COMPONENT_STANDARDS` Section 4).
22. All section status values use lowercase strings: `not_started`, `incomplete`, `complete`. Title Case and ALL CAPS are prohibited (per the project-wide status casing rule).

---

## User Flow

### Flow 1: Candidate reviews a workflow section

1. Candidate opens their application from the email link.
2. The section navigation shows compliance sections (e.g., "Notice of Processing" before services, "Authorization" after services) interleaved with service sections in the configured order.
3. Candidate clicks "Notice of Processing".
4. The section title appears as a heading. Below it, the compliance content renders in a scrollable area: HTML for `type = 'text'` sections, or a download link labelled with `fileName` for `type = 'document'` sections.
5. Below the content, a checkbox reads "I have read and agree to the above".
6. Candidate ticks the checkbox.
7. The auto-save handler fires. The acknowledgment is persisted to `order_data` keyed by the workflow section's UUID, and recorded in `formData.sections[<workflowSectionId>] = { type: 'workflow_section', acknowledged: true }`.
8. The section progress indicator next to "Notice of Processing" turns green.

### Flow 2: Candidate uploads a document

1. Candidate is in Education History entering an entry for Australia.
2. Below the entry's fields, a document requirement card displays "Copy of Degree — Required" with instructions "Please upload a scanned copy of your degree or certificate."
3. Candidate taps the upload button.
4. On mobile, the OS file picker opens with the camera option available (via `<input type="file" accept=".pdf,.jpg,.jpeg,.png" capture="environment">`).
5. Candidate takes a photo of the diploma.
6. The component validates file size and MIME type client-side. If invalid, the candidate sees an error message and can try again. If valid, upload begins; a spinner is shown.
7. Server receives the file at POST `/api/candidate/application/[token]/upload`, validates token, size, and type, stores the file in `uploads/draft-documents/{orderId}/{timestamp}-{originalName}`, and returns metadata.
8. Component receives the metadata and displays the filename, human-readable file size (e.g., "271 KB"), and a remove button.
9. Auto-save fires. Because this is a `per_entry`-scoped requirement, the metadata is written into the entry's `fields` array under the requirement's UUID.
10. The section progress recalculates. With this required document now satisfied (and assuming all other required fields/documents are filled), Education History turns green.

### Flow 3: Cross-section requirement triggers a target-section change

1. Personal Information shows green; the candidate has filled all locally-required fields.
2. Candidate goes to Address History and enters an address in Country X.
3. DSX requirements for Country X include "Middle Name" with `collectionTab = 'personal_info'`.
4. The cross-section registry adds an entry under `personal_info` for the Middle Name requirement, marked as triggered by Address History.
5. Personal Information's progress recalculates. Middle Name is empty, so Personal Information turns red.
6. A banner appears at the top of Personal Information: "Based on addresses you entered, the following fields are now required: Middle Name".
7. Candidate navigates to Personal Information and fills in Middle Name.
8. Auto-save fires; progress recalculates; Personal Information turns green again.
9. If the candidate later deletes the Country X address, the registry entry is cleared, and Personal Information no longer treats Middle Name as required (assuming no other section still requires it).

---

## Data Requirements

This section is the single source of truth for all field names, types, and shapes touched by this stage. Implementer must copy these names exactly.

### POST `/api/candidate/application/[token]/upload` — Request (multipart/form-data)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| File | `file` | binary file (multipart) | Required | Max 10 MB; MIME must be `application/pdf`, `image/jpeg`, or `image/png` | — |
| Requirement ID | `requirementId` | text (UUID) | Required | Must reference an existing `dsx_requirements.id` | — |
| Entry Index | `entryIndex` | number | Optional | Non-negative integer; only used for `per_entry`-scoped documents | — |

### POST `/api/candidate/application/[token]/upload` — Response (success, 201)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Document ID | `documentId` | text (UUID) | Required | Server-generated UUID | — |
| Original Name | `originalName` | text | Required | The filename as uploaded | — |
| Storage Path | `storagePath` | text | Required | `uploads/draft-documents/{orderId}/{timestamp}-{originalName}` | — |
| MIME Type | `mimeType` | text | Required | `application/pdf` / `image/jpeg` / `image/png` | — |
| Size | `size` | number | Required | Bytes; integer | — |
| Uploaded At | `uploadedAt` | ISO8601 timestamp | Required | UTC | — |

### POST `/api/candidate/application/[token]/upload` — Response (error, 400)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Error Message | `error` | text | Required | E.g. "File too large. Maximum size is 10 MB." or "File type not allowed. Accepted types: PDF, JPEG, PNG." | — |

### DELETE `/api/candidate/application/[token]/upload/[documentId]` — Response (success, 200)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Deleted | `deleted` | boolean | Required | Always `true` on success | — |

### Structure endpoint additions — GET `/api/candidate/application/[token]` (extended response per section)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Section Status | `status` | dropdown (text) | Required (per section) | One of `not_started`, `incomplete`, `complete` (lowercase) | `not_started` |

### Structure endpoint additions — workflow section payload

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Section ID | `id` | text (UUID) | Required | `workflow_sections.id` | — |
| Section Name | `name` | text | Required | From `workflow_sections.name` | — |
| Type | `type` | dropdown (text) | Required | `text` or `document` | `text` |
| Content | `content` | text (HTML) | Optional | Sanitized before render; required when `type = 'text'` | — |
| File URL | `fileUrl` | text (URL) | Optional | Required when `type = 'document'` | — |
| File Name | `fileName` | text | Optional | Display label for download link; falls back to `name` | — |
| Placement | `placement` | dropdown (text) | Required | `before_services` or `after_services` | `before_services` |
| Display Order | `displayOrder` | number | Required | Non-negative integer | — |
| Is Required | `isRequired` | boolean | Required | — | `true` |

### WorkflowSectionRenderer — props/state

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Section | `section` | object | Required | Workflow section payload (above) | — |
| Acknowledged | `acknowledged` | boolean | Required | — | `false` |
| On Acknowledge | `onAcknowledge` | function | Required | `(checked: boolean) => void` | — |

### CandidateDocumentUpload — props/state

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Requirement | `requirement` | object | Required | Includes `id`, `name`, `instructions`, `isRequired`, `scope` | — |
| Uploaded Document | `uploadedDocument` | object \| null | Required | Existing metadata if any (see below); `null` if none | `null` |
| On Upload Complete | `onUploadComplete` | function | Required | `(metadata) => void` | — |
| On Remove | `onRemove` | function | Required | `() => void` | — |
| Token | `token` | text | Required | Candidate auth token | — |
| Internal — Status | `status` | dropdown (text) | Required (state) | One of `empty`, `uploading`, `uploaded`, `error` (lowercase) | `empty` |
| Internal — Error | `error` | text \| null | Optional (state) | Error message when `status = 'error'` | `null` |

### SectionProgressIndicator — props

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Status | `status` | dropdown (text) | Required | `not_started` / `incomplete` / `complete` (lowercase) | `not_started` |
| Label | `label` | text | Required | Section name (used for accessible label) | — |

### CrossSectionRequirementBanner — props

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Requirements | `requirements` | array of cross-section registry entries | Required | See registry shape below | `[]` |

### Cross-section requirement registry — entry shape

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Field ID | `fieldId` | text (UUID) | Required | The `dsx_requirements.id` of the requirement | — |
| Field Key | `fieldKey` | text | Required | camelCase; immutable; e.g., `middleName` | — |
| Field Name | `fieldName` | text | Required | Display label, e.g., "Middle Name" | — |
| Is Required | `isRequired` | boolean | Required | — | `true` |
| Triggered By | `triggeredBy` | text | Required | Source section identifier, e.g., `address_history` | — |
| Triggered By Context | `triggeredByContext` | text | Optional | Human-readable context, e.g., "Criminal Search - Australia" | — |
| Triggered By Entry Index | `triggeredByEntryIndex` | number | Optional | The repeatable entry index that triggered this requirement (for cleanup on deletion) | — |

### Saved acknowledgment record (in `formData.sections`)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Bucket Key | (key) `<workflowSectionId>` | text (UUID) | Required | Equals `workflow_sections.id` (per Business Rule 7) | — |
| Type Discriminator | `type` | text | Required | Always `workflow_section` | `workflow_section` |
| Acknowledged | `acknowledged` | boolean | Required | — | `false` |

### Saved document metadata record (stored in `order_data` via auto-save)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Document ID | `documentId` | text (UUID) | Required | Matches the upload response | — |
| Original Name | `originalName` | text | Required | — | — |
| Storage Path | `storagePath` | text | Required | — | — |
| MIME Type | `mimeType` | text | Required | — | — |
| Size | `size` | number | Required | Bytes | — |
| Uploaded At | `uploadedAt` | ISO8601 timestamp | Required | UTC | — |

**Storage location by scope (Business Rule 11):**
- `per_entry` → inside the entry's `fields` array in `formData`, keyed by requirement UUID.
- `per_search` → in the section's aggregated bucket, keyed by `{requirementId, serviceId, jurisdictionId}`.
- `per_order` → in the section's aggregated bucket, keyed by requirement UUID, single slot.

---

## What This Stage Delivers

### Deliverable 1: WorkflowSectionRenderer Component

A new component that displays workflow sections. Unlike service sections (which collect data from the candidate), workflow sections present content *to* the candidate. Think of them as "read and acknowledge" steps.

**What a workflow section looks like to the candidate:**
- A title (e.g., "Notice of Processing" or "Authorization to Run Background Check").
- A block of content. Per Business Rule 3 and 4, the renderer handles two `type` values:
  - `type === 'text'` → render `content` as sanitized HTML in a scrollable container.
  - `type === 'document'` (with a non-null `fileUrl`) → render a tap-to-open/download link labelled with `fileName`, falling back to the section `name`. No embedded PDF viewer.
- An acknowledgment checkbox below the content (per Business Rule 5, the label is the hardcoded translated string "I have read and agree to the above").

**Where workflow sections appear:**
- **Zone 1 (Before Services):** `placement = 'before_services'`, ordered by `displayOrder`.
- **Zone 2 (Service Sections):** IDV, Address History, Education, Employment from earlier stages.
- **Zone 3 (After Services):** `placement = 'after_services'`, ordered by `displayOrder`.

**Examples:**
- *Before services:* Notice of Processing (EU compliance), Instructions, Disclosure of Consumer Report.
- *After services:* General Consent Form (Australia), Authorization to Run Background Check, State-Specific Notices.

**Data source:** `workflow_sections` table, loaded via the existing `/api/candidate/application/[token]` structure endpoint.

### Deliverable 2: Document Upload Component (CandidateDocumentUpload)

A reusable upload component that replaces the informational document line items from Stage 3.

**Background:** When the system determines what data a service needs for a given country, some of those requirements are documents (`type = 'document'` in `dsx_requirements`). Stage 3 displayed these as text only — no upload. This stage adds working uploads.

**Behavior:**
- Shows the document name and any instructions (`dsx_requirements.documentData.instructions`).
- Shows whether the document is required or optional (`DSXMapping.isRequired`).
- Provides a file picker; on mobile the OS picker offers the camera option natively.
- On selection, validates client-side and uploads immediately (Business Rule 21 — not deferred to submission).
- Shows uploading state (spinner), uploaded state (filename, size, remove button), error state (message + try-again).
- Stores only the metadata in form state — the File object is not retained client-side after upload.

**Upload pattern:** Reuses `uploads/draft-documents/{orderId}/` from the internal order flow. At submission (Phase 7), files are linked to order items and fulfillment records.

**Where document uploads appear:** Inside any service section that has document requirements (Address History, Education, Employment, IDV). The Stage 3 informational placeholders are replaced with this component.

**File constraints:** Max 10 MB; PDF, JPEG, PNG only. Both client and server validate.

### Deliverable 3: Section Progress Indicators

Visual indicators in the section navigation showing the status of each section.

**Three states (Business Rule 14, lowercase per Rule 22):**
- `not_started` (grey): nothing entered.
- `complete` (green): all required fields/documents satisfied; for workflow sections, acknowledgment is checked.
- `incomplete` (red): started but not complete.

**Completeness rules per section type:**

| Section Type | Complete When |
|---|---|
| Personal Information | All locally-required fields have values, AND all cross-section requirements registered against `personal_info` have values. |
| IDV | All required DSX fields for the selected country have values. |
| Address History | All required fields and documents within entries the candidate has created are satisfied (Stage 4 does NOT check scope coverage — Business Rule 16). |
| Education History | Same as Address History. |
| Employment History | Same as Address History. |
| Workflow Section | Acknowledgment checkbox is checked when `isRequired = true`; always complete when `isRequired = false`. |

**When progress updates:** On every auto-save (existing on-blur trigger). Calculation runs client-side from form state — no extra API call.

**Visual design:** Small colored dot or icon next to the section name. The implementer follows the platform's existing status-icon conventions.

### Deliverable 4: Cross-Section Requirement Awareness (TD-052)

**Problem:** When a service section (e.g., Address History) loads DSX requirements, some of those requirements may target a different tab via `collectionTab` (e.g., `personal_info`). Without cross-section tracking, the target tab's progress indicator would be unaware that a new field has become required.

**Scope (Business Rule 17):** Stage 4 supports only `personal_info` as a cross-section target. The registry pattern allows additional targets later but they are not built in this stage.

**How it works:**
1. When any section loads DSX requirements, it inspects each requirement's `collectionTab`.
2. Requirements whose `collectionTab` matches the current section render normally.
3. Requirements whose `collectionTab` is different (only `personal_info` for Stage 4) are written to a central registry under that target section's key.
4. Each section's progress check evaluates both its local fields and the registry entries written against it (Business Rule 18).
5. Cross-section banner displays the externally-triggered required fields on the target section (Business Rule 20).
6. When a repeatable entry is removed, registry entries with a matching `triggeredByEntryIndex` are cleared (Business Rule 19).

---

## API Endpoints

### 1. POST `/api/candidate/application/[token]/upload`

Handles document uploads from the candidate.

**Request:** Multipart form data with `file`, `requirementId`, optional `entryIndex` (see Data Requirements table).

**Response (success — 201):**
```
{
  "documentId": "uuid",
  "originalName": "diploma-scan.pdf",
  "storagePath": "uploads/draft-documents/{orderId}/diploma-scan.pdf",
  "mimeType": "application/pdf",
  "size": 276740,
  "uploadedAt": "2026-05-04T12:00:00.000Z"
}
```

**Response (error — 400):**
```
{ "error": "File too large. Maximum size is 10 MB." }
```
or
```
{ "error": "File type not allowed. Accepted types: PDF, JPEG, PNG." }
```

**Server-side behavior:**
- Validates the candidate token (same authentication model as other candidate endpoints).
- Validates file size (max 10 MB) and MIME type (`application/pdf`, `image/jpeg`, `image/png`).
- Stores the file in `uploads/draft-documents/{orderId}/{timestamp}-{originalName}`.
- Returns metadata; does NOT write a database row at upload time. The metadata is persisted via the standard auto-save into `order_data`.

### 2. DELETE `/api/candidate/application/[token]/upload/[documentId]`

Removes a previously uploaded document.

**Response (success — 200):**
```
{ "deleted": true }
```

**Server-side behavior:**
- Validates the token.
- Verifies the file belongs to the order tied to that token (Business Rule 12).
- Removes the file from disk; returns confirmation.

The form state in `order_data` is updated by the regular auto-save when the candidate removes the document — there is no separate database write here.

### 3. Enhancement to existing GET `/api/candidate/application/[token]`

The structure endpoint already returns the list of sections. This stage adds:
- **Workflow section content:** for each workflow section, return `id`, `name`, `type`, `content`, `fileUrl`, `fileName`, `placement`, `displayOrder`, `isRequired`.
- **Section progress data:** for each section (service or workflow), return a `status` field with one of `not_started`, `incomplete`, `complete`.

The endpoint already loads from `workflows` and `workflow_sections` via the package's `workflowId`. This stage adds the additional fields to the response payload.

---

## New UI Components

### 1. WorkflowSectionRenderer
**Location:** `src/components/candidate/sections/WorkflowSectionRenderer.tsx`

**Props:** `section`, `acknowledged`, `onAcknowledge` (see Data Requirements).

**Behavior:**
- Renders the section title as a heading.
- Renders content according to `type` (Business Rule 3 and 4):
  - `text` → sanitized HTML in a scrollable container.
  - `document` with `fileUrl` → download/open link labelled with `fileName` (fallback `name`).
- Renders the acknowledgment checkbox below the content with the hardcoded translated label "I have read and agree to the above" (Business Rule 5).
- Saves via the existing auto-save mechanism on checkbox change.

**Mobile considerations:** Independent scroll for content area; 44px minimum touch target for checkbox + label; minimum 16px font size.

### 2. CandidateDocumentUpload
**Location:** `src/components/candidate/CandidateDocumentUpload.tsx`

**Props:** see Data Requirements table.

**Behavior:**
- **Empty state:** name, instructions, required/optional badge, upload button.
- **Uploading state:** spinner + filename.
- **Uploaded state:** filename, human-readable size (e.g., "271 KB"), remove button.
- **Error state:** error message + try-again.

**File selection:**
- Desktop: click to open file picker.
- Mobile: tap opens system picker; `<input type="file" accept=".pdf,.jpg,.jpeg,.png" capture="environment">` provides camera option natively.

**Upload flow:**
1. Candidate selects a file.
2. Component validates size and type client-side.
3. If valid, calls upload endpoint.
4. Shows uploading state during upload.
5. On success, calls `onUploadComplete` with metadata.
6. On failure, sets error state.

### 3. SectionProgressIndicator
**Location:** `src/components/candidate/SectionProgressIndicator.tsx`

**Props:** `status`, `label` (see Data Requirements).

**Behavior:**
- `not_started`: grey empty circle.
- `incomplete`: red circle with X or exclamation.
- `complete`: green circle with check.
- Accessible label reads "{label} — {status}" for screen readers.

### 4. CrossSectionRequirementBanner
**Location:** `src/components/candidate/CrossSectionRequirementBanner.tsx`

**Props:** `requirements` (array of registry entries — see Data Requirements).

**Behavior:**
- Renders at the top of a target section when registry entries exist for it.
- Example message: "Based on addresses you entered, the following fields are now required: Middle Name".
- Informational banner styling (info/blue), not an error.
- Hidden when the registry array for that section is empty.

---

## Modified Components

### 1. CandidateApplicationShell (section navigation)
- Adds a `SectionProgressIndicator` next to each section name.
- Progress state is managed at the shell level and passed down.
- Recalculates on each auto-save.

### 2. Application Structure Endpoint Response
- Existing fields keep their shape; new fields (workflow content, status) are additive.

### 3. Aggregated Requirements Display (from Stage 3)
- Document requirement line items in Address History (and any other section showing aggregated requirements) are replaced with `CandidateDocumentUpload`. The informational-only display becomes interactive.

---

## Data Flow

### Workflow section acknowledgment
1. Structure endpoint returns workflow sections with content.
2. `WorkflowSectionRenderer` displays content + checkbox.
3. Candidate ticks the box.
4. Auto-save triggers on checkbox change.
5. Acknowledgment is stored in `order_data` keyed by `workflow_sections.id` (Business Rule 7), with form state shape `formData.sections[<workflowSectionId>] = { type: 'workflow_section', acknowledged: true }` (Business Rule 8).
6. Section progress recalculates → green for required + acknowledged.

### Document upload
1. DSX requirements load for a service/country.
2. Document-type requirements render as `CandidateDocumentUpload` instances.
3. Candidate selects a file.
4. POST `/api/candidate/application/[token]/upload`.
5. Server stores file in `uploads/draft-documents/{orderId}/`.
6. Server returns metadata.
7. Component calls `onUploadComplete` with metadata.
8. Auto-save persists metadata into `order_data` according to scope (Business Rule 11):
   - `per_entry` → inside the entry's `fields` array, keyed by requirement UUID.
   - `per_search` → in the section's aggregated bucket.
   - `per_order` → in the section's aggregated bucket (single slot).
9. Section progress recalculates.

### Section progress calculation
1. On each auto-save, progress recalculates for all sections.
2. For service sections: collect required fields and required documents within the entries that exist; check each has a value (Business Rule 16).
3. For workflow sections: check the acknowledgment per Business Rule 6.
4. For Personal Information: include cross-section registry entries under `personal_info` (Business Rule 18).
5. Updated states are pushed to indicators via React state (no extra API call).

---

## Cross-Section Requirement Registry

### Concept
A React context or state object at the application shell level. Sections post requirements that target other sections; sections read requirements posted to them.

### Shape
```
crossSectionRequirements: {
  personal_info: [
    {
      fieldId: "uuid-of-middle-name-requirement",
      fieldKey: "middleName",
      fieldName: "Middle Name",
      isRequired: true,
      triggeredBy: "address_history",
      triggeredByContext: "Criminal Search - Australia",
      triggeredByEntryIndex: 0
    }
  ]
  // Stage 4 supports personal_info only (Business Rule 17). Other keys may be added later.
}
```

### How it gets populated
When a section loads DSX requirements, it inspects `collectionTab`:
- Matches current section → render locally.
- Different (Stage 4: only `personal_info`) → push to registry under that section's key.

### How it gets read
Each section's progress check evaluates:
1. Its own locally-rendered required fields.
2. The registry entries posted under its key.

Both must be satisfied for green.

### When it clears
On removal of a repeatable entry, registry entries with a matching `triggeredByEntryIndex` are cleared (Business Rule 19). On country change within an entry, the section re-loads requirements and the registry is rewritten for that entry.

---

## Existing Patterns Being Reused

- **Auto-save on blur:** Stage 1 implementation. Uploads and acknowledgments use this same mechanism.
- **RepeatableEntryManager:** Stage 2 component. Document uploads may render inside repeatable entries.
- **Draft documents upload pattern:** Internal order flow already stores files in `uploads/draft-documents/` with metadata in `order_data.fieldValue`. Candidate flow follows the same pattern with candidate token authentication.
- **DSX field and document loading:** Stages 1–3. Document requirements already load and display; this stage makes them interactive.
- **Address aggregated requirements area:** Stage 3. Document line items already render; this stage swaps the placeholder for the upload component.

---

## Tech Debt Items Addressed

### TD-009 — Missing User Feedback for Document Upload Failures
`CandidateDocumentUpload` includes error feedback for both client-side and server-side failures.

### TD-011 — No Upload Progress Indication for Large Files
`CandidateDocumentUpload` shows a loading indicator during upload.

### TD-052 — Cross-Section Requirement Awareness
The cross-section requirement registry (Deliverable 4) directly addresses this item. Stage 4 implements the `personal_info` target; the registry pattern leaves room for additional targets later (Business Rule 17).

---

## Edge Cases and Error Scenarios

- **Required field left blank at submit time:** out of scope for Stage 4 (Phase 7 handles submission). For Stage 4, the section simply shows incomplete (red).
- **User lacks permission / token invalid:** upload and delete endpoints return 401/403; the UI shows a generic error and a try-again option.
- **Network failure during upload:** the component enters error state with a try-again button. The form state is unchanged (no metadata recorded).
- **File too large or wrong type:** validated client-side first; server validates again. Component shows the specific error message returned.
- **Disabled or removed requirement after upload:** the metadata remains in `order_data` but the requirement no longer renders; cleanup is out of scope (TD-010).
- **Workflow section content has unsafe HTML:** must be sanitized server-side or in the renderer. Script tags and event handlers are stripped; basic formatting (bold, italic, links, lists) is preserved.
- **Repeatable entry deleted while upload in progress:** the upload completes but the resulting metadata has no home; auto-save discards it because the entry no longer exists.
- **Cross-section requirement comes from multiple entries simultaneously:** the registry holds multiple entries; the banner lists each unique field once.
- **Candidate uploads to one entry then deletes that entry:** registry-cleanup logic (Business Rule 19) clears any cross-section requirements; the orphaned file is left on disk (TD-010).
- **Workflow section with `type = 'document'` but no `fileUrl`:** renderer shows the section name and a placeholder message; checkbox still works for acknowledgment if `isRequired = true`. Internal admin tooling should prevent this state, but the renderer must not crash.

---

## Impact on Other Modules

- **Customer Configurations:** workflow sections are configured by internal admins through existing customer/workflow tooling. This stage consumes that data without changing the admin UI.
- **Global Configurations (DSX):** existing `dsx_requirements` rows with `documentData.scope` and `fieldData.collectionTab` are now read by candidate-facing logic. No schema change.
- **Candidate Workflow:** all four deliverables live here.
- **Internal order flow:** unchanged. The candidate upload reuses its `uploads/draft-documents/` pattern but does not modify the internal flow.

---

## Definition of Done

1. `WorkflowSectionRenderer` is implemented at `src/components/candidate/sections/WorkflowSectionRenderer.tsx` and renders both `text` and `document` workflow section types per Business Rules 3 and 4.
2. The acknowledgment checkbox label uses the hardcoded translated string "I have read and agree to the above" (Business Rule 5).
3. Workflow section acknowledgments are saved to `order_data` keyed by `workflow_sections.id` (Business Rule 7) with form-state shape `formData.sections[<workflowSectionId>] = { type: 'workflow_section', acknowledged: true }` (Business Rule 8).
4. Workflow sections render in the correct zones based on `placement` and `displayOrder` (Business Rules 1 and 2).
5. `CandidateDocumentUpload` is implemented at `src/components/candidate/CandidateDocumentUpload.tsx` with empty/uploading/uploaded/error states and replaces Stage 3's informational document line items.
6. Document upload endpoint POST `/api/candidate/application/[token]/upload` is implemented with token validation, size validation (max 10 MB), MIME validation (PDF/JPEG/PNG), and storage at `uploads/draft-documents/{orderId}/{timestamp}-{originalName}` (Business Rules 9, 10, 12).
7. Document delete endpoint DELETE `/api/candidate/application/[token]/upload/[documentId]` is implemented with token validation, ownership verification, and disk removal (Business Rules 12, 13).
8. Document metadata persists in `order_data` according to scope: `per_entry` inside the entry's `fields` array keyed by requirement UUID; `per_search` and `per_order` in the section's aggregated bucket (Business Rule 11).
9. Document uploads happen immediately on file selection, not at form submission (Business Rule 21).
10. `SectionProgressIndicator` is implemented at `src/components/candidate/SectionProgressIndicator.tsx` and supports the three lowercase status values `not_started`, `incomplete`, `complete` (Business Rules 14, 22).
11. Section progress recalculates on every auto-save event (Business Rule 15).
12. Repeatable section progress checks only the entries the candidate has already created — Stage 4 explicitly does NOT perform scope coverage checks or gap detection (Business Rule 16). Both are deferred to Phase 7.
13. Cross-section requirement registry is implemented and populated when DSX requirements with `collectionTab !== 'currentSection'` are loaded. Stage 4 implements only the `personal_info` target (Business Rule 17).
14. Personal Information's progress check evaluates both local fields and registry entries under `personal_info` (Business Rule 18).
15. `CrossSectionRequirementBanner` is implemented at `src/components/candidate/CrossSectionRequirementBanner.tsx` and renders the list of externally-triggered required fields on the target section (Business Rule 20).
16. When a repeatable entry is deleted, registry entries with a matching `triggeredByEntryIndex` are cleared (Business Rule 19).
17. The structure endpoint GET `/api/candidate/application/[token]` returns workflow section content (`id`, `name`, `type`, `content`, `fileUrl`, `fileName`, `placement`, `displayOrder`, `isRequired`) and a `status` value for each section.
18. Mobile capture works: tapping the upload control on iOS Safari and Chrome for Android opens the OS picker with the camera option available, via the standard `<input type="file" capture="environment">` attribute.
19. HTML sanitization is applied to workflow section `content` before rendering. Script tags and event handlers are stripped; basic formatting is preserved.
20. All status values used in code, database, and tests are lowercase strings (Business Rule 22 and the project-wide casing rule).
21. Pass 1 tests cover: upload size/type validation, token enforcement on upload and delete, structure endpoint returns workflow content + status, candidate sees workflow sections in correct zones, candidate can acknowledge a workflow section, candidate can upload and remove a document, progress indicators show all three states, cross-section requirements affect Personal Information's status, mobile camera affordance is present.
22. Pass 2 tests cover: each component's rendering across states, callback invocation on user actions, error states for oversized/wrong-type files, progress calculation purity (returns `complete`/`incomplete`/`not_started` from inputs), inclusion of cross-section requirements in Personal Information's progress.
23. Linter, typechecker, and full Vitest suite pass with zero net regression.
24. Tech debt items TD-009, TD-011, and TD-052 are marked addressed by this stage.

---

## What This Stage Does NOT Include

- **Scope validation** (entries cover the required time period or count) — Phase 7.
- **Gap tolerance detection** — Phase 7.
- **Submission flow** (final submit button, batch order item creation, status change to `submitted`) — Phase 7.
- **Digital signatures** beyond a checkbox — future phase.
- **Virus scanning** of uploaded files — future enhancement.
- **Drag-and-drop upload** — future UX improvement.
- **File cleanup for orphaned documents** — TD-010, not addressed here.
- **Rich-text admin editor for workflow content** — future enhancement.
- **Custom per-workflow-section acknowledgment text** — deferred (Business Rule 5).
- **Cross-section requirement targets other than `personal_info`** — registry pattern allows them later but not built in Stage 4 (Business Rule 17).

---

## Database Changes

**None.** This stage uses existing tables and columns.

Verified present in `prisma/schema.prisma` (`workflow_sections.content` at line 306, `workflow_sections.placement` at line 304). No migration is required for this stage.

- `workflow_sections` already has `name`, `displayOrder`, `isRequired`, `workflowId`, `placement` (line 304), `type` (line 305), `content` (line 306), `fileUrl` (line 307), `fileName` (line 308).
- `order_data` is the existing store for both candidate field values and document metadata. Workflow acknowledgments are written here as well, keyed by `workflow_sections.id` (Business Rule 7).
- No new tables are needed.

---

## Testing Strategy

### Pass 1 Tests (before implementation)

**Schema/validation tests:**
- Upload endpoint rejects files over 10 MB.
- Upload endpoint rejects non-PDF/JPEG/PNG MIME types.
- Upload endpoint rejects requests with invalid candidate tokens.
- Delete endpoint rejects requests with invalid candidate tokens.
- Delete endpoint refuses deletion when the document does not belong to the order tied to the token.

**End-to-end tests:**
- Candidate sees workflow sections in correct zones (before/after services) per `placement` and `displayOrder`.
- Candidate can check the acknowledgment checkbox on a workflow section and the state persists across reload.
- Candidate can upload a document to a document-type DSX requirement.
- Candidate sees an upload progress indicator during upload.
- Candidate can remove an uploaded document.
- Section progress indicators show `not_started`, `incomplete`, and `complete` states correctly.
- Cross-section requirements cause Personal Information to show `incomplete` when the externally-triggered field is empty; banner lists the field.
- Mobile: camera option available via the file input on mobile devices.

### Pass 2 Tests (after implementation)

**Component tests (with mocks):**
- `WorkflowSectionRenderer` renders content and acknowledgment checkbox for `type = 'text'`.
- `WorkflowSectionRenderer` renders a download link labelled with `fileName` for `type = 'document'` (and falls back to `name` when `fileName` is empty).
- `WorkflowSectionRenderer` calls `onAcknowledge` when the checkbox toggles.
- `CandidateDocumentUpload` renders empty state when `uploadedDocument` is null.
- `CandidateDocumentUpload` shows uploading state during upload.
- `CandidateDocumentUpload` shows uploaded state with filename and size after upload.
- `CandidateDocumentUpload` shows error state for oversized files.
- `CandidateDocumentUpload` shows error state for wrong file types.
- `CandidateDocumentUpload` calls `onRemove` when remove is clicked.
- `SectionProgressIndicator` renders the correct icon for each lowercase status.
- `CrossSectionRequirementBanner` shows requirement names when the registry array has entries; renders nothing when empty.
- Progress calculation returns `complete` when all required fields and documents (including cross-section) are satisfied.
- Progress calculation returns `incomplete` when some are satisfied.
- Progress calculation returns `not_started` when none are satisfied.
- Progress calculation includes cross-section requirements registered under the section.

**API route tests (with mocks):**
- Upload endpoint stores file and returns metadata on success.
- Upload endpoint rejects invalid token, oversized files, wrong types.
- Delete endpoint removes file and returns `{ deleted: true }` on success.
- Delete endpoint refuses cross-order deletion.
- Structure endpoint includes workflow section content fields and per-section `status`.

---

## Estimated Complexity

**High.** Three distinct deliverables that interact: uploads feed into progress; cross-section requirements affect progress; workflow sections have their own progress rules. The cross-section registry is a new architectural pattern. The upload component must work cleanly across iOS Safari, Chrome for Android, and desktop. Progress calculation must be fast and pure.

**Key risks:**
- Cross-section tracking complexity if many sections trigger requirements simultaneously (mitigated by limiting Stage 4 to `personal_info`).
- Mobile file upload differences across browsers.
- Progress calculation performance on large applications (mitigated by keeping the calculation pure and incremental).
- Workflow content HTML safety (mitigated by sanitization).

---

## Implementation Notes for the Architect

1. **Upload endpoint security:** validate the candidate token and verify the upload belongs to that candidate's order. Apply the same check on delete.
2. **HTML sanitization:** use a library that strips script tags and event handlers but preserves bold, italic, links, and lists. Apply at render time at minimum; server-side sanitization on save is a defence-in-depth bonus.
3. **Progress calculation should be pure:** input is the section requirements + saved data; output is the status. Easy to test, isolated from rendering.
4. **Cross-section registry cleanup:** track `triggeredByEntryIndex` so removing an entry can clear its registry contributions cleanly.
5. **Document scope handling:** the upload component must distinguish `per_entry`, `per_search`, and `per_order` and write metadata to the correct location per Business Rule 11.
6. **Reuse existing internal-flow patterns:** look at `DocumentsReviewStep.tsx` and the related hooks for the storage/metadata pattern. Replace the user-session auth with candidate token auth.

---

## Open Questions

None. All clarifying questions answered prior to confirmation:
1. Acknowledgment storage key — `workflow_sections.id`.
2. Acknowledgment shape in formData — per-section bucket `formData.sections[<workflowSectionId>] = { type: 'workflow_section', acknowledged: true }`.
3. Document metadata storage location — `per_entry` inside the entry's `fields` array; `per_search` and `per_order` in the section's aggregated bucket.
4. Section progress for repeatable sections — only required fields/documents inside existing entries; no scope or gap checks.
5. Cross-section target scope — only `personal_info` for Stage 4.
6. Acknowledgment text — hardcoded "I have read and agree to the above" via translation system.
7. Workflow section `type` handling — `text` renders sanitized HTML; `document` with `fileUrl` renders a download link labelled with `fileName` (fallback to section `name`); no embedded PDF viewer.
8. Spec confirmation — confirmed; status flipped to Confirmed.
