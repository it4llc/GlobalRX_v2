# Phase 7 Stage 3b: Per-Entry Required-Field Validation + IDV Country-Switch Cleanup

This document describes the correctness fixes delivered in Phase 7 Stage 3b. The stage bundles two unrelated tech debt items — TD-069 (per-entry required-field validation for repeatable sections) and TD-072 (IDV stale per-country form-data cleanup on country switch) — into a single shippable unit. Both items were identified during Phase 7 Stage 2 smoke testing and affect the accuracy of the candidate submission flow. No schema changes, no migrations, and no API contract changes were introduced.

## What Changed — TD-069 (Per-Entry Required-Field Validation)

Prior to this stage, the validation engine checked only entry count and date coverage for Address History, Education, and Employment. A candidate could save entries with required fields empty — for example, an address entry with only country and dates filled in — and the section would validate green. Stage 3b adds a per-entry required-field walk to each of the three repeatable-section validators. Each entry is evaluated against its own country's required-field rules (not a single section-wide country), and one `FieldError` is emitted per required-but-empty field. For `address_block` fields, the walk descends into the JSON value and checks each piece that is marked `required: true` in the requirement's `addressConfig`. An entry with no `countryId` produces a missing-country field error rather than being skipped silently.

## What Changed — TD-072 (IDV Country-Switch Cleanup)

Prior to this stage, switching IDV country stashed the previous country's form values under a synthetic `country_<countryId>` key but left the active `formData[<requirementId>]` entries in place. Those orphaned entries were included in the next save's `pendingSaves` payload and persisted under the new country's IDV section, causing vendors to receive field values that belonged to a different jurisdiction. Stage 3b rewrites `handleCountryChange` in `IdvSection` as a single `setFormData(prev => ...)` callback that clears all previous-country requirementId slots from `formData` before writing the snapshot and loading the new country's fields. The snapshot for re-hydration is preserved; the `idv_country` save record continues to be updated in the same save cycle.

## Architectural Notes

- **New module `repeatableEntryFieldChecks.ts`** — sibling validator in `src/lib/candidate/validation/` that owns the per-entry required-field walk for Address History, Education, and Employment. Follows the same structural re-declaration pattern as `personalInfoIdvFieldChecks.ts` (TD-077). Issues one batched `findMappings` call per section (covering all distinct entry-country pairs) rather than one query per entry.
- **`buildReviewSummary.ts` hoist** — the `buildReviewSummary` function was extracted from `validationEngine.ts` into a new sibling module to keep the engine file below the 600-line hard stop (engine is now 573 lines).
- **Loader extension (`requirementById` map)** — `loadValidationInputs.ts` now produces a `requirementById` Map (`requirementId → RequirementRecord`) from the already-loaded package-services include, passed to the section validators. No new database round-trip.
- **`IdvSection` `handleCountryChange` rewrite** — the country-change callback was consolidated from separate `setFormData` and `setPendingSaves` calls into a single `setFormData(prev => ...)` callback that reads exclusively from `prev`, eliminating the stale-closure source of the orphaned-save bug.

## What Did Not Change

No database schema changes were made and no migrations were written. The `POST /api/candidate/application/[token]/validate` and `POST /api/candidate/application/[token]/submit` endpoint response shapes are unchanged — `FullValidationResult` and its nested types are identical. The `runValidation` public signature is unchanged. The `personalInfoIdvFieldChecks.ts` file has zero diff. The `prisma/schema.prisma` file has zero diff.

## Known Limitations and Follow-Up

- **TD-082** — `evaluateTimeBasedScope` does not emit a scope error when a saved entry inside a time-bounded scope has null `startDate` and/or `endDate` fields. The DoD 9 test in `validationEngine.test.ts` was written as a forward indicator for this pre-existing behavior and intentionally left failing. Fixing the behavior requires a separate evaluation of whether null-date entries should produce a scope error or be rejected at the UI layer. This is not a regression introduced by Stage 3b.
- **TD-083** — The TD-072 country-switch cleanup race (typing into a country-X IDV field and switching to country Y before the debounced save fires) is not covered by a deterministic automated test. The two `IdvSection.test.tsx` tests for TD-072 serve as forward regression guards on the save-body shape; both pass on the parent commit and after the implementation because the fetch mock returns immediately-resolving promises. The actual cleanup behavior was verified by spec review and by the manual smoke test described in DoD 14. A deferred-promise race test is tracked under TD-083 for a future test-infrastructure pass.
- **TD-077 clarified** — TD-077 was updated to explicitly permit type exports between sibling validator helpers on the same side of the loader/validator boundary. The prohibition on shared cross-layer types modules remains strict. This clarification was prompted by `repeatableEntryFieldChecks.ts` exporting `PackageServiceWithRequirements`, which `validationEngine.ts` imports.

## Links

- Specification: `docs/specs/phase7-stage3b-per-entry-validation-and-idv-country-clear.md`
- Technical plan: `docs/plans/phase7-stage3b-technical-plan.md`
- Code review: `docs/reviews/phase7-stage3b-code-review.md`
- Standards check: not yet on file (standards-checker report was not produced before this documentation pass)
