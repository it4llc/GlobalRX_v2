// /GlobalRX_v2/src/lib/candidate/__tests__/lockedInvitationFieldKeys.test.ts
//
// Pass 1 regression tests for the cross-section validation filtering bug fix.
//
// Spec:           docs/specs/cross-section-validation-filtering-bugfix.md
//                 (Business Rules 2, 3 — locked invitation fields excluded)
//
// This file targets a NEW shared constant module that does not exist yet —
// `src/lib/candidate/lockedInvitationFieldKeys.ts`. The implementer creates
// the module; these tests pin its contract.
//
// The five fieldKeys (firstName, lastName, email, phone, phoneNumber) are
// the locked invitation-sourced fields per Task 8.3 spec Business Rule 6 /
// `personalInfoIdvFieldChecks.ts:229–235` (currently a module-private Set).
// The architect's plan extracts that Set into a shared module so the same
// list is consulted by:
//   - `personal-info-fields/route.ts` (already filters via its own private Set)
//   - `personalInfoIdvFieldChecks.ts` (already filters via its own private Set)
//   - `addressHistoryStage4Wiring.ts` `buildAddressHistorySubjectRequirements`
//     (NEW — currently does not filter, which is what causes the bug)
//
// REGRESSION TEST: proves bug fix for cross-section-validation-filtering
// (Business Rules 2 and 3 — banner / asterisk / validator must all consult
// one source of truth for "this fieldKey is locked and the candidate cannot
// edit it").

import { describe, it, expect } from 'vitest';

import {
  LOCKED_INVITATION_FIELD_KEYS,
  PERSONAL_INFO_FIELD_KEYS,
  isLockedInvitationFieldKey,
  isPersonalInfoFieldKey,
} from '../lockedInvitationFieldKeys';

describe('LOCKED_INVITATION_FIELD_KEYS', () => {
  it('REGRESSION TEST: contains exactly firstName, lastName, email, phone, phoneNumber', () => {
    // Architect's plan: the exported Set must contain exactly these five
    // fieldKeys. The list mirrors the existing private Set in
    // `personalInfoIdvFieldChecks.ts` and the private Set in
    // `personal-info-fields/route.ts`. Asserting `size === 5` plus per-key
    // membership catches both "missing key" and "extra key" drift.
    expect(LOCKED_INVITATION_FIELD_KEYS.size).toBe(5);
    expect(LOCKED_INVITATION_FIELD_KEYS.has('firstName')).toBe(true);
    expect(LOCKED_INVITATION_FIELD_KEYS.has('lastName')).toBe(true);
    expect(LOCKED_INVITATION_FIELD_KEYS.has('email')).toBe(true);
    expect(LOCKED_INVITATION_FIELD_KEYS.has('phone')).toBe(true);
    expect(LOCKED_INVITATION_FIELD_KEYS.has('phoneNumber')).toBe(true);
  });

  it('does not contain unlocked Personal Info fieldKeys (middleName, dateOfBirth, ssn)', () => {
    // Defensive — these fieldKeys ARE rendered on Personal Info; they must
    // not be in the locked set or the validator/banner/asterisk would
    // wrongly drop them.
    expect(LOCKED_INVITATION_FIELD_KEYS.has('middleName')).toBe(false);
    expect(LOCKED_INVITATION_FIELD_KEYS.has('dateOfBirth')).toBe(false);
    expect(LOCKED_INVITATION_FIELD_KEYS.has('ssn')).toBe(false);
  });
});

describe('isLockedInvitationFieldKey', () => {
  it('REGRESSION TEST: returns true for "firstName"', () => {
    expect(isLockedInvitationFieldKey('firstName')).toBe(true);
  });

  it('returns true for each of the five locked keys', () => {
    expect(isLockedInvitationFieldKey('firstName')).toBe(true);
    expect(isLockedInvitationFieldKey('lastName')).toBe(true);
    expect(isLockedInvitationFieldKey('email')).toBe(true);
    expect(isLockedInvitationFieldKey('phone')).toBe(true);
    expect(isLockedInvitationFieldKey('phoneNumber')).toBe(true);
  });

  it('returns false for "middleName"', () => {
    expect(isLockedInvitationFieldKey('middleName')).toBe(false);
  });

  it('returns false for "dateOfBirth"', () => {
    expect(isLockedInvitationFieldKey('dateOfBirth')).toBe(false);
  });

  it('returns false for unknown / empty / arbitrary fieldKeys', () => {
    expect(isLockedInvitationFieldKey('')).toBe(false);
    expect(isLockedInvitationFieldKey('someOtherField')).toBe(false);
    expect(isLockedInvitationFieldKey('residenceAddress')).toBe(false);
  });
});

describe('PERSONAL_INFO_FIELD_KEYS', () => {
  it('REGRESSION TEST: contains the wider Personal Info heuristic set', () => {
    // Cross-section-validation-filtering bug fix Bug A — this set must
    // mirror personalInfoIdvFieldChecks.ts PERSONAL_INFO_FIELD_KEYS so the
    // per-entry validator and the address-history UI splitter both skip
    // requirements whose fieldKey identifies them as PI-collected even
    // when fieldData.collectionTab is missing.
    expect(PERSONAL_INFO_FIELD_KEYS.has('firstName')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('lastName')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('middleName')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('email')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('phone')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('phoneNumber')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('dateOfBirth')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('birthDate')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('dob')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('ssn')).toBe(true);
    expect(PERSONAL_INFO_FIELD_KEYS.has('socialSecurityNumber')).toBe(true);
  });

  it('is a strict superset of LOCKED_INVITATION_FIELD_KEYS', () => {
    for (const key of LOCKED_INVITATION_FIELD_KEYS) {
      expect(PERSONAL_INFO_FIELD_KEYS.has(key)).toBe(true);
    }
  });

  it('does not contain arbitrary non-PI fieldKeys', () => {
    expect(PERSONAL_INFO_FIELD_KEYS.has('residenceAddress')).toBe(false);
    expect(PERSONAL_INFO_FIELD_KEYS.has('passportNumber')).toBe(false);
    expect(PERSONAL_INFO_FIELD_KEYS.has('localRef')).toBe(false);
  });
});

describe('isPersonalInfoFieldKey', () => {
  it('REGRESSION TEST: returns true for fieldKeys that surface on Personal Info', () => {
    // Each of these would otherwise be flagged as a missing required field
    // on an Address History entry — see cross-section-validation-filtering
    // bugfix.md Bug A.
    expect(isPersonalInfoFieldKey('middleName')).toBe(true);
    expect(isPersonalInfoFieldKey('dateOfBirth')).toBe(true);
    expect(isPersonalInfoFieldKey('ssn')).toBe(true);
  });

  it('returns false for fieldKeys unrelated to Personal Info', () => {
    expect(isPersonalInfoFieldKey('')).toBe(false);
    expect(isPersonalInfoFieldKey('residenceAddress')).toBe(false);
    expect(isPersonalInfoFieldKey('countryOfBirth')).toBe(false);
  });
});
