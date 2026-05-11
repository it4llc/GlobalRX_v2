# Phase 7 Stage 2: Submission & Order Item Generation

This document describes the candidate-portal additions delivered in Phase 7 Stage 2. The stage builds directly on the validation engine from Phase 7 Stage 1 and delivers the actual submission path: converting a draft candidate application into a submitted Order with all required database records.

## Scope of This Stage

- A new POST `/api/candidate/application/[token]/submit` endpoint that validates server-side and runs the submission transaction.
- A new submission orchestrator (`submitApplication`) that owns all database writes inside a single atomic transaction.
- New pure helpers for OrderItem-key generation, OrderData population, and Order subject building.
- A success page at `/candidate/[token]/portal/submitted` that the portal shell redirects to after submission.
- A fix for TD-062: Personal Info and IDV sections now validate required DSX field requirements, not just section visit state. Logic lives in a new sibling module `personalInfoIdvFieldChecks.ts`.
- A fix for the education/employment section date extractor: field role identification now uses DSX requirement metadata (dataType + name) as the primary path, with the existing fieldKey alias sets as fallback.
- A fix in `IdvSection.tsx`: the country dropdown now loads from the live `/countries` API instead of a hardcoded static list.
- Submit button activated in `ReviewSubmitPage` — wired to a handler owned by the portal shell.

What this stage does **not** add: confirmation emails, fulfillment workflow triggers beyond status flip, per-entry required-field validation for Address History, Education, and Employment entries (see TD-069).

## New Modules: Submission Library

All modules are in `src/lib/candidate/submission/`.

### `types.ts`

Internal TypeScript interfaces shared across the submission helpers. Not exported from the module publicly. Key types:

- `OrderItemKey` — a `{ serviceId, locationId, source }` triple describing one OrderItem to be created. `source` is a discriminated union carrying provenance by kind: `address`, `education`, `employment`, or `idv`.
- `OrderItemSource` — the discriminated union.
- `SubmissionAddressScope` — the scope shape (scopeType + scopeValue) used by the address-scope filter. A subset of the validation engine's `ResolvedScope`, limited to the four scope types that apply to record services.
- `SavedField`, `SavedRepeatableEntry`, `SavedAddressHistorySection`, `SavedEduEmpSection`, `SavedIdvSection` — parsed views of `CandidateInvitation.formData` sections, typed to avoid direct dependency on the full Prisma model in unit tests.
- `EduEmpEntryForKeys` — minimal entry shape consumed by `buildEduEmpOrderItemKeys`.
- `JurisdictionResolutionResult` — output of the per-address jurisdiction walk.

### `orderItemGeneration.ts`

Pure module (no Prisma access). Exports:

- `selectAddressesInScope(entries, scope, today, addressBlockRequirementId)` — filters address history entries to those within a service's scope. Sorts most-recent-first before applying count-based scopes. For `time_based` scopes, an entry must have a parseable start date and its effective end (or `today` for current addresses) must fall within the window. `isCurrent` entries always sort to the top.
- `resolveJurisdictionForAddress(serviceId, address, availability, addressBlockRequirementId)` — walks DSX availability county → state → country for a single (service, address) pair. Returns the first matching locationId, or `null` when no level has availability.
- `dedupeOrderItemKeys(keys)` — collapses duplicate (serviceId, locationId) pairs using first-source-wins. Intended for the record subset only.
- `buildRecordOrderItemKeys(recordPackageServices, addresses, availability, today, addressBlockRequirementId)` — combines the three helpers above into the full record-type key generation pipeline.
- `buildEduEmpOrderItemKeys(serviceIds, entries, kind)` — one key per (entry × service) for Education and Employment. No deduplication — two entries in the same country produce two keys per service. Entries with a null `countryId` are silently skipped.
- `buildIdvOrderItemKeys(serviceIds, idvCountryId)` — one key per IDV service with `locationId` set to the candidate's selected country. Returns empty when no country is selected.

### `orderDataPopulation.ts`

Pure module (no Prisma access). Exports:

- `OrderDataRow` — the shape of one row as inserted by `tx.orderData.createMany`.
- `DsxRequirementLookup` — minimal requirement columns consumed by the helper (`id`, `type`, `fieldData.dataType`).
- `buildOrderDataRows(input)` — translates one OrderItem's worth of saved form data into `OrderDataRow[]`, driven by the OrderItem's `source.kind`. Rules:
  - `address`: entry fields + section-level `aggregatedFields`.
  - `education` / `employment`: entry fields only.
  - `idv`: section fields excluding the synthetic `idv_country` marker.
  - `fieldValue` is always a string — strings pass through unchanged; everything else is JSON-stringified.
  - `fieldType` is `'document'` when `requirement.type === 'document'`; otherwise `requirement.fieldData.dataType ?? 'text'`.
  - When the matching entry cannot be found in `formData`, returns an empty array (safe no-op).

