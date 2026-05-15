// /GlobalRX_v2/src/lib/candidate/__tests__/computeRecordSearchStatus.test.ts
// Pass 2 unit tests for Task 8.4: computeRecordSearchStatus helper.
//
// The helper lives in src/lib/candidate/sectionProgress.ts and computes one of
// the three lowercase SectionStatus values for the Record Search Requirements
// section: 'not_started' | 'incomplete' | 'complete'.
//
// Source file reviewed:
//   src/lib/candidate/sectionProgress.ts lines 256-327 (the helper) and the
//   private `hasValue` + `hasAggregatedDocument` helpers below it.
//
// Per Pass 2 Rule M1, computeRecordSearchStatus is the subject of these tests
// and is NOT mocked. No mocks of any kind are used — the function is pure.

import { describe, it, expect } from 'vitest';

import { computeRecordSearchStatus } from '../sectionProgress';

describe('computeRecordSearchStatus (Task 8.4)', () => {
  // ---------------------------------------------------------------------------
  // Empty-state: no required fields, no required documents → complete
  // ---------------------------------------------------------------------------
  describe('empty state', () => {
    it('returns `complete` when there are no required fields and no required documents', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('complete');
    });

    it('returns `complete` when fields exist but none are isRequired and no documents are required', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: false },
          { id: 'req-2', fieldKey: 'req-2', isRequired: false },
        ],
        documentRequirements: [
          { id: 'doc-1', type: 'document', isRequired: false },
        ],
        uploadedDocuments: {},
      });

      expect(status).toBe('complete');
    });
  });

  // ---------------------------------------------------------------------------
  // Required field tracking
  // ---------------------------------------------------------------------------
  describe('required field tracking', () => {
    it('returns `not_started` when required fields exist and nothing has been typed', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
          { id: 'req-2', fieldKey: 'req-2', isRequired: true },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('not_started');
    });

    it('returns `incomplete` when some required fields are satisfied and others are empty', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': 'AB12345',
          // req-2 is missing
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
          { id: 'req-2', fieldKey: 'req-2', isRequired: true },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('incomplete');
    });

    it('returns `complete` when all required fields have a value', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': 'AB12345',
          'req-2': 'CD67890',
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
          { id: 'req-2', fieldKey: 'req-2', isRequired: true },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('complete');
    });

    it('treats empty string as not present (hasValue trims)', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': '   ', // whitespace-only — trimmed length is 0
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('not_started');
    });

    it('treats null and undefined as not present', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': null,
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('not_started');
    });

    it('treats numbers (including 0) and booleans (including false) as present', () => {
      // The hasValue helper considers any non-null/non-undefined non-string
      // non-array as present. 0 and false should count as filled-in answers.
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': 0,
          'req-2': false,
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
          { id: 'req-2', fieldKey: 'req-2', isRequired: true },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('complete');
    });

    it('treats empty arrays as not present', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': [],
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('not_started');
    });

    it('treats non-empty string arrays as present', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': ['option-1'],
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('complete');
    });

    it('ignores fields whose isRequired is false even when value is missing', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-required': 'A',
          // req-optional is missing — should not block completion
        },
        fieldRequirements: [
          { id: 'req-required', fieldKey: 'req-required', isRequired: true },
          { id: 'req-optional', fieldKey: 'req-optional', isRequired: false },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('complete');
    });
  });

  // ---------------------------------------------------------------------------
  // Required document tracking — uses hasAggregatedDocument helper internally
  // ---------------------------------------------------------------------------
  describe('required document tracking', () => {
    it('returns `not_started` when required docs exist and none are uploaded', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [],
        documentRequirements: [
          {
            id: 'doc-1',
            type: 'document',
            isRequired: true,
            documentData: { scope: 'per_search' },
          },
        ],
        uploadedDocuments: {},
      });

      expect(status).toBe('not_started');
    });

    it('returns `complete` when a required per_search document is uploaded (composite key)', () => {
      // per_search documents are stored under composite keys like
      // `${requirementId}::${serviceId}::${jurisdictionId}`. The helper
      // accepts ANY key whose prefix is `${requirementId}::` as evidence
      // the doc has been uploaded at least once.
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [],
        documentRequirements: [
          {
            id: 'doc-1',
            type: 'document',
            isRequired: true,
            documentData: { scope: 'per_search' },
          },
        ],
        uploadedDocuments: {
          'doc-1::srv-1::jurisdiction-us': {
            documentId: 'd-uuid',
            originalName: 'afp.pdf',
            storagePath: 'uploads/draft-documents/o-1/d-uuid.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            uploadedAt: '2026-05-14T00:00:00Z',
          },
        },
      });

      expect(status).toBe('complete');
    });

    it('returns `complete` when a required per_order document is uploaded (direct key)', () => {
      // per_order documents are stored under the requirementId directly.
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [],
        documentRequirements: [
          {
            id: 'doc-1',
            type: 'document',
            isRequired: true,
            documentData: { scope: 'per_order' },
          },
        ],
        uploadedDocuments: {
          'doc-1': {
            documentId: 'd-uuid',
            originalName: 'auth.pdf',
            storagePath: 'uploads/draft-documents/o-1/d-uuid.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            uploadedAt: '2026-05-14T00:00:00Z',
          },
        },
      });

      expect(status).toBe('complete');
    });

    it('treats null/missing scope as per_search (BR 23)', () => {
      // null scope should still match composite keys with the requirementId
      // prefix — the helper falls back to per_search lookup semantics.
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [],
        documentRequirements: [
          {
            id: 'doc-1',
            type: 'document',
            isRequired: true,
            documentData: null,
          },
        ],
        uploadedDocuments: {
          'doc-1::srv-1::jurisdiction-us': {
            documentId: 'd-uuid',
            originalName: 'x.pdf',
            storagePath: 'uploads/draft-documents/o-1/d-uuid.pdf',
            mimeType: 'application/pdf',
            size: 100,
            uploadedAt: '2026-05-14T00:00:00Z',
          },
        },
      });

      expect(status).toBe('complete');
    });

    it('returns `incomplete` when one of two required docs is uploaded', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [],
        documentRequirements: [
          { id: 'doc-1', type: 'document', isRequired: true, documentData: { scope: 'per_order' } },
          { id: 'doc-2', type: 'document', isRequired: true, documentData: { scope: 'per_order' } },
        ],
        uploadedDocuments: {
          'doc-1': {
            documentId: 'd-1',
            originalName: 'a.pdf',
            storagePath: 'uploads/draft-documents/o/d-1.pdf',
            mimeType: 'application/pdf',
            size: 1,
            uploadedAt: '2026-05-14T00:00:00Z',
          },
          // doc-2 missing
        },
      });

      expect(status).toBe('incomplete');
    });

    it('ignores documents whose isRequired is false', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [],
        documentRequirements: [
          { id: 'doc-optional', type: 'document', isRequired: false, documentData: { scope: 'per_order' } },
        ],
        uploadedDocuments: {},
      });

      // No required items → complete.
      expect(status).toBe('complete');
    });
  });

  // ---------------------------------------------------------------------------
  // Mixed fields + documents
  // ---------------------------------------------------------------------------
  describe('mixed fields and documents', () => {
    it('returns `complete` when all required fields AND all required docs are satisfied', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': 'AB12345',
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
        ],
        documentRequirements: [
          { id: 'doc-1', type: 'document', isRequired: true, documentData: { scope: 'per_order' } },
        ],
        uploadedDocuments: {
          'doc-1': {
            documentId: 'd-1',
            originalName: 'a.pdf',
            storagePath: 'uploads/draft-documents/o/d-1.pdf',
            mimeType: 'application/pdf',
            size: 1,
            uploadedAt: '2026-05-14T00:00:00Z',
          },
        },
      });

      expect(status).toBe('complete');
    });

    it('returns `incomplete` when required field is filled but required doc is missing', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {
          'req-1': 'AB12345',
        },
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
        ],
        documentRequirements: [
          { id: 'doc-1', type: 'document', isRequired: true, documentData: { scope: 'per_order' } },
        ],
        uploadedDocuments: {},
      });

      expect(status).toBe('incomplete');
    });

    it('returns `incomplete` when required doc is uploaded but required field is missing', () => {
      const status = computeRecordSearchStatus({
        fieldValues: {},
        fieldRequirements: [
          { id: 'req-1', fieldKey: 'req-1', isRequired: true },
        ],
        documentRequirements: [
          { id: 'doc-1', type: 'document', isRequired: true, documentData: { scope: 'per_order' } },
        ],
        uploadedDocuments: {
          'doc-1': {
            documentId: 'd-1',
            originalName: 'a.pdf',
            storagePath: 'uploads/draft-documents/o/d-1.pdf',
            mimeType: 'application/pdf',
            size: 1,
            uploadedAt: '2026-05-14T00:00:00Z',
          },
        },
      });

      expect(status).toBe('incomplete');
    });
  });

  // ---------------------------------------------------------------------------
  // not_started vs incomplete — "typed but not in required set"
  // ---------------------------------------------------------------------------
  describe('typed-but-not-required behavior', () => {
    it('returns `incomplete` when a value has been typed but none of the required fields are satisfied', () => {
      // This case proves the helper detects "user has done SOMETHING" by
      // looking at the full fieldValues map, not only the required-field IDs.
      // Without this branch the candidate could type into an optional field
      // and the section would still show `not_started`.
      const status = computeRecordSearchStatus({
        fieldValues: {
          // typed into an optional field
          'req-optional': 'I typed this',
        },
        fieldRequirements: [
          { id: 'req-required', fieldKey: 'req-required', isRequired: true },
          { id: 'req-optional', fieldKey: 'req-optional', isRequired: false },
        ],
        documentRequirements: [],
        uploadedDocuments: {},
      });

      expect(status).toBe('incomplete');
    });
  });

  // ---------------------------------------------------------------------------
  // Status values are lowercase (BR 22)
  // ---------------------------------------------------------------------------
  describe('lowercase status values (BR 22)', () => {
    it('always returns a lowercase status value', () => {
      const variants = [
        computeRecordSearchStatus({
          fieldValues: {},
          fieldRequirements: [],
          documentRequirements: [],
          uploadedDocuments: {},
        }),
        computeRecordSearchStatus({
          fieldValues: {},
          fieldRequirements: [{ id: 'r', fieldKey: 'r', isRequired: true }],
          documentRequirements: [],
          uploadedDocuments: {},
        }),
        computeRecordSearchStatus({
          fieldValues: { r: 'x' },
          fieldRequirements: [{ id: 'r', fieldKey: 'r', isRequired: true }],
          documentRequirements: [],
          uploadedDocuments: {},
        }),
        computeRecordSearchStatus({
          fieldValues: { r: 'x' },
          fieldRequirements: [
            { id: 'r', fieldKey: 'r', isRequired: true },
            { id: 's', fieldKey: 's', isRequired: true },
          ],
          documentRequirements: [],
          uploadedDocuments: {},
        }),
      ];

      for (const status of variants) {
        expect(status).toBe(status.toLowerCase());
        expect(['not_started', 'incomplete', 'complete']).toContain(status);
      }
    });
  });
});
