// /GlobalRX_v2/src/lib/candidate/__tests__/stepVisibility.test.ts
//
// Pass 1 unit tests for Task 8.5 — Silent Recalculation and Step Skipping.
//
// These tests cover the pure-helper module the technical plan calls for:
//   - src/lib/candidate/stepVisibility.ts (NEW, authored by the implementer)
//
// Spec:           docs/specs/silent-recalculation-step-skipping.md
// Technical plan: docs/plans/silent-recalculation-step-skipping-technical-plan.md
//
// These tests will FAIL when first run because stepVisibility.ts does not
// exist yet. That is correct for Pass 1 TDD — the implementer's job is to
// make them pass.
//
// Coverage:
//   - Spec Business Rule 5 / DoD 5: Personal Info is skipped when no
//     subject-targeted fields exist (no local personalInfoFields AND no
//     cross-section subject requirements).
//   - Spec Business Rule 6 / DoD 6: Record Search Requirements is skipped
//     when no aggregated fields are produced from the candidate's current
//     address entries.
//   - Spec Business Rule 7 / DoD 7: A previously-skipped step becomes
//     visible when its inputs change so it now has content.
//   - Plan §4.1 OR-logic merge rule: `personalInfoVisible` is TRUE iff
//     `personalInfoFields.length > 0 OR
//     subjectCrossSectionRequirements.length > 0`. The most permissive rule
//     wins so we never hide a step that has anything to ask the candidate
//     (CODING_STANDARDS §8.4 — merge logic must be documented and tested).
//   - Plan §4.1 `filterDynamicSteps` contract: removes only the dynamic
//     sections (`personal_info`, `record_search`) when their visibility flag
//     is false. Leaves every other section (workflow, service, address
//     history, review_submit) untouched.
//   - Spec edge case 4: Both dynamic steps skipped — the resulting filtered
//     list contains neither id, allowing navigation to go straight from the
//     last non-dynamic section to Review & Submit.
//   - Plan §4.1 purity: `filterDynamicSteps` does not mutate its input.

import { describe, it, expect } from 'vitest';

import {
  DYNAMIC_STEP_IDS,
  computeDynamicStepVisibility,
  filterDynamicSteps,
} from '../stepVisibility';

// ---------------------------------------------------------------------------
// Small fixture helpers — kept inline because each test sets its own shape.
// ---------------------------------------------------------------------------

/** A minimal personal-info field row. The helper only inspects length. */
function makeFields(count: number): Array<{ requirementId: string }> {
  return Array.from({ length: count }, (_, i) => ({ requirementId: `req-${i}` }));
}

/** Subject cross-section requirements. The helper only inspects length. */
function makeSubjectReqs(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    fieldId: `sub-${i}`,
    fieldKey: `sub${i}`,
    fieldName: `Subject ${i}`,
    isRequired: true,
    triggeredBy: 'address_history',
    triggeredByEntryIndex: i,
  }));
}

/** Aggregated items list — the helper only inspects length. */
function makeAggregatedItems(count: number): unknown[] {
  return Array.from({ length: count }, (_, i) => ({
    requirementId: `agg-${i}`,
    fieldKey: `agg${i}`,
    fieldName: `Aggregated ${i}`,
  }));
}

// ---------------------------------------------------------------------------
// DYNAMIC_STEP_IDS — module-level constants
// ---------------------------------------------------------------------------

describe('DYNAMIC_STEP_IDS', () => {
  it('exports the section id "personal_info" for Personal Info (Step 7)', () => {
    expect(DYNAMIC_STEP_IDS.PERSONAL_INFO).toBe('personal_info');
  });

  it('exports the section id "record_search" for Record Search Requirements (Step 8)', () => {
    expect(DYNAMIC_STEP_IDS.RECORD_SEARCH).toBe('record_search');
  });
});

// ---------------------------------------------------------------------------
// computeDynamicStepVisibility
// ---------------------------------------------------------------------------

