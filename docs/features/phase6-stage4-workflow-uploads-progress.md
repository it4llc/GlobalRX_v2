# Phase 6 Stage 4: Workflow Sections, Document Uploads & Section Progress

This document describes the candidate-portal additions delivered in Phase 6 Stage 4. The stage builds on the repeatable-entry infrastructure from Stages 2 and 3 and adds three new capabilities: rendering administrator-configured workflow sections, live document uploads, and a per-section progress indicator in the sidebar.

## Scope of This Stage

- Renders `workflow_section` entries (text and document types) embedded in the application flow, with a per-section acknowledgment checkbox.
- Adds live document upload and removal for document-type DSX requirements in all repeatable sections and the aggregated requirements panel.
- Adds a `SectionProgressIndicator` in the sidebar that reflects computed progress across all sections.
- Wires a cross-section requirement registry so that DSX requirements collected in repeatable sections (Education, Employment, Address History) can promote fields on the Personal Information tab to required status.
- Completes the Address History Stage 4 wiring (the registry and progress callbacks that Education and Employment already had in Stage 3 are now also wired for Address History).
- Extends the `/save`, `/saved-data`, and `/structure` endpoints to support workflow-section acknowledgments and document-upload metadata.
- Adds two new endpoints: `POST /api/candidate/application/[token]/upload` and `DELETE /api/candidate/application/[token]/upload/[documentId]`.

What this stage does **not** add: document preview, gap-tolerance enforcement, submit flow, or multi-file upload per requirement.

## New Components

All components are client components. Source files are in `src/components/candidate/` unless noted.

### `WorkflowSectionRenderer`

Location: `src/components/candidate/form-engine/WorkflowSectionRenderer.tsx`

Renders a single workflow section for the candidate. Accepts a `WorkflowSectionPayload` prop (content, type, fileUrl, fileName), an `acknowledged` boolean, and an `onAcknowledge` callback.

Two content types are supported:
- `text` — sanitized HTML rendered in a scrollable container. Sanitization is performed by `sanitizeWorkflowContent` (DOMPurify allow-list; strips script, style, iframe, object, embed, and all `on*` handlers).
- `document` — a tap-to-open link labelled with `fileName`, falling back to the section `name`. Only `http://`, `https://`, and root-relative (`/...`) URLs are permitted; any other `fileUrl` value renders a "Document not available" placeholder.

An acknowledgment checkbox is always rendered below the content. Its `onChange` invokes `onAcknowledge(checked)`; the shell persists the value via the `/save` endpoint.

The component is stateless — the shell (`portal-layout.tsx`) owns the `workflowAcknowledgments` map and the persist logic.

### `CandidateDocumentUpload`

Location: `src/components/candidate/CandidateDocumentUpload.tsx`

Reusable upload widget for a single document requirement. Renders a hidden file input triggered by a visible "Upload" button. Implements the four-state machine `empty → uploading → uploaded | error`.

Behavior:
- Client-side validation runs before the network call (max 10 MB; MIME types `application/pdf`, `image/jpeg`, `image/png`). The server re-validates as defense in depth.
- On valid file selection, posts to `POST /api/candidate/application/[token]/upload` with `multipart/form-data`. The `Content-Type` header is not set manually — the browser provides the multipart boundary.
- On success, calls `onUploadComplete(metadata)`. The parent routes the metadata into the correct slot in form state per Business Rule 11.
- The "Remove" button calls `DELETE /api/candidate/application/[token]/upload/[documentId]` and then calls `onRemove()` on success.
- The `capture="environment"` attribute on the hidden input prompts mobile browsers to offer the device camera.
- Upload failures (both client validation and server errors) are shown via a visible `role="alert"` region with a "Try again" affordance, addressing TD-009.
- A spinner is shown while upload is in progress, addressing TD-011.

Props: `requirement` (id, name, instructions, isRequired, scope), `uploadedDocument` (or null), `onUploadComplete`, `onRemove`, `token`, and optional `entryIndex` (for per-entry-scoped requirements).

### `SectionProgressIndicator`

Location: `src/components/candidate/SectionProgressIndicator.tsx`

Small visual indicator displayed next to each section name in the sidebar. Renders one of three lowercase statuses (Business Rules 14 and 22):
- `not_started` — grey empty circle
- `incomplete` — red circle with an exclamation mark
- `complete` — green circle with a check mark

