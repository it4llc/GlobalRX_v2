# Technical Plan: Portal Layout Extraction Refactor
**Based on specification:** `docs/specs/portal-layout-extraction-refactor.md` (May 15, 2026)
**Date:** May 15, 2026
**Status:** Ready for test-writer / implementer

> **Scope reminder.** This is a PURE STRUCTURAL REFACTOR. Zero behavior changes. Zero new features. Zero test logic changes. The 4,916+ existing tests are the safety net.

> **Directory choice.** The spec proposes `src/hooks/candidate/`, but every existing candidate-portal hook lives in `src/lib/candidate/` (`usePortalValidation.ts`, `useRepeatableSectionStage4Wiring.ts`). The user's instructions to the architect explicitly say "matches existing pattern: `src/lib/candidate/`". This plan uses `src/lib/candidate/` so the new hooks live next to the helpers they compose. No spec-mandated behavior changes — the spec rule that matters (Rule 2) is "no changes to components outside portal-layout.tsx," which we honor.

---

## §1. Inventory of `portal-layout.tsx`

The current file is **1,534 lines**. Below is a line-numbered classification of every top-level symbol inside `PortalLayout`. Destinations:

- **VIS** → `useDynamicStepVisibility` (Hook 1)
- **MERGE** → `useSectionStatusMerge` (Hook 2)
- **NAV** → `useStepNavigation` (Hook 3)
- **STAYS** → remains in `portal-layout.tsx`

### 1.1 `useState` declarations

| Line | Symbol | Dest | One-line justification |
|---|---|---|---|
| 93 | `activeSection` | **NAV** | Owned by navigation; written by `handleSectionClick`/`handleNext`/`handleBack`. |
| 94 | `isMobileMenuOpen` | **STAYS** | Pure shell-chrome state; only consumed by JSX/sidebar toggling. |
| 111 | `sectionStatuses` | **MERGE** | The merge hook's primary output channel — every status writer (`handleSectionProgressUpdate`) and reader (`sectionsWithStatus`) lives in merge. |
| 121 | `crossSectionRegistry` | **STAYS** | Shared by VIS (drives `subjectCrossSectionRequirements`) AND PersonalInfo progress effect (which lives in MERGE territory). Keeping it in portal-layout means we thread the derived subject array into both hooks; lifting it into a hook would require a circular dependency. |
| 129 | `workflowAcknowledgments` | **STAYS** | Owned by the shell's workflow-section dispatch + `handleWorkflowAcknowledge`; neither hook needs it. |
| 136 | `personalInfoFields` | **VIS** | Hydration of /personal-info-fields is the visibility hook's effect; the array feeds the visibility memo. (PortalLayout reads it back to pass to PersonalInfoSection — exposed via hook return.) |
| 146 | `personalInfoFieldsLoaded` | **VIS** | Loading gate, paired with `personalInfoFields`; only consumed by the visibility memo's loading-guard branch. |
| 152 | `personalInfoSavedValues` | **STAYS** | Read by (a) the PersonalInfo progress effect that lives in MERGE conceptually, and (b) the JSX dispatch that hands `initialSavedValues` to `PersonalInfoSection`. Lifting it into VIS or MERGE would force the JSX to import a hook return just to pass a prop. Stays in portal-layout; threaded into MERGE as an arg. |
| 160 | `addressHistoryEntries` | **VIS** | Hydration + `refreshAddressHistoryEntries` write it; aggregated-items memo reads it. Pure VIS concern. |
| 161 | `addressHistoryFieldsByEntry` | **VIS** | Same effect family; per-entry DSX field cache. |
| 173 | `fetchedEntryCountryPairs` | **VIS** | Sentinel set for the per-entry fields effect; only VIS touches it. |
| 181 | `savedDataHydration` | **STAYS** | Consumed by usePortalValidation (passed in as init args) AND by VIS (drives `savedDataHydrated`). Stays in portal-layout because both hooks need to read it; lifting it into VIS would force portal-layout to re-derive a boolean from hook return just to feed usePortalValidation. |
| 190 | `submitting` | **STAYS** | Part of `handleSubmit` UI flow; not part of refactor scope. |
| 191 | `submitError` | **STAYS** | Same as above. |

### 1.2 Other top-level hook calls and refs

| Line | Symbol | Dest | Justification |
|---|---|---|---|
| 196 | `router` (`useRouter`) | **STAYS** | Used by `handleSubmit`. |
| 197 | `t` (`useTranslation`) | **STAYS** | Used by `handleSubmit` only. |
| 204-217 | `usePortalValidation({...})` destructured | **STAYS** | Already an external hook; its return is consumed by all three new hooks. Calling it stays in portal-layout so the three new hooks each receive precisely the subset they need (no implicit context). |

### 1.3 `useEffect` blocks

