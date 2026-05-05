# Technical Plan: Phase 6 Stage 4 — Workflow Sections, Document Uploads & Section Progress
**Based on specification:** `docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md` (Status: Confirmed, dated 2026-05-04)
**Date:** 2026-05-04
**Phase:** 6 — Dynamic Application Engine
**Stage:** 4 of 4 (final stage)
**Prerequisites:** Phase 6 Stages 1, 2, and 3 complete and deployed

---

## Plan Scope Reminder

The implementer's Absolute Rule 6 forbids creating, modifying, or touching any file not listed in this plan. Anything missing here cannot be added later without stopping the pipeline. Every file path below is absolute, and the "New Files" / "Existing Files to Modify" lists are exhaustive.

---

## Database Changes

**No schema changes are required for Stage 4.** Every table and column the spec requires already exists:

- `workflow_sections` — already has `name`, `displayOrder`, `isRequired`, `workflowId`, `placement`, `type`, `content`, `fileUrl`, `fileName` (verified at `/Users/andyhellman/Projects/GlobalRx_v2/prisma/schema.prisma` lines 296–315).
- `dsx_requirements.documentData` — already a `Json?` column. The spec uses `documentData.scope` (`per_entry` | `per_search` | `per_order`, defaulting to `per_search` per BR 23) for upload routing. Already returned by the fields endpoint.
- `dsx_requirements.fieldData` — already a `Json?` column. The spec uses `fieldData.collectionTab` (`subject` or `search`, per BR 17) for cross-section requirement detection. Already returned by the fields endpoint.
- `candidate_invitations.formData` — the existing JSON store for candidate auto-save. Stage 4 writes:
  - workflow-section acknowledgments under `formData.sections[<workflowSectionId>] = { type: 'workflow_section', acknowledged: true }` (BR 7, BR 8).
  - document-upload metadata according to scope (BR 11): per-entry inside the entry's `fields` array, per-search/per-order inside the section's `aggregatedFields` bucket. Schema-wise both are already widened to accept JSON object values (per Stage 3 widening of `RepeatableFieldValue`).
- `candidate_invitations.orderId` — exists (line 373). The upload endpoint uses this to pick the storage subdirectory `uploads/draft-documents/{orderId}/`.

**No Prisma migration is required.** The implementer must NOT create a migration directory, must NOT edit `prisma/schema.prisma`, and must NOT run `pnpm prisma migrate deploy` or `pnpm prisma generate`.

---

## New Dependency

