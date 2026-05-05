# Fix: TD-060 & TD-059 — Personal Info Required-Field Accuracy and Sidebar Reactivity

**Created:** May 5, 2026
**Status:** Confirmed
**Branch from:** dev (after Stage 4 PR merges)
**Prerequisite:** Phase 6 Stage 4 merged to dev

---

## Overview

Two related bugs affect the Personal Info section of the candidate portal. Both must be fixed before Phase 7 (Validation & Submission) because Phase 7's validation logic depends on accurate required-field signals and reactive progress tracking.

**TD-060 — Required-field computation is too broad.** The `/api/candidate/application/[token]/personal-info-fields` endpoint determines whether a field is required by looking at ALL DSX mappings for that field across every service and every country in the system, then OR-ing the `isRequired` flags together. If middle name is required in even one country for one service, it shows as required for every candidate regardless of their package or context. The fix: compute baseline required status using only the candidate's package services and their available locations. A field is baseline-required only if it's required in ALL available (service, location) combinations for this candidate's package.

**TD-059 — Sidebar progress doesn't update for unmounted sections.** Personal Info's progress status is computed inside the PersonalInfoSection component, which only runs when the candidate is viewing that tab. When the cross-section registry changes (e.g., candidate changes country in Address History), the sidebar indicator for Personal Info stays stale until the candidate navigates to it. The fix: lift Personal Info's status derivation into the portal shell so it runs whenever the registry changes, regardless of which tab is active.

---

## TD-060: Required-Field Accuracy

### The Problem

`personal-info-fields/route.ts` lines 164-178 currently do this:

1. Get all DSX requirement IDs that are personal info fields
2. Query `dsx_mappings` for those requirement IDs with NO filter on service or location
3. OR-aggregate `isRequired` across every mapping row
4. Return `isRequired: true` if ANY mapping row has `isRequired: true`

This means a field that is only required in one country (e.g., middle name required only in Country X) appears required for ALL candidates.

### The Fix

Change the query to scope `dsx_mappings` to only the (service, location) combinations relevant to this candidate.

"Relevant" means:
- **Services:** Only the services in this candidate's package (from `package_services` via the order's package)
- **Locations:** Only the locations where those services are available AND the location itself is not globally disabled. The filter is `dsx_availability.isAvailable = true` AND `Location.disabled = false` (or `Location.disabled IS NOT TRUE`). A globally disabled location must be excluded even if it appears in `dsx_availability` with `isAvailable = true` — including it would inflate or deflate the baseline requirement calculation incorrectly.

A field's baseline `isRequired` is determined by:
- Look at all `dsx_mappings` rows where `serviceId` is in the candidate's package services AND `locationId` is in the available, non-disabled locations for those services
- If EVERY matching mapping row has `isRequired: true` → the field is **baseline required** (always show the red star)
- If SOME but not all have `isRequired: true` → the field is **conditionally required** (no red star at baseline; the cross-section registry handles adding it when the candidate selects a triggering country)
- If NO matching mapping rows have `isRequired: true` → the field is **not required** (no red star)

### Data Flow

```
CandidateInvitation (token)
  → Order (orderId)
    → CustomerPackage (via order's package reference)
      → PackageServices (serviceIds for this package)
        → DSXAvailability (locationIds where each service isAvailable, excluding disabled locations)
          → DSXMappings (filtered by serviceId + locationId)
            → isRequired per field (ALL must be true for baseline required)
```

### API Response Change

The response shape stays the same. The only change is the VALUE of `isRequired` for each field — it becomes accurate to this candidate's context instead of globally aggregated.

No new endpoints. No new response fields. The cross-section registry already handles the country-specific layer on top of this baseline.

### Audit of Neighboring Endpoints (In Scope)

The architect must inspect the following two files for the same context-free `isRequired` lookup pattern:

- `src/app/api/candidate/application/[token]/saved-data/route.ts`
- `src/app/api/candidate/application/[token]/structure/route.ts`

