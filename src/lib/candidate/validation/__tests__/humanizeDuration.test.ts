// /GlobalRX_v2/src/lib/candidate/validation/__tests__/humanizeDuration.test.ts
// Pass 1 unit tests for Phase 7 Stage 1:
// daysToHumanParts — converts a number of days into translation-ready
// {years, months, days} placeholder values.
//
// These tests will FAIL when first run because the helper does not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md
//
// Coverage:
//   - Spec Rule 15:  The banner message shows both required period and actual coverage
//                    (e.g., "Your entries currently cover 3 years, 4 months out of 7
//                    years required"). The helper produces the placeholder values used
//                    by the translation key.
//   - Tech plan 2.5: The output is plain numbers — the translation layer formats them.
//                    We do NOT compose human-readable strings here.

import { describe, it, expect } from 'vitest';

import { daysToHumanParts } from '../humanizeDuration';

describe('daysToHumanParts', () => {
  it('returns all zeros for 0 days', () => {
    const parts = daysToHumanParts(0);

    expect(parts.years).toBe(0);
    expect(parts.months).toBe(0);
    expect(parts.days).toBe(0);
  });

  it('returns 0 years, 0 months, N days for less than a month', () => {
    const parts = daysToHumanParts(15);

    expect(parts.years).toBe(0);
    expect(parts.months).toBe(0);
    expect(parts.days).toBe(15);
  });

  it('returns 0 years, 1 month, ~0 days for ~30 days', () => {
    const parts = daysToHumanParts(30);

    expect(parts.years).toBe(0);
    expect(parts.months).toBe(1);
  });

  it('returns 0 years, ~3 months for ~90 days', () => {
    const parts = daysToHumanParts(90);

    expect(parts.years).toBe(0);
    expect(parts.months).toBe(3);
  });

  it('returns 1 year, 0 months for ~365 days', () => {
    const parts = daysToHumanParts(365);

    expect(parts.years).toBe(1);
    expect(parts.months).toBe(0);
  });

  it('returns 3 years, ~4 months for ~1216 days', () => {
    // ~3 years, 4 months — matches the spec's example
    // "Your entries currently cover 3 years, 4 months"
    const parts = daysToHumanParts(1216);

    expect(parts.years).toBe(3);
    expect(parts.months).toBe(4);
  });

  it('returns 7 years for ~2555 days', () => {
    const parts = daysToHumanParts(2555);

    expect(parts.years).toBe(7);
  });

  it('returns numbers, not strings, in every part', () => {
    const parts = daysToHumanParts(800);

    expect(typeof parts.years).toBe('number');
    expect(typeof parts.months).toBe('number');
    expect(typeof parts.days).toBe('number');
  });

  it('returns non-negative integers in every part', () => {
    const parts = daysToHumanParts(800);

    expect(parts.years).toBeGreaterThanOrEqual(0);
    expect(parts.months).toBeGreaterThanOrEqual(0);
    expect(parts.days).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(parts.years)).toBe(true);
    expect(Number.isInteger(parts.months)).toBe(true);
    expect(Number.isInteger(parts.days)).toBe(true);
  });
});
