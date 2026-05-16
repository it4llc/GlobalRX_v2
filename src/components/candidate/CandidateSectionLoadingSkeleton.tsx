// /GlobalRX_v2/src/components/candidate/CandidateSectionLoadingSkeleton.tsx
//
// Task 9.1 — Error Boundaries & Loading States
//
// Spec: docs/specs/task-9.1-error-boundaries-loading-states.md §"New Files
// to Create" #2
//
// NOTE: No production consumer today (only the unit test renders it). Built
// for future use when candidate sections become lazy-loaded / Suspense-driven.
//
// Animated placeholder shown while a candidate-portal section is preparing
// its content. Three variants matching the broad shapes the candidate
// portal renders:
//
//   - `form`    (default) — label + input rows, for Personal Info,
//                            Address History, Education, Employment, IDV,
//                            Record Search.
//   - `content`            — paragraph-like bars, for workflow sections
//                            (mostly read-only text with a checkbox).
//   - `review`             — status-row bars, for Review & Submit.
//
// Heights are tuned to roughly match the real section so the page does
// not jump when content loads. All styling is Tailwind utility classes,
// no inline styles (Component Standards §1.1).

'use client';

import React from 'react';

export type CandidateSectionLoadingSkeletonVariant = 'form' | 'content' | 'review';

interface CandidateSectionLoadingSkeletonProps {
  variant?: CandidateSectionLoadingSkeletonVariant;
}

// Shared base classes for every placeholder bar. `animate-pulse` produces
// the subtle shimmer Tailwind ships out of the box; `bg-gray-200` is the
// standard neutral used for placeholders elsewhere in the codebase.
const BAR_BASE = 'animate-pulse rounded bg-gray-200';

function FormSkeleton() {
  // Five label/input rows approximate the typical Personal Info section
  // (first name, last name, DOB, email, phone). Each row uses a label bar
  // on the left and a wider input bar on the right, mirroring the actual
  // FormTable label-column / input-column layout.
  const rows = Array.from({ length: 5 });
  return (
    <div className="mx-auto w-full max-w-3xl p-6" data-testid="candidate-loading-skeleton">
      <div className={`${BAR_BASE} mb-6 h-6 w-1/3`} />
      <div className="space-y-4">
        {rows.map((_, idx) => (
          <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <div className={`${BAR_BASE} h-4 w-32 flex-shrink-0`} />
            <div className={`${BAR_BASE} h-9 w-full sm:flex-1`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function ContentSkeleton() {
  // Workflow sections render a heading, several paragraphs of text, and
  // an acknowledgment checkbox. The bar widths vary so the placeholder
  // does not look like an obvious grid.
  return (
    <div className="mx-auto w-full max-w-3xl p-6" data-testid="candidate-loading-skeleton">
      <div className={`${BAR_BASE} mb-6 h-6 w-2/5`} />
      <div className="space-y-3">
        <div className={`${BAR_BASE} h-4 w-full`} />
        <div className={`${BAR_BASE} h-4 w-11/12`} />
        <div className={`${BAR_BASE} h-4 w-10/12`} />
        <div className={`${BAR_BASE} h-4 w-full`} />
        <div className={`${BAR_BASE} h-4 w-9/12`} />
      </div>
      <div className="mt-8 flex items-center gap-3">
        <div className={`${BAR_BASE} h-5 w-5 flex-shrink-0`} />
        <div className={`${BAR_BASE} h-4 w-2/3`} />
      </div>
    </div>
  );
}

function ReviewSkeleton() {
  // Review & Submit renders one row per section showing its status. Six
  // rows approximate a typical package; if the real list is shorter or
  // longer the height difference is small.
  const rows = Array.from({ length: 6 });
  return (
    <div className="mx-auto w-full max-w-3xl p-6" data-testid="candidate-loading-skeleton">
      <div className={`${BAR_BASE} mb-6 h-6 w-1/3`} />
      <div className="space-y-3">
        {rows.map((_, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <div className={`${BAR_BASE} h-4 w-1/2`} />
            <div className={`${BAR_BASE} h-4 w-20 flex-shrink-0`} />
          </div>
        ))}
      </div>
      <div className={`${BAR_BASE} mt-8 h-10 w-32`} />
    </div>
  );
}

export function CandidateSectionLoadingSkeleton({
  variant = 'form',
}: CandidateSectionLoadingSkeletonProps) {
  if (variant === 'content') return <ContentSkeleton />;
  if (variant === 'review') return <ReviewSkeleton />;
  return <FormSkeleton />;
}

export default CandidateSectionLoadingSkeleton;
