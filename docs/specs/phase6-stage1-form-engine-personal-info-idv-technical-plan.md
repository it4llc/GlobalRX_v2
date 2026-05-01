# Technical Plan: Core Form Engine, Personal Information & IDV Sections
**Based on specification:** phase6-stage1-form-engine-personal-info-idv.md  
**Date:** April 30, 2026

## Database Changes

No database schema changes are required for this stage. The existing schema has all the necessary tables and columns:

- `DSXRequirement` table already stores field definitions with `fieldData`, `documentData` containing all metadata
- `ServiceRequirement` links services to requirements with display order
- `DSXMapping` tracks location-specific requirements  
- `OrderData` table exists for storing candidate responses (though we need a strategy for draft storage before order items exist)
- `CandidateInvitation` has all needed fields for pre-filling (firstName, lastName, email, phone)

**Draft Data Storage Approach:**
Since OrderItems don't exist until submission (Phase 7), we will store draft data in a new JSON column on the `CandidateInvitation` table:
- Add `draftData` (Json, optional) column to store in-progress form data
- This avoids creating orphaned OrderData records
- At submission time (Phase 7), this draft data will be migrated to proper OrderData records

## New Files to Create

### API Routes

1. **`src/app/api/candidate/application/[token]/fields/route.ts`**
   - Purpose: Returns DSX field requirements for a specific service and country
   - Contains: GET handler that queries DSXRequirement via ServiceRequirement and DSXMapping

2. **`src/app/api/candidate/application/[token]/personal-info-fields/route.ts`**
   - Purpose: Returns personal information fields across all package services
   - Contains: GET handler that filters fields by collectionTab and includes pre-fill data

3. **`src/app/api/candidate/application/[token]/save/route.ts`**
   - Purpose: Auto-saves candidate's in-progress form data
   - Contains: POST handler that updates draftData JSON on CandidateInvitation

4. **`src/app/api/candidate/application/[token]/saved-data/route.ts`**
   - Purpose: Retrieves previously saved form data for the candidate
   - Contains: GET handler that returns draftData from CandidateInvitation

### Components

5. **`src/components/candidate/dynamic-field-renderer.tsx`**
   - Purpose: Renders form fields based on field definitions
   - Contains: Client component that handles text, date, number, email, phone, select, checkbox, radio

6. **`src/components/candidate/personal-info-section.tsx`**
   - Purpose: Renders the Personal Information form section
   - Contains: Client component that loads fields, renders them, handles auto-save

7. **`src/components/candidate/idv-section.tsx`**
   - Purpose: Self-contained IDV section component
   - Contains: Client component with country selector, field loading, auto-save

8. **`src/components/candidate/auto-save-indicator.tsx`**
   - Purpose: Shows save status to the candidate
   - Contains: Small UI component for "Saving..." / "Saved" / "Save failed" states

### Types

9. **`src/types/candidate-form.ts`**
   - Purpose: TypeScript types for form fields and responses
   - Contains: Field definitions, API response types, save/load data shapes

## Existing Files to Modify

### 1. **`prisma/schema.prisma`**
- **Current:** CandidateInvitation model without draft storage
- **Change:** Add `draftData Json?` field to CandidateInvitation model
- **Why:** Need to store in-progress form data before order items exist
- **Confirmed:** File was read and checked

### 2. **`src/app/api/candidate/application/[token]/structure/route.ts`**
- **Current:** Returns workflow and service sections, no Personal Information section
- **Change:** Add "Personal Information" as first section if DSX fields exist with personal info collectionTab
- **Why:** Personal Information must appear first in the section list
- **Confirmed:** File was read (lines 1-212)

### 3. **`src/types/candidate-portal.ts`**
- **Current:** Basic section types without service IDs
- **Change:** Add optional `serviceIds?: string[]` to CandidatePortalSection interface
- **Why:** Service sections need to know which services to load fields for
- **Confirmed:** File was read (lines 1-28)

### 4. **`src/components/candidate/section-placeholder.tsx`**
- **Current:** Shows placeholder for all sections
- **Change:** Check section type and render PersonalInfoSection or IDVSection instead of placeholder
- **Why:** Replace placeholders with real form components
- **Confirmed:** File needs to be read before modification

### 5. **`src/components/candidate/portal-layout.tsx`**
- **Current:** Renders SectionPlaceholder for active sections
- **Change:** Import and render new section components based on section type
- **Why:** Wire up new form components
- **Confirmed:** File was read (lines 1-106)

## API Routes

### GET /api/candidate/application/[token]/fields

- **Path:** `/api/candidate/application/[token]/fields`
- **Methods:** GET
- **Authentication:** Required - must have valid candidate_session cookie matching token
- **Permission:** Token in URL must match session token
- **Input:** Query params: `serviceId` (required), `countryId` (required)
- **Validation:** 
  - Validate token format
  - Validate serviceId and countryId are UUIDs
  - Check invitation exists and is not expired/completed
- **Returns:** Array of field definitions with complete fieldData/documentData
- **Errors:** 401 (no session), 403 (token mismatch), 404 (invitation not found), 410 (expired)

### GET /api/candidate/application/[token]/personal-info-fields

- **Path:** `/api/candidate/application/[token]/personal-info-fields`
- **Methods:** GET
- **Authentication:** Required - must have valid candidate_session cookie matching token
- **Permission:** Token in URL must match session token
- **Input:** None
- **Validation:**
  - Validate token format
  - Check invitation exists and is not expired/completed
- **Returns:** Array of personal info fields with pre-fill data and lock status
- **Errors:** 401 (no session), 403 (token mismatch), 404 (invitation not found), 410 (expired)

### POST /api/candidate/application/[token]/save

