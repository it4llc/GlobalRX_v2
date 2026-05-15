# Technical Plan: Silent Recalculation and Step Skipping (Task 8.5)

**Based on specification:** `docs/specs/silent-recalculation-step-skipping.md` (May 14, 2026)
**Date:** 2026-05-14
**Author:** Technical Architect (planning only — no production code)

---

## 1. Overview (plain-English summary)

Task 8.5 closes Phase 8 by making the 9-step candidate flow behave correctly when the candidate goes back and edits earlier sections.

It does three things:

1. **Silent recalculation on arrival.** When the candidate navigates to Personal Info (Step 7) or Record Search Requirements (Step 8), the fields these sections show are recomputed from the current state of the data sources Tasks 8.3 and 8.4 already established (the cross-section subject-targeted field registry and `computeAddressHistoryAggregatedItems` against the current address entries). No warning banners, no save event from the recalc itself.
2. **Dynamic step skipping.** When a step's recalculation produces zero items (no subject-targeted fields → skip Step 7; no aggregated items → skip Step 8), the step is hidden from the sidebar and excluded from Next/Back navigation. When the candidate later changes their entries so that a previously-skipped step now has content, the step reappears in the sidebar and Next/Back path.
3. **Review & Submit accounts for the dynamic step set.** A skipped step does not appear in the review summary and is not required for submission. A previously-skipped step that has come back into scope and is incomplete must block submission until filled in.

**No database changes. No new API endpoints.** The work is entirely in the candidate shell (`portal-layout.tsx`), one new pure helper in `lib/candidate/`, a small extension to the validation summary builder, and a small unit-level extension to `mergeSectionStatus`.

---

## 2. Where the data already lives (no new sources needed)

| Concept | Already produced by | Used by Task 8.5 to |
| --- | --- | --- |
| Subject-targeted fields registry (`subjectCrossSectionRequirements`) | `portal-layout.tsx` via `crossSectionRegistry` state, updated by Address History / Education / Employment | Decide if Personal Info has zero / non-zero items |
| Personal Info local DSX fields (`personalInfoFields`) | `portal-layout.tsx` one-shot fetch of `/personal-info-fields` | Decide if Personal Info has zero / non-zero items |
| Aggregated items for Record Search | `computeAddressHistoryAggregatedItems` (already used inside `RecordSearchSection.tsx`) | Decide if Record Search has zero / non-zero items |
| Section ordering / visibility | Structure endpoint emits the section list once; `sectionsWithStatus` adds statuses | Filter to produce a "navigable + sidebar-visible" subset |

The Task 8.5 contribution is essentially the **filter + recalc trigger**, not new data.

---

## 3. Database Changes

**None.**

No new Prisma models, no schema fields, no indexes, no migrations. The recalculation operates entirely on in-memory candidate-portal state plus the existing `/saved-data`, `/personal-info-fields`, and `/fields` endpoints. The spec explicitly says "No database changes are needed — all data lives within the existing `order_data` JSON structure and in-memory state."

---

## 4. New Files to Create

### 4.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/stepVisibility.ts`

**Purpose:** Pure-function module that decides which of the dynamic sections (Personal Info, Record Search) should be visible to the candidate based on the current state of the cross-section registry, the personal-info field list, and the address-history aggregated items.

**Why a new file?** The decision is a discrete piece of business logic that is consumed by `portal-layout.tsx` (which is already 1018 lines and over the 600 hard stop). Adding a helper module keeps the shell lean and gives the test writer a small pure target for unit tests.

**Contents:**

- File-path comment header (per CODING_STANDARDS Section 1.1).
- One pure helper plus its input types. No state, no I/O, no DOM.
- Module-level constants for the dynamic section IDs:
  ```text
  export const DYNAMIC_STEP_IDS = {
    PERSONAL_INFO: 'personal_info',
    RECORD_SEARCH: 'record_search',
  } as const;
  ```
- Input types:
  ```text
  export interface StepVisibilityInputs {
    /** DSX field requirements pulled from /personal-info-fields. The shell
     *  already owns this list. Used here only to count "is there at least
     *  one subject-targeted local field?" — Task 8.3 already filters out
     *  the four locked invitation fieldKeys before reaching this list. */
    personalInfoFields: ReadonlyArray<{ requirementId: string }>;
    /** `subject` target entries from the cross-section registry. The shell
     *  already memoises this via getCrossSectionRequirements(registry,
     *  'subject'). Used only for length. */
    subjectCrossSectionRequirements: ReadonlyArray<unknown>;
    /** Output of computeAddressHistoryAggregatedItems for the current
     *  address-history entries. Used only for length. */
    recordSearchAggregatedItems: ReadonlyArray<unknown>;
  }
  export interface StepVisibilityResult {
    /** True when Personal Info has at least one local field OR at least one
     *  cross-section subject requirement. False → step is skipped. */
    personalInfoVisible: boolean;
    /** True when the aggregated-items list is non-empty. False → step is
     *  skipped. */
    recordSearchVisible: boolean;
  }
  ```
- One pure function:
  ```text
  export function computeDynamicStepVisibility(
    inputs: StepVisibilityInputs,
  ): StepVisibilityResult
  ```
  Implementation rule (English): `personalInfoVisible` is true iff `personalInfoFields.length > 0 || subjectCrossSectionRequirements.length > 0`. `recordSearchVisible` is true iff `recordSearchAggregatedItems.length > 0`.
- A second pure helper that filters a section list:
  ```text
  export function filterDynamicSteps(
    sections: ReadonlyArray<{ id: string; type: string }>,
    visibility: StepVisibilityResult,
  ): typeof sections
  ```
  Removes the `personal_info` section when `!visibility.personalInfoVisible`. Removes the `record_search` section when `!visibility.recordSearchVisible`. Leaves every other entry untouched (workflow sections, service sections, address_history, review_submit are NOT subject to dynamic skipping in this task).

**Document the "OR-merged" rule** in a JSDoc comment block above the function: "Personal Info uses OR logic — if either local DSX fields exist or any cross-section subject requirement is registered, the step is visible. The most permissive rule wins so we never hide a step that has anything to ask the candidate. This mirrors the `requiredKeys` union in `computePersonalInfoStatus`." (Documenting merge logic is required by CODING_STANDARDS Section 8.4.)