### `buildOrderSubject.ts`

Pure module (no Prisma access). Exports:

- `buildOrderSubject(input)` — builds the `Order.subject` JSON value. Seeded from the invitation's locked columns (firstName, lastName, email, and phone when present). Saved Personal Info fields are merged in by fieldKey, skipping any whose fieldKey matches a locked key (defense in depth against the save endpoint's locked-field filter). Values are stored as-is in the JSON column — no JSON stringification.
- `InvitationLockedFields`, `SavedPersonalInfoSection`, `DsxRequirementSubjectLookup` — public input types.

### `submitApplication.ts`

The submission orchestrator. Exports:

- `AlreadySubmittedError` — sentinel error class. Thrown inside the transaction when the invitation or order state has shifted between the route's pre-flight guard and the transaction's own re-read. The route catches this and returns the idempotent `200` response rather than a `500`.
- `SubmitApplicationResult` — `{ orderId, orderItemIds, orderDataRowCount }`. Returned on success; used by the route layer for logging.
- `submitApplication(tx, invitationId, today)` — the entry point. Accepts a Prisma transaction client, the invitation ID, and the current timestamp (captured once by the route). Runs the ten-step sequence entirely inside the caller's transaction:

  1. Re-read the invitation + order + package services. Throw `AlreadySubmittedError` if already completed or no longer `draft`.
  2. Build `Order.subject` using `buildOrderSubject`.
  3. Generate all `OrderItemKey` records using the generation helpers.
  4. Create `OrderItem` + `ServicesFulfillment` for each key. The `ServicesFulfillment` row is created with `assignedVendorId: null` per DATABASE_STANDARDS §2.2. This step replicates the `OrderCoreService.addOrderItem` transactional pattern inline because that helper opens its own transaction, which cannot be nested (see TD-074).
  5. Insert `OrderData` rows for each created `OrderItem` using `buildOrderDataRows`.
  6. Resolve the system comment template (`shortName='System'` or `'General'`; creates one if neither exists).
  7. Insert one `ServiceComment` per `OrderItem`, attributed to `invitation.createdBy`.
  8. Update the `Order`: `statusCode = 'submitted'`, `submittedAt = today`, `subject = <built subject>`.
  9. Insert an `OrderStatusHistory` row: `fromStatus='draft'`, `toStatus='submitted'`, `isAutomatic=true`.
  10. Update `CandidateInvitation`: `status='completed'`, `completedAt=today`.

All ten steps share the same transaction client — if any step throws, the entire transaction rolls back and the order remains in `draft` state.

## New Module: Validation Helper

### `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`

Sibling helper to `validationEngine.ts`. Owns the Personal Info and IDV required-field checking that was absent before this stage (TD-062 fix). Exports:

- `collectPersonalInfoFieldRequirements(packageServices, findMappings)` — walks every service's `serviceRequirements`, filters to field-type non-disabled personal-info-tab requirements, and AND-aggregates `isRequired` across applicable `(serviceId, locationId)` pairs using the same logic as the `/personal-info-fields` endpoint. The `findMappings` callback is injected so the helper can be unit-tested without a Prisma client.
- `collectIdvFieldRequirements(packageServices, selectedCountryId, findMappings)` — same pattern for IDV-functionality services at the candidate's selected country. Excludes requirements that also satisfy the `isPersonalInfoField` heuristic to avoid flagging `firstName`/`lastName`/`email` as missing IDV fields.
- `checkRequiredFields(input)` — emits a `FieldError` for every required requirement whose saved value is missing or empty. Accepts a `lockedValues` map so invitation-column fields (firstName, lastName, email, phone) count as satisfied without being in the `savedFields` array.
- `validatePersonalInfoSection(input)` — drop-in replacement for the engine's old `validateNonScopedSection` call for `personal_info`. The engine passes a `deriveStatus` callback so this helper does not need to import the engine's `deriveStatusWithErrors` directly.
- `validateIdvSection(input)` — same for IDV. Reads from `sectionsData['idv']` (the correct save-endpoint key), not from `sectionsData['service_idv']` (the sidebar/section-result key). When no country is selected, emits one `fieldRequired` error with message key `candidate.validation.idvCountryRequired` and skips per-field checks.
- `IDV_COUNTRY_MARKER` (exported constant `'idv_country'`) — the synthetic requirementId used to persist the IDV country selection inside the flat-fields array.
- `RequiredFieldDescriptor`, `DsxMappingRow`, `FindDsxMappings` — public types used by callers and tests.

