# Candidate Application API

This document describes the API endpoints for the candidate application form engine.

## Overview

The candidate application system allows candidates to fill out their background check application forms. It includes endpoints for loading form structure, fetching required fields, auto-saving progress, and loading previously saved data.

## Authentication

All endpoints require a valid candidate session cookie (`candidate_session`). The token in the URL must match the token in the session.

## Endpoints

### GET /api/candidate/application/[token]/structure

Returns the list of sections the candidate needs to complete, assembled from workflow and package services.

**Response:**
```json
{
  "invitation": {
    "firstName": "string",
    "lastName": "string",
    "status": "string",
    "expiresAt": "ISO date",
    "companyName": "string"
  },
  "sections": [{
    "id": "string",
    "title": "string",
    "type": "workflow_section | service_section | personal_info | address_history | review_submit",
    "placement": "before_services | services | after_services",
    "status": "not_started | incomplete | complete",
    "order": "number",
    "functionalityType": "string | null",
    "serviceIds": ["string"],
    "workflowSection": {
      "id": "string",
      "name": "string",
      "type": "text | document",
      "content": "string | null",
      "fileUrl": "string | null",
      "fileName": "string | null",
      "placement": "before_services | after_services",
      "displayOrder": "number",
      "isRequired": "boolean"
    },
    "scope": {
      "scopeType": "count_exact | count_specific | time_based | highest_degree | highest_degree_inc_hs | all_degrees | all",
      "scopeValue": "number | null",
      "scopeDescriptionKey": "string (translation key)",
      "scopeDescriptionPlaceholders": "object | undefined"
    }
  }]
}
```

`workflowSection` is only present when `type === "workflow_section"`. It carries the full content payload so the client can render the section without a second fetch.

`scope` is only present on scoped sections: Address History (`type === "address_history"`), Education (`functionalityType === "verification-edu"`), and Employment (`functionalityType === "verification-emp"`). The scope reflects the most-demanding scope across all package services sharing that functionality type (spec Rule 19). `scopeDescriptionKey` is a translation key — not an English string — so the client can localize it.

Phase 7 Stage 1 appends a synthetic `review_submit` section entry at the end of the list (after all after-services workflow sections). Its `id` is always `"review_submit"`, its `type` is `"review_submit"`, and its `placement` is `"after_services"`. It carries no `workflowSection` or `scope` payload.

`status` always returns `"not_started"` from this endpoint (Phase 6 Stage 4, Business Rule 15). Clients are responsible for recomputing progress locally after each auto-save and overriding this initial value. The status value space changed from Stage 3: `"in_progress"` has been replaced by `"incomplete"` (Business Rule 22).

### GET /api/candidate/application/[token]/fields

Returns DSX field requirements for a specific service and country.

**Query Parameters:**
- `serviceId` (required) - The service ID to get fields for
- `countryId` (required) - The country ID to get fields for

**Response:**
```json
{
  "fields": [{
    "requirementId": "string",
    "name": "string",
    "fieldKey": "string",
    "type": "field | document",
    "dataType": "text | date | number | email | phone | select | checkbox | radio",
    "isRequired": "boolean",
    "instructions": "string | null",
    "fieldData": "object",
    "documentData": "object | null",
    "displayOrder": "number"
  }]
}
```

### GET /api/candidate/application/[token]/countries

Returns the list of available countries the candidate can select from. Only returns top-level countries (countries whose `parentId` is `null`) that are not disabled.

**Response:**
```json
[
  {
    "id": "string (UUID)",
    "name": "string",
    "code2": "string"
  }
]
```

Used by entry-based sections (Education, Employment) to populate the per-entry country selector. The API returns UUIDs because the `Country.id` column is a UUID — non-UUID stand-ins (e.g., `"US"`) cannot be saved by the save endpoint.

### GET /api/candidate/application/[token]/scope

Returns the scope requirements configured for a service in the candidate's package. Used by entry-based sections to display how many entries the candidate is expected to provide.

**Query Parameters:**
- `functionalityType` (required) - One of `verification-edu` or `verification-emp`

**Response:**
```json
{
  "functionalityType": "verification-edu | verification-emp",
  "serviceId": "string (UUID)",
  "scopeType": "count_exact | count_specific | time_based | all | highest_degree | highest_degree_inc_hs | all_degrees",
  "scopeValue": "number | null",
  "scopeDescription": "string"
}
```

The endpoint reads the `scope` JSON column on `package_services` for the matching service and maps the stored shape to the response above:

