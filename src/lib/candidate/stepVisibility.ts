// /GlobalRX_v2/src/lib/candidate/stepVisibility.ts
//
// Task 8.5 — Silent Recalculation and Step Skipping.
//
// Spec:           docs/specs/silent-recalculation-step-skipping.md
// Technical plan: docs/plans/silent-recalculation-step-skipping-technical-plan.md
//
// Pure-function helper that decides which of the dynamic candidate-portal
// sections (Personal Info, Record Search Requirements) should be visible to
// the candidate based on the current state of three independent inputs the
// shell already owns:
//
//   1. The list of local Personal Info DSX fields (`personalInfoFields`).
//   2. The `subject`-target slice of the cross-section registry
//      (`subjectCrossSectionRequirements`).
//   3. The aggregated items computed from the candidate's current Address
//      History entries (`recordSearchAggregatedItems`).
//
// The two visibility decisions are computed independently — one for each
// dynamic step. No state, no I/O, no DOM. The shell consumes the result and
// filters its section list before driving the sidebar and Next/Back flow.

/**
 * Section ids the structure endpoint emits for the two dynamic steps the
 * candidate flow may skip. Used by both the shell (to look up
 * sections by id) and the filter helper below (to decide which entries to
 * drop). Frozen as a const-asserted object literal so the values cannot
 * drift at runtime.
 */
export const DYNAMIC_STEP_IDS = {
  PERSONAL_INFO: 'personal_info',
  RECORD_SEARCH: 'record_search',
} as const;

/**
 * Inputs for the dynamic-step visibility decision. Each field is a list,
 * and the helper only inspects its `length` — no value-level inspection is
 * needed because the upstream computations have already filtered out
 * irrelevant entries (Task 8.3 removes the four locked invitation
 * fieldKeys from `personalInfoFields`; the registry is already
 * `target='subject'`-filtered by the shell's memo; the aggregated items
 * list is already de-duped against Personal Info by
 * `computeAddressHistoryAggregatedItems`).
 */
export interface StepVisibilityInputs {
  /**
   * DSX field requirements pulled from `/personal-info-fields`. The shell
   * already owns this list. Used here only to count "is there at least one
   * subject-targeted local field?" — Task 8.3 filters out the four locked
   * invitation fieldKeys before reaching this list.
   */
  personalInfoFields: ReadonlyArray<{ requirementId: string }>;
  /**
   * `subject` target entries from the cross-section registry. The shell
   * already memoises this via `getCrossSectionRequirements(registry,
   * 'subject')`. Used only for length.
   */
  subjectCrossSectionRequirements: ReadonlyArray<unknown>;
  /**
   * Output of `computeAddressHistoryAggregatedItems` for the candidate's
   * current Address History entries. Used only for length.
   */
  recordSearchAggregatedItems: ReadonlyArray<unknown>;
}

/**
 * Boolean visibility flags for the two dynamic steps. The shell uses these
 * to filter its section list before driving the sidebar and Next/Back
 * navigation. `true` → step is visible; `false` → step is skipped.
 */
export interface StepVisibilityResult {
  /**
   * `true` when Personal Info has at least one local field OR at least one
   * cross-section subject requirement. `false` → step is skipped (Spec
   * Business Rule 5).
   */
  personalInfoVisible: boolean;
  /**
   * `true` when the aggregated-items list is non-empty. `false` → step is
   * skipped (Spec Business Rule 6).
   */
  recordSearchVisible: boolean;
}

/**
 * Decide whether each dynamic step should be visible.
 *
 * Merge logic (CODING_STANDARDS Section 8.4 — merge rules must be
 * documented):
 *   - Personal Info uses OR logic — if either local DSX fields exist or
 *     any cross-section subject requirement is registered, the step is
 *     visible. The most permissive rule wins so we never hide a step that
 *     has anything to ask the candidate. This mirrors the `requiredKeys`
 *     union in `computePersonalInfoStatus`.
 *   - Record Search has a single input source (the aggregated items list)
 *     and so reduces to a simple non-empty check.
 *
 * Pure: same inputs always produce the same outputs and the input arrays
 * are never mutated.
 */
export function computeDynamicStepVisibility(
  inputs: StepVisibilityInputs,
): StepVisibilityResult {
  const personalInfoVisible =
    inputs.personalInfoFields.length > 0 ||
    inputs.subjectCrossSectionRequirements.length > 0;
  const recordSearchVisible = inputs.recordSearchAggregatedItems.length > 0;
  return { personalInfoVisible, recordSearchVisible };
}

/**
 * Section descriptor shape consumed by `filterDynamicSteps`. Only `id` and
 * `type` are inspected, so any wider section type (e.g.,
 * `CandidatePortalSection` with status / order / serviceIds) satisfies the
 * constraint. The return type preserves the caller's narrower type via the
 * generic.
 */
type DynamicStepSection = { id: string; type: string };

/**
 * Filter a section list so that the two dynamic steps are removed when
 * their visibility flag is `false`. Every other section is left in place
 * and in its original order — workflow sections, service sections,
 * address_history, and review_submit are not subject to dynamic skipping
 * in this task.
 *
 * Pure: returns a new array; the input is never mutated.
 */
export function filterDynamicSteps<S extends DynamicStepSection>(
  sections: ReadonlyArray<S>,
  visibility: StepVisibilityResult,
): S[] {
  return sections.filter((section) => {
    if (
      section.id === DYNAMIC_STEP_IDS.PERSONAL_INFO &&
      !visibility.personalInfoVisible
    ) {
      return false;
    }
    if (
      section.id === DYNAMIC_STEP_IDS.RECORD_SEARCH &&
      !visibility.recordSearchVisible
    ) {
      return false;
    }
    return true;
  });
}
