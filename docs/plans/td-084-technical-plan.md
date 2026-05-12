# Technical Plan: TD-084 — Required-Indicator Per-Country Alignment

**Based on specification:** `docs/specs/td-084-required-indicator-per-country-alignment.md` (2026-05-11, Confirmed)
**Investigation source:** `docs/audits/TD_084_INVESTIGATION.md`
**Date:** 2026-05-11
**Architect:** Technical Architect agent
**Branch:** `feature/td-084-required-indicator-per-country`

---

## 0. Verification of facts pinned by the spec and the investigation

Every file referenced by the spec / investigation was read in full or at the cited line range before this plan was written. Verified pinned facts:

| Pinned fact | Source | Verified |
|---|---|---|
| `/fields` route is 365 lines | `wc -l` on `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/fields/route.ts` | Verified — 365. |
| `route.ts:286–308` is the per-mapping OR-merge across geographic levels | inspection | Verified — `existing.isRequired || mapping.isRequired` at line 304. |
| `route.ts:323–334` is the service-level fallback that forces `isRequired: true` | inspection | Verified — `isRequired: true,` at line 331, with `isRecordService` carve-out at 325–328 limiting record services to `address_block` only. |
| `route.ts:325–328` skips record-service non-address_block service-level requirements | inspection | Verified. |
| `validationEngine.ts` is 573 lines | `wc -l` | Verified — 573 (the Stage 3b architect projected 556; the actual landing was 573, leaving 27 lines of headroom). |
| `repeatableEntryFieldChecks.ts` is 464 lines and AND-aggregates at line 317 | `wc -l` + inspection | Verified — 464 lines; `flags.length > 0 && flags.every(Boolean)` at line 317 inside `buildPerCountryRequiredMap`. |
| `personalInfoIdvFieldChecks.ts` is 632 lines and AND-aggregates IDV at line 395 | `wc -l` + inspection | Verified — 632 lines; `flags.length > 0 && flags.every(Boolean)` at line 395 inside `collectIdvFieldRequirements`; the module-internal `aggregateIsRequired` at line 175 follows the same AND pattern for Personal Info. |
| `loadValidationInputs.ts` is 332 lines; `kind: 'ok'` arm at 133–154; `findMappings` adapter at 305–332 | inspection | Verified. |
| `buildReviewSummary.ts` is 76 lines, pure helper | inspection | Verified. |
| `DynamicFieldRenderer.tsx:286–288` renders `{isRequired && <span class="text-red-500 ml-1 required-indicator">*</span>}` | inspection | Verified. DoD 13 — NOT MODIFIED. |
| `AddressBlockInput.tsx:327–330` AND-multiplies `pieceRequired && isRequired` to render the piece asterisk | inspection | Verified. DoD 13 — NOT MODIFIED. |
| `AddressBlockInput.tsx:493` hardcodes the `fromDate` asterisk; `:537` hardcodes the `toDate` asterisk | inspection | Verified. DoD 14 — NOT MODIFIED (TD-086 owns these). |
| `IdvSection.tsx:202–211` loops package services and calls `/fields` per service | inspection | Verified. |
| `AddressHistorySection.tsx:480–496` passes `addressBlockField.isRequired` to `AddressBlockInput` | inspection | Verified. |
| `EducationSection.tsx:471` passes `field.isRequired` to `DynamicFieldRenderer` | inspection | Verified. |
| `EmploymentSection.tsx:507` passes `field.isRequired` to `DynamicFieldRenderer` | inspection | Verified. |
| `useEntryFieldsLoader.ts:124–178` runs one `/fields` request per service per entry, supports `subregionId` | inspection | Verified. |
| The `Service` model has `functionalityType` enum string; service IDs grouped by type at `loadValidationInputs.ts:193–208` filter to `verification-edu | verification-emp | record`; IDV is detected separately | inspection | Verified. |
| `personal-info-fields` route uses AND (TD-060) and is OUT OF SCOPE for TD-084 | spec §Out of Scope + `personal-info-fields/route.ts:162–243` | Verified — Personal Info stays on AND; TD-084 only changes IDV/Address-history/Education/Employment. |
| CODING_STANDARDS Section 9.4 hard stop = 600 lines; soft warn = 500 | `docs/CODING_STANDARDS.md:492–493` | Verified. |

**Existing tests verified by reading:**

- `validationEngine.test.ts:1441` total lines; Stage 3b fixtures use single-service-per-country AND-merge implicitly (no test fixture today exercises two services with differing `isRequired` for the same `requirementId` at the same country). Verified by `grep -n "isRequired: false" validationEngine.test.ts` — only one match at line 973, which is for the "two countries with different rules" geographic case, not the cross-service case.
- `personalInfoIdvFieldChecks.test.ts:316` total lines; existing IDV tests fixture a single IDV service. None fixture two IDV services with differing `isRequired` for the same `requirementId`. Verified by `grep -n "SVC_IDV" personalInfoIdvFieldChecks.test.ts`.
- `fields/__tests__/route.test.ts:941` total lines; the test at line 298–325 ("should return service-level requirements not in location mapping") asserts the route returns a service-level requirement when no mapping exists. It does not currently assert `isRequired: true` explicitly, but the implementer must flip the assumption: under BR 3 the response shape is unchanged but the *semantics* are that `isRequired: false` for service-level-only requirements with no mapping at the candidate's selected country (more precisely — under the chosen approach, the requirement either drops out entirely or stays with `isRequired: false`, depending on whether package context is added; see §2.4 below).

---

## 1. Resolution of the seven deferred design questions

This section is the architect's contract. Each subsection answers one of the seven questions the spec deferred, with rationale and concrete consequences.

### 1.1 Where the OR-aggregation runs

**Decision:** **Package-aware `/fields` route — server-side.** The route accepts the full set of relevant package service IDs together (a `serviceIds` array via repeated query param) AND the section's single selected `countryId`, runs a single batched `dsx_mappings.findMany` covering every `(serviceId, locationId)` pair across the geographic hierarchy, and returns the OR-aggregated `isRequired` per requirement. The legacy single-`serviceId` shape is preserved as a backwards-compatible path so the migration is incremental.

**Concrete site:** `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/fields/route.ts` — the existing GET handler is refactored. No new route file. The route stays as the single source of truth.

**Tradeoffs evaluated:**

