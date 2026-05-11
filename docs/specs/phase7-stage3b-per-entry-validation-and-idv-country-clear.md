# Feature Specification: Phase 7 Stage 3b — Per-Entry Required-Field Validation + IDV Country-Switch Cleanup

**Spec file:** `docs/specs/phase7-stage3b-per-entry-validation-and-idv-country-clear.md`
**Date:** 2026-05-09
**Requested by:** Andy
**Status:** Confirmed

---

## Summary

Stage 3b is the correctness work that ships Phase 7. It bundles two unrelated tech debt items into a single shippable stage so they can be reviewed, tested, and released together. Both items affect the candidate's submission flow but they live in different files and they fix different classes of bug.

1. **TD-069 — Per-entry required-field validation for Address History, Education, and Employment.** Today the validation engine only checks entry count and date coverage for these multi-entry sections. It does not verify that the required fields *inside each entry* have values. A candidate can save entries with only dates filled in (or, for Address History, only `countryId` plus `fromDate`/`toDate`/`isCurrent` inside the address-block JSON) and the section validates green even though the required address detail, education detail, or employment detail fields are empty. Stage 3b adds a per-entry field-completeness walk to each of the three sections, and — critically — does that walk against *each entry's own country's* required-field rules, not against a single section-wide country.
2. **TD-072 — IDV stale per-country form-data cleanup on country switch.** Today, when a candidate fills in IDV fields for one country and then switches to a different country, the previous country's per-field values stay alive in the IDV section's form state. They get included in the next save's `pendingSaves` payload and end up persisted as if they belonged to the new country. The vendor receives values that don't belong to the selected jurisdiction. Stage 3b makes country-switch clear out the previous country's per-country IDV field data before the new country's fields begin populating.

Stage 3a (the mechanical refactor that pulled `loadValidationInputs.ts` and `savedEntryShape.ts` out of `validationEngine.ts`) is already merged. Stage 3b builds on that surface area: the per-entry walks live in or alongside `validationEngine.ts` and reuse the loader's `findMappings` adapter and `requirementMetadata` map; the IDV cleanup is local to `IdvSection.tsx` and does not touch the validation engine at all.

This is a **behavior change**, not a refactor. New tests will be added. The existing 4449 tests must continue to pass with zero net regression.

---

## Who Uses This

| Actor | What they do | What changes for them |
|---|---|---|
| Candidate | Fills in Address History / Education / Employment entries; selects an IDV country and types IDV fields; submits the application. | After Stage 3b, sections that have entries with empty required fields show as `incomplete` (red) instead of `complete` (green). The candidate sees `field required` errors per entry and cannot submit until each entry's required fields are filled. After Stage 3b, switching IDV country clears the previous country's field values from the form so the next save no longer carries them forward. |
| Vendor (downstream consumer of OrderData) | Receives the candidate's submitted answers as OrderData rows. | After Stage 3b, IDV OrderData rows for a candidate who switched country mid-flow contain only the values that belong to the *selected* country. Pre-Stage-3b, those rows could include orphaned values from a previously-selected country attached to the new country's OrderItem. |
| Engineers maintaining the validation engine | Read and extend the per-section validators. | After Stage 3b, the validators for Address History, Education, and Employment perform a per-entry required-field walk. The walk uses each entry's own country to resolve required-field rules — a new pattern that the architect's technical plan will document. |

This stage has **no admin-facing surface and no API contract change.** The `/validate` endpoint still returns the same `FullValidationResult` shape; the only behavioral difference is that `fieldErrors` for the three repeatable sections may now be non-empty, and the section `status` may now report `incomplete` where it previously reported `complete`.

---

## Business Rules

### TD-069 — Per-entry required-field validation

