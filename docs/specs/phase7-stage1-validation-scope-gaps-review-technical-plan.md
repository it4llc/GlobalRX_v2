# Technical Plan: Phase 7, Stage 1 — Validation Engine, Scope & Gap Checks, Error Display & Review Page

**Based on specification:** `docs/specs/phase7-stage1-validation-scope-gaps-review.md` (Confirmed May 5, 2026)
**Date:** May 5, 2026
**Phase:** 7 — Validation & Submission
**Stage:** 1 of 2
**Branch:** `feature/phase7-stage1-validation-scope-gaps-review`

---

## 0. Pre-flight Findings (research the implementer must accept before writing code)

These are facts confirmed by reading the codebase. The implementer MUST verify each one before starting work and stop if any of them turn out wrong.

### 0.1 PackageService.scope JSON shape — already in production use

The `scope` column on `package_services` is a Prisma `Json?` field (`prisma/schema.prisma` line 251). It is read today by `src/app/api/candidate/application/[token]/scope/route.ts` (the Phase 6 scope endpoint). The shapes Phase 6 already understands — and which Stage 1 must use without redefinition — are:

| `scope.type` value | Other keys | Meaning |
|---|---|---|
| `"current-address"` | none | Record only — exactly the candidate's current address |
| `"last-x-addresses"` | `quantity: number` | Record only — exactly N addresses |
| `"most-recent"` | none | Education/Employment/Record — exactly 1 entry |
| `"most-recent-x"` | `quantity: number` | Education/Employment/Record — exactly N entries |
| `"past-x-years"` | `years: number` | Time-based coverage of the past N years |
| `"highest-degree"` | none | Education only — single highest degree post-HS |
| `"highest-degree-inc-highschool"` | none | Education only — single highest degree including HS |
| `"all-degrees"` | none | Education only — all degrees post-HS |
| `null` (no scope set) | n/a | Record default → "current-address"; everything else → "all" |

The scope endpoint maps each of these to a normalized `scopeType` already (`count_exact`, `count_specific`, `time_based`, `highest_degree`, `highest_degree_inc_hs`, `all_degrees`, `all`). The validation engine MUST reuse this same source of truth. It must NOT introduce a third interpretation of the JSON shape.

The Stage 1 spec's Rule 13 conceptual table maps to the scope endpoint's normalized values like this:

| Spec conceptual scope | Existing normalized `scopeType` |
|---|---|
| Count — exact | `count_exact` (covers `most-recent`, `current-address`, `highest-degree`, `highest-degree-inc-highschool`) |
| Count — specific | `count_specific` (covers `most-recent-x`, `last-x-addresses`) |
| Time-based | `time_based` (covers `past-x-years`) |
| All | `all` (covers `null` for non-record + `all-degrees`) |

**Open Question 1 in the spec resolves cleanly.** No "scope JSON shape unexpected" stop is needed. The implementer must, however, read `scope/route.ts` to confirm this map is still current at the time of implementation.

### 0.2 Status string values already match spec — no reconciliation needed

The spec's Definition of Done #33 requires lowercase strings: `not_started`, `complete`, `incomplete`. Phase 6 Stage 4 already uses exactly these values:

- `src/types/candidate-stage4.ts` line 15: `export type SectionStatus = 'not_started' | 'incomplete' | 'complete';`
- `src/lib/candidate/sectionProgress.ts` lines 119, 170, 175, 219, 253: pure helpers return only these three values
- `src/types/candidate-portal.ts` line 25: `CandidatePortalSection.status: 'not_started' | 'incomplete' | 'complete'`
- `src/app/api/candidate/application/[token]/structure/route.ts` line 138: structure endpoint emits `'not_started'` literally

**Andy's non-blocker observation: verify-before-coding step.** The implementer's first action after reading this plan must be to grep the codebase for the four legacy alternates and confirm none are present in candidate-portal code: `notStarted`, `in_progress`, `inProgress`, `done`. If any are found inside the Phase 7 surface, stop and report. If they are only in legacy code unrelated to candidate progress (e.g., order status, invitation status), proceed. Phase 7 must not introduce any new value spelling.

### 0.3 No new database columns required

The spec calls visit tracking and `reviewPageVisitedAt` "persisted in auto-save data" (lines 202, 210, 248). Auto-save data lives in `CandidateInvitation.formData` (Json column added by `prisma/migrations/20260430211542_add_candidate_form_data/migration.sql`). Both new fields fit inside that JSON, so **no Prisma schema change and no migration are needed**. See Section 1 below for details.

The user's prompt phrasing implied a column add. After reading the spec carefully (lines 202–214) and matching it against the existing `formData` storage mechanism, the correct interpretation is JSON-only storage. If the implementer believes a column add is needed despite this, stop and check with Andy before editing the schema.

### 0.4 Date storage is asymmetric across sections — validation engine must handle both shapes

The validation engine's gap-detection and time-based-coverage logic must read entry start/end dates. The shapes differ by section:

- **Address History entries:** dates live INSIDE the `address_block` field's JSON value as `fromDate`, `toDate`, and `isCurrent`. See `src/components/candidate/form-engine/AddressBlockInput.tsx` lines 491–547.
- **Employment History entries:** dates live as separate fields in the entry's `fields` array, keyed by camelCase fieldKeys like `startDate`/`endDate` and a `currentlyEmployed`/`isCurrent` boolean. The set of accepted fieldKey aliases is enumerated in `src/components/candidate/form-engine/EmploymentSection.tsx` lines 405–423 (`CURRENTLY_EMPLOYED_FIELD_KEYS` and `END_DATE_FIELD_KEYS`).
- **Education entries:** outside the scope of gap detection per Rule 20.

The validation engine must support **both** date-extraction paths. The implementer must reuse the same fieldKey alias sets that EmploymentSection.tsx uses (or move them to a shared module — see file plan in Section 4) so the engine and the UI stay in lockstep.

### 0.5 The save route is at 580 lines

`src/app/api/candidate/application/[token]/save/route.ts` is currently 580 lines. The 500/600 file-size triggers in Coding Standards Section 9 mean adding the visit-tracking save shape to this route should be done with care: a single new accepted `sectionType` ("section_visit_tracking") is acceptable; a large new schema with branching logic is not. See Section 5.1 for the recommended split.

---

## 1. Database Changes

**No changes to `prisma/schema.prisma`. No new migration directory. No SQL.**