## Modified Modules

### `src/lib/candidate/validation/validationEngine.ts`

- Extended the `packageServices` include to pull `serviceRequirements` (with `requirement`) and `availability` so the TD-062 helpers have the data they need without an extra round-trip.
- Added a `requirementMetadata` map (`requirementId → { fieldKey, name, dataType }`) built from the extended include and passed into `validateEducationSection` and `validateEmploymentSection`.
- Replaced `validateNonScopedSection` calls for `personal_info` and `service_idv` with `validatePersonalInfoSection` and `validateIdvSection` from `personalInfoIdvFieldChecks.ts`.
- Fixed the education and employment section's `sectionData` lookup keys: `'service_verification-edu'` and `'service_verification-emp'` were corrected to `'education'` and `'employment'` — the keys the save endpoint actually writes (TD-071 fix).
- Added `buildFindMappings()` — a private adapter that wraps `prisma.dSXMapping.findMany` and satisfies the injected `FindDsxMappings` callback signature. **Phase 7 Stage 3a note:** this adapter was subsequently moved to `loadValidationInputs.ts` as part of the validation engine split.

### `src/lib/candidate/validation/dateExtractors.ts`

- Added `RequirementMetadata` interface (`fieldKey`, `name`, `dataType`), now exported.
- Updated `extractEmploymentEntryDates` signature: accepts an optional `requirementMetadata: Map<string, RequirementMetadata>` third parameter.
- Primary identification path: when metadata is available for a key, field role (`start`, `end`, `current`) is determined from `dataType` and `name` substring matching. This makes the extractor work for package configurations that use auto-generated UUID-based fieldKeys.
- Fallback path: the legacy camelCase alias sets from `employmentDateFieldKeys.ts` are still consulted when the metadata path does not produce a role assignment.
- `parseBooleanValue` now unwraps single-element arrays before checking the boolean/string value. This handles the form engine's checkbox save shape.

### `src/components/candidate/form-engine/IdvSection.tsx`

- Country list now loaded from `/api/candidate/application/${token}/countries` instead of a hardcoded static array. Using the live API is required because `Country.id` is a UUID — a static stand-in like `'US'` would be rejected by submission when it is written to `OrderItem.locationId` (FK to `Country.id`).
- Added `countriesError` state: when the API call fails, the country dropdown is cleared and an alert is rendered using the `candidate.portal.countriesLoadError` translation key.
- IDV country hydration on saved-data load now reads from the `idv_country` synthetic field row instead of a `sections.idv.country` top-level key. The save handler does not write a top-level `country` key; the flat-field row is the only authoritative location.
- Added `CountryApiResponse` interface typing the `/countries` response shape.

### `src/components/candidate/review-submit/ReviewSubmitPage.tsx`

- Added three new optional props: `onSubmit`, `submitting`, and `submitError`.
- Submit button is now enabled when `validationResult.summary.allComplete === true` and `onSubmit` is provided and `submitting` is `false`. When not all conditions are met, the button uses the muted gray disabled style; when all are met it uses the active blue palette.
- When `submitting` is `true`, the button label swaps to the `candidate.submission.submitting` translation key and `aria-busy` is set.
- When `submitError` is a non-null string, a `role="alert"` error banner renders above the button using the `.form-error` class.
- All new props are optional for backward compatibility with Stage 1 tests that do not pass them.

### `src/components/candidate/portal-layout.tsx`

- Added `submitting` and `submitError` state.
- Added `handleSubmit` callback (wrapped in `useCallback`): calls `POST /submit`, handles the five response shapes (success, already-submitted, validation failure, expired, server error), triggers `refreshValidation()` on 400, and navigates via `router.push(redirectTo)` on 200 success.
- Passes `onSubmit`, `submitting`, and `submitError` down to `ReviewSubmitPage`.

## New Pages

### `src/app/candidate/[token]/portal/submitted/page.tsx`

Server component at route `GET /candidate/[token]/portal/submitted`. Guards access:
1. Validates the candidate session; redirects to `/candidate/[token]` if missing or mismatched.
2. Loads the invitation status. Redirects to `/candidate/[token]/portal` if the invitation is not found or is not `completed`.
3. When the invitation is `completed`, renders `SubmissionSuccessPage`.

### `src/components/candidate/review-submit/SubmissionSuccessPage.tsx`

Presentational client component rendered by the submitted route. Displays a checkmark icon, confirmation title (`candidate.submission.success.title`), confirmation message, and a "What happens next?" section. No navigation affordances, no order details — intentionally information-minimal per spec Rule 17.

## New Types Module

### `src/types/candidate-submission.ts`

