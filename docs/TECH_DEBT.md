# GlobalRx — Tech Debt & Known Issues

This document tracks deferred issues, known limitations, and technical debt
across the GlobalRx platform. Items are logged here when they are identified
but not fixed — usually because the fix is low priority, high churn, or better
handled during a future pass on the affected area.

---

## How to Use This Document

- **Add an item** when a code review, standards check, or dev session identifies
  something that should be fixed but is being intentionally deferred.
- **Remove an item** when it has been resolved — note the fix in the entry before
  deleting it, or move it to the Resolved section at the bottom.
- **Reference this doc** at the start of any work on an affected area so the
  issue can be addressed at the right time.

---

## Open Items

---

### TD-002 — Address Block JSON Parsing Missing in Order Validation Service

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Order Validation Service                   |
| Severity    | Warning                                     |
| Identified  | March 24, 2026 - Address Block Persistence Fix Stage 4 |
| Identified by | Code Reviewer                            |

**Description:**
`order-validation.service.ts` line 295 assigns `data.fieldValue` directly without checking if it needs JSON parsing for address_block fields. While this service is primarily for validation and may not display address blocks, it could cause issues if address block validation logic is added later. This follows the exact same pattern as the bug that was just fixed in useOrderFormState.ts.

**Why deferred:**
The validation service currently works at the string level and doesn't need to inspect the internal structure of address blocks. The fix is not critical for current functionality.

**When to fix:**
Address when adding validation logic that needs to inspect address block structure (e.g., validating that required address fields like street1 or city are present).

**Pattern to apply:**
Follow the same JSON parsing pattern implemented in `useOrderFormState.ts` lines 384-416.

---

### TD-001 — Hardcoded Text Strings in Fulfillment ID Standardization Files

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Fulfillment / Service APIs & Components     |
| Severity    | Warning                                     |
| Identified  | March 18, 2026 - Fulfillment ID Standardization Stage 6 |
| Identified by | Standards Checker                         |

**Description:**
Several files in the fulfillment ID standardization feature contain hardcoded
text strings that should be externalized to the translation system using
the `t()` function from `@/contexts/TranslationContext`.

**Why deferred:**
Fixing this would require updating all related test mocks, resulting in high
churn for low value at this stage of development. The functionality works
correctly with the hardcoded strings, and internationalization is not a
current priority.

**When to fix:**
Address during a future iteration when the affected components are being
worked on for another reason, or when internationalization becomes a priority.

**Files affected:**
- `src/components/services/ServiceResultsSection.tsx` - Multiple hardcoded strings including:
  - "Invalid service ID format"
  - "Failed to load service data"
  - "Service is in terminal status and cannot be edited"
  - "Results saved successfully"
  - "Only PDF files are allowed"
  - "File size must be 5MB or less"
  - "File uploaded successfully"
  - "Attachment deleted successfully"
  - "Loading results..."
  - "Search Results" (label)
  - "Enter search results and findings..." (placeholder)
  - "Added by" / "Last modified by" metadata text
  - Button text: "Save", "Saving...", "Cancel", "Upload PDF", "Uploading..."
  - "No attachments"
  - "Delete Attachment" (dialog title)
  - "Are you sure you want to delete this attachment? This action cannot be undone."

**Note:** ServiceCommentSection.tsx already properly uses the translation system,
serving as a good reference implementation when this tech debt is addressed.

---

### TD-002 — Race Condition in Comment Creation

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Service Comments / Hooks                    |
| Severity    | Warning                                     |
| Identified  | March 19, 2026 - Service Comment Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
In `useServiceComments.ts` lines 301-302, the refetch after comment creation could return stale data if another user creates a comment simultaneously. The current implementation performs an optimistic update followed by a refetch, but there's no synchronization mechanism to handle concurrent modifications.

**Why deferred:**
The current implementation works correctly for single-user scenarios and the optimistic update provides good UX. Implementing optimistic locking or robust synchronization would require significant changes to the backend and frontend state management.

**When to fix:**
Consider implementing optimistic locking or robust synchronization when revisiting the comment system for multi-user collaboration features.

---

### TD-003 — Type Safety Compromise in Service Comment Service

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Service Comments / API                      |
| Severity    | Warning                                     |
| Identified  | March 19, 2026 - Service Comment Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
In `service-comment-service.ts` line 252, using `any[]` for comments to avoid type mismatch reduces type safety. The ServiceCommentWithRelations type doesn't perfectly align with the Prisma query result.

