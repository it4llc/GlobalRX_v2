# Feature Specification: Convert `idv` Functionality Type to `verification-idv`

**Spec file:** `docs/specs/verification-idv-conversion.md`
**Date:** May 12, 2026
**Requested by:** Andy
**Status:** Confirmed

---

## Summary

Today the platform has four `functionalityType` values for services in the
`services` table: `record`, `verification-edu`, `verification-emp`, `other`,
and a fifth de-facto value `idv` that exists in the UI and in source code but
was never added to the API validation allow-list. The Identity Verification
("IDV") section in the candidate portal currently lives on its own special
path through the codebase — bespoke section bucket, bespoke validation
helper, bespoke type guards — instead of following the same wiring as
education and employment verifications.

This feature converts the bare string `"idv"` to `"verification-idv"`
everywhere it appears, so ID verification becomes the third member of the
`verification-*` family alongside `verification-edu` and `verification-emp`.
This is a **rename + behavioral conversion**, not a parallel feature: the old
`"idv"` value is being replaced, and once this work ships there is no
remaining code path that consumes the string `"idv"` as a functionality
type. The conversion also fixes a known inconsistency — `"idv"` is currently
in the admin Services UI dropdown but missing from the `VALID_FUNCTIONALITY_TYPES`
allow-list in `/api/services` POST validation, so any service saved with
that type today silently gets coerced to `"other"`.