| Stored `scope.type`              | Response `scopeType`         | `scopeValue`         |
|----------------------------------|------------------------------|----------------------|
| `most-recent`                    | `count_exact`                | `1`                  |
| `most-recent-x` (with `quantity`)| `count_specific`             | `quantity`           |
| `past-x-years` (with `years`)    | `time_based`                 | `years`              |
| `highest-degree`                 | `highest_degree`             | `1`                  |
| `highest-degree-inc-highschool`  | `highest_degree_inc_hs`      | `1`                  |
| `all-degrees`                    | `all_degrees`                | `null`               |
| missing or unrecognized          | `all`                        | `null`               |

`scopeDescription` is a server-rendered, human-readable string for display (e.g., `"Please provide your most recent 2 education entries"`).

**Errors:** `400` if `functionalityType` is missing or not one of the two allowed values; `404` if no service in the package has the requested functionality type.

### GET /api/candidate/application/[token]/personal-info-fields

Returns personal information fields from across all package services where the DSX collectionTab indicates they belong on the personal info tab.

**Response:**
```json
{
  "fields": [{
    "requirementId": "string",
    "name": "string",
    "fieldKey": "string",
    "dataType": "string",
    "isRequired": "boolean",
    "instructions": "string | null",
    "fieldData": "object",
    "displayOrder": "number",
    "locked": "boolean",
    "prefilledValue": "string | null"
  }]
}
```

**`isRequired` semantics (TD-060 fix, May 2026):** A field's `isRequired` value is `true` only when every `dsx_mappings` row for that requirement, filtered to the candidate's package services and their available non-disabled locations (`dsx_availability.isAvailable = true` AND `Country.disabled IS NOT TRUE`), has `isRequired = true`. Fields with no applicable mapping rows default to `false`. Country-specific conditional requirements (where some but not all applicable mappings have `isRequired = true`) are not reflected here as baseline-required; the cross-section registry handles those at runtime. A field will appear with `isRequired: false` from this endpoint and be promoted to required by the registry when the candidate selects a relevant country in another section.

### POST /api/candidate/application/[token]/save

Auto-saves the candidate's in-progress form data. Called automatically when the candidate moves between fields, adds an entry, or removes an entry.

The endpoint accepts five distinct request shapes, dispatched by `sectionType`:

**Visit-tracking format** — Phase 7 Stage 1. Used to persist section visit records and the Review & Submit visit flag without touching `formData.sections`:
```json
{
  "sectionType": "section_visit_tracking",
  "sectionVisits": [{
    "sectionId": "string",
    "visitedAt": "ISO 8601 timestamp",
    "departedAt": "ISO 8601 timestamp | null"
  }],
  "reviewPageVisitedAt": "ISO 8601 timestamp | null"
}
```

Both `sectionVisits` and `reviewPageVisitedAt` are optional; either or both may be included in a single request. The server merges the incoming visit data using immutable rules: `visitedAt` is never overwritten once set; `departedAt`, once non-null, is never cleared; `reviewPageVisitedAt`, once set, is never cleared.

**Flat-fields format** — used for `personal_info`, `idv`, `workflow_section`, and `service_section`:
```json
{
  "sectionType": "personal_info | idv | workflow_section | service_section",
  "sectionId": "string",
  "fields": [{
    "requirementId": "string (UUID)",
    "value": "string | number | boolean | null | string[] | object"
  }]
}
```

Phase 6 Stage 4 extended the `value` union to accept JSON objects, which enables two new save patterns:

- Workflow-section acknowledgment (keyed by `workflow_sections.id` as `requirementId`):
```json
{ "acknowledged": true }
```

- Document-upload metadata (for `per_search` / `per_order` scoped requirements):
```json
{
  "documentId": "string (UUID)",
  "originalName": "string",
  "storagePath": "string",
  "mimeType": "string",
  "size": "number",
  "uploadedAt": "ISO8601 timestamp"
}
```

This format updates fields incrementally — fields not present in the request are left untouched on the saved record.

**Repeatable-entries format** — used for `education` and `employment`:
```json
{
  "sectionType": "education | employment",
  "sectionId": "string",
  "entries": [{
    "entryId": "string (UUID)",
    "countryId": "string (UUID) | null",
    "entryOrder": "number (>= 0)",
    "fields": [{
      "requirementId": "string (UUID)",
      "value": "string | number | boolean | null | string[]"
    }]
  }]
}
```

