// /GlobalRX_v2/src/lib/candidate/validation/__tests__/packageScopeShape.test.ts
// Pass 1 unit tests for Phase 7 Stage 1:
// PackageService.scope JSON shape normalization and "most demanding" scope picker.
//
// These tests will FAIL when first run because the helpers do not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md
//
// Coverage:
//   - Spec Rule 13:  Conceptual scope types (count exact / count specific / time-based / all)
//                    must map to existing normalized scope strings.
//   - Spec Rule 19:  Multiple services in the same section — most demanding scope wins.
//                    For same-type scopes, larger value wins. For mixed types, time-based
//                    wins over count-based.
//   - Tech plan 0.1: The shapes below are already in production use by the scope endpoint
//                    and must not be redefined.
//   - DoD 16:        Multiple services of the same type use the most demanding scope;
//                    mixed types defer to time-based.

import { describe, it, expect } from 'vitest';

import {
  normalizeRawScope,
  pickMostDemandingScope,
} from '../packageScopeShape';

// ---------------------------------------------------------------------------
// normalizeRawScope — single PackageService.scope value → normalized shape
// ---------------------------------------------------------------------------

describe('normalizeRawScope', () => {
  describe('record functionality (count_exact and count_specific)', () => {
    it('maps `current-address` to count_exact with scopeValue 1', () => {
      const result = normalizeRawScope({ type: 'current-address' }, 'record');

      expect(result.scopeType).toBe('count_exact');
      expect(result.scopeValue).toBe(1);
    });

    it('maps `last-x-addresses` with quantity to count_specific', () => {
      const result = normalizeRawScope(
        { type: 'last-x-addresses', quantity: 3 },
        'record'
      );

      expect(result.scopeType).toBe('count_specific');
      expect(result.scopeValue).toBe(3);
    });

    it('maps `past-x-years` with years to time_based', () => {
      const result = normalizeRawScope(
        { type: 'past-x-years', years: 7 },
        'record'
      );

      expect(result.scopeType).toBe('time_based');
      expect(result.scopeValue).toBe(7);
    });

    it('treats `null` raw scope on a record service as `current-address` default', () => {
      const result = normalizeRawScope(null, 'record');

      expect(result.scopeType).toBe('count_exact');
      expect(result.scopeValue).toBe(1);
    });
  });

  describe('verification-edu functionality', () => {
    it('maps `most-recent` to count_exact', () => {
      const result = normalizeRawScope(
        { type: 'most-recent' },
        'verification-edu'
      );

      expect(result.scopeType).toBe('count_exact');
      expect(result.scopeValue).toBe(1);
    });

    it('maps `most-recent-x` with quantity to count_specific', () => {
      const result = normalizeRawScope(
        { type: 'most-recent-x', quantity: 2 },
        'verification-edu'
      );

      expect(result.scopeType).toBe('count_specific');
      expect(result.scopeValue).toBe(2);
    });

    it('maps `highest-degree` to highest_degree (post-HS)', () => {
      const result = normalizeRawScope(
        { type: 'highest-degree' },
        'verification-edu'
      );

      expect(result.scopeType).toBe('highest_degree');
    });

    it('maps `highest-degree-inc-highschool` to highest_degree_inc_hs', () => {
      const result = normalizeRawScope(
        { type: 'highest-degree-inc-highschool' },
        'verification-edu'
      );

      expect(result.scopeType).toBe('highest_degree_inc_hs');
    });

    it('maps `all-degrees` to all_degrees', () => {
      const result = normalizeRawScope(
        { type: 'all-degrees' },
        'verification-edu'
      );

      expect(result.scopeType).toBe('all_degrees');
    });

    it('treats `null` raw scope on verification-edu as `all`', () => {
      const result = normalizeRawScope(null, 'verification-edu');

      expect(result.scopeType).toBe('all');
    });
  });

  describe('verification-emp functionality', () => {
    it('maps `most-recent` to count_exact', () => {
      const result = normalizeRawScope(
        { type: 'most-recent' },
        'verification-emp'
      );

      expect(result.scopeType).toBe('count_exact');
      expect(result.scopeValue).toBe(1);
    });

    it('maps `past-x-years` with years to time_based', () => {
      const result = normalizeRawScope(
        { type: 'past-x-years', years: 5 },
        'verification-emp'
      );

      expect(result.scopeType).toBe('time_based');
      expect(result.scopeValue).toBe(5);
    });

    it('treats `null` raw scope on verification-emp as `all`', () => {
      const result = normalizeRawScope(null, 'verification-emp');

      expect(result.scopeType).toBe('all');
    });
  });
});

// ---------------------------------------------------------------------------
// pickMostDemandingScope — Rule 19 / DoD 16
// ---------------------------------------------------------------------------

describe('pickMostDemandingScope', () => {
  it('returns the only scope when given a single-element array', () => {
    const only = { scopeType: 'count_exact' as const, scopeValue: 1 };
    const result = pickMostDemandingScope([only]);

    expect(result).toEqual(only);
  });

  it('among two count_specific scopes, picks the larger quantity', () => {
    const small = { scopeType: 'count_specific' as const, scopeValue: 2 };
    const big = { scopeType: 'count_specific' as const, scopeValue: 5 };

    const result = pickMostDemandingScope([small, big]);

    expect(result).toEqual(big);
  });

  it('among two time_based scopes, picks the larger years value', () => {
    const five = { scopeType: 'time_based' as const, scopeValue: 5 };
    const seven = { scopeType: 'time_based' as const, scopeValue: 7 };

    const result = pickMostDemandingScope([five, seven]);

    expect(result).toEqual(seven);
  });

  it('among mixed count and time-based scopes, picks the time-based scope (Rule 19)', () => {
    const count = { scopeType: 'count_specific' as const, scopeValue: 5 };
    const time = { scopeType: 'time_based' as const, scopeValue: 3 };

    const result = pickMostDemandingScope([count, time]);

    expect(result.scopeType).toBe('time_based');
    expect(result.scopeValue).toBe(3);
  });

  it('among `all` and `count_specific`, picks the count_specific (more demanding)', () => {
    const all = { scopeType: 'all' as const, scopeValue: null };
    const count = { scopeType: 'count_specific' as const, scopeValue: 3 };

    const result = pickMostDemandingScope([all, count]);

    expect(result.scopeType).toBe('count_specific');
    expect(result.scopeValue).toBe(3);
  });

  it('among `all` and `time_based`, picks the time_based (more demanding)', () => {
    const all = { scopeType: 'all' as const, scopeValue: null };
    const time = { scopeType: 'time_based' as const, scopeValue: 7 };

    const result = pickMostDemandingScope([all, time]);

    expect(result.scopeType).toBe('time_based');
    expect(result.scopeValue).toBe(7);
  });

  it('three scopes — count + count + time — picks the time-based one', () => {
    const result = pickMostDemandingScope([
      { scopeType: 'count_specific' as const, scopeValue: 3 },
      { scopeType: 'count_specific' as const, scopeValue: 7 },
      { scopeType: 'time_based' as const, scopeValue: 2 },
    ]);

    expect(result.scopeType).toBe('time_based');
    expect(result.scopeValue).toBe(2);
  });
});
