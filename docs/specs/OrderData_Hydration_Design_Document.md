# OrderData Hydration & Display Architecture — Design Document

**Last Updated:** April 16, 2026
**Status:** Planning — Ready for Spec Writing

---

## Overview

Order data is displayed to users in several places in the system. Today, display code in some surfaces (starting with the fulfillment order details page) shows raw database values instead of human-readable content. Specifically:

- **Field labels** appear as UUIDs (the `dsx_requirements.id` foreign key) instead of the configured label from DataRx
- **Address values** appear as raw JSON strings containing embedded state/county UUIDs instead of formatted, readable addresses
- **Document entries** appear as raw JSON metadata instead of readable filenames

The root cause is that display components read raw `OrderData` records without joining to their authoritative sources. This document lays out a phased fix that can be implemented in pieces, with each phase delivering visible user value.

This work also lays the foundation for multilingual display across both the fulfillment portal and the future candidate invite portal, where translation support is a requirement.

---

## Core Architectural Decisions

### Source of Truth for Field Labels

- `dsx_requirements.name` is the **authoritative base label** for any data field or document, configured via the DataRx tab
- For display, labels go through the **translation layer** first — if a translation exists for the user's language, that is shown; if not, `dsx_requirements.name` is the fallback
- String-based transformation (e.g., `formatFieldName()` turning `firstName` into `"First Name"` by pattern matching) is **not acceptable** — it produces wrong results for custom labels, labels with punctuation, non-English labels, and labels like `"First Name/Given Name"` that don't match any pattern

### Translation Architecture

- Translations are **file-backed**, stored in JSON files at `src/translations/` (`en-US.json`, `en-GB.json`, `es-ES.json`, `es.json`, `ja-JP.json`)
- The portal's Global Configs > Translations tab manages these files via the `/api/translations/save` endpoint
- Translation keys follow the pattern `module.fulfillment.{fieldKey}` (e.g., `module.fulfillment.middleName` → `"Middle Name"`)
- **Coverage is partial today** — only fields with human-readable `fieldKey` values (like `middleName`, `firstName`) have translation entries. Fields with auto-generated hex `fieldKey` values (like `86d871feeb2142e0`) do not have entries and almost certainly never will
- Address piece labels (e.g., "Street Address", "City", "State/Province") are **not translated today** — only `"ZIP Code"` has a translation entry

### Label Resolution Fallback Chain

For every label displayed in the system, the hydration function follows this chain:

1. **Translation lookup:** Build key `module.fulfillment.{fieldKey}`, look it up in the user's language file
2. **DataRx label:** If no translation exists, use `dsx_requirements.name`
3. **Placeholder:** If the `dsx_requirements` lookup itself fails (deleted requirement, orphaned data), display "Unknown field" and log a warning

This fallback chain ensures the system degrades gracefully. Partial translation coverage is acceptable — untranslated fields display their DataRx label, which is always populated.

### Source of Truth for Address Sub-Labels

- Address-type fields use `dataType: "address_block"` in `dsx_requirements.fieldData`
- Each address block has an `addressConfig` JSON object defining per-piece configuration:

```json
{
  "street1":    { "label": "Street Address",   "enabled": true,  "required": true },
  "street2":    { "label": "Apt/Suite",         "enabled": true,  "required": false },
  "city":       { "label": "City",              "enabled": true,  "required": true },
  "state":      { "label": "State/Province",    "enabled": true,  "required": true },
  "county":     { "label": "County",            "enabled": false, "required": false },
  "postalCode": { "label": "ZIP/Postal Code",   "enabled": true,  "required": true }
}
```

- Each piece has a customizable `label`, an `enabled` flag, and a `required` flag
- Different address fields can have different sub-labels and different pieces enabled
- **Translation of address piece labels is not implemented today** but the architecture should support it for the candidate portal. The likely approach: translation keys like `addressConfig.street1`, `addressConfig.city`, etc., with fallback to the `addressConfig` label

### Source of Truth for Geographic Names (States, Countries, Subdivisions)

- Countries, states, counties, and cities are all stored in the `countries` table as a multi-level hierarchy using `parentId`
- The table has `subregion1`, `subregion2`, `subregion3` columns that indicate the subdivision level:
  - `parentId = null` → Country (e.g., "Australia")
  - Subregion 1 → State/Territory level (e.g., "Queensland", code `AU-QLD`)
  - Subregion 2 → County level
  - Subregion 3 → City level
