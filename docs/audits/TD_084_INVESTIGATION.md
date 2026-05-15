# TD-084 Investigation — Required-State Visual Indicator vs. Per-Country `dsx_mappings`

**Branch:** `feature/td-084-required-indicator-per-country`
**Date:** 2026-05-11
**Scope:** Read-only investigation. No fix proposed; no source/test/doc modifications beyond this audit file.

---

## 1. Data flow summary

**IDV.** `IdvSection` (`src/components/candidate/form-engine/IdvSection.tsx:202-204`) loops the candidate's package services and calls `GET /api/candidate/application/[token]/fields?serviceId=…&countryId=…` once per service. The route handler (`src/app/api/candidate/application/[token]/fields/route.ts`) returns an array of field descriptors; each carries an `isRequired: boolean` computed on the server. `IdvSection` dedupes by `requirementId`, filters out personal-info-tab fields, and passes each surviving field straight to `DynamicFieldRenderer` (`IdvSection.tsx:521-526`), passing `field.isRequired` as the `isRequired` prop. `DynamicFieldRenderer` reads that prop to decide whether to render the red asterisk (`DynamicFieldRenderer.tsx:286-288`).

**Address History / Education / Employment.** Same `/fields` endpoint, same per-service loop, same `isRequired` field on the response. Differences:

- Address History uses the shared `useEntryFieldsLoader` hook (`src/components/candidate/form-engine/useEntryFieldsLoader.ts:124-178`) and supports a `subregionId` query param to walk the geographic hierarchy server-side. The address_block field is passed directly to `AddressBlockInput` rather than through `DynamicFieldRenderer` (`AddressHistorySection.tsx:480-496`); per-entry document and scalar fields go through `DynamicFieldRenderer`.
- Education (`EducationSection.tsx:234-263`) and Employment (`EmploymentSection.tsx`, ~lines 240–…) roll their own loaders but call the same endpoint and pass `field.isRequired` to `DynamicFieldRenderer` (`EducationSection.tsx:471`, `EmploymentSection.tsx:507`).

In all four sections, the visual asterisk ultimately reflects the `isRequired` value the `/fields` endpoint returns for the selected country/service tuple.

---

## 2. The required-state decoration source

Asterisk decoration for plain (non-address-block) fields is in **`DynamicFieldRenderer.tsx:283-289`**:

```tsx
{dataType !== 'checkbox' && (
  <Label htmlFor={`field-${fieldKey}`} className="block">
    {name}
    {isRequired && (
      <span className="text-red-500 ml-1 required-indicator">*</span>
    )}
  </Label>
)}
```

The `isRequired` prop is supplied by each section component from the API response — `IdvSection.tsx:526`, `EducationSection.tsx:471`, `EmploymentSection.tsx:507`, `AddressHistorySection.tsx` (per-entry documents).

For `address_block` pieces, the asterisk is rendered by **`AddressBlockInput.tsx:327-330`**:

```tsx
const renderAsterisk = (pieceRequired: boolean) =>
  pieceRequired && isRequired ? (
    <span className="text-red-500 ml-1 required-indicator">*</span>
  ) : null;
```

`pieceRequired` is `addressConfig[piece].required` from `DSXRequirement.fieldData.addressConfig` (static per requirement). `isRequired` is the parent field's `field.isRequired` from the API. Address History feeds it at `AddressHistorySection.tsx:489`.

The asterisk decoration always traces back to **the `isRequired` boolean returned by the `/fields` endpoint** for the section's per-entry/per-IDV country and per-service slice.

How `/fields` computes that boolean is in `route.ts`:

- Lines **286-308**: for each (serviceId, locationId) it loads `dsx_mappings` rows and OR-merges `isRequired` across geographic levels (most-restrictive-wins).
- Lines **323-334**: it then adds any `service_requirements` rows not already covered by a DSX mapping and forces `isRequired: true` on them (line 331: `isRequired: true, // Service-level requirements are assumed required`). For record services it restricts this fallback to `address_block` only; for non-record services it does not.

---

## 3. Comparison to validation's data source

The validation engine does NOT call the `/fields` endpoint. It queries `dsx_mappings` directly through a loader and **AND-aggregates** `isRequired` across the candidate's `(packageServiceId, entryCountryId)` pairs.

**Repeatable sections** (`src/lib/candidate/validation/repeatableEntryFieldChecks.ts`):

