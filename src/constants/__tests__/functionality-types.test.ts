// /GlobalRX_v2/src/constants/__tests__/functionality-types.test.ts
//
// Pass 1 contract tests for the new shared functionality-type constants
// module created by docs/specs/verification-idv-conversion.md (Confirmed).
//
// These tests will FAIL when first run because the module does not exist
// yet. That is the correct RED state for Pass 1 TDD — the implementer's
// job is to create `src/constants/functionality-types.ts` such that these
// tests pass.
//
// Spec:           docs/specs/verification-idv-conversion.md
//                 (BR 1, BR 3, BR 14; DoD 1, DoD 13)
// Technical plan: docs/plans/verification-idv-conversion-plan.md §4.1, §10.1
//
// Coverage:
//   - BR 1:    Allow-list is exactly record, verification-edu,
//              verification-emp, verification-idv, other. The bare string
//              "idv" is no longer valid.
//   - BR 14:   Shared constants module exists; "idv" does not appear.
//   - DoD 1:   FUNCTIONALITY_TYPES and FunctionalityType union both
//              exported and consistent.
//   - DoD 13:  isValidFunctionalityType returns false for "idv".

import { describe, it, expect } from 'vitest';

import {
  FUNCTIONALITY_TYPES,
  isValidFunctionalityType,
  type FunctionalityType,
} from '../functionality-types';

describe('functionality-types constants module', () => {
  describe('FUNCTIONALITY_TYPES array', () => {
    it('contains exactly the five allowed functionality types', () => {
      // Pulled verbatim from spec BR 1 and technical plan §4.1.
      // Order is significant: the same order is consumed by the admin
      // dropdown and by the structure endpoint's serviceTypeOrder. IDV
      // is first per technical plan §4.1.
      expect(FUNCTIONALITY_TYPES).toEqual([
        'verification-idv',
        'record',
        'verification-edu',
        'verification-emp',
        'other',
      ]);
    });

    it('has length 5', () => {
      expect(FUNCTIONALITY_TYPES).toHaveLength(5);
    });

    it('does NOT contain the legacy bare string "idv"', () => {
      // BR 1: "The bare string 'idv' is no longer a valid value."
      // BR 14: "After this change, 'idv' does not appear in this file."
      expect(FUNCTIONALITY_TYPES as readonly string[]).not.toContain('idv');
    });

    it('contains "verification-idv" as a first-class member', () => {
      expect(FUNCTIONALITY_TYPES as readonly string[]).toContain('verification-idv');
    });

    it('lists "verification-idv" first in the array', () => {
      // Technical plan §4.1: "IDV is first (the candidate sees it first
      // in the sidebar), then record (address history), then the two
      // non-idv verifications, then other."
      expect(FUNCTIONALITY_TYPES[0]).toBe('verification-idv');
    });

    it('still contains the legacy non-idv verification members', () => {
      // BR 1: the existing record / verification-edu / verification-emp /
      // other values are unchanged.
      expect(FUNCTIONALITY_TYPES as readonly string[]).toContain('record');
      expect(FUNCTIONALITY_TYPES as readonly string[]).toContain('verification-edu');
      expect(FUNCTIONALITY_TYPES as readonly string[]).toContain('verification-emp');
      expect(FUNCTIONALITY_TYPES as readonly string[]).toContain('other');
    });
  });

  describe('isValidFunctionalityType helper', () => {
    it('returns true for each member of the allow-list', () => {
      expect(isValidFunctionalityType('verification-idv')).toBe(true);
      expect(isValidFunctionalityType('record')).toBe(true);
      expect(isValidFunctionalityType('verification-edu')).toBe(true);
      expect(isValidFunctionalityType('verification-emp')).toBe(true);
      expect(isValidFunctionalityType('other')).toBe(true);
    });

    it('returns false for the legacy bare string "idv"', () => {
      // BR 3 / DoD 2 / DoD 3: the API hard-rejects "idv" with 400. The
      // single source of truth for that rejection is this helper.
      expect(isValidFunctionalityType('idv')).toBe(false);
    });

    it('returns false for an arbitrary unknown string', () => {
      expect(isValidFunctionalityType('random-string')).toBe(false);
    });

    it('returns false for the empty string', () => {
      expect(isValidFunctionalityType('')).toBe(false);
    });

    it('returns false for the pre-existing dead string "verification" (no suffix)', () => {
      // Out-of-scope §10 / Risk #4: there is a pre-existing dead-string
      // check `service.functionalityType === 'verification'` in
      // /api/customers/[id]/packages/route.ts:238. The bare string
      // "verification" must remain invalid so that dead-string bug
      // does not start matching after the rename.
      expect(isValidFunctionalityType('verification')).toBe(false);
    });

    it('is case-sensitive — uppercase variants are invalid', () => {
      // Project rule: status / type values are stored lowercase
      // everywhere (CLAUDE.md "Status Values Are Always Lowercase").
      expect(isValidFunctionalityType('VERIFICATION-IDV')).toBe(false);
      expect(isValidFunctionalityType('Verification-Idv')).toBe(false);
      expect(isValidFunctionalityType('IDV')).toBe(false);
    });
  });

  describe('FunctionalityType union type', () => {
    it('accepts each allow-list member as a typed value', () => {
      // Compile-time assertion — if the union is wrong, this test file
      // won't compile.
      const idv: FunctionalityType = 'verification-idv';
      const record: FunctionalityType = 'record';
      const edu: FunctionalityType = 'verification-edu';
      const emp: FunctionalityType = 'verification-emp';
      const other: FunctionalityType = 'other';

      expect([idv, record, edu, emp, other]).toEqual([
        'verification-idv',
        'record',
        'verification-edu',
        'verification-emp',
        'other',
      ]);
    });

    it('narrows a string after isValidFunctionalityType returns true', () => {
      // Same pattern as service-status.ts isValidServiceStatus narrowing.
      const candidate: string = 'verification-idv';
      if (isValidFunctionalityType(candidate)) {
        const narrowed: FunctionalityType = candidate;
        expect(narrowed).toBe('verification-idv');
      } else {
        // If the type guard fails to narrow, fail the test loudly so
        // the implementer notices the type predicate is missing.
        throw new Error(
          'isValidFunctionalityType did not narrow "verification-idv" — type predicate signature is wrong',
        );
      }
    });
  });
});
