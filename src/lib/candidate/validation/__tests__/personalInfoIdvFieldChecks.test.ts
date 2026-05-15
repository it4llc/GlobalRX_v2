// /GlobalRX_v2/src/lib/candidate/validation/__tests__/personalInfoIdvFieldChecks.test.ts
//
// Phase 7 Stage 2 — Pass 2 regression tests for collectIdvFieldRequirements.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
//                 (TD-062 fix — Rule 3, server-side validation of Personal
//                 Info / IDV required fields)
// Implementation: src/lib/candidate/validation/personalInfoIdvFieldChecks.ts
//
// REGRESSION TEST: collectIdvFieldRequirements MUST exclude requirements
// claimed by the Personal Info collector (collectionTab includes 'personal'
// or 'subject', or fieldKey is one of the canonical personal-info field
// keys). Without this exclusion, IDV-mapped DSX fields with
// collectionTab='subject' (e.g. firstName/lastName) get reported as unfilled
// IDV requirements even when the candidate has already satisfied them via
// Personal Info or the locked invitation columns.
//
// Mocking discipline:
//   - Rule M1: We do NOT mock collectIdvFieldRequirements (subject of test).
//   - Rule M2: N/A — pure function with no rendering.
//   - Rule M3: findMappings is mocked with an INLINE implementation that
//     reads the requested (service, location) pairs and returns rows
//     matching the test fixture. No mockReturnValue scripted sequence.

import { describe, it, expect, vi } from 'vitest';

import {
  collectIdvFieldRequirements,
  collectPersonalInfoFieldRequirements,
  type DsxMappingRow,
  type FindDsxMappings,
} from '../personalInfoIdvFieldChecks';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

interface RequirementFixture {
  id: string;
  name: string;
  fieldKey: string;
  type: 'field' | 'document';
  disabled?: boolean;
  fieldData?: { collectionTab?: string } | null;
}

interface ServiceFixture {
  id: string;
  functionalityType: string;
  requirements: RequirementFixture[];
  // Task 8.3 — availability rows are needed by
  // collectPersonalInfoFieldRequirements, which builds its (serviceId,
  // locationId) pair list from ps.service.availability rather than from a
  // separate Prisma query. The existing IDV tests pass [] here and never
  // consult the field.
  availability?: Array<{ serviceId: string; locationId: string; isAvailable: boolean }>;
}

/**
 * Build the loose `PackageServiceWithRequirements[]` shape that
 * `collectIdvFieldRequirements` reads. We use `unknown` then a typed cast
 * because the helper accepts the full Prisma payload type and the test
 * doesn't need every column it doesn't read.
 */
function buildPackageServices(services: ServiceFixture[]): unknown[] {
  return services.map((s) => ({
    serviceId: s.id,
    scope: null,
    service: {
      id: s.id,
      functionalityType: s.functionalityType,
      serviceRequirements: s.requirements.map((r) => ({
        serviceId: s.id,
        requirementId: r.id,
        requirement: {
          id: r.id,
          name: r.name,
          fieldKey: r.fieldKey,
          type: r.type,
          disabled: r.disabled ?? false,
          fieldData: r.fieldData ?? null,
        },
      })),
      availability: s.availability ?? [],
    },
  }));
}

// ---------------------------------------------------------------------------
// findMappings — inline implementation reading the (service, location) pairs
// supplied by the helper and the test-supplied row fixture (Rule M3).
// ---------------------------------------------------------------------------

