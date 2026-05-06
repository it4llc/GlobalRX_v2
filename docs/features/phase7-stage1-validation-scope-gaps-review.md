# Phase 7 Stage 1: Validation Engine, Scope & Gap Checks, Error Display & Review Page

This document describes the candidate-portal additions delivered in Phase 7 Stage 1. The stage builds on the section progress infrastructure from Phase 6 Stage 4 and adds a complete client-driven validation layer: visit tracking, field-level error display, section-level error banners, scope validation, gap detection, and a Review & Submit page.

## Scope of This Stage

- Persists section visit/departure tracking across browser sessions.
- Persists a one-way `reviewPageVisitedAt` flag that, once set, permanently causes all sections to show their errors.
- Adds field-level red borders and below-field error messages for required fields that are empty and for optional fields with badly-formatted content — shown only after first visit-and-departure (or after the Review & Submit page is visited).
- Adds section-level error banners for scope shortfalls, timeline gaps, and document errors.
- Adds scope validation for Address History (record-type services), Education (verification-edu services), and Employment (verification-emp services) — count-based and time-based.
- Adds gap detection for Address History and Employment History, respecting the workflow's `gapToleranceDays` setting.
- Adds a Review & Submit page that lists all errors across all sections. Each error is tappable and navigates to the relevant section.
- Upgrades sidebar progress indicators to incorporate scope and gap results in addition to field completeness.
- Adds a new API endpoint: `POST /api/candidate/application/[token]/validate`.
- Extends three existing API endpoints: `/save`, `/saved-data`, and `/structure`.
- Refactors `GET /api/candidate/application/[token]/scope` to use the shared `packageScopeShape` module.
- Adds approximately 28 new translation keys to all five candidate-portal language files.

What this stage does **not** add: the actual submit action, order item creation, jurisdiction mapping, confirmation emails, order status changes, or comment history logging (deferred to Stage 2).

## New Modules: Validation Engine

All modules are pure (no I/O). Source files are in `src/lib/candidate/validation/`.

### `types.ts`

Shared TypeScript interfaces and constants for the entire validation engine: `FieldError`, `ScopeError`, `GapError`, `DocumentError`, `SectionValidationResult`, `ReviewError`, `ReviewPageSummary`, `FullValidationResult`, `ValidationStatus`, `FieldFormat`, `SavedEntry`, `FieldLike`, `EntryLike`, `DatedEntryLike`.

### `packageScopeShape.ts`

Single source of truth for the `package_services.scope` JSON column shape and the mapping from raw scope values to the normalized `NormalizedScopeType` strings (`count_exact`, `count_specific`, `time_based`, `highest_degree`, `highest_degree_inc_hs`, `all_degrees`, `all`). Exports `normalizeRawScope` and `pickMostDemandingScope`.

The `GET /api/candidate/application/[token]/scope` route was refactored to import from this module so the mapping cannot drift between the validation engine and the existing scope endpoint.

### `scopeValidation.ts`

Exports `evaluateCountScope` and `evaluateTimeBasedScope`. Both are pure functions that accept caller-supplied entry shapes and return a `ScopeError[]`. Coverage is calculated using the live current date passed in by the orchestrator — never a cached value. Overlapping date ranges are counted once.

### `gapDetection.ts`

Exports `detectGaps`. Accepts a list of `DatedEntryLike` entries, a `gapToleranceDays` value (null disables checking; 0 is strict; a positive integer N flags gaps strictly greater than N calendar days), a `today` date, and an optional `scopePeriodStart`. Returns a `GapError[]`. Gaps outside the scope period are ignored per spec Rule 24. Entries with no end date are treated as ending on `today` per spec Rule 23. The start-of-timeline check (spec Rule 26) verifies that the earliest entry covers `scopePeriodStart`.

Education History does not use this module — spec Rule 20.

### `fieldFormatValidation.ts`

