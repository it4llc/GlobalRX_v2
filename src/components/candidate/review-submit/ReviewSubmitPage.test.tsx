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

import { ReviewSubmitPage } from '@/components/candidate/review-submit/ReviewSubmitPage';
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

  // ===========================================================================
  // Task 8.2 (Linear Step Navigation) — Pass 2 tests for the optional
  // onBack prop and the rendered review-back-button. ReviewSubmitPage is
  // the SUBJECT of these tests and is therefore NOT mocked (Rule M1).
  // The translation mock is the only mock; the child components
  // (ReviewSectionBlock / ReviewErrorListItem / SectionProgressIndicator)
  // are NOT mocked per the file's existing pattern (Rule M2).
  //
  // Spec: docs/specs/linear-step-navigation.md — Business Rule 5, 12, 13;
  //       Definition of Done 5, 10, 12.
  // ===========================================================================
  describe('Back button (Task 8.2 — Linear Step Navigation)', () => {
    it('Business Rule 5: does NOT render a Back button when onBack is omitted (backwards compat for older fixtures)', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
        />,
      );

      expect(
        screen.queryByTestId('review-back-button'),
      ).not.toBeInTheDocument();
    });

    it('Business Rule 5 / DoD 5: renders the review-back-button when onBack is supplied', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      expect(screen.getByTestId('review-back-button')).toBeInTheDocument();
    });

    it('Business Rule 5 / DoD 5: clicking the Back button invokes the onBack callback exactly once', () => {
      const onBack = vi.fn();

      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
          onBack={onBack}
        />,
      );

      fireEvent.click(screen.getByTestId('review-back-button'));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('Business Rule 13 / DoD 12: Back button label uses the candidate.navigation.back translation key', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const backButton = screen.getByTestId('review-back-button');
      // The translation mock returns the key as the value when no
      // placeholders are supplied, so the rendered text equals the key.
      expect(backButton).toHaveTextContent('candidate.navigation.back');
    });

    it('Business Rule 12 / DoD 10: Back button has min-h-[44px] for mobile tap targets', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const backButton = screen.getByTestId('review-back-button');
      expect(backButton).toHaveClass('min-h-[44px]');
    });

    it('Business Rule 3: Back button uses the secondary/outline palette (white background + gray border)', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const backButton = screen.getByTestId('review-back-button');
      expect(backButton).toHaveClass('bg-white');
      expect(backButton).toHaveClass('border');
      expect(backButton).toHaveClass('border-gray-300');
      expect(backButton).toHaveClass('text-gray-700');
    });

    it('Back button has type="button" so it cannot accidentally trigger a form submit', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      const backButton = screen.getByTestId('review-back-button');
      expect(backButton).toHaveAttribute('type', 'button');
    });

    it('Business Rule 5: Back button is rendered in the SAME row as Submit (its parent contains the Submit button too)', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
          onBack={vi.fn()}
        />,
      );

      // The Back button and the Submit button share a parent flex
      // container per spec rule 5. We verify this by walking up from
      // each button and checking they end up at the same parent element.
      const backButton = screen.getByTestId('review-back-button');
      const submitButton = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });

      expect(backButton.parentElement).toBe(submitButton.parentElement);
      // And that shared row uses flex layout (mobile-first stacking with
      // sm:flex-row on wide screens — spec rule 5).
      expect(backButton.parentElement).toHaveClass('flex');
      expect(backButton.parentElement).toHaveClass('flex-col-reverse');
      expect(backButton.parentElement).toHaveClass('sm:flex-row');
    });

    it('Back button is independent of Submit-button state (still renders when Submit is disabled)', () => {
      // Submit is disabled when validationResult.summary.allComplete is
      // false. Back must remain rendered and clickable regardless.
      const onBack = vi.fn();
      render(
        <ReviewSubmitPage
          validationResult={buildValidationResult()}
          onErrorNavigate={vi.fn()}
          onBack={onBack}
        />,
      );

      const submitButton = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitButton).toBeDisabled();

      const backButton = screen.getByTestId('review-back-button');
      expect(backButton).toBeInTheDocument();
      // Back is NOT disabled — it always works on the Review page.
      expect(backButton).not.toBeDisabled();

      fireEvent.click(backButton);
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('translation files — Task 8.2 DoD 12', () => {
    it('en-US contains the Next translation for candidate.navigation.next', async () => {
      const enUS = (await import('@/translations/en-US.json')).default as Record<
        string,
        string
      >;

      expect(enUS['candidate.navigation.next']).toBe('Next');
    });

    it('en-US contains the Back translation for candidate.navigation.back', async () => {
      const enUS = (await import('@/translations/en-US.json')).default as Record<
        string,
        string
      >;

      expect(enUS['candidate.navigation.back']).toBe('Back');
    });
  });

  // ===========================================================================
  // Task 8.5 (Silent Recalculation and Step Skipping) — Pass 2 tests for the
  // optional `disableSubmit` prop. ReviewSubmitPage is the SUBJECT (Rule M1
  // — NOT mocked). The child blocks (ReviewSectionBlock / ReviewErrorListItem
  // / SectionProgressIndicator) are NOT mocked per Rule M2; only the
  // TranslationContext is mocked at the file's module-scope above.
  //
  // Spec:  docs/specs/silent-recalculation-step-skipping.md
  //        Business Rule 9 d (newly-visible-but-incomplete step blocks Submit)
  // Plan:  docs/plans/silent-recalculation-step-skipping-technical-plan.md §5.3
  // ===========================================================================
  describe('disableSubmit prop (Task 8.5 — Silent Recalculation and Step Skipping)', () => {
    // Validation result where the engine reports allComplete=true. Without
    // `disableSubmit` and with `onSubmit` wired, the Submit button is
    // enabled. With `disableSubmit={true}` the button is forced disabled.
    const buildAllCompleteResult = (): FullValidationResult => ({
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
    });

    it('BR 9d: disableSubmit={true} forces the Submit button DISABLED even when allComplete is true and onSubmit is wired', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildAllCompleteResult()}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
          disableSubmit={true}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitBtn).toBeDisabled();
    });

    it('BR 9d: disableSubmit={true} sets aria-disabled="true" on the Submit button', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildAllCompleteResult()}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
          disableSubmit={true}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitBtn.getAttribute('aria-disabled')).toBe('true');
    });

    it('BR 9d: clicking the Submit button while disableSubmit={true} does NOT invoke onSubmit', () => {
      const onSubmit = vi.fn();
      render(
        <ReviewSubmitPage
          validationResult={buildAllCompleteResult()}
          onErrorNavigate={vi.fn()}
          onSubmit={onSubmit}
          disableSubmit={true}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      // Native disabled buttons don't fire click events in browsers; jsdom
      // mirrors that behavior. A fire-and-check confirms that no handler
      // runs when the button is disabled via the `disableSubmit` path.
      fireEvent.click(submitBtn);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('disableSubmit defaults to false — when omitted, the button is ENABLED if everything else allows it (backwards compatible)', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildAllCompleteResult()}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
          // disableSubmit intentionally omitted
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitBtn).not.toBeDisabled();
      expect(submitBtn.getAttribute('aria-disabled')).toBe('false');
    });

    it('disableSubmit={false} explicitly — the button is ENABLED if everything else allows it', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildAllCompleteResult()}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
          disableSubmit={false}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitBtn).not.toBeDisabled();
    });

    it('disableSubmit composes with the existing disabled conditions — both allComplete=false AND disableSubmit=true keep the button disabled', () => {
      // The result has allComplete=false; the button would already be
      // disabled. disableSubmit=true must NOT relax that — it stays
      // disabled. (Most-restrictive wins.)
      const incompleteResult: FullValidationResult = {
        sections: [],
        summary: {
          sections: [
            {
              sectionId: 'personal_info',
              sectionName: 'Personal Information',
              status: 'incomplete',
              errors: [],
            },
          ],
          allComplete: false,
          totalErrors: 0,
        },
      };

      render(
        <ReviewSubmitPage
          validationResult={incompleteResult}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
          disableSubmit={true}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitBtn).toBeDisabled();
    });

    it('disableSubmit={true} applies the disabled class palette (muted gray)', () => {
      render(
        <ReviewSubmitPage
          validationResult={buildAllCompleteResult()}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
          disableSubmit={true}
        />,
      );

      const submitBtn = screen.getByRole('button', {
        name: 'candidate.reviewSubmit.submit',
      });
      expect(submitBtn).toHaveClass('bg-gray-300');
      expect(submitBtn).toHaveClass('cursor-not-allowed');
      expect(submitBtn).not.toHaveClass('bg-blue-600');
    });

    it('disableSubmit={true} does NOT affect the Back button — it is still rendered and clickable', () => {
      const onBack = vi.fn();

      render(
        <ReviewSubmitPage
          validationResult={buildAllCompleteResult()}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
          onBack={onBack}
          disableSubmit={true}
        />,
      );

      const backButton = screen.getByTestId('review-back-button');
      expect(backButton).toBeInTheDocument();
      expect(backButton).not.toBeDisabled();

      fireEvent.click(backButton);
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('REGRESSION TEST: descriptor `status` overrides the validation summary (Bug fix Issue 2)', () => {
      // Cross-section-validation-filtering bug fix Issue 2 — Record Search has
      // no server-side validator (Task 8.4 plan §4.8), so its entry is absent
      // from `validationResult.summary.sections`. Before the fix, ReviewSubmit
      // fell back to 'not_started' and rendered grey for record_search even
      // though the sidebar — driven by the shell's merged `sectionsWithStatus`
      // — was correctly showing it complete. Passing the merged status through
      // the descriptor makes Review & Submit consume the same authoritative
      // signal.
      const validationResult: FullValidationResult = {
        sections: [],
        summary: {
          sections: [
            // address_history present, record_search ABSENT (matches the
            // engine's real behavior post-Task-8.4).
            {
              sectionId: 'address_history',
              sectionName: 'address_history',
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
          validationResult={validationResult}
          sections={[
            { id: 'address_history', title: 'Address History', status: 'complete' },
            { id: 'record_search', title: 'Record Search', status: 'complete' },
          ]}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );

      const indicators = screen.getAllByTestId('section-progress-indicator');
      // address_history — complete from summary
      expect(indicators[0].getAttribute('data-status')).toBe('complete');
      // record_search — complete from the descriptor's pre-merged status,
      // NOT 'not_started' from the absent summary entry.
      expect(indicators[1].getAttribute('data-status')).toBe('complete');
    });

    it('REGRESSION TEST: descriptor `status` propagates "incomplete" for sections without validator entries', () => {
      // The post-merge override in portal-layout flags Record Search as
      // `incomplete` when the candidate visits and departs without filling
      // anything. The descriptor must carry that signal to Review & Submit
      // so the icon matches the sidebar.
      const validationResult: FullValidationResult = {
        sections: [],
        summary: {
          sections: [],
          allComplete: false,
          totalErrors: 0,
        },
      };

      render(
        <ReviewSubmitPage
          validationResult={validationResult}
          sections={[
            { id: 'record_search', title: 'Record Search', status: 'incomplete' },
          ]}
          onErrorNavigate={vi.fn()}
        />,
      );

      const indicators = screen.getAllByTestId('section-progress-indicator');
      expect(indicators[0].getAttribute('data-status')).toBe('incomplete');
    });

    it('falls back to the validation summary status when descriptor.status is omitted', () => {
      const validationResult: FullValidationResult = {
        sections: [],
        summary: {
          sections: [
            {
              sectionId: 'personal_info',
              sectionName: 'Personal Information',
              status: 'incomplete',
              errors: [],
            },
          ],
          allComplete: false,
          totalErrors: 0,
        },
      };

      render(
        <ReviewSubmitPage
          validationResult={validationResult}
          sections={[
            // No `status` provided on the descriptor.
            { id: 'personal_info', title: 'Personal Information' },
          ]}
          onErrorNavigate={vi.fn()}
        />,
      );

      const indicators = screen.getAllByTestId('section-progress-indicator');
      expect(indicators[0].getAttribute('data-status')).toBe('incomplete');
    });

    it('disableSubmit={true} does NOT affect the section list rendering', () => {
      const validationResult: FullValidationResult = {
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
          validationResult={validationResult}
          onErrorNavigate={vi.fn()}
          onSubmit={vi.fn()}
          disableSubmit={true}
        />,
      );

      // Section blocks render via real ReviewSectionBlock (Rule M2 — NOT
      // mocked). Both section headings still appear regardless of the
      // disableSubmit prop.
      expect(
        screen.getByRole('heading', { name: 'Personal Information' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: 'Address History' }),
      ).toBeInTheDocument();
    });
  });
});
