# Technical Plan: Phase 6 Stage 3 — Address History & Address Block Rendering
**Based on specification:** `docs/specs/phase6-stage3-address-history-address-block-rendering.md` (created 2026-05-03, last updated 2026-05-04, status Confirmed)
**Date:** 2026-05-04
**Phase:** 6 — Dynamic Application Engine
**Stage:** 3 of 4
**Prerequisites:** Phase 6 Stage 1 and Stage 2 complete and deployed

---

## Plan Scope Reminder

The implementer's Absolute Rule 6 forbids creating, modifying, or touching any file not listed in this plan. Anything missing here cannot be added later without stopping the pipeline. Every file path below is absolute, and the "New Files" / "Existing Files to Modify" lists are exhaustive.

---

## Database Changes

**No schema changes are required for Stage 3.** Every table and column the spec requires already exists:

- `countries` — already stores the four-level geographic hierarchy via the `parentId` self-relation (`prisma/schema.prisma` lines 59-86). Country = `parentId IS NULL`; subregion1/2/3 cascade by `parentId`.
- `dsx_requirements` — `fieldData` JSON already stores `addressConfig`. `documentData` JSON already stores `instructions`. Both fields are returned to the candidate by the existing fields endpoint.
- `dsx_mappings` — supports per-location requirements at any geographic level via `(serviceId, locationId, requirementId)` unique constraint. The same table is used at country, subregion1, subregion2, and subregion3 levels — `locationId` just points to the appropriate `countries.id`.
- `dsx_availability` — tracks `(serviceId, locationId, isAvailable)` at any location.
- `service_requirements.displayOrder` — already used for sort ordering in the aggregated requirements area.
- `candidate_invitations.formData` — already used as the auto-save JSON column by Stage 1 and Stage 2.
- `order_data` — already stores submitted address values as JSON strings; the hydration service already reads them.

**Therefore, no Prisma migration is required for this stage.** The implementer must NOT create a migration directory, must NOT edit `prisma/schema.prisma`, and must NOT run `pnpm prisma migrate deploy` or `pnpm prisma generate`.

---

## New Files to Create

### API routes

1. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/subdivisions/route.ts`**
   - Purpose: Lightweight geographic-subdivision lookup endpoint. Returns `{ id, name, code2 }` for non-disabled `countries` rows where `parentId === parentId query param`, sorted alphabetically by name.
   - Contains: `GET` handler. Same authentication/expiration pattern as every other candidate endpoint (`401 → 403 → 400 → 404 → 410`).
   - Standard JSDoc block per `API_STANDARDS.md` Section 11.
   - Uses dynamic import of `CandidateSessionService` (mirrors `countries/route.ts`).

### Components

2. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressBlockInput.tsx`**
   - Purpose: Reusable address-block input. Renders pieces (street1, street2, city, state, county, postalCode) from the supplied `addressConfig`, falling back to the safe default when none is configured. When `showDates={true}`, renders `fromDate`, `toDate`, and `isCurrent` (with `toDate` hidden while `isCurrent` is checked).
   - Client component (`'use client'`).
   - Reads geographic data via the new subdivisions endpoint, with fallback to free-text input when the corresponding subdivision list is empty.
   - Handles in-flight stale-response invalidation: every fetch call captures the requesting context (entry id + level + selected parent id) and discards responses whose context no longer matches.
   - Uses translation keys for default labels; overrides them per-piece with `addressConfig[piece].label` when present.
   - Renders required asterisks per `COMPONENT_STANDARDS.md` Section 3.3 ("only show asterisks when BOTH the parent field AND the individual sub-field are required" — for Stage 3 the parent is the address_block field which carries `isRequired` from DSX; individual sub-fields are required when `addressConfig[piece].required === true`).
   - No inline `style={{}}` — Tailwind only.

3. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressHistorySection.tsx`**
   - Purpose: Section component for `address_history`. Reuses `RepeatableEntryManager`, `ScopeDisplay`, `EntryCountrySelector`, `AutoSaveIndicator` from Stage 2.
   - Client component.
   - Loads scope via the existing scope endpoint with `functionalityType=record` (after the scope endpoint is extended — see Existing Files to Modify).
   - Loads countries via the existing `/api/candidate/application/[token]/countries` endpoint.
   - Loads saved data via the existing `/saved-data` endpoint and reads `sections.address_history.entries` and `sections.address_history.aggregatedFields`.
   - Always renders at least one entry (creates an empty one on mount when no saved entries exist; never lets the candidate remove the last entry — when `entries.length === 1` the remove control on the entry passed to `RepeatableEntryManager` is hidden via the `canRemove` prop added to `RepeatableEntryManager`, see modification below).
   - On country selection: calls the existing fields endpoint with `serviceId` (one call per record-type service id passed in via `serviceIds` prop), country id, and the most-specific subregion id once the candidate completes the geographic selections for the entry.
   - Owns the per-entry "completed-address" detection: an entry's address is "complete" when (a) state piece either has a value or no subdivisions exist for the country, AND (b) county piece either has a value or county is disabled / no subdivisions exist for the state, AND (c) city likewise. Once complete, fires one merged fields call per service.
   - Computes the **aggregated requirements area** by walking every entry's loaded fields, deduplicating by `dsx_requirements.id` (requirement UUID), applying OR-merge for `isRequired` (most-restrictive wins), and splitting into `additionalInformation` (non-document, non-address-block) and `requiredDocuments` (document type) subsections. Sort key: service-type order first (using the same fixed `['idv', 'record', 'verification-edu', 'verification-emp']` ordering that `structure/route.ts` already uses; service names never visible to candidate), then DSX `displayOrder`. Renders the area only when at least one item is present.
   - Enforces "only one `isCurrent` at a time" — checking it on a new entry clears `isCurrent` on every other entry in the same save cycle.
   - Auto-save on blur with the existing 500ms debounce hook. Save body uses the new `address_history` shape (see Zod schemas below). Saves both `entries` and `aggregatedFields`.

4. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AggregatedRequirements.tsx`**
   - Purpose: Display the deduplicated aggregated requirements area below the address entries. Two subsections: "Additional Information" (data fields) and "Required Documents" (display name + instructions only — no upload UI in Stage 3).
   - Client component.
   - Renders data fields using `DynamicFieldRenderer` (which now supports `address_block` after this stage's changes; aggregated fields are unlikely to be address_block but the renderer handles it gracefully if so).
   - Renders document line items as informational rows: requirement name plus `documentData.instructions` when present.
   - Calls `onAggregatedFieldChange(requirementId, value)` and `onAggregatedFieldBlur()` so the parent section can drive auto-save.
   - Hidden entirely when neither subsection has any items.
   - Uses translation keys for the heading, subsection titles, and the "upload coming soon" text.

### Tests (Pass 1 — schema/contract/e2e tests, written before implementation)

5. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/subdivisions/__tests__/route.test.ts`**
   - Purpose: Pass-2 component-and-route test file (file created by the test-writer, but the route-level tests that rely on the implementer's actual Prisma calls will be filled out in Pass 2 per `TESTING_STANDARDS.md` Section 3). Pass 1 may include only the contract-level shape tests (parameter validation, status code mapping based on the architect-defined error matrix).
   - Tests the security matrix: 401 (no session), 403 (token mismatch), 404 (no invitation), 410 (expired or completed), 200 (success returns array of `{ id, name, code2 }` rows sorted by name, excludes disabled rows).
   - Tests `parentId` query parameter handling: missing/empty `parentId` returns 400; well-formed `parentId` with no children returns an empty array (200, not 404).

6. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/__tests__/AddressBlockInput.test.tsx`**
   - Component tests. Pass 2 (mocked dependencies will be derived from the actual implementation).
   - Covers Definition-of-Done items 1-9 in the spec:
     - Renders only enabled pieces from `addressConfig`
     - Marks required pieces with the asterisk indicator
     - Applies the safe default piece set when `addressConfig` is missing
     - Renders `fromDate` / `toDate` / `isCurrent` only when `showDates={true}`
     - "Current address" hides the `toDate` field
     - State renders as dropdown when subdivisions exist, free-text when they don't
     - County renders as dropdown when subregion2 exists, free-text otherwise
     - Stores state/county as UUID when chosen from dropdown, plain string when typed
     - Stale subdivision responses are discarded when the parent geographic selection changed mid-flight

7. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/__tests__/AddressHistorySection.test.tsx`**
   - Component tests for the section. Pass 2.
   - Covers DoD items 10-18, 21-33 in the spec:
     - Always renders at least one entry; remove control hidden/disabled when only one entry exists
     - Adding/expanding/collapsing/removing entries (subject to the minimum-one rule)
     - Only one `isCurrent` at a time — checking on a new entry clears the previous
     - Auto-save fires on blur and persists `sectionType: 'address_history'`, `entries`, and `aggregatedFields`
     - Section reload after auto-save reproduces the same visible state
     - Stale fields-API responses are discarded
     - Aggregated requirements area is hidden when no items exist, shown when items exist
     - Aggregated area dedupes by `dsx_requirements.id`
     - Aggregated `isRequired` flag is OR-merged across entries (most-restrictive wins)
     - Aggregated area recalculates when entries are added/removed/changed
     - Aggregated additional-field values save into `aggregatedFields` keyed by requirement UUID
     - Document requirements display name + instructions only (no upload UI)

8. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/__tests__/AggregatedRequirements.test.tsx`**
   - Component tests for the aggregated area in isolation. Pass 2.
   - Subsection split, sort order (service-type then displayOrder), name-only document display.

9. **`/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-address.ts`**
   - **NOT a test file — this is the new types file.** (Number 9 listed under Tests by mistake — see Types section below for its purpose.) The test-writer must NOT touch this file in Pass 1; it is owned by the implementer.

### Types

10. **`/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-address.ts`** *(canonical entry — replaces #9 above)*
    - Purpose: TypeScript types for the address block and address history saved data shape, the subdivisions endpoint response, and the aggregated requirements item.
    - Contains:
      - `AddressPieceKey` — `'street1' | 'street2' | 'city' | 'state' | 'county' | 'postalCode'`
      - `AddressConfigPiece` — `{ enabled: boolean; label: string; required: boolean }`
      - `AddressConfig` — `Record<AddressPieceKey, AddressConfigPiece>` (mirror the shape already used by `order-data-resolvers.ts`)
      - `AddressBlockValue` — `{ street1?: string; street2?: string; city?: string; state?: string; county?: string; postalCode?: string; fromDate?: string | null; toDate?: string | null; isCurrent?: boolean }`. Note: `state` and `county` are `string` (UUID when from dropdown, free-text otherwise). Date strings are ISO `YYYY-MM-DD`.
      - `SubdivisionItem` — `{ id: string; name: string; code2: string | null }`
      - `AggregatedRequirementItem` — `{ requirementId: string; name: string; dataType: string; type: 'field' | 'document'; isRequired: boolean; instructions?: string | null; fieldData?: FieldMetadata | null; documentData?: DocumentMetadata | null; serviceTypeOrder: number; displayOrder: number }`
      - `AddressHistoryEntry` — extension of the existing `EntryData` (from `candidate-repeatable-form.ts`) where each entry's `fields` array stores the address_block field's value as `AddressBlockValue` JSON.
      - `AddressHistorySectionSavedData` — `{ sectionType: 'address_history'; entries: AddressHistoryEntry[]; aggregatedFields: Record<string, RepeatableFieldValue> }`
      - All response/request types **derived from Zod schemas via `z.infer<typeof schema>`** where applicable (for the new save schema — see Zod section).

---

## Existing Files to Modify

Each file listed below was read in full or in the relevant section before listing. The "Confirmed" line names the read.

### 1. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/route.ts`
- **Currently:** Builds the section list. Already has `'record'` in `serviceTypeOrder` and a `'candidate.portal.sections.addressHistory'` title mapping (lines 166-172). Service sections are emitted with `type: 'service_section'` and `functionalityType: funcType`.
- **Change:** Replace the generic `service_section` emit for the `record` functionality type with a dedicated emit that uses `type: 'address_history'`. Position is unchanged (the spec calls for "position 2 in the service section ordering — after IDV, before Education History," which the existing fixed `serviceTypeOrder` already produces). The new section object shape:
  ```
  {
    id: 'address_history',
    title: 'candidate.portal.sections.addressHistory',
    type: 'address_history',
    placement: 'services',
    status: 'not_started',
    order: sectionOrder++,
    functionalityType: 'record',
    serviceIds: [...all record-type service ids in the package]
  }
  ```
- **Why:** The candidate's portal-layout dispatch needs to render `AddressHistorySection` rather than fall through to `SectionPlaceholder`. Using a dedicated `type: 'address_history'` value keeps the dispatch clean and matches how `personal_info` is handled today.
- **Confirmed:** read full file (lines 1-233).

### 2. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/fields/route.ts`
- **Currently:** Accepts `serviceId` and `countryId` query params. Loads `DSXMapping` for `(serviceId, locationId=countryId)` and `ServiceRequirement` for `serviceId`, deduplicates with location-mapping precedence, and returns the merged array sorted by `displayOrder`. Does not consult `dsx_availability` at all today, and does not walk subregion ancestors.
- **Change:**
  1. Accept an additional optional `subregionId` query parameter (UUID format when present).
  2. When `subregionId` is provided:
     - Walk the `countries` table from `subregionId` upward via `parentId` to assemble the full ancestor chain (subregion → ... → country). At most four lookups (subregion3 → subregion2 → subregion1 → country).
     - For each level (country, plus each ancestor that exists), check `dsx_availability` for `(serviceId, locationId)`. Treat missing rows as available (per Stage 3 spec — "if no availability entry exists, meaning it defaults to available, load its DSX field and document requirements"). If a service is **not** available at any specific level, skip the additional requirements at that level only — but always include the address_block field itself if it appears in the country-level mapping.
     - For each level where availability is true, load `DSXMapping` rows for `(serviceId, locationId)` and merge into the result.
  3. Merge logic across levels (documented inline per `CODING_STANDARDS.md` Section 8.4): keyed by `requirement.id`. The most-specific level's `isRequired` wins (subregion3 overrides subregion2 overrides subregion1 overrides country) — but if any level says `isRequired: true`, the merged value is `true` (this is the spec's "most restrictive across the candidate's full address history" rule, applied at the per-entry level here; cross-entry aggregation happens client-side in `AddressHistorySection`).
  4. Continue to also include service-level (universal) requirements via `ServiceRequirement` exactly as today.
  5. Return the same response shape as before (no new fields). Document the new `subregionId` parameter in the JSDoc block.
  6. Update validation: the optional `subregionId` must be a UUID-format string when present; otherwise return 400.
- **Why:** The spec's "dual-call pattern" relies on the client sending exactly one fields call per entry, with the most-specific subregion ID, and getting back merged requirements from every applicable level — including `dsx_availability` filtering. The existing endpoint ignores availability and ignores subregions, so it must be extended without breaking Stage 1 (IDV) and Stage 2 (Education / Employment) callers, who don't send `subregionId`.
- **Confirmed:** read full file (lines 1-203).

### 3. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/route.ts`
- **Currently:** Has two Zod schemas — `saveRequestSchema` (flat-fields, `personal_info | idv | workflow_section | service_section`) and `repeatableSaveRequestSchema` (`education | employment` with `entries` array). Branches on `requiresEntriesFormat` for save behavior.
- **Change:**
  1. Add a third Zod schema `addressHistorySaveRequestSchema` (see Zod section below) that accepts `sectionType: 'address_history'`, `sectionId: string`, `entries: AddressHistoryEntry[]`, and `aggregatedFields: Record<string, value>`.
  2. Extend the dispatch logic so a body with `sectionType === 'address_history'` is validated against the new schema and persisted into `formData.sections['address_history']` as `{ type: 'address_history', entries: [...], aggregatedFields: {...} }`. Use whole-section replacement (the entire `entries` array and the entire `aggregatedFields` object replace the previous values).
  3. Update the JSDoc block to document the third request shape.
  4. The existing locked-field-filtering logic (only applied when `sectionType === 'personal_info'`) remains unchanged. Address history has no locked fields.
  5. Inferred types for the new schema (`type AddressHistorySaveRequest = z.infer<typeof addressHistorySaveRequestSchema>`) follow the existing `FlatSaveRequest` / `RepeatableSaveRequest` pattern at the top of the file.
- **Why:** Address history needs the entries array (like education/employment) plus a new top-level `aggregatedFields` map (per spec "Auto-Save Data Shape"). The existing two-schema branching does not cover this combined shape.
- **Confirmed:** read full file (lines 1-416).

### 4. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/saved-data/route.ts`
- **Currently:** Returns flat `fields` for non-repeatable sections and `entries` for `education` / `employment`. Always backfills empty `personal_info` and `idv` sections.
- **Change:**
  1. Recognize `sectionType === 'address_history'` (or the section-id key `'address_history'`) and return both `entries` (same shape as education/employment) AND the new `aggregatedFields` object.
  2. New TypeScript-internal `FormattedAddressHistorySection` type alongside `FormattedFlatSection` and `FormattedRepeatableSection`.
  3. Do NOT auto-create an empty `address_history` section when none exists (unlike `personal_info` and `idv`); the section is conditional on package contents and the structure endpoint already drives whether it appears.
  4. Update the JSDoc block to document the new response shape for `address_history`.
- **Why:** The candidate's `AddressHistorySection` reads its initial state from `/saved-data` and needs both halves (`entries` and `aggregatedFields`) restored. The existing `FormattedRepeatableSection` shape only supports `entries`.
- **Confirmed:** read full file (lines 1-233).

### 5. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/scope/route.ts`
- **Currently:** Zod schema for query param accepts only `'verification-edu' | 'verification-emp'`. Returns scope strings hardcoded for "education" / "employment".
- **Change:**
  1. Extend the Zod enum to also accept `'record'`.
  2. When `functionalityType === 'record'`, set `typeLabel = 'address'` (used in the descriptive string, e.g., "Please provide all address history for the past 7 years"). Honor the same scope-type branching (`most-recent`, `most-recent-x`, `past-x-years`, `all`). Do NOT treat the degree-specific scope types (`highest-degree`, etc.) as valid for `record`; if a record service somehow has one, fall back to `'all'`.
  3. Update JSDoc to list `'record'` as a valid functionalityType and document the address-history wording.
- **Why:** `AddressHistorySection` calls the scope endpoint with `functionalityType=record` to render `ScopeDisplay`. The current schema rejects that value with a 400.
- **Confirmed:** read full file (lines 1-187).

### 6. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/DynamicFieldRenderer.tsx`
- **Currently:** When `dataType === 'address_block'`, renders a grey placeholder div with the literal text "Address fields coming soon" (lines 74-81).
- **Change:**
  1. Replace the placeholder branch with a render of the new `AddressBlockInput` component.
  2. Pass through: `addressConfig` (from `fieldData.addressConfig`), the current value (parsed JSON object), `onChange` (which serializes back to the value type expected by the parent), `onBlur`, `locked`, the `countryId` (which the renderer must now accept as a new optional prop — see point 4), and `showDates={false}` (the renderer never sets `showDates` to `true`; only `AddressHistorySection` overrides this internally by NOT going through the renderer for the address-block field — see point 5 below).
  3. Remove the hardcoded English string "Address fields coming soon" (no replacement is needed; the placeholder branch goes away).
  4. Add an optional `countryId?: string | null` prop to `DynamicFieldProps`. It is only consumed when `dataType === 'address_block'`. All existing callers (PersonalInfoSection, IdvSection, EducationSection, EmploymentSection) continue to work because the prop is optional. The four existing callers already track the entry's selected country and must pass it through; see modifications #7-#10 below.
  5. **Important — `showDates` is always false from the renderer.** The Address History section does NOT pass its address_block field through the `DynamicFieldRenderer`. It renders the address_block field directly via `<AddressBlockInput showDates={true} ... />`, then passes the rest of its non-address fields through the renderer as usual. This keeps `DynamicFieldRenderer` unaware of the section-type / date concern. (Spec confirms: "The AddressBlockInput component accepts a `showDates` flag. The Address History section passes `showDates={true}`. Education and Employment sections either pass `showDates={false}` or don't pass the flag at all.")
- **Why:** Definition-of-Done item #9 requires the renderer to render `AddressBlockInput` for `address_block` fields, replacing the Stage 2 placeholder. The optional `countryId` prop is what lets the renderer feed the right country down to the address block in Education / Employment.
- **Confirmed:** read full file (lines 1-261).

### 7. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/EducationSection.tsx`
- **Currently:** Calls `<DynamicFieldRenderer>` for every field in the entry's loaded field list (lines 343-365). Does not pass any country-aware prop down.
- **Change:** Add `countryId={entry.countryId ?? null}` to the `<DynamicFieldRenderer>` call so the embedded `AddressBlockInput` (rendered for `address_block` fields) can populate its state/province dropdown. No other behavioral change. Auto-save format is unchanged because address_block values were always JSON objects per Stage 2; only the value content changes from empty to populated once the new component renders.
- **Why:** DoD item #36 — Education renders the real address form for any `address_block` DSX field. Without country awareness, the address block can't load subdivisions.
- **Confirmed:** read full file (lines 1-410).

### 8. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/EmploymentSection.tsx`
- **Currently:** Same pattern as EducationSection. Calls `<DynamicFieldRenderer>` (lines 401-414). Has additional currently-employed end-date hiding logic that does not interact with address blocks.
- **Change:** Add `countryId={entry.countryId ?? null}` to the `<DynamicFieldRenderer>` call. No other change.
- **Why:** DoD item #36 — Employment renders the real address form for any `address_block` DSX field.
- **Confirmed:** read full file (lines 1-460).

### 9. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/IdvSection.tsx`
- **Currently:** Calls `<DynamicFieldRenderer>` (lines 348-361) without a `countryId` prop. IDV does have `selectedCountry` in component state.
- **Change:** Add `countryId={selectedCountry || null}` to the `<DynamicFieldRenderer>` call. **No address_block field is expected on IDV today**, but this keeps the renderer's contract consistent: any caller that uses `DynamicFieldRenderer` and may receive an `address_block` field must pass `countryId` through. Stage 1 spec already forbids address_block from rendering as a placeholder, and Stage 3 makes the real renderer available everywhere — IDV must not regress to a placeholder if a future DSX configuration adds an address_block to IDV.
- **Why:** Defensive consistency with the renderer's new optional `countryId` prop. Without this, an address_block field appearing on IDV would render with `countryId=undefined` and the state dropdown would be unusable.
- **Confirmed:** read full file (lines 1-369).

### 10. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx`
- **Currently:** Calls `<DynamicFieldRenderer>`. Has no per-entry country (Personal Info is location-independent, per the Stage 1 spec Business Rule #10).
- **Change:** Add `countryId={null}` to the `<DynamicFieldRenderer>` call. Personal Info should never render an address_block (per spec rule), but if a misconfigured DSX field ever did appear here, the explicit `null` is correct (no country, fall back to free-text state input). Keeps the renderer's contract uniform.
- **Why:** Defensive consistency with the renderer's new optional `countryId` prop. (If on review the implementer believes this prop is unnecessary on Personal Info because address_block is forbidden by spec, the implementer must surface that to Andy before omitting the change — they may not silently skip a file listed in this plan.)
- **Confirmed:** file path verified via `ls` of `src/components/candidate/form-engine/`. The implementer must `Read` the file before modifying per `CODING_STANDARDS.md` Section 1.2.

### 11. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/RepeatableEntryManager.tsx`
- **Currently:** Always renders the remove button on every entry (lines 159-169). No prop controls whether removing the last entry is allowed.
- **Change:**
  1. Add an optional `minimumEntries?: number` prop to `EntryManagerProps`. Default is `0` (current behavior — Education/Employment can have zero entries).
  2. When the current `entries.length <= minimumEntries`, hide the remove button on every entry. (The simplest correct implementation: when `entries.length <= minimumEntries`, do not render the `<button>` at all in that entry's header.)
  3. Address History will pass `minimumEntries={1}` so the remove button disappears on the only entry but reappears as soon as a second entry is added.
  4. The existing `entryLabelKey` and other props remain unchanged. Existing callers (Education, Employment) pass no `minimumEntries` and continue to allow zero entries.
- **Why:** Spec Business Rule #3 ("Address History always has a minimum of one entry. The candidate cannot remove the last entry. The remove button is hidden or disabled when only one entry exists.") and DoD item #13.
- **Confirmed:** read full file (lines 1-191).

### 12. `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-repeatable-form.ts`
- **Currently:** Defines `EntryData`, `RepeatableSection`, `ScopeInfo`, `EntryManagerProps`. The `ScopeInfo.functionalityType` field is typed as `string`. The `scopeType` enum already includes the degree variants (line 31).
- **Change:**
  1. Add `minimumEntries?: number` to `EntryManagerProps`.
  2. The Stage 3 plan does **not** modify the existing `EntryData` shape. The `value` field on each entry's field is `RepeatableFieldValue`, which is already `string | number | boolean | null | string[]`. Address-block JSON object values are stored under that field as a stringified JSON or, if the implementer elects to widen the type, as a typed object. **Decision required from implementer (small scope, document inline):** either (a) keep `value` as `RepeatableFieldValue` and have the address-block component serialize/deserialize JSON when reading and writing, or (b) widen `RepeatableFieldValue` to include `Record<string, unknown>` and update the corresponding Zod schema in `/save/route.ts` to accept JSON objects. The current code (`save/route.ts` line 38-44) only accepts `string | number | boolean | null | string[]`. **The plan picks option (b) for simplicity:** widen the union in both this types file AND the existing repeatable Zod schema (modification #3 above already covers the Zod schema — see Zod section).
  3. Update `RepeatableFieldValue` to: `string | number | boolean | null | string[] | { [k: string]: string | number | boolean | null | undefined }`. Document the additional case in a comment ("for address_block fields, the value is the JSON object stored under the requirement UUID").
- **Why:** The address-block value is a JSON object, not a primitive. Without widening, the save endpoint's Zod validation rejects address-block submissions and the section can never auto-save.
- **Confirmed:** read full file (lines 1-43).

### 13. `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts`
- **Currently:** Defines `CandidatePortalSection.type` as `'workflow_section' | 'service_section' | 'personal_info'` (line 18).
- **Change:** Add `'address_history'` to the union: `'workflow_section' | 'service_section' | 'personal_info' | 'address_history'`. No other change.
- **Why:** Modification #1 (structure endpoint) emits the new section type; the union must include it or TypeScript will reject the assignment.
- **Confirmed:** read full file (lines 1-89).

### 14. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx`
- **Currently:** Branches on `section.type === 'service_section' && section.functionalityType === 'idv' / verification-edu / verification-emp`. The `record` case falls through to `<SectionPlaceholder>`.
- **Change:** Add a new branch immediately before the `verification-edu` branch:
  ```tsx
  if (section.type === 'address_history') {
    return (
      <div className="p-6" data-testid="main-content">
        <AddressHistorySection token={token} serviceIds={section.serviceIds || []} />
      </div>
    );
  }
  ```
  Also remove the now-dead `record` fall-through (the structure endpoint will no longer emit `service_section / record`). Add the `import { AddressHistorySection } from './form-engine/AddressHistorySection';` at the top.
- **Why:** Wires the new section into the candidate portal.
- **Confirmed:** read full file (lines 1-146).

### 15. `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/services/order-data-resolvers.ts`
- **Currently:** `resolveAddressValue` walks `ADDRESS_PIECE_KEYS = ['street1','street2','city','state','county','postalCode']`. Already detects geographic UUIDs vs. names by checking the `geoNameMap`, but the lookup falls back to "use raw value and log a warning" rather than treating non-UUID values as plain strings without warning.
- **Change:**
  1. Add an explicit UUID format test for `state` and `county` values *before* the geoNameMap lookup. If the value matches the UUID v4 regex, attempt the map lookup and warn on miss. If the value does NOT match the UUID format, treat it as a free-text value and use it as-is — without logging a warning. (The warning is appropriate for "stale UUID" but not for "this country has no subdivisions and the candidate typed in 'Pyongyang Province' as free text".)
  2. After the existing piece loop, add a date-handling block that reads `parsed.fromDate`, `parsed.toDate`, and `parsed.isCurrent` from the parsed JSON. Append `AddressPiece` entries:
     - If `parsed.fromDate` is a non-empty string → append `{ key: 'fromDate', label: <translation key fallback "From">, value: <formatted date> }`
     - If `parsed.toDate` is a non-empty string → append `{ key: 'toDate', label: 'To', value: <formatted date> }`
     - If `parsed.isCurrent === true` AND `parsed.toDate` is empty/null → append `{ key: 'toDate', label: 'To', value: 'Present' }`
     - If `parsed.isCurrent === true` AND `parsed.toDate` IS present → still display the date (the candidate likely entered both for some reason) and the "Present" override does not fire.
  3. The display order (after street/city/state/postal code) is required by the spec.
  4. Add unit tests via the existing test file for these resolvers (modification #16 below).
  5. Update the `DEFAULT_ADDRESS_LABELS` constant to include `fromDate: 'From'` and `toDate: 'To'`. (English labels — the order details page is internal-user-facing and currently uses English defaults via the existing `DEFAULT_ADDRESS_LABELS` map. Translation of these labels in the order details surface is out of scope for Stage 3 because the existing labels in this file are already English-only constants.)
- **Why:** DoD items #34 and #35; spec sections "Free-Text State/County Hydration" and "Order Details Display — Address Dates and Free-Text Hydration."
- **Confirmed:** read full file (lines 1-264).

### 16. `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/services/__tests__/order-data-resolvers.test.ts`
- **Currently:** Tests `resolveDocumentValue`, `resolveAddressValue`, and `collectGeographicUuids`.
- **Change:** Add new test cases (Pass 2 — derived from the implementer's actual code):
  - State value that is not a UUID is displayed as-is, no warning logged
  - County value that is not a UUID is displayed as-is, no warning logged
  - State value that IS a UUID and resolves via `geoNameMap` displays the resolved name (existing behavior, regression coverage)
  - State value that IS a UUID and is NOT in the `geoNameMap` displays the raw UUID and logs the warning (existing behavior, regression coverage)
  - Address with `fromDate` and `toDate` populated includes both as labeled pieces in display order after the address pieces
  - Address with `fromDate` and `isCurrent: true` and no `toDate` shows "To: Present"
  - Address with `fromDate` and `isCurrent: true` AND a `toDate` value still shows the actual `toDate` (Present override does not fire)
  - Address with no date properties (Education / Employment style) does NOT include any date pieces in the output
- **Why:** DoD items #34 and #35 require regression coverage of the hydration changes.
- **Confirmed:** file path verified via `Bash ls`. Implementer must `Read` before modifying per `CODING_STANDARDS.md` Section 1.2.

### 17. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-US.json`
- **Currently:** Already has the section title `candidate.portal.sections.addressHistory: "Address History"` (line 614). Has the existing portal/scope/entry keys.
- **Change:** Add the new keys listed in the Translation Keys section below. Add them in alphabetical/grouped order (the file is already alphabetically grouped by `candidate.*` prefix).
- **Why:** All user-facing strings must be translation-driven (DoD item #41, `COMPONENT_STANDARDS.md` Section 6 / `CODING_STANDARDS.md` Section 1).
- **Confirmed:** read relevant lines (594-640) of the candidate.portal block.

---

## API Routes — Summary Tables

### New endpoint

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/candidate/application/[token]/subdivisions` | Candidate session, token must match | Fetch geographic children for a parent location id |

#### `GET /api/candidate/application/[token]/subdivisions`

- **Authentication:** Valid `candidate_session` cookie matching the URL token. Same dynamic-import pattern as every other candidate endpoint.
- **Query parameters:**
  - `parentId` (required, UUID) — the `countries.id` whose immediate children should be returned
- **Response (200):** `Array<{ id: string; name: string; code2: string | null }>` sorted alphabetically by `name`. May be an empty array (if the parent has no children — e.g., a country with no states in the database).
- **Validation order (per `API_STANDARDS.md` Section 2):** 401 → 403 → 400 → 404 → 410 → 200.
- **Errors:**
  - 401 — no candidate session
  - 403 — session token does not match URL token
  - 400 — missing or non-UUID `parentId`
  - 404 — invitation not found
  - 410 — invitation expired or completed
  - 500 — unexpected server error (caught + logged via Winston, no PII)
- **Filtering:** `where: { parentId, OR: [{ disabled: null }, { disabled: false }] }` — mirrors the existing `countries/route.ts` pattern.
- **Ordering:** `orderBy: { name: 'asc' }`.
- **JSDoc:** Standard block per `API_STANDARDS.md` Section 11.

### Modified endpoints

#### `GET /api/candidate/application/[token]/fields` — extended

- New optional query parameter: `subregionId` (UUID). When omitted, behavior is unchanged (Stage 1 / Stage 2 callers).
- When provided: walk ancestor chain via `parentId` (max 4 levels). For each level (country + ancestors):
  - Check `dsx_availability(serviceId, locationId)`. Missing row = available.
  - When available, load `dsx_mappings` for `(serviceId, locationId)` and merge into the result.
  - When unavailable, skip that level's additional requirements but still include the address_block requirement if it appears at the country level (already in the country-level mapping, so this is automatic).
- Merge keyed by `requirement.id`. `isRequired` is OR-merged across levels (most restrictive wins).
- New 400 case: `subregionId` present but not UUID format.
- Document the added parameter in the JSDoc block.

#### `POST /api/candidate/application/[token]/save` — extended

- New `sectionType: 'address_history'` accepted. Validated by the new `addressHistorySaveRequestSchema` (see Zod section).
- Request body shape:
  ```
  {
    sectionType: 'address_history',
    sectionId: string,
    entries: Array<{
      entryId: string (UUID),
      countryId: string (UUID) | null,
      entryOrder: number (>= 0),
      fields: Array<{
        requirementId: string (UUID),
        value: <widened RepeatableFieldValue, including JSON object>
      }>
    }>,
    aggregatedFields: Record<string, <widened RepeatableFieldValue>>
  }
  ```
- Persisted into `formData.sections['address_history']` as `{ type: 'address_history', entries: [...], aggregatedFields: {...} }`. Whole-section replacement (the entire `entries` array and the entire `aggregatedFields` object replace previous values).
- New 400 case: body claims `sectionType: 'address_history'` but is missing `entries` or `aggregatedFields` — reject with the same "details" shape used for the existing `requiresEntriesFormat` check.
- No locked-field filtering applies to address history.
- Update JSDoc.

#### `GET /api/candidate/application/[token]/saved-data` — extended

- For section key `'address_history'`, return `{ entries: [...], aggregatedFields: {...} }`. The new internal type `FormattedAddressHistorySection` lives alongside the existing two formatted types.
- Do NOT auto-create an empty `address_history` section when none exists.
- Update JSDoc.

#### `GET /api/candidate/application/[token]/scope` — extended

- Zod enum extended to `['verification-edu', 'verification-emp', 'record']`.
- When `functionalityType === 'record'`, set `typeLabel = 'address'` and reuse the existing scope-type branching to produce sentences like "Please provide all address history for the past 7 years" or "Please provide your complete address history".
- Degree-specific scope types are not legal for `record`; if seen, fall back to `'all'` like the existing default branch does.
- Update JSDoc.

---

## Zod Validation Schemas

All schemas live alongside the route handlers that use them (existing project convention — see `save/route.ts` for the precedent).

### `addressHistorySaveRequestSchema` (new — in `save/route.ts`)

```ts
const addressHistorySaveRequestSchema = z.object({
  sectionType: z.literal('address_history'),
  sectionId: z.string(),
  entries: z.array(z.object({
    entryId: z.string().uuid(),
    countryId: z.string().uuid().nullable(),
    entryOrder: z.number().int().min(0),
    fields: z.array(z.object({
      requirementId: z.string().uuid(),
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string()),
        // Address-block JSON object — keys are the address piece names plus
        // optional fromDate/toDate/isCurrent. Values are JSON-primitive.
        z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      ])
    }))
  })),
  // Aggregated additional-field values keyed by dsx_requirements.id.
  // Document requirements have NO entries here in Stage 3 — they are
  // tracked only as "which are required" until Stage 4 delivers uploads.
  aggregatedFields: z.record(z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.string())
  ]))
});
```

### `repeatableSaveRequestSchema` (modified — in `save/route.ts`)

Widen the per-field `value` union in the existing schema to also accept the address-block JSON object form, so Education / Employment entries can carry address_block field values once the new component renders for them:

```ts
value: z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.string()),
  z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
])
```

### `subdivisionsQuerySchema` (new — in `subdivisions/route.ts`)

```ts
const subdivisionsQuerySchema = z.object({
  parentId: z.string().uuid()
});
```

### `fieldsQuerySchema` (new explicit schema — in `fields/route.ts`)

The existing `fields/route.ts` does NOT use a Zod schema today (it does manual `searchParams.get` checks). The Stage 3 modification keeps the same manual-check style for consistency, but adds the optional `subregionId` UUID format check inline. (No new exported Zod constant required.)

### `scopeQuerySchema` (modified — in `scope/route.ts`)

```ts
const scopeQuerySchema = z.object({
  functionalityType: z.enum(['verification-edu', 'verification-emp', 'record'])
});
```

---

## TypeScript Types

All new types live in `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-address.ts`. Existing types in `candidate-portal.ts` and `candidate-repeatable-form.ts` are extended in place per the modification list above.

| Type | Source | Purpose |
|---|---|---|
| `AddressPieceKey` | new file | Union of the six piece names |
| `AddressConfigPiece` | new file | `{ enabled, label, required }` per piece |
| `AddressConfig` | new file | `Record<AddressPieceKey, AddressConfigPiece>` |
| `AddressBlockValue` | new file | The JSON object stored as the address_block field's value (street*/city/state/county/postalCode/optional dates) |
| `SubdivisionItem` | new file | `{ id, name, code2 }` shape returned by the new endpoint |
| `AggregatedRequirementItem` | new file | One item displayed in the aggregated requirements area, including hidden sort keys |
| `AddressHistoryEntry` | new file | The entry shape used in the address-history `entries` array |
| `AddressHistorySectionSavedData` | new file | The full saved shape — `{ sectionType, entries, aggregatedFields }` |
| `AddressHistorySaveRequest` | inferred via `z.infer<typeof addressHistorySaveRequestSchema>` in `save/route.ts` | Request body type for the new save shape |
| `AddressHistorySaveEntry` | inferred sibling | One entry inside the request |
| `RepeatableFieldValue` (widened) | `candidate-repeatable-form.ts` | Now includes the address-block JSON object case |
| `EntryManagerProps.minimumEntries?` | `candidate-repeatable-form.ts` | New optional prop on the manager |
| `CandidatePortalSection.type` (widened) | `candidate-portal.ts` | Now includes `'address_history'` |

---

## UI Components — Summary

| Component | Location | Server/Client | Renders | Uses | API Calls |
|---|---|---|---|---|---|
| `AddressBlockInput` | new — `src/components/candidate/form-engine/AddressBlockInput.tsx` | `'use client'` | Per-piece inputs (street1/street2/city/state/county/postalCode) plus optional date fields, based on `addressConfig` and `showDates` | `Input`, `Label`, `Select` (existing UI primitives) | GET `/api/candidate/application/[token]/subdivisions?parentId=<countryId | stateId | countyId>` — once per geographic level reached |
| `AddressHistorySection` | new — `src/components/candidate/form-engine/AddressHistorySection.tsx` | `'use client'` | `ScopeDisplay`, `RepeatableEntryManager` with per-entry `EntryCountrySelector` + `AddressBlockInput` (showDates=true) + non-address DSX fields via `DynamicFieldRenderer`, then `AggregatedRequirements` below | `RepeatableEntryManager` (with `minimumEntries=1`), `EntryCountrySelector`, `ScopeDisplay`, `AutoSaveIndicator`, `DynamicFieldRenderer`, `AddressBlockInput`, `AggregatedRequirements`, `useDebounce`, `useTranslation`, `clientLogger` | GET `/scope?functionalityType=record`, GET `/countries`, GET `/saved-data`, GET `/fields?serviceId=...&countryId=...&subregionId=...` (one merged call per entry once the address is complete), POST `/save` (debounced) |
| `AggregatedRequirements` | new — `src/components/candidate/form-engine/AggregatedRequirements.tsx` | `'use client'` | Optional heading + "Additional Information" subsection (data fields via `DynamicFieldRenderer`) + "Required Documents" subsection (name + instructions only) | `DynamicFieldRenderer`, `useTranslation` | None — receives data and callbacks as props |
| `DynamicFieldRenderer` | modified — `src/components/candidate/form-engine/DynamicFieldRenderer.tsx` | unchanged | Renders `<AddressBlockInput showDates={false} addressConfig=... countryId=... value=... onChange=... onBlur=... locked=... />` for `address_block` fields. All other branches unchanged. | adds `AddressBlockInput` import | None |
| `RepeatableEntryManager` | modified — `src/components/candidate/form-engine/RepeatableEntryManager.tsx` | unchanged | When `entries.length <= minimumEntries`, the per-entry remove button is not rendered. | unchanged | None |
| `EducationSection`, `EmploymentSection`, `IdvSection`, `PersonalInfoSection` | modified | unchanged | Adds `countryId={...}` to `<DynamicFieldRenderer>`. | unchanged | unchanged |
| `portal-layout.tsx` | modified | unchanged | Adds branch for `section.type === 'address_history'` to render `AddressHistorySection`. | adds `AddressHistorySection` import | unchanged |

---

## Translation Keys

Added to `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-US.json` only. The other translation files (`en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`) currently lack many of the existing Stage 1 / Stage 2 candidate keys (verified via grep — they have `candidate.portal.*` keys only up to Stage 1 era). This plan does NOT add the new keys to those files because that would expand the scope beyond what Stage 3 requires; the existing translation context falls back gracefully to the en-US value when a key is missing in the active locale. If Andy wants the other locales updated, that should be a follow-up TD ticket.

| Key | English value |
|---|---|
| `candidate.addressHistory.title` | `"Address History"` |
| `candidate.addressHistory.addAnother` | `"Add Another Address"` |
| `candidate.addressHistory.entryLabel` | `"Address {number}"` |
| `candidate.addressHistory.currentAddress` | `"Current address"` |
| `candidate.addressHistory.fromDate` | `"From"` |
| `candidate.addressHistory.toDate` | `"To"` |
| `candidate.addressHistory.removeConfirm` | `"Remove this address?"` |
| `candidate.addressBlock.street1` | `"Street Address"` |
| `candidate.addressBlock.street2` | `"Apt/Suite"` |
| `candidate.addressBlock.city` | `"City"` |
| `candidate.addressBlock.state` | `"State/Province"` |
| `candidate.addressBlock.county` | `"County"` |
| `candidate.addressBlock.postalCode` | `"ZIP/Postal Code"` |
| `candidate.addressBlock.selectState` | `"Select state/province"` |
| `candidate.addressBlock.selectCounty` | `"Select county"` |
| `candidate.addressBlock.selectCity` | `"Select city"` |
| `candidate.addressBlock.loadingSubdivisions` | `"Loading..."` |
| `candidate.addressBlock.noSubdivisions` | `"No subdivisions available"` |
| `candidate.aggregatedRequirements.heading` | `"Based on your address history, we need the following additional information:"` |
| `candidate.aggregatedRequirements.additionalInformation` | `"Additional Information"` |
| `candidate.aggregatedRequirements.requiredDocuments` | `"Required Documents"` |
| `candidate.aggregatedRequirements.documentUploadPending` | `"Upload will be available soon"` |

Existing key reused (no addition needed): `candidate.portal.sections.addressHistory` (already at line 614).

---

## Order of Implementation

The implementer must work in this order to keep dependencies satisfied:

1. **Database review** — confirm no schema change needed. (No migration commands run.)
2. **Types — new file**:
   - Create `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-address.ts`
3. **Types — extensions**:
   - `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts` (add `'address_history'` to the `type` union)
   - `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-repeatable-form.ts` (widen `RepeatableFieldValue`; add `minimumEntries?` to `EntryManagerProps`)
4. **Zod schemas** — added inline to API routes in step 5.
5. **API routes** (each with JSDoc, validation order 401→403→400→404→410, structured Winston logging without PII):
   1. New endpoint: `subdivisions/route.ts`
   2. Modify `scope/route.ts` (extend enum + record branch)
   3. Modify `fields/route.ts` (subregion walk + availability check + merge)
   4. Modify `save/route.ts` (new schema + dispatch branch + widened repeatable value)
   5. Modify `saved-data/route.ts` (new formatted shape for `address_history`)
   6. Modify `structure/route.ts` (emit `type: 'address_history'` for `record` functionality)
6. **Hydration service** (Order Details display):
   - Modify `src/lib/services/order-data-resolvers.ts` (UUID-vs-string detection without warning + date pieces)
7. **Shared UI updates**:
   - Modify `src/components/candidate/form-engine/RepeatableEntryManager.tsx` (`minimumEntries`)
8. **New UI components**:
   1. `src/components/candidate/form-engine/AddressBlockInput.tsx`
   2. `src/components/candidate/form-engine/AggregatedRequirements.tsx`
   3. `src/components/candidate/form-engine/AddressHistorySection.tsx`
9. **DynamicFieldRenderer**:
   - Modify `src/components/candidate/form-engine/DynamicFieldRenderer.tsx` (replace placeholder with `<AddressBlockInput showDates={false} ... />`; add optional `countryId` prop)
10. **Caller updates** (pass `countryId`):
    - `EducationSection.tsx`, `EmploymentSection.tsx`, `IdvSection.tsx`, `PersonalInfoSection.tsx`
11. **Wire-up**:
    - Modify `src/components/candidate/portal-layout.tsx` (new branch for `address_history`, add import)
12. **Translations**:
    - Add new keys to `src/translations/en-US.json`
13. **Tests** (Pass 1 contract + Pass 2 mock-backed, per the test-writer's two-pass discipline):
    - `subdivisions/__tests__/route.test.ts` (new)
    - `__tests__/AddressBlockInput.test.tsx` (new)
    - `__tests__/AddressHistorySection.test.tsx` (new)
    - `__tests__/AggregatedRequirements.test.tsx` (new)
    - Add new cases to existing `lib/services/__tests__/order-data-resolvers.test.ts`
14. **Verification gate** — `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm vitest run` must all pass with zero net regression vs. the baseline at the start of the stage.

The implementer must NOT touch any files outside this list. If the implementer believes a file outside this list must change, they must stop and ask Andy before doing so (per `CODING_STANDARDS.md` Section 1.5).

---

## Risks and Considerations

1. **`RepeatableFieldValue` widening cascades.** Widening the union in `candidate-repeatable-form.ts` may surface new TypeScript errors at every existing callsite that consumes the value. The implementer should run `pnpm typecheck` after step 3 and address any type narrowing required at consumers. Most consumers either pass values through or use `instanceof Date` checks (already present in `EducationSection.tsx` line 260) — the widened union should not affect those branches.

2. **Mid-flight stale-response handling.** The spec is explicit that subdivision and fields-API responses for stale geographic selections must be discarded (DoD #25, edge case "Stale subdivision/requirement responses"). The implementer must use a request-context capture pattern (e.g., snapshot `entryId + level + parentId` at request fire time, compare against current state on response). A naive `await` chain will introduce race conditions that show up only under realistic candidate behavior.

3. **`dsx_availability` "missing row = available" default.** The spec is explicit that a missing row means the service is treated as available. The implementer must NOT add an inverse default ("missing row = unavailable") — that would silently hide all requirements for any location whose availability rows haven't been seeded.

4. **Subregion walk performance.** The ancestor walk is at most 4 sequential queries per entry (`subregion3 → subregion2 → subregion1 → country`). This is acceptable for Stage 3. If profiling later shows it dominates, switch to a single recursive CTE — but do NOT pre-optimize that now.

5. **`'address_history'` is the section type literal — not a status value.** `DATABASE_STANDARDS.md` Section 5 forbids hardcoded status string literals. `'address_history'` is a section identifier, not an order/service status, so the rule does not apply — but the implementer may be tempted to refactor it into a constants file. That would expand scope beyond this plan. Keep the literal inline (matching how `'personal_info'`, `'idv'`, `'education'`, and `'employment'` are handled today in `save/route.ts` line 14 and line 30).

6. **Aggregated `isRequired` OR-merge across entries.** The deduplication logic in `AddressHistorySection` must compare `isRequired` across *every* entry — not just within a country, and not just the latest-edited entry. Spec Risk #8 calls this out specifically. Inline comment per `CODING_STANDARDS.md` Section 8.4 documenting the OR rule is required.

7. **Document requirements in Stage 3 have no values.** `aggregatedFields` only stores values for non-document requirements. The implementer must NOT add document records to `aggregatedFields` even if the requirement appears in the aggregated area. Documents are tracked only as "which are required"; uploads land in Stage 4.

8. **Country dropdown data already exists.** The candidate-side `/countries` endpoint and the shared `EntryCountrySelector` component already work. Address History reuses both — do NOT introduce a new "address-history-specific countries endpoint". (Verified via reading `EntryCountrySelector.tsx` and `countries/route.ts`.)

9. **`scope` endpoint label wording.** The spec doesn't mandate exact phrasing for the "address" variant (e.g., "Please provide all address history for the past 7 years"). The implementer may pick reasonable English phrasing matching the existing `verification-edu` / `verification-emp` cadence; document the choice in code comment so reviewers can surface concerns. (This is purposely not a translation key in Stage 3 because the existing scope strings in `scope/route.ts` are also not translation keys — staying consistent with the existing pattern. Translating scope strings is a separate refactor.)

10. **Other-locale translation files lag.** As noted in the Translation Keys section, only `en-US.json` is updated. Other locales fall back to en-US. If Andy wants full locale coverage, raise a TD ticket post-merge.

---

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above (16 files modified, 4 new code files, 4 new test files, 1 new types file = 25 distinct paths)
- [x] No file outside this plan will need to be modified
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table (field names match: `street1`, `street2`, `city`, `state`, `county`, `postalCode`, `fromDate`, `toDate`, `isCurrent`, `entryId`, `entryOrder`, `countryId`, `sectionType`, `entries`, `aggregatedFields`, and the `requirementId / name / dataType / fieldData / instructions / isRequired / serviceTypeOrder / displayOrder` aggregated-item fields)
- [x] All ten "MUST address" items from the user's request are covered:
  1. Subdivisions endpoint — covered by new file #1, route summary, security pattern (401/403/400/404/410)
  2. New `address_history` section type at position 2 — covered by structure-route modification #1 and the candidate-portal type widening #13
  3. Address-block rendering with three context modes — `AddressBlockInput` accepts `showDates` flag; Address History passes `true`; Education/Employment go through `DynamicFieldRenderer` which passes `false`
  4. Aggregated requirements area with section-level OR-merge dedup by UUID — covered by `AggregatedRequirements` component spec, by the AddressHistorySection's compute-and-pass-down responsibility, and by Risk #6
  5. Auto-save shape `aggregatedFields` alongside `entries` — covered by the `addressHistorySaveRequestSchema` Zod, by the save-route modification #3, and by the saved-data modification #4
  6. Hydration UUID-vs-string detection for state/county — covered by modification #15 (the existing `geoNameMap` lookup is wrapped with a UUID format check; non-UUID values are displayed as-is without warning)
  7. Default addressConfig fallback — listed explicitly in the spec's Data Requirements table; the `AddressBlockInput` component spec calls out applying this default when `addressConfig` is missing
  8. Minimum-one-entry rule for Address History — covered by `RepeatableEntryManager` modification #11 (`minimumEntries` prop) and `AddressHistorySection` passing `minimumEntries={1}`
  9. Dual-call pattern (lightweight subdivisions vs. one merged fields call) — covered by the `AddressHistorySection` "completed-address detection" responsibility and by the `fields/route.ts` modification #2 walking the ancestor chain server-side
  10. Document requirement display — name + instructions only — covered by `AggregatedRequirements` component spec and Risk #7

This plan is complete and ready for the test-writer (Pass 1) to proceed.
