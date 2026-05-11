// /GlobalRX_v2/src/lib/candidate/validation/buildReviewSummary.ts
//
// Phase 7 Stage 3b — pure helper hoisted out of `validationEngine.ts` to
// keep the engine well below the 600-line hard stop in CODING_STANDARDS.md
// Section 9.4. The hoist is part of the Stage 3b implementation contract
// (architect's plan §2.3.3); behavior is byte-identical to the previous
// inlined definition.
//
// Spec:           docs/specs/phase7-stage3b-per-entry-validation-and-idv-country-clear.md
// Technical plan: docs/plans/phase7-stage3b-technical-plan.md §2.3.3
//
// `buildReviewSummary` walks the per-section validation results and folds
// every error kind (field, scope, gap, document) into a single ordered
// list keyed by sectionId. The Review page renders the result; the
// validate route returns it as the response payload's `summary` field.

import type {
  ReviewError,
  ReviewPageSummary,
  SectionValidationResult,
} from './types';

export function buildReviewSummary(
  sectionResults: SectionValidationResult[],
): ReviewPageSummary {
  let totalErrors = 0;
  const sections = sectionResults.map((sr) => {
    const errors: ReviewError[] = [];
    for (const fe of sr.fieldErrors) {
      errors.push({
        kind: 'field',
        fieldName: fe.fieldName,
        messageKey: fe.messageKey,
        placeholders: fe.placeholders,
      });
    }
    for (const se of sr.scopeErrors) {
      errors.push({
        kind: 'scope',
        messageKey: se.messageKey,
        placeholders: se.placeholders,
      });
    }
    for (const ge of sr.gapErrors) {
      errors.push({
        kind: 'gap',
        messageKey: ge.messageKey,
        placeholders: ge.placeholders,
        gapStart: ge.gapStart,
        gapEnd: ge.gapEnd,
      });
    }
    for (const de of sr.documentErrors) {
      errors.push({
        kind: 'document',
        requirementId: de.requirementId,
        documentNameKey: de.documentNameKey,
      });
    }
    totalErrors += errors.length;
    return {
      sectionId: sr.sectionId,
      // sectionName is filled in by the API route layer, which has access
      // to the section title strings. The engine itself only knows IDs.
      sectionName: sr.sectionId,
      status: sr.status,
      errors,
    };
  });

  return {
    sections,
    allComplete: sectionResults.every((sr) => sr.status === 'complete'),
    totalErrors,
  };
}