- `collectSectionPairs` (lines 262-287) builds the Cartesian product of section package services × distinct non-null entry countries.
- `walkSection` (lines 184-186) issues one batched `findMappings` call.
- `buildPerCountryRequiredMap` (lines 295-322) groups rows by `locationId → requirementId` and at line **317** computes `flags.length > 0 && flags.every(Boolean)` — **AND-aggregation**. An empty mapping group is `false`. A requirement that has no row at this country at this service is absent from `perReq` and treated as not required (lines 204, 228).

**IDV** (`src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`):

- `collectIdvFieldRequirements` (lines 298-399) calls `findMappings` for `(idvServiceIds × selectedCountryId)` pairs (lines 350-358) and at line **395** does the same AND-aggregation: `flags.length > 0 && flags.every(Boolean)`. Requirements with no mapping rows are not considered required.

**Personal Info (prior precedent, TD-060 resolution):** `personalInfoIdvFieldChecks.ts:175-199` — same AND-aggregation pattern.

---

## 4. The discrepancy

The two paths read the same underlying `dsx_mappings` table but combine the data with opposite logic and different scope:

| Aspect | Rendering (`/fields` route) | Validation (`repeatableEntryFieldChecks` / `personalInfoIdvFieldChecks`) |
|---|---|---|
| **Mapping merge** | OR across geographic levels (`route.ts:304`) | AND across applicable mapping rows (`repeatableEntryFieldChecks.ts:317`, `personalInfoIdvFieldChecks.ts:395`) |
| **Service-level fallback** | Service requirements with no mapping default to `isRequired: true` (`route.ts:331`) | Service-level fallback only matters if it produces a mapping row; bare `serviceRequirements` are never treated as required by the validator |
| **Scope** | Per-call: single serviceId, single countryId (no awareness of "all package services") | Whole-package: the validator unions every mapping row across every package service for the entry's country |
| **Candidate context** | None — the route doesn't read the candidate's package; it returns whatever a single (service, country) lookup yields, plus any service-level baseline | Package-aware: `packageServicesForSection` is the candidate's actual package |

For a US address_block field on Address History, the validator queries `dsx_mappings` for (every record service in the package, US) and AND-merges `isRequired`. If **any** applicable row has `isRequired = false`, the validator says "not required". The route, called once per service for the same field, returns `isRequired = true` if **any one** row at any one geographic level for **that single service** says true, OR if the service has a service-level address_block requirement (per `route.ts:323-334`). The route never sees the other package services and never AND-merges, so it can return required when the validator says not required.

The IDV In-Country Address with country = US sits in the same trap: the validator AND-merges across the IDV services in the package; the route OR-merges across geographic levels for one service and adds the service-level baseline that the validator ignores.

---

## 5. Scoped fix recommendations

- **Switch the `/fields` route's merge from OR to AND for `isRequired` across mapping rows.** Localized to `route.ts:304`. Tradeoff: simplest mechanical change but does not address the cross-service whole-package context the validator considers — single-service consumers (today's API contract) still won't know about other package services' opinions.
- **Have the `/fields` route accept and use the candidate's full package context and run the same AND-aggregation the validators run.** Tradeoff: aligns rendering exactly with validation but expands the route's responsibility and probably means a new helper plus a contract change so callers pass all relevant package services at once instead of one per call.
- **Replace per-service `/fields` calls in the four section components with a single batched endpoint that returns the union of required-state-aware fields for the whole section.** Tradeoff: cleanest long-term shape; biggest surface area; touches every section component.
- **Compute per-country `isRequired` client-side in each section using a shared helper that reads from the validator's data path (e.g., a new `/api/candidate/application/[token]/required-state?countryId=…` endpoint).** Tradeoff: lets `/fields` stay as-is for visibility; required-state becomes a separate concern with one canonical source. Adds a second round-trip per country switch.
- **Reuse the existing `/validate` response.** The validator emits `fieldErrors` per requirement; rendering could decorate the asterisk for any requirement currently in `fieldErrors` for that section keyed by fieldName, or more directly, expose a `required: boolean` map from `/validate`. Tradeoff: piggybacks on existing wiring (already debounced via `onSaveSuccess`), but couples visual state to validation lifecycle and would show no asterisks until first validation cycle completes.
- **Remove the `service_requirements` fallback (`route.ts:323-334`) for IDV-functionality services entirely, mirroring the record-service carve-out.** Tradeoff: narrow and minimal but treats the symptom for IDV only; does nothing about the OR-vs-AND mismatch on rows that do exist.

---

## 6. Affected files

For any approach that changes how `isRequired` is computed on the server:

- `src/app/api/candidate/application/[token]/fields/route.ts` — primary site of the OR-merge and service-level fallback.
- `src/app/api/candidate/application/[token]/fields/__tests__/` — existing tests almost certainly assert the current OR-merge behavior; needs review.