1. **Address History, Education, and Employment each validate required fields per entry.** For every saved entry, the engine resolves the set of DSX field requirements that apply to that entry, identifies which of those requirements are required, and emits one `FieldError` per required-but-empty field on that entry.
2. **Each entry is validated against its own country's rules, not the section's.** A section may contain entries from multiple countries (the candidate may have lived, studied, or worked in multiple countries). Required-field rules can vary per country. The engine must resolve the required-field set entry-by-entry, using the country saved on each entry, rather than picking one country and applying its rules to the whole section. Exactly *how* that per-entry country resolution is performed is an architect-level design decision (see "Deferred to the architect's technical plan" below).
3. **The `address_block` field is validated piece-by-piece, not as a single object.** Address History entries contain an `address_block`-typed saved field whose value is a JSON object with sub-fields (`street1`, `street2`, `city`, `state`, `county`, `postalCode`, plus the dates `fromDate` / `toDate` / `isCurrent` already used by date extraction). The engine must descend into the JSON value and verify that each piece marked required is non-empty, not merely verify that the JSON object exists. Exactly which pieces are marked required, and where that requirement metadata lives in `addressConfig`, is an architect-level design decision (see "Deferred to the architect's technical plan" below).
4. **An entry with no country is treated as `incomplete` for required-field purposes.** If an entry has been saved but its `countryId` is null, the entry cannot be validated against any country's rules. The engine must surface this as a field error on that entry (a missing-country error) rather than silently treating the entry as complete or silently skipping it.
5. **Empty values are detected the same way as in `personalInfoIdvFieldChecks.ts`.** A value is empty if it is `undefined`, `null`, the empty string `''`, or an empty array. Whitespace-only strings are not considered empty. For `address_block` pieces, "empty" applies to each piece individually after the JSON descent; an `address_block` whose JSON object exists but whose `street1` is `''` produces a field error for `street1`.
6. **Locked-field semantics do NOT apply to repeatable entries.** The locked-field shortcut (`firstName` / `lastName` / `email` / `phone` from invitation columns) is a Personal Info concern. Address History, Education, and Employment entries do not have locked-value overrides. If a required field on a repeatable entry is empty, it is reported as a field error regardless of any candidate-level locked value.
7. **The engine still runs scope validation, gap detection, and date extraction on the same sections.** TD-069 adds a new check; it does not remove any existing check. After Stage 3b, an entry can fail any combination of scope errors, gap errors, and per-entry field errors. The section's status is `incomplete` if any of those error arrays is non-empty (the existing `deriveStatusWithErrors` rule).
8. **Field errors are surfaced in the existing `fieldErrors` array on `SectionValidationResult`.** No new error category is introduced. The Review & Submit page and `SectionErrorBanner` already render `fieldErrors` for Personal Info / IDV; the same renderer handles Address History / Education / Employment field errors after Stage 3b.
9. **The per-entry walk uses the same `findMappings` adapter and the same `requirementMetadata` map already produced by `loadValidationInputs`.** No new database round-trip should be added on the per-entry hot path beyond what the architect determines is necessary to express per-country required-field rules. The expectation is that all required-field state can be derived from data already loaded by `loadValidationInputs` plus, at most, one additional `dsx_mappings` query keyed by the entry-country pairs.
10. **Status values stay lowercase.** All `ValidationStatus` outputs remain `'not_started'`, `'incomplete'`, or `'complete'` (project rule, restated for completeness — Stage 3b touches this surface).
11. **Error message keys stay in the existing `candidate.validation.*` translation namespace.** Per-entry field errors use the same `candidate.validation.fieldRequired` message key already used by Personal Info / IDV. A new key may be introduced only if a new distinguishing surface is required (e.g., a `candidate.validation.entryCountryRequired` for Rule 4); the architect decides whether a new key is warranted.

### TD-072 — IDV country-switch cleanup

12. **When the candidate changes the IDV country, the previous country's per-field values must be cleared from form state.** Specifically, every `formData[<requirementId>]` entry whose requirement is scoped to the previous country's DSX field set must be removed from `formData` before the new country's fields begin populating.
13. **The candidate's selected country itself is NOT cleared.** Switching country replaces the country value; it does not clear it. The synthetic `idv_country` save record is updated to the new country in the same save cycle (current behavior, preserved).
14. **The next save after a country switch must NOT carry forward the previous country's requirementIds in its `pendingSaves` payload.** After Stage 3b, if a candidate fills field A under country X, switches to country Y, and types into field B (which belongs to country Y), the save payload must contain only field B and the new `idv_country = Y` — not field A.
15. **Existing snapshot behavior is preserved when it does not conflict with Rule 12.** Today the IDV component stashes a snapshot of the previous country's field values under a synthetic `country_<previousCountryId>` key in `formData` before switching, and re-hydrates those values into the active form when the candidate returns to that country. Whether to keep, modify, or remove this snapshot behavior is an architect-level question — but the Rule-12 cleanup of the active per-requirement slots is non-negotiable and must happen regardless of the snapshot decision.
16. **The `locationId` on the resulting IDV `OrderItem` continues to match the candidate's currently-selected country.** This was already true pre-Stage 3b and is restated only to make explicit that Stage 3b does not change the IDV OrderItem generation contract — only the field-value payload that gets attached.
17. **Error handling and save-retry behavior are unchanged.** If a save fails after country switch, the existing retry logic re-attempts the save with the (cleaned) payload. No new error UI is introduced for country-switch cleanup.

