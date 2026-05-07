# Feature Specification: Phase 7, Stage 2 — Submission & Order Item Generation

**Spec file:** `docs/specs/phase7-stage2-submission-order-generation.md`
**Date:** May 6, 2026
**Requested by:** Andy
**Status:** Draft

## Summary

This stage makes the Submit button on the candidate application work. When a candidate has completed all sections of their application and clicks Submit, the system runs server-side validation, creates all the order items (background check line items) from the candidate's form data, populates the field-level data for each order item, changes the order from "draft" to "submitted," logs the events, and shows the candidate a success page. This is the stage that turns a candidate's filled-in application into an actual submitted background check order.

Stage 1 built the validation engine and the Review & Submit page with a disabled Submit button. Stage 2 enables that button and wires it to the real submission pipeline.

## Who Uses This

- **Candidate** — clicks the Submit button after completing all required sections. Sees a success page after submission. Cannot edit the application after submitting.
- **System (automated)** — runs server-side validation, creates order items and fulfillment records, maps addresses to jurisdictions, populates field data, updates statuses, and logs events.
- **Customer (indirect)** — after submission, the order appears in their fulfillment queue as "submitted" with all order items ready to work.

## Business Rules

1. The Submit button on the Review & Submit page is enabled only when the validation engine reports all sections as "complete" (no errors, no scope shortfalls, no unresolved gaps). If any section has issues, the button stays disabled with the existing message: "Submit will be available once all sections are complete."

2. When the candidate clicks Submit, the client sends a POST request to `/api/candidate/application/[token]/submit`. The server calls `runValidation(invitationId)` — the same standalone validation engine from Stage 1 — before doing anything else. If validation fails, the server returns the errors and the submission is rejected. The candidate stays on the Review page and sees the updated errors.

3. TD-062 fix: Before Stage 2's submit handler can rely on server-side validation, the validation engine must be updated to check required fields for Personal Info and IDV sections. Currently it returns "complete" for these sections without checking required fields, relying on a `mergeSectionStatus` workaround. Stage 2 must teach the engine which fields are required for Personal Info and IDV by reading the DSX field requirements for those service types.

4. All database changes at submission time happen inside a single transaction. If any part fails, everything rolls back — no partial submissions. The transaction includes: creating order items and fulfillment records, creating OrderData records, updating the order status, creating the OrderStatusHistory entry, creating ServiceComment entries, and updating the CandidateInvitation record.

5. **Order item creation — Records (address-driven services):** Record-type order items are scope-aware. Each record-type service in the package has its own scope (e.g., "most recent," "most recent 2," "all in past 7 years," "all"). The system first determines which of the candidate's addresses are in scope for each service, then creates order items only for the in-scope addresses:

   **Step 1 — Filter addresses by service scope:**
   - "Most recent" → only the candidate's most recent address (by start date, or end date if still current)
   - "Most recent 2" → only the 2 most recent addresses
   - "All in past X years" → only addresses whose date range overlaps with the past X years
   - "All" → all addresses the candidate entered

   **Step 2 — For each in-scope address, determine the jurisdiction level** by checking DSX availability:
   - Check if the service has DSX availability at the county level for this address's county → if yes, create an order item at the county level
   - If not at county, check the state level → if yes, create at state level
   - If not at state, check the country level → if yes, create at country level
   - If the service is not available at any level for this address's country, skip it for this address (do not create an order item)

   **Example:** A package has two record-type services: Bankruptcy (scope: "most recent") and Global Criminal (scope: "all in past 7 years"). The candidate entered 3 addresses across 3 countries covering the past 7 years. Global Criminal creates up to 3 order items (one per address, subject to DSX availability). Bankruptcy creates only 1 order item (the most recent address only).

   One address can produce multiple order items (one per record-type service that has it in scope and has DSX availability). One service can produce multiple order items across different in-scope addresses (e.g., criminal search in County A and criminal search in County B).

6. **Order item deduplication for records:** If two addresses fall in the same jurisdiction for the same service (e.g., candidate lived at two addresses in the same county), only one order item is created for that service+jurisdiction combination. The system deduplicates by the combination of `serviceId` + `locationId`.

