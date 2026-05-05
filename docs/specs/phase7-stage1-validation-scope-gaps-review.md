# Phase 7, Stage 1 — Validation Engine, Scope & Gap Checks, Error Display & Review Page

**Status:** Confirmed
**Created:** May 5, 2026
**Confirmed:** May 5, 2026
**Phase:** 7 — Validation & Submission
**Stage:** 1 of 2
**Prerequisites:** Phase 6 (all 4 stages) complete, TD-059 and TD-060 resolved

---

## Overview

This stage adds the validation logic that tells candidates what's missing before they can submit, and gives them clear, actionable feedback about what needs to be fixed. It builds on the existing section progress indicators (grey/red/green) from Phase 6 Stage 4, adding scope validation, gap detection, field-level error messages, section-level error banners, and a Review & Submit page that shows all problems across the entire application in one place.

### What exists today (from Phase 6 Stage 4)

- Sidebar indicators show grey (not started), red (incomplete), or green (complete) for each section
- "Complete" currently means: all required fields have values
- Cross-section requirement awareness works (e.g., Address History making Middle Name required on Personal Info)
- Auto-save triggers progress recalculation on field blur
- Section visit tracking does NOT exist yet

### What this stage adds

- **Section visit tracking** — remember which sections the candidate has visited (and departed), persisted across sessions
- **Field-level error display** — red borders and field-specific messages on empty required fields and on optional fields containing badly formatted content (only shown after the candidate has visited and left the section)
- **Section-level error banners** — messages at the top of each section explaining bigger-picture problems like scope shortfalls and timeline gaps (only shown after the candidate has visited and left the section, or after the candidate has visited the Review & Submit page)
- **Scope validation** — checking that the candidate has the right number of entries (count-based) or that their entries cover the required time period (time-based)
- **Gap detection** — finding unexplained gaps in address history and employment timelines that exceed the workflow's gap tolerance
- **Review & Submit page** — a new page in the sidebar where the candidate sees all errors across all sections, with the ability to tap any error to navigate to it
- **Updated progress indicators** — the existing sidebar indicators now factor in scope and gap checks, not just field completeness

---

## Who Uses This

| Actor | What they do |
|---|---|
| Candidate (mobile or desktop) | Fills out sections, sees error feedback after visiting and leaving a section, uses the Review & Submit page to see all remaining issues |
| System | Tracks which sections have been visited and departed, runs validation on each section on demand, detects gaps in timelines, computes updated progress status |

---

## Scope — What's Included

1. Section visit tracking (persisted with auto-save data)
2. Field-level error messages on required fields (shown after first visit+departure)
3. Field-level format error messages on optional fields containing badly formatted content (shown after first visit+departure)
4. Section-level error banners (shown after first visit+departure)
5. Scope validation for count-based and time-based scopes
6. Gap detection for address history and employment timelines
7. Gap tolerance enforcement using the workflow's `gapToleranceDays` setting
8. Review & Submit page with navigable error list
9. Updated progress indicator logic incorporating scope and gap results
10. Submit button on the Review & Submit page (disabled — Stage 2 activates it)

## Scope — What's NOT Included

1. The actual submit action (Stage 2)
2. Order item creation / jurisdiction mapping (Stage 2)
3. Confirmation emails or notifications (Stage 2)
4. Order status changes (Stage 2)
5. Comment history logging (Stage 2)

---

## Business Rules

### Section Visit Tracking

**Rule 1:** The system tracks which sections the candidate has visited. A section counts as "visited and departed" when the candidate navigates away from the entire section via the sidebar (not when they first open it). Collapsing or expanding individual entries within a multi-entry section does NOT count as departing the section. This prevents showing errors on a section the candidate is still actively working on.

**Rule 2:** Visit-and-departure tracking is persisted alongside the candidate's auto-save data so it survives browser closes and return visits. The tracking data is keyed by section identifier. The "visited and departed" flag, once set, persists permanently for that section.

**Rule 3:** The Review & Submit page is NOT a tracked section in the same way as the data sections. It is a special page. However, the act of visiting the Review & Submit page has a permanent, one-way side effect: from that point forward, every section is treated as "visited and departed" for the purpose of error display. This flag never resets — once the candidate has been to the Review & Submit page, all sections show their errors from that point on.

### Field-Level Error Display

