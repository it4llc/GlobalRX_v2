// /GlobalRX_v2/src/components/candidate/SectionErrorBanner.tsx
//
// Phase 7 Stage 1 — section-level error banner shown at the top of a
// section that has scope, gap, or document errors after visit-and-departure.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 8, 9, 10)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #10, §9
//
// Pure presentational. Reads error arrays + emits one localized line per
// error using the translation context. Mobile-first per Component
// Standards Section 1.

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';
import type {
  DocumentError,
  GapError,
  ScopeError,
} from '@/lib/candidate/validation/types';

// Bug fix (smoke testing — translation placeholder {{sectionLabel}} not
// substituted): scope and gap message strings reference {{sectionLabel}},
// but the validation engine (server-side, no translation context) cannot
// resolve translation keys. The owning section is the only place that
// knows which sectionLabel translation key applies, so we accept the
// section id here and resolve the localized label via t() before passing
// it into each error's placeholders.
function resolveSectionLabelKey(sectionId: string | undefined): string | null {
  if (!sectionId) return null;
  if (sectionId === 'address_history') {
    return 'candidate.validation.scope.sectionLabel.addressHistory';
  }
  if (sectionId === 'service_verification-edu') {
    return 'candidate.validation.scope.sectionLabel.education';
  }
  if (sectionId === 'service_verification-emp') {
    return 'candidate.validation.scope.sectionLabel.employment';
  }
  return null;
}

interface SectionErrorBannerProps {
  /**
   * Optional section identifier used to resolve the {{sectionLabel}}
   * placeholder used by scope and gap message keys (Rules 12-15, 22, 26).
   * When omitted, scope/gap messages render with their placeholders unchanged
   * — the existing test surface relies on this no-op fallback.
   */
  sectionId?: string;
  scopeErrors?: ScopeError[];
  gapErrors?: GapError[];
  documentErrors?: DocumentError[];
}

export function SectionErrorBanner(props: SectionErrorBannerProps) {
  const { t } = useTranslation();

  const scope = props.scopeErrors ?? [];
  const gap = props.gapErrors ?? [];
  const docs = props.documentErrors ?? [];
  const sectionLabelKey = resolveSectionLabelKey(props.sectionId);
  const sectionLabel = sectionLabelKey ? t(sectionLabelKey) : null;
  // Inject sectionLabel only when (a) we have one for this section and
  // (b) the engine didn't already include one. This preserves the existing
  // tests (which pass placeholders without sectionLabel) while fixing the
  // production bug where the literal '{{sectionLabel}}' was rendered to
  // candidates.
  const withSectionLabel = (
    placeholders: Record<string, string | number>,
  ): Record<string, string | number> => {
    if (!sectionLabel) return placeholders;
    if (placeholders.sectionLabel !== undefined) return placeholders;
    return { ...placeholders, sectionLabel };
  };

  // Hide entirely when nothing to show — Rule 8 only renders when there ARE
  // problems.
  if (scope.length === 0 && gap.length === 0 && docs.length === 0) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-label={t('candidate.validation.bannerLabel')}
      // Tailwind classes only — no inline styles, no Shadcn primitives.
      // bg-red-50 / border-red-200 / text-red-800 mirror the existing red
      // alert styling used elsewhere in the candidate portal.
      className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-red-800"
    >
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 flex-shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            // Heroicons inline exclamation-triangle, sized to match the
            // 44px touch-target spirit (the SVG itself is small but lives
            // inside a row that's vertically generous).
            d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.672 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.188-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        </svg>
        <ul className="flex flex-col gap-1 text-sm">
          {scope.map((err, idx) => (
            <li key={`scope-${idx}`}>
              {t(err.messageKey, withSectionLabel(err.placeholders))}
            </li>
          ))}
          {gap.map((err, idx) => (
            <li key={`gap-${idx}`}>
              {t(err.messageKey, withSectionLabel(err.placeholders))}
            </li>
          ))}
          {docs.map((err, idx) => (
            <li key={`doc-${err.requirementId}-${idx}`}>
              {t('candidate.validation.document.missingNamed', {
                documentName: t(err.documentNameKey),
              })}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