If either file contains the same pattern (querying `dsx_mappings` for `isRequired` without filtering by the candidate's package services AND available, non-disabled locations), the architect must apply the same fix in this pass. Creating a separate tech debt item for the same bug in a neighboring file would be wasteful — both endpoints feed the same candidate experience and must agree on what "required" means.

This audit and any resulting fixes are **in scope for this fix**, not a follow-up. The implementer should treat all matching files as part of TD-060.

### Edge Cases

1. **Package has no services** — return all fields as not required (shouldn't happen in practice, but degrade gracefully)
2. **A service has no available locations** — skip that service's mappings (no locations = no requirements from that service)
3. **A field has no mapping rows for the filtered services/locations** — treat as not required
4. **Field appears in mappings for some package services but not others** — only consider mappings where the field actually appears; don't treat "missing from service X" as "not required by service X"
5. **Location exists in `dsx_availability` with `isAvailable = true` but is globally disabled (`Location.disabled = true`)** — ignore that mapping row entirely. The location is a phantom from the candidate's perspective and must not affect the baseline calculation.

### Performance

This is a one-time query at Personal Info section load. The join chain (invitation → order → package → package_services → dsx_availability → location → dsx_mappings) involves small tables for any single candidate. Expected query time: under 100ms. No caching needed.

### What NOT to Change

- The cross-section registry is correct and should not be modified
- The way other sections (Education, Employment, Address History) load their fields is unrelated — those endpoints already filter by service and location because the candidate selects a country first
- The `computePersonalInfoStatus` function is correct — it already combines baseline fields with cross-section requirements

---

## TD-059: Sidebar Reactivity

### The Problem

`PersonalInfoSection.tsx` lines 206-226 compute progress status and call `onProgressUpdate(status)`. This effect only runs when `<PersonalInfoSection>` is mounted. The portal shell (`portal-layout.tsx`) only mounts one section at a time — the active tab. When the candidate is on Address History and changes a country, the cross-section registry updates correctly, but Personal Info's status in the sidebar stays stale because the component isn't mounted to recompute.

### The Fix

Lift Personal Info's status derivation into `portal-layout.tsx` so it runs at the shell level, independent of which tab is active.

The shell already owns:
- The cross-section registry (and the derived `subjectCrossSectionRequirements`)
- The `sectionStatuses` state object

What needs to move to the shell:
- Fetching Personal Info field definitions (the `/personal-info-fields` response)
- Fetching Personal Info saved values (from the `/saved-data` response — the shell already fetches this for workflow acknowledgment hydration)
- Running `computePersonalInfoStatus(fields, savedValues, crossSectionRequirements)` whenever any of those three inputs change

### Implementation Approach

1. **Shell fetches Personal Info fields once** — add a fetch to `/personal-info-fields` in the shell's initial data load (alongside the existing structure and saved-data fetches). Store the result in shell state.

2. **Shell extracts Personal Info saved values from the existing saved-data response** — the shell already fetches `/saved-data` for workflow acknowledgment hydration. Personal Info's saved values are in that same response under the personal_info section key. No additional API call needed.

3. **Shell runs computePersonalInfoStatus in a useEffect** — whenever `personalInfoFields`, `personalInfoSavedValues`, or `subjectCrossSectionRequirements` change, recompute and write to `sectionStatuses['personal_info_section_id']`.

4. **PersonalInfoSection becomes presentational for progress** — remove the status-computation effect from PersonalInfoSection. It still owns rendering, user input, auto-save, and field change handlers. It receives its field definitions from the shell as a prop (avoiding a double-fetch).

5. **PersonalInfoSection still calls onProgressUpdate for local changes** — when the candidate fills in or clears a field, the section calls `onProgressUpdate` so the sidebar updates immediately without waiting for the next auto-save round-trip. The shell's useEffect also fires on saved-data changes to handle the "registry changed while unmounted" case.

### What This Fixes

After the fix, when the candidate is on Address History and changes country:
1. Registry updates (already works)
2. Shell's `subjectCrossSectionRequirements` memo recomputes (already works)
3. Shell's new useEffect sees the change, calls `computePersonalInfoStatus` with updated requirements
4. `sectionStatuses['personal_info']` updates
5. Sidebar re-renders with the correct indicator

All of this happens without Personal Info being mounted.

### What NOT to Change

- `computePersonalInfoStatus` function — it's correct, just needs to be called from the shell
- The cross-section registry — correct
- How other sections report progress — they push status via `onProgressUpdate` from within the component, which is fine because their inputs are all local (no external registry changes affect them while unmounted)
- The existing `/saved-data` endpoint — no changes needed

### Risk Mitigation

- **No double-fetch:** Shell passes field definitions to PersonalInfoSection as a prop. The section does NOT fetch `/personal-info-fields` itself.
- **No double-write:** The shell's useEffect and PersonalInfoSection's `onProgressUpdate` both write to the same `sectionStatuses` key. Use `setSectionStatuses` with a functional updater and early-exit (`if (prev[id] === status) return prev`) to prevent unnecessary re-renders. This pattern already exists in `handleSectionProgressUpdate`.
- **Saved data sync:** When the candidate fills in a field on Personal Info and auto-save fires, the shell's saved-data state should update to reflect the new values. The simplest approach: after a successful auto-save, update the shell's Personal Info saved-values state directly (rather than refetching `/saved-data`).

---

## Implementation Order

**Fix TD-060 first.** The API change is independent and foundational — TD-059's lifted status derivation will use the corrected `isRequired` values.

**Fix TD-059 second.** Lifting the derivation into the shell depends on the corrected field definitions from TD-060.

Both fixes can be on the same branch and go through the pipeline together.

---

## Business Rules

1. A Personal Info field is baseline-required only if `isRequired = true` in ALL DSX mapping rows for the candidate's package services and their available, non-disabled locations
2. A Personal Info field is conditionally required if `isRequired = true` in SOME but not all mapping rows — the cross-section registry handles showing/hiding the requirement based on candidate's country selections
3. A Personal Info field is never required if no mapping rows have `isRequired = true` for the candidate's package context
4. Locations included in the baseline calculation must satisfy BOTH filters: `dsx_availability.isAvailable = true` AND `Location.disabled = false` (i.e., `Location.disabled IS NOT TRUE`). A globally disabled location is excluded even if `dsx_availability` shows it as available.
5. The same context-aware filter (package services + available, non-disabled locations) must be applied to any neighboring candidate-application endpoint that performs a context-free `isRequired` lookup. Specifically, the architect must audit `saved-data/route.ts` and `structure/route.ts` and apply the fix to any file that exhibits the same pattern. All such endpoints must agree on what "required" means for a given candidate.
6. The sidebar progress indicator for Personal Info must update reactively when the cross-section registry changes, even when the candidate is on a different tab
7. The Personal Info field definitions are fetched once when the application loads and are not refetched on registry changes — the registry layering handles country-specific changes
8. No new API endpoints are created — only the existing endpoints' behavior changes
9. The `/personal-info-fields` response shape does not change — only the accuracy of `isRequired` values improves

---

## Test Cases

### TD-060 Tests

1. **Field required in ALL package locations → baseline required.** Set up a package with 2 services, each available in 2 locations. Configure a field as `isRequired: true` in all 4 mapping rows. Assert the API returns `isRequired: true`.

2. **Field required in SOME package locations → not baseline required.** Same setup but one mapping row has `isRequired: false`. Assert the API returns `isRequired: false` (the cross-section registry will handle the conditional case).

3. **Field required in a non-package service → ignored.** Configure a field as required for Service X, but the candidate's package only contains Service Y. Assert the API returns `isRequired: false` for that field.

4. **Field required in an unavailable location → ignored.** Configure a field as required for Service A in Location Z, but `dsx_availability` has `isAvailable: false` for that combination. Assert the API ignores that mapping row.

5. **Field required in a globally disabled location → ignored.** Configure a field as required for Service A in Location D, where `dsx_availability.isAvailable = true` but `Location.disabled = true`. Assert the API ignores that mapping row entirely (treat the location as if it didn't exist for this candidate).

6. **Package with no services → all fields not required.** Edge case — assert no errors and all fields return `isRequired: false`.

7. **Field has no mapping rows for package context → not required.** A field exists in `dsx_requirements` but has no `dsx_mappings` rows for the candidate's services/locations. Assert `isRequired: false`.

### TD-059 Tests

8. **Registry change updates sidebar without navigating to Personal Info.** Render the portal shell. Simulate a registry change (add a cross-section requirement). Assert the sidebar's SectionProgressIndicator for Personal Info updates to "incomplete" WITHOUT mounting PersonalInfoSection.

9. **Registry clear updates sidebar back.** After test 8, clear the registry entry. Assert the sidebar indicator returns to its previous state.

10. **Shell fetches Personal Info fields on load.** Assert that the shell makes a fetch to `/personal-info-fields` during initialization.

11. **PersonalInfoSection does not double-fetch fields.** Assert that when PersonalInfoSection mounts, it does NOT make its own fetch to `/personal-info-fields` — it uses the shell-provided prop.

12. **Local field change updates sidebar immediately.** Mount PersonalInfoSection, simulate filling in a required field. Assert the sidebar updates without waiting for auto-save.

---

## Tech Debt Addressed

- **TD-059** — Sidebar progress indicator doesn't reactively update for unmounted sections (scoped to Personal Info)
- **TD-060** — Personal info fields API computes isRequired across all countries instead of candidate's package context

## Files Likely Modified

- `src/app/api/candidate/application/[token]/personal-info-fields/route.ts` — TD-060 fix (primary)
- `src/app/api/candidate/application/[token]/saved-data/route.ts` — TD-060 audit; modify if the same context-free `isRequired` pattern is present
- `src/app/api/candidate/application/[token]/structure/route.ts` — TD-060 audit; modify if the same context-free `isRequired` pattern is present
- `src/components/candidate/portal-layout.tsx` — TD-059 fix (add field fetch, status derivation effect)
- `src/components/candidate/form-engine/PersonalInfoSection.tsx` — TD-059 (remove internal status effect, accept fields as prop)
- Test files for both