Detects badly-formatted content in optional fields: email, phone, date, URL, and numeric. Returns a translation key matching the format type when a value fails validation. Empty optional fields are never flagged (spec Rule 5).

### `humanizeDuration.ts`

Converts a number of calendar days to a `{ years, months }` object for use in scope-error placeholder strings (e.g., "3 years, 4 months" in the time-based scope message).

### `dateExtractors.ts`

Extracts `{ start, end, isCurrent }` triples from saved repeatable entry field maps for Address History and Employment History. The Address History extractor reads from the address_block field's embedded `fromDate`/`toDate`/`isCurrent`; the Employment extractor reads named date field values using the shared `employmentDateFieldKeys` constants.

### `validateWorkflowSection.ts`

Returns a `SectionValidationResult` for workflow sections. A workflow section is complete if it is `acknowledged === true`. Field-level errors are not checked for workflow sections — the acknowledgment checkbox is the only requirement.

### `mergeSectionStatus.ts`

Merges a section's three possible status signals (local component-computed status, validation-engine status, and the initial status from the structure endpoint) into a single value for sidebar display. The merge rule: `incomplete` from either source wins; `complete` requires both sides to agree; `not_started` from local with `complete` from validation becomes `incomplete`; the server status is the tiebreaker.

### `validationEngine.ts`

The top-level orchestrator. Exports `runValidation(invitationId: string): Promise<FullValidationResult>`. Loads the candidate's saved data, the package scope configuration, workflow `gapToleranceDays`, and DSX requirement metadata from the database, then delegates to the pure helpers above and assembles the `FullValidationResult`. The live current date is captured once at the top of `runValidation` and threaded through all helpers. Results are never cached (spec Rule 35).

## New Helper: Section Visit Tracking

### `src/lib/candidate/sectionVisitTracking.ts`

Pure helpers for merging visit records into the `CandidateInvitation.formData` JSON column. Exports `mergeSectionVisits` and `mergeReviewPageVisitedAt`, plus the types `SectionVisitRecord`, `SectionVisitsMap`, and `IncomingVisitUpdate`.

`mergeSectionVisits` enforces the two immutability rules: `visitedAt` is only set on the first visit (never overwritten), and `departedAt`, once set to a non-null value, is never cleared back to null.

`mergeReviewPageVisitedAt` enforces the one-way rule: the flag is never cleared once set.

## New Hook: Portal Validation

### `src/lib/candidate/usePortalValidation.ts`

Client-side hook that owns the visit-tracking state and the `/validate` round-trip. Accepts `{ token, initialSectionVisits, initialReviewPageVisitedAt }`. Exposes:

- `validationResult` — the most recent `FullValidationResult` from the `/validate` endpoint, or `null` if no call has completed yet.
- `isErrorVisible(sectionId)` — returns `true` if the section has been visited-and-departed or if `reviewPageVisitedAt` is set, per spec Rules 4 and 34.
- `markSectionVisited(sectionId)` — records the first visit timestamp for the section and persists it via `section_visit_tracking` save.
- `markSectionDeparted(sectionId)` — records the departure timestamp, persists, and triggers a `/validate` call.
- `markReviewVisited()` — sets `reviewPageVisitedAt` (one-way), persists, and triggers a `/validate` call.
- `refreshValidation()` — triggers a `/validate` call without changing visit state; called after auto-save.

## New Shared Constant

### `src/components/candidate/form-engine/employmentDateFieldKeys.ts`

Exports the constant field keys used to identify date and current-employment fields within Employment History entries. Shared between `EmploymentSection.tsx` and `dateExtractors.ts` so the two modules use the same field names.

## New UI Components

All new components are client components. Source files are in `src/components/candidate/`.

### `SectionErrorBanner`

Location: `src/components/candidate/SectionErrorBanner.tsx`

Renders at the top of a section when there are scope errors, gap errors, or document errors. Light red background with a warning icon. Each error message is a separate line. Only rendered when errors are present (`scopeErrors`, `gapErrors`, or `documentErrors` arrays are non-empty). Disappears entirely when all errors are resolved. Hidden when `isErrorVisible` for the section is `false`.