A single new third-party dependency is required for HTML sanitization of workflow-section `content` (BR 3, DoD #19):

- **`isomorphic-dompurify`** (latest 2.x). Chosen over plain `dompurify` because workflow content needs to be sanitized in component code that may be exercised by Vitest under `happy-dom` and that runs server-side in any future SSR rendering. `isomorphic-dompurify` provides one consistent API across Node and browser. Chosen over `sanitize-html` because DOMPurify is the better-vetted XSS sanitizer (Mozilla, OWASP cheat sheet recommend it) and its allow-list configuration is simpler.
  - Add to `dependencies` (not `devDependencies`).
  - Allow-list: tags `b`, `strong`, `i`, `em`, `u`, `p`, `br`, `ul`, `ol`, `li`, `a`, `h1`, `h2`, `h3`, `h4`, `span`, `div`. Allow `href` and `target` and `rel` on `a`. Strip every `on*` event handler. Strip `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`.
  - Implementation lives in a new utility file (see New Files).

The implementer adds this entry by editing `package.json` (listed below as a modified file). After adding the entry, the implementer runs `pnpm install` to populate `pnpm-lock.yaml`. **Both `package.json` and `pnpm-lock.yaml` are listed in "Existing Files to Modify."**

---

## New Files to Create

### API routes

1. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/upload/route.ts`**
   - Purpose: POST handler for candidate document uploads. Accepts multipart/form-data with `file`, `requirementId`, optional `entryIndex`. Validates token, file size (max 10 MB), MIME type (`application/pdf`, `image/jpeg`, `image/png`). Writes file to `uploads/draft-documents/{orderId}/{timestamp}-{originalName}` and returns metadata.
   - Standard JSDoc per `API_STANDARDS.md` Section 11. Validation order 401 → 403 → 400 → 404 → 410 → 200/201. Uses dynamic import of `CandidateSessionService` (mirrors every other candidate endpoint in this folder).
   - File reads/writes via `import fs from 'fs'` and `import path from 'path'` per `TESTING_STANDARDS.md` Section 7.2 (default-import pattern so Vitest mocks intercept calls).
   - Returns `201` with `{ documentId, originalName, storagePath, mimeType, size, uploadedAt }`. **No database row is created at upload time** (per BR 10 and the spec's API description). Metadata persistence happens via the existing `/save` endpoint when the candidate's auto-save fires.

2. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/upload/[documentId]/route.ts`**
   - Purpose: DELETE handler for removing a previously uploaded document. Validates token, verifies ownership (the file path must live under `uploads/draft-documents/{orderId}/` for the order tied to this candidate's invitation — BR 12), removes the file from disk, returns `{ deleted: true }`.
   - Standard JSDoc. Validation order 401 → 403 → 400 → 404 → 410 → 200. Uses `validateFilePath` from the existing `document-download.service.ts` for path-traversal protection. Uses default-import `fs` for `unlink`.
   - Path parameter validation: `documentId` arrives in the URL and is matched against the `documentId` field in any `formData.sections` entry to confirm ownership before deletion. The DELETE endpoint reads the candidate's saved `formData`, walks every section's entries and aggregated buckets, and only proceeds to disk deletion when a metadata record with the matching `documentId` is found inside that invitation's `formData`.

### Components

3. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/WorkflowSectionRenderer.tsx`**
   - Purpose: Render a single workflow section for the candidate. For `type === 'text'`, renders sanitized HTML in a scrollable container. For `type === 'document'` with `fileUrl`, renders an `<a download>` link labelled with `fileName` (fallback `name`). Edge case: `type === 'document'` with no `fileUrl` shows a single placeholder line ("Document not available"); the acknowledgment checkbox still works.
   - Always renders an acknowledgment checkbox below the content with the hardcoded translated label `t('candidate.workflowSection.acknowledgmentLabel')` (BR 5). Calls `onAcknowledge(checked)` on toggle.
   - Client component (`'use client'`).
   - Imports the new `sanitizeWorkflowContent` utility (file #6 below) for HTML sanitization on render (defense-in-depth — per spec's "server-side sanitization is a bonus" note in DoD #19, sanitization happens client-side in the renderer at minimum).
   - Tailwind-only styling. No inline `style={{}}`.

4. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/CandidateDocumentUpload.tsx`**
   - Purpose: Reusable document upload component. Replaces the Stage 3 informational document line items in `AggregatedRequirements`. Accepts a single requirement object plus an optional already-uploaded metadata object. Shows empty / uploading / uploaded / error states.
   - Uses `<input type="file" accept=".pdf,.jpg,.jpeg,.png" capture="environment">` so iOS/Android offer the camera option natively (DoD #18, BR 21).
   - Validates client-side (max 10 MB, MIME in PDF/JPEG/PNG) before calling POST `/api/candidate/application/[token]/upload`. Uses `FormData` per `COMPONENT_STANDARDS.md` Section 4.2 — never sets `Content-Type` manually.
   - On success calls `onUploadComplete(metadata)`; the parent (the section component) is responsible for routing the metadata to the correct location in form state (per_entry vs per_search vs per_order — see "Document scope routing" below) and triggering the auto-save.
   - On the user clicking "Remove", calls DELETE `/api/candidate/application/[token]/upload/[documentId]` and on success calls `onRemove()`. Failure surfaces a user-visible error message — no silent error (TD-009 explicitly fixed).
   - Error state surfaces both client-side validation errors and server-side error responses (TD-009).
   - Internal status state values are lowercase `'empty' | 'uploading' | 'uploaded' | 'error'` (BR 22).
   - Tailwind-only styling. Translation keys for every visible string.

5. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/SectionProgressIndicator.tsx`**
   - Purpose: Render a small dot/icon next to each section name indicating one of three lowercase statuses (BR 14, BR 22):
     - `not_started` → grey empty circle
     - `incomplete` → red circle with "!" or X
     - `complete` → green circle with check
   - Accessible label: visually-hidden `<span>` with `t('candidate.sectionProgress.<status>')` reading e.g. "Personal Information — incomplete" (combines `label` prop with the status string).
   - Stateless presentational client component. No API calls.
   - Tailwind-only styling.

6. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/CrossSectionRequirementBanner.tsx`**
   - Purpose: Informational banner shown at the top of a target section when one or more cross-section registry entries point to it. Lists the externally-triggered required field names (e.g., "Based on addresses you entered, the following fields are now required: Middle Name").
   - **Render location (resolved decision): rendered inside `PersonalInfoSection.tsx`.** The shell (`portal-layout.tsx`) passes the relevant registry entries down via the `crossSectionRequirements` prop; the section component is responsible for placing the banner at the top of its own layout. Reasoning: the cross-section banner is part of the target section's UI, so it co-locates with the section component; the shell only needs to pass the registry entries down. This keeps the shell agnostic of section-specific layout idioms (heading placement, padding, etc.) and matches how the section already owns its own heading and field layout. See "Cross-section banner render location" below for the full rationale.
   - Hidden when the requirements array is empty.
   - Info-color styling (blue/info per spec — not error/red).
   - Stateless presentational client component. No API calls.
   - Tailwind-only styling. Translation keys for the lead text.

### Utility / shared modules

7. **`/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/sanitizeWorkflowContent.ts`**
   - Purpose: Single-source helper for sanitizing `workflow_sections.content` HTML. Wraps `isomorphic-dompurify` with a fixed allow-list (tags + attributes listed in "New Dependency" above) and a single exported function `sanitizeWorkflowContent(html: string): string`.
   - Imports DOMPurify via `import DOMPurify from 'isomorphic-dompurify'` (default import — works in both happy-dom test envs and runtime).
   - All `on*` attributes are stripped via DOMPurify's default `FORBID_ATTR` plus an explicit `ADD_ATTR` allow list mirroring the spec.

8. **`/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/sectionProgress.ts`**
   - Purpose: Pure function library for computing per-section progress (`not_started` | `incomplete` | `complete`). Pulled into a separate file so it is fully unit-testable without rendering React (per spec Implementation Notes #3).
   - Exported functions:
     - `computeWorkflowSectionStatus(workflowSection, savedAcknowledgment): SectionStatus` — implements BR 6.
     - `computePersonalInfoStatus(fields, values, crossSectionRequirements): SectionStatus` — checks local required fields plus any cross-section registry entries posted under `subject` (BR 18).
     - `computeIdvStatus(fields, values): SectionStatus` — checks all DSX fields for the selected country.
     - `computeRepeatableSectionStatus(entries, fieldsByEntry, aggregatedFields, aggregatedItems, uploadedDocumentsByScope): SectionStatus` — checks required fields/documents within the entries the candidate has created (BR 16). **Does NOT perform scope coverage checks or gap detection** (BR 16, DoD #12). Used by Address History, Education, Employment.
     - `computeAllSectionStatuses(...)` — top-level helper that orchestrates the above per section. The implementer may optionally split into per-section helpers if the resulting file is small enough; in either case the helpers must be exported individually so they can be unit tested.
   - Exports `SectionStatus` type alias (the lowercase-string union). Uses values from a new constant file (see Translation Keys / Constants section below).
   - **Does NOT perform any I/O.** Inputs are typed plain data structures; outputs are typed status strings. Implementer must keep this file pure — no fetches, no DOM access, no `Date.now()`-driven branching.

9. **`/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/crossSectionRegistry.ts`**
   - Purpose: Pure helper functions that operate on the cross-section registry shape. Used by both the section components (when they push requirements into the registry on DSX field load) and the shell (when it computes which banner to render and which section progress check to consult).
   - Exported functions:
     - `addCrossSectionRequirements(registry, target, requirements): CrossSectionRegistry` — adds new entries. If a `(fieldId, triggeredBy, triggeredByEntryIndex)` triplet already exists it is replaced rather than duplicated.
     - `removeCrossSectionRequirementsForEntry(registry, triggeredBy, entryIndex): CrossSectionRegistry` — implements BR 19 (clears entries for a deleted/changed entry).
     - `removeCrossSectionRequirementsForSource(registry, triggeredBy): CrossSectionRegistry` — convenience for clearing every entry contributed by a section (e.g., when a section is unmounted or all entries are deleted).
     - `getCrossSectionRequirements(registry, target): CrossSectionRequirementEntry[]` — accessor for components that need to render banners or evaluate progress.
   - The functions return new objects rather than mutating the input, matching the rest of the codebase's React-state idioms.
   - **Does NOT perform any I/O or state-management of its own.** State storage is the shell's responsibility — see "Cross-section registry: storage decision" below.

### Types

10. **`/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-stage4.ts`**
    - Purpose: TypeScript types specific to Stage 4. Single new file rather than scattered additions, to keep the surface area legible.
    - Contains:
      - `SectionStatus` — `'not_started' | 'incomplete' | 'complete'` (lowercase, per BR 22). **Source of truth for this stage.**
      - `WorkflowSectionPayload` — the structure-endpoint payload shape per the spec's Data Requirements ("Structure endpoint additions — workflow section payload"): `{ id; name; type: 'text' | 'document'; content?: string | null; fileUrl?: string | null; fileName?: string | null; placement: 'before_services' | 'after_services'; displayOrder: number; isRequired: boolean }`.
      - `DocumentScope` — `'per_entry' | 'per_search' | 'per_order'`. (BR 11; the `null`/missing case from BR 23 is handled at read sites, not represented in the type.)
      - `UploadedDocumentMetadata` — `{ documentId; originalName; storagePath; mimeType; size; uploadedAt }`. Matches both the upload endpoint response and the saved metadata record (see spec Data Requirements).
      - `CrossSectionTarget` — `'subject'` (single literal — Stage 4 supports only this target per BR 17). Implementer may widen this later when more targets are added.
      - `CrossSectionRequirementEntry` — `{ fieldId; fieldKey; fieldName; isRequired; triggeredBy; triggeredByContext?; triggeredByEntryIndex? }` per the spec's Data Requirements table.
      - `CrossSectionRegistry` — `Partial<Record<CrossSectionTarget, CrossSectionRequirementEntry[]>>`. Stored in shell-level React state (decision documented below).
      - `WorkflowSectionAcknowledgment` — saved-data record shape: `{ type: 'workflow_section'; acknowledged: boolean }`. Keyed by `workflow_sections.id` per BR 7.
      - `UploadResponseMetadata` — derived via `z.infer<typeof uploadResponseSchema>` (see Zod section). The implementer may co-locate this type with the schema in the route file rather than in this types file; either is acceptable as long as it is exported.

### Tests (Pass 1 contract + Pass 2 mock-backed; written in two passes per `TESTING_STANDARDS.md` Section 3)

11. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/upload/__tests__/route.test.ts`**
    - Pass 1 (contract): 401 (no session), 403 (token mismatch), 400 (missing file, file too large, wrong MIME), 404 (invitation not found), 410 (expired/completed), 201 happy path returns the documented response shape.
    - Pass 2 (mock-backed): file is written to `uploads/draft-documents/{orderId}/...`, returned `storagePath` matches, returned `documentId` is a UUID, server-side validation rejects MIME types not in the allow-list.

12. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/upload/[documentId]/__tests__/route.test.ts`**
    - Pass 1: 401 / 403 / 400 (no documentId) / 404 (no metadata in formData for that documentId) / 410 / 200 (`{ deleted: true }`).
    - Pass 2: cross-order deletion is refused (BR 12 — file path is rejected when it doesn't live under the candidate's `{orderId}/` directory). Existing file is removed via `fs.unlink` (mocked).

13. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/__tests__/WorkflowSectionRenderer.test.tsx`**
    - Pass 2 (component tests with happy-dom; needs the actual implementation present to verify exports and import paths).
    - Cases: text type renders sanitized HTML, document type renders the download link with `fileName` then `name` fallback, acknowledgment checkbox calls `onAcknowledge` when toggled, document type with no `fileUrl` shows the placeholder line and acknowledgment still works, sanitization strips `<script>` and `on*` attributes (regression coverage for BR 3 / DoD #19).

14. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/__tests__/CandidateDocumentUpload.test.tsx`**
    - Pass 2.
    - Cases: empty state renders, oversized file rejected client-side with error state, wrong MIME rejected client-side with error state, valid upload calls POST and on success calls `onUploadComplete` with the returned metadata, "Remove" calls DELETE and on success calls `onRemove`, server error sets the error state and surfaces an error message (TD-009 regression), uploading state shows a spinner (TD-011 regression). Mobile capture: `<input type="file" capture="environment">` is present (DoD #18 regression coverage; the test asserts the attribute appears in the rendered DOM).

15. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/__tests__/SectionProgressIndicator.test.tsx`**
    - Pass 2.
    - Cases: each lowercase status renders its expected indicator, the accessible label includes both `label` and the status string, status with an unrecognized value falls back to `not_started` (defensive — never crashes).

16. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/__tests__/CrossSectionRequirementBanner.test.tsx`**
    - Pass 2.
    - Cases: empty array → renders nothing; single entry → renders one field name; multiple entries with duplicate `fieldKey` → renders each field name only once (the parent shell may already deduplicate, but the banner is also defensive).

17. **`/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/__tests__/sectionProgress.test.ts`**
    - Pass 1 (pure functions — no implementation dependencies for the contract tests).
    - Cases: workflow section with `isRequired = true` and acknowledged → `complete`; workflow section with `isRequired = true` and not acknowledged → `not_started` if no other data, `incomplete` only when started — but for workflow sections the spec only has not_started/complete (BR 6: "always considered complete" if `isRequired = false`; the candidate either acknowledges or hasn't, so the `incomplete` middle state does not apply to workflow sections — the helper returns `not_started` until acknowledged); personal-info `complete` when all local required + all cross-section subject required have values; personal-info `incomplete` when one cross-section requirement is missing; repeatable-section `not_started` when no entries; `incomplete` when an entry exists with missing required field; `complete` when all entries' required fields and required documents are satisfied; document scope detection treats `null`/missing `documentData.scope` as `per_search` (BR 23).

18. **`/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/__tests__/crossSectionRegistry.test.ts`**
    - Pass 1 (pure functions).
    - Cases: `add` creates a new target bucket if missing; `add` appends to an existing bucket; `add` deduplicates by `(fieldId, triggeredBy, triggeredByEntryIndex)`; `removeForEntry` clears matching entries and leaves others; `removeForSource` clears every entry contributed by a section; `get` returns an empty array for a target with no entries.

19. **`/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/__tests__/sanitizeWorkflowContent.test.ts`**
    - Pass 1 (pure function — only depends on the third-party `isomorphic-dompurify` library).
    - Cases: `<script>` is stripped; inline `onclick` handler is stripped; `<b>` / `<a href>` are preserved; `<a target>` and `rel` are preserved; an `<iframe>` is stripped.

20. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts`** *(new test file — Pass 2)*
    - **Resolved decision (Andy, 2026-05-04):** create this new test file. The new workflow-content fields and per-section `status` field warrant contract-level coverage; a dedicated structure-route test file did not exist before Stage 4 because the prior stages added narrower changes that didn't justify it.
    - **Pass assignment: Pass 2 (test-writer-2).** This file tests an actual route handler, so it goes in the implementation-aware pass alongside the upload route tests rather than in Pass 1's pure-function batch.
    - Cases: response includes `workflow_section` items in the correct `before_services` / `after_services` zones with `name`, `type`, `content`, `fileUrl`, `fileName`, `placement`, `displayOrder`, `isRequired` populated from the workflow_sections row; every section in the response has a lowercase `status` field; the section-list ordering reflects `displayOrder` per zone; document-type workflow sections with `null` `fileUrl` still emit the section (renderer handles the placeholder).

---

## Existing Files to Modify

Each file below was read in full or in the relevant section before listing. The "Confirmed" line names the read.

### 1. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/route.ts`
- **Currently:** Returns `sections[]` where each element has `id`, `title`, `type`, `placement`, `status`, `order`, `functionalityType`, optional `serviceIds`. Workflow sections are emitted with only `id` (the `workflow_sections.id`), `title` (the `name`), and minimal metadata. The `status` is hardcoded to `'not_started'` for every section.
- **Change:**
  1. For every workflow section emitted (in both `before_services` and `after_services` zones), add the full payload fields the spec requires: `name` (already covered by `title`, but add a separate `name` so consumers don't have to look up the workflow section by id), `type`, `content`, `fileUrl`, `fileName`, `placement`, `displayOrder`, `isRequired`. Pull these straight from the loaded `workflow_sections` row (already in the `include`). Keep the existing `id`, `title`, `placement`, `status`, `order`, `functionalityType` fields for backward compatibility with the sidebar.
  2. **Status calculation in this endpoint stays as `'not_started'` initial value.** Per BR 15 ("recalculation runs client-side from the form state — no extra API call") and DoD #11, real progress is computed in the client and then displayed via `SectionProgressIndicator`. The endpoint's `status` field becomes a simple initial value — the shell overrides it locally on each auto-save. Update the JSDoc to call this out.
  3. Update the `CandidatePortalSection` `status` type union (in `candidate-portal.ts`) to use `not_started` / `incomplete` / `complete` (replaces `in_progress` with `incomplete`). Per BR 22 Title Case and ALL CAPS are forbidden. The structure endpoint's hardcoded `'not_started'` value is already lowercase and correct.
  4. Add a JSDoc note that the `status` value returned here is the *initial* state; downstream UI overrides it on auto-save.
- **Why:** DoD #17 — the structure endpoint must return workflow content fields and a `status` value for each section. The status type change is required by BR 22 (`incomplete` replaces the existing `in_progress`).
- **Confirmed:** read full file (lines 1–253).

### 2. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/route.ts`
- **Currently:** Three Zod schemas — flat (`personal_info | idv | workflow_section | service_section`), repeatable (`education | employment`), and address-history (`address_history`). The flat schema's `value` union is `string | number | boolean | null | string[]`. Workflow sections are accepted but the saved shape is an array of fields — there is no acknowledgment-specific structure today.
- **Change:**
  1. **Widen the flat schema's `value` union** to also accept the JSON-object form already accepted by the repeatable and address-history schemas: `z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))`. This lets workflow sections store `{ acknowledged: true }` and document-upload metadata objects without rejecting the body.
  2. **Acknowledgment storage shape (BR 7, BR 8):** when a candidate ticks the acknowledgment checkbox, the client sends a flat-fields save with `sectionType = 'workflow_section'`, `sectionId = <workflow_sections.id>`, and `fields = [{ requirementId: <workflow_sections.id>, value: { acknowledged: true } }]`. (The `requirementId` field carries the workflow section's UUID because flat saves index by `requirementId`. BR 7 calls for the acknowledgment to be keyed by `workflow_sections.id`, which is exactly what `requirementId` becomes here.) The saved formData ends up shaped as `formData.sections[<workflowSectionId>] = { type: 'workflow_section', fields: [{ requirementId: <workflowSectionId>, value: { acknowledged: true }, savedAt: ... }] }`. The saved-data endpoint (modification #4) flattens that back to the spec's documented "per-section bucket" shape on read.
  3. Update the JSDoc to explain the new value shape and reference BR 7/8.
- **Why:** Without the JSON-object widening on the flat schema, the existing flat-save path rejects the acknowledgment payload. The repeatable/address-history paths already accept JSON objects (Stage 3 work), but workflow sections go through the flat-save path.
- **Confirmed:** read full file (lines 1–567).

### 3. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/saved-data/route.ts`
- **Currently:** Returns `sections` keyed by section type. Workflow sections are returned in the flat-fields shape (matching the save shape).
- **Change:**
  1. When a section's `type === 'workflow_section'`, format its response as `{ type: 'workflow_section', acknowledged: <boolean> }` instead of the flat-field array. Resolve `acknowledged` by reading the first field's value: if the value is an object with `acknowledged === true`, that's the acknowledgment. Otherwise default to `false`. **The wire format the spec calls for in DoD #3 ("`formData.sections[<workflowSectionId>] = { type: 'workflow_section', acknowledged: true }`") is what the *client-side form state* looks like — this endpoint produces that shape on read so the shell can hydrate cleanly.**
  2. New TypeScript-internal `FormattedWorkflowSection` shape alongside the existing `FormattedFlatSection`, `FormattedRepeatableSection`, `FormattedAddressHistorySection`.
  3. Document-upload metadata: when document-scope routing puts metadata in a section's `aggregatedFields` (per_search/per_order) or in an entry's `fields` (per_entry), the saved-data endpoint passes it through unchanged. The shapes already accept JSON objects via Stage 3 widening — no further change to repeatable/address-history sections. **No new format is introduced.**
  4. Update the JSDoc.
- **Why:** DoD #3 — workflow-section acknowledgment must be readable by the client in a clean per-section bucket shape.
- **Confirmed:** read full file (lines 1–292).

### 4. `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts`
- **Currently:** `CandidatePortalSection.status` union is `'not_started' | 'in_progress' | 'complete'` (line 20). The `type` union includes the Stage 3 `'address_history'`. The `FormSectionData` type and `FieldValue` type already accept JSON objects via Stage 3 widening.
- **Change:**
  1. Replace `'in_progress'` with `'incomplete'` in the `CandidatePortalSection.status` union (BR 22). This is a narrowing change — `'in_progress'` is removed from the type, and every consumer must use `'incomplete'` instead.
  2. Add the workflow-section payload fields to a new optional shape on `CandidatePortalSection`: an optional `workflowSection?: WorkflowSectionPayload` property carrying the full content payload. The structure endpoint populates this when `type === 'workflow_section'`. Keeps the section list extensible.
  3. (No change to `FormSectionData` is needed — `acknowledged` is read off the first field's value at the saved-data endpoint, not stored as a top-level property of the section bucket.)
- **Why:** Stage 4 introduces the `incomplete` status and the workflow-section content payload.
- **Confirmed:** read full file (lines 1–101).

### 5. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-sidebar.tsx`
- **Currently:** Uses `'in_progress'` in `getStatusIcon` and `getStatusLabel` (lines 36, 53). Renders the section list with a hand-built status icon. Does NOT consume `SectionProgressIndicator`.
- **Change:**
  1. Replace the inline status-icon JSX with the new `SectionProgressIndicator` component. Pass `status={section.status}` and `label={t(section.title)}`.
  2. Remove the inline `getStatusIcon` and `getStatusLabel` helpers since they are now centralised in the indicator component.
  3. Update any case label from `'in_progress'` to `'incomplete'` to match the new union.
- **Why:** DoD #10/#11 — the sidebar shows the indicator for every section. Centralising the icon in `SectionProgressIndicator` keeps the visual rules in one place per `COMPONENT_STANDARDS.md` Section 1.
- **Confirmed:** read full file (lines 1–141).

### 6. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx`
- **Currently:** The shell. Manages `activeSection` state. Dispatches based on `section.type`. Has no awareness of progress or cross-section requirements.
- **Change:**
  1. **Lift section progress and the cross-section registry into shell-level React state.** State shape:
     - `sectionStatuses: Record<string, SectionStatus>` — keyed by section id.
     - `crossSectionRegistry: CrossSectionRegistry` (from `candidate-stage4.ts`).
  2. Use a `useReducer` (or two `useState` hooks) for these — they are updated in concert when an auto-save fires. (See "Cross-section registry: storage decision" below for the rationale on lifted state vs. context.)
  3. Provide three callbacks down to children that need to write to the registry:
     - `onCrossSectionRequirementsChanged(target, triggeredBy, entries)` — replaces the entries posted by `triggeredBy` for that `target`. Used when a section finishes loading DSX requirements for a given country.
     - `onCrossSectionRequirementsRemovedForEntry(triggeredBy, entryIndex)` — clears entries posted by a deleted repeatable entry (BR 19).
     - `onCrossSectionRequirementsRemovedForSource(triggeredBy)` — clears every entry posted by a section (used when a country selection is cleared back to "no country").
  4. Provide a single callback for progress updates: `onSectionProgressUpdate(sectionId, status)`. Each section component calls this from inside its auto-save success handler, after computing its own progress with the helpers from `sectionProgress.ts`.
  5. **Pass cross-section registry entries down to `PersonalInfoSection`** as the `crossSectionRequirements` prop, computed via `getCrossSectionRequirements(crossSectionRegistry, 'subject')`. The banner itself renders inside `PersonalInfoSection.tsx` (resolved decision — see "Cross-section banner render location" above). The shell does NOT render the banner directly. (BR 17 limits Stage 4 to the `subject` target, so only Personal Info receives this prop in Stage 4.)
  6. Render `SectionProgressIndicator` inside each sidebar item — already covered by the sidebar modification above.
  7. Add new dispatch branches:
     - `section.type === 'workflow_section'` → render `<WorkflowSectionRenderer section={section.workflowSection!} acknowledged={...} onAcknowledge={...} />`. (Currently the layout falls through to `SectionPlaceholder` for workflow sections.)
  8. Wire the existing `personal_info` branch to receive the `crossSectionRequirements` prop so the section can render the banner and include cross-section fields in its progress check.
  9. Fetch the saved-data initial state once on mount so `acknowledged` and `sectionStatuses` can be hydrated for workflow sections. Currently each child fetches its own saved data; the shell now also makes one fetch, OR each child reports its own initial computed status back via `onSectionProgressUpdate`. **Decision: child-report path** (no new shell-side fetch) — keeps the existing per-section auto-save model, avoids a duplicate /saved-data round trip, and satisfies the spec's "calculation runs client-side from the form state" rule (BR 15).
- **Why:** The shell is the natural owner of cross-section progress + registry because the data spans sections. DoD items #11, #13, #14, #15, #16, plus the "Modified Components → CandidateApplicationShell" entry in the spec.
- **Confirmed:** read full file (lines 1–159).

### 7. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx`
- **Currently:** Loads its own fields and saved data. Does not know about cross-section requirements. Does not push progress updates.
- **Change:**
  1. Accept two new props: `crossSectionRequirements?: CrossSectionRequirementEntry[]` (the entries posted under `subject`) and `onProgressUpdate?: (status: SectionStatus) => void`.
  2. Render `<CrossSectionRequirementBanner requirements={crossSectionRequirements ?? []} />` at the top of the section.
  3. After every successful auto-save (and on initial load once fields are known), call `computePersonalInfoStatus(...)` from `sectionProgress.ts` and forward the result via `onProgressUpdate`.
  4. The progress check must include cross-section requirements as additional required fields. The helper `computePersonalInfoStatus` does this — Personal Info just passes its values + the cross-section list to the helper.
  5. **No change to existing field rendering.** Personal Information still renders its DSX fields the same way.
- **Why:** DoD #14 — the Personal Info progress must evaluate both local fields and registry entries posted under `subject`. Spec User Flow 3 walks the exact case.
- **Confirmed:** read partial file (lines 1–80). Implementer must `Read` the full file before modifying per `CODING_STANDARDS.md` Section 1.2.

### 8. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/IdvSection.tsx`
- **Currently:** Loads fields per selected country. Does not push progress.
- **Change:**
  1. Accept new prop `onProgressUpdate?: (status: SectionStatus) => void`.
  2. After every successful auto-save (and on initial load), call `computeIdvStatus(...)` and forward the result.
  3. **No new cross-section-source behavior** — IDV does not currently produce subject-targeted DSX requirements (those originate from record/education/employment per BR 17 examples). If a future configuration ever does, the existing IDX section's collectionTab filter — already present — would surface them in the Personal Info tab via the registry; the implementer may choose to add a cross-section push from IDV defensively, but it is not required by Stage 4. Document that decision in code comment.
  4. **No new cross-section banner.** IDV is not a target tab in Stage 4 (only `subject` is — BR 17).
- **Why:** DoD #11 — every section reports its own progress to the shell.
- **Confirmed:** read partial file (lines 1–369 from Stage 3 plan citation). Implementer must `Read` the full file before modifying.

### 9. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/EducationSection.tsx`
- **Currently:** Loads per-entry fields. Does not push progress. Does not push to the cross-section registry.
- **Change:**
  1. Accept new props: `onProgressUpdate?: (status: SectionStatus) => void` and the three cross-section registry callbacks (`onCrossSectionRequirementsChanged`, `onCrossSectionRequirementsRemovedForEntry`, `onCrossSectionRequirementsRemovedForSource`) typed against `candidate-stage4.ts`.
  2. **Push subject-targeted requirements into the registry.** When DSX fields are loaded for an entry's country, inspect each field's `fieldData.collectionTab`. Fields where `collectionTab === 'subject'` are pushed into the registry under the `subject` target with `triggeredBy = 'education_history'` and `triggeredByEntryIndex = entry.entryOrder`. Every other field is rendered locally as today (`collectionTab === 'search'` or empty).
  3. **Clear registry entries on entry removal** (BR 19): when the candidate removes an entry, call `onCrossSectionRequirementsRemovedForEntry('education_history', entry.entryOrder)`.
  4. **Clear registry entries on country change**: when a country selection changes, before reloading fields, call `onCrossSectionRequirementsRemovedForEntry('education_history', entry.entryOrder)` so stale subject-targeted entries don't linger from the previous country.
  5. Push progress updates after every auto-save via `computeRepeatableSectionStatus(...)`.
  6. **No new cross-section banner.** Education is not a target tab in Stage 4.
  7. **Document upload integration:** the only document requirements that currently render in Education are inline within an entry. Replace the existing inline document UI (if any — verify by reading the file) with `<CandidateDocumentUpload>`. Per BR 11 these are `per_entry`-scoped: metadata is stored inside the entry's `fields` array under the document requirement's UUID. The auto-save body already accepts JSON-object values per Stage 3 widening, so no save-shape change is needed.
- **Why:** Cross-section requirements originate from record/education/employment — Education must contribute to the registry. DoD #5, #13, #16.
- **Confirmed:** read summary; implementer must `Read` the full file before modifying.

### 10. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/EmploymentSection.tsx`
- **Currently:** Same pattern as EducationSection.
- **Change:** Identical changes to Education with `triggeredBy = 'employment_history'` instead of `'education_history'`. Push registry entries on field load, clear on entry removal and country change, push progress updates, and replace inline document line items with `<CandidateDocumentUpload>` per BR 11.
- **Why:** Same as #9.
- **Confirmed:** read summary; implementer must `Read` the full file before modifying.

### 11. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressHistorySection.tsx`
- **Currently:** Loads per-entry fields, computes the aggregated requirements area, renders document line items via `AggregatedRequirements` as informational text only.
- **Change:**
  1. Accept the new shell props: `onProgressUpdate?` plus the three cross-section registry callbacks.
  2. **Push subject-targeted requirements into the registry.** When fields are loaded for an entry's country/subregion, inspect each field's `fieldData.collectionTab`. Fields where `collectionTab === 'subject'` are pushed under the `subject` target with `triggeredBy = 'address_history'` and `triggeredByEntryIndex = entry.entryOrder`. Spec User Flow 3 walks exactly this case (Middle Name on Country X).
  3. **Clear registry entries on entry removal and country change** (BR 19) — same pattern as #9/#10.
  4. Push progress updates via `computeRepeatableSectionStatus(...)`.
  5. **Aggregated requirements display now wires through to `<CandidateDocumentUpload>`.** The `AggregatedRequirements` component (modification #12) renders the upload component instead of the placeholder line. The section is responsible for routing the document metadata returned by `onUploadComplete` to the correct location in form state per BR 11:
     - `per_entry` — metadata goes into the entry's `fields` array keyed by requirement UUID. (Note: per_entry document requirements should not appear in the *aggregated* area — they belong with the entry. The implementer must verify this and route per_entry metadata into the entry rather than the aggregated bucket.)
     - `per_search` — metadata goes into `aggregatedFieldValues` keyed by `${requirementId}::${serviceId}::${jurisdictionId}` (one slot per service/jurisdiction combo, per spec Data Requirements line 225). The implementer constructs the composite key when storing.
     - `per_order` — metadata goes into `aggregatedFieldValues` keyed by `requirementId` directly (single slot).
     - **Default (BR 23):** if `documentData.scope` is `null` or missing, treat as `per_search`.
  6. The aggregated-requirements computation already filters out `personalInfoRequirementIds` (Stage 3). Stage 4 adds another filter: any requirement whose `fieldData.collectionTab === 'subject'` is also routed to the cross-section registry instead of being rendered locally. Document this OR-merge inline per `CODING_STANDARDS.md` Section 8.4.
  7. Save-shape change: the per-entry `fields` array and the `aggregatedFields` object continue to accept JSON-object values (`UploadedDocumentMetadata`). No Zod schema change is needed because Stage 3 already widened the value union.
- **Why:** Address History is the spec's primary cross-section trigger source. DoD #5, #8, #13, #15, #16.
- **Confirmed:** read partial (lines 1–500). Implementer must `Read` the full file before modifying.

### 12. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AggregatedRequirements.tsx`
- **Currently:** Renders document requirements as informational text with the line "Upload will be available soon".
- **Change:**
  1. Replace the placeholder document line items with `<CandidateDocumentUpload>` instances.
  2. New props: `uploadedDocuments: Record<string, UploadedDocumentMetadata>` (keyed by requirement UUID for `per_order`/`per_entry`, or by composite key for `per_search`), plus `onUploadComplete(requirementId, scope, metadata)` and `onRemove(requirementId, scope, documentId)` callbacks. The parent section (Address History) is responsible for the actual scope-based routing of metadata into form state — this component is purely presentational + wires the upload component.
  3. Keep the same heading + subsection layout: "Additional Information" for data fields, "Required Documents" for documents.
  4. Remove the `t('candidate.aggregatedRequirements.documentUploadPending')` string usage. Translation key can stay in the file (used elsewhere or simply unused — the implementer should leave the en-US string in place but stop referencing it from this file).
- **Why:** DoD #5 — the Stage 3 informational placeholders are replaced with working uploads.
- **Confirmed:** read full file (lines 1–149).

### 13. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-US.json`
- **Currently:** Has `candidate.portal.*`, `candidate.aggregatedRequirements.*`, `candidate.addressBlock.*`, `candidate.addressHistory.*` keys.
- **Change:** Add the new Stage 4 keys (listed in the Translation Keys section below). The existing `candidate.aggregatedRequirements.documentUploadPending` key may stay in place as legacy.
- **Why:** All user-facing text uses translation keys (`COMPONENT_STANDARDS.md` Section 6).
- **Confirmed:** lines 594–665 read.

### 14. `/Users/andyhellman/Projects/GlobalRx_v2/package.json`
- **Currently:** No HTML sanitization library listed.
- **Change:** Add `"isomorphic-dompurify": "^2.x"` to `dependencies` (the latest 2.x at install time). After saving, the implementer runs `pnpm install` to populate `pnpm-lock.yaml`.
- **Why:** Stage 4 needs HTML sanitization for workflow-section content (BR 3, DoD #19). The codebase has no existing sanitization library installed (verified via grep).
- **Confirmed:** read full file (lines 1–103).

### 15. `/Users/andyhellman/Projects/GlobalRx_v2/pnpm-lock.yaml`
- **Currently:** Locked to the current dependency tree. (File not directly read — it is large; `pnpm install` regenerates it deterministically.)
- **Change:** Regenerated by `pnpm install` after the `package.json` change. The implementer must commit the updated `pnpm-lock.yaml` so CI builds reproduce.
- **Why:** Lock file changes are a normal artifact of dependency additions; failing to commit it will produce inconsistent builds across environments.
- **Confirmed:** file existence verified by inference from the project's pnpm usage (`CLAUDE.md` declares pnpm as the package manager).

### 16. `/Users/andyhellman/Projects/GlobalRx_v2/docs/TECH_DEBT.md`
- **Currently:** TD-009 (Missing User Feedback for Document Upload Failures), TD-011 (No Upload Progress Indication for Large Files), and TD-052 (Cross-section Requirement Awareness for Personal Info) are open.
- **Change:** Mark TD-009, TD-011, and TD-052 as **Addressed** with a reference to Stage 4 (date 2026-05-04). Append a "Resolved" footer to each item. Do NOT remove the entries — the convention here is to keep historical entries with status changed to Addressed.
- **Why:** DoD #24 explicitly requires marking these items addressed.
- **Confirmed:** read TD-009 (line 235), TD-010 (line 258), TD-011 (line 282), TD-052 (line 1360).

### 17. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-sidebar.test.tsx`
- **Currently:** Stage 1/2 test fixtures use the literal string `'in_progress'` to assert the sidebar's status icon and label rendering. These fixtures predate the BR 22 status-vocabulary change.
- **Change:** Update every fixture/literal that reads `'in_progress'` to `'incomplete'` so the tests align with the new `CandidatePortalSection.status` union (`'not_started' | 'incomplete' | 'complete'`). The implementer may also update the assertions on the rendered indicator (status icon, accessible label) so they reference `'Incomplete'` rather than the prior label.
- **Implementer-permission scope (special):** the implementer is normally forbidden from editing test files (Pass 1/Pass 2 belong to the test-writer agents). The exception here is narrow and pre-approved by Andy: the production status union itself is changing, which makes the existing test fixtures' status literals obsolete. The implementer is updating production-aligned constants used inside the fixtures, not changing test logic, assertion semantics, or coverage scope. **The implementer must NOT add new test cases, remove existing test cases, change unrelated assertions, or alter the file's structure.** If the change required goes beyond a string-replace of `'in_progress'` → `'incomplete'` (and the corresponding "In progress" → "Incomplete" display label), the implementer must stop and surface it to Andy.
- **Why:** BR 22 — `'in_progress'` is removed from the status union. Fixtures must follow the production-aligned constants or the test build breaks.
- **Confirmed:** file existence verified at `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-sidebar.test.tsx`.

### 18. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.test.tsx`
- **Currently:** Stage 1/2 test fixtures use the literal string `'in_progress'` in section-status mocks for the layout's section dispatch and active-section behavior tests. Same vintage as #17.
- **Change:** Same scope as #17 — replace `'in_progress'` literals with `'incomplete'` in fixtures and any directly-related assertions on the rendered status display. No new tests, no removed tests, no logic changes.
- **Implementer-permission scope (special):** identical to #17. The implementer is updating production-aligned constants used inside the fixtures, nothing else. Anything beyond the string-replace requires stopping and surfacing.
- **Why:** Same as #17 — BR 22 narrowing of the status union.
- **Confirmed:** file existence verified at `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.test.tsx`.

---

## Cross-section registry: storage decision

**Decision: Lifted React state at the shell level (`portal-layout.tsx`), passed down via props.**

Tradeoff considered:

| Option | Pros | Cons |
|---|---|---|
| Lifted state (chosen) | Simple, no new context provider, callbacks are already passed down for auto-save anyway, easy to test (state is owned by one component) | Prop drilling — every section receives one or more registry-callback props |
| React Context | No prop drilling, sections can pull whatever they need | Requires a new provider in `client-provider.tsx`, more moving parts, harder to test in isolation, and the spec only has one cross-section target (`subject`) so the additional surface area is over-engineered for Stage 4 |

The shell already manages `activeSection`, has auto-save hooks, and is the only component that "sees" all sections. Adding two more pieces of state (`sectionStatuses` and `crossSectionRegistry`) plus four callbacks is straightforward. The spec is explicit (BR 17) that only `subject` is a target in Stage 4 — context indirection for one target is unjustified.

If a future stage needs to broaden cross-section targets (e.g., `idv`, `employment`), the implementer can lift the state into a context at that point. **For Stage 4, lifted state.**

The pure helpers in `crossSectionRegistry.ts` (file #9 in New Files) operate on registry values without owning state — they are reusable regardless of where the state ends up.

---

## Cross-section banner render location

**Resolved decision: `<CrossSectionRequirementBanner>` renders inside `PersonalInfoSection.tsx`, not in the shell.**

The shell (`portal-layout.tsx`) owns the cross-section registry state and passes the entries targeted at `subject` down to `PersonalInfoSection` via the `crossSectionRequirements` prop. `PersonalInfoSection` then renders the banner at the top of its own section layout, above its DSX field grid.

Reasoning:
- The banner is part of the *target section's* UI — the lead text references the section's required fields and reads naturally as part of the section's heading area.
- Rendering inside the section keeps the shell agnostic of section-specific layout idioms (heading placement, padding, scroll-container behavior) so future sections can opt into cross-section requirements without forcing the shell to learn each section's chrome.
- The shell already passes other section-specific props down (active section, fields, saved data); adding `crossSectionRequirements` to that flow is consistent with the existing pattern.
- The pure helpers (`getCrossSectionRequirements`) make the lookup trivial inside the shell — one line: `getCrossSectionRequirements(crossSectionRegistry, 'subject')`.

The architect has no reservation about this choice. If a future stage adds banners to multiple target sections, the same per-section render pattern continues to work; the shell's only added work is one `getCrossSectionRequirements` call per target.

---

## Document upload pattern: how the existing internal flow works

The internal portal flow already uses an "immediate-upload, metadata-only-in-state" pattern. **Stage 4 reuses the same pattern with candidate-token authentication.** Implementer reference (read these files for context, do NOT modify them):

- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/portal/uploads/route.ts` — the internal upload endpoint. Uses `request.formData()`, validates MIME via an explicit allow-list, validates size, sanitizes the filename, generates a unique suffix via `randomUUID().slice(0, 8)`, writes via `fs.writeFileSync`, returns metadata in the response body. **The candidate upload endpoint mirrors this structure but writes to `uploads/draft-documents/{orderId}/...` instead of `uploads/draft-documents/{userId}/{documentId}/...`** because the storage hierarchy in the spec uses orderId (BR 10) rather than userId+documentId.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/portal/orders/steps/DocumentsReviewStep.tsx` — the internal upload UI. Demonstrates the `<input type="file">` + on-change handler + `FormData` + immediate-fetch pattern. **`CandidateDocumentUpload` follows the same pattern**, with these differences:
  - Endpoint URL is `/api/candidate/application/[token]/upload` instead of `/api/portal/uploads`.
  - The MIME allow-list is narrower per BR 9 (PDF, JPEG, PNG only — no DOC/DOCX).
  - The file size limit is 10 MB per BR 9.
  - It surfaces upload errors visibly to the user (TD-009 fix) instead of the existing `// TODO: Show error message to user` placeholders in `DocumentsReviewStep.tsx` lines 217 / 224.
  - It exposes `capture="environment"` on the input for mobile camera affordance (DoD #18).
  - It shows an explicit loading state during upload (TD-011 fix).
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/services/document-download.service.ts` — exports `validateFilePath(path)` which the candidate DELETE endpoint reuses to confirm the candidate's `documentId` resolves to a path that lives strictly under `uploads/draft-documents/{orderId}/`.

**Storage subdirectory choice:** the candidate flow uses `{orderId}` (per BR 10) rather than the internal flow's `{userId}/{documentId}` because the candidate doesn't have a `userId` in the same auth model — they have an invitation token tied to an `orderId`. The metadata is co-located with that order's draft documents.

---

## Document scope routing (BR 11, BR 23)

When `CandidateDocumentUpload` succeeds, the parent section calls one of three save paths depending on the requirement's `documentData.scope`:

| Scope | Where the metadata is written in `formData.sections` | Key |
|---|---|---|
| `per_entry` | Inside the entry's `fields` array | requirement UUID (matching how non-document entry fields are keyed today) |
| `per_search` | Inside the section's `aggregatedFields` object | composite `${requirementId}::${serviceId}::${jurisdictionId}` |
| `per_order` | Inside the section's `aggregatedFields` object | requirement UUID directly |
| `null` or missing | **Treated as `per_search`** (BR 23) | composite key as above |

The save endpoint already accepts JSON-object values in both `entries.fields[i].value` and `aggregatedFields[k]` slots (Stage 3 widening), so no API or schema change is needed for routing.

The Pure helpers in `sectionProgress.ts` perform the inverse lookup — given an aggregated bucket, they find the metadata for a given requirement, applying the same default scope rule.

---

## API Routes

### New endpoints

#### `POST /api/candidate/application/[token]/upload`

- **Authentication:** Candidate session cookie matching the URL token (`CandidateSessionService.getSession()`).
- **Body:** `multipart/form-data` with three fields:
  - `file` (binary, required) — max 10 MB, MIME in `application/pdf`/`image/jpeg`/`image/png`.
  - `requirementId` (UUID, required).
  - `entryIndex` (non-negative integer, optional — only consumed for `per_entry`-scoped requirements).
- **Response (201):** `{ documentId, originalName, storagePath, mimeType, size, uploadedAt }`.
- **Validation order:** 401 → 403 → 400 (missing file / file too large / wrong MIME / missing requirementId / bad entryIndex format) → 404 (invitation not found) → 410 (expired/completed) → 201.
- **Storage:** `uploads/draft-documents/{orderId}/{timestamp}-{originalName}` per BR 10. `originalName` is sanitized (alphanumeric + `_-` + extension) with the existing rule used in `/api/portal/uploads`.
- **No DB row written.** The metadata is persisted via the next auto-save by the section component.
- **JSDoc:** standard block per `API_STANDARDS.md` Section 11. Document the rationale for "no DB row" pattern.

#### `DELETE /api/candidate/application/[token]/upload/[documentId]`

- **Authentication:** Candidate session cookie matching the URL token.
- **Path params:** `documentId` (UUID).
- **Response (200):** `{ deleted: true }`.
- **Validation order:** 401 → 403 → 400 (bad documentId format) → 404 (no metadata for that documentId in the candidate's saved formData) → 410 → 200.
- **Ownership check (BR 12):** the route loads the invitation's `formData`, walks every section bucket (per_entry inside `entries[*].fields`, per_search/per_order inside `aggregatedFields`), and finds a metadata record where `documentId` matches. The matched record's `storagePath` must start with `uploads/draft-documents/{orderId}/` for the candidate's order. **If either check fails, return 404 (not 403) — exposing the existence/absence of arbitrary documentIds via 403 vs 404 is information leakage; 404 in both cases is consistent.**
- **File deletion:** uses `validateFilePath` from `document-download.service.ts` then `fs.unlink`.
- **No formData mutation.** The candidate's next auto-save will omit the metadata (because the UI removes it from local state); this endpoint only deletes the file from disk.

### Modified endpoints

#### `GET /api/candidate/application/[token]/structure` — extended

- For each emitted workflow section, return all the fields the spec lists in the "Structure endpoint additions — workflow section payload" table.
- For each section overall, the `status` field is `'not_started'` initially. Real progress is computed client-side per BR 15.
- JSDoc updated.

#### `POST /api/candidate/application/[token]/save` — extended

- Flat schema's `value` union widened to accept `z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))`. Allows workflow-section acknowledgments and document-upload metadata objects.
- JSDoc updated.

#### `GET /api/candidate/application/[token]/saved-data` — extended

- Workflow-section sections are returned in the `{ type: 'workflow_section', acknowledged: boolean }` shape.
- JSDoc updated.

---

## Zod Validation Schemas

### `uploadRequestSchema` (new — in `upload/route.ts`)

The body is `multipart/form-data`, so Zod parses the *fields after extraction* rather than the body wholesale:

```ts
const uploadRequestSchema = z.object({
  requirementId: z.string().uuid(),
  entryIndex: z.preprocess(
    (v) => (typeof v === 'string' && v.length > 0 ? Number(v) : undefined),
    z.number().int().min(0).optional()
  ),
});
```

The `file` field is read directly off the parsed FormData (`formData.get('file')`) and validated by the route's manual size/MIME checks.

### `uploadResponseSchema` (new — in `upload/route.ts`)

```ts
const uploadResponseSchema = z.object({
  documentId: z.string().uuid(),
  originalName: z.string(),
  storagePath: z.string(),
  mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
  size: z.number().int().min(0),
  uploadedAt: z.string().datetime(),
});
```

Used to derive `UploadResponseMetadata` via `z.infer<typeof uploadResponseSchema>` and to validate the actual response shape in tests.

### `deleteResponseSchema` (new — in `upload/[documentId]/route.ts`)

```ts
const deleteResponseSchema = z.object({
  deleted: z.literal(true),
});
```

### `flatSaveRequestSchema` (modified — in `save/route.ts`)

Widen `value` union to also accept `z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))`. (Mirrors the widening already applied to the repeatable and address-history schemas in Stage 3.)

---

## TypeScript Types

| Type | Source | Purpose |
|---|---|---|
| `SectionStatus` | `candidate-stage4.ts` | `'not_started' \| 'incomplete' \| 'complete'` |
| `WorkflowSectionPayload` | `candidate-stage4.ts` | Structure-endpoint workflow section payload |
| `DocumentScope` | `candidate-stage4.ts` | `'per_entry' \| 'per_search' \| 'per_order'` |
| `UploadedDocumentMetadata` | `candidate-stage4.ts` | Saved + response metadata shape |
| `CrossSectionTarget` | `candidate-stage4.ts` | `'subject'` (Stage 4 only) |
| `CrossSectionRequirementEntry` | `candidate-stage4.ts` | One entry in the registry |
| `CrossSectionRegistry` | `candidate-stage4.ts` | `Partial<Record<CrossSectionTarget, CrossSectionRequirementEntry[]>>` |
| `WorkflowSectionAcknowledgment` | `candidate-stage4.ts` | Saved-data shape — `{ type: 'workflow_section'; acknowledged: boolean }` |
| `UploadResponseMetadata` | `z.infer<typeof uploadResponseSchema>` (in `upload/route.ts`) | Type derived from response schema |
| `CandidatePortalSection.status` (narrowed) | `candidate-portal.ts` | `'in_progress'` removed; `'incomplete'` added |
| `CandidatePortalSection.workflowSection?` (added) | `candidate-portal.ts` | Optional payload populated by the structure endpoint |

---

## UI Components — summary

| Component | Location | Server/Client | API calls | Used by |
|---|---|---|---|---|
| `WorkflowSectionRenderer` | new — `src/components/candidate/form-engine/WorkflowSectionRenderer.tsx` | `'use client'` | None (sanitization is in-process) | `portal-layout.tsx` |
| `CandidateDocumentUpload` | new — `src/components/candidate/CandidateDocumentUpload.tsx` | `'use client'` | POST `/api/candidate/application/[token]/upload`, DELETE `/api/candidate/application/[token]/upload/[documentId]` | `AggregatedRequirements.tsx`, plus inline in Education/Employment per_entry document requirements |
| `SectionProgressIndicator` | new — `src/components/candidate/SectionProgressIndicator.tsx` | `'use client'` | None | `portal-sidebar.tsx` |
| `CrossSectionRequirementBanner` | new — `src/components/candidate/CrossSectionRequirementBanner.tsx` | `'use client'` | None | `PersonalInfoSection.tsx` (resolved decision — rendered inside the target section, not the shell. See "Cross-section banner render location" below.) |
| `AggregatedRequirements` (modified) | `src/components/candidate/form-engine/AggregatedRequirements.tsx` | unchanged | None directly; passes through to `CandidateDocumentUpload` | `AddressHistorySection.tsx` |
| `portal-sidebar` (modified) | `src/components/candidate/portal-sidebar.tsx` | unchanged | None | `portal-layout.tsx` |
| `portal-layout` (modified) | `src/components/candidate/portal-layout.tsx` | unchanged | None directly | candidate portal page |

---

## Translation Keys

Added to `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-US.json` only. Other locales (`en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`) currently lack many Stage 1–3 candidate keys; the existing translation context falls back gracefully to en-US when a key is missing in the active locale. Per the Stage 3 plan precedent, Stage 4 also limits translation work to en-US to avoid scope creep.

| Key | English value |
|---|---|
| `candidate.workflowSection.acknowledgmentLabel` | `"I have read and agree to the above"` |
| `candidate.workflowSection.openDocument` | `"Open document"` |
| `candidate.workflowSection.documentUnavailable` | `"Document not available."` |
| `candidate.documentUpload.required` | `"Required"` |
| `candidate.documentUpload.optional` | `"Optional"` |
| `candidate.documentUpload.upload` | `"Upload"` |
| `candidate.documentUpload.uploading` | `"Uploading…"` |
| `candidate.documentUpload.remove` | `"Remove"` |
| `candidate.documentUpload.replace` | `"Replace"` |
| `candidate.documentUpload.errorTooLarge` | `"File too large. Maximum size is 10 MB."` |
| `candidate.documentUpload.errorWrongType` | `"File type not allowed. Accepted types: PDF, JPEG, PNG."` |
| `candidate.documentUpload.errorUploadFailed` | `"Upload failed. Please try again."` |
| `candidate.documentUpload.errorRemoveFailed` | `"Couldn't remove the file. Please try again."` |
| `candidate.documentUpload.tryAgain` | `"Try again"` |
| `candidate.sectionProgress.notStarted` | `"Not started"` |
| `candidate.sectionProgress.incomplete` | `"Incomplete"` |
| `candidate.sectionProgress.complete` | `"Complete"` |
| `candidate.crossSection.bannerLead` | `"Based on information you entered in another section, the following fields are now required:"` |

The existing `candidate.aggregatedRequirements.documentUploadPending` ("Upload will be available soon") becomes legacy — it is no longer referenced from `AggregatedRequirements.tsx` after Stage 4. The string stays in the translation file (unreferenced) rather than being removed, to avoid breaking any cached translation dumps. If lint surfaces it as unused, the implementer can leave a `// legacy — replaced by CandidateDocumentUpload in Stage 4` comment.

---

## Order of Implementation

The implementer must work in this order to keep dependencies satisfied:

1. **Database review** — confirm no schema change needed. (No migration commands run.)
2. **Dependency** — add `isomorphic-dompurify` to `package.json`, run `pnpm install` to update `pnpm-lock.yaml`, commit both.
3. **Types** — create `src/types/candidate-stage4.ts`. Modify `src/types/candidate-portal.ts` to widen the `status` union (replace `'in_progress'` with `'incomplete'`) and add the optional `workflowSection` payload field.
4. **Pure utilities (testable in isolation)** — create:
   1. `src/lib/candidate/sanitizeWorkflowContent.ts`
   2. `src/lib/candidate/crossSectionRegistry.ts`
   3. `src/lib/candidate/sectionProgress.ts`
5. **API routes** (each with JSDoc, validation order 401 → 403 → 400 → 404 → 410, structured Winston logging without PII):
   1. New endpoint: `upload/route.ts` (POST)
   2. New endpoint: `upload/[documentId]/route.ts` (DELETE)
   3. Modify `structure/route.ts` (workflow content payload + JSDoc)
   4. Modify `save/route.ts` (widen flat-schema value union + JSDoc)
   5. Modify `saved-data/route.ts` (workflow-section acknowledgment shape + JSDoc)
6. **New presentational components** — created in a sequence that lets each consumer see the file before it is referenced:
   1. `SectionProgressIndicator.tsx`
   2. `CrossSectionRequirementBanner.tsx`
   3. `WorkflowSectionRenderer.tsx`
   4. `CandidateDocumentUpload.tsx`
7. **Modify shared section components** — Replace inline status icon with `SectionProgressIndicator` in `portal-sidebar.tsx`, replace document placeholder line items with `CandidateDocumentUpload` in `AggregatedRequirements.tsx`.
8. **Wire shell state and section-progress reporting**:
   1. Modify `portal-layout.tsx` (lift `sectionStatuses` and `crossSectionRegistry`, add the dispatch branch for workflow sections, pass `crossSectionRequirements` down to `PersonalInfoSection`).
   2. Modify `PersonalInfoSection.tsx` (accept new props, render `<CrossSectionRequirementBanner>` at the top of the section, push progress).
   3. Modify `IdvSection.tsx` (accept new props, push progress).
   4. Modify `AddressHistorySection.tsx` (accept new props, push registry on field load, clear on entry/country change, push progress, route document metadata per scope).
   5. Modify `EducationSection.tsx` (same as Address History pattern).
   6. Modify `EmploymentSection.tsx` (same as Address History pattern).
9. **Translations** — add the new keys to `en-US.json`.
10. **Tests** (Pass 1 contract + Pass 2 mock-backed, per `TESTING_STANDARDS.md` Section 3):
    1. `sectionProgress.test.ts`
    2. `crossSectionRegistry.test.ts`
    3. `sanitizeWorkflowContent.test.ts`
    4. `WorkflowSectionRenderer.test.tsx`
    5. `CandidateDocumentUpload.test.tsx`
    6. `SectionProgressIndicator.test.tsx`
    7. `CrossSectionRequirementBanner.test.tsx`
    8. `upload/__tests__/route.test.ts`
    9. `upload/[documentId]/__tests__/route.test.ts`
    10. `structure/__tests__/route.test.ts` (new file — Pass 2; see entry #20 in "New Files to Create")
11. **Tech debt updates** — modify `docs/TECH_DEBT.md` to mark TD-009, TD-011, TD-052 as Addressed by Stage 4.
12. **Verification gate** — `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm vitest run` must all pass with zero net regression vs. the baseline at the start of the stage.

The implementer must NOT touch any files outside this list. If the implementer believes a file outside this list must change, they must stop and ask Andy before doing so (per `CODING_STANDARDS.md` Section 1.5).

---

## Risks and Considerations

> **Resolved items removed.** Three open questions from the original plan draft have been resolved by Andy on 2026-05-04 and the resolutions are now embedded directly in the plan body:
> - Status-union narrowing test-fixture impact → resolved by adding `portal-sidebar.test.tsx` and `portal-layout.test.tsx` to "Existing Files to Modify" entries #17 and #18 with a narrowly-scoped implementer permission to update fixture status literals only.
> - New structure-route test file → resolved as Pass 2, file path `src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts` (entry #20 in "New Files to Create").
> - Cross-section banner render location → resolved as `PersonalInfoSection.tsx` (see "Cross-section banner render location" section). Architect has no reservation about this choice.

1. **Document scope routing complexity.** Per BR 11 and BR 23, the parent section is responsible for routing per_entry / per_search / per_order metadata into the right slot in form state. If a `documentData.scope` value is malformed (not one of the three known strings, e.g., `"pet_search"` due to a typo in DSX configuration), the spec doesn't explicitly say what to do. **Plan ruling: log a debug warning via `clientLogger` and treat unknown scopes as `per_search` (matching the BR 23 default rule).** Document this inline.

2. **`per_search` composite key requires `serviceId` + `jurisdictionId`.** When the upload originates from `AggregatedRequirements`, the parent (`AddressHistorySection`) knows the requirement and the candidate's currently-edited entry's country, but `per_search` keys also include `jurisdictionId`. For Stage 4 the implementer can use the entry's most-specific subregion id (or the country id when no subregion is selected) as the jurisdictionId, OR collapse `serviceId` and `jurisdictionId` into a single placeholder ("global") when the candidate is uploading from the aggregated area where multiple services/jurisdictions could share the same requirement. **Plan ruling: jurisdictionId = the entry's most-specific subregion id, falling back to the country id, falling back to the literal `'global'` if no entry context exists.** Document this inline. Phase 7 may revisit.

3. **TD-053 ("Aggregated radio/checkbox fields don't auto-save until next blur").** This is an open Stage 3 tech debt item that surfaces specifically in `AggregatedRequirements`. Stage 4 modifies `AggregatedRequirements` substantially. The implementer should NOT try to fix TD-053 as part of Stage 4 — it is a separate piece of work and the spec doesn't list it. If the modification accidentally regresses behavior around radio/checkbox blur, the implementer must surface it.

4. **Sanitization library version drift.** `isomorphic-dompurify` 2.x is current at the time of writing (2026-05-04). If the implementer encounters a different major version or the package has been deprecated, **stop and surface it before pinning a different sanitizer.** Switching libraries is a security-relevant decision that shouldn't be made silently.

5. **Mobile camera affordance is browser-dependent.** `capture="environment"` is supported on iOS Safari and Chrome for Android natively. Older browsers may ignore the attribute and fall back to a regular file picker. The spec considers this acceptable (DoD #18). The implementer should NOT add a separate "Take photo" button or camera-API integration.

6. **Cross-section requirement deduplication on the registry.** A section may load the same DSX requirement (e.g., Middle Name) from multiple entries simultaneously. The registry must hold each contribution as a separate entry (so removing one entry doesn't accidentally remove the requirement that another entry still triggers), but the *banner* must show each unique field name only once. The pure helper `crossSectionRegistry.add` deduplicates by `(fieldId, triggeredBy, triggeredByEntryIndex)` so multiple entries from the same section produce multiple registry rows; the banner's display logic deduplicates by `fieldKey` for presentation. Documented in code.

7. **File-system mock discipline.** Tests for the upload route must use the `fs` default-import + module-object-call pattern from `TESTING_STANDARDS.md` Section 7.2. Both the upload and delete handlers use `fs.writeFileSync`, `fs.existsSync`, `fs.mkdirSync`, `fs.unlink`. The implementer must verify each call goes through the default module object so Vitest mocks work in the test files.

8. **Workflow-section type union coverage.** The spec only addresses `type === 'text'` and `type === 'document'`. The `WorkflowSection.type` column has a default of `'text'` but is a free `String` in the schema (no enum constraint at the DB level). If a future configuration introduces a new type value, `WorkflowSectionRenderer` must not crash. **Plan ruling: render an empty container with a "Document not available" placeholder when the type is unrecognized.** Acknowledgment checkbox still works.

9. **Race condition: candidate uploads to an entry, then deletes the entry.** Spec edge case: "Repeatable entry deleted while upload in progress." The upload completes server-side; the metadata returned by the server has no home in form state because the entry no longer exists. Per the spec, "auto-save discards it because the entry no longer exists." The plan's section component does NOT need to do anything proactive — the metadata is dropped on the floor when the entry is removed before `onUploadComplete` fires (the parent's setState callback runs against the now-removed entry and finds no match). **The orphaned file remains on disk** (TD-010 — explicitly out of scope for Stage 4).

10. **Existing `AddressHistorySection` already pushes to a registry-like data structure (`personalInfoRequirementIds`).** The Stage 4 cross-section registry is a different mechanism — it tracks externally-triggered requirements that should appear on the *target* section. The existing dedup (excluding subject-targeted requirements from the aggregated area) is complementary, not redundant. The plan keeps both.

---

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above (18 modified files, 9 new code files, 10 new test files = 37 distinct paths)
- [x] No file outside this plan will need to be modified. The two Stage 1/2 test files (`portal-sidebar.test.tsx`, `portal-layout.test.tsx`) are now explicitly listed as modified files #17 and #18 with a narrowly-scoped implementer permission to update fixture status literals only.
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table (field names match: `documentId`, `originalName`, `storagePath`, `mimeType`, `size`, `uploadedAt`, `requirementId`, `entryIndex`, `fieldId`, `fieldKey`, `fieldName`, `isRequired`, `triggeredBy`, `triggeredByContext`, `triggeredByEntryIndex`, `acknowledged`, `status`, `placement`, `displayOrder`, `name`, `type`, `content`, `fileUrl`, `fileName`)
- [x] All 23 Business Rules are addressed:
  - BR 1, 2 — workflow sections rendered in the right zone via the structure endpoint payload
  - BR 3 — sanitized HTML via `sanitizeWorkflowContent`
  - BR 4 — download link with `fileName` fallback to `name`
  - BR 5 — hardcoded translated acknowledgment label
  - BR 6 — `computeWorkflowSectionStatus` enforces the required-vs-not rule
  - BR 7, 8 — acknowledgment keyed by `workflow_sections.id` in `formData.sections`
  - BR 9 — 10 MB / PDF/JPEG/PNG validated client- and server-side
  - BR 10 — storage at `uploads/draft-documents/{orderId}/{timestamp}-{originalName}`
  - BR 11 — scope-based metadata routing (per_entry / per_search / per_order)
  - BR 12 — token + ownership validation on upload and delete
  - BR 13 — DELETE endpoint plus client-side `onRemove`
  - BR 14, 22 — three lowercase status values everywhere
  - BR 15 — progress recalculates on auto-save, no extra API call
  - BR 16 — repeatable progress checks only existing entries; no scope/gap detection
  - BR 17 — `subject` only as a Stage 4 cross-section target
  - BR 18 — Personal Info progress includes registry entries
  - BR 19 — registry cleared on entry removal
  - BR 20 — banner on the target section
  - BR 21 — uploads happen immediately on file selection
  - BR 23 — `null`/missing scope defaults to `per_search`
- [x] All 24 Definition of Done items mapped to plan elements
- [x] Tech debt items TD-009 (upload error feedback), TD-011 (upload progress indication), TD-052 (cross-section requirement awareness) are explicitly addressed and TECH_DEBT.md is in the modification list

This plan is ready for the test-writer (Pass 1) to proceed. All three previously-open risk questions (status-union test fixtures, new structure-route test file, cross-section banner render location) have been resolved by Andy on 2026-05-04 and the resolutions are reflected in the plan body above.
