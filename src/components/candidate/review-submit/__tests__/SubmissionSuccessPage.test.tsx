// /GlobalRX_v2/src/components/candidate/review-submit/__tests__/SubmissionSuccessPage.test.tsx
//
// Phase 7 Stage 2 — Pass 2 component tests for SubmissionSuccessPage.
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
//                 Rule 17 (success page contents and constraints) / DoD 19, 20
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §7.4 / §18
//
// What this file covers:
//   - Renders all four documented translation keys (title, message, whatNext, nextSteps).
//   - Has no back-navigation affordances: no <a>, no <button>, no [role=link].
//   - Renders the page-level testid the parent route uses for placement checks.
//
// Mocking discipline:
//   - Rule M1: We do NOT mock SubmissionSuccessPage.
//   - Rule M2: There are no child components whose rendered DOM we mock out.
//     The decorative SVG is part of the component itself; assertions don't
//     depend on it.
//   - Rule M3: TranslationContext is module-level state. We provide a minimal
//     inline factory to override the global setup mock so we can assert on
//     the EXACT translation keys requested rather than the dictionary's
//     possibly stale mappings.

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SubmissionSuccessPage } from '../SubmissionSuccessPage';

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: () => ({
    // Return the key verbatim — assertions confirm the component asked for
    // exactly the four documented keys.
    t: (key: string) => key,
    language: 'en',
    setLanguage: vi.fn(),
    isLoading: false,
  }),
}));

describe('SubmissionSuccessPage', () => {
  describe('translation keys', () => {
    it('renders the title key candidate.submission.success.title', () => {
      render(<SubmissionSuccessPage />);

      expect(
        screen.getByRole('heading', {
          name: 'candidate.submission.success.title',
        }),
      ).toBeInTheDocument();
    });

    it('renders the confirmation message key candidate.submission.success.message', () => {
      render(<SubmissionSuccessPage />);

      expect(
        screen.getByText('candidate.submission.success.message'),
      ).toBeInTheDocument();
    });

    it('renders the what-next heading candidate.submission.success.whatNext', () => {
      render(<SubmissionSuccessPage />);

      expect(
        screen.getByRole('heading', {
          name: 'candidate.submission.success.whatNext',
        }),
      ).toBeInTheDocument();
    });

    it('renders the next-steps body candidate.submission.success.nextSteps', () => {
      render(<SubmissionSuccessPage />);

      expect(
        screen.getByText('candidate.submission.success.nextSteps'),
      ).toBeInTheDocument();
    });
  });

  describe('no back-navigation affordances (Rule 17)', () => {
    it('renders no anchor (<a>) elements', () => {
      const { container } = render(<SubmissionSuccessPage />);
      expect(container.querySelectorAll('a')).toHaveLength(0);
    });

    it('renders no button elements', () => {
      const { container } = render(<SubmissionSuccessPage />);
      expect(container.querySelectorAll('button')).toHaveLength(0);
    });

    it('renders no elements with role=link', () => {
      render(<SubmissionSuccessPage />);
      expect(screen.queryAllByRole('link')).toHaveLength(0);
    });

    it('renders no elements with role=button', () => {
      render(<SubmissionSuccessPage />);
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });
  });

  describe('layout', () => {
    it('renders the page testid wrapper', () => {
      render(<SubmissionSuccessPage />);
      expect(
        screen.getByTestId('submission-success-page'),
      ).toBeInTheDocument();
    });

    it('renders exactly two heading levels (h1 title, h2 whatNext)', () => {
      render(<SubmissionSuccessPage />);
      const headings = screen.getAllByRole('heading');
      expect(headings).toHaveLength(2);
      // The order documented in the implementation file is title (h1) then
      // whatNext (h2).
      expect(headings[0].tagName).toBe('H1');
      expect(headings[1].tagName).toBe('H2');
    });
  });
});
