# Technical Plan: Candidate Invitation Foundation (Phase 3)

**Based on specification:** `docs/specs/candidate-invitation-foundation.md` (April 23, 2026)
**Date:** April 23, 2026

---

## Database Changes

### 1. Add `previousStatus` column to `candidate_invitations` table

The table already exists. Add one new column:

- `previousStatus` — `VARCHAR`, nullable, default null. Stores the invitation status before it was marked as expired, so it can be restored when an expired invitation is extended.

### 2. Change status default on `candidate_invitations` table

- Change the default value of the `status` column from `'draft'` to `'sent'`.

### 3. Add `eventType` and `message` columns to `order_status_history` table

- `eventType` — `VARCHAR`, NOT NULL, default `'status_change'`. Categorizes the type of event (status_change, invitation_created, invitation_resent, etc.).
- `message` — `TEXT`, nullable, default null. Human-readable description of the event.

The default of `'status_change'` on `eventType` means all existing rows and all existing code that writes to this table will continue working without modification — they'll automatically get tagged as status changes.

### 4. Update `prisma/schema.prisma`

Add the new fields to both models so Prisma knows about them:

**On CandidateInvitation model:**
```
previousStatus  String?   @map("previous_status")
```

**On OrderStatusHistory model:**
```
eventType       String    @default("status_change") @map("event_type")
message         String?
```

### 5. Add relation from Order to CandidateInvitation

The CandidateInvitation model already has `orderId` referencing Order. Ensure the Prisma schema has the relation defined on both sides so it can be included in queries:

**On CandidateInvitation model:**
```
order           Order     @relation(fields: [orderId], references: [id])
```

**On Order model (add if not already present):**
```
candidateInvitation CandidateInvitation?
```

---

## New Files to Create

### Constants

**1. `src/constants/invitation-status.ts`**
- Purpose: Single source of truth for invitation status values
- Contains: `INVITATION_STATUSES` object with keys SENT, OPENED, IN_PROGRESS, COMPLETED, EXPIRED mapping to lowercase strings, plus `INVITATION_STATUS_VALUES` array for Zod enum use
- Follows the exact pattern of the existing `src/constants/service-status.ts`

**2. `src/constants/order-event-type.ts`**
- Purpose: Single source of truth for order event types used in the OrderStatusHistory table
- Contains: `ORDER_EVENT_TYPES` object with keys STATUS_CHANGE, INVITATION_CREATED, INVITATION_RESENT, INVITATION_EXTENDED, INVITATION_EXPIRED, INVITATION_OPENED, COMMENT mapping to lowercase strings, plus `ORDER_EVENT_TYPE_VALUES` array

### Types

**3. `src/types/candidateInvitation.ts`**
- Purpose: TypeScript type definitions for invitation-related data
- Contains:
  - `CreateInvitationInput` — the validated input shape for creating an invitation (packageId, firstName, lastName, email, phoneCountryCode?, phoneNumber?)
  - `ExtendInvitationInput` — the validated input shape for extending (days?)
  - `InvitationResponse` — the shape returned by APIs (excludes passwordHash and token from lookup responses)
  - All types derived from Zod schemas using `z.infer<typeof schema>`

### Validation

**4. `src/lib/validations/candidateInvitation.ts`**
- Purpose: Zod schemas for all invitation API inputs
- Contains:
  - `createInvitationSchema` — validates packageId (required UUID), firstName (required, max 100), lastName (required, max 100), email (required, valid email), phoneCountryCode (optional, max 5), phoneNumber (optional, max 20). Business rule: if phoneNumber is provided, phoneCountryCode is required.
  - `extendInvitationSchema` — validates days (optional, integer, min 1, max 15)
  - Status enums built from the constants file, not hardcoded strings

### Service