7. **Order item creation — Verification-edu:** For each education entry the candidate submitted, the system creates one order item per education-type service in the package. The `locationId` on the order item is the country the candidate selected for that education entry.

8. **Order item creation — Verification-emp:** Same pattern as education. For each employment entry, one order item per employment-type service in the package. The `locationId` is the country from that employment entry.

9. **Order item creation — IDV:** The system creates exactly one order item for each IDV-type service in the package. The `locationId` is the country the candidate selected in the IDV section.

10. Every order item must be created using the established transactional pattern: `OrderItem` and its matching `ServicesFulfillment` record are always created together (per DATABASE_STANDARDS.md Section 2.2). Use `OrderCoreService.addOrderItem` or replicate its transactional pattern within the submission transaction.

11. **OrderData population:** After creating each order item, the system copies the candidate's form field values for that entry into OrderData records. Each field becomes one OrderData row:
    - `orderItemId` — the newly created order item
    - `fieldName` — the DSX requirement ID for that field
    - `fieldValue` — the value the candidate entered (as a string; JSON-stringified for address blocks)
    - `fieldType` — the field's data type from the DSX requirement

12. **Personal Info → Order subject:** The candidate's personal information fields (first name, last name, date of birth, etc.) are written to the `Order.subject` JSON field, keyed by fieldKey. This is separate from OrderData and applies to the order as a whole, not to individual order items.

13. **Order status update:** The order's `statusCode` changes from `"draft"` to `"submitted"`. The `submittedAt` timestamp is set to the current time.

14. **OrderStatusHistory entry:** A new row is created in `order_status_history` with:
    - `fromStatus`: `"draft"`
    - `toStatus`: `"submitted"`
    - `changedBy`: the candidate invitation's associated user context (system-generated)
    - `isAutomatic`: `true`
    - `notes`: `"Candidate submitted application"`

15. **ServiceComment entries:** For each newly created order item, a ServiceComment entry is created to log that the order item was created from the candidate's submission. This uses the system comment pattern with:
    - `finalText`: a descriptive message like "Order item created from candidate application submission"
    - `isInternalOnly`: `false` (visible to customer)
    - `isStatusChange`: `false`
    - `createdBy`: system user context

16. **CandidateInvitation update:** After successful submission:
    - `status` changes from `"in_progress"` to `"completed"`
    - `completedAt` is set to the current time

17. **Success page:** After successful submission, the candidate is redirected to a success page that shows:
    - A confirmation message (e.g., "Your application has been submitted successfully")
    - The candidate cannot navigate back to the application form
    - The candidate cannot re-submit
    - No sensitive details are shown on this page (no order number, no summary of what was entered)

18. **Double-submit prevention:** The submit endpoint must be idempotent or guarded. If the candidate's invitation status is already "completed," the endpoint returns a success response without creating duplicate records. The UI also disables the Submit button immediately on click and shows a loading state.

19. **Expired invitation guard:** If the invitation has expired (`expiresAt` is in the past), the submit endpoint rejects the submission with an appropriate error, even if the candidate had the form open before expiration.

20. **Draft-only guard:** The submit endpoint verifies that the order is currently in "draft" status before processing. If the order is already "submitted" or in any other status, the endpoint returns a success response (for idempotency) without creating duplicate records.

21. Translation keys: All user-facing text on the success page and any new error messages must use translation keys. Add keys to all 5 language files (en-US, en-GB, es-ES, es, ja-JP).

22. **Document references at submission:** Documents the candidate uploaded (stored in `uploads/draft-documents/` and tracked in formData) are referenced in OrderData the same way as other fields. The document metadata JSON (containing filename, storagePath, etc.) becomes the `fieldValue` in OrderData for document-type fields. No file copying or moving is needed at submission time.

23. **formData lifecycle after submission:** `CandidateInvitation.formData` is retained as-is after submission. It is not cleared, archived, or modified. The submitted form data serves as an audit record of exactly what the candidate entered.

## User Flow

The candidate has been filling out their application across multiple sessions. They've entered their personal info, identity verification details, address history, education, employment, acknowledged workflow sections, and uploaded any required documents.

