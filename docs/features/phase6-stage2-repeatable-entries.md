# Phase 6 Stage 2: Repeatable Entry Sections — Education & Employment

This document describes the candidate-portal sections that support multiple entries per section, delivered in Phase 6 Stage 2. These replaced the Education History and Employment History placeholders with working forms.

## Scope of This Stage

- Adds repeatable entry support to the candidate application form engine.
- Wires Education History and Employment History sections to DSX field requirements per entry.
- Adds a scope-display indicator at the top of each repeatable section.
- Extends the auto-save and saved-data APIs to handle entry-based section data.

What this stage does **not** add: scope enforcement, gap-tolerance checking, address-block fields, the submit flow. Those are scheduled for later stages and Phase 7.

## Components

All components live in `src/components/candidate/form-engine/` and are client components.

### `RepeatableEntryManager`

Reusable container that renders a list of entry cards with add/remove controls. Receives `entries`, `onAddEntry`, `onRemoveEntry`, `onEntryChange`, `renderEntry`, and `entryLabelKey` (a translation key with a `{number}` placeholder for entry numbering).

Behavior:
- On viewports under 768px, switches to accordion mode — only one entry expanded at a time.
- On viewports 768px and above, all entries are expanded.
- The "Add Entry" button is debounced — rapid clicks within 500ms are ignored.
- When a new entry is added on mobile, the manager expands the newly appended entry by reading the post-update `entries` prop in an effect (rather than capturing stale state in a click handler).
- Removing the currently expanded entry on mobile expands the first remaining entry, if any.
- A short "Entry removed" confirmation appears for two seconds after a removal.

### `EducationSection`

Renders the Education History section. Props: `token`, `serviceIds` (the IDs of education services in the package).

On mount the section calls, in order:
1. `GET /api/candidate/application/[token]/scope?functionalityType=verification-edu` to drive the `ScopeDisplay`.
2. `GET /api/candidate/application/[token]/countries` to populate the per-entry country dropdown. There is no hardcoded country fallback — `Country.id` is a UUID, and any non-UUID stand-in would be rejected by the save endpoint's Zod schema.
3. `GET /api/candidate/application/[token]/saved-data` to restore previously saved entries, then `GET /api/candidate/application/[token]/fields?serviceIds=<id1>&serviceIds=<id2>&countryId=<id>` for each saved entry's selected country. **TD-084:** the call packs all package service IDs as repeated `serviceIds` params in a single request. The route OR-merges `isRequired` across all services so the displayed required-state matches the validator's view. The previous behavior issued one request per service and merged results client-side.

If there are no saved entries the section starts with one empty entry. If the countries call fails the section displays an error banner and clears the list — the candidate cannot save without a valid country UUID.

When the candidate selects a country on an entry, fields for that country are loaded once and cached by `countryId` for the rest of the session.

Fields whose `collectionTab` matches `subject` (case-insensitive substring) are filtered out — those fields belong on the Personal Information tab. Empty `collectionTab` values are kept and shown in the section.

Auto-save fires on field blur, on country change, on entry add, and on entry remove. The save trigger is debounced (500ms) and always sends the complete current `entries` array (whole-section replacement). Empty entry arrays are sent — they are how the server learns the section was cleared.

### `EmploymentSection`

Same shape as `EducationSection`, with two differences:
- Uses `verification-emp` for the scope and section type.
- Hides the end-date field on an entry when a "currently employed" field on that entry is `true`. Detection uses exact `fieldKey` matches against two fixed sets:
  - Currently-employed keys: `currentlyEmployed`, `isCurrent`, `isCurrentlyEmployed`, `currentEmployment`, `current_employment`, `currently_employed`, `is_current`, `is_currently_employed`.
  - End-date keys: `endDate`, `toDate`, `end_date`, `to_date`, `dateTo`, `date_to`.

Matching is by `fieldKey` only — display labels are localized, so name-based matching breaks for non-English DSX configurations. Substring matching is also avoided so unrelated keys like `noncurrentlyemployed` cannot match.

If DSX does not include a "currently employed" field for the selected service/country, the section just renders start and end date fields without special behavior.

### `ScopeDisplay`

Small informational banner shown above the entry list. Renders `scope.scopeDescription` exactly as returned by the scope API — the human-readable string is built server-side so localization decisions stay in one place.

### `EntryCountrySelector`

Per-entry country dropdown. Renders the native `<select>` element on viewports under 768px (for the device-native picker) and the shadcn `Select` component above that. Receives the country list via props — does not make API calls itself.

## Types

`src/types/candidate-repeatable-form.ts` defines:
- `EntryData` — the shape of a single entry (`entryId`, `countryId`, `entryOrder`, `fields[]`).
- `RepeatableSection` — `{ entries: EntryData[] }`.
- `ScopeInfo` — the response shape of the scope endpoint, including all seven `scopeType` values (`count_exact`, `count_specific`, `time_based`, `all`, `highest_degree`, `highest_degree_inc_hs`, `all_degrees`).
- `RepeatableFieldValue` — `string | number | boolean | null | string[]`. Mirrors the union accepted by `repeatableSaveRequestSchema` in the save route.
- `EntryManagerProps` — the props contract for `RepeatableEntryManager`.

`src/types/candidate-portal.ts` adds an optional `entries` array to `FormSectionData` so the same type can describe both flat-field and repeatable sections in stored form data.

## API Endpoints

Two new endpoints and two extended endpoints back this feature. Full request/response shapes live in `docs/api/candidate-application.md`.

- New: `GET /api/candidate/application/[token]/scope?functionalityType=...` — returns the scope configuration for the requested service.
- New: `GET /api/candidate/application/[token]/countries` — returns the candidate-visible country list (top-level, non-disabled).
- Extended: `POST /api/candidate/application/[token]/save` — accepts an `entries` array when `sectionType` is `education` or `employment`. Whole-section replacement.
- Extended: `GET /api/candidate/application/[token]/saved-data` — returns an `entries` array for `education` and `employment` sections.

## Scope Mapping

The `package_services.scope` JSON column stores values like `{ "type": "most-recent" }`, `{ "type": "most-recent-x", "quantity": 2 }`, `{ "type": "past-x-years", "years": 7 }`, `{ "type": "highest-degree" }`, `{ "type": "highest-degree-inc-highschool" }`, or `{ "type": "all-degrees" }`. The scope endpoint maps these to the `scopeType` values in `ScopeInfo` and produces a localized-friendly description string. An unrecognized or missing scope falls back to `{ scopeType: "all", scopeValue: null }` with a "complete history" description.

## Data Flow Notes

- Each entry's `entryId` is generated client-side using `crypto.randomUUID()` when the candidate adds an entry. The ID is stable for the lifetime of the entry.
- `entryOrder` is reassigned at save time from the entry's current array index, so the stored order always reflects the displayed order.
- The save endpoint's locked-field filtering (firstName/lastName/email/phone) only applies to `personal_info` saves and is skipped for repeatable sections.
- The fields endpoint resolves `displayOrder` for location-specific DSX requirements by joining against `service_requirements` instead of using a fixed sentinel value, so fields defined via `dsx_mappings` render in the configured order rather than alphabetical order.
