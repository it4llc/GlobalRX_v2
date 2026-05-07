# Technical Plan: Phase 7 Stage 2 — Submission & Order Item Generation

**Based on specification:** `docs/specs/phase7-stage2-submission-order-generation.md` (Draft, May 6 2026)
**Date:** May 7 2026
**Author:** Technical Architect

---

## 1. Database Changes

**Yes / No:** **No.**

This stage is pure application logic over the existing schema. Every model the submit handler writes to (`Order`, `OrderItem`, `ServicesFulfillment`, `OrderData`, `OrderStatusHistory`, `ServiceComment`, `CandidateInvitation`) already exists with all required fields. No schema migration is needed.

**Why no schema change:**
- `Order.subject`, `Order.statusCode`, `Order.submittedAt` — all present.
- `OrderItem.id / orderId / serviceId / locationId / status` — all present.
- `ServicesFulfillment.id / orderId / orderItemId / serviceId / locationId / assignedVendorId` — all present.
- `OrderData.id / orderItemId / fieldName / fieldValue / fieldType` — all present.
- `OrderStatusHistory.fromStatus / toStatus / changedBy / isAutomatic / notes / eventType` — all present.
- `ServiceComment.orderItemId / templateId / finalText / isInternalOnly / isStatusChange / createdBy` — all present.
- `CandidateInvitation.status / completedAt` — all present.

**ServiceComment.templateId requirement (Edge 10 in spec):**
The schema requires `templateId` to be a foreign key into `comment_templates`. Rather than introducing a new migration to seed a "system" template, the implementer will look up an existing template at runtime by `shortName='General'` (the same fallback the existing e2e seed uses; see `prisma/seed-e2e-test-data.js` lines 260–273). If no such template exists in a given environment, the implementer creates one inside the same submit transaction with a deterministic `shortName='System'`, `longName='System-generated comment'`, `templateText='System-generated comment'`, `isActive=true`, then re-uses its id for every ServiceComment in that submission. This is a runtime upsert, not a migration.

---

## 2. Files to Create

| Path | Purpose |
|---|---|
| `src/app/api/candidate/application/[token]/submit/route.ts` | New `POST` endpoint: runs validation, performs the transactional submission, returns one of four response shapes. |
| `src/app/api/candidate/application/[token]/submit/__tests__/route.test.ts` | Pass 2 mock-backed tests for the submit handler (happy path, validation failure, expired, already-submitted, draft-only guard, transaction rollback, empty-order success). |
| `src/lib/candidate/submission/submitApplication.ts` | Core submission service. Exports `submitApplication(invitationId, today)` which is invoked from inside the route's `prisma.$transaction`. Owns the order-item generation, OrderData population, status update, history/comment creation, and CandidateInvitation update. Pure of HTTP concerns. |
| `src/lib/candidate/submission/__tests__/submitApplication.test.ts` | Service-level Pass 2 tests (transaction body shape, OrderData rows, OrderStatusHistory, idempotency). |
| `src/lib/candidate/submission/orderItemGeneration.ts` | Pure helpers for jurisdiction mapping and order-item generation: `selectAddressesInScope`, `resolveJurisdictionForAddress`, `dedupeOrderItemKeys`, `buildRecordOrderItemKeys`, `buildEduEmpOrderItemKeys`, `buildIdvOrderItemKeys`. No Prisma calls — operates over input arrays. |
| `src/lib/candidate/submission/__tests__/orderItemGeneration.test.ts` | Pure Pass 1 tests (no mocks) for the helpers above: scope filtering, jurisdiction walk, deduplication. |
| `src/lib/candidate/submission/orderDataPopulation.ts` | Pure helper that translates per-entry `formData` into `OrderData` rows (`orderItemId / fieldName / fieldValue / fieldType`). Handles primitive/JSON-stringification boundary. |
| `src/lib/candidate/submission/__tests__/orderDataPopulation.test.ts` | Pure tests for the OrderData translator. |
| `src/lib/candidate/submission/buildOrderSubject.ts` | Pure helper that translates the saved `personal_info` section data into the `Order.subject` JSON shape (keyed by fieldKey). |
| `src/lib/candidate/submission/__tests__/buildOrderSubject.test.ts` | Pure tests for the subject builder. |
| `src/lib/candidate/submission/types.ts` | Internal TypeScript shapes shared across the submission helpers (`OrderItemKey`, `JurisdictionResult`, `SubmissionContext`, `SubmissionResult`). Not exported publicly. |
| `src/types/candidate-submission.ts` | Public type definitions for the submit endpoint's request/response shapes (`SubmitSuccessResponse`, `SubmitValidationFailureResponse`, `SubmitExpiredResponse`, `SubmitAlreadySubmittedResponse`, `SubmitErrorResponse`, `SubmitResponse` discriminated union). |
| `src/app/candidate/[token]/portal/submitted/page.tsx` | Server component: success page route. Validates invitation status; redirects back to portal if not `completed`. Renders the success view. |
| `src/components/candidate/review-submit/SubmissionSuccessPage.tsx` | Client component for the success page UI. Pure presentational — no submit logic, no back-navigation triggers. |
| `src/components/candidate/review-submit/__tests__/SubmissionSuccessPage.test.tsx` | Component test for the success page. |

---

## 3. Files to Modify

For each entry below, the file has been read in full; the "Current state" line summarizes the relevant existing content.

### 3.1 `src/lib/candidate/validation/validationEngine.ts`
**Current state:** Lines 209–235 call `validateNonScopedSection` for both `personal_info` and `service_idv`. That helper returns `complete` whenever the section was visited, regardless of whether required fields have values. The IDV section also reads `sectionsData['service_idv']`, while the actual saved IDV data lives at `sectionsData['idv']` (the IdvSection saves with `sectionId: 'idv'` — see `src/components/candidate/form-engine/IdvSection.tsx:284`). This is the heart of TD-062.

**Changes (TD-062 fix):**
1. Add a Prisma include for `packageServices.service.serviceRequirements.requirement` and `packageServices.service.availability` to the existing `findUnique` block at lines 99–109, so the engine can read DSX field requirements, isRequired flags, and availability per service. Limit the include to `requirement.type='field'` requirements; documents are out of scope for this fix.
2. Add new internal helpers (kept inside this file unless they cross 60 lines, in which case they move to a new sibling file `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`):
   - `collectPersonalInfoFieldRequirements(packageServices)` — walks each package service's `serviceRequirements`, filters to requirements whose `fieldData.collectionTab` matches the personal-info heuristic used by `personal-info-fields/route.ts` lines 144–152, deduplicates by requirement.id, and returns `{ requirementId, fieldKey, isRequired }[]`. The `isRequired` is computed using the same context-aware AND logic as `personal-info-fields/route.ts` lines 162–243 — every applicable `(serviceId, locationId)` mapping for the candidate's package context must say `isRequired=true`.
   - `collectIdvFieldRequirements(packageServices, selectedCountryId)` — for each `idv`-functionality service in the package, walks `dsx_mappings` filtered to the candidate's selected country (read from `sectionsData['idv'].fields[?].requirementId === 'idv_country'.value`, which is how `IdvSection.tsx:269–275` saves it; if no country is selected, return an empty list — Personal Info / IDV will be `incomplete` with a "country required" field error). Returns the same shape as personalInfo.
   - `checkRequiredFields(saved, required)` — walks required field list; for each requirement whose `isRequired=true`, looks up the saved value at `saved.fields[?].requirementId === requirement.id`. Pushes a `FieldError { fieldName, messageKey: 'candidate.validation.fieldRequired' }` for every required field whose value is missing/empty (empty string, null, undefined, `[]`).
