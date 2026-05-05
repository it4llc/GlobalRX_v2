// /GlobalRX_v2/src/lib/candidate/__tests__/sectionProgress.test.ts
// Pass 1 unit tests for Phase 6 Stage 4:
// Section progress pure helpers — workflow, personal info, repeatable.
//
// These tests will FAIL when first run because the helpers do not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Coverage:
//   - BR 6:   Workflow section is complete only when acknowledgment is checked
//             (when isRequired = true). If isRequired = false, always complete.
//   - BR 14:  Section progress has exactly three states — `not_started`,
//             `incomplete`, `complete`.
//   - BR 16:  Repeatable section progress checks only required fields and required
//             documents within the entries the candidate has already created. No
//             scope coverage / gap detection.
//   - BR 18:  Personal Information's progress check evaluates both local fields
//             and registry entries posted under `subject`.
//   - BR 22:  All status values lowercase strings.
//   - BR 23:  null/missing documentData.scope treated as `per_search`.
//   - DoD 10/12/14.

import { describe, it, expect } from 'vitest';

import {
  computeWorkflowSectionStatus,
  computePersonalInfoStatus,
  computeRepeatableSectionStatus,
} from '../sectionProgress';
import type {
  CrossSectionRequirementEntry,
} from '@/types/candidate-stage4';

// ---------------------------------------------------------------------------
// computeWorkflowSectionStatus (BR 6, BR 22)
// ---------------------------------------------------------------------------

describe('computeWorkflowSectionStatus', () => {
  it('returns `complete` when isRequired = false (regardless of acknowledgment)', () => {
    const status = computeWorkflowSectionStatus(
      { id: 'ws-1', isRequired: false },
      { acknowledged: false }
    );

    expect(status).toBe('complete');
  });

  it('returns `complete` when isRequired = true and acknowledged = true', () => {
    const status = computeWorkflowSectionStatus(
      { id: 'ws-1', isRequired: true },
      { acknowledged: true }
    );

    expect(status).toBe('complete');
  });

  it('returns `not_started` when isRequired = true and there is no saved acknowledgment yet', () => {
    const status = computeWorkflowSectionStatus(
      { id: 'ws-1', isRequired: true },
      undefined
    );

    expect(status).toBe('not_started');
  });

  it('returns `not_started` when isRequired = true and acknowledged = false', () => {
    const status = computeWorkflowSectionStatus(
      { id: 'ws-1', isRequired: true },
      { acknowledged: false }
    );

    expect(status).toBe('not_started');
  });

  it('returns a lowercase status value (BR 22)', () => {
    const status = computeWorkflowSectionStatus(
      { id: 'ws-1', isRequired: false },
      { acknowledged: false }
    );

    expect(status).toBe(status.toLowerCase());
  });
});

// ---------------------------------------------------------------------------
// computePersonalInfoStatus (BR 18)
// ---------------------------------------------------------------------------

describe('computePersonalInfoStatus', () => {
  const firstNameField = {
    id: 'fld-first-name',
    fieldKey: 'firstName',
    isRequired: true,
  };
  const lastNameField = {
    id: 'fld-last-name',
    fieldKey: 'lastName',
    isRequired: true,
  };
  const middleNameField = {
    id: 'fld-middle-name',
    fieldKey: 'middleName',
    isRequired: false,
  };

  const middleNameSubjectRequirement: CrossSectionRequirementEntry = {
    fieldId: 'fld-middle-name',
    fieldKey: 'middleName',
    fieldName: 'Middle Name',
    isRequired: true,
    triggeredBy: 'address_history',
    triggeredByEntryIndex: 0,
  };

  it('returns `not_started` when no fields have any value and no requirements', () => {
    const status = computePersonalInfoStatus(
      [firstNameField, lastNameField],
      {},
      []
    );

    expect(status).toBe('not_started');
  });

  it('returns `complete` when all locally-required fields have values and no cross-section requirements', () => {
    const status = computePersonalInfoStatus(
      [firstNameField, lastNameField],
      { firstName: 'Jane', lastName: 'Doe' },
      []
    );

    expect(status).toBe('complete');
  });

  it('returns `incomplete` when one locally-required field has a value but another is empty', () => {
    const status = computePersonalInfoStatus(
      [firstNameField, lastNameField],
      { firstName: 'Jane' },
      []
    );

    expect(status).toBe('incomplete');
  });

  it('returns `incomplete` when all locally-required fields are filled but a cross-section subject requirement is empty (BR 18)', () => {
    const status = computePersonalInfoStatus(
      [firstNameField, lastNameField, middleNameField],
      { firstName: 'Jane', lastName: 'Doe' /* middleName empty */ },
      [middleNameSubjectRequirement]
    );

    expect(status).toBe('incomplete');
  });

  it('returns `complete` when both local required fields and cross-section requirements are satisfied', () => {
    const status = computePersonalInfoStatus(
      [firstNameField, lastNameField, middleNameField],
      { firstName: 'Jane', lastName: 'Doe', middleName: 'A.' },
      [middleNameSubjectRequirement]
    );

    expect(status).toBe('complete');
  });

  it('treats an empty string value as "no value" for required fields', () => {
    const status = computePersonalInfoStatus(
      [firstNameField, lastNameField],
      { firstName: '', lastName: '' },
      []
    );

    expect(status).toBe('not_started');
  });

  it('returns a lowercase status (BR 22)', () => {
    const status = computePersonalInfoStatus(
      [firstNameField, lastNameField],
      { firstName: 'Jane', lastName: 'Doe' },
      []
    );

    expect(status).toBe(status.toLowerCase());
  });
});

