# Phase 9, Task 9.2 — Accessibility Audit & Improvements

**Date:** May 16, 2026
**Branch:** `feature/candidate-invite-9.2-accessibility-audit`
**Spec:** `docs/specs/candidate-invite-9.2-accessibility-audit.md`

---

## What This Covers

WCAG 2.1 AA accessibility improvements across all 9 steps of the candidate application portal. No new pages or features were added. No database or API route changes were made.

---

## New Files

### `src/components/candidate/skip-link.tsx`
Exports `SkipLink`. A visually-hidden anchor rendered as the first focusable element on the portal. When a keyboard user presses Tab, the link becomes visible at the top of the viewport. Activating it moves browser focus to the element with `id="main-content"` (the `<main>` landmark). Uses `MAIN_CONTENT_ID` from the a11y constants. Translated via `candidate.a11y.skipToContent`.

### `src/components/candidate/step-heading.tsx`
Exports `StepHeading`. A `<h2>` rendered inside the `<main>` content area. Has `tabIndex={-1}` so the `useFocusOnChange` hook can call `.focus()` on it after step navigation without making it part of the sequential tab order. Accepts `id`, `title`, and optional `children`.

### `src/components/candidate/live-announcer.tsx`
Exports `LiveAnnouncerProvider` and `useLiveAnnouncer`. The provider renders a single `aria-live` region (id `candidate-live-region`, defined in a11y constants) and exposes a React context. The `announce(message, urgency)` function clears the region and writes the new message after 50ms so screen readers re-announce identical strings on repeat. Urgency `"polite"` maps to `role="status"`; `"assertive"` maps to `role="alert"`. The hook returns a no-op when the provider is not mounted, so section components mounted in isolation (unit tests) do not throw.

### `src/hooks/candidate/use-focus-management.ts`
Exports `useFocusOnChange` and `focusElementById`.

- `useFocusOnChange(targetId, trigger)` — moves keyboard focus to the element with the given id whenever `trigger` changes, skipping the initial mount. Uses a requestAnimationFrame fallback followed by a 100ms timeout to handle step-transition timing.
- `focusElementById(id)` — imperative version of the same pattern, used where focus must be moved outside of a React effect (e.g., after a programmatic add/remove entry action).

### `src/hooks/candidate/use-keyboard-navigation.ts`
Exports `useKeyboardNavigation` and `useFocusTrap`.

- `useKeyboardNavigation({ onEscape, isDrawerOpen })` — attaches a document-level `keydown` listener that calls `onEscape` when Escape is pressed and the drawer is open. No-ops when the drawer is closed.
- `useFocusTrap(containerRef, isActive)` — confines Tab and Shift+Tab focus to focusable descendants of the referenced element when active. Recomputes the focusable list on every Tab press so dynamically-added items participate immediately. Moves focus into the container on activation if focus is currently outside it.

### `src/lib/candidate/a11y-constants.ts`
Four named string constants used as DOM element IDs across the candidate portal:

| Constant | Value | Used by |
|---|---|---|
| `MAIN_CONTENT_ID` | `"main-content"` | `SkipLink`, `<main>` in `portal-layout` |
| `LIVE_REGION_ID` | `"candidate-live-region"` | `LiveAnnouncerProvider` |
| `MOBILE_SIDEBAR_ID` | `"candidate-mobile-sidebar"` | `portal-sidebar`, `portal-header` |
| `SUBMIT_DISABLED_DESCRIBEDBY_ID` | `"submit-disabled-description"` | `ReviewSubmitPage` |

### `src/types/candidate-a11y.ts`
Three TypeScript types for the accessibility system:

- `LiveAnnouncementUrgency` — union `'polite' | 'assertive'`
- `LiveAnnouncerContextType` — `{ announce: (message, urgency?) => void }`
- `FocusManagementOptions` — `{ targetId: string; delay?: number }`
- `StepAriaInfo` — `{ stepNumber, totalSteps, stepTitle, completionStatus }` with `completionStatus` as `'complete' | 'incomplete' | 'not_started' | 'has_errors'`

