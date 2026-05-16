// /GlobalRX_v2/src/components/candidate/__tests__/CandidateSectionErrorFallback.test.tsx
//
// Task 9.1 — Error Boundaries & Loading States (Pass 2 component tests).
//
// Spec: docs/specs/task-9.1-error-boundaries-loading-states.md
//       §"New Files to Create" #1 (CandidateSectionErrorFallback)
//
// The fallback renders a warning card with translated title, message,
// "Try Again" button, and an optional "Skip to Next Step" button. All
// user-facing text is driven by translation keys defined in
// src/translations/en-US.json.
//
// Mocking notes:
//   - The translation context is replaced with a small dictionary-backed
//     translator. Keys that are NOT in the dictionary fall through to
//     identity (with {{placeholder}} substitution applied on top), which
//     mirrors the pattern in SectionErrorBanner.test.tsx. The dictionary
//     intentionally resolves `candidate.error.sectionFailedWithName` to a
//     realistic English string containing the `{{sectionName}}` placeholder
//     so the test for the named-message branch can verify the placeholder
//     is actually substituted into the rendered DOM (not just that the
//     key string appears verbatim).
//   - CandidateSectionErrorFallback itself is the subject and is NOT mocked.
//   - The Button child component renders as its real self because the
//     test asserts on click handlers wired through the Button (Mocking
//     Rule M2 — child rendering is part of the assertion).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { CandidateSectionErrorFallback } from '../CandidateSectionErrorFallback';