| Option | Verdict | Rationale |
|---|---|---|
| Route-side OR-flip (existing per-call shape, just flip line 304's merge) | **Rejected.** | This is what the route already does today across geographic levels (line 304). It does NOT address the cross-service merge (BR 1). Sections call `/fields` once per `serviceId`; the route cannot OR-aggregate across services when it only sees one service per call. |
| **Package-aware `/fields` route** (chosen) | **Accepted.** | Aligns the route with the validator's package-aware view in one place. No client-side aggregation duplication. Sections collapse N per-service calls into one batched call. The geographic-hierarchy walk (subregionId) composes cleanly inside the same handler. |
| New batched endpoint (sibling route) | **Rejected.** | Cleanest long-term, biggest surface area: would require a new route file (+route.ts file), new tests, and would still leave the existing `/fields` route in place for legacy callers. Adding a sibling endpoint when the existing one can be evolved is overkill for a visual-decoration alignment. |
| Client-side OR-merge helper | **Rejected.** | Duplicates the validator's logic in client code and crosses the loader/validator/server boundary in a way TD-077 frowns on. Every section component (4) would need to import the helper; consistency between paths becomes test-driven rather than computed. |
| `/validate` piggyback | **Rejected.** | Couples visual state to validation lifecycle. First render before `/validate` returns shows no asterisks — a regression from today's render-with-asterisks-then-correct-later behavior. BR 4 (consistency) is harder to assert because the renderer would depend on the validator's transient cache state. Mentioned as future option in TD entry. |

**What happens on the first render before any data has been loaded:** The chosen path does not depend on `/validate`. Each section component calls the package-aware `/fields` route with `serviceIds` (already in props — the structure endpoint passes them at `structure/route.ts:298` / `:340`) and the single `countryId` the candidate just selected (IDV) or the entry's saved/just-selected country (Address History / Education / Employment). The first render after country selection has the response in hand before the section component switches from `loading` to the field list — same lifecycle as today. There is no point in the render pipeline where the asterisk state is uncomputed.

**Order of evaluation inside the new route handler:**

1. Authenticate (unchanged).
2. Read query params: `serviceId` (legacy, optional), `serviceIds` (new, optional, repeated), `countryId` (required), `subregionId` (optional).
3. Resolve the effective `serviceIds[]`:
   - If `serviceIds` is present, use it as-is.
   - Else if `serviceId` is present (legacy), wrap it in a one-element array and proceed.
   - Else return 400.
4. Walk the geographic hierarchy (existing logic at `route.ts:145–168`) to derive `levelIds: string[]`.
5. For each `serviceId` in the effective list:
   - Load the service's `functionalityType` (one `prisma.service.findUnique` per service — see §1.5 for the batching optimization).
   - Load that service's `serviceRequirements` for displayOrder + names (existing).
   - For each level (country, region, subregion), check `dsx_availability` (existing).
6. Issue **one batched** `prisma.dSXMapping.findMany` across **all** `(serviceId, locationId)` pairs (every `serviceId` × every available `levelId`) in one query, instead of N separate per-`(serviceId, levelId)` queries (see §1.5).
7. Merge into a `Map<requirementId, MergedEntry>` keyed by `requirementId`. For each row, OR the `isRequired` into the existing entry (or create one). Geographic-hierarchy + cross-service OR collapse to the same fold operation.
8. **No service-level fallback for missing-mapping requirements.** The post-loop block at `route.ts:323–334` is removed entirely (see §1.4).
9. Return the response in the existing shape. The `isRequired` semantics change but the field's name/type/position do not.

### 1.2 Whether the `/fields` API contract changes

**Decision:** **Yes, additively. Request shape gains an optional `serviceIds` repeated query parameter; response shape is unchanged.**

**New request shape (additive):**

```
GET /api/candidate/application/{token}/fields?serviceIds=svc-A&serviceIds=svc-B&countryId=US-uuid[&subregionId=…]
```

Or, for backwards compatibility (legacy callers):

```
GET /api/candidate/application/{token}/fields?serviceId=svc-A&countryId=US-uuid[&subregionId=…]
```

The route accepts EITHER `serviceId` (legacy single value) OR `serviceIds` (new repeated value). When both are present, `serviceIds` wins and `serviceId` is ignored (logged at debug). When neither is present, returns 400 with the existing error text `"Missing serviceId or countryId parameter"` (preserved verbatim — see Test plan §6).

**Response shape:** Unchanged. The `fields[].isRequired` boolean's TYPE and POSITION are unchanged; its SEMANTICS change to the OR-aggregation across all in-scope `(serviceId, levelId)` pairs with no service-level fallback. Per the spec (Data Requirements §) this is explicitly permitted.

**Migration story for callers:**

- `IdvSection.tsx` — change the per-service loop (lines 202–211) to a single call passing `serviceIds=serviceIds[0]&serviceIds=serviceIds[1]&…` (one `serviceIds` query-string repetition per package IDV service). The post-call de-dup loop (lines 213–229) becomes unnecessary at the cross-service level because the route now de-dups — but the personal-info filter (lines 219–228) STAYS, since IDV still excludes fields whose `collectionTab` includes `subject`/`personal`. The post-filter becomes one pass over `data.fields` instead of one pass per service.
- `useEntryFieldsLoader.ts` — change `loadFieldsForEntry` to issue ONE fetch per entry (instead of one per `serviceId`). The current per-service loop at lines 130–160 collapses into a single fetch whose URL packs all `serviceIds`. The `fieldsByEntryService[`${entryId}::${serviceId}`]` keyed state shape is changed to `fieldsByEntry[entryId]` — flat per-entry — but the downstream helpers in `addressHistoryStage4Wiring` already iterate by entry and de-dup by `fieldKey`, so the shape change is contained (see §1.7 below for the trade-off vs. keeping the per-service keying).
- `EducationSection.tsx` (lines 234–263) — change to a single fetch per country with all `serviceIds` packed. Drop the per-service loop (the `for (const serviceId of serviceIds)` block). The `localFieldMap` / `subjectFieldMap` split logic stays as a single post-pass.
- `EmploymentSection.tsx` (lines 226–295) — same change as Education.

**Backwards compatibility considerations:**

- The legacy `serviceId` (single) shape stays accepted so any test or out-of-tree caller does not break. The fields response under legacy single-`serviceId` is computed exactly as before from a one-element array — so the geographic-hierarchy OR (existing behavior) is preserved, and the service-level fallback removal applies uniformly (a single-service call that previously got `isRequired: true` from the service-level fallback at line 331 now gets `isRequired: false`, by intent per BR 3 — see §1.4).
- The route's existing tests at `fields/__tests__/route.test.ts` mostly use the legacy single-`serviceId` shape. The test rewrites in §6 cover the semantic flip; the shape of those tests does NOT need to change for compatibility — they continue to exercise the legacy single-service path.
- No version header. No URL change. No new MIME type.

### 1.3 Whether the validator's helpers are reused or parallel helpers are created

**Decision:** **Parallel helpers — but the route-side aggregator is defined in a NEW sibling module inside the route's directory, and the validator's `buildPerCountryRequiredMap` is updated in place.** The route file and the validator file do NOT share an aggregator helper (TD-077 — would cross the route/validator boundary in `src/`).

**Concrete shape:**

- **New file:** `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/fields/aggregateFieldsRequired.ts` — a single exported pure function `orMergeMappings(rows, displayOrderByRequirementId)` that takes the rows from the batched `dsx_mappings.findMany` and the displayOrder lookup, returns the same `Map<requirementId, MergedEntry>` the route currently builds in lines 286–308. This is the route's OR-aggregator. Pure. No Prisma import. Unit-testable in isolation.
- **Modified file:** `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/repeatableEntryFieldChecks.ts` — `buildPerCountryRequiredMap` (line 295) changes its inner fold from `flags.length > 0 && flags.every(Boolean)` (AND) to `flags.length > 0 && flags.some(Boolean)` (OR). One operator change. Comment at line 315–316 is rewritten to point at TD-084 / BR 1 instead of the current "AND semantics matching `personalInfoIdvFieldChecks.aggregateIsRequired`".
- **Modified file:** `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` — `collectIdvFieldRequirements` line 395 changes its fold from `flags.every(Boolean)` to `flags.some(Boolean)`. The module-internal `aggregateIsRequired` at line 175 (used ONLY by `collectPersonalInfoFieldRequirements`) STAYS on AND — that helper serves Personal Info, which is out of scope per the spec.

**Why parallel and not shared:**

The investigation considered "have the route import the validator's aggregator." That would mean the route handler imports from `src/lib/candidate/validation/repeatableEntryFieldChecks.ts`. The validator module imports server-side Prisma types and helpers; the route handler also does. So there is no boundary violation in principle. BUT TD-077's structural-re-declaration pattern is about preventing a centralization that obscures which side of the loader/validator/route triangle a shape belongs to. The validator's `buildPerCountryRequiredMap` is called once per `runValidation` per section and is tied to the section validator's input shape (`DsxMappingRow[]` from `FindDsxMappings`). The route's aggregator is called once per HTTP request and is tied to the route's input shape (the result of `prisma.dSXMapping.findMany` with `include: { requirement: true }`, which carries the full requirement record, not just `requirementId`). The two shapes diverge enough that a unified helper would need a generic. Re-declaration is cheaper and preserves the TD-077 boundary.

**How the two stay in lockstep:**

A new consistency test (§6, DoD 8) exercises both paths with the same fixture and asserts equivalent results. No shared lemma module — the test is the contract.

### 1.4 Whether the `Service.functionalityType === 'idv'` / `'record'` carve-outs at `route.ts:323–334` remain

**Decision:** **Remove all of `route.ts:311–334` (the entire service-level fallback block). Resolves BR 3.**

**Rationale:**

The spec is explicit: "if nothing is marked as required in `dsx_mappings`, it is optional. There is no service-level baseline that overrides the absence of a mapping." (BR 3.) The current block at lines 311–334:

```ts
for (const serviceReq of serviceRequirements) {
  if (allRequirements.has(serviceReq.requirement.id)) continue;
  if (isRecordService) {
    const fd = (serviceReq.requirement.fieldData ?? {}) as { dataType?: string };
    if (fd.dataType !== 'address_block') continue;
  }
  allRequirements.set(serviceReq.requirement.id, {
    requirement: serviceReq.requirement,
    isRequired: true, // Service-level requirements are assumed required
    displayOrder: serviceReq.displayOrder
  });
}
```

…does two things: (a) it forces `isRequired: true` on service-level requirements with no DSX mapping (the BR 3 violation), and (b) it adds the requirement to the response at all (which controls field VISIBILITY). The visibility consequence is the trap. Per BR 5, "field visibility is unchanged."

**Mitigation for the visibility consequence:**

The plan's removal of the block affects two cases:

1. **Address History address_block on a record service that has no `dsx_mappings` row at the candidate's country.** Today the block keeps the address_block visible (the record-service carve-out lets it through). After removal, the address_block disappears for that candidate. This is a visibility regression. **The remediation:** preserve the visibility carve-out for `address_block` requirements only, but explicitly set `isRequired: false` (not `true`). This honors BR 3 (required-state semantics) while preserving BR 5 (visibility). The block is rewritten — not removed — as follows:

```ts
// TD-084 — Service-level requirements that have NO dsx_mappings row at the
// candidate's country are NOT forced to isRequired: true (BR 3). They are
// added to the response with isRequired: false IF AND ONLY IF the requirement
// is an address_block dataType — preserves the address_block visibility
// carve-out from Stage 3 (every record service needs to know where the
// candidate lived), but the required-state is now honestly false.
for (const serviceId of effectiveServiceIds) {
  const serviceRequirementsForService = serviceRequirementsByServiceId.get(serviceId) ?? [];
  for (const serviceReq of serviceRequirementsForService) {
    if (allRequirements.has(serviceReq.requirement.id)) continue;
    const fd = (serviceReq.requirement.fieldData ?? {}) as { dataType?: string };
    if (fd.dataType !== 'address_block') continue;
    allRequirements.set(serviceReq.requirement.id, {
      requirement: serviceReq.requirement,
      isRequired: false, // TD-084 BR 3 — no service-level fallback
      displayOrder: serviceReq.displayOrder,
    });
  }
}
```

2. **Education / Employment generic universal fields ("First Name", "School Name") added via the non-record service-level fallback today.** These are subject/collectionTab='subject' or universal-text fields that are NOT in `dsx_mappings`. After removal of the unconditional `isRequired: true` line, the question is whether they disappear entirely. **Inspection of the test fixtures and the EducationSection's local collectionTab filter shows that these fields are caught by the `collectionTab.includes('subject')` exclusion at `EducationSection.tsx:253` and `EmploymentSection.tsx:259` and are NOT rendered in the section anyway.** Pre-fix behavior: the route returns them, the section filters them out. Post-fix behavior: same. No regression. They flow through to the cross-section registry for Personal Info, which has its own AND-based required-state path (`personal-info-fields/route.ts`, out of scope per spec).

   Verified by inspection: `EducationSection.tsx:253` filters out `collectionTab.includes('subject')` fields and discards them from `localFieldMap`. `EmploymentSection.tsx:259` does the same. `IdvSection.tsx:219–228` does the same.

   **Therefore, for Education/Employment/IDV, removing the non-address_block service-level fallback is safe — the affected fields were never rendered in the affected sections to begin with.**

**Net effect of the carve-out review:**

- The `Service.functionalityType` lookup at `route.ts:176–180` is still needed (because the address_block visibility carve-out depends on knowing it's a record service — though we're now applying the address_block carve-out unconditionally; see below).
- **Refinement:** since the address_block carve-out is now `isRequired: false`, it does not matter whether the service is `record` or another type — the address_block being added with `isRequired: false` is harmless for non-record services that happen to define an address_block service-level requirement (Education and Employment normally don't; if they ever do, the asterisk will not show, and the local filter at `EducationSection.tsx:253` may or may not pass it through depending on `collectionTab`). So the `isRecordService` branch can be dropped from this block entirely.
- The result is simpler than the current state: the entire service-level fallback collapses to a single small block that exists ONLY to preserve address_block visibility, with `isRequired: false`.

### 1.5 Exact mechanism for OR-aggregating across the geographic hierarchy when the package contains multiple services

**Decision:** **One batched `prisma.dSXMapping.findMany` per request that covers the full `serviceIds × levelIds` cartesian product. One additional batched `prisma.service.findMany` to look up `functionalityType` for the effective service IDs. One batched `prisma.serviceRequirement.findMany` keyed by `serviceId IN (…)` to source displayOrder and (now) the address_block visibility carve-out.**

The query shape composes with the existing per-mapping OR-merge logic at `route.ts:286–308` directly — the loop body that OR-merges geographic levels for one service now ALSO OR-merges across services, because every `(serviceId, locationId)` pair feeds the same `Map<requirementId, MergedEntry>` and the same line that previously read `existing.isRequired || mapping.isRequired` is the OR-fold across the entire cartesian product. The only thing that changes is that the outer loop iterates over `levelIds × effectiveServiceIds` instead of just `levelIds`.

**Concrete Prisma query (single batched call replaces N×M per-pair calls):**

```ts
// effectiveServiceIds: string[] — derived from `serviceIds` query param (or
// legacy single `serviceId` wrapped to a one-element array).
// availableLevelIdsByService: Map<serviceId, levelId[]> — derived from the
// dsx_availability lookup loop (existing); a level is excluded for a service
// if dsx_availability says isAvailable: false at that level.
const pairs: Array<{ serviceId: string; locationId: string }> = [];
for (const sid of effectiveServiceIds) {
  for (const lid of (availableLevelIdsByService.get(sid) ?? [])) {
    pairs.push({ serviceId: sid, locationId: lid });
  }
}

const allMappings = pairs.length === 0 ? [] : await prisma.dSXMapping.findMany({
  where: {
    OR: pairs.map((p) => ({ serviceId: p.serviceId, locationId: p.locationId })),
  },
  include: { requirement: true },
  orderBy: [
    { serviceId: 'asc' },
    { locationId: 'asc' },
    { requirementId: 'asc' },
  ],
});
```

**OR-fold (single pass over the rows):**

The fold is the same as today's inner loop at `route.ts:286–308`, with two cosmetic differences:

1. The level walk is no longer wrapped in `for (const levelId of levelIds) { ... levelMappings = await ... ; for (const mapping of levelMappings) { ... } }`. Instead, a single `for (const mapping of allMappings) { ... }` runs over the pre-batched result.
2. The "most-specific level wins for displayOrder" rule is preserved by sorting the input by `levelId` ordering: the architect uses the existing `displayOrderByRequirementId` map (which is sourced from `service_requirements`, not from `dsx_mappings`) for the authoritative displayOrder. The legacy `999` fallback path (line 290) is unchanged.

The new module `aggregateFieldsRequired.ts` (§1.3) exports this fold as a pure function so it can be unit-tested without a Prisma harness.

**No `requirementId` IN-filter on the query.** Mirrors the validator's existing pattern (`personalInfoIdvFieldChecks.ts:344–358`) — the route doesn't pre-know the requirement set; it discovers them from the rows.

**Tradeoff vs. multiple round-trips:** the current code issues `levelIds.length` separate `dSXMapping.findMany` calls (currently 1–4 per service). Cross-service multiplies that by `serviceIds.length`. For a typical Address History package with 2 record services and one country (no subregion), that's 2 calls today and 1 call after the batch. For an IDV with 3 services and one country, 3 calls become 1. The latency win is small (10–30 ms range) but consistent.

### 1.6 Caching / memoization across section calls

**Decision:** **No request-level memoization beyond the existing per-section batching.** Validation latency is not at risk (per §1.5, the per-section count drops from N to 1 inside the route's call). The validator side already does one batched `findMappings` per section. Adding a request-level cache adds invalidation complexity for no observed bottleneck.

**Rationale:**

- Stage 3b's Edge Case 8 (validation latency) is satisfied by the single-batched-query pattern in the validator. TD-084 does not regress that — the validator's batched query is unchanged in shape (only the AND→OR fold changes).
- The route is called per section per country-switch in the UI — order of magnitude single-digit calls per candidate session. A request-level cache keyed by package fingerprint would have to span those independent HTTP requests, which means session-level cache, which means cache invalidation on data changes. Out of scope.
- If a future stage observes a latency regression from this change, it can introduce a session-scoped cache as a separate work item.

### 1.7 How `useEntryFieldsLoader` absorbs the new contract

**Decision:** **The loader hook keeps its current public API shape (same exported names, same parameters at the call sites in `AddressHistorySection.tsx`), but its INTERNAL implementation collapses the per-service loop into a single fetch per entry. The per-service keying in `fieldsByEntryService` (currently `${entryId}::${serviceId}`) collapses to a per-entry keying (`${entryId}`).**

**Public-API change for `fieldsByEntryService`:** The hook's exported `fieldsByEntryService: Record<string, EntryDsxField[]>` is **renamed** to `fieldsByEntry: Record<string, EntryDsxField[]>`. The downstream consumer (`AddressHistorySection.tsx:113` destructures it; `buildEntryFieldsBuckets` in `addressHistoryStage4Wiring.ts` iterates it) gets a one-line shape update.

**Why the rename instead of preserving the per-service keying:** the current per-service keying exists so the section can de-dup by `fieldKey` across services on the client (`buildEntryFieldsBuckets` does this fold). With the route now returning the de-duped + OR-merged set in one response, that client-side fold is redundant for required-state purposes. Keeping the per-service keying would force the section to re-issue per-service calls to honor the existing shape — defeating the batching win.

**`buildEntryFieldsBuckets` and `splitFieldsByCollectionTab` consequences:** Both helpers live in `src/lib/candidate/addressHistoryStage4Wiring.ts` and operate on the per-entry-per-service map. After the contract change, they operate on a per-entry map. The signature changes from `(entries, fieldsByEntryService, serviceIds)` to `(entries, fieldsByEntry)`. Internally, the `for (const serviceId of serviceIds) { for (const f of fieldsByEntryService[${entryId}::${serviceId}]) { ... } }` nested loop becomes `for (const f of fieldsByEntry[entryId] ?? []) { ... }`. The de-dup-by-fieldKey logic stays (it's still correct as a defensive measure even though the route now does the dedup; a renamed-requirement edge case could otherwise drop fields).

**This DOES cross into `addressHistoryStage4Wiring.ts`** — that file is on the modification list (§3.5) and was read before this plan was written.

---

## 2. Hard architectural constraints — confirmation that this plan respects each

| Constraint | This plan's resolution |
|---|---|
| BR 1 — Cross-service OR | Route's batched query includes all `serviceIds`; aggregator OR-folds. Validator's `buildPerCountryRequiredMap` flips its inner fold from `every` to `some`. |
| BR 2 — Geographic-hierarchy OR | Already implemented in the route (existing line 304). Preserved as part of the same single-pass OR-fold. |
| BR 3 — No service-level fallback | The `route.ts:323–334` block is rewritten to add `isRequired: false` for the address_block visibility carve-out only. Education/Employment generic universal fields never rendered locally anyway; their pre-fix `isRequired: true` was never visible. |
| BR 4 — Consistency between rendering and validation | DoD 8 consistency test exercises both paths on the same fixture; the route's aggregator and the validator's aggregator are independent implementations that converge by construction (same input, same OR semantics). |
| BR 5 — Field visibility unchanged | The address_block visibility carve-out is preserved (now with `isRequired: false`). The non-address_block service-level fallback removal does not affect rendering because those fields are filtered out by the section components' `collectionTab` filters. |
| No schema changes | Confirmed — the plan adds zero Prisma migrations. |
| No `/validate` response shape change | Confirmed — the `/validate` route and its response shape are not touched. |
| TD-077 — Sibling-validator type exports OK; cross-boundary types module NOT OK | The plan does not add a cross-layer shared types module. The route's aggregator is a new sibling pure file in the route's directory. The validator's aggregator stays in `repeatableEntryFieldChecks.ts`. |
| DoD 13 — `DynamicFieldRenderer.tsx:286–288` and `AddressBlockInput.tsx:327–330` not modified | Confirmed — neither file is on the modification list. |
| DoD 14 — `AddressBlockInput.tsx:493` and `:537` not modified | Confirmed. |
| CODING_STANDARDS §9.4 — no validator helper or route over 600 lines | Per §3 below: `route.ts` goes from 365 → ≈410 lines (net ~+45 add, ~−15 from removed fallback = ~+30). `repeatableEntryFieldChecks.ts` goes from 464 → 466 (one-line operator change + comment update). `personalInfoIdvFieldChecks.ts` goes from 632 → 634 (one-line operator change + comment update — already over 600 BUT this is a one-line operator change inside an existing line, requiring escalation; see Implementation Gates §5). |

---

## 3. File-by-file change list with line-count projections

### 3.1 New files to create

#### 3.1.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/fields/aggregateFieldsRequired.ts` (NEW)

**Purpose:** Pure helper that takes the result of `dsx_mappings.findMany` (a flat `DsxMappingWithRequirement[]`) plus the `displayOrderByRequirementId` lookup and returns the `Map<requirementId, MergedEntry>` the route's response builder consumes. Encodes the OR-fold over the combined `(serviceId, levelId)` cartesian. Server-side only. No Prisma imports — the function takes the rows as input.

**Exports:**

- `orMergeMappings(rows: DsxMappingWithRequirement[], displayOrderByRequirementId: Map<string, number>): Map<string, MergedEntry>` — the public function.
- `interface DsxMappingWithRequirement { requirementId: string; serviceId: string; locationId: string; isRequired: boolean; requirement: DSXRequirementShape; }` — re-declared structurally from the Prisma `findMany` result.
- `interface DSXRequirementShape { id: string; name: string; fieldKey: string; type: string; disabled: boolean; fieldData: unknown; documentData: unknown; }` — re-declared structurally.
- `interface MergedEntry { requirement: DSXRequirementShape; isRequired: boolean; displayOrder: number; }` — re-declared structurally (mirrors the route's current local type alias at `route.ts:219–223`).

**No internal helpers other than the OR-fold.**

**No imports beyond TS standard types.** The Prisma payload is referenced only by structural compatibility — the route passes the rows in.

**Projected line count:** ≈ 80 lines (function + 3 type aliases + comment banner). Well under cap.

**Why a separate module:** the route handler is at 365 lines and grows by the new pre-aggregation orchestration (≈+45 lines, see §3.2). Keeping the OR-fold inside a sibling file (a) isolates it for unit testing without a route harness, (b) prevents the route from creeping past 500/600, (c) gives the test-writer one focused unit-test surface that matches BR 1 + BR 2 semantics.

### 3.2 Existing files to modify

#### 3.2.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/fields/route.ts` (MODIFY)

**File was read in full before this plan was written.** Confirmed (365 lines as of 2026-05-11).

**What changes:**

1. **Query-param parsing (lines 92–116):** Add support for `serviceIds` (repeated). The `URL.searchParams.getAll('serviceIds')` returns `string[]`. Resolve the effective list: prefer `serviceIds` over single `serviceId`. The 400-error path stays untouched when neither is supplied. Validate every element of `serviceIds` is a non-empty string (no UUID format check; existing `serviceId` doesn't have one either).

2. **Service-functionality lookup (lines 170–180):** Change `prisma.service.findUnique({ where: { id: serviceId } })` to `prisma.service.findMany({ where: { id: { in: effectiveServiceIds } }, select: { id: true, functionalityType: true } })` once for the full list. Build a `functionalityTypeById: Map<string, string | null>` for later use.

3. **Service-requirements loading (lines 187–212):** Change to `prisma.serviceRequirement.findMany({ where: { serviceId: { in: effectiveServiceIds }, requirement: { disabled: false } }, include: { requirement: true }, orderBy: { displayOrder: 'asc' } })` once. Group rows by `serviceId` into a `Map<serviceId, ServiceRequirementRow[]>`. Build the existing `displayOrderByRequirementId` lookup off the merged rows (most-recent write wins for the same requirementId across services; this matches the current single-service shape because today's call already returns the single service's displayOrder).

4. **Geographic-level walk (lines 137–168):** Unchanged shape — the level walk runs once per request (the country / subregion chain is the same regardless of how many services are in scope). The result `levelIds: string[]` is the same.

5. **dsx_availability check (lines 226–269):** Currently runs once per level inside the per-level loop. Restructure: for each `(serviceId, levelId)` pair, check `dsx_availability` once. Build `availableLevelIdsByService: Map<serviceId, string[]>` — the levels at which the service is available. This is a small additional O(serviceIds × levelIds) lookup. The existing defensive try/catch and "missing row defaults to available" rule are preserved.

6. **dsx_mappings batched query (lines 271–308):** Replace the per-level `findMany` loop with a single batched `findMany` covering every `(serviceId, levelId)` pair in `availableLevelIdsByService`. The query shape is in §1.5 above.

7. **OR-fold:** Replace the inline merge loop (lines 286–308) with a call to the new `orMergeMappings(rows, displayOrderByRequirementId)` from `./aggregateFieldsRequired.ts`. The route handler is left with the orchestration; the fold lives in the helper.

8. **Service-level fallback block (lines 311–334):** Rewrite to the address_block-visibility-only carve-out per §1.4. The `for (const serviceReq of serviceRequirements)` becomes a nested loop over `effectiveServiceIds` and the grouped `serviceRequirementsByServiceId` map. `isRequired: true` becomes `isRequired: false`. The `isRecordService` check is removed (the carve-out applies to address_block regardless of service type, with `isRequired: false`).

9. **Response shape (lines 336–357):** Unchanged.

10. **Logging:** Existing log lines preserved. Add one `logger.debug` line when both `serviceId` and `serviceIds` are present (the legacy and new shapes collide); the new path wins, the legacy is ignored.

**Estimated line delta:**

| Change | Δ lines |
|---|---|
| Add `serviceIds` parsing + effective-list resolution | +12 |
| Switch `service.findUnique` to `findMany` + map build | +6 |
| Switch `serviceRequirement.findMany` to grouped result | +4 |
| Restructure availability check to per-service-per-level map | +8 |
| Replace per-level `findMany` loop with batched call + pair-list construction | −10 (the loop body collapses) |
| Replace inline merge with call to `orMergeMappings` | −15 (the merge logic moves to the new module) |
| Rewrite service-level fallback block to address_block visibility only | −5 (smaller logic, single dataType check) |
| New comment block referencing TD-084 + BR 3 + this plan | +6 |

Net: **+6 lines**. The route file lands at ≈ 371 lines (well below cap).

**Conservative buffer:** +20 lines for TypeScript narrowing boilerplate and explanatory comments. Conservative landing estimate: **≈ 391 lines**. Still well below 500.

**What stays unchanged:**

- Authentication flow (lines 75–90).
- Invitation existence / expiry / completed checks (lines 119–135).
- The geographic-hierarchy `levelIds` walk (lines 137–168) — applies once per request.
- The DSX-availability defensive try/catch (lines 233–261), restructured but behaviorally identical.
- The 400 error text `"Missing serviceId or countryId parameter"` — preserved.
- The 400 error text `"Invalid subregionId parameter"` — preserved.
- The 401/403/404/410/500 error paths and texts — preserved.
- Response field types and ordering (`requirementId`, `name`, `fieldKey`, `type`, `dataType`, `isRequired`, `instructions`, `fieldData`, `documentData`, `displayOrder`).
- The `displayOrder` sort at line 355.

#### 3.2.2 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/repeatableEntryFieldChecks.ts` (MODIFY)

**File was read in full before this plan was written.** Confirmed (464 lines).

**What changes:**

- **Line 317:** Change `aggregated.set(requirementId, flags.length > 0 && flags.every(Boolean))` to `aggregated.set(requirementId, flags.length > 0 && flags.some(Boolean))`. One operator change (`every` → `some`).
- **Lines 312–317:** Rewrite the comment block to point at TD-084 / BR 1 instead of "AND semantics matching personalInfoIdvFieldChecks.aggregateIsRequired". The comment becomes:
  ```
  // OR semantics matching TD-084 BR 1 / BR 2 — a requirement is required if
  // ANY in-scope mapping row (across cross-service or cross-geographic-level
  // dimensions) says required. Empty arrays are explicitly false (defensive
  // guard preserved from the original AND form).
  ```

**Line delta:** −0 + comment rewrite. Net: **0 lines**. Lands at exactly 464.

**What stays unchanged:** every other line. The OR change is strictly internal to `buildPerCountryRequiredMap`; the function's signature, its callers, its tests, all are preserved.

#### 3.2.3 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` (MODIFY)

**File was read in full before this plan was written.** Confirmed (632 lines — already over the 600-line hard stop, but the change is one-character).

**What changes:**

- **Line 395:** Change `const isRequired = flags.length > 0 && flags.every(Boolean);` to `const isRequired = flags.length > 0 && flags.some(Boolean);` inside `collectIdvFieldRequirements`. One operator change.
- **Comment update:** Lines 391–395 carry the AND-semantics comment. Rewrite to point at TD-084 / BR 1 (similar to §3.2.2's pattern).

**What does NOT change:**

- `aggregateIsRequired` at line 175 — this is consumed by Personal Info ONLY (`collectPersonalInfoFieldRequirements` at lines 211–282). Personal Info is OUT OF SCOPE per the spec; TD-060 set Personal Info's required-state on AND deliberately. The function stays on AND.
- The function's signature, its callers, its tests.

**Line delta:** −0 + comment rewrite. Net: **0 lines**. Lands at exactly 632.

**File-size implication:** The file is over 600. CODING_STANDARDS §9.4 says "no automated agent may add code to a source file over 600 lines without explicitly stopping to ask first." This is a one-line operator change with comment update — not an addition. **Implementation Gate G2 (§5) — the implementer must stop and confirm with Andy that this single-line modification inside an over-cap file is permitted before proceeding.** Surface this in the implementer's checkpoint.

#### 3.2.4 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/IdvSection.tsx` (MODIFY)

**File was read in full before this plan was written.** Confirmed (555 lines).

**What changes:**

1. **Lines 195–260 — `loadFieldsForCountry`:** Replace the per-service for loop with a single fetch passing all `serviceIds` as repeated query params. The post-filter (`isPersonalInfoField`) stays. The `fieldMap.has(field.requirementId)` dedup stays (defensive). The function shape and signature do not change.

   Specifically, lines 202–229 (the `for (const serviceId of serviceIds)` block) collapse to one fetch. The URL construction changes from:
   ```ts
   `/api/candidate/application/${token}/fields?serviceId=${serviceId}&countryId=${countryId}`
   ```
   to:
   ```ts
   `/api/candidate/application/${token}/fields?${serviceIds.map(id => `serviceIds=${encodeURIComponent(id)}`).join('&')}&countryId=${countryId}`
   ```

2. **The personal-info-tab filter (lines 219–228):** Unchanged. Still applied to the de-duplicated response.

3. **The post-loop sort at lines 232–235:** Unchanged.

**Line delta:** −12 (per-service loop body collapses) +6 (URL construction with array join + defensive guard for empty `serviceIds`). Net: **−6 lines**. Lands at ≈ 549 lines.

**What stays unchanged:** all of `handleCountryChange` (lines 285–311), all of `loadSavedData` (lines 140–184), every JSX render path, every `useEffect` (including the country-cleanup `useEffect` from TD-072), every other handler.

#### 3.2.5 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/useEntryFieldsLoader.ts` (MODIFY)

**File was read in full before this plan was written.** Confirmed (186 lines).

**What changes:**

1. **Interface rename:** `fieldsByEntryService: Record<string, EntryDsxField[]>` → `fieldsByEntry: Record<string, EntryDsxField[]>`. The keying changes from `${entryId}::${serviceId}` to `${entryId}` (one entry, one merged set).

2. **`loadFieldsForEntry` (lines 124–178):** Replace the per-service for loop (lines 130–160) with a single fetch. The URL packs all `serviceIds`. The state write becomes `setFieldsByEntry(prev => ({ ...prev, [entryId]: fields }))` instead of one write per service.

3. **The stale-response invalidation pattern (lines 126–145):** Preserved — the `fireCounter` capture + post-fetch counter check pattern stays. The check happens once after the single fetch instead of once per service iteration.

4. **`clearEntry` (lines 109–122):** Update the `key.startsWith(\`${entryId}::\`)` check to `key === entryId` (the keying no longer has `::serviceId`).

5. **The `fieldData._serviceId` tag injection at lines 151–154:** This tag is currently used by `addressHistoryStage4Wiring.ts` to sort the aggregated area by service-type-order. Under the new shape (one merged response, no per-service split), the tag is **no longer derivable** — the response doesn't preserve which service contributed which requirement. **The mitigation:** drop the tag, drop the sort dependency on it, and rely on `serviceTypeOrder` being set from the section's overall functionality type (which Address History knows — it's the `record` bucket per `AddressHistorySection.tsx:84`). The aggregated area's sort is already constant `SERVICE_TYPE_ORDER_RECORD = 1` for every Address History field (line 84 + 394 of `AddressHistorySection.tsx`), so this dependency was vestigial.

**Line delta:** −18 (per-service loop removed) +6 (single fetch construction) +2 (defensive guard for empty serviceIds). Net: **−10 lines**. Lands at ≈ 176 lines.

#### 3.2.6 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressHistorySection.tsx` (MODIFY)

**File was read in full before this plan was written.** Confirmed (596 lines — close to cap; the change must be net-negative).

**What changes:**

1. **Line 13:** Update the destructure to match the new `useEntryFieldsLoader` shape: `const { fieldsByEntry, loadFieldsForEntry, invalidateEntry, clearEntry } = useEntryFieldsLoader(token, serviceIds);` (was `fieldsByEntryService`).

2. **Line 385 (the `useMemo` for `entryFieldBuckets`):** Update the call to `buildEntryFieldsBuckets(entries, fieldsByEntry, serviceIds)` — the helper's signature is changing in §3.5 below to read from the per-entry map.

**Line delta:** **0** (two-line one-char-each renames; no logic change). Lands at exactly 596 lines.

**Compliance:** Section file stays at 596, under 600. The change is restricted to wiring — no logic added.

#### 3.2.7 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/EducationSection.tsx` (MODIFY)

**File was read in full before this plan was written.** Confirmed (610 lines — already over the 600-line hard stop).

**What changes:**

1. **Lines 234–263 — `loadFieldsForCountry`:** Replace the per-service for loop with a single fetch. The `localFieldMap` / `subjectFieldMap` split stays as a post-pass. The fetch URL packs `serviceIds` per §3.2.4's pattern.

**Line delta:** −20 (per-service loop removed) +6 (single fetch with array-joined URL). Net: **−14 lines**. Lands at ≈ 596 lines (drops below the 600 line ceiling).

**File-size implication:** The file is over 600 today. The change is net-negative (file shrinks). **Implementation Gate G3 (§5) — the implementer must stop and confirm with Andy that this net-negative modification inside an over-cap file is permitted before proceeding.**

#### 3.2.8 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/EmploymentSection.tsx` (MODIFY)

**File was read in full before this plan was written.** Confirmed (639 lines — already over the 600-line hard stop).

**What changes:**

1. **Lines 226–295 — `loadFieldsForCountry`:** Same shape as Education. Per-service for loop collapses to one fetch. The `localFieldMap` / `subjectFieldMap` split stays.

**Line delta:** −22 (per-service loop removed) +6 (single fetch with array-joined URL). Net: **−16 lines**. Lands at ≈ 623 lines (still over the cap, but net-negative).

**Implementation Gate G4 (§5) — same condition as Education.** The implementer must stop and confirm before proceeding.

#### 3.2.9 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/addressHistoryStage4Wiring.ts` (MODIFY)

**File NOT read in full before this plan was written. Read the function signatures by grep — see Risks §8.**

**Architect's confidence note:** This file was referenced by inspection. The architect grepped for `buildEntryFieldsBuckets`, `splitFieldsByCollectionTab`, and `_serviceId`. Verified function names exist and the per-service iteration is the dependency. Full read required by the implementer before touching.

**What changes:**

1. **`buildEntryFieldsBuckets` signature:** Change from `(entries, fieldsByEntryService, serviceIds)` to `(entries, fieldsByEntry)`. The internal nested-loop dedup becomes a single iteration over `fieldsByEntry[entry.entryId]`.
2. **Any reader of `field.fieldData._serviceId`:** Drop the dependency. Use the constant `SERVICE_TYPE_ORDER_RECORD = 1` already defined in `AddressHistorySection.tsx:84` for the sort key (or hoist that constant into this file if cleaner).

**Line delta:** Unknown until full read. Estimated −10 to +5. **The implementer must read the file fully before making the change** (per architect's discipline).

### 3.3 Files NOT modified

These files were read and confirmed not to require changes:

- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/validationEngine.ts` — the orchestrator passes `findMappings` and `requirementById` through unchanged. The AND→OR flip lives inside `repeatableEntryFieldChecks.ts:317` (called from the engine but the engine doesn't need to know). Line count stays at 573.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/loadValidationInputs.ts` — the loader's `requirementById` map is unchanged in shape and content. No new fields needed. Line count stays at 332.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/buildReviewSummary.ts` — the review summary builder is downstream of `fieldErrors`. Its logic is unchanged; the `fieldErrors` it folds may grow or shrink under the OR semantics but its iteration is the same. Line count stays at 76.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/DynamicFieldRenderer.tsx` — DoD 13. Lines 286–288 explicitly not modified. No other change.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressBlockInput.tsx` — DoD 13 (lines 327–330) and DoD 14 (lines 493, 537) explicitly not modified. No other change.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/personal-info-fields/route.ts` — Personal Info is out of scope. AND-merge stays.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-address.ts` — types unchanged.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts` (referenced via `FieldMetadata`, `DocumentMetadata`, `FieldValue`) — unchanged.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-stage4.ts` — unchanged.
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/savedEntryShape.ts` — unchanged.
- All Prisma schema files. No migration.
- All translation files. No new keys.

---

## 4. Data flow

### 4.1 Prose

The candidate selects a country in IDV (or sets a country on an Address History / Education / Employment entry). The section component derives its `serviceIds` from the structure endpoint's response (already in props) and the section's selected country. It calls `GET /api/candidate/application/[token]/fields` exactly once for the country, packing all `serviceIds` into repeated query parameters.

The route handler:

1. Authenticates and validates query parameters.
2. Walks the country/subregion hierarchy to assemble `levelIds: string[]`.
3. Loads `Service.functionalityType` for every effective serviceId in one batched query (used only for the address_block visibility carve-out at the post-fold step).
4. Loads `serviceRequirements` for every effective serviceId in one batched query (used for the `displayOrder` lookup and the address_block visibility carve-out).
5. Checks `dsx_availability` per `(serviceId, levelId)` pair to drop unavailable levels per service.
6. Issues ONE `prisma.dSXMapping.findMany` over the full `serviceIds × availableLevelIds` cartesian, with `include: { requirement: true }`.
7. Hands the rows to `orMergeMappings(rows, displayOrderByRequirementId)` (new pure helper). The helper OR-folds `isRequired` across the entire cartesian into a `Map<requirementId, MergedEntry>`.
8. Adds the address_block visibility carve-out with `isRequired: false`.
9. Returns the response.

The section component:
- For IDV: applies its personal-info-tab filter and the requirementId dedup (defensive). Passes each surviving field through `DynamicFieldRenderer` with `isRequired={field.isRequired}`. `DynamicFieldRenderer.tsx:286–288` (unchanged) consumes the prop and renders the asterisk.
- For Address History: passes the address_block field through `AddressBlockInput` with `isRequired={addressBlockField.isRequired}`. `AddressBlockInput.tsx:327–330` (unchanged) ANDs `pieceRequired && isRequired` and renders the per-piece asterisk.
- For Education / Employment: passes each surviving field through `DynamicFieldRenderer`. Same.

For VALIDATION, the validation engine (`runValidation`) operates entirely independently. It calls `loadValidationInputs` to build a `findMappings` adapter and a `requirementById` map. For each repeatable section, it calls into `validateAddressHistoryEntries` / `validateEducationEntries` / `validateEmploymentEntries`, which collect entry-country pairs, issue ONE batched `findMappings` per section, and call `buildPerCountryRequiredMap` to OR-fold (post-TD-084) the flags per `<countryId, requirementId>`. The validator then iterates each entry's saved values, emitting `FieldError`s for required-but-empty fields. For IDV, `collectIdvFieldRequirements` does the same fold on its `(idvServiceIds × selectedCountryId)` query (now OR per BR 1).

The two paths are independent implementations of the same OR-fold semantics. DoD 8's consistency test (§6) is the contract that proves they agree.

### 4.2 Numbered sequence (IDV happy path, post-fix)

```
1. Candidate selects country US in IDV.
2. IdvSection.loadFieldsForCountry(US) fires.
3. Single HTTP GET → /api/candidate/application/{token}/fields?serviceIds=svc-A&serviceIds=svc-B&countryId=US.
4. Route reads serviceIds=[svc-A, svc-B], countryId=US.
5. levelIds=[US] (no subregion).
6. service.findMany({ id IN [svc-A, svc-B] }) → functionalityType lookup.
7. serviceRequirement.findMany({ serviceId IN [svc-A, svc-B], requirement: { disabled: false } }) → displayOrder lookup + carve-out source.
8. For each (sid, US): check dsx_availability. Both svc-A and svc-B available at US.
9. dSXMapping.findMany({ OR: [{ serviceId: svc-A, locationId: US }, { serviceId: svc-B, locationId: US }] }) → returns rows for both services at US.
10. orMergeMappings(rows, displayOrderByRequirementId) → Map<requirementId, MergedEntry> with OR-merged isRequired per requirement.
11. address_block visibility carve-out: for any service-level address_block requirement not in the map, add with isRequired=false.
12. Response shape unchanged: { fields: [...] }.
13. IdvSection filters out collectionTab='subject'|'personal' fields, dedups by requirementId (no-op here), sorts by displayOrder.
14. Each surviving field is passed to DynamicFieldRenderer with isRequired={field.isRequired}.
15. DynamicFieldRenderer:286–288 renders the asterisk based on isRequired.
```

### 4.3 Numbered sequence (validator happy path, post-fix)

```
1. /validate fires (debounced after a save).
2. runValidation(invitationId) → loadValidationInputs(invitationId).
3. Loader builds requirementById map + findMappings adapter.
4. Engine calls validateAddressHistoryEntries(...) (and Edu / Emp / IDV).
5. validateAddressHistoryEntries → walkSection.
6. walkSection.collectSectionPairs → { serviceId, locationId } pairs (cartesian of section's package services × distinct entry countries).
7. findMappings({ requirementIds: [], pairs }) → single batched dSXMapping.findMany.
8. buildPerCountryRequiredMap(rows) → Map<countryId, Map<requirementId, boolean>>.
   POST-TD-084: inner fold is flags.some(Boolean), not flags.every(Boolean).
9. For each entry, walkSection iterates the applicable requirements per its country, emitting FieldErrors for required-but-empty fields.
10. buildReviewSummary folds the FieldErrors into ReviewError items.
11. /validate returns { sections, summary } (shape unchanged).
12. The candidate portal's section status indicators update from the response.
```

---

## 5. Implementation gates

The implementer stops and surfaces a decision at each of these checkpoints:

- **G1.** Any moment the implementer would touch `DynamicFieldRenderer.tsx:286–288`, `AddressBlockInput.tsx:327–330`, `AddressBlockInput.tsx:493`, or `AddressBlockInput.tsx:537`. (DoD 13, DoD 14.) The fix is upstream of these.
- **G2.** Modifying `personalInfoIdvFieldChecks.ts` (already at 632 lines, over the 600-line hard stop). Per CODING_STANDARDS §9.4 the implementer must stop and ask before adding ANY code to an over-cap file. This plan calls for a one-line operator change (`every` → `some`) + comment rewrite. Surface the change to Andy in the checkpoint and confirm permission before applying.
- **G3.** Modifying `EducationSection.tsx` (already at 610 lines, over the 600-line hard stop). The change is net-negative (file shrinks by ~14 lines). Surface and confirm before applying.
- **G4.** Modifying `EmploymentSection.tsx` (already at 639 lines, over the 600-line hard stop). The change is net-negative (file shrinks by ~16 lines, stays at ~623 over cap). Surface and confirm.
- **G5.** Any moment a schema change or Prisma migration would be required. This plan calls for ZERO. If the implementer believes a schema change is needed, stop.
- **G6.** Any moment the new `aggregateFieldsRequired.ts` would grow past 200 lines. The plan projects ~80 lines; growth past 200 is a sign the architect underestimated and the test-writer / implementer should resurface.
- **G7.** Any moment the route file (`route.ts`) would cross 500 lines (soft cap) or 600 (hard cap). The plan projects ~391 lines as a conservative upper bound; crossing 500 is a surprise that needs surfacing.
- **G8.** Any moment a test would change in a way that drops a real assertion rather than flipping AND→OR (or removing a service-level-fallback assertion). Per the spec's Test Contract: "no test is deleted to chase green."
- **G9.** Any moment a business rule from the spec would need to be relaxed. Surface back to Andy.
- **G10.** Any moment the `/validate` response shape would need to change. The plan does not require this; if the implementer believes it does, stop.
- **G11.** Modifying `addressHistoryStage4Wiring.ts` (the architect did not read this file in full — see Risks §8). The implementer must read the file in full before touching, and surface in the checkpoint whether the per-`_serviceId` sort dependency is actually vestigial as the architect projects.

---

## 6. Test plan (high-level)

The test-writer translates these into concrete tests. The architect specifies WHAT must be tested per acceptance criterion, not HOW.

### 6.1 Cross-service OR-merge (BR 1, DoD 1, 2, 3)

- **WHAT (validator):** A fixture with two package services associated with the same requirement at the same country, where one service's `dsx_mappings.isRequired = true` and the other's `isRequired = false`. Assertion: the validator's `fieldErrors` (for an empty field on that requirement) INCLUDES the requirement.
- **WHAT (route):** Same fixture, same package shape. Assertion: the route's response carries `isRequired: true` for the requirement.
- **WHAT (consistency, DoD 8):** Run the route's aggregator and the validator's aggregator on the same fixture. Assert the two booleans agree.

These tests **fail on the current main baseline** (which AND-merges) and **pass after implementation**. The Stage 3b plan's "the test that should fail before implementation lands" pattern.

### 6.2 Geographic-hierarchy OR-merge (BR 2, DoD 4, 5)

- **WHAT (validator):** A fixture with `dsx_mappings` rows at BOTH country and subregion level for the same `(requirementId, serviceId)` with differing `isRequired`. Assert validator reports required if ANY level says required.
- **WHAT (route):** Parallel test on the route's response. The existing geographic OR-merge test at `route.test.ts:669–770` is the precedent — it stays as-is; this new test adds explicit BR 2 coverage at the validator path.

### 6.3 No service-level fallback (BR 3, DoD 6, 7)

- **WHAT (validator):** A fixture with a `serviceRequirements` row for a requirement but no `dsx_mappings` row at the candidate's country. Assert validator does NOT include the field in `fieldErrors` when empty.
- **WHAT (route):** Same fixture, on the route. Assert the route's response carries `isRequired: false` for that requirement (visibility preserved for address_block only).
- **WHAT (route, visibility carve-out):** A fixture with an address_block service-level requirement and no DSX mapping at the country. Assert the field IS in the response (visibility preserved per BR 5) AND `isRequired: false`.
- **WHAT (existing tests, rewrites):**
  - `fields/__tests__/route.test.ts:298–325` — "should return service-level requirements not in location mapping" — the existing test does not currently assert `isRequired: true` explicitly. It does fixture a `mockServiceRequirements` (non-record service) with a service-level requirement and no mapping. Under TD-084 the requirement either (a) drops out of the response entirely (if it is not address_block) or (b) appears with `isRequired: false` (if it is address_block). The fixture's `req-3` has `dataType: 'email'`, so per (a) the test should assert `data.fields.length === 0`. **The implementer rewrites this test** to fixture an address_block requirement (the case that still appears) and asserts `isRequired: false`. The rewrite preserves the test's intent (verify what happens when a `serviceRequirements` row has no `dsx_mappings` row) and updates the assertion to the new contract.
  - `fields/__tests__/route.test.ts:533–598` ("Phase 6 Stage 3 — record service service-level baseline filtering") — `skips service-level non-address_block requirements for record services` STAYS valid (the non-address_block service-level requirement is still excluded). `keeps service-level non-address_block requirements for non-record (verification-edu) services` — **this test must FLIP**: under TD-084 the non-address_block service-level requirement no longer appears for non-record services either (BR 3). The implementer rewrites to assert `data.fields.length === 0`.
- **WHAT (existing tests, kept):** `fields/__tests__/route.test.ts:262–297` ("should return fields successfully with location mapping") — STAYS unchanged. The fixture has a `dsx_mappings` row with `isRequired: true`, so the route returns `isRequired: true` regardless of TD-084.

### 6.4 Per-section concrete fixtures (DoD 9, 10, 11, 12)

- **IDV (DoD 9):** A fixture matching the smoke-test: IDV service with In-Country Address as a service-level requirement, country = US, no `dsx_mappings` row. Assert: the field renders without asterisk (route returns `isRequired: false` for the address_block, visibility preserved per BR 5) AND the validator does not include the field in `fieldErrors`.
- **Address History (DoD 10):** A package with a US record service whose `dsx_mappings` rows for the address_block requirement at the US have `isRequired: false`. Assert: route returns `isRequired: false` for the parent address_block, so per `AddressBlockInput.tsx:327–330`'s AND, NO per-piece asterisk renders even when `addressConfig[piece].required = true`.
- **Education (DoD 11):** A package with a service whose mappings yield `isRequired: false` for an Education requirement at the entry's country. Assert: no asterisk, no `fieldErrors`.
- **Employment (DoD 12):** Same as Education for an Employment requirement.

### 6.5 Existing tests that need rewriting (per spec §Test Contract)

- **`validationEngine.test.ts`** — every cross-service AND-merge assertion that becomes incorrect under OR. **Discovery:** by inspection, no existing test fixtures two services with differing `isRequired` for the same requirement at the same country. The geographic-OR test at line 968–999 fixtures the same requirement at two DIFFERENT countries (not the cross-service case). So no rewrite needed in this file for AND→OR flip; the new tests in §6.1 are net-new.
- **`personalInfoIdvFieldChecks.test.ts`** — same. No existing test fixtures two IDV services with differing `isRequired`. No rewrite needed; new tests are net-new.
- **`fields/__tests__/route.test.ts`** — TWO rewrites (per §6.3): the test at line 298–325 and the test at line 600–644.
- The test at `validationEngine.test.ts:968–999` (geographic case across two countries) STAYS — geographic OR is BR 2 and is unchanged in direction; the test already encodes OR-direction semantics correctly (the test asserts only entry B with `isRequired: true` country produces an error).

### 6.6 Tests that must continue to pass unchanged

- All `personal-info-fields` route tests (TD-060 territory).
- All Stage 3b per-entry field-validation tests EXCEPT the two route-test rewrites above. The Stage 3b structure (per-entry walk, address-block JSON descent, missing-country error, malformed-JSON handling) is preserved.
- All Stage 3b IDV country-switch cleanup tests.
- All scope/gap/date-extraction tests.
- All submission orchestrator tests.

### 6.7 Test coverage targets

- Every business rule (1–11 from the spec) has at least one acceptance criterion. Every acceptance criterion has at least one test (or test rewrite). The test-writer produces a mapping in their checkpoint: BR → DoD → test file:line.

---

## 7. Order of implementation

The implementer follows this sequence. Each step is independently verifiable.

1. **Database changes.** NONE. (Confirmation step — the implementer verifies and proceeds.)
2. **Prisma migration.** NONE.
3. **TypeScript types.** No new types in `src/types/`. Internal type aliases in the new module `aggregateFieldsRequired.ts` (re-declared structurally per TD-077).
4. **Zod schemas.** No new Zod schemas (the route's existing query-string validation is hand-rolled, not Zod).
5. **New helper module.** Create `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/fields/aggregateFieldsRequired.ts` (§3.1.1). Pure function, structurally re-declared types, no Prisma import.
6. **Validator OR flip (1 line).** Edit `repeatableEntryFieldChecks.ts:317` (§3.2.2). Update comment. Halt at G2 before touching the IDV file.
7. **G2 checkpoint.** Surface the over-cap modification of `personalInfoIdvFieldChecks.ts` to Andy. On approval, edit line 395 (§3.2.3). Update comment.
8. **Route update.** Edit `route.ts` per §3.2.1: add `serviceIds` parsing, switch to batched queries, replace fold with `orMergeMappings`, rewrite service-level fallback for address_block visibility only.
9. **`useEntryFieldsLoader` update.** Edit per §3.2.5. Rename `fieldsByEntryService` → `fieldsByEntry`. Collapse the per-service loop. Drop the `_serviceId` tag.
10. **`addressHistoryStage4Wiring.ts` update.** Per §3.2.9. Architect did not read this file fully — implementer reads it first, then updates signatures. Halt at G11 before applying changes.
11. **G11 checkpoint.** Confirm `_serviceId` was indeed vestigial. Apply changes.
12. **AddressHistorySection wiring.** Edit `AddressHistorySection.tsx` per §3.2.6 (two-line rename).
13. **IdvSection update.** Edit per §3.2.4 (one fetch instead of N).
14. **G3 and G4 checkpoints.** Surface the over-cap (net-negative) modifications of `EducationSection.tsx` (§3.2.7) and `EmploymentSection.tsx` (§3.2.8). On approval, apply changes.
15. **Run typecheck.** `pnpm typecheck`. Resolve any narrowing issues.
16. **Run unit tests.** `pnpm vitest run`. Identify failures.
17. **Apply test rewrites.** Edit the two route tests per §6.3. Add new tests per §6.1–§6.4.
18. **Re-run unit tests.** Confirm green.
19. **Run lint.** `pnpm lint`. Zero new errors.
20. **Run build.** `pnpm build`. Confirm success.
21. **Translation keys.** None added.
22. **Checkpoint.** Implementer produces the bash-output evidence per the spec's "Test coverage targets" requirement.

---

## 8. Translation keys

**None.** No new user-facing strings. Per spec BR 6: "No new error category, no new translation key." Confirmed.

---

## 9. Risks and considerations

### 9.1 Architect did not read `addressHistoryStage4Wiring.ts` in full

The file `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/addressHistoryStage4Wiring.ts` is on the modification list (§3.2.9). The architect grepped its function signatures but did not read it end-to-end. The plan's projection that the `_serviceId` tag dependency is vestigial is based on inspection of where it is read (`AddressHistorySection.tsx:394` hardcodes `SERVICE_TYPE_ORDER_RECORD = 1`). Implementation Gate G11 forces the implementer to confirm by reading the file before changing it. If the architect's projection is wrong, the implementer surfaces a deviation; the worst case is keeping the per-service keying in `useEntryFieldsLoader` and threading the `_serviceId` tag through, which would slightly increase the line delta but not break the design.

### 9.2 Per-service `_serviceId` tag may have downstream consumers

Same risk as 9.1, restated. The tag is injected at `useEntryFieldsLoader.ts:151–154`. Consumers may exist outside `addressHistoryStage4Wiring.ts`. Implementer must `grep -rn "_serviceId"` across the codebase before applying §3.2.5's change.

### 9.3 Over-cap files

Three files are over the 600-line cap: `personalInfoIdvFieldChecks.ts` (632), `EducationSection.tsx` (610), `EmploymentSection.tsx` (639). All three modifications are minimal (one-line operator change in the validator file; net-negative changes in the sections). Implementation Gates G2 / G3 / G4 force explicit Andy approval before each. The agent pipeline will halt; if Andy approves verbally, the implementer notes the approval in the checkpoint.

### 9.4 Existing route tests that don't appear to need flipping

The architect's read of `fields/__tests__/route.test.ts` found only two tests that need rewriting (the service-level fallback positive test at lines 298–325, and the non-record service-level keep-positive test at lines 600–644). The "should return fields successfully with location mapping" test at lines 262–297 stays valid because its fixture has a real `dsx_mappings` row with `isRequired: true`. The implementer must confirm there are no other implicit dependencies on the pre-fix semantics (e.g., a test fixture that uses `mockServiceRequirements` to seed a `req-3` whose required-state depends on the service-level fallback). The architect's spot-check is the line-by-line grep at §0; the implementer should re-grep after applying the route change and react to any test failure rather than blindly suppressing it.

### 9.5 Section file size creep

`AddressHistorySection.tsx` is at 596 lines, two lines below cap. The plan changes ONLY two lines (a rename); the file does not grow. But the implementer's grep / edit tooling may produce subtle whitespace deltas. If the file lands at 597 or 598 lines, that is fine. If it lands at 601, surface and clean up.

### 9.6 Cross-section subject-targeted field flow

The current architecture pushes subject-targeted fields (collectionTab='subject') from Education / Employment / Address History into a cross-section registry for Personal Info to consume. The TD-084 change does NOT modify this flow — the route still returns subject fields in the response (per BR 5, visibility unchanged), and the section components still filter them out for local render while passing them to the wiring hook. The plan calls for no change to `useRepeatableSectionStage4Wiring` or the wiring hook's behavior. Implementer should verify that the cross-section registry's `subjectFieldsByCountry` flow continues to work after the per-service loop collapse — specifically, that the route's de-duplicated response (which merges across services) does not lose subject fields that were unique to one service in the package.

**Architect's resolution:** The route's de-dup is by `requirementId`, and `requirementId` is unique per DSX requirement regardless of which service maps it. If two services in the package both map the same subject field, they share the same `requirementId`; if only one maps it, it's still in the response. No subject field is lost.

### 9.7 The architect's line-count math is +20% buffered

The Stage 3b architect's line-count math was off by ~17 lines (engine projected 556, landed 573). TD-084's line projections include a +20% buffer at each estimate. The conservative landing estimates are:

| File | Pre-TD-084 | Conservative post-TD-084 | Cap status |
|---|---|---|---|
| `route.ts` | 365 | 391 | Well under 500 (warn zone) and 600 (hard cap) |
| `aggregateFieldsRequired.ts` (new) | — | 96 | Well under cap |
| `repeatableEntryFieldChecks.ts` | 464 | 466 | Well under cap |
| `personalInfoIdvFieldChecks.ts` | 632 | 634 | OVER CAP — G2 |
| `IdvSection.tsx` | 555 | 549 | Under cap |
| `useEntryFieldsLoader.ts` | 186 | 176 | Under cap |
| `AddressHistorySection.tsx` | 596 | 596 | Under cap |
| `EducationSection.tsx` | 610 | 596 | Drops below cap (was over) — G3 |
| `EmploymentSection.tsx` | 639 | 623 | Stays over cap — G4 |
| `addressHistoryStage4Wiring.ts` | unread | unread | UNKNOWN — G11 |

### 9.8 Scope creep candidates

- Subject-field cross-section registry behavior. Already out of scope per spec (TD-052). Implementer should not "improve" the registry while in the area.
- Aggregated requirements area on Address History. Already out of scope per spec.
- The `_serviceId` tag in `useEntryFieldsLoader` is being dropped as a side effect of §3.2.5. This is a real behavior change (the tag is no longer in the response). The architect's claim is that no consumer reads it productively. If a consumer is discovered (per §9.2), the implementer must either preserve the tag or refactor the consumer — but NOT in the same PR as TD-084 unless the consumer is `addressHistoryStage4Wiring.ts` (already on the list).
- The `Service.functionalityType` lookup at the route was a per-call query under the legacy single-`serviceId` shape. The plan batches it. This is a small perf win, not scope creep.

---

## 10. Discovered, not addressed in this stage

During this architect's reading, the following pre-existing issues were observed that are unrelated to TD-084. Each is a candidate for a new TD entry (TD-087+). The architect does NOT plan to fix any of these.

### 10.1 `personalInfoIdvFieldChecks.ts` is over the file-size cap (632 lines)

The file has been at 632 lines since Stage 2 (TD-062 introduction). It is over the hard cap. CODING_STANDARDS §9.4 says agents must stop before adding code to over-cap files. TD-084 needs to make a one-line operator change inside this file, triggering Implementation Gate G2. **Candidate TD entry: split `personalInfoIdvFieldChecks.ts` along the Personal Info / IDV boundary (the file mixes both concerns), or refactor `collectIdvFieldRequirements`'s closure logic into a sibling module.** Not done here — out of scope.

### 10.2 `EducationSection.tsx` and `EmploymentSection.tsx` are over the file-size cap (610 / 639)

Both files have been over 600 since Phase 6 Stage 4. The TD-084 change is net-negative for both (which is fine), but the underlying over-cap state was a pre-existing issue. **Candidate TD entry: refactor Education / Employment sections to extract the per-country field-loader hook (mirroring `useEntryFieldsLoader` for Address History).** Not done here.

### 10.3 `AddressHistorySection.tsx` is one or two lines from the cap

596 lines as of 2026-05-11. Any future change to this section will trigger a soft-warn at 500 (already past) and the hard cap at 600 (imminent). **Candidate TD entry: prophylactic split of `AddressHistorySection` along the address-block / aggregated-requirements axis.** Not done here.

### 10.4 The `fieldData._serviceId` tag is opaque

`useEntryFieldsLoader.ts:148–155` injects a `_serviceId` tag into the response's `fieldData` blob. This is a layering smell: client-side code shouldn't fabricate fields that look like they came from the server. **Candidate TD entry: if the per-service service-type-order is ever needed again, surface it as a top-level field on the EntryDsxField shape, not nested inside `fieldData`.** Resolved tangentially by §3.2.5 dropping the tag entirely.

### 10.5 Existing geographic-OR test fixture is duplicated across the route and the validator

The route test at `fields/__tests__/route.test.ts:669–770` and the validator test at `validationEngine.test.ts:903–1001` both encode geographic-OR semantics for an Education or Address History entry. They use different fixture shapes but the same underlying rule. **Candidate TD entry: extract a shared geographic-OR fixture builder.** Not done here.

---

## 11. Plan Completeness Check

- [x] Every file the implementer will need to touch is listed in §3.
- [x] No file outside this plan will need to be modified.
- [x] All Zod schemas, types, and translation keys are listed (none required).
- [x] The plan is consistent with the spec's Data Requirements (field names, response shape, no schema changes).
- [x] DoD 13 and DoD 14 files are explicitly excluded.
- [x] All seven design questions in the spec are resolved with file:line precision.
- [x] Line-count projections include a +20% buffer.
- [x] Implementation Gates (§5) cover every checkpoint where the implementer must stop and escalate.
- [x] Risks (§9) call out every observed scope-creep and unread-file risk.
- [x] Discovered-but-not-addressed (§10) entries are logged.
- [x] Test plan (§6) maps every BR to at least one acceptance criterion to at least one test.

**This plan is ready for the test-writer to proceed.**
