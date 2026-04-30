# Phase 6, Stage 1: Core Form Engine, Personal Information & IDV Sections

**Created:** April 30, 2026
**Status:** Confirmed
**Phase:** 6 — Dynamic Application Engine
**Stage:** 1 of 4
**Prerequisites:** Phase 5 (all 3 stages) complete and deployed

---

## Overview

This stage builds the foundation of the form system — the part that figures out what fields to show, renders those fields as a real form, and saves the candidate's answers automatically. It delivers two working sections: **Personal Information** (the candidate's basic details like name, date of birth, etc.) and **Identity Verification** (IDV).

Personal Information is the very first section the candidate sees. Some fields are pre-filled from the invitation (first name, last name, email, phone) and locked so the candidate can't change them. The remaining personal info fields (like date of birth, middle name, etc.) are filled in by the candidate.

After this stage, the candidate portal has two working sections with real forms instead of placeholders. The candidate can fill them in, and their progress is saved automatically when they move between fields. If they close the browser and come back later, their answers are still there.

---

## What Gets Built

1. **DSX Fields API** — A new endpoint that looks up which fields are required for a given service and country, based on the DSX configuration that already exists in the system. It returns the full field configuration including all metadata (retention handling, collection tab, requires verification, etc.).

2. **Personal Information Fields API** — A new endpoint (or mode of the DSX Fields API) that returns all fields across the package's services where the `collectionTab` in DSX is set to the personal information tab. These are fields about the candidate themselves — not tied to a specific service section.

3. **Dynamic Field Renderer** — A component that takes a field definition and displays the correct type of input on screen. Handles text, date, number, email, phone, select/dropdown, checkbox, and radio button field types. Also supports a "locked" mode for pre-filled fields. This is reusable — Stages 2, 3, and 4 will all use it.

4. **Personal Information Section** — A new section that appears first in the sidebar (before any workflow or service sections). It collects the candidate's basic personal details. Fields that are already known from the invitation (first name, last name, email, phone) are pre-filled and locked. Other fields (date of birth, middle name, etc.) are editable.

5. **IDV Section Form** — Replaces the current IDV placeholder in the portal with a working form. The form loads its fields from the DSX Fields API and renders them using the Dynamic Field Renderer.

6. **Auto-Save System** — When the candidate finishes typing in a field and moves to the next one (clicks or tabs away), the system quietly saves their data in the background. A small "Saved" indicator appears so the candidate knows it worked.

7. **Auto-Load System** — When the candidate returns to the portal after closing the browser, their previously saved data is loaded back into the form fields.

---

## What Is NOT in This Stage

- No multi-entry sections (adding/removing multiple schools or jobs) — that's Stage 2
- No address block fields (street, city, state, zip as a group) — that's Stage 3
- No workflow section content (before/after sections) — that's Stage 4
- No document uploads — that's Stage 4
- No section progress indicator — that's Stage 4
- No validation enforcement or error messages for incomplete fields — that's Phase 7
- No submission button — that's Phase 7
- No editing of locked/pre-filled fields — that's a future enhancement (would require change tracking)

---

## Important Context from Previous Stages

- The candidate portal is at `/candidate/[token]/portal`
- The candidate is NOT a system user — they authenticate via their invitation token and password
- The candidate session uses a cookie called `candidate_session`, completely separate from the main login system
- The session checking API is at `GET /api/candidate/auth/session`
- The structure endpoint at `GET /api/candidate/application/[token]/structure` already returns the section list
- The structure endpoint gets the package via `invitation.packageId` (CandidateInvitation has a direct `packageId` field)
- Sections are assembled from the workflow (before/after sections) and the package's services
- Service sections are grouped by functionality type and use friendly names (e.g., "Identity Verification" not the internal service name)
- Each section currently shows a placeholder — this stage replaces the Personal Information and IDV placeholders with actual forms
- The middleware at `src/middleware.ts` excludes `/candidate` paths from customer redirect logic
- The AuthInterceptor at `src/components/auth/auth-interceptor.tsx` has `/candidate` in `PUBLIC_PATHS`

