# Phase 6, Stage 2: Repeatable Entry Sections — Education & Employment History

**Created:** May 1, 2026
**Status:** Confirmed
**Phase:** 6 — Dynamic Application Engine
**Stage:** 2 of 4
**Prerequisites:** Phase 6 Stage 1 complete and deployed

---

## Overview

This stage adds the ability for a candidate to enter **multiple items** within a single section — and uses it to deliver the **Education History** and **Employment History** sections.

In Stage 1, the Personal Information and IDV sections were simple — one set of fields per section. Education and Employment are different: the candidate needs to enter multiple schools or multiple jobs, each with its own country selection, its own set of fields, and its own start/end dates. The number of entries they need to provide is driven by the **scope** setting on the package (e.g., "most recent 2 degrees" or "all jobs in the past 5 years").

After this stage, the candidate portal has four working sections with real forms: Personal Information, Identity Verification, Education History, and Employment History. The remaining placeholders (Address History, workflow sections, document uploads) are handled in Stages 3 and 4.

---

## What Gets Built

1. **Repeatable Entry Manager** — A reusable component that handles the "add entry / remove entry" pattern. It manages a list of entries within a section, lets the candidate add new entries and remove ones they've added, and tracks which entry is currently being edited. This is reusable — Stage 3 (Address History) will also use it.

2. **Entry-Level Country Selector** — Unlike IDV where there's one country selector for the whole section, Education and Employment sections need a country selector *per entry*. Each school or job could be in a different country, and each country drives different DSX fields. When the candidate picks a country for a specific entry, only that entry's fields update.

3. **Education History Section** — Replaces the current Education History placeholder with a working form. The candidate can add education entries (schools, universities, etc.), pick the country for each one, and fill in the fields that DSX requires for that service and country. The section header shows how many entries the candidate needs to provide based on the package scope.

4. **Employment History Section** — Replaces the current Employment History placeholder with a working form. Same pattern as Education — multiple entries, country selector per entry, DSX-driven fields. Employment entries include start and end date fields, with a "current" option for a job the candidate still holds.

5. **Scope Display** — A visual indicator at the top of each section that tells the candidate what's expected of them. For example: "Please provide your most recent 2 education entries" or "Please provide all employment for the past 5 years." The scope comes from the package's configuration for each service.

6. **Scope Information API** — A new endpoint that returns the scope requirements for a given section, so the form knows what to display and how many entries to expect.

7. **Auto-Save Extended for Multiple Entries** — The auto-save system from Stage 1 is extended to handle multiple entries within a section. Each entry's data is saved separately, keyed by a unique entry identifier. Adding or removing an entry also triggers a save.

---

## What Is NOT in This Stage

- No address block fields (street, city, state, zip as a group) — that's Stage 3
- No address history section — that's Stage 3
- No gap tolerance detection or enforcement (checking for gaps between employment dates) — that's Phase 7
- No scope validation enforcement (preventing the candidate from submitting with too few entries) — that's Phase 7
- No workflow section content (before/after sections) — that's Stage 4
- No document uploads — that's Stage 4
- No section progress indicator — that's Stage 4
- No submission button — that's Phase 7
- No "Other" functionality type sections — deferred to future

---

## Forward-Looking Note: Subregion-Level Field Requirements

DSX field requirements can be configured at more granular levels than just the country — they can vary by subregion1 (e.g., state/province), subregion2 (e.g., county), and subregion3 (e.g., city). For example, an education entry in Ontario might require different documents than one in Quebec.

In this stage, the candidate's entry flow is: select country → fields load based on the country. The country drives which fields appear because that's the only location information available at that point.

In the future, when address blocks are fully working (Stage 3), the flow for education and employment entries will naturally expand: select country → enter address (which includes state/province, city, etc.) → the address provides the subregion information → the system can use the subregion to load more specific field requirements if they exist in DSX.

**The implementer does NOT need to build subregion-based field loading in this stage.** Country-level field loading is sufficient for now. This note is here so the architecture decisions (per-entry country selection, the fields API accepting location parameters) are understood to be intentionally compatible with finer-grained requirements later. When subregion-level loading is added, it will be a refinement to the fields API call — not a rethinking of the section architecture.