### `FieldErrorMessage`

Location: `src/components/candidate/FieldErrorMessage.tsx`

Small red text rendered below a form field when validation has produced an error for that field. Accepts a `messageKey` and optional `placeholders` and renders the localized string via the translation context. Only rendered when passed a non-null error.

### `ReviewSubmitPage`

Location: `src/components/candidate/review-submit/ReviewSubmitPage.tsx`

The Review & Submit page. Groups all sections with their status and error lists. Each error is tappable and fires the caller-supplied `onNavigateToSection(sectionId)` callback. Green sections show a completion indicator. Red sections show their errors expanded. Grey sections show "Not yet started" with any scope requirement listed. Submit button is always disabled in this stage; static help text below it reads "Submit will be available once all sections are complete."

### `ReviewSectionBlock`

Location: `src/components/candidate/review-submit/ReviewSectionBlock.tsx`

A single section block within the Review & Submit page. Renders the section name, a status indicator, and the list of `ReviewError` items.

### `ReviewErrorListItem`

Location: `src/components/candidate/review-submit/ReviewErrorListItem.tsx`

A single tappable error line within a `ReviewSectionBlock`. Renders the localized error message and fires `onNavigate` when tapped. Meets the 44px minimum touch target requirement.

## Modified Components

### `portal-layout.tsx`

The main portal shell acquires `usePortalValidation`, wires `savedDataHydration` (extracted from the existing saved-data fetch effect), and threads visit-tracking callbacks to each section component. An additional `useEffect` marks the initially-active section as visited once hydration completes. Imports `ReviewSubmitPage` and renders it when the active section is `review_submit`. The `mergeSectionStatus` helper is used to combine local progress reports with the validation engine's results before writing to `sectionStatuses`.

### `portal-sidebar.tsx`

Renders the synthetic `review_submit` section entry at the bottom of the navigation list with a separator above it. All sections — including Review & Submit — go through the existing `SectionProgressIndicator`.

### `PersonalInfoSection.tsx`

Accepts new `fieldErrors` and `isErrorVisible` props. When `isErrorVisible` is true, renders `FieldErrorMessage` below each required field that is empty, and adds a red border class to that field.

### `IdvSection.tsx`

Accepts new `fieldErrors` and `isErrorVisible` props. Same error display wiring as PersonalInfoSection.

### `EmploymentSection.tsx`

Accepts new `fieldErrors` and `isErrorVisible` props. Imports `employmentDateFieldKeys` from the shared constants file. Same error display wiring pattern. Per-row inline error display inside repeatable entries is deferred (see TD-061).

### `WorkflowSectionRenderer.tsx`

Accepts `fieldErrors` and `isErrorVisible` props (passed through from the layout). No field-level errors are shown for workflow sections; acknowledgment status is the only check.

### `DynamicFieldRenderer.tsx`

Accepts an `hasError` boolean prop. When true, adds a red border CSS class to the rendered input or select element.

### `AddressHistorySection.tsx` and `EducationSection.tsx`

These components appear in the diff. They receive the error display props from the layout shell but per-row inline error display inside repeatable entries is deferred to a future pass when those files are refactored (see TD-061). The new props are forwarded through the component signatures.

## Modified API Endpoints

### POST /api/candidate/application/[token]/save

Added a fifth request shape dispatched when `sectionType === 'section_visit_tracking'`. This shape accepts an optional `sectionVisits` array (objects with `sectionId`, `visitedAt`, `departedAt`) and an optional `reviewPageVisitedAt` ISO timestamp. The handler reads the existing `formData`, merges the incoming visit data using the pure helpers from `sectionVisitTracking.ts`, and writes the result back. The four pre-existing save shapes are unchanged.

### GET /api/candidate/application/[token]/saved-data

The response now includes two sibling fields alongside the existing `sections` map:

