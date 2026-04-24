# Technical Plan: Candidate Invite Permission
**Based on specification:** candidates-invite-permission.md (April 23, 2026)
**Date:** April 23, 2026

## Database Changes
No database changes are needed. The permission will be stored in the existing User.permissions JSON field.

## New Files to Create
None. All changes will be made to existing files.

## Existing Files to Modify

### 1. /Users/andyhellman/Projects/GlobalRx_v2/src/lib/auth-utils.ts
- **Current:** Contains permission check functions like `canManageCandidateInvitations()` which checks broader invitation management capabilities
- **Change:** Add new function `canInviteCandidates()` to check the specific `candidates.invite` permission
- **Why:** Spec requirement to add a separate permission for creating invitations vs managing them
- **Confirmed:** File was read and reviewed

### 2. /Users/andyhellman/Projects/GlobalRx_v2/src/components/modules/user-admin/user-form.tsx
- **Current:** Contains permission checkboxes for user_admin, global_config, customer_config, vendors, fulfillment, comment_management
- **Change:** Add a new "Candidate Invitations" checkbox for the `candidates.invite` permission in the permissions grid
- **Why:** Spec requirement to allow admins to grant this permission through the UI
- **Confirmed:** File was read and reviewed

### 3. /Users/andyhellman/Projects/GlobalRx_v2/src/components/customer-config/customer-user-edit-form.tsx
- **Current:** Contains permission checkboxes for customer users (orders and user management)
- **Change:** Add a new "Candidate Invitations" checkbox under a new "Candidate Management" section
- **Why:** Customer users need to be able to have this permission granted
- **Confirmed:** File was read and reviewed

### 4. /Users/andyhellman/Projects/GlobalRx_v2/src/components/customer-config/customer-user-form.tsx
- **Current:** Contains permission checkboxes for creating new customer users (orders and user management)
- **Change:** Add a new "Candidate Invitations" checkbox under a new "Candidate Management" section
- **Why:** Consistency with the edit form and to allow setting permission when creating users
- **Confirmed:** File was read and reviewed

### 5. /Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/invitations/route.ts
- **Current:** Uses `canManageCandidateInvitations()` to check permission for creating invitations
- **Change:** Replace `canManageCandidateInvitations()` with `canInviteCandidates()` for the permission check
- **Why:** The spec requires using the new specific permission for creating invitations
- **Confirmed:** File was read and reviewed

## API Routes
### POST /api/candidate/invitations (modified)
- **Path:** /api/candidate/invitations
- **Method:** POST  
- **Authentication:** Required - now checks `candidates.invite` permission via `canInviteCandidates()`
- **Input:** No changes to input data
- **Returns:** No changes to return data
- **Errors:** Change error message to "You don't have permission to create invitations" per spec

## Zod Validation Schemas
No new Zod schemas needed. Existing validation remains unchanged.

## TypeScript Types

### user-form.tsx types (modified)
The existing User and FormValues types in user-form.tsx need to be updated to include the `candidates.invite` permission in the permissions object.

### customer-user-form.tsx and customer-user-edit-form.tsx types (modified)
The FormValues interface in both files needs to be updated to add `inviteCandidates: boolean` to the permissions object.

## UI Components

### user-form.tsx (modified)
- **Path:** /Users/andyhellman/Projects/GlobalRx_v2/src/components/modules/user-admin/user-form.tsx
- **Type:** Client component (`"use client"`)
- **Changes:** 
  - Add `candidates_invite: boolean` to FormValues permissions type
  - Add checkbox for "Candidate Invitations" permission in the permission grid
  - Handle the permission in state management and form submission
- **Renders:** Additional checkbox in permissions grid
- **API calls:** No changes to API calls

### customer-user-edit-form.tsx (modified)
- **Path:** /Users/andyhellman/Projects/GlobalRx_v2/src/components/customer-config/customer-user-edit-form.tsx
- **Type:** Client component (`"use client"`)
- **Changes:** 
  - Add `inviteCandidates: boolean` to FormValues permissions interface
  - Add "Candidate Management" section with "Candidate Invitations" checkbox
  - Update form submission to include `candidates: { invite: boolean }` in permissions
- **Renders:** Additional section with checkbox in permissions area
- **API calls:** No changes to API calls

### customer-user-form.tsx (modified)
- **Path:** /Users/andyhellman/Projects/GlobalRx_v2/src/components/customer-config/customer-user-form.tsx
- **Type:** Client component (`"use client"`)
- **Changes:** 
  - Add `inviteCandidates: boolean` to FormValues permissions interface
  - Add "Candidate Management" section with "Candidate Invitations" checkbox
  - Update form submission to include `candidates: { invite: boolean }` in permissions
- **Renders:** Additional section with checkbox in permissions area
- **API calls:** No changes to API calls

## Translation Keys
No new translation keys are needed. The UI label "Candidate Invitations" will be hardcoded like other permission labels in the existing forms.

## Order of Implementation
1. Add `canInviteCandidates()` function to `/src/lib/auth-utils.ts`
2. Update permission check in `/src/app/api/candidate/invitations/route.ts` to use the new function
3. Add "Candidate Invitations" checkbox to `/src/components/modules/user-admin/user-form.tsx`
4. Add "Candidate Invitations" checkbox to `/src/components/customer-config/customer-user-form.tsx`
5. Add "Candidate Invitations" checkbox to `/src/components/customer-config/customer-user-edit-form.tsx`

## Risks and Considerations

1. **Permission Migration:** Existing users who currently can manage invitations through `canManageCandidateInvitations()` will not automatically get the new `candidates.invite` permission. This is intentional per the spec - the permissions are separate.

2. **Permission Structure:** Customer user forms use a different permission structure than admin forms. Customer forms use nested objects like `candidates: { invite: boolean }` while admin forms use flat keys like `candidates_invite`. The implementation must handle both formats correctly.

3. **Vendor Users:** The spec confirms vendor users cannot have this permission. The existing user-form.tsx already disables permissions for vendor users, and `canInviteCandidates()` must explicitly check and reject vendor users.

4. **Admin Permission:** Per spec requirement #8, users with `admin: true` permission should automatically have invite capabilities. The new function must check for this using the hasPermission utility.

5. **Testing Impact:** Existing tests for the POST /api/candidate/invitations endpoint will fail after changing the permission check. Tests will need to be updated by the test-writer.

6. **Error Message:** The API currently returns "Forbidden - insufficient permissions" but the spec requires "You don't have permission to create invitations" for consistency.

## Plan Completeness Check
- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All Zod schemas, types, and translation keys are listed (none needed)
- [x] The plan is consistent with the spec's Data Requirements table (candidates.invite as boolean)
