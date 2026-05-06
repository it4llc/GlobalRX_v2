// /GlobalRX_v2/src/lib/candidate/validation/validateWorkflowSection.ts
//
// Phase 7 Stage 1 — pure helper that derives the validation status for a
// workflow section (the acknowledgment-style sections defined on a Workflow).
//
// Spec: docs/specs/phase7-stage1-validation-scope-gaps-review.md (Rule 27)
//
// The validation engine itself does not load DSXMapping data for workflow
// sections — workflow sections do not use mappings. Their "required field"
// is a single boolean acknowledgment captured in
// formData.sections[sectionId].fields[0].value.acknowledged. This helper
// turns the WorkflowSection.isRequired flag plus the persisted ack value
// plus the visit signal into the right `not_started | incomplete | complete`
// per Rule 27.

import type { ValidationStatus } from './types';

/**
 * Inputs for `validateWorkflowSection`. All three are typed precisely — no
 * `any` and no overly-broad `unknown`. The caller (the validation engine)
 * pulls each value from the data it has already loaded.
 */
export interface ValidateWorkflowSectionInput {
  /**
   * Whether this workflow section is marked required by the workflow author.
   * Mirrors `WorkflowSection.isRequired` from the Prisma schema.
   */
  isRequired: boolean;
  /**
   * Whether the candidate ticked the acknowledgment checkbox. The shape is
   * read from `formData.sections[sectionId].fields[0].value.acknowledged`,
   * which the engine flattens into a boolean before calling this helper.
   * `undefined` means no save has happened yet.
   */
  acknowledged: boolean | undefined;
  /**
   * True when the section has a persisted visit record (visited at least
   * once). The engine reads `formData.sectionVisits[sectionId]` and passes
   * the truthy/falsy signal here.
   */
  hasVisit: boolean;
  /**
   * True when the section's most recent visit has been departed from. Per
   * Rule 27, errors only become visible once a section is "visited and
   * departed" (or once Review & Submit has been visited). This is
   * `sectionVisits[sectionId].departedAt !== null`.
   */
  hasDeparted: boolean;
  /**
   * True when the candidate has visited the Review & Submit page at least
   * once. Per Rule 34, this flips the section's errors to "visible" even
   * if the section itself was never departed.
   */
  reviewVisited: boolean;
}

/**
 * Returns the correct `ValidationStatus` for a workflow section per Rule 27.
 *
 * The decision tree:
 *   1. If never visited AND no acknowledgment data → `not_started`.
 *   2. If the section is not required → `complete` (the candidate is allowed
 *      to skip it — green by default once visible at all).
 *   3. If acknowledged → `complete`.
 *   4. Otherwise the section IS required AND not acknowledged. We only
 *      surface this as `incomplete` once errors are eligible to show
 *      (visited+departed OR Review visited). Until then we keep it
 *      `not_started` so the sidebar doesn't go red prematurely (matches the
 *      spec's "errors are not visible until visited and departed" rule).
 */
export function validateWorkflowSection(
  input: ValidateWorkflowSectionInput,
): ValidationStatus {
  const acknowledged = input.acknowledged === true;
  const hasAnyData = input.acknowledged !== undefined;

  if (!input.hasVisit && !hasAnyData && !input.reviewVisited) {
    return 'not_started';
  }

  if (!input.isRequired) {
    return 'complete';
  }

  if (acknowledged) {
    return 'complete';
  }

  // Required + not acknowledged. Only red if errors are eligible to show.
  const errorsEligible =
    (input.hasVisit && input.hasDeparted) || input.reviewVisited;
  return errorsEligible ? 'incomplete' : 'not_started';
}
