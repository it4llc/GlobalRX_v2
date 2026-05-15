// /GlobalRX_v2/src/lib/candidate/useStepNavigation.ts
// Portal layout extraction — Hook 3 (NAV). See
// docs/plans/portal-layout-extraction-technical-plan.md §2.3 / §4.2.
//
// handleSectionClick is intentionally NOT a useCallback (see plan §4.2)
// — callers omit it from dep arrays via eslint-disable-next-line.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { clientLogger as logger } from '@/lib/client-logger';

import type { CandidatePortalSection } from '@/types/candidate-portal';
import type { SectionStatus } from '@/types/candidate-stage4';

type SectionWithStatus = CandidatePortalSection & { status: SectionStatus };

interface UseStepNavigationInput {
  /** Default section id (first sidebar entry) — used as initial state. */
  defaultSection: string | null;
  /** From MERGE. Drives Next/Back walk and the safety-net effect. */
  visibleSectionsWithStatus: SectionWithStatus[];
  /** From MERGE — only needed for the safety-net effect's "previousOrder"
   *  lookup (we need the order of a section that may have been filtered
   *  out of the visible list). */
  sectionsWithStatus: SectionWithStatus[];
  /** Visit-tracking callbacks from usePortalValidation. */
  markSectionVisited: (sectionId: string) => void;
  markSectionDeparted: (sectionId: string) => void;
  markReviewVisited: () => void;
}

interface UseStepNavigationOutput {
  /** Id of the section the candidate is currently viewing. */
  activeSection: string | null;
  /** Memoised alias for `visibleSectionsWithStatus`. */
  navigableSections: SectionWithStatus[];
  /** Index of `activeSection` within `navigableSections`, or `-1`. */
  activeSectionIndex: number;
  /** Click handler used by sidebar, ReviewSubmitPage error navigation,
   *  Next/Back. Inline closure (NOT useCallback) — see file header. */
  handleSectionClick: (sectionId: string) => void;
  /** Next/Back button handlers. */
  handleNextClick: () => void;
  handleBackClick: () => void;
}

