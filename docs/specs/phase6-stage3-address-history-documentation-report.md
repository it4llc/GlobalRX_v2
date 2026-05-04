# Documentation Report: Phase 6 Stage 3 — Address History & Address Block Rendering

**Date:** 2026-05-04
**Branch:** feature/phase6-stage2-repeatable-entries
**Files Changed (from `git diff origin/dev...HEAD --name-only`):**

New production files:
- `src/app/api/candidate/application/[token]/subdivisions/route.ts`
- `src/components/candidate/form-engine/AddressBlockInput.tsx`
- `src/components/candidate/form-engine/AddressHistorySection.tsx`
- `src/components/candidate/form-engine/AggregatedRequirements.tsx`
- `src/components/candidate/form-engine/useEntryFieldsLoader.ts`
- `src/types/candidate-address.ts`

Modified production files:
- `src/app/api/candidate/application/[token]/fields/route.ts`
- `src/app/api/candidate/application/[token]/save/route.ts`
- `src/app/api/candidate/application/[token]/saved-data/route.ts`
- `src/app/api/candidate/application/[token]/scope/route.ts`
- `src/app/api/candidate/application/[token]/structure/route.ts`
- `src/components/candidate/form-engine/DynamicFieldRenderer.tsx`
- `src/components/candidate/form-engine/EducationSection.tsx`
- `src/components/candidate/form-engine/EmploymentSection.tsx`
- `src/components/candidate/form-engine/IdvSection.tsx`
- `src/components/candidate/form-engine/PersonalInfoSection.tsx`
- `src/components/candidate/form-engine/RepeatableEntryManager.tsx`
- `src/components/candidate/portal-layout.tsx`
- `src/lib/services/order-data-resolvers.ts`
- `src/translations/en-US.json`
- `src/types/candidate-portal.ts`
- `src/types/candidate-repeatable-form.ts`

Documentation files modified by prior pipeline agents (not this documentation pass):
- `docs/TECH_DEBT.md` (TD-051 through TD-058 added by implementer and standards-checker)
- `docs/specs/phase6-stage3-address-history-address-block-rendering.md` (spec — pre-existing)
- `docs/specs/phase6-stage3-address-history-address-block-rendering-technical-plan.md` (plan — pre-existing)

Test files in diff (not modified by this documentation pass):
- `src/app/api/candidate/application/[token]/fields/__tests__/route.test.ts`
- `src/app/api/candidate/application/[token]/save/__tests__/address-history.test.ts`
- `src/app/api/candidate/application/[token]/saved-data/__tests__/address-history.test.ts`
- `src/app/api/candidate/application/[token]/scope/__tests__/route.test.ts`
- `src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts`
- `src/app/api/candidate/application/[token]/subdivisions/__tests__/route.test.ts`
- `src/components/candidate/form-engine/__tests__/AddressBlockInput.test.tsx`
- `src/components/candidate/form-engine/__tests__/AddressHistorySection.test.tsx`
- `src/components/candidate/form-engine/__tests__/AggregatedRequirements.test.tsx`
- `src/components/candidate/form-engine/__tests__/DynamicFieldRenderer.test.tsx`
- `src/components/candidate/form-engine/__tests__/RepeatableEntryManager.test.tsx`
- `src/lib/services/__tests__/order-data-resolvers.test.ts`
- `src/schemas/__tests__/address-history-stage3.test.ts`
- `tests/e2e/candidate-address-history.spec.ts`

---

## What Was Built

Phase 6 Stage 3 delivered two tightly coupled features: the **Address History section** and the **address block field type rendered as a working form**. The address block rendering is reused across Education, Employment, and Address History.

### Address History Section

The candidate portal now includes an Address History section for packages containing record-type services (criminal, civil, bankruptcy, etc.). The section uses `RepeatableEntryManager` from Stage 2 and adds:

