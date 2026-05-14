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
import { mergeSectionStatus } from '@/lib/candidate/validation/mergeSectionStatus';
import type { SectionVisitsMap } from '@/lib/candidate/sectionVisitTracking';
import type {
  ReviewError,
  SectionValidationResult,
} from '@/lib/candidate/validation/types';
import {
  addCrossSectionRequirements,
  getCrossSectionRequirements,
  removeCrossSectionRequirementsForEntry,
  removeCrossSectionRequirementsForSource,
} from '@/lib/candidate/crossSectionRegistry';
import {
  computePersonalInfoStatus,
  computeWorkflowSectionStatus,
} from '@/lib/candidate/sectionProgress';
import type {
  CandidateInvitationInfo,
  CandidatePortalSection,
  PersonalInfoField,
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
  const [activeSection, setActiveSection] = useState<string | null>(defaultSection);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Phase 6 Stage 4 — shell-level state lifted per the technical plan.
  // sectionStatuses is keyed by section.id (the structure-endpoint identifier),
  // and each section pushes its own computed status here through
  // onSectionProgressUpdate. The sidebar consumes this map to drive the
  // SectionProgressIndicator next to each section name. Initial value is the
  // status the structure endpoint returned (currently always 'not_started').
  const [sectionStatuses, setSectionStatuses] = useState<Record<string, SectionStatus>>(
    () => {
      const initial: Record<string, SectionStatus> = {};
      for (const section of sections) {
        initial[section.id] = section.status;
      }
      return initial;
    },
  );

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

  // TD-059 — Personal Info field definitions, fetched once at the shell
  // level so the lifted progress effect below can recompute status whenever
  // the cross-section registry changes, even while PersonalInfoSection is
  // unmounted. The section receives this array as a prop instead of
  // fetching /personal-info-fields itself.
  const [personalInfoFields, setPersonalInfoFields] = useState<PersonalInfoField[]>([]);

  // TD-059 — saved Personal Info values keyed by requirementId. Hydrated
  // from /saved-data alongside workflow acknowledgments and refreshed by
  // PersonalInfoSection via the onSavedValuesChange callback after each
  // successful auto-save.
  const [personalInfoSavedValues, setPersonalInfoSavedValues] = useState<Record<string, unknown>>({});

  // Phase 7 Stage 1 — saved-data hydration payload. Null until /saved-data
  // settles (success or failure); populated with `sectionVisits` and
  // `reviewPageVisitedAt` so the validation hook can adopt them on mount and
  // visit state survives a browser reload (Spec Rules 1/2/3).
  const [savedDataHydration, setSavedDataHydration] = useState<{
    sectionVisits: SectionVisitsMap;
    reviewPageVisitedAt: string | null;
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

  // One-time hydration of saved data. The shell uses /saved-data for two
  // independent purposes:
  //   1) Workflow-section acknowledgments (BR 7 / 8) — WorkflowSectionRenderer
  //      is intentionally presentational, so the shell must hydrate.
  //   2) TD-059 — Personal Info saved values, used by the lifted progress
  //      effect so the sidebar indicator stays accurate even when
  //      PersonalInfoSection is unmounted.
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
            setSavedDataHydration({ sectionVisits: {}, reviewPageVisitedAt: null });
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
          setSectionStatuses((prev) => ({ ...prev, ...statusUpdates }));
          setSavedDataHydration({
            sectionVisits: incomingSectionVisits,
            reviewPageVisitedAt: incomingReviewPageVisitedAt,
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
          setSavedDataHydration({ sectionVisits: {}, reviewPageVisitedAt: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sections]);

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

  // TD-059 — One-time fetch of Personal Info field definitions. Owned by the
  // shell so the lifted progress effect below can run computePersonalInfoStatus
  // whenever the cross-section registry changes — independent of which tab
  // is currently mounted. PersonalInfoSection receives this array as a prop
  // and does NOT make its own fetch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/candidate/application/${encodeURIComponent(token)}/personal-info-fields`,
        );
        if (!response.ok || cancelled) return;
        const data = await response.json();
        if (!cancelled) {
          setPersonalInfoFields(data?.fields ?? []);
        }
      } catch (error) {
        logger.error('Failed to load personal info fields in shell', {
          event: 'shell_personal_info_fields_load_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

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

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Phase 6 Stage 4 — single callback used by every section to push its
  // freshly-computed status up to the shell. Sections call this from inside
  // their auto-save success handlers and on initial mount once they know
  // enough to compute progress.
  const handleSectionProgressUpdate = useCallback(
    (sectionId: string, status: SectionStatus) => {
      setSectionStatuses((prev) => {
        if (prev[sectionId] === status) return prev;
        return { ...prev, [sectionId]: status };
      });
    },
    [],
  );

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

  // TD-059 — lifted Personal Info progress derivation. This effect is the
  // whole reason the field defs and saved values are owned at the shell
  // level: it keeps sectionStatuses['personal_info'] accurate even when
  // PersonalInfoSection is unmounted. When the candidate is on Address
  // History and changes country, the registry update flows here and the
  // sidebar indicator re-renders without the section ever mounting.
  //
  // PersonalInfoSection ALSO calls onProgressUpdate from inside its own
  // local effect for live typing — both writes flow through
  // handleSectionProgressUpdate, which short-circuits identical statuses
  // via the functional updater (no re-render storm).
  useEffect(() => {
    const personalInfoSection = sections.find((s) => s.type === 'personal_info');
    if (!personalInfoSection) return;
    if (personalInfoFields.length === 0) return;

    // Translate requirementId-keyed saved values into the fieldKey-keyed
    // map that computePersonalInfoStatus expects (it joins by fieldKey
    // because cross-section registry entries also key by fieldKey).
    const valuesByFieldKey: Record<string, unknown> = {};
    for (const field of personalInfoFields) {
      // The shell-side derivation must mirror the view PersonalInfoSection's local
      // effect uses, which merges prefilledValue into formData on mount. Without
      // this fallback, a candidate with prefilled-but-not-yet-saved values would
      // see the sidebar flip to not_started the moment a cross-section requirement
      // is added (Bug 1, surfaced in smoke testing of TD-059).
      const savedValue = personalInfoSavedValues[field.requirementId];
      valuesByFieldKey[field.fieldKey] =
        savedValue !== undefined ? savedValue : field.prefilledValue ?? undefined;
    }
    const fieldLikes = personalInfoFields.map((field) => ({
      id: field.requirementId,
      fieldKey: field.fieldKey,
      isRequired: field.isRequired,
    }));
    const status = computePersonalInfoStatus(
      fieldLikes,
      valuesByFieldKey,
      subjectCrossSectionRequirements,
    );
    handleSectionProgressUpdate(personalInfoSection.id, status);
  }, [
    sections,
    personalInfoFields,
    personalInfoSavedValues,
    subjectCrossSectionRequirements,
    handleSectionProgressUpdate,
  ]);

  // Sections augmented with their current computed status. The sidebar
  // always renders the freshest available value; the merge logic (Rule 27)
  // lives in `mergeSectionStatus` so this layout file only orchestrates
  // the inputs. The synthetic `review_submit` entry mirrors
  // `summary.allComplete` (complete when every section is, else
  // not_started — the Review page itself never reports incomplete).
  const sectionsWithStatus = useMemo(
    () =>
      sections.map((section) => {
        if (section.type === 'review_submit') {
          const allComplete = validationResult?.summary.allComplete ?? false;
          return {
            ...section,
            status: allComplete ? ('complete' as const) : ('not_started' as const),
          };
        }
        const validationStatus = validationResult?.sections.find(
          (s) => s.sectionId === section.id,
        )?.status;
        return {
          ...section,
          status: mergeSectionStatus({
            localStatus: sectionStatuses[section.id],
            validationStatus,
            fallbackStatus: section.status,
          }),
        };
      }),
    [sections, sectionStatuses, validationResult],
  );

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

  // Task 8.2 (Linear Step Navigation) — derived navigable section list and
  // the index of the currently-active section. The structure endpoint
  // already returns sections in the linear flow order, and sections that
  // do not apply to the candidate's package are omitted entirely, so the
  // navigable list is simply `sectionsWithStatus` as-is (spec rule 6 /
  // edge case 1). The shell does not maintain a separate "skip" map.
  const navigableSections = useMemo(() => sectionsWithStatus, [sectionsWithStatus]);

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
    } catch {
      // jsdom and some older browsers throw when behavior is unsupported.
      // Fall back to setting scrollTop on the document element.
      try {
        if (document?.documentElement) {
          document.documentElement.scrollTop = 0;
        }
      } catch (scrollError) {
        // Scroll failure is non-fatal for navigation, but we still log it
        // so the failure isn't silently swallowed (standards-checker fix).
        logger.debug('portal-layout: scrollTop fallback failed', {
          error: scrollError instanceof Error ? scrollError.message : 'Unknown error',
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
      const reviewPageSections = sectionsWithStatus
        .filter((s) => s.type !== 'review_submit')
        .map((s) => ({ id: s.id, title: s.title }));
      return (
        <div className="p-6" data-testid="main-content">
          <ReviewSubmitPage
            validationResult={validationResult}
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
            onCrossSectionRequirementsRemovedForSource={handleCrossSectionRequirementsRemovedForSource} onSaveSuccess={refreshValidation}
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
        {/* Desktop sidebar */}
        <PortalSidebar
          sections={sectionsWithStatus}
          activeSection={activeSection}
          onSectionClick={handleSectionClick}
        />

        {/* Mobile sidebar */}
        <PortalSidebar
          sections={sectionsWithStatus}
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