3. Replace the `validateNonScopedSection` invocation for `personal_info` (line 210) with a new helper `validatePersonalInfoSection({ sectionId: 'personal_info', sectionData: sectionsData['personal_info'], requiredFields, sectionVisits, reviewVisitedAt })` that:
   - Calls `checkRequiredFields` and assigns the resulting errors to `result.fieldErrors`.
   - Calls `deriveStatusWithErrors` (existing helper, lines 475–497) so the section becomes `incomplete` whenever any required field is missing — same status semantics as scoped sections.
4. Replace the IDV branch (lines 222–235) with a new helper `validateIdvSection` that:
   - Reads from `sectionsData['idv']` (NOT `service_idv`) to fix the data-key mismatch.
   - If `sectionsData['idv'].countryId` is null/missing, emit a single `FieldError { fieldName: 'country', messageKey: 'candidate.validation.idvCountryRequired' }`.
   - Otherwise calls `collectIdvFieldRequirements` for that country, then `checkRequiredFields`.
   - Calls `deriveStatusWithErrors` to derive the final status.
5. Update the JSDoc/spec banner at the top of the file to reference TD-062 resolution.

**File-size note:** `validationEngine.ts` is currently 630 lines. After this change it will be at the threshold. If the implementer estimates the additions push it past 700, they must move the new helpers to `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` (path explicitly listed in §2 above as an alternative — implementer chooses one path and only one). The default expectation is in-place.

### 3.2 `src/components/candidate/review-submit/ReviewSubmitPage.tsx`
**Current state:** Lines 132–149 render a permanently-disabled Submit button. The component currently has no submit handler, no loading state, no error handling. Props are `validationResult`, `sections`, `onErrorNavigate`.

**Changes:**
1. Add three new props to `ReviewSubmitPageProps`:
   - `onSubmit: () => Promise<void>` — invoked when the user taps Submit. Owned by the host (portal-layout).
   - `submitting: boolean` — host-controlled flag; when true, the button shows the loading state and is forced disabled regardless of validation.
   - `submitError: string | null` — translation-key (or already-localized string) describing the most recent submission failure. When set, render a banner above the footer (use existing `.form-error` class).
2. Replace the hardcoded `disabled` attribute with `disabled={!validationResult?.summary.allComplete || submitting}` and add `onClick={onSubmit}`.
3. When `submitting` is true, swap the button label from `t('candidate.reviewSubmit.submit')` to `t('candidate.submission.submitting')` and add `aria-busy="true"`.
4. When the validation summary is `allComplete=true`, swap the button's Tailwind palette from the disabled gray (`bg-gray-300`, `cursor-not-allowed`, `opacity-60`) to the active-button palette (`bg-blue-600 hover:bg-blue-700 text-white cursor-pointer`). When `disabled` for any reason, the gray palette is retained.
5. Render `submitError` (if non-null) in a banner inside `<footer>` above the button using the existing `.form-error` class. The banner text is the translated string from the host.

### 3.3 `src/components/candidate/portal-layout.tsx`
**Current state:** Lines 555–567 dispatch the Review & Submit section by rendering `<ReviewSubmitPage validationResult={...} sections={...} onErrorNavigate={...} />`. Also has access to `token`, `validationResult`, `refreshValidation`, and `useRouter`. There is no submit handler.

**Changes:**
1. Add three new pieces of local state in the `PortalLayout` component (placed near the other Phase 7 Stage 1 state hooks):
   ```ts
   const [submitting, setSubmitting] = useState(false);
   const [submitError, setSubmitError] = useState<string | null>(null);
   ```
2. Add a `useRouter` import from `next/navigation` if not already imported (verify before the implementer change — it is currently imported by other files in this directory; if missing here, add to imports section).
3. Add a new memoized handler `handleSubmit` (use `useCallback`):
   - Sets `submitting=true`, clears `submitError`.
   - `POST`s to `/api/candidate/application/${encodeURIComponent(token)}/submit` with no body.
   - Switches on the response shape:
     - **200 success:** push `router` to the URL in `redirectTo` (this will be `/candidate/${token}/portal/submitted`).
     - **400 validation failure:** call `refreshValidation()` so the Review page picks up the new errors, set `submitError` to `t('candidate.submission.error.validationFailed')`, leave the user on the Review page.
     - **403 expired:** set `submitError` to `t('candidate.submission.error.expired')`.
     - **200 already-submitted:** push `router` to `redirectTo`.
     - **500 / network failure:** set `submitError` to `t('candidate.submission.error.serverError')`.
   - In a `finally` block, set `submitting=false`.
4. Pass `onSubmit={handleSubmit}`, `submitting={submitting}`, `submitError={submitError}` into the `<ReviewSubmitPage>` JSX at line 561.

### 3.4 Translation files (5 files)

Add the 9 keys from the spec's Success Page Translation Keys table (lines 213–222 of the spec) plus 2 keys introduced by TD-062 to all five files:

- `src/translations/en-US.json`
- `src/translations/en-GB.json`
- `src/translations/es-ES.json`
- `src/translations/es.json`
- `src/translations/ja-JP.json`

(Translation values listed in §10 below.)

---

## 4. API Routes

### 4.1 `POST /api/candidate/application/[token]/submit`

**Auth:**
- 401 if no candidate session (`CandidateSessionService.getSession()` returns null).
- 403 if `sessionData.token !== token`.

**Input data and validation:** No request body. The token is the path parameter (Next.js 15 — `params` is a Promise; await it).

**Body schema:** none (no Zod schema needed for inputs; only response shapes are typed).