Stateless presentational component. Includes a screen-reader-only label combining the section name and status (e.g., "Personal Information — Incomplete") so assistive technology announces both. Unrecognized status values fall back to `not_started` silently.

### `CrossSectionRequirementBanner`

Location: `src/components/candidate/CrossSectionRequirementBanner.tsx`

Informational banner rendered at the top of a target section when one or more cross-section registry entries point to it. Displays a deduplicated list of field names (deduplicated by `fieldKey` for display, though the registry stores separate rows per entry-index). Hidden when the requirements array is empty.

Uses `role="status"` and info/blue styling. Stateless presentational component.

## Modified Components

### `PortalSidebar`

The inline `getStatusIcon` / `getStatusLabel` functions are removed. Each section button now renders `<SectionProgressIndicator status={section.status} label={sectionLabel} />` instead.

### `PortalLayout`

Three new pieces of shell-level state are added (Stage 4):
- `sectionStatuses` — `Record<string, SectionStatus>` initialized from the structure endpoint's initial statuses. Updated by a `handleSectionProgressUpdate` callback that sections call after each auto-save.
- `crossSectionRegistry` — `CrossSectionRegistry` (`Partial<Record<CrossSectionTarget, CrossSectionRequirementEntry[]>>`). Updated by three callbacks (`handleCrossSectionRequirementsChanged`, `handleCrossSectionRequirementsRemovedForEntry`, `handleCrossSectionRequirementsRemovedForSource`) that delegate to pure helpers in `src/lib/candidate/crossSectionRegistry.ts`.
- `workflowAcknowledgments` — `Record<string, boolean>` keyed by `workflow_sections.id`. Hydrated once on mount via `GET /saved-data`; kept in sync by the `handleWorkflowAcknowledge` callback.

**TD-059 additions (May 2026):** Two additional pieces of shell-level state were added to fix sidebar reactivity for unmounted sections:
- `personalInfoFields` — `PersonalInfoField[]`. Populated by a one-time fetch of `GET /personal-info-fields` on mount. Passed to `PersonalInfoSection` as a prop so the section does not make its own fetch.
- `personalInfoSavedValues` — `Record<string, unknown>` keyed by `requirementId`. Extracted from the existing `GET /saved-data` hydration effect alongside workflow acknowledgments; refreshed by `PersonalInfoSection` via `onSavedValuesChange` after each successful auto-save.

A shell-level `useEffect` with dependencies `(personalInfoFields, personalInfoSavedValues, subjectCrossSectionRequirements)` calls `computePersonalInfoStatus` and writes the result to `sectionStatuses` via `handleSectionProgressUpdate` whenever any input changes. This runs regardless of which tab is active, so the sidebar indicator for Personal Info stays accurate even when `PersonalInfoSection` is unmounted.

A `sectionsWithStatus` memo merges `sectionStatuses` over the original `sections` prop and passes the result to both sidebar instances so the indicator always reflects the latest computed value.

The `WorkflowSectionRenderer` is now dispatched for `type === 'workflow_section'` sections. All existing section types (`personal_info`, `idv`, `address_history`, `verification-edu`, `verification-emp`) receive the four Stage 4 callbacks; `PersonalInfoSection` additionally receives `crossSectionRequirements`.

### `PersonalInfoSection`

Stage 4 added two optional props: `crossSectionRequirements?: CrossSectionRequirementEntry[]` and `onProgressUpdate?: (status: SectionStatus) => void`. A `useEffect` recomputed `computePersonalInfoStatus` whenever `fields`, `formData`, or `crossSectionRequirements` changed, and called `onProgressUpdate` with the result.

**TD-059 additions (May 2026):** The component's internal `GET /personal-info-fields` and `GET /saved-data` fetches were removed. Three new props replace those fetches:
- `fields: PersonalInfoField[]` — field definitions, now provided by the shell.
- `initialSavedValues?: Record<string, unknown>` — saved values keyed by `requirementId`, provided by the shell.
- `onSavedValuesChange?: (next: Record<string, unknown>) => void` — called after each successful auto-save to push fresh values back up to the shell.

The local progress effect (`onProgressUpdate` call on `formData` change) is retained for live typing feedback. The `formData` type was tightened from `Record<string, any>` to `Record<string, FieldValue>`.

