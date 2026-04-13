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

**Description:**
In `DocumentsReviewStep.tsx` lines 188 and 195, there are TODO comments indicating that error messages are not shown to users when document uploads fail. While errors are logged to the console, users receive no visual feedback when a document upload fails.

**Why deferred:**
The core bug fix (document persistence) works correctly. Adding user feedback UI is an enhancement beyond the scope of the bug fix.

**When to fix:**
Add proper error UI components when implementing a broader error handling strategy or during UX improvements pass.

**Recommendation:**
Display a toast notification or inline error message when upload fails.

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

**Description:**
For large files (up to 10MB limit), users have no visual indication that an upload is in progress. The UI doesn't provide feedback during the upload process.

**Why deferred:**
The upload functionality works correctly for typical document sizes. Progress indication is a UX enhancement.

**When to fix:**
Add when implementing a comprehensive loading/progress indicator system across the application.

**Recommendation:**
Add a loading spinner or progress bar during file upload, especially for files over 1MB.

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

## Resolved Items

_(Move items here when fixed, with a note on how they were resolved)_

---
