// /GlobalRX_v2/src/lib/candidate/__tests__/addressHistoryStage4Wiring.test.tsx
//
// Phase 6 Stage 4 — pure-helper tests for the AddressHistory-specific wiring
// module. The helpers are 100% pure (no React, no I/O), so tests live here
// rather than in the section's component test file. The section's existing
// component test (AddressHistorySection.test.tsx) intentionally covers the
// integrated behavior; these tests lock the small, pure transforms.
//
// Andy-authorized one-off Rule 1 override (per Option B): the implementer
// agent is permitted to create this single test file as the helper's
// regression net.

import { describe, it, expect } from 'vitest';
import {
  ADDRESS_HISTORY_CROSS_SECTION_SOURCE,
  buildAddressHistorySubjectRequirements,
  buildEntryFieldsBuckets,
  computeAddressHistoryAggregatedItems,
  DEFAULT_DOCUMENT_SCOPE,
  extractAggregatedUploadedDocuments,
  extractPerEntryUploadedDocuments,
  GLOBAL_JURISDICTION_PLACEHOLDER,
  isAddressBlockField,
  isSubjectTargeted,
  readCollectionTab,
  readDocumentScope,
  routeAddressHistoryDocumentScope,
  splitFieldsByCollectionTab,
} from '../addressHistoryStage4Wiring';
import type { EntryDsxField } from '@/components/candidate/form-engine/useEntryFieldsLoader';

// Build a minimal EntryDsxField with sensible defaults; tests override only
// the fields they care about. Keeps each test case under 10 lines.
function makeField(over: Partial<EntryDsxField>): EntryDsxField {
  return {
    requirementId: 'req-id',
    name: 'Test Field',
    fieldKey: 'testField',
    type: 'field',
    dataType: 'text',
    isRequired: false,
    instructions: null,
    fieldData: null,
    documentData: null,
    displayOrder: 0,
    ...over,
  };
}