The candidate navigates to the Review & Submit page. Stage 1 already shows them a list of any remaining issues. Once all issues are resolved (all sections show green/complete), the Submit button becomes enabled.

The candidate taps Submit. The button immediately shows a loading state (spinner or "Submitting..." text) and becomes disabled to prevent double-clicks. The system sends the submission request to the server.

On the server, the validation engine runs one final check. If it finds any problems (maybe data changed between the last client-side check and now), the server rejects the submission and sends back the errors. The candidate sees those errors on the Review page and can fix them.

If validation passes, the server creates all the order items in one transaction. For each address the candidate entered, it checks which record-type services can be searched at that location and at what jurisdiction level, then creates the order items accordingly. For education and employment entries, it creates order items tied to the country of each entry. For IDV, it creates one order item. All the candidate's field data gets copied into the proper database tables. The order flips to "submitted" and the events get logged.

The server responds with success. The candidate's browser navigates to a simple success page: "Your application has been submitted successfully." There's nothing else to do — no links back to the form, no ability to edit. The application is done.

## Data Requirements

### New API Endpoint: POST /api/candidate/application/[token]/submit

**Request:** No body required (the token identifies the invitation and all data is already saved server-side).

**Success Response (200):**

| Field Name | Type | Description |
|---|---|---|
| success | boolean | Always `true` on success |
| message | text | "Application submitted successfully" |
| redirectTo | text | URL path for the success page |

**Validation Failure Response (400):**

| Field Name | Type | Description |
|---|---|---|
| success | boolean | Always `false` |
| error | text | "Validation failed" |
| validationResult | object | The full `FullValidationResult` from `runValidation()` |

**Already Submitted Response (200):**

| Field Name | Type | Description |
|---|---|---|
| success | boolean | `true` (idempotent — treat as success) |
| message | text | "Application has already been submitted" |
| redirectTo | text | URL path for the success page |

**Expired Response (403):**

| Field Name | Type | Description |
|---|---|---|
| success | boolean | `false` |
| error | text | "This invitation has expired" |

### Records Created Per Order Item

| Table | Field Name | Type | Source |
|---|---|---|---|
| OrderItem | id | uuid | Auto-generated |
| OrderItem | orderId | uuid | From the invitation's linked order |
| OrderItem | serviceId | uuid | The service from the package |
| OrderItem | locationId | uuid | Determined by jurisdiction mapping (records) or entry country (edu/emp/IDV) |
| OrderItem | status | text | `"submitted"` |
| OrderItem | createdAt | datetime | Current timestamp |
| ServicesFulfillment | id | uuid | Auto-generated |
| ServicesFulfillment | orderId | uuid | Same as OrderItem.orderId |
| ServicesFulfillment | orderItemId | uuid | The newly created OrderItem.id |
| ServicesFulfillment | serviceId | uuid | Same as OrderItem.serviceId |
| ServicesFulfillment | locationId | uuid | Same as OrderItem.locationId |
| ServicesFulfillment | assignedVendorId | uuid | `null` (assigned later) |
| OrderData | id | uuid | Auto-generated |
| OrderData | orderItemId | uuid | The newly created OrderItem.id |
| OrderData | fieldName | uuid | DSX requirement ID for this field |
| OrderData | fieldValue | text | Candidate's entered value (string or JSON-stringified) |
| OrderData | fieldType | text | Data type from DSX requirement |

### Updated Records at Submission

| Table | Field Name | New Value |
|---|---|---|
| Order | statusCode | `"submitted"` |
| Order | submittedAt | Current timestamp |
| Order | subject | JSON with personal info fields keyed by fieldKey |
| CandidateInvitation | status | `"completed"` |
| CandidateInvitation | completedAt | Current timestamp |

### OrderStatusHistory Record

| Field Name | Type | Value |
|---|---|---|
| id | uuid | Auto-generated |
| orderId | uuid | The invitation's linked order |
| fromStatus | text | `"draft"` |
| toStatus | text | `"submitted"` |
| changedBy | text | System identifier |
| isAutomatic | boolean | `true` |
| notes | text | `"Candidate submitted application"` |

### ServiceComment Record (one per order item)

