// /GlobalRX_v2/src/components/candidate/SectionProgressIndicator.tsx
//
// Phase 6 Stage 4 — small visual indicator displayed next to each section
// name in the candidate portal sidebar. Renders one of three lowercase
// statuses per Business Rule 14 / 22:
//   - not_started → grey empty circle
//   - incomplete  → red circle with an exclamation
//   - complete    → green circle with a check
//
// Stateless presentational component. No API calls.

'use client';

import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import type { SectionStatus } from '@/types/candidate-stage4';

interface SectionProgressIndicatorProps {
  /** Current status of the section. */
  status: SectionStatus;
  /** Section name — included in the screen-reader label so users hear which
      section the indicator belongs to. */
  label: string;
}

const VALID_STATUSES: ReadonlySet<SectionStatus> = new Set([
  'not_started',
  'incomplete',
  'complete',
]);

export default function SectionProgressIndicator({
  status,
  label,
}: SectionProgressIndicatorProps) {
  const { t } = useTranslation();

  // Defensive fallback — if an unrecognized status reaches this component
  // (e.g., from a stale cache), we render the not_started indicator rather
  // than crashing. The progress helpers in sectionProgress.ts only ever
  // emit one of the three valid values, so this branch is unreachable in
  // normal usage.
  const safeStatus: SectionStatus = VALID_STATUSES.has(status)
    ? status
    : 'not_started';

  // Task 9.2 — sr-only status text uses the spec-mandated
  // `candidate.a11y.stepStatus*` vocabulary so the sidebar, the
  // SectionProgressIndicator, and the e2e accessibility audit all share a
  // single set of translation keys.
  const statusLabel =
    safeStatus === 'complete'
      ? t('candidate.a11y.stepStatusComplete')
      : safeStatus === 'incomplete'
        ? t('candidate.a11y.stepStatusIncomplete')
        : t('candidate.a11y.stepStatusNotStarted');

  return (
    <span
      className="inline-flex items-center"
      data-testid="section-progress-indicator"
      data-status={safeStatus}
    >
      {safeStatus === 'complete' && (
        <span
          className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
          aria-hidden="true"
        >
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </span>
      )}
      {safeStatus === 'incomplete' && (
        <span
          className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center"
          aria-hidden="true"
        >
          <svg
            className="w-3 h-3 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M12 9v2m0 4h.01M5 19h14a2 2 0 001.84-2.75L13.74 4a2 2 0 00-3.48 0L3.16 16.25A2 2 0 005 19z"
            />
          </svg>
        </span>
      )}
      {safeStatus === 'not_started' && (
        <span
          className="w-5 h-5 rounded-full bg-gray-300"
          aria-hidden="true"
        />
      )}
      {/* Visually-hidden label combines the section name with the status so
          screen readers announce both, e.g. "Personal Information — Incomplete". */}
      <span className="sr-only">{`${label} — ${statusLabel}`}</span>
    </span>
  );
}