Repeatable-entry saves use **whole-section replacement**: the entire `entries` array replaces the section's stored entries. The frontend must always send the complete current state of the section. Sending an empty `entries` array clears the section's saved data — this is how entry removal of the last entry is handled.

If `sectionType` is `education` or `employment` but the request body does not contain an `entries` field, the endpoint returns `400`.

**Response:**
```json
{
  "success": "boolean",
  "savedAt": "ISO timestamp"
}
```

### GET /api/candidate/application/[token]/saved-data

Loads the candidate's previously saved form data for pre-populating the form when they return.

The response contains three section shapes, depending on the section type.

**Workflow sections** (`workflow_section`) — Phase 6 Stage 4:
```json
{
  "sections": {
    "<workflow_sections.id>": {
      "type": "workflow_section",
      "acknowledged": true
    }
  }
}
```

The bucket key is the `workflow_sections.id` UUID (matching the key in `formData.sections` and the `sectionId` used when saving). Only workflow sections the candidate has interacted with are present — sections not yet started are absent from the response.

**Flat-field sections** (`personal_info`, `idv`, and other non-repeatable sections):
```json
{
  "sections": {
    "personal_info": {
      "fields": [{
        "requirementId": "string (UUID)",
        "value": "any"
      }]
    },
    "idv": {
      "countryId": "string (UUID) | null",
      "fields": [{
        "requirementId": "string (UUID)",
        "value": "any"
      }]
    }
  }
}
```

`personal_info` and `idv` sections are always present in the response, even when the candidate has not saved any data — they appear with an empty `fields` array. The IDV section additionally exposes the saved `countryId` at the section level when present on stored data.

**Repeatable sections** (`education`, `employment`) return an `entries` array instead of a flat `fields` array:
```json
{
  "sections": {
    "education": {
      "entries": [{
        "entryId": "string (UUID)",
        "countryId": "string (UUID) | null",
        "entryOrder": "number",
        "fields": [{
          "requirementId": "string (UUID)",
          "value": "string | number | boolean | null | string[]"
        }]
      }]
    },
    "employment": {
      "entries": [
        // same shape as education
      ]
    }
  }
}
```

Repeatable sections are only present in the response when the candidate has previously saved at least one entry — they are not auto-created.

Phase 7 Stage 1 extended the response to include visit tracking data as siblings of `sections`:

```json
{
  "sections": { "...": "..." },
  "sectionVisits": {
    "<sectionId>": { "visitedAt": "ISO", "departedAt": "ISO | null" }
  },
  "reviewPageVisitedAt": "ISO | null"
}
```

`sectionVisits` is an empty object `{}` when no visit data has been saved. `reviewPageVisitedAt` is `null` until the candidate first visits the Review & Submit page.

### POST /api/candidate/application/[token]/validate

Phase 7 Stage 1. Runs the full validation engine for the candidate and returns per-section status and error lists. Called by the client whenever validation results are needed — after section departure, on Review & Submit page load, and after each auto-save. Results are never cached.

**Authentication:** Valid `candidate_session` cookie with matching token.

**Request body:** none.

**Response (200):**
```json
{
  "sections": [{
    "sectionId": "string",
    "status": "not_started | incomplete | complete",
    "fieldErrors": [{
      "fieldName": "string",
      "messageKey": "string",
      "placeholders": "object | undefined"
    }],
    "scopeErrors": [{
      "messageKey": "string",
      "placeholders": "object"
    }],
    "gapErrors": [{
      "messageKey": "string",
      "placeholders": "object",
      "gapStart": "ISO date string",
      "gapEnd": "ISO date string",
      "gapDays": "number"
    }],
    "documentErrors": [{
      "requirementId": "string (UUID)",
      "documentNameKey": "string (translation key)"
    }]
  }],
  "summary": {
    "sections": [{
      "sectionId": "string",
      "sectionName": "string",
      "status": "not_started | incomplete | complete",
      "errors": ["ReviewError union — see types.ts"]
    }],
    "allComplete": "boolean",
    "totalErrors": "number"
  }
}
```

**Errors:**
- `401` — No session.
- `403` — Session token does not match URL token.
- `404` — Invitation not found.
- `410` — Invitation expired or already completed.
- `500` — Validation engine threw.

### POST /api/candidate/application/[token]/upload

