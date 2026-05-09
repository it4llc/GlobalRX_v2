# Phase 7 Stage 3 — Validation Hardening and Pre-Phase-8 Cleanup (Phase Plan)

**Spec file:** `docs/specs/phase7-stage3-validation-hardening-plan.md`
**Date:** 2026-05-08
**Status:** Approved by Andy; ready for execution
**Produced by:** project-manager agent (`/plan-feature`)

---

## Context

Phase 7 of the Candidate Invite feature has shipped Stages 1 and 2 (Stage 1 merged via PR #476; Stage 2 merged to `dev` via PR #479). The original master phase plan (`docs/specs/candidate-invite-phase-plan.md`) treats Phase 7 as a single phase, but execution split it into stages, and there are now Phase-7-blocking tech-debt items that must close out before Phase 7 ships and Phase 8 (Polish & Edge Cases) begins.

This plan scopes the work needed to close out Phase 7.

## Centerpiece — non-negotiable

**TD-069** — Per-entry required-field validation missing for Address History, Education, and Employment sections.

The candidate validation engine currently reports a section as `complete` even when entries inside it have empty required fields (e.g., empty `street1`/`city`/`state`/`postalCode` in address entries). This is a correctness regression that violates `docs/specs/phase7-stage1-validation-scope-gaps-review.md` Rules 4–7 — a candidate can submit a package with empty required fields. **Must be fixed before Phase 7 ships.**

The fix mirrors the TD-062 pattern in `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`: a `checkRequiredFields` walk that resolves DSX field requirements per entry/jurisdiction and emits `FieldError` rows for empty required fields, including descent into `address_block` JSON values for sub-fields marked `required: true` in the requirement's `addressConfig`.

---

## Scope Assessment

The centerpiece (TD-069) is itself a meaningful piece of work: it touches three section validators in `validationEngine.ts`, requires a new sibling helper module analogous to `personalInfoIdvFieldChecks.ts`, must descend into `address_block` JSON sub-fields, and demands fresh regression tests for three sections. That alone is one tight `/build-feature` cycle.

Folding either TD-067 (`portal-layout.tsx` ~841 lines) or TD-065 (`validationEngine.ts` ~757 lines) into the same cycle would:

1. Mix a correctness fix with a maintainability refactor — two failure modes in one commit, harder to review, harder to revert.
2. Force the implementer to first split the engine and *then* add new logic to the split files, doubling the surface of change.
3. Violate the project's "small phases" discipline.

**Decision: split.** TD-069 is its own stage. The validationEngine split happens BEFORE TD-069 (Stage 3a). The portal-layout split is Phase 8 prep, not Phase 7 closeout, and runs in a separate cleanup branch after Phase 7 ships. TD-072 is small, self-contained, and aligned with correctness — folded into the TD-069 stage.

---

## Complexity Flags

- `validationEngine.ts` is currently ~757 lines. Adding TD-069 on top without splitting first means the file lands somewhere north of 850 lines — well past the 600-line hard stop.
- The TD-069 fix shape is already proven by TD-062's sibling module `personalInfoIdvFieldChecks.ts`. Mirroring it for repeatable sections is straightforward, but `address_block` JSON descent is genuinely new work — `addressConfig` per-piece `required: true` flags must be honored, not just whether the JSON object exists.
- Education and Employment are "latent" per TD-069 — no smoke-test repro, but the same code path is missing. Tests must construct entries with empty required fields and assert the section turns red even though current production data may not have hit this case.
- TD-072's fix in `IdvSection.tsx:262–286` requires reasoning about the `pendingSaves` lifecycle — clearing `formData[<requirementId>]` on country switch must happen *before* the next debounced save fires, or stale requirementIds will still be flushed.
- `portal-layout.tsx` is at 841 lines and Phase 8 will add loading skeletons, error boundaries, expiration warning banner, and session recovery UI. Splitting it is genuinely Phase-8 prerequisite work, not Phase-7 closeout work, so it doesn't gate Phase 7 shipping.

---

## Phases

### Phase 1 (Stage 3a) — Split `validationEngine.ts` before adding TD-069

**Branch:** `feature/phase7-stage3a-validation-engine-split` (created off `origin/dev`)

**What it delivers:** `validationEngine.ts` drops below the 600-line hard stop by extracting the database-loading logic into a `loadValidationInputs` module, leaving the engine file with only the orchestration loop, per-section dispatch, and summary construction. No behavior change. All existing tests pass unchanged.

**Scope:**
- Extract the `prisma.candidateInvitation.findUnique` call, the `requirementMetadata` map population, the `servicesByType` grouping, and the `buildFindMappings` adapter into a new `src/lib/candidate/validation/loadValidationInputs.ts`.
- The engine's `runValidation` becomes a thin orchestrator that calls `loadValidationInputs(invitationId)` and dispatches to per-section validators.
- No changes to per-section validators, no changes to `personalInfoIdvFieldChecks.ts`, no changes to validator inputs or outputs.

**Why first:** TD-069 will add a non-trivial amount of code to the engine (a new sibling module's worth of helpers, plus three new call sites, plus address-block JSON descent). Landing those changes on top of an already-oversized file means re-reviewing the same file twice and inflates the diff for the correctness fix.

**Estimated size:** Small (mechanical extraction, no behavior change, existing tests are the regression net).

**Risks:**
- Small risk of a Prisma include shape mismatch when the loader returns data the engine consumes; mitigated by keeping the include identical and only moving code.
- The `findMappings` adapter currently captures `prisma` in closure; the extraction must preserve that closure or accept `prisma` as a parameter.

**`/build-feature` command:**
```
/build-feature Refactor validationEngine.ts to extract database loading. Create src/lib/candidate/validation/loadValidationInputs.ts that owns the prisma.candidateInvitation.findUnique call, the requirementMetadata map, the servicesByType grouping, and the buildFindMappings adapter. validationEngine.ts retains only the runValidation orchestrator, per-section dispatch, status helpers, and summary construction. No behavior change. All existing validation tests must pass unchanged. Goal: validationEngine.ts drops below 600 lines.
```

---

### Phase 2 (Stage 3b) — TD-069 + TD-072. **Phase 7 ships when this merges.**

**What it delivers:** Address History, Education, and Employment sections turn red when an entry has empty required fields. Address-block sub-fields (`street1`, `city`, `state`, `postalCode`, etc.) are validated against `addressConfig.required` flags, not just JSON-object presence. IDV section no longer leaks stale per-country form values into save payloads after a country switch. Phase 7 ships.

**Scope:**
- New sibling helper `src/lib/candidate/validation/repeatableSectionFieldChecks.ts` analogous to `personalInfoIdvFieldChecks.ts`, exporting `validateAddressHistoryEntries`, `validateEducationEntries`, `validateEmploymentEntries`, and a shared per-entry walk.
- For each entry, resolve DSX field requirements scoped to the entry's `countryId` and emit a `FieldError` for each empty required field.
- For `address_block`-typed fields, descend into the JSON value and check each sub-piece flagged `required: true` in the requirement's `addressConfig`.
- Wire the three new validators into `validateAddressHistorySection`, `validateEducationSection`, `validateEmploymentSection` in `validationEngine.ts`.
- Reuse the `findMappings` adapter and the `aggregateIsRequired` logic where possible (lift to a shared module if duplication is more than trivial).
- Regression tests in `src/lib/candidate/validation/__tests__/validationEngine.test.ts` (or a dedicated new test file) proving each of the three sections turns red when an entry has empty required fields, AND that the green state is preserved when fields are filled.
- TD-072: in `IdvSection.tsx` `handleCountryChange` (lines 262–286), walk the *previous* country's field set and `delete formData[req.id]` for each requirementId before stashing the snapshot under `country_<previousCountryId>`. Add a regression test that switches country, types in a field, and asserts the save payload for the new country does not include orphaned requirementIds.

**Depends on:** Phase 1 complete and merged.

**Estimated size:** Medium. The TD-069 portion is the bulk; TD-072 is genuinely small (~10 lines of code + one test) and shares the "validation correctness" framing.

**Risks:**
- `addressConfig` shape — the implementer must read existing `address_block` requirements directly from the database/spec to confirm the per-piece `required` flag location. The spec assumes "marked `required: true` in the requirement's `addressConfig`" but the implementer must verify the exact JSON path.
- Resolving DSX field requirements *per entry's countryId* (not globally per package) is the difference from Personal Info — Personal Info uses all available country pairs and ANDs across them; repeatable entries pin to the entry's own country.
- Education and Employment have no observed production bug. If the test proves the section turns red on missing required fields but real production data already satisfies the check, the change is silent in operation — that's correct, but the implementer must not trim tests on the assumption that "it never fires."

**`/build-feature` command:**
```
/build-feature TD-069 + TD-072: add per-entry required-field validation for Address History, Education, and Employment sections in the validation engine, and fix the IDV stale-formData leak on country switch. Mirror the TD-062 pattern in personalInfoIdvFieldChecks.ts: a new sibling helper repeatableSectionFieldChecks.ts walks each entry, resolves DSX field requirements for the entry's countryId, and emits FieldError rows for empty required fields. For address_block fields, descend into the JSON value and check addressConfig.required flags. Wire into validateAddressHistorySection, validateEducationSection, validateEmploymentSection. Regression tests must prove each section turns red when an entry has empty required fields. Separately, in IdvSection.tsx handleCountryChange, clear formData entries for the previous country's requirementIds before stashing the snapshot, with a regression test confirming the next save payload does not include orphaned requirementIds.
```

---

### Phase 3 (Cleanup branch) — Runs AFTER Phase 7 ships, BEFORE Phase 8 starts

**What it delivers:** `portal-layout.tsx` drops below the 600-line hard stop in preparation for Phase 8 additions. Pure refactor, no behavior change.

**Scope:**
- Extract `useCandidateSubmit(token)` hook owning `submitting` / `submitError` state and `handleSubmit` callback into `src/lib/candidate/submission/useCandidateSubmit.ts`.
- Extract section-rendering dispatch (`getActiveContent`) into a `<PortalSectionRenderer>` component.
- Extract saved-data hydration effect into a `useSavedDataHydration` hook.
- All existing portal-layout tests pass unchanged.
- Fold in TD-068 (test-file mock-fetch type errors) since the test-writer is already in that file.

**Depends on:** Phase 7 shipped (Phases 1 + 2 above merged to `dev`).

**Estimated size:** Medium (three extractions, all mechanical, but the file has many concerns to keep straight).

**Why not part of Phase 7:** Phase 7 ships when validation is correct. The portal-layout split is Phase-8-prep work, not Phase-7-closeout work. Bundling it forces a single PR to carry both correctness and refactor changes.

**`/build-feature` command:**
```
/build-feature Refactor portal-layout.tsx to drop below the 600-line hard stop. Extract useCandidateSubmit(token) hook owning submitting/submitError state and handleSubmit callback into src/lib/candidate/submission/useCandidateSubmit.ts. Extract the section-rendering dispatch into a <PortalSectionRenderer> component. Extract the saved-data hydration effect into a useSavedDataHydration hook. The shell file retains only top-level state composition and JSX layout. No behavior change. Also fix TD-068: update the test file's mock fetch returns to satisfy typeof fetch (use real Response instances or cast). All existing portal-layout tests must pass unchanged.
```

---

## Recommended Order

1. **Phase 1 (Stage 3a)** — engine split. Small, mechanical, sets the table.
2. **Phase 2 (Stage 3b)** — TD-069 + TD-072. The actual Phase 7 closeout. **Phase 7 ships when this merges.**
3. **Phase 3** — portal-layout split + TD-068. Runs after Phase 7 ships, before Phase 8 starts.

**Reasoning for the engine-split-first decision:** The argument for folding in is "avoid touching the file twice." The counter is stronger: a refactor with no behavior change has a clean review surface (existing tests are the bar), while TD-069 is a correctness fix with new tests. Mixing them creates a single PR where it's harder to tell whether a regression came from the split or the new logic. Doing the split first means TD-069 lands on a clean, sub-600-line file and the diff for the correctness fix is minimal.

---

## TD-072 Evidence Scan

The user has no user-research data on whether candidates switch IDV countries mid-flow. Evidence gathered:

- Nothing in `logs/combined.log` or `logs/error.log` confirming or refuting country-switching behavior.
- No analytics/telemetry hook on IDV country change.
- The IDV country picker is a plain `<Select>` (`IdvSection.tsx` ~83) allowing free re-selection with no warning dialog — UI does not discourage switching.

**Decision: include in Phase 2.** "No evidence either way" + small fix (~10 LOC) + correctness framing matches Andy's stated lean. Wrong-country data going to a vendor is a hard-to-detect failure mode downstream.

---

## Open Questions (must be answered in Phase 2's technical plan)

1. **`addressConfig` JSON shape** — Where exactly does the per-piece `required: true` flag live for address_block requirements? E.g., `requirement.fieldData.addressConfig.street1.required` vs `requirement.fieldData.addressConfig.fields.find(f => f.key === 'street1').required` vs something else. Architect must confirm via DB query before the spec is finalized.

2. **Per-entry country resolution for DSX requirements** — When the engine resolves required fields for an Education entry whose `countryId` is, say, GB, does it AND-aggregate across only the `(eduServiceId, GB)` pair, or across all `(eduServiceId, locationId)` pairs in the package's availability set? The Personal Info path uses *all* available pairs because Personal Info isn't country-scoped per entry; repeatable entries are. Recommended position: "AND across `(entryService.id × entry.countryId)` pairs only" but architect should confirm against the Stage 1 spec.

Both belong in the architect's technical plan for Phase 2, not implementer-time research.

---

## Explicit Deferrals

| Item | Verdict | Reason |
|---|---|---|
| **TD-061** — In-row FieldErrorMessage in repeatable rows | Defer | UX polish. Error visible in banner + Review page. Fold in when those component files (AddressHistorySection / EducationSection / EmploymentSection) are next refactored — likely Phase 8. |
| **TD-063** — Gap dates as ISO strings | Defer | i18n / UX polish. Belongs to a candidate portal i18n pass, not a Phase 7 correctness stage. |
| **TD-064** — Duplicated `resolveSectionLabelKey` helper | Defer | Code-quality nit, two files under 100 lines each. Fold in when either file is next touched. Not Phase-7-blocking. |
| **TD-065** — `validationEngine.ts` size | **Included as Phase 1** | Realized as Stage 3a. |
| **TD-066** — `scope/route.ts` returns English strings | Defer | i18n debt with a known broader pass. Touching it requires updating ScopeDisplay.tsx and five language files. Not Phase-7-blocking and not aligned with validation/closeout. |
| **TD-067** — `portal-layout.tsx` size | **Included as Phase 3** | Phase-8 prep, not Phase-7 closeout. Runs after Phase 7 ships. |
| **TD-068** — Test mock fetch type | **Folded into Phase 3** | Same file is being touched. |
| **TD-070** — Alias-set approach in `dateExtractors.ts` | Defer | Current alias-set works for today's package configurations. Cleanup belongs with TD-073, also deferred. |
| **TD-073** — Locale-dependent date extractor | Defer | Cosmetic per the audit — today's package configurations all use English names and recognized fieldKey aliases. No production trigger. Address before the first non-English package ships. |

---

## Files Referenced

- `src/lib/candidate/validation/validationEngine.ts`
- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`
- `src/lib/candidate/validation/dateExtractors.ts`
- `src/components/candidate/portal-layout.tsx`
- `src/components/candidate/form-engine/IdvSection.tsx`
- `docs/specs/phase7-stage1-validation-scope-gaps-review.md`
- `docs/specs/phase7-stage2-submission-order-generation.md`
- `docs/specs/candidate-invite-phase-plan.md`
- `docs/TECH_DEBT.md` (lines 1562–1875)
