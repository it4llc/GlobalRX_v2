# Standards Check Report: Phase 7 Stage 3b — Per-Entry Required-Field Validation + IDV Country-Switch Cleanup

**Date:** 2026-05-10
**Reviewer:** Standards Checker agent
**Branch:** `feature/phase7-stage3b-per-entry-validation-and-idv-country-clear`
**Source:** Reconstructed from session output. The original tool call to save this report did not land on disk; this file preserves the agent's findings from its hand-off summary for the PR audit trail.

## Summary

**PASS WITH MINOR ISSUES.**

- BLOCKER: 0
- MAJOR: 0
- MINOR / NIT: 2 (both classified as "Note — not blocking" per standards)

The standards-checker agent performed an independent pass against API_STANDARDS, CODING_STANDARDS, DATABASE_STANDARDS, COMPONENT_STANDARDS, and TESTING_STANDARDS on every modified or new file in Stage 3b. No blocking violations were found. The two findings below are informational per the standards docs themselves.

## Findings

### Note 1 — Import ordering in `src/lib/candidate/validation/repeatableEntryFieldChecks.ts:28–30`

- `@/lib/logger` (internal, group 3) appeared before `@prisma/client` (third-party, group 2) in the new file's import block.
- This reverses CODING_STANDARDS S2.3 import ordering and the sibling-file convention used in `loadValidationInputs.ts:23–26` and `personalInfoIdvFieldChecks.ts:34–35`, both of which have `@prisma/client` first.
- Per CODING_STANDARDS S2.3, mis-grouped imports are a Note, not blocking.
- **Status:** addressed in commit (import reorder, Stage 3b standards-fix commit).

### Note 2 — File size warning zone (informational only)

- `validationEngine.ts` ends Stage 3b at 573 lines (improved from 580 pre-Stage-3b due to the mandatory `buildReviewSummary` hoist removing ~17 lines).
- `IdvSection.tsx` ends Stage 3b at 555 lines (pre-existing; net-zero from Stage 3b's changes).
- Neither file exceeds the 600-line hard stop. Both sit in the informational warning zone.
- No action required for Stage 3b. Worth tracking for future stages.

## G1 Deviation Consistency Check

The code-reviewer's RATIFY decision on the G1 deviation (`PackageServiceWithRequirements` exported once from `repeatableEntryFieldChecks.ts` instead of being re-declared in two files) is **consistent with the standards docs as updated.**

The TD-077 clarification committed during Stage 3b explicitly permits sibling-validator type exports on the same side of the loader/validator boundary. The G1 case — `repeatableEntryFieldChecks.ts` exporting a structural alias that `validationEngine.ts` imports — fits this exception. Forcing a third structural copy would have grown the duplication count from 2 to 3, which is the opposite of what TD-077's spirit protects against.

## Verification of Code Reviewer's Findings

All code-reviewer findings independently confirmed, with one minor accuracy note:

- The code reviewer reported the `as any` Prisma mock cast at line 1726 of `validationEngine.test.ts` with "one occurrence." Actual location is lines 602–606, with two `any` tokens in the same `setupDsxMappingMock` helper. Both carry ESLint suppression comments and follow the pre-accepted Prisma mock convention from prior test code. Not a standards violation; flagged for accuracy.

## Required Actions Before Merge

None. The two Notes are informational and the standards docs explicitly classify them as non-blocking. Note 1 has been addressed by the import-reorder commit.

## Verdict

PASS WITH MINOR ISSUES. The implementation is ready for documentation/PR work.