export function useStepNavigation(
  input: UseStepNavigationInput,
): UseStepNavigationOutput {
  const {
    defaultSection,
    visibleSectionsWithStatus,
    sectionsWithStatus,
    markSectionVisited,
    markSectionDeparted,
    markReviewVisited,
  } = input;

  const [activeSection, setActiveSection] = useState<string | null>(defaultSection);

  // Phase 7 Stage 1 — every section click marks the previously-active section
  // as departed (Rule 1 / 2) and the new section as visited (first-visit only).
  // Clicking the synthetic Review & Submit entry additionally flips
  // reviewPageVisitedAt from null → ISO timestamp (Rule 3 / 34), which makes
  // every section's errors eligible for display on its next render.
  const handleSectionClick = (sectionId: string) => {
    if (activeSection && activeSection !== sectionId) {
      markSectionDeparted(activeSection);
    }
    if (sectionId === 'review_submit') {
      markReviewVisited();
    } else {
      markSectionVisited(sectionId);
    }
    setActiveSection(sectionId);
  };

  // Task 8.2 (Linear Step Navigation) — derived navigable section list and
  // the index of the currently-active section. After Task 8.5 the
  // navigable list is the FILTERED `visibleSectionsWithStatus` — dynamic
  // steps that have no content are excluded so Next/Back walks straight
  // over them (Spec Business Rules 5 / 6, edge cases 4 / 5). The shell
  // still does not maintain a separate "skip" map; visibility is derived
  // from upstream state every render.
  const navigableSections = useMemo(
    () => visibleSectionsWithStatus,
    [visibleSectionsWithStatus],
  );

  const activeSectionIndex = useMemo(() => {
    if (!activeSection) return -1;
    return navigableSections.findIndex((s) => s.id === activeSection);
  }, [navigableSections, activeSection]);

  // Task 8.2 (Linear Step Navigation) — Next/Back click handlers. Both
  // delegate to the existing `handleSectionClick` so visit tracking and
  // validation gating continue to flow through a single code path (spec
  // rule 7). After navigating we scroll the candidate back to the top of
  // the new section so they aren't stranded at the bottom (spec rule 11).
  // We scroll BOTH the window AND the `<main>` overflow container because
  // the candidate portal puts its scroll inside an overflow-y-auto main
  // element on desktop and uses window scroll on smaller viewports.
  const scrollNewSectionIntoView = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (scrollError) {
      // jsdom and some older browsers throw when behavior is unsupported.
      // Log the original failure (CODING S4.3) before attempting the fallback.
      logger.debug('portal-layout: window.scrollTo failed, attempting fallback', {
        error: scrollError instanceof Error ? scrollError.message : 'Unknown error',
      });
      try {
        if (document?.documentElement) {
          document.documentElement.scrollTop = 0;
        }
      } catch (fallbackError) {
        // Scroll failure is non-fatal for navigation, but we still log it
        // so the failure isn't silently swallowed (standards-checker fix).
        logger.debug('portal-layout: scrollTop fallback failed', {
          error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        });
      }
    }
    // Also reset the inner overflow container in case the portal's main
    // element is the actual scroll surface (desktop layout uses
    // `<main className="flex-1 bg-white overflow-y-auto">`). We target the
    // `<main>` element directly because the `data-testid="main-content"`
    // attribute is attached to inner content wrappers (`<div className="p-6">`)
    // that are not scrollable — setting scrollTop on those is a silent no-op.
    if (typeof document !== 'undefined') {
      const main = document.querySelector('main') as HTMLElement | null;
      if (main) {
        main.scrollTop = 0;
      }
    }
  }, []);

  const handleNextClick = useCallback(() => {
    if (activeSectionIndex < 0) return;
    const next = navigableSections[activeSectionIndex + 1];
    if (!next) return;
    handleSectionClick(next.id);
    scrollNewSectionIntoView();
    // handleSectionClick is defined inline above (not a useCallback) and
    // closes over the latest activeSection / mark* hooks. We intentionally
    // omit it from deps to avoid recreating this callback on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionIndex, navigableSections, scrollNewSectionIntoView]);

  const handleBackClick = useCallback(() => {
    if (activeSectionIndex < 0) return;
    const prev = navigableSections[activeSectionIndex - 1];
    if (!prev) return;
    handleSectionClick(prev.id);
    scrollNewSectionIntoView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionIndex, navigableSections, scrollNewSectionIntoView]);

  // Task 8.5 — safety net for spec edge case 2. The spec's resolved
  // question 1 says recalculation cannot run while the candidate is "on"
  // a step (because recalculation runs on navigation arrival). This
  // effect catches the rare race where a different section's state change
  // hides the currently-active step — e.g., a save callback from another
  // tab clears the registry source for the active Personal Info step.
  // When that happens we silently navigate to the next visible step in
  // the linear flow (spec rules 5 / 6 / 8 — no banner, no toast).
  useEffect(() => {
    if (!activeSection) return;
    const stillVisible = visibleSectionsWithStatus.some(
      (s) => s.id === activeSection,
    );
    if (stillVisible) return;
    const previous = sectionsWithStatus.find((s) => s.id === activeSection);
    const previousOrder = previous?.order ?? -1;
    const next =
      visibleSectionsWithStatus.find((s) => s.order > previousOrder) ??
      visibleSectionsWithStatus[0];
    if (next) {
      handleSectionClick(next.id);
    }
    // handleSectionClick is an inline closure (intentionally not a
    // useCallback) — adding it here would force the effect to fire every
    // render. Visit/departure tracking still flows through it via the
    // closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleSectionsWithStatus, activeSection, sectionsWithStatus]);

  return {
    activeSection,
    navigableSections,
    activeSectionIndex,
    handleSectionClick,
    handleNextClick,
    handleBackClick,
  };
}
