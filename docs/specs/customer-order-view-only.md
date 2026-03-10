# Feature Specification: Customer Order View-Only Access
**Date:** March 10, 2026
**Requested by:** Andy
**Status:** Draft

## Summary
This feature enables customers to view the detailed status and progress of their background screening orders in a read-only format. Customers will access the same fulfillment order details page that internal users use, but with appropriate restrictions on visible data and actions. This replaces the current dialog-based view with a full page experience that provides transparency into order progress while protecting sensitive internal information.

## Who Uses This
- **Customer users** (userType = 'customer'): Can view details of orders belonging to their customer account, including service statuses, non-internal comments, and status history. Cannot edit any information, create comments, or see internal-only data.
- **Internal admin/users** (existing): Continue to have full read/write access to all order information as currently implemented.
- **Vendors** (existing): Continue to have their current level of access unchanged.

## Business Rules
1. Customers can only view orders that belong to their customer account (user.customerId must match order.customerId)
2. Customers navigate to the same `/fulfillment/orders/[id]` page as internal users
3. Customers see a read-only version of the order details page with no edit capabilities
4. Customers can view comments where `isInternalOnly = false` (external comments)
5. Customers cannot view comments where `isInternalOnly = true` (internal comments)
6. Customers cannot create, edit, or delete any comments
7. Customers can see the current status of each service in the order
8. Customers can see the status history/timeline showing when statuses changed
9. Customers cannot see WHO changed the status or WHO added comments (names/emails must be anonymized or hidden)
10. Customers cannot see vendor names or vendor assignments
11. Customers cannot see vendor pricing or cost information
12. Customers cannot see internal notes fields (vendorNotes, internalNotes from ServiceFulfillment)
13. The comment count badge shows only the count of external comments visible to the customer
14. Status changes made by internal users are immediately visible to customers viewing the order
15. All timestamps shown to customers use the customer's timezone (if configured) or system default

## User Flow
1. Customer logs into the GlobalRx platform with their customer credentials
2. Customer navigates to their orders list (existing customer portal view)
3. Customer clicks on an order to view details (replaces the current dialog with navigation)
4. System navigates customer to `/fulfillment/orders/[id]` page
5. System checks that the customer has permission to view this specific order
6. If authorized, customer sees the order details page with:
   - Order header showing order number and overall status
   - Subject information section (candidate details)
   - Customer details section (their own company information)
   - Services section showing each background check service with:
     - Service name and location
     - Current status with visual indicator (color-coded badge)
     - Expandable comment section showing external comments only
     - Status history in the sidebar
7. Customer can expand each service row to view comments timeline
8. Customer sees only external comments with:
   - Comment text
   - Timestamp
   - No author information (anonymized)
9. Customer can view the status history in the sidebar showing:
   - Status changes over time
   - Timestamps of changes
   - No user information about who made changes
10. Customer cannot perform any actions - all buttons/dropdowns are hidden or disabled
11. Customer can navigate back to their orders list using the back navigation

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Order Number | orderNumber | string | Yes | Format: YYYYMMDD-XXX-NNNN | N/A |
| Order Status | statusCode | string | Yes | Valid status code | pending |
| Created Date | createdAt | datetime | Yes | ISO 8601 format | current timestamp |
| Updated Date | updatedAt | datetime | Yes | ISO 8601 format | current timestamp |
| First Name | subject.firstName | string | Yes | Max 100 chars | N/A |
| Last Name | subject.lastName | string | Yes | Max 100 chars | N/A |
| Middle Name | subject.middleName | string | No | Max 100 chars | null |
| Date of Birth | subject.dateOfBirth | date | No | Valid date, not future | null |
| Email | subject.email | string | No | Valid email format | null |
| Phone | subject.phone | string | No | Valid phone format | null |
| SSN | subject.ssn | string | No | Masked format XXX-XX-#### | null |
| Address | subject.address | string | No | Max 255 chars | null |
| City | subject.city | string | No | Max 100 chars | null |
| State | subject.state | string | No | 2-char state code | null |
| Zip Code | subject.zipCode | string | No | Valid ZIP format | null |
| Customer Name | customer.name | string | Yes | From customer record | N/A |
| Customer Code | customer.code | string | No | From customer record | null |
| Service Name | service.name | string | Yes | From service record | N/A |
| Service Category | service.category | string | No | From service record | null |
| Location Name | location.name | string | Yes | From location record | N/A |
| Location Code | location.code2 | string | No | From location record | null |
| Service Status | serviceFulfillment.status | string | Yes | Valid service status | pending |
| Assigned Date | serviceFulfillment.assignedAt | datetime | No | ISO 8601 format | null |
| Completed Date | serviceFulfillment.completedAt | datetime | No | ISO 8601 format | null |
| Comment Text | comment.finalText | string | Yes | Max 1000 chars | N/A |
| Comment Internal Flag | comment.isInternalOnly | boolean | Yes | true/false | true |
| Comment Created Date | comment.createdAt | datetime | Yes | ISO 8601 format | current timestamp |

