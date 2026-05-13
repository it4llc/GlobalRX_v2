# Technical Plan: Convert `idv` → `verification-idv` Functionality Type

**Based on specification:** `docs/specs/verification-idv-conversion.md` (2026-05-12, Confirmed)
**Date:** 2026-05-12
**Architect:** Technical Architect agent
**Branch:** `feature/td-084-required-indicator-per-country` (continuing on this branch; TD-084 just shipped — see commit `4b91505` — and `verification-idv` inherits TD-084's `/fields` OR-merge automatically)

---

## 0. Pre-flight: verification of facts the spec pinned

Every file the BA spec named was read in full or at the cited line range before this plan was written. Verified pinned facts:

| Pinned fact | Source | Verified |
|---|---|---|
| `/api/services/route.ts` line 9 declares `VALID_FUNCTIONALITY_TYPES` missing `idv` | inspection | Verified — `["record", "verification-edu", "verification-emp", "other"]`. |
| `/api/services/route.ts` line 174 coerces invalid values to `"other"` | inspection | Verified. |
| `/api/services/[id]/route.ts` PUT/PATCH have NO `functionalityType` validation today | inspection | Verified — only "missing required fields" checks. |
| `structure/route.ts` line 163 scope-grouping filter excludes IDV | inspection | Verified — `funcType !== 'record' && funcType !== 'verification-edu' && funcType !== 'verification-emp'` continues. |
| `structure/route.ts` lines 286–292 hardcode `serviceTypeOrder = ['idv', ...]` and `serviceTitleMap['idv']` | inspection | Verified. |
| `structure/route.ts` line 333 builds `id: 'service_${funcType}'` for non-record service sections | inspection | Verified. |
| `validationEngine.ts` lines 202–220 contain the bespoke `hasIdv` dispatch with `sectionId: 'service_idv'` and `idvSectionData: sectionsData['idv']` | inspection | Verified. |
| `loadValidationInputs.ts` lines 199–208 only accept edu/emp/record into `servicesByType` | inspection | Verified. |
| `packageScopeShape.ts` lines 59–62 — `ScopeFunctionalityType` is the 3-member union | inspection | Verified. |
| `personalInfoIdvFieldChecks.ts` line 325 filter on `'idv'`; line 123 `IDV_COUNTRY_MARKER = 'idv_country'` | inspection | Verified. |
| `submitApplication.ts` line 348 filter on `'idv'` | inspection | Verified. |
| `submission/types.ts` line 23 `OrderItemSource.kind: 'idv'` | inspection | Verified. |
| `orderDataPopulation.ts` line 66 `IDV_COUNTRY_MARKER = 'idv_country'`; line 220 `case 'idv':` branch | inspection | Verified. |
| `portal-layout.tsx` line 687 dispatches `section.functionalityType === 'idv'` to `IdvSection` | inspection | Verified. |
| `IdvSection.tsx` line 367 sends `sectionType: 'idv'`; line 198–214 uses package-aware `/fields` request | inspection | Verified. |
| `save/route.ts` line 36 `sectionType` enum contains `'idv'` (UNCHANGED per BR 8) | inspection | Verified. |
| `saved-data/route.ts` line 313 `sectionType === 'idv' && 'countryId' in data` (UNCHANGED per BR 8) | inspection | Verified. |
| Production row `8388bb60-48e4-4781-a867-7c86b51be776` exists with `functionalityType = 'idv'` | spec Decision 1 | Treated as authoritative; not re-verified against production DB at plan time. |
| `prisma/schema.prisma` line 98 — `functionalityType String @default("other")` (no enum at DB level) | inspection | Verified — **no schema migration needed; data migration only.** |
| `src/constants/service-status.ts` exists and demonstrates the constants-file pattern | inspection | Verified (47 lines; uses `as const` object + derived TS type + `_VALUES` array). |

**File-size verification (relevant to the implementer's CODING_STANDARDS §9 file-size rule):**

| File | Current line count | After plan? |
|---|---|---|
| `src/app/api/services/route.ts` | 233 | Under 250 — safe. |
| `src/app/api/services/[id]/route.ts` | 189 | ~210 after PUT/PATCH validation — safe. |
| `src/lib/candidate/validation/validationEngine.ts` | 573 | Net **decrease** after `hasIdv` removal — safe. |
| `src/components/candidate/portal-layout.tsx` | 841 | Already over 600. **The implementer must NOT add any code here.** This plan only allows a one-string literal change at line 687 (`'idv'` → `'verification-idv'`). One-character-equivalent edits to an over-600 file are allowed under the rule's intent (no NEW content added) — but the implementer must call this out and confirm with Andy if the rule is interpreted strictly. **Decision-point flag — see §13 Risks #5.** |
| `src/components/modules/customer/package-dialog.tsx` | 527 | One conditional change at line 280; no new lines. Safe. |
| `src/components/modules/customer/package-dialog-new.tsx` | 632 | Already over 600. One conditional change at line 600. Same caveat as portal-layout.tsx. **Decision-point flag — see §13 Risks #5.** |
| `src/lib/candidate/validation/__tests__/validationEngine.test.ts` | 2121 | Test files are exempt from the 500/600 rule (CODING_STANDARDS §9.2). Net change: +0 to +40 lines for new test cases. |

---

## 1. Scope summary

This plan converts the bare functionality-type string `"idv"` to `"verification-idv"` everywhere the value is used **as a functionality type**, and leaves three unrelated `"idv"` literals intact (save-route `sectionType` enum, `IDV_COUNTRY_MARKER` constant, `OrderItemSource.kind: 'idv'` provenance discriminator) per BR 8 / Decisions 5.

The plan introduces one new shared-constants module (`src/constants/functionality-types.ts`), one data-only DB migration, and updates one PR-worth of source files. There is **no `prisma/schema.prisma` change** — the column type stays `String`.

---

## 2. UI grep verification (BA spec Decision 7 / DoD 14)

The architect grepped client-side code (`src/components/**`, `src/app/**` non-API, `src/hooks/**`) for any string-equality against `'idv'` or `'service_idv'` that would matter to the rename. Findings:

| File:line | What it does | Action |
|---|---|---|
| `src/components/candidate/portal-layout.tsx:687` | `section.type === 'service_section' && section.functionalityType === 'idv'` — UI dispatch to `IdvSection` | **CHANGE** to `'verification-idv'`. |
| `src/components/candidate/form-engine/IdvSection.tsx:367` | `sectionType: 'idv'` (save-route bucket key) | **DO NOT TOUCH** — BR 8. |
| `src/components/candidate/form-engine/IdvSection.tsx:368, :393` | `sectionId: 'idv'` (save payload + log metadata) | **DO NOT TOUCH** — BR 8. |
| `src/components/candidate/form-engine/IdvSection.tsx:162` | `field.requirementId === 'idv_country'` (synthetic marker check) | **DO NOT TOUCH** — BR 8 (synthetic marker). |
| `src/components/candidate/form-engine/IdvSection.tsx:356` | `requirementId: 'idv_country'` (write the marker) | **DO NOT TOUCH** — BR 8. |
| `src/components/modules/global-config/tabs/services-tab.tsx:51` | Hardcoded `useState<string[]>(['record', 'verification-edu', 'verification-emp', 'other', 'idv'])` — admin dropdown source | **CHANGE** — drop `'idv'`, add `'verification-idv'`. After this PR, this entire literal will be replaced by an import from the new constants module. |
| `src/components/modules/global-config/tabs/services-tab.tsx:237–243` | `getDisplayTitle` switch — currently has no case for `'idv'` (it falls through to "Other") | **ADD** a `case 'verification-idv': return 'Verification - Identity';` (label is at Andy's discretion). |
| `src/components/modules/global-config/services/service-form.tsx:120–124` | Dropdown options derived from `functionalityTypes.map(type => ({ value: type, label: type.charAt(0).toUpperCase() + type.slice(1) }))` | **NO CHANGE** — auto-derives from the data the parent passes in. |
| `src/components/modules/customer/package-dialog.tsx:280` | Missing-scope validation: `service.functionalityType.startsWith('verification') && !svc.scope` | **CHANGE** to exclude `verification-idv` (because verification-idv's scope is auto-set, not user-selected). |
| `src/components/modules/customer/package-dialog.tsx:495` | Scope selector visibility: `service.functionalityType.startsWith('verification')` | **CHANGE** to exclude `verification-idv` (no scope selector). |
| `src/components/modules/customer/package-dialog-new.tsx:600` | Same as package-dialog.tsx:495 | **CHANGE** same way. |
| `src/components/modules/customer/scope-selector.tsx` (full file) | Per-service-type scope UI for edu/emp/record only. Verification-idv falls through to "Standard scope" fallback. | **NO CHANGE** — verification-idv never reaches here after the package-dialog gating changes above. |
| `src/components/modules/customer/customer-packages.tsx:295–308` | `formatFunctionalityType` switch — has no `idv` case | **ADD** a `case 'verification-idv': return 'Identity Verification';`. (Label cosmetic; matches the "Identity Verification" copy in candidate.portal.sections.identityVerification.) |
| `src/components/modules/customer/customers-packages-fixed.tsx:345–375` | `formatScopeDisplay` switch — has no `idv` or `verification-idv` branch (returns "Standard" when scope is null or unknown type) | **NO CHANGE** — verification-idv's `{type:'count_exact',quantity:1}` scope falls through to a sensible "Standard" display. (Cosmetic; could be improved later but out of scope.) |
| `src/types/candidate-address.ts:102` | JSDoc comment listing `'idv'` in `serviceTypeOrder` | **CHANGE** the doc-comment string to `'verification-idv'`. |
| `src/types/candidate-portal.ts:54`, `src/types/dsx.ts:72`, `src/types/service-order-data.ts:98`, `src/types/candidate-repeatable-form.ts:37` | `functionalityType: string` field declarations (type `string`, not literal union) | **NO CHANGE** required for behavior. **Optional improvement: refactor to `FunctionalityType` from the new constants module.** Plan defers this to a follow-up to keep this PR minimal — see §13 #7. |

**No router-, analytics-, or persisted-user-state-keyed-by-`'service_idv'` was found.** The `service_idv` literal lives only in (a) `validationEngine.ts:211` (`SectionValidationResult.sectionId`), (b) the structure endpoint's emitted section id (line 333, derived dynamically), and (c) test fixtures that mirror those values. No deep-link, no localStorage key, no URL parameter uses it.

**No analytics events** key off section ids (architect confirmed via grep `analytics|track|telemetry|GA|gtag` returning no IDV-section results).

---

## 3. Database changes

**No `prisma/schema.prisma` changes.** The `services.functionalityType` column stays `String` with `@default("other")`. No DB-level enum. No new tables, no new columns, no new indexes.

The only DB work is a **data migration** in §11.

---

## 4. New files to create

### 4.1 `src/constants/functionality-types.ts`

**Purpose:** Single source of truth for the Service `functionalityType` allow-list and TypeScript union.

**Contents (architect-specified, verbatim guidance for the implementer):**

```typescript
// /GlobalRX_v2/src/constants/functionality-types.ts

/**
 * Service.functionalityType allow-list
 *
 * The DB column type is `String @default("other")` — there is no enum at
 * the database level. This module is the application-side single source
 * of truth: every API route that validates `functionalityType`, every UI
 * dropdown that shows it, and every seed that writes it imports from
 * here.
 *
 * Order matters: this is the order used by the admin Services UI dropdown
 * and by the structure endpoint's service-section ordering on the
 * candidate portal. IDV is first (the candidate sees it first in the
 * sidebar), then record (address history), then the two non-idv
 * verifications, then `other`.
 *
 * After verification-idv-conversion (docs/specs/verification-idv-conversion.md)
 * the bare string `'idv'` no longer appears here.
 */
export const FUNCTIONALITY_TYPES = [
  'verification-idv',
  'record',
  'verification-edu',
  'verification-emp',
  'other',
] as const;

export type FunctionalityType = typeof FUNCTIONALITY_TYPES[number];

/** Type-guard helper; mirrors `isValidServiceStatus` in service-status.ts. */
export function isValidFunctionalityType(value: string): value is FunctionalityType {
  return (FUNCTIONALITY_TYPES as readonly string[]).includes(value);
}
```

**Why the order has IDV first:** matches `structure/route.ts:286` after rename. The admin dropdown picks up the same order so the admin sees IDV-first consistently across surfaces.

**Tests:** new file `src/constants/__tests__/functionality-types.test.ts` (see §10).

---

## 5. Existing files to modify

For each file I confirm it was read before being listed. Listed in the order the implementer should touch them (§9 has the canonical order).

### 5.1 `src/app/api/services/route.ts` — POST validation (read in full)

**Current state (lines 9, 174):**
- Line 9: `const VALID_FUNCTIONALITY_TYPES = ["record", "verification-edu", "verification-emp", "other"];` (missing `idv`)
- Line 174: `const validFunctionalityType = VALID_FUNCTIONALITY_TYPES.includes(functionalityType) ? functionalityType : "other";` (silent coerce)
- Line 115: GET handler returns `functionalityTypes: VALID_FUNCTIONALITY_TYPES` in the response.

**Changes:**

1. **Remove the inline `VALID_FUNCTIONALITY_TYPES` array (line 9).** Import from the new module:
   ```typescript
   import { FUNCTIONALITY_TYPES, isValidFunctionalityType } from '@/constants/functionality-types';
   ```

2. **Replace the line-174 silent coerce with a 400 reject** (BR 3 / DoD 2):
   ```typescript
   if (!isValidFunctionalityType(functionalityType)) {
     return NextResponse.json(
       { error: 'Unknown functionality type' },
       { status: 400 }
     );
   }
   ```
   Place AFTER the "Missing required fields" check at line 166 — the 400 for unknown type must come *after* the 400 for missing required fields so the ordering stays predictable.

3. **GET handler response (line 115):** change `functionalityTypes: VALID_FUNCTIONALITY_TYPES` to `functionalityTypes: FUNCTIONALITY_TYPES`. The response shape is unchanged; only the value source changes.

4. **Update the JSDoc block** (the route has no JSDoc today — adding one is out of scope; just confirm the existing comments referring to the allow-list say the right thing post-change).

**Net effect:** the route now rejects unknown functionality types (including `"idv"`) with HTTP 400 instead of silently coercing to `"other"`.

### 5.2 `src/app/api/services/[id]/route.ts` — PUT and PATCH validation (read in full)

**Current state:**
- PUT (lines 71–125): validates `name`, `category`, `functionalityType` as truthy at line 89, but does NOT check `functionalityType` against an allow-list.
- PATCH (lines 128–190): partial-update path at line 168–180 accepts any `functionalityType` value without validation. Uses `updateData: any` at line 170 (pre-existing tech debt; not addressed here).

**Changes:**

1. **Import the new constants** at the top of the file:
   ```typescript
   import { isValidFunctionalityType } from '@/constants/functionality-types';
   ```

2. **PUT handler:** after the missing-fields check at line 89–94 and before the `findUnique` at line 97, add:
   ```typescript
   if (!isValidFunctionalityType(functionalityType)) {
     return NextResponse.json(
       { error: 'Unknown functionality type' },
       { status: 400 }
     );
   }
   ```

3. **PATCH handler:** inside the partial-update branch (after line 168, before line 174 where `functionalityType` is folded into `updateData`), add:
   ```typescript
   if (functionalityType !== undefined && !isValidFunctionalityType(functionalityType)) {
     return NextResponse.json(
       { error: 'Unknown functionality type' },
       { status: 400 }
     );
   }
   ```
   Note: the partial-update path may legitimately omit `functionalityType` (e.g., when only `name` changes), so we only validate when the field is present.

**Out of scope:** the `updateData: any` typing at line 170 is pre-existing tech debt; not addressed in this PR (would expand the surface and the BA spec does not require it).

### 5.3 `src/app/api/candidate/application/[token]/structure/route.ts` — section ordering, title map, scope-grouping filter (read in full)

**Current state:**
- Line 54 (JSDoc): documents `functionalityType?: string // For service sections: idv, record, verification-edu, verification-emp`.
- Line 163: scope-grouping filter excludes IDV: `if (funcType !== 'record' && funcType !== 'verification-edu' && funcType !== 'verification-emp') continue;`
- Lines 286–292: hardcoded `serviceTypeOrder = ['idv', ...]` and `serviceTitleMap['idv'] = ...`.
- Line 333: section id built as `service_${funcType}`, which after rename emits `service_verification-idv`.

**Changes:**

1. **Line 54 JSDoc:** replace `idv` with `verification-idv` in the comment.

2. **Line 163 filter:** change to allow `verification-idv` through the scope-resolver. Per BR 15 / Decision 4, IDV joins per-functionality grouping. The line becomes:
   ```typescript
   if (
     funcType !== 'record' &&
     funcType !== 'verification-edu' &&
     funcType !== 'verification-emp' &&
     funcType !== 'verification-idv'
   ) continue;
   ```

3. **`buildSectionScope` (lines 179–220):** the function signature accepts `funcType: 'record' | 'verification-edu' | 'verification-emp'`. **Extend the type to also accept `'verification-idv'`.** Add a branch in the `typeLabel` ternary at lines 184–189:
   ```typescript
   const typeLabel =
     funcType === 'verification-edu'
       ? 'education'
       : funcType === 'verification-emp'
         ? 'employment'
         : funcType === 'verification-idv'
           ? 'identity'
           : 'address';
   ```
   The `count_exact` path at line 196 already handles IDV's `{scopeType:'count_exact',scopeValue:1}` correctly — no further branch logic needed.

4. **Lines 286–292:** replace `'idv'` keys with `'verification-idv'`:
   ```typescript
   const serviceTypeOrder = ['verification-idv', 'record', 'verification-edu', 'verification-emp'];
   const serviceTitleMap: Record<string, string> = {
     'verification-idv': 'candidate.portal.sections.identityVerification',
     'record': 'candidate.portal.sections.addressHistory',
     'verification-edu': 'candidate.portal.sections.educationHistory',
     'verification-emp': 'candidate.portal.sections.employmentHistory',
   };
   ```
   **Translation key `candidate.portal.sections.identityVerification` stays unchanged.**

5. **Lines 323–343 (the `else` branch where non-record service sections are emitted):** **add a `verification-idv` branch that attaches the resolved scope** (defensive — even though the scope is always `{count_exact:1}` for IDV, the candidate portal still receives the block so future code can read it uniformly). Concretely:
   ```typescript
   const sectionScope =
     funcType === 'verification-edu'
       ? buildSectionScope('verification-edu')
       : funcType === 'verification-emp'
         ? buildSectionScope('verification-emp')
         : funcType === 'verification-idv'
           ? buildSectionScope('verification-idv')
           : undefined;
   ```

**Net effect:** the structure endpoint emits `id: 'service_verification-idv'` and `functionalityType: 'verification-idv'`. IDV appears first in the service-section ordering, as before.

### 5.4 `src/lib/candidate/validation/packageScopeShape.ts` — extend `ScopeFunctionalityType` (read in full)

**Current state:** `ScopeFunctionalityType` union has three members (lines 59–62). `normalizeRawScope` doesn't handle a verification-idv branch — and `pickMostDemandingScope` operates purely on the resolved shape.

**Changes:**

1. **Extend the union (lines 59–62):**
   ```typescript
   export type ScopeFunctionalityType =
     | 'verification-edu'
     | 'verification-emp'
     | 'verification-idv'
     | 'record';
   ```

2. **`normalizeRawScope` (lines 82–144):** add a defensive early-return for `verification-idv` so IDV always resolves to `{ scopeType: 'count_exact', scopeValue: 1 }` regardless of the stored raw scope shape (BR 15). Insert this near the top of the function, before the `isRecord` / `isDegreeScope` logic:
   ```typescript
   if (functionalityType === 'verification-idv') {
     return { scopeType: 'count_exact', scopeValue: 1 };
   }
   ```
   Rationale: even if a migration-missed row exists with a stale shape, IDV always means "exactly one entry." This is the spec's defensive guarantee.

3. **Comment at lines 73–81 (Defaults docblock):** add a one-liner explaining the verification-idv branch:
   ```typescript
   //   - verification-idv (any scope)   → count_exact 1 (BR 15 — IDV always
   //                                      means "exactly one entry")
   ```

### 5.5 `src/lib/candidate/validation/loadValidationInputs.ts` — add verification-idv to `servicesByType` grouping (read in full)

**Current state (lines 199–208):** loop only inserts edu/emp/record into `servicesByType`. IDV services fall through and are picked up by the bespoke `hasIdv` dispatch downstream.

**Changes:**

1. **Add `verification-idv` to the `ft === ...` filter** at line 200:
   ```typescript
   if (
     ft === 'verification-edu' ||
     ft === 'verification-emp' ||
     ft === 'verification-idv' ||
     ft === 'record'
   ) {
     // ... existing body unchanged
   }
   ```
   The `servicesByType` map's value type widens automatically since the union is extended.

**Net effect:** verification-idv services are grouped alongside edu/emp/record, available to the engine via `servicesByType.get('verification-idv')`.

### 5.6 `src/lib/candidate/validation/validationEngine.ts` — drop bespoke `hasIdv` dispatch (read in full)

**Current state:**
- Lines 119–137: dispatch `'record'` services to `validateAddressHistorySection`.
- Lines 139–157: dispatch `'verification-edu'` to `validateEducationSection`.
- Lines 159–178: dispatch `'verification-emp'` to `validateEmploymentSection`.
- Lines 202–220: **bespoke `hasIdv` dispatch** to `validateIdvSection`, using `sectionId: 'service_idv'` and reading from `sectionsData['idv']`.

**Changes:**

1. **Remove the `hasIdv` block (lines 202–220).** Replace with a parallel `servicesByType.has('verification-idv')` dispatch placed in the same position as the other three sections (between Employment and Personal Info), preserving the engine's section-emission order:

   ```typescript
   // IDV (verification-idv) — symmetric with verification-edu / verification-emp
   // dispatch above. Scope is fixed at count_exact:1 (see packageScopeShape
   // — BR 15). The IDV section's saved-data bucket key stays `'idv'` per
   // BR 8 — the Service.functionalityType rename does NOT touch save-route
   // bucket keys.
   if (servicesByType.has('verification-idv')) {
     const idvServices = servicesByType.get('verification-idv') ?? [];
     const idvResult = await validateIdvSection({
       sectionId: 'service_verification-idv',
       idvSectionData: sectionsData['idv'], // BR 8 — save-bucket key unchanged
       packageServices: idvServices,
       findMappings,
       sectionVisits,
       reviewVisitedAt,
       deriveStatus: deriveStatusWithErrors,
     });
     sectionResults.push(idvResult);
   }
   ```

   **Notes:**
   - **`sectionId` becomes `'service_verification-idv'`** to match what the structure endpoint emits.
   - **`idvSectionData: sectionsData['idv']` stays `'idv'`** — BR 8 (save-route bucket key is intentionally a different namespace).
   - **`packageServices: idvServices`** is the grouped slice — narrower than the previous `orderedPackage.packageServices` (full package). The IDV validator currently accepts the full package list and filters internally; passing the pre-filtered slice is consistent with how edu/emp/record dispatch works. (See §5.7 for the corresponding change inside `personalInfoIdvFieldChecks.ts`.)

2. **Update the stale comment at line 12–13** ("Phase 7 Stage 2 — TD-062 fix: Personal Info / IDV now validate ...") if any of its specifics no longer apply. The implementer should rewrite the IDV reference to note that IDV now flows through the same grouping as edu/emp.

3. **No other change to this file.** `validateIdvSection` itself is in `personalInfoIdvFieldChecks.ts` (handled in §5.7).

### 5.7 `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` — change the IDV filter, update stale comments (read in full)

**Current state:**
- Line 325: `if (ps.service.functionalityType === 'idv') { idvServiceIds.push(ps.service.id); }`
- Lines 536–553 (comment block above `validateIdvSection`): says "Reads from `sectionsData['idv']` (NOT `service_idv` — TD-062 bug fix). When the country is missing ..." and "The engine continues to refer to the IDV section as `service_idv` for SectionValidationResult.sectionId."

**Changes:**

1. **Line 325:** change `'idv'` to `'verification-idv'`:
   ```typescript
   if (ps.service.functionalityType === 'verification-idv') {
     idvServiceIds.push(ps.service.id);
   }
   ```

2. **Comment at lines 536–553:** update wording. The engine now refers to the IDV section as `service_verification-idv` (not `service_idv`), so the comment becomes stale. Implementer rewrites to reflect the post-rename state. **The save-bucket key `'idv'` reference stays — BR 8.** Suggested update:
   - "Reads from `sectionsData['idv']` (NOT `service_verification-idv` — BR 8: save-route bucket key is a separate namespace from the functionality-type rename)."
   - "The engine refers to the IDV section as `service_verification-idv` for SectionValidationResult.sectionId, matching the structure endpoint's emitted section id."

3. **Line 568 (`readIdvCountryId`)**: reads `requirementId === IDV_COUNTRY_MARKER` — **NO CHANGE**, BR 8.

4. **`IDV_COUNTRY_MARKER = 'idv_country'` (line 123)**: **NO CHANGE** — BR 8 (synthetic marker constant).

### 5.8 `src/lib/candidate/submission/submitApplication.ts` — change the IDV filter, update stale comment (read in full)

**Current state:**
- Line 169–171: comment `// The IdvSection saves under sectionId='idv' (NOT 'service_idv') — see ...`; then `const section = formData.sections?.['idv'];` — **all unchanged (BR 8).**
- Line 348: `.filter((ps) => ps.service?.functionalityType === 'idv')` — **CHANGE.**
- Line 361: `buildIdvOrderItemKeys(idvServiceIds, idvCountryId)` — no change, the function itself is unaffected.

**Changes:**

1. **Line 348:** change `'idv'` to `'verification-idv'`.

### 5.9 `src/lib/candidate/submission/types.ts` — UNCHANGED (read in full)

The `OrderItemSource.kind: 'idv'` (line 23) is a **provenance discriminator**, not a functionality type. BR 8 / Decision 5 explicitly pin this. **NO CHANGE.**

### 5.10 `src/lib/candidate/submission/orderDataPopulation.ts` — UNCHANGED (read in full)

- Line 66 `IDV_COUNTRY_MARKER = 'idv_country'` — UNCHANGED, synthetic marker (BR 8).
- Line 220 `case 'idv':` — UNCHANGED, matches the unchanged `OrderItemSource.kind: 'idv'` discriminator (BR 8 / Decision 5).
- Line 176 docblock `idv — section.fields, EXCLUDING the idv_country marker` — UNCHANGED (the discriminator and marker both stay).

### 5.11 `src/lib/candidate/submission/orderItemGeneration.ts` — UNCHANGED (read at lines 400–447)

- Line 444 `source: { kind: 'idv', ... }` — UNCHANGED (matches discriminator).
- Function name `buildIdvOrderItemKeys` — UNCHANGED (component-name cosmetics; BR 8).

### 5.12 `src/components/candidate/portal-layout.tsx` — dispatch literal change (read in full)

**Current state (line 687):**
```typescript
if (section.type === 'service_section' && section.functionalityType === 'idv') {
```

**Changes:**

1. **Line 687:** change `'idv'` to `'verification-idv'`.

**File-size note:** this file is 841 lines (already over 600). The change is a one-character-equivalent literal-string replacement — no NEW lines added. **The implementer must verify Andy is OK with editing this file under the file-size rule before proceeding.** See §13 Risk #5.

### 5.13 `src/components/candidate/form-engine/IdvSection.tsx` — UNCHANGED save-route literals (read in full)

- Line 162: `field.requirementId === 'idv_country'` — UNCHANGED (synthetic marker).
- Line 356: `requirementId: 'idv_country'` — UNCHANGED (synthetic marker write).
- Line 367: `sectionType: 'idv'` — UNCHANGED (save-route bucket key, BR 8).
- Line 368: `sectionId: 'idv'` — UNCHANGED (save payload, BR 8).
- Line 393: `sectionId: 'idv'` — UNCHANGED (logger metadata, BR 8).
- Line 213–214: `/fields?serviceIds=${...}&countryId=${countryId}` request — UNCHANGED, already uses TD-084's package-aware request shape; verification-idv inherits OR-merge automatically.

### 5.14 `src/components/modules/global-config/tabs/services-tab.tsx` — admin dropdown source + display title switch (read at lines 40–125 and 200–315)

**Current state:**
- Line 51: `useState<string[]>(['record', 'verification-edu', 'verification-emp', 'other', 'idv'])`
- Lines 100–110: response-merge logic that appends API-returned types to the local list.
- Lines 236–243: `getDisplayTitle` switch has no `idv` case (falls through to "Other").

**Changes:**

1. **Line 51:** replace hardcoded array with import from `@/constants/functionality-types`:
   ```typescript
   import { FUNCTIONALITY_TYPES } from '@/constants/functionality-types';
   // ...
   const [functionalityTypes, setFunctionalityTypes] = useState<string[]>(
     [...FUNCTIONALITY_TYPES],
   );
   ```
   (Spread because `FUNCTIONALITY_TYPES` is `readonly` and `useState` expects mutable.)

2. **Lines 100–110 (response merge):** the merge logic that appends API-returned types is now redundant — both client and API import from the same constants. The implementer **may simplify the block to a no-op**, but to keep the PR minimal, leave it as-is (it's defensive and harmless). If it surfaces unused-variable warnings after `VALID_FUNCTIONALITY_TYPES` is removed from the GET response shape, simplify; otherwise leave.

3. **`getDisplayTitle` (lines 237–243):** add a case for `verification-idv`:
   ```typescript
   case 'verification-idv': return 'Verification - Identity';
   ```
   (Display label is cosmetic — Andy's call. Suggested wording matches the pattern of "Verification - Education" / "Verification - Employment".)

### 5.15 `src/components/modules/customer/package-dialog.tsx` — exclude verification-idv from scope gating (read at lines 260–310 and 480–510)

**Current state:**
- Line 280: missing-scope check `service.functionalityType.startsWith('verification') && !svc.scope`
- Line 495: scope-selector visibility `service.functionalityType.startsWith('verification')`

**Changes:**

1. **Line 280:** narrow the missing-scope filter to exclude `verification-idv`:
   ```typescript
   if (
     service.functionalityType.startsWith('verification') &&
     service.functionalityType !== 'verification-idv' &&
     !svc.scope
   ) {
     return true;
   }
   ```

2. **Line 495 (scope-selector visibility):** same exclusion:
   ```typescript
   {selectedServiceIds.includes(service.id) &&
    service.functionalityType.startsWith('verification') &&
    service.functionalityType !== 'verification-idv' && (
     <div className="ml-6 border-l-2 border-gray-200 pl-4">
       <ScopeSelector ... />
     </div>
   )}
   ```

3. **`handleServiceToggle` (find by reading the function — it lives upstream of line 280) and the `useEffect` at lines 247–263 that builds the `services` form value:** when a `verification-idv` service is toggled on, its scope must be auto-set to `{type:'count_exact',quantity:1}` so the POST body to `/api/customers/[id]/packages` carries the correct shape (BR 5). The implementer reads the file in full first, then identifies the cleanest place to apply the auto-set:
   - **Recommended approach:** add a `getDefaultScopeFor(functionalityType: string): ScopeValue | null` helper near the top of the file; for `verification-idv` return `{type:'count_exact', quantity:1}`; for everything else return `null` (matching today's behavior).
   - In `handleServiceToggle` (or in the `useEffect` at 247–263 that maps `selectedServiceIds + scopes` into `services`), apply this default when `verification-idv` is selected.

**Out of scope:** the existing line-238 `service.functionalityType === 'verification'` bug at `src/app/api/customers/[id]/packages/route.ts:238` and `src/app/api/packages/[id]/route.ts:232` — those are PRE-EXISTING tech debt referenced in the BA spec §10 / Out of Scope #6 and are not addressed in this PR.

### 5.16 `src/components/modules/customer/package-dialog-new.tsx` — same change as 5.15 (read at lines 580–610)

**Current state (line 600):** identical pattern to package-dialog.tsx:495.

**Changes:**

1. **Line 600:** same exclusion as §5.15 step 2. Add `service.functionalityType !== 'verification-idv'` to the condition.

2. **Same scope-auto-set logic as §5.15 step 3.** Read the full file (632 lines, OVER the 600 hard-stop) before adding any new lines; this PR adds at most a `getDefaultScopeFor` helper and applies it in one place. **The implementer must confirm with Andy before touching this file** per CODING_STANDARDS §9 (file-size hard stop rule).

**File-size note:** this file is 632 lines. The change adds ~5–10 lines of helper + one-line application. **Decision-point flag — see §13 Risks #5.**

### 5.17 `src/components/modules/customer/customer-packages.tsx` — display-name switch (read at lines 230–308)

**Current state (lines 295–308):** `formatFunctionalityType` switch has no IDV case.

**Changes:**

1. **Add `case 'verification-idv': return 'Identity Verification';`** to the switch.

### 5.18 `src/types/candidate-address.ts` — JSDoc comment (read at lines 95–115)

**Current state (line 102):** comment lists `'idv'` in `serviceTypeOrder`.

**Changes:**

1. **Line 102:** replace `'idv'` with `'verification-idv'` in the doc comment.

### 5.19 `docs/DATA_DICTIONARY.md` — line 133

**Current state:** `functionalityType (String, required): Type of service functionality (valid values: record, verification-edu, verification-emp, other, idv)`

**Changes:**

1. **Replace `idv` with `verification-idv`** so the line reads: `valid values: record, verification-edu, verification-emp, verification-idv, other`. Match the order used in the new constants module.

### 5.20 Test file updates

See §10. Listed in this section for completeness, but treated as a single concern.

---

## 6. API routes — contract summary

After the rename, the affected routes' contracts are:

### `POST /api/services`
- **Permission:** authenticated; further admin-level scoping is pre-existing (no change).
- **Body:** `{ name, category, description?, functionalityType }`.
- **Validation:** `functionalityType` MUST be one of `verification-idv`, `record`, `verification-edu`, `verification-emp`, `other`. Reject with 400 `{ error: 'Unknown functionality type' }` otherwise.
- **Success:** 201, returns the created Service.
- **Errors:** 400 (missing fields, unknown functionality type), 401, 500.

### `PUT /api/services/[id]`
- **Permission:** authenticated.
- **Body:** `{ name, category, description?, functionalityType }`.
- **Validation:** same allow-list; same 400 on unknown.
- **Success:** 200.
- **Errors:** 400, 401, 404, 500.

### `PATCH /api/services/[id]` (partial update path, not the `toggleDisabled` action)
- **Body:** `{ name?, category?, description?, functionalityType? }`.
- **Validation:** when `functionalityType` is present, it MUST be in the allow-list. Reject with 400 otherwise.
- **Success:** 200.
- **Errors:** 400, 401, 404, 500.

### `GET /api/services`
- **Response:** `{ services, totalCount, totalPages, currentPage, categories, functionalityTypes }`. The `functionalityTypes` array is now `FUNCTIONALITY_TYPES` from the constants module — i.e., `['verification-idv','record','verification-edu','verification-emp','other']` (note: `idv` no longer present).

### `GET /api/candidate/application/[token]/structure`
- **Response unchanged in shape.** Affected fields:
  - `sections[N].id === 'service_verification-idv'` for the IDV section (was `'service_idv'`).
  - `sections[N].functionalityType === 'verification-idv'` for the IDV section (was `'idv'`).
  - IDV section now carries a `scope: { scopeType: 'count_exact', scopeValue: 1, scopeDescriptionKey, scopeDescriptionPlaceholders }` block (was no `scope` block).
  - IDV is still first in service-section ordering.

### `GET /api/candidate/application/[token]/fields`
- **No code change in this PR.** TD-084 already made the route package-aware; verification-idv requests use the same `serviceIds[]&countryId=` shape. The OR-merge of `isRequired` across `(serviceId, countryId)` pairs applies automatically.

### `POST /api/candidate/application/[token]/save`
- **No code change.** The `sectionType: 'idv'` enum value stays (BR 8).

### `GET /api/candidate/application/[token]/saved-data`
- **No code change.** The `sectionType === 'idv'` countryId-preservation branch at line 313 stays (BR 8).

### `GET /api/candidate/application/[token]/scope`
- **No code change.** The Zod enum at line 22 stays `['verification-edu','verification-emp','record']`. IDV does not use this endpoint because IDV has no scope-selection UI.

---

## 7. Zod schemas

No new Zod schemas. **One existing schema is implicitly affected via the constants import:**

- `/api/services/route.ts` and `/api/services/[id]/route.ts` now reference `isValidFunctionalityType` from the new constants module rather than building inline checks. There are no Zod schemas added; the validation is a plain `if (!isValidFunctionalityType(value))` check. (The route does not use Zod for functionalityType today, and switching to Zod for this one field would expand the surface unnecessarily.)

---

## 8. TypeScript types

### 8.1 New
- `FunctionalityType` — exported from `src/constants/functionality-types.ts`, derived from the `FUNCTIONALITY_TYPES as const` array.

### 8.2 Modified
- `ScopeFunctionalityType` in `src/lib/candidate/validation/packageScopeShape.ts` — adds `'verification-idv'` as a fourth union member.
- The `buildSectionScope` function signature in `structure/route.ts` widens accordingly.

### 8.3 Not modified (out of scope)
- `functionalityType: string` fields on `src/types/candidate-portal.ts`, `src/types/dsx.ts`, `src/types/service-order-data.ts`, `src/types/candidate-repeatable-form.ts`, `src/types/index.ts`. **Optional follow-up:** tighten these to `FunctionalityType`. Deferred to a follow-up TD (see §13 #7).

---

## 9. Order of implementation

The implementer follows this exact sequence. Each step is independent and the codebase compiles/runs after each.

1. **Create `src/constants/functionality-types.ts`** (§4.1). Plus its test file `src/constants/__tests__/functionality-types.test.ts` (see §10). At this point, nothing imports from the new module yet — the new file ships alongside its tests and is independently runnable.

2. **Update `src/lib/candidate/validation/packageScopeShape.ts`** (§5.4). Adds `verification-idv` to the type union and the defensive normalize branch. No downstream consumers fail because the existing 3-member usages stay valid.

3. **Update `src/lib/candidate/validation/loadValidationInputs.ts`** (§5.5). Adds `verification-idv` to the `servicesByType` grouping filter. At this point, `servicesByType.get('verification-idv')` returns IDV services when present, but no caller reads it yet — old `hasIdv` dispatch still works because the IDV service is still present in `orderedPackage.packageServices`.

4. **Update `src/lib/candidate/validation/validationEngine.ts`** (§5.6). Replaces the `hasIdv` block with the symmetric `servicesByType.has('verification-idv')` dispatch. Reads `idvSectionData: sectionsData['idv']` unchanged. Emits `sectionId: 'service_verification-idv'`.

5. **Update `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`** (§5.7). Filter line 325 + comment block updates.

6. **Update `src/lib/candidate/submission/submitApplication.ts`** (§5.8). Filter line 348.

7. **Update `src/app/api/candidate/application/[token]/structure/route.ts`** (§5.3). Section ordering, title map, scope-grouping filter, `buildSectionScope` widening.

8. **Update `src/app/api/services/route.ts`** (§5.1). Import from constants; replace silent-coerce with 400 reject.

9. **Update `src/app/api/services/[id]/route.ts`** (§5.2). PUT + PATCH validation.

10. **Update `src/components/modules/global-config/tabs/services-tab.tsx`** (§5.14). Admin dropdown source + display title.

11. **Update `src/components/modules/customer/package-dialog.tsx`** (§5.15). Scope gating + auto-default for `verification-idv`.

12. **Update `src/components/modules/customer/package-dialog-new.tsx`** (§5.16). Same change as 11. **Requires Andy's explicit OK on file-size override.**

13. **Update `src/components/modules/customer/customer-packages.tsx`** (§5.17). Display-name switch.

14. **Update `src/components/candidate/portal-layout.tsx`** (§5.12). Single-literal change at line 687. **Requires Andy's explicit OK on file-size override.**

15. **Update `src/types/candidate-address.ts`** (§5.18). JSDoc comment.

16. **Update `docs/DATA_DICTIONARY.md`** (§5.19). Documentation.

17. **Update tests** (§10). All listed test files are updated in a single coordinated step at the end so the test suite never has a window in which fixtures contradict source.

18. **Create the data migration directory + SQL** (§11). The migration is checked in as part of this same PR but executed in a different release phase — see §11 sequencing.

19. **Run `pnpm vitest run` and `pnpm typecheck`** and confirm green before opening the PR.

---

## 10. Test strategy hand-off

### 10.1 Test-writer-1 (schema, validation, E2E) — writes FIRST, BEFORE the implementer touches source

**New test file:** `src/constants/__tests__/functionality-types.test.ts`
- `FUNCTIONALITY_TYPES` contains exactly `['verification-idv','record','verification-edu','verification-emp','other']` in that order.
- `FUNCTIONALITY_TYPES` does NOT contain `'idv'`.
- `isValidFunctionalityType('verification-idv')` returns `true`.
- `isValidFunctionalityType('idv')` returns `false`.
- `isValidFunctionalityType('random-string')` returns `false`.
- `isValidFunctionalityType('')` returns `false`.

**Update:** `src/lib/candidate/validation/__tests__/validationEngine.test.ts` (lines 260–297, 345–369)
- Replace the three `functionalityType: 'idv'` fixture values with `'verification-idv'` (lines 271, 356).
- Replace `s.sectionId === 'service_idv'` with `s.sectionId === 'service_verification-idv'` (lines 280, 293).
- Update describe block titles where they say `'idv'` to clarify they're testing the verification-idv functionality.
- **Add a NEW test:** "emits IDV section result when a verification-idv service is present, with sectionId 'service_verification-idv'" — verifies the post-rename dispatch.
- **Add a NEW test:** "does NOT emit any section when a stale `functionalityType: 'idv'` service is in the package" — verifies the rename is exhaustive (stale data does not accidentally trigger the new dispatch).

**Update:** `src/lib/candidate/validation/__tests__/personalInfoIdvFieldChecks.test.ts` (lines 100–316)
- Replace every `functionalityType: 'idv'` with `'verification-idv'` (lines 118, 174, 227, 284).
- `IDV_COUNTRY_MARKER = 'idv_country'` related assertions and the `fieldData: { collectionTab: 'idv' }` metadata stay UNCHANGED (the `collectionTab` value is content, not a functionality type).

**Update:** `src/app/api/candidate/application/[token]/structure/__tests__/route.test.ts`
- Replace every fixture `functionalityType: 'idv'` with `'verification-idv'` (lines 94, 244, 366, 374, 507, 728).
- Replace every assertion `id: 'service_idv'` / `functionalityType: 'idv'` with the new values (lines 238, 244, 401, 542, 750).
- Add an assertion that the IDV section now carries the `scope: { scopeType:'count_exact', scopeValue:1, ... }` block.
- Add a regression test: when a stale package row has `functionalityType: 'idv'`, the structure endpoint does NOT emit an IDV section (the stale string is no longer a recognized functionality type). [This protects against the silent-pass regression Edge Case 5 in the spec.]

**Update:** `src/app/api/services/__tests__/route.test.ts` (266 lines, all test fixtures)
- **Add NEW tests** for the 400 behavior:
  - "rejects POST with `functionalityType: 'idv'` and returns 400 with 'Unknown functionality type'"
  - "rejects POST with `functionalityType: 'random-string'` and returns 400"
  - "accepts POST with `functionalityType: 'verification-idv'` and returns 201"
  - "GET response includes 'verification-idv' in functionalityTypes array and does NOT include 'idv'"

**New test file:** `src/app/api/services/[id]/__tests__/route.test.ts` (file does not exist today; check before creating — if it does, append; if not, create per the standard pattern in `src/app/api/services/__tests__/route.test.ts`).
- "PUT rejects `functionalityType: 'idv'` with 400"
- "PUT accepts `functionalityType: 'verification-idv'`"
- "PATCH with `functionalityType: 'idv'` returns 400"
- "PATCH with `functionalityType` absent does NOT 400 (partial update path)"

**Update:** `src/schemas/__tests__/address-history-stage3.test.ts` (line 750)
- Existing test: "should reject idv (not a scope-supporting functionality type per Stage 2 contract)"
- **Update the test name** to match the post-rename state and update the assertion: the schema rejects BOTH `'idv'` (now invalid for a different reason — it's not a known functionality type at all) AND `'verification-idv'` (also rejected because IDV does not have a `/scope` endpoint).
- Add a corresponding assertion that `'verification-idv'` is rejected.

**Update:** `src/app/api/candidate/application/[token]/fields/__tests__/route.test.ts` (line 1394)
- Fixture: `vi.mocked(prisma.service.findUnique).mockResolvedValueOnce({ functionalityType: 'idv' } as any);` — change to `'verification-idv'`.

### 10.2 Test-writer-2 (component, API route) — writes AFTER the implementer finishes source

**Update:** `src/components/candidate/portal-sidebar.test.tsx` (lines 29, 35, 102, 129, 257, 364, 372)
- Replace fixture `id: 'service_idv'`, `functionalityType: 'idv'`, and all `activeSection="service_idv"` / `expect(...).toHaveBeenCalledWith('service_idv')` with the renamed `'service_verification-idv'` / `'verification-idv'`.

**Update:** `src/components/candidate/portal-layout.test.tsx` (lines 206, 212)
- Same replacements.

**Update:** `src/app/candidate/[token]/portal/__tests__/page.test.tsx` (lines 89, 95)
- Same replacements (`id: 'service_idv'` → `'service_verification-idv'`; `functionalityType: 'idv'` → `'verification-idv'`).

**Update:** `src/components/candidate/form-engine/__tests__/IdvSection.test.tsx`
- **NO functionality-type literals in this file** (the test fixtures use `serviceIds: string[]` and the section never branches on functionalityType). The `collectionTab: 'idv'` values at lines 90/103/368/1388 are FIELDDATA content (a save-tab marker, not a functionality type) — **DO NOT TOUCH** these.
- `expect(body.sectionType).toBe('idv')` at line 774 — **DO NOT TOUCH** (BR 8, save-route bucket key).

**Update:** `src/app/api/candidate/application/[token]/saved-data/__tests__/route.test.ts` (line 339)
- The fixture key `'service_idv'` is a section-id rollup test (it tests that both `service_idv` and `service_record` fall through to the `service_section` bucket). **Update this key to `'service_verification-idv'`** to match the new section-id convention.
- The other `'idv'` references in this file (lines 56, 459, 527 — save-route `type: 'idv'` bucket key shape) **stay unchanged** (BR 8).

**Update:** `src/app/api/candidate/application/[token]/saved-data/__tests__/repeatable-entries.test.ts` (lines 429, 488)
- These are save-route `type: 'idv'` bucket assertions. **DO NOT TOUCH** (BR 8).

**Update:** `src/app/api/candidate/application/[token]/save/__tests__/route.test.ts` (8 hits)
- All `sectionType: 'idv'` / `sectionId: 'idv'` / `formData.sections.idv` references are save-route bucket-key contract assertions. **DO NOT TOUCH** (BR 8).

**Tests NOT modified (intentional):**
- `src/lib/candidate/__tests__/sectionVisitTracking.test.ts:290` — `shouldShowErrorsForSection('idv', ...)`. The hook takes any string as a section id; the test asserts Rule 34 generic behavior. The literal `'idv'` is an arbitrary section-id string for this test — leaving it is fine.
- `src/lib/candidate/__tests__/usePortalValidation.test.tsx:416` — same reasoning.

### 10.3 New E2E / integration test (test-writer-1 owns; runs against the dev DB after the data migration is applied)

**New test file:** `src/__tests__/integration/verification-idv-conversion.test.ts` (lives alongside `education-verification-infinite-loop.test.tsx`).

**Scenarios:**
1. A package containing one `verification-idv` service produces a structure-endpoint response with `id: 'service_verification-idv'`, `functionalityType: 'verification-idv'`, and `scope.scopeType === 'count_exact'`.
2. The validation engine emits a `SectionValidationResult` with `sectionId: 'service_verification-idv'` for that package.
3. `POST /api/services` with `functionalityType: 'idv'` returns 400.
4. `POST /api/services` with `functionalityType: 'verification-idv'` returns 201.
5. The candidate flow: save with `sectionType: 'idv'` (BR 8), submit, verify the resulting OrderItem has the right service and locationId. (This last item exercises the save/submit bridge that does NOT change — useful regression coverage.)

---

## 11. Database migration plan

### 11.1 Migration file (data only — no schema change)

**Path:** `prisma/migrations/<YYYYMMDDHHMMSS>_rename_idv_functionality_type/migration.sql`

**Naming convention:** descriptive snake_case after the timestamp. Per DATABASE_STANDARDS §3.2.

**Contents** (verbatim from BA spec §Migration Concerns, with the DATABASE_STANDARDS §4.2 template applied):

```sql
-- /GlobalRX_v2/prisma/migrations/<YYYYMMDDHHMMSS>_rename_idv_functionality_type/migration.sql
--
-- Business requirement: convert Service.functionalityType 'idv' →
-- 'verification-idv' per docs/specs/verification-idv-conversion.md, and
-- normalize package_services.scope for those services to the
-- count_exact:1 shape.
-- Data integrity goal: align services.functionalityType with the new
-- allow-list (post-this-PR the API rejects 'idv' with 400; the
-- production row MUST be migrated FIRST). Normalize package_services.scope
-- defensively so the new normalizeRawScope branch and the validator agree.
-- Safe to run multiple times (idempotent).

DO $$
BEGIN
  RAISE NOTICE 'Starting rename_idv_functionality_type...';
END $$;

-- Step 1: rename services.functionalityType
DO $$
DECLARE
  services_renamed INT;
BEGIN
  UPDATE services
     SET "functionalityType" = 'verification-idv',
         "updatedAt" = NOW()
   WHERE "functionalityType" = 'idv';
  GET DIAGNOSTICS services_renamed = ROW_COUNT;
  RAISE NOTICE 'Renamed % services rows from idv to verification-idv', services_renamed;
END $$;

-- Step 2: normalize package_services.scope for verification-idv rows.
-- Idempotency guard: only update rows whose scope is not already the
-- correct count_exact:1 shape.
DO $$
DECLARE
  scopes_normalized INT;
BEGIN
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
END $$;

-- Step 3: verification — abort if any 'idv' rows remain
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM services WHERE "functionalityType" = 'idv') THEN
    RAISE EXCEPTION 'Migration verification failed: services rows with functionalityType=idv still exist';
  END IF;
  RAISE NOTICE 'Verification passed: zero services rows with functionalityType=idv';
END $$;

DO $$
BEGIN
  RAISE NOTICE 'rename_idv_functionality_type completed successfully';
END $$;
```

### 11.2 Migration sequencing — load-bearing

Per BR 3 / Decision 3 / DoD 6, **the data migration MUST run BEFORE the API rejection takes effect.** Two viable strategies:

**Strategy A (recommended): one PR, two deploys.**
1. PR contains both the code changes and the migration file.
2. **Deploy 1 (staging):** apply the migration first (`pnpm prisma migrate deploy`), then verify by inspecting the row at `8388bb60-48e4-4781-a867-7c86b51be776`. Then deploy the code. Run the integration test suite end-to-end against staging.
3. **Deploy 2 (production):** same sequence — migration first, then code. The migration is idempotent, so re-running it is safe.

**Strategy B (split into two PRs):**
- PR 1: just the data migration. Deploy, verify in production, then…
- PR 2: the code changes (constants module + 400-reject + rename). Deploy.

**Architect recommendation: Strategy A.** Idempotency + the strict pre-deploy verification step makes it safe, and shipping the rename plus the migration together keeps the PR history clean. **Andy makes the final call before the implementer opens the PR.**

### 11.3 Staging verification checklist (architect-mandated, runs before production deploy)

1. After applying the migration to staging DB, run:
   ```sql
   SELECT COUNT(*) FROM services WHERE "functionalityType" = 'idv';
   -- expect: 0
   SELECT COUNT(*) FROM services WHERE "functionalityType" = 'verification-idv';
   -- expect: 1 (or more if staging has test data)
   SELECT id, "functionalityType" FROM services WHERE id = '8388bb60-48e4-4781-a867-7c86b51be776';
   -- expect: 'verification-idv'
   ```

2. Run the integration test suite from §10.3.

3. Hit the admin Services UI and confirm:
   - The dropdown shows `verification-idv` (or its localized label).
   - Saving a service with `verification-idv` returns 201.
   - A stale curl with `"functionalityType":"idv"` returns 400.

4. Hit the candidate portal for an invitation whose package contains the verification-idv service and confirm:
   - The Identity Verification section renders.
   - Country selection + field load works (TD-084 OR-merge intact).
   - Save on blur succeeds.
   - Submit creates an OrderItem with the right `serviceId` and `locationId`.

---

## 12. Translation keys

**No new translation keys.** The existing `candidate.portal.sections.identityVerification` key is reused (BR per §5.3 step 4). All other UI labels affected by this rename are admin-side English literals or come from existing locale files.

**Out-of-scope follow-up:** the admin-side display labels in `services-tab.tsx getDisplayTitle` and `customer-packages.tsx formatFunctionalityType` are hardcoded English (pre-existing tech debt — these are not translated). Not addressed here.

---

## 13. Risks and considerations

### Risk 1: In-flight `CandidateInvitation.formData` payloads
- **What could go wrong:** the renamed `service_verification-idv` section id appears in the sidebar's `sectionsWithStatus` map. If any candidate is mid-application when the deploy happens, their `formData.sectionVisits` map contains a `'service_idv'` key from a prior session. After deploy, that key no longer matches what the structure endpoint emits, so the "visited" flag is lost.
- **Mitigation:** the `formData.sections['idv']` bucket key is UNCHANGED (BR 8) so saved field values are preserved. Only the per-section *visit* record key for the IDV section changes. **Impact:** the candidate sees "not visited" until they visit the IDV section once. They lose no data; at worst, the section's error visibility is suppressed for one extra navigation cycle. **Acceptable.**
- **Action:** add a one-time data-migration note to the release notes (or have the implementer handle it as a no-op — visit records auto-heal as candidates navigate).

### Risk 2: Stale package configurations with `package_services.scope` containing edu/emp-style shapes for IDV services
- **What could go wrong:** an admin previously saved a verification-idv (formerly `idv`) service in a package with a stray `{type:'most-recent',quantity:3}` scope.
- **Mitigation:** the migration normalizes those rows defensively (§11 step 2), and the new `normalizeRawScope` IDV branch (§5.4 step 2) returns `count_exact:1` regardless of stored shape. Doubly safe.

### Risk 3: The silent-coerce-to-`"other"` bug masking other broken services
- **What could go wrong:** before this rename, the API silently coerced any unknown `functionalityType` to `"other"`. After this PR, the API returns 400 instead. If admin tooling or seed scripts have been *relying* on the silent coercion (e.g., posting `functionalityType: 'idv'` knowing it would get rewritten to `"other"`), those callers now break.
- **Mitigation:** the architect grepped the codebase for any test or seed that exploits the silent coercion. **No such usages found.** The only known broken caller is the admin Services UI dropdown, which is being fixed as part of this same PR.
- **Action:** flag in the PR description that the silent-coerce behavior is being removed; QA should also try posting `"random-string"` to confirm 400 instead of 201-with-"other".

### Risk 4: The pre-existing `service.functionalityType === 'verification'` dead-string bug
- **What could go wrong:** `src/app/api/customers/[id]/packages/route.ts:238` and `src/app/api/packages/[id]/route.ts:232` reference `'verification'` (no suffix) — a string that never matches anything. This is pre-existing tech debt explicitly out of scope (BA spec §10 / Out of Scope #6).
- **Mitigation:** this PR doesn't change those lines and doesn't make the bug worse. **Andy should open a separate TD for it** — flag in the PR description.

### Risk 5: File-size hard stop on `portal-layout.tsx` (841 lines) and `package-dialog-new.tsx` (632 lines)
- **What could go wrong:** CODING_STANDARDS §9 mandates a hard stop at 600 lines unless Andy approves. The implementer cannot edit either file without explicit Andy approval.
- **Mitigation options for the implementer:**
  - **Option A (recommended):** request Andy's explicit OK to edit both files for the minimal one-line change. The change is a string-literal swap — no new content, no logic addition. Spirit of the rule preserved.
  - **Option B (heavyweight):** extract the relevant chunk into a new helper file (e.g., `src/components/candidate/portal-layout-section-dispatch.ts`). Adds two new files and lots of test surface; not proportional to the change.
- **Architect recommendation: Option A** with explicit Andy sign-off. Flag this in the implementer's PR description as a deliberate small-edit-over-large-file override.

### Risk 6: Package builder UI sends `scope: null` for verification-idv if the implementer misses §5.15/§5.16 step 3
- **What could go wrong:** if the package-dialog auto-default isn't applied, saving a package with a verification-idv service produces a `package_services` row with `scope = null`. The new `normalizeRawScope` verification-idv branch covers this defensively (it returns `count_exact:1` regardless), so validation works correctly — but the persisted shape doesn't match BR 5.
- **Mitigation:** test-writer-2's UI tests for package-dialog should include "saves verification-idv with scope `{type:'count_exact',quantity:1}` even when the admin doesn't see a scope selector." Add this to §10.2.

### Risk 7: TypeScript widening of `functionalityType: string` fields
- Not strictly a risk; just a deferred improvement. Listed for awareness in §8.3.

---

## 14. Out-of-scope reaffirmation (from BA spec)

This PR does NOT:
1. Rename the save-route `sectionType: 'idv'` enum value.
2. Rename the `idv_country` synthetic marker constant or any `formData.sections['idv']` lookups.
3. Rename the `OrderItemSource.kind: 'idv'` discriminator or the matching `case 'idv':` branch in `orderDataPopulation.ts`.
4. Re-skin or redesign the IDV section UI in the candidate portal.
5. Introduce a third-party IDV provider integration.
6. Fix the pre-existing dead-string bug at `src/app/api/customers/[id]/packages/route.ts:238` (or its sibling at `src/app/api/packages/[id]/route.ts:232`).
7. Add scope/count UI for verification-idv.
8. Migrate any in-flight `CandidateInvitation.formData` payloads.
9. Tighten the `functionalityType: string` fields in `src/types/**` to the new `FunctionalityType` union. (Optional follow-up.)
10. Refactor the `customers-packages-fixed.tsx` and `customer-packages.tsx` (display-only) scope-formatting switches to add a verification-idv branch. Both fall through to a sensible "Standard" display; cosmetic improvement only.

---

## 15. Plan Completeness Check

- [x] Every file the implementer will need to touch is listed in §4–§5 and §10
- [x] No file outside this plan will need to be modified
- [x] All new types (`FunctionalityType`, extended `ScopeFunctionalityType`) are listed in §8
- [x] All test files are listed in §10
- [x] All API routes touched are described in §6
- [x] The data migration is fully specified in §11 with sequencing
- [x] UI grep was performed and reported in §2
- [x] The plan is consistent with the spec's Data Requirements table — `functionalityType` allowed values, `package_services.scope` for verification-idv, and the three unchanged save-route / synthetic-marker / provenance fields all match BR 1–8 / BR 14–15 / Decisions 1–7.
- [x] File-size override risks are flagged for Andy at §13 Risk #5

---

## 16. PR description scaffold (for the implementer)

Suggested PR title: `verification-idv: convert idv → verification-idv functionality type (BR 1–15)`

PR body should include:
- Link to the BA spec.
- Highlight that the data migration runs first; staging verification is mandatory (§11.3).
- Flag the file-size overrides at portal-layout.tsx and package-dialog-new.tsx (§13 #5) and confirm Andy approved.
- Flag the pre-existing `'verification'` dead-string bug as out of scope (§13 #4).
- List the three things INTENTIONALLY not renamed (save-route enum, IDV_COUNTRY_MARKER, OrderItemSource.kind), per BR 8.