### 4.2 Tests for `stepVisibility.ts`

The architect does not write tests. The test-writer will produce a co-located file `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/__tests__/stepVisibility.test.ts` per the existing project convention. See §11 for the test surface.

---

## 5. Existing Files to Modify

Every file listed below has been read in full or in the relevant section.

### 5.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx`

**Was this file read before listing it here?** Yes — full file read (1018 lines).

**What currently exists:**

- Line 99: `const [crossSectionRegistry, setCrossSectionRegistry] = useState<CrossSectionRegistry>({})`.
- Line 114: `const [personalInfoFields, setPersonalInfoFields] = useState<PersonalInfoField[]>([])`.
- Lines 396–399: `subjectCrossSectionRequirements` memo via `getCrossSectionRequirements(registry, 'subject')`.
- Lines 475–498: `sectionsWithStatus` memo — currently maps every section from the structure endpoint and merges status. **This is the surface the sidebar and Next/Back navigation iterate.**
- Line 641: `navigableSections = useMemo(() => sectionsWithStatus, [sectionsWithStatus])` — currently the same array.
- Lines 996–1009: sidebar renders from `sectionsWithStatus`.

**What needs to change and why:**

This file is over the 600-LOC hard stop. Andy preauthorized continuing to edit it for Task 8.4 (see `task-8.4-record-search-requirements-technical-plan.md` §4.6) and the pattern continues here. The additions below are small (≈ 35 lines net): an import, one memo for aggregated items, one memo for visibility, a transformed memo, and a hardening of the activeSection-fallback effect. **No new state is added.**

1. **Add imports** at the top of the file (next to the existing `@/lib/candidate/sectionProgress` import group):
   ```text
   import {
     computeDynamicStepVisibility,
     filterDynamicSteps,
     DYNAMIC_STEP_IDS,
   } from '@/lib/candidate/stepVisibility';
   import {
     buildEntryFieldsBuckets,
     computeAddressHistoryAggregatedItems,
   } from '@/lib/candidate/addressHistoryStage4Wiring';
   ```
   These helpers already exist; no new wiring needed.

2. **Lift the shell-level aggregated-items derivation.** Today only `RecordSearchSection.tsx` computes `computeAddressHistoryAggregatedItems`, and only while it is mounted. Task 8.5 needs the same computation to be available to the shell so it can decide whether to skip Step 8 even when the section is not mounted.

   - Reuse the same data the shell already loads — `personalInfoFields` (for the dedupe set) and a new piece of state for the candidate's address-history entries plus per-entry DSX fields.
   - Add three new pieces of state to the shell, defined immediately under `personalInfoSavedValues`:
     ```text
     const [addressHistoryEntries, setAddressHistoryEntries] = useState<EntryData[]>([]);
     const [addressHistoryFieldsByEntry, setAddressHistoryFieldsByEntry] = useState<Record<string, EntryDsxField[]>>({});
     ```
     `EntryData` and `EntryDsxField` are imported from `@/types/candidate-repeatable-form` and `@/components/candidate/form-engine/useEntryFieldsLoader` respectively (both already exported).
   - **Extend the existing saved-data hydration effect (lines 188–272)** to ALSO read `savedSections['address_history']?.entries` and store it via `setAddressHistoryEntries`. Same effect, same lifecycle. No new fetch.
   - **Add a single new effect** that, whenever `addressHistoryEntries` changes, fetches per-entry DSX fields for every entry that has a `countryId` and merges results into `addressHistoryFieldsByEntry`. Use the existing `/api/candidate/application/[token]/fields` endpoint (the same one `useEntryFieldsLoader` already calls). The effect caches by `${entryId}::${countryId}` so a re-render with unchanged entries does not refetch. Cancellation via a `cancelled` boolean local. Failures are non-fatal (log via `logger.warn`, leave bucket missing — the visibility helper will just see fewer aggregated items, which is the same end state as the section being "not yet hydrated").

     **Why we accept the new fetch surface here:** `RecordSearchSection.tsx` does the same fetch loop today. Lifting it to the shell makes the visibility decision possible even when the section isn't mounted. The section can continue to call `useEntryFieldsLoader` for itself; the shell-level fetch is a parallel cache used solely for visibility computation. (`RecordSearchSection` is **NOT** modified to consume the shell's cache in this task — that is a follow-up.)

3. **Add a `recordSearchAggregatedItems` memo** just above the existing `subjectCrossSectionRequirements` memo (≈ line 395):
   ```text
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
       // Address History only loads record-type services per the structure
       // endpoint, so every aggregated field gets the same bucket index
       // (matches the constant SERVICE_TYPE_ORDER_RECORD = 1 used by
       // RecordSearchSection).
       resolveServiceTypeOrder: () => 1,
     });
   }, [addressHistoryEntries, addressHistoryFieldsByEntry, personalInfoFields]);
   ```
   Memoised so it only recomputes when its inputs change (correctness with spec rule 12 — rapid navigation must produce consistent results; React effects only fire after the memo settles).

4. **Add a `stepVisibility` memo** just below `recordSearchAggregatedItems`:
   ```text
   const stepVisibility = useMemo(
     () =>
       computeDynamicStepVisibility({
         personalInfoFields,
         subjectCrossSectionRequirements,
         recordSearchAggregatedItems,
       }),
     [
       personalInfoFields,
       subjectCrossSectionRequirements,
       recordSearchAggregatedItems,
     ],
   );
   ```

