// /GlobalRX_v2/src/lib/candidate/validation/__tests__/fieldFormatValidation.test.ts
// Pass 1 unit tests for Phase 7 Stage 1:
// Field-format validators for optional fields containing badly formatted content.
//
// These tests will FAIL when first run because the helpers do not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md
//
// Coverage:
//   - Spec Rule 5:   Optional field with bad-format content shows a format-specific
//                    message ("Please enter a valid email address," etc.). Empty
//                    optional fields never show errors.
//   - Spec Edge 16:  Optional field with bad-format content but section never visited.
//                    No error shown until visited+departed (UI concern; engine still
//                    emits the error, UI gates the display).
//   - DoD 4:         Optional-field format errors appear after section departure.
//   - DoD 5:         Empty optional fields never show errors.

import { describe, it, expect } from 'vitest';

import {
  validateFieldFormat,
  buildFormatErrorKey,
} from '../fieldFormatValidation';

// ---------------------------------------------------------------------------
// validateFieldFormat — true when valid, false when invalid
// ---------------------------------------------------------------------------

describe('validateFieldFormat', () => {
  describe('email', () => {
    it('returns true for a well-formed email', () => {
      expect(validateFieldFormat('email', 'test@example.com')).toBe(true);
    });

    it('returns true for an email with subdomain', () => {
      expect(validateFieldFormat('email', 'jane.doe@mail.example.co.uk')).toBe(true);
    });

    it('returns false for a string with no @', () => {
      expect(validateFieldFormat('email', 'not-an-email')).toBe(false);
    });

    it('returns false for a string with no domain', () => {
      expect(validateFieldFormat('email', 'user@')).toBe(false);
    });

    it('returns false for a string with no local part', () => {
      expect(validateFieldFormat('email', '@example.com')).toBe(false);
    });
  });

  describe('phone', () => {
    it('returns true for a plausible international format with +', () => {
      expect(validateFieldFormat('phone', '+1 555 123 4567')).toBe(true);
    });

    it('returns true for a plausible domestic format with hyphens', () => {
      expect(validateFieldFormat('phone', '555-123-4567')).toBe(true);
    });

    it('returns false when the phone field contains letters', () => {
      expect(validateFieldFormat('phone', 'abc-def-ghij')).toBe(false);
    });

    it('returns false when the phone field is too short', () => {
      expect(validateFieldFormat('phone', '12')).toBe(false);
    });
  });

  describe('date', () => {
    it('returns true for an ISO 8601 calendar date', () => {
      expect(validateFieldFormat('date', '1990-06-15')).toBe(true);
    });

    it('returns false for a non-date string', () => {
      expect(validateFieldFormat('date', 'not-a-date')).toBe(false);
    });

    it('returns false for an obviously invalid calendar date', () => {
      expect(validateFieldFormat('date', '2025-13-40')).toBe(false);
    });
  });

  describe('url', () => {
    it('returns true for an http URL', () => {
      expect(validateFieldFormat('url', 'http://example.com')).toBe(true);
    });

    it('returns true for an https URL with path', () => {
      expect(validateFieldFormat('url', 'https://example.com/about')).toBe(true);
    });

    it('returns false for a string that is not a URL', () => {
      expect(validateFieldFormat('url', 'plain text')).toBe(false);
    });
  });

  describe('numeric', () => {
    it('returns true for an integer string', () => {
      expect(validateFieldFormat('numeric', '12345')).toBe(true);
    });

    it('returns true for a decimal string', () => {
      expect(validateFieldFormat('numeric', '12.5')).toBe(true);
    });

    it('returns false for a string with letters', () => {
      expect(validateFieldFormat('numeric', '12a')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// buildFormatErrorKey — translation key for each format
// ---------------------------------------------------------------------------

describe('buildFormatErrorKey', () => {
  it('returns the email translation key', () => {
    expect(buildFormatErrorKey('email')).toBe(
      'candidate.validation.format.email'
    );
  });

  it('returns the phone translation key', () => {
    expect(buildFormatErrorKey('phone')).toBe(
      'candidate.validation.format.phone'
    );
  });

  it('returns the date translation key', () => {
    expect(buildFormatErrorKey('date')).toBe(
      'candidate.validation.format.date'
    );
  });

  it('returns the url translation key', () => {
    expect(buildFormatErrorKey('url')).toBe(
      'candidate.validation.format.url'
    );
  });

  it('returns the numeric translation key', () => {
    expect(buildFormatErrorKey('numeric')).toBe(
      'candidate.validation.format.numeric'
    );
  });

  it('returns a translation key (string), never an English literal', () => {
    // Per Spec Rule 36 — all error message strings must be translation keys.
    const key = buildFormatErrorKey('email');

    expect(key).toMatch(/^candidate\.validation\.format\./);
    expect(key).not.toMatch(/please/i);
  });
});
