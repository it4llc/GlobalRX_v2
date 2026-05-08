# Phase 7 Stage 2 Data-Flow Audit

**Scope:** Catalog every data-key / shape mismatch across Save → Hydrate → Validate → Submit for the 5 candidate application sections.
**Investigator:** read-only bug investigator
**Date:** 2026-05-07
**Branch:** `feature/phase7-stage2-submission-order-generation`

---

## 1. Executive summary

| Section | Blockers | Cosmetic | Notes |
|---|---|---|---|
| Personal Info | 0 | 0 | All four paths align on `'personal_info'`. |
| IDV | 0 | 1 | Stale per-country snapshot in client state. |
| Address History | 0 | 1 | Status-derivation reads visits by save-id, but engine returns `address_history` for both data and result — works correctly. TD-069 (open) not counted as a path mismatch. |
| Education | **1 BLOCKER** | 0 | Submission reads `formData.sections['service_verification-edu']` — section is saved under `'education'`. |
| Employment | **1 BLOCKER** | 0 | Same as Education with `'service_verification-emp'` vs `'employment'`. |

**Net:** 2 blockers (BL-01, BL-02). Both are in `submitApplication.ts:291–292` and have an identical fix shape but they are physically separate string literals so the duplicate-pattern check is mandatory.

There is also a **major correctness gap** (TD-069, already logged) where Address History / Education / Employment validate as `complete` even when required entry fields are empty. That is a *validation completeness* problem rather than a data-flow mismatch, but it falls within the scope of this audit and is documented in §5.

---

## 2. Per-section path tables

### Section keys used at every layer

| Layer | Personal Info | IDV | Address History | Education | Employment |
|---|---|---|---|---|---|
| Save body `sectionType` | `personal_info` | `idv` | `address_history` | `education` | `employment` |
| Save body `sectionId` | `personal_info` | `idv` | `address_history` | `education` | `employment` |
| Stored under `formData.sections[<sectionId>]` | `personal_info` | `idv` | `address_history` | `education` | `employment` |
| Stored `data.type` | `personal_info` | `idv` | `address_history` | `education` | `employment` |
| `/saved-data` response key (re-keyed by `data.type`) | `personal_info` | `idv` | `address_history` | `education` | `employment` |
| Hydration key in component | `personal_info` | `idv` | `address_history` | `education` | `employment` |
| Validation engine **data** read key | `personal_info` ✅ | `idv` ✅ | `address_history` ✅ | `education` ✅ | `employment` ✅ |
| Validation engine **result** `sectionId` | `personal_info` | `service_idv` | `address_history` | `service_verification-edu` | `service_verification-emp` |
| Sidebar / structure section.id | `personal_info` | `service_idv` | `address_history` | `service_verification-edu` | `service_verification-emp` |
| `sectionVisits` key (set by sidebar click) | `personal_info` | `service_idv` | `address_history` | `service_verification-edu` | `service_verification-emp` |
| Submission **data** read key | `personal_info` ✅ | `idv` ✅ | `address_history` ✅ | **`service_verification-edu` ❌** | **`service_verification-emp` ❌** |

The intentional split is: **data is always keyed by save-`sectionId` (lowercase, e.g. `education`)**; **result/sidebar/visits use `service_<funcType>` for IDV/Edu/Emp**. The engine handles the split correctly. The submission service is the only code path that gets it wrong.

### 2.1 Personal Info — populates `Order.subject`

| Path | Reference | Key / shape | Match |
|---|---|---|---|
| Save | `src/app/api/candidate/application/[token]/save/route.ts:36, 569–606` | sectionType `'personal_info'`, sectionId `'personal_info'`, body shape `{ fields: [{ requirementId, value }] }` | — |
| Save filter | `save/route.ts:441–510` | Locked-field filter strips `firstName / lastName / email / phone / phoneNumber` before persisting | — |
| Hydrate | `src/components/candidate/portal-layout.tsx` (shell) → `PersonalInfoSection.tsx:116–133` | Shell calls `/saved-data`, reads `sections.personal_info.fields`; passes `initialSavedValues` into `PersonalInfoSection`. Locked fieldKeys are merged from invitation columns separately. | ✅ |
| Validate | `validationEngine.ts:289` reads `sectionsData['personal_info']`; `personalInfoIdvFieldChecks.ts:482–509` checks required fields | Result emitted with `sectionId: 'personal_info'` (line 288) | ✅ |
| Submit | `submitApplication.ts:122–129` reads `formData.sections['personal_info'].fields`; `buildOrderSubject.ts:115–149` writes to `Order.subject` keyed by DSX `fieldKey`. Locked fields seeded from invitation columns. | Saved values stored as-is — `Order.subject` is JSON, no FK constraints | ✅ |