- Any UUID in address data pointing to a geographic entity must be resolved through the `countries` table to get the human-readable `name`
- The resolver must handle any subdivision level, not just states

### Address Storage

- Address values are stored in **one form**: as a JSON string in `OrderData.fieldValue` for `address_block` type fields
- Example: `{"street1":"123 Main St","city":"Brisbane","state":"f53e7f72-...","postalCode":"4000"}`
- The `state` value inside this JSON is a UUID pointing to a row in the `countries` table at the subregion 1 level
- The `address_entries` table exists in the schema but has zero rows in the database as of April 16, 2026 — it is not in active use and is likely reserved for future functionality (candidate invite address history)

### Document Storage

- Document-type `OrderData` entries have `dsx_requirements.type = "document"`
- Their `fieldValue` is a JSON string containing file metadata:

```json
{
  "documentId": "86d871fe-...",
  "filename": "NPC-100PointChecklist-18042019.pdf",
  "originalName": "NPC-100PointChecklist-18042019.pdf",
  "storagePath": "uploads/draft-documents/.../NPC-100PointChecklist-18042019.pdf",
  "mimeType": "application/pdf",
  "size": 276740,
  "uploadedAt": "2026-03-25T20:03:56.049Z",
  "uploadedBy": "f7b3085b-..."
}
```

- The display should show `originalName` as a readable filename (ideally as a clickable link using `storagePath`), not the raw JSON
- The label comes from `dsx_requirements.name` (e.g., "Copy of degree") through the same fallback chain as fields

### Server-Side Hydration Principle

- All hydration of raw `OrderData` records into display-ready form happens on the server, inside the API layer
- Client components are **pure presentation** — they do not perform lookups, joins, string transformations, or UUID resolution
- The hydration function accepts a **language code** parameter so it can serve translated labels to any portal (fulfillment, customer, candidate) in any language

---

## Current Broken State

What we found during investigation on April 16, 2026:

### Bug 1: Field labels show as UUIDs

- `OrderData.fieldName` stores a UUID pointing to `dsx_requirements.id`
- `OrderDetailsView.tsx` treats this UUID as if it were a human-readable label
- Users see `007a7957-92c0-4ec4-9a93-f5cd56260f10` instead of `"Company Address"`

### Bug 2: Address values show as raw JSON with embedded UUIDs

- `OrderData.fieldValue` for address_block fields contains JSON like:
  `{"street1":"sfbsf","city":"sdfgsd","state":"f53e7f72-8bbe-4017-994a-499b681bfc70","postalCode":"dfgsds"}`
- The display renders this JSON as-is, showing curly braces, key names, and a UUID for the state
- The correct rendering would use the per-piece labels from `addressConfig` and resolve the state UUID to "Queensland"

### Bug 3: Document entries show as raw JSON

- `OrderData.fieldValue` for document entries contains JSON metadata with documentId, storagePath, mimeType, size, etc.
- The display renders this JSON as-is instead of showing the readable filename

### Bug 4: Duplicate and inconsistent label sources exist

- Hardcoded labels exist in multiple places outside the translation system:
  - `src/components/portal/order-details-dialog.tsx` has `{ key: 'middleName', label: 'Middle Name' }`
  - `src/lib/services/order-core.service.ts` has a reverse map with entries like `'Middle Name': 'middleName'`
  - `src/lib/services/service-order-data.service.ts` has a list of known labels and a `formatFieldName()` method
- These hardcoded labels can drift from both `dsx_requirements.name` and from the translation files

### Bug 5: The initial investigation and fix attempt were wrong

- The bug-investigator recommended calling `ServiceOrderDataService.formatFieldName()` on `OrderData.fieldName`
- Since `fieldName` is a UUID, this transformation would produce mangled UUID strings, not labels
- A full bug-fix pipeline cycle was run and discarded before this design document was written

---

## Resolved Design Decisions

These decisions were made during the investigation on April 16, 2026:

| # | Decision | Resolution |
|---|----------|------------|
| 1 | Missing `dsx_requirements` lookups | Show "Unknown field" as placeholder, log a warning |
| 2 | Malformed JSON in address or document values | Show the raw value as-is, log a warning. Don't crash, don't hide data |
| 3 | Document-type handling | Parse JSON, display `originalName` as filename. Ideally as a clickable link using `storagePath` |
| 4 | Backward compatibility during rollout | Keep the raw `data` array alongside the new hydrated field during Phase 1-2. Remove in Phase 3 after all consumers are migrated |
| 5 | Address display format | Labeled lines (like a form), not comma-separated strings. Each enabled piece gets its own line with the label from `addressConfig` |

