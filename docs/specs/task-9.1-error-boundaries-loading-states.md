# Technical Plan: Task 9.1 — Error Boundaries & Loading States

**Feature:** Phase 9 Polish & Edge Cases — Task 9.1
**Date:** May 15, 2026
**Prerequisites:** Phase 8 complete, portal-layout refactor complete

---

## Summary

Wrap each candidate application section in an error boundary so that if one section crashes, it shows a friendly recovery message instead of taking down the entire application. Also add consistent loading indicators so candidates see clear feedback while section content loads.

---

## Database Changes

None. This task is entirely frontend.

---

## New Files to Create

### 1. `src/components/candidate/CandidateSectionErrorFallback.tsx`

- **Purpose:** A candidate-friendly error fallback component shown when a section crashes
- **Client component** (`"use client"`)
- **What it renders:**
  - A bordered card with a warning icon
  - A short, plain-language message: "This section couldn't load. Please try again."
  - A "Try Again" button that resets the error boundary
  - A "Skip to Next Step" button that navigates to the next section (using the existing `handleSectionClick` navigation)
  - Must be mobile-friendly (full width on small screens, proper touch target sizes per existing 44px minimum)
- **Props:**
  - `error: Error` — the error that was caught (for logging, not shown to the candidate)
  - `resetErrorBoundary: () => void` — callback to retry rendering the section
  - `onSkipToNext?: () => void` — optional callback to navigate to the next step
  - `sectionTitle?: string` — optional section name to include in the message
- **Styling:** Uses existing Tailwind classes and CSS variables. No inline styles. Follows the card/border patterns already used in the candidate portal.
- **Translations:** All user-facing text uses translation keys (see Translation Keys section below)

### 2. `src/components/candidate/CandidateSectionLoadingSkeleton.tsx`

- **Purpose:** A loading placeholder shown while a section's content is being prepared
- **Client component** (`"use client"`)
- **What it renders:**
  - Animated placeholder bars (skeleton pattern) that approximate the shape of a form section
  - A subtle pulsing/shimmer animation using Tailwind's `animate-pulse` class
  - Different skeleton layouts for different section types:
    - `form` — a few rows of label + input placeholder bars (for Personal Info, Address History, etc.)
    - `content` — a block of text placeholder bars (for workflow sections)
    - `review` — a list of status indicator placeholder bars (for Review & Submit)
  - The skeleton should be roughly the same height as typical section content so the page doesn't jump when real content loads
- **Props:**
  - `variant?: 'form' | 'content' | 'review'` — which skeleton layout to show (defaults to `'form'`)
- **Styling:** Tailwind only. Uses `bg-gray-200 animate-pulse rounded` patterns. No inline styles.

### 3. `src/components/candidate/__tests__/CandidateSectionErrorFallback.test.tsx`

- **Purpose:** Tests for the error fallback component
- **What to test:**
  - Renders the error message
  - "Try Again" button calls `resetErrorBoundary`
  - "Skip to Next Step" button calls `onSkipToNext` when provided
  - "Skip to Next Step" button is hidden when `onSkipToNext` is not provided
  - Section title appears in the message when provided

### 4. `src/components/candidate/__tests__/CandidateSectionLoadingSkeleton.test.tsx`

- **Purpose:** Tests for the loading skeleton component
- **What to test:**
  - Renders with default variant (form)
  - Renders each variant (form, content, review) with the correct number of placeholder elements
  - Has the pulse animation class applied

---

## Existing Files to Modify

### 1. `src/components/candidate/portal-layout.tsx`

