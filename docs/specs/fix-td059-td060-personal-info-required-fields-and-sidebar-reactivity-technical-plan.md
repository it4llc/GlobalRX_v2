# Technical Plan: Fix TD-060 & TD-059 — Personal Info Required-Field Accuracy and Sidebar Reactivity

**Based on specification:** `docs/specs/fix-td059-td060-personal-info-required-fields-and-sidebar-reactivity.md` (created May 5, 2026)
**Date:** 2026-05-05
**Branch from:** `dev` (after Stage 4 PR merges)

---

## 1. Summary of Approach (Plain English)

Two related bugs are being fixed together because both touch the Personal Info experience and Phase 7 depends on accurate inputs from both.

- **TD-060** is a server-side accuracy fix in the `/personal-info-fields` endpoint. The endpoint currently asks "is this field required anywhere?" and returns `true` if any DSX mapping in the database (across every service and every country) has `isRequired = true`. We change it to "is this field required for THIS candidate's package and the locations its services are actually available in?" The response shape stays identical; only the value of `isRequired` per field changes. The audit confirms this same bug does NOT exist in the neighboring `saved-data` and `structure` endpoints (see Section 6).

- **TD-059** is a client-side reactivity fix in the candidate portal shell. Personal Info's progress (the sidebar indicator) is currently computed inside `PersonalInfoSection`, which only mounts when the candidate is on that tab. So when a candidate changes a country on Address History, the cross-section registry updates, but the sidebar indicator for Personal Info stays stale. We move the status derivation into `portal-layout.tsx` so it always runs whenever the registry changes, regardless of which tab is active. The shell fetches `/personal-info-fields` once on mount, reads Personal Info saved values from the saved-data response it already fetches, and runs `computePersonalInfoStatus` in a `useEffect` whose deps include the cross-section registry.

`computePersonalInfoStatus` itself is unchanged. The cross-section registry is unchanged. No database migration. No new endpoints. No response shape changes.

---

## 2. Database Changes

**No database changes. No Prisma schema edits. No migrations.**

This is a query-logic and component-architecture fix only.

Confirmation from reading `prisma/schema.prisma` (lines 59–260):
- `Country` (table `countries`) has a nullable `disabled Boolean?` field (line 71). Note: in the spec text this is referred to as `Location.disabled`. The `dsx_mappings` and `dsx_availability` tables both relate to `Country` via their `locationId` foreign key — that is the "Location" the spec refers to.
- `DSXMapping` (table `dsx_mappings`) has `serviceId`, `locationId`, `requirementId`, `isRequired Boolean`. Indexes already exist on `serviceId`, `locationId`, `requirementId`, plus a unique constraint on `(serviceId, locationId, requirementId)`. No additional indexes needed.
- `DSXAvailability` (table `dsx_availability`) has `serviceId`, `locationId`, `isAvailable Boolean`. Indexes already exist on both FK columns.
- `PackageService` (table `package_services`) has `packageId`, `serviceId`. Indexes already exist on both.

Because `Country.disabled` is nullable, the SQL/Prisma filter must use a `disabled IS NOT TRUE` semantic — i.e., include rows where `disabled = false` AND rows where `disabled IS NULL`. In Prisma, this is expressed as `NOT: { disabled: true }` (which excludes only rows whose `disabled` is exactly `true`).

---

## 3. Audit Result: saved-data and structure Routes

The spec mandates an audit of two neighboring files. I read both completely and ran a targeted grep for `isRequired`, `DSXMapping`, and `dsx_mappings`.

### 3.1 `src/app/api/candidate/application/[token]/saved-data/route.ts` — CLEAN

This file does **not** query `dsx_mappings` at all. It only reads `prisma.candidateInvitation.findUnique` (line 172) to fetch the saved `formData` JSON and reformats it for the client. There is no `isRequired` lookup, no DSX query, no field-definition logic. The bug pattern from TD-060 is **not present** in this file.

Verified by:
- `grep -n "isRequired\|DSXMapping\|dsx_mappings"` on the file → zero matches.
- Read the full file end-to-end (lines 1–334). The route only handles the saved-values shape transformation.

**Action:** No change required.

### 3.2 `src/app/api/candidate/application/[token]/structure/route.ts` — CLEAN

This file references `isRequired` in two places (lines 154 and 263), but in both cases the field comes from `WorkflowSection.isRequired` — a column on the `workflow_sections` table, NOT a `dsx_mappings` aggregation. The route emits the WorkflowSection's own `isRequired` flag verbatim into the `workflowSection` payload. There is no DSX mapping lookup, no field-level required computation, and no candidate-context aggregation in this file.

Verified by:
- `grep -n "isRequired\|DSXMapping\|dsx_mappings"` on the file → only matches at lines 43, 154, 263, all on `WorkflowSection.isRequired` (visible in `section.isRequired` where `section` is iterated from `orderedPackage.workflow.sections`).
- Read the full file end-to-end (lines 1–290). The structure endpoint never queries `dsx_mappings`.

**Action:** No change required.

### 3.3 Audit Conclusion

**The TD-060 bug pattern is unique to `personal-info-fields/route.ts`.** Neither `saved-data/route.ts` nor `structure/route.ts` performs an `isRequired` lookup against `dsx_mappings`. Spec Business Rule 5 is satisfied with no additional file modifications.

The implementer should NOT touch `saved-data/route.ts` or `structure/route.ts` for this fix.

---

## 4. New Files to Create

**None.** All changes are modifications to existing files. No new types, no new API routes, no new components.

A few rationales worth flagging for the implementer:
- `computePersonalInfoStatus` already exists in `src/lib/candidate/sectionProgress.ts` and per spec "What NOT to Change" must NOT be modified.
- The `SectionStatus`, `CrossSectionRequirementEntry`, and related types in `src/types/candidate-stage4.ts` already exist and are sufficient for the lifted state.
- The `FieldMetadata`, `FieldValue`, `SavedFieldData`, `CandidateFormData`, `FormSectionData` types in `src/types/candidate-portal.ts` already exist and are sufficient. No new types needed.

---

## 5. Existing Files to Modify

Every file listed below was read in full before writing this section.

