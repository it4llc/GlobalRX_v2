# Code Review Report: Cross-Section Validation Filtering Bug Fix

**Date:** 2026-05-15
**Branch:** feature/task-8.5-silent-recalculation-step-skipping
**Commit reviewed:** feb197b fix: Cross-section validation filtering — 4 bugs
**Reviewer:** code-reviewer agent

## Files reviewed

Production code:
- `src/lib/candidate/lockedInvitationFieldKeys.ts` (NEW)
- `src/lib/candidate/validation/loadValidationInputs.ts`
- `src/lib/candidate/validation/repeatableEntryFieldChecks.ts`
- `src/lib/candidate/addressHistoryStage4Wiring.ts`
- `src/lib/candidate/useRepeatableSectionStage4Wiring.ts`
- `src/lib/candidate/validation/scopeValidation.ts`
- `src/lib/candidate/validation/gapDetection.ts`
- `src/lib/candidate/validation/validationEngine.ts`
- `src/components/candidate/portal-layout.tsx`
- `src/components/candidate/review-submit/ReviewSubmitPage.tsx`
- `src/app/api/candidate/application/[token]/personal-info-fields/route.ts`
- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`

Test files:
- `src/lib/candidate/__tests__/lockedInvitationFieldKeys.test.ts`
- `src/lib/candidate/validation/__tests__/repeatableEntryFieldChecks.collectionTab.test.ts`
- `src/lib/candidate/__tests__/addressHistoryStage4Wiring.test.tsx`
- `src/lib/candidate/__tests__/useRepeatableSectionStage4Wiring.test.tsx`
- `src/lib/candidate/validation/__tests__/validationEngine.test.ts`
- `src/lib/candidate/validation/__tests__/scopeValidation.test.ts`
- `src/components/candidate/review-submit/ReviewSubmitPage.test.tsx`

## Overall Assessment

APPROVE WITH NOTES. The bug fix is functionally correct and well-tested. All four spec bugs are addressed by targeted, narrowly-scoped changes. The off-by-one fix is applied consistently across the three date-arithmetic files. The empty-init `sectionStatuses` change is safe given how `mergeSectionStatus` handles `undefined`. The new shared `lockedInvitationFieldKeys.ts` module is well-documented and tested.

The principal concern is data-key consistency: the `PERSONAL_INFO_FIELD_KEYS` content list now exists in three separate places with the same values. The spec's stated goal was a single source of truth, but only `LOCKED_INVITATION_FIELD_KEYS` was actually unified. This is a maintenance liability (drift risk) rather than a behavioral bug; it should be cleaned up but does not block the fix from shipping. A few minor observations and a single warning round out the report.

## Mechanical Findings (Step 1 pattern scan)

- `as any`: Not found
- `@ts-ignore`: Not found
- `@ts-expect-error`: Not found
- `@ts-nocheck`: Not found
- `console.log` / `console.warn` / `console.error`: Not found
- `TODO` / `FIXME` / `HACK` / `XXX`: Not found
- `debugger`: Not found
- `.only(` / `.skip(` in test files: Not found

Mechanical scan is clean.

## Critical Issues — Must Fix Before Proceeding

None found.

## Warnings — Should Fix

### W1. `PERSONAL_INFO_FIELD_KEYS` content duplicated across three files (CODING S8.3 — Data Key Consistency)

The same eleven-element fieldKey list now exists in three places, all with identical content but separate source-of-truth declarations:

1. `src/lib/candidate/lockedInvitationFieldKeys.ts:43-55` — the new shared `PERSONAL_INFO_FIELD_KEYS`.
2. `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts:116-128` — a module-private `PERSONAL_INFO_FIELD_KEYS` used by `isPersonalInfoField`, which is consumed by `collectPersonalInfoFieldRequirements` AND by `collectIdvFieldRequirements` to exclude PI-claimed requirements from IDV.
3. `src/app/api/candidate/application/[token]/personal-info-fields/route.ts:170-171` — an inlined array literal used in the API route's `isPersonalInfoField` heuristic.

The spec's "Issue 1 root cause" section states the goal: "the server validator, the address-history UI splitter, and (already) the PI route consult one source of truth." Only `LOCKED_INVITATION_FIELD_KEYS` (the smaller set) was actually unified. The wider list was NOT consolidated. The comment in `personalInfoIdvFieldChecks.ts:224` says "the wider PERSONAL_INFO_FIELD_KEYS set above is intentionally left alone" — but the new shared module also exports `PERSONAL_INFO_FIELD_KEYS` with the same content, which is exactly the drift risk S8.3 exists to prevent.

Recommendation: Refactor `personalInfoIdvFieldChecks.ts` to import `PERSONAL_INFO_FIELD_KEYS` / `isPersonalInfoFieldKey` from the shared module, and refactor the API route to do the same (replace the inline array literal with a single import). The TypeScript shape is identical and the behavior is identical; only the source-of-truth changes. This eliminates the three-way drift risk.

If this is deferred, file a tech debt ticket so the three lists are eventually unified, and add a `// SHARED CONTENT — also exists in X and Y` cross-reference comment to each duplicate so a future editor sees the dependency.

## Observations — Consider Improving

### O1. `isPersonalInfoOwnedRequirement` heuristic is opt-in by design, not categorically safe

The heuristic in `repeatableEntryFieldChecks.ts:417-424` filters a requirement as Personal-Info-owned when either (a) `fieldData.collectionTab` lowercase-contains `'subject'` or `'personal'`, or (b) its `fieldKey` is in the hardcoded `PERSONAL_INFO_FIELD_KEYS` set.

The hardcoded set is the safety net for legacy/imported DSX rows that lack an explicit `collectionTab`. The list covers the obvious PI-collected fields: `firstName, lastName, middleName, email, phone, phoneNumber, dateOfBirth, birthDate, dob, ssn, socialSecurityNumber`. This is sufficient for the bugs documented in the spec.

A future DSX requirement with a Personal-Info-style fieldKey not in this set (e.g. `gender`, `nationality`, `placeOfBirth`, `homeCity`) and lacking an explicit `collectionTab` would NOT be caught by the fallback and would be reported as a missing field error on Address History. The canonical fix is to ensure `collectionTab` is set on all PI requirements — the fieldKey set is a backstop, not a complete map. The spec acknowledges this design tradeoff implicitly. No code change needed; this is a documentation point so future maintainers understand the boundary.

### O2. `personalInfoIdvFieldChecks.ts` `isPersonalInfoField` and `repeatableEntryFieldChecks.ts` `isPersonalInfoOwnedRequirement` are functionally equivalent but separately implemented

Both apply the same logic: check `collectionTab` for `'subject'` / `'personal'`, then fall back to a PI fieldKey set. The two functions could share an implementation by exporting one from the shared module and importing it in both places. This is a refactoring opportunity, not a defect.

### O3. Off-by-one fix correctly applied across all three files

The reviewer specifically searched for OTHER date comparisons in the validation directory that might still assume exclusive end dates. The only files doing date arithmetic are:

- `scopeValidation.ts` — fixed (lines 170-175, 212, 218)
- `gapDetection.ts` — fixed (lines 53-58, 75, 131)
- `validationEngine.ts` `computeScopeStart` — fixed (lines 572-578)

`dateExtractors.ts` does only date parsing (no arithmetic). `validateWorkflowSection.ts`, `mergeSectionStatus.ts`, `validateRecordSearchSection.ts`, etc. do no date math. The fix is complete.

The boundary semantics were verified by hand:
- Entry `[2019-05-14, 2026-05-14]` with `today=2026-05-14` and 7-year scope → coveredDays = 2555 = requiredDays → no error.
- Consecutive intervals (end 06-01, start 06-02) → `next.startMs <= runningEnd` short-circuits → no spurious gap.
- A 30-day calendar gap (end 06-01, start 07-01) at tolerance 30 → gapDays = 29 → not flagged. Under the OLD semantics this was gapDays = 30, also not flagged. No regression for tolerance-boundary cases.

### O4. `sectionStatuses` empty-init change is safe

The reviewer audited all consumers of `sectionStatuses`:

- `portal-layout.tsx:747` — passes `sectionStatuses[section.id]` to `mergeSectionStatus` as `localStatus`. The merge helper explicitly types `localStatus` as `SectionStatus | undefined` and handles `undefined` via Rule 4 (`return validationStatus ?? localStatus ?? fallbackStatus`).
- `portal-layout.tsx:680-725` — the lifted Personal Info effect computes a status and writes through `handleSectionProgressUpdate`, which is the standard write path.
- The Record Search override at `portal-layout.tsx:765-774` triggers when `merged === 'not_started'`, which is exactly the case the empty-init produces on first render. The visited+departed logic then kicks in. No regression.

The rationale documented in the comment (lines 102-110) is correct: with `localStatus = 'not_started'` (the old init value) and `validationStatus = 'complete'` (returning candidate), `mergeSectionStatus` Rule 2 reports `'incomplete'`, turning the sidebar red on first render. Leaving local undefined lets the merge correctly defer to validation. The fix is principled.

### O5. The new `requirementById` map is built in the same loop as `requirementMetadata`

`loadValidationInputs.ts:226-285` adds a sibling `requirementById` map built in the same iteration that already builds `requirementMetadata`. No new database round-trips; no new perf cost. Good.

### O6. `isLockedInvitationFieldKey` filter on registry push is symmetric across Address History, Education, and Employment

Address History uses `buildAddressHistorySubjectRequirements` (in `addressHistoryStage4Wiring.ts:291`); Education and Employment use the shared `buildSubjectRequirementsForEntries` (in `useRepeatableSectionStage4Wiring.ts:208`). Both now apply `isLockedInvitationFieldKey`. The two helpers diverged earlier on the locked-key filter but are now equivalent. Worth eventually consolidating into one helper, but acceptable for the bug fix.

## Business Rule Compliance

Spec business rules from `docs/specs/cross-section-validation-filtering-bugfix.md`:

- **BR1 (collectionTab filter on repeatable entry walks)**: Implemented at `repeatableEntryFieldChecks.ts:370-394` via `findApplicableRequirements` calling `isPersonalInfoOwnedRequirement`. Extended with PI fieldKey heuristic per Issue 1 follow-up. Tests cover Address History, Education, Employment symmetrically.
- **BR2 (Personal Info validation only checks PI-owned fields)**: Implemented at `personalInfoIdvFieldChecks.ts` `collectPersonalInfoFieldRequirements` which already excluded locked keys via the imported `LOCKED_INVITATION_FIELD_KEYS`. Test fixture in `validationEngine.test.ts:2202-2276` proves Personal Info reaches `complete` when only middleName + dateOfBirth are required and filled.
- **BR3 (Personal Info banner excludes locked fields)**: Implemented at `addressHistoryStage4Wiring.ts:291` and `useRepeatableSectionStage4Wiring.ts:208` via `isLockedInvitationFieldKey` filter on registry push. The shell-level banner consumes the registry, so excluding from the registry is sufficient. Tests in `addressHistoryStage4Wiring.test.tsx:660-700` and `useRepeatableSectionStage4Wiring.test.tsx:347-360`.
- **BR4 (banner and asterisks agree)**: This is an indirect consequence of BR3 — once locked fields are removed from the registry, the banner and the asterisk-rendering path consume the same trimmed list.
- **BR5 (no data model changes)**: Confirmed. No Prisma schema changes, no new tables, no new API endpoints, no save-bucket key changes.

All five business rules: implemented correctly.

## Security Assessment

This bug fix touches one API route (`personal-info-fields/route.ts`) — only by replacing an inline constant with an import. No security-relevant changes.

- **Authentication check on all routes**: Yes. The route checks `CandidateSessionService.getSession()` and verifies `sessionData.token === token` before any data access.
- **Permission checks server-side**: Yes. Token match plus invitation status checks (expired, completed) at the route level.
- **Input validation with Zod**: N/A (GET-only route, no request body).
- **No sensitive data over-exposed**: Yes. The route returns DSX requirement metadata only — no PII.
- **No cross-customer data leakage risk**: Yes. The invitation is scoped to the candidate's token; service requirements are scoped to the invitation's package services.

## Delegated Standards Rules (from category 7)

- **CODING S8.3 Data key consistency**: Warning (see W1). `PERSONAL_INFO_FIELD_KEYS` content duplicated in three files.
- **API S11 JSDoc on API routes**: Pass. The modified route at `personal-info-fields/route.ts:14-60` has a complete JSDoc block (request shape, response shape, auth requirements, error responses).
- **DATABASE S5.5 Status inheritance**: N/A. No parent/child status relationships touched.
- **DATABASE S5.6 No hardcoded formatted status**: Pass. All status comparisons in the changed files use lowercase database values (`'complete'`, `'incomplete'`, `'not_started'`). No formatted display strings.
- **DATABASE S5.7 Status transitions tested**: Pass. The validation engine tests (`validationEngine.test.ts:2145-2419`) include the full transition: visited → departed → server validates → status reaches `complete` when fields are filled or `incomplete` when not.
- **DATABASE S6 Checkbox/toggle UI logic**: N/A. No checkbox or toggle UI in scope.
- **DATABASE S7 Required field validation (3 layers)**: N/A. No new required fields introduced; the changes modify which requirements the validator walks, not validation tier coverage.

## Test Coverage Assessment

- **All business rules have tests**: Yes.
  - `repeatableEntryFieldChecks.collectionTab.test.ts` covers BR1 (collectionTab + fieldKey heuristic, document-type filter) with regression tests for Bug A and Issue 1.
  - `lockedInvitationFieldKeys.test.ts` pins the shared constants' shape.
  - `addressHistoryStage4Wiring.test.tsx:601-700` covers BR3 for Address History.
  - `useRepeatableSectionStage4Wiring.test.tsx:285-372` covers BR3 for Education and Employment.
  - `validationEngine.test.ts:2145-2419` integration-tests Bug A (Address History reaching complete) and Bug C (Personal Info reaching complete) end-to-end.
  - `ReviewSubmitPage.test.tsx:705-810` covers the descriptor.status override (Issue 2 fix).
  - `scopeValidation.test.ts:255-318` covers the off-by-one fix with two regression tests.

- **API authentication tested**: N/A for this fix (the route change is a constant-import refactor; the route's existing auth tests still apply).

- **Error cases tested**:
  - Edge case: country with only subject-targeted requirements → entry returns zero errors (`repeatableEntryFieldChecks.collectionTab.test.ts:345-387`).
  - Edge case: country with both kinds, inline unfilled → only inline error (`repeatableEntryFieldChecks.collectionTab.test.ts:389-449`).
  - Defensive: filter is narrow — non-PI fieldKey without collectionTab still surfaces a missing-field error (`repeatableEntryFieldChecks.collectionTab.test.ts:893-934`).
  - Boundary: end-date inclusive — entry ending exactly today vs tomorrow give equivalent coverage (`scopeValidation.test.ts:287-318`).

- **Gaps identified**: None. The test surface is robust and includes both unit tests on the new helpers and integration tests through the full `runValidation` orchestrator.

## Focus area verdicts

### Focus area 1: `isPersonalInfoOwnedRequirement` heuristic correctness

**Verdict: Correct for the documented cases, with an acknowledged design boundary.**

- The collectionTab check is the canonical signal and covers all properly-tagged PI requirements.
- The fieldKey set (firstName, lastName, middleName, email, phone, phoneNumber, dateOfBirth, birthDate, dob, ssn, socialSecurityNumber) covers every well-known PI fieldKey and the locked-invitation subset.
- Over-match risk: low. None of the listed fieldKeys are plausible entry-section fields. Tests assert that non-PI keys (`passportNumber`, `residenceAddress`, `countryOfBirth`) are NOT filtered.
- Under-match risk: a future legacy/imported requirement with a PI-conceptual fieldKey not in the set (e.g. `gender`, `nationality`, `homeCity`) AND no explicit `collectionTab` would slip through. Mitigation: future requirements should be tagged with `collectionTab` at seed time; the fieldKey set is a backstop, not a complete map. The spec's "Open Questions" section called this out implicitly. See observation O1.

### Focus area 2: Off-by-one fix completeness

**Verdict: Complete.**

The reviewer searched the validation directory for all date-arithmetic patterns. The three files touched (`scopeValidation.ts`, `gapDetection.ts`, `validationEngine.ts computeScopeStart`) are the only places that compute date-day arithmetic for scope and gap analysis. The fix is symmetric across all three: normalize `today` to UTC midnight, add MS_PER_DAY for the inclusive cap, treat `entry.end` as inclusive by adding MS_PER_DAY.

The boundary semantics were verified by hand:
- 7-year scope with entry [2019-05-14, 2026-05-14] and today = 2026-05-14: coveredDays = 2555 = requiredDays → passes.
- Consecutive intervals (end 06-01, start 06-02): correctly NO gap.
- 30-day tolerance with calendar gap of 30: NOT flagged in either old or new semantics (consistent).
- 31-day calendar gap at tolerance 30: NEW semantics flag at 30 days actual computed gap (because inclusive end consumed one day). This is the correct calendar arithmetic the spec describes.

No other validation files perform date arithmetic. No drift risk identified.

### Focus area 3: `sectionStatuses` empty init safety

**Verdict: Safe. No regression in any consumer.**

Audit of all `sectionStatuses` consumers:

1. `portal-layout.tsx:747` — feeds `mergeSectionStatus` as `localStatus`. The merge helper explicitly types `localStatus: SectionStatus | undefined` and Rule 4 handles `undefined` by falling through to `validationStatus ?? fallbackStatus`. The merge type signature actually REQUIRES `undefined` to be valid input.

2. Personal Info lifted effect (`portal-layout.tsx:689-725`) — writes through `handleSectionProgressUpdate`, which is a write to `sectionStatuses`; not a read.

3. Record Search override (`portal-layout.tsx:765-774`) — triggers when `merged === 'not_started'`. With empty init, the first render's `merged` will be `validationStatus ?? fallbackStatus` (= `'not_started'` for Record Search since it has no validator entry), which is exactly the trigger condition. The visited+departed override then kicks in. Behavior is preserved.

4. The shell explicitly initializes the synthetic `review_submit` section (`portal-layout.tsx:736-741`) outside `sectionStatuses`, so the empty init does not affect Review & Submit.

The fix's documented rationale (avoiding spurious red sidebar on logout/login when validation says complete but local hasn't reported yet) is correct and well-reasoned.

## Verdict

[x] APPROVE WITH NOTES — proceed to standards-checker after addressing W1 (or accepting it as deferred tech debt).

The bug fix is functionally correct, well-tested, and faithful to the spec. The single warning (W1) is a maintenance-liability concern about three-way duplication of the `PERSONAL_INFO_FIELD_KEYS` content. If the implementer is willing to do a small follow-up cleanup (import the shared constant in `personalInfoIdvFieldChecks.ts` and in the API route), the fix becomes a clean approval. Otherwise, file a tech debt ticket and proceed. No critical issues block shipping.