5. **Transform `sectionsWithStatus` into a filtered view.** The existing `sectionsWithStatus` memo (lines 475–498) currently maps every section returned by the structure endpoint. After Task 8.5 the OUTPUT must exclude skipped dynamic steps. Two acceptable shapes:

   - **(Recommended) Option A:** Add a `visibleSectionsWithStatus` derivation immediately AFTER the existing `sectionsWithStatus` memo, using `filterDynamicSteps(sectionsWithStatus, stepVisibility)`. Then rewire downstream consumers (`navigableSections`, both `<PortalSidebar>` instances, `<ReviewSubmitPage sections={…}>`, and the dispatch `section.find(...)` lookups) to use the filtered list. **Important:** the dispatch `getActiveContent()` finds the active section by id from the full `sections` array (line 744), NOT from `sectionsWithStatus`. We leave that lookup untouched so the candidate cannot get "stranded" mid-edit if `activeSection` happens to be set to a step that just became skipped (defensive — the navigation helper introduced in step 6 below prevents this in practice).

   - **(Rejected) Option B:** Mutate `sectionsWithStatus` directly to filter. Rejected because the filtered list and the unfiltered list have different responsibilities: the unfiltered list still matters for the `section.find()` dispatch and for any future read of "what sections exist on this package?". Keeping both makes the relationship explicit.

   Concrete edit:
   ```text
   const visibleSectionsWithStatus = useMemo(
     () => filterDynamicSteps(sectionsWithStatus, stepVisibility),
     [sectionsWithStatus, stepVisibility],
   );
   ```

6. **Rewire navigation and rendering consumers** to use `visibleSectionsWithStatus`:
   - Line 641: `const navigableSections = useMemo(() => visibleSectionsWithStatus, [visibleSectionsWithStatus]);` (replaces the current dependency).
   - Lines 766–768 (Review page descriptor list): replace `sectionsWithStatus.filter(...)` with `visibleSectionsWithStatus.filter((s) => s.type !== 'review_submit')`.
   - Lines 997 and 1004 (both `<PortalSidebar sections={…}>` instances): change `sectionsWithStatus` to `visibleSectionsWithStatus`.

   Notes:
   - The dispatch lookup `const section = sections.find(s => s.id === activeSection)` at line 744 STAYS on the unfiltered `sections` prop. See the defensive comment in step 5.
   - `sectionsWithStatus` is still used by the lifted Personal Info progress effect (line 432: `sections.find((s) => s.type === 'personal_info')`). That effect should continue to consult the full prop (`sections`) so the computed status is correct even when the step is currently skipped — when the step later un-skips, the most recent status is already in `sectionStatuses` and the sidebar shows it.

7. **Add a "fall back to nearest visible step" effect.** Spec rule 7 / edge case 2 says recalculation can mean the active section gets skipped while the candidate is on a different step. When the candidate then arrives at a step that has just become invisible (e.g., they were on Personal Info, went back to Address History, removed the last country with subject fields, then clicked Next), the active step is no longer in the visible list. We catch this in an effect that runs on every change of `visibleSectionsWithStatus` and `activeSection`:
   ```text
   useEffect(() => {
     if (!activeSection) return;
     const stillVisible = visibleSectionsWithStatus.some(
       (s) => s.id === activeSection,
     );
     if (stillVisible) return;
     // Active step was just hidden by recalculation. Move forward to the
     // next visible step in the linear flow (spec rule 5 / 6 — Back from
     // the step after a skipped one goes to the step before; Next from the
     // step before a skipped one goes to the step after). The simplest
     // single-action implementation is: find the lowest-order visible
     // section whose `order` is greater than the active section's previous
     // order; if none, fall back to the first visible section.
     const previous = sectionsWithStatus.find((s) => s.id === activeSection);
     const previousOrder = previous?.order ?? -1;
     const next =
       visibleSectionsWithStatus.find((s) => s.order > previousOrder) ??
       visibleSectionsWithStatus[0];
     if (next) {
       handleSectionClick(next.id);
     }
   }, [visibleSectionsWithStatus, activeSection, sectionsWithStatus]);
   ```
   The handler uses the existing `handleSectionClick` so visit tracking, departure marking, and validation re-fetch continue to fire correctly. Per spec rule 8 this happens silently — no banner, no toast.

   **Edge-case 2 safety net:** spec edge case 2 says "a step cannot become empty while the candidate is viewing it." The effect above is the safety net for the rare case where that invariant is violated (e.g., a save callback that fires from a separate section while focus is technically on the to-be-skipped section). The effect's behavior in the happy path is a no-op.

8. **Reword the long comment block on `navigableSections`** (lines 635–640) to reflect Task 8.5: the navigable list is now `visibleSectionsWithStatus`, NOT the raw structure response — dynamic steps are filtered when they have no items.

9. **No changes** to `handleSectionProgressUpdate`, `handleCrossSectionRequirementsChanged`, or the cross-section registry effects. The visibility derivation reads from the registry directly via the existing `subjectCrossSectionRequirements` memo.

10. **No changes to the dispatch branches** in `getActiveContent()`. They render whichever section the candidate is on; the visibility filter prevents the candidate from being on a skipped section in the first place.

11. **File size note:** the additions are ≈ 35 lines net (≈ 50 lines added, ≈ 15 removed in rewording comments). The file remains over the 600 hard stop. **Andy preauthorizes this addition** for Task 8.5 on the same basis as Task 8.4 (§4.6 of the Task 8.4 plan): there is no clean extraction path for the navigation wiring without breaking the shell's single-orchestrator contract. A follow-up task (TD candidate) may extract `getActiveContent`, `navigableSections`, and the visibility wiring into a separate hook.

### 5.2 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/buildReviewSummary.ts`

**Was this file read before listing it here?** Yes — full file read (76 lines).

**What currently exists:**
- A single pure function `buildReviewSummary` that folds per-section errors into `ReviewPageSummary` and sets `allComplete = sectionResults.every((sr) => sr.status === 'complete')`.

**What needs to change and why:**

After Task 8.5, the candidate-portal shell must be able to exclude skipped steps from BOTH the Review page summary AND the `allComplete` calculation that gates the Submit button (spec rules 9 a, 9 b, 9 c).

There are two viable approaches:

- **(Recommended) Option A — Filter on the client.** Leave `buildReviewSummary` alone. The Review page already consumes a `sections` descriptor list from the portal-layout shell (lines 766–768 of `portal-layout.tsx`). The shell passes the filtered `visibleSectionsWithStatus` list there, so the Review page does not render skipped steps. For the Submit button, the shell already exposes `summary.allComplete` from the server result — but we need to additionally consider the case where a step is "newly visible and not yet complete" (spec rule 9 d).

  The clean answer: add a derived `submissionBlocked` value in the shell that is `true` when EITHER `!validationResult?.summary.allComplete` OR `visibleSectionsWithStatus` contains a section whose currently-merged status is not `'complete'` AND whose id is in `DYNAMIC_STEP_IDS`. Pass that into `<ReviewSubmitPage>` as a new `disableSubmit` prop (or piggy-back the existing `submitting` flag — see §5.3 below).

