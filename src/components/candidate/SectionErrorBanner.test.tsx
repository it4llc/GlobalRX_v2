// /GlobalRX_v2/src/components/candidate/SectionErrorBanner.test.tsx
//
// Phase 7 Stage 1 — Pass 2 component tests for SectionErrorBanner.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 8, 9, 10)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #10

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SectionErrorBanner } from './SectionErrorBanner';
import type {
  DocumentError,
  GapError,
  ScopeError,
} from '@/lib/candidate/validation/types';

// Identity translator. Real `t` (in TranslationContext.tsx) returns the key
// when a translation is missing, so substituting it inline mirrors that
// fallback. When placeholders are supplied, mirror the {{key}} substitution
// the real translator does so the test can assert on substituted output.
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

describe('SectionErrorBanner', () => {
  describe('empty state — Rule 8 (banner only renders when there are problems)', () => {
    it('renders nothing when all error arrays are empty', () => {
      const { container } = render(
        <SectionErrorBanner
          scopeErrors={[]}
          gapErrors={[]}
          documentErrors={[]}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when all error arrays are omitted (defensive)', () => {
      const { container } = render(<SectionErrorBanner />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe('scope errors — Rule 9', () => {
    it('renders one line per scope error using the translation key', () => {
      const scopeErrors: ScopeError[] = [
        {
          messageKey: 'candidate.validation.scope.countSpecific',
          placeholders: { required: 2, actual: 1 },
        },
      ];

      render(<SectionErrorBanner scopeErrors={scopeErrors} />);

      expect(
        screen.getByText('candidate.validation.scope.countSpecific'),
      ).toBeInTheDocument();
    });

    it('substitutes placeholders into the scope error message', () => {
      const scopeErrors: ScopeError[] = [
        {
          messageKey: '{{required}} entries required, {{actual}} entered.',
          placeholders: { required: 7, actual: 0 },
        },
      ];

      render(<SectionErrorBanner scopeErrors={scopeErrors} />);

      expect(
        screen.getByText('7 entries required, 0 entered.'),
      ).toBeInTheDocument();
    });
  });

  describe('gap errors — Rule 9', () => {
    it('renders one line per gap error', () => {
      const gapErrors: GapError[] = [
        {
          messageKey: 'candidate.validation.gap.midline',
          placeholders: { gapStart: 'March 2023', gapEnd: 'June 2023', gapDays: 92, tolerance: 30 },
          gapStart: '2023-03-01',
          gapEnd: '2023-06-01',
          gapDays: 92,
        },
      ];

      render(<SectionErrorBanner gapErrors={gapErrors} />);

      expect(
        screen.getByText('candidate.validation.gap.midline'),
      ).toBeInTheDocument();
    });
  });

  describe('document errors — Rule 9', () => {
    it('renders document errors using the missingNamed key with the document name', () => {
      const documentErrors: DocumentError[] = [
        {
          requirementId: 'req-doc-1',
          documentNameKey: 'candidate.documents.passport',
        },
      ];

      render(<SectionErrorBanner documentErrors={documentErrors} />);

      // The component formats document errors using the
      // `candidate.validation.document.missingNamed` key with the resolved
      // document name passed as a placeholder. With our identity translator
      // the documentName placeholder substitution is visible as raw key text.
      expect(
        screen.getByText('candidate.validation.document.missingNamed'),
      ).toBeInTheDocument();
    });
  });

  describe('multiple errors — Rule 10 (multiple banner messages)', () => {
    it('renders scope, gap, and document errors as separate list items', () => {
      const scopeErrors: ScopeError[] = [
        {
          messageKey: 'candidate.validation.scope.countSpecific',
          placeholders: { required: 2, actual: 1 },
        },
      ];
      const gapErrors: GapError[] = [
        {
          messageKey: 'candidate.validation.gap.midline',
          placeholders: { gapStart: 'A', gapEnd: 'B', gapDays: 50, tolerance: 30 },
          gapStart: '2023-01-01',
          gapEnd: '2023-02-20',
          gapDays: 50,
        },
      ];
      const documentErrors: DocumentError[] = [
        {
          requirementId: 'req-doc-1',
          documentNameKey: 'candidate.documents.passport',
        },
      ];

      render(
        <SectionErrorBanner
          scopeErrors={scopeErrors}
          gapErrors={gapErrors}
          documentErrors={documentErrors}
        />,
      );

      // Three list items — one per error.
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
    });

    it('renders multiple scope errors as separate lines', () => {
      const scopeErrors: ScopeError[] = [
        {
          messageKey: 'first.scope.error',
          placeholders: { required: 1, actual: 0 },
        },
        {
          messageKey: 'second.scope.error',
          placeholders: { required: 5, actual: 2 },
        },
      ];

      render(<SectionErrorBanner scopeErrors={scopeErrors} />);

      expect(screen.getByText('first.scope.error')).toBeInTheDocument();
      expect(screen.getByText('second.scope.error')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('uses role="alert" so the banner is announced to assistive tech', () => {
      const scopeErrors: ScopeError[] = [
        {
          messageKey: 'candidate.validation.scope.countSpecific',
          placeholders: { required: 2, actual: 1 },
        },
      ];

      render(<SectionErrorBanner scopeErrors={scopeErrors} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('exposes a translated aria-label so screen readers identify the banner', () => {
      const scopeErrors: ScopeError[] = [
        {
          messageKey: 'candidate.validation.scope.countSpecific',
          placeholders: { required: 2, actual: 1 },
        },
      ];

      render(<SectionErrorBanner scopeErrors={scopeErrors} />);

      // Identity translator returns the key itself.
      expect(screen.getByLabelText('candidate.validation.bannerLabel')).toBeInTheDocument();
    });
  });

  describe('disappears when errors resolve (Rule 8 / DoD spec line 293)', () => {
    it('returns null after all errors are cleared', () => {
      const scopeErrors: ScopeError[] = [
        {
          messageKey: 'candidate.validation.scope.countSpecific',
          placeholders: { required: 2, actual: 1 },
        },
      ];

      const { rerender, container } = render(
        <SectionErrorBanner scopeErrors={scopeErrors} />,
      );

      // Banner present
      expect(screen.getByRole('alert')).toBeInTheDocument();

      // After errors clear, the banner disappears entirely.
      rerender(
        <SectionErrorBanner scopeErrors={[]} gapErrors={[]} documentErrors={[]} />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
