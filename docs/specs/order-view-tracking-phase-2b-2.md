# Order View Tracking Phase 2B-2: Activity Update Logic

**Date:** April 10, 2026
**Author:** Architecture Team
**Status:** SPECIFICATION - Awaiting Review

---

## Executive Summary

This specification defines Phase 2B-2 of the order view tracking feature, which implements the application logic to update the `lastActivityAt` and `lastInternalActivityAt` fields when meaningful events occur on orders and order items. The schema fields already exist from Phases 2B-1 and 2B-1.5. This phase adds ONLY the backend logic to update these fields — no UI changes, no API response changes, and no comparison logic. This is pure backend plumbing to ensure the activity timestamps are kept current when relevant events occur.

---

## 1. Activity Events Table

The following table defines which events trigger updates to the activity tracking fields:

### Order-Level Events

| Event | Actor | Updates `Order.lastActivityAt` | Updates `Order.lastInternalActivityAt` | Updates Actor's View |
|---|---|---|---|---|
| Order status changes | Internal/Vendor | Yes | Yes | Yes - `OrderView.lastViewedAt` |
| Order metadata edited (subject info, etc.) | Internal | Yes | Yes | Yes - `OrderView.lastViewedAt` |
| New order item added | Internal | Yes | Yes | Yes - `OrderView.lastViewedAt` |
| Vendor assigned to order | Internal | No | Yes | Yes - `OrderView.lastViewedAt` |
| **Any of the above events** | Customer | No | No | Yes - `OrderView.lastViewedAt` |

### Order Item-Level Events

| Event | Actor | Updates `OrderItem.lastActivityAt` | Updates `OrderItem.lastInternalActivityAt` | Updates Actor's View |
|---|---|---|---|---|
| Customer-visible comment added | Internal/Vendor | Yes | Yes | Yes - `OrderItemView.lastViewedAt` |
| Internal-only comment added | Internal/Vendor | No | Yes | Yes - `OrderItemView.lastViewedAt` |
| Item status changes | Internal/Vendor | Yes | Yes | Yes - `OrderItemView.lastViewedAt` |
| Result/document uploaded | Vendor | Yes | Yes | Yes - `OrderItemView.lastViewedAt` |
| **Any of the above events** | Customer | No | No | Yes - `OrderItemView.lastViewedAt` |

**Important:** Order-level events do NOT cascade to order items, and item-level events do NOT cascade to the parent order. Each entity's activity is tracked independently.

---

## 2. Critical Business Rules

### Rule 1: Customer Actions Never Count as Activity

If a customer user (userType = 'customer') is the actor performing any event, neither `lastActivityAt` nor `lastInternalActivityAt` should be updated. This applies to all events — editing orders, adding comments, or any other action. Customer actions are not considered "activity" from the business perspective because activity tracking is meant to show customers when the internal/vendor staff has done something new.

### Rule 2: No Cascading Between Order and Order Items

When an event occurs at the order item level, ONLY the `OrderItem.lastActivityAt` and/or `OrderItem.lastInternalActivityAt` fields are updated. The parent Order's activity fields remain unchanged. Similarly, order-level events do not affect individual order items. This independence allows users to see activity at the appropriate granularity.

### Rule 3: Per-User Actor Filtering via View Timestamp Updates

To prevent users from seeing their own actions as "new activity", every activity event must ALSO update the actor's own view timestamp:
- For order-level events: Update the actor's `OrderView.lastViewedAt`
- For item-level events: Update the actor's `OrderItemView.lastViewedAt`

This simultaneous update means when a user causes activity on an order/item, their own view timestamp gets set to "now" at the same moment as the activity timestamp. When comparison logic runs later, the timestamps will match, so the user won't see their own action as "new". Other users with older view timestamps will correctly see it as new activity. This applies to ALL user types — customer, internal, and vendor.

### Rule 4: Transaction Boundaries Must Be Respected

