# Technical Plan: Repeatable Entry Sections — Education & Employment History
**Based on specification:** phase6-stage2-repeatable-entries-education-employment.md  
**Date:** May 2, 2026

## Database Changes

No database schema changes are required for this stage. The existing schema supports all needed functionality:

- `CandidateInvitation.formData` (Json field) already stores form data and can store entries arrays
- `PackageService.scope` (Json field) already exists to store scope configuration
- `Service.functionalityType` already identifies education (`verification-edu`) and employment (`verification-emp`) services
- All DSX requirement tables remain unchanged

**Data Structure Extension:**
The formData JSON structure will be extended to support entries arrays for education and employment sections:
```json
{
  "sections": {
    "personal_info": { "fields": [...] },
    "idv": { "fields": [...] },
    "education": {
      "entries": [
        {
          "entryId": "uuid",
          "countryId": "country-uuid",
          "entryOrder": 0,
          "fields": [...]
        }
      ]
    },
    "employment": {
      "entries": [...]
    }
  }
}
```

## New Files to Create

### API Routes

1. **`src/app/api/candidate/application/[token]/scope/route.ts`**
   - Purpose: Returns scope requirements for a specific functionality type
   - Contains: GET handler that queries PackageService.scope JSON for the service matching the functionality type
   - Returns scope type, value, and human-readable description

### Components

2. **`src/components/candidate/form-engine/RepeatableEntryManager.tsx`**
   - Purpose: Manages list of entries with add/remove functionality
   - Contains: Client component handling entry lifecycle, expand/collapse UI, and mobile accordion behavior
   - Exports: RepeatableEntryManager component and EntryData interface

3. **`src/components/candidate/form-engine/EducationSection.tsx`**
   - Purpose: Education History section with multiple entry support
   - Contains: Client component using RepeatableEntryManager, per-entry country selection, DSX field rendering
   - Handles auto-save with entryId and countryId context

4. **`src/components/candidate/form-engine/EmploymentSection.tsx`**
   - Purpose: Employment History section with multiple entry support
   - Contains: Client component similar to EducationSection but for employment entries
   - Includes special handling for "currently employed" field visibility logic

5. **`src/components/candidate/form-engine/ScopeDisplay.tsx`**
   - Purpose: Shows scope requirements to the candidate
   - Contains: Simple display component that formats scope information based on type
   - Uses translation keys for internationalized messages

6. **`src/components/candidate/form-engine/EntryCountrySelector.tsx`**
   - Purpose: Country dropdown for individual entries
   - Contains: Reusable country selector component used within each entry
   - Triggers field reload when country changes

### Types

7. **`src/types/candidate-repeatable-form.ts`**
   - Purpose: TypeScript types for repeatable entries
   - Contains: EntryData, RepeatableSection, ScopeInfo, and related types
   - Extends existing candidate-portal types

### Tests

8. **`src/app/api/candidate/application/[token]/scope/__tests__/route.test.ts`**
   - Purpose: Tests for scope endpoint
   - Contains: Tests for authentication, functionality type validation, scope retrieval

9. **`src/components/candidate/form-engine/__tests__/RepeatableEntryManager.test.tsx`**
   - Purpose: Tests for entry management
   - Contains: Tests for add/remove entries, ordering, mobile accordion behavior

10. **`src/components/candidate/form-engine/__tests__/EducationSection.test.tsx`**
    - Purpose: Tests for education section
    - Contains: Tests for country selection, field loading, auto-save with entries

11. **`src/components/candidate/form-engine/__tests__/EmploymentSection.test.tsx`**
    - Purpose: Tests for employment section
    - Contains: Tests similar to education plus "currently employed" logic

## Existing Files to Modify

### 1. **`src/app/api/candidate/application/[token]/save/route.ts`**
- **Current:** Handles flat field arrays for personal_info, idv, workflow_section, service_section
- **Change:** Add support for `education` and `employment` section types with entries array structure
- **Why:** Must handle whole-section replacement for repeatable entries
- **Confirmed:** File was read and analyzed

**Specific changes:**
- Update `saveRequestSchema` to accept `education` and `employment` as sectionType values
- Add conditional logic to detect education/employment sections
- When these sections are detected, expect `entries` array in request body
- Replace entire section data with provided entries (whole-section replacement)
- Maintain backward compatibility for existing section types

### 2. **`src/app/api/candidate/application/[token]/saved-data/route.ts`**
- **Current:** Returns flat fields arrays for all sections
- **Change:** Return entries arrays for education and employment sections
- **Why:** Frontend needs to restore multiple entries with their country selections
- **Confirmed:** File was read (lines 1-132)

**Specific changes:**
- Check if section type is education or employment
- If yes, return data in entries array format with entryId, countryId, entryOrder
- If no, maintain existing flat fields format

### 3. **`src/components/candidate/portal-layout.tsx`**
- **Current:** Renders PersonalInfoSection, IdvSection, or SectionPlaceholder based on type
- **Change:** Add cases for education and employment sections
- **Why:** Need to render new section components
- **Confirmed:** File was read (lines 1-106) in Stage 1

