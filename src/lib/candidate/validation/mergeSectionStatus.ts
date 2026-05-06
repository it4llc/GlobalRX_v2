// /GlobalRX_v2/src/lib/candidate/validation/mergeSectionStatus.ts
//
// Phase 7 Stage 1 — pure helper that merges a section's three possible
// status sources into the single value the sidebar should render.
//
// Spec: docs/specs/phase7-stage1-validation-scope-gaps-review.md (Rule 27)
//
// Why this helper exists
// ----------------------
// A section's status can come from up to three places:
//   • localStatus     — what the section component itself computed locally,
//                       typically with cross-section-registry awareness
//                       (e.g., computePersonalInfoStatus).
//   • validationStatus — what the server-side /validate engine returned.
//                       Aware of scope, gap, and document errors, but NOT
//                       aware of cross-section requirements.
//   • fallbackStatus  — the value the structure endpoint returned at page
//                       load. This is the seed before any computation has
//                       run.
//
// Neither side has the full picture on its own:
//   • Local can miss server-only errors (a scope shortfall the engine sees).
//   • Validation can miss local-only context (a cross-section requirement
//     the engine doesn't load).
//   • Local saying `not_started` while validation says `complete` happens
//     when the section was visited+departed but the local data is empty —
//     red is the correct UX answer.
//
// The merge rule (per the spec):
//   1. If either side is `incomplete` → `incomplete`. Most-restrictive wins.
//   2. If local is `not_started` AND validation is `complete` → `incomplete`.
//      The section was visited+departed (validation knew enough to call it
//      complete) but locally has no saved data — that's a red signal.
//   3. If validation says `complete` AND local says `complete` → `complete`.
//   4. Otherwise fall back: validationStatus ?? localStatus ?? fallbackStatus.

import type { SectionStatus } from '@/types/candidate-stage4';

/**
 * Inputs to `mergeSectionStatus`. All three may be undefined; the helper
 * returns the best signal available with a deterministic fallback.
 */
export interface MergeSectionStatusInput {
  /**
   * Status computed by the section component itself. Cross-section
   * registry-aware. `undefined` if the section hasn't reported in yet.
   */
  localStatus: SectionStatus | undefined;
  /**
   * Status returned by the /validate endpoint for this section. Aware of
   * scope/gap/document errors. `undefined` until the first /validate call
   * has resolved.
   */
  validationStatus: SectionStatus | undefined;
  /**
   * Default status from the structure endpoint at initial page load.
   * Currently always `not_started` from the structure endpoint, but the
   * helper does not assume that.
   */
  fallbackStatus: SectionStatus;
}

/**
 * Merge the three possible status sources into the value the sidebar
 * should render. See module-level comment for the rule list.
 */
export function mergeSectionStatus(input: MergeSectionStatusInput): SectionStatus {
  const { localStatus, validationStatus, fallbackStatus } = input;

  // Rule 1 — most-restrictive wins. Either side flagging incomplete is
  // sufficient; the cross-section registry is invisible to the engine and
  // the server's scope/gap checks are invisible to the local computation.
  if (localStatus === 'incomplete' || validationStatus === 'incomplete') {
    return 'incomplete';
  }

  // Rule 2 — server-side "complete" while local is "not_started" means the
  // section was visited+departed (otherwise the engine couldn't have said
  // anything stronger than not_started) but the local data is empty. Red.
  if (localStatus === 'not_started' && validationStatus === 'complete') {
    return 'incomplete';
  }

  // Rule 3 — both sides happy → green.
  if (localStatus === 'complete' && validationStatus === 'complete') {
    return 'complete';
  }

  // Rule 4 — defined-wins fallback chain.
  return validationStatus ?? localStatus ?? fallbackStatus;
}
