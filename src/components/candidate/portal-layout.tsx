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
import { mergeSectionStatus } from '@/lib/candidate/validation/mergeSectionStatus';
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
// Task 8.5 (Silent Recalculation and Step Skipping) — pure helpers that
// decide whether Personal Info / Record Search Requirements should be
// visible based on the current state of the cross-section registry,
// personal-info field list, and address-history aggregated items.
import {
  DYNAMIC_STEP_IDS,
  computeDynamicStepVisibility,
  filterDynamicSteps,
} from '@/lib/candidate/stepVisibility';
// Task 8.5 — the shell now derives the aggregated items at the shell level
// so the visibility decision is possible even when RecordSearchSection is
// not mounted. These helpers are already consumed by RecordSearchSection
// today; lifting them to the shell is parallel, not a replacement.
import {
  buildEntryFieldsBuckets,
  computeAddressHistoryAggregatedItems,
} from '@/lib/candidate/addressHistoryStage4Wiring';

import type { EntryDsxField } from '@/components/candidate/form-engine/useEntryFieldsLoader';
import type { EntryData } from '@/types/candidate-repeatable-form';
import type { SectionVisitsMap } from '@/lib/candidate/sectionVisitTracking';
import type {
  ReviewError,
  SectionValidationResult,
} from '@/lib/candidate/validation/types';
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

  // Task 8.5 — gate for the dynamic-step visibility filter. The shell
  // starts with `personalInfoFields=[]` and an empty cross-section
  // registry; before /personal-info-fields has resolved we cannot
  // distinguish "no fields exist" from "we haven't loaded them yet". This
  // flag flips to `true` once the fetch settles (even with an empty
  // response). Until then the visibility memo defaults Personal Info to
  // visible so the sidebar does not flicker through a "skipped" state on
  // first render.
  const [personalInfoFieldsLoaded, setPersonalInfoFieldsLoaded] = useState(false);

  // TD-059 — saved Personal Info values keyed by requirementId. Hydrated
  // from /saved-data alongside workflow acknowledgments and refreshed by
  // PersonalInfoSection via the onSavedValuesChange callback after each
  // successful auto-save.
  const [personalInfoSavedValues, setPersonalInfoSavedValues] = useState<Record<string, unknown>>({});

  // Task 8.5 — shell-level address-history state used to decide whether
  // Record Search Requirements (Step 8) should be visible. We need to know
  // both the entries the candidate has saved (for entryId/countryId pairs)
  // and the per-entry DSX field definitions (so the aggregated-items
  // computation can run). RecordSearchSection still loads its own copy
  // when mounted — these are a parallel cache used solely for visibility.
  const [addressHistoryEntries, setAddressHistoryEntries] = useState<EntryData[]>([]);
  const [addressHistoryFieldsByEntry, setAddressHistoryFieldsByEntry] = useState<
    Record<string, EntryDsxField[]>
  >({});

  // Task 8.5 (Code Review W1) — sentinel set of `${entryId}::${countryId}`
  // pairs the per-entry /fields effect has already requested, regardless of
  // whether the response was empty. The previous cache check used
  // `fieldsByEntry[id].length > 0`, which meant a country that legitimately
  // produces zero DSX requirements was refetched on every render. This Set
  // records the FETCH itself, so empty responses are remembered too.
  // `refreshAddressHistoryEntries` invalidates the relevant keys when an
  // entry's country changes (or the entry is removed).
  const [fetchedEntryCountryPairs, setFetchedEntryCountryPairs] = useState<Set<string>>(
    () => new Set(),
  );

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
          setAddressHistoryEntries(nextAddressHistoryEntries);
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
        if (cancelled) return;
        if (!response.ok) {
          // Task 8.5 — still mark loaded on failure so the visibility
          // filter applies (a failed fetch is treated the same as "no
          // fields" — the conservative skip behavior).
          setPersonalInfoFieldsLoaded(true);
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setPersonalInfoFields(data?.fields ?? []);
          setPersonalInfoFieldsLoaded(true);
        }
      } catch (error) {
        logger.error('Failed to load personal info fields in shell', {
          event: 'shell_personal_info_fields_load_error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        if (!cancelled) {
          setPersonalInfoFieldsLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Task 8.5 — per-entry DSX field fetch driven by the candidate's saved
  // address-history entries. Lifted from RecordSearchSection so the
  // visibility decision is possible even when that section is unmounted.
  // The cache is keyed by `${entryId}::${countryId}`; once an entry+country
  // pair has been loaded we never refetch unless the entry changes country.
  // Failures are non-fatal — logged via logger.warn and the bucket is left
  // missing, which the visibility helper sees as fewer aggregated items
  // (conservative skip; the candidate can revisit later to retry).
  useEffect(() => {
    let cancelled = false;
    const addressHistorySection = sections.find((s) => s.type === 'address_history');
    if (!addressHistorySection) return;
    const serviceIds = addressHistorySection.serviceIds ?? [];
    if (serviceIds.length === 0) return;
    if (addressHistoryEntries.length === 0) return;

    (async () => {
      const updates: Record<string, EntryDsxField[]> = {};
      const fetchedKeys: string[] = [];
      for (const entry of addressHistoryEntries) {
        if (cancelled) return;
        if (!entry.countryId) continue;
        const cacheKey = `${entry.entryId}::${entry.countryId}`;
        // W1 fix — sentinel set records the fetch attempt itself, so a
        // country that legitimately produces zero DSX fields is NOT
        // refetched on every render. The Set is invalidated by
        // `refreshAddressHistoryEntries` when an entry's country changes.
        if (fetchedEntryCountryPairs.has(cacheKey)) continue;
        try {
          const serviceIdsQuery = serviceIds
            .map((id) => `serviceIds=${encodeURIComponent(id)}`)
            .join('&');
          const url = `/api/candidate/application/${encodeURIComponent(token)}/fields?${serviceIdsQuery}&countryId=${encodeURIComponent(entry.countryId)}`;
          const response = await fetch(url);
          if (!response.ok) {
            logger.warn('Shell-level address-history fields fetch failed', {
              event: 'shell_address_history_fields_load_error',
              cacheKey,
              status: response.status,
            });
            // Mark as fetched even on failure. Re-running the same failing
            // request on every render is wasted I/O; if the underlying
            // cause is transient, the candidate's next save will produce a
            // fresh entries reference and `refreshAddressHistoryEntries`
            // gives the Set a clean slate for the new state.
            fetchedKeys.push(cacheKey);
            continue;
          }
          const data = await response.json();
          const fields: EntryDsxField[] = (data?.fields ?? []) as EntryDsxField[];
          updates[entry.entryId] = fields;
          fetchedKeys.push(cacheKey);
        } catch (error) {
          logger.warn('Shell-level address-history fields fetch threw', {
            event: 'shell_address_history_fields_load_error',
            cacheKey,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          fetchedKeys.push(cacheKey);
        }
      }
      if (cancelled) return;
      if (Object.keys(updates).length > 0) {
        setAddressHistoryFieldsByEntry((prev) => ({ ...prev, ...updates }));
      }
      if (fetchedKeys.length > 0) {
        setFetchedEntryCountryPairs((prev) => {
          const next = new Set(prev);
          for (const key of fetchedKeys) next.add(key);
          return next;
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `fetchedEntryCountryPairs` is read via closure but intentionally NOT
    // in the dep array — adding it would re-run the effect after every
    // successful fetch (which writes the same key it just consumed) and
    // create an infinite loop. The closure captures the latest value at
    // render time, which is sufficient: the only writer is this effect
    // and `refreshAddressHistoryEntries`, and both produce a new
    // `addressHistoryEntries` reference that does re-trigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sections, addressHistoryEntries]);

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

  // Task 8.5 — shell-level aggregated items derivation. Mirrors the
  // computation inside RecordSearchSection so the shell can decide whether
  // Record Search Requirements (Step 8) should be visible even when the
  // section itself isn't mounted. Address History only loads record-type
  // services per the structure endpoint, so every aggregated field gets
  // the same bucket index (matches the SERVICE_TYPE_ORDER_RECORD constant
  // in RecordSearchSection).
  const recordSearchAggregatedItems = useMemo(() => {
    const buckets = buildEntryFieldsBuckets(
      addressHistoryEntries,
      addressHistoryFieldsByEntry,
    );
    const personalInfoIds = new Set<string>(
      personalInfoFields.map((f) => f.requirementId),
    );
    return computeAddressHistoryAggregatedItems({
      buckets,
      personalInfoRequirementIds: personalInfoIds,
      resolveServiceTypeOrder: () => 1,
    });
  }, [addressHistoryEntries, addressHistoryFieldsByEntry, personalInfoFields]);

  // W6 fix — stable boolean derived from `savedDataHydration` for memo
  // deps that only need null-vs-present. The state object is set at most
  // once today (initial hydration), but extracting the boolean here means
  // any future code path that calls `setSavedDataHydration` with an
  // equal-by-value object cannot cause this memo (or
  // `addressHistoryFieldsLoaded` below) to recompute.
  const savedDataHydrated = savedDataHydration !== null;

  // Task 8.5 (Code Review W2) — second-stage loading gate. After
  // `savedDataHydrated` flips, the shell knows the candidate's address
  // entries but hasn't yet fetched their per-entry DSX fields. During
  // that brief window `recordSearchAggregatedItems` is empty, which the
  // pure helper would interpret as "skip Record Search" — producing a
  // visible flicker in the sidebar. This memo flips to `true` once every
  // entry with a non-null `countryId` has a fetch sentinel in
  // `fetchedEntryCountryPairs` (or trivially when there are no such
  // entries). Until then, the visibility memo below defaults Record
  // Search to visible.
  const addressHistoryFieldsLoaded = useMemo(() => {
    if (!savedDataHydrated) return false;
    const entriesNeedingFields = addressHistoryEntries.filter(
      (e) => !!e.countryId,
    );
    if (entriesNeedingFields.length === 0) return true;
    return entriesNeedingFields.every((e) =>
      fetchedEntryCountryPairs.has(`${e.entryId}::${e.countryId}`),
    );
  }, [savedDataHydrated, addressHistoryEntries, fetchedEntryCountryPairs]);

  // Task 8.5 — dynamic step visibility. OR-merged for Personal Info
  // (either local DSX fields OR cross-section subject requirements keep
  // the step visible — see plan §4.1 and stepVisibility.ts). Single-source
  // for Record Search (aggregated items length).
  //
  // Loading guard: until /personal-info-fields, /saved-data, AND the
  // per-entry /fields fetches have all settled, we cannot tell "no
  // content" from "not yet loaded." During that window both dynamic
  // steps default to visible so the sidebar does not flicker through a
  // "skipped" state on first render. Once the fetches settle the real
  // pure-function rule applies.
  const stepVisibility = useMemo(() => {
    const computed = computeDynamicStepVisibility({
      personalInfoFields,
      subjectCrossSectionRequirements,
      recordSearchAggregatedItems,
    });
    const dataLoaded =
      personalInfoFieldsLoaded &&
      savedDataHydrated &&
      addressHistoryFieldsLoaded;
    if (!dataLoaded) {
      return {
        personalInfoVisible: true,
        recordSearchVisible: true,
      };
    }
    return computed;
  }, [
    personalInfoFields,
    subjectCrossSectionRequirements,
    recordSearchAggregatedItems,
    personalInfoFieldsLoaded,
    savedDataHydrated,
    addressHistoryFieldsLoaded,
  ]);

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
        const merged = mergeSectionStatus({
          localStatus: sectionStatuses[section.id],
          validationStatus,
          fallbackStatus: section.status,
        });

        // Task 8.5 — Record Search has no server-side validator (per the
        // Task 8.4 plan §4.8), so `validationStatus` is always undefined
        // and the merge falls through to `localStatus`.
        // `computeRecordSearchStatus` returns `'not_started'` when there
        // are required items but the candidate hasn't typed anything —
        // which is the correct local signal but, in the merge, would keep
        // the sidebar gray even after the candidate has visited and left
        // the step without filling anything in. This shell-side override
        // applies the analogue of `mergeSectionStatus` Rule 2 (visited +
        // local-empty → incomplete) by using visit tracking directly
        // instead of the missing engine verdict. Once the candidate types
        // something `localStatus` becomes `'incomplete'` or `'complete'`
        // on its own and this branch no-ops.
        if (
          section.id === DYNAMIC_STEP_IDS.RECORD_SEARCH &&
          merged === 'not_started'
        ) {
          const visit = sectionVisits[section.id];
          const departed = !!visit && visit.departedAt !== null;
          if (departed || reviewPageVisitedAt !== null) {
            return { ...section, status: 'incomplete' as const };
          }
        }

        return { ...section, status: merged };
      }),
    [sections, sectionStatuses, validationResult, sectionVisits, reviewPageVisitedAt],
  );

  // Task 8.5 — filtered view of sectionsWithStatus that hides skipped
  // dynamic steps. This is the list the sidebar renders, the navigation
  // flow walks, and the Review & Submit page consumes. The unfiltered
  // sectionsWithStatus is still used by the lifted Personal Info progress
  // effect (so status is computed even when the step is currently skipped)
  // and by the dispatch lookup in getActiveContent (defensive — keeps the
  // candidate from being stranded mid-edit if the active section is hidden
  // by recalculation).
  const visibleSectionsWithStatus = useMemo(
    () => filterDynamicSteps(sectionsWithStatus, stepVisibility),
    [sectionsWithStatus, stepVisibility],
  );

  // Task 8.5 — Review & Submit consumes a patched validation result so
  // that a skipped dynamic step does not block submission even when the
  // server's validate response still reports it as incomplete (Spec
  // Business Rule 9 c). We override only the dynamic-step sections that
  // are currently NOT in the visible list — every other section's verdict
  // passes through untouched. Most-permissive wins for skipping; the
  // separate `disableSubmitForDynamicGaps` below adds the most-restrictive
  // override for newly-visible-but-incomplete steps (Rule 9 d).
  const effectiveValidationResult = useMemo(() => {
    if (!validationResult) return validationResult;
    const visibleIds = new Set(visibleSectionsWithStatus.map((s) => s.id));
    const dynamicIds = new Set<string>([
      DYNAMIC_STEP_IDS.PERSONAL_INFO,
      DYNAMIC_STEP_IDS.RECORD_SEARCH,
    ]);
    const patchedSummarySections = validationResult.summary.sections.map((s) => {
      if (dynamicIds.has(s.sectionId) && !visibleIds.has(s.sectionId)) {
        return { ...s, status: 'complete' as const, errors: [] };
      }
      return s;
    });
    const patchedSections = validationResult.sections.map((s) => {
      if (dynamicIds.has(s.sectionId) && !visibleIds.has(s.sectionId)) {
        return {
          ...s,
          status: 'complete' as const,
          fieldErrors: [],
          scopeErrors: [],
          gapErrors: [],
          documentErrors: [],
        };
      }
      return s;
    });
    const allComplete = patchedSummarySections.every((s) => s.status === 'complete');
    return {
      ...validationResult,
      sections: patchedSections,
      summary: {
        ...validationResult.summary,
        sections: patchedSummarySections,
        allComplete,
      },
    };
  }, [validationResult, visibleSectionsWithStatus]);

  // Task 8.5 — most-restrictive override for the Submit button. Walks the
  // currently-visible section list; if any dynamic step is locally
  // incomplete, Submit is forced disabled even if the server's allComplete
  // says otherwise (Spec Business Rule 9 d — a previously-skipped step
  // that has come back into scope and is not yet filled must block
  // submission).
  const disableSubmitForDynamicGaps = useMemo(() => {
    for (const section of visibleSectionsWithStatus) {
      if (
        section.id === DYNAMIC_STEP_IDS.PERSONAL_INFO ||
        section.id === DYNAMIC_STEP_IDS.RECORD_SEARCH
      ) {
        if (section.status !== 'complete') {
          return true;
        }
      }
    }
    return false;
  }, [visibleSectionsWithStatus]);

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

  // Task 8.5 — mid-session refresh of `addressHistoryEntries`. The initial
  // /saved-data hydration only fires once on mount, so when the candidate
  // adds, removes, or country-changes an Address History entry the shell's
  // copy goes stale and the `recordSearchAggregatedItems` memo decides
  // visibility from out-of-date inputs (Bug: "I add a new address with
  // search-level fields and Step 8 never appears"). We call this from the
  // AddressHistorySection `onSaveSuccess` wrapper below so every save
  // round-trip refreshes the shell state alongside /validate.
  //
  // The function also INVALIDATES the per-entry fields cache for any
  // entry whose country has changed since the previous render (or that
  // disappeared entirely). The per-entry fields effect treats a missing
  // cache entry as "needs to be fetched", so clearing the stale rows
  // forces it to load the correct DSX requirements for the new country.
  const refreshAddressHistoryEntries = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/candidate/application/${encodeURIComponent(token)}/saved-data`,
      );
      if (!response.ok) return;
      const data = await response.json();
      const savedSections = (data?.sections ?? {}) as Record<string, unknown>;
      const bucket = savedSections['address_history'] as
        | { entries?: EntryData[] }
        | undefined
        | null;
      const nextEntries: EntryData[] =
        bucket && Array.isArray(bucket.entries) ? bucket.entries : [];

      setAddressHistoryEntries((prev) => {
        // Detect country changes and removals so the per-entry fields
        // cache (and W1 sentinel set) can be invalidated for those
        // entries. Adds (new entryId) are NOT in `prev` and have no
        // cache row to clear — the per-entry fields effect will fetch
        // them on its own.
        const prevById = new Map(prev.map((e) => [e.entryId, e.countryId]));
        const nextIds = new Set(nextEntries.map((e) => e.entryId));
        const idsToInvalidate: string[] = [];
        const pairsToInvalidate: string[] = [];
        for (const next of nextEntries) {
          const prevCountry = prevById.get(next.entryId);
          if (prevCountry !== undefined && prevCountry !== next.countryId) {
            idsToInvalidate.push(next.entryId);
            if (prevCountry !== null) {
              pairsToInvalidate.push(`${next.entryId}::${prevCountry}`);
            }
          }
        }
        for (const [prevId, prevCountry] of prevById.entries()) {
          if (!nextIds.has(prevId)) {
            idsToInvalidate.push(prevId);
            if (prevCountry !== null) {
              pairsToInvalidate.push(`${prevId}::${prevCountry}`);
            }
          }
        }
        if (idsToInvalidate.length > 0) {
          setAddressHistoryFieldsByEntry((cache) => {
            let changed = false;
            const next = { ...cache };
            for (const id of idsToInvalidate) {
              if (id in next) {
                delete next[id];
                changed = true;
              }
            }
            return changed ? next : cache;
          });
        }
        if (pairsToInvalidate.length > 0) {
          setFetchedEntryCountryPairs((cache) => {
            let changed = false;
            const next = new Set(cache);
            for (const key of pairsToInvalidate) {
              if (next.has(key)) {
                next.delete(key);
                changed = true;
              }
            }
            return changed ? next : cache;
          });
        }
        return nextEntries;
      });
    } catch (error) {
      logger.warn('Failed to refresh address history entries', {
        event: 'shell_address_history_refresh_error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [token]);

  // Task 8.5 — wrapper passed as AddressHistorySection's `onSaveSuccess`.
  // Fires both the normal validation refresh and the Task 8.5 saved-data
  // refresh so the shell's `addressHistoryEntries` (and therefore the
  // Record Search visibility decision) stays in sync with the candidate's
  // current entries after every save.
  const handleAddressHistorySaveSuccess = useCallback(() => {
    void refreshValidation();
    void refreshAddressHistoryEntries();
  }, [refreshValidation, refreshAddressHistoryEntries]);

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
      const reviewPageSections = visibleSectionsWithStatus
        .filter((s) => s.type !== 'review_submit')
        .map((s) => ({ id: s.id, title: s.title }));
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