**Specific changes:**
- Import EducationSection and EmploymentSection components
- Add conditionals to check functionalityType
- Render appropriate component for verification-edu and verification-emp

### 4. **`src/types/candidate-portal.ts`**
- **Current:** Has basic form data types without entry support
- **Change:** Extend FormSectionData to support entries array
- **Why:** Need types for entry-based data structure
- **Confirmed:** File was read (lines 1-83)

**Specific changes:**
- Add optional `entries` field to FormSectionData interface
- Add `entryId`, `countryId`, `entryOrder` to entry data structure

### 5. **`src/translations/en-US.json`**
- **Current:** Contains existing candidate portal translations
- **Change:** Add new translation keys for repeatable entries
- **Why:** All user-facing text needs translations
- **Confirmed:** Translation files use en-US.json based on file listing

## API Routes

### GET /api/candidate/application/[token]/scope

- **Path:** `/api/candidate/application/[token]/scope`
- **Methods:** GET
- **Authentication:** Required - must have valid candidate_session cookie matching token
- **Permission:** Token in URL must match session token
- **Input:** Query param: `functionalityType` (required, e.g., "verification-edu", "verification-emp")
- **Validation:** 
  ```typescript
  z.object({
    functionalityType: z.enum(['verification-edu', 'verification-emp'])
  })
  ```
- **Returns:** 
  ```typescript
  {
    functionalityType: string,
    serviceId: string,
    scopeType: 'count_exact' | 'count_specific' | 'time_based' | 'all',
    scopeValue: number | null,
    scopeDescription: string
  }
  ```
- **Errors:** 
  - 401 (no session)
  - 403 (token mismatch)
  - 404 (invitation/service not found)
  - 410 (expired/completed)
  - 400 (invalid functionalityType)

### POST /api/candidate/application/[token]/save (Modified)

**New request format for education/employment sections:**
- **Input for repeatable sections:**
  ```typescript
  {
    sectionType: 'education' | 'employment',
    sectionId: string,
    entries: [
      {
        entryId: string,
        countryId: string | null,
        entryOrder: number,
        fields: [
          {
            requirementId: string,
            value: any
          }
        ]
      }
    ]
  }
  ```
- **Behavior:** Whole-section replacement - replaces ALL entries for the section with provided data
- **Validation:** Must validate entries array structure when sectionType is education or employment

### GET /api/candidate/application/[token]/saved-data (Modified)

**New response format for education/employment sections:**
- **Returns for repeatable sections:**
  ```typescript
  {
    sections: {
      "education": {
        entries: [
          {
            entryId: string,
            countryId: string,
            entryOrder: number,
            fields: [
              {
                requirementId: string,
                value: any
              }
            ]
          }
        ]
      }
    }
  }
  ```

## Zod Validation Schemas

### scopeQuerySchema
```typescript
z.object({
  functionalityType: z.enum(['verification-edu', 'verification-emp'])
})
```

### repeatableSaveRequestSchema
```typescript
z.object({
  sectionType: z.enum(['education', 'employment']),
  sectionId: z.string(),
  entries: z.array(z.object({
    entryId: z.string().uuid(),
    countryId: z.string().uuid().nullable(),
    entryOrder: z.number().int().min(0),
    fields: z.array(z.object({
      requirementId: z.string().uuid(),
      value: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.string())
      ])
    }))
  }))
})
```

## TypeScript Types

### `src/types/candidate-repeatable-form.ts`

```typescript
export interface EntryData {
  entryId: string;
  countryId: string | null;
  entryOrder: number;
  fields: Array<{
    requirementId: string;
    value: any;
  }>;
}

export interface RepeatableSection {
  entries: EntryData[];
}

export interface ScopeInfo {
  functionalityType: string;
  serviceId: string;
  scopeType: 'count_exact' | 'count_specific' | 'time_based' | 'all';
  scopeValue: number | null;
  scopeDescription: string;
}

export interface EntryManagerProps {
  entries: EntryData[];
  onAddEntry: () => void;
  onRemoveEntry: (entryId: string) => void;
  onEntryChange: (entryId: string, data: Partial<EntryData>) => void;
  renderEntry: (entry: EntryData, index: number) => React.ReactNode;
  entryLabelKey: string; // Translation key for entry labels
}
```

## UI Components

### RepeatableEntryManager (`src/components/candidate/form-engine/RepeatableEntryManager.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** List of entry cards with add/remove buttons
- **Uses:** Tailwind classes, mobile accordion pattern
- **API calls:** None - purely UI management
- **Props:** EntryManagerProps (see types above)
- **Key features:**
  - Mobile: Accordion behavior (one expanded at a time)
  - Desktop: All entries expanded by default
  - Debounced "Add Entry" button to prevent duplicate entries
  - Entry removal with brief confirmation message

### EducationSection (`src/components/candidate/form-engine/EducationSection.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** Scope display, entry manager, per-entry country selector and fields
- **Uses:** RepeatableEntryManager, EntryCountrySelector, DynamicFieldRenderer, AutoSaveIndicator
- **API calls:**
  - GET scope on mount
  - GET fields when country selected per entry
  - GET saved-data on mount
  - POST save with entries array on changes
