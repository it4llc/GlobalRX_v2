# Technical Plan: Phase 7 Stage 3b — Per-Entry Required-Field Validation + IDV Country-Switch Cleanup

**Based on specification:** `docs/specs/phase7-stage3b-per-entry-validation-and-idv-country-clear.md` (2026-05-09, Confirmed)
**Parent phase plan:** `docs/specs/phase7-stage3-validation-hardening-plan.md`
**Date:** 2026-05-09
**Architect:** Technical Architect agent
**Branch (target):** `feature/phase7-stage3b-per-entry-validation-and-idv-country-clear`

---

## 0. Verification of facts pinned by the spec

The architect read the entire spec, the Stage 3a technical plan (`docs/specs/phase7-stage3a-validation-engine-split-technical-plan.md`), and every file the spec names. Verified:

| Pinned fact | Source | Verified |
|---|---|---|
| `validationEngine.ts` is currently 580 lines | `wc -l` | Verified — 580. The 600-line hard stop in `docs/CODING_STANDARDS.md` Section 9.4 leaves only 20 lines of headroom. |
| `IdvSection.tsx` country-change handler at lines 263–286 | spec §Impact on Other Modules | Verified — `handleCountryChange = useCallback((countryId: string) => { ... }, [selectedCountry, fields, formData])` lives at exactly lines 263–286. |
| `IdvSection.tsx` save effect at lines 302–371 | spec §Impact on Other Modules | Verified — the `useEffect(...)` driven by `debouncedPendingSaves` lives at exactly lines 302–371. |
| `loadValidationInputs.ts` discriminated-union loader, 'ok' branch at end | Stage 3a §1.2 | Verified — `ValidationInputs` is `\| { kind: 'no_package' } \| { kind: 'ok'; ... }`; the 'ok' branch's return statement lives at lines 218–231 of `loadValidationInputs.ts`. New loaded data attaches by extending that object literal and the `kind: 'ok'` arm of the union (lines 110–125). |
| `savedEntryShape.ts` is the canonical home for `SavedFieldRecord`, `SavedRepeatableEntry`, `SavedSectionData`, `SectionVisitRecord`, `flattenEntry`, `inferAddressBlockRequirementId` | Stage 3a §4.2 | Verified — file is 72 lines and exports exactly those names. |
| `personalInfoIdvFieldChecks.ts` exposes `aggregateIsRequired`, `checkRequiredFields`, `RequiredFieldDescriptor`, `DsxMappingRow`, `FindDsxMappings` | spec §Data Requirements | Verified — `aggregateIsRequired` is module-internal (line 175), `checkRequiredFields` is exported (line 431), `RequiredFieldDescriptor` exported (line 142), `DsxMappingRow` and `FindDsxMappings` exported (lines 163, 170). |
| `DSXRequirement.fieldData` is `Json?` and includes `addressConfig` for `dataType === 'address_block'` requirements | `prisma/schema.prisma:163–179`, `src/types/candidate-address.ts:37–51`, `src/components/candidate/form-engine/AddressBlockInput.tsx:30–37, 143` | Verified — `addressConfig` lives inside `fieldData` JSON; the per-piece shape is `{ enabled: boolean; label: string; required: boolean }`; default fallback (when `addressConfig` is absent) is the `DEFAULT_ADDRESS_CONFIG` constant in `AddressBlockInput.tsx:30–37`. |
| `loadValidationInputs.ts` already loads `service.serviceRequirements: { include: { requirement: true } }` and `service.availability: true` | `loadValidationInputs.ts:65–87` | Verified — the include tree carries the full `DSXRequirement.fieldData` JSON for every requirement in the package, so per-piece `addressConfig` is reachable without a new database call. |
| TD-077 says new modules must structurally re-declare shared shapes rather than import a cross-layer types module | `docs/TECH_DEBT.md` TD-077 | Verified — the loader and `personalInfoIdvFieldChecks.ts` re-declare the same shapes today; new helpers continue that pattern. |
| `dsxMapping` is the Prisma delegate name; queries use `prisma.dSXMapping.findMany` | `loadValidationInputs.ts:250` | Verified — the existing `buildFindMappings` adapter calls `prisma.dSXMapping.findMany`. |

---

## 1. Resolution of the two design questions the spec deferred

### 1.1 Where per-country required-field metadata lives — the resolved `addressConfig` shape

**Decision:** Per-piece required-field metadata for address_block fields lives in the existing `DSXRequirement.fieldData.addressConfig` JSON column on the same DSXRequirement row. **No new column. No schema change. No migration.** The shape already exists today and is consumed by the candidate UI; the validator simply reads the same JSON the UI uses.

**Per-requirement required state for non-address_block requirements** (Education `degreeAwarded`, Employment `jobTitle`, etc.) lives in the existing `dsx_mappings` table — the same source `personalInfoIdvFieldChecks.aggregateIsRequired` already reads. Per-country resolution happens by querying `dsx_mappings` keyed on `(serviceId, locationId)` where `locationId` is the **entry's** `countryId`.

**Concrete shape of `addressConfig` (canonical, taken verbatim from the live system):**

```ts
// src/types/candidate-address.ts:37–51 (already exists, unchanged)
type AddressPieceKey =
  | 'street1'
  | 'street2'
  | 'city'
  | 'state'
  | 'county'
  | 'postalCode';

interface AddressConfigPiece {
  enabled: boolean;   // controls whether the piece renders in the UI
  label: string;      // optional override label
  required: boolean;  // <-- the per-piece required flag the validator reads
}

type AddressConfig = Record<AddressPieceKey, AddressConfigPiece>;
```

**Concrete payload example (as stored in `DSXRequirement.fieldData` for a US address_block requirement):**

```json
{
  "dataType": "address_block",
  "addressConfig": {
    "street1":    { "enabled": true,  "label": "Street Address",   "required": true  },
    "street2":    { "enabled": true,  "label": "Apt/Suite",        "required": false },
    "city":       { "enabled": true,  "label": "City",             "required": true  },
    "state":      { "enabled": true,  "label": "State/Province",   "required": true  },
    "county":     { "enabled": false, "label": "County",           "required": false },
    "postalCode": { "enabled": true,  "label": "ZIP/Postal Code",  "required": true  }
  }
}
```

**Concrete payload example (as stored in `DSXRequirement.fieldData` for an address_block requirement that has NO addressConfig — older records):**

```json
{
  "dataType": "address_block"
}
```

In the second case, the validator falls back to **the same default the UI already uses** — `DEFAULT_ADDRESS_CONFIG` from `AddressBlockInput.tsx:30–37`:

```ts
// equivalent default applied when fieldData.addressConfig is missing or malformed
{
  street1:    { enabled: true,  label: 'Street Address',  required: true  },
  street2:    { enabled: true,  label: 'Apt/Suite',       required: false },
  city:       { enabled: true,  label: 'City',            required: true  },
  state:      { enabled: true,  label: 'State/Province',  required: true  },
  county:     { enabled: false, label: 'County',          required: false },
  postalCode: { enabled: true,  label: 'ZIP/Postal Code', required: true  },
}
```

**The validator does NOT introduce a separate copy of this default.** It is hoisted into a new shared constant in the new helper module (§3.1) so the validator and the UI stay in sync if the default is ever modified. The constant lives in the new helper module (not in `AddressBlockInput.tsx`) because the UI's existing constant is component-scoped and importing component files into validator code is forbidden by `docs/CODING_STANDARDS.md` (server vs. client boundary). The new validator constant is a structural copy; if a future stage decides to centralize the default, that's a follow-up TD entry, not Stage 3b's concern.

**Per-piece "required" composition rule (Spec Rule 3, Edge Case 8):**
A piece of an address_block field is treated as required for a given entry when **all three** of the following are true:

1. `addressConfig[piece].enabled === true` — the piece renders for the candidate to see; if it isn't shown the candidate cannot fill it.
2. `addressConfig[piece].required === true` — the per-piece required flag.
3. The address_block requirement itself is required at the entry's `(serviceId, countryId)` per `dsx_mappings` (the per-requirement isRequired returned by the existing `aggregateIsRequired` AND-aggregation across applicable mapping rows).

When (3) is false, the address_block requirement itself is not required, and the per-piece walk produces zero field errors for that entry's address_block. When (3) is true but the JSON value of the address_block is null/undefined/malformed, the validator emits a single field error keyed on the address_block requirement's display name (per Spec Edge Case 5/6) and skips the per-piece walk for that entry. When (3) is true and the JSON value is a well-formed object, the validator descends and emits one field error per `(enabled === true && required === true)` piece whose value is empty.

