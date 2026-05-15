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

import {
  buildRepeatableProgressInputs,
  buildSubjectRequirementsForEntries,
  useRepeatableSectionStage4Wiring,
} from '../useRepeatableSectionStage4Wiring';
import {
  computeRepeatableSectionStatus,
} from '@/lib/candidate/sectionProgress';
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

  // TD-059 architectural decision — see commit 1ddc6bd:
  // The original Stage 4 plan called for the hook to clear its source's
  // contributions from the cross-section registry on unmount. That cleanup
  // was REMOVED because Personal Info's lifted progress derivation needs
  // those contributions to persist across tab navigation. If a candidate
  // selects Australia on Address History, switches to Personal Info, then
  // back to Address History, the registry must still hold the AU-triggered
  // subject requirements throughout — otherwise the sidebar's Personal Info
  // indicator drops back to not_started/complete each time the source
  // section unmounts. Cleanup is now handled exclusively by:
  //   - Effect 1's replace-semantics on country change (the source pushes
  //     fresh entries; the shell's handler removes prior ones first).
  //   - The per-entry removal callback when the candidate deletes an entry.
  // Source: docs/specs/fix-td059-td060-...md and the bug-investigator's
  // report on personal-info-shell-prefill-progress.
  it('does NOT clear cross-section contributions on unmount — entries persist for the lifted Personal Info derivation', () => {
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

    // After unmount, the cleanup callback must NOT have fired. The source
    // section's contributions stay in the registry so Personal Info's
    // shell-level progress effect can still see them while the section is
    // mounted — and even when it is unmounted, since that's the whole
    // point of TD-059's lifted derivation.
    expect(onCrossSectionRequirementsRemovedForSource).not.toHaveBeenCalled();
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

// ===========================================================================
// REGRESSION TESTS — cross-section-validation-filtering follow-up
//
// Smoke testing surfaced that Education / Employment still pushed locked
// invitation fieldKeys (firstName/lastName/email/phone/phoneNumber) into the
// cross-section registry because `buildSubjectRequirementsForEntries` — used
// by those two sections — did not consult the shared lockedInvitationFieldKeys
// module. Address History was fixed in the earlier pass via the parallel
// helper `buildAddressHistorySubjectRequirements`; this helper handles the
// Education / Employment case symmetrically.
// ===========================================================================

describe('buildSubjectRequirementsForEntries — locked invitation fieldKey filter', () => {
  const ENTRY = {
    entryId: 'e1',
    countryId: 'c1',
    entryOrder: 0,
    fields: [],
  };

  const LOCKED_AND_DYNAMIC = {
    c1: [
      {
        requirementId: 'r-firstName',
        fieldKey: 'firstName',
        name: 'First Name',
        type: 'field',
        isRequired: true,
      },
      {
        requirementId: 'r-lastName',
        fieldKey: 'lastName',
        name: 'Last Name',
        type: 'field',
        isRequired: true,
      },
      {
        requirementId: 'r-email',
        fieldKey: 'email',
        name: 'Email',
        type: 'field',
        isRequired: true,
      },
      {
        requirementId: 'r-phone',
        fieldKey: 'phone',
        name: 'Phone',
        type: 'field',
        isRequired: true,
      },
      {
        requirementId: 'r-phoneNumber',
        fieldKey: 'phoneNumber',
        name: 'Phone Number',
        type: 'field',
        isRequired: true,
      },
      {
        requirementId: 'r-middleName',
        fieldKey: 'middleName',
        name: 'Middle Name',
        type: 'field',
        isRequired: true,
      },
      {
        requirementId: 'r-dateOfBirth',
        fieldKey: 'dateOfBirth',
        name: 'Date of Birth',
        type: 'field',
        isRequired: true,
      },
    ],
  };

  it('REGRESSION TEST: drops all five locked invitation fieldKeys', () => {
    const result = buildSubjectRequirementsForEntries(
      [ENTRY],
      LOCKED_AND_DYNAMIC,
      'employment_history',
    );

    const keys = result.map((r) => r.fieldKey);
    expect(keys).not.toContain('firstName');
    expect(keys).not.toContain('lastName');
    expect(keys).not.toContain('email');
    expect(keys).not.toContain('phone');
    expect(keys).not.toContain('phoneNumber');
  });

  it('keeps the unlocked subject fieldKeys (middleName, dateOfBirth)', () => {
    const result = buildSubjectRequirementsForEntries(
      [ENTRY],
      LOCKED_AND_DYNAMIC,
      'education_history',
    );

    const keys = result.map((r) => r.fieldKey).sort();
    expect(keys).toEqual(['dateOfBirth', 'middleName']);
  });
});

// ===========================================================================
// REGRESSION TESTS — per-entry document scope filtering
//
// Smoke testing on task-8.5-silent-recalculation-step-skipping surfaced the
// "Address History stays red even when complete and Submit is enabled" case:
//   - The server (`repeatableEntryFieldChecks.ts`) skips ALL document
//     requirements during per-entry validation, so its section status is
//     `complete` with zero errors.
//   - `buildRepeatableProgressInputs` previously routed every `type ===
//     'document'` requirement into `requiredDocumentsByEntry`, regardless of
//     scope. `per_search` / `per_order` documents live in the aggregated
//     bucket (Record Search Section after Task 8.4) — they are NEVER stored
//     under `entry.fields[]`, so `uploadedDocumentsByEntry[entryOrder][doc.id]`
//     is always undefined. The progress helper returned `incomplete`,
//     `mergeSectionStatus` Rule 1 promoted it to a red sidebar indicator
//     while the section banner and Review & Submit page (which read from the
//     server's empty error arrays) showed nothing missing.
//
// The fix matches `selectPerEntryDocumentFields` (the inline-upload renderer):
// only `documentData.scope === 'per_entry'` documents participate in the
// per-entry progress check.
// ===========================================================================

describe('buildRepeatableProgressInputs — document scope filter', () => {
  const baseField = {
    requirementId: 'doc-req',
    fieldKey: 'authorizationForm',
    name: 'Authorization Form',
    type: 'document' as const,
    isRequired: true,
  };

  const entryWithCountry = {
    entryId: 'e1',
    countryId: 'US',
    entryOrder: 0,
    fields: [],
  };

  it("REGRESSION TEST: a per_search document does NOT appear in requiredDocumentsByEntry — it's uploaded in Record Search, not on the entry", () => {
    const inputs = buildRepeatableProgressInputs({
      entries: [entryWithCountry],
      fieldsByCountry: {
        US: [{ ...baseField, documentData: { scope: 'per_search' } }],
      },
      loading: false,
    });

    expect(inputs).not.toBeNull();
    expect(inputs!.requiredDocumentsByEntry[0]).toEqual([]);
  });

  it("REGRESSION TEST: a per_order document does NOT appear in requiredDocumentsByEntry", () => {
    const inputs = buildRepeatableProgressInputs({
      entries: [entryWithCountry],
      fieldsByCountry: {
        US: [{ ...baseField, documentData: { scope: 'per_order' } }],
      },
      loading: false,
    });

    expect(inputs!.requiredDocumentsByEntry[0]).toEqual([]);
  });

  it("a per_entry document IS included — the inline upload path is the only one that satisfies it", () => {
    const inputs = buildRepeatableProgressInputs({
      entries: [entryWithCountry],
      fieldsByCountry: {
        US: [{ ...baseField, documentData: { scope: 'per_entry' } }],
      },
      loading: false,
    });

    expect(inputs!.requiredDocumentsByEntry[0]).toHaveLength(1);
    expect(inputs!.requiredDocumentsByEntry[0][0].id).toBe('doc-req');
  });

  it("a document with missing documentData is treated as NOT per_entry (no scope claim → no per-entry requirement)", () => {
    const inputs = buildRepeatableProgressInputs({
      entries: [entryWithCountry],
      fieldsByCountry: {
        US: [{ ...baseField, documentData: null }],
      },
      loading: false,
    });

    expect(inputs!.requiredDocumentsByEntry[0]).toEqual([]);
  });

  it("END-TO-END REGRESSION: a country with ONLY a required per_search document reports 'complete', not 'incomplete' — matches the server's view", () => {
    // This is the exact symptom Andy reported:
    //   - Address History entry filled in (country + address_block complete)
    //   - The country's DSX has a required per_search document (e.g.,
    //     authorization for a court-records check) — uploaded in Record
    //     Search, not on the entry.
    //   - Server says complete (skips documents in per-entry walk).
    //   - Before the fix, `computeRepeatableSectionStatus` returned
    //     'incomplete' because the per_search doc was treated as a missing
    //     per-entry upload. After the fix, it returns 'complete' and the
    //     merge picks 'complete' too.
    const inputs = buildRepeatableProgressInputs({
      entries: [entryWithCountry],
      fieldsByCountry: {
        US: [{ ...baseField, documentData: { scope: 'per_search' } }],
      },
      loading: false,
    });

    expect(inputs).not.toBeNull();
    expect(computeRepeatableSectionStatus(inputs!)).toBe('complete');
  });
});
