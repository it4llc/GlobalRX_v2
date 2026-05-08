// /GlobalRX_v2/src/lib/candidate/submission/__tests__/orderDataPopulation.test.ts
// Pass 1 unit tests for Phase 7 Stage 2:
// orderDataPopulation — pure helper that translates per-entry formData into
// OrderData rows.
//
// These tests will FAIL when first run because the helper does not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md
//
// Coverage:
//   - Spec Rule 11 / Plan §15.1, §15.2:    OrderData row shape (orderItemId,
//                                          fieldName=requirementId, fieldValue,
//                                          fieldType)
//   - Spec Rule 11 / Plan §15.1:           per-section iteration shape — address
//                                          uses entry.fields + section.aggregatedFields;
//                                          edu/emp use only entry.fields; idv uses
//                                          section.fields excluding the `idv_country`
//                                          marker.
//   - Plan §15.2:                          fieldValue stringification — primitive
//                                          passthrough; object/array → JSON.stringify
//   - Plan §15.2:                          fieldType derivation — requirement.type==='document'
//                                          → 'document'; else fieldData.dataType ?? 'text'
//   - Spec Rule 22 / Plan §15.3:           document references survive as JSON-stringified
//                                          metadata (no file copying)
//   - Spec Rule 12 / Plan §15.4:           Personal Info goes to Order.subject, NOT to
//                                          OrderData (covered by buildOrderSubject tests).
//   - DoD 13:                              OrderData records contain candidate's per-entry
//                                          field values
//
// IMPORTANT: This file imports nothing from Prisma, the database, the network,
// or the filesystem. The helper under test is a pure function of its inputs.

import { describe, it, expect } from 'vitest';

import { buildOrderDataRows } from '../orderDataPopulation';

// ---------------------------------------------------------------------------
// Shared fixture types
//
// SourceProvenance mirrors technical plan §6 (OrderItemKey.source). The
// formData section shapes mirror plan §15.1 / validation engine
// SavedSectionData.
// ---------------------------------------------------------------------------

interface SavedFieldFixture {
  requirementId: string;
  value: unknown;
}

interface SavedRepeatableEntryFixture {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: SavedFieldFixture[];
}

interface AddressHistorySectionFixture {
  entries: SavedRepeatableEntryFixture[];
  aggregatedFields?: Record<string, unknown>;
}

interface EduEmpSectionFixture {
  entries: SavedRepeatableEntryFixture[];
}

interface IdvSectionFixture {
  fields: SavedFieldFixture[];
}

