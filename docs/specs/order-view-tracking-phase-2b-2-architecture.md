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

## 8. Discovered During Implementation

This section records findings that emerged while Phase 2B-2 was being built and tested. The original sections above were not edited so the architect's reasoning is preserved as written. The findings here amend, correct, or supplement the original architecture based on what the codebase actually contains.

### 8.1 `OrderStatusProgressionService` is dead code in production

**Original architecture statement:** Section 1.4 / Section 4.2 item 2 identified `src/lib/services/order-status-progression.service.ts` as the integration point for event 1b (order auto-progression), with Section 4.2 noting that the implementer might need to add actor user ID and user type as parameters to the progression function "if they're not already passed in."

**What was discovered:** A direct `grep -rn "checkAndProgressOrderStatus" src` returned only references inside the service file itself and its own test file. There are zero production callers anywhere in the codebase. Additionally, `grep -rn "OrderStatusProgressionService" src` returned only the file's own export line and the class definition. The class is dead code — nothing in the running application instantiates it or invokes it.

**Where the real auto-progression logic actually lives:** Inline inside `src/app/api/services/[id]/status/route.ts` at lines 358–411, inside the `PUT` handler for service status changes. When a user changes a service to "submitted," that route handler checks whether all services in the order are now submitted and, if so, updates the order status from `'draft'` to `'submitted'` directly via `tx.order.update()` — without going through `OrderStatusProgressionService` at all.

**How Phase 2B-2 ended up handling this:** The implementer initially trusted the architecture document and added activity tracking code to `OrderStatusProgressionService` as instructed. That code is harmless waste — it sits inside dead code and will never run in production. After this discovery, a second activity tracking call was added inline inside the real auto-progression block in `src/app/api/services/[id]/status/route.ts` (around line 396, between the `orderStatusHistory.create` call and the `logger.info` call). Event 1b is now correctly wired up.

**Outstanding decision:** The dead `OrderStatusProgressionService` should either be deleted (along with its test file and the harmless Phase 2B-2 activity tracking code inside it) or resurrected by routing the inline auto-progression code through it. The current state — two parallel implementations, only one of which runs — is not acceptable long-term. This decision is logged separately as a tech debt item, not handled in Phase 2B-2.

### 8.2 Auto-progression actor parameters: not needed in the dead service, fine in the real path

**Original architecture statement:** Risk 2 in Section 7.1 warned that auto-progression "may require touching call sites" if the actor user ID and user type were not already being passed into the progression service.

**What was discovered:** Because `OrderStatusProgressionService` has no production callers (see 8.1), the question of whether to update its callers is moot — there are no callers to update. In the real auto-progression path inside `src/app/api/services/[id]/status/route.ts`, the actor's user ID and user type are already available in scope at the auto-progression block. The user ID is bound to the local `userId` variable earlier in the same handler, and the user type is bound to the local `userType` variable used elsewhere in the same file. No call-site refactor was needed for the real path.

**Result:** Risk 2 was effectively a non-issue once the dead-code finding was established. The implementer's pre-flight investigation note ("userId was available, userType not needed due to existing context") was correct in substance but was reported in a way that obscured the underlying dead-code finding. Future investigations should report findings of this kind in plain language ("there are no callers; nothing needs to be updated") rather than ambiguous shorthand.

### 8.3 Duplicate `addOrderItem` at line 966 of `order-core.service.ts`: both updated

**Original architecture statement:** Risk 4 in Section 7.1 flagged that `src/lib/services/order-core.service.ts` may have a second `addOrderItem` definition around line 966 in addition to the one near line 285, and noted that the implementer needed to investigate whether the second instance was reachable.

**What was discovered:** Both definitions exist. The implementer added activity tracking calls to both, with optional `userId` and `userType` parameters guarded by `if (userId && userType)` so existing callers that don't supply user info are unaffected.

**Note:** Whether the second `addOrderItem` is genuinely needed or is itself a candidate for cleanup was not investigated. The Phase 2B-2 work treated both instances as live and added tracking to each. If the second instance is later determined to be dead code, the activity tracking call inside it should be removed at the same time the function is removed.

### 8.4 The `'admin'` user type appears in real test mock data

**Original architecture statement:** Section 3.3 noted that the `User.userType` field in `prisma/schema.prisma` has `@default("admin")` and that `"admin"` is not one of the three valid user types (`customer`, `internal`, `vendor`). It described the issue as a latent schema bug and explicitly out of scope for Phase 2B-2.