Public TypeScript interfaces for the POST `/submit` response surface. Exported types:

- `SubmitSuccessResponse` — `{ success: true, message, redirectTo }`.
- `SubmitAlreadySubmittedResponse` — same shape as success; both return 200.
- `SubmitValidationFailureResponse` — `{ success: false, error: 'Validation failed', validationResult: FullValidationResult }`.
- `SubmitExpiredResponse` — `{ success: false, error: 'This invitation has expired' }`.
- `SubmitErrorResponse` — `{ success: false, error: string }`.
- `SubmitResponse` — discriminated union of the above.

These are TypeScript interfaces (not Zod schemas) because the endpoint takes no request body — they describe response payloads only.

## Translation Keys

11 new keys added to all five locale files (`en-US`, `en-GB`, `es-ES`, `es`, `ja-JP`):

| Key | Purpose |
|-----|---------|
| `candidate.submission.success.title` | Success page heading |
| `candidate.submission.success.message` | Success page body |
| `candidate.submission.success.whatNext` | "What happens next?" section heading |
| `candidate.submission.success.nextSteps` | "What happens next?" body |
| `candidate.submission.submitting` | Submit button loading-state label |
| `candidate.submission.error.expired` | Banner when invitation expired |
| `candidate.submission.error.alreadySubmitted` | Banner when already submitted (not currently surfaced in portal but available) |
| `candidate.submission.error.validationFailed` | Banner when server-side validation blocks submission |
| `candidate.submission.error.serverError` | Banner for 500/network errors |
| `candidate.validation.fieldRequired` | Generic required-field error (used by TD-062 path) |
| `candidate.validation.idvCountryRequired` | IDV country selection required error |

**Phase 7 Stage 3b addition:** One additional key was added to all five locale files by the TD-069 fix:

| Key | Purpose |
|-----|---------|
| `candidate.validation.entryCountryRequired` | Error shown when a repeatable entry has no saved country; emitted by the per-entry walk in `repeatableEntryFieldChecks.ts` |

## OrderItem / ServicesFulfillment Invariant

Per DATABASE_STANDARDS §2.2, every `OrderItem` must have a paired `ServicesFulfillment` row created in the same transaction. The submission orchestrator replicates the `OrderCoreService.addOrderItem` transactional pattern inline because the static helper opens its own transaction and cannot be nested (see TD-074). The invariant is preserved: for every key in `finalKeys`, one `OrderItem` and one `ServicesFulfillment` are created atomically before proceeding to Step 5. `ServicesFulfillment.assignedVendorId` is always `null` at creation — vendor assignment happens later in the fulfillment workflow.

## formData Key Conventions

This stage depends on the following `CandidateInvitation.formData` key conventions, which are now binding:

| Section | `formData.sections` key | Save endpoint sectionType |
|---------|------------------------|---------------------------|
| Personal Info | `personal_info` | `personal_info` |
| Address History | `address_history` | `address_history` |
| Education | `education` | `education` |
| Employment | `employment` | `employment` |
| IDV | `idv` | `idv` |

The IDV section stores the selected country as a flat field row with `requirementId === 'idv_country'` inside `fields`. This is a synthetic marker (not a DSX requirement UUID). The submission orchestrator (`readIdvCountryId`) and `IdvSection.tsx` both read from this row. No top-level `sections.idv.country` key is written.

## Known Limitations and Deferred Items

See TD-067 through TD-076 in `docs/TECH_DEBT.md`.

Key items:
- **TD-069** — **Resolved in Phase 7 Stage 3b** (`feature/phase7-stage3b-per-entry-validation-and-idv-country-clear`). Per-entry required-field validation now runs for Address History, Education, and Employment. Each entry is validated against its own country's required-field rules. Address-block fields are walked piece-by-piece using `DSXRequirement.fieldData.addressConfig`. The `fieldErrors` array in `SectionValidationResult` is now non-empty when entries have missing required fields, and `summary.allComplete` blocks submission accordingly.
- **TD-072** — **Resolved in Phase 7 Stage 3b** (`feature/phase7-stage3b-per-entry-validation-and-idv-country-clear`). IDV country-switch now clears stale per-country field data from `formData` before loading the new country's fields. The next save's `pendingSaves` payload contains only the new country's requirementIds. Follow-up automation for the race condition is tracked under TD-083.
- **TD-073**: Education/Employment date extractor is locale-dependent; non-English requirement names fall back to alias sets and silently produce no date when aliases also miss.
- **TD-074**: `submitApplication.ts` replicates `OrderCoreService.addOrderItem` inline due to transaction-nesting constraints. The replication must be kept in sync with any future changes to that service.