All activity field updates and view timestamp updates must occur within the SAME database transaction as the triggering event. This ensures data consistency:
- If the main event succeeds, the activity tracking updates also succeed
- If the main event fails and rolls back, the activity tracking updates also roll back
- No orphaned or inconsistent activity timestamps can exist

### Rule 5: Internal vs Customer-Visible Comment Distinction

The system already has a mechanism to distinguish internal-only comments from customer-visible comments (likely a visibility flag or type field). Internal-only comments must NEVER update `lastActivityAt` under any circumstances — they only update `lastInternalActivityAt`. Customer-visible comments update BOTH fields when created by internal/vendor users.

---

## 3. Technical Considerations

### 3.1 Centralization Strategy

To avoid code duplication and ensure consistency, the activity update logic should be centralized. Consider these approaches:

1. **Service Layer Methods:** Create dedicated methods in the order and order item services that handle activity updates
2. **Database Triggers:** Use PostgreSQL triggers to automatically update activity fields (less flexible, harder to test)
3. **Prisma Middleware:** Intercept Prisma operations to inject activity updates (complex but centralized)
4. **Event-Driven Updates:** Emit domain events that an activity tracker service listens to

The recommended approach is **Service Layer Methods** for maintainability and testability.

### 3.2 View Tracking Creation

The specification assumes view tracking records may not exist for admin and vendor users yet (Phase 2A only implemented customer view tracking). If view records don't exist:
- Create the `OrderView` or `OrderItemView` record with `lastViewedAt = now()`
- This ensures the actor doesn't see their own action as "new"

### 3.3 Performance Considerations

- Activity updates should be lightweight — just timestamp updates
- Avoid N+1 queries when updating multiple items
- Use bulk update operations where possible
- Consider using `Promise.all()` for parallel updates when safe

### 3.4 Error Handling

Activity tracking updates participate in the same database transaction as the triggering event (per Rule 4). If an activity update fails, the entire transaction rolls back, including the main event itself. This guarantees that activity tracking is either fully consistent with the event that caused it, or the event did not happen at all. There is no separate error handling, fallback logic, or retry mechanism for activity updates — the transactional guarantee is precisely what makes activity tracking reliable. The architect must ensure that activity update logic is simple and unlikely to fail (it consists only of timestamp updates and view record upserts), so that it does not become a source of transaction rollbacks for the main operations.

---

## 4. Open Questions for the Architect

### 4.1 Where in the codebase does each activity event live?

The architect must identify the exact files and functions where each event occurs:
- Comment creation endpoints and services
- Order status update logic
- Order metadata editing endpoints
- Order item addition logic
- Document upload handlers
- Vendor assignment logic (order-level)

### 4.2 Does view tracking currently exist for admin and vendor users?

Phase 2A explicitly states only customer users have view tracking. The architect must determine:
- Do `OrderView` and `OrderItemView` records get created for internal/vendor users?
- If not, should Phase 2B-2 create them on-the-fly when needed?
- Or should this be deferred to a future phase?

### 4.3 What is the cleanest way to centralize the activity update logic?

Options to evaluate:
- Shared utility functions imported by each service
- Base service class with activity update methods
- Separate activity tracking service
- Prisma extension or plugin

### 4.4 Are there any existing transaction boundaries to respect?

The architect must identify:
- Which operations already use transactions
- Where new transaction blocks need to be added
- How to ensure activity updates participate in existing transactions

### 4.5 How are internal vs customer-visible comments distinguished?

The architect must determine:
- What field or flag identifies comment visibility
- Where this check should occur in the update logic
- Whether there are other event types with similar visibility rules

---

## 5. Definition of Done

### 5.1 Core Implementation

- [ ] All order-level events listed in the Activity Events Table update the correct activity fields
- [ ] All order item-level events listed in the Activity Events Table update the correct activity fields
- [ ] Customer actions never update activity timestamps
- [ ] Order and order item activity remain independent (no cascading)
- [ ] Actor's view timestamps are updated simultaneously with activity timestamps

