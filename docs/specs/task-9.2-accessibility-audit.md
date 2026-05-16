# Technical Plan: Task 9.2 — Accessibility Audit & Improvements

**Based on specification:** Candidate Invite Phase Plan (Phase 9) and GlobalRx Technical Documentation Accessibility Standards
**Date:** May 15, 2026
**Target:** WCAG 2.1 AA compliance across all 9 candidate application steps

---

## What This Task Is About (Plain English)

The candidate application is a 9-step form that people fill out on their phone or computer to complete a background check. Right now, the form works visually, but it doesn't work well for people who:

- Can't use a mouse and need to navigate with just a keyboard (Tab, Enter, arrow keys)
- Use screen readers (software that reads the page out loud for blind or low-vision users)
- Need high contrast or large text

This task adds the missing pieces so the application meets the WCAG 2.1 AA accessibility standard — a widely recognized benchmark for web accessibility.

No new pages or features are being built. We're improving what already exists.

---

## Database Changes

None. This task is purely about the user interface (the parts candidates see and interact with). No data storage changes are needed.

---

## New Files to Create

### 1. `src/components/candidate/skip-link.tsx`
- **Purpose:** A hidden link that appears when a keyboard user presses Tab on page load, letting them jump straight to the main form content instead of tabbing through the entire sidebar/header first
- **What it contains:** A small "use client" component that renders an anchor link (`<a>`) targeting the main content area. Visually hidden until it receives keyboard focus, then it slides into view at the top of the page

### 2. `src/components/candidate/step-heading.tsx`
- **Purpose:** A reusable heading component for each of the 9 steps that provides consistent heading structure (h1/h2) and announces the step name to screen readers when the candidate navigates to a new step
- **What it contains:** A "use client" component that renders the step title as an `<h2>` with a unique `id`, and uses a "live region" to announce step changes. Accepts the step number and title as inputs

### 3. `src/hooks/candidate/use-focus-management.ts`
- **Purpose:** A shared helper (called a "hook" in React) that handles moving keyboard focus to the right place when the candidate navigates between steps
- **What it contains:** Logic that moves focus to the step heading when a candidate clicks Next/Back or selects a step from the sidebar. This prevents the focus from getting "lost" somewhere on the page after navigation

### 4. `src/hooks/candidate/use-keyboard-navigation.ts`
- **Purpose:** A shared helper that adds keyboard shortcuts for navigating between steps
- **What it contains:** Listens for specific key presses and provides functions for keyboard-driven step navigation. Escape key closes the mobile sidebar drawer if it's open

### 5. `src/components/candidate/live-announcer.tsx`
- **Purpose:** An invisible area on the page that screen readers watch for changes, so important updates (like "Step saved" or "Validation error: 3 fields need attention") get announced out loud
- **What it contains:** A "use client" component that renders a hidden `<div>` with `aria-live="polite"` and exposes a way for other components to push announcements into it

### 6. `src/lib/candidate/a11y-constants.ts`
- **Purpose:** A single place to store all the accessibility-related identifiers and text strings used across the candidate application
- **What it contains:** Named constants for ARIA label text, landmark region names, live region IDs, and keyboard shortcut definitions. Keeping these in one file prevents typos and inconsistencies

---

## Existing Files to Modify

### 1. `src/components/candidate/portal-layout.tsx`
**What exists today:** The main wrapper for the entire candidate application. It manages which step is active, handles Next/Back navigation, and renders the sidebar plus the current step's content area.

**What needs to change:**
- Add ARIA landmark roles: the main content area gets `role="main"` and `aria-label="Application form"`, the sidebar region gets `role="navigation"` and `aria-label="Application steps"`
- Import and render the new `SkipLink` component at the top (before the header)
- Import and render the new `LiveAnnouncer` component
- Import and use the `useFocusManagement` hook so that when the active step changes, focus moves to the new step's heading
- When auto-save completes, push an announcement ("Progress saved") to the live announcer
- When validation errors appear, push an announcement ("X fields need attention") to the live announcer
- Add `id="main-content"` to the main content container (the skip link jumps here)

