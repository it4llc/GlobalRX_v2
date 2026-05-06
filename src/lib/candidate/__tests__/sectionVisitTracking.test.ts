// /GlobalRX_v2/src/lib/candidate/__tests__/sectionVisitTracking.test.ts
//
// Phase 7 Stage 1 — Pass 2 unit tests for the pure visit-tracking helpers.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 1, 2, 3, 8, 11, 34; DoD 1, 2)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §1, §3.2

import { describe, it, expect } from 'vitest';

import {
  hasVisitedReviewPage,
  mergeReviewPageVisitedAt,
  mergeSectionVisits,
  shouldShowErrorsForSection,
  type SectionVisitsMap,
} from '../sectionVisitTracking';

describe('mergeSectionVisits', () => {
  describe('first visit semantics — Rule 1', () => {
    it('inserts a new section visit when none exists', () => {
      const result = mergeSectionVisits({}, [
        {
          sectionId: 'personal_info',
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: null,
        },
      ]);

      expect(result).toEqual({
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: null,
        },
      });
    });

    it('inserts multiple new sections in one call', () => {
      const result = mergeSectionVisits({}, [
        {
          sectionId: 'personal_info',
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: null,
        },
        {
          sectionId: 'address_history',
          visitedAt: '2026-05-06T10:01:00Z',
          departedAt: '2026-05-06T10:05:00Z',
        },
      ]);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result.personal_info.departedAt).toBeNull();
      expect(result.address_history.departedAt).toBe('2026-05-06T10:05:00Z');
    });

    it('treats undefined existing map as empty', () => {
      const result = mergeSectionVisits(undefined, [
        {
          sectionId: 'personal_info',
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: null,
        },
      ]);

      expect(result.personal_info).toBeDefined();
    });
  });

  describe('preserves the original visitedAt — Rule 2', () => {
    it('does not overwrite the existing visitedAt when a later visit comes in', () => {
      const existing: SectionVisitsMap = {
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: null,
        },
      };

      const result = mergeSectionVisits(existing, [
        {
          sectionId: 'personal_info',
          // Same section visited again later — visitedAt must remain the
          // original timestamp.
          visitedAt: '2026-05-07T10:00:00Z',
          departedAt: null,
        },
      ]);

      expect(result.personal_info.visitedAt).toBe('2026-05-06T10:00:00Z');
    });
  });

  describe('one-way departedAt — Rule 2 (DoD 1, 2)', () => {
    it('sets departedAt for the first time when previously null', () => {
      const existing: SectionVisitsMap = {
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: null,
        },
      };

      const result = mergeSectionVisits(existing, [
        {
          sectionId: 'personal_info',
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T10:30:00Z',
        },
      ]);

      expect(result.personal_info.departedAt).toBe('2026-05-06T10:30:00Z');
    });

    it('NEVER clears departedAt back to null once set (one-way flag)', () => {
      const existing: SectionVisitsMap = {
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T10:30:00Z',
        },
      };

      const result = mergeSectionVisits(existing, [
        {
          sectionId: 'personal_info',
          visitedAt: '2026-05-06T10:00:00Z',
          // Incoming null must NOT overwrite the existing non-null.
          departedAt: null,
        },
      ]);

      expect(result.personal_info.departedAt).toBe('2026-05-06T10:30:00Z');
    });

    it('takes the LATER timestamp when both existing and incoming departedAt are set', () => {
      const existing: SectionVisitsMap = {
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T10:30:00Z',
        },
      };

      const result = mergeSectionVisits(existing, [
        {
          sectionId: 'personal_info',
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T11:00:00Z', // later than existing
        },
      ]);

      expect(result.personal_info.departedAt).toBe('2026-05-06T11:00:00Z');
    });

    it('keeps the EARLIER existing timestamp when the incoming one is older', () => {
      const existing: SectionVisitsMap = {
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T11:00:00Z',
        },
      };

      const result = mergeSectionVisits(existing, [
        {
          sectionId: 'personal_info',
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T10:30:00Z', // earlier than existing
        },
      ]);

      // Existing is later, so it stays.
      expect(result.personal_info.departedAt).toBe('2026-05-06T11:00:00Z');
    });
  });

  describe('immutability', () => {
    it('does not mutate the input existing map', () => {
      const existing: SectionVisitsMap = {
        personal_info: {
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: null,
        },
      };
      const before = JSON.stringify(existing);

      mergeSectionVisits(existing, [
        {
          sectionId: 'personal_info',
          visitedAt: '2026-05-06T10:00:00Z',
          departedAt: '2026-05-06T10:30:00Z',
        },
      ]);

      expect(JSON.stringify(existing)).toBe(before);
    });
  });
});

