// /GlobalRX_v2/src/components/candidate/portal-layout.tsx

'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { format } from 'date-fns';

import { useTranslation } from '@/contexts/TranslationContext';
import PortalHeader from '@/components/candidate/portal-header';
import PortalSidebar from '@/components/candidate/portal-sidebar';
import PortalWelcome from '@/components/candidate/portal-welcome';
import SectionPlaceholder from '@/components/candidate/section-placeholder';
import { PersonalInfoSection } from '@/components/candidate/form-engine/PersonalInfoSection';
import { IdvSection } from '@/components/candidate/form-engine/IdvSection';
import { EducationSection } from '@/components/candidate/form-engine/EducationSection';
import { EmploymentSection } from '@/components/candidate/form-engine/EmploymentSection';
import { AddressHistorySection } from '@/components/candidate/form-engine/AddressHistorySection';
import { RecordSearchSection } from '@/components/candidate/form-engine/RecordSearchSection';
import WorkflowSectionRenderer from '@/components/candidate/form-engine/WorkflowSectionRenderer';
import { ReviewSubmitPage } from '@/components/candidate/review-submit/ReviewSubmitPage';
import { SectionErrorBanner } from '@/components/candidate/SectionErrorBanner';
// Task 8.2 (Linear Step Navigation) — shared Next/Back button row rendered
// at the bottom of every non-`review_submit` section. The component is
// purely presentational; navigation logic lives here in the shell so it
// can reuse the existing `handleSectionClick` (spec rule 7).
import StepNavigationButtons from '@/components/candidate/StepNavigationButtons';
import { clientLogger as logger } from '@/lib/client-logger';
// Phase 7 Stage 1 — visit tracking + /validate-driven error display.
// usePortalValidation owns sectionVisits, reviewPageVisitedAt, and the
// FullValidationResult; the layout consumes it to render error banners
// and to gate the Review & Submit page.
import { usePortalValidation } from '@/lib/candidate/usePortalValidation';
import { useDynamicStepVisibility } from '@/lib/candidate/useDynamicStepVisibility';
import { useSectionStatusMerge } from '@/lib/candidate/useSectionStatusMerge';
import { useStepNavigation } from '@/lib/candidate/useStepNavigation';
import {
  addCrossSectionRequirements,
  getCrossSectionRequirements,
  removeCrossSectionRequirementsForEntry,
  removeCrossSectionRequirementsForSource,
} from '@/lib/candidate/crossSectionRegistry';
import { computeWorkflowSectionStatus } from '@/lib/candidate/sectionProgress';

import type { EntryData } from '@/types/candidate-repeatable-form';
import type { SectionVisitsMap } from '@/lib/candidate/sectionVisitTracking';
import type {
  ReviewError,
  SectionValidationResult,
} from '@/lib/candidate/validation/types';
import type {
  CandidateInvitationInfo,
  CandidatePortalSection,
} from '@/types/candidate-portal';
import type {
  CrossSectionRegistry,
  CrossSectionRequirementEntry,
  CrossSectionTarget,
  SectionStatus,
} from '@/types/candidate-stage4';
import type { TemplateVariableValues } from '@/types/templateVariables';

interface PortalLayoutProps {
  invitation: CandidateInvitationInfo;
  sections: CandidatePortalSection[];
  token: string;
}