---

## Forward-Looking Note: Two Kinds of Dates — Don't Confuse Them

There are two different kinds of "start date / end date" in the candidate application, and they work differently:

**Education and Employment dates (this stage):** These are standalone DSX fields — just like institution name, degree type, or job title. They describe *when the candidate attended the school or held the job*. They are configured in DataRx as individual fields and rendered by the Dynamic Field Renderer like any other field. The portal does not need to do anything special to associate them with a particular entry — they are simply fields within that entry.

**Address History dates (Stage 3):** These describe *when the candidate lived at a particular address*. These dates are part of the address block itself — they are defined within the address block field type in DataRx, not as separate standalone fields. When the portal renders an address block in the Address History section, the from/to dates come along as part of that block, structurally tied to the address they belong to.

**Why this matters:** If the implementer sees date fields in education or employment entries, those are regular DSX fields — nothing special needs to happen. They should NOT be confused with address history dates, which are a built-in part of the address block and will be handled as part of the address block rendering in Stage 3. The two date concepts look similar to the candidate but are architecturally different.

---

## Important Context from Stage 1

- The Dynamic Field Renderer already exists and handles text, date, number, email, phone, select, checkbox, and radio field types, plus a locked mode and address_block placeholder
- The fields API at `GET /api/candidate/application/[token]/fields` already returns DSX fields for a service + country combination
- The save API at `POST /api/candidate/application/[token]/save` already stores candidate data
- The saved-data API at `GET /api/candidate/application/[token]/saved-data` already loads previously saved data
- Auto-save on blur is already working
- The Auto-Save Indicator component already exists
- The structure endpoint already returns the section list with service sections grouped by functionality type
- `collectionTab` filtering (separating personal info fields from service fields) is already in place

---

## Important Context from Design Decisions

- **One education service and one employment service per package.** A package will only ever contain one education verification service and one employment verification service. There is no need to merge or combine multiple services of the same type within a single section.
- **Order items do NOT exist yet.** They are created at submission time in Phase 7. All in-progress data is stored as draft data.
- **All-or-nothing submission.** The candidate must complete all sections before they can submit. There is no partial submission.
- **One candidate per order.** Each invitation creates exactly one order for one candidate.

---

## New API Endpoint

### GET /api/candidate/application/[token]/scope

**What it does:** Returns the scope requirements for a specific section/functionality type within the candidate's package. The form uses this to display the scope instructions and to know the minimum/expected number of entries.

**How it works:**
1. Validates the candidate session (using the `candidate_session` cookie)
2. Looks up the invitation by token and confirms it's still valid (not expired, not completed)
3. Accepts `functionalityType` as a query parameter (e.g., `verification-edu` or `verification-emp`)
4. Finds the single service in the package that matches that functionality type (there is always exactly one education service and one employment service per package)
5. Reads the scope configuration from the package_services table for that service
6. Returns the scope details in a format the form can display

**Query parameters:**
- `functionalityType` (required) — which functionality type to get scope for (e.g., `verification-edu`, `verification-emp`)

**Response shape:**
```
{
  functionalityType: "verification-edu",
  serviceId: "uuid",
  scopeType: "count_specific",
  scopeValue: 2,
  scopeDescription: "Most recent 2 education entries"
}
```

**Scope types and their meaning:**

| scopeType | scopeValue | What the candidate is told |
|-----------|-----------|---------------------------|
| `count_exact` | 1 | "Please provide your most recent education entry" |
| `count_specific` | 2 (or any number) | "Please provide your most recent 2 education entries" |
| `time_based` | 3 (number of years) | "Please provide all education in the past 3 years" |
| `all` | null | "Please provide all education history" |

**Error responses:**
- 401 — no valid candidate session
- 403 — token doesn't match the session
- 404 — invitation not found
- 410 — invitation expired or already completed
- 400 — missing or invalid functionalityType

**Security:** Same as all other candidate APIs — session and token must match. A candidate cannot access another candidate's scope information.

---

## Modified Existing APIs

### POST /api/candidate/application/[token]/save — Extended

The save endpoint from Stage 1 needs to be extended to handle multiple entries within a section. The request body now supports an `entryId` field and new section types.

