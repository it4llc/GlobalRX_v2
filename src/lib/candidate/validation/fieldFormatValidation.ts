// /GlobalRX_v2/src/lib/candidate/validation/fieldFormatValidation.ts
//
// Phase 7 Stage 1 — format-validators for optional fields containing
// badly-formatted content. Empty optional fields never produce errors;
// these helpers only flag fields that have a value but the value isn't a
// well-formed instance of its declared format.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rule 5, Rule 36, Edge 16, DoD 4–5)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §2.4
//
// Each validator returns `true` when the value is valid for the format and
// `false` when invalid. They never throw. They never log.

import type { FieldFormat, FieldLike } from './types';

// ---------------------------------------------------------------------------
// Format inference (conservative)
// ---------------------------------------------------------------------------

/**
 * Infer a FieldFormat from a field's `type` or `fieldData.format` metadata,
 * or return null if the field's format cannot be determined. Conservative
 * by design — we'd rather skip a check than emit a wrong format error.
 */
export function inferFieldFormat(field: FieldLike): FieldFormat | null {
  // `type` is the DSXRequirement.type column. Accept the obvious matches.
  const typeNorm = (field.type ?? '').toLowerCase();
  if (typeNorm === 'email') return 'email';
  if (typeNorm === 'phone' || typeNorm === 'tel') return 'phone';
  if (typeNorm === 'date') return 'date';
  if (typeNorm === 'url') return 'url';
  if (typeNorm === 'numeric' || typeNorm === 'number') return 'numeric';

  // `fieldData.format` is a free-form hint. Accept the same values.
  const fmt = (field.fieldData?.format ?? '').toLowerCase();
  if (fmt === 'email') return 'email';
  if (fmt === 'phone' || fmt === 'tel') return 'phone';
  if (fmt === 'date') return 'date';
  if (fmt === 'url') return 'url';
  if (fmt === 'numeric' || fmt === 'number') return 'numeric';

  return null;
}

// ---------------------------------------------------------------------------
// validateFieldFormat — true when valid, false when invalid
// ---------------------------------------------------------------------------

// Lightweight regex patterns. We intentionally do NOT pull in a full
// validation library here because the only consumer is candidate-portal
// optional-field error display, where false positives matter more than
// nuance — a well-formed string should always pass, and obviously
// malformed strings should always fail. Borderline cases are accepted
// rather than flagged.

// RFC-5321-ish: requires "<local>@<domain>.<tld>" with no spaces.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// At least 7 digits in the string (after stripping common separators) is the
// rough lower bound for an internationally-meaningful phone number. We allow
// '+', spaces, parentheses, hyphens, and dots as separators.
const PHONE_ALLOWED_CHARS_REGEX = /^[\s\d+().\-]+$/;
// ISO 8601 calendar date — YYYY-MM-DD. The regex catches obvious trash; the
// follow-up Date.parse check rejects calendar-impossible dates like 2025-13-40.
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
// http(s) URL with at least one '.' in the host part.
const URL_REGEX = /^https?:\/\/[^\s.]+\.[^\s]+$/i;
// Optional sign, digits, optional decimal point with more digits.
const NUMERIC_REGEX = /^-?\d+(\.\d+)?$/;

export function validateFieldFormat(
  format: FieldFormat,
  value: unknown,
): boolean {
  // Validators only run on non-empty values. The caller is responsible for
  // skipping empty optional fields (Spec Rule 5).
  if (typeof value !== 'string') {
    // Numeric-typed fields are sometimes saved as numbers, not strings.
    // Allow that one case through; everything else of non-string type
    // can't be a "badly-formatted text input" by definition.
    if (format === 'numeric' && typeof value === 'number') {
      return Number.isFinite(value);
    }
    return false;
  }

  // Empty strings are treated as "no value" by the caller; if we still see
  // one here, it's a defensive check. Treat as invalid because the caller
  // would only pass an empty string when something has gone wrong.
  if (value.trim().length === 0) {
    return false;
  }

  switch (format) {
    case 'email':
      return EMAIL_REGEX.test(value);

    case 'phone': {
      if (!PHONE_ALLOWED_CHARS_REGEX.test(value)) return false;
      // Strip non-digits and require at least 7 digits — short enough to
      // accept emergency-services-style numbers, long enough to reject
      // obvious garbage like "12".
      const digitsOnly = value.replace(/\D/g, '');
      return digitsOnly.length >= 7;
    }

    case 'date': {
      if (!ISO_DATE_REGEX.test(value)) return false;
      // Reject calendar-impossible dates (month/day overflow). Date.parse
      // returning NaN means "no valid date" — but JS happily reinterprets
      // some bad input as later months, so we additionally check that the
      // round-tripped year/month/day matches the input.
      const parsed = new Date(value + 'T00:00:00Z');
      if (Number.isNaN(parsed.getTime())) return false;
      const [yyyy, mm, dd] = value.split('-').map((p) => parseInt(p, 10));
      return (
        parsed.getUTCFullYear() === yyyy &&
        parsed.getUTCMonth() + 1 === mm &&
        parsed.getUTCDate() === dd
      );
    }

    case 'url':
      return URL_REGEX.test(value);

    case 'numeric':
      return NUMERIC_REGEX.test(value);

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// buildFormatErrorKey — translation key for each format
// ---------------------------------------------------------------------------

/**
 * Translation key for a given format's "Please enter a valid ___" message.
 * Spec Rule 36 — every error string must come from a translation key, never
 * an inline English literal.
 */
export function buildFormatErrorKey(format: FieldFormat): string {
  return `candidate.validation.format.${format}`;
}
