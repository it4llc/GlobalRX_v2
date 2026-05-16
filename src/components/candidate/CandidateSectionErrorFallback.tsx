// /GlobalRX_v2/src/components/candidate/CandidateSectionErrorFallback.tsx
//
// Task 9.1 — Error Boundaries & Loading States
//
// Spec: docs/specs/task-9.1-error-boundaries-loading-states.md §"New Files
// to Create" #1
//
// Candidate-friendly fallback shown when a section throws a render-time
// error. Wraps a warning icon + plain-language message + "Try Again" /
// optional "Skip to Next Step" buttons in a bordered card. All copy is
// translation-driven (Component Standards §6.1).
//
// Mobile-first per Component Standards §1.4: the card is full-width on
// small screens, the action buttons stack vertically and each meets the
// project's 44px minimum touch-target height (h-11 = 44px in Tailwind).
//
// The `error` prop is intentionally accepted but never rendered to the
// candidate — surfacing raw error messages to a non-technical user is
// confusing and could leak implementation detail. The caller is expected
// to log the error through ErrorBoundary's onError callback instead.

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';

interface CandidateSectionErrorFallbackProps {
  /**
   * The error that was caught. Held for callers that may want to attach it
   * to a logger ref; the component itself does not render the message to
   * the candidate.
   */
  error: Error;
  /** Resets the parent ErrorBoundary so the section can re-attempt to render. */
  resetErrorBoundary: () => void;
  /**
   * Optional skip handler. When provided, a "Skip to Next Step" button is
   * shown so the candidate can navigate away from a section that keeps
   * failing. When omitted, only "Try Again" is shown.
   */
  onSkipToNext?: () => void;
  /**
   * Optional localized section title (e.g., "Address History"). When
   * provided, the body message references the section by name via the
   * `sectionFailedWithName` key. When omitted, the generic message is used.
   */
  sectionTitle?: string;
}

export function CandidateSectionErrorFallback({
  error: _error,
  resetErrorBoundary,
  onSkipToNext,
  sectionTitle,
}: CandidateSectionErrorFallbackProps) {
  const { t } = useTranslation();

  const message = sectionTitle
    ? t('candidate.error.sectionFailedWithName', { sectionName: sectionTitle })
    : t('candidate.error.sectionFailedMessage');

  return (
    <div
      role="alert"
      aria-live="polite"
      // Tailwind classes only — bordered card matching the visual language
      // of SectionErrorBanner but in a warning (amber) palette rather than
      // the destructive red used for validation banners. Full-width on
      // small screens; max-width caps it on desktop so the message stays
      // readable.
      className="mx-auto my-6 w-full max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-6 text-amber-900"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-3">
        <svg
          aria-hidden="true"
          className="h-6 w-6 flex-shrink-0 self-start"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.672 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.188-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <h2 className="text-base font-semibold">
            {t('candidate.error.sectionFailedTitle')}
          </h2>
          <p className="mt-1 text-sm">{message}</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
            <Button
              type="button"
              variant="default"
              // h-11 = 44px to meet the candidate portal's mobile-first
              // 44-px touch-target rule (Component Standards §1.4).
              className="h-11 w-full sm:w-auto"
              onClick={resetErrorBoundary}
            >
              {t('candidate.error.tryAgain')}
            </Button>
            {onSkipToNext && (
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full sm:w-auto"
                onClick={onSkipToNext}
              >
                {t('candidate.error.skipToNext')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CandidateSectionErrorFallback;
