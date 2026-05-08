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
//
// Phase 7 Stage 2 — added regression tests at the bottom for two bug fixes:
//   - parseBooleanValue handling ["yes"] / ["true"] array form
//   - Employment date extractor identifying roles from RequirementMetadata
//     (dataType + name) when entry fields are keyed by requirementId UUID

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

  // -------------------------------------------------------------------------
  // REGRESSION TEST — parseBooleanValue handling of single-element arrays
  // (Phase 7 Stage 2 implementer fix)
  //
  // Bug: the form-engine's checkbox save shape wraps a boolean answer as a
  // single-element string array (e.g. `['yes']`). Before the fix, the
  // extractor saw the raw array, didn't recognize it as truthy, and returned
  // isCurrent=false — which caused the toDate to be treated as a real end
  // date for gap-detection. After the fix, ['yes'] / ['true'] is unwrapped
  // and recognized as `true`.
  //
  // This test asserts the CORRECT (post-fix) behavior — it FAILS before
  // the fix, PASSES after, with no test changes between.
  // -------------------------------------------------------------------------

  it('REGRESSION TEST: address_block isCurrent wrapped as ["yes"] is treated as truthy', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        [ADDRESS_BLOCK_REQUIREMENT_ID]: {
          fromDate: '2024-01-01',
          toDate: '2024-09-30',
          isCurrent: ['yes'], // Single-element array — checkbox save shape.
        },
      },
    };

    const result = extractAddressEntryDates(entry, ADDRESS_BLOCK_REQUIREMENT_ID);

    expect(result.isCurrent).toBe(true);
    // Because isCurrent is true, the extractor must ignore toDate.
    expect(result.end).toBeNull();
  });

  it('REGRESSION TEST: address_block isCurrent wrapped as ["true"] is treated as truthy', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        [ADDRESS_BLOCK_REQUIREMENT_ID]: {
          fromDate: '2024-01-01',
          toDate: '2024-09-30',
          isCurrent: ['true'],
        },
      },
    };

    const result = extractAddressEntryDates(entry, ADDRESS_BLOCK_REQUIREMENT_ID);

    expect(result.isCurrent).toBe(true);
    expect(result.end).toBeNull();
  });

  it('REGRESSION TEST: address_block isCurrent wrapped as ["false"] is treated as falsy', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        [ADDRESS_BLOCK_REQUIREMENT_ID]: {
          fromDate: '2024-01-01',
          toDate: '2024-09-30',
          isCurrent: ['false'],
        },
      },
    };

    const result = extractAddressEntryDates(entry, ADDRESS_BLOCK_REQUIREMENT_ID);

    expect(result.isCurrent).toBe(false);
    // Because isCurrent is false, the extractor uses the saved toDate.
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

  // -------------------------------------------------------------------------
  // REGRESSION TESTS — Phase 7 Stage 2 implementer fix:
  //   Employment date extractor identifies start / end / current roles via
  //   RequirementMetadata (dataType + name) when entry fields are keyed by
  //   requirementId UUID, not just by the legacy fieldKey alias sets.
  //
  // Bug: when saved entry fields are keyed by requirementId (the runtime
  // shape produced by flattenEntry), and the requirements use auto-fallback
  // UUID-style fieldKeys (not 'startDate' / 'endDate' / 'currentlyEmployed'),
  // the extractor resolved no roles and returned all nulls. The fix
  // introduces a `requirementMetadata` parameter so the role can be inferred
  // from `{ dataType, name }` (e.g. dataType='date' + name~='start').
  //
  // These tests assert the CORRECT (post-fix) behavior — they FAIL before
  // the fix, PASS after, with no test changes between.
  // -------------------------------------------------------------------------

  it('REGRESSION TEST: identifies start/end/current roles from RequirementMetadata (dataType + name)', () => {
    const entry = {
      entryOrder: 0,
      // Fields keyed by requirementId UUID — fieldKey aliases would NOT match.
      fields: {
        'req-uuid-start': '2019-04-01',
        'req-uuid-end': '2022-09-30',
        'req-uuid-current': false,
      },
    };

    const requirementMetadata = new Map<
      string,
      { fieldKey: string; name: string; dataType: string }
    >([
      [
        'req-uuid-start',
        // The fieldKey is auto-fallback (not in the alias set), so the
        // metadata's dataType + name is what drives role identification.
        { fieldKey: 'autoUuidStart', name: 'Start Date', dataType: 'date' },
      ],
      [
        'req-uuid-end',
        { fieldKey: 'autoUuidEnd', name: 'End Date', dataType: 'date' },
      ],
      [
        'req-uuid-current',
        {
          fieldKey: 'autoUuidCurrent',
          name: 'Currently Employed',
          dataType: 'boolean',
        },
      ],
    ]);

    const result = extractEmploymentEntryDates(
      entry,
      fieldsByCountry,
      requirementMetadata,
    );

    expect(result.start?.toISOString().slice(0, 10)).toBe('2019-04-01');
    expect(result.end?.toISOString().slice(0, 10)).toBe('2022-09-30');
    expect(result.isCurrent).toBe(false);
  });

  it('REGRESSION TEST: dataType="date" + name containing "graduation" identifies the end role', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        'req-uuid-start': '2018-09-01',
        'req-uuid-grad': '2022-06-15',
      },
    };

    const requirementMetadata = new Map<
      string,
      { fieldKey: string; name: string; dataType: string }
    >([
      [
        'req-uuid-start',
        { fieldKey: 'autoStart', name: 'Start Date', dataType: 'date' },
      ],
      [
        'req-uuid-grad',
        { fieldKey: 'autoGrad', name: 'Graduation Date', dataType: 'date' },
      ],
    ]);

    const result = extractEmploymentEntryDates(
      entry,
      fieldsByCountry,
      requirementMetadata,
    );

    expect(result.start?.toISOString().slice(0, 10)).toBe('2018-09-01');
    expect(result.end?.toISOString().slice(0, 10)).toBe('2022-06-15');
  });

  it('REGRESSION TEST: dataType="boolean" identifies the currentlyEmployed role even when name does not contain "current"', () => {
    const entry = {
      entryOrder: 0,
      fields: {
        'req-uuid-start': '2024-01-01',
        // The "currently employed" flag is stored under an opaque UUID key
        // and the name does NOT contain 'current' — but its dataType is
        // 'boolean', which is enough to identify the role.
        'req-uuid-flag': true,
      },
    };

    const requirementMetadata = new Map<
      string,
      { fieldKey: string; name: string; dataType: string }
    >([
      [
        'req-uuid-start',
        { fieldKey: 'autoStart', name: 'Start Date', dataType: 'date' },
      ],
      [
        'req-uuid-flag',
        // dataType='boolean' alone resolves the role (the helper accepts
        // either dataType='boolean' OR a name containing 'current').
        { fieldKey: 'autoFlag', name: 'Still Working Here', dataType: 'boolean' },
      ],
    ]);

    const result = extractEmploymentEntryDates(
      entry,
      fieldsByCountry,
      requirementMetadata,
    );

    expect(result.start?.toISOString().slice(0, 10)).toBe('2024-01-01');
    expect(result.isCurrent).toBe(true);
    // Because isCurrent is true, end must be null.
    expect(result.end).toBeNull();
  });

  it('REGRESSION TEST: ["yes"]-wrapped currentlyEmployed flag is treated as truthy', () => {
    // Phase 7 Stage 2 — parseBooleanValue regression for the employment
    // path. The form-engine's checkbox save shape wraps booleans in a
    // one-element array. extractEmploymentEntryDates uses parseBooleanValue
    // for currentlyEmployed; before the fix, the array form was treated as
    // falsy and the toDate was used as a real end.
    const entry = {
      entryOrder: 0,
      fields: {
        startDate: '2024-01-01',
        endDate: '2024-09-30',
        currentlyEmployed: ['yes'],
      },
    };

    const result = extractEmploymentEntryDates(entry, fieldsByCountry);

    expect(result.isCurrent).toBe(true);
    expect(result.end).toBeNull();
  });
});