---

## Target Architecture

### Layer 1: Canonical Hydration Function

A single server-side function that takes raw `OrderData` records and a language code, and returns display-ready objects.

The function:
1. Collects all unique `fieldName` UUIDs from the input records
2. Batch-fetches the corresponding `dsx_requirements` rows in a single query
3. Loads the appropriate language translation file (based on the language code parameter)
4. For each record, resolves the label through the fallback chain: translation → `dsx_requirements.name` → "Unknown field" placeholder (with warning log)
5. Delegates to the appropriate value handler based on data type:
   - `address_block` → Layer 2 address resolver
   - `document` → Layer 2 document resolver
   - All other types → use raw `fieldValue` as `displayValue`
6. Returns hydrated records

Proposed shape of each hydrated record:

```
{
  requirementId: string,    // the dsx_requirements UUID (original OrderData.fieldName)
  label: string,            // resolved through the fallback chain
  fieldKey: string,         // dsx_requirements.fieldKey
  dataType: string,         // from fieldData.dataType ("text", "address_block", "date", etc.)
  requirementType: string,  // dsx_requirements.type ("field" or "document")
  rawValue: string,         // original OrderData.fieldValue
  displayValue: string,     // formatted for display
}
```

For `address_block` type fields, the hydrated record additionally includes:

```
{
  addressPieces: [
    { key: "street1",    label: "Street Address",    value: "123 Main St" },
    { key: "city",       label: "City",              value: "Brisbane" },
    { key: "state",      label: "State/Province",    value: "Queensland" },
    { key: "postalCode", label: "ZIP/Postal Code",   value: "4000" },
  ]
}
```

Each piece uses the label from `addressConfig` (with future translation support), only includes `enabled` pieces, and resolves any UUID values through the `countries` table. Displayed as labeled lines in the UI.

For `document` type entries, the hydrated record additionally includes:

```
{
  document: {
    filename: string,       // originalName from the JSON
    storagePath: string,    // for building a download link
    mimeType: string,       // for icon display
    size: number,           // for display (e.g., "271 KB")
  }
}
```

### Layer 2: Value Resolvers

#### Address Resolver

Handles `address_block` values:

1. Parse the JSON string from `OrderData.fieldValue`
2. Read the `addressConfig` from the parent `dsx_requirements.fieldData`
3. Batch-fetch all referenced geographic UUIDs from the `countries` table in a single query
4. For each **enabled** piece in `addressConfig`:
   - If the piece is `state`, `county`, or any geographic reference: resolve the UUID through the `countries` table to get the `name`
   - Otherwise: use the raw string value from the JSON
   - Apply the label from `addressConfig` (with future translation fallback)
5. Assemble the `addressPieces` array
6. Build a `displayValue` string by joining the non-empty resolved values with commas (used as a fallback summary; the primary display uses the labeled-lines format from `addressPieces`)

Error handling:
- If JSON parsing fails: return the raw value as `displayValue` and log a warning
- If a UUID lookup fails (geographic entity not found in `countries`): use the raw UUID and log a warning
- If a piece is missing from the JSON: skip it in the output
- If `addressConfig` is missing from `fieldData`: fall back to a default set of pieces with generic labels

#### Document Resolver

Handles `document` type values:

1. Parse the JSON string from `OrderData.fieldValue`
2. Extract `originalName`, `storagePath`, `mimeType`, `size`
3. Set `displayValue` to `originalName`
4. Populate the `document` object on the hydrated record

Error handling:
- If JSON parsing fails: return the raw value as `displayValue` and log a warning
- If `originalName` is missing: fall back to `filename`, then to "Unknown document"

### Layer 3: API Contract

Every API endpoint that returns order-related data includes hydrated `OrderData` on each item, as a distinct field from the raw `data` array. The raw array stays during Phase 1-2 for backward compatibility and is removed in Phase 3 after all consumers are migrated.

The hydration call passes the requesting user's language preference (defaulting to `en-US` until language selection is implemented in the fulfillment portal).

Endpoints affected:
- `/api/fulfillment/orders/[id]` — order details for internal/vendor users
- `/api/portal/orders/[id]` — order details for customer users
- Any other endpoint returning order or order-item data with attached `OrderData`