// ---------------------------------------------------------------------------
// computeRepeatableSectionStatus (BR 16, BR 23)
// ---------------------------------------------------------------------------

describe('computeRepeatableSectionStatus', () => {
  const startDateField = {
    id: 'fld-start-date',
    fieldKey: 'startDate',
    isRequired: true,
    type: 'date',
  };
  const endDateField = {
    id: 'fld-end-date',
    fieldKey: 'endDate',
    isRequired: true,
    type: 'date',
  };
  const documentRequirementPerEntry = {
    id: 'req-degree-doc',
    type: 'document',
    isRequired: true,
    documentData: { scope: 'per_entry' as const },
  };
  const documentRequirementNullScope = {
    id: 'req-cert-doc',
    type: 'document',
    isRequired: true,
    documentData: { scope: null as unknown as string | null }, // BR 23
  };

  it('returns `not_started` when there are zero entries', () => {
    const status = computeRepeatableSectionStatus({
      entries: [],
      requiredFieldsByEntry: {},
      requiredDocumentsByEntry: {},
      uploadedDocumentsByEntry: {},
      aggregatedDocuments: {},
      aggregatedDocumentRequirements: [],
    });

    expect(status).toBe('not_started');
  });

  it('returns `incomplete` when an entry exists but a required field is missing', () => {
    const status = computeRepeatableSectionStatus({
      entries: [{ entryOrder: 0, fields: { startDate: '2020-01-01' /* endDate missing */ } }],
      requiredFieldsByEntry: { 0: [startDateField, endDateField] },
      requiredDocumentsByEntry: {},
      uploadedDocumentsByEntry: {},
      aggregatedDocuments: {},
      aggregatedDocumentRequirements: [],
    });

    expect(status).toBe('incomplete');
  });

  it('returns `complete` when all required fields and required documents in existing entries are satisfied (BR 16)', () => {
    const status = computeRepeatableSectionStatus({
      entries: [
        {
          entryOrder: 0,
          fields: {
            startDate: '2020-01-01',
            endDate: '2024-01-01',
          },
        },
      ],
      requiredFieldsByEntry: { 0: [startDateField, endDateField] },
      requiredDocumentsByEntry: { 0: [documentRequirementPerEntry] },
      uploadedDocumentsByEntry: {
        0: {
          'req-degree-doc': {
            documentId: 'doc-1',
            originalName: 'diploma.pdf',
            storagePath: 'uploads/draft-documents/order-1/123-diploma.pdf',
            mimeType: 'application/pdf',
            size: 100,
            uploadedAt: '2026-05-04T12:00:00.000Z',
          },
        },
      },
      aggregatedDocuments: {},
      aggregatedDocumentRequirements: [],
    });

    expect(status).toBe('complete');
  });

  it('returns `incomplete` when a required document inside an entry is missing', () => {
    const status = computeRepeatableSectionStatus({
      entries: [
        {
          entryOrder: 0,
          fields: {
            startDate: '2020-01-01',
            endDate: '2024-01-01',
          },
        },
      ],
      requiredFieldsByEntry: { 0: [startDateField, endDateField] },
      requiredDocumentsByEntry: { 0: [documentRequirementPerEntry] },
      uploadedDocumentsByEntry: { 0: {} },
      aggregatedDocuments: {},
      aggregatedDocumentRequirements: [],
    });

    expect(status).toBe('incomplete');
  });

  it('does NOT perform scope coverage checks (BR 16) — a single entry that satisfies its own fields/documents is `complete` even if more entries are needed for coverage', () => {
    // Three years of address history may be required by the package, but Stage 4
    // does not implement that check. A single complete entry must yield `complete`.
    const status = computeRepeatableSectionStatus({
      entries: [
        {
          entryOrder: 0,
          fields: {
            startDate: '2024-06-01',
            endDate: '2025-01-01',
          },
        },
      ],
      requiredFieldsByEntry: { 0: [startDateField, endDateField] },
      requiredDocumentsByEntry: {},
      uploadedDocumentsByEntry: {},
      aggregatedDocuments: {},
      aggregatedDocumentRequirements: [],
    });

    expect(status).toBe('complete');
  });

  it('treats null/missing documentData.scope as `per_search` and looks for the document in the aggregated bucket (BR 23)', () => {
    // The required document has no scope field set; per BR 23 it must be treated
    // as per_search and looked up in the aggregated bucket. When the aggregated
    // bucket has the metadata, the section is complete; when it does not, the
    // section is incomplete.

    const incompleteStatus = computeRepeatableSectionStatus({
      entries: [
        {
          entryOrder: 0,
          fields: {
            startDate: '2020-01-01',
            endDate: '2024-01-01',
          },
        },
      ],
      requiredFieldsByEntry: { 0: [startDateField, endDateField] },
      requiredDocumentsByEntry: {},
      uploadedDocumentsByEntry: {},
      aggregatedDocuments: {}, // empty
      aggregatedDocumentRequirements: [documentRequirementNullScope],
    });

    expect(incompleteStatus).toBe('incomplete');

    const completeStatus = computeRepeatableSectionStatus({
      entries: [
        {
          entryOrder: 0,
          fields: {
            startDate: '2020-01-01',
            endDate: '2024-01-01',
          },
        },
      ],
      requiredFieldsByEntry: { 0: [startDateField, endDateField] },
      requiredDocumentsByEntry: {},
      uploadedDocumentsByEntry: {},
      aggregatedDocuments: {
        // Some metadata satisfying the per_search requirement lives in this
        // aggregated bucket. The exact composite key shape (per_search uses
        // requirementId::serviceId::jurisdictionId) is verified at the storage
        // layer; here we just assert that the helper detects the presence.
        'req-cert-doc::svc-1::jur-1': {
          documentId: 'doc-2',
          originalName: 'cert.pdf',
          storagePath: 'uploads/draft-documents/order-1/456-cert.pdf',
          mimeType: 'application/pdf',
          size: 100,
          uploadedAt: '2026-05-04T12:00:00.000Z',
        },
      },
      aggregatedDocumentRequirements: [documentRequirementNullScope],
    });

    expect(completeStatus).toBe('complete');
  });

  it('returns one of the three valid lowercase status values only (BR 14, BR 22)', () => {
    const validStatuses = ['not_started', 'incomplete', 'complete'];

    const noEntries = computeRepeatableSectionStatus({
      entries: [],
      requiredFieldsByEntry: {},
      requiredDocumentsByEntry: {},
      uploadedDocumentsByEntry: {},
      aggregatedDocuments: {},
      aggregatedDocumentRequirements: [],
    });

    const allOk = computeRepeatableSectionStatus({
      entries: [
        {
          entryOrder: 0,
          fields: { startDate: '2020-01-01', endDate: '2024-01-01' },
        },
      ],
      requiredFieldsByEntry: { 0: [startDateField, endDateField] },
      requiredDocumentsByEntry: {},
      uploadedDocumentsByEntry: {},
      aggregatedDocuments: {},
      aggregatedDocumentRequirements: [],
    });

    expect(validStatuses).toContain(noEntries);
    expect(validStatuses).toContain(allOk);
  });
});
