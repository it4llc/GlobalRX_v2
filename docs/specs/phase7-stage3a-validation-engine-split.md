# Feature Specification: Phase 7 Stage 3a — Split `validationEngine.ts` (Extract `loadValidationInputs`)

**Spec file:** `docs/specs/phase7-stage3a-validation-engine-split.md`
**Date:** 2026-05-08
**Requested by:** Andy
**Status:** Confirmed

## Summary

Refactor `src/lib/candidate/validation/validationEngine.ts` (currently ~757 lines, exceeding the CODING_STANDARDS.md Section 9 hard stop of 600) by extracting all database-loading concerns into a new sibling module `src/lib/candidate/validation/loadValidationInputs.ts`. This is a pure, mechanical refactor with strict zero behavior change: every existing test must pass unchanged, every public export must keep its current signature, and no caller of `runValidation` may need an edit. The goal is to land the engine below 600 lines so that the next stage (3b — TD-069 per-entry required-field validation) can add new logic to a clean, sub-limit file.

## Who Uses This

This feature has no end-user surface. It is an internal code-organization change.

| Actor | What they do |
|---|---|
| Engineers maintaining the validation engine | Read a smaller, more focused `validationEngine.ts` whose single responsibility is orchestration. Reach for `loadValidationInputs.ts` when changing what the engine reads from the database. |
| Stage 3b implementer | Adds TD-069 (per-entry required-field validation for Address History, Education, Employment) to a file that is already under the 600-line hard stop. |

## Business Rules

These are the constraints the refactor must obey. They are the bar the test suite (unchanged) measures the result against.

1. **Zero behavior change.** The runtime behavior of `runValidation(invitationId)` must be identical before and after the refactor. Same inputs produce byte-identical outputs.
2. **No test file may be edited.** The existing test suite in `src/lib/candidate/validation/__tests__/` (and any other tests that exercise the engine) must pass without modification. Test counts before and after must be equal — same passing count, same failing count, same skipped count.
3. **Public API of `validationEngine.ts` is unchanged.** `runValidation` keeps its current name, parameter list (`invitationId: string`), and return type (`Promise<FullValidationResult>`). Any other currently-exported symbols from the engine remain exported with the same signatures. Callers (route handlers, the submission orchestrator, any other importers) must not require any edits.
4. **`validationEngine.ts` must drop below 600 lines** after the extraction (CODING_STANDARDS.md Section 9 hard stop).
5. **A new file `src/lib/candidate/validation/loadValidationInputs.ts` must exist** and own exactly four concerns:
   - The `prisma.candidateInvitation.findUnique` call (with the `include` shape currently in `validationEngine.ts` lines 116–139, identical and unchanged).
   - The `requirementMetadata` map population (currently `validationEngine.ts` lines 188–201).
   - The `servicesByType` grouping by functionality type (currently `validationEngine.ts` lines 166–181).
   - The `buildFindMappings` adapter (currently `validationEngine.ts` lines 734–756) — i.e., the closure that wraps `prisma.dSXMapping.findMany` and is consumed by `personalInfoIdvFieldChecks.ts`.
