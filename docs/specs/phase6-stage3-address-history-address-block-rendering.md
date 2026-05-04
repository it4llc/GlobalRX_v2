# Phase 6, Stage 3: Address History & Address Block Rendering

**Created:** May 3, 2026
**Last Updated:** May 4, 2026
**Status:** Confirmed
**Phase:** 6 — Dynamic Application Engine
**Stage:** 3 of 4
**Prerequisites:** Phase 6 Stage 2 complete and deployed

---

## Overview

This stage delivers two things that are tightly connected: the **Address History section** and the **address block field type rendered as a real form**.

In Stage 2, Education and Employment sections were built with the RepeatableEntryManager. When a DSX field had a data type of `address_block`, it was rendered as a placeholder — a grey box that said something like "Address block coming soon." That placeholder needs to be replaced with an actual set of input fields (street, city, state/province, postal code, etc.) that the candidate can fill in.

The address block is a **DSX-configured field type**. It works the same way in every section — Education has "School Address," Employment has "Company Address," and record-type services have their own address block field (e.g., "Residence Address"). All of these are defined in DataRx, associated with services through DSX, and loaded through the fields API when the candidate selects a country. The AddressBlockInput component renders all of them the same way, reading the `addressConfig` from DataRx to know which pieces (street, city, state, etc.) to show.

The **Address History section** is used by **record-type services** (criminal searches, civil searches, bankruptcy searches, etc.). It only appears when the package contains record-type services — a package with only education and employment verification has no Address History section. The candidate enters the addresses where they've lived over a time period defined by the package scope (e.g., "all addresses in the past 7 years"). The address block fields for each entry come from DSX, just like in Education and Employment. The only thing the Address History section adds on its own is the **date fields** (from/to and "current address" checkbox), because address history entries always need dates and those aren't part of the DSX configuration today.

Once the address block component is working, it replaces the placeholder everywhere — Address History, Education, and Employment all benefit from the same upgrade.

After this stage, the candidate portal has five working sections with real forms: Personal Information, Identity Verification, Address History, Education History, and Employment History. The only remaining pieces are workflow sections (compliance documents, consent forms), document uploads, and section progress indicators — all handled in Stage 4.

---

## What This Stage Delivers

1. **AddressBlockInput component** — a reusable form that renders the individual address pieces (street, city, state/province, etc.) based on the `addressConfig` from DataRx. Handles country-specific differences (e.g., some countries don't use postal codes, some don't have states).

2. **Address History section** — uses the RepeatableEntryManager from Stage 2 to let the candidate add multiple address entries. Each entry has a country selector, the address block fields (from DSX), and date fields (from/to). Below all entries, an aggregated requirements area shows any additional fields and documents triggered by the candidate's addresses.

3. **To/from date fields in the Address History section** — the Address History section automatically adds "From" and "To" date fields to every address entry, plus a "Current address" checkbox. These are a built-in part of the section (not configured in DataRx), because address history entries always require dates. This can be moved to DataRx configuration later if other parts of the system (like manual order creation) need configurable date fields on address blocks.

4. **Subregion-level DSX field requirements at all three levels** — after a candidate enters an address, the system cascades through subregion1 (state/province), subregion2 (county), and subregion3 (city) to load additional field requirements specific to each level. Each level's dropdown populates from the geographic hierarchy in the `countries` table.

5. **DSX availability checks before loading requirements** — the fields API checks whether each record-type service is available at the candidate's location before loading its requirements. If a service isn't available, its extra fields and documents are silently skipped. The candidate is never shown availability messages — they just enter where they've lived.

6. **Aggregated requirements area with deduplication** — additional data fields and document requirements triggered by the candidate's addresses are collected, deduplicated, and displayed in a single area below the address entries. Fields are sorted by service (behind the scenes) and DSX display order, split into "Additional Information" and "Required Documents" subsections.

7. **Address block rendering in Education and Employment** — the existing placeholder for `address_block` type fields in the DynamicFieldRenderer is replaced with the real AddressBlockInput component. Education's "School Address" and Employment's "Company Address" now work.

8. **State/province/county/city dropdown population** — when the candidate selects a country, the state/province dropdown is populated from the `countries` table hierarchy. Selecting a state populates the county dropdown (if enabled), and selecting a county populates the city dropdown (if entries exist).

9. **Address dates displayed in Order Details** — the hydration function (which prepares data for the Order Details page) is updated to recognize date properties (fromDate, toDate, isCurrent) in address block values and display them alongside the address pieces. Without this, dates would be stored in the data but invisible on the Order Details page.

10. **Free-text state/county hydration support** — the hydration function detects whether a state or county value is a UUID (resolve through the countries table) or a plain string (display as-is). This handles addresses entered in countries that have no subdivisions in the database.

---

## What This Stage Does NOT Deliver

These are explicitly out of scope for Stage 3:

- **Gap detection** — checking for date gaps between address entries is a Phase 7 (Validation & Submission) feature
- **Address-to-order-item generation** — the logic that turns addresses into order items for specific jurisdictions at submission time is Phase 7
- **Workflow sections** — compliance documents and consent forms are Stage 4
- **Document upload UI** — the actual file upload component is Stage 4. Stage 3 shows which documents are required in the aggregated requirements area, but the candidate cannot upload files yet. The requirement is displayed as an informational line item (document name and instructions) with the upload functionality coming in Stage 4.
- **Section progress indicators** — Stage 4
- **Address deduplication** — detecting when the same address is entered twice (the `address_entries` table exists but is not used yet — this is a future feature)
- **Country-specific postal code format validation** — Stage 3 only validates that postal code is non-empty when required. Format validation per country is deferred to a future phase.

---

## Who Uses This

- **Candidates** filling out the application form. They enter addresses where they've lived during the scope period defined by the package. They also see address blocks rendered inline within Education and Employment entries.
- **Internal admin users** are not direct users of this stage's UI, but the data captured here flows into the Order Details page they use to review submitted applications.

---

## Section Position in the Candidate Application

The order of service sections is:

1. Personal Information
2. Identity Verification (IDV)
3. **Address History** *(position 2 in the service section ordering — added by this stage)*
4. Education History
5. Employment History

The structure endpoint must be updated to insert Address History at position 2 in the service section order whenever the package contains record-type services.

---

## How the Candidate Experiences This

### Address History Section

The candidate arrives at the "Address History" section in their application. They see a scope instruction message at the top (e.g., "Please provide all addresses where you have lived in the past 7 years"). Below that is their first address entry, expanded and ready to fill in.

For each address entry, the candidate:

1. **Selects a country** — this calls the fields API, which loads the DSX field requirements for that country and that record-type service. Among those fields will be an `address_block` type field (e.g., "Residence Address") configured in DataRx, plus possibly other fields
2. **Fills in the address** — the address block field renders as street, city, state/province (dropdown populated from the countries table), postal code, and any other pieces that are enabled in the `addressConfig` for that DSX field
3. **Enters dates** — "From" and "To" date fields appear alongside the address. These are added by the Address History section itself (not from DSX), because address history entries always need dates. If this is their current address, they can check a "Current address" checkbox and the "To" date is hidden
4. **Fills in any additional DSX fields** — if the DSX requirements for that country include other fields besides the address block (for example, a text field), those appear in the form too

When the candidate finishes one entry, they tap "Add Another Address" to create a new blank entry. They can expand/collapse entries, remove entries they've added, and reorder if needed. The RepeatableEntryManager from Stage 2 handles all of this. **At least one address entry is always present** — the candidate cannot remove the last remaining entry.

### Address Block in Education and Employment

When the candidate is filling in an Education or Employment entry and encounters a field like "School Address" or "Company Address," instead of seeing a grey placeholder, they now see the full address form inline — street, city, state, postal code. These address blocks do **not** include date fields — dates in Education and Employment are standalone DSX fields handled by Stage 2 (like "Start Date" and "End Date" or "Graduation Date").

---

## Key Concepts Explained Simply

### What is an Address Block?

In the DataRx configuration system, an "address block" is a special type of field. Instead of being a single text box (like "First Name"), it's a group of related fields — street address, apartment/suite, city, state/province, county, and postal code. Each of these sub-fields (called "pieces") can be turned on or off, made required or optional, and given a custom label. This configuration lives in the `addressConfig` property inside the DSX requirement's `fieldData`.

Address block fields are configured in DataRx, associated with services through DSX, and loaded through the fields API — the **same mechanism** used for every other field type. "School Address" in Education, "Company Address" in Employment, and "Residence Address" in Address History are all DSX-configured address block fields. The AddressBlockInput component renders them all the same way. The only difference is that the Address History section adds date fields on top of what DSX provides.