describe('computeDynamicStepVisibility', () => {
  // -------------------------------------------------------------------------
  // Personal Info visibility — OR-merged from two inputs (plan §4.1)
  // -------------------------------------------------------------------------

  describe('personalInfoVisible — OR merge of local fields and cross-section subject requirements', () => {
    it('is TRUE when personalInfoFields is non-empty and subjectCrossSectionRequirements is empty', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: makeFields(2),
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: [],
      });

      expect(result.personalInfoVisible).toBe(true);
    });

    it('is TRUE when personalInfoFields is empty and subjectCrossSectionRequirements is non-empty', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements: makeSubjectReqs(1),
        recordSearchAggregatedItems: [],
      });

      expect(result.personalInfoVisible).toBe(true);
    });

    it('is TRUE when both personalInfoFields and subjectCrossSectionRequirements are non-empty', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: makeFields(3),
        subjectCrossSectionRequirements: makeSubjectReqs(2),
        recordSearchAggregatedItems: [],
      });

      expect(result.personalInfoVisible).toBe(true);
    });

    it('is FALSE when BOTH personalInfoFields and subjectCrossSectionRequirements are empty (Business Rule 5)', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: [],
      });

      expect(result.personalInfoVisible).toBe(false);
    });

    it('treats one item in either source as sufficient to keep the step visible', () => {
      // Single-item edge of the OR rule — guards against an "off by one" /
      // ">=2" mistake on either branch.
      const oneLocal = computeDynamicStepVisibility({
        personalInfoFields: makeFields(1),
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: [],
      });
      const oneRegistry = computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements: makeSubjectReqs(1),
        recordSearchAggregatedItems: [],
      });

      expect(oneLocal.personalInfoVisible).toBe(true);
      expect(oneRegistry.personalInfoVisible).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Record Search visibility — single source (plan §4.1)
  // -------------------------------------------------------------------------

  describe('recordSearchVisible — driven by aggregated items length', () => {
    it('is TRUE when recordSearchAggregatedItems is non-empty', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: makeAggregatedItems(1),
      });

      expect(result.recordSearchVisible).toBe(true);
    });

    it('is FALSE when recordSearchAggregatedItems is empty (Business Rule 6)', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: makeFields(2),
        subjectCrossSectionRequirements: makeSubjectReqs(2),
        recordSearchAggregatedItems: [],
      });

      expect(result.recordSearchVisible).toBe(false);
    });

    it('counts every aggregated item, not just record-type or per-search items (helper only inspects length)', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: makeAggregatedItems(5),
      });

      expect(result.recordSearchVisible).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Independence — the two flags are computed separately
  // -------------------------------------------------------------------------

  describe('independence — Personal Info and Record Search are decided separately', () => {
    it('returns { personalInfoVisible: true, recordSearchVisible: false } when only Personal Info has content', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: makeFields(1),
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: [],
      });

      expect(result).toEqual({
        personalInfoVisible: true,
        recordSearchVisible: false,
      });
    });

    it('returns { personalInfoVisible: false, recordSearchVisible: true } when only Record Search has content', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: makeAggregatedItems(1),
      });

      expect(result).toEqual({
        personalInfoVisible: false,
        recordSearchVisible: true,
      });
    });

    it('returns both flags FALSE when nothing has content (spec edge case 4: both dynamic steps skipped)', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: [],
      });

      expect(result).toEqual({
        personalInfoVisible: false,
        recordSearchVisible: false,
      });
    });

    it('returns both flags TRUE when everything has content', () => {
      const result = computeDynamicStepVisibility({
        personalInfoFields: makeFields(2),
        subjectCrossSectionRequirements: makeSubjectReqs(2),
        recordSearchAggregatedItems: makeAggregatedItems(2),
      });

      expect(result).toEqual({
        personalInfoVisible: true,
        recordSearchVisible: true,
      });
    });
  });

  // -------------------------------------------------------------------------
  // Purity — same inputs produce the same outputs, no input mutation
  // -------------------------------------------------------------------------

  describe('purity', () => {
    it('returns the same shape when called twice with the same inputs', () => {
      const inputs = {
        personalInfoFields: makeFields(2),
        subjectCrossSectionRequirements: makeSubjectReqs(1),
        recordSearchAggregatedItems: makeAggregatedItems(3),
      };
      const a = computeDynamicStepVisibility(inputs);
      const b = computeDynamicStepVisibility(inputs);
      expect(a).toEqual(b);
    });

    it('does not mutate the personalInfoFields input array', () => {
      const personalInfoFields = makeFields(2);
      const before = [...personalInfoFields];

      computeDynamicStepVisibility({
        personalInfoFields,
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems: [],
      });

      expect(personalInfoFields).toEqual(before);
    });

    it('does not mutate the subjectCrossSectionRequirements input array', () => {
      const subjectCrossSectionRequirements = makeSubjectReqs(2);
      const before = [...subjectCrossSectionRequirements];

      computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements,
        recordSearchAggregatedItems: [],
      });

      expect(subjectCrossSectionRequirements).toEqual(before);
    });

    it('does not mutate the recordSearchAggregatedItems input array', () => {
      const recordSearchAggregatedItems = makeAggregatedItems(2);
      const before = [...recordSearchAggregatedItems];

      computeDynamicStepVisibility({
        personalInfoFields: [],
        subjectCrossSectionRequirements: [],
        recordSearchAggregatedItems,
      });

      expect(recordSearchAggregatedItems).toEqual(before);
    });
  });
});