### 5.1 `src/app/api/candidate/application/[token]/personal-info-fields/route.ts` — TD-060 PRIMARY FIX

**Read in full:** lines 1–241 (the entire file).

**What currently exists (the bug, lines 162–178):**
```ts
const personalInfoRequirementIds = Array.from(personalInfoFields.keys());

const dsxMappings = personalInfoRequirementIds.length > 0
  ? await prisma.dSXMapping.findMany({
      where: { requirementId: { in: personalInfoRequirementIds } },
      select: { requirementId: true, isRequired: true }
    })
  : [];

const requiredByRequirementId = new Map<string, boolean>();
for (const mapping of dsxMappings ?? []) {
  const existing = requiredByRequirementId.get(mapping.requirementId) ?? false;
  requiredByRequirementId.set(
    mapping.requirementId,
    existing || mapping.isRequired
  );
}
```

The query has no `serviceId` or `locationId` filter, and the aggregation uses OR semantics. This is exactly the bug TD-060 describes.

**What needs to change (Step 6.5 replacement):**

After the existing `personalInfoRequirementIds` array is computed (after line 162), the implementer must:

1. **Compute the package's serviceIds.** Already available — `serviceIds` is computed at line 98 from `invitation.package?.packageServices.map(ps => ps.service.id)`. Reuse it.

2. **Compute the set of valid `(serviceId, locationId)` pairs for this candidate's package.** Query `prisma.dSXAvailability.findMany` with:
   - `where: { serviceId: { in: serviceIds }, isAvailable: true, country: { NOT: { disabled: true } } }`
   - `select: { serviceId: true, locationId: true }`
   - Use Prisma's relation filter `country: { NOT: { disabled: true } }` to exclude globally disabled locations. Spec Edge Case 5 and Business Rule 4 require this. Because `Country.disabled` is nullable in the schema, `NOT: { disabled: true }` correctly includes both `disabled = false` rows and `disabled IS NULL` rows.

3. **Handle the empty-set guard.** If the resulting array is empty, treat all personal-info fields as `isRequired: false` and skip the mappings query (spec Edge Cases 1, 2). Per `API_STANDARDS.md` Section 7.2, do not skip the filter — explicitly produce an empty `requiredByRequirementId` map.

4. **Query `dsx_mappings` filtered to the (service, location) combinations from step 2 AND the personal-info requirement IDs.** Use a single query:
   ```
   prisma.dSXMapping.findMany({
     where: {
       requirementId: { in: personalInfoRequirementIds },
       OR: <array of { serviceId, locationId } pairs from step 2>,
     },
     select: { requirementId: true, serviceId: true, locationId: true, isRequired: true },
   })
   ```
   The implementer may instead use `AND: [{ serviceId: { in: serviceIds } }, { locationId: { in: locationIds } }]` if it produces the same result given the (serviceId, locationId) uniqueness on `dsx_mappings`. The simpler form `serviceId IN ... AND locationId IN ...` is acceptable AS LONG AS the implementer first confirms the Cartesian product matches. Per the spec, the cleanest approach is to build the explicit pair list from `dsx_availability` results and use `OR` of `{ serviceId, locationId }` pairs.

5. **Aggregate using AND-of-applicable-mappings logic, not OR.** Per spec Section "The Fix" and Business Rules 1–3:
   - Group mapping rows by `requirementId`.
   - For each `requirementId`: if the group is empty → `isRequired: false` (Edge Case 3, Business Rule 3).
   - If every mapping row in the group has `isRequired: true` → `isRequired: true` (baseline required).
   - Otherwise (some true, some false; or all false) → `isRequired: false`. The cross-section registry handles the "some" case at runtime.
   - If the field appears in mappings for some package services but not all → only consider the mappings that DO exist (Edge Case 4). Do NOT treat "missing from service X" as "not required by service X" — the AND is over rows that exist, not over the Cartesian product of all services and locations.

6. **Add a comment explaining the merge logic** per `CODING_STANDARDS.md` Section 8.4. The comment must state: "AND logic: a field is baseline-required only if ALL applicable mapping rows for the candidate's package context have isRequired=true. Mappings that don't exist for a (service, location) pair are not considered. The cross-section registry layers conditional country requirements on top of this baseline."

7. **Update the JSDoc block** (currently lines 11–45) to reflect the new semantics. Replace the description of `isRequired` with: "Whether the field is baseline-required for this candidate's package context. True only when every dsx_mappings row for this requirement (filtered to the candidate's package services AND their available, non-disabled locations) has isRequired=true. Defaults to false when no applicable mappings exist."

8. **No change to the response shape.** The returned `fields` array still has `requirementId`, `name`, `fieldKey`, `dataType`, `isRequired`, `instructions`, `fieldData`, `displayOrder`, `locked`, `prefilledValue`. Only the VALUE of `isRequired` becomes accurate.

9. **No change to authentication, error codes, or any other handler logic.** The handler still:
   - Returns 401 on missing session
   - Returns 403 on token mismatch
   - Returns 404 on missing invitation
   - Returns 410 on expired/completed invitation
   - Returns `{ fields: [] }` on packages with no services
   - Returns 500 on database error

**Confirmation:** This file was read in full (lines 1–241).

### 5.2 `src/components/candidate/portal-layout.tsx` — TD-059 SHELL-LEVEL STATUS DERIVATION

**Read in full:** lines 1–430 (the entire file).

**What currently exists:**
- The shell already owns `sectionStatuses` (lines 53–61), `crossSectionRegistry` (line 69), `subjectCrossSectionRequirements` memo (lines 221–224), and a one-time `/saved-data` fetch effect for workflow acknowledgments (lines 98–151).
- `PersonalInfoSection` is mounted only when the active tab is `personal_info` (lines 298–308) and pushes status via `onProgressUpdate`.

**What needs to change:**

1. **Add new shell state for Personal Info field definitions.** Near the existing state declarations (after line 77), add:
   ```ts
   const [personalInfoFields, setPersonalInfoFields] = useState<PersonalInfoField[]>([]);
   const [personalInfoSavedValues, setPersonalInfoSavedValues] = useState<Record<string, unknown>>({});
   ```
   The shell needs to know enough about each personal-info field to feed `computePersonalInfoStatus` (it needs `id`, `fieldKey`, `isRequired`). Define a local `PersonalInfoField` interface inside the file matching the existing one in `PersonalInfoSection.tsx` lines 16–27 (or import the shared type — see Section 5.3 for the prop contract). Use the existing `FieldMetadata` type from `@/types/candidate-portal` for the `fieldData` field if it is included in the local type.

