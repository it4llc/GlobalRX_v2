// /GlobalRX_v2/src/components/candidate/FieldErrorMessage.tsx
//
// Phase 7 Stage 1 — small inline error message rendered below an input
// when a field is empty (required) or contains badly-formatted content
// (optional with format).
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
//                 (Rules 4, 5, 6, 7)
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §4 #11, §9
//
// Pure presentational — accepts a translation key + placeholders. Visibility
// is controlled by the caller per visit-tracking rules.

'use client';

import React from 'react';

import { useTranslation } from '@/contexts/TranslationContext';

interface FieldErrorMessageProps {
  /** Translation key for the error message (e.g., 'candidate.validation.field.required'). */
  messageKey: string;
  placeholders?: Record<string, string | number>;
  /** Optional fieldName used to form a stable id for screen-reader hookup. */
  fieldName?: string;
}

export function FieldErrorMessage(props: FieldErrorMessageProps) {
  const { t } = useTranslation();
  const id = props.fieldName ? `${props.fieldName}-error` : undefined;

  return (
    <p
      id={id}
      role="alert"
      // .form-error is the existing global class for form-error styling.
      // Component Standards forbids inline styles; this picks up red text +
      // small font automatically.
      className="form-error mt-1 text-sm text-red-700"
    >
      {t(props.messageKey, props.placeholders)}
    </p>
  );
}
