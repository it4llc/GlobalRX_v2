// /GlobalRX_v2/src/lib/candidate/validation/__tests__/packageScopeShape.idv.test.ts
//
// Pass 1 unit tests for the verification-idv extension of packageScopeShape.
//
// These tests will FAIL when first run because:
//   - `ScopeFunctionalityType` does not yet include "verification-idv"
//   - `normalizeRawScope` does not yet have a "verification-idv" branch
// That is the correct RED state for Pass 1 TDD. The implementer's job is
// to land the changes described in technical plan §5.4.
//
// Spec:           docs/specs/verification-idv-conversion.md
//                 (BR 5, BR 15, Decision 4; DoD 9)
// Technical plan: docs/plans/verification-idv-conversion-plan.md §5.4
//
// Coverage:
//   - BR 5:    package_services.scope for verification-idv is fixed to
//              { type: 'count_exact', quantity: 1 }.
//   - BR 15:   ScopeFunctionalityType union extended; normalizeRawScope
//              returns { scopeType: 'count_exact', scopeValue: 1 } for
//              verification-idv regardless of stored scope shape
//              (defensive: even stale rows resolve correctly).
//   - DoD 9:   ScopeFunctionalityType union includes "verification-idv".
//
// Mocking discipline: none. The function is pure and the existing
// packageScopeShape.test.ts (read for pattern) takes the same no-mock
// approach.

import { describe, it, expect } from 'vitest';

import {
  normalizeRawScope,
  type ScopeFunctionalityType,
} from '../packageScopeShape';

describe('normalizeRawScope — verification-idv branch (BR 15)', () => {
  it('resolves the canonical { type: "count_exact", quantity: 1 } shape to count_exact 1', () => {
    // BR 5: this is the shape the data migration writes and the package
    // builder UI auto-sets for IDV services.
    const result = normalizeRawScope(
      { type: 'count_exact', quantity: 1 },
      'verification-idv',
    );

    expect(result.scopeType).toBe('count_exact');
    expect(result.scopeValue).toBe(1);
  });

  it('resolves a null raw scope on verification-idv to count_exact 1 (not "all")', () => {
    // BR 15 defensive guarantee: IDV always means "exactly one entry"
    // regardless of stored shape. This DIVERGES from the verification-edu
    // and verification-emp behavior, where a null raw scope falls back
    // to "all" (see existing packageScopeShape.test.ts line 118).
    const result = normalizeRawScope(null, 'verification-idv');

    expect(result.scopeType).toBe('count_exact');
    expect(result.scopeValue).toBe(1);
  });

  it('resolves a stale edu/emp-style scope on verification-idv to count_exact 1 (defensive)', () => {
    // Edge Case 2 from the spec: an admin may have previously saved a
    // verification-idv (formerly "idv") service with a stray
    // {type:'most-recent-x',quantity:3} scope. After conversion the data
    // migration normalizes those rows, but normalizeRawScope is the
    // belt-and-suspenders defense: IDV ALWAYS resolves to count_exact 1
    // regardless of what the row currently holds.
    const result = normalizeRawScope(
      { type: 'most-recent-x', quantity: 3 },
      'verification-idv',
    );

    expect(result.scopeType).toBe('count_exact');
    expect(result.scopeValue).toBe(1);
  });

  it('resolves a time-based stale scope on verification-idv to count_exact 1 (defensive)', () => {
    // Another stale-row scenario: time-based scope on an IDV service.
    // Per BR 15, IDV ignores all stored shapes and always returns 1.
    const result = normalizeRawScope(
      { type: 'past-x-years', years: 7 },
      'verification-idv',
    );

    expect(result.scopeType).toBe('count_exact');
    expect(result.scopeValue).toBe(1);
  });

  it('resolves a degree-style stale scope on verification-idv to count_exact 1 (defensive)', () => {
    // Another stale-row scenario: degree-style scope on an IDV service.
    // Per BR 15 defensive contract, IDV always wins back to count_exact 1.
    const result = normalizeRawScope(
      { type: 'highest-degree' },
      'verification-idv',
    );

    expect(result.scopeType).toBe('count_exact');
    expect(result.scopeValue).toBe(1);
  });

  it('does NOT regress verification-edu null behavior (still resolves to "all")', () => {
    // Regression guard: the new verification-idv branch must not
    // change the existing verification-edu null-scope fallback. The
    // existing packageScopeShape.test.ts line 118 already covers this
    // pre-rename; we re-assert it here to defend against an implementer
    // accidentally widening the verification-idv branch to all
    // verification-* types.
    const result = normalizeRawScope(null, 'verification-edu');

    expect(result.scopeType).toBe('all');
    expect(result.scopeValue).toBeNull();
  });

  it('does NOT regress record null behavior (still resolves to count_exact 1)', () => {
    // Same regression guard for record. count_exact 1 here is the
    // pre-existing "current address" default — not the IDV default.
    const result = normalizeRawScope(null, 'record');

    expect(result.scopeType).toBe('count_exact');
    expect(result.scopeValue).toBe(1);
  });
});

describe('ScopeFunctionalityType union (DoD 9)', () => {
  it('accepts "verification-idv" as a valid union member', () => {
    // Compile-time assertion: if the implementer forgets to add
    // "verification-idv" to the union, this file won't compile.
    const idv: ScopeFunctionalityType = 'verification-idv';
    expect(idv).toBe('verification-idv');
  });

  it('still accepts all pre-existing members', () => {
    // Regression guard for the legacy three-member union.
    const edu: ScopeFunctionalityType = 'verification-edu';
    const emp: ScopeFunctionalityType = 'verification-emp';
    const record: ScopeFunctionalityType = 'record';

    expect([edu, emp, record]).toEqual([
      'verification-edu',
      'verification-emp',
      'record',
    ]);
  });
});