A `crossSectionRequiredKeys` memo was added to compute the set of fieldKeys promoted to required by the cross-section registry. This set is OR'd with the field's baseline `isRequired` when passing `isRequired` to `DynamicFieldRenderer`, so the red-star indicator matches what `computePersonalInfoStatus` already accounts for.

`CrossSectionRequirementBanner` is rendered at the top of the section (and in the empty-fields branch) driven by the `crossSectionRequirements` prop.

### `EducationSection` and `EmploymentSection`

Both sections receive four new optional props matching the cross-section / progress callback shape:
- `onProgressUpdate`
- `onCrossSectionRequirementsChanged`
- `onCrossSectionRequirementsRemovedForEntry`
- `onCrossSectionRequirementsRemovedForSource`

These are forwarded to `useRepeatableSectionStage4Wiring`. Each section uses a stable `CROSS_SECTION_SOURCE` string constant (`'education_history'`, `'employment_history'`) as the registry identifier.

Both sections also integrate `CandidateDocumentUpload` for per-entry document requirements.

### `AddressHistorySection`

Receives the same four callbacks as Education and Employment. The wiring uses `useRepeatableSectionStage4Wiring` with an adapter layer from `addressHistoryStage4Wiring.ts` because Address History's DSX field storage is keyed `${entryId}::${serviceId}` rather than by `countryId` alone.

Also integrates `CandidateDocumentUpload` for per-entry document requirements.

### `AggregatedRequirements`

Four new optional props: `uploadedDocuments`, `onDocumentUploadComplete`, `onDocumentRemove`, and `token`. When all three callbacks and the token are present, document-type items render `CandidateDocumentUpload` instead of the Stage 3 informational display. When any of the four are absent, the component falls back to the read-only display, preserving backward compatibility.

## New Library Utilities

All files are in `src/lib/candidate/`.

### `crossSectionRegistry.ts`

Pure, stateless helpers for reading and writing the cross-section requirement registry. All functions return a new registry object without mutating the input.

Exported functions:
- `addCrossSectionRequirements(registry, target, entries)` — appends entries under the given target.
- `getCrossSectionRequirements(registry, target)` — returns the entries for a target, or an empty array.
- `removeCrossSectionRequirementsForEntry(registry, triggeredBy, entryIndex)` — removes entries contributed by a specific entry index from a specific source.
- `removeCrossSectionRequirementsForSource(registry, triggeredBy)` — removes all entries contributed by a source (used when a section is cleared).

### `sectionProgress.ts`

Pure helper functions that compute a `SectionStatus` from field and acknowledgment state. No React hooks.

Exported functions:
- `computeWorkflowSectionStatus(section, acknowledgmentState)` — returns `complete` when the section is either not required or is acknowledged; `incomplete` when it is required and unacknowledged; `not_started` when no interaction has occurred.
- `computePersonalInfoStatus(fields, valuesByFieldKey, crossSectionRequirements)` — computes `SectionStatus` for the Personal Information section by checking every required field (both direct and cross-section-promoted) for a non-empty value.
- `computeRepeatableSectionStatus(progressInputs)` — computes `SectionStatus` for repeatable sections (Education, Employment, Address History) from a list of entry-level field/value inputs.

### `sanitizeWorkflowContent.ts`

Thin wrapper around DOMPurify that strips disallowed tags and all event handlers from admin-configured HTML content before it is rendered via `dangerouslySetInnerHTML`. Called by `WorkflowSectionRenderer`.

### `useRepeatableSectionStage4Wiring.ts`

Shared React hook used by Education, Employment, and (via an adapter) Address History. Encapsulates the common logic for:
- Recomputing section progress after each save and calling `onProgressUpdate`.
- Splitting DSX fields by `collectionTab` into local and subject-targeted buckets.
- Pushing subject-targeted fields to the cross-section registry via `onCrossSectionRequirementsChanged`.
- Cleaning up registry entries when an entry is removed (`onCrossSectionRequirementsRemovedForEntry`).