**Updated request body:**
```
{
  sectionType: "education" or "employment",
  sectionId: "section-identifier",
  entryId: "entry-uuid",
  countryId: "uuid-of-selected-country" or null,
  fields: [
    {
      requirementId: "uuid",
      value: "Harvard University"
    },
    ...
  ]
}
```

**New fields:**
- `entryId` — A unique identifier for this specific entry within the section. Generated on the front end when the candidate adds a new entry. Used to keep entries separate in storage.
- `countryId` — The country the candidate selected for this entry. Stored alongside the field values so the correct fields can be loaded when the data is reloaded.

**The save format in storage must support:**
- Multiple entries per section (each with their own `entryId`)
- A `countryId` per entry
- Field values per entry
- The order of entries (so they display in the same order when reloaded)

**Deleting an entry:** When a candidate removes an entry, the front end sends a save request for the section with the removed entry no longer included. The save endpoint replaces the entire section's data (all entries) rather than updating individual entries. This keeps the logic simple — the front end always sends the complete current state of the section.

### GET /api/candidate/application/[token]/saved-data — Extended

The response must now include entry-based data for education and employment sections.

**Updated response shape for entry-based sections:**
```
{
  sections: {
    "personal_info": { ... same as Stage 1 ... },
    "idv": { ... same as Stage 1 ... },
    "education": {
      entries: [
        {
          entryId: "uuid",
          countryId: "uuid",
          fields: [
            { requirementId: "uuid", value: "Harvard University" },
            { requirementId: "uuid", value: "2018-09-01" },
            ...
          ]
        },
        {
          entryId: "uuid",
          countryId: "uuid",
          fields: [ ... ]
        }
      ]
    },
    "employment": {
      entries: [ ... same structure as education ... ]
    }
  }
}
```

---

## New UI Components

### 1. Repeatable Entry Manager

A reusable component that manages a list of entries within a section. It handles adding, removing, and navigating between entries.