### Cross-cutting

18. **Zero net regression on the existing test suite.** All 4449 tests that pass on the parent commit must still pass after Stage 3b. New tests are added on top; no existing test is deleted, skipped, or modified for the convenience of the implementation.
19. **No database schema changes, no migrations.** Stage 3b is application-layer only.
20. **No changes to the deliberate structural re-declaration pattern documented in TD-077.** `loadValidationInputs.ts` and `personalInfoIdvFieldChecks.ts` re-declare some shared shape types intentionally; this layering is preserved. Any new helper Stage 3b introduces follows the same pattern (re-declare structurally rather than creating a shared types module that crosses the layer boundary).

---

## User Flow

### TD-069 — Per-entry required-field validation

**Pre-Stage 3b (today):**
1. Candidate goes to Address History. Adds an entry. Sets country = United States. Fills in `fromDate` and `toDate`. Does NOT fill in street, city, state, postal code.
2. Candidate clicks Save (or the auto-save fires on blur). The entry persists with an `address_block` JSON object whose only populated keys are `fromDate`, `toDate`, `isCurrent`, and the country's `countryId`.
3. Candidate visits Review & Submit. The Address History sidebar indicator is **green**. The Review page shows zero errors for Address History.
4. Candidate clicks Submit. Submission succeeds. The vendor receives an OrderItem for the United States record service whose `address_block` field value contains no street, city, or state.

**Post-Stage 3b:**
1. Candidate does the same thing.
2. Same save behavior.
3. Candidate visits Review & Submit. The Address History sidebar indicator is **red**. The Address History `SectionErrorBanner` lists the required-but-empty fields per entry — for example, "Entry 1 (United States): Street, City, State, Postal Code are required." The Review page shows the same errors grouped under Address History.
4. Submit is blocked until every entry's required fields are filled. (Submit blocking on `summary.allComplete === false` already exists from Stage 1; Stage 3b just makes more sections honestly report `incomplete`.)
5. Candidate goes back to Address History, fills in the missing fields, returns to Review, and submits successfully.

The same flow applies to Education and Employment. For Education, a candidate who saved entries with only school name + start/end dates but left out a country-required `degreeAwarded` field would now be told that `degreeAwarded` is required for that entry's country. For Employment, a candidate who saved entries with only employer + dates but left out a country-required `jobTitle` would now be told that `jobTitle` is required for that entry's country.

### TD-072 — IDV country-switch cleanup

**Pre-Stage 3b (today):**
1. Candidate selects IDV country = United States. Fields for the US load. Candidate types `123-45-6789` into the SSN field. The save fires; `formData['<ssn-requirementId>'] = '123-45-6789'`.
2. Candidate changes IDV country to Canada. The IDV component stashes `formData` for the US under `formData['country_<us-countryId>']` and loads Canada's fields. `formData['<ssn-requirementId>']` IS NOT removed — it still holds `'123-45-6789'`.
3. Candidate types `12345` into Canada's SIN field. The save fires. `pendingSaves` contains `<sin-requirementId>` AND `<ssn-requirementId>` (because Step 2 did not clear it). The save endpoint persists both rows under the new country.
4. Candidate submits. The Canada IDV OrderItem has both `sin = '12345'` AND `ssn = '123-45-6789'` attached. The vendor receives a Canadian IDV order with a US SSN value.

**Post-Stage 3b:**
1. Same as today.
2. Candidate changes IDV country to Canada. The component clears `formData['<ssn-requirementId>']` (and every other `formData['<requirementId>']` belonging to US-scoped requirements) before loading Canada's fields. The snapshot under `country_<us-countryId>` is preserved (or handled per the architect's plan) so returning to the US restores the US values.
3. Candidate types `12345` into Canada's SIN field. The save fires. `pendingSaves` contains only `<sin-requirementId>` and `idv_country` (no orphaned US requirementIds).
4. Candidate submits. The Canada IDV OrderItem contains only Canadian field values. The vendor receives a clean Canada IDV order.