---

## Future-Proofing Note: IDV Provider Integration

The IDV section should be built as its own standalone component, separate from the other section types. The rest of the application should only need to know two things about IDV: whether the candidate has started it, and whether it's complete. It should not depend on any of the specific fields inside the IDV form.

This makes it possible to later replace the entire IDV section with a third-party provider integration (which might use an embedded widget, redirect to an external page, or send the candidate a separate link) without affecting the rest of the application.

In practice this means: the portal page renders the IDV section by dropping in a single self-contained component. That component handles everything internally — loading fields, rendering them, saving data. The parent page does not reach into the IDV component to read individual field values.

---

## New API Endpoints

### 1. GET /api/candidate/application/[token]/fields

**What it does:** Returns the list of required fields for a specific service in a specific country. The candidate's form calls this to find out what fields to display.

**How it works:**
1. Validates the candidate session (using the `candidate_session` cookie)
2. Looks up the invitation by token and confirms it's still valid (not expired, not completed)
3. Accepts `serviceId` and `countryId` as query parameters
4. Looks up which DSX requirements are mapped to that service for that country, using the existing DSX tables (service_requirements joined with dsx_mapping for location-specific requirements)
5. For each requirement, returns the **complete** field definition — not just the basics, but the full `fieldData`, `documentData`, and all metadata

**Query parameters:**
- `serviceId` (required) — which service to get fields for
- `countryId` (required) — which country to get fields for

**Response shape:**
```
{
  fields: [
    {
      requirementId: "uuid",
      name: "First Name",
      fieldKey: "firstName",
      type: "field",
      dataType: "text",
      isRequired: true,
      instructions: "Enter your legal first name" or null,
      fieldData: {
        dataType: "text",
        shortName: "First Name",
        instructions: "...",
        collectionTab: "personal_info",
        retentionHandling: "delete_at_customer_rule",
        requiresVerification: false,
        ...any other properties configured in DSX
      },
      documentData: null,
      displayOrder: 1
    },
    ...
  ]
}
```

**Important:** The full `fieldData` and `documentData` objects must be returned as-is from DSX. The form renderer uses some of these properties (like `dataType`, `instructions`), but other properties (like `retentionHandling`, `requiresVerification`) are used by downstream processes during submission and fulfillment. Nothing should be stripped out or filtered.

**Error responses:**
- 401 — no valid candidate session
- 403 — token doesn't match the session
- 404 — invitation not found
- 410 — invitation expired or already completed
- 400 — missing serviceId or countryId

**Security:** This endpoint must verify that the candidate session matches the invitation token. A candidate must not be able to load fields for someone else's invitation.

---

### 2. GET /api/candidate/application/[token]/personal-info-fields

**What it does:** Returns the list of personal information fields that the candidate needs to fill in. These are fields from across all services in the package where the DSX `collectionTab` indicates they belong on the personal info tab.

**How it works:**
1. Validates the candidate session
2. Looks up the invitation by token and confirms it's still valid
3. Gets all services in the invitation's package
4. For each service, looks up DSX requirements and finds fields where `collectionTab` equals the personal info tab value
5. Deduplicates — if the same field (same `requirementId`) appears in multiple services, it only shows once
6. Returns the fields along with which ones are pre-filled from the invitation

**Response shape:**
```
{
  fields: [
    {
      requirementId: "uuid",
      name: "First Name",
      fieldKey: "firstName",
      dataType: "text",
      isRequired: true,
      instructions: null,
      fieldData: { ... },
      displayOrder: 1,
      locked: true,
      prefilledValue: "John"
    },
    {
      requirementId: "uuid",
      name: "Date of Birth",
      fieldKey: "dateOfBirth",
      dataType: "date",
      isRequired: true,
      instructions: null,
      fieldData: { ... },
      displayOrder: 3,
      locked: false,
      prefilledValue: null
    },
    ...
  ]
}
```