- **(Rejected) Option B — Teach the server validator about visibility.** Rejected because the cross-section registry is in-browser state. The server has no way to know what subject-targeted fields the candidate's address entries currently demand without re-implementing the registry server-side, which is a much larger lift and out of scope per the spec's "Impact on Other Modules" section.

**Concrete edit (none in this file).** This file is mentioned only to document the design decision. `buildReviewSummary.ts` is **NOT** modified in this task. The new "skip a step from review/submit" behavior is implemented in `portal-layout.tsx` and `ReviewSubmitPage.tsx` by passing the filtered section list and a derived "blocked because a dynamic step is incomplete" flag.

### 5.3 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/review-submit/ReviewSubmitPage.tsx`

**Was this file read before listing it here?** Yes — full file read (258 lines).

**What currently exists:**
- Receives `validationResult`, `sections`, `onErrorNavigate`, `onSubmit`, `submitting`, `submitError`, `onBack`.
- Renders one `ReviewSectionBlock` per entry in the `sections` descriptor list (Bug 3 fix from Phase 7).
- Computes Submit-disabled state from `!onSubmit || !validationResult?.summary.allComplete || submitting` (lines 223–232).

**What needs to change and why:**

Spec rule 9 makes the dynamic-step set authoritative for both rendering and submission:

- Rule 9 a — "If Step 7 is skipped, it does not appear in the review summary." The shell already controls the `sections` descriptor list, so passing the filtered list `visibleSectionsWithStatus` is sufficient. **No change needed in `ReviewSubmitPage.tsx`** for this rule beyond what's already there.

- Rule 9 b — "If Step 8 is skipped, same treatment." Same as above — `sections` prop already controls.

- Rule 9 c — "If a step was previously visible and complete but is now skipped, it does not block submission." `validationResult.summary.allComplete` is computed server-side from every section the engine knows about, which always includes `personal_info` and includes `address_history` (Record Search has no server-side validator per the Task 8.4 plan §4.8). So a skipped Personal Info will, in some scenarios, still appear as `incomplete` in `validationResult` even when the cross-section view says "no fields required." We need an override path on the client to ignore such a "phantom" status.

