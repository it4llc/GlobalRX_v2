# Technical Plan: Task 8.4 — Record Search Requirements (Split from Address History)

**Based on specification:** `docs/candidate-invite-phase-plan.md` (Phase Plan) and `docs/Candidate_Invite_Design_Document.md`. No standalone `docs/specs/task-8.4-*.md` spec file exists; this plan is derived from those two sources plus the project owner's clean-cut decision delivered in the request body.
**Date:** 2026-05-14

---

## 1. Context and Goal

Today, Address History (Step 3 in the post-Task-8.2 flow) renders both:

1. The per-entry **address history form** (countries, address blocks, dates, per-entry documents) — driven by record-type DSX requirements with `collectionTab !== 'subject'` and `scope === 'per_entry'` (for documents).
2. A bottom **"AggregatedRequirements"** block — deduplicated additional fields (non-subject, non-address-block) and aggregated documents (`per_search` / `per_order`) collected from the union of countries the candidate selected in their address entries.

Task 8.4 splits #2 into its own standalone step: **Record Search Requirements** (Step 7 in the Task-8.2 9-step flow, sitting between Personal Info at Step 6 and after-service workflow sections at Step 8). After this task, **Address History no longer renders any aggregated content** — it is entries-only.

The project owner has ruled there are no live applications, so:

- **No data migration.** Any saved `formData.sections.address_history.aggregatedFields` in the database is orphaned and ignored.
- **Clean new save path.** Record Search Requirements writes to a brand-new section bucket key (`record_search`). The new section MUST NOT read from `formData.sections.address_history.aggregatedFields` as a fallback under any circumstances. The orphaned data stays where it is in the DB; we do not delete it, migrate it, or look at it.

---

## 2. Database Changes

**None.**

- `CandidateInvitation.formData` is a JSON column; the new section is stored as a new top-level bucket under `formData.sections.record_search`. No Prisma schema change, no migration.
- The orphaned `formData.sections.address_history.aggregatedFields` data remains on existing invitation rows but is **never read** by the new section. Address History save logic stops writing to it (see §4).

---

## 3. New Files to Create

### 3.1 Component

**`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/RecordSearchSection.tsx`** — client component (`'use client'`).

Purpose: the new Step 7 section. Renders the deduplicated additional fields and aggregated documents previously shown at the bottom of `AddressHistorySection`. Self-contained: fetches its own dependencies (countries hydration not needed because Address History is the source of country selections; this section reads the persisted address-history entries to know which countries were chosen).

