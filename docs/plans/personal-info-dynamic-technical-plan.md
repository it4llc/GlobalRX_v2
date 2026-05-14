# Technical Plan: Personal Info — 100% Dynamic

**Based on specification:** `docs/specs/personal-info-dynamic.md` (May 14, 2026)
**Date:** May 14, 2026

---

## Overview (plain-English summary)

The Personal Info section today renders both the three locked invitation fields (firstName, lastName, email, phone/phoneNumber) and any dynamic DSX requirements (e.g. middleName, dateOfBirth, mother's maiden name, national ID). After Task 8.1, those three locked fields are now shown to the candidate on the Welcome page using template variables, so showing them again on Personal Info is redundant.

This task makes Personal Info purely driven by the cross-section subject-targeted field registry. The locked, invitation-derived fields are removed from rendering AND from validation, while their underlying database values (on `CandidateInvitation` columns) are left untouched. The "empty state" message is reused for the case where there are zero dynamic fields and zero subject-targeted cross-section requirements.

There are NO database changes. The change is split across three layers:

1. **API layer** — `/personal-info-fields` filters out the four locked fieldKeys (`firstName`, `lastName`, `email`, `phone`, `phoneNumber`) so they never reach the section component.
2. **Validation layer** — `collectPersonalInfoFieldRequirements` in `personalInfoIdvFieldChecks.ts` excludes the same fieldKey set so the validator no longer expects them and Review & Submit no longer flags them.
3. **UI layer** — `PersonalInfoSection.tsx` already renders whatever fields it is given. With (1) in place the locked fields disappear from the UI naturally. The empty-state branch already exists and just needs its translation text refined to match the spec wording ("No additional information is required.").

Previously saved dynamic field data for fields that are no longer required (because the candidate changed country selections) is preserved in `formData.sections.personal_info.fields` — no migration or deletion is performed. The existing `formData` storage is keyed by `requirementId`, so removed/no-longer-applicable fields keep their values in the database silently.

---

## Database Changes

**None.** Per spec Data Requirements ("No new data fields are stored. No database changes."), this task only changes API filtering, validation collection, the UI's rendered field set, and one translation string per language.

No new Prisma models. No new fields on existing models. No new indexes or constraints. No migration.

---

## New Files to Create

**None.** This task only modifies existing files.

---

## Existing Files to Modify

### 1. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/personal-info-fields/route.ts`

**Was this file read before listing it here?** Yes — full file read.

**What currently exists:**
- Step 6 (lines 130–160) iterates `serviceRequirements`, applies the `isPersonalInfoField` check (collectionTab heuristic OR known fieldKey in a whitelist that INCLUDES `firstName`, `lastName`, `middleName`, `email`, `phone`, `phoneNumber`, `dateOfBirth`, `birthDate`, `dob`, `ssn`, `socialSecurityNumber`), and deduplicates into `personalInfoFields` Map keyed by requirement id.
- Step 7 (lines 250–299) builds the response by mapping each requirement, computing `locked`/`prefilledValue` from a `switch (fieldKey)` block that handles `firstName`, `lastName`, `email`, `phone`, `phoneNumber`.

**What needs to change and why:**

Add a new constant `LOCKED_INVITATION_FIELD_KEYS = new Set(['firstName', 'lastName', 'email', 'phone', 'phoneNumber'])` at module scope (above the GET handler) with a code comment explaining: these fieldKeys are sourced from the invitation columns and shown on the Welcome page (Task 8.1), so per spec Business Rule 1 they are not rendered on Personal Info.

In Step 6, after the existing `isPersonalInfoField` check passes and before the dedupe insertion into the `personalInfoFields` Map, add a guard:

```
if (LOCKED_INVITATION_FIELD_KEYS.has(serviceReq.requirement.fieldKey)) continue;
```

This is a fast O(1) reject so the locked fields are dropped before they enter the response.

In Step 7, the `switch (fieldKey)` block that sets `locked = true` and `prefilledValue` is now dead code (no field with those fieldKeys can reach it). DELETE the switch block entirely. The response builder simplifies to always setting `locked = false` and `prefilledValue = null`. The two response fields (`locked`, `prefilledValue`) remain on the response shape — they are still consumed by the section's existing hydration code path for non-locked cases — but they are now structurally always false/null because no locked dynamic field exists in the new design.

Update the JSDoc block at the top (lines 11–50):
- Remove the bullet that describes `locked: boolean` and `prefilledValue: string | null` (since neither is ever true/non-null any more). Or, equivalently, leave them in the response shape and re-document them as "always false / always null in Task 8.3+ — retained for backward compatibility with the existing section hydration path; locked invitation fields are surfaced via the Welcome page (Task 8.1) and are no longer rendered on Personal Info per Task 8.3 spec Rule 1." The plan recommends the latter — keep the response shape stable to avoid forcing PersonalInfoSection to stop passing the props.

Add a short comment above `LOCKED_INVITATION_FIELD_KEYS` explaining why those specific fieldKeys are excluded and pointing to the spec.

This file is currently 309 lines; the changes net out to roughly the same total (delete switch ~25 lines, add constant + guard ~10 lines, update JSDoc).

---

### 2. `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`

**Was this file read before listing it here?** Yes — full file read.

**What currently exists:**
- `PERSONAL_INFO_FIELD_KEYS` constant (lines 106–118) — used by `isPersonalInfoField` to classify a requirement as belonging to the personal info tab when its `fieldKey` matches one of: `firstName`, `lastName`, `middleName`, `email`, `phone`, `phoneNumber`, `dateOfBirth`, `birthDate`, `dob`, `ssn`, `socialSecurityNumber`.
- `collectPersonalInfoFieldRequirements` (lines 211–282) — walks the package's services, filters with `isPersonalInfoField`, and deduplicates by requirement id.
- `validatePersonalInfoSection` (lines 503–530) — calls `checkRequiredFields` with the collected requirement list plus the locked-value map. Today, locked fieldKeys whose locked value is non-empty are explicitly skipped by `checkRequiredFields` (the locked-value guard at lines 455–460).

**What needs to change and why:**

Add a new constant immediately above `collectPersonalInfoFieldRequirements`:

```
// Task 8.3 — these fieldKeys are sourced from the invitation columns (and
// shown on the Welcome page per Task 8.1). Per spec Rule 6, Personal Info
// validation must not expect or check for these fields any more; they are
// excluded from the requirement walk so Review & Submit cannot flag them
// as missing.
const LOCKED_INVITATION_FIELD_KEYS = new Set([
  'firstName',
  'lastName',
  'email',
  'phone',
  'phoneNumber',
]);
```

In `collectPersonalInfoFieldRequirements`, inside the Step 1 loop, after the `isPersonalInfoField(req.fieldKey, fieldData)` check passes and BEFORE inserting into the `candidates` Map, add:

```
if (LOCKED_INVITATION_FIELD_KEYS.has(req.fieldKey)) continue;
```

`validatePersonalInfoSection` does NOT need to change directly — once the collector drops the locked fields, the validator's `checkRequiredFields` loop has nothing to check for them.

Optional defensive cleanup: in `checkRequiredFields` (lines 437–471) the `lockedValues` parameter is currently used to skip locked fields when they have a non-empty value. After this change, `lockedValues` is never populated with the static-field keys (because the collector dropped them), so the locked-value guard is dead code in this code path. The plan recommends LEAVING the guard in place — it is defense-in-depth for any future regression that re-introduces those fieldKeys to the collector.

Update the header docstring (lines 1–32) to note that as of Task 8.3, the personal-info collector excludes the four locked invitation fieldKeys; cross-link to the spec.

The `PERSONAL_INFO_FIELD_KEYS` set is NOT changed. It is still used by `isPersonalInfoField`, which is also called by `collectIdvFieldRequirements` (line 376) to exclude personal-info-claimed requirements from IDV. Removing keys from that set would break IDV's exclusion logic — which is unrelated to this task. The right surgical change is to add a SECOND filter (`LOCKED_INVITATION_FIELD_KEYS`) that only `collectPersonalInfoFieldRequirements` applies.

This file is currently 639 lines (over the 600-line soft trigger). The changes here are additive (one ~7-line constant block + one ~1-line guard + one docstring update). Per CODING_STANDARDS Section 9.4, splitting a file reactively in the middle of unrelated work is not the right call; the existing tech debt around this file's size stands.

---

### 3. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx`

**Was this file read before listing it here?** Yes — full file read.

**What currently exists:**
- The component receives `fields: PersonalInfoField[]` and renders all of them in `displayOrder` order. Locked fields are rendered through `DynamicFieldRenderer` with `locked={field.locked}` and the prefilled value already merged into `formData` by the hydration effect.
- The empty-state branch (lines 313–323) renders when `fields.length === 0`. It currently shows the `CrossSectionRequirementBanner` (because subject-targeted cross-section entries might still apply even when no local fields exist) plus the translation key `candidate.portal.personalInfo.noFieldsRequired`.
- The instructions block (line 354–356) renders the `candidate.portal.personalInfo.instructions` key, which today reads "Please fill in your personal information below. Fields marked with a red asterisk (*) are required. Information from your invitation is already filled in and cannot be changed." That second sentence about "information from your invitation" is now obsolete (no locked fields are rendered any more).

**What needs to change and why:**

This file does NOT need any structural code changes — the API already filters locked fields out, so the existing render loop will only see dynamic fields. The only edits in this file are documentation:

1. Update the JSDoc block at lines 67–72 to reflect that Personal Info is now 100% driven by the cross-section registry plus the (non-locked) DSX field requirements. Note Task 8.3 / spec reference.
2. Add a short comment above the empty-state branch (around line 313) noting that the empty state now also covers the post-Task-8.3 case where the candidate's country selections do not require any subject-targeted fields (spec User Flow paragraph 3 / Edge Case 1).
3. Update the comment on the `handleFieldBlur` `field?.locked` short-circuit (lines 144–149) to note that as of Task 8.3 no field arrives with `locked=true` from the API, but the guard is retained for defense in depth.

Optionally remove the `LOCKED_FIELD_KEYS`-style preventive code paths that handle the locked case (the `locked` check in the hydration effect at line 126, the `field?.locked` early return in `handleFieldBlur`, the `locked={field.locked}` prop forwarded to `DynamicFieldRenderer`). The plan recommends KEEPING them — they are dead-but-harmless code paths that protect against API regressions. Removing them is a separate cleanup task. (This is consistent with CODING_STANDARDS Section 1.5 — Minimal Footprint.)

No new imports. No new state. No new effects. The file's line count is essentially unchanged.

---

### 4. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-US.json`

**Was this file read before listing it here?** Yes — full file read (existing keys verified via grep).

**What currently exists:**
- Line 632: `candidate.portal.personalInfo.loading` — kept.
- Line 633: `candidate.portal.personalInfo.noFieldsRequired` — current value `"No personal information fields are required for this application."`
- Line 635: `candidate.portal.personalInfo.instructions` — current value mentions "Information from your invitation is already filled in and cannot be changed."

**What needs to change and why:**
- Update `candidate.portal.personalInfo.noFieldsRequired` to: `"No additional information is required."` (matches spec Data Requirements table verbatim).
- Update `candidate.portal.personalInfo.instructions` to remove the sentence about "Information from your invitation is already filled in and cannot be changed." (no longer applicable). New value: `"Please fill in the information below. Fields marked with a red asterisk (*) are required."`

No new keys are added.

---

### 5. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-GB.json`

**Was this file read before listing it here?** Yes — checked via grep for the two keys.

**What needs to change and why:**
Same two updates as en-US.json:
- `candidate.portal.personalInfo.noFieldsRequired` → `"No additional information is required."`
- `candidate.portal.personalInfo.instructions` → `"Please fill in the information below. Fields marked with a red asterisk (*) are required."`

---

### 6. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/es-ES.json`

**Was this file read before listing it here?** Yes — checked via grep for the two keys.

**What needs to change and why:**
- `candidate.portal.personalInfo.noFieldsRequired` → `"No se requiere información adicional."`
- `candidate.portal.personalInfo.instructions` → `"Complete la información a continuación. Los campos marcados con un asterisco rojo (*) son obligatorios."`

---

### 7. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/es.json`

**Was this file read before listing it here?** Yes — checked via grep for the two keys.

**What needs to change and why:**
- `candidate.portal.personalInfo.noFieldsRequired` → `"No se requiere información adicional."`
- `candidate.portal.personalInfo.instructions` → `"Complete la información a continuación. Los campos marcados con un asterisco rojo (*) son obligatorios."`

---

### 8. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/ja-JP.json`

**Was this file read before listing it here?** Yes — checked via grep for the two keys.

**What needs to change and why:**
- `candidate.portal.personalInfo.noFieldsRequired` → `"追加の情報は必要ありません。"`
- `candidate.portal.personalInfo.instructions` → `"以下の情報をご記入ください。赤いアスタリスク（*）でマークされたフィールドは必須です。"`

---

### 9. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/personal-info-fields/__tests__/route.test.ts`

**Was this file read before listing it here?** Yes — partial read of fixtures and structure.

**What currently exists:** Test fixtures include `firstName`, `lastName`, `dateOfBirth`, and `idNumber` as service requirements; existing assertions verify that all four personal-info-tab fields are returned and the locked ones carry prefilled values.

**What needs to change and why:**
- Update or replace any test case that asserts `firstName`, `lastName`, `email`, `phone`, or `phoneNumber` are RETURNED by the route. After Task 8.3 these fieldKeys must be EXCLUDED. Existing assertions like "expects 3 dedup'd fields" need to drop the count by however many locked-fieldKey fixtures exist.
- Add a new test case: "returns no field for fieldKey `firstName` even when the requirement is mapped to a service" (positive proof of the new filter).
- Add a new test case for each of `lastName`, `email`, `phone`, `phoneNumber` — same shape, asserting exclusion.
- Add a new test case: "non-locked personal-info fields (e.g. `middleName`, `dateOfBirth`) are still returned" so we don't over-filter.
- Update any test that asserts `locked === true` or `prefilledValue !== null` on a returned field — those assertions should be deleted (no returned field can have either after this change).

The test-writer will make these changes. This plan only specifies the scope.

---

### 10. `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/__tests__/personalInfoIdvFieldChecks.test.ts`

**Was this file read before listing it here?** Yes — partial read of fixtures and helper structure.

**What currently exists:** Existing tests cover `collectIdvFieldRequirements` and the personal-info-exclusion behavior for IDV. There are no tests for `collectPersonalInfoFieldRequirements` directly in this file today (those are exercised through the validation engine integration tests).

**What needs to change and why:**
- Add a new `describe` block: `'collectPersonalInfoFieldRequirements — Task 8.3 locked-field exclusion'` with these cases:
  - Returns the `middleName` requirement when present (positive proof).
  - Returns the `dateOfBirth` requirement when present (positive proof).
  - Does NOT return the `firstName` requirement even when it has `collectionTab='subject'` and is mapped to a package service.
  - Does NOT return the `lastName` requirement under the same conditions.
  - Does NOT return the `email` requirement under the same conditions.
  - Does NOT return the `phone` requirement under the same conditions.
  - Does NOT return the `phoneNumber` requirement under the same conditions.

The existing IDV exclusion tests continue to pass unchanged (the `PERSONAL_INFO_FIELD_KEYS` set is unchanged).

The test-writer authors the actual cases.

---

### 11. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/__tests__/PersonalInfoSection.test.tsx`

**Was this file read before listing it here?** Yes — full file read.

**What currently exists:** The existing mock `mockFields` array includes locked fields with fieldKeys `firstName`, `lastName`, `email`, `phone`, plus dynamic `dateOfBirth` and `middleName`. Several tests assert that the locked fields are rendered with `readonly`/`disabled` attributes and that their prefill values display.

**What needs to change and why:**
- The TestWriter SHOULD update `mockFields` to remove the four locked-fieldKey entries (req-1 firstName, req-2 lastName, req-3 email, req-4 phone). After Task 8.3 these fields would not be passed to the component by the shell (because the API filters them out), so the test fixtures should match.
- Delete or rewrite the `'pre-filled and locked fields'` describe block (lines 216–249). The post-Task-8.3 contract is that the component does not render locked invitation fields, so testing readonly behavior on them is no longer meaningful. The locked-field guard in `handleFieldBlur` is still present as defense in depth, but it is no longer exercised in normal flow.
- Update remaining tests that rely on the `mockFields` length or specific indices (`mockFields[2]` etc. in the ordering test) to use the post-cleanup array.
- Add a new test case: "does not render any locked invitation field when none are passed in" — verifies the section renders only the dynamic fields.
- Add a new test case: "shows the empty-state translation key when fields=[] AND crossSectionRequirements=[]" (this case already exists; the new test should also verify the green-check status by checking `onProgressUpdate` is called with `'complete'`).

The test-writer authors the actual cases.

---

### 12. `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/__tests__/sectionProgress.test.ts` (or wherever `computePersonalInfoStatus` is unit-tested)

**Was this file read before listing it here?** Not in this pass. The test-writer must locate the existing unit tests for `computePersonalInfoStatus` (search via `grep -rn "computePersonalInfoStatus" src/lib/candidate/__tests__/`), confirm the empty-required-set → `'complete'` case is already covered (line 159 of `sectionProgress.ts` already returns `'complete'` when `requiredKeys.size === 0`), and add a new case if the existing coverage is missing the "no fields AND no cross-section requirements → complete" scenario.

If no test gap exists, no change is needed here. The plan notes this file as a known check-point rather than a confirmed modification.

---

## API Routes

### Modified — `/api/candidate/application/[token]/personal-info-fields` (GET)

- **Path:** `/api/candidate/application/[token]/personal-info-fields`
- **HTTP method:** GET
- **Authentication:** Existing — valid candidate session whose `token` matches the URL token (401/403 ladder unchanged).
- **Input data and validation rules:** None changed. Path param `token` continues to be a string.
- **What it returns on success:** Unchanged response shape `{ fields: PersonalInfoField[] }`. The returned `fields` array no longer contains any item whose `fieldKey` is in the locked set (`firstName`, `lastName`, `email`, `phone`, `phoneNumber`). Every returned item has `locked === false` and `prefilledValue === null`.
- **What errors it should handle:** Unchanged — 401, 403, 404, 410, 500.

### No new API routes

All other candidate-portal routes (`/save`, `/saved-data`, `/structure`, `/validate`, `/submit`) are unchanged. The save endpoint's locked-field filter (lines 432–510 of `save/route.ts`) is left in place; it is defense-in-depth that no longer triggers in normal flow because the field renderer never produces a save payload for the locked fieldKeys, but the filter is retained per CODING_STANDARDS Section 1.5 / Minimal Footprint.

---

## Zod Validation Schemas

**None new.** The save-route's `sectionType` enum (lines 36 of `save/route.ts`) already includes `personal_info` and does not need to change. No request body shapes are altered.

---

## TypeScript Types

**None new.** The existing `PersonalInfoField` interface in `/src/types/candidate-portal.ts` (line 155) keeps both `locked: boolean` and `prefilledValue: string | null` fields. After Task 8.3 the API always sets these to `false` / `null` respectively, but the interface shape is preserved for backward compatibility with the section's hydration code and with the PassThrough/non-locked branches.

---

## UI Components

### Modified — `PersonalInfoSection.tsx` (client component)

- **Full file path:** `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx`
- **Client component:** Yes (`'use client'` at the top).
- **What it renders:** The render output and structure are unchanged. After Task 8.3, the rendered field list is purely dynamic (subject-targeted DSX field requirements that are not in the locked-invitation set). The empty-state branch (lines 313–323) is the path taken when both `fields.length === 0` and the candidate's selections did not push any subject-targeted cross-section requirements; the existing `CrossSectionRequirementBanner` continues to render above the message in case there ARE cross-section entries.
- **Existing UI components used:** Unchanged — `DynamicFieldRenderer`, `AutoSaveIndicator`, `CrossSectionRequirementBanner`, `SectionErrorBanner`, `FieldErrorMessage`.
- **API routes called:** Unchanged — POST `/save`. (The `/personal-info-fields` and `/saved-data` fetches still happen in the shell, not the section, per TD-059.)

### No new UI components.

---

## Translation Keys

Two keys per language file. NO new keys are added — both already exist in all 5 language files. The value of each key is updated.

| Key | Updated value (en-US) | Where it is used |
|---|---|---|
| `candidate.portal.personalInfo.noFieldsRequired` | `No additional information is required.` | Empty-state branch of PersonalInfoSection (line 320) |
| `candidate.portal.personalInfo.instructions` | `Please fill in the information below. Fields marked with a red asterisk (*) are required.` | Section instructions block (line 355) |

Localized equivalents:

| Language | `noFieldsRequired` | `instructions` |
|---|---|---|
| en-US | `No additional information is required.` | `Please fill in the information below. Fields marked with a red asterisk (*) are required.` |
| en-GB | `No additional information is required.` | `Please fill in the information below. Fields marked with a red asterisk (*) are required.` |
| es-ES | `No se requiere información adicional.` | `Complete la información a continuación. Los campos marcados con un asterisco rojo (*) son obligatorios.` |
| es | `No se requiere información adicional.` | `Complete la información a continuación. Los campos marcados con un asterisco rojo (*) son obligatorios.` |
| ja-JP | `追加の情報は必要ありません。` | `以下の情報をご記入ください。赤いアスタリスク（*）でマークされたフィールドは必須です。` |

The `candidate.portal.personalInfo.loading` key is unchanged (still says "Loading personal information fields..." in en-US and equivalents).

---

## Order of Implementation

1. **Database schema changes.** None — skip.
2. **Prisma migration.** None — skip.
3. **TypeScript types.** None new — skip.
4. **Zod schemas.** None new — skip.
5. **API route changes.**
   - `personal-info-fields/route.ts`: add `LOCKED_INVITATION_FIELD_KEYS` constant + guard inside Step 6; delete the `switch (fieldKey)` block in Step 7; update JSDoc.
6. **Validation library changes.**
   - `personalInfoIdvFieldChecks.ts`: add `LOCKED_INVITATION_FIELD_KEYS` constant + guard inside `collectPersonalInfoFieldRequirements`; update file-level docstring.
7. **UI components.**
   - `PersonalInfoSection.tsx`: update JSDoc/comments only (no structural change).
8. **Translation keys.**
   - Update `noFieldsRequired` and `instructions` values in all 5 language files.
9. **Test updates.**
   - Update `personal-info-fields/__tests__/route.test.ts` per Section 9 above.
   - Update `validation/__tests__/personalInfoIdvFieldChecks.test.ts` per Section 10 above.
   - Update `form-engine/__tests__/PersonalInfoSection.test.tsx` per Section 11 above.
   - Optional: update `__tests__/sectionProgress.test.ts` per Section 12 above if a gap exists.

---

## Risks and Considerations

1. **Save-route locked-field filter is now defense-in-depth, not the primary protection.** The `/save` route's filter (lines 432–510) only triggers when the section POSTs a field with a locked fieldKey. After Task 8.3 the section never includes those fieldKeys in a save payload (because they are never rendered or auto-saved). The filter is retained for defense-in-depth — removing it is out of scope for this task. Note this in a code comment so a future cleaner does not strip it under the impression it's dead.

2. **`buildOrderSubject.ts` already hard-codes the locked-field invitation source.** Step 1 of `buildOrderSubject` writes `firstName`, `lastName`, `email`, and (when present) `phone` to `Order.subject` directly from invitation columns, independent of whether those fields exist in the saved `personal_info` bucket. This means Task 8.3 cannot accidentally drop those keys from `Order.subject` — they are always present at submission time. No change needed in `buildOrderSubject.ts`. The plan notes this so the implementer can confirm during smoke testing.

3. **Existing candidates with previously saved data in `formData.sections.personal_info.fields` for the locked fieldKeys.** No migration is required (per spec Rule 5). The section will no longer pass those `requirementId`s in the field defs, so they remain orphaned in `formData` but do not appear anywhere in the UI. `buildOrderSubject`'s defense-in-depth filter (lines 142–144) drops any saved field whose fieldKey matches the locked set, so submission is unaffected. Document this in the implementer's commit message.

4. **`PERSONAL_INFO_FIELD_KEYS` set in `personalInfoIdvFieldChecks.ts` is also used by IDV's exclusion logic.** The plan does NOT remove keys from that set — it adds a new, separate `LOCKED_INVITATION_FIELD_KEYS` set with overlapping but distinct purpose. If the implementer is tempted to consolidate, stop and consult Andy first — the IDV exclusion depends on the wider set including `middleName`, `dateOfBirth`, `ssn`, etc. which Task 8.3 must still render (only the locked-invitation subset is removed from Personal Info).

5. **`PersonalInfoSection.tsx` retains the `locked` and `prefilledValue` plumbing.** After Task 8.3 these are dead code paths in practice. The plan keeps them per CODING_STANDARDS Section 1.5 (Minimal Footprint). A separate cleanup task could strip them — open this as tech debt if the implementer feels strongly.

6. **Review & Submit shows section status, not field summaries.** The spec says "Review & Submit must stop showing name, email, and phone in its Personal Info summary." Inspection of `ReviewSectionBlock.tsx` confirms it never showed field-level summaries to begin with — it shows section status and a list of validation errors. With validation no longer expecting the locked fields, the errors list will not include them. No code change is needed in Review & Submit components themselves. The behavioral guarantee in Rule 7 is satisfied via the validation change.

7. **The empty-state translation key was originally written for "no fields configured" (no DSX requirements). Task 8.3 reuses it for "no fields AND no cross-section requirements".** The semantic stretch is small — both cases mean "candidate has nothing to fill in". The plan updates the English wording to the spec's verbiage and trusts the same key for both cases. If product wants distinct messaging for the two states later, that is a separate task.

8. **Task 8.5 dependency.** Per the spec's Impact on Other Modules section, Task 8.5 (Silent Recalculation) will skip Personal Info in navigation when it becomes empty. Task 8.3 must complete first; Task 8.5 is out of scope here.

9. **Mobile (320px minimum width).** No layout changes are introduced. The existing section already supports 320px (verified in TD-059 testing).

10. **No new translation keys, so no risk of missing language coverage.** All 5 existing files are touched in lockstep.

---

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above (route, validator, section, 5 translations, 3 test files; ~12 files total).
- [x] No file outside this plan will need to be modified. (Confirmed by tracing: shell `portal-layout.tsx` consumes the API output without locked-field branching specific to the static fieldKeys; `ReviewSubmitPage.tsx` consumes validation results without per-field knowledge; `buildOrderSubject.ts` is already correct for the new shape.)
- [x] All Zod schemas, types, and translation keys are listed. (None new for schemas/types; two existing translation keys updated in 5 language files.)
- [x] The plan is consistent with the spec's Data Requirements table. The translation key in the spec is shorthand `candidate.personalInfo.noFieldsRequired`; the actual project key is `candidate.portal.personalInfo.noFieldsRequired` (with the `portal.` prefix that all candidate-portal keys carry). The value updates to match the spec's verbatim text.

---

## Ready for the test-writer

This plan is ready for the test-writer to proceed. The test-writer should:
1. Read the spec and this plan.
2. Author failing tests for each of the test files listed in Sections 9, 10, 11, and (if applicable) 12.
3. Confirm test counts before and after.
4. Hand off to the implementer.

The implementer will then make the production changes listed in Sections 1–8 in the Order of Implementation, run the test suite, and verify zero regressions.