**Confirmed:** This file is listed in the project knowledge as a key existing file (`portal-layout.tsx`)

### 2. `src/components/candidate/portal-sidebar.tsx`
**What exists today:** The step list shown on desktop as a fixed sidebar and on mobile as a slide-out drawer. Each step shows its name and a progress indicator (green check, red exclamation, or grey circle).

**What needs to change:**
- Add `role="navigation"` and `aria-label="Application steps"` to the sidebar container
- Each step item needs `role="listitem"` inside a container with `role="list"`
- Add `aria-current="step"` to the currently active step
- Each step button needs an `aria-label` that includes the step number, name, AND completion status (e.g., "Step 3 of 9: Address History — complete" or "Step 5 of 9: Employment — not started")
- The mobile drawer needs `aria-modal="true"`, `role="dialog"`, and `aria-label="Application steps menu"` when open
- The mobile drawer needs focus trapping — when it's open, Tab should cycle through only the items inside the drawer, not escape to the page behind it
- The mobile drawer's overlay (the dark background behind the drawer) needs to close the drawer when clicked, and this behavior must also work via keyboard (Escape key)
- The hamburger menu button needs `aria-expanded="true/false"` to indicate whether the drawer is open
- The hamburger menu button needs `aria-controls` pointing to the drawer's `id`

**Confirmed:** This file is listed in the project knowledge as a key existing file (`portal-sidebar.tsx`)

### 3. `src/components/candidate/SectionProgressIndicator.tsx`
**What exists today:** A small visual icon (green check, red exclamation, grey circle) that shows next to each step in the sidebar and on the review page.

**What needs to change:**
- Add screen-reader-only text (`<span className="sr-only">`) that describes the status: "Complete", "Has errors", or "Not started"
- The visual icon currently relies on color alone to communicate status (green = done, red = error). Add a distinct icon shape for each state so color isn't the only signal (this is a WCAG requirement)
- Add `aria-hidden="true"` to the decorative icon element itself (since the sr-only text provides the meaning)

**Confirmed:** This file is listed in the project knowledge (`SectionProgressIndicator.tsx`)

### 4. `src/components/candidate/WorkflowSectionRenderer.tsx`
**What exists today:** Renders workflow section content (Welcome page, consent forms, etc.) as HTML using `dangerouslySetInnerHTML` after DOMPurify sanitization and template variable substitution.

**What needs to change:**
- Wrap the rendered HTML in a container with `role="document"` and `aria-label` set to the section title, so screen readers understand this is a standalone document block
- Add `tabIndex={0}` to the container so keyboard users can scroll through long content

**Confirmed:** This file is listed in the project knowledge (`WorkflowSectionRenderer.tsx`)

### 5. `src/components/candidate/PersonalInfoSection.tsx`
**What exists today:** Renders the dynamic subject-targeted fields (Step 7 in the new flow). Fields appear based on which countries the candidate selected in earlier steps.

**What needs to change:**
- Ensure every form field has a visible `<label>` element with a matching `htmlFor`/`id` pair
- Add `aria-required="true"` to all required fields
- Add `aria-invalid="true"` to fields that have validation errors
- Add `aria-describedby` linking each field to its error message (if any)
- When fields are dynamically added (because the candidate went back and changed a country), announce "New required fields have been added" via the live announcer
- Ensure the field grouping uses `<fieldset>` and `<legend>` for logically related fields (e.g., a group of fields all required for a specific country)

**Confirmed:** This file is listed in the project knowledge (`PersonalInfoSection.tsx`)

### 6. Address History section component
**What exists today:** The candidate enters address entries with start/end dates and country selection. Each entry has inline fields that change based on the selected country.

**What needs to change:**
- Each address entry block needs to be wrapped in a `<fieldset>` with a `<legend>` (e.g., "Address 1", "Address 2")
- The "Add another address" button needs a clear `aria-label`: "Add another address entry"
- The "Remove" button on each entry needs a specific label: "Remove address 3" (not just "Remove")
- Date fields need `aria-label` attributes that include context: "Start date for address 1"
- When a new entry is added, focus should move to the first field of the new entry
- When an entry is removed, focus should move to the previous entry's first field (or the "Add" button if it was the only entry)
- Gap tolerance warnings need to be announced via the live announcer