2. **Add a one-time fetch effect for `/personal-info-fields`.** After the existing workflow-acknowledgments effect (after line 151), add a parallel effect:
   ```ts
   useEffect(() => {
     let cancelled = false;
     (async () => {
       try {
         const response = await fetch(
           `/api/candidate/application/${encodeURIComponent(token)}/personal-info-fields`
         );
         if (!response.ok || cancelled) return;
         const data = await response.json();
         if (!cancelled) {
           setPersonalInfoFields(data.fields ?? []);
         }
       } catch (error) {
         logger.error('Failed to load personal info fields in shell', {
           event: 'shell_personal_info_fields_load_error',
           error: error instanceof Error ? error.message : 'Unknown error',
         });
       }
     })();
     return () => { cancelled = true; };
   }, [token]);
   ```
   Per `COMPONENT_STANDARDS.md` Section 2.1, the effect's only condition is whether the data is needed (always, when there's a token). Per `CODING_STANDARDS.md` Section 5, errors go through `clientLogger as logger` (already imported on line 16), no PII.

3. **Extend the existing saved-data hydration effect (lines 98–151) to also populate `personalInfoSavedValues`.** The existing effect already fetches `/saved-data` once on mount for workflow acknowledgments. The simplest, no-double-fetch approach is to add a parallel extraction inside that same effect:
   - Read `savedSections.personal_info?.fields` (an array of `{ requirementId, value }`)
   - Build a map `{ [requirementId]: value }`
   - Call `setPersonalInfoSavedValues(map)` inside the existing `if (!cancelled)` block at line 134.
   - The effect's dependency array is already `[token, sections]`, which is correct.

   Important: do NOT make the `personalInfoSavedValues` fetch conditional on the presence of workflow sections (the existing effect's early-exit at line 102 only triggers if `workflowSectionIds.length === 0`). The implementer must restructure the effect so it ALWAYS runs (as long as there's a token), but only hydrates workflow acknowledgments when workflow sections are present. The simplest restructure: remove the early-exit, and inside the loop branch only on `section.type === 'workflow_section'`. Both maps are built in the same pass; both are written together.

4. **Add a new effect that recomputes Personal Info status whenever any of its inputs change.** After the saved-data hydration effect, add:
   ```ts
   useEffect(() => {
     // Find the Personal Info section so we know what key to write to.
     const personalInfoSection = sections.find(s => s.type === 'personal_info');
     if (!personalInfoSection) return;

     const valuesByFieldKey: Record<string, unknown> = {};
     for (const field of personalInfoFields) {
       valuesByFieldKey[field.fieldKey] = personalInfoSavedValues[field.requirementId];
     }
     const fieldLikes = personalInfoFields.map(field => ({
       id: field.requirementId,
       fieldKey: field.fieldKey,
       isRequired: field.isRequired,
     }));
     const status = computePersonalInfoStatus(
       fieldLikes,
       valuesByFieldKey,
       subjectCrossSectionRequirements,
     );
     handleSectionProgressUpdate(personalInfoSection.id, status);
   }, [
     sections,
     personalInfoFields,
     personalInfoSavedValues,
     subjectCrossSectionRequirements,
     handleSectionProgressUpdate,
   ]);
   ```
   The shape of `fieldLikes` and `valuesByFieldKey` matches the existing call in `PersonalInfoSection.tsx` lines 208–224 verbatim — this is the same pure computation, just lifted. `handleSectionProgressUpdate` already short-circuits via the functional updater at line 172 (`if (prev[sectionId] === status) return prev`), preventing infinite re-renders per `COMPONENT_STANDARDS.md` Section 2.2.

5. **Add an import for `computePersonalInfoStatus`.** The file already imports `computeWorkflowSectionStatus` from `@/lib/candidate/sectionProgress` on line 23. Extend that import to also include `computePersonalInfoStatus`.

6. **Pass the shell-owned data to `PersonalInfoSection` as new props.** Update the dispatch at lines 298–308:
   ```tsx
   if (section.type === 'personal_info') {
     return (
       <div className="p-6" data-testid="main-content">
         <PersonalInfoSection
           token={token}
           fields={personalInfoFields}                          // NEW
           initialSavedValues={personalInfoSavedValues}          // NEW
           crossSectionRequirements={subjectCrossSectionRequirements}
           onProgressUpdate={(status) => handleSectionProgressUpdate(section.id, status)}
           onSavedValuesChange={setPersonalInfoSavedValues}       // NEW — see Section 5.3
         />
       </div>
     );
   }
   ```
   Rationale for `onSavedValuesChange`: when the candidate edits a Personal Info field and auto-save fires successfully, the section needs to push the updated values back to the shell so the lifted `useEffect` recomputes status from the latest values. This addresses the "Saved data sync" risk-mitigation note in the spec (line 149).

7. **No change to the rest of `portal-layout.tsx`.** Sidebar rendering, workflow-acknowledgment handling, mobile menu, and all other sections (Idv, Education, Employment, Address History, workflow_section dispatch) remain unchanged.

**File size note:** the file is currently 430 lines and will grow by ~40–60 lines. That stays under the 500-line warning threshold and well under the 600-line hard stop in `CODING_STANDARDS.md` Section 9.

**Confirmation:** This file was read in full (lines 1–430).

### 5.3 `src/components/candidate/form-engine/PersonalInfoSection.tsx` — TD-059 PRESENTATIONAL REFACTOR

**Read in full:** lines 1–298 (the entire file).

**What currently exists:**
- Lines 16–27: local `PersonalInfoField` type.
- Lines 29–39: props (`token`, `crossSectionRequirements`, `onProgressUpdate`).
- Lines 53–55: state (`fields`, `formData`, `loading`, `saveStatus`, `pendingSaves`).
- Lines 63–65 + 67–120: `loadFieldsAndData` function which fetches `/personal-info-fields` AND `/saved-data` from inside the section.
- Lines 143–199: auto-save effect.
- Lines 206–226: progress recompute effect — **the one to remove for TD-059.**

