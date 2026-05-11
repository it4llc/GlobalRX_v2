# Code Review Report: Phase 7 Stage 3b — Per-Entry Required-Field Validation + IDV Country-Switch Cleanup

**Date:** 2026-05-10
**Reviewer:** Code Reviewer (Opus 4.7 1M context)
**Branch:** `feature/phase7-stage3b-per-entry-validation-and-idv-country-clear`
**Commits reviewed:** `5695e1f` (spec/plan/Pass 1 tests), `5f94946` (implementation)

## Summary

**APPROVE WITH MINOR ISSUES.** Spec compliance is high; every TD-069 business rule has a working implementation backed by green Pass 1 tests; TD-072 cleanup is correctly folded into a single setFormData callback that reads from `prev`; G6 and G7 are clean (zero diff on `personalInfoIdvFieldChecks.ts` and `prisma/schema.prisma`); the engine is at 573 lines (well under the 600 cap); and the full suite shows `4460 passed | 1 failed | 173 skipped`, where the single failure is the pre-existing DoD 9 fixture-or-engine mismatch the implementer correctly left as a known-failing forward indicator. There is one G1 deviation from the technical plan (`PackageServiceWithRequirements` was exported once from `repeatableEntryFieldChecks.ts` instead of being re-declared in two siblings); on the merits it is sound, and I recommend RATIFYING. The TD-072 Pass 1 tests are both forward regression guards (not Pass-1-failure tests), and the in-line comments are honest about that — but it is worth noting in the review that no test in this branch *would have failed* on the parent commit for TD-072. None of the findings rises to BLOCKER.

## Mechanical Findings (from Step 1 pattern scan)

- `as any`: Found at `src/lib/candidate/validation/__tests__/validationEngine.test.ts:1726` — `const findManyMock = prisma.dSXMapping.findMany as unknown as any;` (pre-accepted Prisma mock cast in test code; one ESLint disable comment immediately above; one occurrence)
- `@ts-ignore`: Not found
- `@ts-expect-error`: Not found
- `@ts-nocheck`: Not found
- `console.log` / `console.warn` / `console.error`: Not found
- `TODO` / `FIXME` / `HACK` / `XXX`: Not found
- `debugger`: Not found
- `.only(` / `.skip(` in test files: Not found

## Spec Compliance — per-rule