**Pre-fill and lock logic:**
The API matches invitation fields to DSX fields by `fieldKey`:
- `firstName` → pre-filled from `invitation.firstName`, locked
- `lastName` → pre-filled from `invitation.lastName`, locked
- `email` → pre-filled from `invitation.email`, locked
- `phone` → pre-filled from `invitation.phone`, locked
- All other fields → not pre-filled, not locked

**Important note on collectionTab:** The implementer needs to check what the actual `collectionTab` value is for personal info fields in the existing DSX data. It might be `"personal_info"`, `"subject"`, `"personal"`, or something else. The implementer should query the live data to confirm the exact value used before building the filter logic.

**Error responses:**
- 401 — no valid candidate session
- 403 — token doesn't match the session
- 404 — invitation not found
- 410 — invitation expired or already completed

---

### 3. POST /api/candidate/application/[token]/save

**What it does:** Saves the candidate's in-progress form data. Called automatically when the candidate moves between fields (on blur).

**How it works:**
1. Validates the candidate session
2. Looks up the invitation by token and confirms it's still valid
3. Accepts a JSON body with the section identifier and the field values to save
4. Stores the data linked to the order associated with this invitation
5. Uses an "upsert" approach — if a saved value already exists for this field, it updates it; if not, it creates a new record
6. Returns a success confirmation with a timestamp

**Request body:**
```
{
  sectionType: "personal_info" or "idv",
  sectionId: "section-identifier",
  fields: [
    {
      requirementId: "uuid",
      value: "John"
    },
    ...
  ]
}
```

**Response shape:**
```
{
  success: true,
  savedAt: "2026-04-30T12:00:00Z"
}
```

**Error responses:**
- 401 — no valid candidate session
- 403 — token doesn't match the session
- 404 — invitation not found
- 410 — invitation expired or already completed
- 400 — invalid request body

**Important behavior:**
- This endpoint should be fast (target: under 500ms response time) since it's called frequently during form filling
- It should handle being called rapidly (candidate tabbing through fields quickly) without errors
- It must not expose saved data to other candidates — the token and session are both verified
- It saves using the invitation's `orderId` to link the data to the correct order
- Locked/pre-filled fields (from the Personal Information section) are NOT saved through this endpoint — they come from the invitation record and don't need to be saved separately
- The `fieldName` column in `order_data` stores the `dsx_requirements.id` (the requirement UUID), not the human-readable name

---

### 4. GET /api/candidate/application/[token]/saved-data

**What it does:** Loads the candidate's previously saved form data so the form can be pre-populated when they return.

**How it works:**
1. Validates the candidate session
2. Looks up the invitation by token and confirms it's still valid
3. Reads all saved data records associated with this invitation's order
4. Returns the saved values grouped by section

**Response shape:**
```
{
  sections: {
    "personal_info": {
      fields: [
        {
          requirementId: "uuid",
          value: "1990-05-15"
        },
        ...
      ]
    },
    "idv": {
      fields: [
        {
          requirementId: "uuid",
          value: "John"
        },
        ...
      ]
    }
  }
}
```

**Error responses:**
- 401 — no valid candidate session
- 403 — token doesn't match the session
- 404 — invitation not found
- 410 — invitation expired or already completed

---

## Modified Existing Functionality

### Structure Endpoint Enhancement

The existing `GET /api/candidate/application/[token]/structure` endpoint currently returns sections based on the workflow and package services. It needs to be updated to:

1. **Add a "Personal Information" section** as the very first section in the list, before any workflow "before" sections. This section has a fixed type of `personal_info` and always appears when there are personal info fields in the DSX configuration for any service in the package.

2. **Include service IDs** in service-type sections (if not already present), so the form knows which services to load fields for.

The section order after this change:
1. Personal Information (new — always first)
2. Before-service workflow sections
3. Service sections (IDV, Records, Education, Employment — in their fixed order)
4. After-service workflow sections

