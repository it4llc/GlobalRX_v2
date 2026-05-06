// /GlobalRX_v2/src/lib/candidate/validation/__tests__/scopeValidation.test.ts
// Pass 1 unit tests for Phase 7 Stage 1:
// Scope validation — count-based and time-based.
//
// These tests will FAIL when first run because the helpers do not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md
//
// Coverage:
//   - Spec Rule 13: Scope types — count exact / count specific / time-based / all.
//   - Spec Rule 14: "Today" is the live current date when validation runs.
//   - Spec Rule 15: Time-based coverage merges overlapping ranges (overlap counted once).
//   - Spec Rule 16: Count-based scope counts the number of entries (regardless of
//                   whether the entries are fully filled in).
//   - Spec Rule 12: A multi-entry section with zero entries shows the appropriate
//                   "0 entered" wording (zero-entry case is handled by the validator).
//   - Spec Edge 2:  Overlapping date ranges — coverage counts the overlapping time
//                   only once. No error is raised purely for the overlap.
//   - DoD 9:        Count-based scope validation works for "most recent," "most
//                   recent N," and "all" scopes.
//   - DoD 10:       Time-based scope validation correctly calculates coverage period
//                   using the live current date.

import { describe, it, expect } from 'vitest';

import {
  evaluateCountScope,
  evaluateTimeBasedScope,
} from '../scopeValidation';

// ---------------------------------------------------------------------------
// evaluateCountScope — Rules 13, 16, 12 / DoD 9
// ---------------------------------------------------------------------------

