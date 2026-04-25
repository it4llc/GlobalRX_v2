# Technical Plan: Create Invite Flow (Phase 4 Stage 1)
**Based on specification:** docs/specs/create-invite-flow.md (April 23, 2026)
**Date:** April 24, 2026

## Database Changes
No database changes are required for this stage. The feature builds on the existing database schema and POST /api/candidate/invitations endpoint created in Phase 3.

## New Files to Create

### /src/app/api/packages/route.ts
- **Purpose**: Customer-specific packages API endpoint for invitation flow
- **Content**: GET endpoint to fetch current customer's packages with workflow filter
- **Authentication**: Customer users only (uses session.user.customerId)
- **Input**: Optional query parameter `hasWorkflow=true` to filter packages with active workflows
- **Output**: Array of package objects with id, name, description, and hasWorkflow flag
- **Errors**: 401 (unauthorized), 403 (forbidden), 500 (server error)

### /src/components/portal/InviteCandidateDialog.tsx
- Purpose: Multi-step dialog for creating candidate invitations
- Content: Main dialog component with package selection and candidate info steps
- Client component with multi-step state management

### /src/components/portal/PackageSelectionStep.tsx
- Purpose: Step 1 of invitation dialog - package selection
- Content: Package dropdown with name and description display
- Filters packages to only show those with active workflows

### /src/components/portal/CandidateInfoStep.tsx
- Purpose: Step 2 of invitation dialog - candidate information form
- Content: Form fields for firstName, lastName, email, phone country code, phone number
- Uses FormTable/FormRow pattern with inline validation

### /src/components/portal/InvitationSuccessStep.tsx
- Purpose: Success screen showing invitation details and copyable link
- Content: Success message, candidate details, expiration date, copyable invitation link
- Copy-to-clipboard functionality with toast feedback

### /src/types/inviteCandidate.ts
- Purpose: TypeScript type definitions for invitation flow
- Content: Form data types, step enums, dialog state interfaces

## Existing Files to Modify

### /src/app/portal/dashboard/page.tsx
- Current content: Dashboard with stats grid, quick actions section, and orders list
- Modifications needed:
  - Add "Invite Candidate" button to Quick Actions section (lines 301-329)
  - Import and integrate InviteCandidateDialog component
  - Add permission check for candidates.invite using canInviteCandidates from auth-utils
  - Button only appears if user has permission
- Confirmation: File was read and examined - current Quick Actions section contains "Start New Order" button

### /src/lib/auth-utils.ts
- Current content: Permission checking functions including canInviteCandidates
- Modifications needed: No changes - canInviteCandidates function already exists and is imported
- Confirmation: File exists and contains the required permission function

### Translation Files (all must be updated with new keys)
- `/src/translations/en-US.json` - Primary English translation file
- `/src/translations/en-GB.json` - British English translation file
- `/src/translations/es.json` - Spanish translation file
- `/src/translations/es-ES.json` - Spain Spanish translation file
- `/src/translations/ja-JP.json` - Japanese translation file

**Modifications needed**: Add all translation keys listed in the "Translation Keys" section to each file. Keys must be added to the appropriate nested structure (e.g., `portal.inviteCandidate.dialogTitle`, `common.inviteCandidate`).

## API Routes

### New API Endpoint: GET /api/packages
- **Method**: GET
- **Authentication**: Required - customer users only
- **Authorization**: Uses session.user.customerId to restrict to own packages
- **Query Parameters**:
  - `hasWorkflow` (optional): boolean - if true, only returns packages with active workflows
- **Response Format**:
  ```typescript
  {
    id: string;
    name: string;
    description: string | null;
    hasWorkflow: boolean;
  }[]
  ```
- **Error Responses**:
  - 401: Not authenticated
  - 403: Not a customer user or no customerId
  - 500: Database or server error

### Existing API Integration: POST /api/candidate/invitations
The feature uses the existing POST /api/candidate/invitations endpoint from Phase 3. No new API routes are needed beyond the packages endpoint above.
- HTTP methods: POST
- Authentication: Customer user with candidates.invite permission
- Input validation: Uses existing createInvitationSchema from /src/lib/validations/candidateInvitation.ts
- Success response: Returns invitation object with token, firstName, lastName, email, expiresAt, orderId
- Error handling: Returns appropriate status codes (400, 403, 404, 422, 500) with error messages