**5. `src/lib/services/candidate-invitation.service.ts`**
- Purpose: All business logic for invitations, keeping API routes thin
- Contains these functions:

  **`generateSecureToken()`** — generates a cryptographically secure random string using Node.js `crypto.randomBytes()`. Returns a URL-safe base64 string. Does NOT handle collision checking (that's in `createInvitation`).

  **`createInvitation(input, customerId, userId)`** — the main creation function:
  1. Looks up the package, verifies it belongs to the customer
  2. Verifies the package has an active workflow
  3. Gets the workflow's `expirationDays` (defaults to 14 if not set)
  4. Generates a token, checks for collision (retry up to 3 times)
  5. In a single `prisma.$transaction()`:
     - Creates the order in `draft` status with the candidate name in the `subject` JSON field, using the order number format `YYYYMMDD-CODE-NNNN`
     - Creates the CandidateInvitation record with status `sent`
     - Creates an OrderStatusHistory event with eventType `invitation_created`
  6. Returns the created invitation

  **`lookupByToken(token)`** — finds invitation by token, checks expiration, updates status if expired (saving previous status), logs expiration event if status changed. Returns invitation data without sensitive fields.

  **`extendInvitation(invitationId, customerId, userId, days?)`** — verifies ownership, determines extension days (from request or workflow default, capped at 15), calculates new expiration, restores previous status if expired, logs event.

  **`resendInvitation(invitationId, customerId, userId)`** — verifies ownership, verifies status is `sent` or `opened`, logs resend event. Does not actually send email (that's a future phase concern).

  **`logOrderEvent(orderId, eventType, message, userId, isAutomatic)`** — helper that creates an OrderStatusHistory record with the new `eventType` and `message` fields. Sets `fromStatus` and `toStatus` to null for non-status-change events.

  **Important:** This service does NOT create OrderItems (no order items exist until the candidate submits in Phase 7). The order is created with no items — just a draft shell.

### API Routes

**6. `src/app/api/candidate/invitations/route.ts`**
- Purpose: POST — create a new invitation
- Authentication: required (first check)
- User types allowed: customer users, internal admin users
- Permission: uses existing customer permission pattern from auth-utils.ts (the architect recommends `customer_config` based on the existing pattern for customer-scoped actions — verify against current auth-utils.ts during implementation)
- For customer users: validates the package belongs to their customer (via `session.user.customerId`)
- For internal/admin users: requires `customerId` in the request body (since they aren't tied to a specific customer)
- Calls `candidateInvitationService.createInvitation()`
- Returns 201 with invitation data on success
- JSDoc block required

**7. `src/app/api/candidate/invitations/\[token\]/route.ts`**
- Purpose: GET — look up invitation by token
- Authentication: NOT required (this endpoint will be hit by candidates clicking their link)
- Calls `candidateInvitationService.lookupByToken()`
- Returns 200 with invitation data (no sensitive fields)
- Returns 404 if token not found
- JSDoc block required

**8. `src/app/api/candidate/invitations/\[id\]/extend/route.ts`**
- Purpose: POST — extend invitation expiration
- Authentication: required
- User types allowed: customer users, internal admin users
- Customer scoping: invitation must belong to the customer
- Validates input with `extendInvitationSchema`
- Calls `candidateInvitationService.extendInvitation()`
- Returns 200 with updated invitation
- JSDoc block required

**9. `src/app/api/candidate/invitations/\[id\]/resend/route.ts`**
- Purpose: POST — resend invitation email
- Authentication: required
- User types allowed: customer users, internal admin users
- Customer scoping: invitation must belong to the customer
- Calls `candidateInvitationService.resendInvitation()`
- Returns 200 with confirmation
- JSDoc block required

---

## Existing Files to Modify

### 1. `prisma/schema.prisma`

**What currently exists:** CandidateInvitation model and OrderStatusHistory model, both without the new fields.

**What changes:**
- Add `previousStatus` field to CandidateInvitation
- Add `eventType` and `message` fields to OrderStatusHistory
- Add/verify the relation between Order and CandidateInvitation on both sides
- Change the `@default` on CandidateInvitation.status from `"draft"` to `"sent"`

**Confirmed:** This file must be read by the implementer before making changes to verify exact current state.

### 2. Migration file (new directory under `prisma/migrations/`)

**What to create:** A new migration directory following the project's required process:
1. Create directory: `prisma/migrations/YYYYMMDDHHMMSS_candidate_invitation_phase3`
2. Write `migration.sql` with:
   - `ALTER TABLE candidate_invitations ADD COLUMN previous_status VARCHAR;`
   - `ALTER TABLE candidate_invitations ALTER COLUMN status SET DEFAULT 'sent';`
   - `ALTER TABLE order_status_history ADD COLUMN event_type VARCHAR NOT NULL DEFAULT 'status_change';`
   - `ALTER TABLE order_status_history ADD COLUMN message TEXT;`
   - Idempotent checks (IF NOT EXISTS patterns or DO blocks)
   - RAISE NOTICE logging
   - Verification block confirming columns were added

**Important:** Use `pnpm prisma migrate deploy`, never `prisma migrate dev`.

---

## API Routes Summary

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/candidate/invitations` | Yes (customer/admin) | Create invitation |
| GET | `/api/candidate/invitations/[token]` | No | Look up by token |
| POST | `/api/candidate/invitations/[id]/extend` | Yes (customer/admin) | Extend expiration |
| POST | `/api/candidate/invitations/[id]/resend` | Yes (customer/admin) | Resend invitation |

---

## Zod Validation Schemas

### `createInvitationSchema`
```
packageId:        z.string().uuid()
firstName:        z.string().min(1).max(100)
lastName:         z.string().min(1).max(100)
email:            z.string().email()
phoneCountryCode: z.string().max(5).optional()
phoneNumber:      z.string().max(20).optional()
customerId:       z.string().uuid().optional()  // required for admin users only
```
Plus a `.refine()` rule: if phoneNumber is provided, phoneCountryCode must also be provided.

### `extendInvitationSchema`
```
days: z.number().int().min(1).max(15).optional()
```

---

## TypeScript Types

All types live in `src/types/candidateInvitation.ts`:

- `CreateInvitationInput` — `z.infer<typeof createInvitationSchema>`
- `ExtendInvitationInput` — `z.infer<typeof extendInvitationSchema>`
- `InvitationResponse` — manually defined type for API responses: id, orderId, customerId, firstName, lastName, email, phoneCountryCode, phoneNumber, status, expiresAt, createdAt, createdBy, completedAt, lastAccessedAt. Excludes: token (on lookup responses), passwordHash, previousStatus.

---

## UI Components

None. This phase is APIs only.

---

## Translation Keys

None. This phase has no UI.

---

## Order of Implementation

1. **Database schema** — update `prisma/schema.prisma` with new fields
2. **Migration** — create migration directory and SQL file, run `pnpm prisma migrate deploy`, then `pnpm prisma generate`
3. **Constants** — `src/constants/invitation-status.ts` and `src/constants/order-event-type.ts`
4. **Types** — `src/types/candidateInvitation.ts`
5. **Zod schemas** — `src/lib/validations/candidateInvitation.ts`
6. **Service** — `src/lib/services/candidate-invitation.service.ts`
7. **API route: create** — `src/app/api/candidate/invitations/route.ts`
8. **API route: lookup** — `src/app/api/candidate/invitations/[token]/route.ts`
9. **API route: extend** — `src/app/api/candidate/invitations/[id]/extend/route.ts`
10. **API route: resend** — `src/app/api/candidate/invitations/[id]/resend/route.ts`

---

## Risks and Considerations

1. **Order creation in the service layer.** The spec requires creating an order when an invitation is created. The existing `OrderCoreService.createCompleteOrder()` creates orders WITH order items. Here, we need an order with NO items (items come later in Phase 7). The implementer should check whether `createCompleteOrder` can be called with an empty items array, or whether a simpler `prisma.order.create()` is needed. Since there are no OrderItems being created, the `OrderCoreService.addOrderItem` transactional rule does NOT apply — we're just creating the order shell.

2. **Order number generation.** The order needs a properly formatted order number (`YYYYMMDD-CODE-NNNN`). The implementer must check how the existing order creation code generates these numbers (likely in `order.service.ts` or `order-core.service.ts`) and reuse that logic. Do not write a separate number generator.

3. **Auth-utils permission function.** The spec says customer users can create invitations. The implementer needs to check `src/lib/auth-utils.ts` for an existing permission function that fits (likely related to `customer_config` or a similar key). If no existing function covers this use case, a new one may be needed — flag this to Andy before creating it.

4. **Token lookup is unauthenticated.** The GET endpoint for looking up by token has no authentication check. This is intentional — candidates will access this without being logged in. However, the response must not include any sensitive data. The implementer must be careful to exclude passwordHash, previousStatus, and any internal-only fields.

5. **Next.js 15 params.** Per project standards, dynamic route params are typed as `Promise<{ ... }>` and must be awaited before destructuring. The implementer must follow this pattern in the `[token]` and `[id]` route files.

6. **Relation between CandidateInvitation and Order.** The implementer needs to verify the current state of the Prisma schema to see if the relation is already defined on both sides. If the CandidateInvitation model was created in Phase 2's migration but the Order model wasn't updated with the reverse relation, that needs to be added.

---

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table (field names match)
- [x] Constants files follow the existing `service-status.ts` pattern
- [x] Migration follows the project's required 5-step process
- [x] API routes follow the 4-element structure (auth, validation, try/catch, consistent response)
- [x] Status values are lowercase and referenced through constants

This plan is ready for the test-writer to proceed.