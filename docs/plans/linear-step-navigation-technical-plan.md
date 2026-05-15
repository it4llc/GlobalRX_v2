# Technical Plan: Linear Step Navigation

**Based on specification:** `docs/specs/linear-step-navigation.md` (May 13, 2026)
**Date:** May 13, 2026

---

## Overview (plain-English summary)

This task does two things:

1. **Reorders sections returned by the structure endpoint.** Today the order is
   `before_services workflow → personal_info → IDV → address_history → education → employment → after_services workflow → review_submit`.
   After this change the order becomes
   `before_services workflow → IDV → address_history → education → employment → personal_info → after_services workflow → review_submit`.
   Personal Information moves from second to sixth. Everything else keeps its relative position. The synthetic Review & Submit entry stays last. Sections that don't apply (no IDV, no education, etc.) continue to be omitted entirely — there is no separate "skip" logic to add at the endpoint level.

2. **Adds Next/Back buttons to the candidate portal.** A new small client component renders a Back button (outline style, left) and a Next button (filled primary style, right) at the bottom of every section's content area. The buttons reuse the existing `handleSectionClick` function in `portal-layout.tsx` to navigate. The button row is suppressed on the first applicable step (no Back) and on `review_submit` (no Next — the existing Submit button takes its place; the Back button is rendered next to Submit by the Review & Submit page itself, NOT by the shared button component). On every click, the page scrolls to the top of the content area. Two new translation keys (`candidate.navigation.next` and `candidate.navigation.back`) are added to every language file.

There are NO database changes, NO new API endpoints, NO new Prisma models, NO new Zod schemas, and NO new TypeScript types in `/src/types/`. This is purely a UI re-ordering and a new presentational component.

---

## Database Changes

**None.** Per spec Data Requirements ("No new data fields are stored. This task only changes the order sections are returned by the structure endpoint and adds navigation buttons to the UI. There is no database change.") this is a purely front-end / endpoint-ordering change.

---

## New Files to Create

### 1. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/StepNavigationButtons.tsx`

**Purpose:** Presentational component rendering the Back and Next buttons at the bottom of a section. Lives separately because `portal-layout.tsx` is already 863 lines (over the 600-line soft trigger in `CODING_STANDARDS.md` Section 9.1). All button logic, accessibility wiring, and styling are encapsulated here.

**Contents:**