### 5.2 Transaction Integrity

- [ ] All activity updates occur within the same transaction as the triggering event
- [ ] Rollback of main event also rolls back activity updates
- [ ] No orphaned or inconsistent activity timestamps can be created

### 5.3 Comment Visibility

- [ ] Internal-only comments update only `lastInternalActivityAt`
- [ ] Customer-visible comments update both activity fields
- [ ] Comment visibility logic is correctly identified and implemented

### 5.4 Testing

- [ ] Unit tests verify each event updates the correct fields
- [ ] Unit tests verify customer actions don't update activity fields
- [ ] Integration tests verify transaction boundaries are respected
- [ ] Tests confirm view timestamps are updated for all actor types

### 5.5 Code Quality

- [ ] Activity update logic is centralized and reusable
- [ ] No code duplication across different event handlers
- [ ] Clear separation between customer-visible and internal-only events
- [ ] Activity update logic is simple enough to be unlikely to cause unintended transaction rollbacks

---

## 6. Out of Scope

The following items are explicitly NOT part of Phase 2B-2:

### 6.1 Frontend Changes
- No UI components or visual indicators
- No red dots, badges, or "new" markers
- No changes to how orders or items are displayed

### 6.2 API Response Changes
- No new fields in API responses
- No `hasUpdates` or `hasNewActivity` flags
- No changes to existing API contracts

### 6.3 Read/Comparison Logic
- No logic to compare `lastActivityAt` with `lastViewedAt`
- No queries to find "updated" orders or items
- No filtering based on activity timestamps

### 6.4 View Tracking Extensions
- No changes to which users have view tracking
- If internal/vendor view tracking doesn't exist, only create records as needed for the actor
- No bulk creation of view records for existing users

### 6.5 Historical Data
- No retroactive updating of activity timestamps for past events
- No migration to set activity timestamps based on historical comments or changes

### 6.6 Activity History
- No storage of activity history or audit logs
- Only the most recent activity timestamp is maintained
- No tracking of who performed which activity

---

## 7. Future Phases

Phase 2B-2 only adds the backend logic to update the activity tracking fields. Future work will be needed to (a) expose activity data in API responses and (b) build the frontend UI that compares activity timestamps against view timestamps to display 'new activity' indicators to users. These future phases are not yet planned in detail.

---

## 8. Deferred Work

The following events were originally considered for Phase 2B-2 but are deferred because the underlying functionality does not yet exist in the codebase. When these features are eventually built, the developer building them MUST also wire up activity tracking by calling the ActivityTrackingService at the appropriate point inside the operation's transaction:

- **Order-level comments** (customer-visible and internal-only): The current system only supports comments at the order item level. If order-level comments are added in the future, they should update Order.lastActivityAt (for customer-visible) and/or Order.lastInternalActivityAt.
- **Order item removal**: There is currently no endpoint to remove an order item from an order. When this feature is added, removing an item should update Order.lastActivityAt and Order.lastInternalActivityAt (because removing an item is a customer-visible event).
- **Item-level vendor assignment**: Vendor assignment currently happens only at the order level. If item-level vendor assignment is added, it should update OrderItem.lastInternalActivityAt only (internal-only event, matching the order-level vendor assignment rule).
- **Item details editing**: There is currently no endpoint to edit individual order item details. If this is added, it should update OrderItem.lastActivityAt and OrderItem.lastInternalActivityAt.

---

## Approval

**Status:** SPECIFICATION - Awaiting Review

This specification requires review and approval from Andy before proceeding to the architecture and implementation phases.

**Next Steps:**
1. Andy reviews and approves this specification
2. Architect identifies specific code locations for each event
3. Test-writer creates comprehensive test suite
4. Implementer adds activity update logic following TDD principles
5. Code review ensures all business rules are correctly implemented