## Email Sending Status

Based on examination of `/src/lib/services/candidate-invitation.service.ts`, the existing POST /api/candidate/invitations endpoint from Phase 3 **does not send emails**. The service includes this explicit comment:

```typescript
// Note: Actual email sending will be implemented in a future phase
```

**Decision**: Email sending is **explicitly deferred to a later phase** as indicated by the existing codebase architecture. Phase 4 Stage 1 focuses solely on the UI for creating invitations and displaying the copyable invitation link. The customer will manually share the link with candidates until email functionality is implemented in a subsequent phase.

**Rationale**:
1. The Phase 3 foundation was specifically designed to separate invitation creation from email delivery
2. The spec mentions "Send invitation emails using workflow templates" in the overall phase description, but this is a future capability
3. The current stage is UI-only with "No new API endpoints" as specified (except for the packages list endpoint)
4. Email sending requires workflow template integration which is not in scope for this UI-focused stage

## Zod Validation Schemas
Uses existing schemas from /src/lib/validations/candidateInvitation.ts:

### createInvitationSchema (existing)
- packageId: string (UUID, required)
- firstName: string (min 1, max 100 chars, required)
- lastName: string (min 1, max 100 chars, required)
- email: string (email format, required)
- phoneCountryCode: string (max 5 chars, optional)
- phoneNumber: string (max 20 chars, optional)
- Business rule: phoneCountryCode required if phoneNumber provided

## TypeScript Types
New types needed in /src/types/inviteCandidate.ts:

### InviteFormData (z.infer<typeof createInvitationSchema>)
- Derived from existing createInvitationSchema
- Used for form state management

### DialogStep
- Enum: 'package-selection' | 'candidate-info' | 'success'
- Controls which step of the dialog is displayed

### PackageOption
- id: string (package ID)
- name: string (package name)
- description: string (package description)
- hasWorkflow: boolean (whether package has active workflow)

### InvitationResponse
- Fields from API response: id, token, firstName, lastName, email, expiresAt, orderId
- Used for success step display

### DialogState
- currentStep: DialogStep
- isLoading: boolean
- error: string | null
- formData: Partial<InviteFormData>
- packages: PackageOption[]
- invitationResult: InvitationResponse | null

## UI Components

### InviteCandidateDialog (Client Component)
- Uses ModalDialog with declarative open prop
- Multi-step state management with currentStep enum
- Fetches packages on mount, filters for those with workflows
- Handles form submission and API integration
- Shows loading states during API calls
- Toast notifications for errors and success

### PackageSelectionStep (Client Component)
- Uses StandardDropdown component for package selection
- Displays package name and description in dropdown options
- Validation: package selection required to proceed
- "Next" button advances to candidate info step

### CandidateInfoStep (Client Component)
- Uses FormTable/FormRow components following form standards
- Required fields: firstName, lastName, email (marked with red asterisk)
- Optional fields: phoneCountryCode (dropdown with +1 default), phoneNumber
- Country codes: Static list of common codes (+1, +44, +86, etc.)
- Email validation using HTML input type="email" and Zod schema
- Phone validation: if phoneNumber provided, phoneCountryCode required
- "Create Invitation" button with loading state

### InvitationSuccessStep (Client Component)
- Success icon and message
- Displays candidate full name and email
- Shows expiration date formatted as readable date
- Copyable invitation link field with "Copy Link" button
- Copy functionality using navigator.clipboard.writeText()
- Toast notification "Link copied to clipboard" on successful copy
- "Done" button closes dialog

## Translation Keys
All new user-facing text requires translation keys in /src/translations/ files:

### Dialog and Navigation
- `portal.inviteCandidate.dialogTitle`: "Invite Candidate"
- `portal.inviteCandidate.step1Title`: "Select Package"
- `portal.inviteCandidate.step2Title`: "Candidate Information"
- `portal.inviteCandidate.stepIndicator`: "Step {step} of 2"

### Package Selection
- `portal.inviteCandidate.packageLabel`: "Package"
- `portal.inviteCandidate.packagePlaceholder`: "Select a package"
- `portal.inviteCandidate.noPackages`: "No packages available. Please contact your administrator to set up packages with workflows."
- `portal.inviteCandidate.nextButton`: "Next"