If shifting required-state computation client-side or to a new endpoint:

- `src/components/candidate/form-engine/IdvSection.tsx`
- `src/components/candidate/form-engine/AddressHistorySection.tsx`
- `src/components/candidate/form-engine/EducationSection.tsx`
- `src/components/candidate/form-engine/EmploymentSection.tsx`
- `src/components/candidate/form-engine/useEntryFieldsLoader.ts` — Address History's loader hook
- `src/components/candidate/form-engine/DynamicFieldRenderer.tsx` — receives the prop; likely unchanged
- `src/components/candidate/form-engine/AddressBlockInput.tsx` — same prop contract; unchanged for the renderer change but may need state-piece config awareness if validator-vs-config divergence ever matters

If the fix path reuses the validator helpers:

- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` — `collectIdvFieldRequirements`, `aggregateIsRequired` would need to be reachable from a render-time data path; today they're only called from the validator.
- `src/lib/candidate/validation/repeatableEntryFieldChecks.ts` — `buildPerCountryRequiredMap`, similar.

---

## 7. Risks and unknowns

- **AND vs OR is a product decision, not just a bug.** `route.ts:300-301` ("most-specific level wins for displayOrder; isRequired OR-merges across levels") explicitly chose OR as the "most-restrictive wins" rule. The validators do the opposite. Before changing either side the implementer needs Andy's product call on which semantics are right, particularly for the subregion case where Stage 3's geographic hierarchy walk is meaningful (an "always required at country level, optional at one specific subregion" mapping configuration has different correct behavior under OR vs AND).
- **`personal-info-fields` route uses AND** (per TD-060 resolution in `docs/TECH_DEBT.md:2113-2121` and `personalInfoIdvFieldChecks.ts:155-199`). That precedent supports the AND direction, but TD-060 was scoped to Personal Info; the same call hasn't been made for IDV/repeatable sections.
- **`Service.functionalityType === 'idv'` and `'record'` carve-outs in the `/fields` route are inconsistent.** Record services skip the service-level fallback unless dataType is `address_block` (`route.ts:325-328`). IDV services do not — every service-level requirement defaults to required. This is plausibly part of the bug but might also be intentional. Confirm with Andy before flipping IDV to record-style.
- **`/fields` is called per-service, per-country, per-entry.** Any cross-service AND-aggregation requires the caller to pass all relevant service IDs together, or the route to derive them from the invitation. The current contract doesn't support that, so a real fix likely requires a contract change.
- **Scope creep candidate.** Once the `/fields` endpoint's required-state computation is touched, it's tempting to also align field visibility with `dsx_mappings` + `dsx_availability`. The user explicitly carved that out as a future enhancement and tied it to TD-052; the implementer should resist.
- **Tests around `/fields` and `useEntryFieldsLoader` likely encode the current OR semantics.** A semantics flip will regress them, which is correct per "regression test first" but means the implementer must expect to rewrite those assertions deliberately rather than chase test green.
- **Address date pieces.** `AddressBlockInput.tsx:493` and `:537` hardcode the asterisk for `fromDate` / `toDate` (`<span className="text-red-500 ml-1 required-indicator">*</span>` with no condition). These are outside `dsx_mappings` entirely — TD-084 description doesn't single them out, but anyone reading the address block code may be tempted to "fix" these. Confirm whether they should remain unconditionally required.

---

## Key file:line reference index

- Asterisk for plain fields: `src/components/candidate/form-engine/DynamicFieldRenderer.tsx:286-288`
- Asterisk for address pieces: `src/components/candidate/form-engine/AddressBlockInput.tsx:327-330`
- `/fields` OR-merge: `src/app/api/candidate/application/[token]/fields/route.ts:286-308` (esp. `:304`)
- `/fields` service-level fallback that forces `isRequired: true`: `src/app/api/candidate/application/[token]/fields/route.ts:323-334`
- Validator AND-merge (repeatables): `src/lib/candidate/validation/repeatableEntryFieldChecks.ts:295-322` (esp. `:317`)
- Validator AND-merge (IDV): `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts:298-399` (esp. `:395`)
- Validator AND-merge (Personal Info, prior precedent): `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts:175-199`
- IDV fields fetch site: `src/components/candidate/form-engine/IdvSection.tsx:202-211`
- Address History fields fetch (via hook): `src/components/candidate/form-engine/useEntryFieldsLoader.ts:124-178`
- Education fields fetch: `src/components/candidate/form-engine/EducationSection.tsx:234-263`
- Employment fields fetch: `src/components/candidate/form-engine/EmploymentSection.tsx:241`