- A scope instruction message based on the package's configured scope (e.g., "Please provide all addresses where you have lived in the past 7 years")
- Country selection driving per-entry field loading from DSX
- `AddressBlockInput` with `showDates={true}`, providing From/To dates and a "Current address" checkbox embedded inside the address block value — dates are stored as part of the address block JSON, not as separate DSX requirements
- Enforcement of one-current-address-at-a-time across entries
- `minimumEntries={1}` so the remove button disappears on the last remaining entry
- Count-based scope capping via `maxEntries` (current-address scope caps at 1, last-X-addresses scope caps at X)
- An aggregated requirements area below the entries that deduplicates additional fields and document requirements across all entries, OR-merging `isRequired` across entries (most-restrictive wins per spec Business Rule #20)
- Personal Info field exclusion from the aggregated area (fields the candidate already provides on the Personal Info tab are deduplicated by DSX requirement UUID)

### Address Block Rendering

`AddressBlockInput` is a new reusable component that renders address pieces (street1, street2, city, state/province, county, postalCode) from the DSX `addressConfig`, with a safe default when none is configured. State and county render as dropdowns when the `countries` table has children for the parent; they fall back to free-text inputs when no subdivisions exist. The stored value is a UUID when chosen from a dropdown, or a plain string when typed free-form.

`DynamicFieldRenderer` previously rendered a grey placeholder for `address_block` fields. That placeholder is replaced with `AddressBlockInput`. All existing callers (EducationSection, EmploymentSection, IdvSection, PersonalInfoSection) now pass `countryId` and `token` through to the renderer so the embedded address block can load subdivisions.

### Subregion-Aware DSX Requirement Loading

The fields API now accepts an optional `subregionId` parameter. When provided, it walks the `countries.parentId` chain upward (country → subregion1 → subregion2 → subregion3), checks `dsx_availability` at each level (missing row defaults to available), and OR-merges `isRequired` across all applicable DSX mappings. The most-specific level wins for the requirement object and `displayOrder`. Stage 1 and Stage 2 callers that do not send `subregionId` are unaffected.

The `useEntryFieldsLoader` hook owns the orchestration of per-entry field loading on the client side. It uses a per-entry integer counter stored in a `useRef` to invalidate stale responses: each call to `loadFieldsForEntry` captures the counter at fire time and discards the response if the counter was bumped before the response arrived. This approach was chosen over fetch cancellation because the stale check needs to apply per-entry across multiple concurrent service calls in a single loop — a per-entry counter is simpler and correct in this pattern than maintaining AbortControllers per service.

### Geographic Subdivision Endpoint

A new `GET /api/candidate/application/[token]/subdivisions` endpoint returns the immediate children of a parent location row in the `countries` table, sorted alphabetically by name, filtered to non-disabled rows. An empty array is a valid response (country with no states in the database). `AddressBlockInput` uses this endpoint to populate state and county dropdowns.

### Order Details Hydration

`order-data-resolvers.ts` was updated to:

- Display address dates (From / To / "Present") stored nested inside the address block JSON for Address History entries. Education and Employment address blocks without date properties skip the date block entirely.
- Detect whether a `state` or `county` value is UUID-shaped before attempting the `geoNameMap` lookup. Free-text values (entered when no subdivisions exist for the country) are displayed as-is without logging a warning. UUID-shaped values that do not resolve through the map still log a warning, as before.

### Translation Keys

Twenty-seven new translation keys were added to `en-US.json` in the `candidate.addressHistory.*`, `candidate.addressBlock.*`, and `candidate.aggregatedRequirements.*` namespaces. These keys are absent from non-English locale files — see TD-058.

---

## Code Comments Added

No code comments were added by this documentation pass. The implementer added comprehensive inline comments throughout all files in the diff. All locations identified in the task brief as requiring WHY documentation already contained explanatory comments:

- `useEntryFieldsLoader` — counter-based stale invalidation: why counters not cancellation, and why the check runs inside the per-service loop
- `AddressBlockInput` — completion detection logic explaining what "complete" means for each geographic level and why the deepest UUID is selected as the most-specific subregion id
- `AddressHistorySection.computeAggregatedItems` — OR-merge `isRequired` rule explained with a reference to spec Business Rule #20
- `fields/route.ts` subregion ancestor walk — country-first ordering explained inline; ascending specificity ordering documented at the merge step
- `fields/route.ts` record-service filter — explains why service-level requirements are skipped for record services except address_block
- `order-data-resolvers.ts` UUID-vs-string detection — explains the two storage shapes and when each warning fires
- `scope/route.ts` record-default-to-current-address — explains the default selection reasoning

---

## Technical Documentation Updated

No technical documentation files were updated by this documentation pass.

### What was already covered by prior pipeline agents

`docs/TECH_DEBT.md` — TD-051 through TD-058 were added by the implementer and standards-checker agents during earlier pipeline stages. This documentation pass confirms those entries are present and accurate. No additional tech debt was identified.

---

## API Documentation

### New Endpoint

**Endpoint:** `GET /api/candidate/application/[token]/subdivisions`
**Documentation:** In-file JSDoc block at the top of `src/app/api/candidate/application/[token]/subdivisions/route.ts`

The JSDoc block documents purpose, authentication requirement, query parameters, response shape, and the full error matrix (401/403/400/404/410/500).

### Modified Endpoints

**`GET /api/candidate/application/[token]/fields`** — JSDoc updated to document the new optional `subregionId` parameter, the DSX availability behavior (missing row defaults to available), the cross-level merge logic (keyed by requirement id, `isRequired` OR-merged), and the new 400 error case for non-UUID `subregionId`.

**`POST /api/candidate/application/[token]/save`** — JSDoc updated to document the new `address_history` request shape (`sectionType`, `sectionId`, `entries`, `aggregatedFields`). The comment notes that document requirements have no entries in `aggregatedFields` for Stage 3, and that sending an empty `entries` array clears the section.

**`GET /api/candidate/application/[token]/saved-data`** — JSDoc updated to document the new `address_history` section response shape (`entries` plus `aggregatedFields`), and to note that the section is not auto-created on first load.

**`GET /api/candidate/application/[token]/scope`** — JSDoc updated to list `'record'` as a valid `functionalityType` value, document the address-history wording behavior, and note that degree-specific scope types fall back to `'all'` for record services.

---

## Key Architectural Decisions Documented in Code

1. **Dates stored inside the address block JSON, not as separate DSX requirements.** The spec established this intentionally — address history dates are always present for all packages, so configuring them in DataRx would be redundant. The `showDates` prop on `AddressBlockInput` is the switch; only `AddressHistorySection` passes `true`. Education and Employment sections do not pass it (defaults to `false`). Documented in `AddressBlockInput` props JSDoc and in the spec.

2. **useEntryFieldsLoader counter-based stale invalidation.** The counter pattern was chosen over `AbortController` because the stale check must apply per-entry across multiple concurrent service calls in the same loop. A shared `AbortController` per entry would abort all service calls when any one is invalidated, potentially discarding a valid response from a second service for an unchanged entry. Documented in the hook's JSDoc.

3. **Record-type services pull requirements exclusively from per-location `dsx_mappings`.** Unlike Education and Employment which use a service-level baseline for universal fields, criminal/civil/bankruptcy services have jurisdiction-specific requirements. The fields API filters service-level requirements for record services (allowing only `address_block` through, which every record service needs) and relies on per-location mappings for everything else. Documented inline in `fields/route.ts`.

4. **Free-text geographic values passed as `null` (not the string) to the fields API `subregionId` parameter.** When a country has no subdivisions, the candidate types a free-text value for state/county. Passing that string as `subregionId` would cause a 400 (it is not UUID-shaped). The client detects the free-text case and passes `null` so the API falls back to country-level requirements. Documented in `useEntryFieldsLoader` JSDoc.

5. **`minimumEntries` and `maxEntries` added to `RepeatableEntryManager`.** These were optional additions that default to behavior matching Stage 2 (Education and Employment), so existing callers are unaffected. Address History is the first consumer to use them.

6. **`aggregatedFields` stored at the section level, not per-entry.** The aggregated requirements area appears once below all entries and shows deduplicated requirements across the full history. Storing values per-entry would require the UI to pick one value when the same requirement was triggered by multiple entries, which adds complexity without benefit. Values are keyed by `dsx_requirements.id` (UUID).

---

## Known Gaps Deferred to Tech Debt

| TD    | Description                                                                                                  |
|-------|--------------------------------------------------------------------------------------------------------------|
| TD-051 | `save/route.ts` crossed the 500-line soft trigger during this stage. Split into schema file + per-section handler modules before Stage 4 adds further branches. |
| TD-052 | Cross-section requirement awareness for Personal Info — when Address History DSX mappings make a field required that Personal Info collects, Personal Info still shows it as optional. Phase 7 validation is the backstop. |
| TD-053 | Aggregated radio/checkbox fields don't auto-save until next blur — radio/checkbox onChange fires without a follow-up blur event. |
| TD-054 | `AddressHistorySection` has no UI-surface error state when the fields API fails — aggregated requirements area silently shows nothing. |
| TD-055 | `computeAggregatedItems` always returns `SERVICE_TYPE_ORDER_INDEX.record` for serviceTypeOrder because the DSX response does not include `functionalityType`. Works correctly today since Address History only loads record services. |
| TD-056 | UUID hydration warnings in `order-data-resolvers.ts` could become noisy in production if subdivisions are renamed/disabled after candidates save data. |
| TD-057 | Scope endpoint returns hardcoded English `scopeDescription` strings. Proper fix requires architectural change to the response shape. |
| TD-058 | 14 new Stage 3 translation keys exist only in `en-US.json`. Should be addressed as a batch with Stages 1 and 2 keys when non-English locales are needed. |

---

## Test Counts

**Pass 1 (schema/contract tests — written before implementation):**
52 tests passing (in `src/schemas/__tests__/address-history-stage3.test.ts`)
37 e2e scenarios deferred to Playwright (in `tests/e2e/candidate-address-history.spec.ts`)

**Pass 2 (component and route tests — written against the actual implementation):**
Test suite: 3,876 passing, 0 failing, 173 skipped (no regressions from baseline of 3,777 passing after Stage 3 implementation complete)

**Smoke-test fixes applied during Stage 4 (code review + rework pass):**

Critical #1 — Subregion-level requirement loading was not wired up in `AddressHistorySection`. The fix extracted field-loading orchestration to the new `useEntryFieldsLoader` hook (request-token-based stale invalidation) and added `onAddressComplete` to `AddressBlockInput`. `AddressHistorySection.tsx` net change: −36 lines (632 → 596).

Critical #2 — `renderAsterisk` in `AddressBlockInput` had a tautology (`isRequired || true` always evaluated to `true`). Fixed to `pieceRequired && isRequired` per spec COMPONENT_STANDARDS.md Section 3.3.

Warning #1 — `AggregatedRequirements` was reading `doc.instructions` for document line items. Fixed to read `doc.documentData?.instructions` first (per spec line 716), falling back to `doc.instructions`, then null.

---

## Suggestions (NOT applied — for project owner review)

**1. Request-counter stale-invalidation pattern may warrant a CODING_STANDARDS.md entry.**

`useEntryFieldsLoader` establishes a specific pattern for discarding stale async responses in React hooks: capture an integer counter at fetch fire time, bump the counter on invalidation, and discard the response if the counter changed before arrival. This is an alternative to AbortController that is simpler when you need per-entity counters across multiple concurrent fetches. The pattern appears in `useEntryFieldsLoader.ts`. If the project owner believes this pattern should be reusable guidance for future multi-entity loading hooks, a short section in `CODING_STANDARDS.md` would document it with a "when to use counters vs. cancellation" rationale.

**2. `AddressBlockInput`'s `showDates` flag pattern may warrant a COMPONENT_STANDARDS.md entry.**

The component renders in three distinct modes (Address History with dates, Education/Employment without dates, and via DynamicFieldRenderer which always passes `showDates=false`). The pattern of using a flag to express "context mode" rather than creating separate components was a deliberate architectural choice. If other components will face similar three-context rendering in Stage 4, a brief note in `COMPONENT_STANDARDS.md` about when to use context flags vs. separate components would be useful.

**3. DATA_DICTIONARY.md could document the `address_block` JSON value shape.**

The `AddressBlockValue` interface (`src/types/candidate-address.ts`) defines the JSON shape stored in `candidate_invitations.formData` and in `order_data` for address block fields. The `DATA_DICTIONARY.md` currently documents columns but not JSON sub-schemas for JSON-typed columns. If the project owner wants the data dictionary to cover this shape, an entry under the `CandidateInvitation.formData` column (or a dedicated "JSON Sub-Schemas" appendix) would be the right place for `AddressBlockValue` and `AddressHistorySectionSavedData`.

---

## Audit Relevance

No direct audit relevance. Phase 6 Stage 3 is a new feature delivery, not a bug fix or audit remediation.

---

## Documentation Gaps Identified

1. `docs/DATA_DICTIONARY.md` does not document the JSON sub-schemas for `candidate_invitations.formData` or `order_data`. The `AddressBlockValue`, `AddressHistoryEntry`, and `AddressHistorySectionSavedData` shapes introduced in this stage are defined in `src/types/candidate-address.ts` but have no equivalent entry in the data dictionary. This is consistent with how Stage 1 and Stage 2 JSON shapes were handled — the gap predates this stage.

2. The `countries` table's four-level geographic hierarchy (country → subregion1 → subregion2 → subregion3 via `parentId` self-relation) is not documented in `docs/DATA_DICTIONARY.md`. The `subdivisions` endpoint and the `fields/route.ts` subregion ancestor walk both depend on understanding this structure. The schema is documented in `prisma/schema.prisma` but not in the human-readable data dictionary.

---

## Stage Complete

Documentation pass complete for branch `feature/phase6-stage2-repeatable-entries`.
