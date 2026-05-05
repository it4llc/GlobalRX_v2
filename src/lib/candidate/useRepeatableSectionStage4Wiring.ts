// /GlobalRX_v2/src/lib/candidate/useRepeatableSectionStage4Wiring.ts
//
// Phase 6 Stage 4 — shared cross-cutting wiring for repeatable section
// components (Address History, Education, Employment).
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Why this hook exists:
//   The architect's plan calls for three near-identical pieces of wiring
//   inside each repeatable section: (1) push subject-targeted DSX
//   requirements into the cross-section registry whenever fields load for
//   an entry's country (BR 17 + 18); (2) compute the section's status via
//   computeRepeatableSectionStatus and report it through onProgressUpdate
//   (BR 14, 16); (3) on unmount, clear the section's contributions from the
//   registry so a closed tab doesn't leave Personal Info evaluating dead
//   requirements. Inlining these three useEffect blocks in each section
//   pushes Education from 561 to ~660 lines, Employment from 465 to ~565,
//   and Address History from 596 to ~696 — past the 600-line hard stop.
//
//   Extracting them to one hook gives each section ~10 lines of wiring
//   instead of ~100 and concentrates the Stage 4 wiring contract in one
//   testable place. The hook is a pure wrapper: it does not own state, does
//   not implement registry or progress logic itself, and never reaches into
//   per-section state shapes — the section computes its registry entries
//   and progress inputs and hands them to the hook.

'use client';

import { useEffect } from 'react';

import { computeRepeatableSectionStatus } from '@/lib/candidate/sectionProgress';
import type {
  CrossSectionRequirementEntry,
  CrossSectionTarget,
  SectionStatus,
  UploadedDocumentMetadata,
} from '@/types/candidate-stage4';

/**
 * Inputs the wiring hook needs from the section component. Repeatable
 * sections compute these from their own state and pass them in unchanged.
 */
export interface UseRepeatableSectionStage4WiringArgs {
  /**
   * Stable string identifier for this section's contributions to the cross-
   * section registry — e.g., 'education_history', 'employment_history',
   * 'address_history'. Used as the `triggeredBy` value on every registry
   * entry contributed by this source and as the deletion key on unmount.
   */
  triggeredBy: string;

  /**
   * Subject-targeted DSX requirements this section currently contributes,
   * already flattened to the registry's entry shape. The hook does NOT
   * deduplicate this list — the section is responsible for producing exactly
   * the set of entries it wants to advertise. Empty array is valid and
   * results in the section advertising no contributions.
   */
  subjectRequirements: CrossSectionRequirementEntry[];

  /**
   * Inputs to computeRepeatableSectionStatus. Same shape as the helper's
   * parameter — the hook just forwards the call. Pass `null` to skip the
   * progress computation for this render (useful while the section is still
   * loading and doesn't yet know its required-fields shape).
   */
  progressInputs: Parameters<typeof computeRepeatableSectionStatus>[0] | null;

  /**
   * Shell-provided callback that registers the contributions for this
   * source. The hook always passes the literal string `'subject'` as the
   * target because Stage 4 supports only that target (BR 17). When
   * undefined, the registry-push effect is a no-op.
   */
  onCrossSectionRequirementsChanged?: (
    target: CrossSectionTarget,
    triggeredBy: string,
    entries: CrossSectionRequirementEntry[],
  ) => void;

  /**
   * Shell-provided callback that clears every entry contributed by this
   * source. The hook calls it from the unmount cleanup and is a no-op when
   * undefined. Stage 4 sections also call this directly on country reset to
   * the "no country" state; the hook does not duplicate that path.
   */
  onCrossSectionRequirementsRemovedForSource?: (triggeredBy: string) => void;

  /**
   * Shell-provided callback that receives the section's freshly computed
   * progress status. No-op when undefined. Sections without progress to
   * report (e.g., still loading) can pass `progressInputs: null` to skip the
   * computation entirely.
   */
  onProgressUpdate?: (status: SectionStatus) => void;
}

/**
 * Wire the three cross-cutting Stage 4 effects for a repeatable section.
 * Called from inside the component body once per render — same rules as any
 * other React hook (stable order, no conditional invocation).
 */