- **Path:** `/api/candidate/application/[token]/save`
- **Methods:** POST
- **Authentication:** Required - must have valid candidate_session cookie matching token
- **Permission:** Token in URL must match session token
- **Input:** JSON body with sectionType, sectionId, and fields array
- **Validation:**
  - Validate token format
  - Validate sectionType is valid enum
  - Validate fields array structure
  - Check invitation exists and is not expired/completed
- **Returns:** Success confirmation with timestamp
- **Errors:** 401 (no session), 403 (token mismatch), 404 (invitation not found), 410 (expired), 400 (invalid body)

### GET /api/candidate/application/[token]/saved-data

- **Path:** `/api/candidate/application/[token]/saved-data`
- **Methods:** GET
- **Authentication:** Required - must have valid candidate_session cookie matching token
- **Permission:** Token in URL must match session token
- **Input:** None
- **Validation:**
  - Validate token format
  - Check invitation exists and is not expired/completed
- **Returns:** Saved form data grouped by section
- **Errors:** 401 (no session), 403 (token mismatch), 404 (invitation not found), 410 (expired)

## Zod Validation Schemas

### saveRequestSchema
```typescript
z.object({
  sectionType: z.enum(['personal_info', 'idv']),
  sectionId: z.string(),
  fields: z.array(z.object({
    requirementId: z.string().uuid(),
    value: z.union([z.string(), z.number(), z.boolean(), z.null()])
  }))
})
```

### fieldsQuerySchema
```typescript
z.object({
  serviceId: z.string().uuid(),
  countryId: z.string().uuid()
})
```

## TypeScript Types

### `src/types/candidate-form.ts`

- **DSXFieldDefinition** - Complete field with all metadata from DSXRequirement
- **PersonalInfoField** - Field with pre-fill and lock status
- **SavedFormData** - Structure for saved draft data
- **FieldsResponse** - API response for fields endpoint
- **PersonalInfoResponse** - API response for personal-info-fields endpoint
- **SaveResponse** - API response for save endpoint
- **SavedDataResponse** - API response for saved-data endpoint

All response types will be derived from Zod schemas using `z.infer<typeof schema>`.

## UI Components

### DynamicFieldRenderer (`src/components/candidate/dynamic-field-renderer.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** Appropriate input based on field.dataType
- **Uses:** Standard HTML inputs with Tailwind styling
- **API calls:** None - pure rendering component
- **Props:** field definition, value, onChange, onBlur, locked, error

### PersonalInfoSection (`src/components/candidate/personal-info-section.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** List of personal info fields using DynamicFieldRenderer
- **Uses:** DynamicFieldRenderer, AutoSaveIndicator
- **API calls:** 
  - GET personal-info-fields on mount
  - GET saved-data on mount
  - POST save on field blur

### IDVSection (`src/components/candidate/idv-section.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** Country selector, then fields for selected country
- **Uses:** DynamicFieldRenderer, AutoSaveIndicator, native select for country
- **API calls:**
  - GET fields when country selected
  - GET saved-data on mount
  - POST save on field blur

### AutoSaveIndicator (`src/components/candidate/auto-save-indicator.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** Status text ("Saving...", "Saved", "Save failed - retrying")
- **Uses:** Tailwind classes for styling
- **API calls:** None - receives status as prop

## Translation Keys

Following the `module.section.element` convention:

- `candidate.portal.personalInfo` - "Personal Information"
- `candidate.portal.idv` - "Identity Verification" 
- `candidate.portal.selectCountry` - "Select your country"
- `candidate.portal.saving` - "Saving..."
- `candidate.portal.saved` - "Saved"
- `candidate.portal.saveFailed` - "Save failed - retrying"
- `candidate.portal.noFieldsRequired` - "No information is required for this section"
- `candidate.portal.addressFieldsComingSoon` - "Address fields coming soon"
- `candidate.form.required` - "Required"

## Order of Implementation

1. Database schema changes (add draftData to CandidateInvitation)
2. Prisma migration using Andy's 5-step method
3. TypeScript types (`src/types/candidate-form.ts`)
4. Zod schemas (in respective API route files)
5. API route: GET fields
6. API route: GET personal-info-fields  
7. API route: POST save
8. API route: GET saved-data
9. Modify structure API to add Personal Information section
10. UI component: AutoSaveIndicator
11. UI component: DynamicFieldRenderer
12. UI component: PersonalInfoSection
13. UI component: IDVSection
14. Modify portal-layout to render new components
15. Add translation keys to `src/translations/en.json`

## Risks and Considerations

### 1. CollectionTab Value Unknown
The exact value used for personal info `collectionTab` in existing DSX data needs to be verified. Could be "personal_info", "subject", "personal", or something else. The implementer must query the database to confirm the actual value before building the filter logic.

### 2. Draft Data Storage
Using a JSON column on CandidateInvitation for draft storage is simpler than using OrderData with null orderItemId, but has a size limit. If candidates save massive amounts of data, we may hit PostgreSQL JSON size limits. Monitor for this in production.

### 3. Country Selection Persistence
When a candidate selects a country in IDV, changes it, then changes back, the system should restore their previous data for that country. The save structure must account for this by keying data by both section and country.

### 4. Debouncing Auto-Save
Rapid field navigation could trigger many save requests. The implementer should add debouncing (300ms suggested) to batch rapid changes into single save requests.

### 5. Field Type Extensibility
While this stage handles common field types, the renderer should gracefully fall back to text input for unrecognized types rather than crashing. Log warnings for unknown types.

### 6. Session Expiry During Form Filling
If the candidate's session expires while filling the form, the next auto-save will fail with 401. The UI should detect this and redirect to login, preserving any unsaved data in browser state if possible.

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table (field names match)

This plan is complete and ready for the test-writer to proceed.