6. **`runValidation` becomes a thin orchestrator.** After the refactor, its body is essentially: capture `today`, call `loadValidationInputs(invitationId)`, dispatch to the per-section validators (`validateAddressHistorySection`, `validateEducationSection`, `validateEmploymentSection`, `validatePersonalInfoSection`, `validateIdvSection`, `buildWorkflowSectionResult`), and assemble the `FullValidationResult` via `buildReviewSummary`.
7. **The Prisma `include` shape is identical.** The loader passes the same `include` tree currently used at `validationEngine.ts` lines 116–139. No fields added, no fields removed. Moving code, not changing what is loaded.
8. **The `buildFindMappings` adapter's closure semantics are preserved.** The adapter currently captures the singleton `prisma` import in closure to keep `personalInfoIdvFieldChecks.ts` from importing `prisma` directly. The refactor must preserve this: either keep the adapter as a closure that captures the loader's `prisma` reference, OR accept `prisma` as an explicit parameter — the architect decides in Stage 2 (technical plan). Either way, the consumer (`personalInfoIdvFieldChecks.ts`) and its `FindDsxMappings`/`DsxMappingRow` types stay unchanged.
9. **No new fields, no new validators, no new section types.** The split touches only the four extracted concerns above. Per-section validators, status helpers, scope helpers, gap detection, date extractors, summary construction — all remain in `validationEngine.ts` (or wherever they live today) and are unchanged.
10. **No changes to `personalInfoIdvFieldChecks.ts`.** Its imports, types, and behavior are unaffected by this refactor.
11. **No database changes, no migrations.** This is code-organization only.
12. **TypeScript compiles cleanly.** `pnpm typecheck` returns zero errors that did not exist on the parent commit. No new `any`. No new unsafe casts beyond what already exists.
13. **Logging behavior preserved.** The existing `logger.warn('runValidation invoked on invitation without package', …)` call (currently `validationEngine.ts` lines 152–155) keeps its event name, message, and metadata. If the loader emits a similar warn when the invitation is missing, it must use the same logger and a sensible event name — but the architect should prefer keeping the `Error('Invitation not found: …')` throw in the same place it lives today (lines 141–143) to avoid reshaping error semantics.
14. **Status values remain lowercase strings** (project rule). No status string is touched by this refactor; this rule is restated for completeness.
15. **No changes to file naming convention.** The new module is `loadValidationInputs.ts` (camelCase, sibling to `validationEngine.ts`).

## User Flow

N/A — this refactor has no user-facing surface. The candidate's experience, the admin's experience, and every API response are byte-identical before and after.

The developer experience is:

1. An engineer opens `src/lib/candidate/validation/validationEngine.ts` and sees a file under 600 lines whose top-level function `runValidation` reads as a clear orchestrator: load inputs, validate each section, build summary, return.
2. When the engineer needs to change what the engine reads from the database, they open `src/lib/candidate/validation/loadValidationInputs.ts` instead.
3. When the engineer runs `pnpm vitest run`, every existing test still passes — proving the refactor preserved behavior.

## Data Requirements

N/A. There is no UI, no new database field, no new API field, no new schema. No data-shape table applies to this refactor.

For reference, the data shapes that already cross the boundary between the engine and its helpers (and which the new loader will produce) are unchanged:

- The Prisma return type of `prisma.candidateInvitation.findUnique` with the existing `include` (workflow, packageServices, serviceRequirements, availability).
- `Map<string, RequirementMetadata>` keyed by `requirementId`.
- `Map<ScopeFunctionalityType, PackageService[]>` keyed by functionality type.
- `FindDsxMappings` (the function type defined in `personalInfoIdvFieldChecks.ts`).

## Edge Cases and Error Scenarios

Because behavior cannot change, every edge case the engine handles today must continue to behave identically. Specifically:

1. **Invitation not found** — currently throws `Error('Invitation not found: ${invitationId}')` at the engine. After refactor: still throws the same error with the same message. The architect chooses whether the throw lives in the loader or the orchestrator; either choice is acceptable as long as the surface error is identical.
2. **Invitation has no package** — currently logs `event: 'candidate_validation_no_package'` at warn level and returns `emptyResult()`. After refactor: same log event, same message, same metadata, same return value. The architect chooses whether the no-package short-circuit lives in the loader or the orchestrator; either way the observable behavior is identical.
3. **Invitation's `formData` is null/undefined** — currently coerced to `{}` (line 145). After refactor: same coercion happens in the same conceptual place.
4. **Package has zero `packageServices`** — `requirementMetadata` is an empty Map and `servicesByType` is an empty Map. After refactor: same.
5. **A `serviceRequirement.requirement` row is null** — currently skipped via `if (!r) continue;`. After refactor: same skip in the loader.
6. **`fieldKey`, `name`, or `dataType` are not strings** — currently defaulted to `''`. After refactor: same defaulting, same Map population.
7. **`buildFindMappings` called with `pairs.length === 0`** — currently returns `[]` without hitting the database. After refactor: same short-circuit.
8. **`buildFindMappings` called with empty `requirementIds`** — currently omits the `requirementId IN (...)` filter so the query returns every mapping for the given pairs. After refactor: same query shape.
9. **TypeScript compile** — must remain green with no new errors. The new file imports `prisma`, the same Prisma `include` payload helper types, and any shared types it needs from `./types`, `./packageScopeShape`, `./dateExtractors`, and `./personalInfoIdvFieldChecks` (specifically `FindDsxMappings` / `DsxMappingRow`).