---

## Modified Files

### `src/app/globals.css`
Three accessibility utilities appended:

- `.sr-only` — classic WAI-ARIA 1×1 clip implementation for visually-hiding text that must remain available to screen readers.
- `.skip-link` / `.skip-link:focus` — skip-link styling. Hidden using the sr-only clip until focus arrives; then renders as a fixed-position visible button at the top of the viewport.
- `:focus-visible` — `outline: 2px solid #3b82f6; outline-offset: 2px` on all interactive elements for keyboard users. The `:focus-visible` pseudo-class means the ring does not appear on mouse clicks.
- `@media (prefers-reduced-motion: reduce)` — sets `animation-duration`, `transition-duration`, `animation-iteration-count`, and `scroll-behavior` to near-instant values for users who have enabled the OS "Reduce Motion" preference.

### `src/components/candidate/portal-layout.tsx`
- Wrapped in `LiveAnnouncerProvider` via a thin outer `PortalLayout` wrapper; the implementation logic moved into `PortalLayoutInner`.
- `SkipLink` rendered as the first child of the layout root, before the header.
- `<main>` element gains `id={MAIN_CONTENT_ID}`, `tabIndex={-1}`, `aria-labelledby` pointing to the active step heading id, and `className` addition of `outline-none`.
- `StepHeading` rendered at the top of `<main>` with `id="step-heading-{sectionId}"` and the active section's localized title.
- `useFocusOnChange` called with the active step heading id and active section id so focus moves to the heading on every step change.
- `handleNextClickWithA11y` — gates forward navigation: when the active section has visible validation errors, it announces `candidate.a11y.cannotContinue` assertively, moves focus to the first `[aria-invalid="true"]` element, and blocks `handleNextClick`. When no errors are present it delegates to `handleNextClick` unchanged.
- `onSaveSuccessWithAnnouncement` — wraps `refreshValidation` and announces `candidate.a11y.progressSaved` politely. Passed as `onSaveSuccess` to all section components.
- `handleAddressHistorySaveSuccessWithA11y` — same pattern for Address History, which has its own specialized save handler.
- Per-section gap-warning effect — tracks previous gap count per section via a ref and announces `candidate.a11y.addressGapWarning` when the gap count increases for the active section.
- `StepNavigationButtons` receives `backStepNumber`, `backStepTitle`, `nextStepNumber`, `nextStepTitle` for descriptive aria-labels.
- `isMenuOpen` forwarded to `PortalHeader`.

### `src/components/candidate/portal-header.tsx`
- Added `isMenuOpen?: boolean` prop (defaults to `false`).
- Hamburger button gains `aria-expanded={isMenuOpen ? 'true' : 'false'}` and `aria-controls={MOBILE_SIDEBAR_ID}`.
- Hamburger's SVG icon gains `aria-hidden="true"`.
- `type="button"` added to hamburger button.

### `src/components/candidate/portal-sidebar.tsx`
- `useKeyboardNavigation` and `useFocusTrap` from `use-keyboard-navigation` are now used. Escape closes the mobile drawer; Tab/Shift+Tab are trapped inside the drawer when it is open.
- Desktop and mobile `<nav>` elements gain `role="navigation"` and `aria-label={t('candidate.a11y.applicationSteps')}`.
- Entry list container gains `role="list"`; each `<li>` gains `role="listitem"` and `aria-current="step"` when active.
- Each step button gains an `aria-label` formatted as `"Step {n} of {total}: {name} — {statusWord}"` using `candidate.a11y.stepXofY` and the appropriate `candidate.a11y.stepStatus*` key.
- Mobile overlay `<div>` gains `aria-hidden="true"`.
- Mobile drawer `<div>` gains `id={MOBILE_SIDEBAR_ID}`, `role="dialog"`, `aria-modal="true"`, `aria-label={t('candidate.a11y.stepsMenu')}`, `aria-hidden={!isOpen}`, and `ref={drawerRef}`.
- Close button aria-label changed from hardcoded `"Close menu"` to `t('candidate.a11y.closeMenu')`. Close button SVG gains `aria-hidden="true"`. `type="button"` added.