---

## New UI Components

### 1. Dynamic Field Renderer

A reusable component that takes a field definition and renders the appropriate input. This is the core building block that all sections will use.

**Field types it must handle in this stage:**

| Data Type | What it renders | Mobile behavior |
|-----------|----------------|-----------------|
| `text` | Standard text input | Regular keyboard |
| `date` | Date picker | Device's native date picker via `type="date"` |
| `number` | Number input | Numeric keyboard |
| `email` | Email input | Email keyboard (with @ readily available) |
| `phone` | Phone number input | Phone keyboard |
| `select` | Dropdown / select menu | Device's native select picker |
| `checkbox` | Checkbox (single toggle or group) | 44px minimum touch target |
| `radio` | Radio button group | 44px minimum touch target per option |

**For select, checkbox, and radio types:** The available options come from the field's `fieldData` configuration in DSX. The renderer reads the options list from `fieldData` and displays them accordingly.

**For each field, the renderer shows:**
- The field label (from `name` in the field definition)
- A required indicator if the field is required (subtle, like a small asterisk — no error messaging yet, that's Phase 7)
- Help text / instructions if present (shown below the field or as a tooltip)
- The input itself, sized appropriately for mobile (minimum 44px touch target, 16px font to prevent iOS zoom)

**Locked mode:** When a field is marked as `locked`, it renders as read-only — the value is displayed but the candidate cannot edit it. The field should look visually distinct from editable fields (e.g., slightly greyed background, no cursor on hover) so the candidate understands they can't change it.

**Important:** This component is purely for display and data collection. It does NOT enforce validation in this stage — it just renders the field. Validation enforcement comes in Phase 7.

**Note on address_block:** The `address_block` data type will NOT be handled in this stage. If a field with `dataType: "address_block"` is encountered, the renderer should show a placeholder message saying "Address fields coming soon" rather than crashing. Full address block rendering is Stage 3.

### 2. Personal Information Section

A section that appears first in the candidate's application. It collects basic information about the candidate that isn't tied to any specific service.

**How it works:**
1. Calls the personal-info-fields API to get the list of fields
2. Renders all returned fields using the Dynamic Field Renderer
3. Fields marked as `locked` with `prefilledValue` are shown as read-only with the invitation data already filled in
4. Unlocked fields are editable and trigger auto-save on blur
5. Loads any previously saved data for unlocked fields when first rendered

**What the candidate sees:**
- A section titled "Personal Information" (or similar friendly name)
- Their name, email, and phone already filled in and visually locked
- Empty fields for things like date of birth, middle name, etc. that they need to fill in
- Auto-save happens as they fill in the editable fields

**No country selector needed:** Personal information fields are not country-dependent. The same set of personal info fields applies regardless of country.

### 3. IDV Section Component

A self-contained component that replaces the IDV placeholder. It:
1. Receives the section information from the structure endpoint (including service IDs)
2. Includes a country selector (since the candidate picks their country, and this drives which fields appear)
3. Calls the fields API with the IDV service ID and selected country
4. Filters out fields where `collectionTab` indicates personal info (those are shown in the Personal Information section, not here)
5. Renders all remaining fields using the Dynamic Field Renderer
6. Manages its own internal state (field values)
7. Triggers auto-save when the candidate moves between fields (on blur)
8. Loads any previously saved data when first rendered
9. Shows the "Saved" indicator when auto-save completes

**Country selection behavior:**
- The candidate sees a country dropdown at the top of the IDV section
- When they select a country, the fields below update to show what's required for that country
- If they change the country, previously entered data for the old country is preserved in auto-save but the form shows the fields for the new country
- The selected country is saved along with the field values

**Filtering out personal info fields:** When the fields API returns results, some fields may have a `collectionTab` indicating they belong on the personal info tab. The IDV section must NOT display these — they already appear in the Personal Information section. This prevents the candidate from seeing the same field (like "Date of Birth") in two different places.

**Design note (future-proofing):** This component should be self-contained enough that it could be entirely replaced with a third-party IDV provider integration in the future. The parent page should only interact with it through simple status: not started, in progress, or complete.

### 4. Auto-Save Indicator

A small, non-intrusive indicator that shows the save status:
- **Saving...** — briefly shown while the save request is in progress
- **Saved** — shown for a few seconds after a successful save, then fades away
- **Save failed — retrying** — shown if a save request fails, with automatic retry

On mobile, this indicator must not cover any form fields or the keyboard. It should appear in a consistent location (e.g., below the section header or at the top of the form area).

---

## Field Metadata Preservation

The DSX system stores rich metadata about each field in the `fieldData` and `documentData` JSON columns on `dsx_requirements`. This metadata includes properties like:

- **`collectionTab`** — which tab/section the field appears on during data collection (this is how the system knows a field belongs in Personal Information vs. a service-specific section)
- **`retentionHandling`** — how long to keep the data (don't delete, delete at customer rule, delete at global rule)
- **`requiresVerification`** — whether this field's value needs to be verified
- **`shortName`** — a brief name for the field
- **`instructions`** — help text shown to the candidate
- **`dataType`** — the type of input to render
- **`addressConfig`** — (for address blocks) per-piece configuration

**Critical rule:** The fields API must return the complete `fieldData` and `documentData` objects exactly as they exist in DSX. The form renderer uses some of these properties (like `dataType`, `instructions`), but other properties (like `retentionHandling`, `requiresVerification`) are used by downstream processes during submission and fulfillment. If any metadata is stripped out or lost during the candidate's data collection flow, it could break processes later in the pipeline.

The candidate does NOT see metadata like retention handling or requires verification — these are internal system properties. But the data must flow through intact so that when the candidate submits (Phase 7), all the metadata is available for creating order items correctly.

---

## Forward-Looking Note: Three-State Field Visibility

Currently, a field in DSX is either required or optional. A planned future enhancement will expand this to three states per location: **required** (must be filled in), **optional but displayed** (shown to the candidate but not mandatory), and **not displayed** (hidden entirely for that location).

The current spec already supports this future change well. The fields API already fetches fields on a per-service, per-country basis, so location-specific visibility is just an additional filter at that level. When the three-state model is implemented:

- Fields marked "not displayed" for the selected country would simply not be returned by the fields API
- Fields marked "optional but displayed" would be returned with `isRequired: false`
- Fields marked "required" would be returned with `isRequired: true`

No architectural changes are needed — this is a minor enhancement to the API filtering logic and the DSX data model. The implementer does NOT need to build anything for this now. This note is here so that the design choices made in this stage (particularly the per-country field lookup) are understood to be intentionally compatible with this future direction.

---

## Data Storage

### Where candidate data is saved

Candidate form data is stored in the `order_data` table, which already exists in the system. Each saved field becomes one row:

| Column | What goes in it |
|--------|----------------|
| `id` | Auto-generated unique ID |
| `orderItemId` | This will be null for now — order items don't exist yet (they're created at submission time in Phase 7). The save endpoint needs an alternative way to associate data with the order. See "Storage approach" below. |
| `fieldName` | The `dsx_requirements.id` UUID — this identifies which field the data belongs to |
| `fieldValue` | The value the candidate entered (as a string) |
| `fieldType` | The data type of the field (text, date, number, etc.) |
| `createdAt` | When the record was created |

### Storage approach for in-progress data

Since order items don't exist yet (they're created when the candidate submits in Phase 7), we need a way to store in-progress form data that can be retrieved later. Two options:

