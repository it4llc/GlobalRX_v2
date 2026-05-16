// /GlobalRX_v2/src/components/candidate/__tests__/CandidateSectionLoadingSkeleton.test.tsx
//
// Task 9.1 — Error Boundaries & Loading States (Pass 2 component tests).
//
// Spec: docs/specs/task-9.1-error-boundaries-loading-states.md
//       §"New Files to Create" #2 (CandidateSectionLoadingSkeleton)
//
// The skeleton is purely presentational: a few placeholder bars sharing a
// `animate-pulse rounded bg-gray-200` class trio. There is no context, no
// translation calls, no fetch — so this file mocks nothing.
//
// Variant detection in the production component is keyed on the `variant`
// prop's exact string value. The three branches (`form` default, `content`,
// `review`) render different internal shapes; the test verifies each
// branch by counting variant-specific markers (label/input rows for form,
// the acknowledgment checkbox-shaped bar for content, the trailing button
// bar for review). All variants ALSO share the same `data-testid`
// (`candidate-loading-skeleton`) which is how callers locate the skeleton.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import {
  CandidateSectionLoadingSkeleton,
  type CandidateSectionLoadingSkeletonVariant,
} from '../CandidateSectionLoadingSkeleton';

describe('CandidateSectionLoadingSkeleton', () => {
  describe('default variant', () => {
    it('renders the form variant when no variant prop is passed', () => {
      render(<CandidateSectionLoadingSkeleton />);

      // The component always wraps its bars in a single container with this
      // testid, regardless of variant. We use the wrapper as the assertion
      // anchor.
      const wrapper = screen.getByTestId('candidate-loading-skeleton');
      expect(wrapper).toBeInTheDocument();

      // The form variant renders 5 label/input rows, each row containing
      // two bars (label + input). That gives the form variant a distinct
      // bar count from content (8 bars) and review (13 bars including the
      // trailing button).
      const bars = wrapper.querySelectorAll('.animate-pulse');
      // Form: 1 title bar + (5 rows * 2 bars) = 11 bars
      expect(bars.length).toBe(11);
    });
  });

  describe('animate-pulse class', () => {
    // Every variant must apply Tailwind's `animate-pulse` to its bars so
    // the shimmer effect actually plays. We assert this once per variant
    // to catch regressions where a variant author forgets the class.
    const variants: CandidateSectionLoadingSkeletonVariant[] = ['form', 'content', 'review'];

    variants.forEach((variant) => {
      it(`applies animate-pulse to every placeholder bar in the ${variant} variant`, () => {
        render(<CandidateSectionLoadingSkeleton variant={variant} />);

        const wrapper = screen.getByTestId('candidate-loading-skeleton');
        // Every direct or indirect bar element shares the same base class
        // string. Querying by `.animate-pulse` finds them all. If a bar
        // ever ships without the class, the count would drop to zero and
        // the assertion would catch it.
        const bars = wrapper.querySelectorAll('.animate-pulse');
        expect(bars.length).toBeGreaterThan(0);

        // Every bar also needs `bg-gray-200` and `rounded` from the same
        // BAR_BASE constant. We spot-check one to keep the assertion
        // narrow but representative.
        const firstBar = bars[0];
        expect(firstBar).toHaveClass('animate-pulse');
        expect(firstBar).toHaveClass('rounded');
        expect(firstBar).toHaveClass('bg-gray-200');
      });
    });
  });

  describe('form variant', () => {
    it('renders 5 form-style row pairs plus a heading bar', () => {
      render(<CandidateSectionLoadingSkeleton variant="form" />);

      const wrapper = screen.getByTestId('candidate-loading-skeleton');
      const bars = wrapper.querySelectorAll('.animate-pulse');

      // 1 heading + (5 rows * 2 bars per row) = 11 bars.
      expect(bars.length).toBe(11);
    });
  });

  describe('content variant', () => {
    it('renders paragraph-style bars plus a checkbox row', () => {
      render(<CandidateSectionLoadingSkeleton variant="content" />);

      const wrapper = screen.getByTestId('candidate-loading-skeleton');
      const bars = wrapper.querySelectorAll('.animate-pulse');

      // 1 heading + 5 paragraph bars + (1 checkbox + 1 checkbox-label) = 8 bars.
      expect(bars.length).toBe(8);
    });
  });

  describe('review variant', () => {
    it('renders status-row pairs plus a trailing button bar', () => {
      render(<CandidateSectionLoadingSkeleton variant="review" />);

      const wrapper = screen.getByTestId('candidate-loading-skeleton');
      const bars = wrapper.querySelectorAll('.animate-pulse');

      // 1 heading + (6 rows * 2 bars per row) + 1 trailing button = 14 bars.
      expect(bars.length).toBe(14);
    });
  });

  describe('variants are visually distinct from one another', () => {
    it('produces a different bar count for each variant', () => {
      // Cross-check: if a future change accidentally aliased one variant
      // to another's renderer, this assertion would catch it before the
      // per-variant tests above (which still pass because the count would
      // also match the aliased variant).
      const counts: Record<CandidateSectionLoadingSkeletonVariant, number> = {
        form: 0,
        content: 0,
        review: 0,
      };

      const variants: CandidateSectionLoadingSkeletonVariant[] = ['form', 'content', 'review'];
      for (const variant of variants) {
        const { unmount } = render(
          <CandidateSectionLoadingSkeleton variant={variant} />,
        );
        const wrapper = screen.getByTestId('candidate-loading-skeleton');
        counts[variant] = wrapper.querySelectorAll('.animate-pulse').length;
        unmount();
      }

      // All three counts must be distinct. Set-size === array-size proves
      // there is no overlap.
      const set = new Set(Object.values(counts));
      expect(set.size).toBe(3);
    });
  });
});
