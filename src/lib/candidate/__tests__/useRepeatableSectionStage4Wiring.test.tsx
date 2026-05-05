// /GlobalRX_v2/src/lib/candidate/__tests__/useRepeatableSectionStage4Wiring.test.tsx
//
// Phase 6 Stage 4 — wiring contract test for the shared repeatable-section
// hook. Verifies the three effects fire correctly: registry push on mount
// and on subject-requirement changes, progress report on input changes, and
// unmount cleanup. Does NOT exhaustively cover every input shape — those
// are covered by the existing pure-function tests for sectionProgress and
// crossSectionRegistry. This file proves the wiring contract only.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { useRepeatableSectionStage4Wiring } from '../useRepeatableSectionStage4Wiring';
import type { computeRepeatableSectionStatus } from '@/lib/candidate/sectionProgress';
import type {
  CrossSectionRequirementEntry,
  SectionStatus,
} from '@/types/candidate-stage4';

// Local alias for readability — the hook accepts the same input shape that
// the pure progress helper consumes, plus `null` as a "not ready" sentinel.
type ProgressInputs = Parameters<typeof computeRepeatableSectionStatus>[0];

// Realistic registry entry shape — same structure the section components
// build from DSX field load responses (collectionTab === 'subject').
const sampleEntry = (
  overrides: Partial<CrossSectionRequirementEntry> = {},
): CrossSectionRequirementEntry => ({
  fieldId: 'field-uuid-1',
  fieldKey: 'middleName',
  fieldName: 'Middle Name',
  isRequired: true,
  triggeredBy: 'address_history',
  triggeredByContext: 'AU',
  triggeredByEntryIndex: 0,
  ...overrides,
});

// Realistic computeRepeatableSectionStatus input — single entry with one
// satisfied required field. Matches the helper's signature without pulling
// in test fixtures from the helper's own tests.
const sampleProgressInputs = (
  override?: Partial<{
    entriesEmpty: boolean;
    fieldFilled: boolean;
  }>,
): ProgressInputs => ({
  entries: override?.entriesEmpty
    ? []
    : [
        {
          entryOrder: 0,
          fields: { schoolName: override?.fieldFilled === false ? '' : 'Harvard' },
        },
      ],
  requiredFieldsByEntry: override?.entriesEmpty
    ? {}
    : {
        0: [
          {
            id: 'req-1',
            fieldKey: 'schoolName',
            isRequired: true,
          },
        ],
      },
  requiredDocumentsByEntry: {},
  uploadedDocumentsByEntry: {},
  aggregatedDocuments: {},
  aggregatedDocumentRequirements: [],
});

