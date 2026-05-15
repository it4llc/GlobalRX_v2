// /GlobalRX_v2/src/lib/candidate/validation/__tests__/repeatableEntryFieldChecks.collectionTab.test.ts
//
// Pass 1 regression tests for the cross-section validation filtering bug fix.
//
// Spec:           docs/specs/cross-section-validation-filtering-bugfix.md
//                 (Bug A — Address History / Education / Employment per-entry
//                  walks must filter subject-targeted requirements)
//
// Subject of test: `findApplicableRequirements` (internal) exercised through
// the public exports `validateAddressHistoryEntries`,
// `validateEducationEntries`, and `validateEmploymentEntries`.
//
// REGRESSION TESTS: prove bug fix for cross-section-validation-filtering
// Bug A. Before the fix, `findApplicableRequirements` returns every
// requirement in `perReq.keys()` regardless of `fieldData.collectionTab`,
// causing subject-targeted requirements (collected on Personal Info) to be
// reported as missing on the entry section. After the fix, requirements
// whose `fieldData.collectionTab` lowercase-contains 'subject' or 'personal'
// are filtered OUT of the per-entry walk.
//
// Mocking discipline:
//   - Rule M1: We do NOT mock the helpers under test
//     (validateAddressHistoryEntries / validateEducationEntries /
//     validateEmploymentEntries). They are imported from the real module.
//   - Rule M2: N/A — pure functions with no rendering.
//   - Rule M3: findMappings is an inline implementation that filters fixture
//     rows by the requested (serviceId, locationId) pair list — matches the
//     existing pattern in `personalInfoIdvFieldChecks.test.ts:94–103`.

import { describe, it, expect, vi } from 'vitest';

import {
  validateAddressHistoryEntries,
  validateEducationEntries,
  validateEmploymentEntries,
  type DsxMappingRow,
  type RequirementRecord,
  type PackageServiceWithRequirements,
} from '../repeatableEntryFieldChecks';
import type { FindDsxMappings } from '../personalInfoIdvFieldChecks';
import type { SavedRepeatableEntry } from '../savedEntryShape';

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

interface RequirementFixture {
  id: string;
  name: string;
  fieldKey: string;
  /**
   * The pre-fix `RequirementRecord.fieldData` type does NOT declare
   * `collectionTab`. The architect's plan extends it; until then we cast
   * through `unknown` so the fixture can carry the property at runtime
   * without TypeScript complaining about the test's own typing.
   */
  fieldData?: { dataType?: string; collectionTab?: string } | null;
  disabled?: boolean;
  /**
   * DSXRequirement.type — defaults to 'field' (matches the most common
   * shape). Pass 'document' to exercise the document-type filter that
   * stops document requirements from being treated as missing fields on
   * Address History entries.
   */
  type?: string;
}

/**
 * Build a Map<requirementId, RequirementRecord> exactly as the loader's
 * `requirementById` is shaped — the per-entry walk reads this Map by
 * requirementId to recover the requirement record for each row in the
 * dsx_mappings result. Putting `collectionTab` inside `fieldData` mirrors
 * the architect's plan: extend `RequirementRecord.fieldData` to carry
 * `collectionTab?: string` (read from `fieldData.collectionTab` with the
 * snake_case `collection_tab` fallback).
 */
function buildRequirementById(
  fixtures: RequirementFixture[],
): Map<string, RequirementRecord> {
  const map = new Map<string, RequirementRecord>();
  for (const r of fixtures) {
    const fieldData = r.fieldData ?? null;
    map.set(r.id, {
      id: r.id,
      name: r.name,
      fieldKey: r.fieldKey,
      type: r.type ?? 'field',
      disabled: r.disabled ?? false,
      // Cast — see RequirementFixture.fieldData comment above.
      fieldData: fieldData as unknown as RequirementRecord['fieldData'],
    });
  }
  return map;
}

/**
 * Build the loose `PackageServiceWithRequirements[]` shape that the helper
 * reads when collecting (serviceId, countryId) pairs. The helper only reads
 * `ps.service.id` from this list, so we keep the fixture minimal.
 */
function buildPackageServices(
  serviceIds: string[],
): PackageServiceWithRequirements[] {
  return serviceIds.map((id) => ({
    id: `ps-${id}`,
    packageId: 'pkg-fixture',
    serviceId: id,
    service: { id, serviceRequirements: [], availability: [] },
    // Other fields on the Prisma payload are not read by the helper — cast.
  })) as unknown as PackageServiceWithRequirements[];
}