Phase 6 Stage 4. Accepts a single document file along with a requirement identifier. Stores the file to disk and returns metadata. Does **not** write a database row — the caller persists the metadata on the next auto-save via the standard `/save` endpoint.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | yes | The document to upload. Max 10 MB. Accepted MIME types: `application/pdf`, `image/jpeg`, `image/png`. |
| `requirementId` | string (UUID) | yes | The `dsx_requirements.id` this upload satisfies. |
| `entryIndex` | number | no | Non-negative integer. Only consumed by `per_entry`-scoped requirements to identify which repeatable entry the upload belongs to. |

**Response (201):**
```json
{
  "documentId": "string (UUID)",
  "originalName": "string",
  "storagePath": "string",
  "mimeType": "application/pdf | image/jpeg | image/png",
  "size": "number (bytes)",
  "uploadedAt": "ISO8601 timestamp"
}
```

`storagePath` is always `uploads/draft-documents/{orderId}/{timestamp}-{sanitizedOriginalName}`.

**Errors:**
- `400` — Missing or invalid `requirementId`, missing file, file exceeds 10 MB, or disallowed MIME type.
- `401` — No session.
- `403` — Session token does not match URL token.
- `404` — Invitation not found.
- `410` — Invitation expired or already completed.
- `500` — Disk write failure.

### DELETE /api/candidate/application/[token]/upload/[documentId]

Phase 6 Stage 4. Removes a previously uploaded file from disk. Verifies that the `documentId` appears in the candidate's saved `formData` and that the file's `storagePath` is within the candidate's own order directory.

**Path parameters:**
- `token` — invitation token
- `documentId` — UUID returned by the upload endpoint

**Response (200):**
```json
{ "deleted": true }
```

If the file is already absent from disk (idempotent retry), the endpoint still returns `200`.

No `formData` mutation occurs — the candidate's next auto-save omits the metadata because the UI removes it from local state before triggering the save.

**Errors:**
- `400` — `documentId` is not a valid UUID.
- `401` — No session.
- `403` — Session token does not match URL token.
- `404` — No metadata found for the `documentId` in the candidate's saved `formData`, or the metadata's `storagePath` does not belong to this candidate's order. Both cases return `404` rather than `403` to avoid leaking document existence across orders.
- `410` — Invitation expired or already completed.
- `500` — File removal failed.

## Error Responses

All endpoints return standard HTTP status codes:

- `401 Unauthorized` - No session or invalid session
- `403 Forbidden` - Session token doesn't match URL token
- `404 Not Found` - Invitation not found
- `410 Gone` - Invitation expired or already completed
- `400 Bad Request` - Invalid request parameters or body
- `500 Internal Server Error` - Server error occurred

## Field Locking

Fields that are pre-filled from the invitation (firstName, lastName, email, phone) are locked and cannot be modified by the candidate. The save endpoint filters out any attempts to modify locked fields to ensure data integrity.

## Auto-Save Behavior

The frontend implements auto-save when:
- The candidate blurs out of a field (clicks or tabs away)
- Changes are debounced for 300ms to batch multiple field changes
- A visual indicator shows the save status (saving/saved/error)

## Data Storage

Form data is stored in the `formData` JSON column on the `CandidateInvitation` table until the application is submitted. The structure is:

```json
{
  "sections": {
    "personal_info": {
      "type": "personal_info",
      "fields": [...]
    },
    "idv": {
      "type": "idv",
      "country": "US",
      "fields": [...]
    },
    "service_<id>": {
      "type": "service_section",
      "fields": [...]
    },
    "education": {
      "type": "education",
      "entries": [
        {
          "entryId": "uuid",
          "countryId": "uuid",
          "entryOrder": 0,
          "fields": [
            { "requirementId": "uuid", "value": "...", "savedAt": "ISO timestamp" }
          ]
        }
      ]
    },
    "employment": {
      "type": "employment",
      "entries": [ /* same shape as education */ ]
    }
  }
}
```

Repeatable sections (`education`, `employment`) store entries directly under the section. Whole-section replacement on save means the stored `entries` array is always overwritten with the request body's `entries` array.

Phase 7 Stage 1 added two sibling keys alongside `sections` to persist visit tracking data:

```json
{
  "sections": { "...": "..." },
  "sectionVisits": {
    "<sectionId>": {
      "visitedAt": "ISO 8601 timestamp",
      "departedAt": "ISO 8601 timestamp | null"
    }
  },
  "reviewPageVisitedAt": "ISO 8601 timestamp | null"
}
```

Both keys default to their empty state (`{}` and `null`) when no visit data has been saved. They are written by the `section_visit_tracking` save shape and read back by the `/saved-data` endpoint.