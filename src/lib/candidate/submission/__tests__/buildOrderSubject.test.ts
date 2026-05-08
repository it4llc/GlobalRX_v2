// /GlobalRX_v2/src/lib/candidate/submission/__tests__/buildOrderSubject.test.ts
// Pass 1 unit tests for Phase 7 Stage 2:
// buildOrderSubject — pure helper that builds the Order.subject JSON value
// from the candidate's saved Personal Info section plus the locked invitation
// fields.
//
// These tests will FAIL when first run because the helper does not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md
//
// Coverage:
//   - Spec Rule 12 / Plan §16:        Personal info fields are written to
//                                     Order.subject keyed by fieldKey (NOT to
//                                     OrderData).
//   - Plan §16 step 1:                Locked fields (firstName, lastName, email,
//                                     phone) are sourced from the invitation —
//                                     phone = phoneCountryCode + phoneNumber.
//   - Plan §16 step 1:                If invitation.phoneNumber is null/undefined,
//                                     the phone key is omitted entirely.
//   - Plan §16 step 2:                Saved fields are looked up by requirementId
//                                     in dsxRequirementsLookup to get the fieldKey;
//                                     the value is stored as-is (no JSON-stringify —
//                                     subject is a JSON column).
//   - Plan §16 step 3:                Locked fieldKeys appearing in the saved
//                                     personal info do NOT override the
//                                     invitation-sourced values (defense-in-depth).
//   - DoD 14:                         Order.subject populated from personal info
//
// IMPORTANT: This file imports nothing from Prisma, the database, the network,
// or the filesystem. The helper under test is a pure function of its inputs.
// The "invitation" fixtures below are plain objects shaped by the relevant
// CandidateInvitation columns (firstName / lastName / email / phoneCountryCode
// / phoneNumber) — confirmed against prisma/schema.prisma model
// CandidateInvitation lines 371-405.

import { describe, it, expect } from 'vitest';

import { buildOrderSubject } from '../buildOrderSubject';

// ---------------------------------------------------------------------------
// Shared fixture types
// ---------------------------------------------------------------------------

interface InvitationLockedFields {
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode: string | null;
  phoneNumber: string | null;
}

interface SavedFieldFixture {
  requirementId: string;
  value: unknown;
}

interface PersonalInfoSectionFixture {
  fields: SavedFieldFixture[];
}

interface DsxRequirementLookupRow {
  id: string;
  fieldKey: string;
}

function lookupFromRows(rows: DsxRequirementLookupRow[]): Map<string, DsxRequirementLookupRow> {
  return new Map(rows.map((r) => [r.id, r]));
}

// Reusable invitation fixture covering the locked fields the helper reads.
const baseInvitation: InvitationLockedFields = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  phoneCountryCode: '+1',
  phoneNumber: '5551234567',
};

// ---------------------------------------------------------------------------
// Locked-field projection (Plan §16 Step 1)
// ---------------------------------------------------------------------------

describe('buildOrderSubject — locked fields from invitation', () => {
  it('writes firstName / lastName / email from the invitation columns into the subject', () => {
    const section: PersonalInfoSectionFixture = { fields: [] };

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookupFromRows([]),
    });

    expect(subject.firstName).toBe('Ada');
    expect(subject.lastName).toBe('Lovelace');
    expect(subject.email).toBe('ada@example.com');
  });

  it('writes the phone field as phoneCountryCode + phoneNumber concatenated', () => {
    const section: PersonalInfoSectionFixture = { fields: [] };

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookupFromRows([]),
    });

    expect(subject.phone).toBe('+15551234567');
  });

  it('writes phone using only phoneNumber when phoneCountryCode is null', () => {
    const section: PersonalInfoSectionFixture = { fields: [] };

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: { ...baseInvitation, phoneCountryCode: null },
      dsxRequirementsLookup: lookupFromRows([]),
    });

    expect(subject.phone).toBe('5551234567');
  });

  it('omits the phone key entirely when phoneNumber is null', () => {
    const section: PersonalInfoSectionFixture = { fields: [] };

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: {
        ...baseInvitation,
        phoneCountryCode: null,
        phoneNumber: null,
      },
      dsxRequirementsLookup: lookupFromRows([]),
    });

    expect('phone' in subject).toBe(false);
    expect(subject.phone).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Unlocked-field projection (Plan §16 Step 2)
// ---------------------------------------------------------------------------

