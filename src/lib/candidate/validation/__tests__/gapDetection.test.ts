// /GlobalRX_v2/src/lib/candidate/validation/__tests__/gapDetection.test.ts
// Pass 1 unit tests for Phase 7 Stage 1:
// detectGaps — gap detection for Address History and Employment History timelines.
//
// These tests will FAIL when first run because the helper does not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md
//
// Coverage:
//   - Spec Rule 21:  gapToleranceDays semantics — null disables, 0 strict, positive
//                    integer is strict-greater-than tolerance.
//   - Spec Rule 22:  Gap = period between end of one entry and start of next, in
//                    calendar days.
//   - Spec Rule 23:  Entry with no end date treated as ending on the live current date.
//   - Spec Rule 24:  Gaps outside the scope period are ignored.
//   - Spec Rule 26:  Address History gap check verifies coverage from the start of
//                    the scope period; if the candidate's earliest entry is too recent,
//                    that's flagged as a gap at the beginning of the timeline.
//   - DoD 11–15:     Gap detection in address/employment timelines, gap tolerance
//                    semantics, scope-period filtering, current-entry handling.

import { describe, it, expect } from 'vitest';

import { detectGaps } from '../gapDetection';

// Pin "today" for deterministic tests (Rule 14 calls for live date in
// production; tests pass an explicit Date to keep the function pure).
const today = new Date('2026-05-05T00:00:00.000Z');

// ---------------------------------------------------------------------------
// gapToleranceDays semantics — Rule 21 / DoD 13
// ---------------------------------------------------------------------------

