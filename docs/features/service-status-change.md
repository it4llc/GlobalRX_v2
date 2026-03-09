# Service Status Change Feature (Phase 2d)

## Overview
The Service Status Change feature allows internal GlobalRx users to modify the status of individual services directly from the service fulfillment interface. This capability streamlines service management workflows by providing quick access to status updates without requiring the creation of comments, while maintaining comprehensive audit trails and preventing concurrent modification conflicts.

## User Guide
This feature is designed for internal GlobalRx users managing service fulfillment operations.

### Accessing Status Changes
1. Navigate to an order details page
2. View the service fulfillment table
3. Each service displays its current status as a clickable dropdown element
4. The status appears separate from the comment creation interface

### Changing a Service Status
1. **Click the status dropdown** - The current status appears as a clickable button
2. **Select new status** - Choose from all available status options:
   - Draft
   - Submitted
   - Processing
   - Missing Information
   - Completed
   - Cancelled
   - Cancelled-DNB
3. **Provide context (optional)** - Add a comment explaining the reason for the change
4. **Confirm terminal status reopening** - If changing FROM a terminal status (Completed/Cancelled/Cancelled-DNB), confirm the action when prompted

### Order Locking
- When you open an order, it automatically locks for your use
- Other users will see a lock icon and cannot edit services while you have the lock
- Locks automatically expire after 15 minutes of inactivity
- Locks are released when you navigate away from the order

### Status Change History
- All status changes appear in the service comment timeline
- Status change entries are visually distinct from regular comments
- Each entry shows: who changed the status, when, from what to what, and any additional context

## Technical Details

### Key Files
- **API Route**: `src/app/api/services/[id]/status/route.ts` - Main status update endpoint
- **Lock Service**: `src/lib/services/order-lock.service.ts` - Order locking mechanism
- **Lock API**: `src/app/api/orders/[id]/lock/route.ts` - Lock management endpoints
- **UI Component**: `src/components/fulfillment/ServiceFulfillmentTable.tsx` - Status dropdown interface
- **Constants**: `src/constants/service-status.ts` - Status value definitions

### Database Schema
The feature uses two main database entities:

#### ServiceComment (Extended)
- `isStatusChange: boolean` - Identifies status change audit entries
- `statusChangedFrom: string` - Previous status value
- `statusChangedTo: string` - New status value
- `comment: text` - Optional user-provided context

#### OrderLock (New)
- `orderId: string` - References the locked order
- `lockedBy: string` - User ID holding the lock
- `lockedAt: timestamp` - When lock was acquired
- `lockExpires: timestamp` - When lock automatically expires

### Dependencies
- **Prisma**: Database ORM for lock and comment operations
- **Zod**: Request validation for status updates
- **NextAuth**: Authentication and permission checking
- **Winston**: Structured logging for audit trail

## Configuration

### Environment Variables
No additional environment variables are required. The feature uses existing database and authentication configuration.

### Permissions Required
- **User Type**: Internal GlobalRx users only (vendors excluded in Phase 2d)
- **Permission**: `fulfillment` permission required for status changes
- **Admin Override**: Admin users can force-release locks if needed

### Status Values
The system supports seven status values defined in `src/constants/service-status.ts`:
- **Draft** - Initial status for new services
- **Submitted** - Service submitted for processing
- **Processing** - Service is being worked on
- **Missing Information** - Additional info required from customer
- **Completed** - Service successfully finished (terminal)
- **Cancelled** - Service cancelled by request (terminal)
- **Cancelled-DNB** - Service cancelled due to "Do Not Bill" (terminal)

## Testing

### Verification Steps
1. **Status Update**: Change a service from "Draft" to "Processing" and verify:
   - Service status updates in the database
   - Audit trail entry is created with `isStatusChange: true`
   - Status change appears in comment timeline with distinct formatting

2. **Terminal Status Confirmation**: Attempt to change a "Completed" service to "Processing":
   - System should require explicit confirmation
   - Confirmation dialog should explain the action clearly
   - Status change should only proceed after confirmation

3. **Order Locking**: Open an order in one browser tab, then try to edit services in another:
   - Second tab should show lock indicator
   - Edit controls should be disabled in second tab
   - Lock should release after 15 minutes or when first tab navigates away

4. **Permission Enforcement**: Test with different user types:
   - Internal users should be able to change status
   - Vendor users should receive "Phase 2d: Internal users only" error
   - Customer users should not see status change interface

5. **Audit Trail**: Review ServiceComment records for status changes:
   - `isStatusChange` should be `true`
   - `statusChangedFrom` and `statusChangedTo` should reflect the change
   - Comment text should be auto-generated with optional user context

### Error Scenarios
- **423 Locked**: Order locked by another user
- **409 Conflict**: Terminal status confirmation required
- **403 Forbidden**: Vendor user or insufficient permissions
- **404 Not Found**: Service not found
- **400 Bad Request**: Invalid status value or malformed request

## Phase Limitations

### Phase 2d Restrictions
- **Internal Users Only**: Vendors cannot change service status (planned for future phases)
- **No Notification System**: Status changes don't trigger emails or push notifications
- **No Workflow Automation**: Status changes don't automatically reassign vendors or trigger other workflows
- **Manual Lock Management**: No automatic lock cleanup background job (relies on expiration)

### Future Enhancements (Phase 3+)
- **Vendor Status Changes**: Allow vendors to update status of their assigned services
- **Customer Visibility**: Show status change history to customers (filtered appropriately)
- **Notification Integration**: Email notifications for status changes
- **Workflow Triggers**: Automatic vendor reassignment or process triggers based on status
- **Bulk Status Updates**: Change multiple service statuses simultaneously
- **Status-Specific Permissions**: Different users can change to different status values
- **Lock Management UI**: Admin interface for viewing and managing all active locks

## Business Impact

### Benefits
1. **Faster Fulfillment**: Quick status updates without complex forms
2. **Better Audit Trail**: Complete history of all status changes with context
3. **Concurrent Safety**: Prevents data conflicts from simultaneous editing
4. **User Experience**: Intuitive interface with clear visual feedback
5. **Operational Efficiency**: Reduced time spent on administrative updates

### Metrics to Track
- **Status Change Frequency**: How often statuses are updated per service type
- **Terminal Status Reopenings**: How frequently completed work is reopened
- **Lock Conflicts**: How often users encounter locked orders
- **Context Usage**: Percentage of status changes that include explanatory comments

### Training Requirements
- Internal users need training on proper status progression workflows
- Understanding of when to use each status value appropriately
- Guidelines for providing meaningful context when changing status
- Procedures for handling locked orders and contacting lock holders if needed

## Integration Points

### Existing Systems
- **Service Fulfillment Table**: Status dropdown integrated into existing UI
- **Comment Timeline**: Status changes appear alongside regular comments
- **Permission System**: Leverages existing role-based access control
- **Audit Logging**: Uses existing Winston structured logging infrastructure

### Future Integrations
- **Notification Service**: Status changes will feed into notification system
- **Reporting Dashboard**: Status change metrics for operational insights
- **Customer Portal**: Filtered status change visibility for customers
- **Vendor Dashboard**: Status change capability for vendor-assigned services

This feature represents a significant step forward in service management capabilities while maintaining the platform's commitment to security, audit trails, and user experience.