describe('buildOrderSubject — unlocked fields from saved personal info', () => {
  it('keys each unlocked saved field by its DSX requirement\'s fieldKey', () => {
    const section: PersonalInfoSectionFixture = {
      fields: [
        { requirementId: 'req-dob', value: '1815-12-10' },
        { requirementId: 'req-ssn', value: '123-45-6789' },
        { requirementId: 'req-middle-name', value: 'Augusta' },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-dob', fieldKey: 'dateOfBirth' },
      { id: 'req-ssn', fieldKey: 'ssn' },
      { id: 'req-middle-name', fieldKey: 'middleName' },
    ]);

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookup,
    });

    expect(subject.dateOfBirth).toBe('1815-12-10');
    expect(subject.ssn).toBe('123-45-6789');
    expect(subject.middleName).toBe('Augusta');
  });

  it('preserves object values without JSON-stringifying (Plan §16 — Order.subject is a JSON column)', () => {
    // E.g., a future structured personal-info field like an address block.
    const structuredValue = {
      street: '12 Babbage Way',
      city: 'London',
      postalCode: 'SW1A 1AA',
    };
    const section: PersonalInfoSectionFixture = {
      fields: [{ requirementId: 'req-mailing-address', value: structuredValue }],
    };
    const lookup = lookupFromRows([
      { id: 'req-mailing-address', fieldKey: 'mailingAddress' },
    ]);

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookup,
    });

    // Stored as-is; not JSON-stringified.
    expect(subject.mailingAddress).toEqual(structuredValue);
    expect(typeof subject.mailingAddress).toBe('object');
  });

  it('preserves array values without JSON-stringifying', () => {
    const section: PersonalInfoSectionFixture = {
      fields: [
        {
          requirementId: 'req-aliases',
          value: ['Augusta King', 'Lady Lovelace'],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-aliases', fieldKey: 'aliases' },
    ]);

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookup,
    });

    expect(subject.aliases).toEqual(['Augusta King', 'Lady Lovelace']);
    expect(Array.isArray(subject.aliases)).toBe(true);
  });

  it('skips a saved field whose requirementId is not in the lookup map (defense)', () => {
    const section: PersonalInfoSectionFixture = {
      fields: [
        { requirementId: 'req-known', value: 'kept' },
        { requirementId: 'req-unknown', value: 'skipped' },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-known', fieldKey: 'someKey' },
      // req-unknown intentionally absent.
    ]);

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookup,
    });

    expect(subject.someKey).toBe('kept');
    // The unknown requirement does not contribute any key to the subject.
    expect(Object.values(subject)).not.toContain('skipped');
  });
});

// ---------------------------------------------------------------------------
// Locked-field override defense (Plan §16 Step 3)
// ---------------------------------------------------------------------------

describe('buildOrderSubject — locked-field override defense (Plan §16 Step 3)', () => {
  it('does NOT let a saved field with fieldKey="firstName" override the invitation firstName', () => {
    const section: PersonalInfoSectionFixture = {
      fields: [{ requirementId: 'req-first-name', value: 'Hacker' }],
    };
    const lookup = lookupFromRows([
      { id: 'req-first-name', fieldKey: 'firstName' },
    ]);

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookup,
    });

    // Invitation value wins.
    expect(subject.firstName).toBe('Ada');
  });

  it('does NOT let a saved field with fieldKey="lastName" / "email" / "phone" / "phoneNumber" override the invitation values', () => {
    const section: PersonalInfoSectionFixture = {
      fields: [
        { requirementId: 'req-last-name', value: 'Hacker' },
        { requirementId: 'req-email', value: 'evil@example.com' },
        { requirementId: 'req-phone', value: '+19999999999' },
        { requirementId: 'req-phone-number', value: '0000000000' },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-last-name', fieldKey: 'lastName' },
      { id: 'req-email', fieldKey: 'email' },
      { id: 'req-phone', fieldKey: 'phone' },
      { id: 'req-phone-number', fieldKey: 'phoneNumber' },
    ]);

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookup,
    });

    expect(subject.lastName).toBe('Lovelace');
    expect(subject.email).toBe('ada@example.com');
    expect(subject.phone).toBe('+15551234567');
    // phoneNumber alias should not appear as a separate key — the locked
    // value lives on `phone`. (Plan §16 step 1 — only `phone` is set.)
    expect(subject.phoneNumber).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Combined behavior — the DoD-14 happy path
// ---------------------------------------------------------------------------

describe('buildOrderSubject — combined happy path (DoD 14)', () => {
  it('produces a subject containing both locked invitation fields and unlocked saved fields, keyed by fieldKey', () => {
    const section: PersonalInfoSectionFixture = {
      fields: [
        { requirementId: 'req-dob', value: '1815-12-10' },
        { requirementId: 'req-ssn', value: '123-45-6789' },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-dob', fieldKey: 'dateOfBirth' },
      { id: 'req-ssn', fieldKey: 'ssn' },
    ]);

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookup,
    });

    expect(subject).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+15551234567',
      dateOfBirth: '1815-12-10',
      ssn: '123-45-6789',
    });
  });

  it('returns just the locked fields when there are no saved personal-info fields', () => {
    const section: PersonalInfoSectionFixture = { fields: [] };

    const subject = buildOrderSubject({
      personalInfoSection: section,
      invitation: baseInvitation,
      dsxRequirementsLookup: lookupFromRows([]),
    });

    expect(subject).toEqual({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      phone: '+15551234567',
    });
  });
});