### `src/components/candidate/SectionProgressIndicator.tsx`
- `statusLabel` now uses `candidate.a11y.stepStatusComplete`, `candidate.a11y.stepStatusIncomplete`, and `candidate.a11y.stepStatusNotStarted` instead of the previous `candidate.sectionProgress.*` keys. This aligns the sr-only text with the vocabulary used in the sidebar item aria-labels. The visual icons (distinct shapes per status) and `aria-hidden="true"` on the decorative spans were already present.

### `src/components/candidate/StepNavigationButtons.tsx`
- Added four optional props: `backStepNumber`, `backStepTitle`, `nextStepNumber`, `nextStepTitle`.
- Back button gains `aria-label` using `candidate.a11y.goBackToStep` when destination info is supplied; falls back to no `aria-label` (button text is the accessible name) when omitted.
- Next button gains `aria-label` using `candidate.a11y.continueToStep` under the same pattern.

### `src/components/candidate/form-engine/WorkflowSectionRenderer.tsx`
- The rendered content container gains `role="document"`, `aria-label={section.name}`, and `tabIndex={0}` so keyboard users can scroll through long content and screen readers announce it as a standalone document region.

### `src/components/candidate/form-engine/RepeatableEntryManager.tsx`
- Each entry is now wrapped in a `<fieldset data-entry-id={entryId}>` with a `<legend>` as its first direct child. The legend text is the entry label (e.g., "Address 1", "Education entry 2").
- The entry header toggle area gains `role="button"`, `tabIndex={0}`, `aria-expanded`, `aria-label` (expand/collapse), and a `keyDown` handler for Enter/Space — on mobile only. Desktop always shows entries expanded and the header is non-interactive.
- Chevron icons gain `aria-hidden="true"`.
- Remove button gains `type="button"`, `aria-label={removeAriaLabel}`, and optional `aria-describedby`. Remove button `X` icon gains `aria-hidden="true"`.
- Add Entry button gains `type="button"`. Its `Plus` icon gains `aria-hidden="true"`. A `<span className="sr-only">` with the section-specific `addButtonAriaLabelKey` translation is appended inside the button for screen readers.
- Two new props on `EntryManagerProps`: `addButtonAriaLabelKey?: string` and `removeButtonAriaLabelKey?: string`.
- Focus management on add: after entries grow, `focusFirstFocusableInEntry` focuses the first focusable element inside the last entry's fieldset.
- Focus management on remove: after entries shrink (flagged by `pendingRemoveFocus` ref), focuses the first focusable element of the last remaining entry.

### `src/components/candidate/form-engine/AddressHistorySection.tsx`
- Passes `entryNumber={entry.entryOrder + 1}` and `entryTypeKey="address"` to `AddressBlockInput` so date fields get contextual aria-labels.
- Passes `entryLabelKey="candidate.a11y.addressEntryN"`, `addButtonAriaLabelKey="candidate.a11y.addAnotherAddress"`, and `removeButtonAriaLabelKey="candidate.a11y.removeAddressN"` to `RepeatableEntryManager`.

### `src/components/candidate/form-engine/EducationSection.tsx`
- Passes `entryLabelKey="candidate.a11y.educationEntryN"`, `addButtonAriaLabelKey="candidate.a11y.addAnotherEducation"`, and `removeButtonAriaLabelKey="candidate.a11y.removeEducationN"` to `RepeatableEntryManager`.
- Import path for `CandidateDocumentUpload` changed from relative to `@/` alias.

### `src/components/candidate/form-engine/EmploymentSection.tsx`
- Same aria-label key additions as EducationSection, using the `employment` vocabulary.
- Import path for `CandidateDocumentUpload` changed to `@/` alias.

