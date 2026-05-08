// /GlobalRX_v2/src/lib/candidate/validation/dateExtractors.ts
//
// Phase 7 Stage 1 — pure date extractors that read start/end dates and
// "current" flags from saved candidate entries.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rule 23 — entries with no end date treated as ending on
//                  the live current date, which is the caller's
//                  responsibility — these helpers return `end: null` when
//                  the entry is current)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.7
//
// Why two extractors:
//   Address-history entries store dates INSIDE the address_block field's
//   JSON value (`fromDate`, `toDate`, `isCurrent`). Employment-history
//   entries store dates as separate fields with camelCase fieldKeys
//   (`startDate`, `endDate`, `currentlyEmployed`). Both extractors return the
//   same uniform { start, end, isCurrent } shape so the rest of the
//   validation engine doesn't care about the underlying storage difference.

import {
  CURRENTLY_EMPLOYED_FIELD_KEYS,
  END_DATE_FIELD_KEYS,
  START_DATE_FIELD_KEYS,
} from '@/components/candidate/form-engine/employmentDateFieldKeys';

import type { FieldLike, SavedEntry } from './types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

// Coerce a saved field value to a Date. Accepts ISO strings; rejects
// anything that doesn't parse to a finite epoch. We intentionally don't
// allow Date objects here because the saved-data endpoint returns strings.
function parseDateValue(value: unknown): Date | null {
  if (typeof value !== 'string') {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

// Coerce a saved boolean-ish value. Accepts true/false; treats string
// variants 'true'/'yes' as true and 'false'/'no' as false. Single-element
// arrays (e.g. ['yes']) are unwrapped first — the form-engine's checkbox
// save shape wraps boolean answers as a one-element string array.
function parseBooleanValue(value: unknown): boolean {
  if (Array.isArray(value) && value.length === 1) {
    return parseBooleanValue(value[0]);
  }
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === 'yes') return true;
    if (lower === 'false' || lower === 'no') return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// extractAddressEntryDates
// ---------------------------------------------------------------------------

/**
 * Extract { start, end, isCurrent } from an Address History saved entry.
 * Address-history dates live INSIDE the address_block field's JSON value.
 *
 * If the address_block field is missing or the value is not an object, the
 * extractor returns all-null with isCurrent=false rather than throwing —
 * the validation engine will surface that as a "missing required field"
 * error elsewhere.
 *
 * Note: when isCurrent is true we deliberately return `end: null`. The
 * caller (gap detection / time-based scope) treats null as "ending today"
 * per Spec Rule 23. Putting that responsibility in the caller keeps these
 * extractors deterministic regardless of when "today" is.
 */
export function extractAddressEntryDates(
  entry: SavedEntry,
  addressBlockRequirementId: string,
): { start: Date | null; end: Date | null; isCurrent: boolean } {
  const rawValue = entry.fields[addressBlockRequirementId];
  if (
    !rawValue ||
    typeof rawValue !== 'object' ||
    Array.isArray(rawValue)
  ) {
    return { start: null, end: null, isCurrent: false };
  }

  // `rawValue` is the address_block JSON object. Phase 6 Stage 3 stores
  // fromDate / toDate / isCurrent there. We accept both `null` and missing
  // keys as "not provided".
  const blockValue = rawValue as {
    fromDate?: unknown;
    toDate?: unknown;
    isCurrent?: unknown;
  };

  const start = parseDateValue(blockValue.fromDate);
  const isCurrent = parseBooleanValue(blockValue.isCurrent);
  // When isCurrent is true we deliberately ignore any toDate so the caller
  // can apply the "ending today" rule without inspecting both fields.
  const end = isCurrent ? null : parseDateValue(blockValue.toDate);

  return { start, end, isCurrent };
}

// ---------------------------------------------------------------------------
// extractEmploymentEntryDates
// ---------------------------------------------------------------------------

/**
 * Per-requirement metadata used to identify a saved field's role
 * (start date / end date / currently-employed) without depending on a
 * package-specific fieldKey naming convention.
 *
 * `dataType` comes from `DSXRequirement.fieldData.dataType` (e.g. 'date',
 * 'boolean', 'text'); `name` is the human-authored requirement name shown in
 * the admin UI ('Start Date', 'End Date', 'Graduation Date', ...); `fieldKey`
 * is the camelCase identifier kept here so the alias-set fallback can run.
 */
export interface RequirementMetadata {
  fieldKey: string;
  name: string;
  dataType: string;
}

/**
 * Extract { start, end, isCurrent } from an Employment / Education saved
 * entry.
 *
 * Identifies which saved field is the start / end / currently-employed flag
 * primarily by the requirement's metadata (Phase 7 Stage 2 fix):
 *
 *   - dataType === 'date'  + name contains 'start' (case-insensitive)         → start
 *   - dataType === 'date'  + name contains 'end' or 'graduation'              → end
 *   - dataType === 'boolean' OR name contains 'current'                       → currentlyEmployed
 *
 * This is intentionally tolerant of fieldKey naming. Different package
 * configurations have used `startDate`, `employmentStartDate`, or auto-fallback
 * UUID-based fieldKeys for the same logical role. The metadata-based
 * identification works across all of them as long as the requirement has
 * `fieldData.dataType` set and a descriptive `name`.
 *
 * Falls back to the legacy alias sets imported from
 * `@/components/candidate/form-engine/employmentDateFieldKeys` so any saved
 * entry that uses a known fieldKey alias still resolves even when metadata
 * is unavailable (belt-and-suspenders).
 *
 * Two entry shapes are accepted:
 *   1. fields keyed by camelCase fieldKey directly
 *      { startDate: '2019-04-01', endDate: '2022-09-30', currentlyEmployed: false }
 *   2. fields keyed by requirementId UUIDs (the runtime shape produced by
 *      `flattenEntry` over saved data). Caller must supply
 *      `requirementMetadata` so each UUID can be looked up.
 *
 * The legacy `_fieldsByCountry` parameter is retained on the signature for
 * API compatibility with existing tests and is no longer read.
 */
export function extractEmploymentEntryDates(
  entry: SavedEntry,
  /**
   * @deprecated Replaced by `requirementMetadata`. Retained on the signature
   * only to preserve API compatibility with existing callers and tests; the
   * implementation no longer reads this parameter.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fieldsByCountry: Record<string, FieldLike[]>,
  /**
   * Map of saved-field requirementId → { fieldKey, name, dataType }. Required
   * for shape (2) entries; ignored for shape (1). When omitted or when a
   * given requirementId is not in the map, the extractor falls back to the
   * fieldKey alias sets.
   */
  requirementMetadata?: Map<string, RequirementMetadata>,
): { start: Date | null; end: Date | null; isCurrent: boolean } {
  const fields = entry.fields;

  let startValue: unknown = null;
  let endValue: unknown = null;
  let currentValue: unknown = false;

  for (const key of Object.keys(fields)) {
    let role: 'start' | 'end' | 'current' | null = null;
    const meta = requirementMetadata?.get(key);

    // Primary: identify the field role from the requirement's metadata.
    if (meta) {
      const nameLower = meta.name.toLowerCase();
      if (meta.dataType === 'date') {
        if (nameLower.includes('start')) {
          role = 'start';
        } else if (
          nameLower.includes('end') ||
          nameLower.includes('graduation')
        ) {
          role = 'end';
        }
      } else if (
        meta.dataType === 'boolean' ||
        nameLower.includes('current')
      ) {
        role = 'current';
      }
    }

    // Fallback: the fieldKey alias sets. Try the metadata-supplied fieldKey
    // first (shape 2) and then the raw saved-data key (shape 1).
    if (role === null) {
      const candidates: string[] = [];
      if (meta?.fieldKey && meta.fieldKey !== key) {
        candidates.push(meta.fieldKey);
      }
      candidates.push(key);
      for (const candidate of candidates) {
        if (START_DATE_FIELD_KEYS.has(candidate)) {
          role = 'start';
          break;
        }
        if (END_DATE_FIELD_KEYS.has(candidate)) {
          role = 'end';
          break;
        }
        if (CURRENTLY_EMPLOYED_FIELD_KEYS.has(candidate)) {
          role = 'current';
          break;
        }
      }
    }

    if (role === 'start' && startValue === null) {
      startValue = fields[key];
    } else if (role === 'end' && endValue === null) {
      endValue = fields[key];
    } else if (role === 'current') {
      // Always overwrite — multiple alias hits should all carry the same
      // boolean answer.
      currentValue = fields[key];
    }
  }

  const isCurrent = parseBooleanValue(currentValue);
  const start = parseDateValue(startValue);
  const end = isCurrent ? null : parseDateValue(endValue);

  return { start, end, isCurrent };
}
