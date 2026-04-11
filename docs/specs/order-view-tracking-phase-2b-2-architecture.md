# Order View Tracking Phase 2B-2: Architecture Document

**Date:** April 10, 2026
**Author:** Architecture (verified jointly with Andy via direct codebase inspection)
**Status:** ARCHITECTURE - Awaiting Review

---

## Executive Summary

This document defines the technical implementation approach for Phase 2B-2 of the order view tracking feature, which adds backend logic to update the `lastActivityAt` and `lastInternalActivityAt` fields when meaningful events occur on orders and order items. The schema fields already exist from Phases 2B-1 and 2B-1.5; this phase adds the application logic that maintains them.

Every file path, function name, and transaction status in this document was verified by direct inspection of the actual codebase. All eight in-scope events already run inside Prisma transactions, which means Phase 2B-2 never needs to add a new transaction wrapper — it only needs to hook into existing ones.

The recommended approach is a centralized `ActivityTrackingService` that exposes two methods (`updateOrderActivity` and `updateOrderItemActivity`), accepts a Prisma transaction client as its first parameter, and is called from inside each existing transaction at the appropriate point.

---

## 1. Investigation Findings

### 1.1 Where in the codebase does each in-scope activity event live?

All eight events from the corrected Phase 2B-2 spec were located via direct grep/ls verification in the codebase. Every event already runs inside a Prisma transaction.

#### Order-Level Events (4 events)

**1. Order status change**

There are **two distinct code paths** that change order status. Both must be updated in Phase 2B-2.