Visit tracking and the Review-page visit flag are persisted inside the existing `CandidateInvitation.formData` JSON column under two new top-level keys (siblings of the existing `sections` key):

```jsonc
{
  "sections": { /* existing per-section saved data — unchanged */ },
  "sectionVisits": {
    "personal_info":   { "visitedAt": "2026-05-05T18:21:09.331Z", "departedAt": "2026-05-05T18:23:11.872Z" },
    "address_history": { "visitedAt": "2026-05-05T18:23:11.872Z", "departedAt": null },
    "service_verification-edu": { "visitedAt": "...", "departedAt": "..." }
  },
  "reviewPageVisitedAt": "2026-05-05T18:45:00.000Z"
}
```

- Section identifiers used as keys MUST match the IDs the structure endpoint already emits (`personal_info`, `address_history`, `service_<funcType>`, `<workflow_section.id>`). They are the same identifiers the existing save route already uses for `sections` keys.
- `visitedAt` is set on first navigation TO the section.
- `departedAt` is set on navigation AWAY from the section (to a different section or to Review & Submit). Once non-null, future visits do NOT clear it — the spec requires the "visited and departed" flag to persist permanently (Rule 2).
- `reviewPageVisitedAt` is set the first time the candidate clicks Review & Submit. Once set, never cleared (Rule 3).
- The `formData` JSONB column already has a GIN index — no additional index needed.

If the implementer encounters a project requirement that forces these two new top-level keys to live in dedicated columns instead of inside JSON, stop and consult Andy. Do not invent a migration without approval.

---

## 2. Standalone Validation Service (the heart of Stage 1)

