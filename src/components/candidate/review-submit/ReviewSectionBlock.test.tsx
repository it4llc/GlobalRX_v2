// /GlobalRX_v2/src/components/candidate/review-submit/ReviewSectionBlock.test.tsx
//
// Phase 7 Stage 1 — Pass 2 component tests for ReviewSectionBlock.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 30, 32)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #13
//
// Per Mocking Rule M2 the child components SectionProgressIndicator and
// ReviewErrorListItem are NOT mocked — the tests below assert on their real
// rendered DOM (status indicator color, tappable error buttons, "Complete"
// label rendering).

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ReviewSectionBlock } from './ReviewSectionBlock';
import type { ReviewError } from '@/lib/candidate/validation/types';

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

describe('ReviewSectionBlock', () => {
  describe('section name + status indicator (Rule 30)', () => {
    it('renders the section name as a heading', () => {
      render(
        <ReviewSectionBlock
          sectionId="personal_info"
          sectionName="Personal Information"
          status="complete"
          errors={[]}
          onErrorClick={vi.fn()}
        />,
      );

      expect(
        screen.getByRole('heading', { name: 'Personal Information' }),
      ).toBeInTheDocument();
    });

    it('renders a real SectionProgressIndicator with the matching status', () => {
      render(
        <ReviewSectionBlock
          sectionId="personal_info"
          sectionName="Personal Information"
          status="incomplete"
          errors={[]}
          onErrorClick={vi.fn()}
        />,
      );

      // Indicator carries data-status attribute set by SectionProgressIndicator.
      // Per Mocking Rule M2 we let SectionProgressIndicator render so the test
      // verifies the actual sidebar dot, not a prop pass-through.
      const indicator = screen.getByTestId('section-progress-indicator');
      expect(indicator.getAttribute('data-status')).toBe('incomplete');
    });
  });

  describe('green section — Rule 30 ("Complete" label, no error list)', () => {
    it('renders "Complete" text when status is complete and errors are empty', () => {
      render(
        <ReviewSectionBlock
          sectionId="personal_info"
          sectionName="Personal Information"
          status="complete"
          errors={[]}
          onErrorClick={vi.fn()}
        />,
      );

      expect(
        screen.getByText('candidate.reviewSubmit.sectionComplete'),
      ).toBeInTheDocument();
      // No tappable error buttons.
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('does not render the "Complete" text when status is incomplete', () => {
      render(
        <ReviewSectionBlock
          sectionId="personal_info"
          sectionName="Personal Information"
          status="incomplete"
          errors={[]}
          onErrorClick={vi.fn()}
        />,
      );

      expect(
        screen.queryByText('candidate.reviewSubmit.sectionComplete'),
      ).not.toBeInTheDocument();
    });
  });

  describe('grey section', () => {
    it('renders the "Not yet started" text when status is not_started and errors are empty', () => {
      render(
        <ReviewSectionBlock
          sectionId="personal_info"
          sectionName="Personal Information"
          status="not_started"
          errors={[]}
          onErrorClick={vi.fn()}
        />,
      );

      expect(
        screen.getByText('candidate.reviewSubmit.sectionNotStarted'),
      ).toBeInTheDocument();
    });
  });

  describe('error list — Rule 30, Rule 31', () => {
    it('renders one ReviewErrorListItem button per error', () => {
      const errors: ReviewError[] = [
        {
          kind: 'scope',
          messageKey: 'candidate.validation.scope.countSpecific',
          placeholders: { required: 2, actual: 1 },
        },
        {
          kind: 'field',
          fieldName: 'firstName',
          messageKey: 'candidate.validation.field.required',
        },
      ];

      render(
        <ReviewSectionBlock
          sectionId="personal_info"
          sectionName="Personal Information"
          status="incomplete"
          errors={errors}
          onErrorClick={vi.fn()}
        />,
      );

      // Per Mocking Rule M2: ReviewErrorListItem is NOT mocked. The test
      // asserts on the real rendered button DOM.
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]).toHaveTextContent(
        'candidate.validation.scope.countSpecific',
      );
      expect(buttons[1]).toHaveTextContent(
        'candidate.validation.field.required',
      );
    });

    it('calls onErrorClick with the clicked error when an item button is clicked', () => {
      const handleErrorClick = vi.fn();
      const errors: ReviewError[] = [
        {
          kind: 'scope',
          messageKey: 'candidate.validation.scope.countSpecific',
          placeholders: { required: 2, actual: 1 },
        },
        {
          kind: 'field',
          fieldName: 'firstName',
          messageKey: 'candidate.validation.field.required',
        },
      ];

      render(
        <ReviewSectionBlock
          sectionId="personal_info"
          sectionName="Personal Information"
          status="incomplete"
          errors={errors}
          onErrorClick={handleErrorClick}
        />,
      );

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]);

      expect(handleErrorClick).toHaveBeenCalledTimes(1);
      expect(handleErrorClick).toHaveBeenCalledWith(errors[1]);
    });
  });
});
