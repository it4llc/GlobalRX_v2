# Feature Specification: Order Status Management
**Date:** 2026-03-12
**Requested by:** Andy
**Status:** Confirmed

## Summary
Enhance the existing order status management system to use standardized status values that match service statuses, maintain the current dropdown location in the left sidebar, and add automatic status progression when all services in an order are submitted. This ensures consistency across the platform and improves workflow automation.

## Who Uses This
- **Internal Users (GlobalRx Staff):** Can manually change order status using the dropdown in the left sidebar and view the complete audit trail
- **Customer Users:** View the current order status as read-only text in the left sidebar and see a simplified audit trail (without user names)
- **Vendor Users:** View the current order status as read-only text (no permission to change status)
- **System (Automatic):** Changes order status from "draft" to "submitted" when all services are submitted

## Business Rules
1. Order statuses must use the same seven values as services: draft, submitted, processing, missing_info, completed, cancelled, cancelled_dnb
2. Only internal users with fulfillment permissions can manually change order status
3. Customer and vendor users see status as read-only text (not a dropdown)
4. Status changes can happen in any direction without restrictions (no transition rules initially)
5. All status changes create an entry in the OrderStatusHistory table with user, timestamp, from/to status
6. When ALL services (OrderItems) in an order reach "submitted" status, the order status automatically changes from "draft" to "submitted"
7. The automatic status change happens immediately when the last service is submitted (no delay or batch processing)
8. If a service is changed back from "submitted" to another status, the order remains in its current status (no automatic reversal)
9. Status history shows changes in chronological order with newest first
10. No notes field is required for status changes at this time
11. The status dropdown remains in the left sidebar (OrderDetailsSidebar component)
12. Current color coding for statuses is sufficient (no additional visual indicators needed)

## User Flow

### Manual Status Change (Internal Users)
1. Internal user navigates to order details page at `/fulfillment/orders/[id]`
2. In the left sidebar, they see the current status displayed in a dropdown
3. User clicks the dropdown to see all seven available status options
4. User selects a new status from the list
5. System immediately updates the order status via API call to `/api/fulfillment/orders/[id]/status`
6. Dropdown shows a loading spinner during the update
7. Success toast appears: "Order status updated successfully"
8. The new status is reflected in the dropdown
9. Status History section below shows the new entry at the top with timestamp and user name

### Automatic Status Change (System)
1. User updates a service status to "submitted" via the service fulfillment interface
2. System checks if ALL services in that order now have "submitted" status
3. If all services are submitted AND the order is currently in "draft" status:
   - System automatically updates order status to "submitted"
   - Creates audit trail entry with system user as the changer
   - Note in audit: "Automatically updated - all services submitted"
4. If not all services are submitted, no order status change occurs
5. The order details page automatically reflects the new status if user is viewing it

### Read-Only Status View (Customers/Vendors)
1. Customer or vendor user navigates to order details
2. In the left sidebar, they see "Status: [Current Status]" as plain text
3. Below in Status History, they see the chronological list of status changes
4. For customers: Only timestamps are shown (no user names for privacy)
5. For vendors: Full history with user names is shown

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Order Status | statusCode | enum | Yes | One of: draft, submitted, processing, missing_info, completed, cancelled, cancelled_dnb | draft |
| Changed By | changedBy | string (userId) | Yes | Valid user ID from session | Current user |
| Change Timestamp | createdAt | datetime | Yes | ISO 8601 format | Current time |
| Previous Status | fromStatus | string | No | Previous status value | null (for initial) |
| New Status | toStatus | string | Yes | Valid status enum value | - |
| Change Reason | reason | string | No | Max 500 chars (future use) | null |
| Notes | notes | string | No | Max 500 chars (future use) | null |
| Is Automatic | isAutomatic | boolean | Yes | True for system changes | false |

## Edge Cases and Error Scenarios
- **What if network fails during status update?** Show error toast: "Failed to update order status. Please try again." Keep dropdown at original value
- **What if user loses permission mid-session?** API returns 403, show error: "You no longer have permission to update order status"
- **What if order is deleted while viewing?** API returns 404, show error: "Order not found" and redirect to orders list
- **What if multiple users try to change status simultaneously?** Last update wins, no locking required
- **What if a service status changes while calculating automatic update?** Use database transaction to ensure consistency
- **What if all services are "submitted" but order is already "processing"?** No automatic change - only affects orders in "draft" status
- **What if services are deleted from an order?** Recalculate based on remaining services
- **What if an order has no services?** Cannot automatically progress from "draft" (requires at least one service)
- **What if database is down?** Show error: "Service temporarily unavailable. Please try again later."
- **What if user refreshes during status update?** Update completes on server, new status shown after refresh

## Impact on Other Modules
- **Order Management:** Status values must be consistent with new standardized ones
- **Service Fulfillment:** Service status updates trigger order status evaluation
- **Reporting:** Reports using order status must use new values
- **API Routes:** `/api/services/[id]/status` must trigger order status check after service update
- **Customer Portal:** Must handle read-only status display
- **Status History:** Audit trail continues to function with existing implementation

## Definition of Done
1. Order status dropdown shows exactly seven status options matching service statuses
2. Status dropdown remains in left sidebar for internal users
3. Customer users see status as read-only text in left sidebar
4. All status changes create OrderStatusHistory entries with correct user and timestamp
5. API endpoint `/api/fulfillment/orders/[id]/status` accepts new status values
6. When all services reach "submitted" status, order automatically changes from "draft" to "submitted"
7. Automatic status change creates audit entry with system identifier
8. Status history displays in correct chronological order (newest first)
9. Success/error toasts appear for all status change attempts
10. Loading state shows during status updates
11. Unit tests cover automatic status progression logic
12. Integration tests verify API status updates
13. E2E tests confirm user flows for all user types
14. No console.log statements in production code
15. All status changes are logged via Winston logger

## Open Questions
None - all requirements have been confirmed by Andy.