### Layer 4: Client Consumption

Every display component that reads raw `OrderData` arrays is updated to read the hydrated form instead. Components affected:

- `src/components/fulfillment/OrderDetailsView.tsx`
- `src/components/services/ServiceRequirementsDisplay.tsx`
- `src/components/portal/order-details-dialog.tsx`
- Any other component identified during the Phase 2 audit

Display rules by type:
- **Text fields:** Show label and `displayValue` on one line
- **Address blocks:** Show parent label as a heading, then each `addressPiece` on its own labeled line
- **Documents:** Show label and `displayValue` (filename), ideally as a clickable download link

Hardcoded label maps in components are removed.

---

## Phased Implementation Plan

The work is divided into three phases. Each phase delivers visible user value on its own. You can stop after any phase and the system is better than it was.

### Phase 1 — Fix the Unreadable Surfaces

**Goal:** Users stop seeing UUIDs, raw JSON, and raw document metadata in the fulfillment order details page. Field labels show as configured in DataRx (with translation support built in from the start, defaulting to `en-US`). Addresses render as labeled lines. Documents render as filenames.

**Scope:**
- Build Layer 1 hydration function with language code parameter (batch-fetch `dsx_requirements`, load translation file, apply fallback chain)
- Build Layer 2 address resolver (parse JSON, resolve geographic UUIDs through `countries` at any subdivision level, apply `addressConfig` labels)
- Build Layer 2 document resolver (parse JSON, extract `originalName` and metadata)
- Update `/api/fulfillment/orders/[id]` to return hydrated data alongside raw data
- Update `OrderDetailsView.tsx` to use hydrated data instead of running its own reduce
- Update `ServiceRequirementsDisplay.tsx` if needed to render the new hydrated shape (address labeled lines, document filenames)

**What ships:**
- `OrderDetailsView` shows real labels, readable addresses, and document filenames
- Users stop seeing UUIDs, JSON blobs, and raw metadata in the fulfillment order details page
- Translation infrastructure is in place — when language selection is added to the fulfillment portal later, labels automatically display in the selected language
- When the candidate portal is built, it calls the same hydration function with the candidate's language preference

**What stays broken:** Other surfaces (customer portal order details dialog, etc.) may still show raw values. Hardcoded label strings elsewhere in the codebase still exist. Address piece labels are not yet translated (they use `addressConfig` labels in English).

**Estimated size:** Medium. One hydration function, two value resolvers, one API endpoint change, one or two component updates. Probably 2-3 days of focused work.

### Phase 2 — Sweep Other Display Surfaces

**Goal:** Every display surface showing `OrderData` uses the same hydration. No more raw values anywhere.

**Scope:**
- Audit all components that read `OrderData` arrays (search `src/components/` for anything consuming `item.data` or `orderData`)
- Update `/api/portal/orders/[id]` and any other endpoints identified in the audit
- Update all identified components to use hydrated data
- Remove hardcoded label maps from components (e.g., the `{ key: 'middleName', label: 'Middle Name' }` pattern in `order-details-dialog.tsx`)
- Remove the raw `data` array from API responses once all consumers are migrated

**What ships:** Consistency. Customer portal, vendor views, and any other surface all display the same correct labels, addresses, and document filenames.

**Estimated size:** Medium. Depends on how many surfaces are found in the audit. Probably 2-4 days.

### Phase 3 — Translation Coverage and Label Cleanup

**Goal:** Improve translation coverage. Eliminate duplicate sources of field labels. Add translation support for address piece labels.

**Scope:**
- Audit `dsx_requirements` for fields with human-readable `fieldKey` values that are missing translation entries — create entries for the supported languages
- Add translation keys for address piece labels (e.g., `addressConfig.street1` → "Street Address" in each language file)
- Remove reverse maps like the one in `src/lib/services/order-core.service.ts` that duplicate label information
- Remove the known-labels list in `src/lib/services/service-order-data.service.ts`
- Remove `formatFieldName()` entirely, or repurpose it as an explicit fallback for cases where no translation or `dsx_requirements` lookup succeeds
- Verify no other code paths depend on the removed duplicates

**What ships:** Comprehensive translation support. Single source of truth for every field label. The candidate portal can launch with full multilingual support for data labels.

**Estimated size:** Medium. Mix of data entry (creating translation entries), code deletions, and verification. Probably 2-3 days.

---

## Database Reference

All based on schema inspection and live data queries, April 16, 2026.