**Status guards (in order, after auth):**
1. Load invitation by token. If null → 404 `{ error: 'Invitation not found' }`.
2. If `invitation.expiresAt < now` → 403 `{ success: false, error: 'This invitation has expired' }`. (Per spec response table line 152.)
3. If `invitation.status === INVITATION_STATUSES.COMPLETED` (already submitted) → 200 with `{ success: true, message: 'Application has already been submitted', redirectTo: '/candidate/${token}/portal/submitted' }`. (Per spec response table line 144.)
4. Load the linked Order. If `order.statusCode !== 'draft'` → 200 with the same idempotent already-submitted response. (Per Rule 20.)
5. Run `runValidation(invitation.id)`. If `result.summary.allComplete === false` → 400 `{ success: false, error: 'Validation failed', validationResult: result }`. (Per Rule 2.)

**Business logic (transactional):**
6. Open `prisma.$transaction(async (tx) => { ... })`. Inside it, invoke the submission service `submitApplication` (see §6) passing the transaction client. On success, the route returns 200 `{ success: true, message: 'Application submitted successfully', redirectTo: '/candidate/${token}/portal/submitted' }`.

**Errors (cataloged in JSDoc):**
- 401: No session
- 403: Token mismatch (forbidden), expired invitation
- 404: Invitation not found
- 400: Validation failure
- 500: Transaction error or unexpected exception (logged via Winston with `event: 'candidate_submit_error'` — never log PII)

**Response shapes:** see §5 (Zod / TypeScript) — these are public types in `src/types/candidate-submission.ts`. Note: per `API_STANDARDS.md` §1.2 and §11, this route **must include a JSDoc block** above the `POST` handler covering every status code listed.

---

## 5. Zod Validation Schemas

The submit endpoint takes no request body, so there is **no input Zod schema**.

For internal TypeScript safety, the response types in §6 are plain TS interfaces (Zod is for I/O boundary inputs only — see `CODING_STANDARDS.md` §3.4 and the comment at the top of `src/lib/candidate/validation/types.ts`).

---

## 6. TypeScript Types

**New file: `src/types/candidate-submission.ts`**

```ts
export interface SubmitSuccessResponse {
  success: true;
  message: string;
  redirectTo: string;
}

export interface SubmitAlreadySubmittedResponse {
  success: true;
  message: string;
  redirectTo: string;
}

export interface SubmitValidationFailureResponse {
  success: false;
  error: 'Validation failed';
  validationResult: FullValidationResult; // imported from validation/types
}

export interface SubmitExpiredResponse {
  success: false;
  error: 'This invitation has expired';
}

export interface SubmitErrorResponse {
  success: false;
  error: string;
}

export type SubmitResponse =
  | SubmitSuccessResponse
  | SubmitAlreadySubmittedResponse
  | SubmitValidationFailureResponse
  | SubmitExpiredResponse
  | SubmitErrorResponse;
```

**New file: `src/lib/candidate/submission/types.ts` (internal)**

```ts
export interface OrderItemKey {
  serviceId: string;
  locationId: string;
  // Source provenance — used for OrderData population and ServiceComment messages.
  source:
    | { kind: 'address';   addressEntryId: string }
    | { kind: 'education'; entryId: string; countryId: string }
    | { kind: 'employment'; entryId: string; countryId: string }
    | { kind: 'idv';       countryId: string };
}

export interface JurisdictionResolutionResult {
  resolvedLocationId: string | null; // null = service unavailable at any level → skip
}

export interface SubmissionContext {
  invitation: CandidateInvitation;             // includes packageId, orderId, createdBy
  order: Order;                                 // current draft order
  formData: CandidateFormDataShape;             // typed shape from validationEngine
  packageServices: Array<PackageServiceWithService>; // includes service.functionalityType
  today: Date;                                  // captured once at the route, threaded through
}
```

---

## 7. UI Components

### 7.1 `src/components/candidate/review-submit/ReviewSubmitPage.tsx` (modified)
- **Type:** Client component (`'use client'` — already present at line 12).
- **Renders:** Section blocks (existing) + Submit button + submit help text + new submit-error banner + new active/loading button states.
- **Existing UI components used:** None of the standard Form/Modal/ActionDropdown components apply — this is a custom page. No new component imports needed.
- **API routes called:** None directly. The `onSubmit` prop is invoked; the host (portal-layout) makes the actual fetch.

### 7.2 `src/components/candidate/portal-layout.tsx` (modified)
- **Type:** Client component (already).
- **API routes called:** Adds `POST /api/candidate/application/[token]/submit` to its existing call surface.
- **Existing UI components used:** `<ReviewSubmitPage>` (existing).

### 7.3 `src/app/candidate/[token]/portal/submitted/page.tsx` (new)
- **Type:** Server component (no `'use client'`). The page fetches the invitation, checks status, redirects if not `completed`, otherwise renders the client success component.
- **Renders:** `<SubmissionSuccessPage />`.
- **API routes called:** None. Reads invitation directly via `prisma.candidateInvitation.findUnique` server-side using the `token` path param. (Note: the candidate session is still validated via `CandidateSessionService` — apply the same auth pattern as the existing portal page.)
- **Behavior on access without completion (Edge 8):** If `invitation.status !== INVITATION_STATUSES.COMPLETED`, server-side `redirect(`/candidate/${token}/portal`)`.

### 7.4 `src/components/candidate/review-submit/SubmissionSuccessPage.tsx` (new)
- **Type:** Client component (`'use client'`) so it can use `useTranslation`.
- **Renders:** Centered card with the title (`candidate.submission.success.title`), main message (`candidate.submission.success.message`), "What happens next?" header (`candidate.submission.success.whatNext`), and next-steps body (`candidate.submission.success.nextSteps`).
- **Existing UI components used:** None — pure layout in `globals.css` / Tailwind utility classes (see §3.5 Component Standards: no inline styles, no new stylesheets).
- **No links back to the application form.** No "edit", "review", or "resubmit" affordances. (Per spec Rule 17.)

---

## 8. Translation Keys

Every key below is added to **all five** translation files: `en-US.json`, `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`. Per `COMPONENT_STANDARDS.md` §6.3, non-English files use the English placeholder text (flagged for later real translation) — the platform's `t()` falls back to the input key when missing, but having the key present in every file is mandatory to avoid raw-key display.

| Key | en-US Value |
|---|---|
| `candidate.submission.success.title` | `Application Submitted` |
| `candidate.submission.success.message` | `Your application has been submitted successfully. Thank you for completing your background check application.` |
| `candidate.submission.success.whatNext` | `What happens next?` |
| `candidate.submission.success.nextSteps` | `Your information will be reviewed and processed. You do not need to take any further action.` |
| `candidate.submission.submitting` | `Submitting your application...` |
| `candidate.submission.error.expired` | `This invitation has expired. Please contact the company that sent you this link.` |
| `candidate.submission.error.alreadySubmitted` | `This application has already been submitted.` |
| `candidate.submission.error.validationFailed` | `Your application could not be submitted because some sections are incomplete. Please review and fix the issues listed below.` |
| `candidate.submission.error.serverError` | `Something went wrong while submitting your application. Please try again. If the problem continues, contact the company that sent you this link.` |
| `candidate.validation.fieldRequired` | `This field is required.` |
| `candidate.validation.idvCountryRequired` | `Please select your country to continue identity verification.` |