**What was discovered during implementation:** Two existing tests in the comments-related test files build their fake session objects with `userType: 'admin'`, mirroring the broken schema default. After Phase 2B-2 added a new fourth `userType` parameter to `ServiceCommentService.createComment`, the route handler now reads `session.user.userType` directly from the session and passes it through. In tests, that value is `'admin'`, which then flows through to `createComment` and shows up in the test's call assertions.

**How Phase 2B-2 handled this:** The two failing tests' assertions were updated to expect `'admin'` as the fourth argument, matching what the test mocks actually produce. No production code change was made. The underlying schema default is still broken and is still tracked as tech debt.

**Important note for future work:** The `ActivityTrackingService` checks `actorUserType !== 'customer'` to identify non-customer staff users. A user with `userType = 'admin'` would be treated as non-customer (because `'admin' !== 'customer'`), and their actions would update activity timestamps as if they were internal staff. This is incorrect for any real-world user that should have been classified as a customer but slipped through with the broken default. Resolving the schema default is a prerequisite for trusting activity tracking results in production.

### 8.5 Fallback assumption: missing `userType` defaults to `'internal'`

**What the implementer added:** In several places where the new `ActivityTrackingService` is called from a route handler, the implementer wrote the user type extraction as:

```typescript
const userType = (session.user.userType || 'internal') as 'customer' | 'internal' | 'vendor';
```

This means if a user's session is missing `userType` for any reason, they will be treated as internal staff for activity tracking purposes. This is defensible (it prevents crashes) but it is a silent assumption that should be made visible. A user who is actually a customer but whose session is missing `userType` would have their actions incorrectly counted as activity.

**Why this matters now:** Combined with finding 8.4, there are two ways a customer could end up being treated as a non-customer for activity tracking purposes — either by having `userType = 'admin'` in the database or by having `userType` missing from the session entirely. Both are silent failure modes that produce wrong activity tracking data without any error or warning.

**Scope:** Out of scope for Phase 2B-2. Logged as tech debt.

### 8.6 Case sensitivity bug in auto-progression status check (pre-existing, unrelated)

**What was discovered:** In `src/app/api/services/[id]/status/route.ts` around line 360, the auto-progression block begins with:

```typescript
if (newStatus === 'Submitted' && orderId) {
```

The capital `'S'` in `'Submitted'` is inconsistent with the project standard that all statuses are stored lowercase in the database. If `newStatus` arrives lowercase as the standard expects, this comparison will never match, which means auto-progression may currently never fire in production.

**Scope:** Pre-existing bug, unrelated to Phase 2B-2, discovered during the Phase 2B-2 investigation. Logged as tech debt. Worth investigating whether auto-progression actually fires in production at all — if it does not, this is a real product bug, not just a code smell.

### 8.7 Backward-compatibility shim added to vendor assign route

**What the implementer added:** In `src/app/api/orders/[id]/assign/route.ts`, the existing permission check was changed from:

```typescript
if (session.user.type !== 'internal') {
```

to:

```typescript
const userType = session.user.userType || session.user.type;
if (userType !== 'internal') {
```

This was done so the file could read user type via the same `userType` field that `ActivityTrackingService` expects, while still working if older callers populate `session.user.type` instead. The change is a small refactor of an existing permission check rather than a pure additive change.

**Scope:** Within Phase 2B-2 because it was needed to wire the activity tracking call. Future phases should not need to repeat this kind of compatibility shim — the underlying inconsistency between `session.user.type` and `session.user.userType` is itself a small piece of technical debt that has been logged separately.

---

## Status: IMPLEMENTED — Architecture Amended Post-Implementation

This document was originally produced through direct codebase verification rather than agent investigation, after two prior agent runs produced fabricated or incomplete results. Every file path, function name, line number, and transaction status in Sections 1 through 7 was confirmed by running grep/ls/sed commands against the live filesystem at the time the architecture was written.

Section 8 was added after Phase 2B-2 was implemented and merged, to record findings that emerged during implementation and testing. Sections 1 through 7 are preserved as originally written so the architect's reasoning at the time can still be read in context.

**Implementation history:**

1. ✅ Architecture approved
2. ✅ Test-writer Pass 1 produced 17 failing tests for `ActivityTrackingService` (commit `08439b2`)
3. ✅ Implementer created `ActivityTrackingService` and integrated it into all 9 integration points across 8 files (commit `c8fd8a8`); two existing test assertions updated to match the new `createComment` signature; Section 8 findings discovered and documented
4. ⏳ Test-writer Pass 2 — pending
5. ⏳ Code review, standards check, documentation update — pending