**TD-059 change (May 2026):** The unmount cleanup effect that previously called `onCrossSectionRequirementsRemovedForSource` when the hook's host section was navigated away from was removed. Cross-section contributions must persist across tab navigation so the shell's lifted Personal Info progress effect continues to see the correct registry state. Registry cleanup on source section clear is still handled by the explicit per-entry removal callbacks and the replace semantics in Effect 1 — the hook itself no longer participates in unmount cleanup. The `onCrossSectionRequirementsRemovedForSource` prop is retained on the interface because section components still receive and pass it through for direct use.

Exported helpers: `useRepeatableSectionStage4Wiring`, `buildRepeatableProgressInputs`, `buildSubjectRequirementsForEntries`.

### `addressHistoryStage4Wiring.ts`

Pure-helper adapter module specific to `AddressHistorySection`. Because Address History caches DSX fields per `${entryId}::${serviceId}` rather than by `countryId`, this module translates that storage shape into the country-keyed inputs that `useRepeatableSectionStage4Wiring` consumes.

Also owns document-scope routing helpers (key construction for `per_entry`, `per_search`, and `per_order` scopes) and the `buildAddressHistorySubjectRequirements` function used to build cross-section registry contributions from Address History's field loader output.

Exported constant: `ADDRESS_HISTORY_CROSS_SECTION_SOURCE` (`'address_history'`).

## New Types

### `src/types/candidate-stage4.ts`

New file. Defines all Stage 4-specific types:
- `SectionStatus` — `'not_started' | 'incomplete' | 'complete'`
- `WorkflowSectionPayload` — the full workflow section shape returned by the structure endpoint
- `DocumentScope` — `'per_entry' | 'per_search' | 'per_order'`
- `UploadedDocumentMetadata` — the upload endpoint response shape (also persisted via auto-save)
- `CrossSectionTarget` — `'subject'` (only supported value in Stage 4)
- `CrossSectionRequirementEntry` — a single registry entry
- `CrossSectionRegistry` — `Partial<Record<CrossSectionTarget, CrossSectionRequirementEntry[]>>`
- `WorkflowSectionAcknowledgment` — the saved-data bucket shape for workflow sections

### `src/types/candidate-portal.ts`

Stage 4 changes:
- `CandidatePortalSection.status` narrowed from `'not_started' | 'in_progress' | 'complete'` to `'not_started' | 'incomplete' | 'complete'` (Business Rule 22; `in_progress` is replaced by `incomplete`).
- `CandidatePortalSection.type` union extended to also include `'personal_info'` and `'address_history'` (these were handled by the structure endpoint but were not reflected in the type).
- `CandidatePortalSection.workflowSection?: WorkflowSectionPayload` added — populated by the structure endpoint when `type === 'workflow_section'`.

**TD-059 addition (May 2026):** `PersonalInfoField` interface exported from this file. Previously defined as a local interface inside `PersonalInfoSection.tsx`; moved here so `portal-layout.tsx` can reference the same type for its `personalInfoFields` state.

## API Endpoint Changes

Full request/response details are in `docs/api/candidate-application.md`.

### New: POST /api/candidate/application/[token]/upload

Accepts a `multipart/form-data` body with a binary `file` field (max 10 MB; PDF, JPEG, PNG), a `requirementId` UUID, and an optional `entryIndex`. Stores the file under `uploads/draft-documents/{orderId}/{timestamp}-{originalName}`. Returns upload metadata (201) without writing a database row — the metadata is persisted on the next auto-save via the standard `/save` endpoint.

### New: DELETE /api/candidate/application/[token]/upload/[documentId]

Removes a previously uploaded file from disk after verifying that the `documentId` appears in the candidate's saved `formData` and that the resolved `storagePath` is within the candidate's own `uploads/draft-documents/{orderId}/` directory. Returns `{ "deleted": true }` on success. Returns `404` for both "not found" and "wrong order" cases to avoid leaking document existence across orders.

### Extended: GET /api/candidate/application/[token]/structure

`workflow_section` entries now include a `workflowSection` object carrying the full content payload (id, name, type, content, fileUrl, fileName, placement, displayOrder, isRequired). This removes the need for a second fetch when rendering workflow sections.

The `status` field now uses `'incomplete'` rather than `'in_progress'` (alignment with Business Rule 22). The endpoint always returns `'not_started'` as the initial value; clients are responsible for recomputing progress locally.

### Extended: POST /api/candidate/application/[token]/save