What it contains:
- `'use client'` directive.
- Props interface `RecordSearchSectionProps` matching the wiring pattern used by sibling sections (`token`, `serviceIds`, `onProgressUpdate`, `onSaveSuccess`, `sectionValidation`, `errorsVisible`).
- Local state: `loading`, `saveStatus`, `pendingSave`, `recordSearchFieldValues` (the section's own values), `entries` (read-only snapshot of saved Address History entries, used to drive country-derived field loading), `personalInfoRequirementIds` (dedup source, same as today's Address History block), `fieldsByEntry` cache via `useEntryFieldsLoader`.
- Loads on mount, in this exact order:
  1. `GET /api/candidate/application/[token]/saved-data` — reads **only** `sections.address_history.entries` (for country list) and `sections.record_search.fieldValues` (the new section's own saved values). Explicitly does **not** read `sections.address_history.aggregatedFields` — this is enforced by passing only the entries through (see §4.3).
  2. `GET /api/candidate/application/[token]/personal-info-fields` — for dedup IDs.
  3. For every entry with a `countryId`, calls the existing `useEntryFieldsLoader` to load DSX fields for that country.
- Uses helpers from `addressHistoryStage4Wiring.ts` (already exists, no changes): `buildEntryFieldsBuckets`, `splitFieldsByCollectionTab`, `computeAddressHistoryAggregatedItems`, `buildAggregatedDocumentRequirementsForProgress`, `routeAddressHistoryDocumentScope`, `extractAggregatedUploadedDocuments`, `readAggregatedItemScope`.
- Renders the existing `AggregatedRequirements` component (no changes to that file) wired to the new section's local state and the new save endpoint.
- Posts auto-saves (debounced 500ms via `useDebounce`) to `POST /api/candidate/application/[token]/save` with `sectionType: 'record_search'` and `sectionId: 'record_search'`.
- Renders an empty-state branch when `aggregatedItems.length === 0` displaying the `candidate.recordSearch.noFieldsRequired` translation key. Reports progress `complete` in that case (consistent with Personal Info Task 8.3 pattern).
- Reports progress upward via `onProgressUpdate` using the new `computeRecordSearchStatus` helper added in §4.10.

### 3.2 Types

**`/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-record-search.ts`** — new types module.

Contents:
- `RecordSearchSavedSection` — `{ sectionType: 'record_search'; fieldValues: Record<string, RepeatableFieldValue> }`.
- `RecordSearchSaveRequest` — derived via `z.infer<typeof recordSearchSaveRequestSchema>` (the schema is exported from `recordSearchSave.ts`).
- `RecordSearchSectionProps` — the prop shape for `RecordSearchSection.tsx`.

### 3.3 Save-route helper module

**`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/recordSearchSave.ts`** — new module.

Logically a save-route helper — naming convention matches Andy's sibling-file pattern from `personalInfoIdvFieldChecks.ts`.

Purpose: encapsulate the Zod schema and write logic for the new section so the main `save/route.ts` does not grow over its already-over-hard-stop size.

Contents:
- `recordSearchSaveRequestSchema` (Zod): `{ sectionType: z.literal('record_search'), sectionId: z.string(), fieldValues: z.record(z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string()), z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))])) }`. Same widening as today's `aggregatedFields` schema — primitives, string[], or one-level-deep JSON object for document metadata.
- `handleRecordSearchSave(body: unknown, token: string): Promise<NextResponse>` — performs:
  1. Zod validation → 400 on failure.
  2. Loads invitation by token; reuses the existing CandidateSessionService session check pattern (session validation already passed by the time we enter this function; this helper only does the body-validation + persistence path).
  3. Wraps the existing 404 / 410 expired / 410 completed guards (same shape as the address_history branch).
  4. Writes `formData.sections.record_search = { type: 'record_search', fieldValues: validated.fieldValues }`. Whole-object replacement, same convention as address_history's aggregatedFields replacement.
  5. Updates `lastAccessedAt`, returns `{ success: true, savedAt: ISO }`.

Crucially, **this helper does not touch `formData.sections.address_history`** under any circumstance. Cleanness rule (see §11): the file must not contain the string `aggregatedFields` or any reference to address-history-aggregated storage.

### 3.4 Tests

Generated by test writers, not the architect. Test writers create test files alongside the routes and components per the project's existing co-located `__tests__` pattern. See §10.

---

## 4. Existing Files to Modify

Every file listed below has been read in full or in the relevant section.

### 4.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/route.ts` (489 LOC)

**Read confirmed.**

Currently emits sections in this order: before-services workflow → IDV → address_history → education → employment → personal_info → after-services workflow → review_submit.

Change: after the `personal_info` push (around line 395-405) and before the after-services workflow push (line 408), insert a new `record_search` section emission when the package contains at least one record-type service. Logic:

```text
if (servicesByType.has('record')) {
  const recordServices = servicesByType.get('record')!;
  const serviceIds = recordServices.map(ps => ps.service.id);
  sections.push({
    id: 'record_search',
    title: 'candidate.portal.sections.recordSearchRequirements',
    type: 'record_search',
    placement: 'services',
    status: 'not_started',
    order: sectionOrder++,
    functionalityType: 'record',
    serviceIds,
  });
}
```

Notes:
- `record_search` is a new value for the `CandidatePortalSection.type` union (see §4.2).
- Section is conditional: emitted only when the package has at least one record service (same condition that emits `address_history`). Edge case for "package has no record services" already handled by the same `servicesByType.has('record')` guard the current address_history emission uses.
- No scope block is attached (this section is not scoped — scope lives on Address History per current behavior; we leave that alone).
- Placement value stays `'services'` for sidebar grouping consistency (the layout dispatches by array order, not by placement, per the Task 8.2 comment in this file).

### 4.2 `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts` (166 LOC)

**Read confirmed.**

`CandidatePortalSection.type` union currently: `'workflow_section' | 'service_section' | 'personal_info' | 'address_history' | 'review_submit'`.

Change: add the literal `'record_search'` to the union. No other changes to this file. (The type narrowing in portal-layout.tsx's dispatch picks this up automatically.)

### 4.3 `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/route.ts` (663 LOC — over the 600 hard-stop)

**Read confirmed.**

Add a new branch for `sectionType: 'record_search'`. Because this file is already over the 600-LOC hard stop, the implementer is required by Implementer Absolute Rule 10 to ask before adding code. To avoid that stop, this plan instructs the implementer to **extract the new schema and the new branch into a co-located helper module** (see §3.3) and import it back. The save route file grows by **≤ 8 lines** in this approach (schema not duplicated; one schema import, one early-branch block similar to the existing visit-tracking branch).

Specific changes in this file:

1. Add `import { handleRecordSearchSave } from './recordSearchSave';` (new file at §3.3).
2. After the visit-tracking branch (around line 252-301), add a new branch:
   ```text
   if (body?.sectionType === 'record_search') {
     return handleRecordSearchSave(body, token);
   }
   ```
3. **Also**: make `aggregatedFields` optional on the `address_history` payload going forward.
   - The 400-on-missing guard at lines 340-351 is replaced with a no-op (the key is now optional).
   - In `addressHistorySaveRequestSchema` (lines 93-119), change `aggregatedFields: z.record(...)` to `aggregatedFields: z.record(...).optional()`.
   - At line 552, omit the `aggregatedFields` key entirely when it was not supplied (do not implicitly create empty `aggregatedFields` keys on rows that had them previously). When supplied (legacy clients), continue writing as before for backward tolerance.

The address_history schema and write path stay exactly as they are today otherwise. Whether the client actually sends `aggregatedFields` is now an upstream decision (see §4.5).

### 4.4 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressHistorySection.tsx` (598 LOC — near hard stop)

**Read confirmed.**

Currently renders:
- The repeatable entries area.
- The `AggregatedRequirements` block below the entries (lines 569-578).
- Holds `aggregatedFieldValues` state and passes it to save calls.

Change set:

1. **Delete the `AggregatedRequirements` JSX block** at lines 569-578.
2. **Delete the `aggregatedFieldValues` state** (line 101) and its setter usages.
3. **Delete the aggregated-field handlers**: `handleAggregatedFieldChange` (lines 339-343), `handleAggregatedFieldBlur` (345-347), `handleAggregatedDocumentUpload` (440-447), `handleAggregatedDocumentRemove` (448-456), and the `routeAggregatedKey` helper (434-439).
4. **Delete the aggregated-document derivations**: `aggregatedItems` memo (391-399), `aggregatedDocuments` memo (404-407), `aggregatedDocumentRequirements` memo (408-411). These computations move to `RecordSearchSection.tsx`.
5. **Delete the `personalInfoRequirementIds` state and its load** (lines 106 and 148-162). It is no longer needed by Address History because aggregated computation moves to the new section.
6. **Change the save payload**: remove `aggregatedFields: aggregatedFieldValues` from the `saveEntries` POST body (line 363). The body sent to `/save` becomes `{ sectionType: 'address_history', sectionId: 'address_history', entries }` — no `aggregatedFields` key.
7. **Update saved-data load**: at line 183-184, stop reading `savedAggregated`. Remove the `setAggregatedFieldValues(savedAggregated)` call at line 197. (The address_history bucket still includes the legacy `aggregatedFields` key in the response — see §4.5 — but we ignore it.)
8. **Update `progressInputs` (lines 412-422)** to pass empty `aggregatedDocuments` and empty `aggregatedDocumentRequirements`. The section's progress now reflects entries-only completeness.

LOC impact: this file shrinks by approximately 90-110 lines, well below the 600 hard stop.

**No fallback path is added.** Any pre-existing `formData.sections.address_history.aggregatedFields` is silently ignored. No comment, no logger.warn, no migration — per the project owner's instruction.

### 4.5 `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/saved-data/route.ts` (358 LOC)

**Read confirmed.**

Current address_history branch (lines 257-282) returns `entries` + `aggregatedFields` even when `aggregatedFields` is empty. After this task:

**Change A:** add a new branch above the address_history branch for `sectionType === 'record_search'`. It returns:
```ts
{
  type: 'record_search',
  fieldValues: data.fieldValues ?? {}
}
```
The branch reads `data.fieldValues` directly from the stored bucket; no fallback to any other key.

**Change B:** the existing address_history branch is **untouched** — it still returns `aggregatedFields` (which will now be `{}` for all new rows because Address History no longer writes to it). This is intentional: keeping the contract additive means we don't risk breaking the Address History saved-data tests for the address_history branch shape. Existing rows with non-empty `aggregatedFields` still get them returned, but the new Address History client ignores them.

**Change C:** add a "Always include `record_search` section with empty fieldValues if it doesn't exist" guard mirroring the existing `personal_info` / `idv` defaults at lines 338-344. This ensures the new section component has a stable hydration shape even on first load.

### 4.6 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx` (991 LOC — over 600 hard stop)

**Read confirmed.**

Currently dispatches section types to the right component in `getActiveContent()`. After this task, a new dispatch branch is needed for `section.type === 'record_search'`.

Because this file is over the hard stop, the implementer must NOT add the dispatch inline. Instead:

**Change:** add **one** new dispatch branch between the `address_history` block (lines 854-875) and the `service_section verification-edu` block (line 877). The branch must be exactly the same shape as the address_history block (banner + section + step navigation), so it adds ~18 lines. **Andy preauthorizes this addition** to avoid the Rule 10 stop; this is an unavoidable layout-level integration point and there is no clean extraction path that does not break the dispatch's "list of types in one place" structure.

The branch:
```text
if (section.type === 'record_search') {
  return (
    <div className="p-6" data-testid="main-content">
      {errorsVisible && sectionValidation && (
        <SectionErrorBanner sectionId={section.id}
          scopeErrors={sectionValidation.scopeErrors}
          gapErrors={sectionValidation.gapErrors}
          documentErrors={sectionValidation.documentErrors}
        />
      )}
      <RecordSearchSection
        token={token}
        serviceIds={section.serviceIds || []}
        onProgressUpdate={(status) => handleSectionProgressUpdate(section.id, status)}
        onSaveSuccess={refreshValidation}
        sectionValidation={sectionValidation}
        errorsVisible={errorsVisible}
      />
      {stepNavigation}
    </div>
  );
}
```

Imports: add `import { RecordSearchSection } from '@/components/candidate/form-engine/RecordSearchSection';` at the top with the other section imports.

The shell does **not** need cross-section registry wiring for Record Search (no subject-targeted fields originate from this section; the source remains Address History).

### 4.7 `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/upload/[documentId]/route.ts`

**Read confirmed for the relevant lines (210-239).**

The DELETE handler walks each section's `aggregatedFields` to find an uploaded document by ID. After this task, uploaded documents for record-search live in `formData.sections.record_search.fieldValues`, so the walk must also inspect that bucket.

**Change:** in the walk loop, after the existing `aggregatedFields` inspection, additionally inspect the section's `fieldValues` field when present (only `record_search` uses this shape, but the walk can be generic — "any object-valued property at the section bucket level that looks like a JSON record of upload metadata"). Concretely:

```text
const fieldValuesBucket = (sectionData as { fieldValues?: unknown }).fieldValues;
if (fieldValuesBucket && typeof fieldValuesBucket === 'object') {
  // same inspection loop as for aggregatedFields
}
```

This is a small, localized change; the file is already designed around this dispatcher pattern.

### 4.8 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/validationEngine.ts` (575 LOC)

**Read confirmed.**

Currently calls `validateAddressHistorySection` (line 122-136) using `sectionsData['address_history']`. This helper inspects `entries`, scope, gap detection, and per-entry required fields. The aggregated-area documents are **not** specifically validated by the engine today (it only checks per-entry data; aggregated documents are handled via the Stage 4 progress hook for section-status, not via validation errors). This matches Phase 7 Stage 1's deliberate scope.

After this task:
1. **No change** to the address_history validation block — it stays entries-only, which it already effectively is.
2. **No new section validator** is added for `record_search` in v1. The new section's progress is computed client-side via `sectionProgress.ts` (see §4.9). The `record_search` section will not appear in `FullValidationResult.sections`. The merge logic in `portal-layout.tsx` (`mergeSectionStatus`) falls back to local status when no validation entry exists — this is the existing behavior for non-validated sections and is the desired behavior here for v1.

Future: a follow-up task can teach the validation engine about `record_search` if the project owner wants server-side required-document enforcement. v1 mirrors today's behavior, which already does not server-validate the aggregated documents.

### 4.9 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/sectionProgress.ts` (~320 LOC, well under hard stop)

**Read confirmed.**

Add one new pure helper for the new section's progress derivation.

**New export:** `computeRecordSearchStatus(input: { fieldValues: Record<string, unknown>; fieldRequirements: FieldLike[]; documentRequirements: DocumentRequirementLike[]; uploadedDocuments: Record<string, UploadedDocumentMetadata | undefined>; }): SectionStatus`.

Rules (mirroring the existing Personal Info logic, adapted for the record-search context):
- If no required fields and no required documents → `complete`.
- Walk required data fields against `fieldValues` (using the same `hasValue` helper already in the file).
- Walk required documents against `uploadedDocuments` (using `hasAggregatedDocument`, which is already in the file).
- If none satisfied AND nothing typed → `not_started`. If some satisfied but not all → `incomplete`. If all satisfied → `complete`.

No behavior change to existing exported helpers.

### 4.10 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/submitApplication.ts`

**Read confirmed.**

`readAddressHistorySection` today reads `formData.sections.address_history.aggregatedFields` and emits corresponding `OrderData` rows for each address-derived `OrderItem`. After this task, values needed at submission time live in `record_search.fieldValues`.

**Change:** modify `readAddressHistorySection` to populate the section's `aggregatedFields` output field from `formData.sections.record_search.fieldValues` when present (`address_history.aggregatedFields` is ignored). This preserves the existing `orderDataPopulation.ts` contract (which expects `aggregatedFields` on the section input) without modifying the deeper population logic.

This is the **one and only** place the new section's data is treated as "this is what aggregatedFields used to mean." It is fully internal to submission and is not visible to the candidate UI or save path.

### 4.11 Translation files (5 locales)

**Read confirmed for `en-US.json` keys section.**

Add the following translation keys to all five locale files:

- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-US.json`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-GB.json`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/es-ES.json`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/es.json`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/ja-JP.json`

| Key | en-US default |
| --- | --- |
| `candidate.portal.sections.recordSearchRequirements` | `Record Search Requirements` |
| `candidate.recordSearch.heading` | `Additional information needed for your records search` |
| `candidate.recordSearch.intro` | `Based on the countries in your address history, please provide the information below.` |
| `candidate.recordSearch.noFieldsRequired` | `No additional information is required for the records search.` |

Other locales: the implementer translates to en-GB / es-ES / es / ja-JP using the existing translations in the file as a style guide. If exact translations are uncertain, the en-US string may be used as a temporary placeholder. All five files MUST carry all four keys.

---

## 5. API Routes

### 5.1 Modified — `POST /api/candidate/application/[token]/save`

- **Auth:** existing candidate session cookie (unchanged).
- **New body shape accepted (sectionType `'record_search'`):**
  ```json
  {
    "sectionType": "record_search",
    "sectionId": "record_search",
    "fieldValues": { "<requirementId>": "<value>" }
  }
  ```
- **Validation:** Zod schema in §6.1. Value is the union `string | number | boolean | null | string[] | Record<string, primitive>` (last form for document metadata, same widening as aggregatedFields today).
- **Behavior:** whole-object replacement of `formData.sections.record_search.fieldValues`. Does not read from or write to `formData.sections.address_history.aggregatedFields`.
- **Returns:** `{ success: true, savedAt: ISO }` on 200.
- **Errors:** 401 no session, 403 token mismatch, 404 invitation not found, 410 expired/completed, 400 invalid body.
- **Modified `address_history` body shape:** `aggregatedFields` is now **optional** in the schema (was required). No other changes.

### 5.2 Modified — `GET /api/candidate/application/[token]/saved-data`

- **Auth:** unchanged.
- **New section in response:**
  ```json
  "record_search": {
    "type": "record_search",
    "fieldValues": { }
  }
  ```
- **Default:** when no saved data exists, the section is returned with `fieldValues: {}` (same defaulting pattern as `personal_info` and `idv`).
- **`address_history` response shape:** unchanged. Still includes `aggregatedFields` (now always `{}` for new rows; possibly populated on legacy rows but ignored by the client).

### 5.3 Modified — `GET /api/candidate/application/[token]/structure`

- **Auth:** unchanged.
- **Response change:** when the package contains record-type services, the `sections[]` array now includes a `record_search` entry positioned between `personal_info` and the first after-services workflow section (or before `review_submit` if there are no after-services workflow sections).
- New section shape:
  ```json
  {
    "id": "record_search",
    "title": "candidate.portal.sections.recordSearchRequirements",
    "type": "record_search",
    "placement": "services",
    "status": "not_started",
    "order": "<next>",
    "functionalityType": "record",
    "serviceIds": []
  }
  ```
- No `scope` block (this section is not scoped).

### 5.4 No new endpoints

No new HTTP endpoints are created. Document upload reuses the existing `POST /api/candidate/application/[token]/upload` route (no changes). The upload route's DELETE handler is modified (see §4.7) to also walk the new section's `fieldValues` bucket.

---

## 6. Zod Validation Schemas

### 6.1 New — `recordSearchSaveRequestSchema`

Location: `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/recordSearchSave.ts`.

```text
z.object({
  sectionType: z.literal('record_search'),
  sectionId: z.string().min(1),
  fieldValues: z.record(
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.array(z.string()),
      z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])),
    ]),
  ),
});
```

### 6.2 Modified — `addressHistorySaveRequestSchema`

Location: `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/route.ts` (existing).

Change: make `aggregatedFields` optional. Replace:
```text
aggregatedFields: z.record(z.union([...]))
```
with:
```text
aggregatedFields: z.record(z.union([...])).optional()
```

No other schemas are added or modified.

---

## 7. TypeScript Types

### 7.1 New — `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-record-search.ts`

- `RecordSearchSectionSavedData`:
  ```text
  {
    sectionType: 'record_search';
    fieldValues: Record<string, RepeatableFieldValue>;
  }
  ```
- `RecordSearchSaveRequest` — derived via `z.infer<typeof recordSearchSaveRequestSchema>` (the schema is exported from `recordSearchSave.ts` so callers can derive cleanly).
- `RecordSearchSectionProps` — the prop shape for `RecordSearchSection.tsx`. Fields: `token: string`, `serviceIds: string[]`, `onProgressUpdate?: (status: SectionStatus) => void`, `onSaveSuccess?: () => void`, `sectionValidation?: SectionValidationResult | null`, `errorsVisible?: boolean`.

### 7.2 Modified — `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts`

Add the literal `'record_search'` to `CandidatePortalSection.type`. No other field changes. The `serviceIds` field is already optional and present.

---

## 8. UI Components

### 8.1 New — `RecordSearchSection.tsx`

- **Path:** `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/RecordSearchSection.tsx`
- **Client component:** `'use client'` directive.
- **Renders:**
  - Section heading from `t('candidate.recordSearch.heading')`.
  - `AutoSaveIndicator` (existing, no changes).
  - When `aggregatedItems.length === 0`: the empty-state message `t('candidate.recordSearch.noFieldsRequired')` and reports progress `complete`.
  - When items exist: the existing `AggregatedRequirements` component, wired to local state and the new save endpoint. (No changes to `AggregatedRequirements.tsx`.)
- **Existing UI components used:** `AutoSaveIndicator`, `AggregatedRequirements`. Does NOT use `RepeatableEntryManager`, `EntryCountrySelector`, or `AddressBlockInput` — those stay on Address History.
- **API routes called:**
  - `GET /api/candidate/application/[token]/saved-data` (mount only) — reads address_history.entries (for country list) and record_search.fieldValues (own state).
  - `GET /api/candidate/application/[token]/personal-info-fields` (mount only) — dedup IDs.
  - `GET /api/candidate/application/[token]/fields` (per entry, via `useEntryFieldsLoader`) — DSX fields per country.
  - `POST /api/candidate/application/[token]/save` with `sectionType: 'record_search'` — auto-save.
  - `POST /api/candidate/application/[token]/upload` (via `CandidateDocumentUpload`, indirectly through `AggregatedRequirements`).
  - `DELETE /api/candidate/application/[token]/upload/[documentId]` (via `CandidateDocumentUpload`, indirectly).

### 8.2 Modified — `AddressHistorySection.tsx`

See §4.4. The block of code that rendered `AggregatedRequirements` is removed; all aggregated-related state and handlers are deleted. The component still uses `ScopeDisplay`, `EntryCountrySelector`, `RepeatableEntryManager`, `AddressBlockInput`, `CandidateDocumentUpload` (per_entry only), `AutoSaveIndicator`.

### 8.3 Modified — `portal-layout.tsx`

See §4.6. Add import for `RecordSearchSection` and add one dispatch branch.

### 8.4 NO CHANGES — `AggregatedRequirements.tsx`

The component is reusable as-is. The new section instantiates it with its own props. Do not modify this file.

### 8.5 NO CHANGES — `portal-sidebar.tsx`

The sidebar already iterates `sections[]` from the structure endpoint and renders whatever is there. The new entry will appear automatically.

---

## 9. Translation Keys

All four keys must exist in all five locale files (`en-US.json`, `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`).

| Key | en-US Value |
| --- | --- |
| `candidate.portal.sections.recordSearchRequirements` | `Record Search Requirements` |
| `candidate.recordSearch.heading` | `Additional information needed for your records search` |
| `candidate.recordSearch.intro` | `Based on the countries in your address history, please provide the information below.` |
| `candidate.recordSearch.noFieldsRequired` | `No additional information is required for the records search.` |

Localized strings for en-GB / es / es-ES / ja-JP follow the existing style in each file. The implementer may use the en-US value as a placeholder where localization is uncertain — the project already does this for new strings; localization team revises later.

---

## 10. Test Plan Outline

### 10.1 Test writer 1 (before implementation) — failing tests

Test files to create (all locations follow the existing `__tests__` co-located pattern):

1. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/__tests__/record-search.test.ts`** — structure endpoint emits `record_search` in the right position when the package has record services; omits it when the package has no record services; section has correct `id`, `title`, `type`, `serviceIds`, no `scope` block.

2. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/__tests__/record-search.test.ts`** — POST with `sectionType: 'record_search'` persists the new bucket; validates field shapes (good and bad); returns 401/403/404/410/400 in the right cases; **does NOT modify `formData.sections.address_history`** (positive test: assert address_history bucket is byte-identical before and after a record_search save).

3. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/__tests__/address-history.test.ts`** (extended) — verify that an address_history save body **without** `aggregatedFields` is now accepted (returns 200, persists entries, does not introduce an `aggregatedFields` key on the row). Verify the legacy body **with** `aggregatedFields` still works for backward tolerance (existing tests should continue to pass — no regression).

4. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/saved-data/__tests__/record-search.test.ts`** — saved-data endpoint returns `record_search` section with `fieldValues`; defaults to `{}` when no data exists; the response **does not** sneakily merge `address_history.aggregatedFields` into `record_search.fieldValues`.

5. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/__tests__/RecordSearchSection.test.tsx`** — component renders heading; renders empty-state when no items; renders `AggregatedRequirements` when items exist; calls the new save endpoint on field blur; reports `complete` status when fieldValues satisfy all required items; reports `not_started` when no values and no entries; does NOT make any fetch call that reads `aggregatedFields` from the saved-data response (intercept the fetch and assert no path uses that key).

6. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/__tests__/AddressHistorySection.test.tsx`** (extended) — the existing tests must update to verify that `AggregatedRequirements` is **no longer** rendered inside `AddressHistorySection`; the save payload no longer contains `aggregatedFields`; the `personal-info-fields` endpoint is no longer called by this section.

7. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/__tests__/portal-layout.test.tsx`** (extended) — when sections include `record_search`, the dispatch renders `RecordSearchSection`; the Next/Back buttons step into and out of it correctly; section status from progress callbacks updates the sidebar.

