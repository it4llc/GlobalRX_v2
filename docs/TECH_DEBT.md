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

## Resolved Items

_(Move items here when fixed, with a note on how they were resolved)_

---