**Why no schema change is needed:** every datum the validator needs is already in `DSXRequirement.fieldData` (per-piece `enabled`/`required`) or `dsx_mappings` (per-requirement isRequired per `(serviceId, countryId)`). Address-history's address_block requirement, education's `degreeAwarded`, and employment's `jobTitle` are all DSX requirements with mappings; the per-entry walk just reads them differently.

### 1.2 How per-entry country resolution works — the resolved mechanism

**Decision:** The per-section validators for Address History, Education, and Employment perform a single batched `dsx_mappings` query per **section** that covers every distinct `(serviceId, locationId)` pair across that section's entries. Results are cached for the duration of one `runValidation` call in a `Map<string, boolean>` keyed by `<requirementId>::<serviceId>::<locationId>` so entries that share a country re-use the same mapping rows without a re-query. No per-entry queries.

**Exact `dsx_mappings` query shape (per section):**

```ts
// Issued once per section (Address History / Education / Employment) when
// that section has at least one entry with a non-null countryId. The query
// covers every entry's (serviceId, locationId) pair in that section.
prisma.dSXMapping.findMany({
  where: {
    OR: pairs.map((p) => ({
      serviceId: p.serviceId,
      locationId: p.locationId,
    })),
  },
  select: {
    requirementId: true,
    serviceId: true,
    locationId: true,
    isRequired: true,
  },
  orderBy: [
    { serviceId: 'asc' },
    { locationId: 'asc' },
    { requirementId: 'asc' },
  ],
});
```

**Notes on the query shape:**

- **No `requirementId` IN-filter.** The validator passes an empty `requirementIds` array to the existing `FindDsxMappings` adapter — which already understands that an empty whitelist means "fetch every requirement at these (service, location) pairs" (see `loadValidationInputs.ts:248–254` and `personalInfoIdvFieldChecks.ts:344–358` for the same pattern used by the IDV collector). This is intentional: the per-entry walk needs to know **which** requirements apply at each `(serviceId, countryId)` before it can decide what's required, so it can't pre-narrow.
- **Identical to the existing adapter contract.** No new Prisma helper, no new adapter shape — the validator reuses the `findMappings` closure already supplied by `loadValidationInputs` (`inputs.findMappings`).
- **`pairs`** is the cartesian product of the section's package-service service IDs (one or more `record` services for Address History, one or more `verification-edu` services for Education, one or more `verification-emp` services for Employment) and **every distinct non-null entry country** in that section. So a candidate with 3 address-history entries spanning 2 unique countries and a package that includes 1 record service produces a 1×2 = 2-pair query. The same candidate with 2 record services produces a 2×2 = 4-pair query.
- **Uses the `dSXMapping.findMany` orderBy already locked in by API S7.3** (Stage 3a follow-up commit `85b9f5d`). No new orderBy concerns.

**Caching strategy across entries that share a country:**

- The new helper builds a `Map<string, Map<string, boolean>>` keyed `<countryId> → <requirementId> → isRequired` after the single batched query. Iteration over entries reads from this map without re-querying. Entries that share a country share the inner map.
- Because the spec mandates a single batched query per section (Edge Case 8), the cache's lifetime is the per-section validator call. There is no cross-`runValidation` cache.

**How per-piece rules inside `address_block` compose with per-requirement rules from `dsx_mappings`:**

Worked example for one Address History entry with `countryId = US-uuid`, package has one record service `svc-record`, the address_block requirement is `req-addr`, and the candidate's saved entry has filled `fromDate`, `toDate`, `isCurrent` but not `street1`, `city`, `state`, or `postalCode`:

1. Section's batched query returns rows for `(svc-record, US-uuid)`. Suppose `(req-addr, svc-record, US-uuid).isRequired === true`.
2. The per-entry walk computes `requirement-level required` for `req-addr` at this entry by AND-aggregating across all `(serviceId, US-uuid)` mappings for `req-addr` (Rule 3.1.3 above) — same logic the existing `aggregateIsRequired` helper does for Personal Info. Result: `req-addr` is required for this entry. → proceed to per-piece walk.
3. The walk reads the `addressConfig` from the requirement's `fieldData` (the loader already supplies this — see §3.1 below for the new loader-side map). Suppose `addressConfig` is the canonical US shape from §1.1.
4. For each piece in `['street1', 'street2', 'city', 'state', 'county', 'postalCode']`:
   - Skip if `enabled !== true` (county in this example).
   - Skip if `required !== true` (street2 in this example).
   - Otherwise read `entry.fields[req-addr].value[piece]`. If empty (per the existing `isEmptyValue` definition in `personalInfoIdvFieldChecks.ts:424–429`), emit one field error with `fieldName = "<requirement.name>.<piece>"` (the format-shape `<requirement.name>.<piece>` is decided in §1.3 below).
5. The walk produces 4 field errors for this entry: `street1`, `city`, `state`, `postalCode`.

**For non-address_block requirements (Education `degreeAwarded`, Employment `jobTitle`, etc.):**

- Per-requirement `isRequired` is the AND-aggregation of the `(serviceId, locationId)` mapping rows for that `requirementId` and that entry's country, i.e. the same rule as Personal Info / IDV (`personalInfoIdvFieldChecks.aggregateIsRequired`). Empty mapping group → not required (Spec Edge Case 4).
- Saved value comes from `entry.fields[].value` keyed by `requirementId`. Empty per the existing `isEmptyValue` rule.
- One field error per required-but-empty requirement on that entry.

