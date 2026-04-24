# Feature Specification: Candidate Invitation Foundation (Phase 3)

**Spec file:** `docs/specs/candidate-invitation-foundation.md`
**Date:** April 23, 2026
**Requested by:** Andy
**Status:** Confirmed

---

## Summary

Build the core invitation system APIs for the candidate invite feature. This phase creates the backend logic for generating, looking up, extending, and resending candidate invitations. When a customer creates an invitation, the system generates a unique token-based link, creates a draft order, and logs the event. No UI is built in this phase — APIs only.

This is Phase 3 of 8 in the Candidate Invite feature. Phase 1 (database infrastructure) and Phase 2 (workflow configuration) are complete. The `candidate_invitations` database table already exists from a proactive migration in Phase 2.

---

## Who Uses This

- **Customer users** — create invitations for candidates, extend expiration, resend invitations. This is the primary audience. In the future (Phase 4), they will do this through a UI. For now, the APIs exist for testing and integration.
- **Internal admin users** — can also call these APIs for testing purposes during development. This is not a long-term requirement.
- **The system itself** — logs events automatically when invitation actions occur.

---

## Business Rules

1. Each invitation is tied to exactly one order, and each order has exactly one candidate (one-to-one).
2. When an invitation is created, a new order is created in `draft` status at the same time, in one operation. The invitation cannot exist without an order.
3. The invitation token is a cryptographically secure random string — not the order ID, not guessable, not sequential.
4. Token generation must check for collisions. If the generated token already exists in the database, generate a new one. Retry up to 3 times before returning an error.
5. The package specified in the invitation request must exist, belong to the requesting customer, and have an active workflow assigned to it. If any of these conditions are not met, the API rejects the request with a clear error message.
6. The invitation expiration date is calculated from the workflow's `expirationDays` setting (e.g., if the workflow says 14 days, the invitation expires 14 days from creation).
7. Invitation statuses are: `sent`, `opened`, `in_progress`, `completed`, `expired`. All lowercase.
8. The initial status when an invitation is created is `sent`.
9. An invitation is considered expired when the current time is past `expiresAt`, regardless of what the `status` column says. The API must check the actual date, not just the stored status.
10. When looking up an invitation by token, if the invitation has expired but the status hasn't been updated yet, the API should update the status to `expired` and return the expired state.
11. Resending an invitation sends the email again with the same token. The token does not change.
12. Resending is only allowed when the invitation status is `sent` or `opened` (not expired, not completed, not in_progress).
13. Extending an invitation pushes the expiration date forward from the current date. The customer can optionally specify how many days to extend (1 to 15). If not specified, the system defaults to the workflow's `expirationDays` setting (capped at 15). The new expiration is calculated from today, not from the old expiration date.
14. If an expired invitation is extended, the status reverts to whatever it was before it became expired. To support this, the system must store the previous status before marking an invitation as expired.
15. There is no maximum limit on how many times an invitation can be extended. Each extension is capped at 15 days.
16. Every invitation action (created, resent, extended, expired, opened) is logged as an event in the `order_status_history` table at the order level.
17. Candidate email addresses are normalized to lowercase before being stored.
18. The candidate's phone number is stored as two separate fields: `phoneCountryCode` and `phoneNumber`.

---

## User Flow

**Creating an invitation (API call):**
The customer user sends a request with the package ID and the candidate's contact information (first name, last name, email, and optionally phone). The system validates that the package exists, belongs to the customer, and has an active workflow. It generates a unique token, calculates the expiration date from the workflow settings, creates a draft order, creates the invitation record, logs a "Candidate invitation created" event on the order, and returns the invitation details including the token.

**Looking up an invitation (API call):**
A request comes in with a token in the URL. The system finds the invitation by token. If the invitation has passed its expiration date, the system updates the status to `expired` (saving the previous status first) and returns the expired state. If not expired, it returns the invitation details. No sensitive data (like password hash) is included in the response.

