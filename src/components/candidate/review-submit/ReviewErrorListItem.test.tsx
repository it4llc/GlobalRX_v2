// /GlobalRX_v2/src/components/candidate/review-submit/ReviewErrorListItem.test.tsx
//
// Phase 7 Stage 1 — Pass 2 component tests for ReviewErrorListItem.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rule 31 — tappable to navigate to the section)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #14

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ReviewErrorListItem } from './ReviewErrorListItem';
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

describe('ReviewErrorListItem', () => {
  describe('rendering by error kind', () => {
    it('renders a field error using its messageKey', () => {
      const error: ReviewError = {
        kind: 'field',
        fieldName: 'firstName',
        messageKey: 'candidate.validation.field.required',
      };

      render(<ReviewErrorListItem error={error} onClick={vi.fn()} />);

      expect(
        screen.getByText('candidate.validation.field.required'),
      ).toBeInTheDocument();
    });

    it('renders a scope error using its messageKey', () => {
      const error: ReviewError = {
        kind: 'scope',
        messageKey: 'candidate.validation.scope.countSpecific',
        placeholders: { required: 2, actual: 1 },
      };

      render(<ReviewErrorListItem error={error} onClick={vi.fn()} />);

      expect(
        screen.getByText('candidate.validation.scope.countSpecific'),
      ).toBeInTheDocument();
    });

    it('renders a gap error using its messageKey', () => {
      const error: ReviewError = {
        kind: 'gap',
        messageKey: 'candidate.validation.gap.midline',
        placeholders: { gapStart: 'A', gapEnd: 'B', gapDays: 50, tolerance: 30 },
        gapStart: '2023-01-01',
        gapEnd: '2023-02-20',
      };

      render(<ReviewErrorListItem error={error} onClick={vi.fn()} />);

      expect(
        screen.getByText('candidate.validation.gap.midline'),
      ).toBeInTheDocument();
    });

    it('renders a document error using the missingNamed key', () => {
      const error: ReviewError = {
        kind: 'document',
        requirementId: 'req-doc-1',
        documentNameKey: 'candidate.documents.passport',
      };

      render(<ReviewErrorListItem error={error} onClick={vi.fn()} />);

      expect(
        screen.getByText('candidate.validation.document.missingNamed'),
      ).toBeInTheDocument();
    });
  });

  describe('interaction — Rule 31 (tappable navigation)', () => {
    it('calls onClick when the button is clicked', () => {
      const handleClick = vi.fn();
      const error: ReviewError = {
        kind: 'field',
        fieldName: 'firstName',
        messageKey: 'candidate.validation.field.required',
      };

      render(<ReviewErrorListItem error={error} onClick={handleClick} />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('renders as a button element so it is keyboard accessible', () => {
      const error: ReviewError = {
        kind: 'field',
        fieldName: 'firstName',
        messageKey: 'candidate.validation.field.required',
      };

      render(<ReviewErrorListItem error={error} onClick={vi.fn()} />);

      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
    });
  });

  describe('mobile-first — DoD 28 (44px touch target)', () => {
    it('uses min-h-[44px] for touch-target compliance', () => {
      const error: ReviewError = {
        kind: 'field',
        fieldName: 'firstName',
        messageKey: 'candidate.validation.field.required',
      };

      render(<ReviewErrorListItem error={error} onClick={vi.fn()} />);

      const button = screen.getByRole('button');
      expect(button.className).toContain('min-h-[44px]');
    });
  });
});