```json
{
  "sections": { "..." },
  "sectionVisits": {
    "<sectionId>": { "visitedAt": "ISO", "departedAt": "ISO | null" }
  },
  "reviewPageVisitedAt": "ISO | null"
}
```

Both fields default to their empty state (`{}` and `null`) when no visit data has been saved yet.

### GET /api/candidate/application/[token]/structure

Each scoped section (Address History, Education, Employment) now carries an optional `scope` object:

```json
{
  "scope": {
    "scopeType": "time_based | count_exact | count_specific | ...",
    "scopeValue": "number | null",
    "scopeDescriptionKey": "string (translation key)",
    "scopeDescriptionPlaceholders": { "...": "..." }
  }
}
```

The scope is the most-demanding scope across all package services sharing the same functionality type, per spec Rule 19. Description is exposed as a translation key (not an English string) so the frontend can localize it.

The structure response also includes a synthetic `review_submit` section entry appended after all after-services workflow sections:

```json
{
  "id": "review_submit",
  "type": "review_submit",
  "title": "candidate.portal.sections.reviewSubmit",
  "placement": "after_services",
  "status": "not_started",
  "order": "<last>"
}
```

### GET /api/candidate/application/[token]/scope

Refactored to use `normalizeRawScope` from `packageScopeShape.ts`. The response shape and English `scopeDescription` strings are unchanged (backward-compatible).

## New API Endpoint

### POST /api/candidate/application/[token]/validate

Authentication: Valid `candidate_session` cookie with matching token.

Request body: none. The endpoint reads the candidate's saved data, package scope configuration, and workflow `gapToleranceDays` from the database.

Response (200):

```json
{
  "sections": [
    {
      "sectionId": "string",
      "status": "not_started | incomplete | complete",
      "fieldErrors": [{ "fieldName": "string", "messageKey": "string", "placeholders": {} }],
      "scopeErrors": [{ "messageKey": "string", "placeholders": {} }],
      "gapErrors": [{ "messageKey": "string", "placeholders": {}, "gapStart": "ISO", "gapEnd": "ISO", "gapDays": 0 }],
      "documentErrors": [{ "requirementId": "string", "documentNameKey": "string" }]
    }
  ],
  "summary": {
    "sections": [{ "sectionId": "string", "sectionName": "string", "status": "string", "errors": [] }],
    "allComplete": false,
    "totalErrors": 0
  }
}
```

Errors: `401` (no session), `403` (token mismatch), `404` (invitation not found), `410` (expired or completed), `500` (engine threw).

Results are never cached. The endpoint is designed to be callable from both the candidate-facing portal and (in Stage 2) from the server-side submit handler.

## Types Added

### `src/types/candidate-portal.ts`

- Added `CandidatePortalSectionScope` interface.
- Added `'review_submit'` to the `CandidatePortalSection.type` union.
- Added optional `scope?: CandidatePortalSectionScope` property to `CandidatePortalSection`.

## Translation Keys

Approximately 28 new keys were added to all five candidate-portal language files (`en-US`, `en-GB`, `es-ES`, `es`, `ja-JP`) under the following prefixes:

- `candidate.validation.field.*` — required-field and format-specific error messages.
- `candidate.validation.scope.*` — scope shortfall messages with placeholders for counts and durations.
- `candidate.validation.gap.*` — gap error messages with placeholders for dates and day counts.
- `candidate.validation.document.*` — document error messages.
- `candidate.validation.bannerLabel` — accessible banner label.
- `candidate.portal.sections.reviewSubmit` — sidebar label for Review & Submit.
- `candidate.reviewSubmit.*` — Review & Submit page strings including the disabled submit button help text.

## Database Schema

No schema changes in this stage. Visit tracking data and the `reviewPageVisitedAt` flag are stored as siblings of the existing `sections` map inside the `CandidateInvitation.formData` JSON column, which already existed.

## Known Limitations and Deferred Items

See TD-061 through TD-066 in `docs/TECH_DEBT.md`.
