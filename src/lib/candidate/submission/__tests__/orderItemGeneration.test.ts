// /GlobalRX_v2/src/lib/candidate/submission/__tests__/orderItemGeneration.test.ts
// Pass 1 unit tests for Phase 7 Stage 2:
// orderItemGeneration — pure helpers for scope filtering, jurisdiction
// resolution, deduplication, and per-section order-item key generation.
//
// These tests will FAIL when first run because the helpers do not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md
//
// Coverage:
//   - Spec Rule 5  / Plan §13.2:    scope filtering for record services
//                                   (count_exact / count_specific / time_based / all)
//   - Spec Rule 5  / Plan §13.3:    per-address jurisdiction walk
//                                   (county → state → country)
//   - Spec Rule 5  / Plan §13.3 / Edge 5: skip address+service when no level matches
//   - Spec Rule 6  / Plan §13.4:    record-key deduplication by (serviceId, locationId);
//                                   first-source-wins
//   - Spec Rule 7  / Plan §14.1:    edu — per-entry-per-service, locationId = entry country;
//                                   safety belt: skip entries with null countryId
//   - Spec Rule 8  / Plan §14.2:    emp — same shape as edu
//   - Spec Rule 9  / Plan §14.3:    IDV — exactly one key per idv service
//                                   from idv_country requirementId
//   - DoD 7, 8, 9, 10, 11, 28
//
// IMPORTANT: This file imports nothing from Prisma, the database, the network,
// or the filesystem. The helpers under test are pure functions of their inputs.

import { describe, it, expect } from 'vitest';

import {
  selectAddressesInScope,
  resolveJurisdictionForAddress,
  dedupeOrderItemKeys,
  buildRecordOrderItemKeys,
  buildEduEmpOrderItemKeys,
  buildIdvOrderItemKeys,
} from '../orderItemGeneration';

// ---------------------------------------------------------------------------
// Shared fixture types
//
// These shapes mirror the technical plan's §6 (OrderItemKey) and §13.1 inputs
// (formData.sections.address_history.entries[]). We define them locally so
// the tests do not depend on the implementation file's internal types — that
// way the tests describe the contract, not the implementation.
// ---------------------------------------------------------------------------

interface AddressEntryFixture {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: Array<{
    requirementId: string;
    value: unknown;
  }>;
}

interface ResolvedScopeFixture {
  scopeType:
    | 'count_exact'
    | 'count_specific'
    | 'time_based'
    | 'all';
  scopeValue: number | null;
}

interface PackageServiceFixture {
  serviceId: string;
  scope: ResolvedScopeFixture;
}

interface EduEmpEntryFixture {
  entryId: string;
  countryId: string | null;
}

// ---------------------------------------------------------------------------
// Pinned `today` for deterministic time-based scope tests.
// (Same approach as the Phase 7 Stage 1 gapDetection tests.)
// ---------------------------------------------------------------------------

const TODAY = new Date('2026-05-07T00:00:00.000Z');

// Address-block requirement id used inside the address_block field's JSON
// value to read fromDate / toDate / isCurrent. The submission code has to
// know which requirement carries the address block so it can extract dates;
// the tests pass it explicitly as a parameter rather than hardcoding it.
const ADDRESS_BLOCK_REQUIREMENT_ID = 'req-address-block-001';