**Option A — Use a dedicated JSON column or separate table:** Store all in-progress data as a single JSON blob on the order or invitation record. Simple to save and load, easy to clear at submission time.

**Option B — Use order_data with a draft marker:** Store individual field records in `order_data` with a way to identify them as draft/in-progress data (e.g., a null `orderItemId` or a special section identifier).

The implementer should evaluate which approach works best with the existing data model. The key requirements are:
- Data must survive browser close and return
- Data must be retrievable by token/invitation
- Data must be clearable at submission time (Phase 7) when real order items are created
- Data must be scoped to a specific section so different section types don't overwrite each other

### Pre-filled fields are NOT saved through auto-save

The locked/pre-filled fields (first name, last name, email, phone) come from the invitation record. They are displayed to the candidate but are NOT written to auto-save storage. At submission time (Phase 7), these values will be pulled from the invitation record directly.

---

## Business Rules

1. **Session required** — All four new endpoints require a valid `candidate_session` cookie. No anonymous access.

2. **Token-session match** — The token in the URL must match the token in the candidate's session. A candidate cannot access another candidate's form data.

3. **Invitation must be valid** — The invitation must not be expired and must not already be completed. If it is, return the appropriate error.

4. **Auto-save triggers on blur** — Saving happens when the candidate clicks or tabs away from a field, not on every keystroke. This prevents excessive save requests.

