# Feature Specification: Portal Layout Extraction Refactor
**Spec file:** `docs/specs/portal-layout-extraction-refactor.md`
**Date:** May 15, 2026
**Requested by:** Andy
**Status:** Confirmed

## Summary

`portal-layout.tsx` has grown to 1,531 lines. This makes it difficult for both humans and AI tools to trace data flows, which has directly contributed to a bug (address history status indicator) surviving five fix attempts. This refactor extracts distinct responsibilities into focused modules without changing any behavior. All 4,911+ existing tests serve as a safety net to confirm nothing breaks.

This is a pure structural refactor — zero behavior changes, zero UI changes, zero new features.

## Motivation

The portal layout currently handles too many concerns in one file:

- Rendering the shell (sidebar, header, content area, Next/Back buttons)
- Section navigation (which section is active, handling clicks, Next/Back logic)
- Dynamic step visibility (computing which steps to show/skip based on cross-section registry and aggregated fields)
- Section status merging (combining local component status with server validation status)
- Validation result patching (overriding skipped steps, handling record_search special case)
- Data fetching and hydration (saved data, personal info fields, per-entry DSX fields, address history entries)
- Auto-refresh callbacks (refreshAddressHistoryEntries, handleAddressHistorySaveSuccess)

When a bug occurs in the status merge logic, you have to read 1,500 lines to find it. When Claude Code traces a data flow, it has to hold all of these interacting memos, effects, and callbacks in context simultaneously. Extracting them into focused files means each piece can be understood and debugged in isolation.

## What to Extract

### Hook 1: `useDynamicStepVisibility`

**New file:** `src/hooks/candidate/useDynamicStepVisibility.ts`

**Responsibility:** Given the current candidate data, determine which steps are visible and return a filtered section list.

**What moves into this hook:**
- The `addressHistoryEntries` state and its hydration from saved data
- The `addressHistoryFieldsByEntry` state and the per-entry DSX fields fetch effect
- The `fetchedEntryCountryPairs` sentinel state
- The `personalInfoFieldsLoaded` and `addressHistoryFieldsLoaded` loading gates
- The `recordSearchAggregatedItems` memo (calls `computeAddressHistoryAggregatedItems`)
- The `stepVisibility` memo (calls `computeDynamicStepVisibility`)
- The `visibleSections` filtering logic (calls `filterDynamicSteps`)
- The `refreshAddressHistoryEntries` callback
- The `handleAddressHistorySaveSuccess` callback

**Inputs (passed as arguments):** The full section list from the structure endpoint, saved data hydration state, personal info fields.

**Returns:** `{ visibleSections, refreshAddressHistoryEntries, handleAddressHistorySaveSuccess, stepVisibility, addressHistoryFieldsLoaded }`

### Hook 2: `useSectionStatusMerge`

**New file:** `src/hooks/candidate/useSectionStatusMerge.ts`

**Responsibility:** Merge local section statuses with server validation results, apply patches for dynamic steps, and produce the final section-with-status list.

**What moves into this hook:**
- The `sectionStatuses` state (initialized as empty object)
- The `handleSectionProgressUpdate` callback
- The `visibleSectionsWithStatus` memo (joins sections with merged statuses)
- The `effectiveValidationResult` memo (patches skipped dynamic steps)
- The `disableSubmitForDynamicGaps` memo
- The record_search post-merge status override logic
- The `sectionVisits` and visit/departure tracking that feeds the override

**Inputs:** Visible sections list, validation result, step visibility state.

**Returns:** `{ visibleSectionsWithStatus, effectiveValidationResult, disableSubmitForDynamicGaps, handleSectionProgressUpdate, sectionStatuses }`

### Hook 3: `useStepNavigation`

**New file:** `src/hooks/candidate/useStepNavigation.ts`

**Responsibility:** Manage which section is active and handle Next/Back/sidebar navigation.

**What moves into this hook:**
- The `activeSection` state
- The `handleSectionClick` callback
- The `handleNext` and `handleBack` callbacks
- The fall-back-to-nearest-visible-step safety net effect
- The `navigableSections` derivation

**Inputs:** Visible sections with status list, section visits state.

**Returns:** `{ activeSection, handleSectionClick, handleNext, handleBack, navigableSections }`

### What stays in portal-layout.tsx

After extraction, portal-layout.tsx should contain:

- The three hook calls (useDynamicStepVisibility, useSectionStatusMerge, useStepNavigation)
- The existing data fetching hooks (usePortalValidation, useSavedDataHydration, etc.) — these are already external hooks, just called here
- The `getActiveContent()` render dispatch (which section component to show based on activeSection)
- The JSX rendering (sidebar, header, content area, Next/Back buttons)
- Props threading to child components

This should bring portal-layout.tsx down to roughly 400-600 lines — well under the 600-line threshold or just at it.

## Business Rules

1. **Zero behavior changes.** Every user-visible behavior, every status indicator, every navigation action must work identically before and after. The test suite is the proof.

2. **Same file scope.** The three new hook files live under `src/hooks/candidate/`. No changes to components outside portal-layout.tsx.

3. **Same test coverage.** Existing portal-layout tests continue to pass without modification. If any test imports or mocks need updating due to the extraction, the tests are updated to point at the new locations but the assertions stay the same.

4. **No new dependencies.** The hooks use the same React primitives (useState, useMemo, useEffect, useCallback) and the same internal imports that portal-layout.tsx already uses.

5. **The existing bug fix tests (stepVisibility, validation filtering, etc.) must all continue to pass.** These are the regression safety net.

## Definition of Done

1. portal-layout.tsx is under 700 lines (target: 400-600)
2. Three new hook files exist and each is under 400 lines
3. All 4,911+ existing tests pass with zero failures
4. No behavior changes observable in the browser
5. TypeScript compiles with no new errors
6. Lint passes with no new warnings
7. The address history status bug is either fixed as a side effect of the cleaner separation, or is now much easier to isolate and fix in the focused useSectionStatusMerge hook

## Open Questions

None — this is a mechanical extraction guided by the test suite.