| Field Name | Type | Value |
|---|---|---|
| id | uuid | Auto-generated |
| orderItemId | uuid | The newly created order item |
| templateId | text | System comment template ID |
| finalText | text | "Order item created from candidate application submission" |
| isInternalOnly | boolean | `false` |
| isStatusChange | boolean | `false` |
| createdBy | text | System identifier |

### Success Page Translation Keys

| Key | en-US Value |
|---|---|
| candidate.submission.success.title | Application Submitted |
| candidate.submission.success.message | Your application has been submitted successfully. Thank you for completing your background check application. |
| candidate.submission.success.whatNext | What happens next? |
| candidate.submission.success.nextSteps | Your information will be reviewed and processed. You do not need to take any further action. |
| candidate.submission.submitting | Submitting your application... |
| candidate.submission.error.expired | This invitation has expired. Please contact the company that sent you this link. |
| candidate.submission.error.alreadySubmitted | This application has already been submitted. |
| candidate.submission.error.validationFailed | Your application could not be submitted because some sections are incomplete. Please review and fix the issues listed below. |
| candidate.submission.error.serverError | Something went wrong while submitting your application. Please try again. If the problem continues, contact the company that sent you this link. |

## Edge Cases and Error Scenarios

1. **Candidate clicks Submit but validation fails server-side:** The server returns the validation errors. The UI updates the Review page to show the new errors. The Submit button re-enables so they can try again after fixing issues.

2. **Candidate clicks Submit twice quickly (double-submit):** The UI disables the button on first click. If a second request somehow reaches the server, the draft-only guard (Rule 20) catches it — the order is already "submitted" so the server returns the idempotent success response.

3. **Invitation expired between opening the Review page and clicking Submit:** The server checks `expiresAt` before processing. Returns 403 with the expiration error message.

4. **Transaction fails partway through (e.g., database error creating the 5th order item):** The entire transaction rolls back. No order items are created, no status changes, no history entries. The candidate sees a server error message and can retry.

5. **No DSX availability for a record-type service at any jurisdiction level for a given address:** That service is skipped for that address. No order item is created for that combination. This is not an error — some services simply aren't available in some countries.

6. **Zero order items would be created:** If the jurisdiction mapping produces zero order items for the entire submission (unlikely but possible if DSX availability is misconfigured), the submission still succeeds. The order moves to "submitted" with no order items. This is a configuration problem on the customer/admin side, not the candidate's problem — the candidate did their part by filling out the application. The customer's fulfillment team is responsible for noticing and handling orders with missing services.

7. **Candidate's formData is missing or corrupted:** The server validation catches this — required fields would be missing. The submission is rejected with validation errors.

8. **Candidate navigates to the success page URL directly without submitting:** The success page should check the invitation status. If not "completed," redirect back to the application. If "completed," show the success page (the candidate may have submitted and is refreshing the page).

9. **Network failure during submission:** The candidate sees the server error message (Rule 21 translation key) and the Submit button re-enables for retry. The transaction guarantees nothing was partially committed.

10. **ServiceComment creation requires a templateId:** The system needs a comment template for system-generated comments. If no suitable template exists, the implementer should check whether an existing "system" template can be used, or create a migration to add one. This is an implementation detail for the architect and implementer to resolve.

## Impact on Other Modules

- **Fulfillment module:** After submission, the order and its items appear in the fulfillment queue. The fulfillment team can see all order items, their locations, and the candidate's field data in OrderData. No changes needed to the fulfillment UI — it already reads from OrderItem, ServicesFulfillment, and OrderData.

- **Order status management:** The existing order status change flow (documented in order-status-management.md) is used to update the order to "submitted." The same OrderStatusHistory pattern is followed.

- **Validation engine (Stage 1):** The `runValidation()` function is called server-side by the submit handler. TD-062 is fixed so Personal Info and IDV validation is accurate.

- **Auto-save (Phase 6):** No changes. The auto-save system already stores form data in `CandidateInvitation.formData`. The submit handler reads from this same location.

- **Customer order view:** After submission, customers see the order in their order list with status "submitted." The order items are visible in the order detail view. No changes needed — existing UI already handles submitted orders.

