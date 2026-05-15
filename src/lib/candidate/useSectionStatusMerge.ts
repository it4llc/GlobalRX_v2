// /GlobalRX_v2/src/lib/candidate/useSectionStatusMerge.ts
// Portal layout extraction — Hook 2 (MERGE). See
// docs/plans/portal-layout-extraction-technical-plan.md §2.2 / §4.3.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { mergeSectionStatus } from '@/lib/candidate/validation/mergeSectionStatus';
import { computePersonalInfoStatus } from '@/lib/candidate/sectionProgress';
import {
  DYNAMIC_STEP_IDS,
  filterDynamicSteps,
  type StepVisibilityResult,
} from '@/lib/candidate/stepVisibility';

import type { SectionVisitsMap } from '@/lib/candidate/sectionVisitTracking';
import type { FullValidationResult } from '@/lib/candidate/validation/types';
import type {
  CandidatePortalSection,
  PersonalInfoField,
} from '@/types/candidate-portal';
import type {
  CrossSectionRequirementEntry,
  SectionStatus,
} from '@/types/candidate-stage4';

interface UseSectionStatusMergeInput {
  /** Full structure-endpoint section list (unfiltered). */
  sections: CandidatePortalSection[];
  /** /validate hook output. */
  validationResult: FullValidationResult | null;
  /** From portal-validation hook. Used by the record_search post-merge
   *  override (visited+departed → incomplete, BR 9 a). */
  sectionVisits: SectionVisitsMap;
  /** From portal-validation hook. Same override branch. */
  reviewPageVisitedAt: string | null;
  /** From VIS hook. Drives `visibleSectionsWithStatus` filtering and
   *  `effectiveValidationResult` patching. */
  stepVisibility: StepVisibilityResult;
  /** /personal-info-fields cache — needed for the TD-059 lifted progress
   *  effect. */
  personalInfoFields: PersonalInfoField[];
  /** Saved Personal Info values keyed by requirementId — same effect. */
  personalInfoSavedValues: Record<string, unknown>;
  /** Subject-target requirements — same effect (drives PersonalInfo's
   *  `requiredKeys` union via computePersonalInfoStatus). */
  subjectCrossSectionRequirements: CrossSectionRequirementEntry[];
}

type SectionWithStatus = CandidatePortalSection & { status: SectionStatus };

interface UseSectionStatusMergeOutput {
  /** Sections with their merged status (Rule 27 merge + record_search
   *  visited-but-empty override). */
  sectionsWithStatus: SectionWithStatus[];
  /** Filtered version — skipped dynamic steps removed. Drives the
   *  sidebar, navigation, and Review-page descriptor list. */
  visibleSectionsWithStatus: SectionWithStatus[];
  /** Validation result with skipped dynamic steps patched to `complete`
   *  with cleared error arrays (BR 9 c). */
  effectiveValidationResult: FullValidationResult | null;
  /** Most-restrictive override for the Submit button (BR 9 d). */
  disableSubmitForDynamicGaps: boolean;
  /** Stable callback handed to every section component as
   *  `onProgressUpdate`. */
  handleSectionProgressUpdate: (sectionId: string, status: SectionStatus) => void;
  /** Bulk patcher used ONLY by the orchestrator's saved-data hydration
   *  effect to seed workflow_section statuses on first load. */
  bulkPatchSectionStatuses: (updates: Record<string, SectionStatus>) => void;
}

export function useSectionStatusMerge(
  input: UseSectionStatusMergeInput,
): UseSectionStatusMergeOutput {
  const {
    sections,
    validationResult,
    sectionVisits,
    reviewPageVisitedAt,
    stepVisibility,
    personalInfoFields,
    personalInfoSavedValues,
    subjectCrossSectionRequirements,
  } = input;

  // Phase 6 Stage 4 — shell-level state lifted per the technical plan.
  // sectionStatuses is keyed by section.id (the structure-endpoint identifier),
  // and each section pushes its own computed status here through
  // onSectionProgressUpdate. The sidebar consumes this map to drive the
  // SectionProgressIndicator next to each section name.
  //
  // Initialize EMPTY — not with `section.status` from the structure endpoint.
  // The structure endpoint always returns `not_started`, and pre-populating
  // with that value collides with `mergeSectionStatus` Rule 2 after a
  // logout/login: a returning candidate's section that the server validates
  // as `complete` would land at (local=`not_started`, validation=`complete`)
  // and Rule 2 reports `incomplete` — turning the sidebar red until the
  // section component mounts and reports its real local status. Leaving the
  // entry undefined lets the merge fall through to validation on the first
  // render and only consult local once the section has actually computed it.
  const [sectionStatuses, setSectionStatuses] = useState<Record<string, SectionStatus>>(
    {},
  );

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

  // Bulk patcher for the orchestrator's saved-data hydration effect. The
  // shell calls this once with the workflow_section initial statuses; we
  // keep the underlying setSectionStatuses signature (`(prev) => merged`)
  // so the write order matches the inline call this replaces.
  const bulkPatchSectionStatuses = useCallback(
    (updates: Record<string, SectionStatus>) => {
      setSectionStatuses((prev) => ({ ...prev, ...updates }));
    },
    [],
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
  const sectionsWithStatus = useMemo<SectionWithStatus[]>(
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
            // SectionStatus union literal, not DB status.
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
        // SectionStatus union literal, not DB status.
        return { ...s, status: 'complete' as const, errors: [] };
      }
      return s;
    });
    const patchedSections = validationResult.sections.map((s) => {
      if (dynamicIds.has(s.sectionId) && !visibleIds.has(s.sectionId)) {
        return {
          ...s,
          // SectionStatus union literal, not DB status.
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

  return {
    sectionsWithStatus,
    visibleSectionsWithStatus,
    effectiveValidationResult,
    disableSubmitForDynamicGaps,
    handleSectionProgressUpdate,
    bulkPatchSectionStatuses,
  };
}