The validation engine is implemented as a pure server-side service module (callable from API routes, callable from Stage 2's submit handler). All functions are pure: they take typed input, return typed output, and have no I/O.

### 2.1 New file: `src/lib/candidate/validation/types.ts`

**Status:** new
**Responsibility:** TypeScript types and constants for the validation engine. Imported by every other validation file plus the new API route plus the Review & Submit page.
**Depends on:** `@/types/candidate-stage4` (for `SectionStatus`).

Exports:

```typescript
type ValidationStatus = SectionStatus;          // re-exported alias for clarity

interface FieldError       { fieldName: string; messageKey: string; placeholders?: Record<string, string | number>; }
interface ScopeError       { messageKey: string; placeholders: Record<string, string | number>; }
interface GapError         { messageKey: string; placeholders: Record<string, string | number>; gapStart: string; gapEnd: string; gapDays: number; }
interface DocumentError    { requirementId: string; documentNameKey: string; }

interface SectionValidationResult {
  sectionId: string;
  status: ValidationStatus;       // 'not_started' | 'incomplete' | 'complete'
  fieldErrors: FieldError[];
  scopeErrors: ScopeError[];
  gapErrors: GapError[];
  documentErrors: DocumentError[];
}

interface ReviewPageSummary {
  sections: Array<{ sectionId: string; sectionName: string; status: ValidationStatus; errors: ReviewError[] }>;
  allComplete: boolean;
  totalErrors: number;
}

// ReviewError is a discriminated union over field/scope/gap/document, used purely
// by the Review page to render one navigable line per error.
type ReviewError =
  | { kind: 'field';    fieldName: string; messageKey: string; placeholders?: Record<string, string | number> }
  | { kind: 'scope';    messageKey: string; placeholders: Record<string, string | number> }
  | { kind: 'gap';      messageKey: string; placeholders: Record<string, string | number>; gapStart: string; gapEnd: string }
  | { kind: 'document'; requirementId: string; documentNameKey: string };

interface FullValidationResult {
  sections: SectionValidationResult[];
  summary: ReviewPageSummary;
}

// Format-validator contract for optional fields with content (Rule 5)
type FieldFormat = 'email' | 'phone' | 'date' | 'url' | 'numeric';
```

### 2.2 New file: `src/lib/candidate/validation/scopeValidation.ts`

**Status:** new
**Responsibility:** scope validation — count-based and time-based. Uses the existing scope-shape map (Section 0.1).
**Depends on:** `./types`.

Exports:

```typescript
// Reuses the normalized scopeType strings emitted by /scope/route.ts.
// resolveScopeForSection collapses multiple PackageService.scope values for the
// same section per Rule 19 (time-based wins over count-based; among same-type,
// the larger scope wins).
function resolveScopeForSection(packageServices: PackageServiceScopeInput[]): ResolvedScope | null;

function evaluateCountScope(scope: ResolvedScope, entries: EntryLike[]): ScopeError[];
function evaluateTimeBasedScope(scope: ResolvedScope, entries: DatedEntryLike[], today: Date): { errors: ScopeError[]; coveredDays: number; requiredDays: number };
```

Notes:
- "Today" is taken as a `Date` parameter so callers can pass `new Date()` per Rule 14 — keeps the function pure and testable.
- The function MUST reuse the shape-mapping logic from `scope/route.ts`. Recommended approach: extract that mapping into a small shared helper inside `src/lib/candidate/validation/packageScopeShape.ts` (see Section 2.6) and have BOTH `scope/route.ts` and the new `scopeValidation.ts` import it. This avoids a second interpretation of the JSON shape.
- For time-based coverage, merge overlapping date ranges into a flat union of intervals before counting days. Cap end-of-range at "today" if the entry's end date is null (current entry, Rule 23) or in the future (Edge Case 5).
- Coverage measurement is in calendar days; banner messages convert to "X years, Y months" via a helper in `humanizeDuration.ts` (Section 2.5).

### 2.3 New file: `src/lib/candidate/validation/gapDetection.ts`

**Status:** new
**Responsibility:** gap detection for Address History and Employment History (Rules 20–26).
**Depends on:** `./types`, `./packageScopeShape`.

Exports:

```typescript
function detectGaps(
  entries: DatedEntryLike[],          // already extracted to a uniform shape
  gapToleranceDays: number | null,    // null → disabled; 0 → strict; >0 → strictly-greater-than tolerance
  today: Date,
  scopePeriodStart: Date | null       // null when scope is not time-based — Rule 24
): GapError[];
```

Notes:
- `null` gapToleranceDays returns an empty array immediately (Rule 21).
- Sort entries chronologically by start date before comparing.
- For each consecutive pair, compute calendar days between previous end and next start. Flag if `> gapToleranceDays` (Rule 21 strict-greater-than for positive integers; `>0` flags every gap when tolerance is `0`).
- Treat `null`/missing end as "today" (Rule 23).
- Skip pairs whose gap falls entirely outside `[scopePeriodStart, today]` per Rule 24.
- If `scopePeriodStart` is provided AND the earliest entry starts after `scopePeriodStart`, emit a "starts-too-recently" gap error using the Rule 26 wording (Address History).
- Gap output never has buttons or shortcuts (Rule 25) — that is a UI concern.

### 2.4 New file: `src/lib/candidate/validation/fieldFormatValidation.ts`

**Status:** new
**Responsibility:** detect bad-format content in optional fields (Rule 5). No checks on empty optional fields.
**Depends on:** `./types`.

Exports:

```typescript
function inferFieldFormat(field: { fieldKey: string; type?: string; fieldData?: { format?: string } | null }): FieldFormat | null;
function validateFieldFormat(format: FieldFormat, value: unknown): boolean;
function buildFormatErrorKey(format: FieldFormat): string;  // returns translation key, e.g. 'candidate.validation.format.email'
```

Notes:
- Format detection is conservative: only emit a format inference when the field's `type` or `fieldData.format` clearly indicates one of `email | phone | date | url | numeric`. Anything else → return `null` (no format check possible).
- Validators are simple regex/Zod-equivalent checks. Reuse the same Zod patterns the API standards already prefer (`z.string().email()` style); since we cannot import Zod for non-throwing checks, inline lightweight regexes are acceptable here. If the codebase already has email/phone helpers in `src/lib/utils/`, the implementer must use those instead — a quick grep at implementation time will tell.

### 2.5 New file: `src/lib/candidate/validation/humanizeDuration.ts`

**Status:** new
**Responsibility:** convert numbers of days into translation-ready placeholder values (e.g., `{ years: 3, months: 4, days: 0 }`).
**Depends on:** none.

Exports:

```typescript
function daysToHumanParts(days: number): { years: number; months: number; days: number };
```

Notes:
- The output is plain numbers — the translation layer formats them. We do NOT compose human-readable strings here, only the placeholder values.

### 2.6 New file: `src/lib/candidate/validation/packageScopeShape.ts`

**Status:** new
**Responsibility:** ONE definition of the `PackageService.scope` JSON shape and its mapping to normalized scope types (Section 0.1). Imported by both the validation engine and the existing scope endpoint.
**Depends on:** none.

Exports:

```typescript
interface RawPackageServiceScope { type?: string; quantity?: number; years?: number; }
type NormalizedScopeType = 'count_exact' | 'count_specific' | 'time_based' | 'highest_degree' | 'highest_degree_inc_hs' | 'all_degrees' | 'all';
interface ResolvedScope { scopeType: NormalizedScopeType; scopeValue: number | null; }

function normalizeRawScope(raw: RawPackageServiceScope | null, functionalityType: 'verification-edu' | 'verification-emp' | 'record'): ResolvedScope;
function pickMostDemandingScope(scopes: ResolvedScope[]): ResolvedScope;  // Rule 19
```

The implementer must update `scope/route.ts` to call `normalizeRawScope` instead of duplicating the mapping inline. This is a small, surgical refactor. See Section 5.2.

### 2.7 New file: `src/lib/candidate/validation/dateExtractors.ts`

**Status:** new
**Responsibility:** extract `{ start: Date, end: Date | null }` from an Address History entry (dates inside `address_block.value`) or an Employment entry (dates as separate fields). One function per shape.
**Depends on:** `./types`.

Exports:

```typescript
function extractAddressEntryDates(entry: SavedEntry, addressBlockRequirementId: string): { start: Date | null; end: Date | null; isCurrent: boolean };
function extractEmploymentEntryDates(entry: SavedEntry, fieldsByCountry: Record<string, FieldLike[]>): { start: Date | null; end: Date | null; isCurrent: boolean };
```

Notes:
- Reuses the same `END_DATE_FIELD_KEYS` and `CURRENTLY_EMPLOYED_FIELD_KEYS` constants from `EmploymentSection.tsx`. The implementer should move those constants into a new file `src/components/candidate/form-engine/employmentDateFieldKeys.ts` (see Section 5.3) and import from both EmploymentSection.tsx and the new dateExtractors module. This is a small refactor that keeps the alias list single-sourced.

### 2.8 New file: `src/lib/candidate/validation/validationEngine.ts`

**Status:** new
**Responsibility:** the top-level `runValidation()` function. Loads the candidate's saved data, the package scope, and the workflow's `gapToleranceDays`, then delegates per-section to the helpers above and assembles `FullValidationResult`.
**Depends on:** all other files in `src/lib/candidate/validation/`, plus `@/lib/prisma`, plus `@/lib/candidate/sectionProgress` (for the existing field-completeness logic — Phase 7 is additive, not replacement).

Exports:

```typescript
async function runValidation(invitationId: string): Promise<FullValidationResult>;
```

Notes:
- Status computation:
  - `not_started` only when the section has never been visited AND has no saved data. Visit data is read from `formData.sectionVisits`. Saved data is read from `formData.sections`.
  - `complete` when all field/scope/gap/document checks pass.
  - `incomplete` otherwise (and the section has been visited & departed OR Review & Submit has been visited).
- Errors are produced regardless of visit state — the API returns them all. The UI decides what to display based on visit state (Rules 4, 8, 32).
- For Personal Info, IDV, and workflow sections (Rule 18), no scope/gap checks run — only field completeness (and document checks for workflow sections that are document-type per Phase 6 Stage 4).
- For Address History / Education / Employment, scope+gap+field checks all run.
- "Today" is `new Date()` at the moment `runValidation` is called (Rule 14 + Rule 35).
- The function never caches — every call re-reads from the database.

---

## 3. API Routes

### 3.1 New route: `POST /api/candidate/application/[token]/validate`

**File path:** `src/app/api/candidate/application/[token]/validate/route.ts`
**Status:** new
**Auth:** Candidate session (matches `structure`, `save`, `saved-data`, `scope`).
**Validation order:** 401 → 403 → 404 → 410 → 200.
**Body:** none. The endpoint reads the candidate's saved data from the database (spec line 257).
**Response (200):** `FullValidationResult` shape from Section 2.1.
**Errors:**
- 401: no session
- 403: token mismatch
- 404: invitation not found
- 410: invitation expired or completed (matches the rest of the candidate routes — Edge Case 13 in the spec mentions 401 for "no active session" specifically; we still distinguish 410 from 401 to match existing routes)
- 500: validation engine threw

**JSDoc requirement:** full JSDoc block per `API_STANDARDS.md` Section 11.

**Business logic:** delegates entirely to `runValidation(invitationId)` from Section 2.8. The route is thin — auth + delegation + response shaping.

### 3.2 Modified route: `POST /api/candidate/application/[token]/save`

**File path:** `src/app/api/candidate/application/[token]/save/route.ts` (existing, 580 lines — read before editing per `CODING_STANDARDS.md` Section 1.2)
**Status:** modified

**Currently:** accepts four `sectionType` shapes — `personal_info | idv | workflow_section | service_section` (flat), `education | employment` (repeatable), `address_history` (repeatable + aggregatedFields).

**Change:** add a fifth accepted shape — `section_visit_tracking` — that updates `formData.sectionVisits` and/or `formData.reviewPageVisitedAt` without touching `formData.sections`.

The new request body schema:

```typescript
const visitTrackingSaveRequestSchema = z.object({
  sectionType: z.literal('section_visit_tracking'),
  sectionVisits: z.array(z.object({
    sectionId: z.string().min(1),
    visitedAt: z.string().datetime(),                  // ISO 8601
    departedAt: z.string().datetime().nullable(),       // null until first departure
  })).optional(),
  reviewPageVisitedAt: z.string().datetime().nullable().optional(),
});
```

The handler MUST:
- Merge `sectionVisits` entries into `formData.sectionVisits` rather than replacing — for each `sectionId` in the request, write the new visit record into the existing object. Once a `departedAt` becomes non-null, never clear it back to null on a later request (Rule 2).
- Once `reviewPageVisitedAt` becomes non-null, never clear it (Rule 3). The handler should ignore subsequent requests that try to set it back to null.
- Skip the locked-field-filtering branch (locked fields are a DSX requirement concept; visit tracking has no fields).

The existing four shapes are unchanged. The new shape is a sibling, not a replacement.

**JSDoc update:** extend the existing JSDoc block to document the new shape (Section 11 of `API_STANDARDS.md`).

### 3.3 Modified route: `GET /api/candidate/application/[token]/structure`

**File path:** `src/app/api/candidate/application/[token]/structure/route.ts` (existing, 289 lines)
**Status:** modified

**Change:** the structure response now includes the resolved scope per section so the frontend can render the scope description (and the validation engine has the same data to use, but the validation engine reads it server-side — see Section 2.8). For each section that has scope (Address History, Education, Employment), include:

```typescript
scope?: {
  scopeType: NormalizedScopeType;
  scopeValue: number | null;
  scopeDescriptionKey: string;          // translation key, NOT the English string
  scopeDescriptionPlaceholders?: Record<string, string | number>;
}
```

- The implementer MUST resolve scope using `normalizeRawScope` + `pickMostDemandingScope` from `packageScopeShape.ts` (Section 2.6), not by inlining the JSON parse a third time.
- The Review & Submit "summary" section is added to the structure response as an in-memory section entry: `{ id: 'review_submit', title: 'candidate.portal.sections.reviewSubmit', type: 'review_submit', placement: 'after_services', status: 'not_started', order: <last>, functionalityType: null }`. It is appended AFTER the existing after_services workflow sections. This matches Rule 29 ("positioned last after all workflow after-service sections").
- The structure endpoint still emits `status: 'not_started'` for every section; the client recomputes via `/validate` and overrides locally (existing Phase 6 Stage 4 pattern).

**Translation keys required:** `candidate.portal.sections.reviewSubmit` (see Section 8).

**JSDoc update:** extend the existing JSDoc block.

---

## 4. New Files (full list, alphabetical)

### Library / engine
1. `src/lib/candidate/validation/types.ts`
2. `src/lib/candidate/validation/packageScopeShape.ts`
3. `src/lib/candidate/validation/scopeValidation.ts`
4. `src/lib/candidate/validation/gapDetection.ts`
5. `src/lib/candidate/validation/fieldFormatValidation.ts`
6. `src/lib/candidate/validation/humanizeDuration.ts`
7. `src/lib/candidate/validation/dateExtractors.ts`
8. `src/lib/candidate/validation/validationEngine.ts`

### API routes
9. `src/app/api/candidate/application/[token]/validate/route.ts`

### Components — error display
10. `src/components/candidate/SectionErrorBanner.tsx` — banner at the top of any section that has scope/gap/document errors (Rule 8). Client component. Reads error array, renders per Rule 9 / Rule 10. Mobile-first per Component Standards Section 1.
11. `src/components/candidate/FieldErrorMessage.tsx` — small inline component rendered below an input when a field has an error (Rule 4 / Rule 5). Client component. Pure presentational — accepts `messageKey` + `placeholders`.

### Components — Review & Submit page
12. `src/components/candidate/review-submit/ReviewSubmitPage.tsx` — top-level container for the page. Client component. Loads `/validate` on mount + on every save-triggered refresh. Renders one section block per `FullValidationResult.sections` entry plus the disabled Submit button + help text.
13. `src/components/candidate/review-submit/ReviewSectionBlock.tsx` — one section's status indicator + name + per-section error list. Each error is tappable (Rule 31).
14. `src/components/candidate/review-submit/ReviewErrorListItem.tsx` — single tappable error item.

### Section visit tracking helper
15. `src/lib/candidate/sectionVisitTracking.ts` — pure helpers for merging visit records into `formData.sectionVisits` and computing whether a section is "visited and departed" or whether the review page has been visited. Used both by the save route handler (server-side merge) and by the portal-layout client (state derivation).

### Date-field shared constants
16. `src/components/candidate/form-engine/employmentDateFieldKeys.ts` — extracted from EmploymentSection.tsx (Section 0.4 / 5.3). Exports `END_DATE_FIELD_KEYS`, `CURRENTLY_EMPLOYED_FIELD_KEYS`, plus a `START_DATE_FIELD_KEYS` set covering `startDate | fromDate | start_date | from_date | dateFrom | date_from`.

### Tests (architect names them; test-writer creates the actual test files)
The test-writer agent will create test files alongside the production files following the project conventions in `TESTING_STANDARDS.md`. The architect does not enumerate every test file; the test-writer's plan is its own contract.

---

## 5. Existing Files to Modify

For each file: confirmed read before listing. Each entry says exactly what is in the relevant section today and exactly what will change.

### 5.1 `src/app/api/candidate/application/[token]/save/route.ts` (read in full)

**Currently (lines 26–110):** three Zod schemas (`saveRequestSchema`, `repeatableSaveRequestSchema`, `addressHistorySaveRequestSchema`) covering five sectionTypes. The handler picks one of three schemas based on `body.sectionType`, validates, then writes to `formData.sections[sectionId]`.

**Change:**
1. Add a fourth Zod schema `visitTrackingSaveRequestSchema` (Section 3.2).
2. Add a fourth branch to the schema-selection logic that detects `body.sectionType === 'section_visit_tracking'` and routes to a new handler block.
3. The new handler block:
   - Reads existing `formData.sectionVisits` (default `{}`) and existing `formData.reviewPageVisitedAt` (default `null`).
   - Merges incoming `sectionVisits` entries (preserve any existing non-null `departedAt`).
   - Sets `reviewPageVisitedAt` if the request includes a non-null value AND the existing value is null. Once set, never overwritten.
   - Writes the updated `formData` back via the same `prisma.candidateInvitation.update` call already in the route (line 531).
4. Update the JSDoc block to document the new shape.

**File-size note:** this addition is roughly 60–80 lines. With the file at 580, the implementer is expected to take it past 600 if implemented inline. The implementer MUST extract the new branch into a helper function in the new file `src/lib/candidate/sectionVisitTracking.ts` (Section 4 #15), keeping the route file's growth to ~30 lines (schema + thin dispatch). The route stays under the 600-line agent stop.

**No removal of existing logic. Existing four shapes work unchanged.**

### 5.2 `src/app/api/candidate/application/[token]/scope/route.ts` (read in full)

**Currently (lines 122–227):** an inline mapping from `rawScope.type` to `scopeType / scopeValue / scopeDescription`. ~100 lines of branching.

**Change:** replace the manual branching with a call to `normalizeRawScope(rawScope, validatedFunctionalityType)` from `src/lib/candidate/validation/packageScopeShape.ts` (Section 2.6). The route still wraps the normalized output with the localized `scopeDescription` string (since the scope route currently returns English strings, not translation keys, we keep that behavior to preserve the existing API contract). If the normalized output exposes only the `scopeDescriptionKey`, this route maps the key → English string in-route to maintain backward compatibility. Stage 1 does NOT change the response shape of `scope/route.ts`.

This is a refactor that yields the single source of truth required by Section 2.6. It must be functionally a no-op as observed by callers of `scope/route.ts`. The Pass 1 contract tests for the scope endpoint will catch any drift.

### 5.3 `src/components/candidate/form-engine/EmploymentSection.tsx` (read partially — sections relevant to date fieldKey constants)

**Currently (lines 405–423):** local `const CURRENTLY_EMPLOYED_FIELD_KEYS = new Set([...])` and `const END_DATE_FIELD_KEYS = new Set([...])`.

**Change:** delete the two local Set declarations. Import the same constants from the new file `src/components/candidate/form-engine/employmentDateFieldKeys.ts` (Section 4 #16). The component continues to call `isCurrentlyEmployedField` and `isEndDateField` exactly as it does today; only the constant source changes.

This is the minimum-footprint change required to single-source the alias list. No other behavior change in EmploymentSection.tsx.

### 5.4 `src/components/candidate/portal-layout.tsx` (read in full)

**Currently:** owns `activeSection`, `sectionStatuses`, `crossSectionRegistry`, `workflowAcknowledgments`, `personalInfoFields`, `personalInfoSavedValues`. Hydrates from `/saved-data`. Dispatches sections via `getActiveContent()`. ~552 lines.

**Change:**
1. Add new state: `sectionVisits: Record<string, { visitedAt: string; departedAt: string | null }>` and `reviewPageVisitedAt: string | null`.
2. Hydrate both from `/saved-data` on mount (the existing `/saved-data` endpoint returns the full `formData`; extend the response shape in Section 5.5 to also expose `sectionVisits` and `reviewPageVisitedAt`).
3. Replace `handleSectionClick` with a version that:
   - On clicking a NEW section while an OLD section is currently active: mark the OLD section's `departedAt = now` IF its current `departedAt` is null.
   - Set the NEW section's `visitedAt = now` IF it has not been visited yet.
   - POST the visit-tracking change via the new `section_visit_tracking` save shape.
4. When the candidate clicks the new "Review & Submit" sidebar entry:
   - Mark the previously-active section's `departedAt = now` (same as above).
   - Set `reviewPageVisitedAt = now` IF currently null.
   - POST both via the new save shape.
   - Render the new `ReviewSubmitPage` component.
5. Add a new state for `validationResult: FullValidationResult | null`.
6. After every successful auto-save (any section), trigger a fetch to `/validate` and store the result. The result feeds field-error visibility, banner visibility, and the sidebar status indicator.
7. The lifted progress effect (currently lines 301–337) is kept for fast Personal Info status updates while typing, but is now AUGMENTED by the `/validate` result. Specifically: when `validationResult` arrives, prefer its `status` over the locally-computed `computePersonalInfoStatus` value because the server result also includes scope/gap checks. This is the sidebar update path for Rule 27.
8. Pass `validationResult` and visit-tracking state down to the section components and to ReviewSubmitPage so they can render errors per Rules 4 / 8 / 11 / 31 / 34.

**File-size note:** portal-layout.tsx is currently 552 lines. The additions above are ~120–150 lines. The implementer MUST extract the new visit-tracking + validation-fetch logic into a new hook file `src/lib/candidate/usePortalValidation.ts` (Section 4 — add as #17 below) so the layout file does not cross 600.

### 5.4a (added during enumeration) New file: `src/lib/candidate/usePortalValidation.ts`

**Status:** new (added because of the file-size constraint in 5.4)
**Responsibility:** custom React hook that owns `sectionVisits`, `reviewPageVisitedAt`, `validationResult` state, exposes `markSectionDeparted`, `markSectionVisited`, `markReviewVisited`, and `refreshValidation` callbacks. Encapsulates the POST-to-save and POST-to-validate logic.
**Depends on:** `@/types/candidate-portal`, `src/lib/candidate/validation/types.ts`, `@/lib/client-logger`.

### 5.5 `src/app/api/candidate/application/[token]/saved-data/route.ts` (read in full)

**Currently:** returns `{ sections: { ... } }` only. Maps the saved JSON to a normalized response shape; `formData.sectionVisits` and `formData.reviewPageVisitedAt` are not exposed.

**Change:** extend the response with two additional top-level fields:

```typescript
{
  sections: { /* unchanged */ },
  sectionVisits: Record<string, { visitedAt: string; departedAt: string | null }>,   // empty object when unset
  reviewPageVisitedAt: string | null
}
```

Reading both is a flat property lookup on `formData` — no per-section transform required. Update the existing JSDoc block.

### 5.6 `src/components/candidate/portal-sidebar.tsx` (read in full)

**Currently:** renders one `<li>` per section with `SectionProgressIndicator`. Sections come from props as `CandidatePortalSection[]`.

**Change:** add a divider/separator below the last regular section, then render the Review & Submit pseudo-section as the last `<li>`, also using `SectionProgressIndicator` to show its status. The Review & Submit section is identified by `section.type === 'review_submit'` (a new value added to the `CandidatePortalSection.type` union — see Section 5.7).

The mobile slide-out menu uses the same list — no separate component needed (Rule 13's "match Phase 6 mobile pattern").

### 5.7 `src/types/candidate-portal.ts` (read in full)

**Currently (line 20):** `type: 'workflow_section' | 'service_section' | 'personal_info' | 'address_history';`

**Change:** add `'review_submit'` to the `type` union. Add an optional `scope?: { scopeType: string; scopeValue: number | null; scopeDescriptionKey: string; scopeDescriptionPlaceholders?: Record<string, string | number> }` property to `CandidatePortalSection` for the structure-endpoint additions in Section 3.3.

### 5.8 `src/components/candidate/form-engine/PersonalInfoSection.tsx` (read partially)

**Currently:** renders fields via `DynamicFieldRenderer`, calls `onProgressUpdate(status)` on auto-save success.

**Change:** accept a new optional prop `fieldErrors?: FieldError[]` and `sectionBannerErrors?: { scopeErrors: ScopeError[]; gapErrors: GapError[]; documentErrors: DocumentError[] }`, plus `errorsVisible: boolean` (true when the section has been visited and departed OR when `reviewPageVisitedAt !== null`). When `errorsVisible` is true:
- Pass field errors down to `DynamicFieldRenderer` (or render `FieldErrorMessage` siblings — implementer's choice; whichever is less invasive).
- Render `<SectionErrorBanner errors={sectionBannerErrors} />` at the top of the section.

Personal Info has no scope or gap errors (Rule 18), so `scopeErrors` and `gapErrors` will always be empty arrays for this section, but the prop is uniform across all sections so the layout can pass them generically.

### 5.9 `src/components/candidate/form-engine/IdvSection.tsx` — same change as 5.8

### 5.10 `src/components/candidate/form-engine/AddressHistorySection.tsx` — same shape as 5.8 plus banner messages will include scope and gap errors.

### 5.11 `src/components/candidate/form-engine/EducationSection.tsx` — same as 5.10 minus gap (Rule 20).

### 5.12 `src/components/candidate/form-engine/EmploymentSection.tsx` — same as 5.10. Plus the Section 5.3 import refactor.

### 5.13 `src/components/candidate/form-engine/WorkflowSectionRenderer.tsx` — same shape as 5.8. Workflow sections only have field/document errors (no scope, no gap).

### 5.14 `src/components/candidate/SectionProgressIndicator.tsx` (read in full)

**Currently:** renders three states from `SectionStatus`. Translation keys used: `candidate.sectionProgress.notStarted | incomplete | complete`.

**Change:** none. The status values are unchanged; the new validation-driven status feeds in via the same prop. Listing here for completeness.

### 5.15 `src/lib/candidate/sectionProgress.ts` (read in full)

**Currently:** exposes `computeWorkflowSectionStatus`, `computePersonalInfoStatus`, `computeIdvStatus`, `computeRepeatableSectionStatus`. Pure functions; field-only progress.

**Change:** none. Phase 7 augments these via the validation engine; it does not modify the existing helpers (per spec line 459: "extended, not replaced"). Listing here so the implementer does not accidentally edit it.

### 5.16 Translation files — see Section 8.

### 5.17 `src/components/candidate/portal-layout.test.tsx` (existing test) — see Section 9.

---

## 6. Zod Validation Schemas

For each schema needed:

### 6.1 `visitTrackingSaveRequestSchema` (in `save/route.ts`)
- `sectionType`: `z.literal('section_visit_tracking')`
- `sectionVisits`: optional array of `{ sectionId: z.string().min(1), visitedAt: z.string().datetime(), departedAt: z.string().datetime().nullable() }`
- `reviewPageVisitedAt`: optional `z.string().datetime().nullable()`

### 6.2 No new Zod schemas in `validate/route.ts` — request body is empty.

### 6.3 No new Zod schemas in `structure/route.ts` — endpoint is GET, no body.

The validation engine's internal types (`FieldError`, `ScopeError`, `GapError`, `DocumentError`, `SectionValidationResult`, `FullValidationResult`) are TypeScript interfaces, not Zod schemas, because they describe outputs of pure functions, not inputs from untrusted callers (Coding Standards Section 3.4 — Zod is for I/O boundary data).

---

## 7. TypeScript Types

All types live in `src/lib/candidate/validation/types.ts` (Section 2.1). No additions to `src/types/` are needed for the validation engine itself.

The single change in `src/types/candidate-portal.ts` (Section 5.7) adds the `'review_submit'` literal to the section `type` union and the optional `scope` property.

---

## 8. Translation Keys

Every new user-facing string. All keys must be added to all five language files: `en-US.json`, `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json` (Component Standards Section 6.3). Non-English values may be the English text flagged for later translation.

### 8.1 Field-level error messages
- `candidate.validation.field.required` → "This field is required."
- `candidate.validation.format.email` → "Please enter a valid email address."
- `candidate.validation.format.phone` → "Please enter a valid phone number."
- `candidate.validation.format.date` → "Please enter a valid date."
- `candidate.validation.format.url` → "Please enter a valid URL."
- `candidate.validation.format.numeric` → "Please enter a valid number."

### 8.2 Scope error messages (placeholders inside `{...}`)
- `candidate.validation.scope.countExact` → "{required} entry required, {actual} entered." (used when scopeType is count_exact)
- `candidate.validation.scope.countSpecific` → "{required} entries are required. You currently have {actual}."
- `candidate.validation.scope.timeBased` → "Your {sectionLabel} must cover the past {requiredYears} years. Your entries currently cover {coveredYears} years, {coveredMonths} months."
- `candidate.validation.scope.timeBasedZero` → "{requiredYears} years of {sectionLabel} required, none entered."
- `candidate.validation.scope.zeroEntries` → "{required} entries required, 0 entered." (Rule 12 wording)
- `candidate.validation.scope.allMustHaveOne` → "Please add at least one {sectionLabel} entry."
- `candidate.validation.scope.sectionLabel.addressHistory` → "address history"
- `candidate.validation.scope.sectionLabel.education` → "education history"
- `candidate.validation.scope.sectionLabel.employment` → "employment history"

### 8.3 Gap error messages
- `candidate.validation.gap.midline` → "There is a gap in your {sectionLabel} from {gapStart} to {gapEnd} ({gapDays} days). Gaps longer than {tolerance} days must be accounted for."
- `candidate.validation.gap.startOfTimeline` → "Your {sectionLabel} starts in {actualStart}, but must go back to {requiredStart}." (Rule 26 — Address History)

### 8.4 Document error messages
- `candidate.validation.document.missing` → "{count} required document(s) have not been uploaded."
- `candidate.validation.document.missingNamed` → "Required document not uploaded: {documentName}."

### 8.5 Review & Submit page
- `candidate.portal.sections.reviewSubmit` → "Review & Submit"
- `candidate.reviewSubmit.title` → "Review & Submit"
- `candidate.reviewSubmit.intro` → "Review the status of every section. Tap any item below to go to it."
- `candidate.reviewSubmit.sectionComplete` → "Complete"
- `candidate.reviewSubmit.sectionNotStarted` → "Not yet started"
- `candidate.reviewSubmit.scopeRequirement` → "Scope: {scopeDescription}"
- `candidate.reviewSubmit.submit` → "Submit"
- `candidate.reviewSubmit.submitHelp` → "Submit will be available once all sections are complete."

### 8.6 Sidebar
- (none — `candidate.portal.sections.reviewSubmit` from 8.5 is reused by the sidebar entry)

### 8.7 Error banner aria-label
- `candidate.validation.bannerLabel` → "Section problems"

Approximate count: ~26 new keys × 5 languages = ~130 individual JSON insertions.

---

## 9. UI Components (summary table)

| Path | New/Modified | Server/Client | Renders | Calls |
|---|---|---|---|---|
| `src/components/candidate/SectionErrorBanner.tsx` | new | `'use client'` | banner with scope/gap/document errors | none (presentational) |
| `src/components/candidate/FieldErrorMessage.tsx` | new | `'use client'` | red text below field | none (presentational) |
| `src/components/candidate/review-submit/ReviewSubmitPage.tsx` | new | `'use client'` | full page | `/validate` (refresh) |
| `src/components/candidate/review-submit/ReviewSectionBlock.tsx` | new | `'use client'` | one section's status + error list | none (calls onError navigate) |
| `src/components/candidate/review-submit/ReviewErrorListItem.tsx` | new | `'use client'` | one tappable error | none (calls onClick) |
| `src/components/candidate/portal-layout.tsx` | modified | `'use client'` | shell | `/saved-data`, `/personal-info-fields`, `/save`, `/validate` |
| `src/components/candidate/portal-sidebar.tsx` | modified | `'use client'` | section list with Review entry | none |
| `src/components/candidate/form-engine/PersonalInfoSection.tsx` | modified | `'use client'` | Personal Info form + banner + field errors | `/save` (existing) |
| `src/components/candidate/form-engine/IdvSection.tsx` | modified | `'use client'` | IDV form + banner + field errors | `/save` (existing) |
| `src/components/candidate/form-engine/AddressHistorySection.tsx` | modified | `'use client'` | Address History + banner + field errors | `/save` (existing) |
| `src/components/candidate/form-engine/EducationSection.tsx` | modified | `'use client'` | Education + banner + field errors | `/save` (existing) |
| `src/components/candidate/form-engine/EmploymentSection.tsx` | modified | `'use client'` | Employment + banner + field errors | `/save` (existing) |
| `src/components/candidate/form-engine/WorkflowSectionRenderer.tsx` | modified | `'use client'` | workflow section + banner + field error (document) | none |

Existing UI primitive usage (Component Standards Section 1.3): banner uses `bg-red-50`/`border-red-200`/`text-red-800` classes plus a warning icon (heroicons inline SVG, matching Phase 6 patterns). Field errors use the existing `.form-error` class. Touch targets stay at 44px+.

---

## 10. Order of Implementation

Strict numbered order — the next item depends on the previous.

1. **Verification of preconditions (Section 0).** Grep for legacy status spellings (`notStarted`, `in_progress`, `inProgress`, `done`) in the candidate portal surface. Confirm the scope endpoint's JSON shape mapping is unchanged. Read every file marked "modified" before editing it.
2. **Skip database changes.** No schema edit, no migration, no `pnpm prisma migrate deploy`, no `pnpm prisma generate`. (Section 1.)
3. **Shared constants extraction (5.3).** Move EmploymentSection's `END_DATE_FIELD_KEYS` and `CURRENTLY_EMPLOYED_FIELD_KEYS` into `src/components/candidate/form-engine/employmentDateFieldKeys.ts`. Add a `START_DATE_FIELD_KEYS` set. EmploymentSection.tsx switches to importing them. Run the EmploymentSection tests — no behavior change should be observable.
4. **Validation engine types and pure helpers (Section 2).** Create the eight files in `src/lib/candidate/validation/` in this order: `types.ts` → `packageScopeShape.ts` → `humanizeDuration.ts` → `dateExtractors.ts` → `fieldFormatValidation.ts` → `scopeValidation.ts` → `gapDetection.ts` → `validationEngine.ts`. Each one is a pure module with no DB access until `validationEngine.ts`.
5. **Refactor scope endpoint (5.2).** Replace inline JSON parsing in `scope/route.ts` with `normalizeRawScope`. Existing tests on `scope/route.ts` MUST still pass with no changes — this is a pure refactor.
6. **Type updates (5.7).** Add `'review_submit'` to `CandidatePortalSection.type` and add the optional `scope` property.
7. **Section visit tracking helpers (Section 4 #15).** Create `src/lib/candidate/sectionVisitTracking.ts`.
8. **Save endpoint extension (5.1).** Add `visitTrackingSaveRequestSchema`, route the new `sectionType` through the helpers from step 7. Update JSDoc.
9. **Saved-data endpoint extension (5.5).** Expose `sectionVisits` and `reviewPageVisitedAt` in the response. Update JSDoc.
10. **Structure endpoint extension (5.4 — the API one, sorry, this is 3.3).** Wait — re-numbering: the structure endpoint additions live in Section 3.3. Add the `scope` field per section, append the `review_submit` synthetic section. Update JSDoc.
11. **Validate API route (3.1).** Create the new endpoint. Thin handler delegating to `runValidation`.
12. **`usePortalValidation` hook (5.4a).** Create the new hook file. Validate-fetch logic encapsulated here keeps `portal-layout.tsx` under the file-size hard stop.
13. **Portal layout integration (5.4).** Add visit-tracking state, integrate the new hook, wire the new "Review & Submit" sidebar entry, pass `validationResult` and `errorsVisible` props down to every section component.
14. **Sidebar (5.6).** Add the Review & Submit entry rendering.
15. **Error display components (Section 4 #10–11).** Create `SectionErrorBanner` and `FieldErrorMessage`.
16. **Review & Submit page components (Section 4 #12–14).** Build the page hierarchy.
17. **Section component prop wiring (5.8–5.13).** Modify each section to accept `errorsVisible`, `fieldErrors`, `sectionBannerErrors`, render banner + field errors when `errorsVisible` is true.
18. **Translation keys (Section 8).** Add all keys to all five files.
19. **Manual browser verification.** Click through the complete flow: open invitation → fill Personal Info partially → leave to Education → return → confirm field errors appear; visit Review & Submit → confirm all errors listed; tap an error → confirm navigation; confirm Submit button is disabled with the static help text.
20. **Full vitest suite.** `pnpm vitest run` (no path argument). Paste raw output. Zero net regression required (Testing Standards Section 9).

---

## 11. Risks and Considerations

### 11.1 File-size pressure on portal-layout.tsx (552 lines today) and save/route.ts (580 lines today)

Without the hook extraction in Section 5.4a and the helper extraction in Section 5.1, both files would cross the 600-line agent stop. The plan accommodates this by introducing two new files purely to absorb new logic. The implementer must NOT inline the new logic into the existing files.

### 11.2 The `/validate` endpoint is called on every auto-save

Spec Rule 35 + DoD #26 require uncached recomputation on every demand. The route hits the database (one `findUnique` for the invitation, one `findMany` for package services). This is acceptable for the candidate flow's traffic pattern but should be measured. If validation latency turns out to dominate auto-save UX, Phase 7 Stage 2 can add request-level memoization (within a single HTTP request) — but that is out of scope here.

### 11.3 Time-based scope's "today" is per-request

The same `Date` value must thread through every per-section computation in a single `runValidation` call so all sections share the same "today" — otherwise a long-running call could see two different "today"s. The implementer must capture `new Date()` once at the top of `runValidation` and pass it down explicitly.

### 11.4 Address History start-of-timeline gap (Rule 26) requires scope period

Rule 26's "starts too recently" check needs `scopePeriodStart`. For non-time-based scopes (count_exact, count_specific, all), there is no scope period and the check does not run. This must be encoded in `gapDetection.ts`'s `scopePeriodStart` parameter being nullable.

### 11.5 Future end dates (Edge Case 5)

The spec asks the implementer to confirm whether future end dates are blocked at the field level. Reading `AddressBlockInput.tsx` and the dynamic field renderer, there is no current block on future dates. The validation engine's `extractAddressEntryDates` and `extractEmploymentEntryDates` MUST clamp future end dates to "today" before computing gaps and coverage. This is a non-blocking implementation decision documented here so the test-writer can write tests for it.

### 11.6 The validation result's `documentErrors` is not visible to the candidate today

Document upload UI was added in Phase 6 Stage 4 but the failure mode of "required document missing" was previously folded into the section status. Phase 7 promotes it to a banner item. The implementer must not log document filenames or any PII when constructing document errors — only the requirement ID and a translation-key reference (Coding Standards Section 5.2).

### 11.7 Cross-section requirement registry interaction

The cross-section registry currently affects Personal Info status (Phase 6 Stage 4 / TD-059). The validation engine's Personal Info section also reads cross-section requirements. The implementer must ensure both code paths use the same source of truth — either by computing cross-section requirements server-side from the saved entries (preferred) or by accepting the registry as input. Server-side reconstruction is preferred because it removes a class of "client and server disagree" bugs. The implementer should confirm this approach with Andy if there is any ambiguity.

### 11.8 Scope endpoint API stability

`scope/route.ts` returns English `scopeDescription` strings today. The structure-endpoint addition (3.3) returns translation keys. These two contracts will diverge slightly. The implementer must decide whether to (a) leave `scope/route.ts` returning English and have the new structure addition return keys, or (b) migrate `scope/route.ts` to return keys too. **Recommendation: option (a) for Stage 1.** The scope endpoint is consumed by ScopeDisplay components that already render English; migrating them is a separate piece of work. Stage 1 keeps backward compatibility on `scope/route.ts`.

### 11.9 Test surface

The test-writer agent will produce both Pass 1 contract tests (schema, Zod, e2e) and Pass 2 mock-backed tests after implementation. The architect's plan does not enumerate every test file but the test-writer is expected to cover, at minimum: scope JSON shape conversion, time-based coverage with overlapping intervals, gap tolerance edge cases (`null` / `0` / positive), Rule 26 start-of-timeline detection, Rule 11 banner re-appearance after deletion, Rule 3 / Rule 34 one-way Review & Submit visit effect, Rule 5 format validation only on non-empty optional fields, and the disabled Submit button + help text wording.

---

## 12. Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above.
- [x] No file outside this plan will need to be modified.
- [x] All Zod schemas (one new schema in save/route.ts), all new types (in `src/lib/candidate/validation/types.ts` and an additive line in `src/types/candidate-portal.ts`), and all new translation keys (Section 8) are listed.
- [x] The plan is consistent with the spec's Data Requirements table — field names match (`sectionId`, `visitedAt`, `departedAt`, `reviewPageVisitedAt`, `status`, `fieldErrors`, `scopeErrors`, `gapErrors`, `documentErrors`, `sections`, `allComplete`, `totalErrors`).
- [x] No production code written by the architect.
- [x] Status values are lowercase strings throughout (Section 0.2).
- [x] PackageService.scope JSON shape is researched, not redefined (Section 0.1).
- [x] Validation engine is a standalone service callable from both candidate-facing routes and the future Stage 2 submit handler (Section 2.8 + DoD #27).
- [x] Implementer's first action is the verification step in Section 10 #1 (Andy's non-blocker observation).

This plan is ready for the test-writer to proceed with Pass 1.