**Why deferred:**
The type mismatch is due to complex Prisma relations and would require creating a proper type union or updating the ServiceCommentWithRelations type definition. The current workaround functions correctly.

**When to fix:**
Create a proper type union or update ServiceCommentWithRelations type when refactoring the comment system or during a TypeScript strict mode cleanup pass.

---

### TD-004 — Mixed ID Usage in Order Details View

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Fulfillment / Order Management              |
| Severity    | Warning                                     |
| Identified  | March 19, 2026 - Service Comment Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
In `OrderDetailsView.tsx` line 360, the hybrid approach using `ServicesFulfillment.id || OrderItem.id` is a temporary workaround. This dual ID pattern adds complexity and was the root cause of the comment display bug.

**Why deferred:**
This will be fully resolved when the ServicesFulfillment auto-creation feature is implemented, which will ensure every OrderItem always has a corresponding ServicesFulfillment record from creation.

**When to fix:**
Will be fully resolved when ServicesFulfillment auto-creation feature is implemented. Until then, the hybrid approach maintains backward compatibility.

---

### TD-005 — SessionStorage Security Concern in Order Form State

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Orders / Form State Management              |
| Severity    | Warning                                     |
| Identified  | March 24, 2026 - Draft Order DSX Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
In `useOrderFormState.ts`, the fix for the DSX field values bug uses sessionStorage to temporarily store field values during the remapping process (field names to field IDs). This introduces potential security concerns:
- Field values might contain sensitive data (education details, employment history, etc.)
- SessionStorage persists across page refreshes and could expose data if user navigates away before remapping completes
- No cleanup if the user cancels the operation or closes the browser mid-process

**Why deferred:**
The current implementation works correctly and follows the same pattern already used for subject fields. Changing this would require refactoring both search field and subject field remapping logic.

**When to fix:**
Consider refactoring when implementing a broader state management solution or security audit. Could keep data in component state or use a more temporary storage mechanism.

**Potential race condition:**
The remapping relies on the callback being called after requirements are fetched. If the callback fails or is not invoked for any reason, the sessionStorage items will persist indefinitely.

**Recommendation:**
Add a cleanup mechanism in a `useEffect` cleanup function or error handler.

---

### TD-006 — Code Duplication in Field Remapping Logic

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Orders / Form State Management              |
| Severity    | Warning                                     |
| Identified  | March 24, 2026 - Draft Order DSX Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
In `useOrderFormState.ts`, the remapping logic for search fields (lines 367-391) is very similar to the existing subject field remapping logic (lines 331-361). Both follow the same pattern:
- Store data in sessionStorage with field names as keys
- Wait for requirements to load
- Remap from field names to field IDs
- Clean up sessionStorage

**Why deferred:**
The duplication is functional and both implementations work correctly. Extracting a utility function would be a refactoring task beyond the scope of the bug fix.

**When to fix:**
Extract into a reusable utility function when refactoring the order form state management or during a code quality improvement pass.

**Recommendation:**
Create a generic `remapFieldNamesToIds` utility function that can handle both search fields and subject fields consistently.

---

### TD-007 — Missing User Feedback for Document Upload Failures

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Orders / Document Upload                    |
| Severity    | Warning                                     |
| Identified  | March 25, 2026 - Document Persistence Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
In `DocumentsReviewStep.tsx` lines 188 and 195, there are TODO comments indicating that error messages are not shown to users when document uploads fail. While errors are logged to the console, users receive no visual feedback when a document upload fails.

**Why deferred:**
The core bug fix (document persistence) works correctly. Adding user feedback UI is an enhancement beyond the scope of the bug fix.

**When to fix:**
Add proper error UI components when implementing a broader error handling strategy or during UX improvements pass.

**Recommendation:**
Display a toast notification or inline error message when upload fails.

---

### TD-008 — File Cleanup for Orphaned Draft Documents

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Orders / Document Upload                    |
| Severity    | Warning                                     |
| Identified  | March 25, 2026 - Document Persistence Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
When draft orders are deleted or documents are replaced, the old files remain on disk in the `uploads/draft-documents/` directory. There is no cleanup mechanism for orphaned files.

**Why deferred:**
The document persistence feature works correctly. File cleanup is a storage optimization issue, not a functional bug.

**When to fix:**
Implement during a storage optimization pass or when adding a scheduled cleanup job system.

**Recommendation:**
- Add a cleanup endpoint that removes orphaned files when documents are replaced
- Consider a scheduled job that removes files not referenced by any order_data entries

---