**Verdict: clean.** Locked-field protection is layered (save filter + buildOrderSubject defense in depth).

### 2.2 IDV — produces an OrderItem; needs `locationId` from a `Country.id` UUID

| Path | Reference | Key / shape | Match |
|---|---|---|---|
| Save | `IdvSection.tsx:318–329` posts `sectionType:'idv'`, `sectionId:'idv'`. Country selection persists as a synthetic `{ requirementId: 'idv_country', value: <countryUUID> }` field row (lines 311–316). | Country UUID is a real `Country.id` (sourced from `/countries`). | — |
| Hydrate | `IdvSection.tsx:138–182` reads `savedData.sections?.idv?.fields`, scans for the `idv_country` marker (lines 159–168), restores selectedCountry. | ✅ Comment block at 150–157 explicitly documents the contract with the submission helper. | ✅ |
| Validate | `validationEngine.ts:308` passes `sectionsData['idv']` into `validateIdvSection`. `personalInfoIdvFieldChecks.ts:543–554` reads the `idv_country` marker. Result `sectionId: 'service_idv'` (line 305). | ✅ — comments reference the TD-062 fix that resolved the prior `service_idv` data-key mismatch. | ✅ |
| Submit | `submitApplication.ts:172` reads `formData.sections['idv']`; `readIdvCountryId` extracts `idv_country` value (lines 183–190). `buildIdvOrderItemKeys` uses it as `OrderItem.locationId` (`orderItemGeneration.ts:441–445`). | ✅ Real UUID flows end-to-end. | ✅ |

**Verdict: clean.** One **cosmetic** issue (CO-01 below).

### 2.3 Address History — produces multiple OrderItems; needs jurisdiction from each address

