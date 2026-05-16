# GlobalRx — Tech Debt & Known Issues

This document tracks deferred issues, known limitations, and technical debt
across the GlobalRx platform. Items are logged here when they are identified
but not fixed — usually because the fix is low priority, high churn, or better
handled during a future pass on the affected area.

---

## How to Use This Document

- **Add an item** when a code review, standards check, or dev session identifies
  something that should be fixed but is being intentionally deferred.
- **Mark an item resolved** when the underlying issue has been addressed. Add `Resolved` (date) and `Branch` fields to the entry's metadata table, add a `**How it was resolved:**` section describing the fix, and include `**Files changed:**` listing the source files touched.
- **Move the resolved entry to the Resolved Items section** at the bottom of the document once the resolution metadata is in place. Resolved entries are kept in the doc as audit history; they are not deleted.
- **Reference this doc** at the start of any work on an affected area so the
  issue can be addressed at the right time.

---

## Open Items

---


---

### TD-001 — Order View Tracking — concurrent update e2e test

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Order View Tracking API                    |
| Severity    | Low                                         |
| Identified  | April 8, 2026 - Phase 2A Test Writing      |
| Identified by | Test Writer                               |

**Description:**
Spec edge case #6 (race condition with multiple tabs) is enforced by the database unique constraint on (userId, orderId) / (userId, orderItemId) plus Prisma's upsert, but is not covered by an end-to-end test. The behavior is guaranteed by the database layer and was deliberately not tested at the API route unit level (mocked Prisma cannot exercise real concurrency).

**Why deferred:**
The unique constraint and upsert guarantee correct behavior. Testing real concurrency requires actual database operations, not mocked ones. Deferred from Phase 2A to keep the phase scoped to API behavior.

**When to fix:**
Add an e2e test that fires two simultaneous POSTs to the same view endpoint and asserts exactly one row exists with the later lastViewedAt timestamp.

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

### TD-003 — Hardcoded Text Strings in Fulfillment ID Standardization Files

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

### TD-004 — Race Condition in Comment Creation

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

### TD-005 — Type Safety Compromise in Service Comment Service

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

### TD-006 — Mixed ID Usage in Order Details View

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

### TD-007 — SessionStorage Security Concern in Order Form State

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

### TD-008 — Code Duplication in Field Remapping Logic

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

### TD-009 — Missing User Feedback for Document Upload Failures

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Orders / Document Upload                    |
| Severity    | Warning                                     |
| Identified  | March 25, 2026 - Document Persistence Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |
| Status      | **Addressed (Phase 6 Stage 4 — May 4, 2026)** |

**Description:**
In `DocumentsReviewStep.tsx` lines 188 and 195, there are TODO comments indicating that error messages are not shown to users when document uploads fail. While errors are logged to the console, users receive no visual feedback when a document upload fails.

**Why deferred:**
The core bug fix (document persistence) works correctly. Adding user feedback UI is an enhancement beyond the scope of the bug fix.

**When to fix:**
Add proper error UI components when implementing a broader error handling strategy or during UX improvements pass.

**Recommendation:**
Display a toast notification or inline error message when upload fails.

**Resolution (Phase 6 Stage 4 — May 4, 2026):**
The new `CandidateDocumentUpload` component (`src/components/candidate/CandidateDocumentUpload.tsx`) explicitly surfaces both client-side validation errors (file too large, wrong MIME type) and server-side upload errors via a visible alert region with a "Try again" affordance. The candidate flow is the first place that actively renders these messages; the legacy `DocumentsReviewStep.tsx` TODOs in the internal portal flow are tracked separately as remaining work.

---

### TD-010 — File Cleanup for Orphaned Draft Documents

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

### TD-011— No Upload Progress Indication for Large Files

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Orders / Document Upload                    |
| Severity    | Minor                                       |
| Identified  | March 25, 2026 - Document Persistence Bug Fix Stage 4 |
| Identified by | Code Reviewer                             |
| Status      | **Addressed (Phase 6 Stage 4 — May 4, 2026)** |

**Description:**
For large files (up to 10MB limit), users have no visual indication that an upload is in progress. The UI doesn't provide feedback during the upload process.

**Why deferred:**
The upload functionality works correctly for typical document sizes. Progress indication is a UX enhancement.

**When to fix:**
Add when implementing a comprehensive loading/progress indicator system across the application.

**Recommendation:**
Add a loading spinner or progress bar during file upload, especially for files over 1MB.

**Resolution (Phase 6 Stage 4 — May 4, 2026):**
`CandidateDocumentUpload` shows an animated spinner alongside the "Uploading…" label whenever the component is in the `uploading` state. The state machine is `empty → uploading → uploaded | error`, and the spinner is gated on the `uploading` state via the `data-status` attribute. Internal portal `DocumentsReviewStep.tsx` is unchanged.

---

### TD-012 — Inline Styles in Checkbox Component

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

### TD-013 — Hardcoded Text in Scope Selector Component

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

### TD-014 — Missing File Header Comments

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

### TD-015 — Extensive Use of 'any' Types in Package Dialog

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

### TD-016 — Incomplete Next.js 15 Dynamic Routes Migration

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

### TD-017 — Complex Ref Handling in PackageDialog

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

### TD-018 — fieldKey Error Handling for Undefined Values

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

### TD-019 — generateFieldKey() Unicode/Non-Latin Character Support

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

### TD-020 — Migration Fallback Uses Opaque UUID Keys

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

### TD-021 — Components Directly Access subject.firstName/lastName

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

### TD-022 — Order View Tracking — rate limiting

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Order View Tracking API                    |
| Severity    | Medium                                      |
| Identified  | April 8, 2026 - Phase 2A Implementation    |
| Identified by | Implementer                               |

**Description:**
The three order view tracking endpoints (POST /api/orders/[id]/view, POST /api/order-items/[id]/view, and GET /api/orders/[id]/views) do not have rate limiting configured. Users could potentially spam these endpoints by rapidly clicking items or refreshing pages, creating excessive database load.

**Why deferred:**
The endpoints work correctly and are only called on legitimate user interactions. Rate limiting is a performance optimization, not a functional requirement. Deferred from Phase 2A to keep the phase scoped to core API functionality.

**When to fix:**
Add appropriate rate limiting when implementing a broader API rate limiting strategy across the application. Consider per-user limits of ~100 requests per minute for view tracking endpoints.

---

### TD-023 — Implementer Agent Hardening

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Development Process / Agent Tools           |
| Severity    | Critical (Process Improvement)              |
| Identified  | April 8, 2026 - Phase 2A Stage 4 Incident  |
| Identified by | Documentation Writer                      |

**Description:**
After the Stage 4 incident in Phase 2A where the implementer agent modified test files and then deleted entire test directories, the .claude/agents/implementer.md file needs hard rules added to prevent destructive actions that interfere with the TDD process.

**Why deferred:**
This is a process improvement, not a feature bug. The implementer agent needs to be hardened but this doesn't block feature completion.

**When to fix:**
Immediately after this feature ships - this should be the next task to prevent similar incidents.

**Required changes to implementer.md:**
1. Never edit, create, or delete files matching __tests__/, tests/, or *.test.ts / *.spec.ts under any circumstance
2. Never run rm, git reset, git clean, git checkout -- ., or any other destructive command — the only allowed recovery from a bad edit is reporting the mistake and waiting for human instructions
3. If a test fails, the implementer must STOP and report the failure with diagnosis, never attempt to fix the test
4. Failure-loop protocol: stop after 3 failed attempts on the same issue and report


### TD-024 — Regression tests for admin 403 bug need proper Prisma mocking

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Testing / Service Comments API                      |
| Severity      | Low                                                 |
| Identified    | April 10, 2026 - fix/service-comment-delete-403 Branch |
| Identified by | Manual Testing / Cleanup Process                   |

**Description:**
Regression tests were attempted for the admin 403 bug on branch fix/service-comment-delete-403 but could not be completed because they didn't mock Prisma, which caused them to fail at `orderItem.findUnique` (returning null with no test database) before reaching the actual permission check being tested. The fix itself was verified manually in the browser and works correctly.

**Why deferred:**
The underlying bug fix is verified working and ready to merge. Writing proper regression tests would require understanding and mocking the entire Prisma call chain for `validateUserAccess` and `validateOrderAccess`, which is complex and out of scope for this immediate bug fix.

**When to fix:**
When adding comprehensive test coverage for the permission system. The regression tests should mock Prisma (or mock `ServiceCommentService`) so they actually exercise `validateUserAccess` and `validateOrderAccess` for admin users.

**What needs to be done:**
Rewrite the regression tests to mock Prisma or mock `ServiceCommentService` so they actually exercise the admin permission validation logic for all 5 affected endpoints:
- POST `/api/services/[id]/comments`
- PUT `/api/services/[id]/comments/[commentId]`
- DELETE `/api/services/[id]/comments/[commentId]`
- GET `/api/orders/[id]/services/comments`
- GET `/api/comment-templates`

---

### TD-025 — TypeScript Not Catching Missing ServiceCommentService.deleteComment Method

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | TypeScript Configuration / Type Safety              |
| Severity      | Major (Silent Runtime Failures)                     |
| Identified    | April 9, 2026 - Phase 2B-2 Planning                 |
| Identified by | Architect / Investigation Pass                      |

**Description:**
The DELETE route at `src/app/api/services/[id]/comments/[commentId]/route.ts` line 203 calls `service.deleteComment(commentId, session.user.id)`, but no such method exists on `ServiceCommentService` (`src/services/service-comment-service.ts`). TypeScript strict mode should catch this as a compile-time error, but `pnpm tsc --noEmit` does not report any error for this missing method. This means other missing methods or incorrect signatures could be silently slipping through the type checker elsewhere in the codebase.

**Why deferred:**
The immediate bug (missing `deleteComment` method) will be fixed as a separate bug fix. However, the deeper question of WHY TypeScript is not catching this class of error requires its own investigation — it could be a `tsconfig.json` setting, an overly permissive type declaration somewhere in the `ServiceCommentService` type chain, an implicit `any`, or a missing type import. Fixing the underlying configuration issue is out of scope for the bug fix and for Phase 2B-2.

**When to fix:**
Before adding significant new service layer code. A silent type-checker means developers cannot trust TypeScript to catch missing-method bugs, which undermines the strict-TypeScript guarantee the project relies on.

**Affected components:**
- TypeScript configuration (`tsconfig.json`)
- `src/services/service-comment-service.ts` and its type exports
- Any other service class where the type checker might be similarly silent
- The general trust level in TypeScript's safety net across the codebase

---

### TD-026 — User.userType schema default is invalid

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Database Schema / User Model                        |
| Severity      | Low (Latent Bug with No Known User Impact)          |
| Identified    | April 10, 2026 - Phase 2B-2 Architecture Investigation |
| Identified by | Architecture Investigation                          |

**Description:**
The User model in `prisma/schema.prisma` (line 28) has `userType String @default("admin")`. The string "admin" is not one of the three valid user types in this system. Valid user types are: customer, internal, vendor. Any user created without an explicit userType would silently default to "admin", which does not match any valid code path. In Phase 2B-2's activity tracking logic, an "admin"-typed user would be treated as non-customer (because "admin" !== "customer") which is mostly harmless but incorrect.

**Why deferred:**
This is a latent bug with no known current user impact. All user creation flows appear to explicitly set userType, so the invalid default may never be triggered in practice.

**When to fix:**
During any schema cleanup pass or when refactoring user type handling.

**Recommendation:**
Change the schema default to a valid value (likely "internal") or remove the default and require userType to be explicitly set at user creation time.

---

### TD-027 — `OrderStatusProgressionService` is dead code in production

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Code cleanup / Order status management              |
| Severity      | Major (Two parallel implementations, only one runs) |
| Identified    | April 11, 2026 - Phase 2B-2 Implementation          |
| Identified by | Implementation Investigation                        |

**Description:**
The class `OrderStatusProgressionService` in `src/lib/services/order-status-progression.service.ts` has zero production callers anywhere in the codebase. A direct `grep -rn "OrderStatusProgressionService" src` returns only the file's own export line and the class definition. A direct `grep -rn "checkAndProgressOrderStatus" src` returns only the service file itself and its own test file. Nothing in the running application instantiates the class or invokes its method.

The real auto-progression logic (the code that actually fires when a service is set to "submitted" and may roll an order from draft to submitted) lives inline inside `src/app/api/services/[id]/status/route.ts` at lines 358–411, inside the `PUT` handler. It updates the order status directly via `tx.order.update()` and does not go through `OrderStatusProgressionService` at all.

Phase 2B-2 added activity tracking calls to BOTH locations: harmlessly inside the dead service (where the call will never run), and correctly inside the real auto-progression block in the route file (where it does run). The dead-service activity call should be removed when the service itself is deleted.

**Why deferred:**
The decision of whether to delete `OrderStatusProgressionService` outright or to refactor the inline auto-progression code in the route handler to call into it is a design choice that goes beyond Phase 2B-2's scope. Phase 2B-2 needed to ship working activity tracking for the real auto-progression path, and that has been done.

**When to fix:**
Before any significant work touching order status management or auto-progression. The current state — two parallel implementations, only one of which runs — is a foot-gun that will mislead any future developer or AI agent investigating this area.

**Recommendation:**
One of two paths:

1. **Delete path:** Remove `src/lib/services/order-status-progression.service.ts`, its test file at `src/lib/services/__tests__/order-status-progression.service.test.ts`, and the harmless Phase 2B-2 activity tracking code that lives inside the dead service.
2. **Resurrect path:** Refactor the inline auto-progression block in `src/app/api/services/[id]/status/route.ts` (lines 358–411) to call `OrderStatusProgressionService.checkAndProgressOrderStatus()` instead of duplicating its logic. The service would then become the single source of truth and would actually run in production.

The delete path is simpler and lower risk. The resurrect path is cleaner long-term but requires touching a high-traffic route handler.

**Affected components:**
- `src/lib/services/order-status-progression.service.ts`
- `src/lib/services/__tests__/order-status-progression.service.test.ts`
- `src/app/api/services/[id]/status/route.ts` (the real auto-progression block)

---

### TD-028 — Case sensitivity bug in auto-progression status check (potential real product bug)

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Order status management / Auto-progression          |
| Severity      | Critical if the feature is used (potential silent failure) |
| Identified    | April 11, 2026 - Phase 2B-2 Implementation          |
| Identified by | Implementation Investigation                        |

**Description:**
In `src/app/api/services/[id]/status/route.ts` around line 360, the auto-progression block begins with:

```typescript
if (newStatus === 'Submitted' && orderId) {
```

The capital `'S'` in `'Submitted'` is inconsistent with the project standard that all statuses are stored lowercase in the database (display formatting is a separate concern applied at render time). If `newStatus` arrives lowercase as the standard expects, this comparison will never match, which means the auto-progression block — the code that automatically rolls a draft order to submitted when all its services are submitted — may currently never fire in production at all.

This was discovered during the Phase 2B-2 implementation investigation and is unrelated to Phase 2B-2's own work. Phase 2B-2 wired activity tracking into the auto-progression block correctly assuming the block will run; if the block never actually runs, the activity tracking inside it never fires either, and Phase 2B-2 event 1b is silently broken in production for the same underlying reason.

**Why deferred:**
This is a pre-existing bug that needs investigation in production before a fix is shipped. We do not currently know whether auto-progression actually fires in production, whether `newStatus` is being normalized somewhere upstream that masks the bug, or whether the feature has been silently broken for some time. The investigation and fix are larger than Phase 2B-2's scope.

**When to fix:**
ASAP. This is potentially a real product bug, not just a code smell. Recommend prioritizing investigation in the next available bug-fix slot.

**What needs to be done:**
1. Add diagnostic logging or check production logs to confirm whether the auto-progression block fires in production at all.
2. If it does not fire: trace the code path that produces `newStatus` to see what casing it actually has, then fix the comparison (and any similar comparisons in the same file) to match the lowercase project standard.
3. If it does fire: investigate why — there may be an upstream normalization or a code path that title-cases the value before the comparison. Either way, the literal `'Submitted'` string should be replaced with a constant from the status constants file per project standards.