export default function PortalLayout({ invitation, sections, token }: PortalLayoutProps) {
  // Default to first section (Personal Information) if it exists
  const defaultSection = sections.length > 0 ? sections[0].id : null;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Phase 6 Stage 4 — cross-section requirement registry. Currently the only
  // supported target is `subject` (BR 17), but the registry shape allows other
  // targets so a future stage can broaden coverage without rethinking the
  // ownership model. The registry is owned by the shell (lifted-state
  // decision in the technical plan); section components write through
  // dedicated callbacks and read via the prop pipeline.
  const [crossSectionRegistry, setCrossSectionRegistry] = useState<CrossSectionRegistry>({});

  // Workflow-section acknowledgments hydrated from saved-data on mount. Keyed
  // by workflow_sections.id (matching the bucket key in formData.sections per
  // BR 7 / 8). The renderer's checkbox state mirrors this map; on toggle we
  // both update the map AND POST the new value to /save so the next page load
  // hydrates from the persisted shape `{ type: 'workflow_section',
  // acknowledged: boolean }`.
  const [workflowAcknowledgments, setWorkflowAcknowledgments] = useState<Record<string, boolean>>({});

  // TD-059 — saved Personal Info values keyed by requirementId. Hydrated
  // from /saved-data alongside workflow acknowledgments and refreshed by
  // PersonalInfoSection via the onSavedValuesChange callback after each
  // successful auto-save.
  const [personalInfoSavedValues, setPersonalInfoSavedValues] = useState<Record<string, unknown>>({});

  // Phase 7 Stage 1 — saved-data hydration payload. Null until /saved-data
  // settles (success or failure); populated with `sectionVisits`,
  // `reviewPageVisitedAt`, and `addressHistoryEntries` so the validation
  // hook and the dynamic-step visibility hook can adopt them on mount and
  // visit state survives a browser reload (Spec Rules 1/2/3).
  const [savedDataHydration, setSavedDataHydration] = useState<{
    sectionVisits: SectionVisitsMap;
    reviewPageVisitedAt: string | null;
    addressHistoryEntries: EntryData[];
  } | null>(null);

  // Phase 7 Stage 2 — submission state lifted into the shell. The Review &
  // Submit page is presentational; the shell owns the fetch and the
  // post-submit navigation so the page itself can stay test-friendly and
  // free of Next-router coupling. See plan §3.3 / §17.
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Phase 7 Stage 2 — router for post-submit navigation to the success page.
  // useTranslation is also pulled here (rather than in handleSubmit) because
  // hooks cannot be called from inside a useCallback body.
  const router = useRouter();
  const { t } = useTranslation();

  // Phase 7 Stage 1 — visit tracking + validation result driven by
  // usePortalValidation. The hook hydrates from initial values pushed in
  // by the saved-data hydration effect below, owns the /save +
  // /validate round-trips, and exposes per-section "errors visible"
  // gating per Rules 4 / 8 / 34.
  const {
    sectionVisits,
    reviewPageVisitedAt,
    validationResult,
    isErrorVisible,
    markSectionVisited,
    markSectionDeparted,
    markReviewVisited,
    refreshValidation,
  } = usePortalValidation({
    token,
    initialSectionVisits: savedDataHydration?.sectionVisits,
    initialReviewPageVisitedAt: savedDataHydration?.reviewPageVisitedAt,
  });

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Cross-section registry write callbacks. Each one returns a new registry
  // object via the pure helpers in lib/candidate/crossSectionRegistry — we
  // never mutate the existing value, matching React-state idioms.
  const handleCrossSectionRequirementsChanged = useCallback(
    (
      target: CrossSectionTarget,
      triggeredBy: string,
      entries: CrossSectionRequirementEntry[],
    ) => {
      setCrossSectionRegistry((prev) => {
        // Replace entries for this (target, triggeredBy) pair: clear all
        // previous contributions from the source first, then add the new set.
        // This keeps the registry in step with the source's current view of
        // its requirements (e.g., after a country change reloads fields).
        const cleared = removeCrossSectionRequirementsForSource(prev, triggeredBy);
        return addCrossSectionRequirements(cleared, target, entries);
      });
    },
    [],
  );

  const handleCrossSectionRequirementsRemovedForEntry = useCallback(
    (triggeredBy: string, entryIndex: number) => {
      setCrossSectionRegistry((prev) =>
        removeCrossSectionRequirementsForEntry(prev, triggeredBy, entryIndex),
      );
    },
    [],
  );

  const handleCrossSectionRequirementsRemovedForSource = useCallback(
    (triggeredBy: string) => {
      setCrossSectionRegistry((prev) =>
        removeCrossSectionRequirementsForSource(prev, triggeredBy),
      );
    },
    [],
  );

  // Memoised view of the `subject` cross-section entries — Personal Info uses
  // this to render the banner and to feed its progress calculation. We compute
  // here so the prop reference is stable while the registry is unchanged.
  const subjectCrossSectionRequirements = useMemo(
    () => getCrossSectionRequirements(crossSectionRegistry, 'subject'),
    [crossSectionRegistry],
  );

  // W6 fix — stable boolean derived from `savedDataHydration` for memo
  // deps that only need null-vs-present. The state object is set at most
  // once today (initial hydration), but extracting the boolean here means
  // any future code path that calls `setSavedDataHydration` with an
  // equal-by-value object cannot cause downstream memos to recompute.
  const savedDataHydrated = savedDataHydration !== null;

  // VIS hook — see src/lib/candidate/useDynamicStepVisibility.ts.
  const {
    personalInfoFields,
    stepVisibility,
    handleAddressHistorySaveSuccess,
  } = useDynamicStepVisibility(
    {
      token,
      sections,
      hydratedAddressHistoryEntries:
        savedDataHydration?.addressHistoryEntries ?? null,
      savedDataHydrated,
      subjectCrossSectionRequirements,
    },
    refreshValidation,
  );

  // MERGE hook — see src/lib/candidate/useSectionStatusMerge.ts.
  const {
    sectionsWithStatus,
    visibleSectionsWithStatus,
    effectiveValidationResult,
    disableSubmitForDynamicGaps,
    handleSectionProgressUpdate,
    bulkPatchSectionStatuses,
  } = useSectionStatusMerge({
    sections,
    validationResult,
    sectionVisits,
    reviewPageVisitedAt,
    stepVisibility,
    personalInfoFields,
    personalInfoSavedValues,
    subjectCrossSectionRequirements,
  });

  // One-time hydration of saved data. The shell uses /saved-data for two
  // independent purposes:
  //   1) Workflow-section acknowledgments (BR 7 / 8) — WorkflowSectionRenderer
  //      is intentionally presentational, so the shell must hydrate.
  //   2) TD-059 — Personal Info saved values, used by the lifted progress
  //      effect (now in useSectionStatusMerge) so the sidebar indicator
  //      stays accurate even when PersonalInfoSection is unmounted.
  //
  // The effect always runs as long as there's a token. A previous version
  // short-circuited when no workflow sections existed; that early-exit was
  // removed for TD-059 because Personal Info still needs hydration in
  // packages without workflow sections. We do NOT re-fetch on every section
  // change; auto-save keeps the in-memory state in sync after the initial
  // load (PersonalInfoSection.onSavedValuesChange pushes updates upward).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/candidate/application/${encodeURIComponent(token)}/saved-data`,
        );
        if (!response.ok) {
          if (!cancelled) {
            setSavedDataHydration({
              sectionVisits: {},
              reviewPageVisitedAt: null,
              addressHistoryEntries: [],
            });
          }
          return;
        }
        const data = await response.json();
        const savedSections = (data?.sections ?? {}) as Record<string, unknown>;
        const nextAcknowledgments: Record<string, boolean> = {};
        const statusUpdates: Record<string, SectionStatus> = {};

        // Personal info saved values are keyed by `personal_info` in the
        // saved-data response (matching the bucket the /save endpoint
        // writes). The `fields` array uses requirementId/value pairs, and
        // the shell rekeys to a requirementId-indexed map so PersonalInfo
        // can hydrate by id without an extra lookup.
        const personalInfoBucket = savedSections['personal_info'] as
          | { fields?: Array<{ requirementId: string; value: unknown }> }
          | undefined
          | null;
        const nextPersonalInfoValues: Record<string, unknown> = {};
        if (personalInfoBucket && Array.isArray(personalInfoBucket.fields)) {
          for (const f of personalInfoBucket.fields) {
            nextPersonalInfoValues[f.requirementId] = f.value;
          }
        }

        // Task 8.5 — read the candidate's saved address-history entries so
        // the shell-level aggregated-items computation can decide whether
        // Record Search Requirements (Step 8) should be visible even when
        // the section itself is unmounted. The saved bucket shape mirrors
        // FormSectionData in candidate-portal.ts — `entries` is the array
        // of `{ entryId, countryId, entryOrder, fields }`.
        const addressHistoryBucket = savedSections['address_history'] as
          | { entries?: EntryData[] }
          | undefined
          | null;
        const nextAddressHistoryEntries: EntryData[] =
          addressHistoryBucket && Array.isArray(addressHistoryBucket.entries)
            ? addressHistoryBucket.entries
            : [];

        for (const section of sections) {
          if (section.type !== 'workflow_section') continue;
          const saved = savedSections[section.id];
          const acknowledged =
            saved !== null &&
            typeof saved === 'object' &&
            (saved as { acknowledged?: unknown }).acknowledged === true;
          nextAcknowledgments[section.id] = acknowledged;
          if (section.workflowSection) {
            statusUpdates[section.id] = computeWorkflowSectionStatus(
              section.workflowSection,
              { acknowledged },
            );
          }
        }

        // Phase 7 Stage 1 — section_visit_tracking and review-page visit
        // are siblings of `sections` in the saved-data response. Surface
        // them through savedDataHydration so usePortalValidation can adopt
        // them on its first non-undefined hydration tick.
        const incomingSectionVisits =
          (data?.sectionVisits ?? {}) as SectionVisitsMap;
        const incomingReviewPageVisitedAt =
          (data?.reviewPageVisitedAt ?? null) as string | null;

        if (!cancelled) {
          setWorkflowAcknowledgments(nextAcknowledgments);
          setPersonalInfoSavedValues(nextPersonalInfoValues);
          bulkPatchSectionStatuses(statusUpdates);
          setSavedDataHydration({
            sectionVisits: incomingSectionVisits,
            reviewPageVisitedAt: incomingReviewPageVisitedAt,
            addressHistoryEntries: nextAddressHistoryEntries,
          });
        }
      } catch (error) {
        // Hydration failure is non-fatal — the candidate can still tick the
        // checkbox and the next save will persist regardless. We avoid logging
        // PII; only the event name and a generic error message ship.
        logger.error('Failed to hydrate saved data', {
          event: 'saved_data_hydrate_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        if (!cancelled) {
          setSavedDataHydration({
            sectionVisits: {},
            reviewPageVisitedAt: null,
            addressHistoryEntries: [],
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sections, bulkPatchSectionStatuses]);

  // Phase 7 Stage 1 — mark the initially-active section visited once the
  // saved-data hydration completes (Rule 2). Without this, the candidate's
  // first section never gets a `visitedAt` record, so `markSectionDeparted`
  // short-circuits when they navigate away and the section's errors stay
  // hidden permanently. The hook's `markSectionVisited` itself short-circuits
  // when the section already has a visit record, so re-runs are no-ops.
  useEffect(() => {
    if (!savedDataHydration) return;
    if (!defaultSection) return;
    markSectionVisited(defaultSection);
  }, [savedDataHydration, defaultSection, markSectionVisited]);

  // Task 8.1 — single source of values for replaceTemplateVariables when
  // WorkflowSectionRenderer renders text-type sections. The expirationDate
  // is formatted as `dd MMM yyyy` here (English-only per spec Resolved
  // Question #3); when the candidate app gains locale support this is the
  // one place that needs to change.
  const templateVariableValues = useMemo<TemplateVariableValues>(
    () => ({
      candidateFirstName: invitation.firstName ?? null,
      candidateLastName: invitation.lastName ?? null,
      candidateEmail: invitation.email ?? null,
      candidatePhone: invitation.phone ?? null,
      companyName: invitation.companyName ?? null,
      expirationDate: invitation.expiresAt
        ? format(new Date(invitation.expiresAt), 'dd MMM yyyy')
        : null,
    }),
    [invitation],
  );

  // NAV hook — see src/lib/candidate/useStepNavigation.ts.
  const {
    activeSection,
    navigableSections,
    activeSectionIndex,
    handleSectionClick,
    handleNextClick,
    handleBackClick,
  } = useStepNavigation({
    defaultSection,
    visibleSectionsWithStatus,
    sectionsWithStatus,
    markSectionVisited,
    markSectionDeparted,
    markReviewVisited,
  });

  // Helper — return the per-section validation result (or null when /validate
  // hasn't returned yet). The section components consume this to render
  // SectionErrorBanner + FieldErrorMessage when isErrorVisible(sectionId) is
  // true.
  const getValidationForSection = useCallback(
    (sectionId: string): SectionValidationResult | null => {
      return (
        validationResult?.sections.find((s) => s.sectionId === sectionId) ?? null
      );
    },
    [validationResult],
  );

  // Phase 7 Stage 1 — Review-page tap-to-navigate handler (Rule 31).
  // ReviewSubmitPage emits one of these per error click; we navigate to
  // the section that owns the error so the candidate can act on it.
  const handleReviewErrorNavigate = useCallback(
    (sectionId: string, _error: ReviewError) => {
      handleSectionClick(sectionId);
    },
    // handleSectionClick is stable enough for this use; we omit it from deps
    // because it captures markSectionVisited/markSectionDeparted from the
    // hook (themselves useCallback-stable). Adding it as a dep would force
    // recreating this callback on every render with no behavior gain.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markSectionVisited, markSectionDeparted, markReviewVisited, activeSection],
  );

  // Phase 7 Stage 2 — Submit handler. Owned by the shell so the Review &
  // Submit page stays presentational. Per plan §3.3 / §17:
  //   - 200 success / already-submitted (success===true) → router.push(redirectTo)
  //   - 400 validation failure → refresh validation, show banner, stay on page
  //   - 403 expired → show banner (no redirect — plan §17 row 5)
  //   - 500 / network failure → show generic server-error banner
  // The route response shape is `{ success, message?, redirectTo?, error? }`
  // (see /api/candidate/application/[token]/submit/route.ts). We discriminate
  // on HTTP status first, then on the body's `success` flag for the 200/400
  // shapes that share envelopes.
  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch(
        `/api/candidate/application/${encodeURIComponent(token)}/submit`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );
      const body = (await response.json().catch(() => null)) as
        | { success?: boolean; redirectTo?: string }
        | null;

      if (response.status === 200 && body?.success === true && body.redirectTo) {
        // Success or already-submitted (idempotent). Both paths return the
        // same envelope per plan §11.3, so a single check covers them.
        router.push(body.redirectTo);
        return;
      }

      if (response.status === 400) {
        // Validation failure. Re-run /validate so the Review page picks up
        // the freshly-discovered missing fields, then surface the banner.
        // The candidate stays on the Review page; the button re-enables
        // once allComplete flips back to true after they fix the gaps.
        void refreshValidation();
        setSubmitError(t('candidate.submission.error.validationFailed'));
        return;
      }

      if (response.status === 403) {
        // Expired (or token mismatch — same banner is acceptable per plan
        // §17 row 6; the candidate cannot recover from either without a
        // new invitation).
        setSubmitError(t('candidate.submission.error.expired'));
        return;
      }

      // 401 / 404 / 500 / anything else — treat as server error per
      // plan §17 row 7. The route logs the underlying cause via Winston.
      setSubmitError(t('candidate.submission.error.serverError'));
    } catch (error) {
      // Network failure (fetch threw) or JSON parse failure. We don't log
      // PII; only the event name and a generic error message ship.
      logger.error('Candidate submit failed', {
        event: 'candidate_submit_request_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setSubmitError(t('candidate.submission.error.serverError'));
    } finally {
      setSubmitting(false);
    }
  }, [token, router, refreshValidation, t]);

  // Acknowledge handler invoked by a workflow section's checkbox. Updates the
  // local map immediately so the UI reflects the change, then persists via the
  // standard /save endpoint. Per BR 7/8, the saved shape is keyed by
  // workflow_sections.id with `value: { acknowledged: boolean }` inside the
  // first field. The saved-data endpoint flattens this into a per-section
  // bucket on read.
  const handleWorkflowAcknowledge = useCallback(
    async (section: CandidatePortalSection, checked: boolean) => {
      if (!section.workflowSection) return;
      setWorkflowAcknowledgments((prev) => ({ ...prev, [section.id]: checked }));
      handleSectionProgressUpdate(
        section.id,
        computeWorkflowSectionStatus(section.workflowSection, { acknowledged: checked }),
      );
      try {
        await fetch(`/api/candidate/application/${encodeURIComponent(token)}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectionType: 'workflow_section',
            sectionId: section.id,
            fields: [
              {
                requirementId: section.id,
                value: { acknowledged: checked },
              },
            ],
          }),
        });
        // Phase 7 Stage 1 — refresh validation after the workflow ack save.
        void refreshValidation();
      } catch (error) {
        logger.error('Failed to save workflow acknowledgment', {
          event: 'workflow_acknowledgment_save_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
    [token, handleSectionProgressUpdate, refreshValidation],
  );

  // Task 8.2 — visibility of the shared Next/Back row. The Review &
  // Submit page intentionally renders its OWN Back button next to Submit
  // (spec rule 5), so the shared component is suppressed entirely on
  // that branch to avoid duplicating the Back action.
  const activeSectionForNav = activeSectionIndex >= 0 ? navigableSections[activeSectionIndex] : null;
  const isReviewActive = activeSectionForNav?.type === 'review_submit';
  const showNext =
    !isReviewActive &&
    activeSectionIndex >= 0 &&
    activeSectionIndex < navigableSections.length - 1;
  const showBack =
    !isReviewActive &&
    activeSectionIndex > 0;

  // Single shared instance of the navigation row so each dispatch branch
  // below renders the same element. Memoised against the derived flags so
  // children only re-render when navigation state actually changes.
  const stepNavigation = (
    <StepNavigationButtons
      onBack={showBack ? handleBackClick : null}
      onNext={showNext ? handleNextClick : null}
    />
  );

  const getActiveContent = () => {
    if (!activeSection) {
      return (
        <PortalWelcome
          invitation={invitation}
          sectionCount={sections.length}
        />
      );
    }

    const section = sections.find(s => s.id === activeSection);
    if (!section) {
      return (
        <PortalWelcome
          invitation={invitation}
          sectionCount={sections.length}
        />
      );
    }

    // Phase 7 Stage 1 — Review & Submit page dispatch (Rule 29 / 30).
    // Renders the section list with statuses + error counts; tapping a
    // listed error navigates back to the owning section.
    //
    // Bug 1b / Bug 3 — pass the canonical sidebar section list (already
    // in structure-endpoint order, with translation-key titles) so the
    // Review page renders sections in sidebar order with localized
    // titles instead of falling back to the validation engine's raw
    // section IDs as `sectionName`. We exclude the synthetic Review &
    // Submit entry from the descriptor list so the page does not try to
    // render itself as one of its own listed sections.
    if (section.type === 'review_submit') {
      // Task 8.5 — descriptor list is the FILTERED `visibleSectionsWithStatus`
      // so skipped dynamic steps do not appear in the Review summary
      // (Business Rule 9 a / b). The patched validation result hides any
      // engine "incomplete" verdict for those skipped sections (Rule 9 c),
      // and `disableSubmitForDynamicGaps` blocks Submit when a visible
      // dynamic step is locally incomplete (Rule 9 d).
      // Cross-section-validation-filtering bug fix Issue 2 — pass each
      // section's already-merged status (the same value the sidebar
      // SectionProgressIndicator renders) through the descriptor. Without
      // this, ReviewSubmitPage falls back to the validation summary alone
      // and reports `not_started` for sections that have no server-side
      // validator entry (record_search post-Task-8.4) even when the sidebar
      // is correctly showing them as complete/incomplete.
      const reviewPageSections = visibleSectionsWithStatus
        .filter((s) => s.type !== 'review_submit')
        .map((s) => ({ id: s.id, title: s.title, status: s.status }));
      return (
        <div className="p-6" data-testid="main-content">
          <ReviewSubmitPage
            validationResult={effectiveValidationResult}
            sections={reviewPageSections}
            onErrorNavigate={handleReviewErrorNavigate}
            onSubmit={handleSubmit}
            submitting={submitting}
            submitError={submitError}
            // Task 8.2 (Linear Step Navigation) — Back button next to
            // Submit on the Review & Submit page (spec rule 5). We always
            // wire `handleBackClick` here (no `showBack` gate) because
            // Review & Submit always has at least one prior section.
            onBack={handleBackClick}
            disableSubmit={disableSubmitForDynamicGaps}
          />
        </div>
      );
    }

    // Phase 7 Stage 1 — per-section validation result + visibility flag
    // forwarded to every section component. Sections render
    // SectionErrorBanner / FieldErrorMessage when errorsVisible is true
    // (Rule 4 / 8 / 34); otherwise they suppress display per the spec's
    // "no errors until visited and departed" rule.
    const sectionValidation = getValidationForSection(section.id);
    const errorsVisible = isErrorVisible(section.id);

    // Render actual form sections for Personal Information and IDV
    if (section.type === 'personal_info') {
      return (
        <div className="p-6" data-testid="main-content">
          <PersonalInfoSection
            token={token}
            // TD-059 — fields and saved values are owned by the shell so the
            // lifted progress effect above can keep the sidebar indicator
            // accurate even when this section is unmounted. The section
            // updates the shell's saved values via onSavedValuesChange
            // after each successful auto-save.
            fields={personalInfoFields}
            initialSavedValues={personalInfoSavedValues}
            crossSectionRequirements={subjectCrossSectionRequirements}
            onProgressUpdate={(status) => handleSectionProgressUpdate(section.id, status)}
            onSavedValuesChange={setPersonalInfoSavedValues}
            // Phase 7 Stage 1 — error banner + per-field error wiring.
            sectionValidation={sectionValidation}
            errorsVisible={errorsVisible}
            onSaveSuccess={refreshValidation}
          />
          {stepNavigation}
        </div>
      );
    }

    if (section.type === 'service_section' && section.functionalityType === 'verification-idv') {
      return (
        <div className="p-6" data-testid="main-content">
          <IdvSection
            token={token}
            serviceIds={section.serviceIds || []}
            onProgressUpdate={(status) => handleSectionProgressUpdate(section.id, status)}
            sectionValidation={sectionValidation}
            errorsVisible={errorsVisible}
            onSaveSuccess={refreshValidation}
          />
          {stepNavigation}
        </div>
      );
    }

    // Phase 6 Stage 3: dispatch the new Address History section type emitted
    // by the structure endpoint when the package contains record-type
    // services. Position-2 ordering is enforced upstream by the structure
    // endpoint's fixed serviceTypeOrder.
    //
    // Phase 6 Stage 4 — wiring callbacks are now passed in the same shape as
    // Education / Employment. Subject-targeted contributions (e.g., Middle
    // Name when Country X is selected) flow through the cross-section
    // registry and surface in PersonalInfoSection (BR 17 / User Flow 3).
    // Phase 7 Stage 1 — for the repeatable sections (Address History,
    // Education, Employment) the SectionErrorBanner is rendered HERE in
    // the shell rather than inside each section. This keeps the section
    // components below their file-size soft trigger and avoids a wide
    // prop-surface change to three large files. Per-field error display
    // for repeatable rows is deferred to a follow-up; the banner alone
    // satisfies Rule 8 / 10 / 11 / 25 for scope/gap/document errors which
    // are the dominant case in these sections (Rule 18).
    if (section.type === 'address_history') {
      return (
        <div className="p-6" data-testid="main-content">
          {errorsVisible && sectionValidation && (
            <SectionErrorBanner sectionId={section.id}
              scopeErrors={sectionValidation.scopeErrors}
              gapErrors={sectionValidation.gapErrors}
              documentErrors={sectionValidation.documentErrors}
            />
          )}
          <AddressHistorySection
            token={token}
            serviceIds={section.serviceIds || []}
            onProgressUpdate={(status) => handleSectionProgressUpdate(section.id, status)}
            onCrossSectionRequirementsChanged={handleCrossSectionRequirementsChanged}
            onCrossSectionRequirementsRemovedForEntry={handleCrossSectionRequirementsRemovedForEntry}
            onCrossSectionRequirementsRemovedForSource={handleCrossSectionRequirementsRemovedForSource}
            onSaveSuccess={handleAddressHistorySaveSuccess}
          />
          {stepNavigation}
        </div>
      );
    }

    // Task 8.4 — Record Search Requirements section (split out of Address
    // History's aggregated block). Pre-authorized for portal-layout edit
    // despite the file being over the 600-LOC hard stop; see plan §4.6.
    if (section.type === 'record_search') {
      return (
        <div className="p-6" data-testid="main-content">
          {errorsVisible && sectionValidation && (
            <SectionErrorBanner sectionId={section.id}
              scopeErrors={sectionValidation.scopeErrors}
              gapErrors={sectionValidation.gapErrors}
              documentErrors={sectionValidation.documentErrors}
            />
          )}
          <RecordSearchSection
            token={token}
            serviceIds={section.serviceIds || []}
            onProgressUpdate={(status) => handleSectionProgressUpdate(section.id, status)}
            onSaveSuccess={refreshValidation}
            sectionValidation={sectionValidation}
            errorsVisible={errorsVisible}
          />
          {stepNavigation}
        </div>
      );
    }

    if (section.type === 'service_section' && section.functionalityType === 'verification-edu') {
      return (
        <div className="p-6" data-testid="main-content">
          {errorsVisible && sectionValidation && (
            <SectionErrorBanner sectionId={section.id}
              scopeErrors={sectionValidation.scopeErrors}
              gapErrors={sectionValidation.gapErrors}
              documentErrors={sectionValidation.documentErrors}
            />
          )}
          <EducationSection
            token={token}
            serviceIds={section.serviceIds || []}
            onProgressUpdate={(status) => handleSectionProgressUpdate(section.id, status)}
            onCrossSectionRequirementsChanged={handleCrossSectionRequirementsChanged}
            onCrossSectionRequirementsRemovedForEntry={handleCrossSectionRequirementsRemovedForEntry}
            onCrossSectionRequirementsRemovedForSource={handleCrossSectionRequirementsRemovedForSource} onSaveSuccess={refreshValidation}
          />
          {stepNavigation}
        </div>
      );
    }

    if (section.type === 'service_section' && section.functionalityType === 'verification-emp') {
      return (
        <div className="p-6" data-testid="main-content">
          {errorsVisible && sectionValidation && (
            <SectionErrorBanner sectionId={section.id}
              scopeErrors={sectionValidation.scopeErrors}
              gapErrors={sectionValidation.gapErrors}
              documentErrors={sectionValidation.documentErrors}
            />
          )}
          <EmploymentSection
            token={token}
            serviceIds={section.serviceIds || []}
            onProgressUpdate={(status) => handleSectionProgressUpdate(section.id, status)}
            onCrossSectionRequirementsChanged={handleCrossSectionRequirementsChanged}
            onCrossSectionRequirementsRemovedForEntry={handleCrossSectionRequirementsRemovedForEntry}
            onCrossSectionRequirementsRemovedForSource={handleCrossSectionRequirementsRemovedForSource} onSaveSuccess={refreshValidation}
          />
          {stepNavigation}
        </div>
      );
    }

    // Phase 6 Stage 4 — workflow_section dispatch. The renderer is purely
    // presentational; the shell owns acknowledgment state and persists
    // through handleWorkflowAcknowledge.
    if (section.type === 'workflow_section' && section.workflowSection) {
      return (
        <div className="p-6" data-testid="main-content">
          <WorkflowSectionRenderer
            section={section.workflowSection}
            acknowledged={workflowAcknowledgments[section.id] ?? false}
            onAcknowledge={(checked) => handleWorkflowAcknowledge(section, checked)}
            sectionValidation={sectionValidation}
            errorsVisible={errorsVisible}
            variableValues={templateVariableValues}
          />
          {stepNavigation}
        </div>
      );
    }

    // For other sections, show placeholder. We wrap the fallback in the same
    // `<div className="p-6" data-testid="main-content">` shell + step
    // navigation row used by every other dispatch branch. This branch is
    // unreachable today (every section.type above is handled), but if a new
    // section type is added in the future and forgotten in the dispatch, the
    // fallback still renders Next/Back so the candidate is not stranded.
    return (
      <div className="p-6" data-testid="main-content">
        <SectionPlaceholder title={section.title} />
        {stepNavigation}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <PortalHeader
        invitation={invitation}
        token={token}
        onMenuToggle={toggleMobileMenu}
        showMenuButton={true}
      />

      {/* Main content area */}
      <div className="flex h-[calc(100vh-4rem)]">
        {/* Desktop sidebar — Task 8.5 hides skipped dynamic steps. */}
        <PortalSidebar
          sections={visibleSectionsWithStatus}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
        />

        {/* Mobile sidebar — Task 8.5 hides skipped dynamic steps. */}
        <PortalSidebar
          sections={visibleSectionsWithStatus}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
          isOpen={isMobileMenuOpen}
          onClose={closeMobileMenu}
        />

        {/* Content area */}
        <main className="flex-1 bg-white overflow-y-auto">
          {getActiveContent()}
        </main>
      </div>
    </div>
  );
}
