# Feature: Record Search Requirements — Split from Address History (Task 8.4)

**Date:** 2026-05-14
**Branch:** `task-8.4-record-search-requirements`
**Technical plan:** `docs/plans/task-8.4-record-search-requirements-technical-plan.md`

---

## What changed

The "AggregatedRequirements" block that previously lived at the bottom of Address History (the deduplicated additional fields and aggregated documents collected from the union of countries selected in address entries) has been extracted into its own dedicated candidate-portal step: **Record Search Requirements**.

- **Address History** is now entries-only. It posts an entries-only payload to `/save` (no `aggregatedFields` key) and renders no aggregated content.
- **Record Search Requirements** is a new Step 7 in the post-Task-8.2 nine-step flow, appearing after Personal Info and before after-service workflow sections. It renders the same `AggregatedRequirements` component that Address History previously embedded.

No database schema changes were made. `CandidateInvitation.formData` is a JSON column; the new section writes to a new bucket key `formData.sections.record_search`. There is no data migration and no backward-compatibility read from the legacy `formData.sections.address_history.aggregatedFields` bucket (plan §11.1).

---

## How it works

### Structure endpoint

`GET /api/candidate/application/[token]/structure` now emits a `record_search` section entry when the package contains at least one record-type service — the same guard that controls whether Address History is emitted. The section carries no scope block; scope is owned by Address History. The initial `status` is `not_started`.

### Save endpoint

`POST /api/candidate/application/[token]/save` dispatches `sectionType === 'record_search'` requests to a new co-located helper module `recordSearchSave.ts`. The helper validates the request body with its own Zod schema (`recordSearchSaveRequestSchema`), looks up the invitation, enforces the standard expiry/completed guards, and writes the entire `fieldValues` map as a whole-object replacement to `formData.sections.record_search`. This is the same replacement-on-every-save convention that address history uses for `aggregatedFields`.

The `aggregatedFields` field on the `addressHistorySaveRequestSchema` is now optional. Address History no longer requires it, and the server no longer enforces its presence. Legacy clients that still send it are accepted (backward tolerance).

### Saved-data endpoint

`GET /api/candidate/application/[token]/saved-data` adds a `record_search` branch to its section-formatting loop. The response always includes `sections.record_search` with a `fieldValues` map, defaulting to `{}` when no save has happened yet — giving the component a stable hydration shape on first load (same pattern as `personal_info` and `idv`).

### Upload deletion endpoint

`DELETE /api/candidate/application/[token]/upload/[documentId]` gained a `fieldValues` lookup branch in `findMetadataByDocumentId`. Without it, deleting a document uploaded via Record Search Requirements would fail to locate the metadata because the function previously only inspected `aggregatedFields` — a key that the new section does not use.

### Submission

`submitApplication.ts` now reads the aggregated-field values from `formData.sections.record_search.fieldValues` instead of `formData.sections.address_history.aggregatedFields`. The downstream `aggregatedFields` output field consumed by `orderDataPopulation` is unchanged; only the source of the values changed. The legacy `address_history.aggregatedFields` bucket is intentionally not read (plan §11.1).

### React component — `RecordSearchSection.tsx`

New client component at `src/components/candidate/form-engine/RecordSearchSection.tsx`. On mount it:

1. Fetches saved data to get the read-only address-history entries snapshot (to know which countries were selected) and the section's own `record_search.fieldValues`.
2. Calls `useEntryFieldsLoader` for each entry that has a `countryId` to load DSX fields for that country.
3. Fetches `personal-info-fields` to get the dedup set that prevents Personal Info fields from reappearing here.

It then derives `aggregatedItems` using the same `addressHistoryStage4Wiring` helpers that the pre-split Address History used, renders the existing `AggregatedRequirements` component, and auto-saves (debounced 500 ms) to the save endpoint with `sectionType: 'record_search'`.

When `aggregatedItems.length === 0`, the component renders an empty-state message (`candidate.recordSearch.noFieldsRequired`) and reports progress `complete` immediately — the same pattern as Personal Info's empty state.

`portal-layout.tsx` routes `section.type === 'record_search'` to `RecordSearchSection`.

### Progress computation — `computeRecordSearchStatus`

New exported function in `src/lib/candidate/sectionProgress.ts`. Rules:

- No required fields and no required documents → `complete`.
- All required fields have values and all required documents are uploaded → `complete`.
- All requirements empty and no value typed → `not_started`.
- Partially satisfied → `incomplete`.

---

## Translation keys added

Four keys added in all five language files (`en-US`, `en-GB`, `es-ES`, `es`, `ja-JP`):

