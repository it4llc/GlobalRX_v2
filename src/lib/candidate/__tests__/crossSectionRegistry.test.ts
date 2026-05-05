// /GlobalRX_v2/src/lib/candidate/__tests__/crossSectionRegistry.test.ts
// Pass 1 unit tests for Phase 6 Stage 4:
// Cross-section requirement registry — pure helper functions.
//
// These tests will FAIL when first run because the helpers do not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Coverage:
//   - BR 17: Stage 4 only supports `subject` as a cross-section target.
//   - BR 19: Registry entries cleared when a repeatable entry is deleted (matching
//            triggeredByEntryIndex).
//   - DoD 13: Cross-section registry is populated when DSX requirements with
//             collectionTab !== currentSection are loaded; Stage 4 implements only
//             the `subject` target.
//   - DoD 16: When a repeatable entry is deleted, registry entries with a matching
//             triggeredByEntryIndex are cleared.

import { describe, it, expect } from 'vitest';

import {
  addCrossSectionRequirements,
  removeCrossSectionRequirementsForEntry,
  removeCrossSectionRequirementsForSource,
  getCrossSectionRequirements,
} from '../crossSectionRegistry';
import type {
  CrossSectionRegistry,
  CrossSectionRequirementEntry,
} from '@/types/candidate-stage4';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const middleNameFromAddressEntry0: CrossSectionRequirementEntry = {
  fieldId: '11111111-1111-1111-1111-111111111111',
  fieldKey: 'middleName',
  fieldName: 'Middle Name',
  isRequired: true,
  triggeredBy: 'address_history',
  triggeredByContext: 'Criminal Search - Australia',
  triggeredByEntryIndex: 0,
};

const middleNameFromAddressEntry1: CrossSectionRequirementEntry = {
  fieldId: '11111111-1111-1111-1111-111111111111',
  fieldKey: 'middleName',
  fieldName: 'Middle Name',
  isRequired: true,
  triggeredBy: 'address_history',
  triggeredByContext: 'Criminal Search - Brazil',
  triggeredByEntryIndex: 1,
};

const motherMaidenFromEducationEntry0: CrossSectionRequirementEntry = {
  fieldId: '22222222-2222-2222-2222-222222222222',
  fieldKey: 'motherMaidenName',
  fieldName: "Mother's Maiden Name",
  isRequired: true,
  triggeredBy: 'education_history',
  triggeredByContext: 'Education Verification - Mexico',
  triggeredByEntryIndex: 0,
};

// ---------------------------------------------------------------------------
// addCrossSectionRequirements
// ---------------------------------------------------------------------------

describe('addCrossSectionRequirements', () => {
  it('creates a new target bucket when the target has no entries yet', () => {
    const empty: CrossSectionRegistry = {};

    const next = addCrossSectionRequirements(empty, 'subject', [
      middleNameFromAddressEntry0,
    ]);

    expect(next.subject).toEqual([middleNameFromAddressEntry0]);
  });

  it('appends new entries to an existing target bucket', () => {
    const start: CrossSectionRegistry = {
      subject: [middleNameFromAddressEntry0],
    };

    const next = addCrossSectionRequirements(start, 'subject', [
      motherMaidenFromEducationEntry0,
    ]);

    expect(next.subject).toEqual([
      middleNameFromAddressEntry0,
      motherMaidenFromEducationEntry0,
    ]);
  });

  it('deduplicates by (fieldId, triggeredBy, triggeredByEntryIndex)', () => {
    // Same fieldId + triggeredBy + triggeredByEntryIndex — must not appear twice.
    const start: CrossSectionRegistry = {
      subject: [middleNameFromAddressEntry0],
    };

    const updatedCopyOfSameTriplet: CrossSectionRequirementEntry = {
      ...middleNameFromAddressEntry0,
      triggeredByContext: 'Criminal Search - Australia (refreshed)',
    };

    const next = addCrossSectionRequirements(start, 'subject', [
      updatedCopyOfSameTriplet,
    ]);

    expect(next.subject).toHaveLength(1);
    // The replacement wins (so the latest context value is reflected).
    expect(next.subject?.[0].triggeredByContext).toBe(
      'Criminal Search - Australia (refreshed)'
    );
  });

  it('keeps separate entries when the same fieldId comes from a different entry index', () => {
    const start: CrossSectionRegistry = {
      subject: [middleNameFromAddressEntry0],
    };

    const next = addCrossSectionRequirements(start, 'subject', [
      middleNameFromAddressEntry1,
    ]);

    expect(next.subject).toHaveLength(2);
  });

  it('returns a new object rather than mutating the input', () => {
    const start: CrossSectionRegistry = {
      subject: [middleNameFromAddressEntry0],
    };

    const next = addCrossSectionRequirements(start, 'subject', [
      motherMaidenFromEducationEntry0,
    ]);

    expect(next).not.toBe(start);
    expect(start.subject).toHaveLength(1); // unchanged
  });
});