- **Handles:** Country change preserving old data, entry-specific field loading

### EmploymentSection (`src/components/candidate/form-engine/EmploymentSection.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** Similar to EducationSection
- **Uses:** Same components as EducationSection
- **API calls:** Same pattern as EducationSection
- **Special logic:** Hides end date field when "currently employed" field is true

### ScopeDisplay (`src/components/candidate/form-engine/ScopeDisplay.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** Informational text about scope requirements
- **Uses:** Translation context, Tailwind classes
- **API calls:** None - receives scope data as props
- **Props:** ScopeInfo type

### EntryCountrySelector (`src/components/candidate/form-engine/EntryCountrySelector.tsx`)
- **Type:** Client component (`"use client"`)
- **Renders:** Country dropdown for an individual entry
- **Uses:** Native select element on mobile, shadcn Select on desktop
- **API calls:** None - country list passed as prop
- **Props:** value, onChange, countries array

## Translation Keys

Following the `module.section.element` convention for `en-US.json`:

```json
{
  "candidate.portal.educationHistory": "Education History",
  "candidate.portal.employmentHistory": "Employment History",
  "candidate.portal.addEntry": "Add Entry",
  "candidate.portal.removeEntry": "Remove",
  "candidate.portal.entryRemoved": "Entry removed",
  "candidate.portal.educationEntryLabel": "Education {number}",
  "candidate.portal.employmentEntryLabel": "Employment {number}",
  "candidate.portal.selectCountryForEntry": "Select country",
  "candidate.portal.noFieldsForCountry": "No information is required for this country",
  "candidate.portal.noAdditionalInfo": "No additional information is required for this entry",
  "candidate.portal.scopeCountExact": "Please provide your most recent {type} entry",
  "candidate.portal.scopeCountSpecific": "Please provide your most recent {count} {type} entries",
  "candidate.portal.scopeTimeBased": "Please provide all {type} for the past {years} years",
  "candidate.portal.scopeAll": "Please provide your complete {type} history"
}
```

## Order of Implementation

1. **Database review** - Verify no schema changes needed
2. **TypeScript types** (`src/types/candidate-repeatable-form.ts`)
3. **Zod schemas** (in respective API route files)
4. **API route: GET scope** - New endpoint for scope requirements
5. **API route modifications: POST save** - Add entries array support
6. **API route modifications: GET saved-data** - Return entries array format
7. **UI component: ScopeDisplay** - Simple display component
8. **UI component: EntryCountrySelector** - Reusable country dropdown
9. **UI component: RepeatableEntryManager** - Core entry management
10. **UI component: EducationSection** - Complete education form
11. **UI component: EmploymentSection** - Complete employment form
12. **Modify portal-layout** - Wire up new section components
13. **Translation keys** - Add to `src/translations/en-US.json`
14. **Tests: API routes** - Test new and modified endpoints
15. **Tests: Components** - Test new UI components
16. **Integration testing** - End-to-end flow validation

## Risks and Considerations

### 1. Save Endpoint Complexity
The save endpoint must handle two different data structures: flat fields for existing sections and entries arrays for new repeatable sections. The implementer must carefully maintain backward compatibility while adding the new structure. Whole-section replacement for education/employment means the frontend must always send ALL entries, not just changes.

### 2. Country Data Persistence
When a candidate changes the country on an entry, the old country's data must be preserved. The save structure should key data by both entryId and countryId to allow restoration when switching back. This matches the IDV section's behavior from Stage 1.

### 3. Mobile Performance
With many entries (10+), mobile devices may struggle with rendering performance. The accordion pattern (one expanded at a time) helps, but the implementer should test with realistic data volumes and consider virtual scrolling if needed.

### 4. Entry ID Generation
Entry IDs are generated on the frontend (UUID v4). The implementer must ensure proper UUID generation and handle potential (though extremely unlikely) collisions gracefully.

### 5. Currently Employed Field Detection
The employment section needs to detect fields with fieldKey like `currentlyEmployed` or `isCurrent` to hide the end date. The exact fieldKey must be confirmed from live DSX data. The implementer should make this detection flexible to handle variations.

### 6. Scope Default Handling
If the scope API returns no configuration or fails, default to "all" scope type. At least one entry should always be shown initially to guide the candidate.

### 7. DSX Field Loading Per Entry
Each entry can have a different country, requiring separate field loading. The implementer must ensure efficient batching if multiple entries select the same country to avoid redundant API calls.

### 8. Translation Key Interpolation
Several translation keys use placeholders ({number}, {count}, {type}, {years}). The implementer must ensure proper interpolation in the translation context.

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table
- [x] The plan accounts for the critical corrections (formData field, en-US.json, whole-section replacement)
- [x] Implementation order shows clear dependencies
- [x] Mobile-first requirements are addressed
- [x] All edge cases from the spec are covered

This plan is complete and ready for the test-writer to proceed.
