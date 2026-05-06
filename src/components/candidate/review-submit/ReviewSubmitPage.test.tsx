// /GlobalRX_v2/src/components/candidate/review-submit/ReviewSubmitPage.test.tsx
//
// Phase 7 Stage 1 — Pass 2 component tests for ReviewSubmitPage.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 29, 30, 31, 32, 33)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #12
//
// Per Mocking Rule M2 the child components ReviewSectionBlock,
// ReviewErrorListItem, and SectionProgressIndicator are NOT mocked — the
// tests below assert on the real rendered section DOM, the real status
// indicators, and the real tappable error buttons.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ReviewSubmitPage } from './ReviewSubmitPage';
import type { FullValidationResult } from '@/lib/candidate/validation/types';

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

const buildValidationResult = (): FullValidationResult => ({
  sections: [],
  summary: {
    sections: [
      {
        sectionId: 'personal_info',
        sectionName: 'Personal Information',
        status: 'complete',
        errors: [],
      },
      {
        sectionId: 'address_history',
        sectionName: 'Address History',
        status: 'incomplete',
        errors: [
          {
            kind: 'scope',
            messageKey: 'candidate.validation.scope.countSpecific',
            placeholders: { required: 2, actual: 1 },
          },
          {
            kind: 'gap',
            messageKey: 'candidate.validation.gap.midline',
            placeholders: {
              gapStart: 'A',
              gapEnd: 'B',
              gapDays: 92,
              tolerance: 30,
            },
            gapStart: '2023-03-01',
            gapEnd: '2023-06-01',
          },
        ],
      },
      {
        sectionId: 'service_verification-edu',
        sectionName: 'Education',
        status: 'not_started',
        errors: [],
      },
    ],
    allComplete: false,
    totalErrors: 2,
  },
});

describe('ReviewSubmitPage', () => {
  describe('header — Rule 29', () => {
    it('renders the title heading', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('heading', { name: 'candidate.reviewSubmit.title' }),
      ).toBeInTheDocument();
    });

    it('renders the intro text', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      expect(
        screen.getByText('candidate.reviewSubmit.intro'),
      ).toBeInTheDocument();
    });
  });

  describe('null validation result (still loading)', () => {
    it('renders header + submit button without crashing when validationResult is null', () => {
      render(
        <ReviewSubmitPage
          validationResult={null}
          onErrorNavigate={vi.fn()}
        />,
      );

      // Header still rendered.
      expect(
        screen.getByRole('heading', { name: 'candidate.reviewSubmit.title' }),
      ).toBeInTheDocument();
      // Submit button still rendered (always disabled in Stage 1).
      expect(
        screen.getByRole('button', { name: 'candidate.reviewSubmit.submit' }),
      ).toBeInTheDocument();
    });

    it('renders zero section blocks when validationResult is null', () => {
      render(
        <ReviewSubmitPage
          validationResult={null}
          onErrorNavigate={vi.fn()}
        />,
      );

      // Section blocks emit headings — none should exist when validationResult
      // is null (the only heading is the page title).
      const headings = screen.getAllByRole('heading');
      // Only the H2 page title is present.
      expect(headings).toHaveLength(1);
      expect(headings[0].tagName).toBe('H2');
    });
  });

  describe('section blocks — Rules 30, 32', () => {
    it('renders one section block per summary.sections entry', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('heading', { name: 'Personal Information' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Address History' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Education' }),
      ).toBeInTheDocument();
    });

    it('renders the real SectionProgressIndicator for each section status', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      // Three indicators — one per section. Per Mocking Rule M2 the indicator
      // is NOT mocked; the test asserts on its real data-status attribute so
      // a regression in the section-block→indicator wiring would be caught.
      const indicators = screen.getAllByTestId('section-progress-indicator');
      expect(indicators).toHaveLength(3);
      expect(indicators[0].getAttribute('data-status')).toBe('complete');
      expect(indicators[1].getAttribute('data-status')).toBe('incomplete');
      expect(indicators[2].getAttribute('data-status')).toBe('not_started');
    });

    it('renders "Complete" text on a green section with no errors (Rule 30)', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      // Personal Information is complete with no errors → "Complete" text.
      expect(
        screen.getByText('candidate.reviewSubmit.sectionComplete'),
      ).toBeInTheDocument();
    });

    it('renders the error list items for incomplete sections', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      // Address History contains 2 errors, each rendered as a tappable button.
      // Per Mocking Rule M2 the ReviewErrorListItem is NOT mocked; we assert
      // on the real rendered button DOM.
      expect(
        screen.getByRole('button', {
          name: /candidate\.validation\.scope\.countSpecific/,
        }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {
          name: /candidate\.validation\.gap\.midline/,
        }),
      ).toBeInTheDocument();
    });
  });

  describe('navigation — Rule 31 (tappable errors)', () => {
    it('calls onErrorNavigate with the section id and error when an error is tapped', () => {
      const handleNavigate = vi.fn();
      const validationResult = buildValidationResult();

      render(
        <ReviewSubmitPage
          validationResult={validationResult}
          onErrorNavigate={handleNavigate}
        />,
      );

      const scopeButton = screen.getByRole('button', {
        name: /candidate\.validation\.scope\.countSpecific/,
      });
      fireEvent.click(scopeButton);

      expect(handleNavigate).toHaveBeenCalledTimes(1);
      expect(handleNavigate).toHaveBeenCalledWith(
        'address_history',
        validationResult.summary.sections[1].errors[0],
      );
    });
  });

  describe('Submit button — Rule 33', () => {
    it('renders the Submit button as disabled', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitBtn).toBeDisabled();
      expect(submitBtn.getAttribute('aria-disabled')).toBe('true');
    });

    it('renders the static submit-help text below the button (Rule 33)', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      // The translation KEY for the help text is
      // `candidate.reviewSubmit.submitHelp`. Looking up its English value in
      // src/translations/en-US.json shows:
      //   "Submit will be available once all sections are complete."
      // (we assert on the key here because the test mocks the translator to
      // return the key — DoD 25 / Rule 36 verifies the actual English text
      // at the translation-file level, which we cover separately below.)
      expect(
        screen.getByText('candidate.reviewSubmit.submitHelp'),
      ).toBeInTheDocument();
    });

    it('renders the Submit button as disabled even when all sections are complete', () => {
      const allCompleteResult: FullValidationResult = {
        sections: [],
        summary: {
          sections: [
            {
              sectionId: 'personal_info',
              sectionName: 'Personal Information',
              status: 'complete',
              errors: [],
            },
          ],
          allComplete: true,
          totalErrors: 0,
        },
      };

      render(
        <ReviewSubmitPage
          validationResult={allCompleteResult}
          onErrorNavigate={vi.fn()}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      // Stage 1 spec: button is ALWAYS disabled, regardless of completeness.
      expect(submitBtn).toBeDisabled();
    });
  });

  describe('translation files — DoD 25 / Rule 36', () => {
    // These tests confirm the actual English strings are present in en-US,
    // proving the help text reads "Submit will be available once all sections
    // are complete." per Rule 33 / DoD 22. Other locales are covered by the
    // Pass 1 schema tests but we sanity-check en-US here since this test
    // file owns the Rule 33 surface.
    it('en-US contains the exact submit-help text required by Rule 33', async () => {
      const enUS = (await import('@/translations/en-US.json')).default as Record<
        string,
        string
      >;

      expect(enUS['candidate.reviewSubmit.submitHelp']).toBe(
        'Submit will be available once all sections are complete.',
      );
    });
  });
});