- `'use client'` directive at the top.
- File-path comment header per CODING_STANDARDS Section 1.1.
- Imports: `React`, `useTranslation` from `@/contexts/TranslationContext`.
- Exports a default React component `StepNavigationButtons` taking props:
  - `onBack: (() => void) | null` — when null, Back button is not rendered. The first applicable step passes null so no Back is shown (spec rule 4).
  - `onNext: (() => void) | null` — when null, Next button is not rendered. The Review & Submit page passes null because Submit takes the place of Next (spec rule 4). Also null when only one step exists (spec edge case 4).
  - `nextDisabled?: boolean` — optional; lets future callers disable Next without removing it (not used by this task, but present so we don't have to widen the contract later).
- Renders nothing when both `onBack` and `onNext` are null (spec edge case 4 — "Only one step exists").
- Renders a container `<div>` with Tailwind utility classes:
  - `mt-8 pt-6 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-between gap-3`
  - `flex-col-reverse` on mobile means Back ends up below Next visually when stacked, matching the prominent-forward-action pattern.
- Back button: `type="button"`, outline/secondary style. Classes mirror the muted button style already used in ReviewSubmitPage's disabled state but enabled. Class string: `inline-flex min-h-[44px] items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer w-full sm:w-auto`.
- Next button: `type="button"`, primary/filled style. Matches the existing Submit button palette in `ReviewSubmitPage.tsx` line 211–212 for visual consistency. Class string: `inline-flex min-h-[44px] items-center justify-center rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 cursor-pointer w-full sm:w-auto`.
- Both buttons include `min-h-[44px]` per spec rule 12 (mobile tap targets) and use `w-full sm:w-auto` so they are full-width below the `sm` breakpoint (640px, covers spec edge case 7).
- Labels: `t('candidate.navigation.back')` and `t('candidate.navigation.next')`.
- `data-testid="step-nav-back"` and `data-testid="step-nav-next"` for tests.
- Container `data-testid="step-navigation"`.
- No inline styles (per CODING_STANDARDS Section 1.1 and CLAUDE.md "No Inline Styling").

This component does NOT call any API, does NOT have local state, and does NOT depend on the structure endpoint shape. It only consumes the two callbacks passed in.

### 2. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/StepNavigationButtons.test.tsx`

**Purpose:** Unit tests for the new presentational component (test-writer creates the actual cases — this plan only enumerates which test cases must exist; see "Test surface" section below).

**Contents:** Vitest + @testing-library/react test file with the test cases listed in the test surface section below. Mocks `@/contexts/TranslationContext` like `portal-layout.test.tsx` does (returns the key as the value).

---

## Existing Files to Modify

### 1. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/route.ts`

**Was this file read before listing it here?** Yes — full file read.

**What currently exists:**
- Lines 234–266 push `before_services` workflow sections.
- Lines 268–282 push the `personal_info` section.
- Lines 285–362 push service sections in the fixed `serviceTypeOrder = ['verification-idv', 'record', 'verification-edu', 'verification-emp']`.
- Lines 364–394 push `after_services` workflow sections.
- Lines 400–408 push the synthetic `review_submit` section.

**What needs to change and why:**

The Personal Information block (currently lines 268–282) must move from its current position (between `before_services` and the service sections) to AFTER the service section loop but BEFORE the `after_services` workflow loop. Spec Business Rule 1 places Personal Info at Step 6, after IDV / address_history / education / employment.

Specifically:
- Delete the existing Personal Info push at lines 268–282.
- Add an identical Personal Info push immediately after the service section loop ends (between line 362 and line 364), keeping `sectionOrder++` so the `order` field stays a contiguous 0-based index.
- The `id`, `title`, `type`, `placement`, `status`, and `functionalityType` fields stay exactly as they are today — only the position in the array changes.

The `serviceTypeOrder` array on line 298 is NOT changed — the spec rule 1 order for steps 2–5 is `IDV → address_history → education → employment`, which already matches the existing `['verification-idv', 'record', 'verification-edu', 'verification-emp']`.

The `before_services` and `after_services` loops are NOT changed. The `review_submit` push is NOT changed. The phone-combining logic and the scope-resolution logic are NOT changed.

**Risk of side effects:**
- `personal_info` keeps its existing `placement: 'services'` value. The structure endpoint's contract treats `placement` as a display grouping, not a sort key — the actual ordering is driven by the order items are pushed to the `sections` array and the `order` field. Downstream consumers (the portal layout, the sidebar) use array order / the `order` field, not `placement`. Confirmed by reading `portal-layout.tsx` lines 462–489 (sectionsWithStatus map preserves array order) and `portal-sidebar.tsx` lines 40–80 (iterates the passed-in array in order, no re-sorting).
- The save route (`save/route.ts`) uses `personal_info` as a `sectionType` enum value (per DATABASE_STANDARDS Section 2.4) — that's the key in `formData.sections`, not a sort field. Unaffected.
- Per spec Impact-on-Other-Modules: Task 8.3 will eventually remove static name/email/phone from Personal Info, Task 8.4 will split Record Search Requirements out of Address History. Those tasks will modify the structure endpoint again. This task does NOT pre-emptively add a Record Search Requirements section — spec rule 1 step 7 says "the aggregated fields area stays inside Address History for now". No change to address_history.

### 2. `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts`

**Was this file read before listing it here?** Yes — full file read (878 lines).

**What currently exists:**
- Line 222 asserts total length is 8 sections (1 personal + 1 before + 3 services + 2 after + 1 review_submit).
- Lines 249–257 assert `data.sections[1]` is `personal_info` with `order: 1`.
- Lines 260–269 assert `data.sections[2]` is IDV with `order: 2`.
- Lines 282–297 assert `data.sections[3]` is `address_history` with `order: 3`.
- Lines 302–317 assert `data.sections[4]` is education with `order: 4`.
- Lines 323–339 assert `data.sections[5]` is the first `after_services` workflow with `order: 5`.
- Lines 341–357 assert `data.sections[6]` is the second `after_services` workflow with `order: 6`.
- Lines 361–369 assert `data.sections[7]` is `review_submit` with `order: 7`.
- Lines 461–465 (no-workflow case): `data.sections[0].type === 'personal_info'` followed by service sections.
- Lines 494–501 (no-services case): asserts order `before_services / personal_info / after_services / after_services / review_submit`.
- Lines 563–568 (no-workflow ordering case): asserts `[0]=personal_info, [1]=IDV, [2]=record, [3]=edu, [4]=emp`.
- Lines 770–795 (empty-package case): asserts length 2 with personal_info at index 0 and review_submit at index 1.
- Lines 870–875 (null functionality type case): asserts `sections[0]=personal_info, sections[1]=verification-idv, sections[2]=review_submit`.

**What needs to change and why:**

Every assertion that pins `personal_info` to an array index, an `order` value, or to a position relative to service sections needs to be updated to reflect Personal Info moving from Step 2 to Step 6 (after employment, before after_services).

Specifically (these are EXISTING test cases that need their expected ordering rewritten; no new test cases are added in this file — new behavior tests go in the new test file and in `portal-layout.test.tsx`):

| Test case (line ref) | Old assertion | New assertion |
|---|---|---|
| Main success case `data.sections` index assertions (~lines 230–369) | Length 8; personal_info at [1] with order 1; IDV at [2] order 2; address_history at [3] order 3; education at [4] order 4; after_services at [5]/[6] order 5/6; review_submit at [7] order 7 | Length 8; personal_info at [4] with order 4; IDV at [1] order 1; address_history at [2] order 2; education at [3] order 3; after_services at [5]/[6] order 5/6; review_submit at [7] order 7 |
| `should handle package with no workflow sections` (~line 461) | `data.sections[0].type === 'personal_info'` | `data.sections[0].type === 'service_section'` (IDV first); personal_info is now LAST before review_submit |
| `should handle package with no services` (~lines 494–501) | `[0]=workflow_section before, [1]=personal_info, [2]/[3]=workflow_section after, [4]=review_submit` | `[0]=workflow_section before, [1]=personal_info, [2]/[3]=workflow_section after, [4]=review_submit` — UNCHANGED because with no services there's nothing between before_services and personal_info anyway |
| `should maintain correct order for service sections` (~lines 563–568) | `[0]=personal_info, [1]=IDV, [2]=record, [3]=edu, [4]=emp` | `[0]=IDV, [1]=record, [2]=edu, [3]=emp, [4]=personal_info` |
| `should handle empty sections array gracefully` (~lines 770–795) | length 2; `[0]=personal_info order 0`; `[1]=review_submit order 1` | Unchanged — same two sections, same order |
| `should handle services with null functionality type` (~lines 870–875) | `[0]=personal_info, [1]=verification-idv, [2]=review_submit` | `[0]=verification-idv, [1]=personal_info, [2]=review_submit` |

The test-writer will replace each of these assertions with the new expected ordering. The test cases themselves are not removed — only the expected order strings change.

### 3. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx`

**Was this file read before listing it here?** Yes — full file read (863 lines).

**What currently exists:**
- Lines 311–321 define `handleSectionClick(sectionId)` which marks the previous section departed, marks the new section visited (or marks Review visited), and calls `setActiveSection(sectionId)`.
- Lines 626–826 are `getActiveContent()`, which dispatches on `section.type` to render the appropriate section component (`PersonalInfoSection`, `IdvSection`, `AddressHistorySection`, `EducationSection`, `EmploymentSection`, `WorkflowSectionRenderer`, `ReviewSubmitPage`). Every branch wraps the section component in `<div className="p-6" data-testid="main-content">`.

**What needs to change and why:**

To wire Next/Back buttons we need:

1. **An imports addition (top of file):** import the new `StepNavigationButtons` component from `@/components/candidate/StepNavigationButtons`.

2. **A new helper inside the component, just above `getActiveContent`:** a `useMemo`-derived array `navigableSections` and a `useMemo`-derived index lookup `activeSectionIndex`. These compute the linear order of sections eligible for Next/Back navigation from the `sectionsWithStatus` array. All section types currently emitted by the structure endpoint are eligible (including `review_submit`), because spec rule 8 says sidebar and Next/Back work together — there is no exclusion list. The order is simply `sectionsWithStatus` as-is.

3. **Two new `useCallback` handlers, just above `getActiveContent`:**
   - `handleNextClick`: looks up `navigableSections[activeSectionIndex + 1]`. If found, calls the existing `handleSectionClick(nextSection.id)` and then calls `window.scrollTo({ top: 0, behavior: 'smooth' })` for spec rule 11. If not found (last section), does nothing — but in practice this should never fire because Next is suppressed on the last section.
   - `handleBackClick`: same as above but `activeSectionIndex - 1`. Same scroll-to-top behavior.

4. **Two derived values, just above `getActiveContent`:**
   - `showNext`: `true` when there's a section after the active one AND the active section's `type !== 'review_submit'`. Spec rule 4 — Review & Submit suppresses Next.
   - `showBack`: `true` when there's a section before the active one AND the active section's `type !== 'review_submit'`. Spec rule 5 — the Back button on Review & Submit is rendered by `ReviewSubmitPage` itself (see modification 4 below), NOT by the shared `StepNavigationButtons` component, so we suppress it here to avoid rendering two Back buttons.

5. **Rendering change inside `getActiveContent`:**
   - At the end of every branch in `getActiveContent` EXCEPT the `review_submit` branch, append a `<StepNavigationButtons />` instance inside the existing wrapping `<div className="p-6" data-testid="main-content">`. It receives:
     - `onBack={showBack ? handleBackClick : null}`
     - `onNext={showNext ? handleNextClick : null}`
   - The `review_submit` branch (lines 657–673) is NOT modified here. The Back button on Review & Submit lives inside `ReviewSubmitPage` next to Submit — see modification 4.
   - The empty-active-section path (lines 627–634, `<PortalWelcome />` fallback when `activeSection` is null) is NOT modified — that's the loading-state fallback, no nav needed.
   - The section-not-found fallback (lines 636–644, `<PortalWelcome />` when `sections.find` returns undefined) is also NOT modified — also a fallback.

6. **No state changes are added.** All navigation state is derived from the existing `activeSection` state. The `handleSectionClick` function is reused exactly as-is per spec rule 7.

**File size note:** portal-layout.tsx is currently 863 lines. CODING_STANDARDS Section 9.1 says "no automated agent may add code to a source file over 600 lines without explicitly stopping to ask first". The plan justifies the addition here because: (a) the new code is small (3 callbacks, 2 memos, one rendered element per dispatch branch — roughly 30–40 lines), (b) the actual button rendering and styling lives in the new `StepNavigationButtons.tsx` file rather than inline, and (c) extracting all of `getActiveContent` to a new file would be a larger and riskier refactor that the spec does not request. **Andy: this is the conscious-decision moment required by Section 9.4 — please confirm in review.** If preferred, the test-writer/implementer can split `portal-layout.tsx` into a dispatch file in a follow-up, but the spec does not require it.

### 4. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/review-submit/ReviewSubmitPage.tsx`

**Was this file read before listing it here?** Yes — full file read.

**What currently exists:**
- Lines 165–222 render a `<footer>` containing the `submitError` banner, the Submit button, and the help-text paragraph.

**What needs to change and why:**

Spec rule 5: "On the Review & Submit step, the Back button appears alongside the Submit button in the same row."

1. Add a new optional prop to `ReviewSubmitPageProps`: `onBack?: () => void`. When omitted (legacy tests), no Back button is rendered, preserving backwards compatibility (matching the `onSubmit` pattern already used in this file).

2. Inside the `<footer>`, just before the Submit button, render a `<button type="button">` with the same outline/secondary styling used by the new `StepNavigationButtons.tsx` (so the visual treatment is consistent). The button calls `onBack` when clicked, uses the `candidate.navigation.back` translation key, has `data-testid="review-back-button"`, and `min-h-[44px]` for mobile.

3. Wrap the Back + Submit pair in a `<div className="flex flex-col-reverse sm:flex-row sm:justify-center gap-3 w-full">` (or similar — the test-writer will confirm exact classes through tests) so on mobile they stack with Submit on top and Back below, and on `sm` and wider they sit side-by-side with the Back to the LEFT of Submit. Spec rule 3 wants Back styled as secondary and Submit/Next styled as primary.

4. The `submitError` banner and the help-text paragraph stay where they are. Only the button row changes.

### 5. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx` — Review & Submit dispatch wiring

This is part of modification 3 above but called out separately because it touches the Review & Submit branch specifically.

In the `review_submit` dispatch (lines 657–673), add `onBack={handleBackClick}` to the `<ReviewSubmitPage />` props (alongside the existing `onSubmit`, `submitting`, `submitError`, etc.). `handleBackClick` is the same handler from modification 3 — it navigates to the previous section in `navigableSections`. We always pass it (not gated on `showBack`) because Review & Submit always has at least one prior section.

### 6. `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.test.tsx`

**Was this file read before listing it here?** Yes — read first 100 lines plus describe/it list.

**What currently exists:**
- Tests for header, sidebar, section navigation via sidebar click, mobile menu, status indicators, edge cases, and TD-059 fixture cases.

**What needs to change and why:**

Add new test cases inside the existing `describe('PortalLayout', () => { ... })` block to verify Next/Back behavior. No existing tests are removed. New `describe('step navigation buttons', () => { ... })` block covers:

- Next button renders when active section is not the last section and not `review_submit`.
- Back button renders when active section is not the first section and not `review_submit`.
- First section has no Back button.
- Last applicable non-review section has its Next button still visible (because review_submit follows it).
- Clicking Next advances to the next section in the sidebar's array order.
- Clicking Back retreats to the previous section in the sidebar's array order.
- Clicking Next then sidebar-clicking a section then clicking Next again correctly navigates relative to the new active section (spec edge case 5).
- Skipping over inapplicable sections is implicitly tested by the structure endpoint test — when a section is absent from the structure response, it is absent from `sectionsWithStatus` and therefore not in `navigableSections`. The portal-layout test can confirm this by passing a `sections` prop with IDV omitted and asserting Next from a before_services workflow goes straight to address_history.
- Review & Submit branch: `StepNavigationButtons` is NOT rendered (no separate Next/Back), but the `ReviewSubmitPage`'s own Back button (data-testid="review-back-button") IS rendered and clicking it navigates back to the previous section.
- Pressing Next calls `window.scrollTo` with `{ top: 0, behavior: 'smooth' }` (spec rule 11). Test mocks `window.scrollTo`.

### 7. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-US.json`

**Was this file read before listing it here?** Confirmed via grep that the file contains `candidate.portal.*` keys and a `candidate.navigation.*` namespace does not yet exist.

**What needs to change:** Add two new keys at the end of the `candidate.*` block:

```
"candidate.navigation.next": "Next",
"candidate.navigation.back": "Back",
```

### 8. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/en-GB.json`

**Was this file read before listing it here?** Confirmed via `ls` that the file exists; per COMPONENT_STANDARDS Section 6.3, new keys must be added to every language file.

**What needs to change:** Add the same two keys with the same English text (en-GB shares spellings for these short words).

### 9. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/es-ES.json`

**Was this file read before listing it here?** Confirmed via `ls`.

**What needs to change:** Add the two keys:

```
"candidate.navigation.next": "Siguiente",
"candidate.navigation.back": "Atrás",
```

### 10. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/es.json`

**Was this file read before listing it here?** Confirmed via `ls`.

**What needs to change:** Add the same Spanish translations as `es-ES.json`.

### 11. `/Users/andyhellman/Projects/GlobalRx_v2/src/translations/ja-JP.json`

**Was this file read before listing it here?** Confirmed via `ls` and grep showing existing `candidate.portal.*` keys.

**What needs to change:** Add the two keys. Per COMPONENT_STANDARDS Section 6.3 ("Use the English text as the placeholder for languages you don't speak, flagged for later translation"):

```
"candidate.navigation.next": "次へ",
"candidate.navigation.back": "戻る",
```

These are standard Japanese for Next and Back; if the implementer is uncertain, use English placeholders and the existing translation review process will refine.

---

## API Routes

**One existing route is modified; no new routes are created.**

### `GET /api/candidate/application/[token]/structure` (modified)

- **Path:** `/api/candidate/application/[token]/structure`
- **HTTP method:** GET
- **Authentication:** Existing — valid `candidate_session` cookie whose token matches the URL token. UNCHANGED.
- **Input data:** Path param `token` (string). UNCHANGED.
- **What it returns on success:** Same response shape as today (per the JSDoc at lines 23–84 of the route file). Only difference: the `sections` array now has Personal Information in position 6 (after the service sections) rather than position 2 (before them). The `order` field on each section continues to be a contiguous 0-based index matching its array position.
- **Errors handled:** 401 (no session), 400 (bad token), 403 (token/session mismatch), 404 (invitation not found), 500 (no package / unexpected error). UNCHANGED.
- **JSDoc update:** Update the comment block at lines 36–82 of the route file to describe the new order in plain English ("Sections are ordered: before_services workflow → service sections (IDV, address_history, education, employment) → personal_info → after_services workflow → review_submit"). The existing field-by-field documentation otherwise stays accurate.

---

## Zod Validation Schemas

**None.** No new request bodies, no new validation. The structure endpoint is read-only and validates only `token` (unchanged). The save endpoint's `sectionType` enum (per DATABASE_STANDARDS Section 2.4) is unchanged because no new section types are introduced.

---

## TypeScript Types

**No new types in `/src/types/`.** The existing types in `/src/types/candidate-portal.ts` already cover everything this feature needs:

- `CandidatePortalSection` covers section ordering — `order` is already on the type and is just renumbered.
- `CandidateInvitationInfo` is unchanged.
- `CandidatePortalStructureResponse` is unchanged.

The new `StepNavigationButtons` component defines its own props interface inline (private to the component file), per CODING_STANDARDS Section 3.3 — types only get lifted to `/src/types/` when they are used in more than one place. These props are not.

---

## UI Components

### `StepNavigationButtons` (new) — `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/StepNavigationButtons.tsx`

- **Type:** Client component (`'use client'`) — uses `useTranslation` hook.
- **Renders:** A flex row at the bottom of a section containing an outline-styled Back button on the left (when `onBack` is provided) and a filled primary Next button on the right (when `onNext` is provided). Mobile-first: stacks `flex-col-reverse` below the `sm` breakpoint so Next stays on top.
- **Existing UI components used:** None — uses plain `<button>` elements with established Tailwind class patterns from `ReviewSubmitPage.tsx` (the primary button palette) and a new outline pattern. Does NOT use `ModalDialog`, `FormTable`, `FormRow`, or `ActionDropdown` (none apply — this is not a dialog, form, table, or row action).
- **API routes called:** None.

### `PortalLayout` (modified) — `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx`

- **Type:** Client component (unchanged — already `'use client'`).
- **Renders:** Unchanged except every non-`review_submit` content branch in `getActiveContent` now also renders a `<StepNavigationButtons />` instance at the bottom of the content `<div>`.
- **Existing UI components used:** `PortalHeader`, `PortalSidebar`, `PortalWelcome`, `SectionPlaceholder`, `PersonalInfoSection`, `IdvSection`, `EducationSection`, `EmploymentSection`, `AddressHistorySection`, `WorkflowSectionRenderer`, `ReviewSubmitPage`, `SectionErrorBanner` (all unchanged). Adds `StepNavigationButtons`.
- **API routes called:** Unchanged.

### `ReviewSubmitPage` (modified) — `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/review-submit/ReviewSubmitPage.tsx`

- **Type:** Client component (unchanged).
- **Renders:** Unchanged except the footer's button row now contains a Back button (when `onBack` prop is provided) next to the existing Submit button.
- **Existing UI components used:** `ReviewSectionBlock` (unchanged). No new component dependencies — Back uses the same plain-button-with-Tailwind pattern as Submit.
- **API routes called:** None (parent handles the submit fetch).

---

## Translation Keys

Per spec Data Requirements:

| Key | English text |
|---|---|
| `candidate.navigation.next` | `Next` |
| `candidate.navigation.back` | `Back` |

These keys must be added to **every** language file per COMPONENT_STANDARDS Section 6.3:

- `src/translations/en-US.json` — English (US): `"Next"`, `"Back"`
- `src/translations/en-GB.json` — English (GB): `"Next"`, `"Back"`
- `src/translations/es-ES.json` — Spanish (Spain): `"Siguiente"`, `"Atrás"`
- `src/translations/es.json` — Spanish (generic): `"Siguiente"`, `"Atrás"`
- `src/translations/ja-JP.json` — Japanese: `"次へ"`, `"戻る"`

If a translation file other than these five exists at implementation time, the implementer must also add the keys to that file (COMPONENT_STANDARDS Section 6.3 explicitly warns: "An agent that hardcodes this list will miss newly added languages.").

---

## Test surface (for the test-writer)

This section enumerates the test cases that must exist after this task is implemented. The test-writer will produce the actual Vitest code.

### Structure endpoint tests — `route.test.ts` (modified)

All existing tests stay. The expected ordering inside each existing assertion changes per the "What needs to change and why" table in modification 2. No new test cases are added in this file (the new ordering is verified by updating the existing assertions, which is sufficient coverage).

### Step navigation button component tests — `StepNavigationButtons.test.tsx` (new)

1. Renders both Back and Next when both callbacks are provided.
2. Renders only Next when `onBack` is null.
3. Renders only Back when `onNext` is null.
4. Renders nothing when both are null.
5. Clicking Back calls `onBack`.
6. Clicking Next calls `onNext`.
7. Both buttons have `min-h-[44px]` class (mobile tap target — spec rule 12).
8. Both buttons have `w-full sm:w-auto` for full-width-on-mobile behavior (spec edge case 7).
9. Back button uses outline class names (border, white background); Next button uses filled class names (blue background, white text) — verify by checking class lists.
10. Labels come from the `candidate.navigation.back` and `candidate.navigation.next` translation keys.

### Portal layout integration tests — `portal-layout.test.tsx` (modified)

New `describe('step navigation buttons', () => { ... })` block:

11. First section's content does not include a Back button.
12. First section's content includes a Next button.
13. Last non-review section's content includes both Back and Next.
14. `review_submit` content does NOT render the shared `StepNavigationButtons` component (no `data-testid="step-navigation"`).
15. `review_submit` content DOES render the Review page's own Back button (`data-testid="review-back-button"`).
16. Clicking Next from section index N changes `activeSection` to the section at index N+1.
17. Clicking Back from section index N changes `activeSection` to the section at index N-1.
18. When sidebar is used to jump to a section, subsequent Next/Back is relative to the new position (spec edge case 5).
19. Clicking Next on a section calls `window.scrollTo({ top: 0, behavior: 'smooth' })` (spec rule 11). Test mocks `window.scrollTo`.
20. When the sections prop omits an inapplicable section (e.g., no IDV), Next from before_services workflow lands on address_history, not IDV (spec rule 6).
21. When `sections` array contains exactly one section, neither Back nor Next appears (spec edge case 4).

### Review & Submit page tests — existing test file

If a test file for `ReviewSubmitPage.tsx` exists today, add cases to it (do not create a new one). Otherwise:

22. When `onBack` is omitted, no Back button is rendered (backwards compatibility for existing test fixtures).
23. When `onBack` is provided, a Back button is rendered next to Submit.
24. Clicking the Back button calls `onBack`.
25. The Back button uses `candidate.navigation.back` translation key.
26. The Back button has `min-h-[44px]` for mobile tap targets.

---

## Order of Implementation

Per architect template, database first, then outward. This feature has no database changes, so the implementer starts at step 3.

1. **Database schema changes** — none.
2. **Prisma migration** — none.
3. **TypeScript types** — none (existing types in `/src/types/candidate-portal.ts` already cover the response shape; only `order` values change).
4. **Zod schemas** — none.
5. **API routes** — modify `src/app/api/candidate/application/[token]/structure/route.ts` to move the Personal Info section push to after the service section loop (modification 1). Update the JSDoc comment block to describe the new order.
6. **UI components** — in this order:
   1. Create `src/components/candidate/StepNavigationButtons.tsx` (modification: new file).
   2. Modify `src/components/candidate/review-submit/ReviewSubmitPage.tsx` to accept the optional `onBack` prop and render the Back button in the footer (modification 4).
   3. Modify `src/components/candidate/portal-layout.tsx` to import `StepNavigationButtons`, derive `navigableSections` / `showNext` / `showBack`, add `handleNextClick` / `handleBackClick`, render the buttons in every non-`review_submit` branch of `getActiveContent`, and pass `onBack` to `ReviewSubmitPage` in the `review_submit` branch (modifications 3 and 5).
7. **Translation keys** — add `candidate.navigation.next` and `candidate.navigation.back` to all five language files in `src/translations/` (modifications 7–11).

After all code is written:

8. Update tests in `src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts` per modification 2.
9. Add tests in `src/components/candidate/StepNavigationButtons.test.tsx` per the test surface.
10. Add tests in `src/components/candidate/portal-layout.test.tsx` per the test surface.
11. Update / add tests for `ReviewSubmitPage` per the test surface (test-writer locates the existing test file if any; if none exists, creates `src/components/candidate/review-submit/ReviewSubmitPage.test.tsx`).
12. Run `pnpm typecheck`, `pnpm lint`, `pnpm vitest run`. Verify zero net regression.

---

## Risks and Considerations

1. **portal-layout.tsx is already 863 lines** — over the 600-line soft trigger. The plan above adds ~30–40 lines to it (one import, two memos, two useCallbacks, one element in each of 5 dispatch branches). The new button rendering is in `StepNavigationButtons.tsx` rather than inline, which is the discipline the soft trigger is meant to enforce, but adding ANYTHING to a file already over the limit is still a conscious decision per Section 9.4. **Andy: please confirm in review.** If preferred, the implementer can extract `getActiveContent` to a new file in a follow-up PR — that work is out of scope for this task.

2. **The structure endpoint tests change in many places.** Six existing test blocks reference the old Personal-Info-first ordering. The test-writer must update each one precisely; a missed assertion will keep the old order alive in the test fixtures while the production endpoint emits the new order. The implementer should re-read every diff in the structure test file before committing.

3. **The save route's `sectionType` enum is NOT changed.** Per DATABASE_STANDARDS Section 2.4, `formData.sections['personal_info']` is keyed by the save-route `sectionType` value, which is independent of position in the structure response. Moving Personal Info from index 2 to index 6 in the structure response does not affect the storage key, so saved candidate data continues to flow into the same JSON bucket. Confirmed by reading the structure route, the candidate-portal types, and DATABASE_STANDARDS Section 2.4.

4. **The validation engine sees the same section IDs.** The validation engine identifies sections by their structure-response `id` field (per `usePortalValidation` in `src/lib/candidate/usePortalValidation.ts` and the section_visit_tracking machinery in `src/lib/candidate/sectionVisitTracking.ts`). Section IDs do not change (Personal Info stays `personal_info`, IDV stays `service_verification-idv`, etc.) — only their array position changes. Validation, visit tracking, and error display all continue to work without modification.

5. **First section may be `personal_info` or a service section depending on package.** When the package has no `before_services` workflow sections, the first navigable section is whichever comes next. Today that's `personal_info`; after this change it's IDV (or address_history if no IDV, or whatever the first applicable service section is). The Back button is correctly suppressed via `showBack` derivation — the test cases above cover this. No edge case in the code needs special handling.

6. **The `review_submit` page intentionally does NOT use the shared `StepNavigationButtons` component.** Spec rule 5 wants Back next to Submit in the same row — that requires changing `ReviewSubmitPage` itself. If we ALSO rendered `StepNavigationButtons` in the `review_submit` branch of `getActiveContent`, the page would have two Back buttons (one above Submit from the shared component, one next to Submit from the page itself). The portal-layout's `showBack` derivation excludes the `review_submit` branch precisely to avoid this. Test case 14 in the test surface enforces this.

7. **Scroll-to-top behavior uses `window.scrollTo` against the global window.** The candidate portal's main content area is `<main className="flex-1 bg-white overflow-y-auto">` (portal-layout.tsx line 857), which has its OWN scroll container — the page-level `window.scrollY` is usually 0. The spec rule 11 ("scrolls the page to the top of the new section") is best satisfied by scrolling the main element OR by relying on the section components rendering their own header at the top. The plan uses `window.scrollTo` because it's the simplest implementation and works in jsdom for testing; the implementer should verify in browser smoke testing that mobile behavior is correct. If `window.scrollTo` isn't sufficient (because content is in an overflow container), the implementer can add a ref on the `<main>` element and call `mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })` instead. **This is an implementation detail and does NOT require a new file** — the ref would live inside `portal-layout.tsx`.

8. **No constants file is created for the section ordering.** The current implementation uses an inline array (`serviceTypeOrder` at line 298 of the structure route). Spec rule 1 fixes the new order in plain English but doesn't require a constants extraction. Keeping the ordering inline matches the existing pattern and minimizes file surface change.

---

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above (1 new component, 1 new test file, 1 modified route, 1 modified route test, 1 modified component, 1 modified component test, 1 modified review-submit page, 1 new or modified review-submit test, 5 translation files).
- [x] No file outside this plan will need to be modified. Verified by:
  - `useTranslation` is the only context dependency — unchanged.
  - `handleSectionClick` is reused as-is — `portal-layout.tsx` is the only file that defines it.
  - No new auth check is needed — the existing route's auth checks cover everything.
  - The save route's `sectionType` enum is NOT touched (section IDs unchanged).
  - The validation engine and visit tracking are NOT touched (section IDs unchanged).
  - The constants files in `/src/constants/` are NOT touched (no status changes, no new enums).
  - Prisma schema is NOT touched.
- [x] All Zod schemas, types, and translation keys are listed (none new for Zod/types; two new translation keys, listed for each of the five language files).
- [x] The plan is consistent with the spec's Data Requirements table — both `candidate.navigation.next` and `candidate.navigation.back` are listed with their English values "Next" and "Back", and no other data fields are introduced (matching the spec's "No new data fields are stored").

---

**Ready for the test-writer.**