| Key | en-US value |
|---|---|
| `candidate.portal.sections.recordSearchRequirements` | "Record Search Requirements" |
| `candidate.recordSearch.heading` | "Additional information needed for your records search" |
| `candidate.recordSearch.intro` | "Based on the countries in your address history, please provide the information below." |
| `candidate.recordSearch.noFieldsRequired` | "No additional information is required for the records search." |

Spanish translations (`es-ES`, `es`) are fully localized. Japanese (`ja-JP`) and British English (`en-GB`) carry the same English strings as `en-US` for the new keys.

---

## Types

New types module `src/types/candidate-record-search.ts`:

- `RecordSearchSaveRequest` — re-export of the type inferred from `recordSearchSaveRequestSchema` in the save helper.
- `RecordSearchSectionSavedData` — shape of the persisted bucket as returned by the saved-data endpoint.
- `RecordSearchSectionProps` — props contract for `RecordSearchSection.tsx`.

`CandidatePortalSection.type` in `src/types/candidate-portal.ts` adds `'record_search'` to its union.

---

## Files changed

### New files
- `src/types/candidate-record-search.ts` — types module for the new section
- `src/app/api/candidate/application/[token]/save/recordSearchSave.ts` — Zod schema, inferred type, and `handleRecordSearchSave` helper
- `src/components/candidate/form-engine/RecordSearchSection.tsx` — new section component
- `src/app/api/candidate/application/[token]/save/__tests__/record-search-schemas-pass1.test.ts` — Pass 1 schema contract tests
- `src/app/api/candidate/application/[token]/save/__tests__/record-search.test.ts` — Pass 2 save endpoint integration tests
- `src/app/api/candidate/application/[token]/saved-data/__tests__/record-search.test.ts` — saved-data endpoint tests for the new section
- `src/components/candidate/form-engine/__tests__/RecordSearchSection.test.tsx` — component tests
- `src/lib/candidate/__tests__/computeRecordSearchStatus.test.ts` — unit tests for the new progress helper
- `src/translations/__tests__/task-8.4-record-search-translation-keys.test.ts` — translation key presence tests across all five locales
- `e2e/tests/task-8.4-record-search.spec.ts` — end-to-end tests for the candidate-facing flow
- `docs/plans/task-8.4-record-search-requirements-technical-plan.md` — technical plan

### Modified files
- `src/types/candidate-portal.ts` — added `'record_search'` to `CandidatePortalSection.type` union
- `src/app/api/candidate/application/[token]/structure/route.ts` — emits `record_search` section when package has record-type services; updated JSDoc
- `src/app/api/candidate/application/[token]/save/route.ts` — dispatches `record_search` to helper; makes `aggregatedFields` optional on address-history schema; removes the 400 guard that required `aggregatedFields`; updates address-history write path to only attach `aggregatedFields` when supplied
- `src/app/api/candidate/application/[token]/saved-data/route.ts` — adds `FormattedRecordSearchSection` interface and `record_search` branch in the section-formatting loop; guarantees `record_search` defaults to `{ type: 'record_search', fieldValues: {} }` when absent; updates JSDoc
- `src/app/api/candidate/application/[token]/upload/[documentId]/route.ts` — adds `fieldValues` lookup to `findMetadataByDocumentId`
- `src/components/candidate/portal-layout.tsx` — adds `record_search` branch routing to `RecordSearchSection`
- `src/components/candidate/form-engine/AddressHistorySection.tsx` — removes all aggregated-area state, handlers, memos, and the `AggregatedRequirements` render; converts imports to `@/` prefix paths; posts entries-only payloads to `/save`
- `src/lib/candidate/sectionProgress.ts` — adds `computeRecordSearchStatus` export
- `src/lib/candidate/submission/submitApplication.ts` — reads aggregated values from `record_search.fieldValues` instead of `address_history.aggregatedFields`; adds `fieldValues` to `RawSectionData` interface
- `src/translations/en-US.json` — four new keys
- `src/translations/en-GB.json` — four new keys
- `src/translations/es-ES.json` — four new keys (Spanish)
- `src/translations/es.json` — four new keys (Spanish)
- `src/translations/ja-JP.json` — four new keys
- `src/app/api/candidate/application/[token]/save/__tests__/address-history.test.ts` — updated test to reflect `aggregatedFields` is now optional
- `src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts` — updated section count from 8 to 9 and added assertion for the new `record_search` section shape
- `src/components/candidate/form-engine/__tests__/AddressHistorySection.test.tsx` — updated to reflect the entries-only post-split behavior