### What is addressConfig?

Each address block field in DataRx has a JSON configuration that looks like this:

```
street1:    label "Street Address",   enabled yes, required yes
street2:    label "Apt/Suite",        enabled yes, required no
city:       label "City",             enabled yes, required yes
state:      label "State/Province",   enabled yes, required yes
county:     label "County",           enabled no,  required no
postalCode: label "ZIP/Postal Code",  enabled yes, required yes
```

Different address block fields can have different configurations. For example, "School Address" might not need the county piece, while "Residence Address" in certain countries might require it.

### Default addressConfig When None Is Configured

If a DSX address block field has no `addressConfig` at all, the AddressBlockInput component applies a safe default that covers the most common worldwide address formats:

- `street1` — enabled, required
- `street2` — enabled, optional
- `city` — enabled, required
- `state` — enabled, required
- `postalCode` — enabled, required
- `county` — disabled

### How Are Dates Different Between Section Types?

This is an important distinction:

- **Address History dates** (when you lived there): These are NOT configured in DataRx. Instead, the Address History section component automatically adds "From" and "To" date fields to every address entry because address history entries always need dates — there's no scenario where an admin would want to turn them off. The dates are saved as part of the address block JSON value alongside the street/city/state data.

- **Education/Employment dates** (when you attended/worked there): These are regular DSX fields — separate from the address block. They show up as standalone date pickers in the form, managed by the DynamicFieldRenderer from Stage 1. The address block in an Education or Employment entry has no date fields — it's just the physical address.

**Future note:** If the manual order creation flow eventually needs configurable dates on address blocks (e.g., for certain countries but not others), the date configuration can be added to DataRx's `addressConfig` at that point. The rework would be small — the date UI and storage format stay the same, only the "what tells the component to show dates" part would change from a section-level flag to a DataRx configuration value.

### What Are Subregion-Level Requirements?

DSX requirements can be configured at multiple geographic levels:

- **Country level** — "For the United States, require these fields"
- **Subregion 1** (state/province) — "For Texas specifically, also require this additional field"
- **Subregion 2** (county) — "For Harris County, Texas, also require this field"
- **Subregion 3** (city) — "For Houston, Harris County, also require this field"

When the candidate first selects a country, the system loads the country-level requirements. As they fill in the address and select a state, the system checks whether there are additional requirements at the state level. If so, new fields appear dynamically. This cascading behavior means the form can adapt to local regulations without the candidate needing to know about them.

---

## The Address Block Component

### Pieces and Their Behavior

The AddressBlockInput component renders up to six input fields based on the `addressConfig`:

| Piece Key | Default Label | Input Type | Notes |
|-----------|--------------|------------|-------|
| `street1` | Street Address | Text input | Primary street address line |
| `street2` | Apt/Suite | Text input | Secondary address line (usually optional) |
| `city` | City | Text input | City or town name |
| `state` | State/Province | Dropdown | Populated from `countries` table based on selected country. If the country has no subdivisions in the database, this renders as a plain text input instead. |
| `county` | County | Dropdown or text | If subregion2 entries exist for the selected state, shows a dropdown. Otherwise, a text input. Usually disabled by default. |
| `postalCode` | ZIP/Postal Code | Text input | Postal/ZIP code |

Rules for the component:

- Only render pieces where `enabled` is `true` in the `addressConfig`
- Mark required pieces with the standard required field indicator (red asterisk or similar, matching existing form patterns)
- Use the `label` from `addressConfig` for each piece — these labels are customizable per field in DataRx
- The `state` piece stores a UUID from the `countries` table (the ID of the selected state/province row), not a text string — UNLESS the country has no subdivisions in the database, in which case it stores the typed string
- If a country has no states/provinces in the `countries` table, the `state` piece renders as a free-text input instead of a dropdown
- The `county` piece, when enabled, works similarly — if subregion2 entries exist for the selected state, show a dropdown; otherwise, show a text input
- Layout: on mobile, all pieces stack vertically (one per row). On larger screens, some pieces can share a row (e.g., city and state side by side, postal code on its own row). Follow the existing responsive patterns from Stage 1's DynamicFieldRenderer.

### Date Fields in Address History Entries

The Address History section adds date fields to every address entry automatically. These are **not** part of the `addressConfig` from DataRx — they are built into the Address History section because address entries always need time periods.

| Field | Label | Input Type | Notes |
|-------|-------|------------|-------|
| `fromDate` | From | Date picker | When the candidate moved into this address |
| `toDate` | To | Date picker | When the candidate moved out. Hidden when "Current address" is checked. |
| `isCurrent` | Current address | Checkbox | When checked, hides the "To" date field and indicates the candidate still lives here |

The AddressBlockInput component accepts a `showDates` flag. The Address History section passes `showDates={true}`. Education and Employment sections either pass `showDates={false}` or don't pass the flag at all (defaulting to no dates).

**Why not configure dates in DataRx?** Address History entries always need dates — there's no admin use case for turning them off. Education and Employment never need dates on their address blocks — those sections handle dates as separate DSX fields. So the date behavior is driven by the section type, not by per-field configuration. If the manual order creation flow eventually needs configurable dates on address blocks, this decision can be revisited and the dates can be added to `addressConfig` with minimal rework (the date UI and storage format stay the same).

### Value Storage Format

The address block value is stored as a JSON object. For a basic address block (Education/Employment):

```json
{
  "street1": "123 Main Street",
  "street2": "Apt 4B",
  "city": "Arlington",
  "state": "f53e7f72-8bbe-4017-994a-499b681bfc70",
  "postalCode": "22201"
}
```

For an Address History address block (with dates), the date fields are nested **inside** the address block's JSON value, keyed under the same DSX requirement UUID as the address block itself:

```json
{
  "street1": "123 Main Street",
  "street2": "Apt 4B",
  "city": "Arlington",
  "state": "f53e7f72-8bbe-4017-994a-499b681bfc70",
  "postalCode": "22201",
  "fromDate": "2022-03-01",
  "toDate": "2024-06-15",
  "isCurrent": false
}
```

The `fromDate`, `toDate`, and `isCurrent` keys are **not** stored as separate DSX requirement entries with synthetic UUIDs. They are properties inside the address block's value object, alongside the address pieces.

The `state` value is a UUID pointing to a row in the `countries` table at the subregion1 level **when subdivisions exist for the country**. If the country has no subdivisions, `state` is a plain string the candidate typed. The hydration logic detects which case applies (see "Free-Text State/County Hydration" below). County, if present, follows the same UUID-or-string rule.

This format matches the existing address storage pattern documented in the OrderData Hydration Design Document — no new storage format is being introduced.

---

## Address History Section

### Section Identity

- **Heading:** "Address History"
- **Functionality type:** `record` — this section appears when the package contains any record-type services (criminal, civil, bankruptcy, etc.)
- **When it does NOT appear:** If the package only has education and/or employment verification services (no record-type services), the Address History section is not shown at all
- **Position in the application:** After IDV, before Education History (position 2 in the service section ordering — see "Section Position in the Candidate Application" above)
- **One section covers ALL record-type services** — the candidate doesn't see separate sections for criminal vs. civil. They just enter where they've lived.
- **Fields come from DSX** — when the candidate selects a country, the system loads DSX field requirements for the record-type service, which includes the address block field. The section adds date fields (From/To/Current) on top of whatever DSX provides.
- **Minimum one entry always present** — the candidate cannot remove the last remaining entry. If only one entry exists, the remove button is hidden (or disabled). This is different from Education and Employment, where the candidate can remove all entries if none apply.

### Using the RepeatableEntryManager

The Address History section reuses the RepeatableEntryManager from Stage 2 with the same patterns as Education and Employment:

- Scope display at the top showing the instruction message
- Entries with expand/collapse behavior (mobile: accordion style, one at a time. Desktop: all can be expanded)
- "Add Another Address" button
- Remove button on each entry, **hidden/disabled when only one entry exists** (Address History minimum-one rule)
- Entry labels: "Address 1", "Address 2", etc.
- Country selector per entry

### Differences from Education/Employment

While the Address History section reuses the same infrastructure and the same DSX-driven field loading, there are some differences in behavior:

1. **Minimum one entry always present.** Education and Employment can have zero entries if none apply. Address History always has at least one — the candidate cannot remove the last entry.

