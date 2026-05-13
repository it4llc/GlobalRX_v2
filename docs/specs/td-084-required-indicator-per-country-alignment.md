# Feature Specification: TD-084 — Required-Indicator Per-Country Alignment

**Spec file:** `docs/specs/td-084-required-indicator-per-country-alignment.md`
**Date:** 2026-05-11
**Requested by:** Andy
**Status:** Confirmed
**Branch:** `feature/td-084-required-indicator-per-country`

---

## Summary

In the candidate portal, the red-asterisk "required" decoration on fields in the IDV, Address History, Education, and Employment sections does not reliably reflect whether the field is actually required for the candidate's package at the selected country. The validation engine (which decides whether a section is `complete` and whether the candidate can submit) and the field-rendering path (which decides whether the asterisk appears next to a label) read the same underlying `dsx_mappings` table but combine the data with opposite logic and different scope. The result is fields that visually appear required when they are not, and — in some edge cases — fields that visually appear optional when they are not. This spec aligns the asterisk decoration with the validator's per-country, per-package view of `dsx_mappings.isRequired` so the candidate sees a consistent and accurate "what's required" signal across the form, the section banner, and the Review & Submit page. The fix touches the server-side rendering data path (the `/fields` route) and the validation engine's aggregator helpers; it deliberately does not touch the asterisk components themselves, does not change any schema, and does not change which fields render. The full read-only investigation that grounds this spec is in `docs/audits/TD_084_INVESTIGATION.md` — that file is the source of truth for where the discrepancy lives; this spec is the product decision for how to align the two paths.

---

## Who Uses This

| Actor | What they do | What changes for them |
|---|---|---|
| Candidate | Fills in IDV, Address History, Education, and Employment fields per country. | After this fix, the red asterisk on each field reflects the actual per-country, per-package required-state. Fields that the validator does not require will no longer display the asterisk. Fields that the validator does require — across any service in the candidate's package and any applicable geographic level — will display the asterisk. The candidate's submit-blocking behavior is unchanged from Stage 3b; only the visual signal becomes honest. |
| Engineers maintaining the candidate validation engine | Read and extend the per-section validators (`validationEngine.ts`, `repeatableEntryFieldChecks.ts`, `personalInfoIdvFieldChecks.ts`). | After this fix, the validator's cross-service aggregation logic changes from AND to OR. Existing Stage 3b test assertions that encode the AND-merge are deliberately rewritten by the implementer to encode the OR-merge. |
| Engineers maintaining the candidate `/fields` API route | Read and extend `src/app/api/candidate/application/[token]/fields/route.ts`. | After this fix, the route's `isRequired` computation aligns with the three semantic rules below. The exact mechanism (route-side flip, package-aware route, batched endpoint, etc.) is an architect-level question. |
| DSX administrators (internal) | Configure `dsx_mappings.isRequired` at country / region / subregion levels per service. | No direct change. They keep the existing per-mapping editing experience. The TD-085 follow-up (DSX admin UI propagation of required-state across geographic hierarchy) is tracked separately and is the right home for any data-integrity guarantees on the admin side. |

This stage has **no admin-facing surface change**, **no database schema change**, and **no change to the `/validate` response shape**.

---

## Business Rules

These three semantic rules are the product decisions Andy has made. The implementer encodes them as code; the test-writer encodes them as assertions. They are not open for re-debate in the architect or implementer phases.

### Cross-service merge — OR

1. **When a requirement is associated with multiple services in the candidate's package, and the per-country `dsx_mappings.isRequired` value differs across those services, the rendered required-state is `true` if ANY in-scope (serviceId, locationId) mapping says `true`.** Both the renderer (asterisk) and the validator (which fields are reported as missing) must apply this rule. An empty `isRequired` set (no rows match) yields `false` (not required).

### Geographic-hierarchy merge — OR

