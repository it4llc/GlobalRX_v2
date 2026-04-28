# Phase 4 Stage 2: Invitation Management Panel

**Date:** April 27, 2026
**Branch:** `feature/phase4-stage2-invitation-management`
**Status:** Completed

## Overview

Phase 4 Stage 2 implements the invitation management panel feature, allowing users to view and manage candidate invitation status in the order details interface. This builds on the invitation creation flow from Phase 4 Stage 1 by providing post-creation management capabilities including status monitoring, expiration extension, and invitation resending.

## Feature Summary

The invitation management panel adds:
1. **Invitation Status Section** - Displays candidate information, current status, expiration details, and last access time
2. **Action Buttons** - Extend expiration and resend invitation with permission-based access
3. **Status History Integration** - Shows invitation events alongside regular order status changes
4. **Permission Management** - Customer portal users need `candidates.invite` permission; internal/fulfillment users always have access
5. **Toast Notifications** - Success/error feedback for user actions

## Implementation Details

### New Components Created

#### InvitationStatusSection
**File:** `src/components/portal/order-details/InvitationStatusSection.tsx`

Core component that displays invitation information and provides action controls:

- **Candidate Information Display:**
  - Full name (firstName + lastName)
  - Email address
  - Phone number with country code (if provided)
  - Current status with color-coded badge
  - Expiration date (highlighted red if expired)
  - Last accessed timestamp or "Not yet accessed" placeholder