export function useRepeatableSectionStage4Wiring(
  args: UseRepeatableSectionStage4WiringArgs,
): void {
  const {
    triggeredBy,
    subjectRequirements,
    progressInputs,
    onCrossSectionRequirementsChanged,
    onCrossSectionRequirementsRemovedForSource,
    onProgressUpdate,
  } = args;

  // Effect 1 — re-publish this section's subject-targeted requirements into
  // the registry whenever the contributions change. The shell's callback is
  // expected to replace prior entries from this `triggeredBy` (the shell's
  // implementation in portal-layout.tsx uses removeForSource + add, which
  // matches BR 17/18 / DoD 13 semantics).
  useEffect(() => {
    if (!onCrossSectionRequirementsChanged) return;
    onCrossSectionRequirementsChanged('subject', triggeredBy, subjectRequirements);
  }, [triggeredBy, subjectRequirements, onCrossSectionRequirementsChanged]);

  // Effect 2 — recompute and report progress whenever the inputs change.
  // The progress helper is pure; the hook only forwards values. Sections
  // that aren't ready to compute pass `progressInputs: null` and the effect
  // becomes a no-op for that render.
  useEffect(() => {
    if (!onProgressUpdate) return;
    if (progressInputs === null) return;
    const status = computeRepeatableSectionStatus(progressInputs);
    onProgressUpdate(status);
  }, [progressInputs, onProgressUpdate]);

  // No unmount cleanup — TD-059 requires cross-section contributions to
  // persist across tab navigation so Personal Info's status stays accurate
  // while the source section is unmounted. Cleanup is still correctly handled
  // by Effect 1's replace semantics (when country selection changes) and by
  // per-entry removal callbacks invoked from the source section's own logic.
}

// ---------------------------------------------------------------------------
// Shared pure helpers — kept colocated with the wiring hook because each
// repeatable section needs the same two derivations (subject-requirements
// flatten and progress-inputs build) before calling the hook. Putting them
// here avoids duplicating the same shape transformation in every section
// file and keeps `AddressHistorySection.tsx` from spilling past its 600-line
// hard-stop threshold.
// ---------------------------------------------------------------------------

/** Minimal field shape the helpers consume. Each section's local DSX field
 *  type is structurally compatible with this. `documentData` is widened to
 *  `Record<string, unknown>` because the codebase's DocumentMetadata uses an
 *  index signature; the helpers narrow `documentData.scope` themselves. */
export interface RepeatableWiringField {
  requirementId: string;
  fieldKey: string;
  name: string;
  type: string;
  isRequired: boolean;
  documentData?: Record<string, unknown> | null;
}

/** Minimal entry shape the helpers consume. */
export interface RepeatableWiringEntry {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: Array<{ requirementId: string; value: unknown }>;
}

/**
 * Build the registry contribution list for one section from its entries +
 * the per-country subject-targeted DSX fields it has loaded. Each entry with
 * a country contributes one registry entry per subject field. Entries
 * without a country (still empty) contribute nothing.
 *
 * The field type parameter is generic so each section can pass its own DSX
 * field shape — the helper only reads the structurally-required properties
 * declared by `RepeatableWiringField`.
 */
export function buildSubjectRequirementsForEntries<
  F extends RepeatableWiringField,
>(
  entries: RepeatableWiringEntry[],
  subjectFieldsByCountry: Record<string, F[]>,
  triggeredBy: string,
): CrossSectionRequirementEntry[] {
  const out: CrossSectionRequirementEntry[] = [];
  for (const entry of entries) {
    if (!entry.countryId) continue;
    const fields = subjectFieldsByCountry[entry.countryId] ?? [];
    for (const field of fields) {
      out.push({
        fieldId: field.requirementId,
        fieldKey: field.fieldKey,
        fieldName: field.name,
        isRequired: field.isRequired,
        triggeredBy,
        triggeredByContext: entry.countryId,
        triggeredByEntryIndex: entry.entryOrder,
      });
    }
  }
  return out;
}

/**
 * Build the inputs that `computeRepeatableSectionStatus` consumes from one
 * section's entries + the per-country local DSX fields it has loaded. Pure
 * — no React, no I/O. Returns null when `loading` is true so the caller can
 * pass it straight through to the hook (which skips the progress effect for
 * a null input, the documented "still loading" sentinel).
 *
 * Optional `aggregated` lets sections (currently only AddressHistory) hand
 * in their aggregated-area uploaded documents and the corresponding
 * requirement list so per_search / per_order documents are evaluated too.
 * Defaults are an empty bucket / empty list so per_entry-only sections can
 * omit them.
 */
