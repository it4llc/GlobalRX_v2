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
      availability: [],
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
        functionalityType: 'idv',
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
        functionalityType: 'idv',
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
        functionalityType: 'idv',
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
        functionalityType: 'idv',
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