**Rule 4:** After a section has been visited and departed, any required field that is empty shows a red border and a message below it saying "This field is required." This is in addition to the existing red star indicator.

**Rule 5:** After a section has been visited and departed, any optional field that contains badly formatted content shows a red border and a format-specific message (for example, "Please enter a valid email address," "Please enter a valid phone number," "Please enter a valid date"). Empty optional fields never show errors. Format errors are a data-quality concern, not a required/optional concern.

**Rule 6:** Field-level errors appear immediately when the candidate returns to a previously visited section. They do not wait for another departure.

**Rule 7:** When the candidate fills in a required field, or fixes the format of an optional field, and tabs/clicks away (triggering auto-save), the error message and red border on that field disappear immediately.

### Section-Level Error Banners

**Rule 8:** After a section has been visited and departed, if there are scope or gap problems, a banner appears at the top of the section with a clear explanation. The banner uses a distinct visual style (light red/pink background with a warning icon) so it's clearly different from normal section content.

**Rule 9:** Section banners show specific, actionable messages. Examples:

- "2 education entries are required. You currently have 1."
- "7 entries required, 0 entered."
- "Your address history must cover the past 7 years. Your entries currently cover 3 years, 4 months."
- "There is a gap in your employment history from March 2023 to June 2023 (3 months). Gaps longer than 30 days must be accounted for."
- "2 required documents have not been uploaded."

**Rule 10:** A section can show multiple banner messages if it has multiple problems (e.g., not enough entries AND a gap in the timeline). Each message is a separate line item in the banner.

**Rule 11:** Banner messages update in real time as the candidate adds or removes entries, the same way progress indicators already update on auto-save. If a deletion or change pushes a previously-visited section into an invalid state, the banner appears immediately on the next auto-save without requiring re-departure. The "visited and departed" flag persists, so the section is always eligible to show errors once it has been departed once.

**Rule 12:** A multi-entry section that has been visited and departed but contains zero entries shows the scope banner with the appropriate "0 entered" wording, and the sidebar indicator turns red.

### Scope Validation

**Rule 13:** Scope is defined per service in the package via the `PackageService.scope` field (a JSON column on `package_services`). This field already exists and is read by Phase 6 code. **The implementer must research the existing scope JSON shape directly from the codebase and existing data before writing any code. This spec does not redefine the shape and does not guess at it.** The conceptual scope types the validation must support are:

| Scope Type | Example | Validation Rule |
|---|---|---|
| Count — exact | "Most recent" | Exactly 1 entry required |
| Count — specific | "Most recent 2" | Exactly 2 entries required |
| Time-based | "All in past 3 years" | Entries must cover the full time period with start/end dates |
| All | "All" | At least 1 entry required, no upper limit |

**Rule 14:** For time-based scopes, "today" is computed as the live current date at the moment validation runs. This is recomputed every time validation runs — there is no fixed reference point captured at application start. Coverage is calculated from today's date backward (e.g., "past 7 years" means from today back to 7 years ago). The candidate's entries must collectively cover this entire period — the dates don't need to be in order, but the combined date ranges must span the full period.

**Rule 15:** For time-based scopes, the coverage calculation counts the total time covered by the candidate's entries. If entries overlap, the overlapping time is only counted once. The banner message shows both the required period and the actual coverage (e.g., "Your entries currently cover 3 years, 4 months out of 7 years required").

**Rule 16:** For count-based scopes, the system simply counts the number of entries the candidate has created in that section. It does not matter whether the entries are fully filled in — an entry with empty fields still counts toward the total (the field-level validation handles the empty fields separately).

**Rule 17:** Scope validation applies to these section types:

| Section Type | Scope Source |
|---|---|
| Address History | Record-type services in the package (all share the same address scope) |
| Education History | Verification-edu services in the package |
| Employment History | Verification-emp services in the package |

**Rule 18:** IDV, Personal Information, and Workflow sections do not have scope validation. Their completeness is determined entirely by field-level requirements and (for workflow sections) the acknowledgment checkbox.

**Rule 19:** When multiple services of the same functionality type exist in the package (e.g., two different record-type services), they share one section and the scope is determined by the most demanding scope among them. For same-type scopes (e.g., both time-based), use the larger value (7 years beats 5 years). If the scopes are different types (e.g., one is count-based and one is time-based), always use the time-based (duration) scope since it is more comprehensive.

