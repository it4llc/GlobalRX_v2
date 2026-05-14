# Linear Step Navigation

**Task:** 8.2
**Date delivered:** May 13, 2026
**Spec:** `docs/specs/linear-step-navigation.md`
**Technical plan:** `docs/plans/linear-step-navigation-technical-plan.md`

---

## What was delivered

Two changes shipped together:

1. **Reordered section flow.** The structure endpoint (`GET /api/candidate/application/[token]/structure`) now returns sections in a new 9-step order. Personal Information moved from second position (immediately after before-services workflow sections) to sixth position (after all service sections). See `docs/api/candidate-application.md` for the full ordered list.

2. **Next/Back navigation buttons.** A shared `StepNavigationButtons` component renders a Back button (outline style) and a Next button (filled primary style) at the bottom of every section's content area in `PortalLayout`. Clicking either button delegates to the existing `handleSectionClick` in the shell and scrolls the page back to the top.

---

## New component

### `StepNavigationButtons` (`src/components/candidate/StepNavigationButtons.tsx`)

Presentational client component. Owns no state and calls no APIs. Accepts two props:

| Prop | Type | Meaning |
|------|------|---------|
| `onBack` | `(() => void) \| null` | When null, the Back button is not rendered (first step). |
| `onNext` | `(() => void) \| null` | When null, the Next button is not rendered (last step before Review & Submit). |
| `nextDisabled` | `boolean` (optional, default `false`) | Disables Next while keeping it visible. Reserved for future use. |

When both `onBack` and `onNext` are null the component returns null — no empty row is rendered (handles single-step packages).

Button sizing: `min-h-[44px]`, `w-full sm:w-auto`. Layout: `flex-col-reverse` below `sm` breakpoint (Back on top visually on mobile), `flex-row` with Back left / Next right on `sm` and wider.

Labels come from translation keys `candidate.navigation.back` and `candidate.navigation.next`.

---

## Changes to existing components

### `PortalLayout` (`src/components/candidate/portal-layout.tsx`)

- Imports `StepNavigationButtons`.
- Derives `navigableSections` (the full `sectionsWithStatus` array, in order) and `activeSectionIndex`.
- Adds `handleNextClick` and `handleBackClick` callbacks, both delegating to the existing `handleSectionClick`.
- Both click handlers call `scrollNewSectionIntoView`, which attempts `window.scrollTo({ top: 0, behavior: 'smooth' })` and falls back to `document.documentElement.scrollTop = 0`, then also resets `<main>.scrollTop` to cover the desktop overflow-scroll layout.
- Renders `StepNavigationButtons` at the bottom of every non-`review_submit` content branch in `getActiveContent`. The `review_submit` branch is excluded because `ReviewSubmitPage` renders its own Back button alongside Submit.
- Passes `onBack={handleBackClick}` to `ReviewSubmitPage` in the `review_submit` branch (always wired — Review & Submit always has at least one prior section).

### `ReviewSubmitPage` (`src/components/candidate/review-submit/ReviewSubmitPage.tsx`)

- Accepts a new optional `onBack?: () => void` prop. When provided, an outline-style Back button is rendered alongside the Submit button in the same flex row. When omitted (existing test fixtures), no Back button appears.
- The Submit button's `className` gained `w-full sm:w-auto` to participate in the shared flex row correctly.
- Import path for `ReviewSectionBlock` updated from a relative path to the absolute `@/components/candidate/review-submit/ReviewSectionBlock` alias (standards-checker fix).

### Structure route (`src/app/api/candidate/application/[token]/structure/route.ts`)

- Personal Information section is now pushed to the sections array after the service section loop rather than before it.
- Token path parameter validation replaced: the previous manual `!token || typeof token !== 'string'` guard was replaced with a `z.string().min(1)` Zod schema (`tokenParamSchema`), consistent with the sibling `/scope` and `/save` endpoints.
- Step 3 (session token ownership check) moved to after the Prisma invitation lookup (Step 4 becomes Step 3, check becomes Step 4), so a missing invitation returns 404 before a mismatched token returns 403. This matches the documented API error ordering (401 → 400 → 404 → 403).
- JSDoc block updated to describe the new section emission order.

---

## Translation keys added

Added to all five language files (`en-US.json`, `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`):

| Key | en-US | es | ja-JP |
|-----|-------|----|-------|
| `candidate.navigation.next` | Next | Siguiente | 次へ |
| `candidate.navigation.back` | Back | Atrás | 戻る |

---

## What the candidate sees

The sidebar continues to work for non-linear navigation. The Next/Back buttons appear below each section's form content. Clicking Next or Back moves to the adjacent section (by array index) and scrolls to the top of the new section. The Back button does not appear on the first step. The Next button does not appear on Review & Submit (Submit and its own Back button take that role). Neither button appears if the package has only a single section.