**Per-entry country resolution algorithm (pseudocode for a single section's validator):**

```
function validateRepeatableSectionPerEntry({ entries, packageServicesForSection, requirementById, findMappings }):
    // 1. Collect distinct (serviceId, countryId) pairs across this section's entries.
    pairs = []
    for each ps in packageServicesForSection:
        for each entry in entries:
            if entry.countryId != null:
                pairs.push({ serviceId: ps.service.id, locationId: entry.countryId })
    pairs = distinct(pairs)

    // 2. Single batched query (or empty short-circuit).
    if pairs.length === 0:
        rows = []
    else:
        rows = await findMappings({ requirementIds: [], pairs })

    // 3. Build the cache: countryId -> requirementId -> AND-aggregated isRequired.
    isRequiredByCountryReq = Map<countryId, Map<requirementId, boolean>>
    flagsByCountryReq      = Map<countryId, Map<requirementId, boolean[]>>
    for row in rows:
        flagsByCountryReq[row.locationId][row.requirementId].push(row.isRequired)
    for each (countryId, perReq) in flagsByCountryReq:
        for each (reqId, flags) in perReq:
            isRequiredByCountryReq[countryId][reqId] = flags.length > 0 && flags.every(true)

    // 4. Per-entry walk.
    fieldErrors = []
    for each entry in entries:
        if entry.countryId == null:
            fieldErrors.push({ fieldName: <inferAddressBlockRequirementId(entries) ?? sectionRequirementName>,
                               messageKey: 'candidate.validation.entryCountryRequired',
                               placeholders: { entryOrder } })
            continue
        perReq = isRequiredByCountryReq[entry.countryId] ?? new Map()

        for each requirement in requirementsApplicableTo(entry, perReq):
            if not perReq.get(requirement.id): continue
            saved = entry.fields.find(f => f.requirementId === requirement.id)?.value

            if requirement.fieldData?.dataType === 'address_block':
                addressConfig = requirement.fieldData.addressConfig ?? DEFAULT_ADDRESS_CONFIG
                if isMalformedAddressBlockValue(saved):
                    fieldErrors.push({ fieldName: requirement.name,
                                       messageKey: 'candidate.validation.fieldRequired',
                                       placeholders: { entryOrder } })
                else:
                    for each piece in ADDRESS_PIECE_KEYS:
                        cfg = addressConfig[piece]
                        if !cfg.enabled || !cfg.required: continue
                        if isEmptyValue(saved[piece]):
                            fieldErrors.push({ fieldName: `${requirement.name}.${piece}`,
                                               messageKey: 'candidate.validation.fieldRequired',
                                               placeholders: { entryOrder, piece } })
            else:
                if isEmptyValue(saved):
                    fieldErrors.push({ fieldName: requirement.name,
                                       messageKey: 'candidate.validation.fieldRequired',
                                       placeholders: { entryOrder } })

    return fieldErrors
```

**Definition of "requirement applicable to entry":** a requirement `R` is applicable to `entry` (with country `C`) when `perReq.get(R.id)` exists (i.e. there is at least one mapping row for `R` at country `C` for one of the section's services). Service-level address_block requirements (for record-type services) bypass mapping check and are treated as applicable for every record-service entry — see §1.3 below for the precise rule.

### 1.3 Edge case decisions (deferred by the spec to the architect)

| Spec edge case / rule | Decision | One-sentence rationale |
|---|---|---|
| **Edge Case 3 (TD-069)**: entry whose country no longer exists in DB | **(a)** treat as null country and emit the missing-country field error from Rule 4. | Picking (b) — silent passthrough — would let an entry that the candidate cannot meaningfully edit (no country list row) submit green, defeating the whole point of TD-069; (a) keeps the candidate-visible feedback consistent with a candidate who never picked a country. |
| **Edge Case 6 (TD-069)**: address_block whose JSON is malformed | **Log a `logger.warn` once** with `event: 'candidate_validation_address_block_malformed'`, `invitationId`, `entryId`, `requirementId`, and treat the value as `null` (single field error on the address_block requirement; no per-piece walk). | The malformed-JSON case should be observable without spamming the logs; a single warn per occurrence gives operators a hook for tooling without leaking saved values (per Spec DoD 21 — no PII in logs). |
| **Rule 11 (TD-069)**: new translation key vs. reuse `fieldRequired` | **Introduce `candidate.validation.entryCountryRequired`** (new key), distinct from `candidate.validation.fieldRequired`. Reuse `fieldRequired` for every other per-entry field error. | The missing-country case is structurally different (the candidate has not selected a jurisdiction at all, which is a different remediation than "fill this field") and benefits from a distinct UI affordance; the existing `idvCountryRequired` key precedent supports adding the parallel key for the repeatable sections. |
| **Rule 15 (TD-072)**: snapshot under `country_<previousCountryId>` on country switch | **Preserve the snapshot exactly as today.** The cleanup of active per-requirement slots happens **before** the snapshot is written, but the snapshot itself is constructed from the values that were just cleared (closure-captured). When the candidate returns to the original country, `loadFieldsForCountry` re-hydrates from the snapshot exactly as today (`IdvSection.tsx:240–246`). | Preserving the snapshot keeps the candidate's typed values recoverable when they switch back, which is the documented UX today; only the active per-requirement slots are dropped from `formData` so the next save's `pendingSaves` payload no longer contains the orphaned `requirementId` keys. |
| **Edge Case 12 (TD-072)**: rapid country re-switching | **Each `handleCountryChange` invocation is self-contained** — it (1) snapshots the current country's slot values, (2) clears those active slot keys from `formData`, (3) updates `selectedCountry`. React state updates are batched per render; rapid clicks each enqueue one cleanup→swap pass. The component does NOT debounce country switches. | The cleanup is synchronous within one `setFormData` callback, so the second switch operates on the post-first-switch state (no race between switches); debouncing would delay the cleanup and re-introduce the orphan window the spec is closing. |
| **Edge Case 13 (TD-072)**: country switch while save is in flight | **Cleanup runs immediately** (in the same render that triggers `handleCountryChange`); the next `useEffect`-driven save runs against the cleaned `formData` because save effects read from current state, not the snapshot taken when `pendingSaves` accumulated. The save endpoint is idempotent on the requirementIds it receives, so any in-flight save with stale requirementIds completes (writing values for the previous country) and is then immediately superseded by the next save (which carries no orphan keys). | Including cleanup in the same render that triggers the new save is the simplest contract that respects React's state model and matches the spec's "typically by performing the cleanup after the in-flight save completes, or by including the cleanup in the same render that triggers the new save" preference; the alternative (delaying cleanup until in-flight save completes) requires tracking save promise state and complicates the retry path for no UX benefit. |
| **Service-level address_block applicability** (uncovered by spec) | **Address_block requirements that are service-level** (i.e. `serviceRequirements` rows for the record-type service that produce an `address_block` `fieldData.dataType` regardless of `dsx_mappings`) follow the same rule as the candidate UI: they are required for every entry whose country resolves to a record service in the package — see `src/app/api/candidate/application/[token]/fields/route.ts:323–334` for the precedent. The mapping-table query still runs (other requirements may be country-specific); the address_block service-level requirement is treated as applicable when there is at least one `(record-service-id, entry.countryId)` mapping pair (i.e. the service is available at that country). | This matches the existing UI rule that "every record service needs to know where the candidate lived"; without this carve-out, a record service that has no `dsx_mappings` row for the address_block requirement would silently skip per-piece validation, defeating TD-069 for the most common case. |

### 1.4 Decision: where the per-entry walk lives

**Decision:** **NOT inline in `validationEngine.ts`.** New file `src/lib/candidate/validation/repeatableEntryFieldChecks.ts` — sibling to `personalInfoIdvFieldChecks.ts`, follows the same TD-077 structural-re-declaration pattern.

**Rationale:** `validationEngine.ts` is at 580 lines, 20 under the cap. Stage 3a's first estimate was off by ~9 lines and required an unplanned escalation (`savedEntryShape.ts` was introduced mid-stream). The honest line-count math for inline placement is in §2.1 below; the conservative answer is that inline placement would land somewhere between 615 and 660 lines (over cap). Even if a clever inline implementation hit 595, the margin is too thin to leave for the implementer's discretion. The sibling-file path is the same architectural shape Stage 2's TD-062 used for Personal Info / IDV, has an existing-pattern precedent, and leaves the engine at well under the cap.

---

## 2. File-by-file change list with line-count projections

### 2.1 Honest line-count math: why inline does not work

If the per-entry walk lived inline in `validationEngine.ts`:

| Inline addition | Conservative line cost |
|---|---|
| New helper `collectSectionPairs` (build `(serviceId, countryId)` pair list per section) | ~18 lines |
| New helper `buildPerCountryRequiredMap` (issue batched findMappings, AND-aggregate per `<countryId, requirementId>`) | ~25 lines |
| New helper `walkAddressBlockPieces` (per-piece walk with addressConfig + DEFAULT_ADDRESS_CONFIG fallback + malformed-JSON branch) | ~35 lines |
| New helper `walkScalarRequirement` (non-address_block requirement walk: empty check + field error) | ~12 lines |
| New shared constant `ADDRESS_PIECE_KEYS` array | ~3 lines |
| New shared constant `DEFAULT_ADDRESS_CONFIG` (validator-side) | ~10 lines |
| New shared `isMalformedAddressBlockValue` predicate | ~8 lines |
| Edits to each of `validateAddressHistorySection`, `validateEducationSection`, `validateEmploymentSection` to call into the per-entry walk + thread `findMappings`, package services, requirement metadata map | ~10 lines per section × 3 = ~30 lines |
| New imports + new comment-banner section | ~10 lines |
| **Subtotal** | **~151 lines** |
| **Minus existing imports/code that becomes unused** | **0** (nothing in the engine becomes unused — the new walk is purely additive) |
| **Net engine size** | **580 + 151 = 731 lines** — far over the 600 cap. |

A more aggressive inline design might combine some helpers and shave 30–40 lines, landing around 690–700 — still well over cap. The sibling-file path is therefore the only realistic option.

**Buffer assumption used in the projections below:** every "added lines" estimate carries an honest +20 % buffer for comment banners, blank lines, and TypeScript narrowing boilerplate. Projections marked "≈" are conservative ceilings, not floors.

### 2.2 New files to create

#### 2.2.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/repeatableEntryFieldChecks.ts` (NEW)

**Purpose:** owns the per-entry required-field walk for Address History, Education, and Employment. Sibling to `personalInfoIdvFieldChecks.ts`. The per-section validators in `validationEngine.ts` call into this module's three exported section validators, exactly as they call into `validatePersonalInfoSection` / `validateIdvSection` today.

**Exports:**

- `validateAddressHistoryEntries(input: ValidateRepeatableEntriesInput): Promise<FieldError[]>` — the per-entry walk for Address History. Honors the address_block per-piece rules (§1.1, §1.2). Emits `entryCountryRequired` for null-country entries.
- `validateEducationEntries(input: ValidateRepeatableEntriesInput): Promise<FieldError[]>` — per-entry walk for Education. No address_block special-casing (Education's address_block, where present, follows the same per-piece rules — see §3.4 below).
- `validateEmploymentEntries(input: ValidateRepeatableEntriesInput): Promise<FieldError[]>` — per-entry walk for Employment. Same shape as Education.
- `interface ValidateRepeatableEntriesInput { sectionId: string; entries: SavedRepeatableEntry[]; packageServicesForSection: PackageServiceWithRequirements[]; findMappings: FindDsxMappings; requirementById: Map<string, RequirementRecord>; }` — the shape the engine passes in.
- `interface RequirementRecord { id: string; name: string; fieldKey: string; type: string; disabled: boolean; fieldData: { dataType?: string; addressConfig?: AddressConfig | null } | null; }` — re-declared structurally per TD-077; consumed by the walk.
- `const DEFAULT_ADDRESS_CONFIG: AddressConfig` — the validator-side mirror of `AddressBlockInput.tsx:30–37`. Module-internal; not exported.
- `const ADDRESS_PIECE_KEYS: readonly AddressPieceKey[]` — module-internal; not exported.

**Internal helpers (not exported):**

- `collectSectionPairs(packageServicesForSection, entries) → Array<{ serviceId, locationId }>` — distinct list of `(serviceId, countryId)` pairs for the section.
- `buildPerCountryRequiredMap(rows: DsxMappingRow[]) → Map<countryId, Map<requirementId, boolean>>` — AND-aggregates flags per `<country, requirement>`.
- `isMalformedAddressBlockValue(value: unknown) → boolean` — true when not a non-array object, OR when missing all six piece keys.
- `walkAddressBlockPieces(requirement: RequirementRecord, value: unknown, entryOrder: number) → FieldError[]` — emits per-piece field errors for an entry's address_block.
- `walkScalarRequirement(requirement: RequirementRecord, value: unknown, entryOrder: number) → FieldError[]` — emits the single field error for a non-address_block scalar requirement.
- `isEmptyValue(value: unknown) → boolean` — re-declared verbatim from `personalInfoIdvFieldChecks.ts:424–429` (TD-077 pattern).
- `findApplicableRequirements(perReq: Map<requirementId, boolean>, requirementById, entry, packageServicesForSection) → RequirementRecord[]` — assembles the candidate requirement list for one entry, honoring the §1.3 service-level address_block carve-out.

**Imports:**

- `import logger from '@/lib/logger'`
- `import type { Prisma } from '@prisma/client'` (for `PackageServiceGetPayload`)
- `import type { FieldError } from './types'`
- `import type { DsxMappingRow, FindDsxMappings } from './personalInfoIdvFieldChecks'`
- `import type { SavedFieldRecord, SavedRepeatableEntry } from './savedEntryShape'`
- `import type { AddressConfig, AddressPieceKey } from '@/types/candidate-address'`

**Projected line count:** ≈ 320 lines (well within the 600 cap; well above the soft-warn 400 mark — this is acceptable given the scope, and is comparable in size to `personalInfoIdvFieldChecks.ts`'s 632).

### 2.3 Existing files to modify

#### 2.3.1 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/loadValidationInputs.ts` (MODIFY)

**File was read in full before this plan was written.** Confirmed.

**Currently (verified):** 274 lines. Builds the `requirementMetadata` map at lines 186–199 with shape `Map<requirementId, { fieldKey, name, dataType }>`.

**What changes:** Extend the loader to expose a richer per-requirement record map keyed by `requirementId` with the full data the per-entry walk needs (`name`, `fieldKey`, `type`, `disabled`, `fieldData`). The existing `requirementMetadata` map is preserved unchanged (its consumers — the date extractor — still read it). A new sibling map `requirementById` is added to the `kind: 'ok'` arm of `ValidationInputs`.

Specifically:

- **Add to the `kind: 'ok'` discriminated-union arm at lines 110–125:**
  - New field: `requirementById: Map<string, RequirementRecord>;`
- **Add the new internal type alias at the top of the file (after the existing internal types around line 56):**
  - `interface RequirementRecord { id: string; name: string; fieldKey: string; type: string; disabled: boolean; fieldData: { dataType?: string; addressConfig?: unknown } | null; }`
  - Re-declared structurally per TD-077; the `fieldData` slot is typed loosely (`addressConfig: unknown`) at the loader boundary because the validator narrows it; tightening here would couple the loader to the validator's addressConfig contract.
- **Augment the `for (const ps of orderedPackage.packageServices)` loop at lines 187–199** to also populate `requirementById` alongside `requirementMetadata`. Same iteration; just one extra `Map.set` per requirement. No new database call, no new Prisma include — the existing include (`serviceRequirements: { include: { requirement: true } }`) already returns `fieldData`.
- **Add `requirementById` to the return object at lines 218–231** in the `kind: 'ok'` arm.
- **Add a one-paragraph comment block** above the new type alias explaining why this re-declares vs. importing from a shared types module (TD-077 link).

**Imports needed:** none new. `Prisma` is already imported.

**Projected line delta:** +25 lines ⇒ loader becomes ≈ 299 lines (well within cap; was 274).

**What stays unchanged:**

- The existing `CANDIDATE_INVITATION_INCLUDE` constant.
- The existing `ValidationInputs` discriminated-union shape (one new field added; nothing removed).
- The `requirementMetadata` map — unchanged shape and contents.
- The `lockedValues` construction.
- The `findMappings` adapter and the `buildFindMappings()` factory.
- The `logger.warn('runValidation invoked on invitation without package'...)` call — exact text preserved.
- The "Invitation not found: ${invitationId}" throw — exact text preserved.
- All existing imports (`prisma`, `logger`, `Prisma`, the type imports).

#### 2.3.2 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/validationEngine.ts` (MODIFY)

**File was read in full before this plan was written.** Confirmed. Currently 580 lines.

**What changes:** Each of the three repeatable-section validators (`validateAddressHistorySection` lines 306–357, `validateEducationSection` lines 359–392, `validateEmploymentSection` lines 394–440) gains a per-entry field-error walk by calling into the new `repeatableEntryFieldChecks` module. The existing scope/gap logic in each validator is unchanged (Spec Rule 7).

Specifically:

- **Add new import** at the import block (around line 44, alphabetically near the other `./` imports):
  ```ts
  import {
    validateAddressHistoryEntries,
    validateEducationEntries,
    validateEmploymentEntries,
  } from './repeatableEntryFieldChecks';
  ```
- **Mark each of the three section validator functions `async`** so they can `await` the per-entry walks. Each validator becomes `async function validateAddressHistorySection(input): Promise<SectionValidationResult>` (and the same for Education/Employment). The orchestrator block at lines 113–164 already pushes `validateXxxSection(...)` results into `sectionResults` synchronously; the call sites become `sectionResults.push(await validateAddressHistorySection({...}))`. **`runValidation` is already `async`**, so this is a single-character `await` insertion at three call sites.
- **Extend `ScopedSectionInput`** (lines 291–304) with two new optional fields:
  - `packageServicesForSection: PackageServiceWithRequirements[]` — the subset of `inputs.orderedPackage.packageServices` that have the right `functionalityType` for this section.
  - `findMappings: FindDsxMappings` — passed through from `inputs.findMappings`.
  - `requirementById: Map<string, RequirementRecord>` — passed through from `inputs.requirementById`.
  - Type imports for `PackageServiceWithRequirements` and `RequirementRecord` are required; the simplest path is to re-declare them structurally in the engine (TD-077 pattern) or import them from `loadValidationInputs.ts`. Decision: **re-declare structurally** in the engine — the engine already re-declares `SavedFieldRecord` etc. by virtue of importing them from `savedEntryShape.ts`, and adding two more interface aliases at the top of the engine's helper section is consistent with the existing pattern. (`PackageServiceWithRequirements` already lives in `personalInfoIdvFieldChecks.ts:85–94` — the engine can import that type directly to avoid duplication, since it is already exported from `personalInfoIdvFieldChecks.ts`'s public surface via the implicit `export` on `PackageServiceWithRequirements` — verify during implementation; if not exported, re-declare here.)

  **Implementation note:** check whether `PackageServiceWithRequirements` is currently exported from `personalInfoIdvFieldChecks.ts`. If yes, import it. If no, re-declare structurally in the engine. Either path is acceptable per TD-077 — but the engine MUST NOT add an `export` to `personalInfoIdvFieldChecks.ts` (that file is unchanged in this stage, see §2.4 below).

- **Update the orchestrator's section-dispatch block at lines 110–164** to thread the new arguments through:
  - `validateAddressHistorySection({ ..., packageServicesForSection: servicesByType.get('record') ?? [], findMappings, requirementById })`.
  - `validateEducationSection({ ..., packageServicesForSection: servicesByType.get('verification-edu') ?? [], findMappings, requirementById })`.
  - `validateEmploymentSection({ ..., packageServicesForSection: servicesByType.get('verification-emp') ?? [], findMappings, requirementById })`.
- **Inside each validator**, after the existing scope/gap computation and before the `deriveStatusWithErrors` call, **append**:
  ```ts
  result.fieldErrors = await validateAddressHistoryEntries({  // or Education/Employment
    sectionId: input.sectionId,
    entries,
    packageServicesForSection: input.packageServicesForSection,
    findMappings: input.findMappings,
    requirementById: input.requirementById,
  });
  ```
  The status derivation already accounts for `result.fieldErrors.length > 0` via `deriveStatusWithErrors` (line 471 — `result.fieldErrors.length > 0` is part of the `hasErrors` condition). No change to status derivation is needed.

**Imports added:** the three exports from `repeatableEntryFieldChecks` (one import statement). Possibly `PackageServiceWithRequirements` from `personalInfoIdvFieldChecks` (if exported) or a new re-declared interface alias.

**Imports removed:** none.

**Projected line delta:** the engine wiring adds ~30 lines, but the simultaneous mandatory hoist of `buildReviewSummary` (§2.3.3 below) removes ~54 lines, yielding a net ~−24 line delta. The engine ends at ≈556 lines, with healthy headroom for future stages and well below the 600 hard cap.

**The `buildReviewSummary.ts` file is mentioned by name in this plan and is therefore covered by Implementer Absolute Rule 6.**

#### 2.3.3 `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/buildReviewSummary.ts` (NEW — mandatory)

**Created unconditionally as part of Stage 3b.** The hoist removes ~54 lines from `validationEngine.ts` and is what brings the engine from ≈610 lines (post-wiring, pre-hoist) down to ≈556 lines. Hoisting is part of the implementation contract, not a contingency. Gate G3 below remains as a residual sanity check on the post-hoist line count.

**Purpose:** owns the `buildReviewSummary` function lifted from `validationEngine.ts:520–573` — pure helper that walks `SectionValidationResult[]` and produces `ReviewPageSummary`.

**Exports:**

- `buildReviewSummary(sectionResults: SectionValidationResult[]): ReviewPageSummary` — moved verbatim, no behavior change.

**Imports:**

- `import type { ReviewError, ReviewPageSummary, SectionValidationResult } from './types'`

**Projected line count:** ≈ 65 lines (the function plus a header comment block).

#### 2.3.4 `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/IdvSection.tsx` (MODIFY)

**File was read in full before this plan was written.** Confirmed. Currently 531 lines.

**What changes:** The `handleCountryChange` callback at lines 263–286 is modified to clear active per-requirement slots before stashing the previous country's snapshot.

**Specifically:**

The current callback at lines 263–286:

```ts
const handleCountryChange = useCallback((countryId: string) => {
  if (selectedCountry && fields.length > 0) {
    const currentCountryData: Record<string, FieldValue> = {};
    for (const field of fields) {
      const value = formData[field.requirementId] as FieldValue | undefined;
      if (value !== undefined) {
        currentCountryData[field.requirementId] = value;
      }
    }
    setFormData(prev => ({
      ...prev,
      [`country_${selectedCountry}`]: currentCountryData
    }));
  }
  setSelectedCountry(countryId);
  setPendingSaves(prev => new Set(prev).add('country'));
}, [selectedCountry, fields, formData]);
```

becomes (single combined `setFormData` callback that snapshots **and** clears in one render):

```ts
const handleCountryChange = useCallback((countryId: string) => {
  // TD-072 fix — clear the active per-requirement slots scoped to the
  // previous country at the same render that stashes the snapshot, so the
  // next save's pendingSaves payload no longer carries orphaned
  // requirementIds. The snapshot under `country_<previousCountryId>`
  // preserves the values for re-hydration when the candidate returns.
  if (selectedCountry && fields.length > 0) {
    setFormData(prev => {
      // Build the snapshot from the previous-country values currently in
      // formData (read from `prev`, not the closure-captured formData, so
      // rapid switches stay consistent — Spec Edge Case 12).
      const currentCountryData: Record<string, FieldValue> = {};
      for (const field of fields) {
        const value = prev[field.requirementId] as FieldValue | undefined;
        if (value !== undefined) {
          currentCountryData[field.requirementId] = value;
        }
      }
      // Clone prev, drop the per-requirement slots, then attach the snapshot.
      const next: typeof prev = { ...prev };
      for (const field of fields) {
        delete next[field.requirementId];
      }
      next[`country_${selectedCountry}`] = currentCountryData;
      return next;
    });
  }
  setSelectedCountry(countryId);
  setPendingSaves(prev => new Set(prev).add('country'));
}, [selectedCountry, fields]);
```

Notes on the implementation:

- The dependency array drops `formData` (no longer captured) — the snapshot now reads from `prev` inside the `setFormData` callback. This is the standard React pattern for correctness under rapid switches (Edge Case 12).
- `setSelectedCountry(countryId)` and `setPendingSaves(...)` remain unchanged; they're separate `setState` calls and React batches them with the `setFormData` call within the same event handler.
- The save effect at lines 302–371 is unchanged — when the next render's debounced save fires, `formData` no longer has the orphan keys, so the save payload only contains the new-country requirementIds plus the synthetic `idv_country` row (Rule 14).
- The snapshot is preserved unchanged; returning to the previous country re-hydrates per current behavior at lines 240–246. Rule 15 is satisfied.

**Imports added:** none.

**Imports removed:** none.

**Projected line delta:** +6 to +10 lines (the callback grows by ~10 lines including the new comment block) ⇒ component becomes ≈ 540 lines. Well within the cap.

**What stays unchanged:**

- The save effect at lines 302–371.
- `loadFieldsForCountry` at lines 195–260 (including the snapshot-rehydrate logic at lines 240–246).
- `loadSavedData` at lines 140–184.
- The progress-update `useEffect` at lines 386–406.
- Every render block (lines 419–530).
- All other handlers (`handleFieldChange`, `handleFieldBlur`).

### 2.4 Files NOT modified

- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` — unchanged. (Spec Impact table, line 154.)
- `src/lib/candidate/validation/savedEntryShape.ts` — unchanged. (Spec Impact table, line 155.)
- `src/lib/candidate/validation/dateExtractors.ts` — unchanged.
- `src/lib/candidate/validation/types.ts` — unchanged.
- `src/lib/candidate/validation/packageScopeShape.ts` — unchanged.
- `src/lib/candidate/validation/scopeValidation.ts` — unchanged.
- `src/lib/candidate/validation/gapDetection.ts` — unchanged.
- `src/lib/candidate/validation/validateWorkflowSection.ts` — unchanged.
- `src/lib/candidate/validation/mergeSectionStatus.ts` — unchanged.
- `src/lib/candidate/validation/fieldFormatValidation.ts` — unchanged.
- `src/lib/candidate/validation/humanizeDuration.ts` — unchanged.
- `src/app/api/candidate/application/[token]/validate/route.ts` — unchanged. (Spec Impact table, line 158.)
- `src/app/api/candidate/application/[token]/submit/route.ts` — unchanged. (Spec Impact table, line 158.)
- `src/lib/candidate/submission/submitApplication.ts` — unchanged. (Spec Impact table, line 159.)
- `src/components/candidate/SectionErrorBanner.tsx` — unchanged. (Spec Impact table, line 157.)
- `src/components/candidate/review-submit/ReviewErrorListItem.tsx` — unchanged. (Spec Impact table, line 157.)
- `src/components/candidate/form-engine/AddressBlockInput.tsx` — unchanged. The validator gets its own structural copy of `DEFAULT_ADDRESS_CONFIG` per the server-vs-client boundary rule (§1.1).
- `src/components/candidate/form-engine/AddressHistorySection.tsx` — unchanged. The form-rendering bug (TD-069 carve-out: spec "Out of Scope" first bullet) is explicitly NOT addressed.
- `src/types/candidate-address.ts` — unchanged. The validator imports `AddressConfig` and `AddressPieceKey` from this file as types only.
- `src/types/candidate-portal.ts` — unchanged.
- `prisma/schema.prisma` — unchanged. **No schema changes. No migration.**
- All existing test files in `src/lib/candidate/validation/__tests__/` — unchanged in this stage. (New tests added by the test-writer agent; see §6 below.)
- `src/components/candidate/form-engine/__tests__/IdvSection.test.tsx` — to be **modified by the test-writer agent** in the next stage with new tests for TD-072 cleanup. The architect lists the file here so the implementer is informed it will receive new tests, but the **implementer does not modify this file**; the test-writer does.
- `src/test/setup.ts`, `src/test/utils.ts` — unchanged.

### 2.5 Test files the test-writer will create or modify

Listed here (per "the plan IS the contract") so the implementer knows test files in addition to source files are within scope for the pipeline as a whole. **The implementer does NOT write tests; the test-writer agent does.** The test-writer's allowed surface for this stage is exactly:

- **MODIFY:** `src/lib/candidate/validation/__tests__/validationEngine.test.ts` — append new `describe(...)` blocks for TD-069 per-entry walk regressions (DoD 1–10, see §6 below).
- **MODIFY:** `src/components/candidate/form-engine/__tests__/IdvSection.test.tsx` — append new `describe(...)` blocks for TD-072 country-switch cleanup (DoD 11–14, see §6 below).
- **CREATE (optional):** `src/lib/candidate/validation/__tests__/repeatableEntryFieldChecks.test.ts` — direct unit tests for the new helper. The test-writer chooses whether the integration coverage in `validationEngine.test.ts` is sufficient; if not, this file is created.

The test-writer files NOT touched: every other test file (per Spec Cross-cutting Rule 18 — zero net regression on existing tests).

---

## 3. New helper functions named, with file location and one-sentence purpose

| Helper | File | Purpose |
|---|---|---|
| `validateAddressHistoryEntries` | `repeatableEntryFieldChecks.ts` | Per-entry walk for Address History; honors address_block per-piece rules and emits `entryCountryRequired` on null countries. |
| `validateEducationEntries` | `repeatableEntryFieldChecks.ts` | Per-entry walk for Education; same shape, no Address-History-only branching beyond what `findApplicableRequirements` resolves. |
| `validateEmploymentEntries` | `repeatableEntryFieldChecks.ts` | Per-entry walk for Employment; same shape as Education. |
| `collectSectionPairs` | `repeatableEntryFieldChecks.ts` (internal) | Builds the distinct `(serviceId, locationId)` pair list from the section's package services and entries. |
| `buildPerCountryRequiredMap` | `repeatableEntryFieldChecks.ts` (internal) | AND-aggregates `dsx_mappings` rows into a `Map<countryId, Map<requirementId, boolean>>` cache. |
| `findApplicableRequirements` | `repeatableEntryFieldChecks.ts` (internal) | For one entry, returns the list of requirements applicable to its country, honoring the service-level address_block carve-out from §1.3. |
| `walkAddressBlockPieces` | `repeatableEntryFieldChecks.ts` (internal) | Emits per-piece field errors for one address_block requirement on one entry, applying enabled/required composition and DEFAULT_ADDRESS_CONFIG fallback. |
| `walkScalarRequirement` | `repeatableEntryFieldChecks.ts` (internal) | Emits the single field error for a non-address_block requirement that's required and empty. |
| `isMalformedAddressBlockValue` | `repeatableEntryFieldChecks.ts` (internal) | Predicate that returns true when the saved address_block value is null/undefined or not a non-array object missing all six pieces. |
| `isEmptyValue` | `repeatableEntryFieldChecks.ts` (internal) | Re-declared structurally from `personalInfoIdvFieldChecks.ts:424–429` per TD-077; returns true for undefined, null, '', and []. |
| `RequirementRecord` (interface) | both `loadValidationInputs.ts` and `repeatableEntryFieldChecks.ts` | Re-declared structurally per TD-077; per-requirement record carrying `id`, `name`, `fieldKey`, `type`, `disabled`, `fieldData`. |
| `DEFAULT_ADDRESS_CONFIG` (const) | `repeatableEntryFieldChecks.ts` | Validator-side mirror of `AddressBlockInput.tsx:30–37`'s default; applied when `fieldData.addressConfig` is missing. |
| `ADDRESS_PIECE_KEYS` (const) | `repeatableEntryFieldChecks.ts` | The fixed iteration order for the six address pieces, mirroring `src/types/candidate-address.ts:21–27`. |
| `buildReviewSummary` | `buildReviewSummary.ts` (mandatory, §2.3.3) | Verbatim hoist of `validationEngine.ts:520–573`; created unconditionally as part of Stage 3b to keep the engine at ≈556 lines. |

---

## 4. Data flow from `loadValidationInputs` through per-section validators down to the per-entry walk

### 4.1 Prose

`runValidation(invitationId)` calls `loadValidationInputs(invitationId)`, which (post-Stage-3b) returns `ValidationInputs` with one new field `requirementById` alongside the existing `requirementMetadata`, `findMappings`, `servicesByType`, `lockedValues`, etc. The orchestrator destructures the 'ok' branch as today, then dispatches to the three repeatable-section validators (`validateAddressHistorySection`, `validateEducationSection`, `validateEmploymentSection`), threading `findMappings` and `requirementById` plus the section-specific `packageServicesForSection` slice of `servicesByType`. Each section validator runs the existing scope/gap logic unchanged, then `await`s the new per-entry walk (`validateAddressHistoryEntries` / `validateEducationEntries` / `validateEmploymentEntries`), which: (1) collects the section's distinct `(serviceId, countryId)` pairs from its entries; (2) issues one batched `dsx_mappings` query via the existing `findMappings` adapter; (3) builds the per-country/per-requirement `isRequired` cache; (4) walks each entry, emitting `entryCountryRequired` for null-country entries and otherwise dispatching per-requirement to either `walkAddressBlockPieces` (for `dataType === 'address_block'`) or `walkScalarRequirement`. The returned `FieldError[]` is assigned to `result.fieldErrors`; `deriveStatusWithErrors` then folds it into the section's status the same way it folds Personal Info / IDV field errors today. No change to `summary`, no change to the `/validate` or `/submit` endpoint shape.

### 4.2 Numbered sequence

```
1. validate route handler  →  runValidation(invitationId)
2. runValidation           →  await loadValidationInputs(invitationId)
3. loadValidationInputs    →  prisma.candidateInvitation.findUnique({ include: CANDIDATE_INVITATION_INCLUDE })
4. loadValidationInputs    →  build requirementMetadata (existing, unchanged)
                              build requirementById     (NEW — same loop, extra Map.set)
                              build servicesByType     (existing, unchanged)
                              build lockedValues       (existing, unchanged)
                              build findMappings       (existing, unchanged)
                              return { kind: 'ok', ..., requirementById }
5. runValidation           →  for each repeatable section type {record, verification-edu, verification-emp}:
                                  await validateXxxSection({
                                      ...existing args,
                                      packageServicesForSection: servicesByType.get(<type>) ?? [],
                                      findMappings,
                                      requirementById,
                                  })
6. validateXxxSection      →  existing scope + gap logic (unchanged)
                              result.fieldErrors = await validateXxxEntries({ entries, packageServicesForSection, findMappings, requirementById, sectionId })
                              result.status = deriveStatusWithErrors(...)  [now sees fieldErrors]
                              return result
7. validateXxxEntries      →  pairs = collectSectionPairs(packageServicesForSection, entries)
                              if pairs.length === 0:
                                  rows = []
                              else:
                                  rows = await findMappings({ requirementIds: [], pairs })   // ONE batched query per section
                              perCountryReq = buildPerCountryRequiredMap(rows)
                              for each entry:
                                  if entry.countryId == null: emit entryCountryRequired error; continue
                                  applicable = findApplicableRequirements(perCountryReq, requirementById, entry, packageServicesForSection)
                                  for each requirement in applicable that perCountryReq says is required:
                                      saved = entry.fields.find(...)?.value
                                      if requirement.fieldData.dataType === 'address_block':
                                          errors.push(...walkAddressBlockPieces(requirement, saved, entry.entryOrder))
                                      else:
                                          errors.push(...walkScalarRequirement(requirement, saved, entry.entryOrder))
                              return errors
8. runValidation           →  buildReviewSummary(sectionResults)
                              return { sections: sectionResults, summary }
```

### 4.3 Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ runValidation(invitationId)                                            │
│                                                                        │
│   ┌──────────────────────────────────────┐                            │
│   │ loadValidationInputs(invitationId)    │                            │
│   │   - findUnique (existing include)     │                            │
│   │   - servicesByType, requirementMeta   │                            │
│   │   - findMappings, lockedValues        │                            │
│   │   - requirementById          [NEW]    │                            │
│   └──────────────┬───────────────────────┘                            │
│                  ▼ ValidationInputs ('ok' branch)                      │
│                                                                        │
│   ┌──────────────────────────────────────┐                            │
│   │ validateAddressHistorySection(args)   │                            │
│   │   1. existing scope + gap (unchanged) │                            │
│   │   2. await validateAddressHistory     │                            │
│   │        Entries({ entries,             │                            │
│   │                  packageServices,     │                            │
│   │                  findMappings,        │                            │
│   │                  requirementById })   │                            │
│   │   3. deriveStatusWithErrors (sees     │                            │
│   │      fieldErrors)                     │                            │
│   └──────────────┬───────────────────────┘                            │
│                  │   (same shape for Education, Employment)            │
│                  ▼                                                     │
│   ┌──────────────────────────────────────┐                            │
│   │ repeatableEntryFieldChecks            │  [NEW MODULE]              │
│   │   - collectSectionPairs               │                            │
│   │   - findMappings({ ids: [], pairs })  │  ONE batched query         │
│   │   - buildPerCountryRequiredMap        │                            │
│   │   - per-entry walk:                   │                            │
│   │       null country → entryCountry...  │                            │
│   │       address_block → walk pieces     │                            │
│   │       scalar req → walk value         │                            │
│   └───────────────────────────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Translation keys

Every new user-facing text string and its translation key:

| Key | English text |
|---|---|
| `candidate.validation.entryCountryRequired` | `Country is required for this entry.` |

**Reused (no new key):**

- `candidate.validation.fieldRequired` — used for every per-entry required-but-empty field error (whether address_block per-piece or scalar requirement). Same key Personal Info / IDV use today (per spec Rule 11).

The implementer adds the new key to the en translation file. Translation file path TBD: the implementer must search the codebase for the existing `candidate.validation.fieldRequired` key and add the new key adjacent to it. If the existing key is split across multiple locale files, the new key follows the same pattern. **Implementation Gate G2** below covers the case where the translation file location is ambiguous.

---

## 6. Test plan (high-level — full test specifications belong to the test-writer agent)

This section is the architect's specification of WHAT must be tested, not HOW. The test-writer translates these into test files.

### 6.1 TD-069 regressions (target file: `src/lib/candidate/validation/__tests__/validationEngine.test.ts`)

DoD 1–10 in the spec map directly to:

1. **Address History entry with bare `address_block` (only `countryId`/`fromDate`/`toDate`/`isCurrent`) → status incomplete** with one `FieldError` per required piece.
2. **Education entry missing a country-required `degreeAwarded` → status incomplete** with one `FieldError` for `degreeAwarded`.
3. **Employment entry missing a country-required `jobTitle` → status incomplete** with one `FieldError` for `jobTitle`.
4. **Two entries, two countries, distinct rules** — entry A passes country-A's rules, entry B fails country-B's rules; only B's missing fields appear in `fieldErrors`.
5. **Entry with `countryId === null` → status incomplete** with `entryCountryRequired` field error.
6. **Section with zero entries → no per-entry field errors** (only existing scope errors).
7. **Personal Info / IDV unchanged** — the existing tests in `personalInfoIdvFieldChecks.test.ts` continue to pass byte-identically.
8. **Section with valid entries reports `complete`** — the new walk does not flag a correctly-filled section.
9. **Date-coverage scope errors still fire** when entries are out of scope.
10. **Gap-detection still fires** when entries have gaps exceeding tolerance.

### 6.2 TD-072 regressions (target file: `src/components/candidate/form-engine/__tests__/IdvSection.test.tsx`)

DoD 11–14:

11. **Switching country from X to Y removes X-scoped `formData[<requirementId>]` entries.**
12. **Next save's `pendingSaves` payload does NOT include any X-scoped requirementIds.**
13. **`idv_country` save record is updated to Y in the same save cycle** (existing behavior preserved).
14. **Manual smoke-test path documented in the implementer's checkpoint.** (The smoke-test step is a checkpoint deliverable, not a test file.)

### 6.3 Cross-cutting

- **Zero net regression** — pre-existing test count (Spec calls out 4449) is the floor. Implementer captures `pnpm vitest run 2>&1 | tail -10` raw output before and after.
- **Typecheck green** — no new `any`, no new unsafe casts.
- **Lint green** — no new errors relative to parent commit.
- **Build green** — `pnpm build` succeeds.

---

## 7. Order of implementation

Numbered steps for the implementer. The implementer runs `pnpm typecheck` and `pnpm vitest run` after every step and stops if either regresses.

1. **No database changes.** Confirm `prisma/schema.prisma` is unchanged. Skip the migration step.
2. **No Prisma migration step.** (Per spec Rule 19 — no schema changes.)
3. **TypeScript types and constants:**
   - Add `interface RequirementRecord` to `src/lib/candidate/validation/loadValidationInputs.ts` (re-declared structurally per TD-077). One paragraph of TD-077 commentary above it.
4. **No Zod schema changes.** (No request/response shape changes.)
5. **Loader extension** — modify `loadValidationInputs.ts`:
   - Augment the existing `for (const ps of orderedPackage.packageServices)` loop at lines 187–199 to also build the `requirementById` map.
   - Add `requirementById` to the `kind: 'ok'` arm of the `ValidationInputs` union (lines 110–125).
   - Add `requirementById` to the return object (lines 218–231).
   - Run `pnpm typecheck`. Run `pnpm vitest run`. Counts must match baseline.
6. **New module** — create `src/lib/candidate/validation/repeatableEntryFieldChecks.ts`:
   - All exports and helpers from §3.
   - File compiles cleanly but is not yet wired in. `pnpm typecheck` passes. `pnpm vitest run` counts unchanged.
7. **Engine wiring** — modify `validationEngine.ts`:
   - New import for the three exported section-walk functions.
   - Mark each of the three repeatable-section validators `async`.
   - Extend `ScopedSectionInput` with `packageServicesForSection`, `findMappings`, `requirementById`.
   - Update each validator to `await` the new walk and assign `result.fieldErrors`.
   - Update the orchestrator's three call sites at lines 113–164 to thread the new arguments and `await`.
   - Run `pnpm typecheck`. Run `pnpm vitest run`. **Existing test counts must not regress.** New tests (added in the test-writer's pass) will fail at this step ONLY if the test-writer ran first; otherwise the engine compiles green and existing tests still pass.
8. **Mandatory hoist** — hoist `buildReviewSummary` into a new file `src/lib/candidate/validation/buildReviewSummary.ts`. Move the function verbatim from `validationEngine.ts:520–573`, add the import in `validationEngine.ts`, remove the function body from `validationEngine.ts`. Run `pnpm typecheck`. Run `pnpm vitest run`.
9. **IDV component** — modify `src/components/candidate/form-engine/IdvSection.tsx`:
    - Update `handleCountryChange` per §2.3.4.
    - Run `pnpm typecheck`. Run `pnpm vitest run`. Existing tests must still pass.
10. **Translation key** — locate the existing `candidate.validation.fieldRequired` translation entry and add `candidate.validation.entryCountryRequired` adjacent to it (Implementation Gate G2 if location is ambiguous).
11. **Test-writer hand-off** — the implementer's pass ends here. The test-writer agent then runs and adds the new TD-069 / TD-072 regression tests.
12. **Final verification** (back to the implementer after the test-writer):
    - `pnpm vitest run 2>&1 | tail -10` raw output captured.
    - `pnpm typecheck` green.
    - `pnpm lint` green (no new errors).
    - `pnpm build` succeeds.
    - `wc -l` on every modified file confirms `validationEngine.ts < 600` and every other file under cap.

---

## 8. Implementation gates — points where the implementer STOPs and escalates

The implementer is allowed to follow this plan as written. The implementer is NOT allowed to improvise outside it. The following are the explicit STOP points:

- **G1 — `PackageServiceWithRequirements` import path.** Step 7 needs this type. Check whether `personalInfoIdvFieldChecks.ts` exports it (it does NOT, by inspection of the file at lines 85–94 — the type alias has no `export` keyword). The implementer's path is to **re-declare it structurally** in `repeatableEntryFieldChecks.ts` and `validationEngine.ts` (per TD-077 pattern). The implementer must NOT add an `export` keyword to `personalInfoIdvFieldChecks.ts:85` — that file is unchanged in this stage. If the implementer believes a third path is necessary, STOP.

- **G2 — Translation key location.** Step 11 adds `candidate.validation.entryCountryRequired`. If the `candidate.validation.fieldRequired` translation key lives in multiple locale files, the implementer adds the new key to every file that has `fieldRequired`. If `fieldRequired` lives in a unique location and the new key naturally fits there, no escalation is needed. If the implementer cannot find `fieldRequired` at all, STOP — that's a precondition violation worth surfacing (the spec assumes the key exists).

- **G3 — Engine line count over 600 after the mandatory hoist.** Step 8's hoist projects the engine at ≈556 lines. If the engine still measures `>= 600` after step 8, STOP and escalate — that's a discovered constraint the architect must resolve, and the implementer must NOT improvise additional extractions.

- **G4 — Existing test regression.** If `pnpm vitest run` shows any pre-existing test going from pass to fail at any step, STOP. Per Spec Rule 18 — zero net regression — that's a fatal stage condition.

- **G5 — Typecheck regression.** If `pnpm typecheck` shows new errors at any step that were not present at the parent commit, STOP. No new `any`, no new unsafe casts.

- **G6 — `personalInfoIdvFieldChecks.ts` change.** If `git diff src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` shows any change after step 7, STOP. The file is in §2.4 (NOT modified). Even an "innocent" `export` keyword addition is a contract violation.

- **G7 — Schema or migration change.** If any `prisma/migrations/` directory grows or `prisma/schema.prisma` changes, STOP. Spec Rule 19 — application-layer only.

---

## 9. Risks

### 9.1 Engine line count estimate

The mandatory hoist of `buildReviewSummary` (§2.3.3) removes the primary line-count concern Stage 3a hit: the engine ends at ≈556 lines, not ≈610. G3 remains as a residual sanity check in case the post-hoist measurement still lands at or above 600.

### 9.2 The IDV cleanup interacting with `loadFieldsForCountry`'s rehydrate

`loadFieldsForCountry` at lines 240–246 reads `formData[`country_${countryId}`]` to rehydrate when the candidate returns to a previously-visited country. The new `handleCountryChange` writes the snapshot *before* clearing the active slots; both happen in the same `setFormData` callback so React applies them atomically. There is no window in which `formData` lacks the snapshot and lacks the active slots simultaneously — the snapshot replaces the active slots. **Mitigation:** the test-writer adds an explicit test that switches X→Y→X and asserts the X values rehydrate (mapping to spec Edge Case 12).

### 9.3 The `formData` callback dependency change

Today `handleCountryChange` declares `formData` in its dependency array (line 286). Removing it (because the callback now reads `prev` inside `setFormData`) is the correct React pattern for state that depends only on its previous value. Linting may flag this as a stale-closure warning if the lint rule is configured to enforce all-deps. **Mitigation:** the implementer reviews the lint output; if `react-hooks/exhaustive-deps` flags the change, the implementer adds an `eslint-disable-next-line react-hooks/exhaustive-deps` comment with a one-line rationale citing TD-072 / Edge Case 12. This is the same disable pattern used elsewhere in the candidate form engine when the closure-vs-state-callback distinction matters.

### 9.4 The discriminated-union extension

Adding `requirementById` to the `kind: 'ok'` arm changes the public shape of `ValidationInputs`. No external consumer destructures it (only `validationEngine.ts` does), but TypeScript type-narrowing in test files that fixture `ValidationInputs` directly may need an update. **Mitigation:** confirmed by `grep -rn "ValidationInputs" src` that the type is referenced only inside the validation directory; no test file currently fixtures it directly. If a test does, the test-writer adjusts.

### 9.5 Per-entry walk performance with many entries

A candidate with 12 address-history entries spanning 5 countries produces a 5-pair query (assuming one record service in the package). Even with multiple services, the pair list is bounded by `services × distinct-countries`, which is small. The single `dsx_mappings.findMany` over OR-of-pairs uses the existing `(serviceId, locationId)` index. **Mitigation:** Spec Edge Case 8 mandates this exact bounded-batch shape; no separate caching is needed beyond the in-memory `Map` built from the query result.

### 9.6 The `entryCountryRequired` field error's `fieldName`

The walk returns `FieldError` objects whose `fieldName` is what `SectionErrorBanner` and the Review page render. For `entryCountryRequired`, the architect picks **`fieldName: "Entry ${entryOrder}"`** with `messageKey: 'candidate.validation.entryCountryRequired'` and `placeholders: { entryOrder }`. This format mirrors how the existing IDV flow renders `idvCountryRequired` errors. **Mitigation:** the test-writer asserts the exact `fieldName` and `placeholders` shape so any future renaming is caught.

### 9.7 Missing-country entry on a section with zero applicable requirements

Edge case: an entry has `countryId === null`, but the section's package service has no field-type requirements at all (Spec Edge Case 7). Today, the section produces zero field errors and is `complete`. After Stage 3b, the entry's null country triggers `entryCountryRequired` regardless of whether other requirements exist. **Decision:** this is the intended behavior — Spec Rule 4 says "An entry with no country is treated as `incomplete` for required-field purposes." The null-country error is independent of which requirements would otherwise apply.

---

## 10. Plan completeness check

- [x] Every file the implementer will touch is listed in §2 (one new mandatory: `repeatableEntryFieldChecks.ts`; one new mandatory: `buildReviewSummary.ts`; three modified: `loadValidationInputs.ts`, `validationEngine.ts`, `IdvSection.tsx`; plus translation file location to be discovered at G2).
- [x] Test files the test-writer will touch are explicitly listed in §2.5 so the pipeline contract is complete.
- [x] No file outside this plan will need modification. The "Files NOT modified" list (§2.4) is exhaustive for the directories at risk.
- [x] All new helpers are named with files and one-sentence purpose (§3).
- [x] All new constants and types named (§3).
- [x] All new translation keys listed (§5).
- [x] Data flow documented in prose, numbered sequence, and diagram (§4).
- [x] Both deferred design questions resolved with concrete payload examples and a precise composition rule (§1.1, §1.2).
- [x] All deferred edge cases decided with one-sentence rationale each (§1.3).
- [x] Implementation gates listed (§8).
- [x] Honest line-count math with conservative buffer (§2.1).
- [x] Plan is consistent with spec — no business rule has been relaxed; every rule from the spec maps to a concrete implementation behavior or to an edge-case decision; all "Out of Scope" items are excluded.

---

## 11. Discovered, not addressed in this stage

The architect's reading of the codebase surfaced the following pre-existing issues. Each is a candidate new TD entry; none is part of Stage 3b's implementation. The implementer must NOT fix any of these in this branch.

### 11.1 `validationEngine.ts` carries `MS_PER_DAY` and `DAYS_PER_YEAR` constants that are also defined in `dateExtractors.ts`

`validationEngine.ts:65–66` declares these two constants; `dateExtractors.ts` declares the same two values for the same purpose. Neither file imports from the other. Constant duplication is a minor smell that can drift if one is changed and the other isn't. **Logged candidate:** TD-078 — `validationEngine.ts` and `dateExtractors.ts` re-declare the same MS_PER_DAY / DAYS_PER_YEAR constants; consider a single shared `time-constants.ts` module or accept the duplication and document it.

### 11.2 `IdvSection.tsx` `loadCountries` and `loadSavedData` do not use the global fetch wrapper

`IdvSection.tsx:103–138, 140–184` use `fetch(...)` directly rather than a helper that includes auth headers / error normalization. Other candidate-portal components (`AddressHistorySection.tsx`, `EducationSection.tsx`) follow the same pattern, so this is consistent — but it does mean error handling is hand-rolled per component. **Logged candidate:** TD-079 — the candidate portal could benefit from a shared `candidatePortalFetch(token, path)` helper to centralize error logging and auth-header handling. Out of scope for Stage 3b because TD-072 only modifies `handleCountryChange`.

### 11.3 The validator-side `DEFAULT_ADDRESS_CONFIG` is a structural copy of `AddressBlockInput.tsx:30–37`

The validator has its own copy of the default config because the UI's copy lives in a `'use client'` component file. If the UI's default is ever changed, the validator's copy must be updated in lockstep — there is no compile-time guarantee. **Logged candidate:** TD-080 — extract `DEFAULT_ADDRESS_CONFIG` and `ADDRESS_PIECE_KEYS` into a server-safe shared module (e.g. extending `src/types/candidate-address.ts` with non-type exports) so the UI and the validator import from one source. Out of scope for Stage 3b because the new copy is structurally complete and behaviorally equivalent today; the duplication is a future-proofing concern, not a correctness concern.

### 11.4 `personalInfoIdvFieldChecks.ts` does not export `PackageServiceWithRequirements`

The type alias at `personalInfoIdvFieldChecks.ts:85–94` is module-internal. The new `repeatableEntryFieldChecks.ts` will need the same shape and is forced to re-declare structurally per TD-077. This is consistent with the TD-077 pattern (intentional duplication), but the duplication footprint grows with every new sibling helper. **Logged candidate:** TD-081 — when the next sibling validator helper is added (after `repeatableEntryFieldChecks.ts`), reconsider whether `PackageServiceWithRequirements` benefits from being exported by `personalInfoIdvFieldChecks.ts` as the canonical shape; today's TD-077 layering accepts the duplication. Out of scope for Stage 3b per spec Rule 20.

---

The plan is ready for the test-writer to proceed.