2. **When a requirement has `dsx_mappings` rows at multiple geographic levels (country, region, subregion) for the same service and the rendered required-state differs across levels, the rendered required-state is `true` if ANY applicable level says `true`.** Both the renderer and the validator must apply this rule. The product intent is that geographic-hierarchy required-state should be consistent by construction — marking a country required propagates to its subregions; unchecking a subregion propagates up to the parent. Enforcement of that consistency is **TD-085's** scope (DSX admin UI), not TD-084's. TD-084 handles whatever data exists in `dsx_mappings` today with OR-merge as the safe rendering and validation rule.

### Service-level fallback — none

3. **When a requirement is associated with a service via `service_requirements` (the service-level association) but has no `dsx_mappings` row for the candidate's selected country at that service, the rendered required-state is `false` (not required).** The `/fields` route's current behavior of forcing `isRequired: true` for missing mapping rows (`route.ts:323-334`, with the existing `Service.functionalityType` carve-outs) is wrong per the product rule "if nothing is marked as required in `dsx_mappings`, it is optional." There is no service-level baseline that overrides the absence of a mapping.

### Cross-cutting

4. **The two paths (rendering and validation) must compute `isRequired` from the same data with the same semantics.** It is not acceptable for the section's status to be `complete` while a visible asterisk says the field is required, or vice versa. The test contract below explicitly proves consistency for representative fixtures.