---

## Data Requirements

Stage 3b does not introduce any new UI fields, new database columns, or new API request/response fields. The existing data shapes are unchanged:

- `SavedRepeatableEntry` (already declared in `savedEntryShape.ts`) — `entryId`, `countryId`, `entryOrder`, `fields[]`. No change.
- `SavedFieldRecord` — `requirementId`, `value`. No change.
- `SectionValidationResult` (already declared in `types.ts`) — `sectionId`, `status`, `fieldErrors[]`, `scopeErrors[]`, `gapErrors[]`, `documentErrors[]`. No change. Stage 3b populates `fieldErrors` for the three repeatable sections where today it is always empty.
- `FieldError` — `fieldName`, `messageKey`, `placeholders?`. No change.
- `RequiredFieldDescriptor` (declared in `personalInfoIdvFieldChecks.ts`) — `requirementId`, `fieldKey`, `fieldName`, `isRequired`. No change. The architect decides whether to reuse this shape for the per-entry walk or introduce a parallel descriptor; either is acceptable.
- `DsxMappingRow` / `FindDsxMappings` (declared in `personalInfoIdvFieldChecks.ts`, produced by `loadValidationInputs`) — `requirementId`, `serviceId`, `locationId`, `isRequired`. No change. The architect decides whether the per-entry walk uses the existing adapter as-is or extends its query shape.

The only data-shape consideration that *is* a Stage 3b business question is the **shape of the per-piece required-field rules inside `addressConfig`**, which determines what the engine consults when validating each piece of an `address_block`. That shape is explicitly deferred to the architect's technical plan (see below).

**Per project rule:** all `fieldKey` values are immutable camelCase identifiers and are never changed by Stage 3b.

**Per project rule:** all status values are lowercase strings (`'not_started'`, `'incomplete'`, `'complete'`).

---

## Edge Cases and Error Scenarios

### TD-069

1. **Section has no saved entries.** Existing scope-error behavior already covers this (count or time-based scope produces the appropriate error). Stage 3b adds nothing — no entries means no per-entry walk. The section's status falls out of the existing `deriveStatusWithErrors` logic.
2. **Section has entries but the candidate has not visited the section.** Existing visit-tracking rules already resolve to `not_started` until the candidate visits AND departs. Stage 3b's per-entry field errors are computed but the section status is not flipped to `incomplete` until visit semantics allow it. This matches Personal Info / IDV behavior from Stage 1.
3. **Entry has a country that no longer exists in the database** (the country was disabled / deleted between saves). The architect's plan must specify the resolution. Two acceptable behaviors: (a) treat as if the entry's country is null and emit the missing-country field error from Rule 4; (b) treat as if no required-field rules apply and emit no field errors for that entry. The architect picks one and documents the choice. The wrong behavior is to throw — the validate endpoint must always succeed.
4. **DSX mapping rows do not exist for the entry's `(serviceId, countryId)` pair.** No required fields apply for that pair. The entry passes the per-entry walk for that service. (Same behavior as `aggregateIsRequired` already documents for Personal Info: empty mapping group → not required.)
5. **An entry has an `address_block` field whose JSON value is `null` or `undefined`.** The `address_block` requirement itself is empty; the engine emits a field error for the address_block requirement (Rule 5). The per-piece walk does not apply because there is no JSON object to descend into.
6. **An entry has an `address_block` field whose JSON value is malformed** (e.g., a string instead of an object, or an object missing all expected keys). The engine treats this the same as `null` for validation purposes — the entire `address_block` requirement reports as empty. The architect chooses whether to log a warning.
7. **The candidate's package contains a service that does not have any field-type requirements at all.** No required fields apply for entries served only by that service. The per-entry walk produces no field errors. The section's other checks (scope, gap) still run.
8. **Performance:** a candidate with many entries spanning many countries.** The per-entry walk must not regress validation latency materially. Per-entry resolution must batch DSX mapping queries into a single query that covers every distinct entry-country pair; per-entry queries are not acceptable. The architect's plan specifies the batched query shape and any caching across entries that share a country. The existing `/validate` endpoint test suite must show no new timeouts and the test suite must run in roughly the same wall-clock time.
9. **`runValidation` is called server-side from the submit endpoint** (Stage 2 wired it in). After Stage 3b, that call must continue to return correct `fieldErrors` for the three repeatable sections — submission must respect Rule 18 of Stage 1 (`summary.allComplete === false` blocks submission) using the new field errors.
10. **TypeScript compile.** `pnpm typecheck` must remain green. No new `any`. No new unsafe casts.