2. **The section adds date fields on top of DSX fields.** The address block itself is loaded from DSX just like "School Address" or "Company Address." But the Address History section wraps "From," "To," and "Current address" around it because address history entries always need dates. Education and Employment don't do this — their dates are separate DSX fields.

3. **"Current address" checkbox** — when checked, the "To" date field is hidden and the system treats the end date as "present." Only one entry at a time should have "Current address" checked. If the candidate checks "Current address" on a new entry, the previous one should be unchecked automatically.

4. **Additional DSX fields are less common** — most address history entries only need the address block itself plus the section-added dates. But the system still supports additional DSX fields per country, loaded the same way as Education/Employment.

5. **Scope is always time-based for records** — education can have count-based scopes ("most recent 2"), but address history scopes are typically time-based ("all in past 7 years") or "all." The ScopeDisplay component already handles both types.

### Auto-Save Data Shape

When the Address History section auto-saves, the data follows the same pattern as Education/Employment from Stage 2, with one addition: a top-level `aggregatedFields` object stores values entered in the aggregated requirements area below the entries.

```json
{
  "sectionType": "address_history",
  "entries": [
    {
      "entryId": "uuid-of-entry",
      "countryId": "uuid-of-country",
      "fields": {
        "dsx-requirement-uuid-for-address-block": {
          "street1": "123 Main St",
          "city": "Arlington",
          "state": "uuid-of-virginia",
          "postalCode": "22201",
          "fromDate": "2022-03-01",
          "toDate": null,
          "isCurrent": true
        }
      }
    }
  ],
  "aggregatedFields": {
    "dsx-requirement-uuid-1": "value entered by candidate",
    "dsx-requirement-uuid-2": "another value"
  }
}
```

Notes about the saved shape:

- The address block value (including `fromDate`, `toDate`, `isCurrent`) is stored as the value for its DSX requirement field ID, just like any other field. The difference is that the value is a JSON object instead of a simple string. The dates are nested inside that object, NOT stored as separate fields with synthetic requirement IDs.
- `aggregatedFields` is a flat key-value object, keyed by `dsx_requirements.id` (the requirement UUID). Each value is whatever the candidate entered for that aggregated additional field.
- **Document requirements in the aggregated area do NOT have values yet in Stage 3.** Documents are tracked only as "which are required" — no candidate-entered data for those until Stage 4 delivers the upload UI.

---

## Subregion-Level Field Requirements

### How It Works — Two Types of Calls

There are two distinct things that happen as the candidate fills in an address, and it's important to separate them because they have very different timing:

**1. Dropdown population (lightweight, happens immediately as selections are made)**

When the candidate selects a country, the state/province dropdown needs to populate. When they select a state, the county dropdown needs to populate (if enabled). When they select a county, the city dropdown needs to populate (if entries exist). These are fast, lightweight calls to the subdivisions API — they just return a list of names and IDs so the next dropdown can render. These happen immediately on each selection because the candidate needs the dropdown to be populated before they can make the next choice.

**2. Requirement and availability loading (one call, after the address is complete)**

Once the candidate has finished entering the address — meaning they've selected the most specific geographic level available (state, or county if county is enabled, or city if city entries exist) — the system makes **one** call to the fields API, passing the most specific subregion ID. This single call checks DSX availability and loads all additional requirements for that location in one response. The candidate fills in the entire address top to bottom without interruption, and the requirement loading happens after they're done.

This approach avoids mid-entry loading spinners and keeps the address entry experience smooth. The candidate isn't bouncing back and forth between address fields and requirement fields — they complete the address, then any additional requirements appear.

### The Full Flow

1. Candidate selects a country → system loads country-level DSX fields (existing behavior) and populates the state/province dropdown via the subdivisions API
2. Candidate fills in street, city, and selects a state/province
3. If county is enabled in addressConfig, the county dropdown populates via the subdivisions API. If not, the address is considered complete at this point.
4. If county is enabled, candidate selects a county. If subregion3 (city) entries exist for that county, the city dropdown populates. Otherwise, the address is considered complete.
5. If city dropdown appeared, candidate selects a city. Address is now complete.
6. Once the address is complete (the most specific geographic selection has been made), the system makes **one** call to the fields API, passing the most specific subregion ID
7. The API checks DSX availability for each record-type service at every level in the hierarchy (country → subregion1 → subregion2 → subregion3 as applicable)
8. The API loads DSX mappings at every level and merges them, returning the combined set of additional requirements
9. Any additional data field or document requirements appear in the aggregated requirements area below the entries

When the candidate changes a geographic selection, everything below that level resets (dropdowns clear, the requirement loading for that entry is invalidated, and the aggregated requirements area recalculates).

### API Change

The existing fields API endpoint needs a small extension. Currently it accepts a country ID. It needs to also accept an optional subregion ID:

**Current:** `GET /api/candidate/application/[token]/fields?serviceId=xxx&countryId=xxx`

**Updated:** `GET /api/candidate/application/[token]/fields?serviceId=xxx&countryId=xxx&subregionId=xxx`

When `subregionId` is provided, the API handles the full hierarchy in one call:
1. Still returns all country-level requirements (same as before)
2. Walks up the geographic hierarchy from the provided subregion ID to determine all ancestor levels (e.g., if a subregion3 city ID is provided, the API resolves its parent county, its grandparent state, and the country)
3. Checks `dsx_availability` for each record-type service at every level in the hierarchy — if a service is not available at any level, its additional requirements for that level are excluded (but the address block field is still returned so the candidate can record where they lived)
4. Checks `dsx_mappings` at every level and merges the results
5. Returns the combined set of requirements across all levels
6. If a requirement exists at multiple levels, the most specific level's mapping takes precedence (it might change `isRequired` from false to true, for example)

The key point: the client makes **one call** with the most specific subregion ID, and the API does all the hierarchy walking internally. The client doesn't need to make separate calls for each level.

### When Requirements Are Loaded

The requirement loading is triggered **once per entry**, when the candidate has completed their geographic selections:

- If the address has only a country (no subdivisions exist) → requirements loaded after country selection (this is the existing Stage 1 behavior)
- If the address has country + state → requirements loaded after state selection
- If the address has country + state + county → requirements loaded after county selection
- If the address has country + state + county + city → requirements loaded after city selection

The system determines "completeness" by checking whether the next level of subdivisions exists. If no county entries exist for the selected state, the address is complete at the state level. There's no need for the candidate to take any explicit action — the system detects when the most specific level has been selected.

If the candidate changes a geographic selection after requirements have loaded, the previous requirements for that entry are cleared and the system waits for the address to be complete again before making a new call.

### What the Candidate Sees

The candidate fills in the address uninterrupted — street, city, state, county (if applicable), postal code. There are no loading spinners mid-entry. After they finish the address and move on, any additional requirements appear in the aggregated area below all entries.

If no additional requirements exist for that location (which will be the common case for many countries), nothing appears — the candidate just continues filling in the next address or moves on.

**Important:** The candidate does not see any message about whether a search is available or unavailable at their location. They just enter where they've lived. If a service isn't available at a particular location, the system simply doesn't load additional requirements for that service at that location. The address itself is still collected because it's needed for scope coverage.

---

## State/Province Dropdown Population

### Data Source

The state/province values come from the `countries` table, which stores a geographic hierarchy:

- Countries have `parentId = null`
- States/provinces have `parentId` pointing to their country
- Counties have `parentId` pointing to their state
- Cities have `parentId` pointing to their county or state

### API for Geographic Data

A new API endpoint is needed to fetch subdivisions:

`GET /api/candidate/application/[token]/subdivisions?parentId=xxx`

This returns all non-disabled entries in the `countries` table where `parentId` matches the provided ID, sorted alphabetically by name. It returns the `id`, `name`, and `code2` for each entry.

This endpoint is called at every level of the hierarchy:
- When the candidate selects a country → fetches states/provinces for that country
- When the candidate selects a state → fetches counties for that state (if county piece is enabled in addressConfig)
- When the candidate selects a county → fetches cities for that county (if subregion3 entries exist)

### Subdivisions API Security

The subdivisions endpoint follows the **same security pattern as every other candidate API endpoint**:

- **Token validation** — the `[token]` route segment is validated against `candidate_invitations.invitationToken`
- **401 Unauthorized** — invalid or missing token
- **403 Forbidden** — token does not match the requested resource or candidate session
- **404 Not Found** — token has no matching invitation
- **410 Gone** — invitation token has expired (per the same expiration check used by `/fields`, `/save`, `/saved-data`, `/scope`)

No new auth pattern is introduced — the standard candidate-token middleware/utility used by the existing endpoints applies here as well.