### `order_data` table (Prisma: `orderData`)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `orderItemId` | uuid | FK to `order_items` |
| `fieldName` | string (uuid) | **Misnamed — actually a FK to `dsx_requirements.id`** |
| `fieldValue` | string | Raw value; JSON for `address_block` and `document` types; plain string for `text` types |
| `fieldType` | string | Field type metadata |
| `createdAt` | timestamp | |

Observation: the column name `fieldName` is misleading. It stores a UUID reference, not a name. Renaming the column is out of scope for this work but worth noting for future schema passes.

**Live data type distribution** (as of April 16, 2026):

| dsx_requirements.type | fieldData.dataType | Count |
|----------------------|-------------------|-------|
| field | text | 3 |
| field | address_block | 3 |
| document | (none) | 2 |

### `dsx_requirements` table

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK — this is what `OrderData.fieldName` references |
| `name` | string | **Authoritative base label** — e.g., "Graduation Date", "First Name/Given Name", "Copy of degree" |
| `type` | string | "field" or "document" |
| `fieldKey` | string | Immutable key; some human-written (`mothersMaidenName`), some auto-generated hex fragments |
| `fieldData` | json | Field configuration — includes `dataType`, `addressConfig` for address blocks, `shortName`, `instructions`, etc. |
| `documentData` | json | Document configuration — includes `scope`, `instructions`, `retentionHandling` |
| `formData` | json | Form configuration |
| `disabled` | boolean | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

Key `fieldData` properties:
- `dataType`: "text", "address_block", "date", "number", etc.
- `shortName`: compact name for the field
- `instructions`: help text shown to the candidate
- `addressConfig`: (address_block only) per-piece configuration with `label`, `enabled`, `required` per piece
- `collectionTab`: which tab this field appears on during data collection

Key `documentData` properties:
- `scope`: "per_search" or similar — how the document applies
- `instructions`: help text for the user
- `retentionHandling`: data retention policy

### `countries` table (multi-level geographic hierarchy)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | string | e.g., "Australia", "Queensland", "Brisbane" |
| `code2` | string | ISO-2 code or composite like "AU-QLD" |
| `code3` | string | ISO-3 code |
| `subregion1` | string | State/territory level indicator |
| `subregion2` | string | County level indicator |
| `subregion3` | string | City level indicator |
| `parentId` | uuid | FK to `countries` — null for countries, populated for subdivisions |
| `disabled` | boolean | |

Hierarchy:
- `parentId = null` → Country
- Subregion 1 (state/territory) → `parentId` points to country
- Subregion 2 (county) → `parentId` points to state
- Subregion 3 (city) → `parentId` points to county or state

### Translation files (`src/translations/`)

| File | Language |
|------|----------|
| `en-US.json` | English (US) |
| `en-GB.json` | English (UK) |
| `es-ES.json` | Spanish (Spain) |
| `es.json` | Spanish (generic) |
| `ja-JP.json` | Japanese |

Key pattern: `module.fulfillment.{fieldKey}` → translated label
Coverage: partial. Only fields with human-readable `fieldKey` values have entries. Address piece labels are almost entirely untranslated (only "ZIP Code" has an entry).

### `address_entries` table

**Status: Empty table (0 rows as of April 16, 2026).** Not in active use. Likely reserved for future candidate invite address history. Not relevant to this work.

---

## Proven Data Flow (Verified by Database Queries)

This section documents the exact data relationships confirmed by live database queries on April 16, 2026. Any future agent or developer picking up this work can rely on these findings without re-investigation.

### Field label resolution

```sql
SELECT od."fieldName", dr.name, dr."fieldKey", dr.type
FROM order_data od
LEFT JOIN dsx_requirements dr ON dr.id = od."fieldName"
LIMIT 5;
```

Results confirmed: `OrderData.fieldName` UUID joins cleanly to `dsx_requirements.id`, producing labels like "Company Address", "Company Name", "School Address".

### Address value storage

```sql
SELECT od."fieldValue", dr.name, dr."fieldData"->>'dataType' AS data_type
FROM order_data od
LEFT JOIN dsx_requirements dr ON dr.id = od."fieldName"
WHERE dr."fieldData"->>'dataType' = 'address_block'
LIMIT 5;
```

Results confirmed: every `address_block` field stores its value as a JSON string in `OrderData.fieldValue` with keys like `street1`, `city`, `state`, `postalCode`. State values are UUIDs.

