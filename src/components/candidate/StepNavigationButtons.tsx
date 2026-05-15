// /GlobalRX_v2/src/components/candidate/StepNavigationButtons.tsx
//
// Task 8.2 (Linear Step Navigation) — presentational Next/Back button row
// rendered at the bottom of every non-`review_submit` section in the
// candidate portal. The component is intentionally tiny: it owns no
// state, calls no APIs, and depends only on the two callbacks passed in
// by the portal-layout shell.
//
// Both buttons match `min-h-[44px]` and `w-full sm:w-auto` per spec rule 12
// and edge case 7 (mobile tap targets / 320px-wide screens). The Back
// button uses the secondary/outline palette; the Next button matches the
// primary/filled palette already used by the Submit button on the Review
// & Submit page so the candidate sees consistent visual treatment for
// "primary forward action" across the flow.
//
// Spec:           docs/specs/linear-step-navigation.md
// Technical plan: docs/plans/linear-step-navigation-technical-plan.md

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';

interface StepNavigationButtonsProps {
  /**
   * Click handler for the Back button. When null, the Back button is not
   * rendered (first step, per spec rule 4). The portal-layout shell passes
   * null whenever the active section is at index 0 of the navigable list.
   */
  onBack: (() => void) | null;
  /**
   * Click handler for the Next button. When null, the Next button is not
   * rendered (Review & Submit step, per spec rule 4 — the page's own
   * Submit button replaces it). Also null when only a single step exists
   * (spec edge case 4).
   */
  onNext: (() => void) | null;
  /**
   * Optional toggle for disabling Next while keeping it visible. Reserved
   * for future use; the current task never disables Next without
   * suppressing it entirely, but exposing the prop now avoids widening
   * the component contract later.
   */
  nextDisabled?: boolean;
}

export default function StepNavigationButtons({
  onBack,
  onNext,
  nextDisabled = false,
}: StepNavigationButtonsProps) {
  const { t } = useTranslation();

  // Render nothing when neither callback was supplied — spec edge case 4
  // (single-step packages should not display an empty navigation row).
  if (onBack === null && onNext === null) {
    return null;
  }

  return (
    <div
      data-testid="step-navigation"
      className="mt-8 pt-6 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-between gap-3"
    >
      {onBack !== null ? (
        <button
          type="button"
          data-testid="step-nav-back"
          onClick={onBack}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer w-full sm:w-auto"
        >
          {t('candidate.navigation.back')}
        </button>
      ) : null}

      {onNext !== null ? (
        <button
          type="button"
          data-testid="step-nav-next"
          onClick={onNext}
          disabled={nextDisabled}
          aria-disabled={nextDisabled ? 'true' : undefined}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer w-full sm:w-auto"
        >
          {t('candidate.navigation.next')}
        </button>
      ) : null}
    </div>
  );
}
