// /GlobalRX_v2/src/components/candidate/review-submit/SubmissionSuccessPage.tsx
//
// Phase 7 Stage 2 — candidate-side success page UI. Pure presentational
// component rendered by the success page server route after a successful
// submission. No submit logic, no back-navigation affordances, no order
// details (Spec Rule 17 — the page intentionally shows only confirmation
// and next-steps copy).
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md (Rule 17)
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §7.4 / §18

'use client';

import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

/**
 * Success page UI. The container styles match the candidate portal's
 * existing card aesthetic (white card on the page-level gray background
 * applied by the candidate layout). Tailwind utilities only — no inline
 * styles, no new stylesheets (per COMPONENT_STANDARDS.md §3.5).
 *
 * Translation keys (added to all five locale files in this stage):
 *   candidate.submission.success.title
 *   candidate.submission.success.message
 *   candidate.submission.success.whatNext
 *   candidate.submission.success.nextSteps
 */
export function SubmissionSuccessPage() {
  const { t } = useTranslation();

  return (
    <div
      className="mx-auto w-full max-w-md rounded-lg bg-white p-6 shadow-sm md:p-8"
      data-testid="submission-success-page"
    >
      <div className="flex flex-col items-center text-center">
        {/* Decorative checkmark — purely visual, no interactivity. The
            inline SVG carries aria-hidden so screen readers skip it; the
            text below is the source of truth for assistive tech. */}
        <div
          aria-hidden="true"
          className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
        >
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900">
          {t('candidate.submission.success.title')}
        </h1>

        <p className="mt-3 text-sm text-gray-600">
          {t('candidate.submission.success.message')}
        </p>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <h2 className="text-base font-semibold text-gray-900">
          {t('candidate.submission.success.whatNext')}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {t('candidate.submission.success.nextSteps')}
        </p>
      </div>
    </div>
  );
}