**Extending an invitation (API call):**
The customer user sends a request with the invitation ID and optionally how many days to extend (1 to 15). If they don't specify, the system uses the workflow's default expiration period (capped at 15 days). The system recalculates the expiration date from today. If the invitation was expired, the status reverts to the previous status. The system logs an "Invitation extended" event on the order.

**Resending an invitation (API call):**
The customer user sends a request with the invitation ID. The system verifies the invitation is in `sent` or `opened` status (not expired, completed, or in_progress). The same token and link are used — nothing changes except the email is queued to be sent again. The system logs an "Invitation resent" event on the order.

---

## Data Requirements

### CandidateInvitation table (already exists — needs migration for status changes)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| ID | id | text (UUID) | Required | UUID format | Auto-generated |
| Order | orderId | text (UUID) | Required | Must reference existing order | — |
| Customer | customerId | text (UUID) | Required | Must reference existing customer | — |
| Token | token | text | Required | Unique, cryptographically random | Auto-generated |
| First Name | firstName | text | Required | Max 100 characters | — |
| Last Name | lastName | text | Required | Max 100 characters | — |
| Email | email | text | Required | Valid email, normalized to lowercase | — |
| Phone Country Code | phoneCountryCode | text | Optional | Max 5 characters (e.g., "+1", "+44") | — |
| Phone Number | phoneNumber | text | Optional | Max 20 characters | — |
| Password Hash | passwordHash | text | Optional | — | null (set in Phase 5) |
| Status | status | text | Required | One of: sent, opened, in_progress, completed, expired | sent |
| Previous Status | previousStatus | text | Optional | Stores the status before expiration, for restoration on extend | null |
| Expires At | expiresAt | timestamp | Required | Must be in the future at creation time | — |
| Created At | createdAt | timestamp | Required | — | Current timestamp |
| Created By | createdBy | text (UUID) | Required | Must reference existing user | — |
| Completed At | completedAt | timestamp | Optional | — | null |
| Last Accessed At | lastAccessedAt | timestamp | Optional | — | null |
| Updated At | updatedAt | timestamp | Required | — | Current timestamp |

### OrderStatusHistory table (already exists — needs new columns)

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Event Type | eventType | text | Required | One of: status_change, invitation_created, invitation_resent, invitation_extended, invitation_expired, invitation_opened, comment | status_change |
| Message | message | text | Optional | Human-readable description of the event | null |