5. **Auto-save is silent** — The save happens in the background without interrupting the candidate. The only visible sign is the small "Saved" indicator.

6. **Failed saves retry automatically** — If a save request fails (e.g., network issue), the system retries after a short delay. The candidate sees a "Save failed — retrying" message. Data is not lost from the form even if saves fail — it stays in the browser until a save succeeds.

7. **Country drives fields (IDV only)** — The fields shown in the IDV form depend on which country the candidate selects. Different countries may require different fields for the same service. Personal Information fields are NOT country-dependent.

8. **Field definitions come from DSX** — The system does not hardcode any field names or types. Everything comes from the DSX configuration, which the admin team maintains through the DataRx interface.

9. **collectionTab drives section placement** — Fields are placed in the Personal Information section or a service section based on their `collectionTab` value in DSX. If a field's `collectionTab` indicates personal info, it appears in the Personal Information section and is filtered OUT of any service section.

10. **Personal Info must only contain location-independent fields** — The Personal Information section is displayed before the candidate has selected a country on any service section. This means there is no way to know the candidate's location at the time Personal Info is collected. Therefore, the DSX configuration team must only assign fields to the Personal Info `collectionTab` if those fields are the same across all locations — things like names, date of birth, phone numbers, and email. Any field that varies by location (different ID number types, location-specific options, fields that only apply in certain countries) must stay on its service-specific tab, where the candidate selects a country first. **This is a DSX configuration rule, not a code rule** — the system does not enforce it automatically. It should be documented in whatever training or reference materials the DSX configuration team uses.

11. **Personal info fields are deduplicated** — If the same personal info field is required by multiple services in the package, it appears only once in the Personal Information section.

12. **Pre-filled fields are locked** — Fields that match invitation data (firstName, lastName, email, phone) are displayed but cannot be edited. Editing locked fields is a future enhancement that will require change tracking and flagging.

13. **IDV is single-entry** — Unlike education or employment (Stage 2), the IDV section has exactly one set of fields. There is no "add another" button.

14. **Personal Information is single-entry** — Like IDV, there is exactly one set of personal info fields. No "add another" button.

15. **No validation enforcement yet** — Fields may be marked as required in the field definition, and the required indicator is shown, but the form does NOT prevent the candidate from moving to another section with empty required fields. Validation enforcement is Phase 7.

16. **All field metadata is preserved** — The fields API returns the complete `fieldData` and `documentData` from DSX. Nothing is stripped. Properties like `retentionHandling`, `requiresVerification`, and `collectionTab` all flow through intact.

---

## User Flow

### First visit — Personal Information section

1. Candidate logs in and sees the portal with sections in the sidebar
2. "Personal Information" is the first section and is selected by default
3. The section loads and shows the candidate's personal info fields
4. First name, last name, email, and phone are already filled in (from the invitation) and visually locked — the candidate can see them but not edit them
5. Other fields like date of birth, middle name, etc. are empty and editable
6. Candidate fills in their date of birth and tabs to the next field
7. "Saving..." appears briefly, then "Saved" — their date of birth is now stored
8. Candidate continues filling in the remaining personal info fields