8. **`/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/__tests__/sectionProgress.test.ts`** (extended) — unit tests for the new `computeRecordSearchStatus` helper covering: no required fields/docs → complete; all required satisfied → complete; some satisfied → incomplete; none satisfied → not_started.

9. **Translation key tests** (existing project pattern — likely a single combined translation key audit test) — assert that the four new keys exist in all five locale files.

### 10.2 Test writer 2 (after implementation) — additional coverage

After implementation is complete, test writer 2 adds:

1. **End-to-end smoke for the split** — a single integration-style test that:
   - Creates an invitation with a package containing record-type services and a country requiring aggregated fields.
   - Walks the structure endpoint → verifies 4-step minimum: address_history at Step 3, personal_info at Step 6, record_search at Step 7 (Task 8.2 ordering).
   - POSTs an address_history save (entries only, no aggregatedFields) → 200, persists.
   - POSTs a record_search save → 200, persists in the new bucket.
   - GETs saved-data → record_search.fieldValues is populated; address_history.aggregatedFields is `{}` (not propagated).

2. **Backward-compat read absence test** — pre-seed a row with a legacy `formData.sections.address_history.aggregatedFields` blob; verify that the new `RecordSearchSection` renders with **empty** state (no items, empty-state message), proving no fallback read occurs.