5. **Field visibility is unchanged.** Which fields render in each section is governed by existing rules (a field renders if it is associated with any service in the candidate's package). TD-084 only touches the `isRequired` decoration on rendered fields — not the visibility filter.

6. **No new error category, no new translation key.** The Review & Submit `SectionErrorBanner` already renders `fieldErrors` derived from the validator's existing aggregation. After the OR-flip lands, those `fieldErrors` will correctly reflect the new aggregation; the renderer of the banner is unchanged.

7. **Status values stay lowercase.** All `ValidationStatus` outputs remain `'not_started'`, `'incomplete'`, or `'complete'`.

8. **`fieldKey` is immutable.** This spec does not touch any `fieldKey` value. Required-state aggregation operates on `requirementId` keys, never on `fieldKey` text identity.

9. **No database schema change. No migration.** Application-layer only.

10. **The `/validate` API response shape is unchanged.** The architect may add internal helpers or new internal endpoints in pursuit of the fix, but the public response shape of `/api/candidate/application/[token]/validate` does not change in this stage.

11. **The deliberate structural re-declaration pattern from TD-077 is respected.** Any new helper or shared aggregation module follows the same pattern (re-declare structurally rather than crossing the loader/validator boundary with a shared types module). The TD-077 clarification — sibling-validator type exports are acceptable — applies.

---

## User-Visible Behavior

### Today (pre-fix)

The candidate selects a country in IDV (or sets a country on an Address History / Education / Employment entry) and sees the form. For some country / package combinations, fields display a red asterisk that the validator does not actually consider required. Conversely, for some combinations where a requirement is marked required via `dsx_mappings` for one service in the package and not for another, the validator (AND-merge) and the renderer (OR-merge of one-service-at-a-time) disagree: the validator may say "not required" while the renderer says "required," or vice versa. The section status indicator (sidebar dot, Review page row) reflects the validator's view, so submission is not blocked when the asterisk is the only problem — but the candidate sees a visual inconsistency that erodes trust.

The most concretely observed cases (from the smoke tests that surfaced TD-084):

- IDV In-Country Address with country = United States, on a package whose IDV service has the In-Country Address as a `service_requirements` row but no `dsx_mappings` row at the country level. Today: asterisk shows (route forces `isRequired: true` for the missing mapping). Validator: not required. After fix: asterisk does not show.
- Address History `address_block` pieces (street1, city, state, postalCode) with country = United States, where the per-package set of record services does not collectively require these pieces. Today: asterisks show on the piece labels. Validator: section is `complete` even when these are empty. After fix: asterisks do not show.

### After the fix

For every field the candidate sees in IDV, Address History, Education, and Employment, the asterisk decoration matches the validator's view:

- Asterisk shows when the candidate's package — considering ALL services associated with that requirement and ALL applicable geographic levels — has at least one `dsx_mappings.isRequired = true` row for the candidate's selected country.
- Asterisk does not show when every applicable row is `isRequired = false`, or when no applicable rows exist.

The candidate's submit experience is functionally identical to Stage 3b (the validator still gates submission), but the visual signal during entry is now consistent and accurate.

---

## Data Requirements

TD-084 does not introduce any new UI fields, new database columns, or new API request / response fields. Existing data shapes are unchanged:

- `dsx_mappings` rows — `(requirementId, serviceId, locationId, isRequired)`. No change in shape.
- `service_requirements` rows — service-level requirement associations. No change in shape. After the fix, the absence of a corresponding `dsx_mappings` row at the candidate's country no longer forces `isRequired: true`.
- `/fields` route response — array of field descriptors each carrying `isRequired: boolean`. **The boolean's semantics change** (it now reflects the OR-aggregation across all in-scope mappings and never the service-level fallback). The **field is unchanged in name, type, and position** in the response. If the architect determines that aligning the route requires the route to accept additional input (e.g., a list of all package service IDs together rather than one at a time), that input-shape change is an architect deliverable and is documented in the technical plan; the response shape does not change.
- Section validation outputs (`SectionValidationResult`, `FieldError`) — no shape change. The `fieldErrors` array for the four affected sections may grow or shrink relative to Stage 3b's output because the cross-service aggregation moves from AND to OR.

The address-block JSON shape (`street1`, `street2`, `city`, `state`, `county`, `postalCode`, plus `fromDate` / `toDate` / `isCurrent`) is unchanged. The per-piece required-state metadata in `DSXRequirement.fieldData.addressConfig` is unchanged. The `addressConfig[piece].required` boolean continues to be the per-piece gate consumed by `AddressBlockInput.renderAsterisk` (`AddressBlockInput.tsx:327-330`); only the parent `isRequired` prop it AND-multiplies against changes in source.

**Per project rule:** all `fieldKey` values are immutable camelCase identifiers. This spec does not modify any `fieldKey`.

**Per project rule:** all status values are lowercase strings (`'not_started'`, `'incomplete'`, `'complete'`).

---

## Acceptance Criteria / Definition of Done

Each business rule has a corresponding acceptance criterion. The implementer's checkpoint must show raw test output proving each criterion.

### Cross-service OR-merge (Business Rule 1)

1. A regression test in `validationEngine.test.ts` (or the appropriate sibling test file) fixtures a candidate whose package has TWO services associated with the same requirement at the same country, where one service's `dsx_mappings.isRequired = true` and the other's `isRequired = false`. The test asserts the validator reports the field as required (it appears in `fieldErrors` when empty). This test fails on the current `main` baseline (which AND-merges) and passes after the implementation lands.
2. A regression test in the `/fields` route's test directory fixtures the same package shape and asserts that the route's response carries `isRequired: true` for the requirement.
3. A consistency test (in either of the two locations above, or a new location the architect names) fixtures the same package and asserts that the renderer's `isRequired` and the validator's "field required" determination agree.

### Geographic-hierarchy OR-merge (Business Rule 2)

4. A regression test fixtures a candidate whose `dsx_mappings` has rows at BOTH the country level and a subregion level (or country and region) for the same `(requirementId, serviceId)`, with differing `isRequired` values. The test asserts the validator reports the field as required if ANY level says required. (This mirrors the route's existing geographic OR-merge at `route.ts:286-308`; the test makes the geographic OR-merge an explicit, asserted contract instead of an incidental side effect of the code.)
5. A parallel regression test in the `/fields` route's test directory asserts the route's response carries `isRequired: true` under the same fixture.

### No service-level fallback (Business Rule 3)

6. A regression test fixtures a candidate whose package has a service with a `service_requirements` row for a given requirement but no `dsx_mappings` row at the selected country. The test asserts that:
   - The validator does NOT include the field in `fieldErrors` when empty (it is not required).
   - The `/fields` route response carries `isRequired: false` for that requirement.
7. The `Service.functionalityType === 'idv'` and `'record'` carve-outs at `route.ts:323-334` are addressed by the architect's plan. Whatever survives of those carve-outs after the architect's review is documented in the plan with rationale; the acceptance test in (6) holds regardless of which carve-outs remain.

### Consistency between paths (Business Rule 4)

8. For each of the four affected sections (IDV, Address History, Education, Employment), a consistency test fixtures at least one representative requirement and asserts that the validator's "required" verdict matches the `/fields` route's `isRequired` for the same package / country combination. Where the architect's design unifies the two paths via a shared helper, this test exercises that helper directly. Where the architect's design keeps two parallel paths, this test exercises both paths and compares their outputs.

### Affected sections — concrete fixtures

9. **IDV.** A test reproduces the smoke-test case: IDV service with In-Country Address as a service-level requirement, country = US, no `dsx_mappings` row. After fix: the field renders without asterisk and the validator does not include the field in `fieldErrors`.
10. **Address History.** A test fixtures a candidate whose package includes a US record service with `dsx_mappings` rows for the address-block requirement at `isRequired = false`. After fix: the `address_block`'s parent `isRequired` is `false`, so even pieces whose `addressConfig[piece].required = true` do NOT render the asterisk (per `AddressBlockInput.renderAsterisk`'s AND of `pieceRequired && isRequired`).
11. **Education.** A test fixtures an Education entry with a country whose package services collectively yield `isRequired = false` for a given Education requirement. After fix: the field renders without asterisk and the validator does not flag it as missing.
12. **Employment.** A test fixtures an Employment entry with a country whose package services collectively yield `isRequired = false` for a given Employment requirement. After fix: the field renders without asterisk and the validator does not flag it as missing.

### Asterisk-decoration components are untouched

13. `src/components/candidate/form-engine/DynamicFieldRenderer.tsx:286-288` and `src/components/candidate/form-engine/AddressBlockInput.tsx:327-330` are not modified by this stage. The asterisk-rendering JSX correctly consumes an `isRequired` prop; the fix is entirely upstream of that prop's source.

### Hardcoded date asterisks are untouched

14. The unconditional asterisks at `AddressBlockInput.tsx:493` and `:537` on `fromDate` / `toDate` are NOT modified. TD-086 owns any future decision on those.

### Cross-cutting

15. The pre-existing test suite continues to pass with zero net regression except where Stage 3b's tests deliberately encoded the old AND-merge semantics. Each test that changes must:
    - Be identified in the implementer's checkpoint with its file:line.
    - Have its new assertion explicitly justified against this spec's business rules.
    - Continue to test a real behavior (renaming an assertion to chase green is not acceptable).
16. `pnpm typecheck` is green. No new `any`. No new unsafe casts.
17. `pnpm lint` returns no new errors relative to the parent commit.
18. `pnpm build` succeeds.
19. CODING_STANDARDS Section 9 file-size rules are respected. If any of the validator helpers grows past 600 lines as a result of the OR-aggregator refactor, the architect splits per the TD-076 / TD-077 pattern.
20. No `console.log/warn/error` is added. Existing Winston logger usage is preserved. No PII is logged. Logs may include `requirementId`, `serviceId`, `locationId`, and `countryId`.
21. The asterisk-decoration components (DoD 13) and date asterisks (DoD 14) are not touched, even incidentally.
22. The branch is `feature/td-084-required-indicator-per-country` and is ready for PR review with green CI.

---

## Out of Scope

To keep this stage shippable, the following items are explicitly **NOT** in scope. Items that surface during implementation must not be folded in.

- **Personal Info section's required-state behavior with cross-section country selections** (TD-052). Personal Info is its own data path with its own per-package `isRequired` aggregator (resolved under TD-060). Cross-section coordination between Address History / Education / Employment country selections and Personal Info field requirements is a separate concern tracked under TD-052 and the Phase 6 Stage 4 cross-section requirement registry.
- **DSX admin UI propagation of required-state across the geographic hierarchy** (TD-085). The product intent is that marking a country required propagates to its subregions and that un-checking a subregion propagates up to the country. That enforcement belongs in the admin UI and the underlying data-integrity layer, not in the candidate-portal rendering layer. TD-084 uses OR-merge as a safe compensation for whatever data exists today.
- **Hardcoded asterisks on `fromDate` / `toDate` in `AddressBlockInput.tsx`** (TD-086). The asterisks at lines `:493` and `:537` are outside `dsx_mappings`'s scope. The fix does not touch them. If a future stage aligns those with per-country rules, it will be its own work item.
- **Field visibility — which fields render.** Per existing product rules, a field renders if it is associated with any service in the candidate's package. TD-084 only touches the required-state decoration on rendered fields, not the rendering filter itself.
- **The three-state model (not-displayed / optional / required).** A future product enhancement to express "not displayed" as a first-class state is acknowledged but out of scope. TD-084 operates within the existing two-state (optional / required) model.
- **Cross-section required-state inversion** (i.e., the inverse of TD-052 — propagating Address History / Education / Employment country-driven required-state back up to Personal Info). Out of scope. The cross-section registry already handles the forward direction of this concern.
- **Aggregated requirements area on Address History entries.** The aggregated area (Stage 3 work) is governed by its own `computeAggregatedItems` logic. TD-084 does not change which requirements appear in the aggregated area or how they are ordered.
- **`AddressHistorySection.tsx` form-rendering gap** where address detail inputs may not render even when a country and an address-block requirement are resolved (carved out of TD-069). Out of scope.
- **Candidate-flow navigation redesign** (a future linear-flow product change). Acknowledged as future work. The architect should not assume or design for the navigation redesign; the architect must also not lock in assumptions that would be hard to unwind when the redesign happens.
- **Backfill or data migration** for past in-flight candidates. The fix is application-layer only; no data needs to migrate.

If during implementation a new pre-existing issue is discovered, the discoverer logs a new TD entry in `docs/TECH_DEBT.md` (incrementing past TD-086) and does NOT fix it in this branch.

---

## Deferred to the Architect's Technical Plan (NOT Decided in This Spec)

The Business Analyst is explicitly **NOT** pre-deciding the following design questions. The architect's technical plan resolves each and documents the resolution; the test-writer and implementer follow the architect's plan as their contract.

1. **Where exactly the OR-aggregation runs.** The TD-084 investigation enumerated five plausible options:
   - Route-side OR-flip (`route.ts` performs the cross-service / cross-level OR-merge using the candidate's package context).
   - Package-aware `/fields` route (the route accepts the full set of relevant package service IDs together rather than one at a time, and runs OR-aggregation server-side).
   - New batched endpoint (a sibling route returns the union of required-state-aware fields for the whole section in one call, replacing per-service calls in the four section components).
   - Client-side helper (each section calls the existing `/fields` route per service and an OR-merge helper runs on the client).
   - `/validate` piggyback (the validator's existing `fieldErrors` is the source of truth for the asterisk decoration).

   The architect picks one with file:line precision and a per-file line-count projection. The architect documents the tradeoffs that drove the choice. The architect explicitly addresses what happens for the first render before any data has been loaded (e.g., before the first `/validate` cycle completes, if the chosen path piggybacks on `/validate`).

2. **Whether the `/fields` API contract changes.** If the architect's chosen path requires the route to accept additional input (e.g., an array of package service IDs together), the architect specifies the new request shape, the new response shape (if any), the migration story for existing callers (the four section components plus any tests), and any backwards-compatibility considerations. If the response shape changes, that is also called out for Andy's review.

3. **Whether the validator's helpers (`buildPerCountryRequiredMap`, `collectIdvFieldRequirements`, `aggregateIsRequired`) should be reused from the rendering path or whether parallel helpers should be created.** The architect decides per the TD-077 structural re-declaration pattern: a shared helper is acceptable if it stays on one side of the loader/validator boundary; cross-boundary type sharing is not. If parallel helpers are created, the architect documents how the two stay in lockstep (e.g., a shared aggregation lemma in a sibling module, or explicit consistency tests that exercise both).

4. **Whether the `Service.functionalityType === 'idv'` and `'record'` carve-outs at `route.ts:323-334` should remain in any form.** The investigation flagged these as inconsistent (record services skip the service-level fallback except for `address_block`; IDV services do not). The product rule encoded by Business Rule 3 — no service-level fallback — means the carve-outs are probably entirely removable. The architect resolves explicitly: keep all, keep some (with rationale), or remove all. The acceptance test in DoD 6 must hold regardless.

5. **The exact mechanism for OR-aggregating across the geographic hierarchy when the package contains multiple services and the candidate selects a country with multiple applicable region / subregion mappings.** The aggregation matrix is: `(serviceIds_in_package × geographic_levels_applicable_to_countryId)`. The OR-fold over that matrix yields the rendered `isRequired`. The architect specifies the exact query shape (single batched `dsx_mappings.findMany` covering all `(serviceId, locationId)` pairs, then group / fold, vs. multiple round-trips) and how it composes with the existing per-mapping OR-merge logic in `route.ts:286-308`.

6. **Caching / memoization across section calls.** Today the four section components each call `/fields` independently per service. The architect decides whether to introduce a request-level memoization (e.g., a session-scoped cache of `dsx_mappings` rows keyed by package fingerprint) or accept the existing per-call cost. The decision is informed by Edge Case 8 from Stage 3b's spec: validation latency must not regress materially.

7. **How `useEntryFieldsLoader` (the Address History loader hook) absorbs the new contract.** Address History's hook supports a `subregionId` query parameter for the geographic-hierarchy walk. The architect decides whether the loader keeps its current shape, gets an additional argument for package services, or is restructured.

The architect may add new internal helpers, new types, or new sibling modules so long as those additions respect every business rule above (especially Rules 9, 10, and 11). The architect must NOT relax any business rule without flagging it back to Andy first.

---

## Deployment Impact

This is a behavior change in both the visible asterisk decoration AND the validator's required-field determination for cross-service-shared requirements. Sections whose status was previously `complete` under Stage 3b's AND-merge may flip to `incomplete` under the new OR-merge if a required field is unfilled. No live applications are currently in flight (per Andy's decision to ship the correct semantics rather than preserve the buggy AND-merge), so the practical impact is constrained to test data and any future candidates. Three categories of visible change follow:

- **Fields that were incorrectly displaying the asterisk will stop displaying it.** Candidates who previously saw an asterisk on (for example) an IDV In-Country Address field with country = US — and felt pressured to fill it — will no longer see that asterisk. They may leave the field blank without consequence, which matches the validator's existing behavior. Some candidates may have already filled in these fields; no data is removed (the values stay where they were saved).
- **Fields that were incorrectly NOT displaying the asterisk will start displaying it.** For package configurations where the validator's AND-merge across services missed a "required" verdict (i.e., one service says required, another says optional, and AND would have yielded "not required" while OR now yields "required"), the asterisk will newly appear and the validator will newly include the field in `fieldErrors` when empty. A candidate who had previously skipped that field will now see it as required at the next visit and at submission. This is the intended product behavior — the new aggregation is correct, the old AND-merge was wrong.
- **Section status changes for in-flight candidates.** Candidates whose Stage 3b state was `complete` may flip to `incomplete` if a field newly flagged as required is empty on their saved data. Submission will be blocked until they fill it. This is the same delivery shape as Stage 3b's deployment impact note: prior green states that were incorrect become honestly red. Communications to in-flight candidates and any operational follow-up are tracked separately and are not this stage's responsibility.
- **No data migration required.** No schema change. No backfill. The fix is application-layer only.
- **No vendor-facing impact.** OrderItem and OrderData generation at submission is unchanged. The IDV / record / education / employment OrderItem location and value population remain governed by the candidate's selected country and saved data; the asterisk fix does not touch any of that.

---

## Test Contract

The test-writer follows this contract. The implementer makes the listed test changes deliberately and explains each in the checkpoint.

### Existing tests that need to be rewritten (Stage 3b AND-merge assertions)

- **`src/lib/candidate/validation/personalInfoIdvFieldChecks.test.ts`** — every assertion that explicitly tests the cross-service AND-merge for IDV must be rewritten to assert OR-merge. The architect identifies the exact tests by inspection; the implementer lists them with file:line in the checkpoint and provides the new assertion text.
- **`src/lib/candidate/validation/repeatableEntryFieldChecks.test.ts`** — same treatment for Address History / Education / Employment per-entry walks. The AND-merge logic at `repeatableEntryFieldChecks.ts:317` becomes OR; tests pinned to AND must be flipped.
- **`src/app/api/candidate/application/[token]/fields/__tests__/`** — any test that asserts the current service-level fallback forces `isRequired: true` (per `route.ts:331`) must be rewritten to assert `isRequired: false` for the no-mapping case (per Business Rule 3). Tests that assert the route's geographic OR-merge (`route.ts:304`) stay as they are.
- **No test is deleted to chase green.** A flipped test must continue to exercise the same code path; only the asserted outcome changes.

### New tests required by the acceptance criteria

The numbering below maps to the Definition of Done section above. Each item is a new test (not a rewrite). The test-writer chooses the file, names the test descriptively, and documents the fixture inline.

- DoD 1, 2, 3 — cross-service OR-merge tests in validator, route, and consistency test.
- DoD 4, 5 — geographic-hierarchy OR-merge tests in validator and route.
- DoD 6 — no-service-level-fallback tests in validator and route.
- DoD 8 — per-section consistency tests for IDV, Address History, Education, Employment.
- DoD 9, 10, 11, 12 — per-section concrete fixtures (smoke-test reproductions).

### Tests that must continue to pass unchanged

- All `personal-info-fields` route tests (TD-060 resolution territory; this stage does not touch Personal Info).
- All Stage 3b per-entry field-validation tests EXCEPT those listed under "Existing tests that need to be rewritten" above. The Stage 3b structure (per-entry walk, address-block JSON descent, missing-country error, address-block JSON `null` handling) is preserved.
- All Stage 3b IDV country-switch cleanup tests. This stage does not touch `IdvSection.handleCountryChange` or its `formData` cleanup logic.
- All scope-validation, gap-detection, and date-extraction tests.
- All submission orchestrator tests.

### Test coverage targets

- Every business rule (1–11) has at least one acceptance criterion. Every acceptance criterion has at least one test (or a test rewrite). The test-writer produces a mapping in the checkpoint: business rule → acceptance criterion → test file:line.

---

## Open Questions

None remaining for the Business Analyst. The seven design questions called out under "Deferred to the Architect's Technical Plan" are deliberately not Business-Analyst questions — they are architect questions, and the architect resolves them in the next stage. If the architect's reading uncovers a question that *is* a business question (e.g., "what should happen when a candidate's package has only one service for a given requirement and that service's row is `isRequired = null`?"), the architect must surface it back to Andy via the architect's plan rather than assuming a behavior.