- **Path A — Direct API call (e.g. an admin manually changes an order's status):**
  - File: `src/app/api/fulfillment/orders/[id]/status/route.ts`
  - Function: `PATCH` handler at line 32
  - Transaction: `prisma.$transaction` opened at line 190
  - Integration point: Add activity tracking call inside the existing transaction block

- **Path B — Automatic progression (e.g. order auto-progresses from draft to submitted when all items are submitted):**
  - File: `src/lib/services/order-status-progression.service.ts`
  - Function: contains a transaction starting at line 80
  - Transaction: `prisma.$transaction` at line 80
  - Integration point: Add activity tracking call inside the existing transaction block

  **⚠️ Important:** This is an automatic progression triggered by item-level events. The "actor" for this kind of change is whichever user caused the underlying item action. The implementer must make sure the actor's user ID and user type are propagated through to the progression service, otherwise activity tracking will not know who to filter for Rule 1 (customer skip) and Rule 3 (actor view update).

**2. Order metadata edit**

- File: `src/app/api/portal/orders/[id]/route.ts`
- Function: `PUT` handler at line 111
- Transaction: `prisma.$transaction` opened at line 134
- Integration point: Add activity tracking call inside the existing transaction block

**3. New order item added to an order**

- File: `src/lib/services/order-core.service.ts`
- Function: `addOrderItem` at line 285 (the instance method, signature: `addOrderItem(orderId, serviceId, locationId, userId)`)
- Transaction: `prisma.$transaction` opened at line 292
- Integration point: Add activity tracking call inside the existing transaction block
- Note: There is a second `addOrderItem` at line 966 of the same file (a static method). The implementer should determine whether both code paths need activity tracking, or whether only the instance method is reachable from real user actions. This is flagged for the implementer to investigate, not assumed.

**4. Vendor assigned to an order (internal-only event)**

- File: `src/app/api/orders/[id]/assign/route.ts`
- Function: `PUT` handler at line 10
- Transaction: `prisma.$transaction` opened at line 104
- Integration point: Add activity tracking call inside the existing transaction block
- This event is internal-only — it updates `lastInternalActivityAt` but NOT `lastActivityAt`

#### Order Item-Level Events (4 events)

**5 & 6. Customer-visible comment added / Internal-only comment added (one code path, two event types)**

Both comment events flow through the same code path, distinguished only by the value of the `isInternalOnly` boolean field on the comment data.

- API route layer:
  - File: `src/app/api/services/[id]/comments/route.ts`
  - Function: `POST` handler at line 39
  - Transaction: No transaction at this layer — the route handler delegates to the service layer
  - At line 128 it calls `service.createComment(...)`
- Service layer (where the actual work happens):
  - File: `src/services/service-comment-service.ts`
  - Function: `createComment` at line 15
  - Transaction: `prisma.$transaction` opened at line 84
  - Integration point: Add activity tracking call inside the existing transaction in `createComment`. The event type is determined by reading `data.isInternalOnly`.

**Verified safe:** This `createComment` function is used ONLY for real user-authored comments. The auto-generated status-change audit comments (the ones with `isStatusChange = true`) are created via a different code path entirely (see Event 7 below). This means we can safely add activity tracking inside `createComment` without it accidentally double-firing on status changes.

**7. Item status change**

- File: `src/app/api/services/[id]/status/route.ts`
- Function: `PUT` handler at line 73
- Transaction: `prisma.$transaction` opened at line 266
- Integration point: Add activity tracking call inside the existing transaction block
- **Audit comment side effect:** This route creates a `ServiceComment` row with `isStatusChange = true` directly inside its own transaction (at line 338 of the same file, via `tx.serviceComment.create(...)`). This is the auto-generated audit trail. **Important:** Because this audit comment is created directly via `tx.serviceComment.create` and does NOT go through `ServiceCommentService.createComment()`, it will NOT trigger activity tracking via the comment code path. The status change is treated as a single activity event (status change), not two events (status change + audit comment), as required by the resolved questions.

**8. Document/result upload to an item**

- File: `src/app/api/services/[id]/attachments/route.ts`
- Function: `POST` handler at line 157
- Transaction: `prisma.$transaction` opened at line 280
- Integration point: Add activity tracking call inside the existing transaction block

### 1.2 Does view tracking currently exist for internal and vendor users?

**No.** Phase 2A explicitly limits view tracking to customer users. The existing view-recording endpoints (`/api/orders/[id]/view` and `/api/order-items/[id]/view`) silently return early when the requester is not a customer, and no `OrderView` or `OrderItemView` records are created for internal or vendor users.

**Implication for Phase 2B-2:** To satisfy Rule 3 (per-user actor filtering), the activity tracking logic must update the actor's view timestamp regardless of user type — including for internal and vendor users who currently have no view records at all. The cleanest way to handle this is via Prisma's `upsert` operation, which will create the view record if it doesn't exist and update it if it does. This is a small, deliberate expansion of the view tracking model from Phase 2A and was explicitly accepted in the resolved questions section below.

### 1.3 What pattern centralizes the activity update logic?

**Recommended: a static-method service layer pattern (`ActivityTrackingService`).** See Section 3 for the full design.

The pattern fits the existing `src/lib/services/` conventions in this codebase, accepts a Prisma transaction client as its first parameter (so it always participates in the caller's transaction), and exposes two clean entry points — one for order-level events and one for item-level events. This avoids copy-pasted activity logic across the eight integration points and makes future event additions trivial.

Three alternatives were considered and rejected:

- **Database triggers:** Cannot detect actor user type, hard to test, PostgreSQL-specific.
- **Prisma middleware:** Lacks business context (cannot easily distinguish a status change from a metadata edit), and it is harder to control which operations should and shouldn't trigger activity tracking.
- **Domain events / pub-sub:** Would violate Rule 4 by running activity updates outside the triggering event's transaction.

### 1.4 What existing transaction boundaries must be respected?

**Every single in-scope event already uses a Prisma transaction.** This is the most important finding of the entire investigation. There are zero events where Phase 2B-2 needs to add a new transaction wrapper. The implementer's job for transactions is purely to find the existing `prisma.$transaction` block in each file, pass the `tx` client into the activity tracking call, and add nothing else.

| Event | File | Existing Transaction Line |
|---|---|---|
| Order status change (direct) | `src/app/api/fulfillment/orders/[id]/status/route.ts` | line 190 |
| Order status change (auto-progression) | `src/lib/services/order-status-progression.service.ts` | line 80 |
| Order metadata edit | `src/app/api/portal/orders/[id]/route.ts` | line 134 |
| New order item added | `src/lib/services/order-core.service.ts` | line 292 |
| Vendor assigned to order | `src/app/api/orders/[id]/assign/route.ts` | line 104 |
| Item comment created | `src/services/service-comment-service.ts` | line 84 |
| Item status change | `src/app/api/services/[id]/status/route.ts` | line 266 |
| Item document upload | `src/app/api/services/[id]/attachments/route.ts` | line 280 |

### 1.5 How are internal vs customer-visible comments distinguished?

The `ServiceComment` model has an `isInternalOnly Boolean @default(true)` field at line 589 of `prisma/schema.prisma`. The default of `true` means "internal-only by default" (security-conservative).

In `createComment` at `src/services/service-comment-service.ts` line 15, the value comes from the input data and is stored on the new comment. The activity tracking call should read `data.isInternalOnly` (or the equivalent on the resulting comment) and pass:

- `isInternalOnly === true` → event type that updates only `lastInternalActivityAt`
- `isInternalOnly === false` → event type that updates BOTH `lastActivityAt` and `lastInternalActivityAt`

---

## 2. Activity Events Discovery Table

This table is the implementer's checklist. Every row has been verified against the live codebase.

| # | Event | File | Function | Transaction | Customer-visible? |
|---|---|---|---|---|---|
| 1a | Order status change (direct API) | `src/app/api/fulfillment/orders/[id]/status/route.ts` | `PATCH` (line 32) | line 190 ✅ | Yes — both fields |
| 1b | Order status change (auto-progression) | `src/lib/services/order-status-progression.service.ts` | progression logic | line 80 ✅ | Yes — both fields |
| 2 | Order metadata edit | `src/app/api/portal/orders/[id]/route.ts` | `PUT` (line 111) | line 134 ✅ | Yes — both fields |
| 3 | New order item added | `src/lib/services/order-core.service.ts` | `addOrderItem` (line 285) | line 292 ✅ | Yes — both fields |
| 4 | Vendor assigned to order | `src/app/api/orders/[id]/assign/route.ts` | `PUT` (line 10) | line 104 ✅ | **No — internal only** |
| 5 | Customer-visible item comment | `src/services/service-comment-service.ts` | `createComment` (line 15) | line 84 ✅ | Yes — both fields |
| 6 | Internal-only item comment | `src/services/service-comment-service.ts` | `createComment` (line 15) | line 84 ✅ | **No — internal only** |
| 7 | Item status change | `src/app/api/services/[id]/status/route.ts` | `PUT` (line 73) | line 266 ✅ | Yes — both fields |
| 8 | Item document upload | `src/app/api/services/[id]/attachments/route.ts` | `POST` (line 157) | line 280 ✅ | Yes — both fields |

**Total integration points: 9** (event 1 has two distinct code paths). All nine already use transactions.

---

## 3. Recommended Architecture

### 3.1 The ActivityTrackingService

Create a new file at `src/lib/services/activity-tracking.service.ts` exposing a class with two static methods.

```typescript
// PSEUDOCODE — illustrative, not production-ready
import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
type ActorUserType = 'customer' | 'internal' | 'vendor';

export class ActivityTrackingService {

  /**
   * Updates activity tracking for an order-level event.
   *
   * Always updates the actor's OrderView.lastViewedAt (Rule 3).
   * Only updates Order.lastActivityAt and Order.lastInternalActivityAt
   * if the actor is NOT a customer (Rule 1) AND the event applies.
   */
  static async updateOrderActivity(
    tx: Tx,
    orderId: string,
    actorUserId: string,
    actorUserType: ActorUserType,
    isCustomerVisible: boolean,
  ): Promise<void> {
    const now = new Date();

    // Rule 1: customer actions never count as activity.
    // But Rule 3 still applies — update the actor's view either way.
    if (actorUserType !== 'customer') {
      const data: Prisma.OrderUpdateInput = {
        lastInternalActivityAt: now,
      };
      if (isCustomerVisible) {
        data.lastActivityAt = now;
      }
      await tx.order.update({
        where: { id: orderId },
        data,
      });
    }

    // Rule 3: always update the actor's own view timestamp,
    // regardless of user type or event visibility.
    await tx.orderView.upsert({
      where: { userId_orderId: { userId: actorUserId, orderId } },
      create: { userId: actorUserId, orderId, lastViewedAt: now },
      update: { lastViewedAt: now },
    });
  }

  /**
   * Updates activity tracking for an order-item-level event.
   *
   * Same rules as updateOrderActivity, but operates on OrderItem
   * and OrderItemView. Per Rule 2, this NEVER touches the parent Order.
   */
  static async updateOrderItemActivity(
    tx: Tx,
    orderItemId: string,
    actorUserId: string,
    actorUserType: ActorUserType,
    isCustomerVisible: boolean,
  ): Promise<void> {
    const now = new Date();

    if (actorUserType !== 'customer') {
      const data: Prisma.OrderItemUpdateInput = {
        lastInternalActivityAt: now,
      };
      if (isCustomerVisible) {
        data.lastActivityAt = now;
      }
      await tx.orderItem.update({
        where: { id: orderItemId },
        data,
      });
    }

    await tx.orderItemView.upsert({
      where: {
        userId_orderItemId: { userId: actorUserId, orderItemId },
      },
      create: { userId: actorUserId, orderItemId, lastViewedAt: now },
      update: { lastViewedAt: now },
    });
  }
}
```

**Key design properties:**

1. **Transaction client is the first parameter.** This forces every caller to pass an active transaction, which makes Rule 4 (transactional integrity) structurally enforced — there's no way to call this service "outside" a transaction.

2. **`isCustomerVisible` is a simple boolean.** The caller decides whether the event is customer-visible. This keeps the service dumb and easy to test, and prevents the service from needing to know about every event type. Callers determine the boolean as follows:
   - Order status change (direct or progression): `true`
   - Order metadata edit: `true`
   - New order item added: `true`
   - Vendor assigned to order: `false`
   - Customer-visible comment (`isInternalOnly === false`): `true`
   - Internal-only comment (`isInternalOnly === true`): `false`
   - Item status change: `true`
   - Item document upload: `true`

3. **Customer actors still trigger an upsert on their own view record.** Per Rule 3, even customer actors get their `lastViewedAt` bumped — they just don't move the activity timestamps. The upsert at the bottom of each method runs unconditionally.

4. **Rule 2 (no cascade) is structural.** `updateOrderItemActivity` only touches `OrderItem` and `OrderItemView`. There is no code path in this service that bumps the parent Order from an item event.

### 3.2 How actor user type is detected

User type comes from the session. In every API route handler, the existing pattern is `session.user.userType`, which contains one of `'customer' | 'internal' | 'vendor'`. The route handler must read this value from the session and pass it down through any service calls so it eventually reaches `ActivityTrackingService`.

For events that go through a service method (like `createComment` and `addOrderItem`), the user type may need to be added as a new parameter on the existing service signature. The implementer should make this change minimal — add a single `actorUserType` parameter rather than restructuring how user data flows through the service.

For the auto-progression service (`order-status-progression.service.ts`), the user who *triggered* the underlying item action is the actor. The implementer must make sure that user's ID and user type are propagated into the progression service. If they're not currently passed in, that's a small refactor in scope for Phase 2B-2.

### 3.3 The `userType` schema default issue (informational, not in scope)

During verification we discovered that the `User.userType` field in `prisma/schema.prisma` has `@default("admin")` at line 28. The string `"admin"` is not one of the three valid user types (`customer`, `internal`, `vendor`) in this system. Any user created without an explicit `userType` would silently default to `"admin"`, which would be treated as "non-customer" by Phase 2B-2's logic (because `"admin" !== "customer"`).

This is a latent bug in the schema that pre-dates Phase 2B-2 and is **explicitly out of scope** for this phase. It has been added to `docs/tech_debt.md` for separate tracking.

### 3.4 Comment visibility check

In `ServiceCommentService.createComment` (line 15 of `src/services/service-comment-service.ts`), the new comment is created inside the existing transaction at line 84. The activity tracking call should be added immediately after the comment is created, inside the same transaction:

```typescript
// PSEUDOCODE — illustrative
const comment = await prisma.$transaction(async (tx) => {
  const newComment = await tx.serviceComment.create({ ... });

  await ActivityTrackingService.updateOrderItemActivity(
    tx,
    newComment.orderItemId,
    actorUserId,
    actorUserType,
    !newComment.isInternalOnly,  // isCustomerVisible = NOT internal
  );

  return newComment;
});
```

### 3.5 Status-change audit comment is NOT a separate event

Verified directly: the status-change audit comments (the ones with `isStatusChange = true`) are created at line 338 of `src/app/api/services/[id]/status/route.ts` via `tx.serviceComment.create(...)` directly. They do **not** go through `ServiceCommentService.createComment()`. This is structurally important because it means adding activity tracking to `createComment` will not accidentally fire a second time when a status change runs.

The status change itself (event 7) is the activity event. The audit comment is just a record-keeping side effect.

---

## 4. Files That Will Need to Be Modified

### 4.1 New file to create

- `src/lib/services/activity-tracking.service.ts` — the new `ActivityTrackingService` class

### 4.2 Files modified to integrate activity tracking (8 files total)

For each file, the change is the same shape: import `ActivityTrackingService`, then add a call to `updateOrderActivity` or `updateOrderItemActivity` inside the existing `prisma.$transaction(...)` block.

**Order-level integration (5 changes across 4 files):**

1. `src/app/api/fulfillment/orders/[id]/status/route.ts` — add activity call inside transaction at line 190 (event 1a)
2. `src/lib/services/order-status-progression.service.ts` — add activity call inside transaction at line 80 (event 1b). May require adding actor user ID + user type as parameters to the progression function if they're not already passed in.
3. `src/app/api/portal/orders/[id]/route.ts` — add activity call inside transaction at line 134 (event 2)
4. `src/lib/services/order-core.service.ts` — add activity call inside transaction at line 292, in `addOrderItem` (event 3). Implementer should also evaluate whether the duplicate `addOrderItem` at line 966 needs the same treatment.
5. `src/app/api/orders/[id]/assign/route.ts` — add activity call inside transaction at line 104 (event 4). This is the only order-level event where `isCustomerVisible = false`.

**Item-level integration (3 changes across 3 files):**

6. `src/services/service-comment-service.ts` — add activity call inside transaction at line 84, in `createComment` (events 5 and 6, distinguished by `isInternalOnly`). May require adding actor user type as a parameter to `createComment`.
7. `src/app/api/services/[id]/status/route.ts` — add activity call inside transaction at line 266 (event 7)
8. `src/app/api/services/[id]/attachments/route.ts` — add activity call inside transaction at line 280 (event 8)

### 4.3 Files that may need parameter additions (call sites)

If `createComment` and the auto-progression service gain a new `actorUserType` parameter, every place that calls them must pass the value through. The implementer should grep for callers and update them. Expected call sites include the route handlers that delegate to these services.

### 4.4 Test files

The test-writer stage will determine the exact test files needed. At minimum:

- Unit tests for `ActivityTrackingService` itself (all six branches: customer + non-customer × order/item × visible/internal)
- Integration tests confirming activity updates roll back when the parent transaction rolls back (Rule 4 verification)
- Tests confirming the actor's view timestamp is updated even for customer actors (Rule 3 verification)
- Tests confirming Rule 2 (no cascade) — an item event must not move the parent order's activity fields

---

## 5. Resolved Questions

These were originally open questions for the architect. They have all been resolved through joint discussion between Andy and the architect, and are recorded here for the implementer's reference:

1. **Missing functionality is deferred, not in scope.** Order-level comments, order item removal, item-level vendor assignment, and item-level details editing do not exist in the codebase. These are documented in the spec's Deferred Work section. Phase 2B-2 only implements activity tracking for events that have real implementations.

2. **User types are exactly three: `customer`, `internal`, `vendor`.** There is no `admin` user type in the running system, despite the schema's stale default. The `ActivityTrackingService` uses `actorUserType !== 'customer'` to identify non-customer staff users, which correctly groups internal and vendor users together.

3. **Status-change audit comments are ONE event, not two.** Verified structurally: the audit comment is created via a different code path (`tx.serviceComment.create` directly in the status route) than regular comments (`ServiceCommentService.createComment`), so adding activity tracking to `createComment` will not double-fire on status changes.

4. **Phase 2B-2 will create OrderView/OrderItemView records for internal and vendor users via upsert.** This is a small, deliberate expansion of the Phase 2A view tracking model. Required by Rule 3.

5. **Vendor activity counts as activity.** Vendors are non-customer staff users whose actions matter to customers. They are treated identically to internal users by the `actorUserType !== 'customer'` check.

---

## 6. Deferred Work

The following events were originally part of the activity table but are explicitly out of scope for Phase 2B-2 because the underlying functionality does not exist in the codebase. When these features are eventually built, the developer building them MUST add a call to `ActivityTrackingService.updateOrderActivity` or `ActivityTrackingService.updateOrderItemActivity` at the appropriate point inside the operation's transaction:

- **Order-level comments** (when an order-level comment feature is added)
- **Order item removal** (when a remove-item endpoint is added)
- **Item-level vendor assignment** (when item-level assignment is added)
- **Item details editing** (when an item edit endpoint is added)

The `ActivityTrackingService` created in Phase 2B-2 will be ready and waiting to handle these events.

---

## 7. Risks and Trade-offs

### 7.1 Risks

**Risk 1: A bug in activity tracking could roll back real user actions.** Because activity updates participate in the same transaction as the triggering event (Rule 4), a failure in `ActivityTrackingService` would roll back the user's intended action. *Mitigation:* The activity update logic is intentionally trivial — two timestamp updates and one upsert. There is very little surface area for failure. The test-writer must include negative-path tests to verify the failure modes.

**Risk 2: Auto-progression actor propagation may require touching call sites.** Event 1b (auto-progression) needs the actor's user ID and user type passed into the progression service. If those parameters aren't already there, the implementer will need to add them and update every caller. The scope of that change isn't yet known. *Mitigation:* The implementer should investigate this early in the implementation phase and report back if it turns out to be larger than expected.

**Risk 3: View record growth.** Creating `OrderView` and `OrderItemView` records for internal and vendor users will grow these tables substantially. *Mitigation:* The records are small (three IDs and a timestamp) and the unique constraints prevent duplicates. Index sizes are unlikely to become a problem at the platform's current scale.

**Risk 4: The duplicate `addOrderItem` at line 966 of `order-core.service.ts` may or may not need activity tracking.** The instance method at line 285 is the obvious one; the static method at line 966 needs investigation. *Mitigation:* The implementer must check whether the line 966 version is reachable from real user actions (vs. test fixtures) and handle accordingly.

### 7.2 Trade-offs

**Centralized service vs. inline logic:** Chose centralized service. The trade-off is one extra import per file vs. avoiding eight copies of the same business logic. Centralization wins easily here.

**Boolean `isCustomerVisible` parameter vs. event-type enum:** Chose boolean. The trade-off is that the caller has to know whether their event is customer-visible (we have a small list — see Section 3.1). The benefit is that the service itself stays trivial: no enums, no switch statements, no future-event-type changes needed when new events are added.

**Static methods vs. instance class:** Chose static. There is no state to maintain in the service, no constructor parameters, and no dependency injection in this codebase. Static methods match the codebase's existing service patterns.

---

## Status: ARCHITECTURE - Awaiting Review

This document was produced through direct codebase verification rather than agent investigation, after two prior agent runs produced fabricated or incomplete results. Every file path, function name, line number, and transaction status above was confirmed by running grep/ls/sed commands against the live filesystem.

**Next steps after approval:**

1. Andy reviews and approves this architecture
2. Test-writer Pass 1 produces failing tests for `ActivityTrackingService` and end-to-end activity tracking expectations
3. Implementer creates `ActivityTrackingService` and integrates it into all 8 files (9 integration points)
4. Test-writer Pass 2 produces unit tests for the new service and any new code paths
5. Code review, standards check, documentation update