function buildFindMappings(rows: DsxMappingRow[]): FindDsxMappings {
  return vi.fn(async ({ pairs }) => {
    // Filter the fixture rows to those whose (serviceId, locationId) pair
    // appears in the requested set. This keeps the mock honest — if the
    // helper ever passed mismatched arguments the test would see no rows
    // and fail loudly.
    const wanted = new Set(pairs.map((p) => `${p.serviceId}:${p.locationId}`));
    return rows.filter((r) => wanted.has(`${r.serviceId}:${r.locationId}`));
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('collectIdvFieldRequirements — personal-info exclusion (TD-062 / Stage 2 fix)', () => {
  const COUNTRY_ID = 'country-uuid-001';
  const SVC_IDV = 'svc-idv-001';

  it('REGRESSION TEST: excludes a requirement whose fieldKey is "firstName" even when the IDV mapping marks it required', async () => {
    // Bug: without the personal-info exclusion, a DSX requirement with
    // fieldKey='firstName' that happens to be mapped at the IDV service
    // would surface as an unfilled IDV requirement on the Review page —
    // even though the locked invitation column already supplies the value.
    //
    // CORRECT behavior (post-fix): the helper drops `firstName` from the
    // returned list, so the validator never marks it as missing.

    const packageServices = buildPackageServices([
      {
        id: SVC_IDV,
        functionalityType: 'verification-idv',
        requirements: [
          {
            id: 'req-firstName',
            name: 'First Name',
            fieldKey: 'firstName',
            type: 'field',
            fieldData: null,
          },
          {
            id: 'req-idNumber',
            name: 'ID Number',
            fieldKey: 'idNumber',
            type: 'field',
            fieldData: { collectionTab: 'idv' },
          },
        ],
      },
    ]);

    const findMappings = buildFindMappings([
      // Both requirements are mapped at the selected country and marked
      // isRequired. The helper must STILL drop the firstName one.
      {
        requirementId: 'req-firstName',
        serviceId: SVC_IDV,
        locationId: COUNTRY_ID,
        isRequired: true,
      },
      {
        requirementId: 'req-idNumber',
        serviceId: SVC_IDV,
        locationId: COUNTRY_ID,
        isRequired: true,
      },
    ]);

    const result = await collectIdvFieldRequirements(
      packageServices as never,
      COUNTRY_ID,
      findMappings,
    );

    // Only the non-personal-info IDV requirement survives.
    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('idNumber');
    expect(result[0].isRequired).toBe(true);

    // Defensive — explicitly confirm firstName is NOT in the output.
    expect(result.find((r) => r.fieldKey === 'firstName')).toBeUndefined();
  });

  it('REGRESSION TEST: excludes a requirement whose fieldData.collectionTab is "subject"', async () => {
    const packageServices = buildPackageServices([
      {
        id: SVC_IDV,
        functionalityType: 'verification-idv',
        requirements: [
          {
            id: 'req-ssn',
            name: 'Social Security Number',
            // fieldKey is auto-fallback / opaque — the collectionTab is what
            // identifies this as a subject/personal-info field.
            fieldKey: 'opaqueSsnKey',
            type: 'field',
            fieldData: { collectionTab: 'subject' },
          },
          {
            id: 'req-idNumber',
            name: 'ID Number',
            fieldKey: 'idNumber',
            type: 'field',
            fieldData: { collectionTab: 'idv' },
          },
        ],
      },
    ]);

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-ssn',
        serviceId: SVC_IDV,
        locationId: COUNTRY_ID,
        isRequired: true,
      },
      {
        requirementId: 'req-idNumber',
        serviceId: SVC_IDV,
        locationId: COUNTRY_ID,
        isRequired: true,
      },
    ]);

    const result = await collectIdvFieldRequirements(
      packageServices as never,
      COUNTRY_ID,
      findMappings,
    );

    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('idNumber');
  });

  it('REGRESSION TEST: excludes "lastName", "email", "phone", "dateOfBirth" when reachable through the IDV mapping', async () => {
    const personalKeys = ['lastName', 'email', 'phone', 'dateOfBirth'];

    const packageServices = buildPackageServices([
      {
        id: SVC_IDV,
        functionalityType: 'verification-idv',
        requirements: [
          ...personalKeys.map((k) => ({
            id: `req-${k}`,
            name: k,
            fieldKey: k,
            type: 'field' as const,
            fieldData: null,
          })),
          {
            id: 'req-idv-only',
            name: 'IDV-Only Field',
            fieldKey: 'idvOnly',
            type: 'field',
            fieldData: { collectionTab: 'idv' },
          },
        ],
      },
    ]);

    const findMappings = buildFindMappings([
      ...personalKeys.map((k) => ({
        requirementId: `req-${k}`,
        serviceId: SVC_IDV,
        locationId: COUNTRY_ID,
        isRequired: true,
      })),
      {
        requirementId: 'req-idv-only',
        serviceId: SVC_IDV,
        locationId: COUNTRY_ID,
        isRequired: true,
      },
    ]);

    const result = await collectIdvFieldRequirements(
      packageServices as never,
      COUNTRY_ID,
      findMappings,
    );

    // Only the genuinely IDV requirement survives.
    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('idvOnly');

    // Defensive — confirm none of the personal keys leaked through.
    for (const k of personalKeys) {
      expect(result.find((r) => r.fieldKey === k)).toBeUndefined();
    }
  });

  it('returns IDV-only requirements (positive case) so the regression test isn\'t accidentally vacuous', async () => {
    // Sanity check — the helper still returns IDV-tab requirements when
    // they are present.
    const packageServices = buildPackageServices([
      {
        id: SVC_IDV,
        functionalityType: 'verification-idv',
        requirements: [
          {
            id: 'req-idNumber',
            name: 'ID Number',
            fieldKey: 'idNumber',
            type: 'field',
            fieldData: { collectionTab: 'idv' },
          },
        ],
      },
    ]);

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-idNumber',
        serviceId: SVC_IDV,
        locationId: COUNTRY_ID,
        isRequired: true,
      },
    ]);

    const result = await collectIdvFieldRequirements(
      packageServices as never,
      COUNTRY_ID,
      findMappings,
    );

    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('idNumber');
    expect(result[0].isRequired).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 8.3 — collectPersonalInfoFieldRequirements must exclude the locked
// invitation fieldKeys (firstName, lastName, email, phone, phoneNumber).
//
// Spec: docs/specs/personal-info-dynamic.md (Business Rule 6, DoD item 6).
// Plan: docs/plans/personal-info-dynamic-technical-plan.md (Section 2 / 10).
//
// The Pass-1-existing collectIdvFieldRequirements suite above stays unchanged.
// We add a new suite here that targets the Personal Info collector specifi-
// cally and pins the Task 8.3 contract: locked invitation fieldKeys MUST be
// dropped, non-locked personal-info fieldKeys (middleName, dateOfBirth, ssn,
// etc.) MUST still come through.
//
// Mocking discipline:
//   - Rule M1: collectPersonalInfoFieldRequirements is the subject — NOT
//     mocked.
//   - Rule M3: findMappings uses the existing buildFindMappings inline
//     implementation that reads pairs from the helper and filters fixture
//     rows accordingly.
// ---------------------------------------------------------------------------

describe('collectPersonalInfoFieldRequirements — Task 8.3 locked-field exclusion', () => {
  const SVC_PI = 'svc-pi-001';
  const LOC_A = 'loc-A';

  // Standard availability row used by every test in this suite. The helper
  // builds its (serviceId, locationId) pair list from ps.service.availability;
  // without at least one row, every requirement falls through to isRequired
  // = false (spec Edge Case 3 — which is correct, but doesn't exercise the
  // AND-aggregation path we want to confirm doesn't regress).
  const baseAvailability = [
    { serviceId: SVC_PI, locationId: LOC_A, isAvailable: true },
  ];

  it('does NOT return the firstName requirement even when it has collectionTab=subject and is mapped to a package service', async () => {
    const packageServices = buildPackageServices([
      {
        id: SVC_PI,
        functionalityType: 'personal-info',
        availability: baseAvailability,
        requirements: [
          {
            id: 'req-firstName',
            name: 'First Name',
            fieldKey: 'firstName',
            type: 'field',
            fieldData: { collectionTab: 'subject' },
          },
        ],
      },
    ]);

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-firstName',
        serviceId: SVC_PI,
        locationId: LOC_A,
        isRequired: true,
      },
    ]);

    const result = await collectPersonalInfoFieldRequirements(
      packageServices as never,
      findMappings,
    );

    expect(result).toHaveLength(0);
    expect(result.find((r) => r.fieldKey === 'firstName')).toBeUndefined();
  });

  it('does NOT return any of lastName, email, phone, phoneNumber when they are mapped through Personal Info', async () => {
    const lockedKeys = ['lastName', 'email', 'phone', 'phoneNumber'];

    const packageServices = buildPackageServices([
      {
        id: SVC_PI,
        functionalityType: 'personal-info',
        availability: baseAvailability,
        requirements: lockedKeys.map((k) => ({
          id: `req-${k}`,
          name: k,
          fieldKey: k,
          type: 'field' as const,
          fieldData: { collectionTab: 'subject' },
        })),
      },
    ]);

    const findMappings = buildFindMappings(
      lockedKeys.map((k) => ({
        requirementId: `req-${k}`,
        serviceId: SVC_PI,
        locationId: LOC_A,
        isRequired: true,
      })),
    );

    const result = await collectPersonalInfoFieldRequirements(
      packageServices as never,
      findMappings,
    );

    expect(result).toHaveLength(0);
    for (const k of lockedKeys) {
      expect(result.find((r) => r.fieldKey === k)).toBeUndefined();
    }
  });

  it('returns the middleName requirement when present (positive proof — no over-filtering)', async () => {
    // middleName is in PERSONAL_INFO_FIELD_KEYS (so isPersonalInfoField
    // returns true) but is NOT in LOCKED_INVITATION_FIELD_KEYS, so the
    // Task 8.3 guard does not strip it.
    const packageServices = buildPackageServices([
      {
        id: SVC_PI,
        functionalityType: 'personal-info',
        availability: baseAvailability,
        requirements: [
          {
            id: 'req-middleName',
            name: 'Middle Name',
            fieldKey: 'middleName',
            type: 'field',
            fieldData: { collectionTab: 'subject' },
          },
        ],
      },
    ]);

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-middleName',
        serviceId: SVC_PI,
        locationId: LOC_A,
        isRequired: true,
      },
    ]);

    const result = await collectPersonalInfoFieldRequirements(
      packageServices as never,
      findMappings,
    );

    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('middleName');
    expect(result[0].isRequired).toBe(true);
  });

  it('returns the dateOfBirth requirement when present (positive proof — no over-filtering)', async () => {
    const packageServices = buildPackageServices([
      {
        id: SVC_PI,
        functionalityType: 'personal-info',
        availability: baseAvailability,
        requirements: [
          {
            id: 'req-dob',
            name: 'Date of Birth',
            fieldKey: 'dateOfBirth',
            type: 'field',
            fieldData: { collectionTab: 'subject' },
          },
        ],
      },
    ]);

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-dob',
        serviceId: SVC_PI,
        locationId: LOC_A,
        isRequired: true,
      },
    ]);

    const result = await collectPersonalInfoFieldRequirements(
      packageServices as never,
      findMappings,
    );

    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('dateOfBirth');
    expect(result[0].isRequired).toBe(true);
  });

  it('returns the non-locked field and drops the locked one when both are mapped to the same service', async () => {
    // Mixed fixture — locked firstName + non-locked dateOfBirth. The helper
    // must produce a result list containing only dateOfBirth.
    const packageServices = buildPackageServices([
      {
        id: SVC_PI,
        functionalityType: 'personal-info',
        availability: baseAvailability,
        requirements: [
          {
            id: 'req-firstName',
            name: 'First Name',
            fieldKey: 'firstName',
            type: 'field',
            fieldData: { collectionTab: 'subject' },
          },
          {
            id: 'req-dob',
            name: 'Date of Birth',
            fieldKey: 'dateOfBirth',
            type: 'field',
            fieldData: { collectionTab: 'subject' },
          },
        ],
      },
    ]);

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-firstName',
        serviceId: SVC_PI,
        locationId: LOC_A,
        isRequired: true,
      },
      {
        requirementId: 'req-dob',
        serviceId: SVC_PI,
        locationId: LOC_A,
        isRequired: true,
      },
    ]);

    const result = await collectPersonalInfoFieldRequirements(
      packageServices as never,
      findMappings,
    );

    expect(result).toHaveLength(1);
    expect(result[0].fieldKey).toBe('dateOfBirth');
    expect(result.find((r) => r.fieldKey === 'firstName')).toBeUndefined();
  });
});