**What needs to change:**

1. **Update the props contract.** Add three new props: `fields`, `initialSavedValues`, and `onSavedValuesChange`:
   ```ts
   interface PersonalInfoSectionProps {
     token: string;
     fields: PersonalInfoField[];                                   // NEW — shell-provided
     initialSavedValues?: Record<string, unknown>;                   // NEW — shell-provided saved values keyed by requirementId
     crossSectionRequirements?: CrossSectionRequirementEntry[];      // unchanged
     onProgressUpdate?: (status: SectionStatus) => void;             // unchanged (still called for local edits)
     onSavedValuesChange?: (next: Record<string, unknown>) => void; // NEW — push saved values up after auto-save
   }
   ```

2. **Remove the `/personal-info-fields` and `/saved-data` fetches from this component.** Delete the entire `loadFieldsAndData` function (lines 67–120) and the mount effect at lines 63–65. Replace the mount effect with a single effect that hydrates `formData` from props:
   ```ts
   useEffect(() => {
     // Initial form data: prefilled values from field defs, then saved values
     // from the shell. Locked fields keep their prefilledValue (auto-save
     // won't fire for them anyway because handleFieldBlur returns early
     // for locked fields — see line 134).
     const initial: Record<string, unknown> = {};
     for (const field of fields) {
       if (field.prefilledValue !== null && field.prefilledValue !== undefined) {
         initial[field.requirementId] = field.prefilledValue;
       }
     }
     if (initialSavedValues) {
       for (const [requirementId, value] of Object.entries(initialSavedValues)) {
         const fieldDef = fields.find(f => f.requirementId === requirementId);
         if (!fieldDef?.locked) {
           initial[requirementId] = value;
         }
       }
     }
     setFormData(initial);
     setLoading(false);
   }, [fields, initialSavedValues]);
   ```
   Remove the `setFields(...)` call entirely — the local `fields` state is removed and the prop is used directly.

3. **Replace local `fields` state with the prop.** Remove `const [fields, setFields] = useState<PersonalInfoField[]>([]);` (line 53). Use `fields` from props directly.

4. **Remove the lifted progress effect (lines 206–226).** It is now owned by the shell. The `computePersonalInfoStatus` import on line 12 is no longer used here and must be removed. The `SectionStatus` and `CrossSectionRequirementEntry` imports on line 14 are still needed (`SectionStatus` for the prop signature, `CrossSectionRequirementEntry` for the prop signature).

5. **Keep the local `onProgressUpdate` call but move it to the auto-save success path AND the field-edit path.** Per spec Section TD-059 "Implementation Approach" point 5, the section should still call `onProgressUpdate` on local edits so the sidebar updates immediately without waiting for auto-save. Add a new effect that recomputes and pushes status when `formData` changes:
   ```ts
   useEffect(() => {
     if (loading || !onProgressUpdate) return;
     const valuesByFieldKey: Record<string, unknown> = {};
     for (const field of fields) {
       valuesByFieldKey[field.fieldKey] = formData[field.requirementId];
     }
     const fieldLikes = fields.map(field => ({
       id: field.requirementId,
       fieldKey: field.fieldKey,
       isRequired: field.isRequired,
     }));
     const status = computePersonalInfoStatus(
       fieldLikes,
       valuesByFieldKey,
       crossSectionRequirements ?? [],
     );
     onProgressUpdate(status);
   }, [loading, fields, formData, crossSectionRequirements, onProgressUpdate]);
   ```
   This is essentially the same effect that exists today on lines 206–226 — it stays HERE for live local typing. The shell's effect (Section 5.2 step 4) handles the unmounted-section case. Both write through `handleSectionProgressUpdate`, which short-circuits identical statuses via the functional updater. **Restore the `computePersonalInfoStatus` import** for this purpose.

6. **Push saved values up after a successful auto-save.** In the auto-save effect (currently lines 143–199), after `setPendingSaves(new Set())` on the success path (line 175), call `onSavedValuesChange?.(formData)` so the shell's saved-values map stays in sync. This avoids a `/saved-data` refetch on every save and addresses the "Saved data sync" risk in the spec (line 149).

7. **Initial loading state.** The component's `loading` flag was previously set to `true` until both fetches completed. With the fetches removed, it should default to `true` and flip to `false` inside the new hydration effect (step 2). Alternatively, treat `fields.length === 0` plus the parent-still-loading semantic by accepting an explicit prop — but the simpler and lower-risk choice is the loading effect described in step 2.

8. **No change to:** the cross-section requirement banner rendering (lines 250–255), the field rendering with `DynamicFieldRenderer` (lines 269–296), `handleFieldChange`, `handleFieldBlur`, the auto-save effect's POST request, the empty-state branch, or the loading-state branch. The component's user-visible behavior is unchanged.

**File size note:** the file is currently 298 lines. Removing the inline fetches saves about 50 lines while adding ~30 lines for the new hydration and progress effects, leaving the file slightly smaller. Well under all thresholds.

**Confirmation:** This file was read in full (lines 1–298).

### 5.4 Tests to Update (existing test files)

The architect must list every test file that the implementer will need to modify, because the test-writer's Pass 2 will rewrite mocks in these files based on the new contracts. Listing these here as MODIFIED (not as new files) prevents the implementer from creating duplicates.

#### 5.4.1 `src/app/api/candidate/application/[token]/personal-info-fields/__tests__/route.test.ts`

**Read in full:** lines 1–736.

**What currently exists:** 11 tests covering authentication, invitation validation, field retrieval, deduplication, locked/prefilled fields, disabled-requirement filtering, document-type filtering, collectionTab variations, fieldKey fallback, empty-services packages, fieldData preservation, and error handling. None of the existing tests mock `dsx_availability` or assert on the new `(service, location)` filter behavior.