The work also addresses a structural quirk: IDV will continue to have exactly
one entry per candidate (you don't have "two identities"), but it will be
expressed as a verification with `scope` fixed to 1 and no
user-facing scope/count selector — the same field-and-document collection
pattern as education/employment, just with the count locked.

---

## Decisions (Resolved Open Questions)

The following decisions were made by Andy on 2026-05-12 and are baked into
the rules below. They are recorded here so future readers see the rationale
without having to dig through chat history.

1. **Production data row exists and must be migrated.** Exactly one row in
   production today has `functionalityType = 'idv'`:
   - `id`: `8388bb60-48e4-4781-a867-7c86b51be776`
   - `name`: `ID Verification`
   - `category`: `IDV`
   The data migration **must** UPDATE this row to
   `functionalityType = 'verification-idv'` before the API starts rejecting
   `"idv"`. Sequencing is mandatory — see Migration Concerns.

2. **`package_services.scope` shape for verification-idv is explicit.**
   Store as `{ "type": "count_exact", "quantity": 1 }`, not null. This is
   symmetric with how other count-bearing scopes are stored and avoids the
   `normalizeRawScope` "all" fallback that would be wrong for IDV.

3. **API hard-rejects `"idv"` with 400.** `/api/services` POST, PUT, and
   PATCH must reject the bare string `"idv"` with HTTP 400 going forward.
   No silent coercion to `"other"`. The shared `FUNCTIONALITY_TYPES`
   constant (decision 6) no longer contains `"idv"`. **Sequencing
   requirement:** the production-data migration in decision 1 must run
   first; the API rejection takes effect only after the migration
   completes.

4. **`ScopeFunctionalityType` union is extended (Option A).** Add
   `verification-idv` to the union in `packageScopeShape.ts` so IDV joins
   the same per-functionality grouping as edu/emp/record. The bespoke
   `hasIdv` dispatch in `validationEngine.ts` is dropped or refactored so
   verification-idv flows through the same code paths as edu and emp.

5. **Internal markers stay unchanged.** The following are NOT
   functionality-type strings and must NOT be renamed:
   - The save-route `sectionType: 'idv'` enum value
   - The `IDV_COUNTRY_MARKER = 'idv_country'` constant in
     `personalInfoIdvFieldChecks.ts` and `orderDataPopulation.ts`
   - The `OrderItemSource.kind: 'idv'` provenance discriminator in
     `submission/types.ts` (and the matching `case 'idv':` branch in
     `orderDataPopulation.ts` line 220)

   These are save-data bucket keys, synthetic markers, and internal
   provenance discriminators — they are pinned by DATABASE_STANDARDS §2.4
   and renaming them would invalidate in-flight candidate sessions or
   muddle internal contracts. **This is the most common place for the
   implementer to make a mistake — re-emphasized in Business Rules and
   Out of Scope.**

6. **Shared constants module.** Create
   `src/constants/functionality-types.ts` as the single source of truth
   for the `FUNCTIONALITY_TYPES` array and the TypeScript
   `FunctionalityType` union. All API validation (POST/PUT/PATCH),
   UI dropdowns, and seeds import from this module. After this change,
   `"idv"` does not appear in this file — it is replaced by
   `"verification-idv"`.

7. **UI grep deferred to architect.** Whether any UI/router/analytics
   code keys off the section id `service_idv` or the literal string
   `"idv"` in client code is an architect-stage verification step, not
   a BA-stage gap. The architect must grep client-side code (router,
   analytics, persisted user state, deep links) before implementation.

---

## Who Uses This

- **Internal admin / Global Configurations user** — creates and edits
  Service records and picks `functionalityType` from a dropdown. After this
  change, the dropdown shows `verification-idv` instead of `idv` and the API
  accepts the new value (and rejects the old one with 400).

- **Internal admin / Customer Configurations user** — assembles packages
  containing services. When the package includes a `verification-idv`
  service, the admin sees the same UI affordances as for `verification-edu`
  and `verification-emp` (the service appears in the package's service list,
  contributes to the rendered package summary). The admin does NOT see a
  scope/count selector for verification-idv — scope is fixed at 1.

- **Candidate** — fills out the application from an invitation link. When
  the candidate's package contains a `verification-idv` service, the portal
  shows an "Identity Verification" section that walks the candidate through
  selecting a country, then renders the country-specific DSX fields and
  documents the same way the Education and Employment sections do for their
  per-entry country.

- **Customer (indirectly)** — submitted orders correctly carry one
  `OrderItem` per IDV service in the package, with `locationId` set to the
  candidate-selected country. This is unchanged from today's behavior — the
  conversion preserves the existing data shape on the order side.

---

## Business Rules

1. The Service model's `functionalityType` allow-list is changed to
   exactly: `record`, `verification-edu`, `verification-emp`,
   `verification-idv`, `other`. The bare string `"idv"` is no longer a
   valid value.

2. The admin Services UI dropdown shows the value `verification-idv` (the
   user-facing label may stay "Identity Verification" — labels are
   cosmetic and tracked separately from the stored value).

3. The `/api/services` POST, PUT, and PATCH endpoints accept
   `verification-idv` as a valid `functionalityType`. They **reject
   `"idv"` with HTTP 400** and an explicit "Unknown functionality type"
   error. There is no silent coercion to `"other"` for `"idv"`. PUT and
   PATCH currently have no functionality-type validation at all (only
   POST does); the conversion must add the same allow-list check to PUT
   and PATCH so the rename can be enforced uniformly. All three handlers
   import the allow-list from
   `src/constants/functionality-types.ts` (see BR 14).

4. `Service.functionalityType === 'verification-idv'` is the ONLY
   server-side signal that a service is identity-verification. Code that
   currently branches on `=== 'idv'` is updated to branch on
   `=== 'verification-idv'`. There is no fallback to the old string.

5. Identity verification scope is permanently fixed to "exactly one
   entry per candidate." The package configuration UI does **not**
   render a scope selector or count input for `verification-idv`
   services. The `package_services.scope` JSON column for IDV services
   is set on save to **`{ "type": "count_exact", "quantity": 1 }`**
   (not null). This is symmetric with other count-bearing scopes and
   avoids the `normalizeRawScope` "all" fallback. The data migration
   normalizes any pre-existing IDV `package_services.scope` rows to
   this same value.

6. The candidate portal renders an IDV section when the package contains
   at least one `verification-idv` service. The section UI is unchanged
   from today's `IdvSection.tsx`: country picker on top, dynamic DSX
   fields below, save on blur. It is NOT being re-skinned in this work.

7. The DSX field list for the IDV section is fetched via
   `/api/candidate/application/[token]/fields` using the same per-country,
   per-service request shape as Education and Employment. The TD-084
   OR-merge of `isRequired` across every `(serviceId, countryId)` mapping
   row applies automatically — verification-idv inherits the
   `verification-*` family's request flow and gets the per-country
   required-indicator behavior with no extra wiring.

8. **Internal markers are NOT renamed.** The candidate save-route
   `sectionType` enum continues to accept `'idv'` as the saved-data
   bucket key. The `IDV_COUNTRY_MARKER = 'idv_country'` constant in
   `personalInfoIdvFieldChecks.ts` and `orderDataPopulation.ts` stays
   exactly as `'idv_country'`. The `OrderItemSource.kind: 'idv'`
   discriminator in `submission/types.ts` and the matching
   `case 'idv':` branch in `orderDataPopulation.ts` line 220 stay
   exactly as `'idv'`. DATABASE_STANDARDS §2.4 pins these — they are
   save-data bucket keys, synthetic markers, and internal provenance
   discriminators, not functionality types. The functionality-type
   rename (Service.functionalityType `idv` → `verification-idv`) is
   **separate** from these markers. Code that crosses both — the
   submission orchestrator, the validation engine, the section
   components — must be careful not to conflate them.

9. The submission pipeline (`submitApplication.ts` →
   `buildIdvOrderItemKeys`) continues to emit exactly one OrderItem per
   IDV service per submission, with `locationId` set to the
   candidate-selected country. Behavior identical to today; only the
   functionality-type filter string at the top of `submitApplication.ts`
   line 348 changes from `'idv'` to `'verification-idv'`.

10. The structure endpoint's hardcoded `serviceTypeOrder` list and
    `serviceTitleMap` (structure/route.ts lines 286–292) replace `'idv'`
    with `'verification-idv'`. The display order (IDV first, then
    record, then edu, then emp) is preserved.

11. The production row with `id = '8388bb60-48e4-4781-a867-7c86b51be776'`
    (name "ID Verification", functionalityType `'idv'`) must be migrated
    to `functionalityType = 'verification-idv'` in the same release. A
    data migration is required (see Migration Concerns).

12. Existing OrderItems already created with services whose
    functionality type was `idv` at the time of order placement are
    **not** affected by this work — `OrderItem.serviceId` is a foreign
    key to `services.id`, and the service's functionality type is
    looked up live at validation/submission time. When the underlying
    `services` row is migrated, the existing OrderItem's effective
    type updates automatically. No data migration on
    `order_items` / `services_fulfillment` is needed.

13. Test fixtures, seeds, and mocks that hardcode `"idv"` are updated to
    `"verification-idv"` in the same PR. Tests that exercise the
    `idv`-as-section-bucket behavior (the save-route enum) and the
    `idv_country` marker and the `OrderItemSource.kind: 'idv'` literal
    are **not** changed — see BR 8.

14. **Shared constants module.** A new file
    `src/constants/functionality-types.ts` exports the
    `FUNCTIONALITY_TYPES` array (`['record', 'verification-edu',
    'verification-emp', 'verification-idv', 'other']`) and the
    TypeScript `FunctionalityType` union derived from it. The
    `/api/services` POST/PUT/PATCH handlers, the admin UI dropdown,
    and any seeds import from this module. `"idv"` does not appear in
    this file.

15. **`ScopeFunctionalityType` union extension.**
    `packageScopeShape.ts`'s `ScopeFunctionalityType` union gains
    `verification-idv` as a fourth member, symmetric with
    `verification-edu` and `verification-emp`. The bespoke `hasIdv`
    dispatch in `validationEngine.ts` is dropped or refactored so
    verification-idv flows through the same per-functionality grouping
    as edu and emp. `normalizeRawScope` must handle the
    `verification-idv` case by returning a fixed
    `{ scopeType: 'count_exact', scopeValue: 1 }` regardless of stored
    scope shape (defensive: even if a stale row has a different shape,
    IDV always means "exactly one").

---

## User Flow

### Internal admin — creating an IDV service in Global Configurations

1. The admin navigates to the Services configuration page.
2. They click "Create Service" (or edit an existing one).
3. The service form shows a "Functionality Type" dropdown.
4. The dropdown options are, in order: `record`, `verification-edu`,
   `verification-emp`, `verification-idv`, `other`. (Display labels may be
   "Record check", "Education verification", "Employment verification",
   "Identity verification", "Other" — final label copy is at Andy's
   discretion since labels are cosmetic.)
5. The admin selects `verification-idv` and fills in the rest of the
   form.
6. On save, the POST/PUT request goes to `/api/services`. The API
   validates that `functionalityType` is in the allow-list and persists
   it. The service record now has `functionalityType: 'verification-idv'`.
   If a stale client sends `"idv"`, the API returns 400.

### Internal admin — adding an IDV service to a package

1. The admin navigates to Customer Configurations → the customer → Packages.
2. They open a package and click "Add service" (or similar).
3. The service picker shows the customer's allowed services. The
   `verification-idv` service is listed alongside other allowed services.
4. The admin selects it. The package builder adds the service to the
   package. **No scope/count selector is rendered** for the IDV service
   (unlike verification-edu and verification-emp which expose
   "highest degree" / "all degrees" / etc. and a count selector).
5. On save, a `package_services` row is created with
   `scope = { "type": "count_exact", "quantity": 1 }` per BR 5.

### Candidate — completing an IDV section

This flow is unchanged from today's behavior. After the rename:

1. The candidate logs into the portal.
2. The sidebar shows an "Identity Verification" entry alongside other
   sections.
3. The candidate clicks it. The section renders the country picker.
4. The candidate selects a country. The form fetches DSX fields for
   that country (one or more services × the selected country) via
   `/api/candidate/application/[token]/fields`. Required indicators
   are OR-merged across services per TD-084.
5. The candidate fills in the fields and uploads any required documents.
   Each blur triggers an auto-save to
   `/api/candidate/application/[token]/save` with `sectionType: 'idv'`
   (see BR 8 — the save-bucket key is unchanged).
6. The section progress indicator (`computeIdvStatus`) shows
   `not_started` → `incomplete` → `complete` as fields are filled.
7. When the candidate clicks "Submit," the validation engine confirms
   all required IDV fields have values and the submission orchestrator
   creates one OrderItem per IDV service with `locationId` set to the
   candidate's selected country.

---

## Data Requirements

This feature does not add new database columns. It changes the **allowed
values** for an existing column (`services.functionalityType`), the
**accepted strings** in several Zod schemas / TypeScript unions, and the
**stored shape** of `package_services.scope` for IDV services.

### `services.functionalityType` allowed values

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (dropdown option) | `functionalityType` | text | Required | Must be one of: `record`, `verification-edu`, `verification-emp`, `verification-idv`, `other`. Sourced from `src/constants/functionality-types.ts`. | `other` |

The column type stays `String`. There is no enum at the database level —
the allow-list is enforced in API validation against the shared constants
module (BR 14). The DATA_DICTIONARY.md description of the
`services.functionalityType` field must be updated to replace `idv` with
`verification-idv` in its list of valid values (line 133 of the dictionary
as currently written).

### Save-route `sectionType` enum (UNCHANGED)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (request body) | `sectionType` | text | Required | Must be one of: `personal_info`, `idv`, `address_history`, `education`, `employment`, `workflow_section`, `service_section`, `section_visit_tracking` | — |

**This stays `idv`** — see Business Rule 8. The
DATABASE_STANDARDS Section 2.4 contract pins this to the save-route's
enum, and renaming it would invalidate existing `CandidateInvitation.formData`
rows mid-flight. This is a deliberate split.

### Synthetic IDV markers (UNCHANGED)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (in saved data) | `idv_country` | text | Required at submit | The selected country's `Country.id` UUID, stored as a saved field with `requirementId === 'idv_country'` | — |

The `IDV_COUNTRY_MARKER` constant in
`src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` and the
mirrored constant in `src/lib/candidate/submission/orderDataPopulation.ts`
both stay as `'idv_country'`. They name a synthetic save-data marker, not
a functionality type.

### `package_services.scope` for verification-idv

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (not exposed in UI) | `scope` | JSON | Required (non-null) | Must be exactly `{ "type": "count_exact", "quantity": 1 }` | `{ "type": "count_exact", "quantity": 1 }` |

Per Decision 2 / BR 5, this shape is mandatory for verification-idv
`package_services` rows. The `normalizeRawScope` function in
`packageScopeShape.ts` must be extended (BR 15) to handle the
`verification-idv` functionality type and resolve it to
`{ scopeType: 'count_exact', scopeValue: 1 }`. The data migration
normalizes any pre-existing IDV rows to this shape.

---

## Current-State Audit

This is the exhaustive inventory of every place `"idv"` (the bare
functionality-type string) is referenced today, plus its
verification-edu / verification-emp counterparts so the gap is concrete.
The audit was performed by reading the files directly; line numbers
reflect the state of `main` as of commit `13c3f6e` (the latest commit
on `feature/td-084-required-indicator-per-country` at the time of
writing).

### 1. API validation — `/api/services`

**File:** `src/app/api/services/route.ts`

- Line 9 declares the allow-list:
  ```typescript
  const VALID_FUNCTIONALITY_TYPES = ["record", "verification-edu", "verification-emp", "other"];
  ```
  **`idv` is missing.** This is the known inconsistency. The
  conversion replaces this inline array with an import from
  `src/constants/functionality-types.ts` (BR 14). The order must
  be preserved as displayed in the UI dropdown — the architect should
  confirm whether ordering matches the structure endpoint's
  `serviceTypeOrder` (which puts IDV first).

- Line 174 uses the allow-list to coerce invalid values to `"other"`:
  ```typescript
  const validFunctionalityType = VALID_FUNCTIONALITY_TYPES.includes(functionalityType)
    ? functionalityType
    : "other";
  ```
  **This coercion behavior is changed.** Per Decision 3 / BR 3, the
  API now **rejects** unknown functionality types (including `"idv"`)
  with HTTP 400 and an explicit "Unknown functionality type" error,
  instead of silently coercing to `"other"`.

**File:** `src/app/api/services/[id]/route.ts`

- PUT handler lines 71–125: no validation of `functionalityType`
  against the allow-list. Accepts any string. Conversion: add the
  same validation here, importing from
  `src/constants/functionality-types.ts` (BR 14).

- PATCH handler lines 128–190: same gap, same fix.

**Comparable verification-edu/emp behavior:** the allow-list at line 9
already includes the other two `verification-*` values, so no other
changes are needed in this file beyond adding the third member.

### 2. Candidate portal structure endpoint

**File:** `src/app/api/candidate/application/[token]/structure/route.ts`

- Line 54 (JSDoc): documents the response shape with
  `functionalityType?: string // For service sections: idv, record, verification-edu, verification-emp`.
  Conversion: replace `idv` with `verification-idv`.

- Line 163: scope-grouping branch explicitly excludes IDV:
  ```typescript
  if (funcType !== 'record' && funcType !== 'verification-edu' && funcType !== 'verification-emp') continue;
  ```
  This filter was deliberate because IDV had no scope concept. Per
  Decision 4 / BR 15, IDV now joins the per-functionality grouping
  via `ScopeFunctionalityType`, so this filter must be updated to
  include `verification-idv`. The grouping then resolves IDV's scope
  via `normalizeRawScope` (which returns
  `{ scopeType: 'count_exact', scopeValue: 1 }` for IDV).

- Lines 286–292: hardcoded service-section ordering and title map:
  ```typescript
  const serviceTypeOrder = ['idv', 'record', 'verification-edu', 'verification-emp'];
  const serviceTitleMap: Record<string, string> = {
    'idv': 'candidate.portal.sections.identityVerification',
    'record': ...,
    'verification-edu': ...,
    'verification-emp': ...
  };
  ```
  Conversion: replace both keys `'idv'` with `'verification-idv'`.
  The translation key stays as `candidate.portal.sections.identityVerification`.

- Lines 332–343: builds the service section. The `id` for non-record
  sections is `service_${funcType}` (line 333), so after conversion
  the IDV section's sidebar id becomes `service_verification-idv`
  instead of `service_idv`. **This is a contract change that ripples
  into the validation engine** — see item 3.

**Comparable verification-edu/emp behavior:** identical wiring. Once
IDV is renamed, the three verification types are siblings in the
`serviceTypeOrder` array and the title map.

### 3. Candidate validation engine

**File:** `src/lib/candidate/validation/validationEngine.ts`

- Line 207 — `hasIdv` check:
  ```typescript
  const hasIdv = orderedPackage.packageServices.some(
    (ps) => ps.service?.functionalityType === 'idv',
  );
  ```
  Per Decision 4 / BR 15, the bespoke `hasIdv` dispatch is dropped or
  refactored so verification-idv flows through the same
  per-functionality grouping as edu and emp. The architect chooses the
  cleanest refactor — likely removing `hasIdv` entirely and letting
  IDV fall out of the same grouping branch that handles edu/emp.

- Line 211 — section ID for the IDV result:
  ```typescript
  sectionId: 'service_idv',
  ```
  This is the SectionValidationResult.sectionId. Conversion: change
  to `'service_verification-idv'` so it matches the structure
  endpoint's new section id (item 2 above). The comment block at
  lines 202–205 ("Section bucket is keyed `idv` ... we keep the
  SectionValidationResult.sectionId as `service_idv`...") becomes
  stale — the new value is `service_verification-idv` because that's
  what the structure endpoint emits.

- Line 212 — saved-data lookup key:
  ```typescript
  idvSectionData: sectionsData['idv'],
  ```
  **This stays `'idv'`** — it's the save-route bucket key (BR 8). The
  comment on line 202–204 explicitly calls out this distinction and
  must be updated to reflect the post-conversion state.

**File:** `src/lib/candidate/validation/loadValidationInputs.ts`

- Lines 199–208: `servicesByType` grouping currently only accepts
  `verification-edu`, `verification-emp`, and `record`. Per Decision 4 /
  BR 15, add `verification-idv` to the allowed-types check at line 200.
  This pairs with the `ScopeFunctionalityType` extension (item 5
  below).

### 4. Candidate validation — Personal Info / IDV field checks

**File:** `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`

- Line 325 — the IDV service filter:
  ```typescript
  if (ps.service.functionalityType === 'idv') {
    idvServiceIds.push(ps.service.id);
  }
  ```
  Conversion: change to `'verification-idv'`.

- Line 123 — the `IDV_COUNTRY_MARKER` constant value (`'idv_country'`).
  **This stays unchanged** — it's a save-data marker name, not a
  functionality-type. See BR 8 and the Data Requirements table.

### 5. Candidate validation — packageScopeShape

**File:** `src/lib/candidate/validation/packageScopeShape.ts`

- Lines 59–62: the `ScopeFunctionalityType` union:
  ```typescript
  export type ScopeFunctionalityType =
    | 'verification-edu'
    | 'verification-emp'
    | 'record';
  ```
  Per Decision 4 / BR 15, this union gains `verification-idv` as a
  fourth member. `normalizeRawScope` must be extended to handle the
  `verification-idv` case by returning
  `{ scopeType: 'count_exact', scopeValue: 1 }` regardless of any
  stored scope shape (defensive: IDV always means "exactly one").

### 6. Candidate submission — orchestrator

**File:** `src/lib/candidate/submission/submitApplication.ts`

- Line 348 — IDV service filter:
  ```typescript
  const idvServiceIds = packageServices
    .filter((ps) => ps.service?.functionalityType === 'idv')
    .map((ps) => ps.service.id);
  ```
  Conversion: change `'idv'` to `'verification-idv'`.

- The `idvCountryId` extraction higher up in the file (search for
  `readIdvCountryId`) reads from `sectionsData['idv']` per BR 8;
  **stays `'idv'`**.

### 7. Candidate submission — order item generation

**File:** `src/lib/candidate/submission/orderItemGeneration.ts`

- Lines 422–446: `buildIdvOrderItemKeys` function. Its **logic is
  unchanged** — it takes serviceIds and a country and emits one
  OrderItemKey per service. Comments referencing "IDV" or
  "verification-idv" are cosmetic. Function name stays
  `buildIdvOrderItemKeys` (matches the file's existing naming
  convention).

**File:** `src/lib/candidate/submission/types.ts`

- Line 23: `OrderItemSource` discriminated union includes
  `{ kind: 'idv'; countryId: string }`. Per Decision 5 / BR 8, the
  `kind: 'idv'` discriminator **stays unchanged** — it is a private
  internal provenance tag, not a functionality-type string.

### 8. Candidate submission — order data population

**File:** `src/lib/candidate/submission/orderDataPopulation.ts`

- Line 66 — local `IDV_COUNTRY_MARKER = 'idv_country'` constant.
  **Stays unchanged** — same marker as item 4.

- Line 220: `case 'idv':` branch in the `switch (source.kind)`. Per
  Decision 5 / BR 8, this **stays unchanged** — it's paired with the
  unchanged `OrderItemSource.kind: 'idv'` discriminator in item 7.

### 9. Candidate portal layout — IDV section component

**File:** `src/components/candidate/portal-layout.tsx`

- Line 13: imports `{ IdvSection }` from
  `./form-engine/IdvSection`. **Unchanged** — the component file
  name and import name are cosmetic.

- The layout dispatches to `IdvSection` based on the section's
  `functionalityType === 'idv'` (would need to verify by reading
  the full file — based on the structure-endpoint contract, after
  conversion the dispatch will use `'verification-idv'` here).
  **Per Decision 7, the architect must grep this file (and all UI /
  router / analytics code) for any string equality against `'idv'`
  and update accordingly. This is an architect-stage verification
  step.**

**File:** `src/components/candidate/form-engine/IdvSection.tsx`

- Line 367: save call sends `sectionType: 'idv'`. **Unchanged** —
  this is the save-route bucket key (BR 8).

- Line 393: error log includes `sectionId: 'idv'`. **Unchanged** —
  same reason. (The logger metadata is just a string label, not
  the save-route key, but using `'idv'` keeps log queries
  consistent with the saved bucket name.)

- Line 162: reads `idv_country` from saved data. **Unchanged** —
  same marker.

- The component name `IdvSection` and its file path
  (`form-engine/IdvSection.tsx`) are unchanged. Component names are
  cosmetic.

### 10. Customer-side packages API

**File:** `src/app/api/customers/[id]/packages/route.ts`

- Line 238 references `service.functionalityType === 'verification'`
  — a string that doesn't exist in the codebase. This is a
  **pre-existing bug** and is **out of scope** for this conversion.

### 11. Tests

The architect should run a grep for `'idv'` and `"idv"` in
`src/**/*.test.ts` and `src/**/*.test.tsx` and update every fixture
that hardcodes `functionalityType: 'idv'` to `'verification-idv'`.
Likely locations include:

- `validationEngine.test.ts` (or equivalent) — exercises `hasIdv`
  branching (which is being removed/refactored — tests must follow)
- `submitApplication.test.ts` (or equivalent) — exercises
  `idvServiceIds` filtering
- `personalInfoIdvFieldChecks.test.ts` (or equivalent) — exercises
  IDV requirement collection
- Any `structure/route.test.ts` — exercises the
  `serviceTypeOrder`-driven response
- Any `services/route.test.ts` — exercises the allow-list (must now
  cover the 400-reject path for `"idv"`)

Tests that exercise the save-route `sectionType: 'idv'` enum, the
`idv_country` marker, and the `OrderItemSource.kind: 'idv'` literal
are **not** changed (BR 8).

### 12. Documentation

**File:** `docs/DATA_DICTIONARY.md`

- Line 133: lists `functionalityType` valid values as
  `record`, `verification-edu`, `verification-emp`, `other`, `idv`.
  Conversion: replace `idv` with `verification-idv`.

### 13. Seeds and fixtures

**File:** `prisma/seed.js`

- Reviewed. No service seeding; no functionality-type strings.
  Nothing to change.

The architect should grep test fixtures (`src/__fixtures__/`,
`tests/fixtures/`, etc.) for `idv` to catch any seed-shaped data
files I couldn't directly enumerate.

---

## Target-State Behavior

After this conversion ships, the end-to-end behavior is the same as
verification-edu and verification-emp **except** for the scope-fixed-to-1
piece. Where the spec says "same as verification-edu / verification-emp"
below, the architect should mirror the wiring for those types without
re-deriving the behavior.

### Service catalog (Global Configurations)

Same as verification-edu / verification-emp:
- Admin can create a service with `functionalityType: 'verification-idv'`.
- DSX availability per country is configured normally.
- DSX requirements (fields and documents) are mapped per country
  normally.
- Service appears in the customer's allowed-services list normally.
- API rejects `"idv"` with HTTP 400 (BR 3).

### Package configuration (Customer Configurations)

Differs from verification-edu / verification-emp:
- The package builder shows IDV services in the service picker.
- **No scope/count selector is rendered for verification-idv**.
  Compare: verification-edu shows "Highest degree / All degrees /
  Highest including HS"; verification-emp shows "Most recent / Most
  recent X / Past X years / All". Verification-idv shows nothing.
- On save, `package_services.scope` is set to
  `{ "type": "count_exact", "quantity": 1 }` (BR 5).

### Order placement and submission

Same as verification-edu / verification-emp:
- Candidate sees an Identity Verification section in the portal.
- Country drives DSX field/document loading via `/fields`.
- TD-084 OR-merge applies (the new code path already supports any
  serviceIds, regardless of functionality type).
- Auto-save on blur.
- Validation engine checks required fields filled.
- At submit, one OrderItem per verification-idv service with
  `locationId` = candidate-selected country.

Differs from verification-edu / verification-emp:
- IDV section reads from `sectionsData['idv']` (single flat bucket),
  not from a per-entry repeatable bucket. The save-route's flat
  schema is used (`sectionType: 'idv'`), not the repeatable schema.
- Validation does NOT compute scope errors or gap errors for IDV
  (Rule 18 in the existing Phase 7 Stage 1 spec — IDV is non-scoped).
- Submission emits exactly N OrderItems where N is the number of
  IDV services in the package, regardless of any scope value.

### Candidate-portal field-collection behavior

Identical to verification-edu / verification-emp on a per-entry basis,
collapsed to one "entry":
- One country selector at the top of the section.
- Below it, the DSX fields/documents that the merged
  `/fields?serviceIds=...&countryId=...` response returns for that
  country.
- TD-084 per-country required-indicator OR-merge applies through the
  same code path. The architect should verify this by tracing
  `IdvSection.tsx`'s fetch (line 213) and confirming the request shape
  matches what TD-084 supports.

---

## Edge Cases and Error Scenarios

1. **The production row `8388bb60-48e4-4781-a867-7c86b51be776` exists
   with `functionalityType: 'idv'`.** The data migration rewrites it
   to `'verification-idv'`. Migration runs BEFORE the API begins
   rejecting `"idv"` — strict sequencing (see Migration Concerns).

2. **A package was saved with `package_services.scope`
   shaped like `{ type: 'past-x-years', years: 7 }` for an IDV
   service.** The data migration normalizes any pre-existing IDV
   `package_services.scope` rows to
   `{ "type": "count_exact", "quantity": 1 }` per BR 5. Additionally,
   `normalizeRawScope` defensively returns
   `{ scopeType: 'count_exact', scopeValue: 1 }` for any IDV row
   regardless of the stored shape, so even if a migration-missed row
   exists, validation behavior is correct.

3. **An admin's frontend is cached and still sends the old `"idv"`
   string in a POST/PUT/PATCH to `/api/services`.** Per BR 3, the API
   returns HTTP 400 with an "Unknown functionality type" error. The
   admin sees a clear error and must reload the page to pick up the
   new dropdown values. No silent coercion.

4. **A candidate has a draft `formData.sections.idv` bucket from
   before this work ships.** Nothing changes for the candidate —
   the save-bucket key stays `'idv'` (BR 8), the section component
   continues to read and write that key, and the validation engine
   continues to read `sectionsData['idv']`. The conversion is
   transparent to in-flight candidate sessions.

5. **A test that mocks `service.functionalityType` with `"idv"`
   is not updated.** After the rename, the mock no longer matches
   any branch (no code looks for `'idv'` anymore). The test silently
   passes for the wrong reason: the IDV-specific code path is never
   exercised. **Mitigation:** the implementer must update every
   fixture flagged in Current-State Audit item 11; the typed
   `FunctionalityType` union from
   `src/constants/functionality-types.ts` (BR 14) will surface
   stale literals at typecheck time.

6. **Tests that hardcode the section id `'service_idv'`** —
   the validation engine emits `SectionValidationResult.sectionId =
   'service_idv'` today (line 211 of `validationEngine.ts`). After
   conversion, that becomes `'service_verification-idv'`. Tests that
   pattern-match on the section ID need to be updated.

7. **A non-admin tries to call `/api/services` PUT with
   `functionalityType: 'idv'`.** PUT and PATCH today have no
   allow-list validation. After this conversion adds validation to
   PUT/PATCH (BR 3), the request returns 400. Both endpoints become
   consistent with POST.

8. **Migration runs but the API is deployed first and starts
   rejecting `"idv"`.** This must not happen — see Migration
   Concerns for the strict sequencing requirement. If the API
   deploys before the migration, services with the old
   functionality type continue to function (their type is read live)
   but any in-flight admin save of those services would 400. The
   deploy order is: (1) data migration, (2) API changes.

---

## Impact on Other Modules

- **User Admin** — no impact.
- **Global Configurations** — Services UI dropdown updated.
  `/api/services` POST/PUT/PATCH validation tightened and now
  rejects unknown types with 400. DSX availability and mapping
  behavior unchanged.
- **Customer Configurations** — Package builder hides scope selector
  for `verification-idv`. `package_services.scope` is stored as
  `{ "type": "count_exact", "quantity": 1 }`. The
  `package.functionalityType === 'verification'` legacy check at
  `/api/customers/[id]/packages` line 238 is **separate** and not
  addressed here.
- **Candidate Workflow** — Structure endpoint, /fields endpoint,
  save endpoint, validation engine, submission orchestrator all
  rename `'idv'` → `'verification-idv'` (functionality type only —
  save-bucket key, `idv_country` marker, and
  `OrderItemSource.kind: 'idv'` discriminator all stay unchanged).
  `ScopeFunctionalityType` union gains `verification-idv`. UI
  components keep their names.
- **Fulfillment** — no direct impact. OrderItems created from
  IDV services look identical post-conversion (same shape, same
  `locationId`, same `serviceId`).

---

## Definition of Done

1. The shared constants module
   `src/constants/functionality-types.ts` exists and exports
   `FUNCTIONALITY_TYPES` (containing `verification-idv` and not
   containing `idv`) and the `FunctionalityType` TypeScript union.
2. The `/api/services/route.ts` POST handler imports the allow-list
   from the shared constants module and **rejects** unknown
   functionality types (including `"idv"`) with HTTP 400 and an
   explicit error.
3. The `/api/services/[id]/route.ts` PUT and PATCH handlers
   import the same allow-list and apply the same 400-reject behavior.
4. The admin Services UI dropdown shows `verification-idv` in the
   functionality-type selector and does not show `idv`. Dropdown
   options sourced from the shared constants module.
5. Every other source-code reference to the bare functionality-type
   string `'idv'` (as documented in the Current-State Audit items 1
   through 10) has been changed to `'verification-idv'`, EXCEPT
   for the save-route `sectionType` enum (which stays `'idv'`),
   the `IDV_COUNTRY_MARKER` constant (which stays `'idv_country'`),
   and the `OrderItemSource.kind: 'idv'` provenance tag (which
   stays `'idv'` per Decision 5).
6. The data migration is written, runs BEFORE the API rejection
   takes effect, and rewrites the production row
   `8388bb60-48e4-4781-a867-7c86b51be776` (and any other matching
   rows) from `functionalityType = 'idv'` to `'verification-idv'`.
   The migration also normalizes `package_services.scope` for IDV
   rows to `{ "type": "count_exact", "quantity": 1 }`. The migration
   is idempotent and includes verification logging per
   DATABASE_STANDARDS §4.
7. `DATA_DICTIONARY.md` line 133 is updated to list the new allow-list.
8. The package builder UI does not render a scope selector or count
   input for `verification-idv` services. New saves and the data
   migration both produce
   `scope = { "type": "count_exact", "quantity": 1 }`.
9. `packageScopeShape.ts`'s `ScopeFunctionalityType` union includes
   `verification-idv`. `normalizeRawScope` returns
   `{ scopeType: 'count_exact', scopeValue: 1 }` for IDV regardless
   of stored shape. The `hasIdv` dispatch in `validationEngine.ts`
   is dropped or refactored so IDV flows through the same
   per-functionality grouping as edu and emp.
10. The candidate portal renders the Identity Verification section
    when the package contains at least one `verification-idv`
    service.
11. End-to-end test: a candidate with a `verification-idv` package
    service can select a country, see country-driven DSX fields with
    correct TD-084 required-indicator behavior, fill them in,
    submit, and the resulting order has exactly one OrderItem with
    `locationId` set to the selected country.
12. No source file references the bare string `"idv"` as a
    functionality type after this work. Grep verification:
    `grep -rn --include='*.ts' --include='*.tsx' "['\"]idv['\"]" src`
    returns only:
    - the save-route `sectionType` enum (intentional, BR 8)
    - the `idv_country` marker constant value (intentional, BR 8)
    - the `OrderItemSource.kind: 'idv'` literal and matching
      `case 'idv':` branch (intentional, BR 8)
    - any `formData.sections['idv']` lookups (intentional, BR 8)
    - test fixtures that exercise the save-route's `'idv'` enum,
      the `idv_country` marker, or the `OrderItemSource.kind: 'idv'`
      literal (intentional)
13. All existing tests pass. Updated tests cover the new
    allow-list (including the 400-reject path for `"idv"`) and the
    rename in every audit location.
14. The architect has performed a UI/router/analytics grep (Decision
    7) to verify no client-side code keys off `'service_idv'` or
    the literal `"idv"` in ways the BA audit didn't capture, and
    any findings have been addressed.

---

## Migration Concerns

**Production row confirmed (Decision 1):** exactly one row exists with
`functionalityType = 'idv'`:
- `id`: `8388bb60-48e4-4781-a867-7c86b51be776`
- `name`: `ID Verification`
- `category`: `IDV`

**Strict deploy sequencing (Decision 3):** the data migration MUST run
**before** the API changes are deployed (or at minimum, before the API
changes take effect on the production database). The API's new
400-reject behavior must not become active until after the production
row has been rewritten. Otherwise the existing service would still
have `functionalityType = 'idv'` while the API rejects that value —
admin saves on that service would 400 until the migration completes.

**Deploy order:**
1. Run data migration: UPDATE the services row and normalize any IDV
   `package_services.scope` rows.
2. Deploy API + UI changes (new constants module, 400-reject behavior,
   renamed strings, `ScopeFunctionalityType` extension).

Following DATABASE_STANDARDS §4 idempotent pattern:

```sql
-- prisma/migrations/<YYYYMMDDHHMMSS>_rename_idv_functionality_type/migration.sql
--
-- Business requirement: convert idv → verification-idv per spec
-- docs/specs/verification-idv-conversion.md
-- Data integrity goal: align services.functionalityType with the new
-- allow-list and normalize package_services.scope for IDV rows.
-- Safe to run multiple times (idempotent).

DO $$
DECLARE
  services_renamed INT;
  scopes_normalized INT;
BEGIN
  -- Step 1: rename services functionalityType
  UPDATE services
     SET "functionalityType" = 'verification-idv',
         "updatedAt" = NOW()
   WHERE "functionalityType" = 'idv';
  GET DIAGNOSTICS services_renamed = ROW_COUNT;
  RAISE NOTICE 'Renamed % services rows from idv to verification-idv', services_renamed;

  -- Step 2: normalize package_services.scope for IDV rows
  UPDATE package_services ps
     SET scope = '{"type":"count_exact","quantity":1}'::jsonb,
         "updatedAt" = NOW()
    FROM services s
   WHERE ps."serviceId" = s.id
     AND s."functionalityType" = 'verification-idv'
     AND (ps.scope IS NULL
          OR ps.scope::text <> '{"type":"count_exact","quantity":1}');
  GET DIAGNOSTICS scopes_normalized = ROW_COUNT;
  RAISE NOTICE 'Normalized % package_services.scope rows for verification-idv', scopes_normalized;

  -- Verification
  IF EXISTS (SELECT 1 FROM services WHERE "functionalityType" = 'idv') THEN
    RAISE EXCEPTION 'Migration verification failed: services rows with functionalityType=idv still exist';
  END IF;
END $$;
```

**OrderItems / ServicesFulfillment / order_data are NOT migrated.**
They reference services by foreign key and read functionality type
live at query/validation time, so the upstream `services` rename
flows through automatically.

---

## Out of Scope / Non-Goals

This work does NOT:

1. Rename the save-route `sectionType: 'idv'` enum value. See BR 8 /
   Decision 5.
2. Rename the `idv_country` synthetic marker constant or any
   `formData.sections['idv']` lookups. See BR 8 / Decision 5.
3. Rename the `OrderItemSource.kind: 'idv'` discriminator or the
   matching `case 'idv':` branch in `orderDataPopulation.ts`. See
   BR 8 / Decision 5.
4. Re-skin or redesign the IDV section UI in the candidate portal.
   `IdvSection.tsx` keeps its current shape; only the
   functionality-type filter strings that gate IDV-section
   rendering change.
5. Introduce a third-party IDV provider integration. The
   `IdvSection.tsx` comment block at lines 63–72 explicitly
   anticipates such integration as a future feature; this work
   does not enable it.
6. Fix the pre-existing dead-string bug at
   `src/app/api/customers/[id]/packages/route.ts` line 238
   (`service.functionalityType === 'verification'`). That is its
   own ticket.
7. Add scope/count UI for verification-idv. Scope is fixed at 1
   and not exposed to admins or candidates.
8. Migrate any in-flight `CandidateInvitation.formData` payloads.
   These are unaffected because the save-route bucket key is
   unchanged.