| Path | Reference | Key / shape | Match |
|---|---|---|---|
| Save | `AddressHistorySection.tsx:347–363` posts `sectionType:'address_history'`, `sectionId:'address_history'`, body `{ entries: [...], aggregatedFields: {...} }`. Each entry has top-level `countryId` (real Country UUID). Address-block field stores `{ street1, street2, city, state, county, postalCode, fromDate, toDate, isCurrent }`. `state` / `county` are UUIDs when the country has subdivisions, free-text strings otherwise. | `save/route.ts:535–553` | — |
| Hydrate | `AddressHistorySection.tsx:179–195` reads `savedData.sections?.address_history?.entries / .aggregatedFields`. | ✅ | ✅ |
| Validate | `validationEngine.ts:215` reads `sectionsData['address_history']`; result `sectionId:'address_history'`. Inferred address-block requirementId via fromDate/toDate/isCurrent heuristic. Time-based scope + gap detection use `extractAddressEntryDates` (`dateExtractors.ts:82–111`). | ✅ Result sectionId matches data sectionId. | ✅ |
| Submit | `submitApplication.ts:134–147` reads `formData.sections['address_history']`. `orderItemGeneration.ts:104–133` reads `entry.countryId` (entry top-level) AND `block.state` / `block.county` (or test-fixture's `stateId` / `countyId`) and walks `dSXAvailability` county → state → country. `OrderItem.locationId` is the resolved UUID. | ✅ All values are real `Country.id` UUIDs (or null for free-text subdivisions, in which case the walk falls through to the country level). | ✅ |

**Verdict: clean** for data-flow alignment. **TD-069 separately flags** that the validator does not check whether each address entry's required fields (street1/city/etc. inside the address_block JSON, plus `aggregatedFields` documents) are populated. See §5.

### 2.4 Education — produces OrderItems per (entry × edu service); locationId = `entry.countryId`

| Path | Reference | Key / shape | Match |
|---|---|---|---|
| Save | `EducationSection.tsx:374–388` posts `sectionType:'education'`, `sectionId:'education'`, body `{ entries: [{ entryId, countryId, entryOrder, fields }] }`. `entry.countryId` is real Country UUID (from `/countries`). | `save/route.ts:554–568` | — |
| Hydrate | `EducationSection.tsx:172–187` reads `savedData.sections?.education?.entries`. | ✅ | ✅ |
| Validate | `validationEngine.ts:230–238` passes `sectionsData['education']` into `validateEducationSection` BUT emits result with `sectionId: 'service_verification-edu'`. The data-key `'education'` matches the save sectionId; the result sectionId is the structure section.id used by the sidebar. Date extraction via `extractEmploymentEntryDates` keyed off requirement metadata. | ✅ Engine reads `'education'` correctly. | ✅ |
| Submit | **`submitApplication.ts:291`** — `readEduEmpSection(formData, 'service_verification-edu')`. **The bucket key passed in is wrong; it should be `'education'`.** The function returns `entries: []` because `formData.sections['service_verification-edu']` does not exist. → `buildEduEmpOrderItemKeys` returns `[]` → no edu OrderItems are created. | **❌ BLOCKER (BL-01)** | ❌ |

### 2.5 Employment — produces OrderItems per (entry × emp service); locationId = `entry.countryId`

| Path | Reference | Key / shape | Match |
|---|---|---|---|
| Save | `EmploymentSection.tsx:380–393` posts `sectionType:'employment'`, `sectionId:'employment'`. Same shape as Education. | `save/route.ts:554–568` | — |
| Hydrate | `EmploymentSection.tsx:179–194` reads `savedData.sections?.employment?.entries`. | ✅ | ✅ |
| Validate | `validationEngine.ts:249–257` passes `sectionsData['employment']` into `validateEmploymentSection`; result `sectionId: 'service_verification-emp'`. | ✅ Engine reads `'employment'` correctly. | ✅ |
| Submit | **`submitApplication.ts:292`** — `readEduEmpSection(formData, 'service_verification-emp')`. Same defect as Education. | **❌ BLOCKER (BL-02)** | ❌ |

---

## 3. Mismatch list (every blocker and cosmetic, with file:line)

### BL-01 — Submission reads Education from a key the section never writes
- **Files:** `src/lib/candidate/submission/submitApplication.ts:291`
- **Severity:** Blocker
- **Symptom:** Education entries are silently dropped at submit time. `buildEduEmpOrderItemKeys` is called with `entries: []`, so **zero education OrderItems are generated**, regardless of how many entries the candidate completed.
- **Cause:** The literal `'service_verification-edu'` is used as a `formData.sections` key. That string is the *result.sectionId* used by the sidebar; the *data key* is `'education'` (saved by `EducationSection.tsx:381`).
- **Detection difficulty:** High — validation passes (engine reads the right key), the candidate submits successfully, the order is created, no errors are logged. The failure is silent: the order has no edu items.
- **Risk to existing data:** Submitted orders with edu services prior to this fix have lost their edu OrderItems. Investigate whether any production submissions are affected — a recovery script can replay from the saved formData.
- **Comment block at `submitApplication.ts:170–171`** explicitly notes the analogous IDV gotcha (`'idv'` not `'service_idv'`) — the same warning was not applied to edu/emp.

### BL-02 — Submission reads Employment from a key the section never writes
- **Files:** `src/lib/candidate/submission/submitApplication.ts:292`
- **Severity:** Blocker
- **Symptom / Cause / Risk:** Identical to BL-01 with `'service_verification-emp'` vs `'employment'`.
- **Why both must be fixed in one pass:** The duplicate-pattern check (`grep -n "service_verification" src/lib/candidate/submission/`) returns exactly these two lines plus the validation engine's *result.sectionId* assignments (which are correct). A fix that updates only line 291 will leave employment broken.

### CO-01 — IDV stale per-country form-data leak
- **Files:** `src/components/candidate/form-engine/IdvSection.tsx:236–241, 268–272`
- **Severity:** Cosmetic
- **Description:** When the candidate switches IDV country, the previous country's per-field values are stashed under a synthetic `country_${countryId}` key in client `formData` state but the existing `formData[<requirementId>]` entries are NOT cleared. The next save (triggered by typing a new field for the new country) sends ALL `pendingSaves` requirementIds, including any pending entries from the previous country. Because the country selection itself is what determines which fields are valid, and the saved fields are referenced by requirementId, the most likely effect is that orphaned values persist in `formData.sections.idv.fields` until a new field with the same requirementId overwrites them. Submission's `readIdvSection` will include them in OrderData rows (orphaned text/value attached to the IDV OrderItem).
- **Impact:** OrderData rows for IDV may carry residual values from a country that's no longer selected. They will be attached to the *current* country's OrderItem.
- **Why "cosmetic":** Submission still produces an IDV OrderItem for the right country; the `locationId` FK is correct; the candidate is unlikely to switch countries mid-flow in production. Worth logging as tech debt rather than blocking the submission fix.

### CO-02 — Education / Employment date-extractor metadata-only path is fragile if metadata fetch fails
- **Files:** `src/lib/candidate/validation/dateExtractors.ts:165–252`, `validationEngine.ts:188–201` (metadata population)
- **Severity:** Cosmetic
- **Description:** The extractor's primary identification path uses `requirement.name` substring matching ("start", "end", "graduation", "current"). This is locale-dependent — a non-English package configuration would have to fall through to the camelCase alias-set fallback. The fallback uses `meta.fieldKey`; if both metadata and known aliases are missing, dates simply won't be detected and the section will validate as if it has no date data. No error is logged when this happens.
- **Impact:** A package whose DSX requirements have neither a recognized fieldKey alias nor an English name with "start"/"end"/"current"/"graduation" will silently bypass time-based scope and gap checks for edu/emp. The candidate could submit an out-of-scope entry without the engine flagging it.
- **Suggested follow-up:** Log a `warn` when an entry has fields but no role-identified start/end date.

---

## 4. Hardcoded / placeholder list

A grep across the candidate-application code paths for `TODO`, `placeholder`, `hardcoded`, `FIXME`, and stand-in country codes (`'US'`, `'CA'`, etc.) within affected files.

| Item | File:line | Risk |
|---|---|---|
| (none found) | — | — |

The previously-suspect IDV hardcoded countries list (`{ id: 'US', name: 'United States' }`, etc.) has been removed in the uncommitted change to `IdvSection.tsx:101–136` (the diff against HEAD shows it was replaced with a real fetch from `/api/candidate/application/[token]/countries`). Both `EducationSection.tsx:147–165`, `EmploymentSection.tsx:154–172`, `AddressHistorySection.tsx:162–173`, and now `IdvSection.tsx:108–135` all use the real `/countries` endpoint and surface a translated `candidate.portal.countriesLoadError` alert on failure rather than falling back to placeholders. Comments at each call site (e.g., `IdvSection.tsx:101–107`) explicitly explain that a non-UUID stand-in would be rejected at submission.

The `'idv_country'` literal in IDV is **not** a placeholder — it's an intentional synthetic field-row marker (documented at `submitApplication.ts:181`, `personalInfoIdvFieldChecks.ts:122–123`, and `orderDataPopulation.ts:65–66`).

The system comment template fallback chain in `submitApplication.ts:627–667` ("System" → "General" → create) is a runtime resolver, not a placeholder.

The `assignedVendorId: null` set in `submitApplication.ts:417` is intentional per `DATABASE_STANDARDS.md §2.2` and the comment at line 415–416 documents this.

**No production-impacting placeholder values found.**

---

## 5. Validation completeness matrix

For each section, what the validator currently checks vs what it should check per spec Rules 4–7 / 18.

| Section | Visit gating | Required-field check | Scope check | Gap check | Document check | Gap from spec? |
|---|---|---|---|---|---|---|
| Personal Info | ✅ Rule 27 (`deriveStatusWithErrors`) | ✅ TD-062 fix (`checkRequiredFields`) | ✅ Rule 18 — N/A | ✅ Rule 18 — N/A | Latent (no document errors emitted) | None |
| IDV | ✅ | ✅ TD-062 fix; emits `candidate.validation.idvCountryRequired` if country missing | ✅ Rule 18 — N/A | ✅ Rule 18 — N/A | Latent | None |
| Address History | ✅ | **❌ TD-069 — required entry fields (street1/city/state/postalCode inside `address_block`, and aggregated documents) NOT checked** | ✅ count + time-based | ✅ gap detection with tolerance | Partial (aggregated documents not enforced) | TD-069 |
| Education | ✅ | **❌ TD-069 — required entry fields (school/degree/dates) NOT checked** | ✅ count + time-based + degree (degree mapped to `'all'` per Plan §10.2 fallback) | ✅ Rule 20 — N/A | Partial | TD-069 |
| Employment | ✅ | **❌ TD-069 — required entry fields (employer/title/dates) NOT checked** | ✅ count + time-based | ✅ gap detection | Partial | TD-069 |

**Concrete consequence for submission:** A candidate can complete Education with a country but no school name, no degree, no dates — and the engine reports `complete`. Submission then produces an edu OrderItem (once BL-01 is fixed) whose OrderData rows are mostly empty. The vendor receives a useless work item. TD-069 must be fixed before Phase 7 ships, even though it's outside the "data-flow mismatch" framing of this audit.

**Address-block sub-field validation gap:** Even fixing TD-069 at the requirement level may not close the address block. The `address_block` field is one DSX requirement whose VALUE is a JSON object with sub-fields — `street1`, `city`, `state`, `postalCode`. The DSX requirement's `addressConfig` (in `fieldData`) marks each piece's required flag. The validator would need to descend into the JSON object and check each piece's required flag, not just whether the requirement has *any* value (TD-069's "Suggested fix" at `TECH_DEBT.md:1808` calls this out).

