# Feature: Personal Info — 100% Dynamic (Task 8.3)

**Date:** 2026-05-14
**Branch:** `task-8.3-personal-info-dynamic`
**Spec:** `docs/specs/personal-info-dynamic.md`
**Technical plan:** `docs/plans/personal-info-dynamic-technical-plan.md`

---

## What changed

The Personal Info section now renders only dynamic, subject-targeted DSX field requirements. The three invitation-derived fields — candidate name, email, and phone — are no longer shown on Personal Info. They are already shown on the Welcome page via template variables (Task 8.1) and their presence on Personal Info was redundant.

No database changes were made. Previously saved data for the removed field types is untouched.

---

## How it works

The change is applied at three layers:

**API layer — `GET /api/candidate/application/[token]/personal-info-fields`**

A new constant `LOCKED_INVITATION_FIELD_KEYS` (containing `firstName`, `lastName`, `email`, `phone`, `phoneNumber`) is checked inside the field-collection loop. Any requirement whose `fieldKey` is in that set is skipped before it enters the response. Every field the route now returns has `locked: false` and `prefilledValue: null`. The `switch (fieldKey)` block that previously set these values from invitation columns was removed.

**Validation layer — `collectPersonalInfoFieldRequirements` in `personalInfoIdvFieldChecks.ts`**

A matching `LOCKED_INVITATION_FIELD_KEYS` constant was added immediately before `collectPersonalInfoFieldRequirements`. The same five fieldKeys are skipped before they enter the requirement candidate map. The wider `PERSONAL_INFO_FIELD_KEYS` set used by `isPersonalInfoField` was left unchanged — it is also consumed by `collectIdvFieldRequirements` for a different purpose (IDV exclusion) and must not be narrowed by this task.

With the collector excluding the locked keys, the validator's `checkRequiredFields` loop can no longer flag them as missing. Review & Submit no longer shows them as incomplete.

**UI layer — `PersonalInfoSection.tsx`**

No structural changes. The component renders whatever is passed in the `fields` prop. Because the API no longer passes the locked fieldKeys, they never reach the component. The `locked`-guard in `handleFieldBlur` was kept as defense in depth and its comment was updated to explain the new context. The JSDoc block and the empty-state branch comment were updated to describe the Task 8.3 behavior.

---

## Empty state

When the candidate's country selections do not trigger any subject-targeted dynamic fields, `fields.length === 0` and the section renders the `candidate.portal.personalInfo.noFieldsRequired` message. The section is treated as complete in this state (the `computePersonalInfoStatus` helper returns `'complete'` when the required-key set is empty), so the sidebar shows a green check and the Next button is enabled.

---

## Translation key updates

Two existing translation keys were updated in all five language files. No new keys were added.

| Key | Previous value (en-US) | New value (en-US) |
|---|---|---|
| `candidate.portal.personalInfo.noFieldsRequired` | "No personal information fields are required for this application." | "No additional information is required." |
| `candidate.portal.personalInfo.instructions` | "Please fill in your personal information below. Fields marked with a red asterisk (*) are required. Information from your invitation is already filled in and cannot be changed." | "Please fill in the information below. Fields marked with a red asterisk (*) are required." |

Languages updated: `en-US`, `en-GB`, `es-ES`, `es`, `ja-JP`.

---

## Data preservation

Saved `formData` values for the locked fieldKeys (stored under `formData.sections.personal_info.fields`) are left in the database untouched. The section will not render them, and the submission orchestrator's `buildOrderSubject` reads those values directly from invitation columns rather than from `formData`, so submission is unaffected.

---

## Downstream dependency

Task 8.5 (Silent Recalculation) depends on this task. Once Personal Info is 100% dynamic, Task 8.5 will add navigation-level logic to skip the section when the candidate's country selections produce an empty field list.

---

## Files changed

- `src/app/api/candidate/application/[token]/personal-info-fields/route.ts` — added `LOCKED_INVITATION_FIELD_KEYS` constant and guard, removed `switch` block, updated JSDoc and inline comments, added `orderBy` to two Prisma `findMany` calls
- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` — added `LOCKED_INVITATION_FIELD_KEYS` constant and guard in `collectPersonalInfoFieldRequirements`, updated file-level header comment
- `src/components/candidate/form-engine/PersonalInfoSection.tsx` — updated JSDoc, `handleFieldBlur` guard comment, and empty-state branch comment
- `src/translations/en-US.json` — updated `noFieldsRequired` and `instructions` values
- `src/translations/en-GB.json` — same
- `src/translations/es-ES.json` — same
- `src/translations/es.json` — same
- `src/translations/ja-JP.json` — same
- `src/app/api/candidate/application/[token]/personal-info-fields/__tests__/route.test.ts` — rewritten to assert the new contract (locked fieldKeys excluded, no locked/prefilledValue on returned fields)
- `src/lib/candidate/validation/__tests__/personalInfoIdvFieldChecks.test.ts` — added `collectPersonalInfoFieldRequirements` Task 8.3 exclusion test suite
- `src/components/candidate/form-engine/__tests__/PersonalInfoSection.test.tsx` — updated fixtures and tests; removed locked-field rendering tests; added Task 8.3 exclusion and empty-state progress-reporting tests
- `src/translations/__tests__/personal-info-dynamic-translation-keys.test.ts` — new file; verifies the updated translation key values across all five languages
- `e2e/tests/personal-info-dynamic.spec.ts` — new file; end-to-end test suite for the Task 8.3 candidate-facing behavior
- `docs/plans/personal-info-dynamic-technical-plan.md` — new file; technical plan authored by the architect agent