All existing columns remain unchanged. The new columns are added alongside the existing `fromStatus`, `toStatus`, `notes`, `reason`, `changedBy`, `isAutomatic`, etc. For invitation events, `fromStatus` and `toStatus` will be null (since they aren't order status changes), and the event details go in `eventType` and `message`.

### Invitation Status Constants

A new constants file must be created following the existing pattern (like `service-status.ts`):

| Constant Key | Value | Description |
|---|---|---|
| SENT | sent | Invitation created and email sent |
| OPENED | opened | Candidate clicked the link (set in Phase 5) |
| IN_PROGRESS | in_progress | Candidate has started filling in information (set in Phase 6) |
| COMPLETED | completed | Candidate submitted the application (set in Phase 7) |
| EXPIRED | expired | Invitation passed its expiration date |

### Event Type Constants

A new constants file for order event types:

| Constant Key | Value | Description |
|---|---|---|
| STATUS_CHANGE | status_change | An order status change (existing behavior) |
| INVITATION_CREATED | invitation_created | Candidate invitation was created |
| INVITATION_RESENT | invitation_resent | Invitation email was resent |
| INVITATION_EXTENDED | invitation_extended | Invitation expiration was extended |
| INVITATION_EXPIRED | invitation_expired | Invitation reached its expiration date |
| INVITATION_OPENED | invitation_opened | Candidate clicked the invitation link (Phase 5) |
| COMMENT | comment | A manual comment (future use) |

---

## API Endpoints

### POST /api/candidate/invitations — Create Invitation

**Who can call it:** Customer users (creating for their own customer), internal admin users (for testing).

**Request body:**
- `packageId` (required) — the package to use for this invitation
- `firstName` (required) — candidate's first name
- `lastName` (required) — candidate's last name
- `email` (required) — candidate's email address
- `phoneCountryCode` (optional) — e.g., "+1"
- `phoneNumber` (optional) — candidate's phone number

**What it does:**
1. Validates the user is authenticated
2. Validates input with Zod
3. Looks up the package, confirms it belongs to the user's customer, confirms it has an active workflow
4. Generates a unique token (with collision retry)
5. Calculates expiration from the workflow's `expirationDays`
6. Creates the order (draft status) and the invitation in one database transaction
7. Logs an "Invitation created" event on the order
8. Returns the invitation details (status 201)

**Error responses:**
- 401 — not authenticated
- 400 — invalid input (missing fields, bad email format)
- 404 — package not found
- 403 — package doesn't belong to this customer
- 422 — package has no active workflow assigned
- 500 — token generation failed after retries, or database error

### GET /api/candidate/invitations/\[token\] — Look Up Invitation

**Who can call it:** No authentication required (this is the endpoint the candidate's link will hit in future phases). For Phase 3, it returns the invitation data. Phase 5 will add the candidate authentication layer on top.

**What it does:**
1. Finds the invitation by token
2. Checks if the invitation is past its expiration date
3. If expired and status isn't already `expired`, updates the status (saving previous status first) and logs an expiration event
4. Returns invitation details (excluding sensitive fields like passwordHash)

**Response includes:** invitation ID, status, candidate name, email, expiresAt, order ID, customer ID. Does NOT include the token itself, password hash, or internal IDs that aren't needed.

**Error responses:**
- 404 — no invitation found for this token

### POST /api/candidate/invitations/\[id\]/extend — Extend Expiration

**Who can call it:** Customer users (for their own customer's invitations), internal admin users.

**Request body:**
- `days` (optional) — number of days to extend (1 to 15). If not provided, defaults to the workflow's `expirationDays` (capped at 15).

**What it does:**
1. Validates the user is authenticated
2. Validates input with Zod (if `days` is provided, must be integer between 1 and 15)
3. Finds the invitation by ID, confirms it belongs to the user's customer
4. Determines extension duration: use `days` from request if provided, otherwise look up the workflow's `expirationDays` (capped at 15)
5. Sets new `expiresAt` to today + extension duration
6. If the invitation was expired, restores the previous status from `previousStatus`
7. Logs an "Invitation extended by X days" event on the order
8. Returns the updated invitation

**Error responses:**
- 401 — not authenticated
- 400 — invalid input (days not between 1 and 15)
- 404 — invitation not found
- 403 — invitation doesn't belong to this customer
- 422 — invitation is completed (cannot extend a completed invitation)

### POST /api/candidate/invitations/\[id\]/resend — Resend Invitation

**Who can call it:** Customer users (for their own customer's invitations), internal admin users.

**What it does:**
1. Validates the user is authenticated
2. Finds the invitation by ID, confirms it belongs to the user's customer
3. Validates the invitation is in `sent` or `opened` status
4. Logs an "Invitation resent" event on the order
5. Returns confirmation (actual email sending is a future concern — for Phase 3, the event is logged but no email is actually sent)

**Error responses:**
- 401 — not authenticated
- 404 — invitation not found
- 403 — invitation doesn't belong to this customer
- 422 — invitation is in a status that doesn't allow resending (expired, in_progress, completed)

---

## Edge Cases and Error Scenarios

- **What if the package has no workflow?** The create API returns 422 with message: "This package does not have a workflow assigned. A workflow with email template and expiration settings is required to create an invitation."
- **What if the workflow is not active?** The create API returns 422 with message: "The workflow assigned to this package is not active."
- **What if the workflow has no expirationDays set?** Use a system default of 14 days. Log a warning.
- **What if the token already exists in the database?** Generate a new one. Retry up to 3 times. If all 3 collide (extremely unlikely), return 500.
- **What if someone tries to extend a completed invitation?** Return 422 — completed invitations cannot be extended.
- **What if someone tries to extend with more than 15 days?** Return 400 — extension days must be between 1 and 15.
- **What if the workflow's expirationDays is greater than 15?** Cap it at 15 when used as the default for extensions. The workflow setting still applies normally at invitation creation time (no cap there).
- **What if someone tries to resend an expired invitation?** Return 422 — the customer should extend first, then resend.
- **What if the customer user doesn't have permission?** Use the existing customer permission check pattern. The specific permission key will be determined by the architect based on existing patterns.
- **What if the same candidate email already has an active (non-expired, non-completed) invitation for the same customer?** For Phase 3, allow it. Duplicate prevention can be added as a future enhancement if needed.
- **What if the candidate's name contains special characters or non-Latin scripts?** Allow it — no character restrictions beyond max length.
- **What if the request has a phone country code but no phone number (or vice versa)?** If phone number is provided, country code is required. If neither is provided, both are null.

---

## Impact on Other Modules

- **Orders module** — a new order is created in `draft` status when an invitation is created. This order will appear in the fulfillment dashboard. The order's `subject` field (which stores candidate info as JSON) should be populated with the candidate's name.
- **OrderStatusHistory table** — two new columns added (`eventType`, `message`). Existing order status change code should continue to work because the new columns have defaults. The existing code that writes to this table does not need to change in this phase, but should be updated to include `eventType: 'status_change'` for consistency.
- **No UI impact** — this phase is APIs only.

---

## Definition of Done

1. A new invitation can be created via POST to `/api/candidate/invitations` with valid package, candidate info, and authentication.
2. Creating an invitation generates a cryptographically secure random token that is unique in the database.
3. Creating an invitation creates a draft order in the same database transaction.
4. The invitation expiration is correctly calculated from the workflow's `expirationDays`.
5. The create API rejects requests where the package has no active workflow (422 response).
6. The create API rejects requests where the package doesn't belong to the authenticated customer (403 response).
7. An invitation can be looked up by token via GET to `/api/candidate/invitations/[token]`.
8. The lookup API correctly detects and handles expired invitations (updates status, saves previous status).
9. The lookup API does not return sensitive fields (passwordHash, internal IDs).
10. An invitation's expiration can be extended via POST to `/api/candidate/invitations/[id]/extend` with an optional `days` parameter (1-15).
11. Extending an expired invitation restores the previous status.
12. Extension days default to the workflow's `expirationDays` when not specified, capped at 15.
13. Extension is rejected if `days` is less than 1 or greater than 15 (400 response).
14. An invitation can be resent via POST to `/api/candidate/invitations/[id]/resend`.
15. Resend is rejected for invitations in expired, in_progress, or completed status (422 response).
16. All invitation actions (create, extend, resend, expire) are logged as events in the `order_status_history` table with the correct `eventType` and a human-readable `message`.
17. Invitation status constants are defined in a constants file, not hardcoded as string literals.
18. Event type constants are defined in a constants file, not hardcoded as string literals.
19. All status values are lowercase in the database.
20. Candidate email is normalized to lowercase before storage.
21. Input validation uses Zod schemas that reference the status constants.
22. The `candidate_invitations` table has a `previousStatus` column added via migration.
23. The `order_status_history` table has `eventType` and `message` columns added via migration.
24. The status column default is changed from `draft` to `sent`.
25. All API routes have JSDoc documentation.
26. Authentication is checked on all routes that require it.
27. Customer-scoping is enforced — customers can only see and manage their own invitations.

---

## Open Questions

None — all questions were resolved in pre-spec discussion:
- Statuses: sent → opened → in_progress → completed, plus expired (resolved)
- Extend from expired restores previous status (resolved)
- Resend uses same token (resolved)
- No max on extensions (resolved)
- Package must have active workflow (resolved)
- Event logging uses expanded OrderStatusHistory table (resolved)
- Phone stored as two fields: country code + number (confirmed from existing migration)