- **Status Badge Colors:**
  - `sent`: Yellow (waiting for candidate to click)
  - `opened`: Orange (candidate clicked but hasn't entered data)
  - `in_progress`: Blue (candidate is filling in data)
  - `completed`: Green (candidate submitted application)
  - `expired`: Red (invitation has expired)

- **Action Buttons:**
  - **Extend**: Available for `sent`, `opened`, `in_progress`, and `expired` statuses
  - **Resend**: Available for `sent` and `opened` statuses only
  - Both buttons disabled during processing to prevent duplicate actions

#### InvitationConfirmDialog
**File:** `src/components/portal/order-details/InvitationConfirmDialog.tsx`

Modal confirmation dialog for extend and resend actions:
- Uses the ModalDialog component from the UI library
- Dynamic title and description based on action type
- Loading state during action execution
- Cancel and confirm buttons with proper accessibility

### Type Definitions

#### invitation-management.ts
**File:** `src/types/invitation-management.ts`

Contains TypeScript interfaces for invitation management:

```typescript
export interface InvitationStatusDisplay {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
  status: 'sent' | 'opened' | 'in_progress' | 'completed' | 'expired';
  expiresAt: Date | string;
  lastAccessedAt?: Date | string | null;
  createdAt: Date | string;
}

export enum InvitationAction {
  EXTEND = 'extend',
  RESEND = 'resend'
}

export interface OrderEventDisplay {
  id: string;
  eventType?: string;
  message?: string;
  fromStatus?: string;
  toStatus?: string;
  createdAt: Date | string;
  user?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  notes?: string | null;
}
```

### API Integration

The feature leverages existing API endpoints from Phase 3:

#### Extend Invitation Endpoint
- **Endpoint:** `POST /api/candidate/invitations/[id]/extend`
- **Permission:** Customer users need `candidates.invite`; internal users always allowed
- **Function:** Resets expiration date and reverts status if expired

#### Resend Invitation Endpoint
- **Endpoint:** `POST /api/candidate/invitations/[id]/resend`
- **Permission:** Customer users need `candidates.invite`; internal users always allowed
- **Function:** Sends email again with same invitation link

### Modified Components

#### OrderDetailsSidebar (Fulfillment)
**File:** `src/components/fulfillment/OrderDetailsSidebar.tsx`

**Changes:**
- Added `candidateInvitations` field to order prop interface
- Integrated InvitationStatusSection between order info and status history
- Modified status history display to handle both regular status changes and invitation events
- Added permission check using `checkPermission('candidates', 'invite')`
- Added `onRefresh` callback for data refresh after successful actions

**Status History Enhancement:**
- Conditional rendering based on event type
- Invitation events display using translated event messages
- Regular status changes show the traditional "fromStatus → toStatus" format
- User information preserved for invitation events, anonymized for regular status changes (customer view)

#### order-details-dialog (Portal)
**File:** `src/components/portal/order-details-dialog.tsx`

**Changes:**
- Added `candidateInvitations` and `statusHistory` fields to OrderDetails interface
- Integrated InvitationStatusSection in the dialog layout
- Added status history section with invitation event support
- Implemented data refetch after successful invitation actions

#### Order Data Fetching
**File:** `src/app/api/fulfillment/orders/[id]/route.ts`

**Changes:**
- Added `candidateInvitations` include to Prisma query with selected fields:
  - Basic info: `id`, `firstName`, `lastName`, `email`
  - Contact: `phoneCountryCode`, `phoneNumber`
  - Status: `status`, `previousStatus`, `expiresAt`, `lastAccessedAt`, `createdAt`
  - Limited to 1 record (orders have at most one invitation)

#### Customer Order Permissions
**File:** `src/lib/utils/customer-order-permissions.ts`

**Changes:**
- Modified `filterDataForCustomer` function to preserve user information for invitation events
- Checks for `eventType` starting with `invitation_` to determine which events preserve user details
- Regular status changes continue to have user information anonymized for customer portal users

### Styling Enhancements

#### Toast Notifications
**File:** `src/app/globals.css`

Added comprehensive CSS classes for toast notifications to support the existing `useToast` hook:
- Container positioning (top/bottom, left/center/right variations)
- Toast appearance styling with variants (success, error, warning, info)
- Animation classes for enter/exit transitions
- Responsive design considerations

### Internationalization

#### Translation Keys Added
All translation files updated (`en-US.json`, `en-GB.json`, `es.json`, `es-ES.json`, `ja-JP.json`):

**Status Display:**
- `invitation.status.title`: "Invitation Status"
- `invitation.status.candidateName`: "Candidate Name"
- `invitation.status.email`: "Email"
- `invitation.status.phone`: "Phone"
- `invitation.status.status`: "Status"
- `invitation.status.expires`: "Expires"
- `invitation.status.lastAccessed`: "Last Accessed"
- `invitation.status.notYetAccessed`: "Not yet accessed"

**Status Values:**
- `invitation.status.sent`: "Sent"
- `invitation.status.opened`: "Opened"
- `invitation.status.inprogress`: "In Progress"
- `invitation.status.completed`: "Completed"
- `invitation.status.expired`: "Expired"

**Action Labels:**
- `invitation.action.extend`: "Extend"
- `invitation.action.resend`: "Resend"
- `invitation.action.extendConfirm`: "Are you sure you want to extend the expiration date?"
- `invitation.action.resendConfirm`: "Are you sure you want to resend the invitation email?"

**Loading States:**
- `invitation.action.extending`: "Extending..."
- `invitation.action.resending`: "Resending..."

**Success/Error Messages:**
- `invitation.action.extendSuccess`: "Expiration date extended successfully"
- `invitation.action.resendSuccess`: "Invitation email resent successfully"
- `invitation.action.extendError`: "Failed to extend expiration"
- `invitation.action.resendError`: "Failed to resend invitation"

**Event History:**
- `invitation.event.created`: "Invitation created"
- `invitation.event.extended`: "Expiration extended"
- `invitation.event.resent`: "Invitation resent"
- `invitation.event.expired`: "Invitation expired"
- `invitation.event.opened`: "Invitation opened by candidate"

## Business Logic

### Permission Control
- **Customer Portal Users:** Need `candidates.invite` permission to see action buttons
- **Internal/Fulfillment Users:** Always see action buttons as part of order management access
- **Read-Only Access:** All users can view invitation status information regardless of permissions

### Action Availability
- **Extend Button:** Available for statuses `sent`, `opened`, `in_progress`, `expired`
- **Resend Button:** Available for statuses `sent`, `opened` only
- **Completed Status:** No actions available (invitation process is complete)

### Status History Display
- **Invitation Events:** Show with translated event messages and preserve user information
- **Regular Status Changes:** Show traditional "fromStatus → toStatus" format
- **Customer View:** User information anonymized for regular status changes, preserved for invitation events
- **Internal View:** All user information visible

### Data Refresh
- After successful extend or resend actions, the invitation data refreshes automatically
- No full page reload required
- Toast notifications provide immediate feedback

## Testing Coverage

### Component Tests
- **InvitationStatusSection:** Status display, action button rendering, permission checks
- **InvitationConfirmDialog:** Dialog behavior, action confirmation, loading states

### Unit Tests
- **Customer Order Permissions:** Event filtering logic, user information preservation rules

### E2E Tests
- **Invitation Management Panel:** End-to-end workflows for extend/resend actions
- **Permission Scenarios:** Different user types and permission combinations
- **Status History Integration:** Verification of invitation events display

## Security Considerations

### Permission Enforcement
- API endpoints verify user permissions before allowing actions
- Customer users can only manage invitations for their own customer's orders
- Internal users can manage any invitation

### Data Filtering
- Customer portal users see filtered status history (user info preserved only for invitation events)
- Sensitive vendor and internal information continues to be filtered out

### Input Validation
- Invitation ID validation in API routes
- Permission checks at both component and API levels
- Error handling for invalid or expired invitations

## Performance Impact

### Database Queries
- Added `candidateInvitations` include to order fetch queries
- Minimal impact due to 1:1 relationship and selective field inclusion
- Query limited to 1 record per order (take: 1)

### UI Rendering
- Invitation section only renders when invitation exists
- Efficient re-rendering on status updates
- No impact on orders without invitations

## Browser Compatibility

All features implemented using standard React patterns and existing UI components, maintaining compatibility with the application's browser support matrix.

## Documentation Files Referenced

- **Specification:** `docs/specs/invitation-management-panel.md`
- **Technical Plan:** `docs/plans/phase4-stage2-invitation-management-technical-plan.md`

## Future Enhancements

This implementation provides the foundation for future invitation management features:
- Automated reminder emails (will require new workflow template fields)
- Bulk invitation actions
- Advanced invitation analytics
- Custom expiration periods per invitation

## Audit Relevance

No direct audit relevance - this feature enhances user experience and operational efficiency without addressing specific audit findings.

---

**Stage Complete:** Documentation pass complete for branch `feature/phase4-stage2-invitation-management`.