// /GlobalRX_v2/src/components/candidate/review-submit/ReviewSubmitPage.tsx
//
// Phase 7 Stage 1 — top-level Review & Submit page. Loads /validate on
// mount and on every save-triggered refresh, renders one section block per
// FullValidationResult.sections entry plus the Submit button + help text.
//
// Phase 7 Stage 2 — wired the Submit button to a host-supplied
// `onSubmit` handler with loading/error states. The host (portal-layout)
// owns the actual fetch and the navigation; this component remains
// presentational for everything except the click handler.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 29–33)
//                 docs/specs/phase7-stage2-submission-order-generation.md (Rule 1, 24)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #12, §9
//                 docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §3.2 / §17

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';
import type {
  FullValidationResult,
  ReviewError,
  ValidationStatus,
} from '@/lib/candidate/validation/types';

import { ReviewSectionBlock } from '@/components/candidate/review-submit/ReviewSectionBlock';

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
  /**
   * Phase 7 Stage 2 — invoked when the candidate taps Submit. Host
   * (portal-layout) makes the actual fetch and handles the response.
   * Optional so existing callers / tests that only render the Stage 1
   * surface keep working — when omitted, the button stays disabled.
   */
  onSubmit?: () => void | Promise<void>;
  /**
   * Phase 7 Stage 2 — host-controlled "submission in flight" flag. When
   * true the button is disabled (regardless of validation state), the
   * label swaps to the loading-state translation, and aria-busy is set so
   * assistive tech announces the change.
   */
  submitting?: boolean;
  /**
   * Phase 7 Stage 2 — already-localized error string (or null when no
   * error). When non-null, a banner is rendered above the Submit button
   * using the existing `.form-error` class.
   */
  submitError?: string | null;
  /**
   * Task 8.2 (Linear Step Navigation) — optional Back-button handler.
   * When provided, the Review & Submit page renders an outline-style
   * Back button alongside the Submit button (spec rule 5). When omitted,
   * no Back button is rendered, preserving backwards compatibility for
   * existing test fixtures that only exercise the Stage 1/2 surface.
   * The Back button on this page is rendered by ReviewSubmitPage itself
   * (not by the shared StepNavigationButtons component) so it can sit in
   * the same row as Submit per the spec.
   */
  onBack?: () => void;
}

export function ReviewSubmitPage(props: ReviewSubmitPageProps) {
  const { t } = useTranslation();
  const {
    validationResult,
    sections,
    onErrorNavigate,
    onSubmit,
    submitting = false,
    submitError = null,
    onBack,
  } = props;

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
        {/* Phase 7 Stage 2 — submit error banner. Renders above the button
            when the host reports a non-null error (validation failure,
            expired invitation, server error, network failure). Already
            localized by the host; we render it through the existing
            .form-error class for visual consistency with other error
            banners in the candidate portal. */}
        {submitError ? (
          <div
            role="alert"
            data-testid="submit-error-banner"
            className="form-error w-full rounded-md border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700"
          >
            {submitError}
          </div>
        ) : null}

        {/* Task 8.2 (Linear Step Navigation) — Back + Submit live in a
            single row so the candidate can step back from the review page
            without losing track of the primary submit action (spec rule 5).
            Mobile-first: stacks `flex-col-reverse` below the `sm`
            breakpoint so Submit stays visually on top; on `sm` and wider
            they sit side-by-side with Back on the LEFT and Submit on the
            RIGHT. Back is rendered only when the shell supplies `onBack`,
            so existing Stage 1/2 tests continue to pass without it. */}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-center sm:items-center gap-3 w-full">
          {onBack ? (
            <button
              type="button"
              data-testid="review-back-button"
              onClick={onBack}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer w-full sm:w-auto"
            >
              {t('candidate.navigation.back')}
            </button>
          ) : null}

          <button
            type="button"
            // Phase 7 Stage 2 — Submit is enabled only when:
            //   1. validation reports allComplete=true (Spec Rule 1), AND
            //   2. the host wired an onSubmit handler, AND
            //   3. no submission is currently in flight.
            // The legacy disabled-only path is preserved for any caller that
            // forgets to pass onSubmit, so the test suite's Stage 1 fixtures
            // continue to behave as before.
            disabled={
              !onSubmit ||
              !validationResult?.summary.allComplete ||
              submitting
            }
            aria-disabled={
              !onSubmit ||
              !validationResult?.summary.allComplete ||
              submitting
            }
            aria-busy={submitting ? 'true' : undefined}
            onClick={onSubmit ? () => void onSubmit() : undefined}
            // Active palette when ready to submit; muted gray otherwise. The
            // ternary avoids ambiguity about which palette wins in the
            // "submitting === true" case (gray, because the button is
            // disabled at that point).
            className={
              !onSubmit ||
              !validationResult?.summary.allComplete ||
              submitting
                ? 'inline-flex min-h-[44px] items-center justify-center rounded-md bg-gray-300 px-6 py-2 text-sm font-medium text-gray-600 opacity-60 cursor-not-allowed w-full sm:w-auto'
                : 'inline-flex min-h-[44px] items-center justify-center rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer w-full sm:w-auto'
            }
          >
            {submitting
              ? t('candidate.submission.submitting')
              : t('candidate.reviewSubmit.submit')}
          </button>
        </div>
        <p className="text-center text-xs text-gray-500">
          {t('candidate.reviewSubmit.submitHelp')}
        </p>
      </footer>
    </div>
  );
}