### TD-069
- Rule 1 (per-entry required-field validation for AH/Edu/Emp): PASS — `validationEngine.ts:370-376, 414-421, 471-478` invoke the walk for all three sections.
- Rule 2 (each entry validated against its own country's rules): PASS — `repeatableEntryFieldChecks.ts:189` builds `perCountryReq` keyed by `countryId`, and `repeatableEntryFieldChecks.ts:205` reads `perCountryReq.get(entry.countryId)` per entry. Confirmed by green DoD 4 test asserting only the country-B entry produces a degree error.
- Rule 3 (`address_block` validated piece-by-piece): PASS — `repeatableEntryFieldChecks.ts:370-419` `walkAddressBlockPieces`. AND-composition (Spec Rule 3.1.3) is enforced at line 408 (`!cfg.enabled || !cfg.required` plus an upstream `perReq.get(...) !== true` skip at line 229).
- Rule 4 (null-country entry → missing-country error): PASS — `repeatableEntryFieldChecks.ts:193-203` emits `entryCountryRequired` with `fieldName: "Entry ${entryOrder}"` and `placeholders: { entryOrder }`. DoD 5 green.
- Rule 5 (empty-value detection same as personal-info): PASS — `repeatableEntryFieldChecks.ts:446-451` re-declares `isEmptyValue` verbatim from `personalInfoIdvFieldChecks.ts:424-429` per TD-077.
- Rule 6 (locked-field semantics do NOT apply to repeatable entries): PASS — no locked-value lookup anywhere in `repeatableEntryFieldChecks.ts`. The `lockedValues` map is only consumed by `validatePersonalInfoSection`.
- Rule 7 (existing scope/gap/date-extraction unchanged): PASS — `validationEngine.ts:349-367` (AH), `:400-412` (Edu), `:451-469` (Emp) preserve all existing scope/gap logic; the per-entry walk is purely additive (`fieldErrors` is a new fourth array). DoD 10 green confirms gap-detection still fires.
- Rule 8 (errors in existing `fieldErrors[]`): PASS — every walk return type is `FieldError[]` and the engine assigns directly to `result.fieldErrors`.
- Rule 9 (no new DB round-trip beyond ONE batched query per section): PASS — `repeatableEntryFieldChecks.ts:185-187` issues a single `findMappings({ requirementIds: [], pairs })` call per section. The pair list (`collectSectionPairs`) is the cartesian product of services × distinct entry countries, distinct'd via `seen` Set on lines 275-285.
- Rule 10 (lowercase status values): PASS — no new status strings added; existing `'not_started' | 'incomplete' | 'complete'` preserved.
- Rule 11 (translation key reuse + new key for missing-country): PASS — every per-piece/scalar field error uses `'candidate.validation.fieldRequired'`; missing-country uses the new `'candidate.validation.entryCountryRequired'` key, added to all five locale files with consistent English text.

### TD-072
- Rule 12 (clear active per-requirement slots before snapshot/load): PASS — `IdvSection.tsx:287-304` single `setFormData(prev => …)` callback first builds `currentCountryData` from `prev`, then deletes each `field.requirementId` from `next`, then writes the snapshot under `country_<previousCountryId>`.
- Rule 13 (selected country itself NOT cleared, `idv_country` updated): PASS — `setSelectedCountry(countryId)` and `setPendingSaves(prev => new Set(prev).add('country'))` preserve existing behavior. DoD 13 test green.
- Rule 14 (next save's `pendingSaves` does not carry orphan ids): PASS by inspection — once the requirementId keys are gone from `formData`, the save effect at `IdvSection.tsx:336-341` builds `fieldsToSave` from `pendingSaves`-membership only. (See test-quality note below — this is harder to assert in a test than to prove by inspection.)
- Rule 15 (snapshot preserved for re-hydration): PASS — line 302 writes `next[\`country_${selectedCountry}\`] = currentCountryData;` and `loadFieldsForCountry` at lines 240-246 re-hydrates from this snapshot unchanged.
- Rule 16 (`locationId` on resulting IDV OrderItem unchanged): PASS — no edits to OrderItem-generation code paths.
- Rule 17 (error/retry behavior unchanged): PASS — save effect at lines 327-396 untouched.

### Cross-cutting
- Rule 18 (zero net regression): PASS — `pnpm vitest run` returns `4460 passed | 1 failed | 173 skipped`. The single failure is the deliberate DoD 9 known-failing test added by the test-writer.
- Rule 19 (no schema/migration changes): PASS — `git diff dev..HEAD -- prisma/schema.prisma` returns empty.
- Rule 20 (TD-077 pattern preserved): PASS with note — `personalInfoIdvFieldChecks.ts` has zero diff, but the implementer deviated from G1 by using one export+import path between sibling validator files instead of two structural re-declarations. See "G1 deviation assessment" below.
- Rule 21 (no PII in logs): PASS — `repeatableEntryFieldChecks.ts:382-388` logs only `requirementId` and `entryId`, no saved values.
- Rule 22 (preserved log event names): PASS — the malformed-address_block warn uses a new event name `candidate_validation_address_block_malformed` in the existing `candidate_validation_*` namespace per Spec DoD 20.

## Plan Compliance — per-section

- §1.1 (addressConfig shape resolution): PASS. `repeatableEntryFieldChecks.ts:105-112` declares the `DEFAULT_ADDRESS_CONFIG` mirror; `:397-400` falls back to it via `isUsableAddressConfig`. Per-piece composition rule (`enabled && required && per-requirement isRequired true`) is at `:228-229` plus `:408`.
- §1.2 (per-entry country resolution: ONE batched query): PASS. `repeatableEntryFieldChecks.ts:184-187` issues one `findMappings({ requirementIds: [], pairs })` per section. Caching is the `Map<countryId, Map<requirementId, boolean>>` built at `:296-323`.
- §1.3 (edge case decisions): PASS. Country-no-longer-exists treated as null country (handled at `:193`); malformed address_block warns once with no PII (`:382-388`); new `entryCountryRequired` translation key added; IDV snapshot preserved; rapid re-switching reads from `prev`; in-flight save handled via same-render cleanup.
- §2.3.1 (loader extension): PASS. `requirementById` Map added to the 'ok' branch at `loadValidationInputs.ts:151`; `RequirementRecord` interface added at `:72-79` with TD-077 commentary at `:58-70`. `requirementMetadata` loop at `:215-256` is augmented with one extra `Map.set` per requirement; no new include and no extra Prisma round-trip.
- §2.3.2 (engine wiring): PASS. Three section validators are async (`validationEngine.ts:327, 389, 433`); orchestrator awaits each; `ScopedSectionInput` extended at `:305-325` with the new fields; new walks called at `:370-376, 414-421, 471-478`; results assigned to `result.fieldErrors`.
- §2.3.3 (mandatory `buildReviewSummary` hoist): PASS. New file `buildReviewSummary.ts` is 76 lines; engine ends at 573 lines (target was ≈556; over by ~17 lines, but well below the 600 hard cap and well within G3's no-escalation tolerance).
- §2.3.4 (IdvSection handleCountryChange): PASS. Single combined `setFormData` callback at `IdvSection.tsx:287-304` reads from `prev`; dependency array correctly drops `formData` (line 311). The change is justified by a clear comment block at `:262-284`. Notable: no `eslint-disable react-hooks/exhaustive-deps` was needed (the pattern compiled and passed lint as-is).

## G1 deviation assessment

**Recommendation: RATIFY the deviation, with a process note.**

What the implementer actually did:
- `repeatableEntryFieldChecks.ts:72-81` declares `PackageServiceWithRequirements` once with `export type`.
- `validationEngine.ts:51` imports `PackageServiceWithRequirements` from `'./repeatableEntryFieldChecks'`.
- `personalInfoIdvFieldChecks.ts:85` is unchanged (the original module-internal alias remains).

Both files involved in the new export/import edge are sibling validator helpers on the same side of the loader/validator boundary that TD-077 was written to protect. TD-077's stated concern is preventing a "shared cross-layer types module" from emerging that couples the loader's data-shape concerns with the validators' usage concerns; the deviation here is a single type export between two co-equal sibling validators, neither of which crosses that loader/validator boundary. The architectural footprint of the deviation is a duplication count of 2 (the alias appears in `personalInfoIdvFieldChecks.ts` and `repeatableEntryFieldChecks.ts`), exactly the same count G1 specified — the only difference is which file holds the canonical declaration and which holds the import. The implementer's in-code comment at `repeatableEntryFieldChecks.ts:64-71` explains this honestly and references TD-081.

The process violation is real — G1 explicitly said "If the implementer believes a third path is necessary, STOP" — and should be noted in the implementer's checkpoint. But the resulting code is sound and the duplication count is unchanged. Reversing now (forcing a structural re-declaration in `validationEngine.ts` for a third copy) would actually grow the duplication count to 3, which is the opposite of what the spirit of TD-077 wants.

**Recommendation on TD-077 itself:** Update TD-077 to clarify that sibling-file type exports between validator helpers (on the same side of the loader/validator boundary) are permitted, while the prohibition on shared cross-layer types modules stays strict. Today's TD-077 wording is silent on the sibling-validator case, which is what created the ambiguity G1 was trying to forestall. A two-sentence clarification would prevent this recurring as a process question.

## Code quality findings

- (MINOR) `repeatableEntryFieldChecks.ts:341` — `findApplicableRequirements` accepts a parameter `_packageServicesForSection` that is never used (the underscore prefix correctly signals this). The architect's plan §1.3 service-level address_block carve-out claims this is "implicitly satisfied" because the address_block requirement appears in `requirementById` and acquires a dsx_mappings row at the entry's country. That reasoning is correct for today's package shapes, but a short inline comment naming the case (e.g. "service-level address_block: implicitly applicable when its dsx_mappings row exists at the entry's country, see §1.3") would help a future reader. Not a correctness defect.
- (MINOR) `loadValidationInputs.ts:235-238` — comment correctly notes that `requirementById.set` is last-write-wins for requirements mapped to multiple services, and that the values are identical because they come from the same `requirement` Prisma row. This is correct today, but if the same requirementId ever appeared on two services with diverging Prisma-side projections (currently impossible by FK constraints, but theoretically possible with future joins), last-write-wins could mask issues. The comment as written is honest.
- (NIT) `repeatableEntryFieldChecks.ts:60` — `RequirementRecord.fieldData.addressConfig: unknown` — the structural alias here is wider than strictly needed (could be typed `AddressConfig | null | undefined` since the validator walks it via `isUsableAddressConfig` first). The `unknown` typing matches the loader's deliberately loose boundary type and is consistent.
- (NIT) `repeatableEntryFieldChecks.ts:198` — `fieldName: \`Entry ${entry.entryOrder}\`` is a hardcoded English-shaped label. The technical plan §9.6 deliberately mirrors the existing `idvCountryRequired` precedent. This is acceptable for the renderer pattern in use, and the placeholder `entryOrder` is also passed for future locale-aware formatting. No action needed.
- (NIT) Five translation files all show "No newline at end of file" in the diff — pre-existing condition, not introduced by this branch.

## Test quality findings

- (PASS) DoD 1, 2, 3, 4, 5, 6, 8, 10 in `validationEngine.test.ts` are all green and correctly assert the new behavior. DoD 4 specifically uses different `isRequired` flags per country (false for country A, true for country B) — confirmed at lines 968-981, not a degenerate fixture.
- (PASS) DoD 9 fails with `expected 0 to be greater than 0` — confirms the implementation did NOT scope-creep into fixing the pre-existing `evaluateTimeBasedScope` bug. The implementer's hand-off comment documenting this as a known-failing fixture-or-engine mismatch is honest and consistent with what I observed.
- (MAJOR) The two TD-072 IdvSection tests (lines 1472-1541 and 1560-1664) are forward regression guards, not Pass-1-failure tests. The in-line comments at `:1466-1471` and `:1543-1559` are admirably honest about this: the bug TD-072 fixes is a race that requires deferred fetch promises to reproduce in a test, and Pass 1 cannot drive that race deterministically. The result is that **no test in this branch fails on the parent commit (dev) for TD-072**. The cleanup behavior in `formData` itself is verified only by spec review and by the manual smoke documented in DoD 14. This is an acknowledged limitation, not a bug — but it should be explicitly called out as MAJOR because the standard pipeline contract is "Pass 1 tests fail on parent, pass on implementation." The implementer's hand-off must mention that DoD 14 (manual smoke) is the only direct verification of the cleanup, and reviewers should not be surprised that the regression guards were green on both sides. Suggest a follow-up TD entry to drive the race test (deferred-promise fetch mock + held resolve) when test infrastructure allows.
- (MINOR) The `as any` cast at `validationEngine.test.ts:1726` is the pre-accepted Prisma mock cast and carries an `eslint-disable @typescript-eslint/no-explicit-any` comment immediately above it. Justified.
- (MINOR) The DoD 9 test at line 1219 asserts `expect(emp!.scopeErrors.length).toBeGreaterThan(0)` — the comment says it tests "time-based scope errors continue to surface alongside the new per-entry walk" but the fixture's saved entry has no date fields populated (the entry only contains `requirementId: REQ_JOB_TITLE, value: 'Engineer'` — no startDate or endDate). The fixture-or-engine mismatch is what the implementer flagged. The test is correctly NOT made to pass; future TD work will need to either fix the fixture or fix the engine.

## Discovered items — verify implementer-reported candidate TDs

- **DoD 9 fixture-or-engine mismatch (`evaluateTimeBasedScope` returning no error when entry dates are null):** CONFIRMED. The fixture at `validationEngine.test.ts:1240-1255` has an employment entry with no startDate or endDate fields populated; `evaluateTimeBasedScope` should fail-loud on null dates inside a time-based scope, but appears to return zero scope errors. Either the fixture needs date fields added, or `evaluateTimeBasedScope` needs to emit an error when entry dates are null inside a time-bounded scope. This is appropriate as a new TD entry (suggested TD-082) and should not be fixed in this branch.
- **`requirementById` last-write-wins** (multiple writes for the same requirement when mapped to multiple services): CONFIRMED at `loadValidationInputs.ts:239-254`. The comment at `:235-238` correctly notes this is safe because the values are identical (same `requirement` Prisma row). Not a TD candidate today, but if the include shape ever joins service-specific projections onto requirements, this would need revisiting. The implementer's note is sufficient.
- **Additional finding (mine):** The two TD-072 Pass 1 tests are forward regression guards rather than Pass-1-failure tests (see test quality MAJOR above). Suggest opening a follow-up TD (suggested TD-083) to write a deferred-promise race test for the `pendingSaves` orphan window once test infrastructure allows.
- **Additional finding (mine):** `findApplicableRequirements` ignores its `_packageServicesForSection` parameter. The architect's plan §1.3 service-level address_block carve-out claim ("implicitly satisfied") is correct under today's package shapes, but the unused parameter could be removed entirely or kept and used in a stricter assertion. Not a TD candidate; cosmetic.

## Scope discipline check

- CONFIRMED: only the files listed in the plan §2 were touched (loadValidationInputs.ts, validationEngine.ts, repeatableEntryFieldChecks.ts NEW, buildReviewSummary.ts NEW, IdvSection.tsx, five translation files, two test files, plus the spec/plan docs and the .gitignore log-files entry). No accidental edits.
- CONFIRMED: G6 (`personalInfoIdvFieldChecks.ts` zero diff) and G7 (`prisma/schema.prisma` zero diff) both honored.
- CONFIRMED: no incidental fixes — DoD 9's pre-existing failure was correctly left in place; TD-078/079/080/081 (the four candidates flagged in the architect's §11) are all unfixed; the form-rendering bug in `AddressHistorySection.tsx` is untouched per spec carve-out.

## Required actions before merge

- (MAJOR — author's call to address now or open a follow-up TD): Document explicitly in the hand-off summary that **the two TD-072 Pass 1 tests are forward regression guards, not Pass-1-failure tests** — the actual cleanup behavior is verified by spec review and the manual smoke (DoD 14), not by an automated test that fails on the parent commit. If a follow-up TD is preferred, file it (suggested TD-083) so the deferred-promise race test is tracked.
- (MINOR — author's call): Update TD-077 in `docs/TECH_DEBT.md` to explicitly permit sibling-file type exports between validator helpers (resolving the G1 ambiguity for future stages). Two sentences would suffice.
- (MINOR — author's call): Add a one-line inline comment at `repeatableEntryFieldChecks.ts:341` naming the service-level address_block carve-out case so a future reader sees why `_packageServicesForSection` is intentionally unused.
- (MINOR — author's call): Open new TD entry (suggested TD-082) for the DoD 9 fixture-or-engine mismatch (`evaluateTimeBasedScope` returning no error when entry dates are null inside a time-based scope).

No BLOCKERs. The implementation is ready to proceed to standards-checker once Andy decides whether the MAJOR test-quality note is addressed in this PR or rolled into a follow-up.

## Verdict

[ ] APPROVED — proceed to standards-checker
[X] APPROVED WITH CONDITIONS — recommend addressing the MAJOR test-quality note (or filing a follow-up TD) before standards-checker; MINORs and NITs are author's call
[ ] REQUIRES REWORK — critical issues must be resolved and re-reviewed

Standards-checker can proceed once Andy decides on the test-quality note disposition.
