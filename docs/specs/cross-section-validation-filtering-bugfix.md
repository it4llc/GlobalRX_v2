# Bug Fix Specification: Cross-Section Validation Filtering
**Spec file:** `docs/specs/cross-section-validation-filtering-bugfix.md`
**Date:** May 14, 2026
**Requested by:** Andy
**Status:** Confirmed

## Summary

When a candidate fills out an application that includes countries with subject-targeted DSX fields (fields routed from entry sections to Personal Info via the cross-section registry), four related validation problems appear. All four trace back to one root cause: the validation engine doesn't know that some fields are collected on a different section than the one that triggered them. This causes false "incomplete" verdicts, confusing banner messages, and missing visual indicators.

These are pre-existing issues introduced by Tasks 8.3 and 8.4 (Personal Info relocation and Record Search split) but only became visible during Task 8.5 smoke testing because that was the first time the full 9-step flow was exercised end-to-end with real country data that triggers cross-section routing.

## Who Uses This

**Candidate** — the person filling out the background screening application. These bugs make it look like the candidate hasn't finished a section even when they have, and show confusing field requirements on Personal Info.

No internal admin, customer, or vendor users are affected.

## The Four Bugs

### Bug A: Address History stays red even when complete

**What happens:** The candidate fills in all address history entries with all required fields. The progress indicator stays red (incomplete).

**Root cause:** The validation engine's repeatable-entry field checker (`repeatableEntryFieldChecks.ts`) calls `findApplicableRequirements` to get the list of fields required for each entry's country. That function returns ALL DSX requirements for the country, including subject-targeted fields (fields with `fieldData.collectionTab = "subject-targeted"`). The validator then looks for those field values inside the address entry's saved data — but subject-targeted fields are saved under the Personal Info bucket, not the address entry. So the validator reports them as missing, and the section stays red.

**Expected behavior:** Address History should show green when all address entries are filled in correctly. Subject-targeted fields should not be counted against the address entry — they are collected on Personal Info.

### Bug B: Personal Info banner shows locked invitation fields

**What happens:** The Personal Info step shows a banner that says "Based on information you entered in another section, the following fields are now required:" followed by a list that includes fields like "First Name/Given Name," "Last Name," "Residence Address," and "Middle Name/Other Given Name." These are locked fields that come from the candidate invitation data — the candidate cannot edit them and they are already filled in.

**Root cause:** The cross-section registry or the banner rendering logic includes locked invitation fields in its "required fields" list. Task 8.3 removed the static/locked fields from the Personal Info form, but the banner message is still built from a requirements list that includes them.

**Expected behavior:** The banner should only list fields the candidate actually needs to fill in. Locked invitation fields (name, email, phone, address) should be excluded from the banner message.

### Bug C: Personal Info won't go green even when all visible fields are filled

**What happens:** The candidate fills in every visible field on Personal Info. The progress indicator stays red or yellow — it never goes green.

**Root cause:** Most likely the same as Bug A but in reverse. The validation engine's check for Personal Info includes fields in its "required" list that are either (a) locked invitation fields the candidate can't edit, or (b) fields the validator expects to find in the Personal Info save bucket but that are actually stored elsewhere. If the validator's required field count doesn't match what the form actually renders, the section can never reach "complete."

**Expected behavior:** Personal Info should show green when all visible, editable fields are filled in.

### Bug D: Banner says fields are required but no red asterisks on those fields

**What happens:** The top banner on a section says certain fields are required, but those fields don't have red asterisks next to them in the form.

**Root cause:** The banner's required-field list comes from the validation engine (which includes subject-targeted fields from other sections), but the form's asterisk rendering comes from the section's own field list (which correctly only includes fields that belong to that section). The two lists don't match.

**Expected behavior:** The banner and the asterisks should agree. Fields that aren't rendered on the current section should not appear in that section's "required fields" banner.

## Business Rules

1. **The validation engine must filter by `collectionTab` when checking repeatable entry fields.** When validating an address, education, or employment entry, requirements with `fieldData.collectionTab = "subject-targeted"` must be excluded from the per-entry field check. Those fields are collected on Personal Info, not on the entry section.

2. **Personal Info validation must only check fields that Personal Info actually collects.** This means subject-targeted fields from the cross-section registry plus any local DSX fields for the Personal Info section — but NOT locked invitation fields (name, email, phone, etc.) that are pre-filled and not editable by the candidate.

3. **The Personal Info banner must exclude locked/invitation fields.** The "the following fields are now required" message should only list fields the candidate can actually fill in on that step.

4. **The banner and the form asterisks must agree.** If a field appears in the "required fields" banner, it must also be rendered on the form with a red asterisk. If a field is not rendered on the form, it must not appear in the banner.

5. **No data model changes.** The fix is in how the validation engine filters requirements and how the banner message is built. No changes to the database, no new API endpoints, no changes to how data is saved.

## Edge Cases and Error Scenarios

1. **A country has only subject-targeted requirements and no inline requirements.** The entry section should show complete once the entry's country and basic fields are filled in — the subject-targeted requirements are Personal Info's responsibility.

2. **A country has both inline and subject-targeted requirements.** The entry section's validator should check only the inline requirements. Personal Info's validator checks the subject-targeted ones.

3. **No subject-targeted fields exist for any entry.** Everything works as before — no filtering needed because there are no subject-targeted requirements to exclude.

4. **Locked fields have values from the invitation.** The validator should recognize these as already filled and not count them as missing.

## Impact on Other Modules