describe('evaluateCountScope', () => {
  describe('count_exact', () => {
    it('returns no errors when entry count exactly matches required count of 1', () => {
      const errors = evaluateCountScope(
        { scopeType: 'count_exact', scopeValue: 1 },
        [{ entryOrder: 0 }]
      );

      expect(errors).toEqual([]);
    });

    it('returns a scope error when zero entries are provided and count_exact requires 1', () => {
      const errors = evaluateCountScope(
        { scopeType: 'count_exact', scopeValue: 1 },
        []
      );

      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns a scope error when more entries than required are provided', () => {
      const errors = evaluateCountScope(
        { scopeType: 'count_exact', scopeValue: 1 },
        [{ entryOrder: 0 }, { entryOrder: 1 }]
      );

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('count_specific', () => {
    it('returns no errors when entry count exactly equals the required count', () => {
      const errors = evaluateCountScope(
        { scopeType: 'count_specific', scopeValue: 2 },
        [{ entryOrder: 0 }, { entryOrder: 1 }]
      );

      expect(errors).toEqual([]);
    });

    it('returns a scope error when entries are fewer than required (Rule 16 — fill-state irrelevant)', () => {
      // Even completely empty entries count toward the total (Rule 16).
      const errors = evaluateCountScope(
        { scopeType: 'count_specific', scopeValue: 3 },
        [{ entryOrder: 0 }]
      );

      expect(errors.length).toBeGreaterThan(0);
    });

    it('returns a scope error with a translation key (Rule 36)', () => {
      const errors = evaluateCountScope(
        { scopeType: 'count_specific', scopeValue: 3 },
        [{ entryOrder: 0 }]
      );

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].messageKey).toMatch(/^candidate\.validation\.scope\./);
    });

    it('produces placeholder values reporting required and actual counts', () => {
      const errors = evaluateCountScope(
        { scopeType: 'count_specific', scopeValue: 3 },
        [{ entryOrder: 0 }]
      );

      expect(errors.length).toBeGreaterThan(0);
      const placeholders = errors[0].placeholders;
      // placeholders should expose the required count and the actual count
      // somewhere — exact key names follow the translation key shape from
      // technical plan Section 8.2 (`{required}` / `{actual}`).
      expect(placeholders).toBeDefined();
    });
  });

  describe('all', () => {
    it('returns no errors when at least one entry exists for an `all` scope', () => {
      const errors = evaluateCountScope(
        { scopeType: 'all', scopeValue: null },
        [{ entryOrder: 0 }]
      );

      expect(errors).toEqual([]);
    });

    it('returns a scope error when zero entries exist for an `all` scope (Rule 13 — at least 1 required)', () => {
      const errors = evaluateCountScope(
        { scopeType: 'all', scopeValue: null },
        []
      );

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('Rule 12 — multi-entry section with zero entries', () => {
    it('emits a scope error when count_specific has zero entries', () => {
      const errors = evaluateCountScope(
        { scopeType: 'count_specific', scopeValue: 5 },
        []
      );

      expect(errors.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// evaluateTimeBasedScope — Rules 13, 14, 15, Edge 2 / DoD 10
// ---------------------------------------------------------------------------

describe('evaluateTimeBasedScope', () => {
  // Pin "today" for deterministic tests (Rule 14 calls for live date in
  // production; tests pass an explicit Date to keep the function pure).
  const today = new Date('2026-05-05T00:00:00.000Z');

  it('returns no errors when entries collectively cover the full required period', () => {
    // Required: 7 years back from 2026-05-05 → from 2019-05-05.
    const result = evaluateTimeBasedScope(
      { scopeType: 'time_based', scopeValue: 7 },
      [
        { start: new Date('2018-01-01T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      today
    );

    expect(result.errors).toEqual([]);
  });

  it('returns a scope error when entries do not reach back far enough', () => {
    // Required 7 years; entry only covers most recent 3 years.
    const result = evaluateTimeBasedScope(
      { scopeType: 'time_based', scopeValue: 7 },
      [
        { start: new Date('2023-05-05T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      today
    );

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('treats overlapping entries as a single union of intervals (Rule 15 / Edge 2)', () => {
    // Two overlapping entries — the overlap must count once. Combined coverage
    // 2018-01-01 to 2026-05-05 (~8 years) is enough for 7 years.
    const result = evaluateTimeBasedScope(
      { scopeType: 'time_based', scopeValue: 7 },
      [
        { start: new Date('2018-01-01T00:00:00.000Z'), end: new Date('2022-12-31T00:00:00.000Z'), isCurrent: false },
        { start: new Date('2021-06-01T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      today
    );

    expect(result.errors).toEqual([]);
  });

  it('treats a current entry (no end date) as ending on today (Rule 23)', () => {
    // 8 years ago to "current" — covers 7-year scope when treated as ending today.
    const result = evaluateTimeBasedScope(
      { scopeType: 'time_based', scopeValue: 7 },
      [
        { start: new Date('2018-01-01T00:00:00.000Z'), end: null, isCurrent: true },
      ],
      today
    );

    expect(result.errors).toEqual([]);
  });

  it('returns coveredDays and requiredDays so the banner can show duration', () => {
    const result = evaluateTimeBasedScope(
      { scopeType: 'time_based', scopeValue: 7 },
      [
        { start: new Date('2023-05-05T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      today
    );

    expect(typeof result.coveredDays).toBe('number');
    expect(typeof result.requiredDays).toBe('number');
    expect(result.coveredDays).toBeGreaterThanOrEqual(0);
    expect(result.requiredDays).toBeGreaterThan(0);
  });

  it('returns a scope error with a translation key (Rule 36)', () => {
    const result = evaluateTimeBasedScope(
      { scopeType: 'time_based', scopeValue: 7 },
      [
        { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      today
    );

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].messageKey).toMatch(/^candidate\.validation\.scope\./);
  });

  it('returns a scope error when zero entries are provided for a time-based scope', () => {
    const result = evaluateTimeBasedScope(
      { scopeType: 'time_based', scopeValue: 7 },
      [],
      today
    );

    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('produces a coveredDays of 0 when zero entries are provided', () => {
    const result = evaluateTimeBasedScope(
      { scopeType: 'time_based', scopeValue: 7 },
      [],
      today
    );

    expect(result.coveredDays).toBe(0);
  });
});