### Gap Detection

**Rule 20:** Gap detection applies to Address History and Employment History sections only. It does not apply to Education History (education entries don't need to be contiguous).

**Rule 21:** The workflow's `gapToleranceDays` setting determines how large a gap is acceptable. This single value applies equally to both address history and employment history. The semantics are:

- `null` — gap checking is disabled entirely. No gaps are flagged. This is the "I don't care" setting.
- `0` — zero tolerance. Any gap of any length is flagged. This is the "I want no gaps whatsoever" setting.
- Any positive integer (e.g., 30) — gaps strictly larger than this many calendar days are flagged; gaps of this length or less are ignored.

**Rule 22:** A gap is defined as a period of time between the end date of one entry and the start date of the next entry (when entries are sorted chronologically) that exceeds the gap tolerance. The calculation uses calendar days.

**Rule 23:** If an entry has no end date (i.e., "current address" or "current employment"), it is treated as ending on the live current date for gap detection purposes (matching the same "today" used for time-based scope coverage).

**Rule 24:** Gaps are only checked within the scope period. If the scope is "past 7 years" and there's a gap 8 years ago, it's ignored.

**Rule 25:** The gap detection message in the banner tells the candidate where the gap is and how long it is, but does NOT provide a button or shortcut to create an entry. The candidate uses the existing "Add Entry" button on their own.

**Rule 26:** For Address History, the gap check also verifies that entries cover the start of the scope period. If the scope requires 7 years of history and the candidate's earliest address starts only 5 years ago, that's flagged as a gap at the beginning of the timeline ("Your address history starts in May 2021, but must go back to May 2019").

### Progress Indicator Updates

**Rule 27:** The existing sidebar progress indicators are enhanced to incorporate scope and gap validation. The status logic becomes:

| Status | Condition |
|---|---|
| Grey (not started) | Section has never been visited AND has no saved data |
| Green (complete) | All required fields filled AND scope requirements met AND no gaps exceeding tolerance AND no format errors on optional fields |
| Red (incomplete) | Section has been visited and departed (or Review & Submit has been visited), AND any of: required fields empty, format errors on optional fields, scope not met, gaps detected |

**Rule 28:** A section that was previously green can turn red if conditions change. For example, if the candidate deletes an entry that was needed to meet scope, the section turns red on the next auto-save without requiring re-departure.

### Review & Submit Page

**Rule 29:** The Review & Submit page is a new page accessed from the bottom of the sidebar navigation, below all other sections. It shows a summary of every section's status and lists all errors across the entire application.

**Rule 30:** The Review & Submit page groups errors by section. Each section shows its name, its status indicator (grey/red/green), and the list of specific errors for that section. Sections with no errors show a green indicator and no error list.

**Rule 31:** Each error message on the Review & Submit page is tappable/clickable. Tapping it navigates the candidate to the relevant section and (where possible) scrolls to the specific field or area with the problem.

**Rule 32:** The Review & Submit page shows errors for ALL sections, even sections the candidate hasn't visited yet. This is the "show me everything" view.

**Rule 33:** The Review & Submit page includes a Submit button at the bottom. In this stage, the button is always disabled. Below the button, static help text explains why in functional language: "Submit will be available once all sections are complete." This wording is used regardless of whether the candidate has remaining errors. The candidate must NOT be told that submission is a future feature or "coming soon" — the framing is purely functional. (No tooltip is used because mobile has no hover.)

**Rule 34:** When the candidate visits the Review & Submit page and then navigates to any section, that section now shows its errors from that point on, even if the candidate has never visited or departed that section directly. This is the one-way effect described in Rule 3.

### Validation Computation

**Rule 35:** Validation results are always recomputed on demand. There is no caching of validation output. Auto-save makes data changes constant, so any cached validation result would risk being stale. Validation computation is intended to be lightweight enough that recomputation on every request is acceptable.

### Translation Keys

**Rule 36:** All user-facing error message strings introduced by this stage MUST be defined as translation keys with placeholders, not hard-coded English. This applies to:

- Banner text (scope shortfalls, gap warnings, document missing messages, "0 entered" wording)
- Field-level error messages ("This field is required," "Please enter a valid email address," etc.)
- Review & Submit page summary text
- Submit button help text

The translation keys must be added to all five candidate-portal language files: `en-US`, `en-GB`, `es-ES`, `es`, and `ja-JP`. Placeholders are used for variable values (counts, durations, dates, field names) so the translated strings can position those values appropriately for each language.

---

## Data Requirements

All `fieldKey` values listed below are camelCase identifiers and are immutable after creation. Status values are lowercase strings.

### Section Visit Tracking (persisted in auto-save data)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (not shown — internal) | sectionId | text | Required | Must match an existing section identifier from the structure endpoint | — |
| (not shown — internal) | visitedAt | date | Required | ISO 8601 date-time string | — |
| (not shown — internal) | departedAt | date | Optional | ISO 8601 date-time string; null until the candidate first leaves the section | null |

### Review & Submit Visit Flag (persisted in auto-save data)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (not shown — internal) | reviewPageVisitedAt | date | Optional | ISO 8601 date-time string; null until first visit; once set, never cleared | null |

### Validation Result Shape (computed, not persisted)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (not shown — internal) | sectionId | text | Required | Section identifier | — |
| (not shown — internal) | status | dropdown | Required | One of: `not_started`, `complete`, `incomplete` (lowercase) | `not_started` |
| (not shown — internal) | fieldErrors | array | Required | Each entry has `fieldName` (camelCase) and `messageKey` (translation key) | empty array |
| (not shown — internal) | scopeErrors | array | Required | Each entry has `messageKey` and placeholder values | empty array |
| (not shown — internal) | gapErrors | array | Required | Each entry has `messageKey`, `gapStart` (date), `gapEnd` (date), `gapDays` (number) | empty array |
| (not shown — internal) | documentErrors | array | Required | Each entry has `requirementId` and `documentNameKey` | empty array |

### Review Page Summary Shape (computed, not persisted)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Section list | sections | array | Required | One entry per section with `sectionId`, `sectionName`, `status`, `errors` | empty array |
| (not shown — internal) | allComplete | boolean | Required | True only if every section has status `complete` | false |
| (not shown — internal) | totalErrors | number | Required | Total count of all errors across all sections, integer >= 0 | 0 |

### Existing Inputs Read by This Stage (already persisted, not created here)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Gap Tolerance (Days) | gapToleranceDays | number | Optional | Non-negative integer or null; semantics defined in Rule 21 | null |
| Service Scope | scope | text (JSON) | Required | Existing JSON shape on `package_services`; implementer must research the shape from the codebase before use (see Rule 13) | — |

---

## API Changes

### Modified Endpoint: POST /api/candidate/application/\[token\]/save

**Change:** The save endpoint now also accepts and persists section visit tracking data (the `sectionId`, `visitedAt`, `departedAt` records) and the `reviewPageVisitedAt` flag alongside the existing form data. The visit tracking is stored in the same auto-save storage mechanism.

### New Endpoint: POST /api/candidate/application/\[token\]/validate

**Purpose:** Runs the full validation engine across all sections and returns the complete validation result.

**When called:** Whenever the frontend needs validation output — when the candidate navigates to the Review & Submit page, when individual sections need validation after departure, and on every auto-save (since results are not cached). The endpoint must be lightweight enough to support this access pattern.

**Request:** No body needed — the endpoint reads the candidate's saved data from the database.

**Response:** Returns the validation result shape described above — status and error lists for every section, plus the review-page summary shape.

**Authentication:** Same candidate session validation as all other candidate endpoints.

**Business logic:**
1. Load the candidate's saved data, the package scope configuration (from existing `PackageService.scope` JSON), and the workflow `gapToleranceDays` setting.
2. For each section, compute field completeness, optional-field format validation, scope validation, and gap detection.
3. Return the complete result set. Do not cache.

### Modified Endpoint: GET /api/candidate/application/\[token\]/structure

**Change:** The structure response now includes scope information for each section so the frontend can display scope requirements to the candidate (e.g., "Please enter your last 7 years of addresses"). The scope data comes from the `PackageService` records linked to the package and uses the existing JSON shape (no redefinition).

---

## UI Components

### Field-Level Error Display

- Red border on the input/select element
- Small red text below the field; message text is read from translation keys (Rule 36)
- Required field empty: shows the "field is required" translation key
- Optional field with bad-format content: shows the format-specific translation key (email, phone, date, etc.)
- Only appears after the section has been visited and departed, or after the Review & Submit page has been visited
- Disappears immediately when the field gets a valid value and auto-save triggers
- Must work on mobile (error text must be readable at mobile font sizes, must not be hidden behind the virtual keyboard)
- Touch targets remain at least 44px

### Section Error Banner

- Appears at the top of the section content area, below the section heading
- Light red/pink background with a warning icon
- Each error message is a separate line; all message text comes from translation keys with placeholders
- Scrollable if there are many messages (unlikely but handle gracefully)
- Mobile-first: full width, readable text, no horizontal scroll
- Disappears entirely when all scope/gap/document errors for the section are resolved

### Review & Submit Page

- Page accessed from the sidebar navigation, positioned last (after all workflow after-service sections)
- Shows all sections grouped with their status and errors
- Each error is tappable to navigate to the problem
- Green sections show a green indicator and "Complete" — no error list
- Red sections show the error list expanded
- Grey sections show "Not yet started" with any scope requirements listed
- Submit button at the bottom, disabled in this stage, with static help text below: "Submit will be available once all sections are complete." (no tooltip — mobile has no hover)
- Mobile-first: the error list must be easy to scroll and tap on a phone screen

### Mobile Navigation

- The Review & Submit page must be reachable using the existing Phase 6 mobile navigation pattern (likely a collapsible sidebar/drawer). Match what Phase 6 established — do not introduce a new mobile nav pattern in this stage.

---

## What the Candidate Sees — Step by Step

1. Candidate opens the application and starts filling in sections as before. No error messages appear while they're working.
2. Candidate finishes working on Education History and taps on Employment History in the sidebar. Education History is now marked as "visited and departed."
3. If Education History has problems (missing fields, not enough entries, format errors on optional fields), the sidebar indicator turns red. If the candidate goes back to Education History, they see the red field borders and the scope banner.
4. Candidate works through all sections at their own pace. As they visit and leave each section, errors become visible for that section.
5. When the candidate feels done, they tap "Review & Submit" in the sidebar.
6. The Review & Submit page shows every section with its status. Any remaining problems are listed with clear descriptions. The candidate taps on an error and is taken directly to the section that needs attention. From this moment on, every section will show its errors when visited (the one-way effect from Rule 3 / Rule 34).
7. After fixing all problems, the Review & Submit page shows all green indicators. The Submit button is visible but disabled, with the help text "Submit will be available once all sections are complete." (Stage 2 will enable the button.)

---

## Edge Cases and Error Scenarios

1. **Multi-entry section with zero entries after visit-and-depart.** The candidate opens an Address History section, doesn't add any entries, and navigates away. The sidebar indicator turns red and the banner reads "X entries required, 0 entered" using the live scope requirement.

2. **Overlapping date ranges.** Two address entries with overlapping date ranges are valid input. The coverage calculation counts the overlapping time only once (Rule 15). No error is raised purely for the overlap.

3. **Gap tolerance set to null.** No gap detection runs at all. The section can have arbitrary gaps and no gap errors will appear. Scope validation still runs.

4. **Gap tolerance set to 0.** Any gap, even one of a single day, is flagged. Strict mode.

5. **Future end dates.** If a candidate enters an end date that is in the future (after the live current date), the validator must still treat the entry coherently. (Implementer should confirm whether future end dates are blocked at field validation time. If not blocked, the gap calculation should still terminate properly using whichever is later: the live current date or the latest entry.)

6. **Entry with no start date.** A required start date that is missing is a field-level error. The entry is not usable for coverage or gap calculations until the start date is filled in.

7. **Entry with no end date.** Treated as ending on the live current date for both coverage and gap calculations (Rule 23).

8. **Candidate visits Review & Submit, then leaves and returns later.** The `reviewPageVisitedAt` flag persists. All sections continue to show their errors from that point on. The flag never resets (Rule 3).

9. **Candidate deletes an entry that was needed to meet scope.** On the next auto-save, the banner appears immediately even though the candidate has not departed the section again (Rule 11). Sidebar indicator turns red.

10. **Multiple services of mixed scope types in one section.** Per Rule 19, time-based wins over count-based; among same-type scopes, the larger / more demanding wins.

11. **Scope JSON shape unexpected.** If the implementer encounters scope JSON that does not match the existing reading code in Phase 6, they must stop and flag it before proceeding. This spec does not define the shape.

12. **Network failure during /validate call.** The frontend should fail gracefully and not block navigation. Candidate retains the last known validation state until the next successful call.

13. **Candidate lacks an active session.** Validation endpoint returns 401 (matching existing candidate-endpoint behavior). No validation result is leaked to unauthenticated requests.

14. **Education History gap.** Education entries do not trigger gap detection at all (Rule 20). A 5-year gap between high school and university is fine.

15. **Address scope requires 7 years but earliest entry is only 5 years old.** This is flagged as a gap at the beginning of the timeline using the wording from Rule 26.

16. **Optional field with bad-format content but section never visited.** No error shown until the section has been visited and departed (or until Review & Submit has been visited).

17. **Required field empty AND scope shortfall in the same section.** Both errors are shown — field-level red borders on the empty fields AND the scope banner at the top. The Review & Submit page lists both under that section.

---

## Impact on Other Modules

This stage touches but does not fundamentally change the following existing surfaces:

1. **Sidebar progress indicators.** The status computation is extended (not replaced) to factor in scope, gaps, and optional-field format errors. The grey/red/green color scheme and indicator placement remain identical.

2. **Auto-save flow.** The existing auto-save mechanism is extended to persist section visit/departure tracking and the `reviewPageVisitedAt` flag. The auto-save storage location and trigger conditions are unchanged.

3. **Section registry / structure endpoint.** The structure endpoint (`GET /api/candidate/application/[token]/structure`) is extended to include scope information per section. The existing section ordering and metadata are unchanged.

4. **Field-level required indicators.** The existing red star indicator continues to display as before. The new red border + below-field message is additive.

5. **Mobile navigation.** Match the existing Phase 6 mobile navigation pattern. No new mobile nav layer is introduced.

6. **Phase 6 scope-reading code.** Reuse the existing code that reads `PackageService.scope`. Do not create a parallel reader.

7. **Translation infrastructure.** All five candidate-portal language files (`en-US`, `en-GB`, `es-ES`, `es`, `ja-JP`) gain new keys for this stage's error messages. No translation infrastructure changes.

8. **Stage 2 (submission).** Stage 2 will call the same `/validate` endpoint server-side before processing the submission. The validation service must therefore be a standalone module callable from both the candidate-facing flow and the server-side submit handler.

---

## Definition of Done

1. Section visit-and-departure tracking is persisted and survives browser close/reopen
2. The `reviewPageVisitedAt` flag is persisted and survives browser close/reopen, and is one-way (never cleared)
3. Required field errors (red border + message) appear after section departure, not before
4. Optional-field format errors (red border + format-specific message) appear after section departure on optional fields containing bad-format content
5. Empty optional fields never show errors
6. Field-level errors disappear immediately when the field is filled (or fixed) and auto-saved
7. Section error banners appear after section departure with specific, accurate messages
8. Multi-entry sections with zero entries after departure show the "0 entered" banner and turn red
9. Count-based scope validation works correctly for "most recent," "most recent N," and "all" scopes
10. Time-based scope validation correctly calculates coverage period using the live current date
11. Gap detection correctly identifies gaps in address history timelines
12. Gap detection correctly identifies gaps in employment history timelines
13. `gapToleranceDays = null` disables gap detection entirely; `0` enforces zero tolerance; positive integers enforce strict-greater-than tolerance
14. Gap detection ignores gaps outside the scope period
15. "Current" entries (no end date) are treated as ending on the live current date
16. Multiple services of the same type use the most demanding scope; mixed types defer to time-based
17. Progress indicators in the sidebar reflect scope, gap validation, and optional-field format errors, not just field completeness
18. Banner and indicator update on the next auto-save when a deletion pushes a previously-visited section back to invalid, without requiring re-departure
19. Review & Submit page shows all sections with accurate status and error lists
20. Error messages on the Review & Submit page are tappable and navigate to the correct section
21. Review & Submit page shows errors for all sections regardless of visit status
22. Submit button appears on Review & Submit page but is disabled, with static help text "Submit will be available once all sections are complete." below it
23. Visiting Review & Submit triggers error display for all sections on subsequent navigation, permanently
24. All error messages are specific and actionable (show numbers, dates, and periods) and come from translation keys with placeholders
25. Translation keys for all new error messages are added to `en-US`, `en-GB`, `es-ES`, `es`, and `ja-JP`
26. Validation results are always recomputed on demand — no caching
27. The validation engine is implemented as a standalone service callable from both candidate-facing routes and (later) the Stage 2 submit handler
28. All UI components are mobile-first (44px touch targets, readable text, no horizontal scroll)
29. Mobile navigation to the Review & Submit page matches the existing Phase 6 mobile navigation pattern
30. All new functionality works on mobile browsers (Safari, Chrome on iOS and Android)
31. All new tests pass, no regressions in existing tests
32. Education History does NOT have gap detection (only scope validation)
33. All status values written by this stage are lowercase strings (`not_started`, `complete`, `incomplete`)

---

## Open Questions

1. **PackageService.scope JSON shape.** This spec deliberately does not define the JSON shape of the `scope` field on `package_services`. The implementer must research the existing shape directly from the codebase (the column exists today and Phase 6 already reads/uses it) before any code is written. Do not guess. Do not redefine. If the existing shape does not cleanly support one of the scope types described in Rule 13, stop and flag it before proceeding.

## Resolved Questions

2. **Mixed scope types across services in the same section.** If one service has a count-based scope and another has a time-based (duration) scope for the same section, use the time-based scope. Duration scopes are more comprehensive than count-based scopes. *(Resolved May 5, 2026)*

3. **Gap tolerance for address vs. employment.** The workflow's single `gapToleranceDays` value applies equally to both address history and employment history gap detection. No separate tolerance per section type. *(Resolved May 5, 2026)*

4. **`gapToleranceDays` semantics.** `null` disables gap checking entirely. `0` means zero tolerance (any gap is flagged). A positive integer N means gaps strictly greater than N calendar days are flagged. *(Resolved May 5, 2026)*

5. **"Today" for time-based scope and gap calculations.** The live current date at the moment validation runs. Recomputed every time. *(Resolved May 5, 2026)*

6. **Review & Submit page status as a tracked section.** It is NOT a tracked section. Visiting it has a permanent, one-way side effect: from that point on, every section is treated as "visited and departed" for error-display purposes. The flag never resets. *(Resolved May 5, 2026)*

7. **Format errors on optional fields with content.** Shown in this stage. Empty optional fields never show errors; optional fields with bad-format content show red borders and format-specific messages. *(Resolved May 5, 2026)*

8. **Departing multi-entry sections.** Departure means navigating away from the entire section via the sidebar. Collapsing/expanding individual entries within a section does NOT count as departing. *(Resolved May 5, 2026)*

9. **Banner update after deletion.** If deletion pushes a previously-visited section into an invalid state, the banner appears immediately on the next auto-save without requiring re-departure. The "visited" flag persists. *(Resolved May 5, 2026)*

10. **Disabled Submit button affordance.** Static help text below the button reading "Submit will be available once all sections are complete." No tooltip (mobile has no hover). The candidate must NOT be told this is a Stage 2 limitation — wording is purely functional. *(Resolved May 5, 2026)*

11. **Validation result caching.** Always recomputed on demand. No caching. *(Resolved May 5, 2026)*

12. **Translation keys.** All new error message strings use translation keys with placeholders, and are added to `en-US`, `en-GB`, `es-ES`, `es`, and `ja-JP`. *(Resolved May 5, 2026)*

13. **Mobile navigation pattern.** Match the existing Phase 6 mobile navigation pattern (likely a collapsible sidebar/drawer). Do not introduce a new pattern. *(Resolved May 5, 2026)*

---

## Notes for the Development Pipeline

- Branch name: `feature/phase7-stage1-validation-scope-gaps-review`
- This stage modifies existing components (section components, sidebar, portal layout) and adds new ones (Review & Submit page, error banner, validation service)
- The validation logic should be a standalone service file, not embedded in components, so Stage 2 can call the same validation before processing the submission
- The existing progress computation logic (computePersonalInfoStatus, etc.) needs to be extended, not replaced — scope, gap, and optional-field format checks are additive
- Gap detection and scope validation are pure logic with no side effects — they're highly testable in isolation
- Validation must be lightweight enough to recompute on every demand without caching
- The implementer's first step must be to read the existing `PackageService.scope` JSON shape from the codebase before writing any new logic against it