### First visit — IDV section (no saved data)

1. Candidate clicks "Identity Verification" in the sidebar
2. The IDV section loads and shows a country dropdown at the top
3. Candidate selects their country from the dropdown
4. The form loads the required fields for that country (brief loading indicator while fields are fetched)
5. Fields that belong to the personal info tab are NOT shown here (they're already in the Personal Information section)
6. Remaining fields appear — things like ID number, ID type, etc. (whatever DSX requires for that service and country)
7. Candidate fills in the first field and tabs to the next
8. "Saving..." appears briefly, then "Saved"
9. Candidate continues filling in fields, with auto-save happening each time they move between fields
10. Candidate can click on any other section in the sidebar at any time — their IDV data is preserved

### Return visit (previously saved data exists)

1. Candidate logs in and sees the portal
2. Personal Information section loads with locked fields pre-filled and previously saved fields (like date of birth) already filled in
3. Candidate clicks "Identity Verification"
4. The IDV section loads, showing the previously selected country and all previously saved field values already filled in
5. Candidate can edit any field — changes are auto-saved when they move away from the field

### Error scenarios

1. **Network failure during auto-save:** The form keeps the data in the browser. The indicator shows "Save failed — retrying." The system retries. When the network comes back, the data is saved successfully.

2. **Session expires while filling in the form:** The next auto-save attempt gets a 401 error. The candidate is redirected to the login page (password entry). After logging back in, they return to the portal and their most recently saved data is loaded.

3. **Invitation expires while filling in the form:** The next auto-save attempt gets a 410 error. The candidate sees a message explaining that their invitation has expired and they should contact the company that invited them.

---

## Edge Cases and Error Scenarios

| Scenario | What should happen |
|----------|-------------------|
| No personal info fields configured in DSX for this package | The Personal Information section is hidden from the sidebar. The candidate starts at the next available section. |
| No DSX fields configured for IDV service/country combination | Show a message: "No information is required for this section based on your selected country." The section is treated as complete. |
| All IDV fields for a country have collectionTab = personal info | The IDV section shows only the country selector and a message: "No additional information is required for this section." All the relevant fields are already in the Personal Information section. |
| Candidate selects a country in IDV, fills in fields, then changes the country | The old country's data is preserved in auto-save. The form shows the new country's fields. If the candidate switches back, the old data is reloaded. |
| Candidate tabs through fields very quickly (rapid blur events) | Auto-save requests should be debounced — wait a brief moment (e.g., 300ms) after the last blur before sending the save request, so rapid tabbing doesn't fire dozens of requests. |
| Very slow network (3G mobile) | Show "Saving..." for as long as the request takes. Do not timeout too quickly — allow at least 10 seconds before showing the retry message. |
| The DSX fields API returns a field type the renderer doesn't recognize | Fall back to rendering a plain text input. Log a warning for debugging. |
| The DSX fields API returns an address_block field type | Show a placeholder message: "Address fields coming soon." Do not crash. (Full address block rendering is Stage 3.) |
| Multiple browser tabs open with the same invitation | The most recent save wins. No conflict detection needed for v1. |
| Candidate's browser crashes before auto-save | Data entered since the last successful auto-save is lost. This is acceptable — auto-save on blur means at most one field of data is lost. |
| A select/dropdown field has no options configured in fieldData | Show the dropdown as disabled with a message: "No options available." Log a warning. |
| The invitation has a phone number but DSX doesn't include a phone field in personal info | The phone is simply not shown. Pre-fill matching is based on fieldKey — if there's no matching field in DSX, the invitation value is just not displayed. No error. |

---

## Mobile-First Requirements

Everything must be designed for mobile first and then work well on larger screens.

- **Minimum width:** 320px
- **Touch targets:** All buttons, dropdowns, checkboxes, radio buttons, and interactive elements must be at least 44px × 44px
- **Font size:** Minimum 16px for all input fields (prevents iOS Safari from zooming in when the candidate taps a field)
- **Country dropdown:** Must be easy to use on mobile — consider using the native `<select>` element which opens the device's built-in picker
- **Select/dropdown fields:** Same as country — use native `<select>` on mobile
- **Checkbox and radio fields:** Large enough touch targets with visible labels
- **Date fields:** Should use the device's native date picker on mobile (via `type="date"`)
- **Auto-save indicator:** Must be visible on mobile without covering the keyboard or any fields
- **Field labels:** Should be above the input (not beside it) on mobile for readability
- **Locked fields:** Should be clearly visually distinct from editable fields on mobile (so the candidate doesn't try to tap into them and think the form is broken)
- **Virtual keyboard:** When the keyboard opens, the active field must remain visible and not be hidden behind the keyboard

---

## Impact on Other Modules

- **Structure endpoint** — Needs to add a "Personal Information" section as the first item, and include service IDs for service-type sections (if not already present)
- **order_data table** — Will now have records created by the candidate auto-save, in addition to records created by the customer-side order flow. The save endpoint should use the same storage format so the data is compatible with the rest of the system.
- **No impact on customer portal** — All new code is under the `/candidate` path and `/api/candidate` routes
- **No impact on authentication** — Candidate session system is completely separate and was built in Phase 5
- **DSX configuration** — No changes needed to DSX. The system reads existing `collectionTab` values to determine field placement. If a field doesn't have a `collectionTab` value, it is treated as belonging to its service section (not personal info).

---

## Definition of Done

1. The Personal Information section appears first in the sidebar
2. Personal Information loads fields from DSX based on `collectionTab`
3. Fields from the invitation (first name, last name, email, phone) are pre-filled and locked
4. Locked fields are visually distinct and cannot be edited
5. Unlocked personal info fields (like date of birth) are editable and trigger auto-save
6. The IDV section shows a real form with fields from DSX, not a placeholder
7. IDV fields that belong to the personal info tab are NOT shown in the IDV section
8. The country dropdown in IDV works and changes which fields are shown
9. Fields render with the correct input type (text, date, number, email, phone, select, checkbox, radio)
10. Required fields show a subtle indicator (asterisk or similar)
11. Help text / instructions appear where configured in DSX
12. Auto-save triggers when the candidate moves between fields (on blur)
13. The "Saved" indicator appears after a successful save
14. Failed saves show a retry message and retry automatically
15. Saved data loads correctly when the candidate returns to the portal
16. Saved data loads correctly when the candidate navigates away from a section and back
17. The fields API returns the correct fields for a given service and country, including full `fieldData`/`documentData` metadata
18. The personal-info-fields API returns deduplicated personal info fields with correct pre-fill and lock status
19. The save API stores data and returns a timestamp
20. The saved-data API returns previously saved data grouped by section
21. All four APIs reject requests without a valid session
22. All four APIs reject requests where the token doesn't match the session
23. All four APIs reject requests for expired or completed invitations
24. Everything works on mobile (320px width, touch targets, native pickers, keyboard behavior)
25. The IDV component is self-contained — the parent page does not access its internal field values
26. Rapid field changes don't cause excessive save requests (debouncing works)
27. All existing tests continue to pass

---

## Open Questions

1. **Exact `collectionTab` value for personal info:** The implementer needs to check what value the existing DSX data uses for the personal info tab. It might be `"personal_info"`, `"subject"`, `"Personal Info"`, or something else. Query the live data to confirm before building the filter. If no `collectionTab` value is set for any fields, that's a configuration gap that needs to be addressed in DSX before this stage can fully work — surface it early.

2. **In-progress data storage approach:** The implementer should choose between Option A (JSON blob on the order/invitation) and Option B (individual order_data rows with draft marker) based on what works best with the existing data model.