### 7. Education section component
**What exists today:** The candidate enters education entries with inline DSX fields per entry.

**What needs to change:**
- Same fieldset/legend pattern as Address History ("Education entry 1", "Education entry 2")
- Same add/remove focus management as Address History
- Same aria-label patterns for contextual field labels
- Scope validation messages ("You need exactly 2 education entries") announced via live announcer

### 8. Employment section component
**What exists today:** The candidate enters employment entries with start/end dates and inline DSX fields.

**What needs to change:**
- Same fieldset/legend, add/remove focus management, and aria-label patterns as Address History and Education
- Employment gap entries need their own fieldset with a legend that indicates they're gap entries: "Employment gap — June 2024 to September 2024"

### 9. Record Search Requirements section component
**What exists today:** (Split out from Address History in Task 8.4) Shows aggregated fields like authorization documents and county-of-arrest selections.

**What needs to change:**
- Fields need proper labels and aria attributes (same pattern as Personal Info)
- When fields recalculate silently (because the candidate changed addresses), announce "Requirements have been updated" via the live announcer

### 10. Review & Submit section component
**What exists today:** Shows a summary of all steps with completion status and error navigation. The candidate can click on a section with errors to jump back to it.

**What needs to change:**
- Each section summary block needs an accessible heading (h3) with the section name
- The "Jump to section" links need `aria-label` attributes: "Go back to fix errors in Address History"
- The overall validation summary at the top needs `role="alert"` so it's immediately announced when errors exist
- The Submit button needs `aria-disabled="true"` (not just visual graying) when the form isn't complete, and `aria-describedby` pointing to text that explains why ("Complete all required sections before submitting")

### 11. Next/Back navigation buttons (in portal-layout.tsx or a sub-component)
**What exists today:** Next and Back buttons below each step's content area.

**What needs to change:**
- Back button: `aria-label="Go back to Step X: \[Step Name\]"` (showing where it will actually go, not just "Back")
- Next button: `aria-label="Continue to Step X: \[Step Name\]"` (showing the destination)
- When a step has validation errors and the candidate presses Next, announce "Cannot continue — X fields need attention" via the live announcer and move focus to the first field with an error
- Both buttons must meet the 44px minimum touch target size (this should already be in place from the mobile-first work, but needs verification)

### 12. `src/app/globals.css` (or equivalent global stylesheet)
**What exists today:** Global styles for the application.

**What needs to change:**
- Add a visible focus indicator style for all interactive elements: `outline: 2px solid #3b82f6; outline-offset: 2px` on `:focus-visible` (the `:focus-visible` selector means the outline only shows for keyboard users, not mouse clicks)
- Add a `sr-only` utility class if one doesn't already exist (visually hidden text for screen readers)
- Add a `prefers-reduced-motion` media query that disables animations/transitions for users who have turned on "reduce motion" in their operating system settings
- Ensure all text meets the 4.5:1 contrast ratio requirement against its background (WCAG AA)

---

## API Routes

No API route changes. This task is entirely about the front-end user interface.

---

## Zod Validation Schemas

No new schemas. Existing validation logic stays the same — we're just improving how validation results are communicated to users.

---

## TypeScript Types

### `src/types/candidate-a11y.ts`
New type definitions for the accessibility system:

```
LiveAnnouncerContextType:
  - announce: function that takes a message string and an optional urgency level ("polite" or "assertive")

FocusManagementOptions:
  - targetId: string (the id of the element to focus)
  - delay: number (optional — milliseconds to wait before focusing, needed for step transition animations)

StepAriaInfo:
  - stepNumber: number
  - totalSteps: number
  - stepTitle: string
  - completionStatus: "complete" | "incomplete" | "not_started" | "has_errors"
```

These are NOT derived from Zod schemas — they're purely for the UI layer.

---

## UI Components

See "New Files to Create" and "Existing Files to Modify" above. Summary of the component architecture:

**New components:**
- `SkipLink` — rendered once at the top of the portal layout
- `StepHeading` — rendered inside each step's content area
- `LiveAnnouncer` — rendered once at the top of the portal layout, provides context to all child components

**New hooks:**
- `useFocusManagement` — used by portal-layout to manage focus on step changes
- `useKeyboardNavigation` — used by portal-layout to handle keyboard shortcuts

**All new components are "use client" components** (they need browser features like focus management and event listeners).

**Existing UI components used:** No new use of `ModalDialog`, `FormTable`, or `ActionDropdown`. The changes are to candidate-specific components.

---

## Translation Keys

Every new piece of screen-reader-only text and aria-label needs a translation key. New keys to add:

| Key | English Text |
|-----|-------------|
| `candidate.a11y.skipToContent` | Skip to main content |
| `candidate.a11y.applicationSteps` | Application steps |
| `candidate.a11y.applicationForm` | Application form |
| `candidate.a11y.stepsMenu` | Application steps menu |
| `candidate.a11y.stepXofY` | Step {current} of {total}: {name} |
| `candidate.a11y.stepStatusComplete` | Complete |
| `candidate.a11y.stepStatusIncomplete` | Has errors |
| `candidate.a11y.stepStatusNotStarted` | Not started |
| `candidate.a11y.progressSaved` | Progress saved |
| `candidate.a11y.fieldsNeedAttention` | {count} fields need attention |
| `candidate.a11y.cannotContinue` | Cannot continue — {count} fields need attention |
| `candidate.a11y.goBackToStep` | Go back to Step {number}: {name} |
| `candidate.a11y.continueToStep` | Continue to Step {number}: {name} |
| `candidate.a11y.addAnotherAddress` | Add another address entry |
| `candidate.a11y.removeAddressN` | Remove address {number} |
| `candidate.a11y.addAnotherEducation` | Add another education entry |
| `candidate.a11y.removeEducationN` | Remove education entry {number} |
| `candidate.a11y.addAnotherEmployment` | Add another employment entry |
| `candidate.a11y.removeEmploymentN` | Remove employment entry {number} |
| `candidate.a11y.employmentGapPeriod` | Employment gap — {startDate} to {endDate} |
| `candidate.a11y.newFieldsAdded` | New required fields have been added |
| `candidate.a11y.requirementsUpdated` | Requirements have been updated based on your entries |
| `candidate.a11y.fixErrorsIn` | Go back to fix errors in {sectionName} |
| `candidate.a11y.completeBeforeSubmit` | Complete all required sections before submitting |
| `candidate.a11y.validationSummary` | Validation summary — {count} sections need attention |
| `candidate.a11y.startDateForEntry` | Start date for {entryType} {number} |
| `candidate.a11y.endDateForEntry` | End date for {entryType} {number} |
| `candidate.a11y.addressEntryN` | Address {number} |
| `candidate.a11y.educationEntryN` | Education entry {number} |
| `candidate.a11y.employmentEntryN` | Employment entry {number} |

---

## Order of Implementation

Since there are no database or API changes, the order focuses on building the shared pieces first, then applying them to each component:

1. **Accessibility constants file** (`a11y-constants.ts`) — the identifiers and IDs that everything else references
2. **TypeScript types** (`candidate-a11y.ts`) — type definitions for the new hooks and components
3. **Translation keys** — add all new keys to every language file
4. **Global CSS changes** — focus indicators, sr-only class, reduced-motion query, contrast fixes
5. **LiveAnnouncer component** — the announcement system that other components will use
6. **SkipLink component** — small and self-contained
7. **StepHeading component** — used by every step
8. **useFocusManagement hook** — focus management logic
9. **useKeyboardNavigation hook** — keyboard shortcut logic
10. **portal-layout.tsx modifications** — integrate SkipLink, LiveAnnouncer, useFocusManagement, useKeyboardNavigation, add ARIA landmarks and `id="main-content"`
11. **portal-sidebar.tsx modifications** — ARIA attributes, focus trapping in mobile drawer, aria-current, aria-expanded
12. **SectionProgressIndicator.tsx modifications** — sr-only status text, distinct icon shapes, aria-hidden on decorative icons
13. **WorkflowSectionRenderer.tsx modifications** — role="document", aria-label, tabIndex
14. **Next/Back button modifications** — descriptive aria-labels, validation announcements, focus-to-error behavior
15. **Address History section modifications** — fieldset/legend, contextual labels, add/remove focus management
16. **Education section modifications** — same pattern as Address History
17. **Employment section modifications** — same pattern, plus gap entry labeling
18. **PersonalInfoSection.tsx modifications** — field labels, aria-required, aria-invalid, aria-describedby, fieldset grouping, dynamic field announcements
19. **Record Search Requirements modifications** — field labels, recalculation announcements
20. **Review & Submit section modifications** — headings, role="alert", aria-disabled on Submit, descriptive jump links