// ---------------------------------------------------------------------------
// filterDynamicSteps
// ---------------------------------------------------------------------------

describe('filterDynamicSteps', () => {
  /**
   * A representative 9-step section list. The order matches the post-Task 8.2
   * linear flow:
   *   before_services (workflow) → idv (service) → address_history (record) →
   *   education (service) → employment (service) → personal_info (dynamic) →
   *   record_search (dynamic) → after_services (workflow) → review_submit
   */
  const fullSectionList: ReadonlyArray<{ id: string; type: string }> = [
    { id: 'wf-welcome', type: 'workflow_section' },
    { id: 'svc-idv', type: 'service_section' },
    { id: 'address_history', type: 'service_section' },
    { id: 'svc-edu', type: 'service_section' },
    { id: 'svc-emp', type: 'service_section' },
    { id: 'personal_info', type: 'personal_info' },
    { id: 'record_search', type: 'record_search' },
    { id: 'wf-thanks', type: 'workflow_section' },
    { id: 'review_submit', type: 'review_submit' },
  ];

  // -------------------------------------------------------------------------
  // No-op cases
  // -------------------------------------------------------------------------

  describe('no-op cases — every dynamic step is visible', () => {
    it('returns the full list unchanged when both flags are TRUE', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: true,
        recordSearchVisible: true,
      });

      expect(result.map((s) => s.id)).toEqual(fullSectionList.map((s) => s.id));
    });

    it('keeps both personal_info and record_search in the output when both flags are TRUE', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: true,
        recordSearchVisible: true,
      });

      expect(result.find((s) => s.id === 'personal_info')).toBeDefined();
      expect(result.find((s) => s.id === 'record_search')).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Personal Info skip
  // -------------------------------------------------------------------------

  describe('Business Rule 5 — Personal Info is hidden when personalInfoVisible is FALSE', () => {
    it('removes the personal_info section when personalInfoVisible is FALSE', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: false,
        recordSearchVisible: true,
      });

      expect(result.find((s) => s.id === 'personal_info')).toBeUndefined();
    });

    it('preserves the record_search section when only personal_info should be hidden', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: false,
        recordSearchVisible: true,
      });

      expect(result.find((s) => s.id === 'record_search')).toBeDefined();
    });

    it('preserves every non-dynamic section (workflow, service, address_history, review_submit) when personal_info is hidden', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: false,
        recordSearchVisible: true,
      });

      const remainingIds = result.map((s) => s.id);
      expect(remainingIds).toContain('wf-welcome');
      expect(remainingIds).toContain('svc-idv');
      expect(remainingIds).toContain('address_history');
      expect(remainingIds).toContain('svc-edu');
      expect(remainingIds).toContain('svc-emp');
      expect(remainingIds).toContain('wf-thanks');
      expect(remainingIds).toContain('review_submit');
    });

    it('preserves the relative ordering of the non-dynamic sections', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: false,
        recordSearchVisible: true,
      });

      // The order of non-dynamic ids in the filtered list must match their
      // order in the input list. Filtering must not reorder anything.
      const filteredIds = result.map((s) => s.id);
      const nonDynamicIds = fullSectionList
        .filter((s) => s.id !== 'personal_info' && s.id !== 'record_search')
        .map((s) => s.id);
      const filteredNonDynamic = filteredIds.filter((id) => nonDynamicIds.includes(id));
      expect(filteredNonDynamic).toEqual(nonDynamicIds);
    });
  });

  // -------------------------------------------------------------------------
  // Record Search skip
  // -------------------------------------------------------------------------

  describe('Business Rule 6 — Record Search is hidden when recordSearchVisible is FALSE', () => {
    it('removes the record_search section when recordSearchVisible is FALSE', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: true,
        recordSearchVisible: false,
      });

      expect(result.find((s) => s.id === 'record_search')).toBeUndefined();
    });

    it('preserves the personal_info section when only record_search should be hidden', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: true,
        recordSearchVisible: false,
      });

      expect(result.find((s) => s.id === 'personal_info')).toBeDefined();
    });

    it('preserves every non-dynamic section when record_search is hidden', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: true,
        recordSearchVisible: false,
      });

      const remainingIds = result.map((s) => s.id);
      expect(remainingIds).toContain('wf-welcome');
      expect(remainingIds).toContain('svc-idv');
      expect(remainingIds).toContain('address_history');
      expect(remainingIds).toContain('svc-edu');
      expect(remainingIds).toContain('svc-emp');
      expect(remainingIds).toContain('wf-thanks');
      expect(remainingIds).toContain('review_submit');
    });
  });

  // -------------------------------------------------------------------------
  // Both dynamic steps hidden (spec edge case 4)
  // -------------------------------------------------------------------------

  describe('spec edge case 4 — both dynamic steps hidden', () => {
    it('removes both personal_info and record_search when both flags are FALSE', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: false,
        recordSearchVisible: false,
      });

      expect(result.find((s) => s.id === 'personal_info')).toBeUndefined();
      expect(result.find((s) => s.id === 'record_search')).toBeUndefined();
    });

    it('leaves the navigation flow as ...after_services → review_submit when both dynamic steps are hidden', () => {
      // Spec edge case 4: "Navigation goes from Step 6 directly to Step 9."
      // After filtering, the workflow_section "wf-thanks" (the after-services
      // workflow) must be followed immediately by review_submit — with no
      // dynamic step in between.
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: false,
        recordSearchVisible: false,
      });

      const ids = result.map((s) => s.id);
      const thanksIndex = ids.indexOf('wf-thanks');
      const reviewIndex = ids.indexOf('review_submit');
      expect(thanksIndex).toBeGreaterThanOrEqual(0);
      expect(reviewIndex).toBe(thanksIndex + 1);
    });

    it('preserves every non-dynamic section in original order when both dynamic steps are hidden', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: false,
        recordSearchVisible: false,
      });

      expect(result.map((s) => s.id)).toEqual([
        'wf-welcome',
        'svc-idv',
        'address_history',
        'svc-edu',
        'svc-emp',
        'wf-thanks',
        'review_submit',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Edge case 5 — only one of the two is skipped
  // -------------------------------------------------------------------------

  describe('spec edge case 5 — only one of the two dynamic steps is skipped', () => {
    it('preserves record_search between employment and after_services when personal_info is hidden', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: false,
        recordSearchVisible: true,
      });

      const ids = result.map((s) => s.id);
      expect(ids.indexOf('svc-emp')).toBeLessThan(ids.indexOf('record_search'));
      expect(ids.indexOf('record_search')).toBeLessThan(ids.indexOf('wf-thanks'));
    });

    it('preserves personal_info between employment and after_services when record_search is hidden', () => {
      const result = filterDynamicSteps(fullSectionList, {
        personalInfoVisible: true,
        recordSearchVisible: false,
      });

      const ids = result.map((s) => s.id);
      expect(ids.indexOf('svc-emp')).toBeLessThan(ids.indexOf('personal_info'));
      expect(ids.indexOf('personal_info')).toBeLessThan(ids.indexOf('wf-thanks'));
    });
  });

  // -------------------------------------------------------------------------
  // Purity — no mutation of the input section list
  // -------------------------------------------------------------------------

  describe('purity', () => {
    it('does not mutate the input section list (filterDynamicSteps is pure)', () => {
      const input = fullSectionList.map((s) => ({ ...s }));
      const inputSnapshot = input.map((s) => ({ ...s }));

      filterDynamicSteps(input, {
        personalInfoVisible: false,
        recordSearchVisible: false,
      });

      expect(input).toEqual(inputSnapshot);
    });

    it('returns the same result when called twice with the same inputs', () => {
      const visibility = {
        personalInfoVisible: false,
        recordSearchVisible: true,
      };
      const a = filterDynamicSteps(fullSectionList, visibility);
      const b = filterDynamicSteps(fullSectionList, visibility);
      expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
    });
  });

  // -------------------------------------------------------------------------
  // No incidental section type filtering — non-dynamic ids never disappear
  // -------------------------------------------------------------------------

  describe('only personal_info and record_search are subject to dynamic filtering', () => {
    it('never removes a workflow_section, service_section, address_history, or review_submit entry', () => {
      // Try every combination of the two flags — the four non-dynamic ids
      // must always survive.
      const variants: Array<{ personalInfoVisible: boolean; recordSearchVisible: boolean }> = [
        { personalInfoVisible: true, recordSearchVisible: true },
        { personalInfoVisible: true, recordSearchVisible: false },
        { personalInfoVisible: false, recordSearchVisible: true },
        { personalInfoVisible: false, recordSearchVisible: false },
      ];

      for (const visibility of variants) {
        const result = filterDynamicSteps(fullSectionList, visibility);
        const ids = result.map((s) => s.id);

        expect(ids).toContain('wf-welcome');
        expect(ids).toContain('svc-idv');
        expect(ids).toContain('address_history');
        expect(ids).toContain('svc-edu');
        expect(ids).toContain('svc-emp');
        expect(ids).toContain('wf-thanks');
        expect(ids).toContain('review_submit');
      }
    });

    it('returns the empty list when given an empty list (defensive)', () => {
      const result = filterDynamicSteps([], {
        personalInfoVisible: false,
        recordSearchVisible: false,
      });

      expect(result).toEqual([]);
    });
  });
});