- Rule 9 d — "If a step was previously skipped but is now visible, it appears as incomplete in the review summary and the candidate must go back and fill it." When the step is now visible AND its merged local status is not `'complete'`, submission must be blocked even if the server has not yet caught up (e.g., the candidate just typed a country change but hasn't departed Address History yet to trigger /validate). This is the same OR-merged rule pattern we already use elsewhere — most-restrictive wins.

**Concrete change in this file:**

1. Add a single new optional prop `disableSubmit?: boolean` to `ReviewSubmitPageProps`. When `true`, the Submit button is forced disabled regardless of `validationResult.summary.allComplete`. When omitted, behavior is unchanged.
2. In the disabled-state ternary (lines 223–232 and lines 239–245), replace the condition with:
   ```text
   disabled={
     !onSubmit ||
     !validationResult?.summary.allComplete ||
     submitting ||
     disableSubmit === true
   }
   ```
   And the same condition is propagated to `aria-disabled` and the class-name ternary.
3. Update the JSDoc on `ReviewSubmitPageProps` to document the new prop:
   - "`disableSubmit` — Phase 8 Task 8.5. When true, the Submit button is forced disabled even if the server validation reports `allComplete`. Used by the shell to enforce client-side dynamic-step skipping (spec rule 9 d): when a previously-skipped step has just come back into scope and is locally incomplete, the shell sets this true so the candidate cannot submit until they fill the new fields. Optional and default-false so existing tests / fixtures keep their current behavior."
4. Update the `ReviewPageSectionDescriptor` JSDoc to note that the shell now passes a FILTERED list (skipped dynamic steps absent).

**No changes to the rendering loop, the error banner, the Back button, or the help-text paragraph.** The component remains presentational.

### 5.4 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx` (Review-page wiring)

This is the same file as §5.1; the dispatch into `<ReviewSubmitPage>` is called out separately so the edits are clear.

In the `review_submit` dispatch branch (lines 765–786), the wiring becomes:

1. The `sections` prop passed to `<ReviewSubmitPage>` (currently `sectionsWithStatus.filter(...)`) becomes `visibleSectionsWithStatus.filter((s) => s.type !== 'review_submit')`. This satisfies spec rules 9 a and 9 b.

2. Add a derived `disableSubmitForDynamicGaps` value just above `getActiveContent`:
   ```text
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
   ```
   Pass `disableSubmit={disableSubmitForDynamicGaps}` to `<ReviewSubmitPage>`. This satisfies spec rule 9 d.

3. **No need to override `validationResult.summary.allComplete` for skipped sections.** The Submit button now consults BOTH `summary.allComplete` AND `disableSubmit`. If the server's `allComplete` is already `true` (because skipped sections happened to validate as `'complete'` server-side), Submit is enabled — which is the intended behavior. The new `disableSubmit` only adds restrictions; it never relaxes them.

   The remaining concern (rule 9 c) is: a step is skipped on the client but the server thinks it is incomplete (because Personal Info has unfilled required fields server-side). This is the inverse case. To address it, the shell additionally overrides the `summary.allComplete` value passed into `<ReviewSubmitPage>` so that the server's "incomplete" verdict on a skipped section is suppressed. Concrete change:
   ```text
   const effectiveValidationResult = useMemo(() => {
     if (!validationResult) return validationResult;
     // Rule 9 c — a skipped dynamic step does not block submission. Replace
     // the engine's "incomplete" verdict with "complete" for any dynamic
     // section that is currently NOT in the visible list, and recompute
     // allComplete from the patched section list.
     const visibleIds = new Set(visibleSectionsWithStatus.map((s) => s.id));
     const dynamicIds = new Set<string>([
       DYNAMIC_STEP_IDS.PERSONAL_INFO,
       DYNAMIC_STEP_IDS.RECORD_SEARCH,
     ]);
     const patchedSections = validationResult.summary.sections.map((s) => {
       if (dynamicIds.has(s.sectionId) && !visibleIds.has(s.sectionId)) {
         return { ...s, status: 'complete' as const, errors: [] };
       }
       return s;
     });
     const allComplete = patchedSections.every((s) => s.status === 'complete');
     return {
       ...validationResult,
       summary: {
         ...validationResult.summary,
         sections: patchedSections,
         allComplete,
       },
     };
   }, [validationResult, visibleSectionsWithStatus]);
   ```
   Pass `validationResult={effectiveValidationResult}` to `<ReviewSubmitPage>`. **No type changes** — `effectiveValidationResult` has the same `FullValidationResult` shape.

   This is the **one place** the shell is allowed to mutate the engine's verdict, and the rule it implements is documented in the merge-logic comment block per CODING_STANDARDS Section 8.4: "Skipped dynamic step → suppress engine verdict (most-permissive wins for skipping; most-restrictive wins for newly visible). Both are correct because skipping is a client-side reflection of the candidate's current entries, which the engine does not see."

### 5.5 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/sectionVisitTracking.ts`

**Was this file read before listing it here?** Yes — relevant section read (lines 100–135).

**What currently exists:** `shouldShowErrorsForSection` decides whether to show errors for a section. Errors only show after the section has been visited+departed OR after the review page has been visited at least once.

**What needs to change and why:** **No change.** The visit-tracking logic does not need to know about skipping; a skipped section is simply never rendered and never visited. When the section becomes visible again, the existing visit records (from a prior visit while it was visible) are still in `sectionVisits` and the existing logic correctly drives error visibility for the candidate's next interaction. Spec resolved question 3 ("a skipped-then-returned step retains its previous completion status") is therefore satisfied by the existing design without changes.

### 5.6 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.test.tsx`

**Was this file read before listing it here?** Yes — relevant sections read.

**What currently exists:** Tests for header, sidebar, section navigation, step navigation, mobile menu, TD-059 lifted Personal Info status.

**What needs to change and why:**

This file is in scope for the test writer (not the architect). The test writer will:

1. Add a new `describe('dynamic step skipping (Task 8.5)', () => {...})` block.
2. Use a fixture that includes both Personal Info and Record Search sections in the structure prop, plus stubs that let the test simulate "cross-section registry empty" vs "non-empty" and "aggregated items empty" vs "non-empty" by injecting state via the existing `RepeatableSectionStub` pattern.

The test surface is enumerated in §11. **The test writer must not modify production code in this file.**

### 5.7 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/__tests__/stepVisibility.test.ts`

**Was this file read before listing it here?** N/A — new file authored by the test writer.

The test writer will create this file alongside the existing `__tests__/` pattern. See §11 for the test cases.

---

## 6. Files NOT to Touch / Behaviors NOT to Add

### 6.1 No structure-endpoint change

`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/route.ts` is **NOT** modified by this task. The structure endpoint continues to emit `personal_info` unconditionally (line 396 today) and continues to emit `record_search` when the package has at least one record service (line 415). The visibility decision is entirely client-side; the server cannot see the cross-section registry. This matches the spec's "Impact on Other Modules" section: "No changes to API routes used by internal users or customers."

### 6.2 No new API routes, no new Zod schemas, no new TypeScript types in `/src/types/`

The task adds **one new helper module** (`stepVisibility.ts`) that exports its own input/output types locally. Per CODING_STANDARDS Section 3.3, types only get lifted to `/src/types/` when they are used in more than one place. These types are not.

### 6.3 No save-side change

`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/route.ts` is **NOT** modified. Spec Business Rule 10 explicitly says "Recalculation does not trigger auto-save," and Business Rule 3 says "Data preservation for removed fields ... it is NOT deleted." Both rules are satisfied by NOT changing the save behavior — the registry/visibility computation runs entirely in browser state.

### 6.4 No translation keys

No new user-facing strings are introduced (spec rule 8 explicitly forbids warning banners and alerts). The existing `candidate.portal.personalInfo.noFieldsRequired` / `candidate.recordSearch.noFieldsRequired` keys are NOT used by Task 8.5 because the sections themselves are now hidden — the candidate never reaches the empty-state branch. Those keys remain in place for completeness (a section could become visible while having zero items if a future code path produces that state; the keys then serve as a final safety net).

### 6.5 No changes to `RecordSearchSection.tsx`, `PersonalInfoSection.tsx`, or any other section component

The sections themselves do not need to know about skipping. The shell prevents them from rendering when they should be skipped; when they do render, they behave exactly as Task 8.3 / 8.4 left them. No prop changes, no new state, no new effects.

### 6.6 No changes to `mergeSectionStatus`, `validationEngine`, or `usePortalValidation`

The merge rules already handle "section status from multiple sources." The new rule introduced by Task 8.5 — "skipped section → ignore engine verdict" — lives in the shell, not in the merge helper, because it depends on the visibility decision which the helper does not see.

### 6.7 No comment / banner / toast saying "your information has changed"

Spec rule 8: "No warnings or alerts." The shell silently recomputes and silently navigates past skipped steps. The test writer adds explicit negative assertions (no toast, no banner) to enforce this.

### 6.8 Files explicitly NOT touched (full list)

- `prisma/schema.prisma` (no schema change)
- `src/app/api/candidate/application/[token]/structure/route.ts`
- `src/app/api/candidate/application/[token]/save/route.ts`
- `src/app/api/candidate/application/[token]/saved-data/route.ts`
- `src/app/api/candidate/application/[token]/validate/route.ts`
- `src/app/api/candidate/application/[token]/personal-info-fields/route.ts`
- `src/app/api/candidate/application/[token]/fields/route.ts`
- `src/lib/candidate/sectionProgress.ts`
- `src/lib/candidate/crossSectionRegistry.ts`
- `src/lib/candidate/validation/buildReviewSummary.ts`
- `src/lib/candidate/validation/validationEngine.ts`
- `src/lib/candidate/validation/mergeSectionStatus.ts`
- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`
- `src/lib/candidate/usePortalValidation.ts`
- `src/lib/candidate/sectionVisitTracking.ts`
- `src/lib/candidate/addressHistoryStage4Wiring.ts` (helpers consumed unchanged)
- `src/components/candidate/portal-sidebar.tsx` (data-driven — picks up the filtered list automatically)
- `src/components/candidate/form-engine/PersonalInfoSection.tsx`
- `src/components/candidate/form-engine/RecordSearchSection.tsx`
- `src/components/candidate/form-engine/AddressHistorySection.tsx`
- `src/components/candidate/form-engine/EducationSection.tsx`
- `src/components/candidate/form-engine/EmploymentSection.tsx`
- `src/components/candidate/form-engine/IdvSection.tsx`
- `src/components/candidate/CrossSectionRequirementBanner.tsx`
- `src/components/candidate/StepNavigationButtons.tsx`
- `src/translations/*.json` (no new keys)
- `src/types/candidate-portal.ts`
- `src/types/candidate-stage4.ts`
- `src/types/candidate-record-search.ts`

---

## 7. API Routes

**None new. None modified.**

The candidate-portal API surface is untouched by this task. The structure endpoint, save endpoint, saved-data endpoint, validate endpoint, personal-info-fields endpoint, and fields endpoint all continue to behave exactly as Task 8.4 left them.

The only new I/O the shell performs is the per-entry DSX field fetch via the existing `/api/candidate/application/[token]/fields` endpoint, which `useEntryFieldsLoader` already calls. The shell uses the same endpoint with the same query shape (no new query parameters, no new response fields).

---

## 8. Zod Validation Schemas

**None new. None modified.**

No new request bodies cross the API boundary. The `stepVisibility.ts` helper validates its own inputs by TypeScript types only — it is an internal pure function, not an I/O boundary, so per CODING_STANDARDS Section 3.4 a TypeScript interface is sufficient.

---

## 9. TypeScript Types

### 9.1 New (local to `src/lib/candidate/stepVisibility.ts`)

- `StepVisibilityInputs` — input shape for `computeDynamicStepVisibility`.
- `StepVisibilityResult` — output shape.
- `DYNAMIC_STEP_IDS` (`const` object literal) — section id constants.

These types are not lifted to `/src/types/` because they are consumed only by `portal-layout.tsx` and the helper's own tests (CODING_STANDARDS Section 3.3).

### 9.2 No new types in `/src/types/`

`CandidatePortalSection`, `FullValidationResult`, `ReviewPageSummary`, `SectionStatus`, `CrossSectionRequirementEntry` are all unchanged. The shell uses existing types throughout.

---

## 10. UI Components

### 10.1 No new components

No new presentational component is needed. Spec rule 8 forbids warnings and alerts; rule 1/2 say recalculation is silent.

### 10.2 Modified — `portal-layout.tsx` (shell, client component)

See §5.1 and §5.4. Changes are confined to imports, new memos for aggregated items / visibility / effective validation result / submit blocking, a transformed `visibleSectionsWithStatus`, a fall-back-to-visible effect, and rewiring of three downstream consumers (sidebar, navigable list, Review page descriptor list and validation result).

### 10.3 Modified — `ReviewSubmitPage.tsx` (client component)

See §5.3. One new optional `disableSubmit?: boolean` prop, propagated into the disabled-state ternary. No other rendering changes.

### 10.4 No changes to `PortalSidebar`, `StepNavigationButtons`, `SectionProgressIndicator`, or any section component

The sidebar already iterates whatever `sections` prop it gets; the new filtered list is rendered automatically. The step-navigation row reads its `onBack` / `onNext` callbacks from the shell, which compute against the filtered `navigableSections` list — so Next/Back already skip over hidden dynamic steps without any per-button change.

---

## 11. Test Plan Outline

The test writer authors all tests. This plan only enumerates the test surface.

### 11.1 New — `src/lib/candidate/__tests__/stepVisibility.test.ts`

Unit tests for the pure helper. No mocking required.

- `personalInfoVisible` is true when `personalInfoFields.length > 0` and `subjectCrossSectionRequirements` is empty.
- `personalInfoVisible` is true when `personalInfoFields` is empty and `subjectCrossSectionRequirements.length > 0`.
- `personalInfoVisible` is true when both are non-empty.
- `personalInfoVisible` is false when both are empty.
- `recordSearchVisible` is true when `recordSearchAggregatedItems.length > 0`.
- `recordSearchVisible` is false when `recordSearchAggregatedItems` is empty.
- `filterDynamicSteps` removes `personal_info` when `personalInfoVisible=false` and leaves every other section in place (workflow_section, service_section, address_history, record_search, review_submit).
- `filterDynamicSteps` removes `record_search` when `recordSearchVisible=false` and leaves every other section in place.
- `filterDynamicSteps` removes BOTH when both flags are false; the navigation flow goes `... → after_services → review_submit` (spec edge case 4).
- `filterDynamicSteps` is a pure function — same inputs produce the same outputs, no mutation of the input array.

### 11.2 Extended — `src/components/candidate/portal-layout.test.tsx`

New `describe('dynamic step skipping (Task 8.5)', () => {...})` block. Uses the existing `RepeatableSectionStub` pattern from the TD-059 block (lines 79–187 of the test file today) to drive cross-section registry state and emulate aggregated-items state.

Per spec rules and edge cases:

- **Rule 1 (silent recalc on Personal Info arrival):** Navigate from a section that pushed subject-targeted requirements into the registry; assert Personal Info renders with the new field as empty AND no banner / toast appears.
- **Rule 2 (silent recalc on Record Search arrival):** Same shape but for Record Search; needs a fixture that produces aggregated items.
- **Rule 5 (Personal Info skipped when registry empty):** No subject requirements pushed, no local Personal Info fields → Personal Info entry is NOT in the sidebar; Next from the section before it goes to the section after it (or to Review & Submit if no further section).
- **Rule 6 (Record Search skipped when aggregated items empty):** Aggregated items list is empty → Record Search entry is NOT in the sidebar; Next from Personal Info (or the prior section) jumps over.
- **Rule 7 (dynamic transitions):** Start with Personal Info skipped (no cross-section requirements). Trigger the stub button that pushes a registry entry. Assert Personal Info now appears in the sidebar.
- **Rule 7 (reverse direction):** Start with Personal Info visible. Trigger the stub button that clears the registry source. Assert Personal Info is now hidden.
- **Rule 8 (silent):** Explicit negative assertion — no `data-testid="banner"`, no element with role `alert` appears as a result of recalculation.
- **Rule 9 a / b (skipped steps absent from review summary):** Navigate to Review & Submit while Personal Info and Record Search are both skipped. Assert neither section name appears in the review list rendered by `<ReviewSectionBlock>`. (Note: descriptor list is filtered by the shell; `<ReviewSubmitPage>` does not see the skipped sections at all.)
- **Rule 9 c (skipped step does not block submission):** Mock the validation result to say `personal_info` is `incomplete` server-side. With visibility-skipped Personal Info, assert the Submit button is enabled.
- **Rule 9 d (newly visible step blocks submission):** Make Personal Info visible via the cross-section stub WITHOUT typing anything into it. Visit Review & Submit. Assert Submit is disabled (the new `disableSubmit` path).
- **Edge case 2 safety net (active section becomes invisible):** Use the stub to make the candidate "be on" Personal Info, then clear the registry. Assert the shell navigates the candidate to the next visible step automatically (Address History, the after_services workflow section, or Review & Submit depending on fixture).
- **Edge case 4 (both dynamic steps skipped):** No registry entries, no aggregated items. Assert Next from the last service section goes directly to the first after-services workflow section (or Review & Submit if no after-services sections exist).
- **Edge case 5 (only one of the two is skipped):** Aggregated items present but no cross-section requirements → Record Search visible, Personal Info skipped. Assert Next from Employment lands on Record Search; Back from Record Search lands on Employment.
- **Resolved question 3 (skipped-then-returned retains status):** Mark Personal Info `complete` locally, skip it, then un-skip it. Assert the sidebar still shows the `complete` status (the most recent value in `sectionStatuses`) — the merge rule's "incomplete wins" still applies if a new required field has appeared, but the prior `complete` is preserved as the starting point.

### 11.3 Extended — `src/components/candidate/review-submit/ReviewSubmitPage.test.tsx` (if exists, else create)

- New optional `disableSubmit` prop forces Submit disabled regardless of `validationResult.summary.allComplete`.
- Omitted `disableSubmit` retains current behavior (test the regression — existing assertions must keep passing).
- `aria-disabled` mirrors the disabled state.

### 11.4 Existing tests that must continue to pass without modification

The test writer should re-run the full vitest suite and confirm no net regression. Particular sets at risk:

- `src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts` — structure endpoint behavior unchanged.
- `src/app/api/candidate/application/[token]/validate/__tests__/route.test.ts` — validate endpoint behavior unchanged.
- `src/components/candidate/portal-layout.test.tsx` Task 8.2 step navigation tests — they pass `linearSections` directly, with neither Personal Info nor Record Search skipped, so the dynamic-skip filter is a no-op for those fixtures.
- `src/components/candidate/portal-layout.test.tsx` TD-059 tests — the lifted progress effect still consults the full prop list, not the filtered one (see §5.1 step 6 note).

---

## 12. Order of Implementation

Per the architect template, database first, then outward. This task has no database changes, so implementation starts at step 3.

1. **Database schema changes** — none.
2. **Prisma migration** — none.
3. **TypeScript types** — none new in `/src/types/`. The new types are local to `stepVisibility.ts`.
4. **Zod schemas** — none.
5. **Library helpers (NEW):**
   - Create `src/lib/candidate/stepVisibility.ts` with `DYNAMIC_STEP_IDS`, `StepVisibilityInputs`, `StepVisibilityResult`, `computeDynamicStepVisibility`, `filterDynamicSteps`.
6. **UI components (MODIFIED):**
   - Modify `src/components/candidate/review-submit/ReviewSubmitPage.tsx` to accept the new optional `disableSubmit` prop and propagate it into the disabled-state ternary.
   - Modify `src/components/candidate/portal-layout.tsx` to:
     - Import `stepVisibility` helpers and `buildEntryFieldsBuckets` / `computeAddressHistoryAggregatedItems`.
     - Add `addressHistoryEntries` and `addressHistoryFieldsByEntry` state.
     - Extend the saved-data hydration effect to read `address_history.entries`.
     - Add the per-entry fields-fetch effect.
     - Add `recordSearchAggregatedItems`, `stepVisibility`, `visibleSectionsWithStatus`, `effectiveValidationResult`, and `disableSubmitForDynamicGaps` memos.
     - Add the "fall back to nearest visible step" effect.
     - Replace `sectionsWithStatus` with `visibleSectionsWithStatus` in: `navigableSections` derivation, both sidebar instances, the Review-page descriptor list.
     - Pass `validationResult={effectiveValidationResult}` and `disableSubmit={disableSubmitForDynamicGaps}` to `<ReviewSubmitPage>`.
7. **Translation keys** — none new.
8. **Tests** — the test writer authors them per §11 before the implementer makes the production code changes.

---

## 13. Risks and Considerations

1. **`portal-layout.tsx` is over the 600-LOC hard stop.** The plan adds ≈ 35 net lines. The implementer must stop and confirm with Andy per Implementer Absolute Rule 10 before touching the file. Andy preauthorizes this addition on the same basis as Task 8.4 (§4.6 of that plan): there is no clean extraction path for the navigation wiring without breaking the shell's single-orchestrator contract. A follow-up TD candidate is recommended to extract `getActiveContent` and the navigation/visibility wiring into a separate hook.

2. **Two truth sources for "what fields does Personal Info need to show right now?".** `PersonalInfoSection.tsx` uses its `fields` prop + `crossSectionRequirements` prop. The shell uses the same inputs to decide visibility. We pass the same data through both paths, so they cannot diverge. Test coverage in §11.2 includes a regression check that the section is never mounted while the shell believes it should be skipped.

3. **Per-entry DSX fields fetch in the shell.** The shell now performs the same `/fields` fetch loop that `RecordSearchSection.tsx` performs. This is duplicated I/O. Acceptable in v1 because (a) the fetches hit the same endpoint with the same cache keys, (b) browsers cache identical `GET` responses for the duration of a session, and (c) the alternative — adding a shared loader hook in another file — exceeds the spec's scope ("changes are confined to the portal layout's navigation logic and the recalculation triggers"). Note this as a tech debt candidate.

4. **Edge case 2 (active section becomes invisible) is the most subtle case.** The spec resolved question 1 says this cannot happen, but the safety net effect in §5.1 step 7 catches the race condition where a save callback from a different section flips visibility mid-render. The implementer must verify in browser smoke testing that the auto-navigate from an invisible active section feels natural (no flicker, no lost work in inputs).

5. **Spec rule 11 — "completes in under 1 second with no visible loading state."** The shell-level aggregated-items computation runs every time `addressHistoryEntries` or `addressHistoryFieldsByEntry` changes. With a typical candidate's 1–5 address entries and a small number of DSX fields per country, the computation is O(n × m) for n entries and m fields per entry — well under 1ms. The per-entry DSX fields fetch can take longer (network), but it is reused from the existing `useEntryFieldsLoader` cache pattern and runs only when entries change — not on every navigation event. The visibility memo settles synchronously from cached state once the fetches resolve. The implementer should verify that the per-entry fetch is not on the navigation critical path (the shell-level effect runs on a `useEffect`, which fires AFTER paint).

6. **`mergeSectionStatus` is NOT changed.** A skipped section's `localStatus` is never recomputed (it would be, but the section isn't mounted to recompute it). The status the sidebar shows for a hidden section is irrelevant (the section is not in the sidebar at all). When the section becomes visible again, the most recent `localStatus` from `sectionStatuses` is the value — which is exactly what spec resolved question 3 wants: "If Step 7 was previously marked complete, then got skipped, then came back with new fields, it retains its previous completion status."

7. **`validationResult.summary.allComplete` is patched on the shell side, not on the server.** The server's allComplete is still the source for "everything looks done." We override it ONLY when a dynamic section is currently skipped, by walking the section list and replacing its status with `complete`. This is the safest place to do the override — the engine remains pure and a future server-side audit can still see the engine's verdict in raw form.

8. **No throttling / no debounce.** Spec rule 12 explicitly says rapid navigation must produce correct results — there is no debounce. The visibility memo fires synchronously on every state change; the auto-navigate effect fires whenever the visible list changes. Tests must include a "click Back ten times rapidly" case to confirm no stale state.

9. **Network failure during per-entry DSX fetch.** If the fetch fails, the shell sees fewer aggregated items than the candidate would expect. That makes Record Search look skipped when it should not be. The implementer must NOT silently swallow the error — log via `logger.warn` (per CODING_STANDARDS Section 4.3) and accept the conservative skip. The candidate can revisit by clicking the sidebar entry; if the fetch then succeeds, the visibility recomputes and the entry reappears. Document this in the smoke-test runbook.

10. **No documentation of merge-logic was found in `mergeSectionStatus.ts` for the new "skipped section → suppress engine verdict" rule.** The plan documents it inline in `portal-layout.tsx` per CODING_STANDARDS Section 8.4. A future cleanup could centralize it in `mergeSectionStatus.ts`; out of scope for v1.

11. **The spec calls out mobile (320 px) explicitly (DoD #15).** No layout changes are introduced. The existing sidebar drawer, progress indicators, and Next/Back buttons all handle dynamic step counts without per-breakpoint code; the test writer should add one mobile-viewport regression test (set `window.innerWidth = 320` before render) to confirm the filtered list renders correctly in the slide-out drawer.

12. **Subject-targeted fields could in theory come from Education or Employment, not just Address History.** Today the spec describes "address, education, or employment entries" all contributing to the cross-section registry. The visibility decision treats this generically — it only inspects the registry's `subject` target, regardless of which source section pushed entries. So Personal Info will correctly become visible when Education entries introduce subject-targeted requirements, even though the documentation often centers on Address History.

---

## 14. Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above (1 new helper module, 1 modified shell, 1 modified review-submit page).
- [x] No file outside this plan will need to be modified. Verified by tracing: structure endpoint emits the section list unconditionally; sidebar consumes the array as-is; section components hold their own state and do not need to know about skipping; validation engine is patched client-side at the shell layer only; visit tracking continues to work on section IDs that may come and go.
- [x] All Zod schemas, types, and translation keys are listed. (None new for any of them; the helper's types are local.)
- [x] The plan is consistent with the spec's intent (silent recalc; dynamic skipping; no warnings; preserve saved data; Review & Submit respects the visible set).
- [x] The plan honors Implementer Absolute Rule 6 — the implementer cannot touch files outside this list. If a test depends on a file not in this list, the test is wrong (not the plan).

---

## 15. Files relevant to this task (absolute paths)

- `/Users/andyhellman/Projects/GlobalRx_v2/docs/specs/silent-recalculation-step-skipping.md` (spec)
- `/Users/andyhellman/Projects/GlobalRx_v2/docs/plans/personal-info-dynamic-technical-plan.md` (Task 8.3 plan — context)
- `/Users/andyhellman/Projects/GlobalRx_v2/docs/plans/task-8.4-record-search-requirements-technical-plan.md` (Task 8.4 plan — context)
- `/Users/andyhellman/Projects/GlobalRx_v2/docs/plans/linear-step-navigation-technical-plan.md` (Task 8.2 plan — context)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx` (modified)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/review-submit/ReviewSubmitPage.tsx` (modified)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/stepVisibility.ts` (new)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/addressHistoryStage4Wiring.ts` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/crossSectionRegistry.ts` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/sectionProgress.ts` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/RecordSearchSection.tsx` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/useEntryFieldsLoader.ts` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-stage4.ts` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-repeatable-form.ts` (consumed unchanged)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/__tests__/stepVisibility.test.ts` (new — author by test writer)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.test.tsx` (extended — author by test writer)
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/review-submit/ReviewSubmitPage.test.tsx` (extended or new — author by test writer)

The plan is ready for the test-writer to proceed.
