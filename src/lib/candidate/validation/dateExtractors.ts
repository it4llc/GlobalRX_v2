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

// Coerce a saved boolean-ish value. Accepts true/false; treats string 'true'
// / 'false' as their booleans for resilience against legacy save shapes.
function parseBooleanValue(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
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
 * Extract { start, end, isCurrent } from an Employment History saved entry.
 *
 * Employment dates are stored as separate fields with camelCase fieldKeys.
 * We look up start / end / currentlyEmployed by SCANNING the entry's saved
 * fields against the alias sets imported from
 * `@/components/candidate/form-engine/employmentDateFieldKeys`. Two entry
 * shapes are accepted to match what the saved-data endpoint can return:
 *
 *   1. fields keyed by camelCase fieldKey directly:
 *      { startDate: '2019-04-01', endDate: '2022-09-30', currentlyEmployed: false }
 *
 *   2. fields keyed by requirementId, with a `fieldsByCountry` lookup
 *      providing the requirementId-to-fieldKey mapping. The current saved
 *      entries this stage cares about already use shape (1); we accept
 *      shape (2) defensively so future configurations don't break this
 *      extractor.
 *
 * The `fieldsByCountry` parameter is reserved for shape (2) lookups and is
 * currently unused — keeping it on the signature lets future country-aware
 * employment configurations supply the alias map without an API break.
 */
export function extractEmploymentEntryDates(
  entry: SavedEntry,
  // Reserved for shape-(2) lookups (see docstring). Underscore prefix marks
  // it as intentionally unused for now without changing the public signature.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fieldsByCountry: Record<string, FieldLike[]>,
): { start: Date | null; end: Date | null; isCurrent: boolean } {
  const fields = entry.fields;

  // Find the first matching key for each role. Multiple aliases may collide
  // in degenerate save data; we take the first matching alias set hit so
  // behavior is deterministic.
  let startValue: unknown = null;
  let endValue: unknown = null;
  let currentValue: unknown = false;

  for (const key of Object.keys(fields)) {
    if (START_DATE_FIELD_KEYS.has(key) && startValue === null) {
      startValue = fields[key];
    } else if (END_DATE_FIELD_KEYS.has(key) && endValue === null) {
      endValue = fields[key];
    } else if (CURRENTLY_EMPLOYED_FIELD_KEYS.has(key)) {
      // Always overwrite — the alias set may have multiple keys, but they
      // should all carry the same boolean.
      currentValue = fields[key];
    }
  }

  const isCurrent = parseBooleanValue(currentValue);
  const start = parseDateValue(startValue);
  const end = isCurrent ? null : parseDateValue(endValue);

  return { start, end, isCurrent };
}
