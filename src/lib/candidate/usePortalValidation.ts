// /GlobalRX_v2/src/lib/candidate/usePortalValidation.ts
//
// Phase 7 Stage 1 — custom React hook that owns the candidate portal's
// visit-tracking state and validation result, exposes callbacks to mark
// section visits/departures + Review-page visits, and refreshes
// /validate after auto-saves.
//
// Spec:           docs/specs/phase7-stage1-validation-scope-gaps-review.md
// Technical plan: docs/specs/phase7-stage1-validation-scope-gaps-review-technical-plan.md §5.4a
//
// Why a hook:
//   portal-layout.tsx is large enough that adding visit-tracking +
//   validation-fetch logic inline would push it past the file-size soft
//   trigger. Extracting it here keeps the hook reusable and the layout
//   focused on layout.

'use client';

import { useCallback, useEffect, useState } from 'react';

import { clientLogger as logger } from '@/lib/client-logger';
import {
  mergeReviewPageVisitedAt,
  mergeSectionVisits,
  shouldShowErrorsForSection,
  type IncomingVisitUpdate,
  type SectionVisitsMap,
} from './sectionVisitTracking';
import type { FullValidationResult } from './validation/types';

interface UsePortalValidationInput {
  token: string;
  initialSectionVisits?: SectionVisitsMap;
  initialReviewPageVisitedAt?: string | null;
  // When true, we suspend automatic /validate refreshes (used while the
  // portal is still hydrating so we don't fire an extra request before the
  // candidate has interacted with anything).
  paused?: boolean;
}

interface UsePortalValidationOutput {
  sectionVisits: SectionVisitsMap;
  reviewPageVisitedAt: string | null;
  validationResult: FullValidationResult | null;
  /** True for sections that should show their errors (Rule 4 / 8 / 34). */
  isErrorVisible: (sectionId: string) => boolean;
  markSectionVisited: (sectionId: string) => void;
  markSectionDeparted: (sectionId: string) => void;
  markReviewVisited: () => void;
  refreshValidation: () => Promise<void>;
}

export function usePortalValidation(
  input: UsePortalValidationInput,
): UsePortalValidationOutput {
  const { token, paused = false } = input;
  const [sectionVisits, setSectionVisits] = useState<SectionVisitsMap>(
    input.initialSectionVisits ?? {},
  );
  const [reviewPageVisitedAt, setReviewPageVisitedAt] = useState<string | null>(
    input.initialReviewPageVisitedAt ?? null,
  );
  const [validationResult, setValidationResult] = useState<FullValidationResult | null>(null);

  const refreshValidation = useCallback(async () => {
    if (paused) return;
    try {
      const res = await fetch(`/api/candidate/application/${token}/validate`, {
        method: 'POST',
      });
      if (!res.ok) {
        // Spec Edge 12: fail gracefully — keep last known state.
        logger.warn('candidate_validation_fetch_failed', { status: res.status });
        return;
      }
      const data = (await res.json()) as FullValidationResult;
      setValidationResult(data);
    } catch (err) {
      logger.warn('candidate_validation_fetch_error', {
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [token, paused]);

  // Trigger an initial /validate fetch once on mount.
  useEffect(() => {
    void refreshValidation();
  }, [refreshValidation]);

  const postVisitTracking = useCallback(
    async (
      visitUpdates: IncomingVisitUpdate[],
      reviewVisitedAt: string | null,
    ) => {
      try {
        await fetch(`/api/candidate/application/${token}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionType: 'section_visit_tracking',
            ...(visitUpdates.length > 0 ? { sectionVisits: visitUpdates } : {}),
            ...(reviewVisitedAt !== null
              ? { reviewPageVisitedAt: reviewVisitedAt }
              : {}),
          }),
        });
      } catch (err) {
        logger.warn('candidate_visit_tracking_save_failed', {
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    },
    [token],
  );

  const markSectionVisited = useCallback(
    (sectionId: string) => {
      const now = new Date().toISOString();
      setSectionVisits((prev) => {
        // Only set visitedAt if it doesn't already exist (Rule 2 — we don't
        // re-set the visit time on subsequent visits).
        if (prev[sectionId]) return prev;
        const update: IncomingVisitUpdate = {
          sectionId,
          visitedAt: now,
          departedAt: null,
        };
        const next = mergeSectionVisits(prev, [update]);
        void postVisitTracking([update], null);
        return next;
      });
    },
    [postVisitTracking],
  );

  const markSectionDeparted = useCallback(
    (sectionId: string) => {
      const now = new Date().toISOString();
      setSectionVisits((prev) => {
        const visit = prev[sectionId];
        // Only update if the section has been visited and not yet departed
        // (Rule 2 — once departed, never un-depart).
        if (!visit || visit.departedAt !== null) return prev;
        const update: IncomingVisitUpdate = {
          sectionId,
          visitedAt: visit.visitedAt,
          departedAt: now,
        };
        const next = mergeSectionVisits(prev, [update]);
        void postVisitTracking([update], null);
        // Refresh validation so the now-departed section's errors surface.
        void refreshValidation();
        return next;
      });
    },
    [postVisitTracking, refreshValidation],
  );

  const markReviewVisited = useCallback(() => {
    const now = new Date().toISOString();
    setReviewPageVisitedAt((prev) => {
      const next = mergeReviewPageVisitedAt(prev, now);
      // Only post when the value transitions from null → set (Rule 3).
      if (prev === null && next === now) {
        void postVisitTracking([], now);
        // Refresh validation immediately so all sections become eligible
        // for error display per Rule 34.
        void refreshValidation();
      }
      return next;
    });
  }, [postVisitTracking, refreshValidation]);

  const isErrorVisible = useCallback(
    (sectionId: string) =>
      shouldShowErrorsForSection(sectionId, sectionVisits, reviewPageVisitedAt),
    [sectionVisits, reviewPageVisitedAt],
  );

  return {
    sectionVisits,
    reviewPageVisitedAt,
    validationResult,
    isErrorVisible,
    markSectionVisited,
    markSectionDeparted,
    markReviewVisited,
    refreshValidation,
  };
}
