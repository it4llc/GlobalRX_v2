// /GlobalRX_v2/src/components/candidate/review-submit/ReviewSectionBlock.tsx
//
// Phase 7 Stage 1 — one section's status indicator + name + error list on
// the Review & Submit page. Sections with no errors show a green indicator
// and no list. Sections with errors show the list expanded.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 30, 32)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #13, §9

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';
import SectionProgressIndicator from '@/components/candidate/SectionProgressIndicator';
import type { ReviewError, ValidationStatus } from '@/lib/candidate/validation/types';

import { ReviewErrorListItem } from './ReviewErrorListItem';

interface ReviewSectionBlockProps {
  sectionId: string;
  sectionName: string;
  status: ValidationStatus;
  errors: ReviewError[];
  /** Called when any error in the list is tapped. */
  onErrorClick: (error: ReviewError) => void;
}

export function ReviewSectionBlock(props: ReviewSectionBlockProps) {
  const { t } = useTranslation();
  const { sectionId, sectionName, status, errors, onErrorClick } = props;

  return (
    <section className="mb-6 rounded-md border border-gray-200 bg-white p-4">
      <header className="mb-3 flex items-center gap-3">
        <SectionProgressIndicator status={status} label={sectionName} />
        <h3 className="text-base font-semibold text-gray-900">
          {/* The sectionName is already localized (or a translation key the
              caller resolved). We pass it through directly here. */}
          {sectionName}
        </h3>
      </header>

      {status === 'complete' && errors.length === 0 ? (
        <p className="text-sm text-green-700">
          {t('candidate.reviewSubmit.sectionComplete')}
        </p>
      ) : null}

      {status === 'not_started' && errors.length === 0 ? (
        <p className="text-sm text-gray-600">
          {t('candidate.reviewSubmit.sectionNotStarted')}
        </p>
      ) : null}

      {errors.length > 0 ? (
        <>
          {/* Task 9.2 — descriptive jump link with aria-label "Go back to
              fix errors in <section name>". Renders as a semantic anchor
              (role=link) so the spec's getByRole('link') query finds it.
              The anchor preventDefaults and calls the same onErrorClick
              handler as the per-error buttons, navigating to the first
              error in the list. */}
          <a
            href={`#${sectionId}`}
            className="mb-2 inline-block text-sm font-medium text-red-700 underline hover:text-red-900"
            aria-label={t('candidate.a11y.fixErrorsIn', { sectionName })}
            onClick={(event) => {
              event.preventDefault();
              if (errors.length > 0) {
                onErrorClick(errors[0]);
              }
            }}
            data-testid="review-jump-link"
          >
            {t('candidate.a11y.fixErrorsIn', { sectionName })}
          </a>
          <ul className="flex flex-col gap-2">
            {errors.map((err, idx) => (
              <li key={`${err.kind}-${idx}`}>
                <ReviewErrorListItem
                  error={err}
                  sectionId={sectionId}
                  onClick={() => onErrorClick(err)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