The fix touches the validation engine files in `src/lib/candidate/validation/` and possibly the Personal Info banner rendering. No changes to admin UI, customer UI, or API routes.

## Definition of Done

1. Address History shows green when all address entries are complete, even when the candidate's countries have subject-targeted requirements
2. Personal Info shows green when all visible, editable fields are filled in
3. The Personal Info banner does not list locked invitation fields (First Name, Last Name, etc.)
4. The Personal Info banner only lists fields that are actually rendered on the form with red asterisks
5. No banner/asterisk mismatches on any section
6. All existing validation tests continue to pass
7. The fix works correctly with the Task 8.5 step skipping logic (if filtering changes what the validator considers "required" for a section, the step visibility computation must still produce correct results)

## Open Questions

1. **Where exactly does `findApplicableRequirements` live, and does it already receive `collectionTab` data?** The architect needs to read the actual file to determine whether `collectionTab` is already available in the requirement records or needs to be carried through from the DSX field loading. The Task 8.5 implementer's investigation identified `loadValidationInputs.ts` and `repeatableEntryFieldChecks.ts` as the files to fix, but the architect should verify.

2. **How are locked invitation fields identified in the codebase?** Task 8.3 removed them from the Personal Info form, but they may still exist in the DSX requirements data. The architect needs to find how the form currently knows which fields are locked (there may be a list of locked fieldKeys, or a flag on the requirement) so the banner and validator can use the same check.

## Follow-up Fixes — Issue 1 (Address History red after the first three patches) and Issue 2 (Review & Submit grey Record Search)

The initial round of fixes (collectionTab filtering, scope/gap off-by-one, document-type filtering) addressed Bug A's three obvious failure modes but a fourth one survived smoke testing.

**Issue 1 root cause — PI fieldKey heuristic gap.** The Personal Info route (`personal-info-fields/route.ts:167-171`) and `personalInfoIdvFieldChecks.ts` `isPersonalInfoField` both surface a requirement on Personal Info when EITHER its `collectionTab` contains 'subject'/'personal' OR its `fieldKey` lives in a fixed Personal Info fieldKey set (`firstName`, `lastName`, `middleName`, `email`, `phone`, `phoneNumber`, `dateOfBirth`, `birthDate`, `dob`, `ssn`, `socialSecurityNumber`). The per-entry validator's `isSubjectTargetedRequirement` only checked the `collectionTab` half of that heuristic, so a DSX requirement with a PI-style fieldKey but no explicit `collectionTab` (legacy/imported row, or a locked invitation key like `firstName`) fell through and was reported as a missing FieldError on every Address History entry whose country mapped it.

The fix:
- Promoted the wider Personal Info fieldKey set out of `personalInfoIdvFieldChecks.ts` into the shared `lockedInvitationFieldKeys.ts` module so the server validator, the address-history UI splitter, and (already) the PI route consult one source of truth. Added `PERSONAL_INFO_FIELD_KEYS` and `isPersonalInfoFieldKey`.
- Renamed `isSubjectTargetedRequirement` → `isPersonalInfoOwnedRequirement` in `repeatableEntryFieldChecks.ts` and extended it to combine the collectionTab check with `isPersonalInfoFieldKey`.
- Extended `isSubjectTargeted` in `addressHistoryStage4Wiring.ts` the same way so the local `computeRepeatableSectionStatus` no longer flags PI-fieldKey requirements as missing on the entry (they never get saved on the entry — the candidate fills them on Personal Info, and `buildAddressHistorySubjectRequirements` already filters locked keys from the registry push).

**Issue 2 root cause — Review & Submit consumed a different status source than the sidebar.** The sidebar renders the section's `status` from the shell's `visibleSectionsWithStatus`, which combines `mergeSectionStatus` (local + validation + fallback) plus the Record Search visited+departed override. The Review & Submit page received `effectiveValidationResult` but joined the descriptor list to `validationResult.summary.sections` by id — and Record Search has no server-side validator entry (Task 8.4 plan §4.8), so the join produced `undefined` and the page fell back to `'not_started'` (grey).

The fix:
- Extended `ReviewPageSectionDescriptor` with an optional `status` field carrying the already-merged sidebar value.
- `portal-layout.tsx` now passes `s.status` from `visibleSectionsWithStatus` into each descriptor; ReviewSubmitPage prefers `descriptor.status` over the summary lookup, falling back to summary status when the descriptor omits it. This keeps the sidebar and the Review & Submit page in lockstep without coupling either to the other's data path.

### Regression coverage

- `src/lib/candidate/__tests__/lockedInvitationFieldKeys.test.ts` — pins the shape of `PERSONAL_INFO_FIELD_KEYS` and `isPersonalInfoFieldKey`, including the superset relationship with `LOCKED_INVITATION_FIELD_KEYS`.
- `src/lib/candidate/validation/__tests__/repeatableEntryFieldChecks.collectionTab.test.ts` — adds four regression tests proving the fieldKey heuristic is consulted across Address History, Education, and Employment, and proving the filter stays narrow (non-PI fieldKeys without a collectionTab still surface as missing).
- `src/lib/candidate/__tests__/addressHistoryStage4Wiring.test.tsx` — adds six regression tests covering both `splitFieldsByCollectionTab` and `isSubjectTargeted` for the fieldKey path.
- `src/components/candidate/review-submit/ReviewSubmitPage.test.tsx` — adds three regression tests covering the descriptor's status override, status fallback to the validation summary, and the incomplete-via-descriptor case.