describe('detectGaps — gapToleranceDays semantics', () => {
  it('returns no gap errors when gapToleranceDays is null (gap checking disabled)', () => {
    // Even with a huge gap between entries, null tolerance disables gap checking entirely.
    const result = detectGaps(
      [
        { start: new Date('2018-01-01T00:00:00.000Z'), end: new Date('2018-12-31T00:00:00.000Z'), isCurrent: false },
        { start: new Date('2025-01-01T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      null,
      today,
      null
    );

    expect(result).toEqual([]);
  });

  it('flags any gap when gapToleranceDays is 0 (strict)', () => {
    // Even a one-day gap is flagged when tolerance is 0.
    const result = detectGaps(
      [
        { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2024-06-30T00:00:00.000Z'), isCurrent: false },
        { start: new Date('2024-07-02T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      0,
      today,
      null
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it('does not flag gaps strictly less than or equal to the positive tolerance', () => {
    // Tolerance of 30 — a 30-day gap (i.e., 30 calendar days between end and next start)
    // is NOT flagged. Only gaps strictly greater than 30 days are flagged.
    const result = detectGaps(
      [
        { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2024-06-01T00:00:00.000Z'), isCurrent: false },
        // 30 days later: 2024-07-01
        { start: new Date('2024-07-01T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      null
    );

    expect(result).toEqual([]);
  });

  it('flags gaps strictly greater than a positive tolerance', () => {
    // Tolerance 30 — 90-day gap should be flagged.
    const result = detectGaps(
      [
        { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2024-06-01T00:00:00.000Z'), isCurrent: false },
        // 90 days later: 2024-08-30
        { start: new Date('2024-08-30T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      null
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it('returns a gap error with messageKey, gapStart, gapEnd, gapDays (validation result shape)', () => {
    const result = detectGaps(
      [
        { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2024-06-01T00:00:00.000Z'), isCurrent: false },
        { start: new Date('2024-08-30T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      null
    );

    expect(result.length).toBeGreaterThan(0);
    const err = result[0];
    expect(err.messageKey).toMatch(/^candidate\.validation\.gap\./);
    expect(typeof err.gapStart).toBe('string');
    expect(typeof err.gapEnd).toBe('string');
    expect(typeof err.gapDays).toBe('number');
    expect(err.gapDays).toBeGreaterThan(30);
  });
});

// ---------------------------------------------------------------------------
// Current entry handling — Rule 23 / DoD 15
// ---------------------------------------------------------------------------

describe('detectGaps — current entries (no end date)', () => {
  it('treats an entry with no end date as ending on today (Rule 23)', () => {
    // Single current entry covering today — no gap before today.
    const result = detectGaps(
      [
        { start: new Date('2024-01-01T00:00:00.000Z'), end: null, isCurrent: true },
      ],
      30,
      today,
      null
    );

    expect(result).toEqual([]);
  });

  it('detects a gap that ends inside a current entry boundary correctly', () => {
    // Previous entry ends 2024-06-01, current entry starts 2025-01-01 (no end).
    // Gap is 7 months (>30 days) — must be flagged.
    const result = detectGaps(
      [
        { start: new Date('2023-01-01T00:00:00.000Z'), end: new Date('2024-06-01T00:00:00.000Z'), isCurrent: false },
        { start: new Date('2025-01-01T00:00:00.000Z'), end: null, isCurrent: true },
      ],
      30,
      today,
      null
    );

    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Scope period filtering — Rule 24 / DoD 14
// ---------------------------------------------------------------------------

describe('detectGaps — scope period filtering (Rule 24)', () => {
  it('ignores gaps entirely outside the scope period', () => {
    // Scope is past 7 years → from 2019-05-05.
    // The gap is between 2010 and 2012 entries — way before scope start.
    const scopeStart = new Date('2019-05-05T00:00:00.000Z');

    const result = detectGaps(
      [
        { start: new Date('2010-01-01T00:00:00.000Z'), end: new Date('2010-12-31T00:00:00.000Z'), isCurrent: false },
        // Big gap entirely before scope start
        { start: new Date('2019-05-05T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      scopeStart
    );

    expect(result).toEqual([]);
  });

  it('still flags gaps that fall inside the scope period', () => {
    const scopeStart = new Date('2019-05-05T00:00:00.000Z');

    const result = detectGaps(
      [
        { start: new Date('2019-05-05T00:00:00.000Z'), end: new Date('2021-01-01T00:00:00.000Z'), isCurrent: false },
        // 6-month gap inside scope window
        { start: new Date('2021-07-01T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      scopeStart
    );

    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Start-of-timeline (Address History) — Rule 26
// ---------------------------------------------------------------------------

describe('detectGaps — start-of-timeline gap (Rule 26)', () => {
  it('flags when the earliest entry starts after the scope period start', () => {
    // Scope is past 7 years → from 2019-05-05.
    // Earliest entry begins 2021-05-05 — 2 years too recent.
    const scopeStart = new Date('2019-05-05T00:00:00.000Z');

    const result = detectGaps(
      [
        { start: new Date('2021-05-05T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      scopeStart
    );

    expect(result.length).toBeGreaterThan(0);
  });

  it('does not flag a start-of-timeline gap when the earliest entry already covers the scope start', () => {
    const scopeStart = new Date('2019-05-05T00:00:00.000Z');

    const result = detectGaps(
      [
        { start: new Date('2018-05-05T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      scopeStart
    );

    expect(result).toEqual([]);
  });

  it('does not run the start-of-timeline check when scopePeriodStart is null (non-time-based scope)', () => {
    // For count-based / all scopes, scopePeriodStart should be null and the
    // start-of-timeline check should not produce errors based on coverage to
    // a particular date.
    const result = detectGaps(
      [
        { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      null
    );

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Sorting and multi-entry — Rule 22
// ---------------------------------------------------------------------------

describe('detectGaps — chronological sorting (Rule 22)', () => {
  it('sorts entries chronologically before computing gaps (input order should not matter)', () => {
    // Entries provided out of order — gap is 6 months (>30 days), must be flagged.
    const out = [
      { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2026-05-05T00:00:00.000Z'), isCurrent: false },
      { start: new Date('2020-01-01T00:00:00.000Z'), end: new Date('2023-06-30T00:00:00.000Z'), isCurrent: false },
    ];

    const result = detectGaps(out, 30, today, null);

    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Empty / single-entry inputs
// ---------------------------------------------------------------------------

describe('detectGaps — degenerate inputs', () => {
  it('returns no gap errors when given zero entries', () => {
    const result = detectGaps([], 30, today, null);

    expect(result).toEqual([]);
  });

  it('returns no inter-entry gap errors when given a single closed entry (no scope period)', () => {
    const result = detectGaps(
      [
        { start: new Date('2024-01-01T00:00:00.000Z'), end: new Date('2024-12-31T00:00:00.000Z'), isCurrent: false },
      ],
      30,
      today,
      null
    );

    expect(result).toEqual([]);
  });
});