- **What currently exists:** The main layout component that manages `activeSection` state, handles navigation via `handleSectionClick`, and renders the active section's content via `getActiveContent()`. After the Phase 8 refactor, this includes Next/Back button navigation.
- **What needs to change:**
  1. **Import** the existing `ErrorBoundary` from `@/components/error-boundary` and the new `CandidateSectionErrorFallback` and `CandidateSectionLoadingSkeleton` components
  2. **Wrap the section content area** (the output of `getActiveContent()` or equivalent) in an `ErrorBoundary` that uses `CandidateSectionErrorFallback` as its fallback
  3. **Pass a unique `key` prop** to the ErrorBoundary that changes when the active section changes — this ensures the error boundary resets when the candidate navigates to a different section (so a crash in Address History doesn't block Personal Info)
  4. **Pass the "skip to next" callback** to the fallback so the candidate can navigate away from a broken section
  5. **Add a loading state** — when transitioning between sections, briefly show `CandidateSectionLoadingSkeleton` with the appropriate variant based on section type. The skeleton shows while the section component mounts and loads its data.
  6. **Map section types to skeleton variants:**
     - Workflow sections → `'content'`
     - Review & Submit → `'review'`
     - Everything else (Address History, Education, Employment, Personal Info, IDV, Record Search Requirements) → `'form'`
- **Confirmation:** File path confirmed in project knowledge (candidate-invite-phase-plan.md)

### 2. `src/components/error-boundary.tsx`

- **What currently exists:** A generic `ErrorBoundary` class component that catches render errors and shows a red-bordered error box with a "Try Again" button. Accepts a `fallback` prop for custom fallback UI and a `children` prop.
- **What needs to change:**
  1. **Add an `onError` callback prop** — so the portal layout can be notified when an error occurs (for logging purposes). The callback receives the `error` and `errorInfo` objects.
  2. **Add an `onReset` callback prop** — so the portal layout can perform cleanup when the error boundary resets (e.g., clear stale section data)
  3. **Add a `resetKeys` prop** (array) — when any value in this array changes, the error boundary automatically resets itself. This is the mechanism that clears errors when navigating between sections.
  4. Ensure the existing `fallback` prop behavior is unchanged so other parts of the app that already use `ErrorBoundary` are not affected.
- **Confirmation:** File path confirmed in project technical documentation (GlobalRx_Technical_Documentation)

---

## API Routes

None. This task is entirely frontend.

---

## Zod Validation Schemas

None.

---

## TypeScript Types

No new shared types needed. The component props are defined inline in each component file since they are only used by that component.

---

## UI Components

### CandidateSectionErrorFallback

- **File:** `src/components/candidate/CandidateSectionErrorFallback.tsx`
- **Client component** (`"use client"`)
- **Renders:** Warning card with retry and skip buttons
- **Uses:** `Button` from `@/components/ui/button`, translation hook `useTranslation`
- **No API calls**

### CandidateSectionLoadingSkeleton

- **File:** `src/components/candidate/CandidateSectionLoadingSkeleton.tsx`
- **Client component** (`"use client"`)
- **Renders:** Animated placeholder bars in form, content, or review layouts
- **Uses:** Tailwind utility classes only
- **No API calls**

### portal-layout.tsx (modified)

- **File:** `src/components/candidate/portal-layout.tsx`
- **Already a client component**
- **Changes:** Wraps section content in ErrorBoundary with candidate-specific fallback, adds loading skeleton during section transitions
- **Uses:** `ErrorBoundary` from `@/components/error-boundary`, new candidate components above

---

## Translation Keys

All user-facing text in the new components needs translation keys. Add these to every translation file (`en-US.json`, `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`):

| Key | English (en-US) Value |
|---|---|
| `candidate.error.sectionFailedTitle` | `"Something went wrong"` |
| `candidate.error.sectionFailedMessage` | `"This section couldn't be loaded. Your progress has been saved."` |
| `candidate.error.sectionFailedWithName` | `"The {{sectionName}} section couldn't be loaded. Your progress has been saved."` |
| `candidate.error.tryAgain` | `"Try Again"` |
| `candidate.error.skipToNext` | `"Continue to Next Step"` |
| `candidate.loading.sectionLoading` | `"Loading..."` |

For non-English translation files, use the English text as a placeholder value — the translation team will update them later.

---

## Order of Implementation

1. **Enhance `ErrorBoundary`** (`src/components/error-boundary.tsx`) — add `onError`, `onReset`, and `resetKeys` props
2. **Create `CandidateSectionErrorFallback`** — the friendly fallback UI
3. **Create `CandidateSectionLoadingSkeleton`** — the loading placeholder
4. **Add translation keys** to all language files
5. **Update `portal-layout.tsx`** — wire everything together: wrap section content in ErrorBoundary with the new fallback, add loading skeleton during transitions

---

## Risks and Considerations

1. **ErrorBoundary enhancement must be backward-compatible.** The existing ErrorBoundary is likely used elsewhere in the app. The new props (`onError`, `onReset`, `resetKeys`) must all be optional with no behavior change when omitted. The implementer must verify all existing usages of ErrorBoundary still work after the changes.

2. **The `key` prop on ErrorBoundary is critical.** Without it, a crash in one section would persist when navigating to another section because React wouldn't unmount and remount the error boundary. The key must be tied to the active section's ID.

3. **Loading skeleton timing.** The skeleton should only show during meaningful transitions (switching sections), not flicker on every re-render. If section content renders synchronously (which it may — the data is already fetched and held in state), the skeleton may not be needed at all for most transitions. The implementer should test whether a noticeable delay exists before adding skeleton logic. If sections render instantly, the skeleton can be wired up but only activated for the initial page load or when data is being fetched.

4. **Winston logger for error reporting.** The `onError` callback in the ErrorBoundary should use the Winston logger (not `console.error`) to log section crashes, per coding standards. However, since this is a client component, verify that the existing logger utility works client-side. If it doesn't, use a `fetch` call to a logging endpoint, or flag this as a follow-up item.

5. **Auto-save reassurance.** The error fallback message says "Your progress has been saved" — this is true because auto-save fires on field blur. But if the crash happened mid-typing before a blur event, the very latest keystrokes might not have been saved. The message is still accurate for all practical purposes since the last blurred field was saved.

---

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All translation keys are listed
- [x] No database changes needed
- [x] No API changes needed
- [x] No Zod schemas needed
- [x] No new shared TypeScript types needed
- [x] Backward compatibility of ErrorBoundary enhancement is called out
- [x] Mobile-first requirement is addressed (touch targets, full-width on small screens)

---

**This plan is ready for the test writer (Pass 1) to proceed.**