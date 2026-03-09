# Phase 2d - Service Status Change Capability

## Overview

This feature adds the ability for internal GlobalRx users to change the status of a service directly from the service detail view. The status change is separate from adding comments - it appears as a clickable dropdown element showing the current status. When clicked, users can select a new status from all available options. Status changes are recorded in the audit trail alongside comments for complete service history visibility.

## Business Requirements

### Primary Goals
1. Enable quick status updates without requiring a comment
2. Maintain complete audit trail of all status changes
3. Support re-opening completed/cancelled services with confirmation
4. Prevent concurrent edits through order-level locking

### User Scope
- **Phase 2d**: Internal GlobalRx users only
- **Future phases**: May extend to vendors for their assigned services
- **Not included**: Customer users cannot change service status

### Status Values
All seven existing statuses are available:
- Draft
- Submitted
- Processing
- Missing Information
- Completed (terminal)
- Cancelled (terminal)
- Cancelled-DNB (terminal)

## User Flow

### Viewing Current Status
1. User opens an order (triggering order lock for this user)
2. Each service displays its current status as a clickable element
3. Status appears separate from the comment form

### Changing Status
1. User clicks on the current status
2. Dropdown menu appears with all status options
3. User selects new status
4. If changing FROM terminal status (Completed/Cancelled/Cancelled-DNB):
   - Confirmation dialog appears: "This service is currently [status]. Are you sure you want to re-open it?"
   - User must confirm or cancel
5. Status updates immediately upon selection/confirmation
6. Status change is recorded as a special ServiceComment entry
7. Change appears in comment timeline with distinct visual formatting

### Order Locking
1. When user A opens an order, all services within it are locked
2. Other users see a lock indicator and cannot edit services
3. Lock releases when user A navigates away or after timeout (15 minutes)
4. Lock can be manually released by admin users if needed

## Data Requirements

### Status Change Records (ServiceComment table)

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Status Changed To | statusChangedTo | string | Yes (for status changes) | Must be valid status enum | null |
| Previous Status | statusChangedFrom | string | Yes (for status changes) | Must be valid status enum | null |
| Is Status Change | isStatusChange | boolean | Yes | true/false | false |
| Change Reason | comment | text | No | Max 1000 chars | null |
| Changed By | userId | uuid | Yes | Must exist in users | current user |
| Changed At | createdAt | timestamp | Yes | Valid timestamp | now() |
| Service ID | orderItemId | uuid | Yes | Must exist in order_items | - |

### OrderItem Status Update

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Service Status | status | string | Yes | Valid status enum | Draft |
| Last Updated | updatedAt | timestamp | Yes | Valid timestamp | now() |
| Updated By | updatedById | uuid | Yes | Must exist in users | current user |

### Order Lock Management

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Order ID | orderId | uuid | Yes | Must exist in orders | - |
| Locked By | lockedBy | uuid | Yes | Must exist in users | - |
| Locked At | lockedAt | timestamp | Yes | Valid timestamp | now() |
| Lock Expires | lockExpires | timestamp | Yes | Must be future time | now() + 15 min |

## Business Rules

1. **Permission Check**: User must have "fulfillment" permission to change status
2. **Internal Users Only**: In Phase 2d, only internal GlobalRx users can change status (not vendors)
3. **All Statuses Available**: User can select any of the 7 status values
4. **No Transition Restrictions**: Any status can change to any other status
5. **Terminal Status Confirmation**: Changing FROM Completed/Cancelled/Cancelled-DNB requires confirmation
6. **Audit Trail Required**: Every status change creates a ServiceComment record with isStatusChange=true
7. **Visual Distinction**: Status change comments display differently than regular comments in timeline
8. **Optional Change Reason**: User can add a comment with the status change but it's not required
9. **Order Locking**: When user opens an order, all its services are locked from other users
10. **Lock Timeout**: Locks expire after 15 minutes of inactivity
11. **Lock Release**: Locks release when user navigates away from order
12. **Admin Override**: Admin users can force-release locks if needed
13. **Concurrent Prevention**: System prevents simultaneous status changes via locking
14. **Independent from Order Status**: Service status changes don't affect order status
15. **No Triggered Actions**: Status changes don't trigger notifications or assignments in Phase 2d

## Technical Requirements

### API Endpoints

#### Update Service Status
- **Method**: PUT
- **Path**: `/api/services/[serviceId]/status`
- **Request Body**:
  ```json
  {
    "status": "Processing",
    "comment": "Optional reason for change"
  }
  ```
- **Response**: Updated service with new status and audit entry

#### Order Locking
- **Lock Order**: POST `/api/orders/[orderId]/lock`
- **Release Lock**: DELETE `/api/orders/[orderId]/lock`
- **Check Lock**: GET `/api/orders/[orderId]/lock`

### Database Changes

1. **ServiceComment table additions**:
   - `isStatusChange` boolean DEFAULT false
   - `statusChangedFrom` varchar(50) NULL
   - `statusChangedTo` varchar(50) NULL

2. **New order_locks table**:
   ```sql
   CREATE TABLE order_locks (
     order_id UUID PRIMARY KEY REFERENCES orders(id),
     locked_by UUID NOT NULL REFERENCES users(id),
     locked_at TIMESTAMP NOT NULL DEFAULT NOW(),
     lock_expires TIMESTAMP NOT NULL
   );
   ```

### UI Components

1. **Status Dropdown**:
   - Displays current status
   - Click to open dropdown with all options
   - Shows lock indicator if locked by another user

2. **Confirmation Dialog**:
   - Triggered when re-opening terminal status
   - Clear warning message
   - Confirm/Cancel buttons

3. **Status Change Indicator**:
   - Special formatting in comment timeline
   - Shows: "Status changed from [X] to [Y]"
   - Different background color or icon

### System Behavior

1. **Auto-create Template**: System has built-in "Status Change" template (not user-editable)
2. **Comment Text Format**: Auto-generated as "Status changed from [previous] to [new]"
3. **User can add additional context**: Optional comment field for change reason
4. **Lock Checking**: Check lock status before allowing any service edits
5. **Lock Cleanup**: Background job to clean expired locks

## Acceptance Criteria

1. ✅ Internal users with "fulfillment" permission can change service status
2. ✅ Status appears as separate clickable element, not in comment form
3. ✅ All 7 status values available in dropdown
4. ✅ Changing from terminal status shows confirmation dialog
5. ✅ Status changes create ServiceComment with isStatusChange=true
6. ✅ Status change comments visually distinct in timeline
7. ✅ Optional comment can be added with status change
8. ✅ Opening order locks all services from other users
9. ✅ Lock indicator shows when service locked by another user
10. ✅ Locks expire after 15 minutes
11. ✅ Locks release when user navigates away
12. ✅ Admin users can force-release locks
13. ✅ Service status changes don't affect order status
14. ✅ No notifications or assignments triggered on status change
15. ✅ Audit trail shows who changed status and when

## Out of Scope for Phase 2d

- Vendor status changes (future phase)
- Customer visibility of status changes
- Triggered workflows on status change
- Email notifications
- Automatic vendor reassignment
- Status change permissions by status type
- Bulk status changes across multiple services