// DSXRequirement lookup row — the fields the helper actually reads
// (per plan §15.2). Documented as a small interface to keep the test fixtures
// honest about which DSXRequirement columns are consumed.
interface DsxRequirementLookupRow {
  id: string;
  type: 'field' | 'document';
  fieldData?: { dataType?: string } | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORDER_ITEM_ID = 'order-item-uuid-123';

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------

function lookupFromRows(rows: DsxRequirementLookupRow[]): Map<string, DsxRequirementLookupRow> {
  return new Map(rows.map((r) => [r.id, r]));
}

// ---------------------------------------------------------------------------
// Address-history provenance
// ---------------------------------------------------------------------------

describe('buildOrderDataRows — address-history provenance', () => {
  it('returns one OrderData row per saved field on the matching entry', () => {
    const section: AddressHistorySectionFixture = {
      entries: [
        {
          entryId: 'addr-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [
            { requirementId: 'req-address-block', value: { fromDate: '2024-01-01' } },
            { requirementId: 'req-zip', value: '98101' },
          ],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-address-block', type: 'field', fieldData: { dataType: 'address' } },
      { id: 'req-zip', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'address', addressEntryId: 'addr-1' },
      addressHistorySection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.orderItemId === ORDER_ITEM_ID)).toBe(true);
  });

  it('uses the requirementId as the fieldName on every row (Plan §15.2)', () => {
    const section: AddressHistorySectionFixture = {
      entries: [
        {
          entryId: 'addr-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-foo', value: 'bar' }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-foo', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'address', addressEntryId: 'addr-1' },
      addressHistorySection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows[0].fieldName).toBe('req-foo');
  });

  it('passes through string values unchanged in fieldValue', () => {
    const section: AddressHistorySectionFixture = {
      entries: [
        {
          entryId: 'addr-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-zip', value: '98101' }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-zip', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'address', addressEntryId: 'addr-1' },
      addressHistorySection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows[0].fieldValue).toBe('98101');
  });

  it('JSON-stringifies object values (e.g., the address_block JSON)', () => {
    const blockValue = {
      fromDate: '2024-01-01',
      toDate: null,
      isCurrent: true,
      countryId: 'country-us',
    };
    const section: AddressHistorySectionFixture = {
      entries: [
        {
          entryId: 'addr-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-address-block', value: blockValue }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-address-block', type: 'field', fieldData: { dataType: 'address' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'address', addressEntryId: 'addr-1' },
      addressHistorySection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows[0].fieldValue).toBe(JSON.stringify(blockValue));
  });

  it('also emits OrderData rows for the section.aggregatedFields (Plan §15.1 — per-section data applies to every record-type item)', () => {
    const section: AddressHistorySectionFixture = {
      entries: [
        {
          entryId: 'addr-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-zip', value: '98101' }],
        },
      ],
      aggregatedFields: {
        'req-aggregated-A': 'value-A',
        'req-aggregated-B': 'value-B',
      },
    };
    const lookup = lookupFromRows([
      { id: 'req-zip', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-aggregated-A', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-aggregated-B', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'address', addressEntryId: 'addr-1' },
      addressHistorySection: section,
      dsxRequirementsLookup: lookup,
    });

    // 1 per-entry field + 2 aggregated fields = 3 rows total.
    expect(rows).toHaveLength(3);
    const fieldNames = rows.map((r) => r.fieldName).sort();
    expect(fieldNames).toEqual(['req-aggregated-A', 'req-aggregated-B', 'req-zip']);
  });

  it('returns an empty array when no entry matches the source.addressEntryId (defense)', () => {
    const section: AddressHistorySectionFixture = {
      entries: [
        {
          entryId: 'addr-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-zip', value: '98101' }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-zip', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'address', addressEntryId: 'addr-DOES-NOT-EXIST' },
      addressHistorySection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Education / Employment provenance
// ---------------------------------------------------------------------------

describe('buildOrderDataRows — education provenance', () => {
  it('returns one OrderData row per saved field on the matching education entry', () => {
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [
            { requirementId: 'req-school', value: 'University X' },
            { requirementId: 'req-degree', value: 'BS' },
          ],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-school', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-degree', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-1', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.fieldName).sort()).toEqual(['req-degree', 'req-school']);
  });

  it('does NOT include section-level aggregatedFields for education (only address history aggregates)', () => {
    // Education sections do not have `aggregatedFields` per plan §15.1 — only
    // address_history does. We verify the helper does not look them up.
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-school', value: 'University X' }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-school', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-1', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(1);
  });

  it('returns empty when the education entryId does not match any saved entry', () => {
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-school', value: 'X' }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-school', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-MISSING', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toEqual([]);
  });
});

describe('buildOrderDataRows — employment provenance', () => {
  it('returns one OrderData row per saved field on the matching employment entry', () => {
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'emp-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [
            { requirementId: 'req-employer', value: 'Acme Corp' },
            { requirementId: 'req-title', value: 'Engineer' },
            { requirementId: 'req-start-date', value: '2020-01-01' },
          ],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-employer', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-title', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-start-date', type: 'field', fieldData: { dataType: 'date' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'employment', entryId: 'emp-1', countryId: 'country-us' },
      employmentSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(3);
    const fieldNames = rows.map((r) => r.fieldName).sort();
    expect(fieldNames).toEqual(['req-employer', 'req-start-date', 'req-title']);
  });
});

// ---------------------------------------------------------------------------
// IDV provenance
// ---------------------------------------------------------------------------

describe('buildOrderDataRows — IDV provenance', () => {
  it('returns one OrderData row per saved IDV field, EXCLUDING the idv_country marker (Plan §15.1)', () => {
    const section: IdvSectionFixture = {
      fields: [
        { requirementId: 'idv_country', value: 'country-us' },
        { requirementId: 'req-idv-doc-number', value: '123456' },
        { requirementId: 'req-idv-issuing-state', value: 'WA' },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-idv-doc-number', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-idv-issuing-state', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'idv', countryId: 'country-us' },
      idvSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(2);
    const names = rows.map((r) => r.fieldName).sort();
    expect(names).toEqual(['req-idv-doc-number', 'req-idv-issuing-state']);
    // Critically, the marker is NOT in the result.
    expect(names).not.toContain('idv_country');
  });

  it('returns empty when the IDV section has only the idv_country marker', () => {
    const section: IdvSectionFixture = {
      fields: [{ requirementId: 'idv_country', value: 'country-us' }],
    };
    const lookup = lookupFromRows([]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'idv', countryId: 'country-us' },
      idvSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// fieldType derivation — Plan §15.2
// ---------------------------------------------------------------------------

describe('buildOrderDataRows — fieldType derivation', () => {
  it('sets fieldType="document" when the requirement.type is "document"', () => {
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [
            {
              requirementId: 'req-diploma-doc',
              value: {
                documentId: 'doc-uuid-1',
                originalName: 'diploma.pdf',
                storagePath: 'uploads/draft-documents/abc/diploma.pdf',
                mimeType: 'application/pdf',
                size: 12345,
                uploadedAt: '2026-05-01T00:00:00Z',
              },
            },
          ],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-diploma-doc', type: 'document', fieldData: null },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-1', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].fieldType).toBe('document');
  });

  it('uses requirement.fieldData.dataType when requirement.type is "field"', () => {
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-graduation-date', value: '2020-06-01' }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-graduation-date', type: 'field', fieldData: { dataType: 'date' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-1', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].fieldType).toBe('date');
  });

  it('defaults fieldType to "text" when requirement.fieldData is missing or has no dataType', () => {
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [
            { requirementId: 'req-no-fielddata', value: 'A' },
            { requirementId: 'req-empty-fielddata', value: 'B' },
          ],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-no-fielddata', type: 'field', fieldData: null },
      { id: 'req-empty-fielddata', type: 'field', fieldData: {} },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-1', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.fieldType === 'text')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Document-reference handling — Spec Rule 22 / Plan §15.3
// ---------------------------------------------------------------------------

describe('buildOrderDataRows — document references (Rule 22)', () => {
  it('JSON-stringifies the document metadata into fieldValue without modifying it', () => {
    const docMetadata = {
      documentId: 'doc-uuid-42',
      originalName: 'transcript.pdf',
      storagePath: 'uploads/draft-documents/xyz/transcript.pdf',
      mimeType: 'application/pdf',
      size: 67890,
      uploadedAt: '2026-04-30T12:00:00Z',
    };
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-transcript', value: docMetadata }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-transcript', type: 'document', fieldData: null },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-1', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].fieldValue).toBe(JSON.stringify(docMetadata));
    expect(rows[0].fieldType).toBe('document');
    // Round-trip should still yield the same metadata — i.e., the helper is
    // not mutating, copying, or moving anything.
    expect(JSON.parse(rows[0].fieldValue)).toEqual(docMetadata);
  });
});

// ---------------------------------------------------------------------------
// Boundary / edge cases
// ---------------------------------------------------------------------------

describe('buildOrderDataRows — boundary cases', () => {
  it('skips fields whose value is undefined (Plan §15.2 — "for each saved field with a non-undefined value")', () => {
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [
            { requirementId: 'req-A', value: 'present' },
            { requirementId: 'req-B', value: undefined },
          ],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-A', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-B', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-1', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].fieldName).toBe('req-A');
  });

  it('JSON-stringifies array values (e.g., multi-select fields)', () => {
    const arrayValue = ['option-a', 'option-b', 'option-c'];
    const section: EduEmpSectionFixture = {
      entries: [
        {
          entryId: 'edu-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [{ requirementId: 'req-multi', value: arrayValue }],
        },
      ],
    };
    const lookup = lookupFromRows([
      { id: 'req-multi', type: 'field', fieldData: { dataType: 'multi-select' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'education', entryId: 'edu-1', countryId: 'country-us' },
      educationSection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].fieldValue).toBe(JSON.stringify(arrayValue));
  });

  it('sets every row\'s orderItemId to the given orderItemId', () => {
    const section: AddressHistorySectionFixture = {
      entries: [
        {
          entryId: 'addr-1',
          countryId: 'country-us',
          entryOrder: 0,
          fields: [
            { requirementId: 'req-A', value: 'a' },
            { requirementId: 'req-B', value: 'b' },
          ],
        },
      ],
      aggregatedFields: { 'req-C': 'c' },
    };
    const lookup = lookupFromRows([
      { id: 'req-A', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-B', type: 'field', fieldData: { dataType: 'text' } },
      { id: 'req-C', type: 'field', fieldData: { dataType: 'text' } },
    ]);

    const rows = buildOrderDataRows({
      orderItemId: ORDER_ITEM_ID,
      source: { kind: 'address', addressEntryId: 'addr-1' },
      addressHistorySection: section,
      dsxRequirementsLookup: lookup,
    });

    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.orderItemId === ORDER_ITEM_ID)).toBe(true);
  });
});