**Affected components:**
- `src/app/api/services/[id]/status/route.ts` (around line 360)
- Any other place in the file with the same casing pattern
- The auto-progression product feature itself

---

### TD-029 — Activity tracking `userType` fallback silently mis-classifies users

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Activity tracking / Session handling                |
| Severity      | Low (Defensive fallback with silent wrong-data risk) |
| Identified    | April 11, 2026 - Phase 2B-2 Implementation          |
| Identified by | Implementation Investigation                        |

**Description:**
In several places where the new `ActivityTrackingService` is called from a route handler, the implementer wrote the user type extraction as:

```typescript
const userType = (session.user.userType || 'internal') as 'customer' | 'internal' | 'vendor';
```

This means if a user's session is missing `userType` for any reason, the user will be treated as internal staff for activity tracking purposes. This is defensible (it prevents crashes) but it is a silent assumption: a user who is actually a customer but whose session is missing `userType` would have their actions incorrectly counted as activity, and customers are explicitly excluded from activity tracking by Phase 2B-2's Rule 1.

This combines with TD-026 (the `User.userType` schema default of `"admin"`) to create two overlapping silent failure modes. A customer could end up incorrectly classified as a non-customer either by having `userType = "admin"` in the database (TD-026) or by having `userType` missing from the session entirely (this entry). Neither produces an error or warning — the activity tracking just records bad data.

**Why deferred:**
The fallback prevents crashes and there is no current evidence of mis-classification in production. Phase 2B-2 needed a working implementation, and this fallback was the implementer's defensive choice.

**When to fix:**
Together with TD-026. Once `User.userType` always holds a valid value at the database level, the session should reliably surface that valid value, and the fallback can be removed entirely (or replaced with a hard error and a log entry). Fixing this entry without first fixing TD-026 would risk crashes for any user whose record still has the broken default.

**Recommendation:**
1. Resolve TD-026 first.
2. Then validate `session.user.userType` at session creation time and either reject the session or log loudly when the value is missing or invalid.
3. Remove the `|| 'internal'` fallback from every route handler that uses it for activity tracking.

**Affected components:**
- `src/app/api/fulfillment/orders/[id]/status/route.ts`
- `src/app/api/orders/[id]/assign/route.ts`
- `src/app/api/portal/orders/[id]/route.ts`
- `src/app/api/services/[id]/attachments/route.ts`
- `src/app/api/services/[id]/comments/route.ts`
- `src/app/api/services/[id]/status/route.ts`
- The session creation flow in `src/lib/auth.ts` or wherever NextAuth user fields are populated

---

### TD-030 — Inconsistency between `session.user.type` and `session.user.userType`

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Session handling / Type safety                      |
| Severity      | Low (Working shim in place)                         |
| Identified    | April 11, 2026 - Phase 2B-2 Implementation          |
| Identified by | Implementation Investigation                        |

**Description:**
Different parts of the codebase read user type from two different fields on the session: some places read `session.user.type` and others read `session.user.userType`. During Phase 2B-2 the implementer needed `userType` for the new `ActivityTrackingService` but found that `src/app/api/orders/[id]/assign/route.ts` was using `session.user.type` instead. Rather than rewriting upstream session population, the implementer added a backward-compatibility shim:

```typescript
const userType = session.user.userType || session.user.type;
if (userType !== 'internal') {
```

The shim works but it papers over an underlying inconsistency. Future developers or AI agents reading this code may not realize there are two different fields holding the same conceptual value, which could lead to bugs if one is updated and the other isn't.

**Why deferred:**
The shim is in place and working. Resolving the underlying inconsistency requires picking a single canonical field name and updating every reference in the codebase, which is a small but non-trivial cleanup pass that goes beyond Phase 2B-2.

**When to fix:**
During any session handling cleanup pass, or when consolidating user type references across the codebase.

**Recommendation:**
1. Pick one canonical field name (`userType` is likely the better choice — it matches the database column and the `User` Prisma model).
2. Grep for all references to `session.user.type` and update them to `session.user.userType`.
3. Remove the backward-compatibility shim from `src/app/api/orders/[id]/assign/route.ts` once all callers are aligned.
4. Update the NextAuth session callback to populate the canonical field only.
5. If TypeScript types still allow both, narrow the type definition so the wrong field name becomes a compile-time error.

**Affected components:**
- `src/app/api/orders/[id]/assign/route.ts` (where the shim was added)
- `src/lib/auth.ts` or wherever the NextAuth session callback lives
- The TypeScript type definitions for the session user object
- Any other file in the codebase that reads `session.user.type`

---

### TD-031 — ActivityTrackingService violates Rule 4 by swallowing errors

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Activity tracking / Transaction integrity           |
| Severity      | Major (Architecture violation, silent data inconsistency risk) |
| Identified    | April 12, 2026 - Phase 2B-2 Code Review             |
| Identified by | Code Review                                         |

**Description:**
The `ActivityTrackingService` at `src/lib/services/activity-tracking.service.ts` violates Rule 4 of the Phase 2B-2 architecture document, which states that all activity tracking updates must participate in the same transaction as the triggering event so that a failure rolls everything back.

Both methods (`updateOrderActivity` and `updateOrderItemActivity`) wrap their entire bodies in a `try { ... } catch (error) { logger.warn(...) }` block. The catch logs the error and returns normally — it does not re-throw. As a result, if the activity tracking call inside a transaction throws (for example, a transient database error), the error is swallowed, the parent transaction commits successfully, and the database is left in an inconsistent state: the triggering event happened but its activity timestamps were never updated.

The methods also contain four defensive existence checks of the form `if (tx.order?.update)` and `if (tx.orderView?.upsert)`. In real Prisma the transaction client always exposes these methods. The checks exist solely to make tests pass when their inline mocks don't include the new `orderView` and `orderItemView` models. This is a code smell — it lets tests appear to pass while never exercising the production code path.

The architect explicitly considered this trade-off as Risk 1 in Section 7.1 of the architecture document and accepted it: *"a failure in `ActivityTrackingService` would roll back the user's intended action."* The implementer overrode that decision unilaterally and added the error swallowing.

**Why deferred:**
A correct fix requires removing both try-catch blocks and both sets of defensive existence checks, then updating the Pass 1 test file to include error-propagation tests, AND updating the inline Prisma mocks in 11 other test files that currently rely on the safety net to silently paper over their incomplete mock setups. The 11-file test mock cleanup is the hard part — the failures it surfaces are not all simple "missing model" issues, and properly fixing them requires interactive debugging that was not feasible during the original code review session.

Phase 2B-2's happy path works correctly in production: the activity tracking code does fire and the timestamps do update under normal conditions. The architectural violation only matters in failure scenarios, and there is no current evidence of those failures occurring.

**When to fix:**
ASAP. This is a Major-severity architectural violation, not a minor cleanup. It should be the first item addressed after Phase 2B-2 is merged — ideally on its own branch with dedicated time for the test mock cleanup.

**What needs to be done:**
1. Remove the try-catch blocks from both methods in `src/lib/services/activity-tracking.service.ts`. Errors must propagate so the parent transaction rolls back.
2. Remove the four defensive `tx.X?.method` existence checks from the same file.
3. Add at least four new error-propagation tests to `src/lib/services/__tests__/activity-tracking.service.test.ts` — one for each Prisma operation the service performs (`order.update`, `orderView.upsert`, `orderItem.update`, `orderItemView.upsert`). Each test should mock the relevant operation to throw and assert that the error propagates out of the service via `expect(...).rejects.toThrow(...)`.
4. Update the 11 test files that currently use inline `vi.mock('@/lib/prisma', ...)` blocks to either (a) include the missing `orderView`/`orderItemView` mocks AND debug whatever else is causing the route handlers to return 500 in those tests once the safety net is removed, or (b) migrate those files to rely on the global mock from `src/test/setup.ts` (which already includes every model). Option (b) is architecturally cleaner but hit interactive-debugging issues during the original attempt.

The 11 test files that need attention are:
- `src/__tests__/integration/fulfillment-id-standardization.integration.test.ts`
- `src/app/api/fulfillment/orders/[id]/status/__tests__/route.test.ts`
- `src/app/api/fulfillment/orders/[id]/status/__tests__/route-enhanced.test.ts`
- `src/app/api/fulfillment/orders/[id]/status/__tests__/service-closure.test.ts`
- `src/app/api/orders/[id]/assign/__tests__/route.test.ts`
- `src/app/api/portal/orders/[id]/__tests__/route-status-inheritance.test.ts`
- `src/app/api/portal/orders/[id]/__tests__/route.document-persistence.test.ts`
- `src/app/api/services/[id]/attachments/__tests__/fulfillment-id-standardization.test.ts`
- `src/app/api/services/[id]/attachments/__tests__/route.test.ts`
- `src/app/api/services/[id]/status/__tests__/fulfillment-id-standardization.test.ts`
- `src/app/api/services/[id]/status/__tests__/route.test.ts`

**Important context for the developer who picks this up:**
A previous attempt to fix this during the original code review session removed the try-catches and defensive checks correctly (the 21 unit tests for `ActivityTrackingService` all passed) but exposed pre-existing problems in the 11 test files above. The tests were silently relying on the safety net to paper over mock setups that did not match what the production code actually expected. The exact failure mode was not "missing Prisma method on the mock" — it was something deeper, where the route handlers returned 500 even after the missing models were added to the inline mocks. Diagnosing this properly requires running the tests interactively, not from a chat-based tool. Plan accordingly.

**Affected components:**
- `src/lib/services/activity-tracking.service.ts` (the violation)
- `src/lib/services/__tests__/activity-tracking.service.test.ts` (missing error-propagation tests)
- The 11 test files listed above (incomplete inline mocks that the safety net is currently hiding)

---

### TD-032 — ServiceCommentCard.tsx case-sensitivity bug in status styling

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | UI Components / Service Comments                    |
| Severity      | Low (UI styling only, no data impact)              |
| Identified    | April 12, 2026 - TD-028 Bug Investigation          |
| Identified by | Bug Investigator Agent                             |

**Description:**
ServiceCommentCard.tsx compares statusChangedTo against Title Case strings ('Completed', 'Cancelled', 'Cancelled-DNB') but the field stores lowercase values, so the conditional styling never applies. Lines 64, 66, 93-94, 192, 194 contain comparisons that will never match because the database and API store lowercase status values.

**Why deferred:**
This is a separate bug from TD-028 and violates the "one bug per branch per PR" rule. The styling issue only affects visual appearance (background colors for status change comments).

**When to fix:**
Address in a separate bug fix branch after TD-028 is complete.

**Recommendation:**
Fix by using SERVICE_STATUSES constants or normalizeServiceStatus helper for comparisons.

---

### TD-033 — Order details page has untranslated hardcoded strings

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Internationalization / Order details page          |
| Severity      | Low                                                 |
| Identified    | April 13, 2026 - Phase 2C Standards Check          |
| Identified by | Standards Checker                                   |

**Description:**
src/app/fulfillment/orders/[id]/page.tsx contains hardcoded English strings at approximately lines 236, 242, 256, and 274 including "Back to Dashboard", "Order not found", and similar UI text. These strings should be routed through the project's translation system using the t() function from the TranslationContext.

**Why deferred:**
These strings are pre-existing and were not introduced by Phase 2C. They were discovered by the standards-checker during Phase 2C review but are outside the scope of view-tracking work. Per the "one bug per branch per PR" rule, fixing unrelated issues in the middle of feature work is not allowed.

**When to fix:**
During a future internationalization pass on the order details page, or as part of any feature work that already touches this file's UI rendering logic.

---

### TD-034 — Phase 2C e2e tests present but not verified

| Field         | Detail                                              |
|---------------|-----------------------------------------------------|
| Area          | Order View Tracking / E2E Test Coverage            |
| Severity      | Low                                                 |
| Identified    | April 13, 2026 - Phase 2C Documentation Stage     |
| Identified by | Phase 2C Review                                     |

**Description:**
tests/e2e/order-view-tracking-phase-2c.spec.ts was generated by the test-writer agent during Phase 2C Pass 1. The file contains 9 Playwright-based e2e tests that exercise the order view and item view tracking flows in a real browser. The tests were committed (in fce2a2d) but were never actually run as part of Phase 2C verification.

The tests have several characteristics that need attention before they can be run and trusted:

1. **Network is fully mocked with page.route().** The tests intercept all /api/** calls and return fake responses rather than hitting the real API. This is a hybrid approach — real browser + real login + mocked network — which limits the value of the tests compared to a fully end-to-end round-trip. The strongest verification would come from letting API calls actually reach the database.

2. **Test user prerequisite is undocumented.** The tests hardcode customer@acmecorp.com / password123 and customer-123 as the test user. This user must exist in the local database for the login step to succeed, but the dependency is not noted anywhere in the project README, test config, or setup scripts.

3. **The playwright.config.ts webServer block is commented out.** This means Playwright will not auto-start a dev server. A developer running these tests must manually have `pnpm dev` running in a separate terminal first. This is not documented either.

4. **The test-writer agent's work on Phase 2C unit tests required multiple fixup rounds** (see commit history on feature/order-view-tracking-2c-ui-wiring). We have lower confidence that the e2e tests are correct as written, and they deserve a careful review before anyone trusts their results.

**Why deferred:**
Phase 2C was verified end-to-end through a combination of unit tests (23 passing) and manual browser verification against the real local database (real order_views and order_item_views rows were confirmed). The e2e tests in this file would add coverage against regressions, but because they mock the network they do not exercise the full database-writing path that was manually verified. Running, debugging, and trusting these tests is scope beyond Phase 2C's purpose.

**When to fix:**
During a dedicated e2e test maintenance pass, or before merging Phase 2D which will add UI indicators that a maintained e2e suite could regression-test automatically.

**What needs to be done:**
1. Verify the test-writer agent's output by reading the file carefully
2. Establish or document the customer@acmecorp.com test user (either add a seed script or update the README)
3. Decide whether the webServer block in playwright.config.ts should be uncommented, or whether the manual `pnpm dev` workflow is the project standard
4. Run the tests and fix anything broken
5. Add the e2e tests to CI if CI runs e2e tests, or document why they are skipped if CI does not
6. Consider whether the fully-mocked-network pattern should be replaced by a true round-trip test that writes to a test database

**Affected files:**
- tests/e2e/order-view-tracking-phase-2c.spec.ts
- playwright.config.ts (webServer block)
- Any test user seeding / README documentation

---
### TD-035 — Pre-existing TypeScript errors across test files and utilities

pnpm tsc --noEmit reports errors in src/test/setup.ts (missing vitest globals), src/__tests__/404-error-handling/missing-services-fulfillment.test.ts (Prisma mock type mismatches), src/lib/utils/__tests__/customer-order-permissions.test.ts, src/lib/vendorUtils.ts, and several E2E spec files. Most are related to the 167 skipped tests on temp/skip-failing-tests commit 3c3a641. Revealed during Phase 2D code review on 2026-04-14; not caused by Phase 2D. Cleanup should be scoped as its own branch and paired with the deferred-test cleanup.

---
### TD-036 — Bad mock-leak assertions in fulfillment-id-standardization tests

**File:** src/app/api/services/[id]/status/__tests__/fulfillment-id-standardization.test.ts (lines around 295 and 358)

**Issue:** Two assertions of the form `expect(prisma.servicesFulfillment).toBeUndefined()` were commented out during Bucket 2A cleanup. These assertions only "passed" before because the file's local Prisma mock was incomplete — `servicesFulfillment` was undefined as a side effect of a partial mock object, not because the route deliberately avoided that table. Once the file switched to the global mock (which includes all models), the assertions failed.

**Intent:** The author probably wanted to verify the route does not call any method on `prisma.servicesFulfillment`.

**Fix needed:** Replace the deferred assertions with explicit per-method checks, e.g.:
  expect(vi.mocked(prisma.servicesFulfillment.findUnique)).not.toHaveBeenCalled();
  expect(vi.mocked(prisma.servicesFulfillment.findFirst)).not.toHaveBeenCalled();
  // ...for any other servicesFulfillment methods the route could plausibly call

**Origin:** Bucket 2A cleanup, 2026-04-15.

**Priority:** Low (test still validates other behavior; deferred assertion is a coverage gap, not a correctness issue).

---

### TD-037 — Migrate test mocks from legacy .type to .userType field

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Testing / Authentication                    |
| Severity    | Low                                        |
| Identified  | April 15, 2026 - Bucket 4-pre TypeScript cleanup |
| Identified by | Branch fix/centralize-user-type-auth-utils |

**Description:**
The getUserType helper in src/lib/auth-utils.ts reads from (user as any).type || user.userType. The .type branch and the as any cast are defensive support for legacy test mocks. The official session user type (defined in src/types/next-auth.d.ts) only has .userType. The as any cast bypasses TypeScript's type checking on this property and is a code smell.

**Why deferred:**
The fallback is functioning correctly. This is purely a code hygiene / type safety improvement. To avoid regressing 16 tests, we kept the defensive .type fallback in getUserType.

**When to fix:**
Low priority cleanup task. Address when working on test modernization or TypeScript strict mode improvements.

**Scope:**
14 test files contain 66 occurrences of .type set on mocked user/session objects:
- src/app/api/vendors/__tests__/usertype-bug.test.ts
- src/app/api/vendors/[id]/__tests__/route.test.ts
- src/app/api/data-rx/documents/__tests__/route.test.ts
- src/app/api/fulfillment/orders/[id]/status/__tests__/route.test.ts
- src/app/api/fulfillment/orders/[id]/__tests__/route.test.ts
- src/app/api/comment-templates/__tests__/create-template-usertype-bug.test.ts
- src/app/api/comment-templates/__tests__/route.test.ts
- src/app/api/orders/[id]/lock/__tests__/route.test.ts
- src/app/api/orders/[id]/assign/__tests__/route.test.ts
- src/components/layout/ViewToggle.test.tsx
- src/components/comment-templates/CommentTemplateGrid.test.tsx
- src/hooks/useCommentTemplates.test.ts
- src/lib/schemas/vendorSchemas.test.ts
- src/lib/schemas/__tests__/comment-management-permission.test.ts

**Resolution:**
In each file, find every mock user/session object that sets type: '<value>' (where <value> is internal, admin, vendor, or customer) and change the field name to userType: '<value>'. After all files are updated, remove the (user as any).type || portion of the getUserType function in src/lib/auth-utils.ts, leaving only const userType = user.userType;. Verify the full test suite still passes (expected: 2631+ passing / 0 failing) and the TS error count does not increase.

**Estimated effort:**
1-2 hours, mostly mechanical find-and-replace per file with verification after each.

**Risk:**
Low if done carefully. Risk: a test elsewhere may incidentally rely on .type being unset (unlikely but possible). Mitigation: run full test suite after each file is migrated, not just at the end.

---

### TD-038: permissions.fulfillment shape inconsistency across route files

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Type definitions / Permissions              |
| Severity    | Major (Type safety & runtime inconsistency) |
| Identified  | April 15, 2026 - TypeScript cleanup, Bucket 4 recon |
| Identified by | TypeScript error analysis                 |

**Description:**
The fulfillment permission is checked as four different shapes across the codebase, but is not even defined in the TypeScript type definition.

**Location:** Type defined in `src/types/next-auth.d.ts`. Used inconsistently across 12 route files under `src/app/api/`.

**Current type definition:**
```typescript
interface Session {
  user: {
    permissions: {
      countries?: string[];
      services?: string[];
      dsx?: string[];
      customers?: string[];
      // NOTE: fulfillment field is missing entirely!
    };
    // ... rest of user fields
  }
}
```

**Problem:** The fulfillment permission is checked as four different shapes across the codebase:
1. As a boolean: `permissions.fulfillment === true`
2. As a wildcard string: `permissions.fulfillment === '*'`
3. As an object with action flags: `permissions.fulfillment?.view === true`, `?.manage`, `?.edit`
4. As a string array: `Array.isArray(permissions.fulfillment) && permissions.fulfillment.includes('*')`
5. As an admin flag: `permissions.admin === true` (not defined in the permissions type at all — same missing-field issue as fulfillment)

**Impact:** 73+ TypeScript errors across 12 route files. More importantly, runtime permission checks are inconsistent — the same permission is interpreted differently depending on which route is handling the request, which is a latent security/correctness risk.

**Files affected (sample, not exhaustive):**
- `src/app/api/fulfillment/route.ts`
- `src/app/api/fulfillment/orders/[id]/route.ts` (admin)
- `src/app/api/fulfillment/services/route.ts`
- `src/app/api/fulfillment/services/[id]/route.ts` (both admin and fulfillment)
- `src/app/api/fulfillment/services/[id]/history/route.ts`
- `src/app/api/services/[id]/status/route.ts`

**Do NOT fix by:** Widening the type to a union (`boolean | string | string[] | { view, manage, edit }`). That would silence the compiler but lock in the inconsistency permanently.

**Proper fix:** Run through the full feature pipeline (business-analyst → architect → ...). Decide on one canonical shape for fulfillment permission, then refactor all 12 route files to use it. Update next-auth.d.ts last, once usage is consistent.

**Status:** Logged, not started.

---

### TD-039: ServiceCommentData missing required Prisma fields in services/[id]/status/route.ts

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | API / Prisma Schema                        |
| Severity    | Major (Runtime error risk)                 |
| Identified  | April 15, 2026 - TypeScript cleanup, Bucket 4 pilot |
| Identified by | TypeScript error analysis                 |

**Description:**
The Prisma ServiceComment model requires templateId (String) and finalText (String) — neither is optional, neither has a default. But the code only provides these fields conditionally (when statusChangeTemplate?.id exists and hasCommentTemplateModel is true). If those conditions are false, the serviceComment.create() call will fail at runtime with a Prisma validation error.

**Location:** src/app/api/services/[id]/status/route.ts, lines ~337-355

**Problem:** Schema drift between Prisma model requirements and code implementation.

**Fix options:**
- (a) Make templateId and finalText optional in the Prisma schema if blank comments are valid, or
- (b) Ensure the code always provides values

Requires a design decision — not a type-level fix.

**Status:** Logged, not started.

### TD-040: `service.order.subject` field access in fulfillment service route

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | API routes / Prisma queries                 |
| Severity    | Low (2 TypeScript errors, no known runtime impact) |
| Identified  | April 15, 2026 - TypeScript cleanup, Bucket 4 |
| Identified by | Code review during TS schema-drift fixes  |

**Description:**
In `src/app/api/fulfillment/services/[id]/route.ts` (around lines 116-120), the code accesses `service.order?.subject` but the Prisma query's select/include does not return `subject`, so TypeScript reports it as nonexistent.

**Investigation needed:**
1. Does the `Order` model in Prisma have a `subject` field? If yes, add `subject: true` to the Prisma select in the query that fetches the service.
2. If `subject` does not exist on the Order model (renamed or removed), this code is dead and should be cleaned up.
3. Check if there's a `subjectName` or similar field that replaced it.

**Do NOT fix by:** Using `as any` to silence the error.

**Status:** Logged, not started.

---

### TD-041: OrderData Hydration — Phases 2 & 3 (remaining display surfaces and label cleanup)

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | OrderData display, translations, label sources |
| Severity    | Medium (functional — some surfaces still show raw data) |
| Identified  | April 16, 2026 — OrderData Hydration Phase 1 |
| Identified by | Andy + Claude working session              |

**Description:**
Phase 1 of the OrderData Hydration work is complete — the fulfillment order details page now shows resolved labels, formatted addresses, and document filenames instead of UUIDs, raw JSON, and metadata blobs. However, other display surfaces still show raw values, and duplicate label sources still exist in the codebase.

**Full spec:** `docs/specs/OrderData_Hydration_Design_Document.md`

**Phase 2 — Sweep Other Display Surfaces:**
- Audit all components consuming `OrderData` (known: `order-details-dialog.tsx` in customer portal; search for `item.data` and `orderData` patterns)
- Wire hydration into `/api/portal/orders/[id]` and any other endpoints found
- Update identified components to use `hydratedData` prop
- Remove hardcoded label maps (e.g., `{ key: 'middleName', label: 'Middle Name' }`)
- Remove raw `data` array from API responses once all consumers migrated

**Phase 3 — Translation Coverage and Label Cleanup:**
- Create missing translation entries for fields with human-readable fieldKeys
- Add translation keys for address piece labels (`addressConfig.street1`, etc.)
- Remove duplicate label sources: reverse map in `order-core.service.ts`, known-labels list in `service-order-data.service.ts`, `formatFieldName()` method
- Verify no code paths depend on removed duplicates

**Estimated effort:** 4-7 days total across both phases.

**Do NOT fix by:** Adding more hardcoded label maps. All label resolution must go through the hydration service.

**Status:** Logged, not started.

---

### TD-042: Dashboard customer orders page needs server-side pagination

**Status:** Open
**Priority:** Medium
**Filed:** 2026-04-16
**Context:** fix/order-count-pagination bug fix

**Description:**
The customer dashboard (`src/app/portal/dashboard/page.tsx`) fetches orders with a client-side limit of 1000 and paginates in the browser. This works for current customer volumes but will not scale when customers exceed 1000 orders.

**Why it was deferred:**
Converting to server-side pagination requires adding compound status filter support to the portal orders API (`/api/portal/orders`). The dashboard's "pending" filter combines `submitted` and `processing` statuses, which the API currently cannot express as a single query parameter. The fulfillment API was updated with `in_progress` compound filter support as part of the pagination fix, but the portal orders API was not — doing so would have expanded the bug fix scope beyond what was necessary.

**What needs to happen:**
1. Add compound status filter support to `/api/portal/orders` (e.g., `status=pending` maps to `statusCode: { in: ['submitted', 'processing'] }`)
2. Convert the dashboard page from client-side to server-side pagination (same pattern as the fulfillment page fix)
3. Remove the `limit=1000` cap

**Affected files:**
- `src/app/api/portal/orders/route.ts`
- `src/app/portal/dashboard/page.tsx`
- Possibly `src/lib/services/order.service.ts` (if the compound filter is handled at the service layer)

---

TD-043 — Legacy Super-Admin Detection in Users API Routes
FieldDetailAreaUser Admin / API RoutesSeverityWarningIdentifiedApril 17, 2026 - Customer Permission Key Fix InvestigationIdentified byBug Investigator
Description:
src/app/api/users/[id]/route.ts (lines 34, 107, 272) and src/app/api/users/route.ts (lines 28, 99) use a legacy "super admin" detection pattern that checks perms.customers?.includes?.('*') alongside similar checks on countries, services, and dsx. All four of these permission keys are from the old format. The customers key has been replaced by customer_config, and dsx has been replaced by global_config, so this check no longer correctly identifies admin users who were set up using the new permission format.
This was discovered during the customer permission key mismatch investigation but pulled out of that fix because it's a different logical problem — it's about super-admin detection, not customer management permissions. Mixing a key rename with a logic redesign in the same PR would be harder to verify and roll back.
Why deferred:
The fix requires understanding the full intended behavior of the "has all wildcards" check and replacing it with the correct centralized functions (canManageUsers(), canAccessGlobalConfig(), etc.). This is a logic change, not just a key rename, and needs its own investigation.
When to fix:
During the next work on user management permissions or during a permissions system cleanup pass.
Affected files:

src/app/api/users/[id]/route.ts
src/app/api/users/route.ts

Recommendation:
Replace the hasAllWildcards pattern with the centralized helper functions from src/lib/auth-utils.ts that already handle both old and new permission formats.

--- 

TD-044 — NextAuth Type Definition Still Shows Old Permission Format
FieldDetailAreaTypeScript Types / SessionSeverityWarning (Type Safety)IdentifiedApril 17, 2026 - Customer Permission Key Fix InvestigationIdentified byArchitect
Description:
src/types/next-auth.d.ts (lines 14-19) defines the session user's permissions type as:
typescriptpermissions: {
  countries?: string[];
  services?: string[];
  dsx?: string[];
  customers?: string[];
}
This reflects the old permission format. The actual permissions stored in the database and used at runtime now include module-based keys like customer_config, global_config, user_admin, vendors, fulfillment, and candidate_workflow — none of which appear in this type definition. The type definition is misleading and provides no type safety for the current permission structure.
Why deferred:
Updating the type definition could surface TypeScript errors across the codebase wherever the old permission keys are still referenced — which is exactly the set of files being fixed in the current customer permission bug. Updating the types at the same time as the permission fix would mix two concerns. Better to fix the runtime behavior first, then update the types.
When to fix:
After the customer permission key fix is merged and verified. Update the type definition to match the actual runtime permission structure and resolve any resulting TypeScript errors.
Affected files:

src/types/next-auth.d.ts
Any file that currently relies on the old type shape for autocompletion or type checking

Recommendation:
Update the permissions type to include all current module-based keys with their correct types (boolean or string array). Consider making it a union type or using a Record to handle both legacy and new formats during the transition period.

TD-045 — normalizePermissions() Still References Old Permission Keys
FieldDetailAreaPermission UtilitiesSeverityWarningIdentifiedApril 17, 2026 - Customer Permission Key Fix InvestigationIdentified byBug Investigator
Description:
src/lib/permission-utils.ts line 88 in the normalizePermissions() function still references the old customers key in its resources array. If this function is used to normalize permissions at login or session creation, it may strip or mishandle the new customer_config key since it's not in the recognized list.
Why deferred:
Changing what normalizePermissions() recognizes could affect session creation and permission loading for all users. Needs careful analysis of where this function is called and whether existing users in the database have permissions stored under the old keys that still need to be normalized. Changing it without that analysis risks breaking permission loading for legacy users.
When to fix:
After the customer permission key fix is merged. Investigate all callers of normalizePermissions() to understand whether it needs to handle both old and new keys simultaneously (migration support) or can be updated to only recognize new keys.
Affected files:

src/lib/permission-utils.ts

---

TD-046: ServiceFulfillmentTable.tsx exceeds 600-line hard stop

File: src/components/fulfillment/ServiceFulfillmentTable.tsx
Issue: File is 1460 lines, far exceeding the 600-line hard stop defined in CODING_STANDARDS.md Section 9. Contains dialog components, filter controls, table rows, and expansion logic that should be extracted into separate components.
Impact: Low (functional, but difficult to maintain and review)
Suggested fix: Extract into smaller components: expanded row content, filter controls, dialog modals, and table row rendering.
Discovered during: Uploaded Document Access feature standards check (2026-04-18)

---

TD-047: Fulfillment routes use inline permission checks instead of centralized auth-utils

File: src/app/api/fulfillment/documents/[id]/route.ts (and other fulfillment routes)
Issue: Permission checks for fulfillment.view, candidate_workflow.view, etc. are done inline with multiple format checks rather than using centralized functions from auth-utils.ts. This pattern is consistent with existing fulfillment routes but violates API_STANDARDS.md Section 3.2.
Impact: Low (functional, but creates inconsistency and duplication across routes)
Suggested fix: Create centralized permission-checking functions in auth-utils.ts and refactor all fulfillment routes to use them.
Discovered during: Uploaded Document Access feature standards check (2026-04-18)

---

TD-048: Consolidate duplicate package dialog components

Files: src/components/modules/customer/package-dialog.tsx, src/components/modules/customer/package-dialog-new.tsx
Issue: Two near-identical package dialog components exist. package-dialog-new.tsx is the active one (used by the main packages page). package-dialog.tsx is used only by the scope page. Both have workflow dropdowns.
Impact: Low (functional, but confusing and doubles maintenance)
Suggested fix: Merge into one component, update all imports
Discovered during: Candidate Invite Phase 1 (2026-04-20)

--- 

### TD-049: Playwright e2e test infrastructure not functional

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Testing / E2E Infrastructure                |
| Severity    | Medium                                      |
| Identified  | April 22, 2026 - Candidate Invite Phase 2 Pass 1 |
| Identified by | Test verification checkpoint              |

**Description:**
E2E test files exist in tests/e2e/ but cannot actually run. The test-writer Pass 1 for Candidate Invite Phase 2 created tests/e2e/workflow-configuration-phase2.spec.ts with 27 Playwright tests, but these tests cannot be executed. Likely a setup/configuration issue with Playwright.

**Why deferred:**
Unit and API route tests provide sufficient coverage for features. E2E tests would provide additional regression protection but are not blocking feature delivery.

**When to fix:**
During a dedicated testing infrastructure improvement pass, or before the next major feature that requires E2E coverage.

**What needs to be done:**
- Investigate Playwright config in playwright.config.ts
- Verify browsers are installed (npx playwright install)
- Confirm test runner works with a simple smoke test
- Document setup requirements for running E2E tests
- Consider adding E2E tests to CI pipeline once working

**Impact:**
Blocks all E2E test coverage across the project, not just this feature. Coverage gaps will grow over time as more features are added without E2E regression tests.

---

### TD-050 — Test Mock Objects Using `as any` in Phase 2 Workflow Tests

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Test Files / TypeScript                     |
| Severity    | Warning (Code Quality)                      |
| Identified  | April 23, 2026 - Candidate Invite Phase 2 Code Review |
| Identified by | Code Reviewer                             |

**Description:**
57 instances of `as any` across 5 test files introduced in the Phase 2 workflow configuration feature. These are used to cast partial mock objects (e.g., `{ id: '123' } as any`) when mocking Prisma responses in unit tests. Affected files:
- `src/app/api/workflows/[id]/__tests__/phase2-route.test.ts` (9)
- `src/app/api/workflows/[id]/sections/[sectionId]/__tests__/route.test.ts` (21)
- `src/app/api/workflows/[id]/sections/[sectionId]/upload/__tests__/route.test.ts` (13)
- `src/app/api/workflows/[id]/sections/__tests__/route.test.ts` (11)
- `src/types/__tests__/workflow-section-schema.test.ts` (3)

**Why deferred:**
Test mock `as any` casts are low risk — they only affect test code, not production. Fixing properly requires creating typed mock factory helpers for each Prisma model, which is a significant effort for minimal safety benefit.

**When to fix:**
When creating a shared test utilities module or during a broader TypeScript strictness cleanup.

**Recommendation:**
Create typed mock factory functions (e.g., `createMockWorkflow(overrides)`) that return properly typed objects with sensible defaults. This eliminates `as any` and makes tests more maintainable.

---

### TD-051 — Candidate save/route.ts exceeds 500-line soft trigger

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application API                   |
| Severity    | Warning (Maintainability)                   |
| Identified  | May 4, 2026 - Phase 6 Stage 3 Implementation |
| Identified by | Implementer (Stage 4)                     |

**Description:**
`src/app/api/candidate/application/[token]/save/route.ts` grew from 415 lines to 566 lines during Phase 6 Stage 3, crossing the 500-line soft trigger defined in CODING_STANDARDS.md Section 9. The growth came from additions called out in the Stage 3 technical plan (the new `addressHistorySaveRequestSchema`, the widened repeatable schema, and the `address_history` dispatch branch with JSDoc).

**Why deferred:**
The file was under 500 lines when Stage 3 began, so the additions were permitted under Rule 10. The file remains functional and well-organized — each section type has its own dispatch branch following an established pattern. Splitting now would conflict with the Stage 3 implementer's narrow scope.

**When to fix:**
Before adding any further section types (Stage 4 will add upload-related branches; this file should be split first). The natural split is one schema file plus per-section-type handler modules.

**Suggested fix:**
- Extract each `*SaveRequestSchema` into `src/schemas/candidate-save-schemas.ts`
- Extract each per-section dispatch branch into a service module (e.g., `src/lib/services/candidate-save/{personal-info,idv,education,employment,address-history,repeatable}.ts`)
- The route handler becomes a thin dispatcher that authenticates, validates, and routes to the appropriate service module

**Files affected:**
- `src/app/api/candidate/application/[token]/save/route.ts`

---

### TD-052 — Cross-section requirement awareness for Personal Info

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Personal Info & Address History |
| Severity    | Warning (Data Integrity)                    |
| Identified  | May 4, 2026 - Phase 6 Stage 3 Smoke Testing |
| Identified by | Andy (smoke test)                         |
| Status      | **Addressed (Phase 6 Stage 4 — May 4, 2026)** |

**Description:**
When Address History's DSX mappings make a field required that is collected on the Personal Information tab (e.g., Middle Name becomes required for criminal searches in a specific country), the Personal Information section currently has no awareness of this. The field is correctly excluded from the Address History aggregated area — `AddressHistorySection.computeAggregatedItems` skips any requirement whose UUID appears in `/personal-info-fields` — so the candidate isn't asked twice. But the Personal Info section still shows the field as optional based on its own `isRequired` resolution, which doesn't account for downstream sections' requirements.

The candidate can skip the field on the Personal Info tab and no warning appears until submission validation in Phase 7.

**Why deferred:**
The fix requires the Personal Info section to consult Address History's DSX mappings (and Education's, and Employment's) when computing per-field `isRequired`. That cross-section coordination is more naturally placed alongside section progress indicators, which Phase 6 Stage 4 will build.

**When to fix:**
Address in Phase 6 Stage 4 when building section progress indicators. The progress computation should factor in cross-section requirements so Personal Info can show as incomplete if a field it collects is required by another section's DSX mappings. If Stage 4 scope is too tight, defer to Phase 7 validation as a backstop.

**Preferred fix:**
Update `personal-info-fields` (or a new shared resolver) to OR-merge `isRequired` across:
1. The field's own `service_requirements` / `dsx_mappings`
2. Any `dsx_mappings` for the same `requirementId` reachable from Address History entry countries
3. Any `dsx_mappings` for the same `requirementId` reachable from Education / Employment entry countries

This way a field becomes required on the Personal Info tab if ANY downstream section needs it.

**Files affected:**
- `src/app/api/candidate/application/[token]/personal-info-fields/route.ts`
- `src/components/candidate/form-engine/PersonalInfoSection.tsx` (if progress UI changes)

**Resolution (Phase 6 Stage 4 — May 4, 2026):**
A cross-section requirement registry (`src/lib/candidate/crossSectionRegistry.ts`) and shared wiring hook (`src/lib/candidate/useRepeatableSectionStage4Wiring.ts`) were added so that any repeatable section can publish subject-targeted DSX requirements to a central registry, and `PersonalInfoSection` consumes the `subject` bucket via the new `crossSectionRequirements` prop. Education History, Employment History, and Address History all publish their subject contributions through the registry; their DSX field loaders split fields by `collectionTab` and forward the subject ones to the shell. Banner display is implemented via `CrossSectionRequirementBanner`, rendered inside `PersonalInfoSection.tsx`.

**Address History wiring (final wire-up — May 4, 2026):** `AddressHistorySection.tsx` now consumes the shared `useRepeatableSectionStage4Wiring` hook with the `addressHistoryStage4Wiring` helper module (`src/lib/candidate/addressHistoryStage4Wiring.ts`), and `portal-layout.tsx` passes the four wiring callbacks (`onProgressUpdate`, `onCrossSectionRequirementsChanged`, `onCrossSectionRequirementsRemovedForEntry`, `onCrossSectionRequirementsRemovedForSource`) to `AddressHistorySection` in the same shape used for Education / Employment. User Flow 3 (Address History entry country triggers Middle Name requirement → registry push → PersonalInfo banner / progress) is now end-to-end live.

---

### TD-053 — Aggregated radio/checkbox fields don't auto-save until next blur

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Address History     |
| Severity    | Warning (UX)                                |
| Identified  | May 4, 2026 - Phase 6 Stage 3 Code Review   |
| Identified by | Code Reviewer                             |

**Description:**
`AggregatedRequirements` calls `onAggregatedFieldChange` on `onChange` and `onAggregatedFieldBlur` on `onBlur`. Auto-save is triggered by the blur callback. For input/text fields this works correctly because they emit a separate blur event. But radio buttons and checkboxes typically only fire `onChange` on toggle, with no follow-up blur. A candidate who clicks a radio in the aggregated area and then leaves the page (or simply does not touch any other field) will lose that selection until the next save cycle.

**Why deferred:**
The bug is observable but does not cause data loss in the common case where the candidate continues filling out the form (touching any other field triggers the deferred save). Fix requires either changing the auto-save trigger to fire on every change (not just blur) for non-text dataTypes, or wrapping the radio/checkbox fields with an explicit blur emission. Either approach has cross-section implications and is better tackled alongside Stage 4 form polish.

**When to fix:**
Phase 6 Stage 4 form polish, OR when the auto-save mechanism is reviewed broadly.

**Files affected:**
- `src/components/candidate/form-engine/AggregatedRequirements.tsx`
- `src/components/candidate/form-engine/DynamicFieldRenderer.tsx` (radio/checkbox branches)

---

### TD-054 — AddressHistorySection silent failure when fields API errors

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Address History     |
| Severity    | Warning (UX)                                |
| Identified  | May 4, 2026 - Phase 6 Stage 3 Code Review   |
| Identified by | Code Reviewer                             |

**Description:**
`AddressHistorySection.loadFieldsForEntry` (lines 214-251) catches errors when calling `/fields` but only logs them via `clientLogger.error`. The candidate sees no UI surface — the aggregated requirements area silently shows nothing instead of indicating that requirements failed to load. The Stage 3 spec edge case ("Fields API returns an error during requirement loading → the aggregated requirements area shows a recoverable error state") is not implemented.

**Why deferred:**
Address history will still render with the address block intact even when the fields call fails — the candidate can complete the address itself. The aggregated additional information / required documents would just be missing. A retry button or banner is the right fix but it's a UX polish task, not blocking data integrity.

**When to fix:**
Phase 6 Stage 4 form polish, OR when general candidate form error handling is reviewed.

**Files affected:**
- `src/components/candidate/form-engine/AddressHistorySection.tsx`

---

### TD-055 — computeAggregatedItems uses constant serviceTypeOrder

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Address History     |
| Severity    | Low (Code Quality)                          |
| Identified  | May 4, 2026 - Phase 6 Stage 3 Code Review   |
| Identified by | Code Reviewer                             |

**Description:**
`AddressHistorySection.computeAggregatedItems` calls `resolveServiceTypeOrder(serviceId, fields)` for every field, but the helper always returns `SERVICE_TYPE_ORDER_INDEX.record` (= 1) regardless of which service the field came from. Today this is correct because all services routed to Address History are `record`-functionality, so the sort within the aggregated area collapses to `displayOrder` — which is the intended behavior. But the abstraction is misleading: a future change that routes a non-record service into Address History (or that adds a new record-functionality sort key) would silently mis-sort.

**Why deferred:**
Behaves correctly today. Inline computation of the real per-service rank requires tagging fields with their actual `functionalityType` at fetch time, which is more invasive than the current Stage 3 scope warrants.

**When to fix:**
When a non-record service is added to Address History, or when sort ordering across record sub-types becomes meaningful. Either inline a comment explaining the intentional collapse, or compute a real per-service rank.

**Files affected:**
- `src/components/candidate/form-engine/AddressHistorySection.tsx` (`computeAggregatedItems`, `resolveServiceTypeOrder`)

---

### TD-056 — Stale-UUID hydration warnings could become noisy

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Order Display / Hydration                   |
| Severity    | Low (Operational)                           |
| Identified  | May 4, 2026 - Phase 6 Stage 3 Code Review   |
| Identified by | Code Reviewer                             |

**Description:**
`order-data-resolvers.ts` lines 196-199 emit `logger.warn` for every saved address whose state/county UUID no longer resolves through the `countries` table (deleted or renamed subdivision). Each disabled row in `countries` will warn on every hydration of every order that references it. In production this could become a steady background of warnings if any subdivisions are ever renamed/disabled.

**Why deferred:**
The warning is correct behavior — data integrity issues should be visible. But the noise level may not match the actual urgency of any individual case.

**When to fix:**
If/when production logs show this warning is firing frequently. Mitigations could include: dedupe-by-UUID cache so each missing subdivision warns only once per process, downgrade to debug, or move to a periodic data-quality audit job.

**Files affected:**
- `src/lib/services/order-data-resolvers.ts`

---

### TD-057 — Scope endpoint returns hardcoded English `scopeDescription` strings

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Scope API           |
| Severity    | Warning (i18n)                              |
| Identified  | May 4, 2026 - Phase 6 Stage 3 Standards Check |
| Identified by | Standards Checker                         |

**Description:**
`src/app/api/candidate/application/[token]/scope/route.ts` builds `scopeDescription` as a hardcoded English template string for every scope variant (lines 167, 171, 177, 182, 187–189, 195–197, 202–204, 209, 214, 219, 224–226). The string is rendered directly to the candidate by `ScopeDisplay.tsx` line 22 with no `t()` call. This violates COMPONENT S6.1 (all user-facing text must use the translation system).

The pattern is pre-existing for education and employment scope branches; Phase 6 Stage 3 extended it to record-functionality branches (current-address, last-x-addresses, null-record-default). Fixing only the new branches would create inconsistency with the rest of the file.

**Why deferred:**
Proper fix is architectural: the scope endpoint should return a structured response (`scopeKey: 'scope.record.currentAddress'`, `scopeParams: { years: 7 }`) and the client should call `t(scopeKey, scopeParams)`. This requires changing the response shape, the `ScopeInfo` type, all `ScopeDisplay` consumers, and adding new translation keys for every scope variant across all 5 language files. Out of scope for Stage 3.

**When to fix:**
When the candidate portal needs full localization. Likely Phase 7 or a dedicated i18n pass.

**Files affected:**
- `src/app/api/candidate/application/[token]/scope/route.ts`
- `src/components/candidate/form-engine/ScopeDisplay.tsx`
- `src/types/candidate-repeatable-form.ts` (`ScopeInfo` shape)
- All 5 translation files

---

### TD-058 — New Phase 6 Stage 3 translation keys missing from non-en-US locales

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Translations / i18n |
| Severity    | Warning (i18n)                              |
| Identified  | May 4, 2026 - Phase 6 Stage 3 Standards Check |
| Identified by | Standards Checker                         |

**Description:**
The 14 new translation keys added in Phase 6 Stage 3 (`candidate.addressHistory.*`, `candidate.addressBlock.*`, `candidate.aggregatedRequirements.*`) exist only in `src/translations/en-US.json`. They are absent from `en-GB.json`, `es-ES.json`, `es.json`, and `ja-JP.json`. This violates COMPONENT S6.3 (new translation keys must be added to every language file).

**Why deferred:**
The Stage 3 technical plan explicitly noted this decision: "The other translation files currently lack many of the existing Stage 1 / Stage 2 candidate keys ... This plan does NOT add the new keys to those files because that would expand the scope beyond what Stage 3 requires; the existing translation context falls back gracefully to the en-US value when a key is missing in the active locale." The pattern matches Stages 1 and 2.

**When to fix:**
When the candidate portal is being prepared for non-English locales. Should be done as one batch covering Stages 1, 2, and 3 keys — translating each set in isolation creates rework when terminology changes.

**Affected keys (Stage 3 set):**
- `candidate.addressHistory.title`, `.addAnother`, `.entryLabel`, `.currentAddress`, `.fromDate`, `.toDate`, `.removeConfirm`
- `candidate.addressBlock.street1`, `.street2`, `.city`, `.state`, `.county`, `.postalCode`
- `candidate.aggregatedRequirements.heading`, `.additionalInformation`, `.requiredDocuments`, `.documentUploadPending`

**Files affected:**
- `src/translations/en-GB.json`
- `src/translations/es-ES.json`
- `src/translations/es.json`
- `src/translations/ja-JP.json`

---

---

### TD-061 — In-row FieldErrorMessage inside repeatable entry rows deferred

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Address History, Education, Employment |
| Severity    | Warning (UX — errors shown in banner but not inline in rows) |
| Identified  | May 6, 2026 - Phase 7 Stage 1               |
| Identified by | Implementer                               |

**Description:**
Per-row inline `FieldErrorMessage` display inside repeatable entry rows (AddressHistorySection, EducationSection, EmploymentSection) was deferred. Field errors for these sections are surfaced via the `SectionErrorBanner` and on the Review & Submit page, but not inline next to the individual field within the row. This is a UX gap — the candidate cannot see exactly which field in which row is failing without navigating to the section and reading the banner.

**Why deferred:**
Those component files are each over 500 lines. Adding per-row inline error display requires threading per-entry field error data through nested component props in files that are already at or past the CODING_STANDARDS.md Section 9 size limit. The files should be refactored and split first, then the inline error wiring added.

**When to fix:**
When any of these three files is refactored for another reason, add per-row `FieldErrorMessage` rendering using the `fieldErrors` prop already passed to the component.

**Files affected:**
- `src/components/candidate/form-engine/AddressHistorySection.tsx`
- `src/components/candidate/form-engine/EducationSection.tsx`
- `src/components/candidate/form-engine/EmploymentSection.tsx`

---

### TD-062 — Validation engine does not check Personal Info / IDV required fields directly

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Validation Engine   |
| Severity    | Warning (Coverage gap)                      |
| Identified  | May 6, 2026 - Phase 7 Stage 1               |
| Identified by | Implementer                               |

**Description:**
The validation engine in `validationEngine.ts` does not independently load and check required fields for Personal Info and IDV sections. Instead it relies on the `mergeSectionStatus` workaround: the local component-computed status for those sections (which does check required fields) is merged with the engine's result, and the most-restrictive status wins. This means the `/validate` endpoint's per-section `fieldErrors` array for Personal Info and IDV sections may be empty even when required fields are missing — only the `status` field reflects the actual completeness.

**Why deferred:**
Personal Info and IDV required-field computation requires loading `personal-info-fields` and the IDV field set from the database (with package-context scoping per TD-060's fix). Adding that to the engine was judged to be out of scope for Stage 1; the `mergeSectionStatus` workaround produces the correct sidebar indicator color even when the field-errors array is incomplete.

**When to fix:**
Before Stage 2's server-side pre-submit validation call. The submit handler will call `runValidation()` server-side and must be able to identify missing Personal Info and IDV fields from `fieldErrors` without relying on client-side local status.

**Files affected:**
- `src/lib/candidate/validation/validationEngine.ts`

---

### TD-063 — Gap dates displayed as ISO strings instead of locale-aware format

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Error Display       |
| Severity    | Warning (UX / i18n)                         |
| Identified  | May 6, 2026 - Phase 7 Stage 1               |
| Identified by | Implementer                               |

**Description:**
Gap error messages show dates using ISO date strings (e.g., `2021-05-01`) because `GapError.gapStart` and `GapError.gapEnd` are typed as ISO strings and the frontend renders them via translation placeholders without locale-aware formatting. Candidates see raw ISO dates instead of locale-formatted dates (e.g., "May 1, 2021" or "01/05/2021").

**Why deferred:**
Locale-aware date formatting requires injecting a date-format function at the rendering layer and is a broader i18n concern. The ISO string is unambiguous and technically correct, but the UX does not match the spec's example wording ("from March 2023 to June 2023").

**When to fix:**
During a candidate portal i18n pass. Format the `gapStart` and `gapEnd` values in `ReviewErrorListItem` and `SectionErrorBanner` using the translation context's locale before inserting them into the placeholder string.

**Files affected:**
- `src/components/candidate/review-submit/ReviewErrorListItem.tsx`
- `src/components/candidate/SectionErrorBanner.tsx`
- Possibly `src/lib/candidate/validation/gapDetection.ts` (if the format is moved to the engine)

---

### TD-064 — Duplicated resolveSectionLabelKey helper

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Review & Submit     |
| Severity    | Low (Code quality / duplication)            |
| Identified  | May 6, 2026 - Phase 7 Stage 1               |
| Identified by | Implementer                               |

**Description:**
The `resolveSectionLabelKey` helper function is duplicated in `SectionErrorBanner.tsx` and `ReviewErrorListItem.tsx`. It maps a `sectionId` to the translation key for that section's label (e.g., `'candidate.addressHistory.title'`). Both files carry identical implementations.

**Why deferred:**
The duplication is two small files, each under 100 lines. Extracting a shared utility requires deciding on a home module, which is a design choice beyond Stage 1's scope.

**When to fix:**
During any future modification to either file. Extract into a shared module (e.g., `src/lib/candidate/validation/sectionLabelKeys.ts`) and import from both files.

**Files affected:**
- `src/components/candidate/SectionErrorBanner.tsx`
- `src/components/candidate/review-submit/ReviewErrorListItem.tsx`

---

### TD-065 — portal-layout.tsx and validationEngine.ts exceed size limits

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Portal Shell / Validation |
| Severity    | Warning (Maintainability — CODING_STANDARDS.md Section 9) |
| Identified  | May 6, 2026 - Phase 7 Stage 1               |
| Identified by | Implementer                               |

**Description:**
After Phase 7 Stage 1 additions, `portal-layout.tsx` is approximately 711 lines and `validationEngine.ts` is approximately 628 lines. Both exceed the 600-line hard stop defined in CODING_STANDARDS.md Section 9.

`portal-layout.tsx` has grown across multiple phases to own visit tracking, validation result state, cross-section registry wiring, saved-data hydration, and section rendering dispatch. `validationEngine.ts` owns the full orchestration including database loading, per-section validation, and summary construction.

**Why deferred:**
Both files were within limits when Stage 1 began. The additions were required by the spec. Splitting mid-stage would have been riskier than completing Stage 1 and logging the debt.

**When to fix:**
Before Phase 7 Stage 2 adds further orchestration to either file.

**Suggested splits:**
- `portal-layout.tsx`: extract the saved-data hydration effect into a custom hook; extract section rendering dispatch into a `SectionRenderer` component.
- `validationEngine.ts`: extract the database-loading logic into a `loadValidationInputs` module; the engine file retains only the orchestration loop and summary construction.

**Files affected:**
- `src/components/candidate/portal-layout.tsx`
- `src/lib/candidate/validation/validationEngine.ts`

**Partial resolution — Phase 7 Stage 3a (`feature/phase7-stage3a-validation-engine-split`, 2026-05-09):**
The `validationEngine.ts` half of this entry is resolved. Database loading was extracted into `src/lib/candidate/validation/loadValidationInputs.ts` and two pure helpers (`flattenEntry`, `inferAddressBlockRequirementId`) were moved to `src/lib/candidate/validation/savedEntryShape.ts`. The engine is now 580 lines (under the 600-line hard stop). A pre-existing `prisma.dSXMapping.findMany` call was also given an explicit `orderBy` clause to satisfy API_STANDARDS S7.3.

The `portal-layout.tsx` half remains open and is tracked separately by TD-067.

---

### TD-066 — scope/route.ts still returns English strings for scopeDescription

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Scope API / i18n    |
| Severity    | Warning (i18n — backward compatibility workaround) |
| Identified  | May 6, 2026 - Phase 7 Stage 1               |
| Identified by | Implementer                               |

**Description:**
`GET /api/candidate/application/[token]/scope` still returns an English `scopeDescription` string (not a translation key) in its response. This is intentional: the existing `ScopeDisplay` component consumes the English string directly, and changing the response shape would break that consumer.

Phase 7 Stage 1 introduced a parallel pattern: the `/structure` endpoint now returns a `scopeDescriptionKey` (translation key) alongside `scopeDescriptionPlaceholders` for the same scope information. New components (error banners, Review & Submit page) use the key-based pattern and localize cleanly. The `/scope` endpoint's English-string pattern is inconsistent with this and with COMPONENT_STANDARDS.md S6.1.

This is a continuation and expansion of TD-057 (which logged the same pattern for the pre-existing scope endpoint).

**Why deferred:**
Changing the `/scope` endpoint response shape would require updating `ScopeDisplay.tsx` and the `ScopeInfo` type simultaneously. That file was not part of Phase 7 Stage 1's scope.

**When to fix:**
During the candidate portal i18n pass. Convert the `/scope` endpoint to return `{ scopeKey, scopeParams }` instead of `scopeDescription`, update `ScopeDisplay.tsx` to call `t(scopeKey, scopeParams)`, and add translation keys for all scope variants to all five language files. Resolve TD-057 at the same time.

**Files affected:**
- `src/app/api/candidate/application/[token]/scope/route.ts`
- `src/components/candidate/form-engine/ScopeDisplay.tsx`
- `src/types/candidate-repeatable-form.ts` (`ScopeInfo` shape)
- All five translation files

---

### TD-067 — portal-layout.tsx exceeds file-size soft trigger

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Portal Shell        |
| Severity    | Warning (Maintainability — CODING_STANDARDS.md Section 9.4) |
| Identified  | May 7, 2026 - Phase 7 Stage 2               |
| Identified by | Implementer                               |

**Description:**
After Phase 7 Stage 2 additions (submission state, router, useTranslation, handleSubmit callback), `src/components/candidate/portal-layout.tsx` is approximately 841 lines, well past the 500-line soft trigger from CODING_STANDARDS.md Section 9.4 and meaningfully past the previously-flagged 711-line state recorded in TD-065.

The file now owns too many concerns simultaneously: visit tracking state, validation result wiring, cross-section registry plumbing, saved-data hydration, submission state and submit-fetch orchestration, section rendering dispatch for every section type, and routing. A change to any one concern forces the developer to load the whole file's mental model.

**Why deferred:**
Andy granted a Rule 10 waiver for the Stage 2 additions because the alternative (extracting a `useCandidateSubmit` hook mid-stage) introduced a new file outside the architect's plan. Splitting after Stage 2 lands is the correct sequencing.

**When to fix:**
Before any further Phase 7 work that adds orchestration to this file. Supersedes TD-065 with respect to portal-layout.tsx — TD-065 also covers `validationEngine.ts` and remains open for that file.

**Suggested splits:**
- Extract a `useCandidateSubmit(token)` hook owning the `submitting` / `submitError` state and the `handleSubmit` callback, into `src/lib/candidate/submission/useCandidateSubmit.ts`.
- Extract the section-rendering dispatch (`getActiveContent`) into a `<PortalSectionRenderer>` component.
- Extract the saved-data hydration effect into a `useSavedDataHydration` hook.
- The shell file should retain only top-level state composition and JSX layout.

**Files affected:**
- `src/components/candidate/portal-layout.tsx`

---

### TD-068 — portal-layout.test.tsx mock fetch return type does not satisfy `typeof fetch`

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Portal Shell tests  |
| Severity    | Warning (Type safety — TESTING_STANDARDS.md) |
| Identified  | May 7, 2026 - Phase 7 Stage 2               |
| Identified by | Implementer                               |

**Description:**
`pnpm tsc --noEmit` reports five TS2345 errors in `src/components/candidate/portal-layout.test.tsx` at lines 276, 759, 864, 966, and 1060. Each call site assigns a mock function with the shape `(url: string) => Promise<Response> | Promise<{ ok: boolean; status: number; }>` to a binding typed as the global `fetch` signature `(input: string | URL | Request, init?: RequestInit) => Promise<Response>`. The mocks return either a real `Response` or a hand-rolled `{ ok, status }` object literal, so the inferred union is not assignable to the strict global signature.

These errors are pre-existing — they were present on this branch before Phase 7 Stage 2 began. They were surfaced (not introduced) when the new submission code in `portal-layout.tsx` made the project-wide `tsc --noEmit` output more visible.

**Why deferred:**
Implementer agents may not edit test files (Absolute Rule 1). Fixing the mocks requires either casting each return as `Response` or constructing a real `Response` instance — both are test-file edits. Stage 2 was finished without touching the test file to comply with Rule 1.

**When to fix:**
Either as part of Phase 7 Stage 2 Pass 2 testing (test-writer-2 will be writing new component tests for the submit flow in this same file and can normalize the existing mocks at the same time), or as a standalone test-cleanup task before the next branch with broad TypeScript work.

**Suggested fix:**
Replace each mock fetch return literal with a real `Response` instance:
```ts
return new Response(JSON.stringify({ ... }), { status: 200, headers: { 'Content-Type': 'application/json' } });
```
or cast the literal: `return { ok: true, status: 200 } as Response;`. Both options satisfy the `typeof fetch` signature.

**Files affected:**
- `src/components/candidate/portal-layout.test.tsx` (lines 276, 759, 864, 966, 1060)

---

### TD-069 — Per-entry required field validation missing for Address History, Education, and Employment sections

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate Application — Validation Engine   |
| Severity    | Major (Correctness — sections validate green when actually incomplete) |
| Identified  | May 7, 2026 - Phase 7 Stage 2 smoke testing |
| Identified by | Andy (smoke test) + bug-investigator     |

**Description:**
The validation engine checks entry count and date coverage for Address History, Education, and Employment, but does not verify that required fields within each entry have values. A candidate can create entries with only dates filled in (and, for address-history, only `countryId` + `fromDate` / `toDate` / `isCurrent` inside the address_block JSON) and the section validates as `complete`. There is no equivalent of the TD-062 `checkRequiredFields` walk for these three repeatable sections — TD-062 only wired up Personal Info and IDV.

The bug surfaces visibly in Address History (where the address detail fields like `street1`, `city`, `state`, `postalCode` may be empty on every entry yet the section reads green); the same gap is latent in Education and Employment.

**Separate from the form-rendering gap:**
A related but distinct symptom was observed during smoke testing: address detail inputs (street, city, state, postal code) sometimes do not appear in the rendered `AddressHistorySection` form, even when the candidate has saved an entry with country and dates. That is a UI gate problem (`AddressHistorySection.tsx:479` only renders `<AddressBlockInput>` when both `entry.countryId` and a DSX `address_block`-typed field are resolved) and is **not** the same issue as this validation gap. Fixing this validation gap will correctly turn the section red but will not make missing inputs appear; the rendering gap needs its own repro and separate fix.

**Why deferred:**
Andy chose to scope the Phase 7 Stage 2 smoke-test fixes to Issue 2 (the date-extractor bug) only, and defer Issue 1 (per-entry required field validation) to a future stage to avoid expanding the scope of the Stage 2 implementer commit.

**When to fix:**
Before Phase 7 ships. The submission flow currently allows a candidate to submit a package with empty required fields inside Address History entries because validation reports `allComplete: true`. This is a correctness regression against the spec's status table (`docs/specs/phase7-stage1-validation-scope-gaps-review.md` Rules 4–7).

**Suggested fix:**
- Add a per-entry field-completeness walk to `validateAddressHistorySection`, `validateEducationSection`, and `validateEmploymentSection` that mirrors the TD-062 pattern in `personalInfoIdvFieldChecks.ts`.
- For each entry, resolve the DSX field requirements for the entry's jurisdiction and emit a `FieldError` for every required field whose saved value is empty.
- For `address_block`-typed fields specifically, descend into the JSON value and check each piece marked `required: true` in the requirement's `addressConfig` (`street1`, `city`, etc.) — not just whether the JSON object exists.
- Reuse the `findMappings` adapter and `checkRequiredFields` helper already built for TD-062 where possible.

**Files affected:**
- `src/lib/candidate/validation/validationEngine.ts` — `validateAddressHistorySection`, `validateEducationSection`, `validateEmploymentSection`
- Possibly a new helper file analogous to `personalInfoIdvFieldChecks.ts` for the repeatable-section field walk
- New regression tests in `src/lib/candidate/validation/__tests__/validationEngine.test.ts` proving each section turns red when an entry has empty required fields

---

### TD-072 — IDV stale per-country form-data leak on country switch

| Field         | Detail                                                                  |
|---------------|-------------------------------------------------------------------------|
| Area          | Candidate Application — `IdvSection.tsx`                                |
| Severity      | Warning (correctness — orphaned OrderData rows)                         |
| Identified    | May 7, 2026 - Phase 7 Stage 2 data-flow audit                           |
| Identified by | bug-investigator (`docs/audits/PHASE7_STAGE2_DATAFLOW_AUDIT.md` CO-01)  |

**Description:**
When the candidate switches IDV country, the previous country's per-field values are stashed under a synthetic `country_${countryId}` key in client `formData` state, but the existing `formData[<requirementId>]` entries are NOT cleared. The next save (triggered by typing a new field for the new country) sends ALL `pendingSaves` requirementIds, including any pending entries from the previous country. Saved values are referenced by requirementId, so orphaned values can persist in `formData.sections.idv.fields` until a new field with the same requirementId overwrites them. `readIdvSection` will include them in OrderData rows, attached to the *current* country's IDV OrderItem.

**Impact:**
OrderData rows for IDV may carry residual values from a country that's no longer selected, attached to the OrderItem for the new country. Submission still produces an IDV OrderItem for the right country and the `locationId` FK is correct, so this does not block submission — but the vendor receives field values that don't belong to the selected jurisdiction.

**Why deferred:**
Cosmetic per the audit: the candidate is unlikely to switch countries mid-flow in production, the `locationId` is correct, and the fix requires reasoning about the `pendingSaves` lifecycle in `IdvSection.tsx:236–272`. Logged as tech debt rather than blocking the BL-01/BL-02 submission fix.

**When to fix:**
Before Phase 7 ships if user research confirms candidates do switch IDV country during the flow; otherwise can be addressed in a follow-up cleanup pass.

**Suggested fix:**
On country switch in `IdvSection.tsx`, clear all `formData[<requirementId>]` entries that belong to DSX requirements scoped to the previous country before stashing the snapshot. Equivalently, walk the previous country's field set and `delete formData[req.id]` for each. Add a regression test that switches country, types in a field, and asserts the save payload does not include orphaned requirementIds from the prior country.

**Files affected:**
- `src/components/candidate/form-engine/IdvSection.tsx` (lines 236–272 — country-switch handling and `pendingSaves` flush)

---

### TD-073 — Education / Employment date extractor is locale-dependent and silently no-ops

| Field         | Detail                                                                  |
|---------------|-------------------------------------------------------------------------|
| Area          | Candidate Application — Validation Engine date extractors               |
| Severity      | Warning (correctness — non-English packages may bypass scope/gap checks) |
| Identified    | May 7, 2026 - Phase 7 Stage 2 data-flow audit                           |
| Identified by | bug-investigator (`docs/audits/PHASE7_STAGE2_DATAFLOW_AUDIT.md` CO-02)  |

**Description:**
The extractor's primary identification path in `dateExtractors.ts:165–252` uses `requirement.name` substring matching — it looks for "start", "end", "graduation", "current". This is locale-dependent. A non-English package configuration would fall through to the camelCase alias-set fallback, which uses `meta.fieldKey`. If both metadata is missing AND the known aliases don't match, dates simply won't be detected and the section will validate as if it has no date data. **No warning or error is logged when this happens.**

**Impact:**
A package whose DSX requirements have neither a recognized fieldKey alias (`startDate`, `endDate`, `graduationDate`, `currentlyEmployed`, etc.) nor an English name with "start" / "end" / "current" / "graduation" will silently bypass time-based scope and gap checks for Education and Employment. The candidate could submit an out-of-scope entry without the engine flagging it.

**Why deferred:**
Cosmetic per the audit: today's package configurations all use English names and recognized fieldKey aliases, so the silent fallback is not currently triggered in production. Logged as tech debt to address proactively before non-English package configurations are introduced or before locale-translated requirement names ship.

**When to fix:**
Before any package configuration ships with non-English `requirement.name` values, or before the date-extractor is reused in any locale-localized context.

**Suggested fix:**
- When `extractEmploymentEntryDates` (or its caller) finds an entry that has fields but no role-identified start/end date, log a `warn` with the entry's requirementIds and the candidate token so the gap is observable instead of silent.
- Consider replacing the substring-on-name path with a stricter fieldKey-only match — `requirement.name` should not be load-bearing for semantic role detection.
- Add a regression test that constructs a package whose date requirements have non-English names but recognized fieldKey aliases, and asserts the extractor still resolves them.

**Files affected:**
- `src/lib/candidate/validation/dateExtractors.ts` (lines 165–252)
- `src/lib/candidate/validation/loadValidationInputs.ts` — metadata population (the `requirementMetadata` map build) moved here from `validationEngine.ts` in Phase 7 Stage 3a; the warning could be emitted from this function

---

### TD-074 — Submission orchestrator bypasses `OrderCoreService.addOrderItem`

| Field         | Detail                                                                  |
|---------------|-------------------------------------------------------------------------|
| Area          | Candidate Application — Submission orchestrator                         |
| Severity      | Warning (architectural — accepted deviation from DATABASE_STANDARDS S2.2) |
| Identified    | May 7, 2026 - Phase 7 Stage 2 standards check                           |
| Identified by | standards-checker                                                       |

**Description:**
DATABASE_STANDARDS Section 2.2 states that the canonical function for creating an `OrderItem` is `OrderCoreService.addOrderItem` and that `OrderItem` records must not be created directly via `prisma.orderItem.create()`. `submitApplication.ts` (Phase 7 Stage 2) creates `OrderItem` rows directly inside its outer `prisma.$transaction()` rather than calling the canonical function.

**Why deferred:**
`OrderCoreService.addOrderItem` opens its own `prisma.$transaction()`. Calling it from inside the submission's outer transaction would either nest transactions (unsupported) or splinter the submit operation across multiple independent transactions, breaking the all-or-nothing invariant the technical plan §12 explicitly requires. The submission orchestrator therefore replicates the same transactional pattern inline — `tx.orderItem.create` immediately followed by `tx.servicesFulfillment.create({ assignedVendorId: null })` in the same transaction — preserving the `OrderItem` ↔ `ServicesFulfillment` 1:1 invariant that S2.2 was written to enforce. The deviation was reviewed and accepted by the code-reviewer and standards-checker stages of the Phase 7 Stage 2 pipeline.

**Risks of the deviation:**
- The duplicate-check (`findMany({ orderId, serviceId, locationId })`) that `addOrderItem` performs is not replicated here. The submission flow relies on upstream dedup logic (`dedupeOrderItemKeys`) plus idempotency guards on the order's `statusCode === 'draft'` precondition. Concurrent retries that pass the in-transaction guard could in principle write duplicates; mitigation is the candidate UI's button-disable plus session-bound auth.
- Future changes to `OrderCoreService.addOrderItem` (e.g., new audit hooks or side effects) will not flow through to the submission path automatically.

**When to fix:**
When `OrderCoreService` is refactored to accept an externally provided `tx` parameter (i.e., `addOrderItem(tx, …)` becomes possible), migrate the submission orchestrator to call it directly. Alternatively, extract the inner write pattern into a shared helper that both paths invoke.

**Suggested fix:**
- Refactor `OrderCoreService.addOrderItem` to accept an optional `tx: Prisma.TransactionClient` parameter and use it instead of opening a new transaction when provided. Then replace the inline `tx.orderItem.create` + `tx.servicesFulfillment.create` block in `submitApplication.ts` (around line 407) with a call to `OrderCoreService.addOrderItem(tx, …)`.
- Add a duplicate `(orderId, serviceId, locationId)` precondition check in the helper for parity with the existing `addOrderItem` behavior.

**Files affected:**
- `src/lib/candidate/submission/submitApplication.ts` (around line 407 — direct `tx.orderItem.create` + `tx.servicesFulfillment.create` block)
- `src/lib/services/order-core.service.ts` (`addOrderItem` — would need a tx-pass-through variant)

---

### TD-075 — `submitApplication.ts` exceeds 600-line file-size hard stop

| Field         | Detail                                                                  |
|---------------|-------------------------------------------------------------------------|
| Area          | Candidate Application — Submission orchestrator                         |
| Severity      | Warning (file size — accepted override)                                 |
| Identified    | May 7, 2026 - Phase 7 Stage 2 standards check                           |
| Identified by | standards-checker                                                       |

**Description:**
`src/lib/candidate/submission/submitApplication.ts` is 689 lines, exceeding the 600-line hard stop in CODING_STANDARDS S9.

**Why accepted:**
The file is the orchestrator for the entire candidate submission pipeline. The technical plan (`docs/specs/phase7-stage2-submission-order-generation-technical-plan.md` §12) deliberately keeps the 11 sequential steps in a single file so the all-or-nothing transaction shape is readable in one place. Splitting the orchestrator across multiple files would either re-introduce the transaction-nesting problem already documented in TD-074 or fragment the sequence diagram across helpers, hurting readability of the most critical safety-bearing code path in the candidate flow.

**When to fix:**
If the orchestrator grows beyond ~800 lines, or if a future feature adds a wholly new submission step that can be cleanly extracted as a co-equal sibling helper. Until then, the size is a deliberate trade-off.

**Files affected:**
- `src/lib/candidate/submission/submitApplication.ts`

---

### TD-076 — `personalInfoIdvFieldChecks.ts` exceeds 600-line file-size hard stop

| Field         | Detail                                                                  |
|---------------|-------------------------------------------------------------------------|
| Area          | Candidate Application — Validation engine field checks                  |
| Severity      | Warning (file size — accepted override)                                 |
| Identified    | May 7, 2026 - Phase 7 Stage 2 standards check                           |
| Updated       | May 15, 2026 - Cross-section validation filtering bug fix standards check |
| Identified by | standards-checker                                                       |

**Description:**
`src/lib/candidate/validation/personalInfoIdvFieldChecks.ts` is 659 lines, over the 600-line hard stop in CODING_STANDARDS S9.

Growth history:
- Phase 7 Stage 2 (May 7, 2026): 632 lines (over soft warning).
- Phase 7 Stage 3a/3b: grew past 600 to 671 lines.
- Task 8.5 (Silent Recalculation): 671 lines (no net change).
- Cross-section validation filtering bug fix (May 15, 2026): 668 lines committed and 659 lines after the locked-invitation-fieldKey wiring pass. The bug fix is net-negative on this file; the file was already over 600 before the branch started.

**Why accepted:**
The file was deliberately extracted from `validationEngine.ts` (already TD-065) to keep the validation engine itself manageable. The collectors, AND-aggregator, `checkRequiredFields`, and the two section validators it contains share the same data shapes and helper logic — the code-reviewer's first pass concluded that splitting it further would create unnatural seams without any cohesion benefit.

Per `CODING_STANDARDS.md` Section 9.4, splitting a large file reactively in the middle of unrelated work is how regressions happen. The cross-section validation filtering bug fix is a behavioral correction in the cross-section registry layer and does not own this file structurally, so the split is being deferred again rather than performed inside the bug-fix branch.

**When to fix:**
Suggested split: extract the per-fieldKey Personal Info / IDV field-key resolution helpers (the lookups that pair a requirement with its fieldKey and its DSX mapping context) into a focused module (e.g., `personalInfoFieldKeyResolver.ts`) and leave the section validators in this file. That seam is the cleanest because the field-key resolution layer is what the cross-section registry consumes, and lifting it out also makes future cross-section registry changes easier to test in isolation. If a future stage adds a third section validator (beyond Personal Info and IDV), the section-level collector and validator pairs should also be split into per-section files at that point.

**Files affected:**
- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`

---

### TD-077 — Document the deliberate structural re-declaration pattern

| Field         | Detail                                                                  |
|---------------|-------------------------------------------------------------------------|
| Area          | Candidate Application — Validation engine module structure              |
| Severity      | Warning                                                                 |
| Identified    | May 9, 2026 - Phase 7 Stage 3a documentation pass                       |
| Identified by | documentation-writer                                                    |

**Description:**
Several files in `src/lib/candidate/validation/` re-declare the same TypeScript interface shapes rather than importing from a shared location. This is intentional architectural layering (see Phase 7 Stage 3a technical plan §3.1) but is undocumented in code, creating risk that a future engineer will "consolidate" the duplication and break the layering.  
**Clarification (post Phase 7 Stage 3b):**
The TD-077 prohibition applies to a shared types module that crosses the loader/validator boundary in `src/lib/candidate/validation/`. It does **not** prohibit type exports between sibling validator helpers on the same side of that boundary (for example, `repeatableEntryFieldChecks.ts` exporting a structural alias that `validationEngine.ts` imports). A single export between two co-equal sibling validators preserves the duplication count and keeps the loader/validator separation intact.

**Affected sites:**
- `CandidateFormDataShape` in `loadValidationInputs.ts`
- The DSX mapping shape types in `personalInfoIdvFieldChecks.ts` (lines 47–76)

**Fix:**
Add brief comment blocks at each re-declaration site noting that the duplication is intentional and pointing to the architectural rationale (Phase 7 Stage 3a technical plan §3.1).

**Files affected:**
- `src/lib/candidate/validation/loadValidationInputs.ts`
- `src/lib/candidate/validation/personalInfoIdvFieldChecks.ts`


---

### TD-082 — `evaluateTimeBasedScope` does not flag entries with null dates inside a time-bounded scope

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate validation engine — scope checks  |
| Severity    | Medium                                      |
| Identified  | Phase 7 Stage 3b code review (2026-05-10)   |

**Description:**
When a repeatable section has a time-based scope (e.g., 5-year employment scope) and a saved entry has null `startDate` and/or `endDate` fields, `evaluateTimeBasedScope` returns zero scope errors. The expected behavior is for the function to emit a scope error indicating the entry cannot be evaluated against the time-based scope because it lacks the dates needed to compute coverage.

Surfaced by the DoD 9 Pass 1 test in `validationEngine.test.ts:1219–1311`, which constructs a 5-year-scope employment with a single entry that has no date fields populated and expects a scope error to be produced. The test fails on Pass 1 and continues to fail after Stage 3b's implementation — the per-entry walk is unrelated.

The DoD 9 test in validationEngine.test.ts is currently .skip'd with a pointer to this TD entry. When the underlying behavior is fixed (or the fixture is corrected), un-skip the test.

**Why deferred:**
Stage 3b scope was strictly TD-069 and TD-072. The scope-extractor's behavior with null-date entries is a pre-existing issue with its own implications and should be evaluated independently.

**When to fix:**
Either tighten `evaluateTimeBasedScope` to emit an error when an entry's dates are null inside a time-bounded scope, or fix the fixture in the DoD 9 test to populate dates. Decide which by inspecting how time-based scope is expected to behave when dates are missing — this may surface a broader product question about whether a candidate should be permitted to save an entry without dates.

---

### TD-083 — TD-072 country-switch cleanup race not under deterministic automated test

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | IdvSection candidate component — country switch |
| Severity    | Low (behavior is verified by spec review + manual smoke) |
| Identified  | Phase 7 Stage 3b test-writer Pass 1 (2026-05-10) |

**Description:**
The bug TD-072 fixes is a race condition: when a candidate types into a country-X-scoped IDV field and then switches to country Y *before* the user-typed save's debounced request has fired, the country-X requirementId stays in `pendingSaves` and gets included in the country-switch save body as if it belonged to country Y.

The Stage 3b Pass 1 tests for TD-072 (`IdvSection.test.tsx:1472–1541` and `:1560–1664`) cannot deterministically reproduce this race because the fetch mock's `setupCountrySwitchFetchMock` returns immediately-resolving promises. Both tests pass on Pass 1 (before any cleanup logic exists) as well as after the implementation lands — they serve as forward regression guards on the save-body shape rather than as Pass-1-failure tests.

The actual cleanup behavior is verified by spec review and by DoD 14's manual smoke test, both of which the implementer confirmed.

**Why deferred:**
Reproducing the race deterministically requires a deferred-promise fetch mock where the test can hold the country-X save's response in flight while the country switch fires, then resolve and re-assert. The existing test infrastructure does not expose this pattern, and orchestrating it is non-trivial work that should not block Stage 3b shipping.

**When to fix:**
When test infrastructure work permits, write a deferred-promise race test for the `pendingSaves` orphan window. The test should:
1. Type into a country-X-scoped field.
2. Hold the resulting save request unresolved.
3. Switch to country Y.
4. Resolve the country-X save.
5. Assert that the country-switch save body does NOT contain the country-X requirementId.

---

### TD-084 — Required-state indicator on form fields does not reflect per-country DSX mappings

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate portal — form rendering           |
| Severity    | Low (visual only — validation is correct)   |
| Identified  | Phase 7 Stage 3b smoke test (2026-05-11)    |

**Description:**
In sections where the candidate has selected a country (IDV section's country dropdown; per-entry country on Address History / Education / Employment entries), form fields render with a required-state visual indicator (red asterisk) that does not reflect the per-country `dsx_mappings.isRequired` value for the candidate's package services. Specifically:

- Fields render with a required indicator even when no `dsx_mappings` row marks them required at the candidate's selected country for any service in their package. Observed on the IDV In-Country Address field with country = US and on Address History address-block pieces with country = US.

The validation engine itself correctly reads per-country `dsx_mappings.isRequired` (confirmed by Stage 3b's per-entry walk — section indicator turns green when the field is blank but not actually required, and submission is not blocked).

This is a visual inconsistency, not a correctness bug. Candidates may be confused by the asterisk but are not blocked from submitting.

**Out of scope for this entry:**
- Personal Info section's required-state indicator behavior. Personal Info does not have cross-section country awareness, so fields like Mother's Maiden Name (which is required at Mexico per `dsx_mappings` but rendered on Personal Info per `collectionTab`) do not reflect any country-specific required-state. This is the inverse problem and is tracked under TD-052.
- Field visibility / which fields render. Per current product rules, a field renders if it is associated with any service in the candidate's package. Per-country filtering of field visibility is a future product enhancement, not part of TD-084.

**Why deferred:**
Visual-only inconsistency. Validation engine is correct; submission is not blocked. Worth fixing for candidate clarity but not urgent.

**When to fix:**
Trace the source of the required-state decoration in the form-rendering code path. Likely candidates: a default flag on the requirement itself, a field-config default in the API response, or hardcoded asterisk decoration in the input component. Align it with per-country `dsx_mappings.isRequired` lookups using the same data the validation engine already consumes.

---

### TD-085 — DSX admin UI does not propagate required-state across geographic hierarchy

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | DSX administration UI / `dsx_mappings` data integrity |
| Severity    | Medium (data inconsistency)                 |
| Identified  | Phase 7 follow-up — TD-084 investigation (2026-05-11) |

**Description:**
The DSX admin interface allows per-mapping `isRequired` toggling at country, region, and subregion levels without enforcing consistency between levels. As a result, the `dsx_mappings` table can contain inconsistent geographic-hierarchy data: a parent country may be marked required while a subregion under it is marked optional, or vice versa.

The intended product behavior is that geographic-hierarchy required-state propagates:
- Marking a country required should mark all subregions under it required automatically.
- Unchecking a single subregion should uncheck the parent country (and any other subregions that were implicitly required by the parent).
- Required-state inheritance should be enforced at edit time, so the table cannot end up with inconsistent levels.

Today this propagation is not implemented. The TD-084 investigation surfaced this when explaining the OR-merge logic in the `/fields` route: the route's merge behavior partly compensates for the table's inability to express consistent multi-level rules.

**Why deferred:**
This is a DSX admin-UI concern, not a candidate-portal concern. TD-084 will land the rendering / validation fixes assuming the table may contain inconsistent data and will use OR-merge to compensate. Once the admin UI enforces propagation, the OR-merge becomes a safety net rather than a workaround.

**When to fix:**
Implement required-state inheritance in the DSX admin UI: marking a parent location required propagates to children; unchecking a child propagates up to the parent. Add a data-integrity migration (or one-time cleanup script) to reconcile any existing inconsistent rows in `dsx_mappings`.

---

### TD-086 — `fromDate` / `toDate` asterisks hardcoded in AddressBlockInput.tsx

| Field       | Detail                                      |
|-------------|---------------------------------------------|
| Area        | Candidate portal — AddressBlockInput component |
| Severity    | Low (visual only — likely correct behavior already) |
| Identified  | Phase 7 follow-up — TD-084 investigation (2026-05-11) |

**Description:**
`src/components/candidate/form-engine/AddressBlockInput.tsx:493` and `:537` render an unconditional red asterisk on the `fromDate` and `toDate` fields with no condition tied to `dsx_mappings` or any per-country logic:

```tsx
<span className="text-red-500 ml-1 required-indicator">*</span>
```

The asterisk is always rendered, regardless of which country the entry is for or whether the mapping data says required. Surfaced by the TD-084 investigation.

The likely correct behavior is to leave these asterisks unconditional, because date coverage is required for any address-history entry to be useful (scope validation and gap detection both depend on dates being populated). However, this hasn't been explicitly verified as the intended behavior.

**Why deferred:**
The asterisks are outside `dsx_mappings`'s scope (mappings cover per-piece required-state for street / city / state / postal code, not dates). The behavior is probably intentional. TD-084's fix should NOT touch these — it's a scope-creep trap.

**When to fix:**
Confirm with product whether dates should remain unconditionally required for address-history entries. If yes, document the decision in code with a brief comment near the asterisks. If no, align the date asterisks with whatever per-country logic governs them (probably a separate mapping or config).

---

### TD-087 — Batched dSXMapping.findMany in /fields route aggregator

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | DSX field aggregation / API performance               |
| Severity      | Minor (Performance optimization)                      |
| Identified    | May 11, 2026 - TD-084 Implementation                  |
| Identified by | Implementer                                           |

**Description:**
The `/fields` route (`src/app/api/candidate/application/[token]/fields/route.ts`) calls `dsx_mappings.findMany` once per `(serviceId, levelId)` combination when building the input to the new aggregator (`aggregateFieldsRequired.ts`, in the same directory) introduced by TD-084. For a candidate package with N services and M geographic levels, this issues N×M queries instead of a single batched query.

**Why deferred:**
The existing test fixtures in `route.test.ts` are structured around per-`(serviceId, levelId)` mocks. Collapsing to a single batched query would have required restructuring those fixtures, which expanded the scope of TD-084 beyond what was authorized. The current N×M pattern is correct — this is a performance optimization, not a correctness issue.

**When to fix:**
When `route.test.ts` fixtures are restructured for another reason, or if `/fields` route latency becomes a measurable issue under load. Likely a natural pairing with TD-089 (test-infrastructure cleanup in the same file).

**Recommendation:**
Collapse the per-`(serviceId, levelId)` `findMany` loop in `route.ts` (around lines 328-349) into a single `findMany` call with a compound `where` clause covering all `(serviceId, levelId)` pairs. The aggregator (`aggregateFieldsRequired.ts`) already takes a flat row list and does not need to change. Update `route.test.ts` mock fixtures to support the batched call shape.

---

### TD-088 — Pre-existing typecheck error in IdvSection.tsx:538

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | TypeScript strict mode / Candidate form components    |
| Severity      | Low (Type safety, no runtime impact)                  |
| Identified    | May 11, 2026 - TD-084 Implementation                  |
| Identified by | Implementer                                           |

**Description:**
A pre-existing typecheck error at `src/components/candidate/form-engine/IdvSection.tsx:538`. The expression resolves to `FieldMetadata | null | undefined` where the downstream consumer's signature expects `FieldMetadata | undefined`. The mismatch does not cause runtime issues because `null` is coerced to `undefined` at the consumer boundary, but it fails strict typecheck.

**Why deferred:**
This error exists on `dev` and was not introduced by TD-084. Fixing it requires either narrowing the type at the source or adjusting the consumer's signature — both touch code outside TD-084's scope. The implementer flagged it during the Stage 3b pass and preserved scope discipline by not touching it.

**When to fix:**
During the next pass on `IdvSection.tsx`, or as part of a broader TypeScript strict-mode cleanup.

**Recommendation:**
Either narrow the upstream expression to exclude `null` at the source, or accept `FieldMetadata | null | undefined` at the consumer's signature and normalize there.

---

### TD-089 — Pre-existing typecheck error in route.test.ts:903 mock setup

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | TypeScript strict mode / Test infrastructure          |
| Severity      | Low (Type safety in test code, no runtime impact)     |
| Identified    | May 11, 2026 - TD-084 Implementation                  |
| Identified by | Implementer                                           |

**Description:**
A pre-existing typecheck error at `src/app/api/candidate/application/[token]/fields/route.test.ts:903`. The argument passed to `dSXAvailability.findFirst.mockImplementation` is not assignable to the type expected by the Prisma client's generated `findFirst` signature. The implementer verified by targeted git stash that this error was inherited from an earlier commit on the TD-084 branch and was NOT introduced by Stage 3b's work.

**Why deferred:**
The mock works correctly at runtime — the type mismatch is between the simplified mock argument shape and the full Prisma type. Fixing it requires either matching the full Prisma argument shape in the mock or casting at the boundary. Both are test-infrastructure cleanup that was out of scope for TD-084.

**When to fix:**
When test fixtures for `route.test.ts` are next restructured — likely alongside TD-087's batched-query work, which will already require fixture changes in the same file.

**Recommendation:**
Either update the mock implementation to match the full Prisma `findFirst` argument type, or add a type assertion at the mock boundary. Consider pairing with TD-087's fixture restructure to address both at once.

---

### TD-090 — `portal-layout.tsx` file size exceeds 600-line hard stop

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Portal / Component Structure                |
| Severity      | Warning                                               |
| Identified    | May 13, 2026 - Task 8.1 Template Variable System      |
| Updated       | May 15, 2026 - Task 9.1 Error Boundaries & Loading States |
| Identified by | Standards Checker                                     |

**Description:**
`src/components/candidate/portal-layout.tsx` is 988 lines, well over the 600-line hard stop in `CODING_STANDARDS.md` Section 9.1. The file handles layout, navigation, section rendering, form state, template variable value construction, visit tracking, the linear step navigation callbacks, dynamic step visibility / silent recalculation logic, effective validation result patching that hides skipped dynamic steps from Review & Submit, and (as of Task 9.1) the ErrorBoundary wiring for per-section crash isolation — responsibilities that should be split into smaller focused modules.

Growth history (post portal-layout refactor, PR #513):
- Post-refactor baseline (dev, May 15, 2026): 881 lines
- Post-Task 9.1: 988 lines (+107, ErrorBoundary import and wiring, `scrubErrorMessage` helper, `handleSectionRenderError` callback, `activeSectionTitle` and `skipToNextFromFallback` derivations, ErrorBoundary JSX wrapping the content area)

**Why deferred:**
Per `CODING_STANDARDS.md` Section 9.4, splitting a large file reactively in the middle of unrelated work is how regressions happen. The Task 9.1 addition is wiring-only: the boundary logic itself lives in the new `ErrorBoundary` and `CandidateSectionErrorFallback` components. A full split of `portal-layout.tsx` is the correct standalone task.

**When to fix:**
As a dedicated follow-up task before any further feature additions to this file. Suggested first split: extract the navigation/visibility logic — dynamic step visibility computation, visible-sections derivation, visit tracking effects, and effective validation result patching — into a custom hook (e.g., `useDynamicStepNavigation`). That hook would own a significant portion of the file's most cohesive logic, can be unit-tested in isolation, and would materially reduce the component size. Subsequent splits can extract section rendering and form state management into their own hooks.

---

### TD-091 — Hardcoded `'not_started'` status strings in structure route

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Application API                             |
| Severity      | Warning                                               |
| Identified    | May 13, 2026 - Task 8.1 Template Variable System      |
| Identified by | Standards Checker                                     |

**Description:**
`src/app/api/candidate/application/[token]/structure/route.ts` uses the string literal `'not_started'` in 6 places. Per `DATABASE_STANDARDS.md` Section 5.1-5.2, status values must come from named constants, not hardcoded strings.

**Why deferred:**
The values are correct and match the database. This is a code quality issue, not a bug. No section status constants file exists yet — creating one and updating all references is a small dedicated task.

**When to fix:**
When working on the structure route for another reason, or during a constants standardization pass. Create a `SECTION_STATUSES` constant (similar to the existing order/service status constants) and replace all 6 occurrences.

---

### TD-092 — `workflow-dialog.tsx` email template hint list not using shared variable registry

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Admin Workflows / Email Templates                     |
| Severity      | Low                                                   |
| Identified    | May 13, 2026 - Task 8.1 Template Variable System      |
| Identified by | Architect                                             |

**Description:**
`src/components/modules/workflows/workflow-dialog.tsx` contains a hardcoded HTML list of email template variable hints including `candidateFirstName`, `candidateLastName`, `candidateEmail`, `candidatePhone`, `companyName`, `inviteLink`, and `expirationDate`. Task 8.1 created a shared variable registry at `src/lib/templates/variableRegistry.ts` but deliberately did not migrate this hint list because `inviteLink` is not in the v1 registry (it's only meaningful at email-send time, not workflow-section-render time).

**Why deferred:**
Migrating the hint list would drop `inviteLink` from the visible hints, which is a behavior change not authorized by the Task 8.1 spec. The email-send feature has not been built yet.

**When to fix:**
When the email-send feature is implemented. At that point, add `inviteLink` to the shared registry (category: `'invitation'`) and replace the hardcoded hint list in `workflow-dialog.tsx` with the `WorkflowSectionVariableReference` component (or a variant of it that includes invitation-only variables).

---

### TD-093 — E2e seed data missing for template variable Playwright tests

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Testing / E2e                                         |
| Severity      | Low                                                   |
| Identified    | May 13, 2026 - Task 8.1 Template Variable System      |
| Identified by | Code Reviewer                                         |

**Description:**
`e2e/tests/template-variable-system.spec.ts` expects a seeded candidate invitation with token `'test-template-variable-token'`, firstName `'Sarah'`, company `'Acme Corp'`, and a workflow section containing template variable placeholders. No matching seed data exists in the e2e seed scripts. The tests will skip or fail in CI until the seed is created.

**Why deferred:**
The e2e seed infrastructure was not in scope for Task 8.1. The unit and component tests (93 tests) provide full coverage of the feature logic.

**When to fix:**
When setting up or expanding the e2e seed data for the candidate portal flow. Add a seeded invitation matching the test's expectations to the e2e seed script.

---

### TD-094 — `CandidateSectionLoadingSkeleton` built but not wired into production

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Portal / Loading States                     |
| Severity      | Low                                                   |
| Identified    | May 15, 2026 - Task 9.1 Error Boundaries & Loading States |
| Identified by | Implementer                                           |

**Description:**
`src/components/candidate/CandidateSectionLoadingSkeleton.tsx` was created as part of Task 9.1 but has no production consumer. The component is fully tested and ready to use. It is not wired into `portal-layout.tsx` or any section component because candidate sections are not yet lazy-loaded or Suspense-driven. The component exists as infrastructure for when that change is made.

**Why deferred:**
Wiring a loading skeleton requires a Suspense boundary and either lazy-loaded section components or a data-fetching suspension point. Neither exists yet. Building that infrastructure was out of scope for Task 9.1, which focused on render-error isolation.

**When to fix:**
When candidate portal sections are converted to lazy-loaded components or Suspense-driven data fetching. At that point, wrap each section import or data-fetch suspension with `<Suspense fallback={<CandidateSectionLoadingSkeleton variant="..." />}>`. Choose the variant based on the section type: `form` for data-entry sections, `content` for workflow/acknowledgment sections, `review` for the Review & Submit section.

---

### TD-095 — `scrubErrorMessage` does not redact SSN-shaped strings

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Portal / PII Safety in Client Logs          |
| Severity      | Low                                                   |
| Identified    | May 15, 2026 - Task 9.1 Error Boundaries & Loading States |
| Identified by | Implementer                                           |

**Description:**
The `scrubErrorMessage` helper in `portal-layout.tsx` redacts formatted phone numbers, long bare digit runs, and capitalized name-like sequences from error messages before they are forwarded to `clientLogger.error`. It does not redact SSN-shaped strings (`123-45-6789`) or JSON-quoted name fields (e.g., `"firstName": "John"`). These patterns are unlikely to appear in React render error messages in practice, but they are theoretically possible if a crash references a form field value that holds one of those shapes.

**Why deferred:**
The existing heuristics cover the most likely PII shapes in React error messages (formatted phone numbers and proper-name token sequences). SSN patterns and JSON field fragments are a much lower-probability path. The over-redact design philosophy already accepts false positives for safety, so the current implementation is conservative-by-design rather than incomplete-by-accident.

**When to fix:**
If a post-incident log review reveals SSN or JSON-field fragments reaching the client log sink, add the missing patterns:
- SSN: `/\b\d{3}-\d{2}-\d{4}\b/g` → `[REDACTED_SSN]`
- JSON name fragments: `/"\w+Name"\s*:\s*"[^"]+"/g` → `"[REDACTED_FIELD]": "[REDACTED]"`

Consider adding a dedicated unit test for `scrubErrorMessage` at the same time (see TD-096).

---

### TD-096 — `scrubErrorMessage` has no dedicated unit test

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Portal / Test Coverage                      |
| Severity      | Low                                                   |
| Identified    | May 15, 2026 - Task 9.1 Error Boundaries & Loading States |
| Identified by | Implementer                                           |

**Description:**
`scrubErrorMessage` is a module-private function in `portal-layout.tsx`. Its behavior is verified only indirectly by the `portal-layout-error-boundary.test.tsx` integration test, which checks that `clientLogger.error` is called and that the logged value is a string — but does not assert the specific redaction patterns. A dedicated unit test of the redaction logic would catch regressions if the regex patterns are modified.

**Why deferred:**
The function is module-private and cannot be imported directly. Testing it in isolation would require either exporting it (changing the public surface of the module) or extracting it into a separate utility file. Both are small refactors but out of scope for Task 9.1.

**When to fix:**
Extract `scrubErrorMessage` into `src/lib/scrubErrorMessage.ts` (or co-locate it with `client-logger.ts` as a logging utility), export it, and add a unit test covering phone number redaction, name redaction, and pass-through for clean strings. Pair with TD-095 if SSN patterns are added at the same time.

---

### TD-097 — `portal-layout.tsx` split planning needed before next feature addition

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Portal / Component Structure                |
| Severity      | Warning                                               |
| Identified    | May 15, 2026 - Task 9.1 Error Boundaries & Loading States |
| Identified by | Documentation Writer                                  |

**Description:**
After Task 9.1, `portal-layout.tsx` is at 988 lines — 65% over the 600-line hard stop and approaching 1000 lines. Each feature task has added a small, authorized increment. The cumulative result is a file that is approaching the point where further authorized additions become difficult to review safely. TD-090 already tracks this; this entry is a forward-looking flag: the next feature task that needs to add logic to `portal-layout.tsx` should be preceded by the hook-extraction split described in TD-090 before the feature work begins, not after.

**Why deferred:**
File splitting was out of scope for Task 9.1.

**When to fix:**
Before the next feature task that would add more than ~20 lines to `portal-layout.tsx`. The split plan in TD-090 (extract navigation/visibility logic into `useDynamicStepNavigation`) is the recommended starting point.

---

### TD-098 — Employment gap entry legend needs validation-result plumbing

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Application — `EmploymentSection`           |
| Severity      | Warning (Accessibility)                               |
| Identified    | May 16, 2026 - Task 9.2 Accessibility Audit           |
| Identified by | Documentation Writer                                  |

**Description:**
The translation key `candidate.a11y.employmentGapPeriod` is present in all five locale files and the fieldset/legend infrastructure for employment entries is in place, but gap entries still render with the generic employment entry legend. The dedicated "Employment gap — June 2024 to September 2024" legend cannot be assembled because the gap-detection result (start date, end date, gap index) is not threaded into the props consumed by `EmploymentSection` / `RepeatableEntryManager`.

**Why deferred:**
Adding a separate rendering path for gap entries and extending the entry-manager prop shape was a larger refactor than the Task 9.2 scope allowed. The other employment accessibility improvements (fieldset/legend on real entries, aria-labels, focus management) were delivered without it.

**When to fix:**
Next accessibility pass on `EmploymentSection`, or whenever `RepeatableEntryManager` is next refactored. Approach: extend the entry payload to carry an optional gap descriptor (start/end dates), branch the legend rendering, and pass the formatted date range to the translation key's interpolation parameters.

---

### TD-099 — Education scope validation announcement needs plumbing

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Application — `EducationSection`            |
| Severity      | Warning (Accessibility)                               |
| Identified    | May 16, 2026 - Task 9.2 Accessibility Audit           |
| Identified by | Documentation Writer                                  |

**Description:**
The translation key `candidate.a11y.educationScopeNeeded` exists in all five locale files but is never announced. `EducationSection` does not receive the scope-validation result (which education entries fail the configured scope requirement) in a form that can be passed to `useLiveAnnouncer`. Screen reader users are therefore not told when an additional education entry is required to satisfy the scope.

**Why deferred:**
Threading the scope-validation result into `EducationSection` requires changes to the props contract and to the validation pipeline upstream. Out of scope for the Task 9.2 accessibility pass, which focused on ARIA structure and focus management.

**When to fix:**
Next accessibility pass on `EducationSection`, or alongside the next change to education scope validation. Approach: surface the scope-validation result (e.g. `{ satisfied: boolean, gapDescription?: string }`) through `EducationSection`'s props and call `useLiveAnnouncer` with the `candidate.a11y.educationScopeNeeded` key when the requirement is unsatisfied.

---

### TD-100 — E2e seed data for `test-a11y-*` candidate tokens not created

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | E2e test infrastructure                               |
| Severity      | Warning                                               |
| Identified    | May 16, 2026 - Task 9.2 Accessibility Audit           |
| Identified by | Documentation Writer                                  |

**Description:**
`e2e/tests/candidate-invite-9.2-accessibility.spec.ts` was added in Task 9.2 and references candidate-invite tokens with `test-a11y-*` prefixes. These tokens do not exist in the e2e seed dataset, so the spec cannot run end-to-end against a real database. The test file is committed but cannot be added to CI until the seed fixtures are created.

**Why deferred:**
Seed-data work was out of scope for Task 9.2's component-level accessibility implementation.

**When to fix:**
Before the accessibility e2e suite is enabled in CI. Add `test-a11y-*` candidate-invite records to the e2e seed script covering each scenario the spec exercises (multi-step flow, mobile drawer, validation gating, review/submit).

---

### TD-101 — `candidate.a11y.*` translation keys not localized in es-ES, es, ja-JP

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Application — Internationalization          |
| Severity      | Warning                                               |
| Identified    | May 16, 2026 - Task 9.2 Accessibility Audit           |
| Identified by | Documentation Writer                                  |

**Description:**
Task 9.2 added 35 new `candidate.a11y.*` keys to all five locale files. The keys in `src/translations/es-ES.json`, `src/translations/es.json`, and `src/translations/ja-JP.json` were populated with the English-language source strings as placeholders. Screen reader users running the portal in Spanish (either variant) or Japanese will hear English text for skip links, ARIA labels, live-region announcements, status text, and validation messages.

**Why deferred:**
Translation work is handled outside the engineering pipeline. The keys were committed in English to keep the structure consistent across all locale files and to give translators a complete set of source strings to work from.

**When to fix:**
Before the candidate portal is offered to Spanish- or Japanese-speaking candidates in production. Translate the 35 `candidate.a11y.*` keys in `es-ES.json`, `es.json`, and `ja-JP.json` via the standard localization process.

---

### TD-102 — Multiple candidate-form component files exceed 600-line hard stop after Task 9.2

| Field         | Detail                                                |
|---------------|-------------------------------------------------------|
| Area          | Candidate Application — Component Structure           |
| Severity      | Warning                                               |
| Identified    | May 16, 2026 - Task 9.2 Accessibility Audit           |
| Identified by | Documentation Writer                                  |

**Description:**
Task 9.2 added fieldset/legend grouping, ARIA attributes, focus management, and live-region wiring to several form-engine components. The accessibility additions pushed multiple files past the 600-line hard stop:

- `src/components/candidate/portal-layout.tsx` — ~1,146 lines (already tracked in TD-090 and TD-097)
- `src/components/candidate/form-engine/EmploymentSection.tsx` — ~648 lines
- `src/components/candidate/form-engine/EducationSection.tsx` — ~619 lines
- `src/components/candidate/form-engine/AddressBlockInput.tsx` — ~596 lines (at the threshold)
- `src/components/candidate/form-engine/AddressHistorySection.tsx` — ~532 lines (under threshold but growing)

**Why deferred:**
Splitting these files was out of scope for Task 9.2's accessibility implementation. The TD-090 / TD-097 plan for `portal-layout.tsx` already exists; the form-engine section files do not yet have a split plan.

**When to fix:**
Before the next feature task that would add meaningful logic to any of the listed files. Recommended approach for the form-engine sections: extract the repeatable-entry rendering and the per-entry field rendering into separate components, and lift gap-detection / scope-validation logic into hooks. `portal-layout.tsx` should follow the TD-090 plan (extract `useDynamicStepNavigation`).

---
## Resolved Items

---

### TD-059 — Sidebar status not reactively recomputed for unmounted sections

| Field         | Detail                                                             |
|---------------|--------------------------------------------------------------------|
| Area          | Candidate Application — Portal layout / cross-section requirements |
| Severity      | Warning (UX)                                                       |
| Identified    | May 5, 2026 - Phase 6 Stage 4 smoke testing                        |
| Identified by | Andy (smoke test)                                                  |
| Resolved      | May 5, 2026                                                        |
| Branch        | `fix/td059-td060-personal-info-required-fields-and-sidebar-reactivity` |
| Commits       | `4a085ce`, `1ddc6bd`, `230b14c`, `19239de`                         |

**How it was resolved:**
Personal Info's progress derivation was lifted from `PersonalInfoSection` into `portal-layout.tsx` (the portal shell). The shell now fetches `/personal-info-fields` once on mount and extracts Personal Info saved values from its existing `/saved-data` fetch. A new `useEffect` in the shell calls `computePersonalInfoStatus` whenever `personalInfoFields`, `personalInfoSavedValues`, or `subjectCrossSectionRequirements` change and writes the result to `sectionStatuses` via `handleSectionProgressUpdate`. This effect runs regardless of which tab is active, so the sidebar indicator updates immediately when the cross-section registry changes even when `PersonalInfoSection` is unmounted.

`PersonalInfoSection` retains its own local progress effect for live typing feedback, and pushes freshly saved values back up to the shell via the new `onSavedValuesChange` prop after each successful auto-save so the shell's effect always operates on current values.

The unmount cleanup in `useRepeatableSectionStage4Wiring` that had been calling `onCrossSectionRequirementsRemovedForSource` on tab navigation was reverted (commit `1ddc6bd`) because it was clearing the registry on unmount, which prevented the lifted shell effect from seeing the contributions that should have triggered the Personal Info update.

**Files changed:**
- `src/components/candidate/portal-layout.tsx`
- `src/components/candidate/form-engine/PersonalInfoSection.tsx`
- `src/lib/candidate/useRepeatableSectionStage4Wiring.ts`
- `src/types/candidate-portal.ts` (moved `PersonalInfoField` interface here from `PersonalInfoSection.tsx`)

---

### TD-060 — `personal-info-fields` API ignores candidate context when computing `isRequired`

| Field         | Detail                                                                                      |
|---------------|---------------------------------------------------------------------------------------------|
| Area          | Candidate Application — `/api/candidate/application/[token]/personal-info-fields`          |
| Severity      | Warning (UX / spec mismatch)                                                                |
| Identified    | May 5, 2026 - Phase 6 Stage 4 smoke testing                                                 |
| Identified by | Andy (smoke test) + traced via DevTools console                                             |
| Resolved      | May 5, 2026                                                                                 |
| Branch        | `fix/td059-td060-personal-info-required-fields-and-sidebar-reactivity`                      |
| Commits       | `4a085ce`, `230b14c`, `19239de`                                                             |

**How it was resolved:**
The `personal-info-fields` route now scopes its `isRequired` computation to the candidate's package context. The previous implementation used OR logic across every `dsx_mappings` row for a requirement, making any field globally required if it was required in even a single (service, location) mapping row anywhere in the database.

The replacement logic:
1. Queries `dsx_availability` filtered to the package's service IDs, `isAvailable = true`, and `country.disabled IS NOT TRUE` (handling the nullable `Country.disabled` column correctly).
2. Uses the resulting (serviceId, locationId) pairs as an OR-of-pairs filter on the subsequent `dsx_mappings` query.
3. AND-aggregates `isRequired` across the matching rows per requirement: a field is baseline-required only if every applicable mapping row has `isRequired = true`. Fields with no applicable mapping rows default to `isRequired: false`.

The response shape is unchanged. An audit of the neighboring `saved-data` and `structure` routes confirmed neither contains the same bug pattern; neither was modified.

**Files changed:**
- `src/app/api/candidate/application/[token]/personal-info-fields/route.ts`

---

### TD-070 — Alias-set approach to date field identification in dateExtractors.ts

| Field         | Detail                                                                  |
|---------------|-------------------------------------------------------------------------|
| Area          | Candidate Application — Validation engine date extractors               |
| Severity      | Warning (correctness — locale-fragile field identification)             |
| Identified    | May 7, 2026 - Phase 7 Stage 2 data-flow audit                           |
| Identified by | bug-investigator (`docs/audits/PHASE7_STAGE2_DATAFLOW_AUDIT.md`)        |
| Resolved      | May 7, 2026                                                             |
| Branch        | `feature/phase7-stage2-submission-order-generation`                     |

**How it was resolved:**
Originally logged for the alias-set approach to date field identification. Resolved by replacing alias sets with `dataType`-based field identification in `dateExtractors.ts`.

**Files changed:**
- `src/lib/candidate/validation/dateExtractors.ts`

---

### TD-071 — Submission edu/emp data-key mismatch (silent dropping of education and employment OrderItems)

| Field         | Detail                                                                  |
|---------------|-------------------------------------------------------------------------|
| Area          | Candidate Application — Submission orchestrator                         |
| Severity      | Blocker (Correctness — no edu/emp OrderItems generated at submission)   |
| Identified    | May 7, 2026 - Phase 7 Stage 2 data-flow audit                           |
| Identified by | bug-investigator (`docs/audits/PHASE7_STAGE2_DATAFLOW_AUDIT.md` BL-01, BL-02) |
| Resolved      | May 7, 2026                                                             |
| Branch        | `feature/phase7-stage2-submission-order-generation`                     |

**How it was resolved:**
`submitApplication.ts` read `formData.sections` using the sidebar / `result.sectionId` keys (`'service_verification-edu'` and `'service_verification-emp'`) instead of the save endpoint's data keys (`'education'` and `'employment'`). Because `formData.sections['service_verification-edu' | '-emp']` does not exist, `readEduEmpSection` returned `entries: []` and `buildEduEmpOrderItemKeys` produced zero OrderItems. The failure was silent — validation passed, submission succeeded, the order was created with no education or employment items.

The validation engine had the same bug fixed at the data-key level in commit `3aaf0d2` (TD-062 fix); the submission service was missed in that pass and was caught by the comprehensive Phase 7 Stage 2 data-flow audit (`docs/audits/PHASE7_STAGE2_DATAFLOW_AUDIT.md`).

Two string-literal fixes in `submitApplication.ts:291–292`:
- Line 291: `'service_verification-edu'` → `'education'`
- Line 292: `'service_verification-emp'` → `'employment'`

The validation engine's `result.sectionId` values (`'service_verification-edu'` and `'service_verification-emp'` in `validationEngine.ts:230, 249`) are intentionally unchanged — those are sidebar / structure section IDs used by `portal-layout.tsx`, the `sectionVisits` map, the Review error nav, and `SectionErrorBanner`. They live in a different directory and are not data keys.

**Verification:**
- `grep -rn "service_verification" src/lib/candidate/submission/` returns zero hits after the fix.
- 72/72 Pass 1 tests in `src/lib/candidate/submission/__tests__/` pass (`buildOrderSubject.test.ts` 12, `orderDataPopulation.test.ts` 19, `orderItemGeneration.test.ts` 41).
- A browser smoke test of the submission flow with edu and emp entries is queued.

**Files changed:**
- `src/lib/candidate/submission/submitApplication.ts` (two string literals on lines 291–292)

**Follow-ups:**
- A Pass 2 regression test must fixture both edu and emp entries with `countryId`s, run `submitApplication` end-to-end, and assert `OrderItem` rows are created with the matching `serviceId` and `locationId`. Labelled `// REGRESSION TEST: proves bug fix for submission edu/emp data-key mismatch (TD-071)`.

---