// ---------------------------------------------------------------------------
// removeCrossSectionRequirementsForEntry (BR 19)
// ---------------------------------------------------------------------------

describe('removeCrossSectionRequirementsForEntry', () => {
  it('removes only entries matching both triggeredBy and triggeredByEntryIndex', () => {
    const start: CrossSectionRegistry = {
      subject: [
        middleNameFromAddressEntry0,
        middleNameFromAddressEntry1,
        motherMaidenFromEducationEntry0,
      ],
    };

    const next = removeCrossSectionRequirementsForEntry(
      start,
      'address_history',
      0
    );

    // address_history index 0 should be gone; address_history index 1 stays;
    // education_history index 0 stays.
    expect(next.subject).toEqual([
      middleNameFromAddressEntry1,
      motherMaidenFromEducationEntry0,
    ]);
  });

  it('does nothing when no entry matches the provided triggeredBy + index', () => {
    const start: CrossSectionRegistry = {
      subject: [middleNameFromAddressEntry0],
    };

    const next = removeCrossSectionRequirementsForEntry(
      start,
      'employment_history',
      5
    );

    expect(next.subject).toEqual([middleNameFromAddressEntry0]);
  });

  it('returns a new object rather than mutating the input', () => {
    const start: CrossSectionRegistry = {
      subject: [middleNameFromAddressEntry0],
    };

    const next = removeCrossSectionRequirementsForEntry(
      start,
      'address_history',
      0
    );

    expect(next).not.toBe(start);
    expect(start.subject).toHaveLength(1); // unchanged
  });
});

// ---------------------------------------------------------------------------
// removeCrossSectionRequirementsForSource
// ---------------------------------------------------------------------------

describe('removeCrossSectionRequirementsForSource', () => {
  it('removes every entry contributed by the given triggeredBy source', () => {
    const start: CrossSectionRegistry = {
      subject: [
        middleNameFromAddressEntry0,
        middleNameFromAddressEntry1,
        motherMaidenFromEducationEntry0,
      ],
    };

    const next = removeCrossSectionRequirementsForSource(
      start,
      'address_history'
    );

    expect(next.subject).toEqual([motherMaidenFromEducationEntry0]);
  });

  it('leaves the registry unchanged when no entries match', () => {
    const start: CrossSectionRegistry = {
      subject: [motherMaidenFromEducationEntry0],
    };

    const next = removeCrossSectionRequirementsForSource(
      start,
      'address_history'
    );

    expect(next.subject).toEqual([motherMaidenFromEducationEntry0]);
  });

  it('returns a new object rather than mutating the input', () => {
    const start: CrossSectionRegistry = {
      subject: [middleNameFromAddressEntry0],
    };

    const next = removeCrossSectionRequirementsForSource(
      start,
      'address_history'
    );

    expect(next).not.toBe(start);
    expect(start.subject).toHaveLength(1); // unchanged
  });
});

// ---------------------------------------------------------------------------
// getCrossSectionRequirements
// ---------------------------------------------------------------------------

describe('getCrossSectionRequirements', () => {
  it('returns the array of entries for the given target', () => {
    const registry: CrossSectionRegistry = {
      subject: [middleNameFromAddressEntry0, motherMaidenFromEducationEntry0],
    };

    const result = getCrossSectionRequirements(registry, 'subject');

    expect(result).toEqual([
      middleNameFromAddressEntry0,
      motherMaidenFromEducationEntry0,
    ]);
  });

  it('returns an empty array when the target has no entries', () => {
    const registry: CrossSectionRegistry = {};

    const result = getCrossSectionRequirements(registry, 'subject');

    expect(result).toEqual([]);
  });
});
