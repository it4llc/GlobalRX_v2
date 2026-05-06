// /GlobalRX_v2/src/lib/candidate/validation/gapDetection.ts
//
// Phase 7 Stage 1 — gap detection for Address History and Employment History.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 20–26; DoD 11–15)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.3
//
// Pure module. Education History does NOT use this — Rule 20.

import type { DatedEntryLike, GapError } from './types';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Detect gaps in a chronological list of entries.
 *
 * @param entries — entries with { start, end, isCurrent }; null end is
 *                  treated as "ending today" (Rule 23).
 * @param gapToleranceDays — null disables gap checking entirely (Rule 21);
 *                  0 strict; positive integer N flags gaps strictly greater
 *                  than N calendar days.
 * @param today — the live current date for "current" entries and for
 *                clamping. Captured once at runValidation() entry.
 * @param scopePeriodStart — the start of the scope window. When non-null,
 *                gaps entirely outside [scopePeriodStart, today] are
 *                ignored (Rule 24), and the start-of-timeline check
 *                (Rule 26) verifies the earliest entry covers
 *                scopePeriodStart.
 *
 * Output: GapError[] — one entry per detected gap. Empty array means no
 * gaps. The error includes both ISO date strings and a numeric gap-day
 * count so the UI can render localized dates and use the day count for
 * placeholders.
 */
export function detectGaps(
  entries: DatedEntryLike[],
  gapToleranceDays: number | null,
  today: Date,
  scopePeriodStart: Date | null,
): GapError[] {
  // Rule 21 — null tolerance disables gap detection entirely.
  if (gapToleranceDays === null) {
    return [];
  }

  const errors: GapError[] = [];
  const todayMs = today.getTime();
  const scopeStartMs = scopePeriodStart ? scopePeriodStart.getTime() : null;

  // Resolve each entry to a deterministic { startMs, endMs } pair. Skip
  // entries with no start date — those are field-level errors that the
  // caller surfaces separately.
  type ResolvedEntry = { startMs: number; endMs: number; isCurrent: boolean };
  const resolved: ResolvedEntry[] = [];
  for (const entry of entries) {
    if (entry.start === null) continue;
    const startMs = entry.start.getTime();
    let endMs: number;
    if (entry.end === null || entry.isCurrent) {
      endMs = todayMs;
    } else {
      // Clamp future end-dates to today (Edge Case 5).
      endMs = Math.min(entry.end.getTime(), todayMs);
    }
    if (endMs < startMs) continue;
    resolved.push({ startMs, endMs, isCurrent: entry.isCurrent });
  }

  if (resolved.length === 0) {
    return errors;
  }

  // Sort chronologically by start (Rule 22).
  resolved.sort((a, b) => a.startMs - b.startMs);

  // Rule 26 — start-of-timeline gap (only applies when a scope window is
  // defined). If the earliest entry begins after scopePeriodStart, that's
  // a gap from scopePeriodStart to the earliest entry's start.
  if (scopeStartMs !== null) {
    const earliest = resolved[0];
    if (earliest.startMs > scopeStartMs) {
      const gapDays = Math.round(
        (earliest.startMs - scopeStartMs) / MS_PER_DAY,
      );
      // The start-of-timeline check is intentionally NOT subject to the
      // gapToleranceDays threshold — Rule 26 phrases it as a "must go back
      // to" requirement, not a tolerance question.
      errors.push({
        messageKey: 'candidate.validation.gap.startOfTimeline',
        placeholders: {
          gapDays,
          actualStart: msToIsoDate(earliest.startMs),
          requiredStart: msToIsoDate(scopeStartMs),
        },
        gapStart: msToIsoDate(scopeStartMs),
        gapEnd: msToIsoDate(earliest.startMs),
        gapDays,
      });
    }
  }

  // Inter-entry gaps (Rule 22). Track running maximum end so overlapping
  // entries don't generate spurious gaps.
  let runningEnd = resolved[0].endMs;
  for (let i = 1; i < resolved.length; i += 1) {
    const next = resolved[i];
    if (next.startMs <= runningEnd) {
      // Overlap or touching — extend running end, no gap.
      runningEnd = Math.max(runningEnd, next.endMs);
      continue;
    }

    const gapStartMs = runningEnd;
    const gapEndMs = next.startMs;

    // Rule 24 — skip gaps entirely outside the scope window. A gap is "in
    // window" if any part of it overlaps [scopeStartMs, todayMs].
    if (scopeStartMs !== null) {
      if (gapEndMs <= scopeStartMs || gapStartMs >= todayMs) {
        runningEnd = Math.max(runningEnd, next.endMs);
        continue;
      }
    }

    // Compute calendar-day gap. Round to handle DST-style millisecond drift.
    const gapDays = Math.round((gapEndMs - gapStartMs) / MS_PER_DAY);

    // Rule 21 — flag only when gap > tolerance (strict-greater-than).
    if (gapDays > gapToleranceDays) {
      errors.push({
        messageKey: 'candidate.validation.gap.midline',
        placeholders: {
          gapDays,
          tolerance: gapToleranceDays,
        },
        gapStart: msToIsoDate(gapStartMs),
        gapEnd: msToIsoDate(gapEndMs),
        gapDays,
      });
    }

    runningEnd = Math.max(runningEnd, next.endMs);
  }

  return errors;
}

// Convert epoch ms → 'YYYY-MM-DD' string (UTC). Localization happens at the
// translation layer; the engine only ever produces ISO calendar dates.
function msToIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