| Lines | Purpose | Dest | Justification |
|---|---|---|---|
| 220-229 | Window resize → close mobile menu | **STAYS** | Shell chrome only. |
| 245-345 | Saved-data hydration effect (workflow acks, personal-info saved values, address-history entries, section visits, statuses) | **STAYS** (orchestrator), **VIS** (writes `addressHistoryEntries`), **MERGE** (initial `statusUpdates` for workflow), **portal-validation** (visits, review timestamp) | This single effect fans out to four destinations. Per "no behavior changes" and "no new abstractions," we keep it in portal-layout as the orchestrator and have it write to: (a) `setWorkflowAcknowledgments`, `setSavedDataHydration` directly (STAYS); (b) a VIS-exported setter `setAddressHistoryEntries` exposed as `addressHistoryEntriesActions.hydrate(...)`; (c) MERGE-exported `setSectionStatuses` exposed via `bulkPatchStatuses(...)`. Rationale: splitting this effect across hooks risks reordering writes between renders, which is exactly the kind of subtle behavior change we must avoid. |
| 353-357 | Mark default section visited once hydration completes | **STAYS** | Talks only to portal-validation (`markSectionVisited`); single line, no benefit to lifting. |
| 364-397 | `/personal-info-fields` one-time fetch | **VIS** | Pure VIS hydration. Moves wholesale; portal-layout never reads `personalInfoFields` outside the JSX dispatch (and gets it back from `useDynamicStepVisibility`'s return). |
| 407-483 | Per-entry DSX field fetch (driven by `addressHistoryEntries`) | **VIS** | Reads `addressHistoryEntries`, writes `addressHistoryFieldsByEntry` + `fetchedEntryCountryPairs`. Pure VIS. |
| 689-725 | **TD-059 lifted Personal Info progress derivation** — recomputes `sectionStatuses['personal_info']` whenever fields/saved values/cross-section requirements change | **MERGE** | This effect calls `handleSectionProgressUpdate` (a MERGE callback) and consumes `personalInfoFields`, `personalInfoSavedValues`, `subjectCrossSectionRequirements`. MERGE owns sectionStatuses, so MERGE owns this effect. Its input args become: `sections, personalInfoFields, personalInfoSavedValues, subjectCrossSectionRequirements`. ⚠ **Hot spot — see §4.3 for the address-history-red bug interlock.** |
| 1190-1209 | Safety net: navigate to next visible step when active section becomes hidden | **NAV** | Reads `activeSection`, `visibleSectionsWithStatus`, `sectionsWithStatus`; writes via `handleSectionClick`. Pure NAV concern. |

### 1.4 `useMemo` blocks

| Lines | Symbol | Dest | Justification |
|---|---|---|---|
| 566-569 | `subjectCrossSectionRequirements` | **STAYS** | Threaded into VIS (visibility input), MERGE (PersonalInfo progress effect), and JSX (PersonalInfoSection prop). Single source of truth at the orchestrator level. |
| 578-591 | `recordSearchAggregatedItems` | **VIS** | Visibility input; depends on VIS-owned `addressHistoryEntries`/`addressHistoryFieldsByEntry` and the orchestrator-level `personalInfoFields` (passed in). |
| 599 | `savedDataHydrated` (const, not memo) | **STAYS** | One-liner boolean derivation; threaded into VIS as an arg. |
| 611-620 | `addressHistoryFieldsLoaded` | **VIS** | Loading gate consumed only by VIS's `stepVisibility` memo. |
| 633-657 | `stepVisibility` | **VIS** | Core VIS output. |
| 664-676 | `templateVariableValues` | **STAYS** | Consumed only by WorkflowSectionRenderer JSX dispatch. |
| 733-780 | `sectionsWithStatus` (merge + record_search override) | **MERGE** | Core MERGE output. Depends on `sections`, `sectionStatuses` (MERGE), `validationResult`, `sectionVisits`, `reviewPageVisitedAt` — all passed in. |
| 790-793 | `visibleSectionsWithStatus` | **MERGE** | Filters `sectionsWithStatus` by `stepVisibility`. Stays in MERGE because MERGE consumes VIS output (visibility) as an arg. |
| 803-841 | `effectiveValidationResult` | **MERGE** | Same MERGE concern — patches the validation result against `visibleSectionsWithStatus`. |
| 849-861 | `disableSubmitForDynamicGaps` | **MERGE** | Derived from `visibleSectionsWithStatus`. |
| 1107-1110 | `navigableSections` | **NAV** | Trivial pass-through of `visibleSectionsWithStatus`; kept as a memo to preserve referential stability. Lives in NAV (NAV consumes `visibleSectionsWithStatus` as an arg). |
| 1112-1115 | `activeSectionIndex` | **NAV** | Pure NAV derivation. |

### 1.5 `useCallback` blocks

| Lines | Symbol | Dest | Justification |
|---|---|---|---|
| 490-500 | `handleSectionClick` (defined inline — NOT useCallback today) | **NAV** | Returned from NAV as a stable useCallback (one tiny upgrade: today it's an inline closure, the refactor must preserve that semantic — see §4.2). |
| 502-504 | `toggleMobileMenu` | **STAYS** | Shell chrome. |
| 506-508 | `closeMobileMenu` | **STAYS** | Shell chrome. |
| 514-522 | `handleSectionProgressUpdate` | **MERGE** | Sole writer of `sectionStatuses`. |
| 527-543 | `handleCrossSectionRequirementsChanged` | **STAYS** | Writes `crossSectionRegistry` (which stays). Passed into Education/Employment/AddressHistory section JSX. |
| 545-552 | `handleCrossSectionRequirementsRemovedForEntry` | **STAYS** | Same. |
| 554-561 | `handleCrossSectionRequirementsRemovedForSource` | **STAYS** | Same. |
| 867-874 | `getValidationForSection` | **STAYS** | Inline helper consumed only by the JSX dispatch. |
| 879-889 | `handleReviewErrorNavigate` | **STAYS** | Consumed by ReviewSubmitPage JSX; delegates to `handleSectionClick` (NAV). Calls NAV's return — fine. |
| 901-955 | `handleSubmit` | **STAYS** | Phase 7 Stage 2; not part of refactor scope. |
| 963-996 | `handleWorkflowAcknowledge` | **STAYS** | Consumed by WorkflowSectionRenderer JSX; writes `workflowAcknowledgments` + calls MERGE's `handleSectionProgressUpdate`. |
| 1012-1088 | `refreshAddressHistoryEntries` | **VIS** | Sole job is refreshing VIS state + invalidating VIS caches. Returned from VIS. |
| 1095-1098 | `handleAddressHistorySaveSuccess` | **VIS** | Composes `refreshValidation` + `refreshAddressHistoryEntries`. Spec assigns this to VIS. Takes `refreshValidation` as an arg. |
| 1125-1159 | `scrollNewSectionIntoView` | **NAV** | Internal helper used only by `handleNext`/`handleBack`. |
| 1161-1171 | `handleNextClick` | **NAV** | Core NAV callback. |
| 1173-1180 | `handleBackClick` | **NAV** | Core NAV callback. |

### 1.6 Local helper functions inside the component

| Lines | Symbol | Dest | Justification |
|---|---|---|---|
| 1235-1497 | `getActiveContent()` | **STAYS** | Pure JSX dispatch — by definition this is what stays in portal-layout per the spec. |

### 1.7 JSX top-level render (lines 1499-1533)

Stays. Consumes hook returns + STAYS-state.

---

## §2. Hook contracts

> Every hook is a **`'use client'`** module. Each file begins with the project file-path comment (Coding Standards §1.1). Each return field has a one-line doc.

### 2.1 `useDynamicStepVisibility` (Hook 1 — VIS)

**File:** `src/lib/candidate/useDynamicStepVisibility.ts`

**TypeScript signature:**

```ts
interface UseDynamicStepVisibilityInput {
  /** Auth token, used in /personal-info-fields, /saved-data, /fields fetches. */
  token: string;
  /** Full structure-endpoint section list. */
  sections: CandidatePortalSection[];
  /** Initial address-history entries from /saved-data, written by the
   *  shell's hydration effect. `null` until hydration completes; the hook
   *  adopts it once on transition from `null` → non-`null`. */
  hydratedAddressHistoryEntries: EntryData[] | null;
  /** Whether /saved-data has settled (drives the loading-guard branch of
   *  `stepVisibility`). */
  savedDataHydrated: boolean;
  /** `subject`-target slice of the cross-section registry (orchestrator-
   *  level memo). Feeds the visibility OR-rule for Personal Info. */
  subjectCrossSectionRequirements: CrossSectionRequirementEntry[];
}

interface UseDynamicStepVisibilityOutput {
  /** /personal-info-fields response, exposed so portal-layout can pass
   *  it to PersonalInfoSection (TD-059 — section does NOT fetch its own). */
  personalInfoFields: PersonalInfoField[];
  /** True once the /personal-info-fields fetch has settled (success OR
   *  failure — both flip the gate). */
  personalInfoFieldsLoaded: boolean;
  /** True once every entry-with-country has a sentinel in
   *  `fetchedEntryCountryPairs` (or trivially when no such entries
   *  exist). */
  addressHistoryFieldsLoaded: boolean;
  /** Final boolean visibility decision for the two dynamic steps. */
  stepVisibility: StepVisibilityResult;
  /** Pre-filter aggregated items (kept on the return so MERGE / future
   *  callers don't have to re-derive). */
  recordSearchAggregatedItems: AggregatedRequirementItem[];
  /** Re-hydrates `addressHistoryEntries` from /saved-data and invalidates
   *  the per-entry fields cache for entries whose country changed. */
  refreshAddressHistoryEntries: () => Promise<void>;
  /** Wraps `refreshValidation()` + `refreshAddressHistoryEntries()` so
   *  AddressHistorySection's `onSaveSuccess` triggers both. Receives
   *  `refreshValidation` via closure when the hook is called. */
  handleAddressHistorySaveSuccess: () => void;
  /** Current address-history entries cache (read by the orchestrator's
   *  saved-data hydration effect to seed initial state, and exposed for
   *  Pass 2 tests if needed — though current tests do not assert on it). */
  addressHistoryEntries: EntryData[];
}

export function useDynamicStepVisibility(
  input: UseDynamicStepVisibilityInput,
  refreshValidation: () => Promise<void>,
): UseDynamicStepVisibilityOutput;
```

**What it owns:**
- State: `personalInfoFields`, `personalInfoFieldsLoaded`, `addressHistoryEntries` (after hydration adoption), `addressHistoryFieldsByEntry`, `fetchedEntryCountryPairs`.
- Effects: `/personal-info-fields` one-time fetch (current lines 364-397), per-entry DSX field fetch (current lines 407-483), plus a tiny adoption effect that pulls `hydratedAddressHistoryEntries` into `addressHistoryEntries` on the null→non-null transition (replacing the inline `setAddressHistoryEntries(nextAddressHistoryEntries)` call inside the current orchestrator saved-data effect, line 322).
- Memos: `recordSearchAggregatedItems` (578-591), `addressHistoryFieldsLoaded` (611-620), `stepVisibility` (633-657).
- Callbacks: `refreshAddressHistoryEntries` (1012-1088), `handleAddressHistorySaveSuccess` (1095-1098).

**What it does NOT own:**
- `crossSectionRegistry` and its writer callbacks — STAYS, because Section components write to it and MERGE reads `subjectCrossSectionRequirements`. Hoisting it would require a context.
- `subjectCrossSectionRequirements` memo — STAYS at orchestrator level. The hook takes the memoised array as an arg; deriving it inside would double-compute.
- `savedDataHydration` itself — STAYS. The hook only consumes the boolean `savedDataHydrated` and the hydrated entries array.

**External dependencies (already-existing helpers it composes):**
- `computeDynamicStepVisibility`, `filterDynamicSteps`, `DYNAMIC_STEP_IDS` from `@/lib/candidate/stepVisibility`
- `buildEntryFieldsBuckets`, `computeAddressHistoryAggregatedItems` from `@/lib/candidate/addressHistoryStage4Wiring`
- `clientLogger` from `@/lib/client-logger`
- Types: `EntryDsxField`, `EntryData`, `PersonalInfoField`, `CrossSectionRequirementEntry`, `AggregatedRequirementItem`, `CandidatePortalSection`, `StepVisibilityResult`

---

### 2.2 `useSectionStatusMerge` (Hook 2 — MERGE)

**File:** `src/lib/candidate/useSectionStatusMerge.ts`

**TypeScript signature:**

```ts
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
   *  effect (current lines 689-725). */
  personalInfoFields: PersonalInfoField[];
  /** Saved Personal Info values keyed by requirementId — same effect. */
  personalInfoSavedValues: Record<string, unknown>;
  /** Subject-target requirements — same effect (drives PersonalInfo's
   *  `requiredKeys` union via computePersonalInfoStatus). */
  subjectCrossSectionRequirements: CrossSectionRequirementEntry[];
}

interface UseSectionStatusMergeOutput {
  /** Sections with their merged status (Rule 27 merge + record_search
   *  visited-but-empty override). Used by the JSX `review_submit` branch
   *  and by VIS-filtered downstream consumers. */
  sectionsWithStatus: Array<CandidatePortalSection & { status: SectionStatus }>;
  /** Filtered version — skipped dynamic steps removed. Drives the
   *  sidebar, navigation, and Review-page descriptor list. */
  visibleSectionsWithStatus: Array<CandidatePortalSection & { status: SectionStatus }>;
  /** Validation result with skipped dynamic steps patched to `complete`
   *  with cleared error arrays (BR 9 c). */
  effectiveValidationResult: FullValidationResult | null;
  /** Most-restrictive override for the Submit button (BR 9 d). */
  disableSubmitForDynamicGaps: boolean;
  /** Stable callback handed to every section component as
   *  `onProgressUpdate`. */
  handleSectionProgressUpdate: (sectionId: string, status: SectionStatus) => void;
  /** Bulk patcher used ONLY by the orchestrator's saved-data hydration
   *  effect to seed workflow_section statuses on first load. Exposed as
   *  a setter callback to preserve the current single-write behavior. */
  bulkPatchSectionStatuses: (updates: Record<string, SectionStatus>) => void;
  /** Current local section status map (read by Pass 2 tests if needed
   *  — no current test asserts on it directly, but exposing it keeps the
   *  refactor reversible). */
  sectionStatuses: Record<string, SectionStatus>;
}

export function useSectionStatusMerge(
  input: UseSectionStatusMergeInput,
): UseSectionStatusMergeOutput;
```

**What it owns:**
- State: `sectionStatuses` (line 111).
- Callbacks: `handleSectionProgressUpdate` (514-522), plus the new `bulkPatchSectionStatuses` helper (extracts the inline `setSectionStatuses((prev) => ({ ...prev, ...statusUpdates }))` write at line 323 of the orchestrator effect).
- Memos: `sectionsWithStatus` (733-780, **including** the record_search override at 765-775), `visibleSectionsWithStatus` (790-793), `effectiveValidationResult` (803-841), `disableSubmitForDynamicGaps` (849-861).
- Effects: TD-059 lifted Personal Info progress derivation (689-725).

**What it does NOT own:**
- `crossSectionRegistry` writer callbacks — STAYS.
- `validationResult` / `sectionVisits` / `reviewPageVisitedAt` — owned by `usePortalValidation` (already external).
- `effectiveValidationResult` consumers (ReviewSubmitPage JSX) — STAYS.
- The `record_search` override **logic** stays inside MERGE (per spec). It needs `sectionVisits` + `reviewPageVisitedAt` as args, which is why MERGE takes them.

**External dependencies:**
- `mergeSectionStatus` from `@/lib/candidate/validation/mergeSectionStatus`
- `computePersonalInfoStatus` from `@/lib/candidate/sectionProgress`
- `DYNAMIC_STEP_IDS`, `filterDynamicSteps` from `@/lib/candidate/stepVisibility`
- Types: `SectionStatus`, `SectionVisitsMap`, `FullValidationResult`, `CandidatePortalSection`, `PersonalInfoField`, `CrossSectionRequirementEntry`, `StepVisibilityResult`

---

### 2.3 `useStepNavigation` (Hook 3 — NAV)

**File:** `src/lib/candidate/useStepNavigation.ts`

**TypeScript signature:**

```ts
interface UseStepNavigationInput {
  /** Default section id (first sidebar entry) — used as initial state. */
  defaultSection: string | null;
  /** From MERGE. Drives Next/Back walk and the safety-net effect. */
  visibleSectionsWithStatus: Array<CandidatePortalSection & { status: SectionStatus }>;
  /** From MERGE — only needed for the safety-net effect's "previousOrder"
   *  lookup (we need the order of a section that may have been filtered
   *  out of the visible list). */
  sectionsWithStatus: Array<CandidatePortalSection & { status: SectionStatus }>;
  /** Visit-tracking callbacks from usePortalValidation. */
  markSectionVisited: (sectionId: string) => void;
  markSectionDeparted: (sectionId: string) => void;
  markReviewVisited: () => void;
}

interface UseStepNavigationOutput {
  /** Id of the section the candidate is currently viewing. */
  activeSection: string | null;
  /** Memoised alias for `visibleSectionsWithStatus` (preserves the
   *  existing `navigableSections` reference identity). */
  navigableSections: Array<CandidatePortalSection & { status: SectionStatus }>;
  /** Index of `activeSection` within `navigableSections`, or `-1`. */
  activeSectionIndex: number;
  /** Click handler used by sidebar, ReviewSubmitPage error navigation,
   *  Next/Back. Inline closure today (NOT useCallback) — see §4.2. */
  handleSectionClick: (sectionId: string) => void;
  /** Next/Back button handlers. */
  handleNextClick: () => void;
  handleBackClick: () => void;
}

export function useStepNavigation(
  input: UseStepNavigationInput,
): UseStepNavigationOutput;
```

**What it owns:**
- State: `activeSection` (line 93).
- Memos: `navigableSections` (1107-1110), `activeSectionIndex` (1112-1115).
- Callbacks: `handleSectionClick` (490-500 — preserved as an inline closure inside the hook body, see §4.2), `scrollNewSectionIntoView` (1125-1159), `handleNextClick` (1161-1171), `handleBackClick` (1173-1180).
- Effects: safety-net fall-back-to-nearest-visible effect (1190-1209).

**What it does NOT own:**
- Mobile menu state (`isMobileMenuOpen` + toggle/close) — STAYS. Different concern.
- `handleReviewErrorNavigate` — STAYS; it's an inline closure consumed only by ReviewSubmitPage JSX and only delegates to `handleSectionClick`. Lifting it into NAV would require NAV to also be aware of ReviewSubmitPage's `ReviewError` shape, which is unrelated to navigation.

**External dependencies:**
- `clientLogger` from `@/lib/client-logger` (for the `window.scrollTo` fallback warnings).
- Types: `CandidatePortalSection`, `SectionStatus`

---

## §3. Extraction order with dependency graph

### 3.1 The order: **VIS → MERGE → NAV**

Verified by tracing the current file:

1. **MERGE needs VIS output.** Line 791: `filterDynamicSteps(sectionsWithStatus, stepVisibility)` — `stepVisibility` comes from VIS. Line 805: `new Set(visibleSectionsWithStatus.map(...))` patches `effectiveValidationResult` based on the filtered list. → VIS must be extracted first.
2. **NAV needs MERGE output.** Line 1108: `navigableSections = visibleSectionsWithStatus` — directly consumes MERGE's filtered list. Line 1196: `sectionsWithStatus.find(...)` — safety-net uses MERGE's unfiltered list. → MERGE must be extracted before NAV.
3. **VIS does NOT depend on MERGE or NAV.** VIS reads `subjectCrossSectionRequirements` (STAYS) and writes `addressHistoryEntries`/`fields*` state it owns. It never reads `sectionStatuses` or `activeSection`.

Final order: **VIS → MERGE → NAV**.

### 3.2 Step 1: Extract `useDynamicStepVisibility`

**Sub-symbols moved (line refs in current file):**
- State: `personalInfoFields` (136), `personalInfoFieldsLoaded` (146), `addressHistoryEntries` (160), `addressHistoryFieldsByEntry` (161), `fetchedEntryCountryPairs` (173).
- Effects: 364-397 (personal-info-fields fetch), 407-483 (per-entry fields fetch), **plus** a new adoption effect that copies `hydratedAddressHistoryEntries` → `addressHistoryEntries` on the null→non-null transition (replacing the inline write at line 322).
- Memos: 578-591 (`recordSearchAggregatedItems`), 611-620 (`addressHistoryFieldsLoaded`), 633-657 (`stepVisibility`).
- Callbacks: 1012-1088 (`refreshAddressHistoryEntries`), 1095-1098 (`handleAddressHistorySaveSuccess`).

**Props the hook accepts after extraction:**
```ts
useDynamicStepVisibility({
  token,
  sections,
  hydratedAddressHistoryEntries:
    savedDataHydration?.addressHistoryEntries ?? null, // see §4.1
  savedDataHydrated: savedDataHydration !== null,
  subjectCrossSectionRequirements,
}, refreshValidation)
```

**What portal-layout passes in:** `token`, `sections`, the hydrated address-history entries (which portal-layout extracts from saved-data before calling the hook), `savedDataHydrated` boolean, `subjectCrossSectionRequirements` memo, and `refreshValidation` (from `usePortalValidation`).

**Adjustment to the orchestrator saved-data effect (lines 245-345):** the inline `setAddressHistoryEntries(nextAddressHistoryEntries)` at line 322 is removed; instead, the parsed `nextAddressHistoryEntries` is included in the `setSavedDataHydration({...})` payload as a new field `addressHistoryEntries`. The VIS hook's adoption effect picks it up. This keeps the original effect's write ordering intact (still one `setSavedDataHydration` call at the end of the same render cycle).

**JSX in portal-layout immediately after extraction:** unchanged. PortalLayout reads `personalInfoFields`, `stepVisibility`, `refreshAddressHistoryEntries`, `handleAddressHistorySaveSuccess` from the hook return. The two callsites (PersonalInfoSection prop, AddressHistorySection prop) reference hook return values instead of local variables.

**Expected test impact:** **zero**. The VIS hook only changes the call site of three useState/useEffect declarations; it does not change which fetches fire, in what order, or with what URLs. All mocks in `portal-layout.test.tsx` are on child sections (`./form-engine/*`), not on lib/candidate hooks.

### 3.3 Step 2: Extract `useSectionStatusMerge`

**Sub-symbols moved (line refs in current file):**
- State: `sectionStatuses` (111).
- Callbacks: `handleSectionProgressUpdate` (514-522).
- Effects: 689-725 (TD-059 lifted Personal Info progress derivation).
- Memos: `sectionsWithStatus` (733-780), `visibleSectionsWithStatus` (790-793), `effectiveValidationResult` (803-841), `disableSubmitForDynamicGaps` (849-861).
- Logic block: record_search post-merge override (765-775) stays inside `sectionsWithStatus`.

**Props the hook accepts after extraction:**
```ts
useSectionStatusMerge({
  sections,
  validationResult,
  sectionVisits,
  reviewPageVisitedAt,
  stepVisibility,                    // from VIS
  personalInfoFields,                // from VIS (return)
  personalInfoSavedValues,           // STAYS
  subjectCrossSectionRequirements,   // STAYS (orchestrator memo)
})
```

**What portal-layout passes in:** all of the above, sourced from STAYS-state, `usePortalValidation`, and the VIS hook return.

**bulkPatchSectionStatuses use:** the orchestrator's saved-data effect (245-345) currently writes `setSectionStatuses((prev) => ({ ...prev, ...statusUpdates }))` at line 323. After extraction, the orchestrator imports `bulkPatchSectionStatuses` from MERGE's return and calls it instead. No write-order change; same single setSectionStatuses call on the same render.

**JSX in portal-layout immediately after extraction:** unchanged. The sidebar receives `visibleSectionsWithStatus`, ReviewSubmitPage receives `effectiveValidationResult` and `disableSubmit={disableSubmitForDynamicGaps}`, every section component continues to receive `(status) => handleSectionProgressUpdate(section.id, status)`.

**Expected test impact:** **zero**.

### 3.4 Step 3: Extract `useStepNavigation`

**Sub-symbols moved (line refs in current file):**
- State: `activeSection` (93).
- Inline closure: `handleSectionClick` (490-500) — **preserved as an inline closure inside the hook body** (NOT promoted to `useCallback`) per §4.2.
- Memos: `navigableSections` (1107-1110), `activeSectionIndex` (1112-1115).
- Callbacks: `scrollNewSectionIntoView` (1125-1159), `handleNextClick` (1161-1171), `handleBackClick` (1173-1180).
- Effects: safety-net fall-back (1190-1209).

**Props the hook accepts after extraction:**
```ts
useStepNavigation({
  defaultSection: sections.length > 0 ? sections[0].id : null,
  visibleSectionsWithStatus,
  sectionsWithStatus,
  markSectionVisited,
  markSectionDeparted,
  markReviewVisited,
})
```

**What portal-layout passes in:** MERGE return, `usePortalValidation` callbacks, and the computed `defaultSection`.

**JSX in portal-layout immediately after extraction:** uses `activeSection`, `handleSectionClick`, `handleNextClick`, `handleBackClick` from the hook return. The mark-default-section-visited effect (353-357) still lives in portal-layout (it depends on `savedDataHydration` and `defaultSection`, both STAYS, and on `markSectionVisited` from usePortalValidation).

**Expected test impact:** **zero**. `handleSectionClick`'s observable behavior (call markSectionDeparted on old section, call markReviewVisited or markSectionVisited on new, setActiveSection) is unchanged.

---

## §4. Circular dependency / shared state risks

### 4.1 `savedDataHydration` — adopted by THREE consumers

The orchestrator's saved-data effect (lines 245-345) writes `savedDataHydration` (with `sectionVisits` + `reviewPageVisitedAt`), and that single state is consumed by:
- `usePortalValidation` (via `initialSectionVisits` / `initialReviewPageVisitedAt`)
- VIS (via the `savedDataHydrated` boolean it uses in the loading-guard branch of `stepVisibility`)
- The mark-default-section-visited effect (lines 353-357)

After the refactor, VIS additionally needs the `addressHistoryEntries` slice from saved-data. The current code does this via a separate `setAddressHistoryEntries` call inside the same effect (line 322). Two options:

- **Option A (chosen):** widen the `savedDataHydration` payload to include `addressHistoryEntries: EntryData[]`. VIS receives `savedDataHydration?.addressHistoryEntries ?? null` as the `hydratedAddressHistoryEntries` arg and adopts it once. **One state writer, one consumer-side adoption effect.** This preserves the single-write atomicity of the current code: every saved-data hydration result is captured in one `setSavedDataHydration({...})` call.
- Option B (rejected): keep a separate `addressHistoryEntries` setter exported from VIS and have the orchestrator call it from inside its effect. Rejected because it forces a multi-write fan-out from one effect to two hooks, increasing the surface area for re-render ordering changes.

**Recommended:** Option A. The `savedDataHydration` type widens to include `addressHistoryEntries`; nothing else changes.

### 4.2 `handleSectionClick` is currently an inline closure (NOT useCallback)

The current code defines `handleSectionClick` at lines 490-500 as a regular function, not a `useCallback`. Two downstream blocks intentionally use eslint-disable to omit it from dep arrays (lines 887 and 1170 and 1179 and 1208). **The refactor must preserve this**: lifting it to `useCallback` would change the dep-array semantics of every existing useCallback that closes over it, and could break the carefully-tuned `handleReviewErrorNavigate`, `handleNextClick`, `handleBackClick`, and safety-net effect.

**Recommendation in NAV:**
- Define `handleSectionClick` as a plain `const handleSectionClick = (sectionId: string) => {...}` inside the hook body, just like today.
- Return it from the hook. React will treat this as a new identity each render (same as today), which is exactly what the eslint-disabled comment in the safety-net effect documents (current line 1208).
- `handleNextClick` / `handleBackClick` inside NAV continue to use `eslint-disable-next-line react-hooks/exhaustive-deps` with the same dep list as today.

This is the single subtle rule that, if violated, will cascade into render-order behavior changes the tests may not catch.

### 4.3 The `personalInfoSavedValues` + `handleSectionProgressUpdate` + `sectionStatuses` interlock — the address-history-red bug hot spot

This is the spec's stated reason for the refactor. The current sequence (lines 152, 514-522, 689-725, 765-775):

1. PortalLayout owns `personalInfoSavedValues` (state). It's hydrated from saved-data (line 321) AND updated by PersonalInfoSection's `onSavedValuesChange` (line 1326).
2. PortalLayout owns `sectionStatuses` (state). MERGE will own this after extraction.
3. The TD-059 effect (lines 689-725) depends on `[sections, personalInfoFields, personalInfoSavedValues, subjectCrossSectionRequirements, handleSectionProgressUpdate]`. It calls `handleSectionProgressUpdate(personalInfoSection.id, status)` — which writes to `sectionStatuses` via the functional updater that short-circuits identical statuses (line 517: `if (prev[sectionId] === status) return prev`).
4. The record_search override inside `sectionsWithStatus` (lines 765-775) reads `sectionVisits` + `reviewPageVisitedAt` and may flip Record Search from `not_started` → `incomplete`.
5. The MERGE result drives `visibleSectionsWithStatus`, which the sidebar consumes.

**Risk after extraction:** if MERGE's effect runs from inside `useSectionStatusMerge` and the deps change order (e.g., `[sections, personalInfoFields, personalInfoSavedValues, subjectCrossSectionRequirements, handleSectionProgressUpdate]` vs the existing closure), React may schedule the effect on a different render tick and the address-history red indicator could flicker differently. **Mitigations the implementer MUST follow:**

1. Move the effect with its dep array INTACT and in the same order. Do NOT reorder deps.
2. Inside the effect, do NOT change the order of the operations: build `valuesByFieldKey`, compute status via `computePersonalInfoStatus`, call `handleSectionProgressUpdate`.
3. `handleSectionProgressUpdate` inside MERGE must keep the identical short-circuit `if (prev[sectionId] === status) return prev` (line 517).
4. The record_search override (lines 765-775) must keep the exact same condition order: `section.id === DYNAMIC_STEP_IDS.RECORD_SEARCH && merged === 'not_started'`, then visit lookup, then `if (departed || reviewPageVisitedAt !== null)`.
5. The dep array of `sectionsWithStatus` (line 779) must keep `[sections, sectionStatuses, validationResult, sectionVisits, reviewPageVisitedAt]` in that exact order.

**The bug is suspected to live in the interaction between the merge result and `sectionVisits`.** Confirming that without first untangling the file is the whole point of this refactor. The plan does NOT attempt a fix; it just preserves every observable.

### 4.4 Callbacks crossing hook boundaries — explicit dep arrays

| Callback | Defined in | Closes over | Notes |
|---|---|---|---|
| `handleAddressHistorySaveSuccess` | VIS | `refreshValidation` (arg), `refreshAddressHistoryEntries` (VIS-local) | Pure VIS closure. Deps: `[refreshValidation, refreshAddressHistoryEntries]`. |
| `handleSectionProgressUpdate` | MERGE | nothing | Empty deps, same as today (line 522). |
| TD-059 effect | MERGE | sections, personalInfoFields, personalInfoSavedValues, subjectCrossSectionRequirements, handleSectionProgressUpdate | Deps stay `[sections, personalInfoFields, personalInfoSavedValues, subjectCrossSectionRequirements, handleSectionProgressUpdate]`. |
| `handleSectionClick` | NAV | activeSection, markSection*, setActiveSection | Inline closure (no deps). Same as today. |
| `handleNextClick` / `handleBackClick` | NAV | activeSectionIndex, navigableSections, scrollNewSectionIntoView | Deps `[activeSectionIndex, navigableSections, scrollNewSectionIntoView]` + eslint-disable for handleSectionClick (same as today, line 1170 / 1179). |
| Safety-net effect | NAV | visibleSectionsWithStatus, activeSection, sectionsWithStatus | Deps `[visibleSectionsWithStatus, activeSection, sectionsWithStatus]` + eslint-disable for handleSectionClick (same as today, line 1208). |
| `handleReviewErrorNavigate` | STAYS | handleSectionClick (from NAV return), markSection*, activeSection | Same deps + eslint-disable, same as today (line 887). |

No new dep-array shapes. Every eslint-disable in the current code is preserved.

### 4.5 No new contexts, reducers, or state machines

Per the hard constraints, the three hooks are pure `useState`/`useMemo`/`useEffect`/`useCallback` compositions of helpers already in `src/lib/candidate/`. The `crossSectionRegistry` is the one piece of shared state that two hooks (VIS, MERGE) and the JSX dispatch all need; we keep it at the orchestrator level rather than introducing a context.

---

## §5. Test impact survey

### 5.1 Files that import from `portal-layout.tsx`

```
src/app/candidate/[token]/portal/page.tsx                 — production import, NO CHANGE
src/components/candidate/portal-layout.test.tsx           — test file, NO LOGIC CHANGE
src/app/candidate/[token]/portal/__tests__/page.test.tsx  — uses vi.mock on portal-layout, NO CHANGE
```

`page.test.tsx` mocks the entire portal-layout component (`vi.mock('@/components/candidate/portal-layout', ...)`) — it returns a stub. The export shape stays the same (default export, same prop interface). NO CHANGE.

### 5.2 `vi.mock` calls in `portal-layout.test.tsx` (the big one)

| Mock target | Path | Impact |
|---|---|---|
| `@/contexts/TranslationContext` | external | NO CHANGE |
| `@/hooks/useDebounce` | external | NO CHANGE |
| `./form-engine/AddressHistorySection` | child section | NO CHANGE (sibling component) |
| `./form-engine/RecordSearchSection` | child section | NO CHANGE |
| `./form-engine/EducationSection` | child section | NO CHANGE |
| `./form-engine/EmploymentSection` | child section | NO CHANGE |
| `./form-engine/IdvSection` | child section | NO CHANGE |
| `global.fetch` | global | NO CHANGE |

**No mock targets a hook in `src/lib/candidate/`.** Adding three new files in that directory leaves all mocks intact. ✅

### 5.3 Other test files that mention portal-layout or PortalLayout

- `src/components/candidate/review-submit/ReviewSubmitPage.test.tsx` (line 753) — comment reference only; no import. **NO CHANGE.**
- `src/components/candidate/StepNavigationButtons.test.tsx` (line 22) — comment reference. **NO CHANGE.**

### 5.4 Tests that exist for the helpers the hooks will compose

These all stay intact (the hooks don't change the helpers, only call them):
- `src/lib/candidate/__tests__/stepVisibility.test.ts`
- `src/lib/candidate/validation/__tests__/mergeSectionStatus.test.ts`
- `src/lib/candidate/__tests__/addressHistoryStage4Wiring.test.ts`
- `src/lib/candidate/__tests__/crossSectionRegistry.test.ts`
- `src/lib/candidate/__tests__/usePortalValidation.test.ts`
- `src/lib/candidate/__tests__/useRepeatableSectionStage4Wiring.test.ts`
- `src/lib/candidate/__tests__/sectionProgress.test.ts`
- etc.

### 5.5 Classification summary

| Bucket | Count |
|---|---|
| NO CHANGE | every test file (verified) |
| Mock path update only | 0 |
| Test logic update | 0 |

**Risk flag:** none. The refactor is mechanical enough that the existing test suite is genuinely the safety net the spec promises.

### 5.6 New tests this plan does NOT call for

This is a pure refactor with no behavior changes; per Coding Standards §1.5 ("Minimal footprint") and the spec ("Same test coverage"), the plan does NOT require new unit tests for the three new hooks. The 4,916 existing tests, executed through the real PortalLayout, cover their behavior. The test-writer agent should write **zero** new tests in Pass 1 or Pass 2.

> If the implementer's smoke test reveals a regression that existing tests miss, that is a separate finding — the answer is to add a regression test, not to write speculative coverage now.

---

## §6. Coding standards compliance checklist

Per `docs/CODING_STANDARDS.md`:

- [x] **§1.1** Every new file starts with a path comment (`// /GlobalRX_v2/src/lib/candidate/useDynamicStepVisibility.ts` etc.).
- [x] **§1.5 Minimal footprint** — exactly three new files created; one existing file (`portal-layout.tsx`) modified; no other files touched.
- [x] **§2.1 Naming** — utility/hook files are camelCase (`useDynamicStepVisibility.ts`).
- [x] **§2.3 Import order** — every new file groups imports React → third-party → internal → types.
- [x] **§2.4 Import what you use** — every type and helper used is imported explicitly. No bare named imports of Node built-ins (no Node built-ins used anyway).
- [x] **§3.1 No `any`** — every input/output interface is fully typed; the hooks operate on existing typed shapes (`PersonalInfoField`, `EntryData`, `CrossSectionRequirementEntry`, `FullValidationResult`, `SectionStatus`, `StepVisibilityResult`, `SectionVisitsMap`, `AggregatedRequirementItem`).
- [x] **§3.3 Types in `/src/types/`** — every type the hooks need already lives in `@/types/...`. No new shared types are introduced; hook-input/output interfaces stay co-located with the hook (single consumer).
- [x] **§5.1 Logging** — `logger.warn` / `logger.error` calls (current lines 333, 385, 434, 452, 947, 989, 1083, 1132, 1142) move with their effects/callbacks. No `console.*`.
- [x] **§5.2 No PII in logs** — current logs never include PII; the refactor preserves them verbatim.
- [x] **§5.4 Structured logging** — preserved.
- [x] **§8.2 Comments explain "why"** — the existing comments at lines 96-110 (sectionStatuses initialization rationale), 168-175 (sentinel set rationale), 240-244 (hydration flow), 599 (savedDataHydrated derivation), 631-657 (loading guard rationale), 793-802 (effectiveValidationResult patching rationale) **move intact** with their owning state/memo/effect. The implementer must NOT rephrase these comments — they document exactly the behavior the surviving address-history bug investigation will need to read.
- [x] **§8.4 Merge logic documented** — `stepVisibility` (OR for Personal Info, single-input for Record Search) and `mergeSectionStatus` (most-restrictive wins, see lib helper) already have their docs; the refactor does not change them.
- [x] **§9.1 File size** — target line counts:
  - `portal-layout.tsx`: from 1,534 → **target ≤ 500** lines (under the 500-line warning).
  - `useDynamicStepVisibility.ts`: ~280 lines (well under 300).
  - `useSectionStatusMerge.ts`: ~220 lines.
  - `useStepNavigation.ts`: ~140 lines.

---

## §7. Definition of done

The implementer must verify every box before declaring complete:

- [ ] `src/components/candidate/portal-layout.tsx` line count ≤ 500 (target), ≤ 600 (hard ceiling per the soft trigger — see Coding Standards §9.1). Confirmed by `wc -l`.
- [ ] `src/lib/candidate/useDynamicStepVisibility.ts` exists, < 400 lines.
- [ ] `src/lib/candidate/useSectionStatusMerge.ts` exists, < 400 lines.
- [ ] `src/lib/candidate/useStepNavigation.ts` exists, < 400 lines.
- [ ] **All 4,916+ existing tests pass.** Implementer pastes raw `pnpm vitest run` output (per Testing Standards §9.1). Zero new failures, zero net regressions.
- [ ] **No new TypeScript errors beyond the pre-existing 3,221 baseline.** `pnpm typecheck` output compared.
- [ ] `pnpm build` succeeds.
- [ ] `pnpm lint` produces no new warnings.
- [ ] **Manual browser re-test of the address-history red indicator scenario** (the surviving 5-fix bug): log in as a candidate with Address History; observe whether the sidebar indicator behaves identically to the pre-refactor baseline on (a) initial load, (b) after entering an address that triggers a subject requirement, (c) after departing the section, (d) after a logout/login. The pass criterion for THIS refactor is "identical to baseline — no better, no worse." If the bug visibly worsens, the refactor must be reverted and re-examined.
- [ ] **Automated regression check** for the same bug: confirm every test in `portal-layout.test.tsx` under `describe('TD-059 — lifted Personal Info status derivation')` and `describe('dynamic step skipping (Task 8.5)')` passes unchanged.
- [ ] No `vi.mock` calls in any test file added, removed, or had their path changed. Confirmed by `git diff` showing only `portal-layout.tsx` and the three new hook files modified.

---

## §8. Files in scope (the implementer contract)

> Implementer Absolute Rule 6: anything not listed here cannot be touched.

**Files to CREATE (3):**
1. `src/lib/candidate/useDynamicStepVisibility.ts`
2. `src/lib/candidate/useSectionStatusMerge.ts`
3. `src/lib/candidate/useStepNavigation.ts`

**Files to MODIFY (1):**
1. `src/components/candidate/portal-layout.tsx` — read in full before editing (Coding Standards §1.2). Lines 90-1534 (the `PortalLayout` component body) are restructured per §3. Lines 1-88 (imports + interface) are adjusted to add the three new hook imports and drop the helpers/types no longer referenced directly in this file. The file-path comment at line 1 is preserved.

**Files NOT touched (for clarity):**
- Any test file (no path changes; no logic changes).
- Any sibling component in `src/components/candidate/`.
- Any helper in `src/lib/candidate/`.
- Any type file in `src/types/`.
- `prisma/schema.prisma` — no database changes.

---

## §9. Risks and considerations

1. **The address-history red bug is not in scope.** The refactor will not fix it. If, after the refactor, the bug is reproducible on the smaller MERGE hook, the next agent investigates from there with 200 readable lines instead of 1,500.
2. **`handleSectionClick` semantics.** The single biggest landmine — see §4.2. The implementer must NOT convert it to `useCallback`.
3. **The orchestrator saved-data effect (lines 245-345) writes four pieces of state from one async response.** The plan widens `savedDataHydration` to include `addressHistoryEntries` so the write count stays at three (`setWorkflowAcknowledgments`, `setPersonalInfoSavedValues`, `setSectionStatuses` via bulk patch, `setSavedDataHydration`). The VIS hook then adopts the entries on a subsequent render. This is one extra render compared to today — but the data is the same and no JSX renders prematurely (the loading-guard branch of `stepVisibility` already defaults both dynamic steps to visible during this window).
   - **If the smoke test shows a sidebar flicker that didn't exist before**, the implementer should NOT try to fix it in this PR. Open a tech-debt entry and revert to inline-write Option B (§4.1).
4. **TD-059 effect dep ordering** — see §4.3. Implementer must move the effect with deps in exact order.
5. **Type imports may shift between portal-layout and the new hooks.** `EntryDsxField` is imported in portal-layout today (line 64); after the refactor it lives in VIS. The implementer must `git grep` for orphan unused imports in portal-layout post-extraction.
6. **No spec-driven changes to the architecture beyond the three hooks.** No context, no reducer, no Zustand. The plan honors that.

---

## §10. Plan completeness check

- [x] Every file the implementer will touch is listed in §8.
- [x] No file outside §8 will need to be modified.
- [x] No new TypeScript types in `/src/types/` — hook input/output interfaces are co-located in their hook file (single consumer).
- [x] No new Zod schemas (no API contract changes).
- [x] No new translation keys (no UI string changes).
- [x] The plan is consistent with the spec's "What to Extract" sections — every state/memo/effect/callback the spec lists is assigned to a destination in §1.
- [x] Extraction order (VIS → MERGE → NAV) is justified by traceable line refs in §3.1.
- [x] The address-history-red bug interlock is documented in §4.3 with explicit "preserve ordering" rules for the implementer.

**This plan is ready for the test-writer to confirm Pass 1 has zero new tests (correct — it's a refactor) and for the implementer to execute the three extraction steps in order.**
