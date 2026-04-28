# Technical Plan: Invitation Management Panel (Phase 4 Stage 2)
**Based on specification:** invitation-management-panel.md
**Date:** April 26, 2026

## Database Changes
No database changes are needed. All required fields exist in the `CandidateInvitation` model from Phase 3.

## New Files to Create

### 1. /src/components/portal/order-details/InvitationStatusSection.tsx
- Purpose: Component displaying invitation status and action buttons in order details
- What it will contain:
  - Display of candidate name, email, phone, status badge, expiration date, last accessed date
  - Extend and Resend action buttons with permission checks
  - Confirmation dialogs for actions
  - Loading states and error handling
  - Data refresh after successful actions

### 2. /src/components/portal/order-details/InvitationActionButton.tsx  
- Purpose: Reusable button component for invitation actions
- What it will contain:
  - Button with loading state
  - Disabled state logic based on invitation status
  - Icon and label props
  - onClick handler prop

### 3. /src/components/portal/order-details/InvitationConfirmDialog.tsx
- Purpose: Confirmation dialog for extend/resend actions
- What it will contain:
  - Modal dialog with action type prop
  - Dynamic title and message based on action
  - Cancel and confirm buttons
  - Loading state during action execution

### 4. /src/types/invitation-management.ts
- Purpose: TypeScript types for invitation management UI
- What it will contain:
  - InvitationStatus type with all display fields
  - InvitationAction enum (extend, resend)
  - InvitationStatusSectionProps interface
  - ActionButtonProps interface

## Existing Files to Modify

### 1. /src/components/fulfillment/OrderDetailsSidebar.tsx
- What currently exists: Order details sidebar with status history section (lines 309-334)
- What needs to change:
  - Add InvitationStatusSection import
  - Add candidateInvitation to order prop type (line 32)
  - Insert InvitationStatusSection between order info (line 213) and Status History section (line 309)
  - Modify Status History section to handle invitation events with eventType/message format
- **Confirmed by reading:** Yes, this file was read and analyzed

### 2. /src/components/portal/order-details-dialog.tsx
- What currently exists: Portal version of order details dialog (lines 1-302)
- What needs to change:
  - Add InvitationStatusSection import
  - Add candidateInvitation field to OrderDetails interface (line 26)
  - Insert InvitationStatusSection between order header (line 173) and subject details (line 175)
- **Confirmed by reading:** Yes, this file was read and analyzed

### 3. /src/app/api/fulfillment/orders/[id]/route.ts
- What currently exists: Order fetch endpoint without candidateInvitation include (lines 208-268)
- What needs to change:
  - Add candidateInvitation to the baseInclude object after line 252:
    ```typescript
    candidateInvitations: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneCountryCode: true,
        phoneNumber: true,
        status: true,
        previousStatus: true,
        expiresAt: true,
        lastAccessedAt: true,
        createdAt: true
      },
      take: 1
    }
    ```
- **Confirmed by reading:** Yes, this file was read and analyzed

### 4. /src/app/api/portal/orders/[id]/route.ts
- What currently exists: Portal order fetch endpoint (needs verification)
- What needs to change:
  - Add candidateInvitation include similar to fulfillment endpoint
  - Ensure candidateInvitations relation is included in Prisma query

### 5. /src/translations/en-US.json
- What currently exists: Translation keys for the application
- What needs to change:
  - Add new keys for invitation management UI (see Translation Keys section)
- **Confirmed by reading:** Translation file structure was verified

### 6. /src/translations/es.json, es-ES.json, en-GB.json, ja-JP.json
- What currently exists: Other language translation files
- What needs to change:
  - Add corresponding translations for new keys

## API Routes

All API routes already exist from Phase 3 and are working:

### POST /api/candidate/invitations/[id]/extend
- Full path: `/api/candidate/invitations/[id]/extend`
- HTTP methods: POST
- Authentication: Requires session
- Permission required: `candidates.invite` for customer users, always allowed for internal/fulfillment users
- Input data: None (id in path)
- Returns on success: Updated invitation object
- Errors handled: 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (completed status)

### POST /api/candidate/invitations/[id]/resend  
- Full path: `/api/candidate/invitations/[id]/resend`
- HTTP methods: POST
- Authentication: Requires session
- Permission required: `candidates.invite` for customer users, always allowed for internal/fulfillment users
- Input data: None (id in path)
- Returns on success: Success message with email details
- Errors handled: 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (invalid status)

## Zod Validation Schemas

No new Zod schemas needed - existing invitation APIs don't require request body validation.

## TypeScript Types

### /src/types/invitation-management.ts

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

export interface InvitationStatusSectionProps {
  invitation: InvitationStatusDisplay;
  canManageInvitations: boolean;
  onActionSuccess?: () => void;
}