### TD-072

11. **Candidate switches IDV country before any field has been filled.** No previous-country requirementIds exist in `formData`; the cleanup is a no-op. Behavior is correct.
12. **Candidate switches IDV country, then immediately switches back to the original country before saving.** With Stage 3b's cleanup, the active per-requirement slots are cleared on the first switch. The architect's plan specifies whether the snapshot under `country_<originalCountryId>` is consulted to re-hydrate, or whether the candidate has to re-type the values. Either is acceptable; the architect documents the choice.
13. **Candidate switches IDV country while a save is in flight.** The component must not reorder the cleanup with respect to the in-flight save's payload. The architect's plan addresses this — typically by performing the cleanup after the in-flight save completes, or by including the cleanup in the same render that triggers the new save.
14. **`fields` for the new country fail to load** (network / API error). The cleanup of the previous country's slots still runs. The component handles the load failure as it does today (sets fields to empty, logs the error). The form is left in a consistent state — no orphaned previous-country values, no new-country values yet.
15. **Save fails after country switch.** The retry logic re-runs with the cleaned payload. No previous-country requirementIds reappear.
16. **Submit fires while the country has just been switched and the new save has not yet flushed.** Existing submit-time validation behavior governs whether submission proceeds. No new behavior added by Stage 3b.

---

## Impact on Other Modules