/**
 * findMappings inline implementation — returns fixture rows that match the
 * helper's batched (serviceId, locationId) pair list. The `requirementIds`
 * whitelist is honored when non-empty (matches the loader's adapter).
 */
function buildFindMappings(rows: DsxMappingRow[]): FindDsxMappings {
  return vi.fn(async ({ requirementIds, pairs }) => {
    const wanted = new Set(pairs.map((p) => `${p.serviceId}:${p.locationId}`));
    return rows.filter((row) => {
      if (!wanted.has(`${row.serviceId}:${row.locationId}`)) return false;
      if (requirementIds.length > 0 && !requirementIds.includes(row.requirementId)) {
        return false;
      }
      return true;
    });
  });
}

// ---------------------------------------------------------------------------
// Canonical constants reused across the suite.
// ---------------------------------------------------------------------------

const COUNTRY_A = 'country-uuid-A-0001';
const SVC_RECORD = 'svc-record-001';
const SVC_EDU = 'svc-edu-001';
const SVC_EMP = 'svc-emp-001';

// ---------------------------------------------------------------------------
// Bug A — Address History per-entry walk filters subject-targeted requirements
// ---------------------------------------------------------------------------

describe('validateAddressHistoryEntries — collectionTab filtering (Bug A)', () => {
  it('REGRESSION TEST: subject-targeted requirements are NOT reported as missing on the entry section', async () => {
    // Country A has TWO required-at-country mappings for the same address
    // entry:
    //   - req-state: an inline field (no collectionTab) — REQUIRED, FILLED
    //   - req-middleName: a subject-targeted field
    //       (fieldData.collectionTab = 'subject') — REQUIRED but the
    //       candidate's saved entry has no value for it (because the value
    //       is stored on Personal Info under a different requirementId).
    //
    // Pre-fix: findApplicableRequirements returns BOTH; the walk emits a
    //   FieldError for req-middleName ("missing").
    //
    // Post-fix: findApplicableRequirements drops req-middleName because its
    //   fieldData.collectionTab === 'subject'; the walk emits ZERO errors.
    const requirementById = buildRequirementById([
      {
        id: 'req-state',
        name: 'State',
        fieldKey: 'state',
        fieldData: { dataType: 'text' },
      },
      {
        id: 'req-middleName',
        name: 'Middle Name',
        fieldKey: 'middleName',
        // Subject-targeted: collected on Personal Info, NOT on this entry.
        fieldData: { dataType: 'text', collectionTab: 'subject' },
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [
          // The inline field IS filled.
          { requirementId: 'req-state', value: 'CA' },
          // No value for req-middleName — it lives on Personal Info.
        ],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-state',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-middleName',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    // No errors expected: state is filled; middleName is subject-targeted
    // and must NOT be checked against the entry's saved fields.
    expect(
      errors.find((e) => e.fieldName === 'Middle Name'),
    ).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Bug A — Education symmetric case
// ---------------------------------------------------------------------------

describe('validateEducationEntries — collectionTab filtering (Bug A)', () => {
  it('REGRESSION TEST: subject-targeted Education requirements are NOT reported as missing on the entry section', async () => {
    const requirementById = buildRequirementById([
      {
        id: 'req-degree',
        name: 'Degree Awarded',
        fieldKey: 'degreeAwarded',
        fieldData: { dataType: 'text' },
      },
      {
        id: 'req-middleName',
        name: 'Middle Name',
        fieldKey: 'middleName',
        fieldData: { dataType: 'text', collectionTab: 'subject' },
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-edu-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [{ requirementId: 'req-degree', value: 'BSc' }],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-degree',
        serviceId: SVC_EDU,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-middleName',
        serviceId: SVC_EDU,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateEducationEntries({
      sectionId: 'service_verification-edu',
      entries,
      packageServicesForSection: buildPackageServices([SVC_EDU]),
      findMappings,
      requirementById,
    });

    expect(
      errors.find((e) => e.fieldName === 'Middle Name'),
    ).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Bug A — Employment symmetric case
// ---------------------------------------------------------------------------

describe('validateEmploymentEntries — collectionTab filtering (Bug A)', () => {
  it('REGRESSION TEST: subject-targeted Employment requirements are NOT reported as missing on the entry section', async () => {
    const requirementById = buildRequirementById([
      {
        id: 'req-jobTitle',
        name: 'Job Title',
        fieldKey: 'jobTitle',
        fieldData: { dataType: 'text' },
      },
      {
        id: 'req-middleName',
        name: 'Middle Name',
        fieldKey: 'middleName',
        fieldData: { dataType: 'text', collectionTab: 'subject' },
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-emp-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [{ requirementId: 'req-jobTitle', value: 'Engineer' }],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-jobTitle',
        serviceId: SVC_EMP,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-middleName',
        serviceId: SVC_EMP,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateEmploymentEntries({
      sectionId: 'service_verification-emp',
      entries,
      packageServicesForSection: buildPackageServices([SVC_EMP]),
      findMappings,
      requirementById,
    });

    expect(
      errors.find((e) => e.fieldName === 'Middle Name'),
    ).toBeUndefined();
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('repeatableEntry collectionTab filtering — edge cases', () => {
  it('Edge case 1: country whose ONLY required field is subject-targeted → entry has zero errors', async () => {
    // Spec Edge Case 1: a country has only subject-targeted requirements
    // and no inline requirements. The entry section should return empty
    // errors — the subject-targeted requirements are Personal Info's
    // responsibility.
    const requirementById = buildRequirementById([
      {
        id: 'req-middleName',
        name: 'Middle Name',
        fieldKey: 'middleName',
        fieldData: { dataType: 'text', collectionTab: 'subject' },
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        // No fields saved on this entry at all.
        fields: [],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-middleName',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    expect(errors).toEqual([]);
  });

  it('Edge case 2: country has BOTH kinds; inline ones UNFILLED → only inline errors reported', async () => {
    // Proves the filter is narrow — when the inline field is missing, the
    // walk MUST still report it. The subject-targeted field is dropped, but
    // the inline field's empty value is still flagged.
    const requirementById = buildRequirementById([
      {
        id: 'req-state',
        name: 'State',
        fieldKey: 'state',
        fieldData: { dataType: 'text' },
      },
      {
        id: 'req-middleName',
        name: 'Middle Name',
        fieldKey: 'middleName',
        fieldData: { dataType: 'text', collectionTab: 'subject' },
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        // Neither field has a value — but only the inline one should produce
        // an error.
        fields: [],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-state',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-middleName',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    // Exactly one error — for the inline State field.
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldName).toBe('State');
    // The subject-targeted Middle Name must NOT appear in errors.
    expect(
      errors.find((e) => e.fieldName === 'Middle Name'),
    ).toBeUndefined();
  });

  it('Regression: collectionTab value "personal_info" (snake_case substring) is also filtered', async () => {
    // The architect's plan: substring match against lowercased
    // collectionTab, accepting both 'subject' and 'personal'. The value
    // 'personal_info' must trigger the filter (it lowercase-contains
    // 'personal').
    const requirementById = buildRequirementById([
      {
        id: 'req-ssn',
        name: 'Social Security Number',
        fieldKey: 'ssn',
        fieldData: { dataType: 'text', collectionTab: 'personal_info' },
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        // No value for ssn on this entry — it's saved on Personal Info.
        fields: [],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-ssn',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    expect(errors).toEqual([]);
  });

  it('Regression: empty / missing collectionTab is NOT filtered (those are inline requirements that must still be checked)', async () => {
    // Defensive proof that the filter is opt-in. A requirement with no
    // collectionTab (or an empty string) is a NORMAL inline requirement and
    // must continue to surface field errors when its saved value is empty.
    const requirementById = buildRequirementById([
      {
        id: 'req-inlineEmpty',
        name: 'Inline Empty',
        fieldKey: 'inlineEmpty',
        fieldData: { dataType: 'text', collectionTab: '' },
      },
      {
        id: 'req-inlineMissing',
        name: 'Inline Missing',
        fieldKey: 'inlineMissing',
        // No collectionTab key at all.
        fieldData: { dataType: 'text' },
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-inlineEmpty',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-inlineMissing',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    // Both inline requirements must produce errors — the filter is narrow.
    expect(errors).toHaveLength(2);
    const names = errors.map((e) => e.fieldName);
    expect(names).toContain('Inline Empty');
    expect(names).toContain('Inline Missing');
  });
});

// ---------------------------------------------------------------------------
// REGRESSION TESTS — document-type requirements must NOT be reported as
// missing field errors on Address History entries.
//
// Smoke testing surfaced that Address History stayed red even when every
// inline field on every entry was filled in. The cause: a record service
// in the package had document requirements (e.g., proof-of-address,
// court-record) mapped at the entry's country. Those documents are
// either per_search / per_order (stored in `aggregatedFields`, owned by
// Record Search Section post Task 8.4) or per_entry (uploaded metadata
// stored in `entry.fields[reqId]`). The per-entry walk was treating ALL
// applicable requirements as scalar fields and emitting a FieldError for
// every document not present in `entry.fields` — which is always true for
// per_search / per_order documents.
//
// Post-fix: `findApplicableRequirements` skips records whose
// `record.type === 'document'`. Document validation has its own paths
// (client-side `computeRepeatableSectionStatus.requiredDocumentsByEntry`
// for per_entry; Record Search Section for aggregated documents).
// ---------------------------------------------------------------------------

describe('repeatableEntry walk — document-type filtering (Bug A root cause)', () => {
  it('REGRESSION TEST: a required document-type requirement at the entry country is NOT reported as a missing FieldError', async () => {
    // Country A has TWO required mappings:
    //   - req-state: an inline text field — REQUIRED, FILLED
    //   - req-courtRecord: a per_search DOCUMENT — REQUIRED, NOT in entry.fields
    //     (per_search documents live in aggregatedFields)
    //
    // Pre-fix: the walk runs walkScalarRequirement against
    //   savedByRequirementId.get('req-courtRecord') === undefined → emits a
    //   FieldError "Court Record" with messageKey 'fieldRequired'. Address
    //   History stays red.
    //
    // Post-fix: findApplicableRequirements drops req-courtRecord because its
    //   record.type === 'document'. No error emitted.
    const requirementById = buildRequirementById([
      {
        id: 'req-state',
        name: 'State',
        fieldKey: 'state',
        fieldData: { dataType: 'text' },
        type: 'field',
      },
      {
        id: 'req-courtRecord',
        name: 'Court Record',
        fieldKey: 'courtRecord',
        fieldData: { dataType: 'document' },
        type: 'document',
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [{ requirementId: 'req-state', value: 'CA' }],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-state',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-courtRecord',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    expect(
      errors.find((e) => e.fieldName === 'Court Record'),
    ).toBeUndefined();
    expect(errors).toEqual([]);
  });

  it('keeps non-document required requirements when a document is also mapped (filter is narrow)', async () => {
    // Mixed bag at the same country:
    //   - req-state: inline field — REQUIRED, FILLED → no error
    //   - req-jobTitle: inline field — REQUIRED, UNFILLED → must error
    //   - req-courtRecord: document — REQUIRED, not in entry.fields → must NOT error
    const requirementById = buildRequirementById([
      {
        id: 'req-state',
        name: 'State',
        fieldKey: 'state',
        fieldData: { dataType: 'text' },
        type: 'field',
      },
      {
        id: 'req-jobTitle',
        name: 'Job Title',
        fieldKey: 'jobTitle',
        fieldData: { dataType: 'text' },
        type: 'field',
      },
      {
        id: 'req-courtRecord',
        name: 'Court Record',
        fieldKey: 'courtRecord',
        fieldData: { dataType: 'document' },
        type: 'document',
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [{ requirementId: 'req-state', value: 'CA' }],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-state',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-jobTitle',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-courtRecord',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    // Exactly one error — for the inline jobTitle field. Court Record (doc)
    // must NOT appear.
    expect(errors).toHaveLength(1);
    expect(errors[0].fieldName).toBe('Job Title');
    expect(
      errors.find((e) => e.fieldName === 'Court Record'),
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// REGRESSION TESTS — Personal Info fieldKey heuristic.
//
// Smoke testing showed Address History stayed red even after the
// collectionTab filter shipped. Root cause: a DSX requirement with a PI-style
// fieldKey (e.g. `middleName`, `dateOfBirth`, `ssn`) but NO explicit
// `collectionTab` falls through the collectionTab-only filter. The Personal
// Info route surfaces it (using the same fieldKey heuristic), the candidate
// fills it in on Personal Info, the entry's `fields[]` never receives a
// value, and the per-entry walk emits a "missing field" error.
//
// Spec: docs/specs/cross-section-validation-filtering-bugfix.md Bug A
// (extended). Fix: `isPersonalInfoOwnedRequirement` consults the same
// PERSONAL_INFO_FIELD_KEYS set as `personal-info-fields/route.ts` and
// `personalInfoIdvFieldChecks.ts`.
// ---------------------------------------------------------------------------

describe('repeatableEntry — PERSONAL_INFO_FIELD_KEYS heuristic (Bug A extension)', () => {
  it('REGRESSION TEST: PI fieldKey without collectionTab is filtered (middleName)', async () => {
    // A DSX requirement with `fieldKey === 'middleName'` and no
    // `collectionTab` at all must be treated as Personal-Info-owned and
    // skipped by the per-entry walk. Without this filter the walk reports
    // a missing FieldError on every Address History entry whose country has
    // a middleName mapping — keeping the sidebar red after the candidate
    // fills middleName in on Personal Info.
    const requirementById = buildRequirementById([
      {
        id: 'req-middleName-noTab',
        name: 'Middle Name',
        fieldKey: 'middleName',
        fieldData: { dataType: 'text' }, // NO collectionTab
      },
      {
        id: 'req-state',
        name: 'State',
        fieldKey: 'state',
        fieldData: { dataType: 'text' },
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [{ requirementId: 'req-state', value: 'CA' }],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-middleName-noTab',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-state',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    expect(errors).toEqual([]);
  });

  it('REGRESSION TEST: locked invitation fieldKey (firstName) without collectionTab is filtered', async () => {
    // The locked invitation keys are sourced from the invitation columns and
    // never saved on the entry. Without the fieldKey heuristic, every
    // address entry whose country requires `firstName` produces a missing
    // FieldError.
    const requirementById = buildRequirementById([
      {
        id: 'req-firstName',
        name: 'First Name',
        fieldKey: 'firstName',
        fieldData: { dataType: 'text' }, // NO collectionTab
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-firstName',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    expect(errors).toEqual([]);
  });

  it('REGRESSION TEST: PI fieldKey heuristic applies to Education and Employment too', async () => {
    const requirementById = buildRequirementById([
      {
        id: 'req-dob',
        name: 'Date of Birth',
        fieldKey: 'dateOfBirth',
        fieldData: { dataType: 'date' }, // NO collectionTab
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-dob',
        serviceId: SVC_EDU,
        locationId: COUNTRY_A,
        isRequired: true,
      },
      {
        requirementId: 'req-dob',
        serviceId: SVC_EMP,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const eduErrors = await validateEducationEntries({
      sectionId: 'service_verification-edu',
      entries,
      packageServicesForSection: buildPackageServices([SVC_EDU]),
      findMappings,
      requirementById,
    });
    const empErrors = await validateEmploymentEntries({
      sectionId: 'service_verification-emp',
      entries,
      packageServicesForSection: buildPackageServices([SVC_EMP]),
      findMappings,
      requirementById,
    });

    expect(eduErrors).toEqual([]);
    expect(empErrors).toEqual([]);
  });

  it('Non-PI fieldKey without collectionTab is NOT filtered (filter is narrow)', async () => {
    // Proves the heuristic is opt-in. A requirement whose fieldKey isn't in
    // the PI set must continue to surface missing-field errors when its
    // saved value is empty.
    const requirementById = buildRequirementById([
      {
        id: 'req-passport',
        name: 'Passport Number',
        fieldKey: 'passportNumber',
        fieldData: { dataType: 'text' }, // NO collectionTab, NOT a PI key
      },
    ]);

    const entries: SavedRepeatableEntry[] = [
      {
        entryId: 'entry-1',
        countryId: COUNTRY_A,
        entryOrder: 1,
        fields: [],
      },
    ];

    const findMappings = buildFindMappings([
      {
        requirementId: 'req-passport',
        serviceId: SVC_RECORD,
        locationId: COUNTRY_A,
        isRequired: true,
      },
    ]);

    const errors = await validateAddressHistoryEntries({
      sectionId: 'address_history',
      entries,
      packageServicesForSection: buildPackageServices([SVC_RECORD]),
      findMappings,
      requirementById,
    });

    expect(errors).toHaveLength(1);
    expect(errors[0].fieldName).toBe('Passport Number');
  });
});