3. **Upload deletion path** — uploaded a document via `RecordSearchSection`; then call DELETE on the document ID; verify the upload route correctly locates the metadata in `record_search.fieldValues` and removes it.

4. **Submission path** — `submitApplication.ts` orderData population test verifying that values in `record_search.fieldValues` are emitted into OrderData rows for each record-type item produced by Address History (replacing what `aggregatedFields` did before). See §11 risks.

---

## 11. Files NOT to Touch / Behaviors NOT to Add

### 11.1 No backward-compatibility reads

**The `RecordSearchSection` component and the new save/load endpoints MUST NOT, under any circumstances:**
- Read from `formData.sections.address_history.aggregatedFields`.
- Use `address_history.aggregatedFields` as a fallback when `record_search.fieldValues` is empty.
- Migrate, copy, or otherwise reference legacy aggregated data.

The orphaned data stays where it is. No comment in the new code should mention "legacy" or "migration" or "fallback".

### 11.2 No data migration

No SQL migration script. No application-layer migration code. No one-time fixup loop. Existing rows keep their existing data; the new section never touches it.

### 11.3 Files explicitly NOT touched

The following files are referenced by this plan but are NOT to be modified by the implementer:

- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AggregatedRequirements.tsx` (reused as-is by RecordSearchSection)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-sidebar.tsx` (no changes needed — data-driven)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/addressHistoryStage4Wiring.ts` (helpers reused as-is by RecordSearchSection — the file name and AddressHistory comments can stay; do not rename or refactor)
- `prisma/schema.prisma` (no schema change)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/CandidateDocumentUpload.tsx` (existing component reused)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/validationEngine.ts` (no new validator for record_search in v1)

### 11.4 Submission/order-data behavior

`/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/submitApplication.ts` and `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/orderDataPopulation.ts` currently read `formData.sections.address_history.aggregatedFields` and emit corresponding `OrderData` rows for each address-derived `OrderItem`. After this task, **values needed at submission time live in `record_search.fieldValues`**.

This plan instructs the implementer to use **Option A**: modify the address-section reader (`readAddressHistorySection` in `submitApplication.ts`) to populate the `aggregatedFields` output field from `formData.sections.record_search.fieldValues` (`address_history.aggregatedFields` is ignored). This preserves the existing `orderDataPopulation.ts` contract without modifying the deeper population logic.

This is the **one and only** place the new section's data is treated as "this is what aggregatedFields used to mean." It is fully internal to submission and is not visible to the candidate UI or save path.

---

## 12. Order of Implementation

1. **Database schema:** no changes. Skip.
2. **Prisma migration:** no migration. Skip.
3. **TypeScript types:**
   - Modify `src/types/candidate-portal.ts` to add `'record_search'` to `CandidatePortalSection.type`.
   - Create `src/types/candidate-record-search.ts` with `RecordSearchSectionSavedData` and `RecordSearchSectionProps`.
4. **Zod schemas:**
   - Create `src/app/api/candidate/application/[token]/save/recordSearchSave.ts` (helper module with schema and handler).
   - Modify `src/app/api/candidate/application/[token]/save/route.ts` `addressHistorySaveRequestSchema` to make `aggregatedFields` optional, and remove the 400-on-missing guard.
5. **API routes:**
   - Modify `src/app/api/candidate/application/[token]/save/route.ts` to route `sectionType: 'record_search'` to the new helper. Also accept omitted `aggregatedFields` on `address_history` saves.
   - Modify `src/app/api/candidate/application/[token]/saved-data/route.ts` to add the `record_search` response branch and default.
   - Modify `src/app/api/candidate/application/[token]/structure/route.ts` to emit the `record_search` section in the right position.
   - Modify `src/app/api/candidate/application/[token]/upload/[documentId]/route.ts` to also walk `fieldValues` buckets.
   - Modify `src/lib/candidate/submission/submitApplication.ts` `readAddressHistorySection` to populate `aggregatedFields` from the new `record_search.fieldValues` bucket.
6. **Library helpers:**
   - Modify `src/lib/candidate/sectionProgress.ts` to add `computeRecordSearchStatus`.
7. **UI components:**
   - Create `src/components/candidate/form-engine/RecordSearchSection.tsx`.
   - Modify `src/components/candidate/form-engine/AddressHistorySection.tsx` to remove aggregated state, handlers, derivations, and JSX.
   - Modify `src/components/candidate/portal-layout.tsx` to add the dispatch branch and the import.
8. **Translation keys:**
   - Add the four new keys to all five locale files: `en-US.json`, `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`.

---

## 13. Risks and Considerations

1. **`portal-layout.tsx` is over the 600-LOC hard stop.** Adding the dispatch branch is unavoidable — there is no clean extraction. Andy preauthorizes this addition (§4.6) because the alternative (extracting all dispatch into a separate file) is a larger refactor with its own risks.

2. **`save/route.ts` is also over the hard stop.** The plan extracts the new branch into `recordSearchSave.ts` (helper) and keeps the main route's net addition to ~5 lines. This avoids the Rule 10 stop.

3. **Submission compatibility (Option A in §11.4).** The `orderDataPopulation.ts` contract today reads `aggregatedFields` from the section it gets handed. We satisfy this by having `submitApplication.ts` populate that input from the new `record_search.fieldValues` bucket. A future task can refactor submission to know about the section natively; v1 keeps the change small.

4. **No subject-targeted fields originate from Record Search.** All subject-targeted fields (e.g., Mother's Maiden Name) come from Address History entries' country selections. The new section consumes the same dedup-against-Personal-Info logic and the same OR-merged isRequired computation — it does not push new entries into the cross-section registry. This is correct: Record Search is downstream of Address History, not a sibling source.

5. **Empty-state when no record-type service is in the package.** Structure endpoint omits the section entirely (guarded by `servicesByType.has('record')`). No conditional rendering needed on the client beyond the existing dispatch.

6. **Empty-state when record services exist but no country selected yet.** The new section renders with `aggregatedItems.length === 0` and shows the empty-state message. As soon as the candidate adds an address with a country, refreshing the section (or revisiting it) loads aggregated items. There is no live cross-section pub-sub here — the candidate must depart Address History (auto-save triggers) and visit Record Search to see updated items. This mirrors today's behavior in the aggregated block.

7. **Saved-data response still returns `address_history.aggregatedFields`.** This is intentional (additive contract; legacy rows still return whatever they have). The Address History client ignores it. Tests should not assert it is `{}` for legacy rows — only for newly-saved rows.

8. **Translation key audit.** If a per-locale audit test exists in the project (verifying all keys are present across locales), it will catch any missed locale. Implementer must add all four keys to all five files in the same commit.

9. **Architect did not find a Task-8.4-specific spec file.** The phase plan and the Task 8.2 linear-step-navigation spec together fully define this task; no other spec exists. If Andy expected one, he should resolve before the test writer starts.

---

## 14. Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above.
- [x] No file outside this plan will need to be modified.
- [x] All Zod schemas, types, and translation keys are listed.
- [x] The plan is consistent with the spec's intent (Step 7 = Record Search Requirements, Address History entries-only).
- [x] No-backward-compat-read rule is called out explicitly (§11.1) and reinforced in the test plan (§10.1.2, §10.1.4, §10.2.2).

---

## 15. Files relevant to this task (absolute paths)

- `/Users/andyhellman/Projects/GlobalRx_v2/docs/candidate-invite-phase-plan.md`
- `/Users/andyhellman/Projects/GlobalRx_v2/docs/Candidate_Invite_Design_Document.md`
- `/Users/andyhellman/Projects/GlobalRx_v2/docs/specs/linear-step-navigation.md`
- `/Users/andyhellman/Projects/GlobalRx_v2/docs/specs/personal-info-dynamic.md`
- `/Users/andyhellman/Projects/GlobalRx_v2/prisma/schema.prisma` (no changes)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/recordSearchSave.ts` (new)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/saved-data/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/upload/[documentId]/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressHistorySection.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AggregatedRequirements.tsx` (not modified, but consumed)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/RecordSearchSection.tsx` (new)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/sectionProgress.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/submitApplication.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/addressHistoryStage4Wiring.ts` (not modified, but consumed)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-record-search.ts` (new)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-US.json`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-GB.json`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/es-ES.json`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/es.json`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/ja-JP.json`

The plan is ready for the test-writer to proceed.