**What the candidate sees:**
- A list of their entries (e.g., "Education 1", "Education 2" or "Employment 1", "Employment 2") — each one can be expanded to show its fields or collapsed to save space
- An "Add Entry" button at the bottom of the list to add a new entry
- A "Remove" button on each entry (except when only one entry exists and it's required)
- A visual indicator showing which entry is currently being edited

**How it works internally:**
- Maintains a list of entry objects, each with a unique `entryId` (generated when the entry is created)
- When a new entry is added, it creates an empty entry with a new `entryId` and optionally expands it for editing
- When an entry is removed, it removes it from the list and triggers a save of the updated section data
- Passes entry data (entryId, countryId, field values) up to the parent section component for saving

**Add/Remove behavior:**
- The "Add Entry" button is always visible (no hard limit on entries in the UI — scope validation that enforces limits is in Phase 7)
- The "Remove" button appears on every entry. If the candidate removes all entries, the section shows an empty state with just the "Add Entry" button
- When an entry is removed, a brief confirmation is shown (e.g., "Entry removed") but no confirmation dialog — the candidate can just add a new one if they made a mistake

**Mobile behavior:**
- On mobile, entries should use a card-style layout — each entry is a distinct card that can be expanded/collapsed
- The "Add Entry" button must be a large, easy-to-tap touch target (at least 44px tall)
- The "Remove" button should be accessible but not so prominent that it's tapped accidentally — placed at the top-right corner of the entry card, or at the bottom

### 2. Education History Section

A section component that replaces the Education History placeholder. Uses the Repeatable Entry Manager for managing multiple entries.

**How it works:**
1. Calls the scope API to get the scope requirements for `verification-edu`
2. Displays the scope instructions at the top (e.g., "Please provide your most recent 2 education entries")
3. Loads any previously saved entries from the saved-data API
4. For each entry, renders a country selector and the DSX-driven fields for the selected country
5. Uses the Dynamic Field Renderer from Stage 1 for individual fields
6. Auto-save triggers on field blur, same as Stage 1, but now includes the `entryId` and `countryId`

**What the candidate sees:**
- Section heading: "Education History"
- Scope instruction message below the heading
- Their entries (or one empty entry if starting fresh)
- Each entry has: a country dropdown at the top, then the DSX-driven fields below it
- "Add Entry" button at the bottom
- "Remove" button on each entry
- Auto-save indicator

**Country selection behavior (per entry):**
- Each entry has its own country dropdown
- When the candidate picks a country, the fields for that entry load based on the DSX requirements for the education service + that country
- Changing the country on one entry does NOT affect other entries
- If the candidate changes the country on an entry, the previously entered data for the old country is preserved in auto-save storage, and the form shows the new country's fields. If the candidate switches back, the old data is reloaded.

**Field filtering:** Same as IDV in Stage 1 — fields with a `collectionTab` indicating personal info are filtered OUT. They already appear in the Personal Information section.

### 3. Employment History Section

Same pattern as Education History, but for employment entries (`verification-emp` functionality type).

**Differences from Education:**
- Section heading: "Employment History"
- Scope instruction uses employment-specific language (e.g., "Please provide all employment for the past 5 years")
- Employment entries typically include start date, end date, and a "Currently employed here" option
- When "Currently employed here" is checked, the end date field is hidden or disabled and the system uses today's date as the effective end date

**"Currently employed here" behavior:**
- This is entirely driven by DSX. The portal does NOT create or hardcode this field — it is a regular DSX field configured in DataRx, just like any other field (institution name, job title, etc.)
- If the DSX configuration for the employment service includes a "current employment" checkbox/toggle field, the Dynamic Field Renderer renders it like any other field
- The only special portal behavior: if a field with a `fieldKey` like `currentlyEmployed` or `isCurrent` (the exact key depends on DSX configuration) exists in the entry and its value is `true`, the portal hides the end date field in that same entry — the candidate doesn't need to enter an end date for their current job
- If DSX does not include a "currently employed" field for a given service/country, the section just shows start and end date fields without this special behavior — the portal doesn't add anything on its own

**Note on gap tolerance:** The design document describes gap tolerance checking for employment (detecting gaps between jobs and requiring the candidate to account for them). **This is NOT part of Stage 2.** Gap detection and enforcement are part of Phase 7 (Validation & Submission). In this stage, the candidate simply adds entries and fills them in — there is no checking for gaps between dates.

### 4. Scope Display Component

A small, informational component shown at the top of the Education and Employment sections. It tells the candidate what's expected.

**What it shows:**
- A friendly message explaining how many entries are needed
- The message adapts based on the scope type:
  - Count exact: "Please provide your most recent education entry"
  - Count specific: "Please provide your most recent 2 education entries"
  - Time-based: "Please provide all education for the past 3 years"
  - All: "Please provide your complete education history"

**Visual treatment:**
- Not an error or warning — more of a helpful instruction
- Should be subtle but clearly readable (e.g., a light info box or just styled text below the section heading)
- On mobile, it should not take up too much vertical space

---

## Data Storage

### How entry-based data is stored

Each section's data is stored as a collection of entries. Each entry contains:

| Field | What it contains |
|-------|-----------------|
| `entryId` | A unique identifier for this entry, generated on the front end when the entry is created (UUID format) |
| `countryId` | The country the candidate selected for this entry |
| `entryOrder` | The position of this entry in the list (1, 2, 3...) so entries display in the correct order when reloaded |
| Field values | The individual field values, each identified by `requirementId` |

**The save approach must extend whatever storage approach Stage 1 implemented** (either JSON blob on the invitation or individual rows in order_data with a draft marker). The key addition is that education and employment sections have multiple entries, each with their own countryId and field values.

**If Stage 1 used the JSON blob approach (Option A):** The JSON structure on the invitation's `draftData` column would look like:
```
{
  "personal_info": { fields: [...] },
  "idv": { countryId: "...", fields: [...] },
  "education": {
    entries: [
      { entryId: "...", countryId: "...", entryOrder: 1, fields: [...] },
      { entryId: "...", countryId: "...", entryOrder: 2, fields: [...] }
    ]
  },
  "employment": {
    entries: [
      { entryId: "...", countryId: "...", entryOrder: 1, fields: [...] }
    ]
  }
}
```

**If Stage 1 used individual rows (Option B):** Each entry's fields would be stored as rows in `order_data`, with the `entryId` stored alongside the data to group fields by entry.

The implementer should follow whichever approach Stage 1 established and extend it consistently.

---

## Business Rules

1. **Session required** — All endpoints require a valid `candidate_session` cookie. No anonymous access.

2. **Token-session match** — The token in the URL must match the token in the candidate's session.

3. **Invitation must be valid** — The invitation must not be expired and must not already be completed.

4. **Each entry has its own country** — Unlike IDV where one country applies to the whole section, each education or employment entry has its own country selector. The DSX fields shown for each entry depend on that entry's selected country.

5. **One service per type per package** — A package contains exactly one education verification service and one employment verification service. There is no merging or combining of multiple services within a section.

6. **Scope is informational in this stage, not enforced** — The scope display tells the candidate how many entries are expected, but the system does NOT prevent the candidate from having fewer or more entries than the scope requires. Enforcement happens in Phase 7.

7. **Fields are filtered by collectionTab** — Same as Stage 1. Fields with a personal info `collectionTab` are NOT shown in the Education or Employment sections — they already appear in the Personal Information section.

8. **Entry IDs are generated on the front end** — When the candidate clicks "Add Entry," a new UUID is generated in the browser. This ID stays with the entry for its lifetime and is used to key the saved data.

9. **Auto-save includes entry context** — When auto-save fires, it sends the `entryId` and `countryId` along with the field values, so the system knows which entry the data belongs to.

10. **Removing an entry removes its data** — When the candidate removes an entry, the next auto-save sends the complete list of remaining entries. The deleted entry's data is no longer included.

11. **Entry order is preserved** — Entries must be displayed in the same order the candidate created them. The order is stored and restored on reload.

12. **Changing country on an entry preserves old data** — If the candidate changes the country on an entry, the old country's data is kept in storage. If they switch back to the old country, the old data is restored. This is the same behavior as the IDV section in Stage 1.

13. **No validation enforcement** — Required field indicators are shown (from Stage 1's Dynamic Field Renderer), but the form does not prevent the candidate from leaving fields empty or having too few entries. Enforcement is Phase 7.

14. **No gap tolerance** — The form does not check for gaps between employment dates. This is Phase 7.

15. **No limit on number of entries in the UI** — The candidate can add as many entries as they want. Scope is informational only in this stage.

---

## User Flow

### First visit — Education History (scope: "most recent 2")

1. Candidate clicks "Education History" in the sidebar
2. The section loads and shows the scope instruction: "Please provide your most recent 2 education entries"
3. One empty entry card is shown by default, with a country dropdown at the top
4. Candidate selects a country (e.g., "United States") for the first entry
5. Fields load for that country — things like institution name, degree type, field of study, dates attended (whatever DSX requires)
6. Candidate fills in the fields, with auto-save happening on each field blur
7. Candidate clicks "Add Entry" to add a second entry
8. A new empty entry card appears with its own country dropdown
9. Candidate selects a different country (e.g., "United Kingdom") for the second entry
10. Different fields load — the UK might require different information than the US
11. Candidate fills in the second entry
12. Both entries are visible in the section, and the candidate can click on either to view/edit it

### First visit — Employment History (scope: "all in past 5 years")

1. Candidate clicks "Employment History" in the sidebar
2. The section loads and shows the scope instruction: "Please provide all employment for the past 5 years"
3. One empty entry card is shown with a country dropdown
4. Candidate selects a country and fills in the job details
5. If the DSX configuration includes a "Currently employed here" field, the candidate can check it to indicate this is their current job — the end date field is hidden
6. Candidate clicks "Add Entry" to add previous jobs
7. Candidate continues adding entries until they've covered their employment history

### Return visit (previously saved entries exist)

1. Candidate logs in and clicks "Education History"
2. The section loads with their previously saved entries already populated
3. Each entry shows the correct country and field values
4. Candidate can edit any entry, add new entries, or remove entries
5. Changes are auto-saved

### Removing an entry

1. Candidate has three employment entries
2. They click "Remove" on the second entry
3. A brief "Entry removed" message appears
4. The entry disappears from the list
5. The remaining entries are renumbered (Employment 1 and Employment 2, previously Employment 1 and Employment 3)
6. Auto-save fires with the updated list of entries

### Changing country on an existing entry

1. Candidate has an education entry with "United States" selected and fields filled in
2. They change the country to "Canada"
3. The US fields disappear and the Canadian fields load
4. The US data is preserved in auto-save (keyed by entry + country)
5. If the candidate changes back to "United States," their previously entered US data reappears

---

## Edge Cases and Error Scenarios

| Scenario | What should happen |
|----------|-------------------|
| No education services in the package | The "Education History" section does not appear in the sidebar at all. The structure endpoint already handles this — it only creates sections for functionality types present in the package. |
| No employment services in the package | Same as above — "Employment History" does not appear. |
| Scope API returns no scope configuration | Default to "all" — show "Please provide your complete education/employment history." At least 1 entry is expected. |
| Candidate removes all entries | Show the empty state with just the "Add Entry" button and the scope instruction. No error. |
| Candidate adds many entries (10+) | The section should scroll smoothly. Entries should be collapsible so the list doesn't become overwhelming. Performance should not degrade noticeably. |
| Fields API returns no fields for a country | Show a message within the entry: "No information is required for this country." The entry still exists and the country selection is saved. |
| All fields for a service/country have collectionTab = personal info | The entry shows only the country selector and a message: "No additional information is required for this entry." |
| Candidate selects a country, fills in fields, then removes the entry and adds a new one | The removed entry's data is gone. The new entry starts fresh. The removed entry's data is not magically restored. |
| Network failure during auto-save of an entry | Same behavior as Stage 1 — data stays in the browser, retry indicator shows, retries until successful. |
| Session expires while editing entries | Same behavior as Stage 1 — redirect to login, data since last successful save may be lost. |
| Candidate's browser crashes | Data since the last successful auto-save is lost. Each field blur saves, so at most one field's worth of data is lost for the current entry. |
| Two entries with the same country | Perfectly fine — a candidate might have attended two universities in the same country. Each entry is independent. |
| Rapid "Add Entry" clicks | Debounce the button — only one entry is added per click. If the candidate clicks three times quickly, only one new entry should appear. |
| Entry card expanded on mobile fills most of the screen | This is expected. The candidate scrolls within the entry. Other entries are collapsed per the accordion pattern. |

---

## Mobile-First Requirements

Everything from Stage 1 applies (320px minimum width, 44px touch targets, 16px font size, native pickers). Additional mobile requirements for this stage:

- **Entry cards:** Each entry should be a visually distinct card. On mobile, cards stack vertically and take the full width.
- **Expand/collapse:** On mobile, entries use an accordion pattern — only one entry is expanded at a time. Tapping a collapsed entry expands it and collapses the previously open one. On desktop, all entries are expanded by default.
- **"Add Entry" button:** Full-width on mobile, large touch target (at least 44px tall), clearly visible at the bottom of the entry list.
- **"Remove" button:** Visible but not so large that it's accidentally tapped. Consider a smaller button at the top-right or bottom of each entry card.
- **Country dropdown:** Use native `<select>` element on mobile for the device's built-in picker.
- **Scrolling:** When a new entry is added, the screen should scroll to show the new entry so the candidate knows it was created.
- **Entry numbering/labeling:** Each entry is labeled with the section type and a number (e.g., "Education 1," "Education 2" or "Employment 1," "Employment 2") so the candidate can tell them apart on a small screen.

---

## Impact on Other Modules

- **Save API** — Extended to accept `entryId` and `countryId` in the request body, and new section types (`education`, `employment`)
- **Saved-data API** — Extended response format to include entry-based data with `entries` arrays
- **Structure endpoint** — No changes needed. It already returns Education History and Employment History sections based on the package's services.
- **Fields API** — No changes needed for this stage. It already returns fields for a service + country combination. The education and employment sections call it with their specific service IDs and the country the candidate selected per entry. In the future, subregion parameters could be added to this API to support finer-grained field requirements (see Forward-Looking Note).
- **Dynamic Field Renderer** — No changes needed. It already handles all the necessary field types.
- **Auto-Save Indicator** — No changes needed. It already shows saving/saved/failed status.
- **No impact on customer portal** — All new code is under the `/candidate` path and `/api/candidate` routes
- **No impact on authentication** — Candidate session system is unchanged

---

## Translation Keys

Following the existing `module.section.element` pattern:

- `candidate.portal.educationHistory` — "Education History"
- `candidate.portal.employmentHistory` — "Employment History"
- `candidate.portal.addEntry` — "Add Entry"
- `candidate.portal.removeEntry` — "Remove"
- `candidate.portal.entryRemoved` — "Entry removed"
- `candidate.portal.educationEntryLabel` — "Education {number}" (where {number} is replaced with 1, 2, 3, etc.)
- `candidate.portal.employmentEntryLabel` — "Employment {number}" (where {number} is replaced with 1, 2, 3, etc.)
- `candidate.portal.selectCountryForEntry` — "Select country"
- `candidate.portal.noFieldsForCountry` — "No information is required for this country"
- `candidate.portal.noAdditionalInfo` — "No additional information is required for this entry"
- `candidate.portal.scopeCountExact` — "Please provide your most recent {type} entry"
- `candidate.portal.scopeCountSpecific` — "Please provide your most recent {count} {type} entries"
- `candidate.portal.scopeTimeBased` — "Please provide all {type} for the past {years} years"
- `candidate.portal.scopeAll` — "Please provide your complete {type} history"

(Where `{type}` is "education" or "employment", `{count}` is the number, and `{years}` is the number of years.)

---

## Definition of Done

1. The Education History section shows a real form with fields from DSX, not a placeholder
2. The Employment History section shows a real form with fields from DSX, not a placeholder
3. The candidate can add new entries within a section
4. The candidate can remove entries within a section
5. Each entry has its own country selector
6. Selecting a country on one entry loads the correct DSX fields for that entry only — other entries are not affected
7. Fields with a personal info `collectionTab` are NOT shown in education or employment entries — they already appear in Personal Information
8. The scope display shows the correct instruction message based on the package's scope configuration
9. The scope API returns the correct scope information for the education or employment service in the package
10. Auto-save works for each entry — triggers on field blur and includes the entryId and countryId
11. Adding a new entry triggers a save
12. Removing an entry triggers a save with the updated entry list
13. Previously saved entries load correctly when the candidate returns (correct order, correct country, correct field values)
14. Changing the country on an entry preserves the old country's data and loads the new country's fields
15. Switching the country back restores the previously saved data for that country
16. Entry order is preserved across saves and reloads
17. The scope API rejects requests without a valid session
18. The scope API rejects requests where the token doesn't match the session
19. The scope API rejects requests for expired or completed invitations
20. The save API correctly handles the extended format with entryId, countryId, and entry-based fields
21. The saved-data API correctly returns entry-based data in the extended format
22. The "Currently employed here" behavior works when the DSX configuration includes the relevant field
23. On mobile, entry cards use accordion behavior — only one expanded at a time. On desktop, all entries are expanded by default
24. On mobile, "Add Entry" is a full-width button with a large touch target
25. On mobile, scrolling works smoothly with many entries
26. Rapid "Add Entry" clicks only add one entry (debouncing works)
27. All existing tests continue to pass (Stage 1 functionality is not broken)

---

## Resolved Design Decisions

1. **Entry card expand/collapse behavior:** On mobile, one entry is expanded at a time — tapping a collapsed entry expands it and collapses the previously open one (accordion pattern). On desktop, all entries are expanded by default so the candidate can see everything at once.

2. **Default entries on first visit:** The section starts with one empty entry already showing (with the country dropdown visible), so the candidate immediately sees the form and knows what to do. They don't have to figure out that they need to click "Add Entry" first.

3. **"Currently employed" is a DSX field:** The "currently employed" toggle is a regular field configured in DataRx — the portal does not hardcode or create it. The portal just renders whatever fields DataRx provides. The only special behavior is: if a field with a `fieldKey` like `currentlyEmployed` or `isCurrent` exists in the entry and its value is `true`, the portal hides the end date field in that same entry. The exact `fieldKey` needs to be confirmed by checking the live DSX data.

4. **Entry labels:** Entries are labeled "Education 1, Education 2, Education 3" in the Education section and "Employment 1, Employment 2, Employment 3" in the Employment section.