## Impact on Other Modules

None at runtime. Compile-time impact is limited to imports inside `src/lib/candidate/validation/`:

- `validationEngine.ts` adds an import from `./loadValidationInputs` and removes the directly-inlined database/grouping/adapter code.
- `loadValidationInputs.ts` is a new file; nothing else needs to import it (only the engine consumes it). Tests may optionally import it directly in the future, but no tests are added in this stage.
- `personalInfoIdvFieldChecks.ts` is unchanged.
- API routes and the submission orchestrator that call `runValidation` are unchanged.

## Definition of Done

1. New file `src/lib/candidate/validation/loadValidationInputs.ts` exists.
2. The four extracted concerns (Prisma `findUnique` + include, `requirementMetadata` map, `servicesByType` grouping, `buildFindMappings` adapter) have all been removed from `validationEngine.ts` and now live in `loadValidationInputs.ts`.
3. `validationEngine.ts` is below 600 lines per `wc -l`.
4. `pnpm vitest run` returns the same passing/failing/skipped counts as the parent commit (`origin/dev` HEAD at the time the branch was created). Raw bash output of test counts is captured in the implementer's checkpoint.
5. `pnpm typecheck` returns zero new errors relative to the parent commit.
6. `pnpm build` succeeds.
7. `pnpm lint` returns no new errors relative to the parent commit.
8. The Prisma `include` shape passed to `findUnique` is identical to the pre-refactor shape, verified by side-by-side diff.
9. The exported public API of `validationEngine.ts` is unchanged. `git diff` of import sites under `src/app/api/**`, `src/lib/candidate/submission/**`, and any other consumer paths shows zero edits.
10. `personalInfoIdvFieldChecks.ts` is unchanged. `git diff` confirms.
11. No test file under `src/lib/candidate/validation/__tests__/` (or any other tests that exercise the engine) has been edited. `git diff` confirms.
12. The `buildFindMappings` adapter's behavior is preserved: same query structure, same `pairs.length === 0` short-circuit, same conditional `requirementId IN (…)` filter.
13. No new use of `any`, no new `console.*` calls, no new inline styles (none expected — this is server code).
14. The branch `feature/phase7-stage3a-validation-engine-split` is ready for PR review with a green CI run.

## Open Questions

These are deliberately deferred to the Stage 2 (architect/technical-plan) step. The Business Analyst does not pre-decide them.

1. **Closure vs. parameter for `prisma` in `buildFindMappings`** — the adapter currently captures the module-level `prisma` import in closure. The architect decides whether to keep that closure inside `loadValidationInputs.ts` (preferred for minimal diff) or to refactor it to accept `prisma` as an explicit parameter. Either is acceptable per the spec; the test suite is the bar.
2. **Exact return shape of `loadValidationInputs(invitationId)`** — the architect decides whether the loader returns one aggregate object (`{ invitation, requirementMetadata, servicesByType, findMappings, gapToleranceDays, formData, … }`) or a tuple, and which derived values (e.g., `gapToleranceDays`, the `formData` cast, `sectionsData`, `sectionVisits`, `reviewVisitedAt`) belong in the loader vs. left in `runValidation`. The constraint is only that the four named concerns above move to the loader; anything else may move along with them at the architect's discretion as long as the engine drops below 600 lines and behavior does not change.
3. **Where the "invitation not found" throw and the "no package" warn-and-return short-circuits live** — loader or orchestrator. Either is acceptable as long as the externally observable error/log/return is byte-identical.
