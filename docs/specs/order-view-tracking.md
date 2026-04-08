# Feature Specification: Order View Tracking
**Spec file:** `docs/specs/order-view-tracking.md`
**Date:** 2026-04-07
**Requested by:** Andy
**Status:** Draft

## Summary
This feature tracks when customer users view orders and individual order items, storing the last viewed timestamp for each user-order and user-order-item combination. This data will be used to show users what's "new" since their last visit using visual indicators like red dots, helping them quickly identify which orders or items need their attention.

## Who Uses This
- **Customer Users** - Can view their orders and order items. The system automatically tracks when they view each order and item, storing only the most recent view timestamp.
- **System** - Automatically records view events when customer users load order details pages or click to expand order items.
- **UI Components** - Use the tracking data to display "new/unviewed" indicators on orders and items that have been updated since the user's last view.

Note: Admin users and vendor users are NOT tracked - only customer users have their views recorded.

## Business Rules
1. Only customer users (userType = 'customer' with a customerId) have their views tracked - admin and vendor views are never recorded
2. A user can only see their own view tracking data - users cannot access view data for other users
3. An order view is recorded when the order details page initially loads or when the page is refreshed
4. An order item view is recorded when the user clicks on or expands an individual item to see its details
5. Only the most recent view timestamp is stored per user-order combination (not a full history)
6. Only the most recent view timestamp is stored per user-order-item combination (not a full history)
7. If a user views the same order or item multiple times, the lastViewedAt timestamp is updated to the most recent view
8. View tracking data is kept indefinitely - there is no automatic cleanup or expiration
9. View tracking happens synchronously when the page loads or item is clicked
10. If a user has never viewed an order or item, no record exists (absence of a record means never viewed)
11. View timestamps should use UTC time for consistency across time zones
12. The system must handle concurrent updates gracefully if a user has multiple tabs open

## User Flow

### Viewing an Order
1. A customer user logs into the portal
2. The user navigates to their orders list
3. The user clicks on an order to view its details
4. The order details page loads, showing all information about the order
5. Behind the scenes, the system immediately creates or updates an order_views record with the current timestamp
6. If this is the user's first time viewing this order, a new record is created
7. If the user has viewed this order before, the existing record's lastViewedAt is updated
8. The user can refresh the page, which updates the lastViewedAt timestamp again

### Viewing an Order Item
1. While on the order details page, the user sees a list of order items
2. The user clicks on a specific order item to expand its details or view more information
3. The item details are displayed (either inline expansion or in a modal)
4. Behind the scenes, the system immediately creates or updates an order_item_views record
5. If this is the user's first time viewing this item, a new record is created
6. If the user has viewed this item before, the existing record's lastViewedAt is updated
7. Each item click is tracked independently - viewing one item doesn't mark others as viewed

### Using View Tracking for "New" Indicators
1. When a user returns to their orders list, the system compares order updatedAt timestamps with the user's lastViewedAt for each order
2. Orders updated after the user's last view show a red dot or "new" badge
3. Similarly, on the order details page, items updated after the user's last view of that specific item show indicators
4. These indicators disappear once the user views the updated content

## Data Requirements

### Table: order_views

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| — | id | text | Required | UUID format | Auto-generated UUID |
| — | userId | text | Required | Must be a valid user ID from users table | — |
| — | orderId | text | Required | Must be a valid order ID from orders table | — |
| Last Viewed | lastViewedAt | date | Required | ISO 8601 datetime in UTC | Current UTC timestamp |
| — | createdAt | date | Required | ISO 8601 datetime in UTC | Current UTC timestamp |
| — | updatedAt | date | Required | ISO 8601 datetime in UTC | Current UTC timestamp |

### Table: order_item_views

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| — | id | text | Required | UUID format | Auto-generated UUID |
| — | userId | text | Required | Must be a valid user ID from users table | — |
| — | orderItemId | text | Required | Must be a valid order item ID from order_items table | — |
| Last Viewed | lastViewedAt | date | Required | ISO 8601 datetime in UTC | Current UTC timestamp |
| — | createdAt | date | Required | ISO 8601 datetime in UTC | Current UTC timestamp |
| — | updatedAt | date | Required | ISO 8601 datetime in UTC | Current UTC timestamp |

### Database Indexes Required:
- order_views: Compound index on (userId, orderId) for fast lookups and uniqueness
- order_views: Index on userId for fetching all orders viewed by a user
- order_views: Index on orderId for finding all users who viewed an order
- order_item_views: Compound index on (userId, orderItemId) for fast lookups and uniqueness
- order_item_views: Index on userId for fetching all items viewed by a user
- order_item_views: Index on orderItemId for finding all users who viewed an item

## Edge Cases and Error Scenarios

1. **Non-customer user attempts to trigger view tracking** - System should silently skip tracking without throwing an error
2. **Invalid orderId or orderItemId provided** - Should log a warning but not crash the page load
3. **Database connection fails during view recording** - Page should still load normally; view tracking failure should not block the user from seeing content
4. **User views an order that gets deleted** - View records should cascade delete with the order
5. **User views an order item that gets deleted** - View records should cascade delete with the order item
6. **Race condition with multiple tabs** - Last write wins; most recent timestamp is kept
7. **User's account is deleted** - All their view tracking records should cascade delete
8. **User is converted from customer to admin type** - Existing view records remain but no new tracking occurs
9. **Timezone differences** - All timestamps stored in UTC; UI responsible for local display conversion

## Impact on Other Modules

1. **Order Details Page** - Must trigger view tracking on page load and handle tracking API errors gracefully
2. **Order Items Component** - Must trigger item view tracking on click/expand events
3. **Orders List Page** - Must fetch and compare view tracking data to show "new" indicators
4. **User Deletion Process** - Must cascade delete all view tracking records when a user is removed
5. **Order/OrderItem Deletion** - Must cascade delete related view tracking records
6. **API Rate Limiting** - View tracking endpoints should have appropriate rate limits to prevent abuse
7. **Database Migrations** - Need to create two new tables with proper foreign keys and indexes
8. **Performance Monitoring** - Should track the impact of view recording on page load times

## Definition of Done

1. Database migration created with order_views and order_item_views tables
2. All required indexes are created for optimal query performance
3. API endpoint exists to record an order view for the current user
4. API endpoint exists to record an order item view for the current user
5. API endpoint exists to fetch view tracking data for the current user's orders
6. API endpoint exists to fetch view tracking data for the current user's order items
7. View tracking only occurs for customer users (userType = 'customer')
8. Order details page successfully records views on load and refresh
9. Order item clicks successfully record item views
10. Users can only access their own view tracking data
11. Cascade deletes work correctly for users, orders, and order items
12. All timestamps are stored in UTC format
13. Concurrent updates are handled without errors
14. View tracking failures don't prevent pages from loading
15. Unit tests cover all business rules and edge cases
16. Integration tests verify end-to-end view tracking flow
17. Documentation updated with new API endpoints

## Open Questions

None - all requirements have been clarified and confirmed.