---

## 9. Order of Implementation

The implementer must follow this sequence. Each step's file list is explicit; no other files may be touched.

1. **Database schema:** No changes (see §1).
2. **Prisma migration:** None (see §1). Skip the standard 5-step migration process for this stage.
3. **TypeScript types:**
   - Create `src/types/candidate-submission.ts`.
   - Create `src/lib/candidate/submission/types.ts`.
4. **Pure helpers (no Prisma):**
   - Create `src/lib/candidate/submission/orderItemGeneration.ts`.
   - Create `src/lib/candidate/submission/orderDataPopulation.ts`.
   - Create `src/lib/candidate/submission/buildOrderSubject.ts`.
5. **Validation engine TD-062 fix:**
   - Modify `src/lib/candidate/validation/validationEngine.ts` per §3.1.
6. **Submission service (Prisma-aware):**
   - Create `src/lib/candidate/submission/submitApplication.ts`.
7. **Submit API route:**
   - Create `src/app/api/candidate/application/[token]/submit/route.ts`.
8. **Success page:**
   - Create `src/app/candidate/[token]/portal/submitted/page.tsx`.
   - Create `src/components/candidate/review-submit/SubmissionSuccessPage.tsx`.
9. **UI wiring:**
   - Modify `src/components/candidate/review-submit/ReviewSubmitPage.tsx` per §3.2.
   - Modify `src/components/candidate/portal-layout.tsx` per §3.3.
10. **Translation keys (all five locale files):** Modify per §3.4 / §10.

---

## 10. TD-062 Fix — Detailed Specification

### 10.1 The defect (concrete)

`src/lib/candidate/validation/validationEngine.ts` currently returns `complete` for both `personal_info` and `service_idv` whenever the section was visited, regardless of whether required fields are filled in. Two specific defects:

1. **Personal Info:** Lines 209–217 invoke `validateNonScopedSection`, which never inspects field values — it only checks whether the section was visited (`sectionVisits['personal_info']`) or has any saved data (`hasAnySavedData`). A candidate can visit Personal Info, type nothing, leave, and the engine reports `complete`.
2. **IDV:** Lines 222–235 do the same, **plus** read from the wrong key — `sectionsData['service_idv']` instead of `sectionsData['idv']`. The IdvSection saves under `sectionId: 'idv'` (see `src/components/candidate/form-engine/IdvSection.tsx:284`), so the engine's lookup always returns `undefined`. Today this happens to be papered over by `mergeSectionStatus`, which combines local + server statuses, and the local IDV component computes its own status against the loaded fields. Stage 2 needs server-side authority because `mergeSectionStatus` runs only in the browser.

### 10.2 Source of field requirements

For both sections, requirements live in `dsx_requirements` joined to `service_requirements` (per service in the package), filtered by `requirement.type='field'` and `requirement.disabled=false`. The `isRequired` flag on each `(requirement × service × location)` tuple comes from `dsx_mappings`.

The reference implementation already exists for Personal Info: `src/app/api/candidate/application/[token]/personal-info-fields/route.ts` lines 109–243. The TD-062 fix mirrors that algorithm inside the validation engine. **The implementer must read that route end-to-end before writing the helpers; do not reinvent the AND-aggregation logic.**

### 10.3 Personal Info field requirements algorithm (validation-engine side)

Inputs from the existing Prisma query (extended in step 1 of §3.1): `packageServices` array with each `service.serviceRequirements` and each requirement's `fieldData`, plus `availability` rows for each service's countries.

Steps:
1. **Collect candidate Personal Info requirements:** For every package service, walk `serviceRequirements`, filter to `requirement.type==='field'` and `requirement.disabled===false`, then keep only those whose `fieldData.collectionTab` (or `collection_tab`) value matches the personal-info heuristic from `personal-info-fields/route.ts:144–152` — that is, contains "personal" or "subject" in lowercase, OR the `fieldKey` is in the well-known list (`firstName`, `lastName`, `middleName`, `email`, `phone`, `phoneNumber`, `dateOfBirth`, `birthDate`, `dob`, `ssn`, `socialSecurityNumber`).
2. **Resolve isRequired per requirement** using the same context-aware AND logic as `personal-info-fields/route.ts:162–243`:
   - Find applicable `(serviceId, locationId)` pairs: `dsx_availability.isAvailable=true` AND `country.disabled IS NOT TRUE`.
   - Query `dsx_mappings` for `(requirementId IN [...], OR pair list)`.
   - Group by `requirementId`; AND across the group's `isRequired` flags.
   - Empty group → `isRequired=false`.