| Module | Impact |
|---|---|
| `src/lib/candidate/validation/validationEngine.ts` | Per-entry field-completeness walks are wired into `validateAddressHistorySection`, `validateEducationSection`, and `validateEmploymentSection`. The architect decides whether the walks live inline in these helpers or in a new sibling module analogous to `personalInfoIdvFieldChecks.ts`. |
| `src/lib/candidate/validation/loadValidationInputs.ts` | May be extended to load additional DSX state needed for per-country required-field resolution (architect's call). The discriminated-union return shape may grow. |
| `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` | Unchanged in behavior. May be referenced by the new walk for shared helpers (`aggregateIsRequired`, `checkRequiredFields`, `RequiredFieldDescriptor`). |
| `src/lib/candidate/validation/savedEntryShape.ts` | Unchanged. The existing `flattenEntry` and `inferAddressBlockRequirementId` helpers remain authoritative. |
| `src/components/candidate/form-engine/IdvSection.tsx` | The country-change handler is updated to clear active per-requirement slots before stashing/loading. Lines 263–286 (the current `handleCountryChange` callback) are the primary edit site. The save effect at lines 302–371 should require no change beyond what falls out of the cleaner `formData`. |
| `src/components/candidate/SectionErrorBanner.tsx`, `src/components/candidate/review-submit/ReviewErrorListItem.tsx` | No change. They already render `fieldErrors`; they will simply have more to render after Stage 3b. |
| `src/app/api/candidate/application/[token]/validate/route.ts`, `src/app/api/candidate/application/[token]/submit/route.ts` | No change. They consume `runValidation`'s return value, which keeps its shape. |
| `src/lib/candidate/submission/submitApplication.ts` | No change. Submission already runs validation and rejects when `allComplete` is false. |
| Database schema | No change. No migration. |

---

## Definition of Done

### TD-069

1. New regression tests prove that an Address History entry with a saved `address_block` containing only `countryId` + `fromDate` + `toDate` + `isCurrent` (no street / city / state / postalCode) makes the section's status become `incomplete` and produces one `FieldError` per required-but-empty piece.
2. New regression tests prove that an Education entry with a saved school name and dates but missing a country-required additional field (e.g., `degreeAwarded` when that requirement's `dsx_mappings` are `isRequired = true` for the entry's country) makes the section's status `incomplete` with a `FieldError` for the missing field.
3. New regression tests prove that an Employment entry with a saved employer name and dates but missing a country-required additional field (e.g., `jobTitle` under the same conditions) makes the section's status `incomplete` with a `FieldError` for the missing field.
4. New regression tests prove that **two entries in the same section, with different countries**, are validated against their *respective* country's required-field rules. An entry from country A with country-A's required fields filled passes; a sibling entry from country B with country-A's required fields filled but country-B's required fields empty fails — and only the country-B entry's missing fields appear in `fieldErrors`.
5. New regression tests prove that an entry with `countryId === null` produces a missing-country `FieldError` and the section status is `incomplete`.
6. New regression tests prove that the per-entry walk does NOT produce a false positive when a section has zero entries (existing scope errors still fire; per-entry walk fires zero field errors).
7. New regression tests prove that the per-entry walk does NOT regress Personal Info or IDV — those paths still operate via `personalInfoIdvFieldChecks.ts` and produce identical errors before and after Stage 3b.
8. The existing test for "Address History with valid entries reports `complete`" still passes — the new walk does not flag a correctly-filled section as incomplete.
9. The existing test for date-coverage scope errors still fires when the candidate has insufficient time coverage.
10. The existing test for gap-detection still fires when the candidate has gaps exceeding tolerance.

### TD-072

11. New regression test in `IdvSection.test.tsx` (or its equivalent location) proves that switching country from X to Y removes the X-scoped `formData[<requirementId>]` entries from form state.
12. New regression test proves that the next save after a country switch sends a `pendingSaves` payload that does NOT include any X-scoped requirementIds.
13. New regression test proves that the `idv_country` save record is updated to Y in the same save cycle (existing behavior preserved).
14. Manual smoke-test path documented in the implementer's checkpoint: open the candidate portal, select country X, fill in a country-X-only IDV field, switch to country Y, type a country-Y-only field, save, inspect the saved `formData` (via the `/saved-data` endpoint or DB query) and confirm no country-X requirementIds are present under the IDV section.

### Cross-cutting

15. `pnpm vitest run` finishes with **all 4449 existing tests passing** plus the new regression tests added by Stage 3b. Raw bash output of test counts is captured in the implementer's checkpoint. No existing test is deleted, skipped, or modified for the convenience of the new code.
16. `pnpm typecheck` is green. No new `any`. No new unsafe casts beyond what the architect's plan documents and accepts.
17. `pnpm lint` returns no new errors relative to the parent commit.
18. `pnpm build` succeeds.
19. CODING_STANDARDS Section 9 file-size rules are respected. If the per-entry walk lives inline in `validationEngine.ts`, the engine must not cross the 600-line hard stop. If it would, the architect splits the walk into a sibling module (analogous to `personalInfoIdvFieldChecks.ts`) and the new module follows the same TD-077 structural-re-declaration pattern.
20. The existing `logger.warn` and `logger.error` events in the validation engine and `IdvSection.tsx` are preserved with the same event names. Any new log emission added by Stage 3b uses an event name in the existing `candidate_validation_*` / `idv_*` namespace.
21. No PII is logged. Per-entry walks must not log saved field values; logs may include `requirementId`, `entryId`, `entryOrder`, and `countryId`.
22. The branch is named `feature/phase7-stage3b-per-entry-validation-and-idv-country-clear` (or the project's standard equivalent) and is ready for PR review with a green CI run.

---

## Deferred to the Architect's Technical Plan (NOT Decided in This Spec)

The Business Analyst is explicitly NOT pre-deciding the following two design questions. The architect's technical plan resolves them and their resolutions are the contract that the test-writer and implementer follow.

1. **The exact shape of per-country required-field rules inside `addressConfig` (or wherever the rules live).** The spec says "each piece marked required is non-empty" without specifying what "marked required" looks like in stored data. The architect inspects the existing `DSXRequirement.fieldData` and any related JSON payloads, decides where the per-country / per-piece required-field metadata lives, and documents the shape and resolution path in the technical plan. If the metadata does not exist today and a small data-model addition is unavoidable, the architect names that addition explicitly so Andy can review before implementation begins.
2. **How per-entry country resolution works when aggregating required fields across multiple entries in a section.** The spec says "each entry is validated against its own country's rules" without specifying the exact shape of the single batched query that covers every distinct entry-country pair, how it caches results across entries that share a country, or how it composes per-piece rules inside `address_block` with per-requirement rules from `dsx_mappings`. The architect's technical plan specifies the resolution mechanism, names every helper function added, and shows the data flow from `loadValidationInputs` through the per-section validators down to the per-entry walk. Per-entry queries (one round-trip per entry) are not an acceptable resolution mechanism — see Business Rule 9 and Edge Case 8.

The architect may also add new internal helpers, new types, or new sibling modules so long as those additions respect every business rule above (especially Rules 18, 19, and 20). The architect must NOT relax any business rule without flagging it back to Andy first.

---

## Out of Scope for Stage 3b

To keep Stage 3b shippable, the following are explicitly NOT in scope. Items that surface as pre-existing issues during Stage 3b reading or implementation must NOT be folded into this stage. They are either already tracked or should be filed as new TD entries by whoever discovers them:

- **The form-rendering gap in `AddressHistorySection.tsx`** where address detail inputs (street, city, state, postalCode) sometimes do not appear even when the candidate has saved an entry with country and dates. TD-069's description explicitly carves this out as a separate UI gate problem (`AddressHistorySection.tsx:479` only renders `<AddressBlockInput>` when both `entry.countryId` and a DSX `address_block`-typed field are resolved). Stage 3b does not fix the rendering problem; if the candidate cannot see the inputs, they cannot fill them, but that is a different bug needing its own repro and fix.
- **Locale-aware date formatting** in gap and scope error messages (TD-063). Out of scope.
- **i18n cleanup for hardcoded English `scopeDescription` strings** in the scope and structure endpoints (TD-057, TD-066). Out of scope.
- **Locale-dependent date-extractor field identification** (TD-073). Stage 3b's per-entry walk runs alongside the date extractor but does not fix the extractor's locale fragility. Out of scope.
- **The dead `OrderStatusProgressionService`** (TD-027). Out of scope.
- **`portal-layout.tsx` size hard-stop** (TD-067). Stage 3b should not add new orchestration to `portal-layout.tsx`. If it would, the architect must flag this back to Andy before proceeding.
- **`OrderCoreService.addOrderItem` deviation in `submitApplication.ts`** (TD-074). Stage 3b does not touch the submission orchestrator's transaction shape.
- **Per-row inline `FieldErrorMessage` rendering inside repeatable entries** (TD-061). Stage 3b's new field errors will appear in the section banner and on the Review page, NOT inline next to each field within each row. Inline rendering remains TD-061's scope.
- **Per-entry required-field validation for any section beyond Address History, Education, and Employment.** Stage 3b touches exactly those three sections.
- **Cross-section requirement awareness for the new per-entry walks** (the inverse of TD-052). Stage 3b's walk evaluates each entry against its own country's rules and does NOT propagate those required-field decisions back up to Personal Info or to the cross-section registry.
- **The structural re-declaration pattern itself** (TD-077). Stage 3b respects the pattern; it does not reorganize the validation directory's type-sharing approach.
- **Any new test of pre-existing behavior** that was already covered by the 4449 existing tests. Stage 3b's new tests are scoped to the new behaviors documented here.

If during Stage 3b implementation a new pre-existing issue is discovered, the discoverer logs a new TD entry in `docs/TECH_DEBT.md` (incrementing past TD-077) and does NOT fix it in this branch.

---

## Deployment Impact

This is the intended behavior; the prior green state was incorrect. Once Stage 3b ships, existing in-flight candidates whose sparse saved entries previously validated as `complete` will see those sections flip to `incomplete` and will be blocked from submitting until they fill in the required fields they had previously skipped. Candidates affected by the `AddressHistorySection.tsx` rendering bug (carved out under "Out of Scope" above) will be blocked until that rendering bug is addressed in its own work item, because they cannot see the inputs they now need to fill. Communication to in-flight candidates, the rendering-bug fix, and any data migration or backfill are tracked separately and are not Stage 3b's responsibility.

---

## Open Questions

None remaining for the Business Analyst. The two design questions called out under "Deferred to the Architect's Technical Plan" are deliberately not Business-Analyst questions — they are architect questions, and the architect resolves them in the next stage. If the architect's reading uncovers a question that *is* a business question (e.g., "what should happen when a saved entry's country was disabled?"), the architect must surface it back to Andy via the architect's plan rather than assuming a behavior.
