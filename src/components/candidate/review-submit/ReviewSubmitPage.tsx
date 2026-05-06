// /GlobalRX_v2/src/components/candidate/review-submit/ReviewSubmitPage.tsx
//
// Phase 7 Stage 1 — top-level Review & Submit page. Loads /validate on
// mount and on every save-triggered refresh, renders one section block per
// FullValidationResult.sections entry plus the disabled Submit button + help
// text.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 29–33)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #12, §9

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';
import type {
  FullValidationResult,
  ReviewError,
  ValidationStatus,
} from '@/lib/candidate/validation/types';

import { ReviewSectionBlock } from './ReviewSectionBlock';

/**
 * Minimal section descriptor consumed by ReviewSubmitPage to drive both the
 * order of section blocks AND the section titles. Provided by the portal
 * shell from the same `sectionsWithStatus` array the sidebar uses, so the
 * Review & Submit page renders sections in the canonical sidebar order
 * (Bug 3) with their localized titles (Bug 1b) instead of the raw section
 * IDs the validation engine returns as `sectionName`.
 */
export interface ReviewPageSectionDescriptor {
  /** Section identifier — matches FullValidationResult.summary.sections[i].sectionId. */
  id: string;
  /**
   * Translation key (or already-localized display string for workflow sections,
   * which carry section.name from the database). Resolved through `t()`; the
   * platform's `t` helper falls back to the input when no translation exists,
   * so passing a raw label here is safe.
   */
  title: string;
}

interface ReviewSubmitPageProps {
  /** Latest validation result. May be null while still loading. */
  validationResult: FullValidationResult | null;
  /**
   * Optional canonical section list driven by the structure endpoint (in
   * sidebar order, with translation-key titles). When provided, drives both
   * the order and the rendered titles of section blocks — fixing Bug 1b
   * (raw IDs shown) and Bug 3 (sidebar/review order mismatch). When not
   * provided, the page falls back to iterating the validation summary
   * (preserving the original behavior expected by older tests).
   */
  sections?: ReviewPageSectionDescriptor[];
  /**
   * Called when the candidate taps an error in the list. The host (portal
   * layout) is responsible for navigating to the corresponding section.
   * Passes back the section id that owns the error and the error itself
   * so the host can scroll to a specific field where applicable (Rule 31).
   */
  onErrorNavigate: (sectionId: string, error: ReviewError) => void;
}

export function ReviewSubmitPage(props: ReviewSubmitPageProps) {
  const { t } = useTranslation();
  const { validationResult, sections, onErrorNavigate } = props;

  // Build the renderable list. Two paths so existing tests that only pass
  // validationResult continue to work, while production (which passes
  // `sections`) gets canonical order + localized titles.
  //
  // When `sections` is provided we iterate it directly (canonical sidebar
  // order, fixing Bug 3) and join against the validation summary by id for
  // status / error data. Sections that have no validation entry yet (e.g.,
  // not yet evaluated by the engine) fall back to a default
  // `not_started` block with no errors so the candidate still sees the
  // section listed.
  let renderableSections: Array<{
    sectionId: string;
    sectionName: string;
    status: ValidationStatus;
    errors: ReviewError[];
  }>;
  if (sections) {
    const summaryById = new Map(
      (validationResult?.summary.sections ?? []).map((s) => [s.sectionId, s]),
    );
    renderableSections = sections.map((sec) => {
      const fromSummary = summaryById.get(sec.id);
      return {
        sectionId: sec.id,
        sectionName: t(sec.title),
        status: fromSummary?.status ?? 'not_started',
        errors: fromSummary?.errors ?? [],
      };
    });
  } else {
    renderableSections = (validationResult?.summary.sections ?? []).map((s) => ({
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      status: s.status,
      errors: s.errors,
    }));
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {t('candidate.reviewSubmit.title')}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {t('candidate.reviewSubmit.intro')}
        </p>
      </header>

      <div>
        {renderableSections.map((sec) => (
          <ReviewSectionBlock
            key={sec.sectionId}
            sectionId={sec.sectionId}
            sectionName={sec.sectionName}
            status={sec.status}
            errors={sec.errors}
            onErrorClick={(err) => onErrorNavigate(sec.sectionId, err)}
          />
        ))}
      </div>

      <footer className="mt-6 flex flex-col items-stretch gap-2 sm:items-center">
        <button
          type="button"
          // Stage 1: Submit is always disabled. Stage 2 will activate it.
          disabled
          aria-disabled="true"
          // Disabled visual treatment uses the standard "muted gray" pattern
          // — opacity-60 + cursor-not-allowed. No tooltip per Rule 33
          // (mobile has no hover); the help text below the button is
          // permanent and visible to all candidates.
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-gray-300 px-6 py-2 text-sm font-medium text-gray-600 opacity-60 cursor-not-allowed"
        >
          {t('candidate.reviewSubmit.submit')}
        </button>
        <p className="text-center text-xs text-gray-500">
          {t('candidate.reviewSubmit.submitHelp')}
        </p>
      </footer>
    </div>
  );
}