// Helper to build an address entry with date range inside the address_block
// field's JSON value — matches the shape Phase 6 Stage 3 actually saves.
function makeAddressEntry(opts: {
  entryId: string;
  entryOrder: number;
  countryId: string | null;
  stateId?: string | null;
  countyId?: string | null;
  fromDate: string;
  toDate: string | null;
  isCurrent?: boolean;
}): AddressEntryFixture {
  return {
    entryId: opts.entryId,
    countryId: opts.countryId,
    entryOrder: opts.entryOrder,
    fields: [
      {
        requirementId: ADDRESS_BLOCK_REQUIREMENT_ID,
        value: {
          fromDate: opts.fromDate,
          toDate: opts.toDate,
          isCurrent: opts.isCurrent ?? false,
          countryId: opts.countryId,
          stateId: opts.stateId ?? null,
          countyId: opts.countyId ?? null,
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// selectAddressesInScope — Rule 5 Step 1 / Plan §13.2 / DoD 28
// ---------------------------------------------------------------------------

describe('selectAddressesInScope', () => {
  // Three addresses, most-recent first by start date.
  // entry-A: 2024-01-01 → present (current)
  // entry-B: 2022-01-01 → 2023-12-31
  // entry-C: 2018-01-01 → 2021-12-31
  const entries: AddressEntryFixture[] = [
    makeAddressEntry({
      entryId: 'entry-A',
      entryOrder: 0,
      countryId: 'country-us',
      fromDate: '2024-01-01',
      toDate: null,
      isCurrent: true,
    }),
    makeAddressEntry({
      entryId: 'entry-B',
      entryOrder: 1,
      countryId: 'country-us',
      fromDate: '2022-01-01',
      toDate: '2023-12-31',
    }),
    makeAddressEntry({
      entryId: 'entry-C',
      entryOrder: 2,
      countryId: 'country-ca',
      fromDate: '2018-01-01',
      toDate: '2021-12-31',
    }),
  ];

  describe('count_exact scope', () => {
    it('returns only the most recent address when scopeType=count_exact and scopeValue=1', () => {
      const result = selectAddressesInScope(
        entries,
        { scopeType: 'count_exact', scopeValue: 1 },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].entryId).toBe('entry-A');
    });

    it('returns an empty array when there are no entries', () => {
      const result = selectAddressesInScope(
        [],
        { scopeType: 'count_exact', scopeValue: 1 },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result).toEqual([]);
    });
  });

  describe('count_specific scope', () => {
    it('returns the first N entries in chronological order most-recent-first when scopeValue=2', () => {
      const result = selectAddressesInScope(
        entries,
        { scopeType: 'count_specific', scopeValue: 2 },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result).toHaveLength(2);
      expect(result.map((e) => e.entryId)).toEqual(['entry-A', 'entry-B']);
    });

    it('returns all entries (no truncation) when scopeValue exceeds the entry count', () => {
      const result = selectAddressesInScope(
        entries,
        { scopeType: 'count_specific', scopeValue: 10 },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result).toHaveLength(3);
    });
  });

  describe('time_based scope', () => {
    it('returns only entries whose date range overlaps the past Y years window', () => {
      // Past 5 years from 2026-05-07 → 2021-05-07.
      // entry-A (2024-now) overlaps. entry-B (2022-2023) overlaps. entry-C
      // (2018-2021-12) overlaps the boundary at the very end (2021-12-31 is
      // AFTER 2021-05-07), so it should also be included.
      const result = selectAddressesInScope(
        entries,
        { scopeType: 'time_based', scopeValue: 5 },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result.map((e) => e.entryId).sort()).toEqual(
        ['entry-A', 'entry-B', 'entry-C'].sort(),
      );
    });

    it('excludes entries whose date range is entirely before the window', () => {
      // Past 1 year from 2026-05-07 → 2025-05-07. Only entry-A (current)
      // overlaps; entry-B and entry-C are both wholly before the window.
      const result = selectAddressesInScope(
        entries,
        { scopeType: 'time_based', scopeValue: 1 },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].entryId).toBe('entry-A');
    });

    it('treats a current entry (no end date) as ending on `today` for overlap purposes', () => {
      const onlyCurrent = [entries[0]]; // entry-A, current
      const result = selectAddressesInScope(
        onlyCurrent,
        { scopeType: 'time_based', scopeValue: 1 },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result).toHaveLength(1);
      expect(result[0].entryId).toBe('entry-A');
    });
  });

  describe('all scope', () => {
    it('returns every entry untouched when scopeType=all', () => {
      const result = selectAddressesInScope(
        entries,
        { scopeType: 'all', scopeValue: null },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result).toHaveLength(3);
      // Ordering: spec wording does not constrain `all` ordering, but the
      // implementation must at least include all entries. We assert by id-set.
      expect(new Set(result.map((e) => e.entryId))).toEqual(
        new Set(['entry-A', 'entry-B', 'entry-C']),
      );
    });

    it('returns an empty array when there are no entries', () => {
      const result = selectAddressesInScope(
        [],
        { scopeType: 'all', scopeValue: null },
        TODAY,
        ADDRESS_BLOCK_REQUIREMENT_ID,
      );

      expect(result).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// resolveJurisdictionForAddress — Rule 5 Step 2 / Plan §13.3 / DoD 7
// ---------------------------------------------------------------------------

describe('resolveJurisdictionForAddress', () => {
  // Address with all three structural levels populated.
  const fullAddress = makeAddressEntry({
    entryId: 'entry-1',
    entryOrder: 0,
    countryId: 'country-us',
    stateId: 'state-wa',
    countyId: 'county-king',
    fromDate: '2024-01-01',
    toDate: null,
    isCurrent: true,
  });

  // Address with only state and country (no county).
  const stateOnlyAddress = makeAddressEntry({
    entryId: 'entry-2',
    entryOrder: 1,
    countryId: 'country-us',
    stateId: 'state-or',
    countyId: null,
    fromDate: '2022-01-01',
    toDate: '2023-12-31',
  });

  // Address with only country (no state, no county).
  const countryOnlyAddress = makeAddressEntry({
    entryId: 'entry-3',
    entryOrder: 2,
    countryId: 'country-fr',
    stateId: null,
    countyId: null,
    fromDate: '2018-01-01',
    toDate: '2021-12-31',
  });

  // Helper: build an availability index keyed by `${serviceId}:${locationId}`.
  // The key shape is documented in plan §13.3 — a Map<string, true>.
  function makeAvailability(pairs: Array<[string, string]>): Map<string, true> {
    const m = new Map<string, true>();
    for (const [serviceId, locationId] of pairs) {
      m.set(`${serviceId}:${locationId}`, true);
    }
    return m;
  }

  it('resolves to the county locationId when service has county-level availability', () => {
    const availability = makeAvailability([
      ['service-bankruptcy', 'county-king'],
      // Also has state and country availability — but county wins (Plan §13.3
      // step 2 — county is checked first, remaining levels skipped).
      ['service-bankruptcy', 'state-wa'],
      ['service-bankruptcy', 'country-us'],
    ]);

    const result = resolveJurisdictionForAddress(
      'service-bankruptcy',
      fullAddress,
      availability,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result.resolvedLocationId).toBe('county-king');
  });

  it('falls back to state-level availability when county is not available', () => {
    const availability = makeAvailability([
      ['service-criminal', 'state-wa'],
      ['service-criminal', 'country-us'],
    ]);

    const result = resolveJurisdictionForAddress(
      'service-criminal',
      fullAddress,
      availability,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result.resolvedLocationId).toBe('state-wa');
  });

  it('falls back to country-level availability when neither county nor state are available', () => {
    const availability = makeAvailability([
      ['service-criminal', 'country-us'],
    ]);

    const result = resolveJurisdictionForAddress(
      'service-criminal',
      fullAddress,
      availability,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result.resolvedLocationId).toBe('country-us');
  });

  it('returns null when no level has DSX availability (Edge 5 — service skipped for this address)', () => {
    const availability = makeAvailability([
      // Different service has availability, but our target has none.
      ['service-other', 'country-us'],
    ]);

    const result = resolveJurisdictionForAddress(
      'service-criminal',
      fullAddress,
      availability,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result.resolvedLocationId).toBeNull();
  });

  it('skips the county step when address has no countyId and tries state then country', () => {
    const availability = makeAvailability([
      ['service-criminal', 'state-or'],
    ]);

    const result = resolveJurisdictionForAddress(
      'service-criminal',
      stateOnlyAddress,
      availability,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result.resolvedLocationId).toBe('state-or');
  });

  it('skips county and state when address only has countryId', () => {
    const availability = makeAvailability([
      ['service-criminal', 'country-fr'],
    ]);

    const result = resolveJurisdictionForAddress(
      'service-criminal',
      countryOnlyAddress,
      availability,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result.resolvedLocationId).toBe('country-fr');
  });

  it('returns null when address is country-only and country has no availability', () => {
    const availability = makeAvailability([
      // Country-fr is not in the availability map.
      ['service-criminal', 'country-us'],
    ]);

    const result = resolveJurisdictionForAddress(
      'service-criminal',
      countryOnlyAddress,
      availability,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result.resolvedLocationId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// dedupeOrderItemKeys — Rule 6 / Plan §13.4 / DoD 8
// ---------------------------------------------------------------------------

describe('dedupeOrderItemKeys', () => {
  it('returns the input unchanged when no two keys share (serviceId, locationId)', () => {
    const keys = [
      {
        serviceId: 'service-1',
        locationId: 'county-a',
        source: { kind: 'address' as const, addressEntryId: 'entry-1' },
      },
      {
        serviceId: 'service-1',
        locationId: 'county-b',
        source: { kind: 'address' as const, addressEntryId: 'entry-2' },
      },
      {
        serviceId: 'service-2',
        locationId: 'county-a',
        source: { kind: 'address' as const, addressEntryId: 'entry-1' },
      },
    ];

    const result = dedupeOrderItemKeys(keys);

    expect(result).toHaveLength(3);
  });

  it('collapses two record keys with the same (serviceId, locationId) to a single key', () => {
    const keys = [
      {
        serviceId: 'service-1',
        locationId: 'county-king',
        source: { kind: 'address' as const, addressEntryId: 'entry-1' },
      },
      {
        serviceId: 'service-1',
        locationId: 'county-king',
        source: { kind: 'address' as const, addressEntryId: 'entry-2' },
      },
    ];

    const result = dedupeOrderItemKeys(keys);

    expect(result).toHaveLength(1);
  });

  it('preserves the FIRST source provenance when deduplicating (Plan §13.4)', () => {
    const keys = [
      {
        serviceId: 'service-1',
        locationId: 'county-king',
        source: { kind: 'address' as const, addressEntryId: 'entry-FIRST' },
      },
      {
        serviceId: 'service-1',
        locationId: 'county-king',
        source: { kind: 'address' as const, addressEntryId: 'entry-SECOND' },
      },
    ];

    const result = dedupeOrderItemKeys(keys);

    expect(result).toHaveLength(1);
    expect(result[0].source).toEqual({
      kind: 'address',
      addressEntryId: 'entry-FIRST',
    });
  });

  it('does not collapse keys with the same locationId but different serviceIds', () => {
    const keys = [
      {
        serviceId: 'service-bankruptcy',
        locationId: 'county-king',
        source: { kind: 'address' as const, addressEntryId: 'entry-1' },
      },
      {
        serviceId: 'service-criminal',
        locationId: 'county-king',
        source: { kind: 'address' as const, addressEntryId: 'entry-1' },
      },
    ];

    const result = dedupeOrderItemKeys(keys);

    expect(result).toHaveLength(2);
  });

  it('returns an empty array when input is empty', () => {
    expect(dedupeOrderItemKeys([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildRecordOrderItemKeys — combined scope + jurisdiction + dedup pipeline
// (Spec Rule 5 + Rule 6 / Plan §13 / DoD 7, 8, 28)
// ---------------------------------------------------------------------------

describe('buildRecordOrderItemKeys', () => {
  // Two record-type services in one package:
  //   bankruptcy: most-recent (count_exact 1)
  //   criminal:   all in past 7 years (time_based 7)
  const bankruptcy: PackageServiceFixture = {
    serviceId: 'service-bankruptcy',
    scope: { scopeType: 'count_exact', scopeValue: 1 },
  };
  const criminal: PackageServiceFixture = {
    serviceId: 'service-criminal',
    scope: { scopeType: 'time_based', scopeValue: 7 },
  };

  // Three addresses spanning 7+ years across two countries.
  const addresses: AddressEntryFixture[] = [
    makeAddressEntry({
      entryId: 'addr-1',
      entryOrder: 0,
      countryId: 'country-us',
      stateId: 'state-wa',
      countyId: 'county-king',
      fromDate: '2024-01-01',
      toDate: null,
      isCurrent: true,
    }),
    makeAddressEntry({
      entryId: 'addr-2',
      entryOrder: 1,
      countryId: 'country-us',
      stateId: 'state-or',
      countyId: null,
      fromDate: '2022-01-01',
      toDate: '2023-12-31',
    }),
    makeAddressEntry({
      entryId: 'addr-3',
      entryOrder: 2,
      countryId: 'country-ca',
      stateId: null,
      countyId: null,
      fromDate: '2019-01-01',
      toDate: '2021-12-31',
    }),
  ];

  function makeAvailability(pairs: Array<[string, string]>): Map<string, true> {
    const m = new Map<string, true>();
    for (const [s, l] of pairs) m.set(`${s}:${l}`, true);
    return m;
  }

  it('produces one key per service per in-scope address resolved to its best jurisdiction', () => {
    // bankruptcy available at county-king. criminal available at county-king,
    // state-or, and country-ca. Both services have country-us availability
    // but the deeper levels win.
    const availability = makeAvailability([
      ['service-bankruptcy', 'county-king'],
      ['service-criminal', 'county-king'],
      ['service-criminal', 'state-or'],
      ['service-criminal', 'country-ca'],
    ]);

    const result = buildRecordOrderItemKeys(
      [bankruptcy, criminal],
      addresses,
      availability,
      TODAY,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    // Expected:
    //   bankruptcy (most-recent only) → addr-1 → county-king
    //   criminal (all past 7y)        → addr-1 → county-king
    //                                 → addr-2 → state-or
    //                                 → addr-3 → country-ca
    // Total 4 keys; no dedup conflicts because (service, location) pairs differ.
    expect(result).toHaveLength(4);

    const tuples = result.map((k) => `${k.serviceId}:${k.locationId}`).sort();
    expect(tuples).toEqual(
      [
        'service-bankruptcy:county-king',
        'service-criminal:country-ca',
        'service-criminal:county-king',
        'service-criminal:state-or',
      ].sort(),
    );
  });

  it('skips an address+service when DSX has no availability at any level (Edge 5)', () => {
    // criminal has NO availability anywhere for addr-3 (country-ca). It will
    // be skipped for that address but produce keys for addr-1 and addr-2.
    const availability = makeAvailability([
      ['service-bankruptcy', 'county-king'],
      ['service-criminal', 'county-king'],
      ['service-criminal', 'state-or'],
      // No country-ca for criminal — skipped for addr-3.
    ]);

    const result = buildRecordOrderItemKeys(
      [bankruptcy, criminal],
      addresses,
      availability,
      TODAY,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    // bankruptcy → addr-1 (1 key)
    // criminal → addr-1, addr-2 (2 keys); addr-3 skipped.
    expect(result).toHaveLength(3);

    const tuples = result.map((k) => `${k.serviceId}:${k.locationId}`).sort();
    expect(tuples).toEqual(
      [
        'service-bankruptcy:county-king',
        'service-criminal:county-king',
        'service-criminal:state-or',
      ].sort(),
    );
  });

  it('deduplicates two addresses that resolve to the same (service, location) pair', () => {
    // Two addresses both in county-king. One service. Should produce 1 key,
    // not 2. (Spec Rule 6 — dedup by serviceId+locationId.)
    const sameCountyTwice: AddressEntryFixture[] = [
      makeAddressEntry({
        entryId: 'addr-A',
        entryOrder: 0,
        countryId: 'country-us',
        stateId: 'state-wa',
        countyId: 'county-king',
        fromDate: '2024-01-01',
        toDate: null,
        isCurrent: true,
      }),
      makeAddressEntry({
        entryId: 'addr-B',
        entryOrder: 1,
        countryId: 'country-us',
        stateId: 'state-wa',
        countyId: 'county-king',
        fromDate: '2020-01-01',
        toDate: '2023-12-31',
      }),
    ];
    const allRecord: PackageServiceFixture = {
      serviceId: 'service-criminal',
      scope: { scopeType: 'all', scopeValue: null },
    };
    const availability = makeAvailability([['service-criminal', 'county-king']]);

    const result = buildRecordOrderItemKeys(
      [allRecord],
      sameCountyTwice,
      availability,
      TODAY,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result).toHaveLength(1);
    expect(result[0].serviceId).toBe('service-criminal');
    expect(result[0].locationId).toBe('county-king');
    // First-source-wins (Plan §13.4) — addr-A (most recent) is the surviving
    // provenance because it appears first in the iteration order produced by
    // selectAddressesInScope.
    expect(result[0].source).toEqual({
      kind: 'address',
      addressEntryId: 'addr-A',
    });
  });

  it('returns an empty array when there are no record-type services', () => {
    const availability = makeAvailability([
      ['service-bankruptcy', 'county-king'],
    ]);

    const result = buildRecordOrderItemKeys(
      [],
      addresses,
      availability,
      TODAY,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result).toEqual([]);
  });

  it('returns an empty array when there are no addresses', () => {
    const availability = makeAvailability([
      ['service-bankruptcy', 'county-king'],
    ]);

    const result = buildRecordOrderItemKeys(
      [bankruptcy, criminal],
      [],
      availability,
      TODAY,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result).toEqual([]);
  });

  it('marks every record-type key with source.kind === "address" and the originating addressEntryId', () => {
    const availability = makeAvailability([
      ['service-bankruptcy', 'county-king'],
    ]);

    const result = buildRecordOrderItemKeys(
      [bankruptcy],
      addresses,
      availability,
      TODAY,
      ADDRESS_BLOCK_REQUIREMENT_ID,
    );

    expect(result).toHaveLength(1);
    expect(result[0].source.kind).toBe('address');
    if (result[0].source.kind === 'address') {
      // Most-recent addresses wins under count_exact 1 — addr-1.
      expect(result[0].source.addressEntryId).toBe('addr-1');
    }
  });
});

// ---------------------------------------------------------------------------
// buildEduEmpOrderItemKeys — Rule 7, 8 / Plan §14.1, §14.2 / DoD 9, 10
// ---------------------------------------------------------------------------

describe('buildEduEmpOrderItemKeys', () => {
  const eduEntries: EduEmpEntryFixture[] = [
    { entryId: 'edu-1', countryId: 'country-us' },
    { entryId: 'edu-2', countryId: 'country-us' },
    { entryId: 'edu-3', countryId: 'country-ca' },
  ];

  it('produces one key per entry per service for kind="education"', () => {
    const result = buildEduEmpOrderItemKeys(
      ['service-edu-A', 'service-edu-B'],
      eduEntries,
      'education',
    );

    // 3 entries × 2 services = 6 keys.
    expect(result).toHaveLength(6);
  });

  it('sets locationId to the entry country for education keys', () => {
    const result = buildEduEmpOrderItemKeys(
      ['service-edu-A'],
      eduEntries,
      'education',
    );

    expect(result).toHaveLength(3);
    const byEntry = new Map(
      result.map((k) => [
        k.source.kind === 'education' ? k.source.entryId : '',
        k,
      ]),
    );
    expect(byEntry.get('edu-1')?.locationId).toBe('country-us');
    expect(byEntry.get('edu-2')?.locationId).toBe('country-us');
    expect(byEntry.get('edu-3')?.locationId).toBe('country-ca');
  });

  it('marks every education key with kind="education" and the originating entryId / countryId', () => {
    const result = buildEduEmpOrderItemKeys(
      ['service-edu-A'],
      eduEntries,
      'education',
    );

    for (const key of result) {
      expect(key.source.kind).toBe('education');
      if (key.source.kind === 'education') {
        expect(key.source.entryId).toBeDefined();
        expect(key.source.countryId).toBeDefined();
      }
    }
  });

  it('does NOT deduplicate two education entries with the same country (Rule 7 — no dedup)', () => {
    // edu-1 and edu-2 are both country-us. Two keys, not one.
    const result = buildEduEmpOrderItemKeys(
      ['service-edu-A'],
      [eduEntries[0], eduEntries[1]],
      'education',
    );

    expect(result).toHaveLength(2);
    expect(
      result.every((k) => k.serviceId === 'service-edu-A' && k.locationId === 'country-us'),
    ).toBe(true);
  });

  it('skips an entry whose countryId is null (safety belt — Plan §14.1)', () => {
    const result = buildEduEmpOrderItemKeys(
      ['service-edu-A'],
      [
        { entryId: 'edu-X', countryId: null },
        { entryId: 'edu-Y', countryId: 'country-us' },
      ],
      'education',
    );

    expect(result).toHaveLength(1);
    if (result[0].source.kind === 'education') {
      expect(result[0].source.entryId).toBe('edu-Y');
    }
  });

  it('produces one key per entry per service for kind="employment" with provenance kind="employment"', () => {
    const empEntries: EduEmpEntryFixture[] = [
      { entryId: 'emp-1', countryId: 'country-us' },
      { entryId: 'emp-2', countryId: 'country-de' },
    ];

    const result = buildEduEmpOrderItemKeys(
      ['service-emp-X'],
      empEntries,
      'employment',
    );

    expect(result).toHaveLength(2);
    expect(result.every((k) => k.source.kind === 'employment')).toBe(true);
  });

  it('returns an empty array when there are no services', () => {
    expect(
      buildEduEmpOrderItemKeys([], eduEntries, 'education'),
    ).toEqual([]);
  });

  it('returns an empty array when there are no entries', () => {
    expect(
      buildEduEmpOrderItemKeys(['service-edu-A'], [], 'education'),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildIdvOrderItemKeys — Rule 9 / Plan §14.3 / DoD 11
// ---------------------------------------------------------------------------

describe('buildIdvOrderItemKeys', () => {
  it('produces exactly one key per IDV service when a country is selected', () => {
    const result = buildIdvOrderItemKeys(
      ['service-idv-A', 'service-idv-B'],
      'country-us',
    );

    expect(result).toHaveLength(2);
    expect(result.map((k) => k.serviceId).sort()).toEqual(
      ['service-idv-A', 'service-idv-B'].sort(),
    );
  });

  it('sets locationId to the selected idv country', () => {
    const result = buildIdvOrderItemKeys(['service-idv-A'], 'country-mx');

    expect(result).toHaveLength(1);
    expect(result[0].locationId).toBe('country-mx');
  });

  it('marks each IDV key with source.kind="idv" and the selected countryId', () => {
    const result = buildIdvOrderItemKeys(['service-idv-A'], 'country-mx');

    expect(result).toHaveLength(1);
    expect(result[0].source.kind).toBe('idv');
    if (result[0].source.kind === 'idv') {
      expect(result[0].source.countryId).toBe('country-mx');
    }
  });

  it('returns an empty array when no country is selected (null)', () => {
    expect(buildIdvOrderItemKeys(['service-idv-A'], null)).toEqual([]);
  });

  it('returns an empty array when the country id is an empty string', () => {
    expect(buildIdvOrderItemKeys(['service-idv-A'], '')).toEqual([]);
  });

  it('returns an empty array when there are no IDV services', () => {
    expect(buildIdvOrderItemKeys([], 'country-us')).toEqual([]);
  });
});
