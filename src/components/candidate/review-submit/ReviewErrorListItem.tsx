// /GlobalRX_v2/src/components/candidate/review-submit/ReviewErrorListItem.tsx
//
// Phase 7 Stage 1 — single tappable error item on the Review & Submit page.
// Tapping navigates the candidate to the section containing the error.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rule 31)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #14, §9

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';
import type { ReviewError } from '@/lib/candidate/validation/types';

// Bug fix (smoke testing — translation placeholder {{sectionLabel}} not
// substituted): scope and gap message strings reference {{sectionLabel}}, but
// the validation engine emits raw placeholders without resolving the section
// label translation key. The Review page knows the section id for each
// listed error, so we resolve the localized label here before substitution.
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

interface ReviewErrorListItemProps {
  error: ReviewError;
  onClick: () => void;
  /**
   * Optional section identifier used to resolve the {{sectionLabel}}
   * placeholder for scope / gap errors. When omitted, scope/gap messages
   * render with their placeholders unchanged — preserving the existing
   * test surface that does not pass sectionId.
   */
  sectionId?: string;
}

export function ReviewErrorListItem(props: ReviewErrorListItemProps) {
  const { t } = useTranslation();
  const { error, onClick, sectionId } = props;

  // Resolve sectionLabel once per render and inject into scope/gap
  // placeholders only when (a) we have a label for this section and (b) the
  // engine did not already provide one.
  const sectionLabelKey = resolveSectionLabelKey(sectionId);
  const sectionLabel = sectionLabelKey ? t(sectionLabelKey) : null;
  const withSectionLabel = (
    placeholders: Record<string, string | number> | undefined,
  ): Record<string, string | number> | undefined => {
    if (!sectionLabel) return placeholders;
    if (placeholders?.sectionLabel !== undefined) return placeholders;
    return { ...(placeholders ?? {}), sectionLabel };
  };

  // Localize each error variant. Document errors get a named-fallback when
  // the documentNameKey resolves to an empty string.
  let label: string;
  if (error.kind === 'field') {
    label = t(error.messageKey, error.placeholders);
  } else if (error.kind === 'scope' || error.kind === 'gap') {
    label = t(error.messageKey, withSectionLabel(error.placeholders));
  } else {
    label = t('candidate.validation.document.missingNamed', {
      documentName: t(error.documentNameKey),
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      // 44px touch target per Component Standards Section 1. The full-row
      // tap area lets the candidate hit any part of the error line.
      className="flex w-full min-h-[44px] items-center justify-between rounded-md border border-red-200 bg-red-50 px-4 py-2 text-left text-sm text-red-800 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
    >
      <span>{label}</span>
      <span aria-hidden="true" className="ml-3 text-red-400">
        ›
      </span>
    </button>
  );
}