### TD-009 — No Upload Progress Indication for Large Files

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Orders / Document Upload                    |
| Severity    | Minor                                       |
| Identified  | March 25, 2026 - Document Persistence Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
For large files (up to 10MB limit), users have no visual indication that an upload is in progress. The UI doesn't provide feedback during the upload process.

**Why deferred:**
The upload functionality works correctly for typical document sizes. Progress indication is a UX enhancement.

**When to fix:**
Add when implementing a comprehensive loading/progress indicator system across the application.

**Recommendation:**
Add a loading spinner or progress bar during file upload, especially for files over 1MB.

---

### TD-010 — Inline Styles in Checkbox Component

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | UI Components / Checkbox                    |
| Severity    | Critical (Standards Violation)              |
| Identified  | March 28, 2026 - Education Verification Bug Fix Stage 5 |
| Identified by | Standards Checker                         |

**Description:**
`src/components/ui/checkbox.tsx` lines 35-48 and 54 contain inline styles that violate the "no inline styles — ever" rule in CODING_STANDARDS.md. The component uses `style={{ height: '16px', width: '16px', ... }}` instead of Tailwind classes.

**Why deferred:**
The component functions correctly with inline styles. The bug fix for the infinite loop is the priority, and styling changes could be handled in a separate cleanup pass.

**When to fix:**
During a UI components standardization pass or when the checkbox component needs other modifications.

**Recommendation:**
Replace inline styles with Tailwind classes: `h-4 w-4 min-h-[16px] min-w-[16px] max-h-[16px] max-w-[16px] flex items-center justify-center flex-shrink-0 box-border`

---

### TD-011 — Hardcoded Text in Scope Selector Component

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Customer Components / Scope Selector        |
| Severity    | Critical (Standards Violation)              |
| Identified  | March 28, 2026 - Education Verification Bug Fix Stage 5 |
| Identified by | Standards Checker                         |

**Description:**
`src/components/modules/customer/scope-selector.tsx` lines 91, 141, and 215 contain hardcoded "Scope:" text that should use the translation system per CODING_STANDARDS.md.

**Why deferred:**
The component works correctly with hardcoded English text. Fixing would require updating all test mocks that use this component.

**When to fix:**
During an internationalization pass or when the scope-selector component needs other modifications.

**Recommendation:**
- Import `useTranslation` hook
- Replace "Scope:" with `{t('common.scope')}`
- Add translation key to all language files

---

### TD-012 — Missing File Header Comments

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Multiple Components                          |
| Severity    | Warning (Standards Violation)               |
| Identified  | March 28, 2026 - Education Verification Bug Fix Stage 5 |
| Identified by | Standards Checker                         |

**Description:**
The following files are missing file path header comments as required by CODING_STANDARDS.md:
- `src/components/ui/checkbox.tsx` (already has it, false positive)
- `src/components/modules/customer/package-dialog-new.tsx`

**Why deferred:**
Missing comments don't affect functionality. Low priority compared to fixing actual bugs.

**When to fix:**
During any future modification to these files.

**Recommendation:**
Add `// src/components/modules/customer/package-dialog-new.tsx` as the first line.

---

### TD-013 — Extensive Use of 'any' Types in Package Dialog

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Customer Components / Package Dialog         |
| Severity    | Warning (TypeScript Standards)              |
| Identified  | March 28, 2026 - Education Verification Bug Fix Stage 5 |
| Identified by | Standards Checker                         |

**Description:**
`src/components/modules/customer/package-dialog-new.tsx` has multiple uses of `any` type on lines 25, 61, 150, 153, 158, 230, 252, 263, 282, 514, violating the "No any types" rule in CODING_STANDARDS.md.

**Why deferred:**
These are pre-existing violations not introduced by the bug fix. Fixing would require extensive type definitions and could introduce new issues.

**When to fix:**
During a TypeScript strict mode cleanup pass or when refactoring the package dialog component.

**Recommendation:**
Define proper TypeScript interfaces for all data structures used in the component.

---

### TD-014 — Incomplete Next.js 15 Dynamic Routes Migration

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | API Routes / Next.js 15                     |
| Severity    | Critical (Will cause runtime errors)        |
| Identified  | March 28, 2026 - Education Verification Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
While reviewing the bug fix, the code reviewer identified that many API routes still use the old Next.js pattern of directly destructuring params without awaiting. At least 15 dynamic route files need the `await params` pattern applied, including:
- `/src/app/api/users/[id]/route.ts` (line 53)
- And many others throughout the API routes directory