## Edge Cases and Error Scenarios
1. **Customer tries to access an order from a different customer account**: Show 403 Forbidden error with message "You do not have permission to view this order"
2. **Customer tries to access a non-existent order**: Show 404 Not Found error with message "Order not found"
3. **Customer's session expires while viewing**: Redirect to login page, then back to order details after re-authentication
4. **Order data fails to load**: Show error message "Failed to load order details. Please try again." with retry button
5. **Comments fail to load**: Show the order details but display "Unable to load comments" in the comment section
6. **Customer attempts to manipulate URL to edit mode**: System ignores any edit parameters and shows read-only view
7. **Internal comment count is accidentally exposed**: Ensure comment count calculation excludes internal comments before display
8. **Status history fails to load**: Show order details but display "Status history unavailable" in sidebar
9. **Customer's account is deactivated while viewing**: Complete current page view but redirect to error page on next navigation
10. **Browser back button after session timeout**: Show session expired message and redirect to login

## Impact on Other Modules
1. **Authentication module**: Must properly identify customer users and their associated customerId
2. **Order API (`/api/fulfillment/orders/[id]`)**: Already supports customer access but may need to ensure proper filtering of internal data
3. **Comments API**: Already filters internal comments for customers - no changes needed
4. **Order list page**: Customer's order list view needs update to navigate to details page instead of showing dialog
5. **Permissions system**: Existing permission checks already support customer access - verified in code
6. **Status history API**: May need to anonymize user information in responses to customers
7. **ServiceFulfillmentTable component**: Already supports read-only mode but needs to hide vendor information for customers
8. **ServiceCommentSection component**: Already filters comments based on user type - working correctly

## Definition of Done
1. ✓ Customer can successfully navigate from order list to order details page
2. ✓ Customer sees full order details page at `/fulfillment/orders/[id]` route
3. ✓ All edit buttons, dropdowns, and action menus are hidden for customer users
4. ✓ Customer can only see external comments (isInternalOnly = false)
5. ✓ Internal comments are completely hidden from customer view
6. ✓ Comment count badge shows only the count of external comments
7. ✓ Customer cannot see vendor names or assignments
8. ✓ Customer cannot see internal notes fields
9. ✓ Customer cannot see who made status changes or added comments
10. ✓ Status history shows timestamps but no user information
11. ✓ Customer receives appropriate error if trying to access another customer's order
12. ✓ Page loads successfully with no console errors for customer users
13. ✓ All sensitive internal data is verified to be hidden in network responses
14. ✓ Page is responsive and works on mobile devices
15. ✓ Performance is acceptable (page loads within 3 seconds)

## Open Questions
1. **Future Enhancement - Download/Print**: Should we add a "Download PDF" or "Print" button in a future phase? What format should the PDF be in?
2. **Future Enhancement - Notifications**: When should customers receive email notifications about status changes? Only for major milestones or all changes?
3. **Future Enhancement - Estimated Completion**: Should we show estimated completion dates for each service? How would these be calculated?
4. **Status History Detail**: Should customers see all status transitions or only major ones (e.g., hide draft status)?
5. **Comment Authoring**: Should external comments show a generic "GlobalRx Team" as the author, or completely hide authorship?
6. **Mobile Experience**: Should the mobile view have a different layout optimized for smaller screens, or use the same responsive design?