### Document value storage

```sql
SELECT od."fieldValue", dr.name, dr.type, dr."documentData"
FROM order_data od
JOIN dsx_requirements dr ON dr.id = od."fieldName"
WHERE dr.type = 'document'
LIMIT 2;
```

Results confirmed: document entries store JSON metadata with `documentId`, `filename`, `originalName`, `storagePath`, `mimeType`, `size`, `uploadedAt`, `uploadedBy`. The `originalName` field is the human-readable filename for display.

### Geographic UUID resolution

```sql
SELECT id, name, code2, "parentId" FROM countries
WHERE id = 'f53e7f72-8bbe-4017-994a-499b681bfc70';
```

Result: `Queensland`, `AU-QLD`, with `parentId` pointing to the Australia row. Confirms state UUIDs resolve through the `countries` table.

### Address configuration structure

```sql
SELECT name, "fieldData"->'addressConfig' FROM dsx_requirements
WHERE "fieldData"->>'dataType' = 'address_block' LIMIT 1;
```

Result: `addressConfig` contains per-piece configuration with `label`, `enabled`, `required` for each of: `street1`, `street2`, `city`, `state`, `county`, `postalCode`. Labels are customizable per address field.

### Data type distribution in live order data

```sql
SELECT dr.type, dr."fieldData"->>'dataType' AS data_type, COUNT(*)
FROM order_data od
JOIN dsx_requirements dr ON dr.id = od."fieldName"
GROUP BY dr.type, dr."fieldData"->>'dataType';
```

Result: 3 text fields, 3 address_block fields, 2 document entries. Confirms all three data types are present in live data and must be handled by the hydration function.

### Translation key pattern

```
grep "middleName\|firstName" src/translations/en-US.json
```

Result: `"module.fulfillment.firstName": "First Name"`, `"module.fulfillment.middleName": "Middle Name"`. Confirms the key pattern is `module.fulfillment.{fieldKey}`.

---

## Open Questions

### Remaining (to be resolved during spec writing or implementation)

1. **Hydration function location:** Should hydration live on `ServiceOrderDataService` (extending an existing service) or in a new dedicated service? The existing service has server-side dependencies (Prisma, logger) which is appropriate, but it also has the `formatFieldName()` method which this work supersedes.

2. **Performance and batching:** For an order with many fields, hydration involves fetching `dsx_requirements` rows, loading a translation file, and potentially multiple `countries` rows for address UUIDs. The hydration function should batch these lookups. Worth confirming this approach is sufficient or whether caching (e.g., in-memory cache of translation files and frequently-used `dsx_requirements` rows) is needed.

3. **Order creation flow:** The order creation UI shows labels correctly today. How does it source them? Does it read `dsx_requirements.name` directly, or use translations, or use one of the hardcoded sources? Understanding this determines whether Phase 3 cleanup could break the creation flow.

4. **Regression test strategy:** Previous attempt at e2e regression tests was unusable. For this work, is API-route testing (with mocked Prisma returning known `dsx_requirements`, `countries`, and translation data) sufficient?

5. **Translation key for hex-fragment fieldKeys:** Some `fieldKey` values are auto-generated hex fragments (e.g., `86d871feeb2142e0`). These will never have human-authored translations. Should the translation system ignore them entirely (relying on `dsx_requirements.name` fallback), or should the translation save endpoint auto-populate entries for new fields using the DataRx label as the default value for all languages?

6. **Address piece label translation keys:** What key pattern should address piece labels use in the translation files? Candidates: `addressConfig.street1`, `address.streetAddress`, or a pattern tied to the parent field like `module.fulfillment.{parentFieldKey}.street1`. The choice affects how translators find and manage these entries in the Global Configs > Translations UI.

7. **Audit scope for Phase 2:** What is the complete list of display surfaces that show `OrderData`? The current known set is `OrderDetailsView.tsx`, `order-details-dialog.tsx`, and `ServiceRequirementsDisplay.tsx`. Are there vendor-specific views, printable reports, email notifications with order content, or export features that also display this data?

8. **Language selection in the fulfillment portal:** Phase 1 defaults to `en-US`. When will language selection be added to the fulfillment portal UI? This doesn't block Phase 1 but affects when the translation infrastructure gets exercised beyond the default.

9. **Document download links:** Should the document `displayValue` be a clickable download link in the UI (using `storagePath`), or just a filename with a separate download button? This is a UI/UX decision.