### Handling Locations Without Subdivisions

At any level, the subdivisions API may return an empty list. When this happens:

- The dropdown for that level renders as a **free-text input** instead. For example, if a country has no states in the database, the state piece becomes a text input. If a state has no counties, the county piece (if enabled) becomes a text input.
- The value stored is the text the candidate typed, not a UUID
- The subregion-level field requirement loading is skipped for that level and all levels below it (no subregion ID to look up)

The AddressBlockInput component needs to handle both modes: dropdown (when subdivisions exist) and text input (when they don't).

---

## DSX Availability Checks

### Why This Matters

There's no point asking the candidate for additional data or documents for a search that can't actually be run in a particular location. For example, if criminal record searches aren't available in a certain country, the system shouldn't load document requirements specific to criminal searches for that country.

### How It Works

The fields API checks the `dsx_availability` table before returning requirements. For each record-type service in the package, at each geographic level (country, subregion1, subregion2, subregion3):

1. Check `dsx_availability` for the service at that location
2. If the service **is available** (or no availability entry exists, meaning it defaults to available): load its DSX field and document requirements for that location
3. If the service **is not available**: skip its requirements for that location. The address block field is still returned (because the candidate still needs to enter the address for scope coverage), but no additional fields or documents for that unavailable service are loaded

### What the Candidate Does NOT See

The candidate is never told "this search isn't available in your location." They just enter where they've lived. The system silently skips requirements for unavailable services. This is intentional — availability information is internal operational detail, not something the candidate needs to think about.

### Per-Service Availability

Because a package can include multiple record-type services (criminal, civil, bankruptcy), availability is checked per service. It's possible that criminal searches are available in a location but civil searches are not. In that case, requirements specific to criminal searches would load, but civil-specific requirements would not.

---

## Aggregated Requirements Area

### The Problem

When the candidate enters multiple addresses, each address may trigger additional field and document requirements from DSX. Some of these requirements will overlap — for example, two Australian addresses both need the AFP form for criminal searches, but the candidate should only be asked for it once.

Showing requirements inline within each address entry creates deduplication problems: if Address 1 and Address 2 are both in Australia, the AFP form would appear twice. And if the candidate deletes Address 1, the requirement would need to move to Address 2.

### The Solution

Below all the address entries in the Address History section, an **aggregated requirements area** collects all the additional field and document requirements triggered by the candidate's addresses. Requirements are deduplicated — each unique requirement appears exactly once, regardless of how many addresses triggered it.

The area has a heading: **"Based on your address history, we need the following additional information:"**

This heading only appears when there are actually additional requirements to show. If no addresses triggered any extra requirements (which will be common for many packages), this area is completely hidden.

### What Goes Where

- **Address block** — always inline within each entry. Each address is unique, so there's nothing to deduplicate.
- **Date fields** (from/to/current) — always inline within each entry. Same reason.
- **Additional data fields from DSX** (non-address-block fields) — go in the aggregated requirements area, deduplicated across all entries.
- **Document requirements from DSX** — go in the aggregated requirements area, deduplicated across all entries.

### Layout and Sort Order

The aggregated requirements area is divided into two subsections:

1. **Additional Information** — all data field requirements
2. **Required Documents** — all document requirements

Within each subsection, requirements are sorted by:
- **First:** Grouped by service (using the same fixed service type ordering used elsewhere — criminal, civil, bankruptcy, etc.). The service name is NOT shown to the candidate — it's only used as the behind-the-scenes sort key.
- **Second:** Within each service group, sorted by DSX display order (the `displayOrder` field on `service_requirements`)

The candidate sees a flat list of fields and a flat list of documents. No service-level headings or groupings are visible.

### Document Requirement Display Fields (Stage 3)

For Stage 3, each document line in the "Required Documents" subsection shows ONLY:

- **Document name** — from `dsx_requirements.name`
- **Instructions** — from `documentData.instructions` on the requirement

That's it. No file type list, no size limits, no upload button. The full upload UI (with file types, size limits, file picker, progress indicator) is delivered in Stage 4.

### Deduplication Rules

- A requirement is identified by its `dsx_requirements.id` (the requirement UUID)
- If the same requirement appears for multiple addresses (same country, or multiple addresses in the same subregion), it appears only once in the aggregated area
- The `isRequired` flag uses the **most restrictive value across the candidate's full address history**. If a requirement is optional in one country but required in another country (and the candidate has addresses in both), the requirement displays as required in the aggregated area. The rule is: **if ANY address triggers the requirement as required, it is shown as required.**

### Dynamic Recalculation

The aggregated requirements area recalculates whenever entries change:

- **Candidate adds a new address with a new country** → new requirements may appear in the aggregated area
- **Candidate changes an address's country or subregion** → requirements recalculate. Old requirements that are no longer needed (because no remaining address triggers them) disappear. New ones may appear.
- **Candidate removes an address** → if the removed address was the only one triggering a particular requirement, that requirement disappears from the aggregated area
- **Auto-save** — the aggregated requirements area values auto-save alongside the address entries, using the same save mechanism

### Document Requirements Before Stage 4

Stage 4 delivers the actual document upload UI. In Stage 3, document requirements appear in the aggregated area as informational line items showing the document name and instructions from DSX. The candidate can see what documents will be needed, but cannot upload them yet. Stage 4 replaces these informational line items with functional upload components.

---

## Integration with Education and Employment

### What Changes in the DynamicFieldRenderer

In Stage 1, the DynamicFieldRenderer was built to handle different field data types: `text`, `date`, `number`, etc. For `address_block`, it rendered a placeholder.

In Stage 3, the DynamicFieldRenderer is updated so that when it encounters a field with `dataType: "address_block"`, it renders the AddressBlockInput component instead of the placeholder.

The DynamicFieldRenderer passes:
- The `addressConfig` from the field's `fieldData` (so the component knows which pieces to show)
- The current value (the JSON object)
- An onChange handler
- The selected country ID (so the component can load the state/province dropdown)
- `showDates={false}` (since Education/Employment address blocks don't have dates)

### What Changes for Education/Employment Sections

The Education and Employment section components themselves do NOT need to change. The address block rendering upgrade happens entirely inside the DynamicFieldRenderer, which these sections already use. When the DynamicFieldRenderer encounters an `address_block` field, it now renders the real component instead of the placeholder — the section components don't need to know about this change.

The only thing Education/Employment sections need to handle is passing the selected country ID down to the DynamicFieldRenderer (which they likely already do from Stage 2, since country-level DSX loading was part of that work).

### Auto-Save Compatibility

The auto-save format for Education/Employment entries doesn't change. The `address_block` field value was always expected to be a JSON object — Stage 2 just couldn't populate it because the input component was a placeholder. Now the real component produces the correct JSON object, and the existing save/load pipeline handles it unchanged.

---

## Order Details Display — Address Dates and Free-Text Hydration

### The Problem (Dates)

When an order is submitted and viewed in the Order Details page, the address block values are displayed using the hydration function (from the OrderData Hydration Design Document). That function reads the `addressConfig` to decide which pieces to display. Since dates (fromDate, toDate, isCurrent) are NOT part of the `addressConfig` — they're a section-level behavior — the hydration function would skip them. The dates would be sitting in the stored JSON data but invisible on the Order Details page.

### The Fix (Dates)

The hydration function's address resolver needs a small addition. After it processes all the normal `addressConfig` pieces (street, city, state, postal code), it also checks the JSON value for `fromDate`, `toDate`, and `isCurrent`. If any of these are present in the stored data, it adds them to the display output.

The display logic:

- If `fromDate` is present, show it with the label "From" and format it as a readable date
- If `toDate` is present, show it with the label "To" and format it as a readable date
- If `isCurrent` is `true` and `toDate` is absent or null, show "To: Present" instead of a date
- Date pieces appear after the address pieces in the display (street, city, state, postal code, then from, then to)

This means the hydration function doesn't need to know *why* dates are there — it just checks the stored value for date properties and displays them if found. This keeps the hydration function simple and forward-compatible. If dates are eventually added to `addressConfig` through DataRx, the explicit date handling in the hydration function can be removed and the standard piece-rendering logic will take over.

### The Problem (Free-Text State/County Values)

The hydration function currently assumes that `state` and `county` values are UUIDs and resolves them by looking them up in the `countries` table. But when a country has no subdivisions in the database, the candidate types a free-text value, which is stored as a plain string — not a UUID. The current resolver would fail to look it up and either show nothing or show the raw string in an inappropriate place.

### The Fix (Free-Text)

The hydration function's address resolver checks whether each `state` (and `county`) value looks like a UUID before resolving:

- If the value matches the standard UUID format → look it up in the `countries` table and display the resolved `name`
- If the value is a plain string (no UUID format) → display the value as-is

The check is a simple format test (UUID v4 regex). No database lookup is attempted for non-UUID values. This handles both legacy and new data without requiring any data migration.

### Where These Changes Happen

The address resolver function inside the hydration service. This is the same function that currently resolves state UUIDs to readable names and builds the `addressPieces` array. The changes are small — roughly 10-15 lines of additional code after the existing piece-processing loop, plus a UUID format check inside the existing resolution lookup.

---

## Validation Rules

Stage 3 implements **field-level validation** — checking that required pieces within an address block are filled in. Broader validation (scope enforcement, gap detection) is Phase 7.

### Address Block Piece Validation

For each address block:
- Every piece marked `required: true` in the `addressConfig` must have a non-empty value
- Validation runs on blur (when the candidate moves out of the field), matching the existing auto-save trigger pattern
- Validation errors display inline below the specific piece, using the same error styling as other form fields

### Postal Code Validation

For Stage 3, postal code validation is **non-empty only** when the postal code piece is required in the `addressConfig`. Country-specific format validation (e.g., US ZIP `NNNNN` or `NNNNN-NNNN`, UK postal code patterns, Canada `A1A 1A1`) is **deferred to a future phase**.

### Date Validation (Address History Only)

For address history entries:
- "From" date is required
- "To" date is required unless "Current address" is checked
- "From" date must be before "To" date (if both are present)
- Dates must be reasonable — not in the future, not before 1900
- Date format follows the existing date picker pattern from Stage 1

### Required vs. Optional Pieces

The `addressConfig` determines which pieces are required. The system respects this configuration — if DataRx says postal code is optional for a particular address field in a particular country, the form doesn't require it even if it's normally required elsewhere.

---

## Translation Keys

New translation keys needed for Stage 3. These follow the existing pattern of `candidate.` prefix used in Stage 1 and Stage 2:

```
candidate.addressHistory.title = "Address History"
candidate.addressHistory.addAnother = "Add Another Address"
candidate.addressHistory.entryLabel = "Address {number}"
candidate.addressHistory.currentAddress = "Current address"
candidate.addressHistory.fromDate = "From"
candidate.addressHistory.toDate = "To"
candidate.addressHistory.removeConfirm = "Remove this address?"

candidate.addressBlock.street1 = "Street Address"
candidate.addressBlock.street2 = "Apt/Suite"
candidate.addressBlock.city = "City"
candidate.addressBlock.state = "State/Province"
candidate.addressBlock.county = "County"
candidate.addressBlock.postalCode = "ZIP/Postal Code"
candidate.addressBlock.selectState = "Select state/province"
candidate.addressBlock.selectCounty = "Select county"
candidate.addressBlock.selectCity = "Select city"
candidate.addressBlock.loadingSubdivisions = "Loading..."
candidate.addressBlock.noSubdivisions = "No subdivisions available"

candidate.aggregatedRequirements.heading = "Based on your address history, we need the following additional information:"
candidate.aggregatedRequirements.additionalInformation = "Additional Information"
candidate.aggregatedRequirements.requiredDocuments = "Required Documents"
candidate.aggregatedRequirements.documentUploadPending = "Upload will be available soon"
```

Note: The `addressConfig` labels from DataRx take precedence over these translation keys when available. These translation keys serve as fallback defaults and are used for pieces where no DataRx label is configured.

---

## Data Requirements

This section is the single source of truth for every field that appears in the UI, database, or API for Stage 3. Field names listed here are the **immutable** identifiers used in code, JSON storage, and API contracts. UI labels are display-only and may differ across translations.

### Address Block Pieces (per addressConfig from DataRx)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Street Address | street1 | text | Required when `addressConfig.street1.enabled` and `.required` are true | Non-empty when required | — |
| Apt/Suite | street2 | text | Optional unless `addressConfig.street2.required` is true | Non-empty when required | — |
| City | city | text | Required when `addressConfig.city.enabled` and `.required` are true | Non-empty when required | — |
| State/Province | state | text (UUID when subdivisions exist; free-text string when they don't) | Required when `addressConfig.state.enabled` and `.required` are true | Non-empty when required. UUID when a subdivision dropdown is present; otherwise free string | — |
| County | county | text (UUID when subdivisions exist; free-text string when they don't) | Optional unless `addressConfig.county.enabled` and `.required` are true. County is disabled by default. | Non-empty when required. UUID when a subdivision dropdown is present; otherwise free string | — |
| ZIP/Postal Code | postalCode | text | Required when `addressConfig.postalCode.enabled` and `.required` are true | Non-empty only for Stage 3 (no country-specific format check) | — |

### Address History Section Date Fields (added by the section, not DSX)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| From | fromDate | date | Required | Must not be in the future. Must not be before 1900-01-01. Must be on or before `toDate` when `toDate` is present. | — |
| To | toDate | date | Required unless `isCurrent` is true | Must not be in the future. Must not be before 1900-01-01. Must be on or after `fromDate`. Hidden in UI when `isCurrent` is true. | — |
| Current address | isCurrent | boolean | Optional | Only one entry across the section may have `isCurrent` = true at a time. Setting `true` on a new entry must clear it on any other entry. | false |

### Address History Section Entry Fields

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (Country selector) | countryId | text (UUID) | Required | Must reference a non-disabled `countries` row where `parentId IS NULL` | — |
| (Internal entry identifier) | entryId | text (UUID) | Required | Generated client-side when entry is created | — |

### Address History Section Saved Shape (top-level keys in `draftData` for the section)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (Section type marker) | sectionType | text | Required | Always lowercase string `'address_history'` | `'address_history'` |
| (Address entries array) | entries | array of entry objects | Required | Minimum length 1 (Address History always has at least one entry) | `[]` is invalid for this section; first load creates one empty entry |
| (Aggregated requirement values) | aggregatedFields | object (keyed by `dsx_requirements.id` UUID) | Optional | Each key is a DSX requirement UUID. Each value is whatever the candidate entered for that aggregated additional field. Document requirements have NO entries here in Stage 3. | `{}` |

### Per-Entry Field Map (inside `entries[].fields`)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (DSX requirement UUID → value) | fields | object keyed by `dsx_requirements.id` | Required | Each key is the UUID of a DSX requirement. For `address_block` requirements, the value is a JSON object containing the address pieces and (for Address History only) `fromDate`, `toDate`, `isCurrent` nested inside. For other data types, the value matches the type. | `{}` |

### Subdivisions API Response Item

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (Subdivision row id) | id | text (UUID) | Required | Matches `countries.id` | — |
| (Display name) | name | text | Required | Matches `countries.name` | — |
| (ISO code) | code2 | text | Optional | Matches `countries.code2` | — |

### Aggregated Requirements Area Items

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (Requirement id) | requirementId | text (UUID) | Required | Matches `dsx_requirements.id` | — |
| (Display name shown to candidate) | name | text | Required | From `dsx_requirements.name` | — |
| (Field data type) | dataType | text | Required | One of the existing DSX data types | — |
| (Field data blob, for non-document types) | fieldData | json | Optional | Parsed from `dsx_requirements.fieldData` | — |
| (Document instructions, for documents) | instructions | text | Optional | From `documentData.instructions` on the requirement | — |
| (Required flag) | isRequired | boolean | Required | Computed as the most restrictive across the candidate's full address history — if ANY triggering address marks the requirement as required, this is `true` | false |
| (Behind-the-scenes sort key) | serviceTypeOrder | number | Required | Used for sorting only — never displayed | — |
| (Within-service sort) | displayOrder | number | Required | From `service_requirements.displayOrder` | — |

### Document Requirement Display (Stage 3 only)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| (Document name) | name | text | Required | From `dsx_requirements.name` | — |
| (Instructions) | instructions | text | Optional | From `documentData.instructions` | — |

Stage 4 will extend this with `acceptedFileTypes`, `maxFileSizeMb`, upload state, file metadata, etc.

### Default addressConfig Fallback (when none configured)

| Piece | Enabled | Required |
|---|---|---|
| street1 | true | true |
| street2 | true | false |
| city | true | true |
| state | true | true |
| county | false | false |
| postalCode | true | true |

**Status value reminder:** every status string anywhere in the saved shape is lowercase (e.g., `'address_history'`). Never Title Case. Never UPPER CASE.

**fieldKey reminder:** the keys in `entries[].fields` and `aggregatedFields` are the DSX requirement UUIDs (`dsx_requirements.id`), not the `fieldKey`. The `fieldKey` is camelCase and immutable, but the storage shape used here is keyed by requirement UUID for stability across label and field-key edits.

---

## Business Rules Summary

These are the rules that the implementation must enforce:

1. **Address History only appears when the package has record-type services.** If the package only has education and employment verification, no Address History section is shown.

2. **One section for all record-type services.** Even if the package has criminal, civil, and bankruptcy services, the candidate sees one "Address History" section.

3. **Address History always has a minimum of one entry.** The candidate cannot remove the last entry. The remove button is hidden or disabled when only one entry exists. This is different from Education and Employment, which allow zero entries.

4. **Address history dates are a built-in section behavior, not a DataRx configuration.** The Address History section always renders From/To date fields and a "Current address" checkbox on every entry. The AddressBlockInput component receives a `showDates` flag to control this.

5. **Address history dates are stored nested inside the address block's value object**, keyed under the same DSX requirement UUID as the address block itself. They are NOT stored as separate fields with synthetic requirement IDs.

6. **Education/Employment dates are standalone DSX fields.** They are NOT part of the address block. The AddressBlockInput does not render dates for Education/Employment.

7. **Only one "Current address" entry at a time.** Checking "Current address" on one entry unchecks it on any other entry that had it checked.

8. **Country selection drives field requirements.** When the candidate selects a country, the fields API is called to load the DSX requirements for that country.

9. **Subregion dropdowns cascade through all three levels.** Selecting a state populates the county dropdown (if enabled). Selecting a county populates the city dropdown (if entries exist). Changing a selection clears everything below it. These are lightweight subdivision lookups only — requirement loading waits until the address is complete.

10. **Requirements load once per entry after address completion.** When the candidate has made their most specific geographic selection, one API call loads all additional requirements across all hierarchy levels. The API walks the hierarchy internally — the client sends the most specific subregion ID and gets back merged results from all levels.

11. **DSX availability is checked before loading requirements.** The fields API checks `dsx_availability` for each record-type service at each geographic level. If a service is not available at a location, its additional requirements are silently skipped. The address block is always returned regardless of availability.

12. **The candidate never sees availability messages.** No "search not available" notifications. Requirements for unavailable services are simply not loaded.

13. **Address block pieces respect the addressConfig.** Only enabled pieces are shown. Required pieces are validated. Labels come from the addressConfig.

14. **When no addressConfig is configured, the safe default is used:** street1 (required), street2 (optional), city (required), state (required), postalCode (required), county (disabled).

15. **Dropdowns populated from the countries table at every level.** State/province, county, and city dropdowns pull from the geographic hierarchy. Each falls back to free-text input when no subdivisions exist at that level.

16. **State/county values are stored as UUIDs when a dropdown was used, and as plain strings when free-text input was used.** The hydration layer detects which case applies by checking whether the stored value matches the UUID format.

17. **Additional requirements aggregate below entries, deduplicated.** Data field and document requirements triggered by addresses are collected across all entries, deduplicated by requirement ID, and displayed in an aggregated area below the address entries. No per-entry display of non-address-block requirements.

18. **Aggregated requirements are split into two subsections.** "Additional Information" for data fields and "Required Documents" for document requirements. Within each, sorted by service (hidden from candidate) then DSX display order.

19. **Aggregated requirements recalculate when entries change.** Adding, removing, or changing an address triggers recalculation. Requirements that are no longer needed by any entry disappear.

20. **Deduplication uses the most restrictive isRequired value across the full address history.** If a requirement is optional in one country and required in another (and the candidate has addresses in both), it shows as required. The rule: if ANY address triggers the requirement as required, it is required.

21. **Auto-save on field blur** — same pattern as Stages 1 and 2. Address block values and aggregated requirement values auto-save as JSON objects.

22. **The address block component is reusable.** It works in Address History (with dates), Education (without dates), and Employment (without dates).

23. **Address dates display in Order Details.** The hydration function detects fromDate/toDate/isCurrent in stored address block values and includes them in the display output. Address blocks without dates (from Education/Employment) display normally without dates.

24. **Document requirements in Stage 3 show only name and instructions.** No file types, no size limits, no upload UI. Full upload comes in Stage 4.

25. **Postal code validation in Stage 3 is non-empty only.** Country-specific format validation is deferred.

26. **Subdivisions API enforces the standard candidate token security.** 401 for missing/invalid token, 403 for token mismatch, 404 for unknown invitation, 410 for expired token.

27. **Section ordering in the candidate application:** Personal Info → IDV → Address History → Education → Employment. The structure endpoint inserts Address History at position 2 in the service section ordering.

---

## User Flow — Address History Section

### First Visit (No Saved Data)

1. Candidate navigates to the Address History section
2. Scope instruction displays at the top (e.g., "Please provide all addresses where you have lived in the past 7 years")
3. One empty address entry is shown, expanded, labeled "Address 1." The remove button on this entry is hidden/disabled because it is the last (and only) entry.
4. Candidate selects a country from the dropdown
5. System loads country-level DSX fields and populates the state/province dropdown
6. Candidate fills in street, city, selects state, enters postal code. If county is enabled and counties exist for the selected state, the county dropdown populates. Same for city if subregion3 entries exist.
7. Once the candidate has made their most specific geographic selection, the system makes one call to load all additional requirements and check availability across all levels
8. Candidate enters "From" date
9. If this is their current address, they check "Current address." Otherwise, they enter a "To" date
10. Auto-save triggers on each field blur
11. If the address triggered any additional data field or document requirements, they appear in the aggregated requirements area below the entries
12. Candidate taps "Add Another Address" to create a second entry. Once a second entry exists, the remove button on the first entry becomes available.
13. Repeat for additional addresses until the scope period is covered
14. As more entries are added, the aggregated requirements area updates — new requirements may appear, but duplicates are never shown

### Return Visit (Saved Data Exists)

1. Candidate navigates to the Address History section
2. Scope instruction displays
3. Previously saved entries load and display with their data populated
4. Aggregated requirements area loads based on saved entries
5. Candidate can edit existing entries or add new ones (subject to the minimum-one rule)
6. Changes auto-save on field blur

### Edge Cases

- **Candidate starts filling in an address, then changes the country**: Previously entered address fields are cleared, and new fields load for the new country. A confirmation prompt warns them before clearing. The aggregated requirements area recalculates.
- **Candidate selects a state, sees additional fields, then changes the state**: The subregion1-specific fields are cleared, county and city dropdowns reset, and new fields load for the new state (if any exist). Subregion2 and subregion3 fields are also cleared.
- **Candidate changes a county**: Subregion2-specific fields clear. City dropdown resets. Subregion3 fields clear.
- **Country with no states in the database**: The state piece renders as a free-text input. No subregion-level requirement loading occurs at any level.
- **Candidate tries to remove the only address**: The remove control is not available. They can change the contents of that entry, but cannot delete it.
- **Candidate removes the only address for a particular country (when other addresses still exist)**: Any requirements in the aggregated area that were only triggered by that address disappear.
- **Two addresses in the same country**: Requirements appear only once in the aggregated area (deduplication).
- **Same requirement marked required in one country and optional in another**: It appears as required in the aggregated area (most restrictive wins).

---

## Edge Cases and Error Scenarios

- **Required address piece left blank** → inline validation error appears below the piece on blur, using the standard error styling. Auto-save still occurs but the section is marked incomplete.
- **Candidate lacks a valid token / token expired** → API endpoints return 401/403/404/410 as appropriate, matching the existing candidate API security pattern. The UI shows the standard "session expired" message used elsewhere in the candidate portal.
- **Network failure during auto-save** → existing Stage 1 retry behavior applies. The candidate sees the standard auto-save failure indicator.
- **Subdivisions API returns empty list** → the relevant level's input falls back to free-text. No error shown to candidate.
- **Subdivisions API returns an error** → relevant level's dropdown shows the existing inline error UI from Stage 1's data-loading patterns. The candidate can still proceed by typing a value if the input falls back to text mode.
- **Fields API returns an error during requirement loading** → the aggregated requirements area shows a recoverable error state. The address pieces remain editable.
- **No `addressConfig` on a DSX address_block field** → the safe default is applied (see Default addressConfig Fallback above). No error.
- **Stale subdivision/requirement responses after a country/subregion change** → in-flight requests are tagged with the geographic selection at the time they were fired. Responses for stale selections are discarded.
- **Candidate checks "Current address" on a new entry while another entry already had it checked** → the previous entry's `isCurrent` is set to false silently and that entry's "To" date field reappears (with whatever value was previously stored, or empty if none).
- **`fromDate` is after `toDate`** → inline validation error.
- **Postal code is empty when required** → inline validation error.
- **State value in storage looks like a UUID but doesn't resolve to a `countries` row** → hydration falls back to displaying the raw value (no crash, no empty cell). This handles renamed/disabled subdivision rows.
- **Disabled `countries` row used by older saved data** → still resolves by ID for display purposes (disabled rows are filtered for new selections only, not for hydration).

---

## Impact on Other Modules

- **Candidate Workflow** — primary module for this stage. Adds the AddressBlockInput component, the Address History section, the aggregated requirements area, and the subdivisions endpoint. Modifies the fields endpoint and the DynamicFieldRenderer.
- **Order Details (admin view)** — the hydration service used by Order Details gains date awareness in address blocks and free-text state/county handling. Existing addresses without dates continue to render unchanged.
- **Global Configurations / DataRx** — no changes to admin UI in this stage. The component reads existing `addressConfig` and `dsx_availability` data unchanged. The configuration shape is unchanged.
- **Customer Configurations** — no changes.
- **User Admin** — no changes.
- **Structure endpoint** — must be updated to insert Address History at position 2 in the service section ordering whenever the package contains record-type services.

---

## Definition of Done

This feature is complete when **all** of the following are true. Each item is a checkable acceptance criterion that becomes a basis for tests.

1. AddressBlockInput component exists and renders only the pieces enabled by the supplied `addressConfig`.
2. AddressBlockInput marks pieces as required per the `addressConfig` and applies the standard required-field indicator.
3. AddressBlockInput uses the supplied label per piece, falling back to the default labels (and translation keys) when not provided.
4. When no `addressConfig` is supplied, AddressBlockInput applies the safe default piece set (street1 required, street2 optional, city required, state required, postalCode required, county disabled).
5. AddressBlockInput renders date fields (`fromDate`, `toDate`, `isCurrent`) when `showDates={true}`, and never renders them when `showDates={false}` or absent.
6. The `state` piece renders as a dropdown when subdivisions exist for the selected country, and as a free-text input when none exist.
7. The `county` piece, when enabled, renders as a dropdown when subdivisions exist for the selected state, and as a free-text input when none exist.
8. The `state` and `county` values are stored as UUIDs when chosen from a dropdown, and as plain strings when typed into a free-text input.
9. The DynamicFieldRenderer renders AddressBlockInput for any DSX field with `dataType: "address_block"`, replacing the Stage 2 placeholder.
10. The Address History section appears in the candidate application whenever the package contains any record-type service, and does not appear otherwise.
11. The Address History section is positioned at index 2 of the service section ordering (after IDV, before Education).
12. The Address History section uses the RepeatableEntryManager and ScopeDisplay from Stage 2.
13. The Address History section always renders at least one entry. The remove control is hidden or disabled when only one entry exists.
14. Adding a new entry, expanding/collapsing, and removing entries (subject to the minimum-one rule) all work using the existing Stage 2 controls.
15. Only one entry across the section may have `isCurrent = true` at a time. Checking it on a new entry unchecks the previous one automatically.
16. Auto-save fires on field blur and persists the section in the saved shape documented in "Auto-Save Data Shape," including `sectionType`, `entries`, and `aggregatedFields`.
17. Date fields in Address History are stored nested inside the address block's value object, keyed under the address block's DSX requirement UUID — not as separate fields with synthetic requirement IDs.
18. Re-loading the section after auto-save produces an identical visible state.
19. Subdivisions endpoint exists at `GET /api/candidate/application/[token]/subdivisions?parentId=xxx`, returns `id`, `name`, `code2` for non-disabled child rows, sorted alphabetically by name.
20. Subdivisions endpoint enforces the standard candidate-token security pattern: 401 (missing/invalid token), 403 (token mismatch), 404 (no matching invitation), 410 (expired token).
21. Fields endpoint accepts an optional `subregionId` parameter and walks the geographic hierarchy internally, merging requirements from all applicable levels.
22. Fields endpoint checks `dsx_availability` for each record-type service at every level. Requirements for unavailable services are silently skipped while the address block field itself is still returned.
23. State/county/city dropdowns populate via the subdivisions endpoint as the candidate makes selections. Changing a selection at any level clears all dropdowns below it and invalidates any in-flight or completed requirement load for that entry.
24. Requirement loading is triggered exactly once per entry, after the candidate has made their most specific geographic selection (no mid-entry loading spinners).
25. Stale subdivision and requirement responses are discarded when the geographic selection has changed since the request was fired.
26. The aggregated requirements area renders below the address entries when at least one address triggers an additional requirement, and is hidden otherwise.
27. The aggregated requirements area is divided into "Additional Information" (data fields) and "Required Documents" (documents).
28. Items in the aggregated area are sorted first by service type (using the existing fixed service ordering, hidden from the candidate) and then by `displayOrder` from `service_requirements`.
29. The aggregated area deduplicates requirements by `dsx_requirements.id` — each unique requirement appears exactly once.
30. The deduplicated `isRequired` flag uses the most restrictive value across the full address history (if ANY address triggers the requirement as required, it is required).
31. Aggregated area recalculates when an entry is added, removed, or has its country/subregion changed. Requirements no longer triggered by any entry disappear; new ones appear.
32. Document requirements in the aggregated area show **only** the document name (from `dsx_requirements.name`) and instructions (from `documentData.instructions`). No upload UI.
33. Aggregated additional-field values save into `aggregatedFields`, keyed by `dsx_requirements.id`. Document requirements have no values stored in Stage 3.
34. The hydration service's address resolver displays `fromDate`, `toDate`, and `isCurrent` when present in stored address values, formatted as readable dates, with "Present" shown when `isCurrent` is true and `toDate` is empty.
35. The hydration service's address resolver displays state/county values that are plain strings (not UUIDs) as-is, without attempting database resolution.
36. Education and Employment sections from Stage 2 render real address forms (no more placeholder) for any `address_block` DSX field.
37. Existing Stage 2 auto-save and saved-data behavior continues to work unchanged for Education and Employment.
38. Address piece validation runs on blur and shows inline errors for empty required pieces, including non-empty postal code when required.
39. Date validation runs on blur: `fromDate` required, `toDate` required unless `isCurrent`, dates not in the future, dates not before 1900, `fromDate` ≤ `toDate`.
40. All status values in saved data are lowercase strings (e.g., `'address_history'`).
41. All translation strings in the new UI come from translation keys (no hardcoded user-facing English).
42. No inline `style={{}}` is used in any new component.
43. No `console.*` logging in any new code; structured logging via Winston where logging is needed; PII never logged.
44. No use of TypeScript `any` in new code.
45. All net-new code paths and the modified hydration logic have tests at the appropriate level (unit, integration, or component) following `docs/TESTING_STANDARDS.md`. Test counts are confirmed via raw bash output, not self-report.
46. `pnpm build`, `pnpm typecheck`, `pnpm lint`, and `pnpm vitest run` all pass with zero net regression vs. the baseline at the start of the stage.

---

## Dependencies on Previous Stages

### From Stage 1 (Core Form Engine)

- **DynamicFieldRenderer** — receives the address block upgrade in this stage
- **Auto-save system** — address block values save through the same auto-save pipeline
- **Fields API** (`/api/candidate/application/[token]/fields`) — extended with optional `subregionId` parameter
- **Save API** (`/api/candidate/application/[token]/save`) — no changes needed, already accepts JSON field values
- **Saved-data API** (`/api/candidate/application/[token]/saved-data`) — no changes needed, already returns JSON field values

### From Stage 2 (Repeatable Entries)

- **RepeatableEntryManager** — reused as-is for Address History entries (with the minimum-one rule applied at the section level)
- **ScopeDisplay** — reused as-is
- **EntryCountrySelector** — reused as-is
- **Scope API** (`/api/candidate/application/[token]/scope`) — reused as-is
- **Entries save/load pattern** — the same `entries` array format used by Education/Employment

---

## New Components

| Component | Purpose |
|-----------|---------|
| `AddressBlockInput` | Reusable address form — renders pieces based on addressConfig, optionally includes dates |
| `AddressHistorySection` | Section component for address history — uses RepeatableEntryManager, loads scope, manages entries, includes aggregated requirements area, enforces the minimum-one-entry rule |
| `AggregatedRequirements` | Displays deduplicated additional field and document requirements below address entries, split into "Additional Information" and "Required Documents" subsections |

## Modified Components

| Component | Change |
|-----------|--------|
| `DynamicFieldRenderer` | Replace `address_block` placeholder with real AddressBlockInput component |
| Fields API route | Add optional `subregionId` parameter, DSX availability checks, subregion-level requirement loading at all 3 levels |
| Address resolver (hydration service) | Add date awareness — check for fromDate/toDate/isCurrent in address block values and include them in the display output for Order Details. Add UUID-vs-string detection for state/county values so free-text inputs hydrate correctly. |
| Structure endpoint | Insert Address History at position 2 in service section ordering when the package has any record-type services |

## New API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/candidate/application/[token]/subdivisions` | GET | Fetch geographic subdivisions (states, counties, cities) for a parent location. Standard candidate-token security (401/403/404/410). |

## Modified API Endpoints

| Endpoint | Change |
|----------|--------|
| `/api/candidate/application/[token]/fields` | Accept optional `subregionId` parameter. Check `dsx_availability` before loading requirements — skip requirements for unavailable services. Merge subregion-level DSX mappings with country-level results. Works for subregion1, subregion2, and subregion3. |

---

## Database Changes

**No schema changes are required for Stage 3.** All the tables and columns needed already exist:

- `countries` table has the geographic hierarchy (country → state → county → city)
- `dsx_requirements` table has `addressConfig` in `fieldData`
- `dsx_mappings` table supports location-specific requirement mappings at any level
- `dsx_availability` table tracks which services are available at which locations
- `service_requirements` table has `displayOrder` for sort order within the aggregated requirements area
- `candidate_invitations` table has `draftData` for auto-save storage
- `order_data` table stores address values as JSON strings (for submitted orders)

---

## Testing Priorities

### Must Test — Address Block Component

1. AddressBlockInput renders only enabled pieces from addressConfig
2. AddressBlockInput marks required pieces correctly
3. AddressBlockInput shows date fields when `showDates` is true, hides them when false
4. AddressBlockInput applies the safe default piece set when no `addressConfig` is supplied
5. State/province dropdown populates from countries table for the selected country
6. State/province falls back to text input when no subdivisions exist
7. County dropdown populates from subregion2 entries when county piece is enabled
8. City dropdown populates from subregion3 entries when they exist
9. "Current address" checkbox hides the "To" date field
10. Only one entry can have "Current address" checked at a time
11. Changing country clears previously entered address data (with confirmation)
12. Address block value saves as correct JSON format with dates nested inside (Address History) or without dates (Education/Employment)
13. DynamicFieldRenderer renders AddressBlockInput for address_block data type
14. Address block works correctly in Education and Employment sections (no dates)
15. State value stored as UUID when dropdown was used; as plain string when free-text was used

### Must Test — Subregion Cascading and Requirement Loading

16. Subdivisions API populates state dropdown after country selection
17. Subdivisions API populates county dropdown after state selection (if county enabled and entries exist)
18. Subdivisions API populates city dropdown after county selection (if subregion3 entries exist)
19. Changing a state clears county/city dropdowns and invalidates previous requirement load for that entry
20. Changing a county clears city dropdown and invalidates previous requirement load for that entry
21. Requirements load in one call after the most specific geographic selection is made
22. The fields API walks the hierarchy internally — client sends one subregion ID, API returns requirements from all levels
23. Requirements from all hierarchy levels are merged correctly (country + subregion1 + subregion2 + subregion3)
24. Stale requirement responses are discarded when geographic selection changed since the request was fired

### Must Test — DSX Availability

25. Fields API skips additional requirements for services that are not available at the selected location
26. Fields API still returns the address block field even when a service is unavailable (address still needed for scope)
27. Availability is checked per service — available services load requirements, unavailable ones don't
28. No availability message is shown to the candidate

### Must Test — Aggregated Requirements Area

29. Additional data fields from DSX appear in the aggregated area, not inline in entries
30. Document requirements appear in the aggregated area under "Required Documents" with name and instructions only (no upload UI)
31. Same requirement triggered by multiple addresses appears only once (deduplication)
32. Removing an address recalculates — requirements unique to that address disappear
33. Adding an address with a new country adds new requirements to the aggregated area
34. Requirements sorted by service then DSX display order
35. No service names visible to the candidate
36. Aggregated area hidden when no additional requirements exist
37. Deduplication uses most restrictive isRequired value across the full address history
38. Aggregated additional-field values save into `aggregatedFields`, keyed by DSX requirement UUID

### Must Test — Address History Section

39. Address History section uses RepeatableEntryManager correctly
40. Address History section enforces minimum one entry — remove control hidden/disabled when only one entry exists
41. Address History section appears at position 2 in service section ordering when package has record-type services
42. Address History section does NOT appear when package has no record-type services
43. Auto-save works for address block fields, date fields (nested in address block JSON), and aggregated requirement values
44. Saved address data loads correctly on return visit
45. Aggregated requirements area loads correctly on return visit

### Must Test — Subdivisions API Security

46. Subdivisions endpoint returns 401 when token is missing or invalid
47. Subdivisions endpoint returns 403 when token does not match the requested resource
48. Subdivisions endpoint returns 404 when token is not found in `candidate_invitations`
49. Subdivisions endpoint returns 410 when the invitation token has expired

### Edge Cases to Test

50. Country with no subdivisions at any level — all geographic dropdowns fall back to text input, requirements loaded after country selection only
51. addressConfig with all pieces disabled except street1 and city
52. Address block with no addressConfig at all — fallback to default piece set is applied
53. Rapid country changes — no race conditions in subdivision loading
54. Candidate changes state after requirement call was fired — stale response is discarded
55. Two addresses in same country, different states — requirements load independently per entry but aggregate correctly
56. Service available at country level but not at subregion level — subregion requirements skipped for that service
57. Candidate attempts to remove the only entry — remove control is unavailable, entry remains
58. Postal code blank when required — inline validation error; non-empty value (in any format) passes for Stage 3

### Hydration / Order Details Display

59. Hydration function includes fromDate and toDate in display output when present in stored address value
60. Hydration function shows "Present" for toDate when isCurrent is true
61. Hydration function works normally for address blocks that have no date properties (Education/Employment addresses)
62. Date pieces appear after address pieces in the display order
63. Hydration function detects free-text state/county values (non-UUID format) and displays them as-is, without attempting database resolution
64. Hydration function continues to resolve UUID state/county values via the countries table

---

## Estimated Complexity

**High.** This is the most complex stage in Phase 6. It introduces the AddressBlockInput component (with conditional date rendering, dynamic dropdown population at three geographic levels, and multiple rendering contexts), the aggregated requirements area (with deduplication logic and dynamic recalculation), DSX availability checks, a new API endpoint, an extension to an existing API, and integration across three section types. The cascading subregion loads and the aggregated requirements recalculation both require careful state management to avoid race conditions and stale data.

---

## Risks

1. **Countries table data completeness** — if states/provinces are missing from the database for a particular country, the dropdown will be empty and the system will fall back to text input. This is safe but means subregion-level requirements can't be enforced for those countries.

2. **Subdivision API performance** — the lightweight subdivision calls (populating dropdowns) should be fast, but if a country has hundreds of states/provinces, the dropdown could be slow to render. Consider whether the subdivisions API needs pagination for very large lists, though in practice most countries have a manageable number of subdivisions.

3. **addressConfig variations** — different address block fields may have very different configurations. The component needs to handle any combination of enabled/disabled/required pieces gracefully.

4. **Address block in three contexts** — the same component is used in Address History (with dates), Education (without dates), and Employment (without dates). Testing all three contexts is important.

5. **Race conditions with geographic changes** — if the candidate changes a geographic selection after the requirement call has been fired but before the response returns, the stale response needs to be discarded. This is simpler than the original cascading approach but still needs handling, especially with multiple entries being edited.

6. **Aggregated requirements recalculation complexity** — every time an entry is added, removed, or has its country/subregion changed, the aggregated requirements area must recalculate. The deduplication logic needs to be efficient enough to not cause UI lag, especially with many entries.

7. **DSX availability data completeness** — if availability data hasn't been populated for a location, the system needs a sensible default (likely treating the service as available). Missing availability data should not cause errors or block the candidate.

8. **Most-restrictive isRequired across countries** — the deduplication logic must compare `isRequired` across all triggering addresses (not just within one country). Implementations that only consider the latest-added address's requirement flag will produce incorrect results.