**What needs to change:**
- Existing mocks of `prisma.serviceRequirement.findMany` will continue to work, but the implementer must add mocks for `prisma.dSXAvailability.findMany` and update the existing `prisma.dSXMapping.findMany` mocks to match the new query shape (the `where` clause now includes location/service filters).
- All existing tests that hit the database mocks will need their `prisma.dSXMapping.findMany` mock implementations adjusted to return mappings consistent with the new context-aware query. Tests that don't explicitly set this mock will fall through to whatever the global mock returns (typically `[]`), which produces `isRequired: false` for everything — this is acceptable for tests that don't care about `isRequired`.
- New tests for TD-060 (Pass 1 — see Section 11) target the new behavior.

**Confirmation:** This file was read in full.

#### 5.4.2 `src/components/candidate/form-engine/__tests__/PersonalInfoSection.test.tsx`

**Read in full:** lines 1–80, 80–280 (sufficient to see the testing patterns; remaining lines follow the same patterns).

**What currently exists:** tests that mock `global.fetch` to return `/personal-info-fields` and `/saved-data` responses. The component being tested fetches both endpoints itself.

**What needs to change:**
- Because the component no longer fetches `/personal-info-fields` or `/saved-data`, the tests must be updated to pass `fields` and `initialSavedValues` as props instead of mocking `fetch`. The mock fetch should only intercept `/save` (auto-save) calls.
- The change is mechanical: every place the test sets up a `mockFetch` for `/personal-info-fields` becomes a `fields={[...]}` prop on the rendered `<PersonalInfoSection>`. Every `/saved-data` mock becomes an `initialSavedValues={...}` prop.
- Existing assertions on rendered field values, locked/prefilled behavior, and auto-save remain valid.

**Confirmation:** This file was read in full.

#### 5.4.3 `src/components/candidate/portal-layout.test.tsx`

**Read in full:** lines 1–300 (sufficient to see the testing patterns; remaining lines follow the same patterns).

**What currently exists:** tests for sidebar rendering, section navigation, mobile menu behavior, and one general fetch mock at lines 88–93.

**What needs to change:**
- The default fetch mock needs to handle `/personal-info-fields` and `/saved-data` because the shell now fetches them on mount. The current mock returns `{ fields: [] }` which is acceptable for `/personal-info-fields` but does not match the `/saved-data` shape (`{ sections: {...} }`). Update the default mock to URL-route like `PersonalInfoSection.test.tsx` already does (lines 125–145).
- New TD-059 tests live in this file (Pass 2, Section 11).

**Confirmation:** This file was read in full (lines 1–300, plus an additional 50-line spot check confirming the same patterns continue).

---

## 6. API Routes

### 6.1 Modified: `GET /api/candidate/application/[token]/personal-info-fields`

- **HTTP method:** GET (unchanged)
- **Path:** `/api/candidate/application/[token]/personal-info-fields` (unchanged)
- **Authentication:** Valid `candidate_session` cookie matching the URL token (unchanged). No NextAuth session — candidate flow is its own auth path via `CandidateSessionService`.
- **Permissions:** None beyond the candidate-session match (unchanged). This is not a logged-in-user endpoint, so `auth-utils.ts` permission functions don't apply.
- **Input:** Path param `token: string` (unchanged). No request body.
- **Validation:** Token format is implicitly validated by `CandidateSessionService.getSession()` lookup (unchanged).
- **Returns on success (200):**
  ```ts
  {
    fields: Array<{
      requirementId: string;
      name: string;
      fieldKey: string;
      dataType: string;
      isRequired: boolean;     // Semantics changed — see below.
      instructions: string | null;
      fieldData: object;
      displayOrder: number;
      locked: boolean;
      prefilledValue: string | null;
    }>;
  }
  ```
  The `isRequired` semantics change: it is now `true` only when every applicable `dsx_mappings` row for the candidate's package context (filtered by package services AND available, non-disabled locations) has `isRequired = true`. When no applicable mappings exist for a field, the value is `false`.
- **Errors:**
  - 401: `{ error: 'Unauthorized' }` (no session)
  - 403: `{ error: 'Forbidden' }` (token mismatch)
  - 404: `{ error: 'Invitation not found' }`
  - 410: `{ error: 'Invitation expired' }` or `{ error: 'Invitation already completed' }`
  - 500: `{ error: 'Internal server error' }`

All error cases are unchanged from the current implementation.

### 6.2 Unchanged Routes

- `GET /api/candidate/application/[token]/saved-data` — no change (audit cleared in Section 3.1).
- `GET /api/candidate/application/[token]/structure` — no change (audit cleared in Section 3.2).
- `POST /api/candidate/application/[token]/save` — no change (auto-save target).

No new endpoints are created.

---

## 7. Zod Validation Schemas

**No new Zod schemas.** This fix does not accept any new request body or query parameter. The existing `personal-info-fields` route does not currently use Zod (only path-param validation via the session service), and TD-060 doesn't change the input surface.

If a future stage adds validation for this endpoint, it would belong here, but per the spec's "What NOT to Change" list and the principle of minimal footprint (`CODING_STANDARDS.md` Section 1.5), it is out of scope.

---

## 8. TypeScript Types

**No new shared types.** The fix uses existing types only:

- `SectionStatus` from `@/types/candidate-stage4` — already imported in `portal-layout.tsx` and `PersonalInfoSection.tsx`.
- `CrossSectionRequirementEntry` from `@/types/candidate-stage4` — already imported in both.
- `FieldMetadata`, `FieldValue` from `@/types/candidate-portal` — already imported in `PersonalInfoSection.tsx`.

The local `PersonalInfoField` interface (currently in `PersonalInfoSection.tsx` lines 16–27) needs to be visible to `portal-layout.tsx` so the shell can declare the shape of its new state. Two options:

**Option A (recommended):** Move the `PersonalInfoField` interface from `PersonalInfoSection.tsx` to `src/types/candidate-portal.ts` so both files import it. Add the interface to the existing types file (no new file). This is consistent with `CODING_STANDARDS.md` Section 3.3 ("Types live in /src/types/").

**Option B:** Duplicate the interface in `portal-layout.tsx`. Rejected — violates the "never duplicate type definitions" rule in `CODING_STANDARDS.md` Section 3.3.

