// /GlobalRX_v2/src/components/candidate/FieldErrorMessage.test.tsx
//
// Phase 7 Stage 1 — Pass 2 component tests for FieldErrorMessage.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 4, 5, 6, 7)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #11

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { FieldErrorMessage } from './FieldErrorMessage';

// Translation context: identity-with-placeholders translator. Returns the
// translation key by default; when placeholders are supplied, mirrors the
// real TranslationContext's `{{key}}` substitution so tests that pass
// placeholders can assert on the substituted output.
vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (!params) return key;
      let text = key;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replaceAll(`{{${paramKey}}}`, String(paramValue));
      }
      return text;
    },
  }),
}));

describe('FieldErrorMessage', () => {
  describe('rendering', () => {
    it('renders the translated message text via the messageKey prop (Rule 4)', () => {
      render(
        <FieldErrorMessage messageKey="candidate.validation.field.required" />,
      );

      // With identity translator the rendered text is the translation key.
      expect(
        screen.getByText('candidate.validation.field.required'),
      ).toBeInTheDocument();
    });

    it('renders a format-specific message when given a format key (Rule 5)', () => {
      render(
        <FieldErrorMessage messageKey="candidate.validation.format.email" />,
      );

      expect(
        screen.getByText('candidate.validation.format.email'),
      ).toBeInTheDocument();
    });

    it('substitutes placeholders into the message text', () => {
      render(
        <FieldErrorMessage
          messageKey="Min length is {{min}}"
          placeholders={{ min: 5 }}
        />,
      );

      expect(screen.getByText('Min length is 5')).toBeInTheDocument();
    });

    it('uses role="alert" so screen readers announce field errors immediately', () => {
      render(
        <FieldErrorMessage messageKey="candidate.validation.field.required" />,
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
    });
  });

  describe('id wiring for screen-reader hookup', () => {
    it('builds an id derived from fieldName when provided', () => {
      render(
        <FieldErrorMessage
          messageKey="candidate.validation.field.required"
          fieldName="emailAddress"
        />,
      );

      const alert = screen.getByRole('alert');
      expect(alert.getAttribute('id')).toBe('emailAddress-error');
    });

    it('omits the id attribute when fieldName is not provided', () => {
      render(
        <FieldErrorMessage messageKey="candidate.validation.field.required" />,
      );

      const alert = screen.getByRole('alert');
      expect(alert.hasAttribute('id')).toBe(false);
    });
  });

  describe('styling — DoD 28 (mobile-first, readable text)', () => {
    it('uses red text color via the form-error class', () => {
      render(
        <FieldErrorMessage messageKey="candidate.validation.field.required" />,
      );

      const alert = screen.getByRole('alert');
      expect(alert.className).toContain('form-error');
      expect(alert.className).toContain('text-red-700');
    });
  });
});