---

## 6. Cross-reference with TECH_DEBT.md

| TD | State | Relevance to this audit |
|---|---|---|
| TD-061 | Open (deferred) | Not data-flow; in-row error display deferred. |
| TD-062 | Resolved | Resolved the IDV `service_idv` data-key bug — the same family of bug as BL-01/BL-02 but in the validator. Confirms the engine knows the correct data keys; the regression slipped in the submission layer instead. |
| TD-063 | Open | Display formatting only. |
| TD-064 | Open | DRY only. |
| TD-065 | Open | File size; not data-flow. |
| TD-066 | Open | Translation; not data-flow. |
| TD-067 | Open | File size; not data-flow. |
| TD-068 | Open | Test typing only. |
| **TD-069** | **Open** | **Per-entry required-field check missing for Address History / Education / Employment.** Captured in §5 above. |

BL-01 and BL-02 are NEW findings — they should be added to TECH_DEBT.md (or fixed and resolved in the same pass) as e.g. TD-070 / TD-071, or merged into a single "submission edu/emp data-key mismatch" entry given they share a single fix.

---

## 7. What NOT to change (surgical-scope reminder for the implementer)

- **Do NOT rename the validation engine's result `sectionId` values** (`service_verification-edu`, `service_verification-emp`, `service_idv`). They are correctly used by the sidebar (`portal-layout.tsx:445–467`), the `sectionVisits` map keys, the Review page error nav (`ReviewSubmitPage.test.tsx`, `ReviewErrorListItem.tsx:27–30`), and the `SectionErrorBanner` (lines 37–40). Renaming them would cascade into many files.
- **Do NOT change the save endpoint's `sectionId` literals.** The save shape (`'education'` / `'employment'` / `'idv'` / `'personal_info'` / `'address_history'`) is already consumed by the validator and the saved-data endpoint. The submit layer is the only mismatch.
- **Do NOT remove the `'service_verification-edu'` literal from the validation engine** at lines 230 and 249 — those are intentional result.sectionId values, not data keys.
- **Do NOT touch `idv_country`** — it is the documented synthetic marker.
- **Do NOT introduce a new constants file** unless the implementer's plan explicitly calls for it; the surgical fix is two string-literal changes.