describe('mergeReviewPageVisitedAt — Rule 3 (one-way flag)', () => {
  it('returns the incoming value when existing is null', () => {
    const result = mergeReviewPageVisitedAt(null, '2026-05-06T12:00:00Z');
    expect(result).toBe('2026-05-06T12:00:00Z');
  });

  it('returns the incoming value when existing is undefined', () => {
    const result = mergeReviewPageVisitedAt(undefined, '2026-05-06T12:00:00Z');
    expect(result).toBe('2026-05-06T12:00:00Z');
  });

  it('preserves the EARLIER existing value even when a later one arrives (Rule 3 one-way)', () => {
    // Once set, never reset — and the EARLIEST visit is what the spec calls
    // "the moment the candidate first visited the page". A later incoming
    // value must not overwrite it.
    const result = mergeReviewPageVisitedAt(
      '2026-05-06T12:00:00Z',
      '2026-05-07T15:00:00Z',
    );
    expect(result).toBe('2026-05-06T12:00:00Z');
  });

  it('preserves the existing value when incoming is null (Rule 3 — never clears)', () => {
    const result = mergeReviewPageVisitedAt('2026-05-06T12:00:00Z', null);
    expect(result).toBe('2026-05-06T12:00:00Z');
  });

  it('returns null when both are null/undefined', () => {
    expect(mergeReviewPageVisitedAt(null, null)).toBeNull();
    expect(mergeReviewPageVisitedAt(undefined, undefined)).toBeNull();
  });
});

describe('shouldShowErrorsForSection — Rules 4/8/34', () => {
  it('returns false when neither departedAt nor reviewPageVisitedAt is set', () => {
    const visits: SectionVisitsMap = {
      personal_info: {
        visitedAt: '2026-05-06T10:00:00Z',
        departedAt: null,
      },
    };

    expect(shouldShowErrorsForSection('personal_info', visits, null)).toBe(
      false,
    );
  });

  it('returns false when the section has never been visited and review not visited', () => {
    expect(shouldShowErrorsForSection('personal_info', {}, null)).toBe(false);
  });

  it('returns true when the section has been visited and departed', () => {
    const visits: SectionVisitsMap = {
      personal_info: {
        visitedAt: '2026-05-06T10:00:00Z',
        departedAt: '2026-05-06T10:30:00Z',
      },
    };

    expect(shouldShowErrorsForSection('personal_info', visits, null)).toBe(
      true,
    );
  });

  it('returns true for ALL sections when reviewPageVisitedAt is set (Rule 34)', () => {
    // Rule 34: visiting Review & Submit makes errors visible everywhere from
    // that point on, regardless of whether the section itself has been
    // departed. Even an EMPTY visits map must yield `true` if the review
    // flag is set.
    expect(
      shouldShowErrorsForSection(
        'never_visited_section',
        {},
        '2026-05-06T12:00:00Z',
      ),
    ).toBe(true);
    expect(
      shouldShowErrorsForSection(
        'never_visited_section',
        undefined,
        '2026-05-06T12:00:00Z',
      ),
    ).toBe(true);
  });

  it('returns true for a never-visited section when review has been visited (Rule 34)', () => {
    const visits: SectionVisitsMap = {
      address_history: {
        visitedAt: '2026-05-06T10:00:00Z',
        departedAt: '2026-05-06T10:30:00Z',
      },
    };

    expect(
      shouldShowErrorsForSection('idv', visits, '2026-05-06T12:00:00Z'),
    ).toBe(true);
  });
});

describe('hasVisitedReviewPage — Rule 3', () => {
  it('returns true for any non-null timestamp', () => {
    expect(hasVisitedReviewPage('2026-05-06T12:00:00Z')).toBe(true);
  });

  it('returns false for null', () => {
    expect(hasVisitedReviewPage(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(hasVisitedReviewPage(undefined)).toBe(false);
  });

  it('returns false for empty string (defensive)', () => {
    expect(hasVisitedReviewPage('')).toBe(false);
  });
});