describe('useRepeatableSectionStage4Wiring', () => {
  it('pushes subject requirements into the registry on mount', () => {
    const onCrossSectionRequirementsChanged = vi.fn();

    renderHook(() =>
      useRepeatableSectionStage4Wiring({
        triggeredBy: 'education_history',
        subjectRequirements: [sampleEntry()],
        progressInputs: null,
        onCrossSectionRequirementsChanged,
      }),
    );

    expect(onCrossSectionRequirementsChanged).toHaveBeenCalledTimes(1);
    expect(onCrossSectionRequirementsChanged).toHaveBeenCalledWith(
      'subject',
      'education_history',
      [sampleEntry()],
    );
  });

  it('reports progress on mount when progressInputs are provided', () => {
    const onProgressUpdate = vi.fn();

    renderHook(() =>
      useRepeatableSectionStage4Wiring({
        triggeredBy: 'education_history',
        subjectRequirements: [],
        progressInputs: sampleProgressInputs(),
        onProgressUpdate,
      }),
    );

    expect(onProgressUpdate).toHaveBeenCalledTimes(1);
    expect(onProgressUpdate).toHaveBeenCalledWith<[SectionStatus]>('complete');
  });

  it('reports `not_started` when there are no entries', () => {
    const onProgressUpdate = vi.fn();

    renderHook(() =>
      useRepeatableSectionStage4Wiring({
        triggeredBy: 'education_history',
        subjectRequirements: [],
        progressInputs: sampleProgressInputs({ entriesEmpty: true }),
        onProgressUpdate,
      }),
    );

    expect(onProgressUpdate).toHaveBeenCalledWith<[SectionStatus]>('not_started');
  });

  it('reports `incomplete` when a required field is empty', () => {
    const onProgressUpdate = vi.fn();

    renderHook(() =>
      useRepeatableSectionStage4Wiring({
        triggeredBy: 'education_history',
        subjectRequirements: [],
        progressInputs: sampleProgressInputs({ fieldFilled: false }),
        onProgressUpdate,
      }),
    );

    expect(onProgressUpdate).toHaveBeenCalledWith<[SectionStatus]>('incomplete');
  });

  it('skips the progress callback when progressInputs is null', () => {
    const onProgressUpdate = vi.fn();

    renderHook(() =>
      useRepeatableSectionStage4Wiring({
        triggeredBy: 'education_history',
        subjectRequirements: [],
        progressInputs: null,
        onProgressUpdate,
      }),
    );

    expect(onProgressUpdate).not.toHaveBeenCalled();
  });

  it('re-fires the registry effect when subjectRequirements identity changes', () => {
    const onCrossSectionRequirementsChanged = vi.fn();
    const initial = [sampleEntry()];
    const updated = [sampleEntry({ fieldKey: 'middleNameUpdated' })];

    const { rerender } = renderHook(
      ({ subjectRequirements }) =>
        useRepeatableSectionStage4Wiring({
          triggeredBy: 'address_history',
          subjectRequirements,
          progressInputs: null,
          onCrossSectionRequirementsChanged,
        }),
      { initialProps: { subjectRequirements: initial } },
    );

    expect(onCrossSectionRequirementsChanged).toHaveBeenCalledTimes(1);

    rerender({ subjectRequirements: updated });

    expect(onCrossSectionRequirementsChanged).toHaveBeenCalledTimes(2);
    expect(onCrossSectionRequirementsChanged).toHaveBeenLastCalledWith(
      'subject',
      'address_history',
      updated,
    );
  });

  it('re-fires the progress effect when progressInputs identity changes', () => {
    const onProgressUpdate = vi.fn();

    const { rerender } = renderHook(
      ({ inputs }) =>
        useRepeatableSectionStage4Wiring({
          triggeredBy: 'education_history',
          subjectRequirements: [],
          progressInputs: inputs,
          onProgressUpdate,
        }),
      { initialProps: { inputs: sampleProgressInputs() } },
    );

    expect(onProgressUpdate).toHaveBeenCalledWith<[SectionStatus]>('complete');

    rerender({ inputs: sampleProgressInputs({ fieldFilled: false }) });

    expect(onProgressUpdate).toHaveBeenLastCalledWith<[SectionStatus]>('incomplete');
  });

  it('calls removeForSource exactly once on unmount with the section id', () => {
    const onCrossSectionRequirementsRemovedForSource = vi.fn();

    const { unmount } = renderHook(() =>
      useRepeatableSectionStage4Wiring({
        triggeredBy: 'employment_history',
        subjectRequirements: [],
        progressInputs: null,
        onCrossSectionRequirementsRemovedForSource,
      }),
    );

    expect(onCrossSectionRequirementsRemovedForSource).not.toHaveBeenCalled();

    unmount();

    expect(onCrossSectionRequirementsRemovedForSource).toHaveBeenCalledTimes(1);
    expect(onCrossSectionRequirementsRemovedForSource).toHaveBeenCalledWith(
      'employment_history',
    );
  });

  it('does not throw when every callback is undefined', () => {
    expect(() =>
      renderHook(() =>
        useRepeatableSectionStage4Wiring({
          triggeredBy: 'education_history',
          subjectRequirements: [sampleEntry()],
          progressInputs: sampleProgressInputs(),
        }),
      ),
    ).not.toThrow();
  });

  // Defensive — section components may unmount before they ever attached
  // their callbacks. The cleanup must still be a no-op in that case.
  it('does not throw on unmount when the cleanup callback is undefined', () => {
    const { unmount } = renderHook(() =>
      useRepeatableSectionStage4Wiring({
        triggeredBy: 'education_history',
        subjectRequirements: [],
        progressInputs: null,
      }),
    );
    expect(() => unmount()).not.toThrow();
  });
});