The per-field `value` union for flat-field saves is extended to accept JSON objects (`z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))`). This allows workflow-section acknowledgments (`{ "acknowledged": boolean }`) and document-upload metadata to flow through the flat-save path. Repeatable-entry saves already accepted objects from Stage 3.

### Extended: GET /api/candidate/application/[token]/saved-data

Workflow sections now return a dedicated bucket shape: `{ "type": "workflow_section", "acknowledged": boolean }` keyed by `workflow_sections.id`. The raw stored shape (a flat-fields array with the acknowledgment inside the first field's value object) is converted to this clean bucket on read.

## Translation Keys Added

All keys are in `src/translations/en-US.json`:

| Key | Value |
|-----|-------|
| `candidate.aggregatedRequirements.documentUploadPending` | Upload will be available soon |
| `candidate.workflowSection.acknowledgmentLabel` | I have read and agree to the above |
| `candidate.workflowSection.openDocument` | Open document |
| `candidate.workflowSection.documentUnavailable` | Document not available. |
| `candidate.documentUpload.required` | Required |
| `candidate.documentUpload.optional` | Optional |
| `candidate.documentUpload.upload` | Upload |
| `candidate.documentUpload.uploading` | Uploading… |
| `candidate.documentUpload.remove` | Remove |
| `candidate.documentUpload.replace` | Replace |
| `candidate.documentUpload.errorTooLarge` | File too large. Maximum size is 10 MB. |
| `candidate.documentUpload.errorWrongType` | File type not allowed. Accepted types: PDF, JPEG, PNG. |
| `candidate.documentUpload.errorUploadFailed` | Upload failed. Please try again. |
| `candidate.documentUpload.errorRemoveFailed` | Couldn't remove the file. Please try again. |
| `candidate.documentUpload.tryAgain` | Try again |
| `candidate.sectionProgress.notStarted` | Not started |
| `candidate.sectionProgress.incomplete` | Incomplete |
| `candidate.sectionProgress.complete` | Complete |
| `candidate.crossSection.bannerLead` | Based on information you entered in another section, the following fields are now required: |

## Tech Debt Addressed

- **TD-009** — Upload error messages not shown to candidates. Resolved: `CandidateDocumentUpload` renders a visible `role="alert"` region on validation and server-side upload failures, with a "Try again" affordance.
- **TD-011** — No upload progress indicator. Resolved: `CandidateDocumentUpload` shows an animated spinner in the `uploading` state.
- **TD-052** — Personal Information section unaware of cross-section DSX requirements. Resolved: the cross-section registry and `useRepeatableSectionStage4Wiring` hook allow repeatable sections to publish subject-targeted requirements to the shell; `PersonalInfoSection` consumes these via `crossSectionRequirements` prop and renders `CrossSectionRequirementBanner`.

## Known Limitations (Deferred)

- **TD-059** — Sidebar progress for Personal Information does not update reactively while the section is unmounted (i.e., while another tab is active and a cross-section trigger fires). The sidebar updates correctly once the candidate navigates to Personal Information. Fix requires lifting the personal-info fields/values fetch into the shell.
- **TD-060** — The `personal-info-fields` API computes `isRequired` as a naive OR over all DSX mappings without filtering by the candidate's current context (country, saved Address History). This causes the per-field asterisk to remain visible even after the cross-section trigger is cleared. The cross-section banner and progress calculation are correct; only the field-level asterisk is affected.

## Testing

- Unit tests for `crossSectionRegistry`, `sectionProgress`, `sanitizeWorkflowContent`, `addressHistoryStage4Wiring`, and `useRepeatableSectionStage4Wiring` are in `src/lib/candidate/__tests__/`.
- Component tests for `CandidateDocumentUpload`, `CrossSectionRequirementBanner`, `SectionProgressIndicator`, and `WorkflowSectionRenderer` are co-located with their source files.
- Integration tests for the two new API routes are in `src/app/api/candidate/application/[token]/upload/__tests__/` and `src/app/api/candidate/application/[token]/upload/[documentId]/__tests__/`.
- Extended tests for the structure and saved-data routes are in their existing `__tests__/` directories.
- End-to-end tests covering the three primary user flows (workflow section acknowledgment, document upload/remove, and cross-section requirement propagation) are in `tests/e2e/phase6-stage4-workflow-uploads-progress.spec.ts`.