The implementer must use Option A. The interface to move:
```ts
export interface PersonalInfoField {
  requirementId: string;
  name: string;
  fieldKey: string;
  dataType: string;
  isRequired: boolean;
  instructions?: string | null;
  fieldData?: FieldMetadata | null;
  displayOrder: number;
  locked: boolean;
  prefilledValue?: string | null;
}
```

This means `src/types/candidate-portal.ts` is also a MODIFIED file. It is added to the modified-files list:

#### 5.5 `src/types/candidate-portal.ts` — TD-059 SUPPORT

**Read in full:** lines 1–110 (the entire file).

**What currently exists:** Types for `CandidateInvitationInfo`, `CandidatePortalSection`, `CandidatePortalStructureResponse`, `FieldMetadata`, `SavedFieldData`, `FormSectionData`, `CandidateFormData`, `DocumentMetadata`, `FieldValue`. The `PersonalInfoField` shape is currently duplicated as a local interface in `PersonalInfoSection.tsx`.

**What needs to change:**
- Add the `PersonalInfoField` interface (defined above, with import of `FieldMetadata` already at the top of the file).
- Export it from this file.
- No other changes.

**Confirmation:** This file was read in full (lines 1–110).

---

## 9. UI Components

No new components. The only modified components are:

- `src/components/candidate/portal-layout.tsx` — already a client component (`'use client'` line 3). See Section 5.2.
- `src/components/candidate/form-engine/PersonalInfoSection.tsx` — already a client component (`'use client'` line 3). See Section 5.3.

Neither component changes its rendered output for the candidate (no new UI elements, no new ModalDialog / FormTable / FormRow / ActionDropdown). The change is purely state ownership and effect placement.

---

## 10. Translation Keys

**No new translation keys.** No user-facing text is added or removed. All existing keys in `PersonalInfoSection.tsx` (`candidate.portal.personalInfo.loading`, `candidate.portal.personalInfo.noFieldsRequired`, `candidate.portal.personalInfo.instructions`, `candidate.portal.sections.personalInformation`) remain unchanged.

Per `COMPONENT_STANDARDS.md` Section 6.3, translation files are not touched.

---

## 11. Test Strategy

The pipeline uses two-pass test discipline (`TESTING_STANDARDS.md` Section 3). Pass 1 runs before the implementer; Pass 2 runs after. The architect specifies which tests belong in each pass.

### 11.1 Pass 1 — Contract Tests (before implementation)

Pass 1 covers behavior that can be defined purely from the spec and this plan, without inventing implementation details. For this fix:

**TD-060 contract tests (added to `src/app/api/candidate/application/[token]/personal-info-fields/__tests__/route.test.ts`):**

These tests assert end-to-end behavior of the route at the contract level: given a Prisma mock state, the response's `isRequired` values match the spec's business rules. They mock `prisma.candidateInvitation.findUnique`, `prisma.serviceRequirement.findMany`, `prisma.dSXAvailability.findMany`, and `prisma.dSXMapping.findMany`. They do NOT mock the route handler itself. They target the existing route file path. The implementation does not exist yet, so the tests will fail (RED) until the implementer wires up the new query logic.

The following 7 Pass 1 tests are mandatory, mapping to the spec's "Test Cases" 1–7:

1. **Field required in ALL package locations → baseline required.** Mock `dsx_availability` with 2 services × 2 locations (4 rows). Mock `dsx_mappings` with 4 rows for one requirement, all `isRequired: true`. Assert `data.fields[0].isRequired === true`.
2. **Field required in SOME package locations → not baseline required.** Same setup, but one of the 4 mapping rows has `isRequired: false`. Assert `data.fields[0].isRequired === false`.
3. **Field required in a non-package service → ignored.** Configure `dsx_mappings` with `isRequired: true` for a service that's NOT in the candidate's package. Assert `data.fields[0].isRequired === false`.
4. **Field required in an unavailable location → ignored.** `dsx_availability` returns `isAvailable: false` for the relevant (service, location) pair. The endpoint must filter that pair out before querying mappings. Assert `data.fields[0].isRequired === false`.
5. **Field required in a globally disabled location → ignored.** `dsx_availability` returns `isAvailable: true` but the implementer's query must include the `country: { NOT: { disabled: true } }` relation filter, which excludes the row at the database level. Mock the result of `prisma.dSXAvailability.findMany` to NOT include the disabled-location row (because the actual Prisma filter would have excluded it). Assert `data.fields[0].isRequired === false`. The Pass 1 test should ALSO assert (in a separate sub-case) that the endpoint's `prisma.dSXAvailability.findMany` call was invoked with a `where` clause that includes `country: { NOT: { disabled: true } }` — `expect(prisma.dSXAvailability.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ country: { NOT: { disabled: true } } }) }))`.
6. **Package with no services → all fields not required.** `invitation.package.packageServices` is empty. Endpoint should still return 200 with `fields: []`. Existing test at line 609 already covers this; the new test asserts the case where the package has services but no `dsx_mappings` apply.
7. **Field has no mapping rows for package context → not required.** A requirement exists in `dsx_requirements` and is matched by the personal-info filter, but `dsx_mappings` has zero rows for the (service, location) pairs in the candidate's package. Assert `data.fields[0].isRequired === false`.

These 7 tests follow `TESTING_STANDARDS.md` Section 3.1 (no mocks of unwritten modules — the route file already exists, only its internals change). They use only `prisma.*` mocks via the global mock at `src/test/setup.ts` per Section 7.1.

**Schema tests:** None. No Zod schemas added.

**E2E tests (Playwright):** Out of scope for this fix. The two bugs are unit/integration-level. E2E coverage of the candidate portal is owned by Phase 6/7 e2e plans.

**Pass 1 total:** 7 new tests, all in `personal-info-fields/__tests__/route.test.ts`.

### 11.2 Pass 2 — Mock-Backed Tests (after implementation)

Pass 2 reads the actual source files the implementer wrote and writes mocks against them. For this fix:

**TD-059 component tests (added to `src/components/candidate/portal-layout.test.tsx`):**

Per spec "Test Cases" 8–11:

8. **Registry change updates sidebar without navigating to Personal Info.** Render `<PortalLayout>` with mock sections that include both `personal_info` and `address_history`. Mock fetches so `/personal-info-fields` returns a field with `isRequired: true`, and `/saved-data` returns an empty `personal_info` section. Click Address History (so PersonalInfoSection is unmounted). Programmatically trigger a cross-section registry change — easiest via a test-only callback hook OR by simulating the AddressHistorySection's `onCrossSectionRequirementsChanged` call through user interaction with the rendered AddressHistorySection. Assert that the sidebar's SectionProgressIndicator for `personal_info` shows the `incomplete` (or `not_started` → `incomplete`) state without `personal_info` being mounted. The test must verify by querying the sidebar DOM, not by inspecting React internals.

9. **Registry clear updates sidebar back.** After test 8, simulate the registry being cleared (e.g., AddressHistorySection's `onCrossSectionRequirementsRemovedForSource` callback). Assert the sidebar indicator returns to its prior state.

10. **Shell fetches Personal Info fields on load.** Render `<PortalLayout>`. Assert `mockFetch` was called with a URL matching `/personal-info-fields`.

11. **PersonalInfoSection does not double-fetch fields.** Render `<PortalLayout>`. Click Personal Info (mounting the section). Assert that the `/personal-info-fields` URL was fetched exactly once (the shell's fetch), not twice.

**TD-059 component tests (added to `src/components/candidate/form-engine/__tests__/PersonalInfoSection.test.tsx`):**

Per spec "Test Case" 12:

12. **Local field change updates sidebar immediately.** Render `<PersonalInfoSection>` with shell-provided `fields` (one required field) and an `onProgressUpdate` spy. Simulate the candidate typing into the required field. Assert `onProgressUpdate` was called with `'incomplete'` BEFORE auto-save fires (the in-component progress effect in Section 5.3 step 5 fires synchronously on `formData` change).

**Pass 2 mock guidance:**
- Mocks for `portal-layout.test.tsx` must read the actual `portal-layout.tsx` source the implementer wrote to confirm the new prop signatures on `PersonalInfoSection`. The test-writer must pass `fields` and `initialSavedValues` props with the shape defined in the actual source.
- Mocks for `PersonalInfoSection.test.tsx` (existing tests) must be REWRITTEN to use the new prop-based contract per Section 5.4.2. The test-writer reads the actual updated component, finds the new prop list, and updates fixtures accordingly.

**Pass 2 total:** 5 new tests (4 in portal-layout.test.tsx, 1 in PersonalInfoSection.test.tsx) + rewriting all existing PersonalInfoSection tests to pass props instead of mocking fetches. The rewrite is mechanical and does not add new test cases.

### 11.3 Order of Test Authoring

Per spec "Implementation Order" (TD-060 first, TD-059 second):
1. **Pass 1 — Test Writer 1** writes the 7 TD-060 tests in `personal-info-fields/__tests__/route.test.ts`. RED phase confirmed by running the suite and seeing 7 new failures.
2. **Implementer (Stage 4)** writes the TD-060 fix in `personal-info-fields/route.ts` until the 7 new tests turn green. Existing 11 tests must remain green (zero net regression).
3. **Pass 1 has nothing further to write for TD-059** (component changes are Pass 2 territory because they need the implementer's actual prop signatures).
4. **Implementer (Stage 4 continued, same PR)** writes the TD-059 fix in `portal-layout.tsx`, `PersonalInfoSection.tsx`, and moves the `PersonalInfoField` interface to `candidate-portal.ts`.
5. **Pass 2 — Test Writer 2** rewrites existing `PersonalInfoSection.test.tsx` for the new prop contract, adds the 5 new TD-059 tests, and updates `portal-layout.test.tsx`'s default fetch mock.
6. **Standards-checker, documentation-writer** — out of architect scope but expected as later pipeline stages.

---

## 12. Order of Implementation

Per spec line 153: "Fix TD-060 first." The implementer must follow this order:

1. **Move `PersonalInfoField` interface** from `PersonalInfoSection.tsx` to `src/types/candidate-portal.ts`. This is a no-behavior-change refactor and unblocks Step 2 needing the type in the shell. No tests affected.
2. **Implement TD-060 in `personal-info-fields/route.ts`:**
   1. Update the JSDoc block to describe the new `isRequired` semantics.
   2. Add the `prisma.dSXAvailability.findMany` query (filtered by package serviceIds, `isAvailable: true`, and `country: { NOT: { disabled: true } }`).
   3. Build the (serviceId, locationId) pair list and short-circuit when empty.
   4. Update the existing `prisma.dSXMapping.findMany` query to filter by both `requirementId IN (...)` and the (serviceId, locationId) pairs.
   5. Replace the OR aggregation with the AND-of-applicable-mappings logic per Section 5.1 step 5.
   6. Add the merge-logic comment per Section 5.1 step 6.
3. **Verify TD-060 by running the targeted route test file:** `pnpm vitest run src/app/api/candidate/application/[token]/personal-info-fields/__tests__/route.test.ts`. All 11 existing tests + 7 new tests must pass.
4. **Implement TD-059 in the shell and section:**
   1. Update `portal-layout.tsx` per Section 5.2 (state + two effects + import + prop wiring).
   2. Update `PersonalInfoSection.tsx` per Section 5.3 (props + remove fetches + remove lifted effect + add saved-values push).
5. **Verify the full suite:** `pnpm vitest run`. Zero net regression vs. the baseline before the fix. All TD-060 and TD-059 new tests passing.
6. **Browser verification:** Open the candidate portal as a test invitation. Navigate to Address History, change country to one that triggers a cross-section subject requirement, navigate back to Personal Info. Confirm the sidebar updated WITHOUT mounting Personal Info during the country change.

The standard order in the architect template (database → migration → types → Zod → routes → components → translations) is collapsed because there are no DB or migration steps and no new types/Zod/translations.

---

## 13. Risks and Considerations

### 13.1 Open / decided clarifications

All ambiguities I noticed are resolved by the spec and `DATABASE_STANDARDS.md`:

- **`Country.disabled` is nullable in the schema (line 71).** Spec Business Rule 4 says "disabled IS NOT TRUE" — I interpret that to mean `disabled = false OR disabled IS NULL`. The Prisma filter `NOT: { disabled: true }` matches this exactly. Confirmed by the spec text "or `Location.disabled IS NOT TRUE`" on line 39.
- **The spec uses "Location" but the schema uses `Country`.** The relation field on `dsx_mappings` and `dsx_availability` is named `country` and points to the `Country` model. They are the same thing. The implementer must use `Country` / `country` in code; "Location" is the spec's domain term.
- **Edge Case 4 ("field appears in mappings for some package services but not others").** The spec says "only consider mappings where the field actually appears." The plan's Section 5.1 step 5 implements this by AND-aggregating only over rows that exist for the (serviceId, locationId) pairs in the candidate's package — missing rows are not penalized.

### 13.2 Risks I want flagged for Andy

1. **The OR-pair filter on `dsx_mappings`.** A `where` clause of the form `OR: <array of (serviceId, locationId) pairs>` produces many predicate branches when the package has many service-location combinations. For typical candidate packages (1–5 services × 1–10 locations = up to 50 pairs), Prisma generates a single SQL query with an `IN (...)` or `OR` clause that PostgreSQL handles fine using the existing indexes on `dsx_mappings.serviceId` and `.locationId`. For pathological cases (e.g., a package with 50 services × 50 countries = 2500 pairs), the query may degrade. Spec line 86 explicitly states "Expected query time: under 100ms. No caching needed" — Andy has accepted this. The simpler `serviceId IN (...) AND locationId IN (...)` form returns the SAME row set when (serviceId, locationId) is unique on `dsx_mappings` (which it is, per `@@unique([serviceId, locationId, requirementId])`), so the implementer may use that form for a tighter query. The plan permits either; implementer choice.

2. **The shell's `/saved-data` effect previously short-circuited when no workflow sections were present (line 102).** The plan requires removing that short-circuit because Personal Info saved values must be hydrated even when no workflow sections exist. The change is small and the existing tests (which mostly include workflow sections in their fixtures) should still pass, but the implementer must verify.

3. **Dual write to `sectionStatuses['personal_info']`.** Both the shell's effect (Section 5.2 step 4) and the section's effect (Section 5.3 step 5) call `handleSectionProgressUpdate`. The functional updater in `handleSectionProgressUpdate` (lines 169–177) short-circuits identical statuses, so this is safe. The "no double-write" risk-mitigation note in spec line 148 is satisfied by the existing pattern.

4. **The component test rewrite is mechanical but voluminous.** `PersonalInfoSection.test.tsx` is 734 lines. The Pass 2 test-writer has substantial work to convert every test from fetch-mocking to prop-passing. This is part of the cost of moving fetches up.

5. **Type-move from `PersonalInfoSection.tsx` to `candidate-portal.ts`.** Adding a new export to a shared types file is generally low-risk, but the implementer must verify no other consumer (e.g., `AddressHistorySection`) imports `PersonalInfoField` from `PersonalInfoSection.tsx` directly. Grep confirmed no other consumer; the type is currently only used inside `PersonalInfoSection.tsx`.

6. **The Pass 1 test for "globally disabled location" depends on the implementer using the `country: { NOT: { disabled: true } }` Prisma filter exactly.** If the implementer uses an alternative form (e.g., `country: { disabled: { not: true } }` or fetches all locations and filters in JS), the Pass 1 test in Section 11.1 #5 needs an adjusted assertion. The spec language and this plan both prescribe the `NOT: { disabled: true }` form; deviations require a plan amendment.

### 13.3 Things explicitly OUT of scope (for clarity)

- The cross-section registry shape, helpers in `src/lib/candidate/crossSectionRegistry.ts`, and the `useRepeatableSectionStage4Wiring` hook are NOT modified.
- `computePersonalInfoStatus` and any other function in `src/lib/candidate/sectionProgress.ts` are NOT modified.
- The candidate `/save` route and its persistence shape are NOT modified.
- Other section progress paths (Education, Employment, Address History, IDV, workflow_section) are NOT modified.
- E2E (Playwright) tests are NOT in scope.

---

## 14. Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above.
  - `src/app/api/candidate/application/[token]/personal-info-fields/route.ts` (Section 5.1)
  - `src/components/candidate/portal-layout.tsx` (Section 5.2)
  - `src/components/candidate/form-engine/PersonalInfoSection.tsx` (Section 5.3)
  - `src/types/candidate-portal.ts` (Section 5.5 / Section 8)
  - `src/app/api/candidate/application/[token]/personal-info-fields/__tests__/route.test.ts` (Section 5.4.1)
  - `src/components/candidate/form-engine/__tests__/PersonalInfoSection.test.tsx` (Section 5.4.2)
  - `src/components/candidate/portal-layout.test.tsx` (Section 5.4.3)
- [x] No file outside this plan will need to be modified.
  - `saved-data/route.ts` and `structure/route.ts` are explicitly cleared by the audit (Section 3) and must NOT be touched.
  - `sectionProgress.ts` is explicitly out of scope (Section 13.3).
  - `crossSectionRegistry.ts` is out of scope.
  - The `/save` route is out of scope.
  - No translations, Zod schemas, migrations, or new components.
- [x] All Zod schemas, types, and translation keys are listed.
  - Zod: none (Section 7).
  - Types: existing `SectionStatus`, `CrossSectionRequirementEntry`, `FieldMetadata`, `FieldValue` plus the moved `PersonalInfoField` (Section 8).
  - Translation keys: none added (Section 10).
- [x] The plan is consistent with the spec's Data Requirements / business rules.
  - Business Rules 1–3: AND-of-applicable-mappings logic in Section 5.1 step 5.
  - Business Rule 4: `country: { NOT: { disabled: true } }` filter in Section 5.1 step 2.
  - Business Rule 5 (audit): cleared in Section 3.
  - Business Rule 6: shell-level status derivation in Section 5.2 step 4.
  - Business Rule 7: shell fetches `/personal-info-fields` once on mount in Section 5.2 step 2.
  - Business Rule 8: no new endpoints (Section 6).
  - Business Rule 9: response shape unchanged (Section 6.1).
  - Edge Cases 1–5: handled in Section 5.1 steps 3, 5, plus the disabled-location filter.

This plan is ready for the test-writer (Pass 1) to proceed.