**Why deferred:**
Not related to the Education Verification infinite loop bug. Fixing all routes would expand the scope significantly beyond the current bug fix.

**When to fix:**
URGENT - Should be addressed in a separate bug fix cycle as these routes will fail at runtime when accessed.

**Recommendation:**
- Create a migration script to identify all dynamic routes needing updates
- Apply the `await params` pattern consistently across all routes
- Add regression tests for each migrated route

---

### TD-015 — Complex Ref Handling in PackageDialog

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Customer Components / Package Dialog         |
| Severity    | Warning (Code Complexity)                   |
| Identified  | March 28, 2026 - Education Verification Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |

**Description:**
`src/components/modules/customer/package-dialog-new.tsx` uses refs (`scopesRef` and `selectedServiceIdsRef`) to stabilize the `handleScopeChange` callback. While this works, it adds complexity compared to using `useCallback` with proper dependencies.

**Why deferred:**
The current implementation successfully fixes the infinite loop bug. Refactoring to a simpler pattern is not critical.

**When to fix:**
During a code simplification pass or when the component needs other modifications.

**Recommendation:**
Consider using `useCallback` with proper dependency array instead of refs for callback stabilization.

---

### TD-016 — fieldKey Error Handling for Undefined Values

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Order Validation / Form Hooks               |
| Severity    | Warning (Low Risk)                         |
| Identified  | April 6, 2026 - fieldKey Implementation     |
| Identified by | Code Reviewer                             |

**Description:**
`useOrderValidation.ts` lines 226, 249 and `OrderValidationService` lines 117, 130, 181, 194 directly use `field.fieldKey` or `requirement.fieldKey` without checking if undefined. Could cause runtime errors if fieldKey is missing.

**Why deferred:**
Low risk since the database migration enforces NOT NULL on the fieldKey column, and all API routes now return fieldKey. Defensive checks would add code complexity for an edge case that shouldn't occur in production.

**When to fix:**
Add defensive checks if fieldKey generation logic changes or if we need to support legacy data without fieldKeys.

---

### TD-017 — generateFieldKey() Unicode/Non-Latin Character Support

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Data RX / Field Management                  |
| Severity    | Major (International Support)               |
| Identified  | April 6, 2026 - fieldKey Implementation     |
| Identified by | Code Reviewer                             |

**Description:**
The `generateFieldKey()` function in `/api/data-rx/fields/route.ts` strips all non-alphanumeric characters. Fields with Chinese, Arabic, Cyrillic, or other non-Latin names will generate empty or broken keys.

**Why deferred:**
Currently all field names in the system use English/Latin characters. International support is not an immediate requirement.

**When to fix:**
Must be implemented before international field names are used. Consider using a Unicode-aware slug generation library or transliteration.

**Recommendation:**
Use a library like `transliteration` or `slugify` that can handle Unicode characters properly.

---

### TD-018 — Migration Fallback Uses Opaque UUID Keys

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Database Migration / fieldKey               |
| Severity    | Minor (Code Quality)                       |
| Identified  | April 6, 2026 - fieldKey Implementation     |
| Identified by | Code Reviewer                             |

**Description:**
The migration uses `SUBSTRING(REPLACE(id::text, '-', ''), 1, 16)` for unmapped fields, creating keys like "f47ac10b58cc4372" that are meaningless and hard to debug.

**Why deferred:**
The fallback only applies to non-field records (documents, forms) where fieldKey isn't actually used. Improving this would require re-running the migration.

**When to fix:**
Improve when adding fieldKey support for document/form types, or if debugging issues with these opaque keys.

---

### TD-019 — Components Directly Access subject.firstName/lastName

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Order Components / Subject Data             |
| Severity    | Major (Breaking Change Risk)               |
| Identified  | April 6, 2026 - fieldKey Implementation     |
| Identified by | Code Reviewer                             |

**Description:**
Multiple components expect `subject.firstName` and `subject.lastName` to exist as exact property names. If a subject field's fieldKey doesn't match these exact strings (e.g., "givenName" instead of "firstName"), components will break.

**Why deferred:**
The migration ensures standard fields map to expected keys ("firstName", "lastName"). Risk is low for current data.

**When to fix:**
Before allowing custom field names that might generate different keys. Need to identify all affected components and update them to handle dynamic field keys.

**Affected components:**
Need to search for all components accessing `subject.firstName` or `subject.lastName` directly.

---

## Resolved Items

_(Move items here when fixed, with a note on how they were resolved)_

---
