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
    "type": "workflow_section | service_section | personal_info",
    "placement": "before_services | services | after_services",
    "status": "not_started | in_progress | complete",
    "order": "number",
    "functionalityType": "string | null",
    "serviceIds": ["string"] // For service sections
  }]
}
```

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

### POST /api/candidate/application/[token]/save

Auto-saves the candidate's in-progress form data. Called automatically when the candidate moves between fields, adds an entry, or removes an entry.

The endpoint accepts two distinct request shapes, dispatched by `sectionType`:

**Flat-fields format** — used for `personal_info`, `idv`, `workflow_section`, and `service_section`:
```json
{
  "sectionType": "personal_info | idv | workflow_section | service_section",
  "sectionId": "string",
  "fields": [{
    "requirementId": "string (UUID)",
    "value": "any"
  }]
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

The response contains two section shapes, depending on the section type.

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