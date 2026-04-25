# Create Invite Flow Feature

**Feature Type:** Customer Portal Enhancement
**Phase:** 4 Stage 1
**Implementation Date:** April 24, 2026
**Status:** Implemented

## Overview

The Create Invite Flow enables customer users to send background screening invitations to candidates directly from the customer portal. The feature provides a multi-step dialog interface for package selection, candidate information entry, and invitation link sharing.

## User-Facing Functionality

### Invite Candidate Button
- Located in the dashboard Quick Actions section alongside "Start New Order" and "My Orders" toggle
- Only visible to users with `candidates.invite` permission
- Opens a multi-step dialog for invitation creation

### Multi-Step Dialog Interface

**Step 1: Package Selection**
- Dropdown showing customer's packages that have active workflows
- Displays package name and description
- Only packages with `workflowId` are selectable
- Shows helpful message if no workflow-enabled packages exist

**Step 2: Candidate Information**
- Form fields for candidate details:
  - First Name (required)
  - Last Name (required)
  - Email Address (required, validated)
  - Country Code (optional, defaults to +1)
  - Phone Number (optional)
- Business rule: Country code required if phone number provided
- Uses FormTable/FormRow components for consistent styling

**Step 3: Success Screen**
- Displays success message with candidate name
- Shows invitation expiration date
- Provides copyable invitation link
- Copy-to-clipboard functionality with toast feedback

### Dashboard Enhancements
- Order list shows "Candidate Invite" badge for orders created via invitations
- Candidate invite orders cannot be edited by customers (managed by candidates)
- Grid layout adjusted to accommodate three quick action buttons

## API Endpoints

### GET /api/packages
**Purpose:** Fetch customer-specific packages for invitation flow

**Authentication:** Customer users only (verified by `session.user.customerId`)

**Query Parameters:**
- `hasWorkflow` (optional boolean): When `true`, returns only packages with active workflows

**Response Format:**
```json
[
  {
    "id": "pkg_123",
    "name": "Standard Background Check",
    "description": "Basic employment screening package",
    "hasWorkflow": true,
    "workflow": {
      "name": "Standard Workflow",
      "description": "Default screening workflow",
      "expirationDays": 30,
      "reminderEnabled": true
    }
  }
]
```

**Error Responses:**
- `401`: Not authenticated
- `403`: Not a customer user or no customerId
- `500`: Database or server error

### Integration with Existing APIs
The feature integrates with the existing `POST /api/candidate/invitations` endpoint created in Phase 3. No modifications were made to this endpoint.

## Components

### InviteCandidateDialog
**File:** `/src/components/portal/InviteCandidateDialog.tsx`

Main dialog component with multi-step state management:
- Fetches packages on mount with `hasWorkflow=true` filter
- Manages form data across steps
- Handles API integration and error states
- Provides loading indicators during operations

### InviteCandidateButton
**File:** `/src/components/portal/InviteCandidateButton.tsx`

Permission-aware button component:
- Checks `candidates.invite` permission before rendering
- Opens InviteCandidateDialog when clicked
- Styled consistently with other Quick Action buttons

### PackageSelectionStep
**File:** `/src/components/portal/PackageSelectionStep.tsx`

Step 1 of invitation flow:
- StandardDropdown component for package selection
- Displays package name and description in options
- Validates package selection before allowing proceed

### CandidateInfoStep
**File:** `/src/components/portal/CandidateInfoStep.tsx`

Step 2 of invitation flow:
- FormTable/FormRow pattern for consistent styling
- Zod validation using existing `createInvitationSchema`
- Country code dropdown with common codes (+1, +44, +86, etc.)
- Phone validation: country code required if phone provided

### InvitationSuccessStep
**File:** `/src/components/portal/InvitationSuccessStep.tsx`

Success screen with invitation details:
- Formatted expiration date display
- Copyable link field with copy button
- Navigator clipboard API integration
- Toast notifications for copy success

## TypeScript Types

### New Types in `/src/types/inviteCandidate.ts`

```typescript
export enum DialogStep {
  PackageSelection = 'package-selection',
  CandidateInfo = 'candidate-info',
  Success = 'success'
}

export interface PackageOption {
  id: string;
  name: string;
  description: string | null;
  hasWorkflow: boolean;
  workflow: WorkflowDetails | null;
}

export interface InvitationResponse {
  id: string;
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  expiresAt: string;
  orderId: string;
}

export interface DialogState {
  currentStep: DialogStep;
  isLoading: boolean;
  error: string | null;
  formData: Partial<InviteFormData>;
  packages: PackageOption[];
  invitationResult: InvitationResponse | null;
}
```

## Internationalization

Translation keys added to all language files (`en-US.json`, `en-GB.json`, `es.json`, `es-ES.json`, `ja-JP.json`):

### Dialog Navigation
- `portal.inviteCandidate.dialogTitle`
- `portal.inviteCandidate.step1Title` / `step2Title`
- `portal.inviteCandidate.stepIndicator`

### Form Labels and Validation
- Field labels: `firstNameLabel`, `lastNameLabel`, `emailLabel`, etc.
- Validation messages: `emailValidation`
- Action buttons: `nextButton`, `createButton`, `copyLinkButton`

### Success Screen
- `successTitle`, `successMessage`, `expirationMessage`
- `invitationLinkLabel`, `linkCopied`

### Error Handling
- `errorNetworkFailure`, `errorNoWorkflow`, `errorNoPermission`

## Database Integration

### No Schema Changes
The feature builds on existing database schema created in Phase 3. No new migrations were required.

### Service Modifications
**File:** `/src/lib/services/order-core.service.ts`

Added `candidateInvitations` include to order queries:
```typescript
candidateInvitations: {
  select: {
    id: true,
    status: true,
  },
  take: 1,
}
```

This allows the dashboard to identify and badge orders created via candidate invitations.

## Testing Coverage

### Unit Tests
- API route: `/src/app/api/packages/__tests__/route.test.ts` (433 lines)
- Each component has corresponding `.test.tsx` files
- Test coverage includes authentication, authorization, error handling, and success flows

### E2E Tests
- File: `/tests/e2e/create-invite-flow.spec.ts`
- Tests permission-based button visibility
- Multi-step dialog flow testing
- Package filtering and selection validation
- Form submission and success flows

## Key Implementation Patterns

### Permission-Based Rendering
Components use `canInviteCandidates` from auth-utils to conditionally render based on user permissions.

### Multi-Step State Management
Dialog state is managed through a single `DialogState` interface with step enum, preventing state inconsistencies.

### API Error Handling
Comprehensive error handling with user-friendly messages and toast notifications for network failures, permission issues, and validation errors.

### Copy-to-Clipboard Integration
Uses modern Navigator Clipboard API with fallback error handling and user feedback.

## Configuration Requirements

### Prerequisites
- Packages must have active workflows (`workflowId` not null) to appear in invitation flow
- Users must have `candidates.invite` permission to access the feature
- Customer users must have valid `customerId` in session

### Known Limitations
- Email sending is not implemented (copyable link only)
- Static country code list (not sourced from backend)
- Package filtering limited to workflow presence

## Future Enhancements

### Email Integration
The feature currently provides copyable invitation links. Email sending capability will be implemented in a future phase once workflow template integration is complete.

### Enhanced Package Filtering
Future versions may include additional package filtering options based on service types or other criteria.

### Mobile Optimization
While responsive, the multi-step dialog may benefit from mobile-specific UX improvements in future iterations.