export interface InvitationActionButtonProps {
  action: InvitationAction;
  invitationId: string;
  disabled?: boolean;
  onSuccess?: () => void;
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

## UI Components

### 1. InvitationStatusSection (new)
- Full file path: `/src/components/portal/order-details/InvitationStatusSection.tsx`
- Client component (`"use client"`)
- What it renders:
  - Section title "Invitation Status"
  - Grid layout with candidate info fields
  - Status badge using appropriate colors (reuse pattern from order status badges)
  - Expiration date with visual highlight if expired (red text)
  - Last accessed date or "Not yet accessed" placeholder
  - Extend and Resend buttons based on status and permissions
- Which existing UI components it uses:
  - No ModalDialog needed - use inline confirmation pattern
  - Badge pattern from existing status badges
- Which API routes it calls:
  - POST `/api/candidate/invitations/[id]/extend`
  - POST `/api/candidate/invitations/[id]/resend`

### 2. InvitationActionButton (new)
- Full file path: `/src/components/portal/order-details/InvitationActionButton.tsx`
- Client component (`"use client"`)
- What it renders:
  - Button with icon and text
  - Loading spinner during action
  - Disabled state styling
- Uses native button element with Tailwind classes

### 3. InvitationConfirmDialog (new)
- Full file path: `/src/components/portal/order-details/InvitationConfirmDialog.tsx`
- Client component (`"use client"`)
- What it renders:
  - Confirmation prompt with dynamic message
  - Cancel and Confirm buttons
  - Loading state overlay
- Uses Dialog component from `@/components/ui/dialog`

### 4. OrderDetailsSidebar (modified)
- Full file path: `/src/components/fulfillment/OrderDetailsSidebar.tsx`
- Server component (no change)
- What changes:
  - Add InvitationStatusSection between existing sections
  - Update Status History section to handle eventType/message format
  - Check for both fromStatus/toStatus (status changes) and eventType/message (events)

### 5. order-details-dialog (modified)
- Full file path: `/src/components/portal/order-details-dialog.tsx`  
- Client component (no change)
- What changes:
  - Add InvitationStatusSection after order header
  - Pass candidateInvitation data to the component

## Translation Keys

New keys to add to all translation files:

```json
{
  "invitation.status.title": "Invitation Status",
  "invitation.status.candidateName": "Candidate Name",
  "invitation.status.email": "Email",
  "invitation.status.phone": "Phone",
  "invitation.status.status": "Status",
  "invitation.status.expires": "Expires",
  "invitation.status.lastAccessed": "Last Accessed",
  "invitation.status.notYetAccessed": "Not yet accessed",
  "invitation.status.sent": "Sent",
  "invitation.status.opened": "Opened",
  "invitation.status.inProgress": "In Progress",
  "invitation.status.completed": "Completed",
  "invitation.status.expired": "Expired",
  "invitation.action.extend": "Extend",
  "invitation.action.resend": "Resend",
  "invitation.action.extendConfirm": "Are you sure you want to extend the expiration date?",
  "invitation.action.resendConfirm": "Are you sure you want to resend the invitation email?",
  "invitation.action.extending": "Extending...",
  "invitation.action.resending": "Resending...",
  "invitation.action.extendSuccess": "Expiration date extended successfully",
  "invitation.action.resendSuccess": "Invitation email resent successfully",
  "invitation.action.extendError": "Failed to extend expiration",
  "invitation.action.resendError": "Failed to resend invitation",
  "invitation.event.created": "Invitation created",
  "invitation.event.extended": "Expiration extended",
  "invitation.event.resent": "Invitation resent",
  "invitation.event.expired": "Invitation expired",
  "invitation.event.opened": "Invitation opened by candidate"
}
```

## Order of Implementation

1. **Database schema changes** - None needed
2. **Prisma migration** - None needed  
3. **TypeScript types** - Create `/src/types/invitation-management.ts`
4. **Zod schemas** - None needed
5. **API routes** - Modify existing order fetch endpoints to include candidateInvitations
6. **UI components** - Create new components and modify existing ones
7. **Translation keys** - Add to all language files

Detailed implementation sequence:
1. Create TypeScript types file
2. Update `/src/app/api/fulfillment/orders/[id]/route.ts` to include candidateInvitations
3. Update `/src/app/api/portal/orders/[id]/route.ts` to include candidateInvitations
4. Create `InvitationActionButton` component
5. Create `InvitationConfirmDialog` component  
6. Create `InvitationStatusSection` component
7. Modify `OrderDetailsSidebar` to include invitation section and handle event types
8. Modify `order-details-dialog` to include invitation section
9. Add all translation keys to language files

## Risks and Considerations

1. **Status History Event Display**: The current Status History section only handles fromStatus/toStatus format. Need to update to check for eventType and display message field for invitation events. This requires careful conditional rendering logic.

2. **Permission Logic Complexity**: Customer portal users need `candidates.invite` permission for action buttons, but internal/fulfillment users should always see them. Need clear conditional logic to avoid confusion.

3. **Data Refresh Pattern**: After successful extend/resend actions, need to refresh the invitation data without full page reload. Consider using SWR or React Query pattern, or manual refetch.

4. **Phone Number Display**: Phone numbers should display with country code prefix. Need to handle cases where phone is null/undefined gracefully.

5. **Expired Status Handling**: When extending an expired invitation, the status reverts to previousStatus. UI must refresh to show the new status correctly.

6. **Race Conditions**: Multiple rapid clicks on action buttons could cause duplicate API calls. Buttons must be disabled during action processing.

7. **Order Fetch Performance**: Adding candidateInvitations include to order queries adds a small overhead. Since it's a 1:1 relationship with `take: 1`, impact should be minimal.

8. **Translation Consistency**: New translation keys must be added to all 5 language files to avoid missing text issues.

## Plan Completeness Check

Confirm:
- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified  
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table (field names match)

## Notes

- All backend APIs from Phase 3 are working and tested - no backend changes needed
- The invitation management section only appears for orders with linked invitations
- Status badge colors should follow existing pattern (yellow=sent, orange=opened, blue=in_progress, green=completed, red=expired)
- Event history logging is automatic from the backend - no additional logging code needed
- The existing Order Status History component needs modification to display invitation events properly
