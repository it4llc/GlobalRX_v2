// /GlobalRX_v2/src/lib/candidate/validation/scopeValidation.ts
//
// Phase 7 Stage 1 — scope validation: count-based and time-based scopes.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 12, 13, 14, 15, 16, Edge 2; DoD 9, 10)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.2
//
// Pure module. "Today" is a Date parameter on the time-based evaluator so
// the function stays testable and deterministic — Rule 14 calls for a live
// date in production, but we capture it once at runValidation()'s entry
// point and thread it through.

import type {
  DatedEntryLike,
  EntryLike,
  ScopeError,
} from './types';
import type { ResolvedScope } from './packageScopeShape';

// ---------------------------------------------------------------------------
// evaluateCountScope (Rules 13, 16, 12; DoD 9)
// ---------------------------------------------------------------------------

/**
 * Evaluate a count-based scope (count_exact / count_specific / all) against
 * a list of entries. Per Rule 16, every entry counts toward the total
 * regardless of whether its fields are filled in — empty entries are not a
 * count problem; that's a field-level concern.
 *
 * - count_exact (scopeValue=1): exactly 1 entry required
 * - count_specific (scopeValue=N): exactly N entries required
 * - all: at least 1 entry required, no upper limit
 * - other normalized types (highest_degree, etc.): degree-style scopes are
 *   handled here by treating them like count_exact (1 entry required) so
 *   degree-only sections still get a basic "at least one" check. The full
 *   degree-validation logic is out of scope for Stage 1.
 */
export function evaluateCountScope(
  scope: ResolvedScope,
  entries: EntryLike[],
): ScopeError[] {
  const actual = entries.length;

  switch (scope.scopeType) {
    case 'count_exact': {
      const required = scope.scopeValue ?? 1;
      if (actual === required) return [];
      // Any deviation — too few or too many — is an error.
      if (actual === 0) {
        return [
          {
            messageKey: 'candidate.validation.scope.zeroEntries',
            placeholders: { required, actual },
          },
        ];
      }
      return [
        {
          messageKey: 'candidate.validation.scope.countExact',
          placeholders: { required, actual },
        },
      ];
    }

    case 'count_specific': {
      const required = scope.scopeValue ?? 0;
      if (actual === required) return [];
      if (actual === 0) {
        return [
          {
            messageKey: 'candidate.validation.scope.zeroEntries',
            placeholders: { required, actual },
          },
        ];
      }
      return [
        {
          messageKey: 'candidate.validation.scope.countSpecific',
          placeholders: { required, actual },
        },
      ];
    }

    case 'all': {
      // At least 1 entry required, no upper limit (Rule 13).
      if (actual >= 1) return [];
      return [
        {
          messageKey: 'candidate.validation.scope.allMustHaveOne',
          placeholders: { required: 1, actual: 0 },
        },
      ];
    }

    case 'highest_degree':
    case 'highest_degree_inc_hs': {
      // Degree-style scopes (verification-edu only) require at least one
      // qualifying entry. Stage 1 only validates "any entry exists"; the
      // degree-specific checks are deferred to a later stage.
      if (actual >= 1) return [];
      return [
        {
          messageKey: 'candidate.validation.scope.allMustHaveOne',
          placeholders: { required: 1, actual: 0 },
        },
      ];
    }

    case 'all_degrees': {
      if (actual >= 1) return [];
      return [
        {
          messageKey: 'candidate.validation.scope.allMustHaveOne',
          placeholders: { required: 1, actual: 0 },
        },
      ];
    }

    case 'time_based':
      // Time-based scopes are evaluated by evaluateTimeBasedScope. Caller
      // misroute — return empty so we don't double-report.
      return [];

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// evaluateTimeBasedScope (Rules 13, 14, 15; Edge 2; DoD 10)
// ---------------------------------------------------------------------------

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const DAYS_PER_YEAR = 365;

/**
 * Evaluate a time-based scope against a list of entries. Returns the error
 * array PLUS the covered/required day counts so the banner UI can show a
 * "covers X years, Y months out of N years" message even when the entries
 * are sufficient.
 *
 * Coverage calculation (Rule 15 / Edge 2): merges overlapping entry
 * intervals into a flat union before counting days, so overlapping ranges
 * are counted once.
 *
 * Current entries (isCurrent=true OR end===null) are clamped to "today" per
 * Rule 23 / Edge 5. Entries with end-dates in the future are also clamped
 * to today so the validator stays coherent — see technical plan §11.5.
 */
export function evaluateTimeBasedScope(
  scope: ResolvedScope,
  entries: DatedEntryLike[],
  today: Date,
): { errors: ScopeError[]; coveredDays: number; requiredDays: number } {
  const requiredYears = scope.scopeValue ?? 0;
  const requiredDays = Math.round(requiredYears * DAYS_PER_YEAR);
  const todayMs = today.getTime();
  const scopeStartMs = todayMs - requiredDays * MS_PER_DAY;

  if (entries.length === 0) {
    return {
      errors: [
        {
          messageKey: 'candidate.validation.scope.timeBasedZero',
          placeholders: {
            required: requiredYears,
            requiredYears,
            actual: 0,
            coveredYears: 0,
            coveredMonths: 0,
          },
        },
      ],
      coveredDays: 0,
      requiredDays,
    };
  }

  // Build clamped intervals — clamp end to today (Rule 23/Edge 5), then
  // intersect with the scope window so entries outside the past N years
  // don't inflate coverage.
  type Interval = { start: number; end: number };
  const intervals: Interval[] = [];
  for (const entry of entries) {
    if (entry.start === null) continue;
    const startMs = entry.start.getTime();
    let endMs: number;
    if (entry.end === null || entry.isCurrent) {
      endMs = todayMs;
    } else {
      // Clamp future end-dates to today.
      endMs = Math.min(entry.end.getTime(), todayMs);
    }
    // Skip degenerate intervals (start after clamped end).
    if (endMs < startMs) continue;
    // Clip to the scope window.
    const clippedStart = Math.max(startMs, scopeStartMs);
    const clippedEnd = Math.min(endMs, todayMs);
    if (clippedEnd <= clippedStart) continue;
    intervals.push({ start: clippedStart, end: clippedEnd });
  }

  // Merge overlapping intervals.
  intervals.sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const iv of intervals) {
    const last = merged[merged.length - 1];
    if (last && iv.start <= last.end) {
      last.end = Math.max(last.end, iv.end);
    } else {
      merged.push({ ...iv });
    }
  }

  const coveredMs = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  // Use ceil so a 364.99-day coverage doesn't round to 364 days, which would
  // make a "barely covered" 7-year scope look 1 day short.
  const coveredDays = Math.round(coveredMs / MS_PER_DAY);

  if (coveredDays >= requiredDays) {
    return { errors: [], coveredDays, requiredDays };
  }

  // Compute the actual coverage for the banner placeholders. Use
  // approximate year/month/day buckets matching humanizeDuration.ts.
  const years = Math.floor(coveredDays / DAYS_PER_YEAR);
  const monthsRemainder = coveredDays - years * DAYS_PER_YEAR;
  const months = Math.floor(monthsRemainder / 30);

  return {
    errors: [
      {
        messageKey: 'candidate.validation.scope.timeBased',
        placeholders: {
          required: requiredYears,
          requiredYears,
          coveredDays,
          coveredYears: years,
          coveredMonths: months,
        },
      },
    ],
    coveredDays,
    requiredDays,
  };
}