## Tech Debt Addressed in This Stage

### TD-062 — Validation engine returns "complete" for Personal Info/IDV without checking required fields

**What changes:** The validation engine (`validationEngine.ts`) is updated to query DSX field requirements for Personal Info and IDV services and check that all required fields have values in the candidate's saved form data. The `mergeSectionStatus` workaround is no longer needed for these sections (though the function may remain for backward compatibility).

## Tech Debt NOT Addressed in This Stage (Deferred)

The following tech debt items are explicitly out of scope for Phase 7, Stage 2. They will be addressed in later stages or phases:

- **TD-061** — Deferred. Not part of Stage 2's scope.
- **TD-063** — Deferred. Not part of Stage 2's scope.
- **TD-064** — Deferred. Not part of Stage 2's scope.
- **TD-065** — Deferred. Not part of Stage 2's scope.
- **TD-066** — Deferred. Not part of Stage 2's scope.

## Definition of Done

1. The Submit button on the Review & Submit page is enabled when all sections pass validation and disabled when any section has errors.
2. Clicking Submit sends a POST to `/api/candidate/application/[token]/submit`.
3. The submit endpoint calls `runValidation(invitationId)` server-side before any data changes.
4. If server-side validation fails, the submission is rejected and the candidate sees the errors on the Review page.
5. TD-062 is resolved: the validation engine checks required DSX fields for Personal Info and IDV sections rather than relying on the `mergeSectionStatus` workaround.
6. All database changes at submission happen inside a single Prisma transaction.
7. For record-type services, order items are created only for addresses that are in scope for each service (e.g., "most recent" uses only 1 address, "all in past 7 years" uses only addresses within that period), at the correct jurisdiction level by walking the DSX availability hierarchy (county → state → country).
8. Record-type order items are deduplicated by serviceId + locationId (no duplicate order items for the same service at the same jurisdiction).
9. For education-type services, one order item is created per education entry per service, with locationId set to the entry's country.
10. For employment-type services, one order item is created per employment entry per service, with locationId set to the entry's country.
11. For IDV-type services, exactly one order item is created per service, with locationId set to the candidate's selected country.
12. Every OrderItem is created with a matching ServicesFulfillment record in the same transaction (per DATABASE_STANDARDS.md).
13. OrderData records are created for each order item containing the candidate's field values for that entry.
14. The Order.subject JSON field is populated with the candidate's personal information fields.
15. The order's statusCode is updated from "draft" to "submitted" and submittedAt is set.
16. An OrderStatusHistory record is created logging the draft → submitted transition.
17. A ServiceComment record is created for each new order item logging its creation.
18. The CandidateInvitation status is updated from "in_progress" to "completed" and completedAt is set.
19. After successful submission, the candidate is redirected to a success page.
20. The success page shows a confirmation message and does not allow navigation back to the form.
21. The submit endpoint is idempotent — re-submitting when status is already "completed" returns success without creating duplicates.
22. The submit endpoint rejects expired invitations with a 403 response.
23. The submit endpoint rejects submissions where the order is not in "draft" status (idempotent success response).
24. Double-click prevention: the Submit button disables immediately on click and shows a loading state.
25. If the transaction fails, everything rolls back and the candidate sees a retry-able error message.
26. All user-facing text uses translation keys added to all 5 language files.
27. If jurisdiction mapping produces zero total order items, the submission still succeeds — the order moves to "submitted" with no items. This is a configuration issue for the customer to handle, not the candidate.
28. Record-type order items are scope-aware: each record service's scope (most recent, most recent N, all in past X years, all) determines which of the candidate's addresses produce order items for that service.
29. Document references in formData are carried over to OrderData as-is (no file moving needed).
30. All existing tests continue to pass (0 regressions).
31. New tests cover: submit endpoint happy path, validation rejection, expired invitation, already-submitted idempotency, scope-aware jurisdiction mapping for records (county/state/country levels, most-recent vs all-in-timeframe), deduplication, edu/emp/IDV order item creation, OrderData population, transaction rollback on failure, and success page rendering.

## Open Questions

None — all design decisions have been resolved.