---

## Risks and Considerations

### 1. Dynamic field rendering and screen reader announcements
The candidate application has fields that appear and disappear as the candidate fills in entries (subject-targeted fields in Personal Info, aggregated fields in Record Search Requirements). If announcements fire too aggressively during rapid navigation, it could overwhelm screen reader users. **Recommendation:** Debounce announcements by 500ms so rapid step changes don't produce a flood of spoken text.

### 2. WorkflowSectionRenderer uses `dangerouslySetInnerHTML`
The workflow section content is stored as raw HTML and rendered directly. We can wrap it in accessible containers, but we cannot control the accessibility of the HTML inside those sections (since it's authored by internal users in the admin tool). **Recommendation:** This is out of scope for Task 9.2 — document it as a known limitation. Future improvement: add an accessibility linter to the admin content editor.

### 3. Mobile drawer focus trapping
The mobile sidebar drawer currently opens and closes via state, but may not have focus trapping. Implementing proper focus trapping (so Tab doesn't escape the drawer) requires identifying all focusable elements inside the drawer and cycling between them. This is well-understood but needs careful testing on both iOS Safari and Android Chrome. **Recommendation:** Test on actual devices, not just browser developer tools' device emulation.

### 4. Existing component file sizes
Some candidate components may already be approaching the 500-line warning zone. The modifications in this task add code to many existing files. The implementer should check file sizes before starting and flag any files that would exceed 600 lines after modifications. If a file is already large, the accessibility additions might need to go into a separate helper file that the main component imports.

### 5. Focus management timing
Moving focus to a heading after step navigation requires the new step's content to be fully rendered in the browser first. If the component uses animations or loads data before rendering, the focus call might fire too early and target an element that doesn't exist yet. **Recommendation:** The `useFocusManagement` hook should accept an optional delay parameter and use `requestAnimationFrame` as a fallback to ensure the target element exists before focusing it.

### 6. Translation key volume
This task adds approximately 30 new translation keys. These must be added to ALL language files, not just English. The implementer should verify every key exists in every file before considering the translation step done.

### 7. No test infrastructure for accessibility
The project uses Jest and React Testing Library for testing. React Testing Library has built-in support for querying by ARIA role and label, which is helpful. However, automated accessibility testing (like checking color contrast or heading hierarchy) would benefit from integrating `jest-axe` (an accessibility testing library). **Recommendation for test writer:** Include `jest-axe` checks in component tests to catch regressions.

---

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the Phase 9 scope (WCAG 2.1 AA, keyboard navigation, ARIA labels, focus management, screen reader support across all 9 steps)
- [x] No database changes needed — confirmed
- [x] No API route changes needed — confirmed

---

## Ready for Test Writer

This plan is ready for the test writer (Pass 1) to proceed. The test writer should focus on:

1. **Accessibility-specific tests** using `jest-axe` to verify each modified component has no WCAG violations
2. **Keyboard navigation tests** verifying Tab order, Enter/Space activation, Escape to close drawer, and focus movement on step changes
3. **Screen reader text tests** verifying that `aria-label`, `aria-describedby`, `aria-current`, and sr-only text are present and correct
4. **Focus management tests** verifying that focus moves to the step heading after navigation, to the first error field after failed validation, and to the correct element after add/remove entry actions