describe('addressHistoryStage4Wiring', () => {
  describe('module-level constants', () => {
    it('exposes a stable triggeredBy literal for AddressHistory', () => {
      expect(ADDRESS_HISTORY_CROSS_SECTION_SOURCE).toBe('address_history');
    });
    it('exposes the BR 23 default scope literal', () => {
      expect(DEFAULT_DOCUMENT_SCOPE).toBe('per_search');
    });
    it('exposes the global jurisdiction placeholder', () => {
      expect(GLOBAL_JURISDICTION_PLACEHOLDER).toBe('global');
    });
  });

  describe('readCollectionTab', () => {
    it('returns the camelCase value when present', () => {
      const f = makeField({ fieldData: { collectionTab: 'subject' } });
      expect(readCollectionTab(f)).toBe('subject');
    });
    it('returns the snake_case value when only that is present', () => {
      const f = makeField({ fieldData: { collection_tab: 'search' } as never });
      expect(readCollectionTab(f)).toBe('search');
    });
    it('returns empty string when neither is present', () => {
      expect(readCollectionTab(makeField({}))).toBe('');
    });
    it('returns empty string when fieldData is null', () => {
      expect(readCollectionTab(makeField({ fieldData: null }))).toBe('');
    });
  });

  describe('isSubjectTargeted', () => {
    it('matches collectionTab === "subject"', () => {
      expect(isSubjectTargeted(makeField({ fieldData: { collectionTab: 'subject' } }))).toBe(true);
    });
    it('does case-insensitive substring match', () => {
      expect(isSubjectTargeted(makeField({ fieldData: { collectionTab: 'Subject' } }))).toBe(true);
      expect(isSubjectTargeted(makeField({ fieldData: { collectionTab: 'subject_only' } }))).toBe(true);
    });
    it('returns false for non-subject tabs', () => {
      expect(isSubjectTargeted(makeField({ fieldData: { collectionTab: 'search' } }))).toBe(false);
      expect(isSubjectTargeted(makeField({}))).toBe(false);
    });
  });

  describe('isAddressBlockField', () => {
    it('returns true for address_block dataType', () => {
      expect(isAddressBlockField(makeField({ dataType: 'address_block' }))).toBe(true);
    });
    it('returns false for text and document', () => {
      expect(isAddressBlockField(makeField({ dataType: 'text' }))).toBe(false);
      expect(isAddressBlockField(makeField({ dataType: 'document' }))).toBe(false);
    });
  });

  describe('readDocumentScope', () => {
    it('reads scope when documentData.scope is a string', () => {
      const f = makeField({ documentData: { scope: 'per_entry' } as never });
      expect(readDocumentScope(f)).toBe('per_entry');
    });
    it('returns null when documentData is null', () => {
      expect(readDocumentScope(makeField({ documentData: null }))).toBeNull();
    });
    it('returns null when scope is missing', () => {
      const f = makeField({ documentData: { foo: 'bar' } as never });
      expect(readDocumentScope(f)).toBeNull();
    });
    it('returns null when scope is non-string', () => {
      const f = makeField({ documentData: { scope: 42 } as never });
      expect(readDocumentScope(f)).toBeNull();
    });
  });

  describe('buildEntryFieldsBuckets', () => {
    // TD-084 — the helper's signature changed from
    // `(entries, fieldsByEntryService, serviceIds)` to `(entries, fieldsByEntry)`
    // because the /fields route now OR-merges across all package services
    // server-side. The four tests below preserve the original test intent
    // (one bucket per entry; merge order; first-wins dedup; countryId
    // preserved) while adapting to the new architecture.
    it('produces one bucket per entry, in entry order', () => {
      const buckets = buildEntryFieldsBuckets(
        [
          { entryId: 'e1', countryId: 'c1' },
          { entryId: 'e2', countryId: 'c2' },
        ],
        {},
      );
      expect(buckets.map((b) => b.entryId)).toEqual(['e1', 'e2']);
    });
    it('merges fields per entry from the fetched list', () => {
      // TD-084 — pre-flip this test verified that the helper walked every
      // service id and merged the per-service lists. Under the new
      // architecture the route returns one merged list per entry, so the
      // surviving intent is "the helper produces a bucket containing every
      // field from `fieldsByEntry[entryId]`, in the order they appear."
      const f1 = makeField({ requirementId: 'r1', fieldKey: 'a' });
      const f2 = makeField({ requirementId: 'r2', fieldKey: 'b' });
      const f3 = makeField({ requirementId: 'r3', fieldKey: 'c' });
      const f4 = makeField({ requirementId: 'r4', fieldKey: 'd' });
      const buckets = buildEntryFieldsBuckets(
        [
          { entryId: 'e1', countryId: 'c1' },
          { entryId: 'e2', countryId: 'c2' },
        ],
        {
          e1: [f1, f2],
          e2: [f3, f4],
        },
      );
      expect(buckets[0].fields.map((f) => f.requirementId)).toEqual(['r1', 'r2']);
      expect(buckets[1].fields.map((f) => f.requirementId)).toEqual(['r3', 'r4']);
    });
    it("dedupes fields with the same requirementId within an entry's list (first wins)", () => {
      // TD-084 — pre-flip this test verified cross-service dedup. The route
      // now de-dups across services in its response, but the helper still
      // dedupes defensively in case the input list contains duplicate
      // requirementIds for any reason (a fixture, a future change, a
      // hand-crafted response). This test exercises that defensive path.
      const f1 = makeField({ requirementId: 'r1', fieldKey: 'a', name: 'first' });
      const f1b = makeField({ requirementId: 'r1', fieldKey: 'a', name: 'second' });
      const buckets = buildEntryFieldsBuckets(
        [{ entryId: 'e1', countryId: 'c1' }],
        { e1: [f1, f1b] },
      );
      expect(buckets[0].fields).toHaveLength(1);
      expect(buckets[0].fields[0].name).toBe('first');
    });
    it('preserves countryId on the bucket (including null)', () => {
      const buckets = buildEntryFieldsBuckets(
        [
          { entryId: 'e1', countryId: 'c1' },
          { entryId: 'e2', countryId: null },
        ],
        {},
      );
      expect(buckets[0].countryId).toBe('c1');
      expect(buckets[1].countryId).toBeNull();
    });
  });

  describe('splitFieldsByCollectionTab', () => {
    it('routes subject-targeted fields to subjectFieldsByCountry', () => {
      const subj = makeField({
        requirementId: 'r-s',
        fieldKey: 'middleName',
        fieldData: { collectionTab: 'subject' },
      });
      const split = splitFieldsByCollectionTab([
        { entryId: 'e1', countryId: 'c1', fields: [subj] },
      ]);
      expect(split.subjectFieldsByCountry['c1']).toHaveLength(1);
      expect(split.subjectFieldsByCountry['c1'][0].fieldKey).toBe('middleName');
      expect(split.localFieldsByCountry['c1'] ?? []).toHaveLength(0);
    });
    it('routes non-subject fields to localFieldsByCountry', () => {
      const local = makeField({
        requirementId: 'r-l',
        fieldKey: 'localRef',
        fieldData: { collectionTab: 'search' },
      });
      const split = splitFieldsByCollectionTab([
        { entryId: 'e1', countryId: 'c1', fields: [local] },
      ]);
      expect(split.localFieldsByCountry['c1']).toHaveLength(1);
      expect(split.subjectFieldsByCountry['c1'] ?? []).toHaveLength(0);
    });
    it('excludes address_block fields from BOTH maps', () => {
      const ab = makeField({
        requirementId: 'r-ab',
        fieldKey: 'residenceAddress',
        dataType: 'address_block',
      });
      const split = splitFieldsByCollectionTab([
        { entryId: 'e1', countryId: 'c1', fields: [ab] },
      ]);
      expect(split.subjectFieldsByCountry['c1'] ?? []).toHaveLength(0);
      expect(split.localFieldsByCountry['c1'] ?? []).toHaveLength(0);
    });
    it('skips entries with no countryId', () => {
      const f = makeField({ requirementId: 'r1', fieldKey: 'k' });
      const split = splitFieldsByCollectionTab([
        { entryId: 'e1', countryId: null, fields: [f] },
      ]);
      expect(Object.keys(split.localFieldsByCountry)).toHaveLength(0);
      expect(Object.keys(split.subjectFieldsByCountry)).toHaveLength(0);
    });
    it('dedupes by requirementId within the same country across entries', () => {
      const f = makeField({ requirementId: 'r1', fieldKey: 'k' });
      const split = splitFieldsByCollectionTab([
        { entryId: 'e1', countryId: 'c1', fields: [f] },
        { entryId: 'e2', countryId: 'c1', fields: [f] },
      ]);
      expect(split.localFieldsByCountry['c1']).toHaveLength(1);
    });

    it('REGRESSION TEST: PI-fieldKey fields without collectionTab route to subjectFieldsByCountry (Bug A extension)', () => {
      // A DSX requirement with `fieldKey === 'middleName'` and no
      // `collectionTab` is collected on Personal Info via the same
      // fieldKey heuristic the PI route uses. Without this filter, the
      // field lands in localFieldsByCountry, gets fed to
      // computeRepeatableSectionStatus as a required entry field, and the
      // local progress flags it missing — keeping the sidebar red even
      // after the candidate filled middleName in on Personal Info.
      const mid = makeField({
        requirementId: 'r-mid',
        fieldKey: 'middleName',
        fieldData: null, // NO collectionTab
      });
      const split = splitFieldsByCollectionTab([
        { entryId: 'e1', countryId: 'c1', fields: [mid] },
      ]);
      expect(split.subjectFieldsByCountry['c1']).toHaveLength(1);
      expect(split.subjectFieldsByCountry['c1'][0].fieldKey).toBe('middleName');
      expect(split.localFieldsByCountry['c1'] ?? []).toHaveLength(0);
    });

    it('REGRESSION TEST: locked invitation fieldKey (firstName) without collectionTab routes to subjectFieldsByCountry', () => {
      // firstName / lastName / email / phone / phoneNumber are sourced from
      // the invitation columns and must not feed local progress. They go to
      // subjectFieldsByCountry; the registry push then drops them via
      // isLockedInvitationFieldKey.
      const fn = makeField({
        requirementId: 'r-fn',
        fieldKey: 'firstName',
        fieldData: null,
      });
      const split = splitFieldsByCollectionTab([
        { entryId: 'e1', countryId: 'c1', fields: [fn] },
      ]);
      expect(split.subjectFieldsByCountry['c1']).toHaveLength(1);
      expect(split.localFieldsByCountry['c1'] ?? []).toHaveLength(0);
    });

    it('Non-PI fieldKey without collectionTab still routes to localFieldsByCountry', () => {
      const local = makeField({
        requirementId: 'r-local',
        fieldKey: 'passportNumber',
        fieldData: null,
      });
      const split = splitFieldsByCollectionTab([
        { entryId: 'e1', countryId: 'c1', fields: [local] },
      ]);
      expect(split.localFieldsByCountry['c1']).toHaveLength(1);
      expect(split.subjectFieldsByCountry['c1'] ?? []).toHaveLength(0);
    });
  });

  describe('isSubjectTargeted — PI-fieldKey heuristic (Bug A extension)', () => {
    it('REGRESSION TEST: returns true for PI fieldKey without collectionTab (middleName)', () => {
      expect(
        isSubjectTargeted(makeField({ fieldKey: 'middleName', fieldData: null })),
      ).toBe(true);
    });
    it('REGRESSION TEST: returns true for locked fieldKey without collectionTab (firstName)', () => {
      expect(
        isSubjectTargeted(makeField({ fieldKey: 'firstName', fieldData: null })),
      ).toBe(true);
    });
    it('returns false for arbitrary non-PI fieldKey without collectionTab', () => {
      expect(
        isSubjectTargeted(makeField({ fieldKey: 'passportNumber', fieldData: null })),
      ).toBe(false);
    });
  });

  describe('buildAddressHistorySubjectRequirements', () => {
    it('produces one entry per (entry, subject field) with entryOrder + countryId context', () => {
      const subjectFieldsByCountry = {
        'c1': [
          {
            requirementId: 'r-mid',
            fieldKey: 'middleName',
            name: 'Middle Name',
            type: 'field',
            isRequired: true,
          },
        ],
      };
      const result = buildAddressHistorySubjectRequirements(
        [
          { entryId: 'e1', countryId: 'c1', entryOrder: 0, fields: [] },
          { entryId: 'e2', countryId: 'c1', entryOrder: 1, fields: [] },
        ],
        subjectFieldsByCountry,
      );
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        fieldId: 'r-mid',
        fieldKey: 'middleName',
        fieldName: 'Middle Name',
        isRequired: true,
        triggeredBy: 'address_history',
        triggeredByContext: 'c1',
        triggeredByEntryIndex: 0,
      });
      expect(result[1].triggeredByEntryIndex).toBe(1);
    });
    it('skips entries with no countryId', () => {
      const result = buildAddressHistorySubjectRequirements(
        [{ entryId: 'e1', countryId: null, entryOrder: 0, fields: [] }],
        { 'c1': [{ requirementId: 'r', fieldKey: 'k', name: 'n', type: 'field', isRequired: true }] },
      );
      expect(result).toHaveLength(0);
    });
    it('returns empty when no subject fields are loaded for the entry country', () => {
      const result = buildAddressHistorySubjectRequirements(
        [{ entryId: 'e1', countryId: 'c1', entryOrder: 0, fields: [] }],
        {},
      );
      expect(result).toHaveLength(0);
    });
    it('honors a custom triggeredBy override', () => {
      const result = buildAddressHistorySubjectRequirements(
        [{ entryId: 'e1', countryId: 'c1', entryOrder: 0, fields: [] }],
        { 'c1': [{ requirementId: 'r', fieldKey: 'k', name: 'n', type: 'field', isRequired: true }] },
        'custom_source',
      );
      expect(result[0].triggeredBy).toBe('custom_source');
    });
  });

  describe('routeAddressHistoryDocumentScope', () => {
    it('per_entry → key is the bare requirementId', () => {
      const r = routeAddressHistoryDocumentScope({ requirementId: 'req-1', scope: 'per_entry' });
      expect(r).toEqual({ kind: 'per_entry', key: 'req-1' });
    });
    it('per_order → key is the bare requirementId', () => {
      const r = routeAddressHistoryDocumentScope({ requirementId: 'req-1', scope: 'per_order' });
      expect(r).toEqual({ kind: 'per_order', key: 'req-1' });
    });
    it('per_search → composite key with serviceId + jurisdictionId', () => {
      const r = routeAddressHistoryDocumentScope({
        requirementId: 'req-1',
        scope: 'per_search',
        serviceId: 'svc-1',
        jurisdictionId: 'subreg-9',
      });
      expect(r).toEqual({ kind: 'per_search', key: 'req-1::svc-1::subreg-9' });
    });
    it('per_search defaults missing serviceId / jurisdictionId to "global"', () => {
      const r = routeAddressHistoryDocumentScope({ requirementId: 'req-1', scope: 'per_search' });
      expect(r).toEqual({ kind: 'per_search', key: 'req-1::global::global' });
    });
    it('null scope (BR 23) defaults to per_search', () => {
      const r = routeAddressHistoryDocumentScope({
        requirementId: 'req-1',
        scope: null,
        serviceId: 'svc-1',
        jurisdictionId: 'subreg-9',
      });
      expect(r).toEqual({ kind: 'per_search', key: 'req-1::svc-1::subreg-9' });
    });
  });

  describe('computeAddressHistoryAggregatedItems', () => {
    const personalInfoIds = new Set<string>(['req-pi-1']);
    const resolveOrder = () => 1;

    it('produces one item per unique requirementId, OR-merging isRequired (most-restrictive wins)', () => {
      const f1 = makeField({
        requirementId: 'r1',
        fieldKey: 'localRef',
        name: 'Local Ref',
        isRequired: false,
        displayOrder: 1,
      });
      const f1b = makeField({
        requirementId: 'r1',
        fieldKey: 'localRef',
        name: 'Local Ref',
        isRequired: true, // most-restrictive must win
        displayOrder: 1,
      });
      const items = computeAddressHistoryAggregatedItems({
        buckets: [
          { entryId: 'e1', countryId: 'c1', fields: [f1] },
          { entryId: 'e2', countryId: 'c1', fields: [f1b] },
        ],
        personalInfoRequirementIds: personalInfoIds,
        resolveServiceTypeOrder: resolveOrder,
      });
      expect(items).toHaveLength(1);
      expect(items[0].isRequired).toBe(true);
    });

    it('excludes address_block fields', () => {
      const ab = makeField({
        requirementId: 'r-ab',
        fieldKey: 'addr',
        dataType: 'address_block',
      });
      const items = computeAddressHistoryAggregatedItems({
        buckets: [{ entryId: 'e1', countryId: 'c1', fields: [ab] }],
        personalInfoRequirementIds: personalInfoIds,
        resolveServiceTypeOrder: resolveOrder,
      });
      expect(items).toHaveLength(0);
    });

    it('excludes personalInfoRequirementIds', () => {
      const piField = makeField({
        requirementId: 'req-pi-1',
        fieldKey: 'firstName',
      });
      const items = computeAddressHistoryAggregatedItems({
        buckets: [{ entryId: 'e1', countryId: 'c1', fields: [piField] }],
        personalInfoRequirementIds: personalInfoIds,
        resolveServiceTypeOrder: resolveOrder,
      });
      expect(items).toHaveLength(0);
    });

    it('excludes subject-targeted fields (BR 17 — they go via the registry)', () => {
      const subj = makeField({
        requirementId: 'r-subj',
        fieldKey: 'middleName',
        fieldData: { collectionTab: 'subject' },
      });
      const items = computeAddressHistoryAggregatedItems({
        buckets: [{ entryId: 'e1', countryId: 'c1', fields: [subj] }],
        personalInfoRequirementIds: personalInfoIds,
        resolveServiceTypeOrder: resolveOrder,
      });
      expect(items).toHaveLength(0);
    });

    it('skips entries with no countryId', () => {
      const f = makeField({ requirementId: 'r1', fieldKey: 'k' });
      const items = computeAddressHistoryAggregatedItems({
        buckets: [{ entryId: 'e1', countryId: null, fields: [f] }],
        personalInfoRequirementIds: personalInfoIds,
        resolveServiceTypeOrder: resolveOrder,
      });
      expect(items).toHaveLength(0);
    });

    it('sorts by serviceTypeOrder asc, then displayOrder asc', () => {
      // resolveServiceTypeOrder returns 0 for the first field, 1 for the rest.
      let call = 0;
      const order = () => (call++ === 0 ? 0 : 1);
      const a = makeField({ requirementId: 'rA', fieldKey: 'a', name: 'A', displayOrder: 5 });
      const b = makeField({ requirementId: 'rB', fieldKey: 'b', name: 'B', displayOrder: 1 });
      const c = makeField({ requirementId: 'rC', fieldKey: 'c', name: 'C', displayOrder: 9 });
      const items = computeAddressHistoryAggregatedItems({
        buckets: [{ entryId: 'e1', countryId: 'c1', fields: [a, b, c] }],
        personalInfoRequirementIds: personalInfoIds,
        resolveServiceTypeOrder: order,
      });
      // First bucket pass: A (svcOrder 0), B (svcOrder 1), C (svcOrder 1).
      // displayOrders B=1, C=9.
      expect(items.map((i) => i.requirementId)).toEqual(['rA', 'rB', 'rC']);
    });

    it('routes type === "document" to type "document"', () => {
      const doc = makeField({
        requirementId: 'r-doc',
        fieldKey: 'doc',
        type: 'document',
        dataType: 'document',
      });
      const items = computeAddressHistoryAggregatedItems({
        buckets: [{ entryId: 'e1', countryId: 'c1', fields: [doc] }],
        personalInfoRequirementIds: personalInfoIds,
        resolveServiceTypeOrder: resolveOrder,
      });
      expect(items[0].type).toBe('document');
    });
  });

  describe('extractPerEntryUploadedDocuments', () => {
    it('extracts documentId-bearing values keyed by entryId then requirementId', () => {
      const out = extractPerEntryUploadedDocuments([
        {
          entryId: 'e1',
          countryId: 'c1',
          entryOrder: 0,
          fields: [
            {
              requirementId: 'r-doc',
              value: { documentId: 'd-1', originalName: 'a.pdf', storagePath: 'p', mimeType: 'application/pdf', size: 1, uploadedAt: 'now' },
            },
            { requirementId: 'r-text', value: 'hello' },
          ],
        },
      ]);
      expect(out['e1']['r-doc']?.documentId).toBe('d-1');
      expect(out['e1']['r-text']).toBeUndefined();
    });

    it('returns empty inner object for entries with no document values', () => {
      const out = extractPerEntryUploadedDocuments([
        { entryId: 'e1', countryId: null, entryOrder: 0, fields: [{ requirementId: 'r1', value: 'x' }] },
      ]);
      expect(out['e1']).toEqual({});
    });
  });

  describe('extractAggregatedUploadedDocuments', () => {
    it('keeps documentId-bearing values and keys by underlying requirementId', () => {
      const out = extractAggregatedUploadedDocuments({
        'req-1::svc-1::sub-1': {
          documentId: 'd-1',
          originalName: 'a.pdf',
          storagePath: 'p',
          mimeType: 'application/pdf',
          size: 1,
          uploadedAt: 'now',
        },
        'req-2': {
          documentId: 'd-2',
          originalName: 'b.pdf',
          storagePath: 'p',
          mimeType: 'application/pdf',
          size: 1,
          uploadedAt: 'now',
        },
        'req-3': 'plain string value, not a doc',
      });
      expect(out['req-1']?.documentId).toBe('d-1');
      expect(out['req-2']?.documentId).toBe('d-2');
      expect(out['req-3']).toBeUndefined();
    });
    it('returns empty when no document-shaped values exist', () => {
      const out = extractAggregatedUploadedDocuments({ 'r1': 'plain', 'r2': 5, 'r3': null });
      expect(out).toEqual({});
    });
  });

  // ===========================================================================
  // BUG B regression tests — buildAddressHistorySubjectRequirements must
  // filter out locked invitation fieldKeys (firstName, lastName, email,
  // phone, phoneNumber) so they never reach the cross-section registry.
  //
  // Spec: docs/specs/cross-section-validation-filtering-bugfix.md
  //       (Bug B — Personal Info banner shows locked invitation fields)
  //
  // REGRESSION TESTS: prove bug fix for cross-section-validation-filtering
  // Bug B. Before the fix, `buildAddressHistorySubjectRequirements` pushes
  // every subject-targeted field through to the cross-section registry —
  // including firstName / lastName / email / phone / phoneNumber, which
  // are sourced from the invitation columns and never editable by the
  // candidate. The Personal Info banner then lists them and asterisks them,
  // which is confusing because the candidate cannot fill them in.
  //
  // After the fix, the helper consults the shared
  // `lockedInvitationFieldKeys` module and SKIPS any field whose fieldKey
  // is locked. Bug D (banner/asterisk consistency) is emergent from the
  // same change — once the locked fields do not reach the registry, they
  // do not appear on the banner OR drive asterisks.
  // ===========================================================================

  describe("buildAddressHistorySubjectRequirements — locked invitation fieldKey filter (Bug B)", () => {
    const SUBJECT_BUCKET = {
      c1: [
        {
          requirementId: "r-firstName",
          fieldKey: "firstName",
          name: "First Name",
          type: "field",
          isRequired: true,
        },
        {
          requirementId: "r-lastName",
          fieldKey: "lastName",
          name: "Last Name",
          type: "field",
          isRequired: true,
        },
        {
          requirementId: "r-email",
          fieldKey: "email",
          name: "Email",
          type: "field",
          isRequired: true,
        },
        {
          requirementId: "r-phone",
          fieldKey: "phone",
          name: "Phone",
          type: "field",
          isRequired: true,
        },
        {
          requirementId: "r-phoneNumber",
          fieldKey: "phoneNumber",
          name: "Phone Number",
          type: "field",
          isRequired: true,
        },
        {
          requirementId: "r-middleName",
          fieldKey: "middleName",
          name: "Middle Name",
          type: "field",
          isRequired: true,
        },
        {
          requirementId: "r-dateOfBirth",
          fieldKey: "dateOfBirth",
          name: "Date of Birth",
          type: "field",
          isRequired: true,
        },
      ],
    };

    const SINGLE_ENTRY = [
      { entryId: "e1", countryId: "c1", entryOrder: 0, fields: [] },
    ];

    it("REGRESSION TEST: a subject field with fieldKey === 'firstName' is NOT pushed to the registry", () => {
      const result = buildAddressHistorySubjectRequirements(
        SINGLE_ENTRY,
        SUBJECT_BUCKET,
      );
      expect(result.find((r) => r.fieldKey === "firstName")).toBeUndefined();
    });

    it("REGRESSION TEST: a subject field with fieldKey === 'lastName' is NOT pushed to the registry", () => {
      const result = buildAddressHistorySubjectRequirements(
        SINGLE_ENTRY,
        SUBJECT_BUCKET,
      );
      expect(result.find((r) => r.fieldKey === "lastName")).toBeUndefined();
    });

    it("REGRESSION TEST: a subject field with fieldKey === 'email' is NOT pushed to the registry", () => {
      const result = buildAddressHistorySubjectRequirements(
        SINGLE_ENTRY,
        SUBJECT_BUCKET,
      );
      expect(result.find((r) => r.fieldKey === "email")).toBeUndefined();
    });

    it("REGRESSION TEST: a subject field with fieldKey === 'phone' is NOT pushed to the registry", () => {
      const result = buildAddressHistorySubjectRequirements(
        SINGLE_ENTRY,
        SUBJECT_BUCKET,
      );
      expect(result.find((r) => r.fieldKey === "phone")).toBeUndefined();
    });

    it("REGRESSION TEST: a subject field with fieldKey === 'phoneNumber' is NOT pushed to the registry", () => {
      const result = buildAddressHistorySubjectRequirements(
        SINGLE_ENTRY,
        SUBJECT_BUCKET,
      );
      expect(result.find((r) => r.fieldKey === "phoneNumber")).toBeUndefined();
    });

    it("keeps the unlocked 'middleName' field — proves the filter is narrow", () => {
      const result = buildAddressHistorySubjectRequirements(
        SINGLE_ENTRY,
        SUBJECT_BUCKET,
      );
      const middle = result.find((r) => r.fieldKey === "middleName");
      expect(middle).toBeDefined();
      expect(middle?.fieldName).toBe("Middle Name");
    });

    it("keeps the unlocked 'dateOfBirth' field — proves the filter is narrow", () => {
      const result = buildAddressHistorySubjectRequirements(
        SINGLE_ENTRY,
        SUBJECT_BUCKET,
      );
      const dob = result.find((r) => r.fieldKey === "dateOfBirth");
      expect(dob).toBeDefined();
      expect(dob?.fieldName).toBe("Date of Birth");
    });

    it("returns ONLY the two unlocked fields when the bucket has all five locked + middleName + dateOfBirth", () => {
      const result = buildAddressHistorySubjectRequirements(
        SINGLE_ENTRY,
        SUBJECT_BUCKET,
      );
      expect(result).toHaveLength(2);
      const keys = result.map((r) => r.fieldKey).sort();
      expect(keys).toEqual(["dateOfBirth", "middleName"]);
    });
  });
});