3. **Check saved values:** For each requirement with `isRequired=true`, look up the value in `formData.sections.personal_info.fields[?].requirementId === requirement.id`. Locked fields (`firstName`, `lastName`, `email`, `phone`, `phoneNumber`) are pre-filled from invitation columns and **must be treated as filled** — read them from `invitation.firstName`, `invitation.lastName`, `invitation.email`, and `invitation.phoneNumber` rather than from `formData`. (See `src/app/api/candidate/application/[token]/save/route.ts:439–510` — locked fields are filtered out of the save payload, so they're never present in `formData.sections.personal_info`.)
4. **Emit field errors:** For each required field whose value is empty (null, undefined, empty string, or empty array `[]`), append `{ fieldName: requirement.name, messageKey: 'candidate.validation.fieldRequired' }` to `result.fieldErrors`.

### 10.4 IDV field requirements algorithm

Steps:
1. **Read the saved IDV bucket:** `formData.sections['idv']` (NOT `service_idv` — bug fix).
2. **Resolve the country:** The country is saved under the requirementId `'idv_country'` (string literal, see `IdvSection.tsx:269–275`). If absent or empty, emit `{ fieldName: 'country', messageKey: 'candidate.validation.idvCountryRequired' }` and stop — no other field checks make sense without a country.
3. **Collect IDV field requirements:** For each `idv`-functionality package service, find `dsx_mappings` rows where `(serviceId, locationId=selectedCountryId)` and `dsx_availability.isAvailable=true at that locationId`. Walk `requirementId → requirement.type='field'` to get the requirement list. Deduplicate by `requirement.id`. Track `isRequired` per requirement (AND across `(service, location)` mapping rows for the requirement, same pattern as Personal Info).
4. **Check saved values:** For each required requirement, look up in `formData.sections.idv.fields[?].requirementId === requirement.id`. Empty → field error.

### 10.5 Status derivation
The new `validatePersonalInfoSection` and `validateIdvSection` helpers each call the existing `deriveStatusWithErrors` (line 475) instead of `deriveBasicStatus`. This means: if `fieldErrors.length > 0`, status becomes `incomplete`. If no errors and the section was visited or has saved data, status becomes `complete`. If neither visited nor any saved data and no errors, status stays `not_started`. This matches the existing scoped-section behavior (Address History / Education / Employment).

### 10.6 `mergeSectionStatus`
Per spec line 262, the `mergeSectionStatus` helper "may remain for backward compatibility." The plan **does not modify or remove** `src/lib/candidate/validation/mergeSectionStatus.ts`. After TD-062, the server-side validation is correct on its own, but `portal-layout.tsx` continues to use the merge as a safety net for the local-only signals it tracks (e.g., cross-section requirements). No regression.

---

## 11. Submit Endpoint Design — Full Specification

### 11.1 Request handling
- Path: `/api/candidate/application/[token]/submit` (Next.js 15 — `params: Promise<{ token: string }>`, must `await`).
- Method: `POST`. No body.
- Logger event prefix for this route: `candidate_submit_*` (`candidate_submit_error`, `candidate_submit_validation_failed`, etc.). Never log PII.

### 11.2 Order of checks (mirrors the established `/validate` route at `src/app/api/candidate/application/[token]/validate/route.ts:50–98`)

1. `await params` → token.
2. `CandidateSessionService.getSession()`. If null → 401.
3. `sessionData.token !== token` → 403.
4. `prisma.candidateInvitation.findUnique({ where: { token }, include: { order: true } })`. If null → 404.
5. `invitation.expiresAt < now` → 403 expired (`SubmitExpiredResponse`).
6. `invitation.status === INVITATION_STATUSES.COMPLETED` → 200 `SubmitAlreadySubmittedResponse` (idempotent).
7. `invitation.order.statusCode !== 'draft'` → 200 `SubmitAlreadySubmittedResponse` (idempotent draft-only guard, Rule 20).
8. `runValidation(invitation.id)`. If `!result.summary.allComplete` → 400 `SubmitValidationFailureResponse` carrying the result.
9. Open `prisma.$transaction(async (tx) => { ... }, { timeout: 30000 })`. Call `submitApplication(tx, invitation, today)` (see §12). On success the transaction commits.
10. Return 200 `SubmitSuccessResponse`.

### 11.3 Response shapes

| Case | Status | Body |
|---|---|---|
| Success | 200 | `{ success: true, message: 'Application submitted successfully', redirectTo: '/candidate/${token}/portal/submitted' }` |
| Already submitted (idempotent) | 200 | `{ success: true, message: 'Application has already been submitted', redirectTo: '/candidate/${token}/portal/submitted' }` |
| Validation failure | 400 | `{ success: false, error: 'Validation failed', validationResult: FullValidationResult }` |
| Expired | 403 | `{ success: false, error: 'This invitation has expired' }` |
| 401 / 403-token / 404 / 500 | as above | per `API_STANDARDS.md` |

### 11.4 Idempotency and concurrency
- The 200 already-submitted shape returns when `invitation.status === completed` **or** when the order's `statusCode !== draft`. Either condition is sufficient — they are checked separately so a corrupted state (one updated but not the other) does not loop the candidate through a server error.
- The transaction itself uses Prisma's default isolation. The "two simultaneous submits" race is resolved by the `invitation.status` check inside the transaction body (see §12 step 7) — if a sibling transaction already flipped status to `completed`, this transaction's update finds `previousStatus !== 'in_progress'` and aborts, rolling back any work it had begun.

---

## 12. Transaction Body — Full Specification

`submitApplication(tx: Prisma.TransactionClient, invitation: InvitationWithOrder, today: Date): Promise<void>` runs **inside** the route's `prisma.$transaction`. Steps in order:

### Step 1 — Re-read inside the transaction
Re-fetch the invitation with `tx.candidateInvitation.findUnique({ where: { id: invitation.id }, include: { order: true, package: { include: { packageServices: { include: { service: true } } } } } })`. Verify `status !== completed` and `order.statusCode === 'draft'`. If either fails, throw a sentinel error `AlreadySubmittedError`; the route catches this and returns the idempotent 200 response without rolling back anything (because nothing has been written yet).

### Step 2 — Build personal info → Order.subject
Call `buildOrderSubject(formData.sections.personal_info, invitation, dsxRequirementsLookup)`. Returns a JSON object keyed by `fieldKey`. Locked fields (`firstName`, `lastName`, `email`, `phoneCountryCode + phoneNumber`) are sourced from the invitation columns (per Personal Info save-route locked-field rule). Unlocked fields are sourced from `formData.sections.personal_info.fields[?].value`. The `dsxRequirementsLookup` is a `Map<requirementId, fieldKey>` built once at the top of `submitApplication` from a single `tx.dSXRequirement.findMany({ where: { id: { in: allRequirementIds } } })` query.

### Step 3 — Generate order item keys
Call `buildRecordOrderItemKeys`, `buildEduEmpOrderItemKeys`, `buildIdvOrderItemKeys` from `orderItemGeneration.ts` (see §13). Concatenate the results, deduplicate by `(serviceId, locationId)` for the **record-type** subset only (per Rule 6 — edu/emp keys are intentionally per-entry-per-service so deduplication does not apply; IDV is one-per-service so duplicates are impossible). The dedupe logic preserves the **first** source provenance for each `(serviceId, locationId)` pair so OrderData population still has an entry to read from.

### Step 4 — Create OrderItem + ServicesFulfillment for each key
**Decision: replicate the `OrderCoreService.addOrderItem` transactional pattern inline rather than calling the static method.**

**Rationale:**
- `OrderCoreService.addOrderItem` (lines 1071–1152 of `src/lib/services/order-core.service.ts`) opens its own `prisma.$transaction`. Calling it from inside our transaction would either nest transactions (Prisma's behavior here is to reuse the outer transaction only when the inner call accepts a `tx` — it does not; it always uses `prisma`), or duplicate the connection.
- The existing static method also enforces a `customerId` and `statusCode==='draft'` precondition that would conflict with our flow — we already checked these upstream.
- The instance method `OrderCoreService.prototype.addOrderItem` (lines 286–375) is the closer fit because it skips the customer check, but it still opens its own transaction.

**What to do instead:** Replicate the exact transactional pattern from `addOrderItem`:
1. `tx.orderItem.create({ data: { orderId, serviceId, locationId, status: 'submitted' } })`. (Status is `'submitted'` because the parent order is about to flip to `submitted` in step 7. Uses constant `SERVICE_STATUSES.SUBMITTED` — never a string literal.)
2. `tx.servicesFulfillment.create({ data: { orderId, orderItemId: orderItem.id, serviceId, locationId, assignedVendorId: null } })`.

Repeat for each generated key. Collect the resulting `orderItem` records into a list keyed by the source provenance for use in step 5.

**Why `assignedVendorId: null`:** Per `DATABASE_STANDARDS.md` §2.2 rule 2 and the existing pattern at `order-core.service.ts:341–351` — vendor assignment is a separate, later step.

**Why we don't call `ServiceFulfillmentService.createServicesForOrder`:** It runs outside the transaction and is the legacy "create fulfillment records when order is submitted" path. We're creating them at the same time as the order items, which is the stricter invariant (DATABASE_STANDARDS.md §2.2 rule 1).

### Step 5 — Create OrderData rows
For each newly created OrderItem, call `buildOrderDataRows(orderItem, sourceProvenance, formDataSection, dsxRequirementsLookup)` from `orderDataPopulation.ts` (see §14). Insert each returned row via `tx.orderData.createMany({ data: [...] })`. Batch per OrderItem.

### Step 6 — Resolve the system comment template
Run a single lookup at the top of the transaction (before the loop in Step 4 to avoid repeating it per item):
```ts
const template = await tx.commentTemplate.findFirst({ where: { shortName: 'System' } })
              ?? await tx.commentTemplate.findFirst({ where: { shortName: 'General' } })
              ?? await tx.commentTemplate.create({
                   data: {
                     shortName: 'System',
                     longName: 'System-generated comment',
                     templateText: 'System-generated comment',
                     isActive: true,
                   },
                 });
```
This is deterministic, idempotent (later submissions reuse the same row), and avoids the migration-vs-runtime question raised by spec Edge 10.

### Step 7 — Create one ServiceComment per OrderItem
For each OrderItem created in Step 4:
```ts
await tx.serviceComment.create({
  data: {
    orderItemId: orderItem.id,
    templateId: template.id,
    finalText: 'Order item created from candidate application submission',
    isInternalOnly: false,
    isStatusChange: false,
    createdBy: invitation.createdBy, // Staff user who created the invitation
  },
});
```

**Why `invitation.createdBy` for `createdBy`:** Per the data dictionary, `ServiceComment.createdBy` is a foreign key to `User.id`. The schema has no nullable system-user. The candidate is not a `User`. The most coherent system identity for a candidate-driven event is the staff user who originated the invitation — `CandidateInvitation.createdBy`. This same identity is used for `OrderStatusHistory.changedBy` in Step 8 below for symmetry.

### Step 8 — Update Order
```ts
await tx.order.update({
  where: { id: order.id },
  data: {
    statusCode: ORDER_STATUS_VALUES /* 'submitted' constant */,
    submittedAt: today,
    subject: builtSubject, // from Step 2
  },
});
```
Uses the constant from `src/constants/order-status.ts` (`'submitted'` — already lowercase). Never a string literal.

### Step 9 — Insert OrderStatusHistory
```ts
await tx.orderStatusHistory.create({
  data: {
    orderId: order.id,
    fromStatus: 'draft',
    toStatus: 'submitted',
    changedBy: invitation.createdBy, // FK to users.id (see Step 7)
    isAutomatic: true,
    notes: 'Candidate submitted application',
    eventType: 'status_change', // schema default, but written explicitly
  },
});
```

### Step 10 — Update CandidateInvitation
```ts
await tx.candidateInvitation.update({
  where: { id: invitation.id },
  data: {
    status: INVITATION_STATUSES.COMPLETED,
    completedAt: today,
  },
});
```
**Status note:** Spec says "in_progress → completed". The actual codebase uses `INVITATION_STATUSES.ACCESSED` not `IN_PROGRESS` (see `src/constants/invitation-status.ts:11` — `ACCESSED: 'accessed'`). The transition is technically `accessed → completed`. The implementer must reference the constant `INVITATION_STATUSES.COMPLETED` for the destination value; the source value is whatever the row currently has (we do not assert on it, only on `!== completed`).

### Step 11 — Return
The function returns void. The route handler then sends the success response.

**Note on `formData`:** Per spec Rule 23, `formData` is **not modified**. No update statement touches it. The submitted form data is preserved as-is for audit.

---

## 13. Scope-Aware Jurisdiction Mapping for Records — Algorithm

### 13.1 Inputs
- `addressEntries`: `formData.sections.address_history.entries[]` (per `save/route.ts:535–553`).
- `recordPackageServices`: `packageServices.filter(ps => ps.service.functionalityType === 'record')`.
- `today`: captured once at the route, threaded through.

### 13.2 Per-service scope filtering (Rule 5 step 1)

For each record-type package service, normalize its scope using the existing helper `normalizeRawScope(ps.scope, 'record')` from `src/lib/candidate/validation/packageScopeShape.ts`. Then select addresses:

| Scope type | Selection logic |
|---|---|
| `count_exact` (k entries) | First k entries in chronological order, most-recent first. |
| `count_specific` with `scopeValue=N` | First N entries in chronological order, most-recent first. |
| `time_based` with `scopeValue=Y years` | All entries whose date range overlaps `[today − Y years, today]`. Use `extractAddressEntryDates` (already exists in validation engine) to read the address-block from/to dates. |
| `all` | Every entry. |

Helper `selectAddressesInScope(entries, scope, today)` lives in `orderItemGeneration.ts` and is **pure** (no Prisma).

### 13.3 Per-address jurisdiction resolution (Rule 5 step 2)

For each `(serviceId, addressEntry)` pair selected above, walk DSX availability **county → state → country**:

1. Read the address's structured location IDs from the address-block JSON value: `addressEntry.fields[?].value` is an object with shape `{ countryId, stateId?, countyId?, ... }`. (The exact shape is set by the address-block field; verify by reading a saved entry. This is consistent with the country-only `entry.countryId` for Edu/Emp.)
2. If `addressEntry has countyId`: look up `dsx_availability` for `(serviceId, locationId=countyId, isAvailable=true)`. If found, resolved jurisdiction = `countyId`. Skip remaining levels.
3. Else if `addressEntry has stateId`: look up `(serviceId, locationId=stateId, isAvailable=true)`. If found, resolved = `stateId`.
4. Else: look up `(serviceId, locationId=countryId, isAvailable=true)`. If found, resolved = `countryId`.
5. If none of the above match: skip this `(serviceId, addressEntry)` pair (no order item) — Edge 5.

Helper `resolveJurisdictionForAddress(serviceId, address, availabilityIndex)` lives in `orderItemGeneration.ts`. Takes a pre-built `Map<(serviceId, locationId), DSXAvailability>` so the resolver itself is pure. The submission service builds this map once via:
```ts
const availability = await tx.dSXAvailability.findMany({
  where: { serviceId: { in: recordServiceIds }, isAvailable: true },
  select: { serviceId: true, locationId: true },
});
const availabilityIndex = new Map<string, true>(); // key: `${serviceId}:${locationId}`
for (const a of availability) availabilityIndex.set(`${a.serviceId}:${a.locationId}`, true);
```

### 13.4 Deduplication (Rule 6)
After all `(serviceId, addressEntry)` pairs have been resolved, dedupe by `(serviceId, resolvedLocationId)`. Keep the **first** occurrence's source provenance (it carries the address-entry id used for OrderData population). Helper: `dedupeOrderItemKeys(keys)` in `orderItemGeneration.ts`. Documented per `CODING_STANDARDS.md` §8.4 (first-wins is appropriate here because addresses with the same resolved jurisdiction produce structurally identical order items — the choice of provenance is arbitrary, but first-most-recent is the most defensible default).

### 13.5 Existing helpers reused
- `normalizeRawScope` from `packageScopeShape.ts` — yes.
- `pickMostDemandingScope` from `packageScopeShape.ts` — **no.** The submission scope is per-package-service (each service contributes its own order items with its own scope), not per-section (which is what `pickMostDemandingScope` is for). This is a deliberate divergence from the Stage 1 validation engine.
- `extractAddressEntryDates` from `dateExtractors.ts` — yes (for time-based scope filtering).
- `evaluateCountScope` / `evaluateTimeBasedScope` — **no**, those are validation-side and produce errors. The submission-side filter is direct.

---

## 14. Edu / Emp / IDV Order Item Creation — Algorithms

### 14.1 Verification-edu (Rule 7)
For each entry in `formData.sections.education.entries[]`, and for each package service whose `service.functionalityType === 'verification-edu'`, emit one order-item key: `{ serviceId, locationId: entry.countryId, source: { kind: 'education', entryId: entry.entryId, countryId: entry.countryId } }`.

**Edge:** if `entry.countryId` is null (the entry was created but no country selected), validation should already have flagged this as incomplete — but as a safety belt, skip the entry rather than crash. Log a `warn` event `candidate_submit_skipped_edu_entry`, no PII.

**No deduplication.** Two education entries in the same country produce two order items per edu service. (Verifications target schools, not jurisdictions.)

### 14.2 Verification-emp (Rule 8)
Identical to edu but reads `formData.sections.employment.entries[]` and matches `functionalityType === 'verification-emp'`. Same provenance shape with `kind: 'employment'`.

### 14.3 IDV (Rule 9)
For each `idv`-functionality package service, emit exactly one order-item key: `{ serviceId, locationId: idvCountryId, source: { kind: 'idv', countryId: idvCountryId } }`.

The `idvCountryId` is read from `formData.sections.idv.fields[?].requirementId === 'idv_country'` — same source as the validation engine's TD-062 fix for IDV (§10.4 step 2).

If no country is selected, validation will have caught it; same safety belt as edu/emp.

---

## 15. OrderData Population — Algorithm

### 15.1 Source mapping
For each created OrderItem, walk the relevant section of `formData` based on the source provenance:

| Provenance kind | formData source | Iteration |
|---|---|---|
| `address` | `formData.sections.address_history.entries.find(e => e.entryId === source.addressEntryId).fields` | Each saved field |
| `education` | `formData.sections.education.entries.find(e => e.entryId === source.entryId).fields` | Each saved field |
| `employment` | `formData.sections.employment.entries.find(e => e.entryId === source.entryId).fields` | Each saved field |
| `idv` | `formData.sections.idv.fields` | Each saved field, **excluding** `requirementId === 'idv_country'` (that's an internal marker, not a DSX requirement) |

For **address_history only**, also iterate `formData.sections.address_history.aggregatedFields` (a flat object keyed by `requirementId`). The aggregated fields apply to every record-type order item produced from address_history (Rule 11 — they are per-section data, not per-entry).

### 15.2 Row shape

For each saved field with a non-undefined value:
```ts
{
  orderItemId: orderItem.id,
  fieldName: field.requirementId,    // The DSX requirement UUID (per spec Data Requirements line 172)
  fieldValue: typeof v === 'string' ? v : JSON.stringify(v),
  fieldType: dsxRequirementsLookup.get(field.requirementId).fieldKey,
                                     // Wait — see clarification below.
}
```

**`fieldType` clarification.** The spec Data Requirements table (line 174) says `fieldType` is "Data type from DSX requirement". `DSXRequirement` does not have a `dataType` column directly; data type lives inside `requirement.fieldData.dataType` (see `personal-info-fields/route.ts:289` — `dataType: fieldData.dataType || 'text'`). For documents (`fieldType='document'` in OrderData per the data dictionary), the requirement's `type` column is `'document'`. The implementer's rule:
- If `requirement.type === 'document'` → `fieldType = 'document'`.
- Otherwise → `fieldType = (requirement.fieldData?.dataType as string) ?? 'text'`.

This matches the existing OrderData population pattern in `OrderCoreService.createCompleteOrder` lines 538–545 / 558–566 of `order-core.service.ts`, with the bug fix that the static method currently hardcodes `fieldType: 'search'` (a TODO at line 543 explicitly flags this) — Stage 2 does it correctly because we have requirement-type information available.

### 15.3 Document reference handling (Rule 22)
Documents are saved in `formData` as JSON objects with `{ documentId, originalName, storagePath, mimeType, size, uploadedAt }` (per save-route lines 28–34). The `JSON.stringify(v)` branch in §15.2 above handles this correctly — the metadata becomes the OrderData's `fieldValue`. **No file copying or moving.**

### 15.4 Subject fields are NOT written to OrderData
Personal info fields (`formData.sections.personal_info`) go into `Order.subject` (Step 2 of §12), **not** into OrderData. This matches Rule 12 of the spec.

---

## 16. Order.subject Building — Algorithm

`buildOrderSubject(personalInfoSection, invitation, dsxRequirementsLookup)` returns a JSON object keyed by `fieldKey`. Steps:

1. Start with the four locked fields from the invitation:
   ```ts
   const subject = {
     firstName: invitation.firstName,
     lastName: invitation.lastName,
     email: invitation.email,
     ...(invitation.phoneNumber ? {
       phone: (invitation.phoneCountryCode ?? '') + invitation.phoneNumber,
     } : {}),
   };
   ```
2. For each saved field in `personalInfoSection.fields`, look up the requirement in `dsxRequirementsLookup` to get its `fieldKey`. Set `subject[fieldKey] = field.value` (do not stringify objects — `Order.subject` is JSON, not a string column, per the schema at `prisma/schema.prisma:338` `subject Json`).
3. Skip locked fields if they appear in saved data (defense-in-depth — the save endpoint already filters them out, but a defensive skip prevents accidental override).

The helper is pure — no Prisma access. `dsxRequirementsLookup` is built once at the top of `submitApplication`.

---

## 17. ReviewSubmitPage Changes — Detailed Behavior

| User action | Component state change | Network call | UI feedback |
|---|---|---|---|
| Page loads with `summary.allComplete=false` | None | None | Submit button disabled, gray, `submitHelp` shown |
| Page loads with `summary.allComplete=true` | None | None | Submit button enabled, blue palette |
| User taps Submit (enabled) | `submitting=true`, `submitError=null` | `POST /submit` | Button label swaps to `submitting` translation key, button disabled, `aria-busy=true` |
| Server responds 200 success | (host) `router.push(redirectTo)` | — | Browser navigates to success page |
| Server responds 400 validation failure | `submitting=false`, `submitError=t(validationFailed)`, host calls `refreshValidation()` | — | Banner above button shows error text; button re-enables once validation result re-renders (still allComplete=false until refresh, then enables) |
| Server responds 403 expired | `submitting=false`, `submitError=t(expired)` | — | Banner shows expired text; button re-enables (but allComplete check may keep it disabled — that's fine, error banner is the user's signal) |
| Network failure | `submitting=false`, `submitError=t(serverError)` | — | Banner; button re-enables |

---

## 18. Success Page

### 18.1 Existing page check
There is no existing success page in the codebase. Verified via:
- `find /Users/andyhellman/Projects/GlobalRx_v2/src/app/candidate -type d` lists only `[token]`, `[token]/portal`. No `submitted` directory.
- `grep -rn "candidate.submission.success" /Users/andyhellman/Projects/GlobalRx_v2/src/translations/` returns no matches.

### 18.2 Route placement
- Page route: `src/app/candidate/[token]/portal/submitted/page.tsx`. URL: `/candidate/[token]/portal/submitted`.
- This is a sibling of `src/app/candidate/[token]/portal/page.tsx`, so it inherits the existing `[token]/layout.tsx` (which handles authentication scaffolding and the locale provider). No new layout file.

### 18.3 Server-side guard (Edge 8)
The server component at `src/app/candidate/[token]/portal/submitted/page.tsx`:
1. Reads the candidate session via `CandidateSessionService.getSession()`. If null or `sessionData.token !== token`, calls `redirect('/candidate/${token}')` (back to the auth start).
2. Loads the invitation via `prisma.candidateInvitation.findUnique({ where: { token } })`. If `status !== 'completed'`, calls `redirect('/candidate/${token}/portal')` (back to the application form).
3. Renders `<SubmissionSuccessPage />`.

### 18.4 Translation keys
The 9 keys in §10 cover all on-page text plus the candidate-facing messages used by the submit error banner.

---

## 19. Risks and Open Questions

### 19.1 Resolved
- **`changedBy` system identity:** Schema requires User FK. Resolved by using `invitation.createdBy` (the staff user). Documented in §12 Step 9.
- **`ServiceComment.templateId`:** Resolved at runtime by lookup-then-create-if-missing pattern. No migration. Documented in §12 Step 6.
- **`OrderData.fieldName`:** Spec says it is a UUID (the requirement ID). Schema column is `String`. Implementation stores the requirement's UUID as a string. Documented in §15.
- **`OrderData.fieldType`:** Spec says "data type". Schema column is `String`. Implementation derives from `requirement.fieldData.dataType` (or `'document'` for document-type requirements). Documented in §15.2.
- **IDV section key mismatch (engine reads `service_idv` but data is at `idv`):** Resolved as part of TD-062. Documented in §10.4 step 1.
- **Invitation status name (`accessed` vs `in_progress`):** Codebase uses `accessed`. Spec wording is loose. Implementation transitions to `INVITATION_STATUSES.COMPLETED` from whatever-the-current-state-is (does not assert on `accessed`). Documented in §12 Step 10.

### 19.2 Risks the implementer must watch
- **Transaction timeout:** A package with many addresses + many record services could produce dozens of order items with dozens of OrderData rows each. The 30-second default timeout (set explicitly in §11.2 step 9) is generous but not infinite. If a real candidate hits it, the route returns 500 and the candidate can retry — the spec accepts this (Rule 25 — rollback + retry).
- **`OrderCoreService` future refactor:** The submission service replicates `addOrderItem`'s transactional pattern rather than calling it. If the order-core service is later refactored to accept an external `tx` parameter, the submission service should be updated to use the canonical method. Tracked informally — not in scope for Stage 2.
- **Address-block field shape assumption:** The plan assumes the address-block JSON has `{ countryId, stateId?, countyId? }` keys. Verify before implementation by reading a saved address-history record. If the keys differ (`country`, `state`, `county`), the helper signature stays the same but the field names change. The implementer should update §13.3 step 1 to match reality.
- **Personal-info heuristic drift:** §10.3 step 1 reuses the "contains 'personal' or 'subject'" heuristic from `personal-info-fields/route.ts:144–152`. If global configurations later add a true `collectionTab='personal_info'` literal, both this code and the existing route should be updated together. Not a Stage 2 concern.

### 19.3 Open questions
None. The spec's Open Questions section is empty (line 308 — "None — all design decisions have been resolved.") and every uncertainty raised during plan development has been resolved above.

---

## 20. Plan Completeness Check

- [x] Every file the implementer will need to touch is listed in §2 (create) or §3 (modify).
- [x] No file outside this plan will need to be modified. Specifically: `OrderCoreService` is **not** modified (the plan replicates its pattern); `mergeSectionStatus` is **not** modified (validation engine TD-062 fix lives in `validationEngine.ts` and possibly a new sibling helper file already listed in §2); validation `types.ts` is **not** modified; existing API routes other than the new `/submit` route are **not** modified.
- [x] All Zod schemas (none — the endpoint takes no input body), TypeScript types (`src/types/candidate-submission.ts`, `src/lib/candidate/submission/types.ts`), and translation keys (all 11, in all 5 locales) are listed.
- [x] The plan is consistent with the spec's Data Requirements tables (field names, types, and sources match: `OrderItem.id/orderId/serviceId/locationId/status/createdAt`, `ServicesFulfillment.assignedVendorId=null`, `OrderData.orderItemId/fieldName/fieldValue/fieldType`, `Order.statusCode/submittedAt/subject`, `CandidateInvitation.status/completedAt`, `OrderStatusHistory.fromStatus/toStatus/changedBy/isAutomatic/notes`, `ServiceComment.orderItemId/templateId/finalText/isInternalOnly/isStatusChange/createdBy`).
- [x] TD-062 fix is fully specified in §10 with the exact source of field requirements, the helpers reused, and the merge of `mergeSectionStatus` left intact.
- [x] Every one of the 31 Definition of Done items has a corresponding implementation step (§9 Order of Implementation), file (§2 / §3), or response shape (§11.3 / §17).

**This plan is execution-ready for the test-writer.**
