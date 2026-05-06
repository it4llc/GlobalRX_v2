// /GlobalRX_v2/src/lib/candidate/validation/humanizeDuration.ts
//
// Phase 7 Stage 1 — convert a number of days into the placeholder values
// translation keys consume (e.g. "Your entries cover {years} years,
// {months} months, {days} days").
//
// We deliberately do NOT compose human-readable strings here; the
// translation layer handles plurals, ordering, and locale formatting.
// This helper outputs plain integer counts.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rule 15 — banner shows both required period and actual
//                  coverage)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.5
//
// Calendar approximations:
//   We use the same conventions as the spec's example wording
//   ("3 years, 4 months out of 7 years"):
//     - 1 year   = 365 days
//     - 1 month  = 30 days
//   These approximations match the way candidates and customers think about
//   coverage in plain English. They are NOT used for date arithmetic — only
//   for converting an already-computed total day count into "buckets" for
//   display.

const DAYS_PER_YEAR = 365;
const DAYS_PER_MONTH = 30;

/**
 * Convert an integer day count into approximate { years, months, days }
 * components for translation-key placeholders.
 *
 * Negative inputs are clamped to zero so the output is always non-negative
 * integers. Fractional inputs are floored.
 */
export function daysToHumanParts(days: number): {
  years: number;
  months: number;
  days: number;
} {
  // Clamp negatives and fractional inputs to non-negative integers so the
  // output never breaks downstream consumers who format these as plain
  // counts.
  const safeDays = Math.max(0, Math.floor(days));

  const years = Math.floor(safeDays / DAYS_PER_YEAR);
  const remainderAfterYears = safeDays - years * DAYS_PER_YEAR;

  const months = Math.floor(remainderAfterYears / DAYS_PER_MONTH);
  const remainderAfterMonths = remainderAfterYears - months * DAYS_PER_MONTH;

  return {
    years,
    months,
    days: remainderAfterMonths,
  };
}
