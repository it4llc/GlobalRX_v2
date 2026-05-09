// /GlobalRX_v2/src/lib/candidate/validation/savedEntryShape.ts
//
// Phase 7 Stage 3a — pure helpers that read the saved-entry shape (the
// `formData.sections[sectionId].entries[].fields[]` structure produced by
// the candidate UI). Hoisted out of `validationEngine.ts` so the engine can
// stay below the 600-line hard stop in CODING_STANDARDS.md Section 9.4.
//
// Spec:           docs/specs/phase7-stage3a-validation-engine-split.md
// Technical plan: docs/specs/phase7-stage3a-validation-engine-split-technical-plan.md §4.2
//
// These two helpers depend only on the `SavedRepeatableEntry` shape, which
// is structural rather than nominal — re-declared here to match the engine's
// own narrow declaration without coupling the two modules. This mirrors the
// existing pattern between `validationEngine.ts` and
// `personalInfoIdvFieldChecks.ts`.

export interface SavedFieldRecord {
  requirementId: string;
  value: unknown;
}

export interface SavedRepeatableEntry {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: SavedFieldRecord[];
}

export interface SavedSectionData {
  type?: string;
  fields?: SavedFieldRecord[];
  entries?: SavedRepeatableEntry[];
  aggregatedFields?: Record<string, unknown>;
}

export interface SectionVisitRecord {
  visitedAt: string;
  departedAt: string | null;
}

// Translate the saved-data per-entry shape (fields: SavedFieldRecord[]) into
// the date-extractor shape (fields: Record<requirementId|fieldKey, value>).
export function flattenEntry(entry: SavedRepeatableEntry): {
  entryOrder: number;
  fields: Record<string, unknown>;
} {
  const flat: Record<string, unknown> = {};
  for (const field of entry.fields) {
    flat[field.requirementId] = field.value;
  }
  return { entryOrder: entry.entryOrder, fields: flat };
}

// Heuristic: an "address_block" field is a saved field whose value is a JSON
// object containing fromDate / toDate / isCurrent keys. We sniff the first
// entry's fields so the validator doesn't need a separate metadata fetch.
export function inferAddressBlockRequirementId(
  entries: SavedRepeatableEntry[],
): string | null {
  for (const entry of entries) {
    for (const field of entry.fields) {
      const v = field.value;
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        const obj = v as object;
        if ('fromDate' in obj || 'toDate' in obj || 'isCurrent' in obj) {
          return field.requirementId;
        }
      }
    }
  }
  return null;
}