---

## 8. Suggested fix shape (for the implementer — not the fix itself)

Two-line change in `submitApplication.ts`:

- Line 291: change `'service_verification-edu'` → `'education'`.
- Line 292: change `'service_verification-emp'` → `'employment'`.

Both reads should match the engine's read keys (`validationEngine.ts:232, 251`). The duplicate-pattern check `grep -n "service_verification" src/lib/candidate/submission/` MUST return zero hits after the fix (the validation-engine result.sectionId references at lines 230 and 249 do not pattern-match because they are inside `sectionId:` assignments, not formData reads — but a stricter `grep "formData.*service_verification\|service_verification.*formData"` is the right verification).

A regression test must:
1. Fixture a `formData.sections.education.entries` with at least one entry that has a `countryId`.
2. Call `submitApplication` end-to-end (transactional test, not a unit test of `readEduEmpSection`).
3. Assert that an `OrderItem` row was created with the matching `serviceId` and `locationId`.
4. **MUST fail before the fix and pass after.** Labelled `// REGRESSION TEST: proves bug fix for submission edu/emp data-key mismatch (BL-01/BL-02)`.

The same test structure proves both BL-01 and BL-02 — the fixture only needs both edu and emp entries.

---

## 9. Risk of the proposed fix

- **Low.** The change is surgical (two string literals), the helper function `readEduEmpSection` is already parameterized on the bucket key, and the engine independently reads the correct keys so no other code path is affected. The transactional posture of `submitApplication` and its existing `AlreadySubmittedError` idempotency mean a botched fix would fail loudly via a transaction rollback, not silently corrupt data.

---

## Files referenced (absolute paths)

- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/save/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/saved-data/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/submit/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/countries/route.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/PersonalInfoSection.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/IdvSection.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressHistorySection.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/EducationSection.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/EmploymentSection.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/AddressBlockInput.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/form-engine/employmentDateFieldKeys.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/validationEngine.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/dateExtractors.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/submitApplication.ts` ← **fix target**
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/orderItemGeneration.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/orderDataPopulation.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/buildOrderSubject.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/src/lib/candidate/submission/types.ts`
- `/Users/andyhellman/Projects/GlobalRx_v2/docs/TECH_DEBT.md` (TD-069)