export function buildRepeatableProgressInputs<
  F extends RepeatableWiringField,
>(args: {
  entries: RepeatableWiringEntry[];
  fieldsByCountry: Record<string, F[]>;
  loading: boolean;
  aggregatedDocuments?: Record<string, UploadedDocumentMetadata | undefined>;
  aggregatedDocumentRequirements?: Array<{
    id: string;
    type: string;
    isRequired: boolean;
    documentData?: { scope?: string | null } | null;
  }>;
}): Parameters<typeof computeRepeatableSectionStatus>[0] | null {
  const { entries, fieldsByCountry, loading } = args;
  if (loading) return null;
  const requiredFieldsByEntry: Record<
    number,
    Array<{ id: string; fieldKey: string; isRequired: boolean }>
  > = {};
  const requiredDocumentsByEntry: Record<
    number,
    Array<{
      id: string;
      type: string;
      isRequired: boolean;
      documentData?: { scope?: string | null } | null;
    }>
  > = {};
  const uploadedDocumentsByEntry: Record<
    number,
    Record<string, UploadedDocumentMetadata | undefined>
  > = {};

  const entriesForProgress = entries.map((entry) => ({
    entryOrder: entry.entryOrder,
    fields: Object.fromEntries(
      entry.fields.map((f) => [
        // The progress helper keys by fieldKey; we look up the field's key
        // from the loaded country fields list when available, otherwise we
        // store under the requirementId so a missing key never reads as
        // satisfied by accident.
        fieldKeyForRequirement(f.requirementId, entry.countryId, fieldsByCountry) ??
          f.requirementId,
        f.value,
      ]),
    ),
  }));

  for (const entry of entries) {
    const fields = entry.countryId ? fieldsByCountry[entry.countryId] ?? [] : [];
    requiredFieldsByEntry[entry.entryOrder] = fields
      .filter((f) => f.type !== 'document')
      .map((f) => ({
        id: f.requirementId,
        fieldKey: f.fieldKey,
        isRequired: f.isRequired,
      }));
    requiredDocumentsByEntry[entry.entryOrder] = fields
      .filter((f) => f.type === 'document')
      .map((f) => ({
        id: f.requirementId,
        type: 'document',
        isRequired: f.isRequired,
        documentData: extractDocumentScope(f.documentData),
      }));
    const uploadedForEntry: Record<string, UploadedDocumentMetadata | undefined> = {};
    for (const stored of entry.fields) {
      if (
        stored.value &&
        typeof stored.value === 'object' &&
        !Array.isArray(stored.value) &&
        (stored.value as { documentId?: unknown }).documentId
      ) {
        uploadedForEntry[stored.requirementId] =
          stored.value as unknown as UploadedDocumentMetadata;
      }
    }
    uploadedDocumentsByEntry[entry.entryOrder] = uploadedForEntry;
  }

  return {
    entries: entriesForProgress,
    requiredFieldsByEntry,
    requiredDocumentsByEntry,
    uploadedDocumentsByEntry,
    aggregatedDocuments: args.aggregatedDocuments ?? {},
    aggregatedDocumentRequirements: args.aggregatedDocumentRequirements ?? [],
  };
}

/**
 * Look up a requirement's `fieldKey` from the loaded country fields. Returns
 * `null` when the country isn't loaded yet — the caller stores under the
 * requirementId in that case so the progress helper never reads a missing key
 * as a satisfied required field.
 */
function fieldKeyForRequirement(
  requirementId: string,
  countryId: string | null,
  fieldsByCountry: Record<string, Array<{ requirementId: string; fieldKey: string }>>,
): string | null {
  if (!countryId) return null;
  const fields = fieldsByCountry[countryId];
  if (!fields) return null;
  const match = fields.find((f) => f.requirementId === requirementId);
  return match ? match.fieldKey : null;
}

/**
 * Narrow a DSX DocumentMetadata bag to only the `scope` field that the
 * progress helper consumes. The DSX type uses `[key: string]: unknown` so a
 * direct cast would lose type safety — this helper keeps the narrowing
 * explicit and one-place.
 */
function extractDocumentScope(
  documentData: Record<string, unknown> | null | undefined,
): { scope?: string | null } | null {
  if (!documentData) return null;
  const raw = documentData.scope;
  if (typeof raw === 'string') return { scope: raw };
  if (raw === null || raw === undefined) return { scope: null };
  return null;
}
