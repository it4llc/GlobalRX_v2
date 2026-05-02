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

Auto-saves the candidate's in-progress form data. Called automatically when the candidate moves between fields.

**Request Body:**
```json
{
  "sectionType": "personal_info | idv | workflow_section | service_section",
  "sectionId": "string",
  "fields": [{
    "requirementId": "string",
    "value": "any"
  }]
}
```

**Response:**
```json
{
  "success": "boolean",
  "savedAt": "ISO timestamp"
}
```

### GET /api/candidate/application/[token]/saved-data

Loads the candidate's previously saved form data for pre-populating the form when they return.

**Response:**
```json
{
  "sections": {
    "personal_info": {
      "fields": [{
        "requirementId": "string",
        "value": "any"
      }]
    },
    "idv": {
      "country": "string",
      "fields": [{
        "requirementId": "string",
        "value": "any"
      }]
    }
  }
}
```

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
    }
  }
}
```