### `src/components/candidate/form-engine/AddressBlockInput.tsx`
- Two new optional props: `entryNumber?: number` and `entryTypeKey?: string` (defaults to `"address"`).
- Start-date input gains `aria-label` built from `candidate.a11y.startDateForEntry` when `entryNumber` is supplied.
- End-date input gains `aria-label` built from `candidate.a11y.endDateForEntry` under the same condition.

### `src/components/candidate/form-engine/DynamicFieldRenderer.tsx`
- Text inputs gain `aria-required={isRequired || undefined}`.
- Text inputs gain `aria-describedby` referencing both the `FieldErrorMessage` id and the inline error paragraph id when an error is present.
- Inline error `<p>` gains `id="error-{fieldKey}"` to match the `aria-describedby` reference.

### `src/components/candidate/form-engine/PersonalInfoSection.tsx`
- Uses `useLiveAnnouncer` to access the live announcer.
- New effect tracks required field count (fields + cross-section requirements). When the count increases after the initial load, announces `candidate.a11y.newFieldsAdded` politely.

### `src/components/candidate/form-engine/RecordSearchSection.tsx`
- Uses `useLiveAnnouncer`.
- New effect tracks the aggregated items list by a stable string key (requirement ids + isRequired flag, sorted). Announces `candidate.a11y.requirementsUpdated` politely when the list changes after the initial load.

### `src/components/candidate/review-submit/ReviewSubmitPage.tsx`
- `submitDisabled` boolean extracted and shared between `disabled`, `aria-disabled`, and the new `aria-describedby`.
- Submit button gains `aria-describedby={SUBMIT_DISABLED_DESCRIBEDBY_ID}` when disabled; `undefined` when enabled.
- New `<p id={SUBMIT_DISABLED_DESCRIBEDBY_ID} className="sr-only">` in the footer containing the `candidate.a11y.completeBeforeSubmit` translation.
- `role="alert"` validation summary banner renders when `fieldsNeedAttentionCount > 0`, showing the `candidate.a11y.fieldsNeedAttention` text.

### `src/components/candidate/review-submit/ReviewSectionBlock.tsx`
- When a section has errors, a new `<a>` link with `aria-label={t('candidate.a11y.fixErrorsIn', { sectionName })}` is rendered above the error list. Clicking it calls `onErrorClick(errors[0])` after preventing default. The link uses `data-testid="review-jump-link"`.

### `src/types/candidate-repeatable-form.ts`
- Added `addButtonAriaLabelKey?: string` and `removeButtonAriaLabelKey?: string` to `EntryManagerProps`.

### Translation files
35 new `candidate.a11y.*` keys added to all five locale files: `en-US.json`, `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`. The `es-ES.json`, `es.json`, and `ja-JP.json` files carry English text for the new keys; translation is deferred (see tech debt entries).

Two existing keys were updated in all five locale files:
- `candidate.portal.educationEntryLabel` — text changed from `"Education {number}"` to `"Education entry {number}"`
- `candidate.portal.employmentEntryLabel` — text changed from `"Employment {number}"` to `"Employment entry {number}"`

---

## New E2e Test File

`e2e/tests/candidate-invite-9.2-accessibility.spec.ts` covers: skip link behavior, ARIA landmarks, sidebar ARIA (list/listitem/aria-current/aria-label), mobile drawer dialog semantics and focus trap, hamburger aria-expanded/aria-controls, step-heading focus on Next/Back/sidebar navigation, live announcer region, Next-button validation gating with assertive announcement, Back/Next descriptive aria-labels, 44px touch targets, `SectionProgressIndicator` sr-only text, `WorkflowSectionRenderer` role="document", form field accessibility, repeatable-entry fieldset/legend, add/remove focus management, and Review & Submit accessibility.

Test seed tokens `test-a11y-*` are not yet created — see TD-100.

---

## Deferred Items

See TD-098 through TD-102 in `docs/TECH_DEBT.md`.