// Dictionary of translation keys that this test wants resolved to a
// readable English value. Any key NOT listed here falls through to
// identity (i.e. `t('some.key')` returns `'some.key'`), preserving the
// existing assertion style used by the other tests in this suite that
// check for keys directly in the DOM.
//
// `sectionFailedWithName` is resolved here so the named-message test
// below can verify that the {{sectionName}} placeholder is actually
// substituted by the component — not just that the raw key reaches the
// DOM. The real en-US translation has the same shape.
const translationDictionary: Record<string, string> = {
  'candidate.error.sectionFailedWithName':
    "The {{sectionName}} section couldn't be loaded. Your progress has been saved.",
};

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      const resolved = translationDictionary[key] ?? key;
      if (!params) return resolved;
      let text = resolved;
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replaceAll(`{{${paramKey}}}`, String(paramValue));
      }
      return text;
    },
    language: 'en',
    setLanguage: vi.fn(),
    isLoading: false,
  }),
  TranslationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe('CandidateSectionErrorFallback', () => {
  const baseError = new Error('something blew up');

  describe('rendering', () => {
    it('renders an alert container with the warning icon and title', () => {
      render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={vi.fn()}
        />,
      );

      // The card is wrapped in a role="alert" container so screen readers
      // announce it when it appears.
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveAttribute('aria-live', 'polite');

      // The title comes from a translation key that is NOT in the
      // dictionary, so the identity fallback in the translator returns
      // the key text verbatim. This is the existing assertion style for
      // every other key in this suite.
      expect(
        screen.getByText('candidate.error.sectionFailedTitle'),
      ).toBeInTheDocument();

      // The icon is purely decorative and hidden from screen readers.
      const icon = alert.querySelector('svg[aria-hidden="true"]');
      expect(icon).not.toBeNull();
    });

    it('renders the generic message when no sectionTitle is provided', () => {
      render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={vi.fn()}
        />,
      );

      // Generic-message branch — the component selects the message key
      // based on the presence of sectionTitle. Without one, it must use
      // sectionFailedMessage. The key is NOT in the dictionary so it
      // renders verbatim.
      expect(
        screen.getByText('candidate.error.sectionFailedMessage'),
      ).toBeInTheDocument();

      // The named variant must NOT render in the generic branch. We
      // check both the raw key form and the resolved-string form so a
      // regression that flipped the branch would fail regardless of
      // whether the dictionary lookup succeeded.
      expect(
        screen.queryByText(/sectionFailedWithName/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/section couldn't be loaded/),
      ).not.toBeInTheDocument();
    });

    it('renders the named message with the section title substituted into the placeholder', () => {
      render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={vi.fn()}
          sectionTitle="Address History"
        />,
      );

      // Critical assertion: the dictionary resolves the
      // `sectionFailedWithName` key to an English template containing
      // `{{sectionName}}`. The translator then substitutes the
      // `sectionName` param the component passes through. The rendered
      // DOM must contain the FULLY SUBSTITUTED string — both the
      // surrounding English copy AND the section name in the slot
      // where the placeholder used to be. This is what genuinely proves
      // the component is forwarding `sectionTitle` through the second
      // argument of t(); a regression that dropped the params argument
      // would leave the literal `{{sectionName}}` in the DOM and this
      // assertion would fail.
      expect(
        screen.getByText(
          "The Address History section couldn't be loaded. Your progress has been saved.",
        ),
      ).toBeInTheDocument();

      // Belt-and-suspenders: neither the raw key nor an un-substituted
      // `{{sectionName}}` token may appear anywhere in the DOM.
      expect(
        screen.queryByText(/sectionFailedWithName/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/\{\{sectionName\}\}/),
      ).not.toBeInTheDocument();

      // The generic message key must not be present in the named branch.
      expect(
        screen.queryByText('candidate.error.sectionFailedMessage'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Try Again button', () => {
    it('renders the Try Again button with the translated label', () => {
      render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: 'candidate.error.tryAgain' }),
      ).toBeInTheDocument();
    });

    it('calls resetErrorBoundary when Try Again is clicked', () => {
      const resetErrorBoundary = vi.fn();

      render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={resetErrorBoundary}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'candidate.error.tryAgain' }),
      );

      expect(resetErrorBoundary).toHaveBeenCalledTimes(1);
    });
  });

  describe('Skip to Next Step button', () => {
    it('renders the Skip to Next Step button only when onSkipToNext is provided', () => {
      const { rerender } = render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={vi.fn()}
        />,
      );

      // Without onSkipToNext, the button must be absent.
      expect(
        screen.queryByRole('button', { name: 'candidate.error.skipToNext' }),
      ).not.toBeInTheDocument();

      // With onSkipToNext supplied, the button appears.
      rerender(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={vi.fn()}
          onSkipToNext={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('button', { name: 'candidate.error.skipToNext' }),
      ).toBeInTheDocument();
    });

    it('calls onSkipToNext when the Skip button is clicked', () => {
      const onSkipToNext = vi.fn();

      render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={vi.fn()}
          onSkipToNext={onSkipToNext}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'candidate.error.skipToNext' }),
      );

      expect(onSkipToNext).toHaveBeenCalledTimes(1);
    });

    it('does not call resetErrorBoundary when only Skip is clicked', () => {
      // Two independent handlers — clicking one must not invoke the other.
      const resetErrorBoundary = vi.fn();
      const onSkipToNext = vi.fn();

      render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={resetErrorBoundary}
          onSkipToNext={onSkipToNext}
        />,
      );

      fireEvent.click(
        screen.getByRole('button', { name: 'candidate.error.skipToNext' }),
      );

      expect(onSkipToNext).toHaveBeenCalledTimes(1);
      expect(resetErrorBoundary).not.toHaveBeenCalled();
    });
  });

  describe('error prop handling', () => {
    it('does not render the raw error message to the candidate', () => {
      // The spec is explicit that raw error details must not be surfaced
      // to the candidate (could leak implementation detail). This test
      // verifies that the error message string does not appear in the DOM.
      const sensitiveError = new Error('TypeError: cannot read property foo of undefined');

      render(
        <CandidateSectionErrorFallback
          error={sensitiveError}
          resetErrorBoundary={vi.fn()}
        />,
      );

      expect(
        screen.queryByText(/cannot read property/),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText(/TypeError/),
      ).not.toBeInTheDocument();
    });
  });

  describe('translation-driven text', () => {
    it('drives every visible text node from a translation key', () => {
      // All visible text must come from a translation key (Component
      // Standards §6.1). The identity branch of the translator returns
      // the key when no dictionary entry matches and no params are
      // passed, so every rendered string starts with `candidate.error.`
      // if it came from a translation key.
      render(
        <CandidateSectionErrorFallback
          error={baseError}
          resetErrorBoundary={vi.fn()}
          onSkipToNext={vi.fn()}
        />,
      );

      // The four visible strings: title, message, Try Again, Skip.
      expect(
        screen.getByText('candidate.error.sectionFailedTitle'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('candidate.error.sectionFailedMessage'),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'candidate.error.tryAgain' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'candidate.error.skipToNext' }),
      ).toBeInTheDocument();
    });
  });
});