### Candidate Information Form
- `portal.inviteCandidate.firstNameLabel`: "First Name"
- `portal.inviteCandidate.lastNameLabel`: "Last Name"
- `portal.inviteCandidate.emailLabel`: "Email Address"
- `portal.inviteCandidate.phoneCountryCodeLabel`: "Phone Country Code"
- `portal.inviteCandidate.phoneNumberLabel`: "Phone Number"
- `portal.inviteCandidate.createButton`: "Create Invitation"
- `portal.inviteCandidate.emailValidation`: "Please enter a valid email address"

### Success Screen
- `portal.inviteCandidate.successTitle`: "Invitation Created Successfully"
- `portal.inviteCandidate.successMessage`: "Invitation sent to {firstName} {lastName} at {email}"
- `portal.inviteCandidate.expirationMessage`: "This invitation expires on {date}"
- `portal.inviteCandidate.invitationLinkLabel`: "Invitation Link"
- `portal.inviteCandidate.copyLinkButton`: "Copy Link"
- `portal.inviteCandidate.linkCopied`: "Link copied to clipboard"
- `portal.inviteCandidate.doneButton`: "Done"

### Error Messages
- `portal.inviteCandidate.errorNetworkFailure`: "Unable to create invitation. Please check your connection and try again."
- `portal.inviteCandidate.errorNoWorkflow`: "This package does not have a workflow configured. Please contact your administrator."
- `portal.inviteCandidate.errorNoPermission`: "You don't have permission to create invitations."

### Button Text
- `common.inviteCandidate`: "Invite Candidate"

## Order of Implementation
1. **Create API endpoint** `/src/app/api/packages/route.ts`
2. **Create TypeScript types** in `/src/types/inviteCandidate.ts`
3. **Create success step component** `/src/components/portal/InvitationSuccessStep.tsx`
4. **Create candidate info step component** `/src/components/portal/CandidateInfoStep.tsx`
5. **Create package selection step component** `/src/components/portal/PackageSelectionStep.tsx`
6. **Create main dialog component** `/src/components/portal/InviteCandidateDialog.tsx`
7. **Update dashboard page** to add button and integrate dialog
8. **Add translation keys** to all language files in `/src/translations/`

## Risks and Considerations

### Technical Concerns
- **Package API dependency**: Addressed by creating GET /api/packages endpoint
- **Country code list**: Using static list initially; may need to source from backend in future
- **Multi-step state management**: Complex client-side state; ensure proper cleanup on dialog close
- **Error boundary**: Consider wrapping dialog in error boundary for unexpected failures

### Integration Points
- **Permission system**: Relies on existing canInviteCandidates function working correctly
- **API compatibility**: Depends on Phase 3 API endpoint being stable and tested
- **Dashboard layout**: Button placement in Quick Actions section must not break responsive design
- **Toast system**: Needs to integrate with existing toast/notification system

### UX Considerations
- **Package filtering**: Empty package list should show helpful message, not broken UI
- **Form validation**: Inline validation timing must feel responsive but not annoying
- **Loading states**: All async operations need clear loading indicators
- **Error recovery**: Users should be able to retry failed operations without losing form data

### Testing Strategy
- **Component isolation**: Each step component should be unit testable in isolation
- **Integration testing**: Full dialog flow should be tested end-to-end
- **Permission testing**: Verify button visibility based on user permissions
- **API error testing**: Test all error scenarios from API (404, 422, 500, etc.)
- **Responsive testing**: Verify dialog works on mobile and desktop screen sizes

## Plan Completeness Check
- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All TypeScript types and translation keys are listed
- [x] The plan follows the spec's data requirements exactly (field names match)
- [x] Component architecture follows established patterns (ModalDialog, FormTable, StandardDropdown)
- [x] Integration with existing API endpoint is properly defined
- [x] Error handling strategy addresses all spec requirements
- [x] Multi-step workflow is broken down into manageable components
- [x] Package fetching API endpoint is fully specified
- [x] All translation files are listed with exact paths
- [x] Email sending clarification is provided with justification

The plan is ready for the test-writer to proceed with creating comprehensive tests for each component and the integration flow.