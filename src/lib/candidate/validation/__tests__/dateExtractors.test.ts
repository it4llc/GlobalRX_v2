// /GlobalRX_v2/src/lib/candidate/validation/__tests__/dateExtractors.test.ts
// Pass 1 unit tests for Phase 7 Stage 1:
// extractAddressEntryDates / extractEmploymentEntryDates — pure date extractors
// that read start/end dates and "current" flags from saved entries.
//
// These tests will FAIL when first run because the helpers do not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md
//
// Coverage:
//   - Spec Rule 23: An entry with no end date (current address / current employment)
//                   is treated as ending on the live current date for gap detection.
//   - Tech plan 0.4: Address entry dates live INSIDE the address_block field's JSON
//                    value (fromDate/toDate/isCurrent). Employment dates live as
//                    separate fields (startDate/endDate/currentlyEmployed).

import { describe, it, expect } from 'vitest';

import {
  extractAddressEntryDates,
  extractEmploymentEntryDates,
} from '../dateExtractors';

// ---------------------------------------------------------------------------
// extractAddressEntryDates — Address History
// ---------------------------------------------------------------------------

describe('extractAddressEntryDates', () => {
  const ADDRESS_BLOCK_REQUIREMENT_ID = 'req-address-block-001';

  it('extracts fromDate / toDate from the address_block field value', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        // Address History stores dates inside the address_block field's JSON value.
        [ADDRESS_BLOCK_REQUIREMENT_ID]: {
          fromDate: '2018-01-01',
          toDate: '2020-06-30',
          isCurrent: false,
        },
      },
    };

    const result = extractAddressEntryDates(entry, ADDRESS_BLOCK_REQUIREMENT_ID);

    expect(result.start).not.toBeNull();
    expect(result.end).not.toBeNull();
    expect(result.start?.toISOString().slice(0, 10)).toBe('2018-01-01');
    expect(result.end?.toISOString().slice(0, 10)).toBe('2020-06-30');
    expect(result.isCurrent).toBe(false);
  });

  it('returns end = null and isCurrent = true when address_block.isCurrent is true (Rule 23)', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        [ADDRESS_BLOCK_REQUIREMENT_ID]: {
          fromDate: '2024-01-01',
          toDate: null,
          isCurrent: true,
        },
      },
    };

    const result = extractAddressEntryDates(entry, ADDRESS_BLOCK_REQUIREMENT_ID);

    expect(result.start).not.toBeNull();
    expect(result.end).toBeNull();
    expect(result.isCurrent).toBe(true);
  });

  it('returns nulls when the entry has no address_block field at all', () => {
    const entry = {
      entryOrder: 0,
      fields: {},
    };

    const result = extractAddressEntryDates(entry, ADDRESS_BLOCK_REQUIREMENT_ID);

    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
    expect(result.isCurrent).toBe(false);
  });

  it('returns start = null when fromDate is missing from the address_block value', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        [ADDRESS_BLOCK_REQUIREMENT_ID]: {
          fromDate: null,
          toDate: '2020-01-01',
          isCurrent: false,
        },
      },
    };

    const result = extractAddressEntryDates(entry, ADDRESS_BLOCK_REQUIREMENT_ID);

    expect(result.start).toBeNull();
    expect(result.end).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractEmploymentEntryDates — Employment History
// ---------------------------------------------------------------------------

describe('extractEmploymentEntryDates', () => {
  // Employment-section field metadata, keyed by the country/jurisdiction the
  // requirements apply in. Each value lists the fields the validation engine
  // can use to find startDate / endDate / currentlyEmployed.
  // The field shape mirrors what the structure endpoint already provides.
  const fieldsByCountry = {
    'jur-default': [
      { fieldKey: 'startDate', type: 'date' },
      { fieldKey: 'endDate', type: 'date' },
      { fieldKey: 'currentlyEmployed', type: 'boolean' },
    ],
  };

  it('extracts startDate / endDate from a finished employment entry', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        startDate: '2019-04-01',
        endDate: '2022-09-30',
        currentlyEmployed: false,
      },
    };

    const result = extractEmploymentEntryDates(entry, fieldsByCountry);

    expect(result.start).not.toBeNull();
    expect(result.end).not.toBeNull();
    expect(result.start?.toISOString().slice(0, 10)).toBe('2019-04-01');
    expect(result.end?.toISOString().slice(0, 10)).toBe('2022-09-30');
    expect(result.isCurrent).toBe(false);
  });

  it('returns end = null and isCurrent = true when currentlyEmployed = true (Rule 23)', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        startDate: '2023-01-01',
        endDate: null,
        currentlyEmployed: true,
      },
    };

    const result = extractEmploymentEntryDates(entry, fieldsByCountry);

    expect(result.start).not.toBeNull();
    expect(result.end).toBeNull();
    expect(result.isCurrent).toBe(true);
  });

  it('accepts the alias `isCurrent` as well as `currentlyEmployed` (tech plan 0.4)', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        startDate: '2023-06-01',
        isCurrent: true,
      },
    };

    const result = extractEmploymentEntryDates(entry, fieldsByCountry);

    expect(result.isCurrent).toBe(true);
    expect(result.end).toBeNull();
  });

  it('returns start = null when the entry has no startDate', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        endDate: '2022-09-30',
        currentlyEmployed: false,
      },
    };

    const result = extractEmploymentEntryDates(entry, fieldsByCountry);

    expect(result.start).toBeNull();
    expect(result.end).not.toBeNull();
  });

  it('returns all nulls when the entry has no fields at all', () => {
    const entry = {
      entryOrder: 0,
      fields: {},
    };

    const result = extractEmploymentEntryDates(entry, fieldsByCountry);

    expect(result.start).toBeNull();
    expect(result.end).toBeNull();
    expect(result.isCurrent).toBe(false);
  });
});
