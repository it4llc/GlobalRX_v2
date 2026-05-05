// /GlobalRX_v2/src/lib/candidate/crossSectionRegistry.ts
//
// Pure helper functions that operate on the cross-section requirement
// registry. The registry tracks DSX requirements that are triggered by one
// section but must be evaluated as required by a different section's progress
// check (e.g., an Address History entry in Australia making Middle Name —
// owned by Personal Information — required).
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Coverage:
//   - BR 17: Stage 4 supports the `subject` target only.
//   - BR 19: Registry entries cleared when a repeatable entry is deleted.
//   - DoD 13: Cross-section registry is populated when DSX requirements with
//             collectionTab !== currentSection are loaded.
//   - DoD 16: Registry entries cleared when a repeatable entry is deleted.
//
// All helpers are pure: they accept the current registry value and return a
// new object rather than mutating the input. This matches the React-state
// idioms used elsewhere in the candidate-portal feature.

import type {
  CrossSectionRegistry,
  CrossSectionRequirementEntry,
  CrossSectionTarget,
} from '@/types/candidate-stage4';

/**
 * Add new requirements to the registry under the given target. If a triplet
 * `(fieldId, triggeredBy, triggeredByEntryIndex)` already exists, the existing
 * entry is replaced by the incoming one — this lets sections re-push their
 * requirements after a country change without producing duplicates.
 *
 * The deduplication intentionally distinguishes between contributions from
 * different `triggeredByEntryIndex` values (different entries in the same
 * source section). The banner deduplicates by `fieldKey` for display, but the
 * registry must hold separate rows so removing one entry doesn't remove a
 * requirement another entry still triggers.
 */
export function addCrossSectionRequirements(
  registry: CrossSectionRegistry,
  target: CrossSectionTarget,
  requirements: CrossSectionRequirementEntry[],
): CrossSectionRegistry {
  const existing = registry[target] ?? [];

  // Build a map of incoming triplets so we can dedupe efficiently and let the
  // incoming entries win when a triplet collision is detected.
  const incomingByKey = new Map<string, CrossSectionRequirementEntry>();
  for (const entry of requirements) {
    incomingByKey.set(makeTripletKey(entry), entry);
  }

  // Keep existing entries that are NOT being replaced, then append the
  // incoming ones (preserving incoming order). This produces deterministic
  // ordering: existing-survivors first, then new arrivals.
  const survivors = existing.filter(
    (entry) => !incomingByKey.has(makeTripletKey(entry)),
  );

  const next = [...survivors, ...requirements];

  return {
    ...registry,
    [target]: next,
  };
}

/**
 * Remove entries from every target bucket whose `triggeredBy` and
 * `triggeredByEntryIndex` both match. Implements BR 19: when a repeatable
 * entry is deleted, the cross-section requirements it contributed must be
 * cleared.
 */
export function removeCrossSectionRequirementsForEntry(
  registry: CrossSectionRegistry,
  triggeredBy: string,
  entryIndex: number,
): CrossSectionRegistry {
  const next: CrossSectionRegistry = {};
  for (const target of Object.keys(registry) as CrossSectionTarget[]) {
    const entries = registry[target] ?? [];
    next[target] = entries.filter(
      (entry) =>
        !(
          entry.triggeredBy === triggeredBy &&
          entry.triggeredByEntryIndex === entryIndex
        ),
    );
  }
  return next;
}

/**
 * Remove every entry contributed by the given `triggeredBy` source from every
 * target bucket. Used when a section unmounts or when its country selection
 * is cleared back to "no country selected" — its requirements should no
 * longer affect any target's progress.
 */
export function removeCrossSectionRequirementsForSource(
  registry: CrossSectionRegistry,
  triggeredBy: string,
): CrossSectionRegistry {
  const next: CrossSectionRegistry = {};
  for (const target of Object.keys(registry) as CrossSectionTarget[]) {
    const entries = registry[target] ?? [];
    next[target] = entries.filter(
      (entry) => entry.triggeredBy !== triggeredBy,
    );
  }
  return next;
}

/**
 * Return the entries posted under the given target, or an empty array when
 * none are present. Accessor used by progress calculations and by the
 * cross-section banner component.
 */
export function getCrossSectionRequirements(
  registry: CrossSectionRegistry,
  target: CrossSectionTarget,
): CrossSectionRequirementEntry[] {
  return registry[target] ?? [];
}

// Compose a stable string key for triplet deduplication. We treat
// `undefined` entryIndex as the literal string "none" so non-repeatable
// sources (which omit the index) still dedupe by source.
function makeTripletKey(entry: CrossSectionRequirementEntry): string {
  const idx =
    entry.triggeredByEntryIndex === undefined
      ? 'none'
      : String(entry.triggeredByEntryIndex);
  return `${entry.fieldId}::${entry.triggeredBy}::${idx}`;
}
