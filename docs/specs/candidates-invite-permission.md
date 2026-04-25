# Feature Specification: Candidate Invite Permission
**Spec file:** `docs/specs/candidates-invite-permission.md`
**Date:** April 23, 2026
**Requested by:** Andy
**Status:** Confirmed
**Phase:** 4 (of 8 total phases in Candidate Invite feature)
**Prerequisites:** Phase 3 (Candidate Invitation Foundation) — Complete

## Summary

Add a new granular permission `candidates.invite` that controls whether a user can send invitations to candidates. This permission is separate from the existing `canManageCandidateInvitations()` function which controls managing invitations (extending, resending). The new permission specifically controls the ability to create new invitations through the "Invite Candidate" button and associated UI. This is part of Phase 4 of the Candidate Invite feature, adding fine-grained permission control for customer and internal users.

## Who Uses This

- **Customer users** — can be granted the `candidates.invite` permission to allow them to send invitations to candidates. Without this permission, they cannot see or use the "Invite Candidate" button.
- **Internal admin users** — can also be granted this permission for testing and support purposes, though they typically have broader permissions through `customer_config`.
- **Vendor users** — cannot have this permission. Vendors never send candidate invitations.

## Business Rules

1. The permission key is `candidates.invite` stored as a boolean in the user's permissions JSON object.
2. This permission is separate from and independent of the module-level `candidate_workflow` permission. A user can have one, both, or neither.
3. The permission can be granted to both internal users and customer users, but not vendor users.
4. A new function `canInviteCandidates()` is added to `auth-utils.ts` to check this specific permission.
5. The existing `canManageCandidateInvitations()` function remains unchanged — it checks for broader invitation management capabilities (extend, resend).
6. The "Invite Candidate" button in the UI only appears if `canInviteCandidates()` returns true.
7. The permission follows the existing granular permission pattern, stored as a boolean value like `customers.edit`.
8. If a user has the `admin` permission with value `true`, they automatically have `candidates.invite` permission.
9. Customer users who have `candidates.invite` permission can only create invitations for their own customer organization.
10. The permission check happens both in the UI (to show/hide the button) and in the API (to validate the action).

## User Flow

**For users with the permission:**
1. The user logs into the system.
2. On their dashboard, they see the "Invite Candidate" button because they have the `candidates.invite` permission.
3. They click the button and proceed with creating an invitation (as described in the Phase 4 Stage 1 spec).

**For users without the permission:**
1. The user logs into the system.
2. On their dashboard, the "Invite Candidate" button is not visible.
3. If they somehow try to access the invitation creation API directly, they receive a 403 Forbidden response with the message "You don't have permission to create invitations".

**For administrators granting the permission:**
1. An admin navigates to User Management.
2. They edit a user's permissions.
3. In the permissions UI, they see a checkbox labeled "Candidate Invitations" (UI label for `candidates.invite`).
4. They check the box and save.
5. The user's permissions JSON is updated to include `"candidates": { "invite": true }`.

## Data Requirements

### User Permissions JSON Structure

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Candidate Invitations | candidates.invite | boolean | Optional | true or false | false |

The permission is stored in the user's `permissions` JSON field in the database. Example structure:
```json
{
  "candidates": {
    "invite": true
  },
  // other permissions...
}
```

### canInviteCandidates() Function

| Parameter | Type | Required | Description |
|---|---|---|---|
| user | User \| null \| undefined | Required | The user object from session |

**Returns:** `boolean` — true if the user can create candidate invitations, false otherwise.

### Permission Check Constants

| Constant Key | Value | Description |
|---|---|---|
| CANDIDATES_RESOURCE | candidates | The resource key for candidate-related permissions |
| INVITE_ACTION | invite | The action key for creating invitations |

## Edge Cases and Error Scenarios

- **What if a vendor user somehow gets the permission assigned?** The `canInviteCandidates()` function explicitly checks user type and returns false for vendor users, even if the permission is present in their JSON.
- **What if the permission JSON is malformed?** The function safely handles missing or malformed permission objects and returns false.
- **What if the user has admin permission?** The function returns true for admin users even if `candidates.invite` is not explicitly set.
- **What if the permission is set to false explicitly?** The function returns false, respecting the explicit denial.
- **What if a customer user has the permission but no customerId?** The API validates that customer users must have a valid customerId when creating invitations.
- **What if the permission check fails in the API after the UI showed the button?** The API returns 403 with message "You don't have permission to create invitations".
- **What if the permissions object doesn't have a `candidates` key?** The function treats this as no permission and returns false.
- **What if the user is not authenticated?** The function returns false for null or undefined user objects.

## Impact on Other Modules

- **Auth Utils** — gains the new `canInviteCandidates()` function alongside the existing `canManageCandidateInvitations()`.
- **Customer Dashboard UI** — uses `canInviteCandidates()` to conditionally show the "Invite Candidate" button.
- **Candidate Invitations API** — uses `canInviteCandidates()` to validate permission before creating invitations.
- **User Management UI** — gains a new checkbox "Candidate Invitations" in the permissions section.
- **Permission Utils** — the existing `hasPermission()` function already supports this pattern, no changes needed.
- **No impact on existing permissions** — this is additive only, existing permissions and functions remain unchanged.

## Definition of Done

1. A new function `canInviteCandidates()` exists in `src/lib/auth-utils.ts`.
2. The function checks for `candidates.invite` permission in the user's permissions object.
3. The function returns true for admin users even without explicit `candidates.invite` permission.
4. The function returns false for vendor users even if they have the permission set.
5. The function returns true for internal users with `candidates.invite` set to true.
6. The function returns true for customer users with `candidates.invite` set to true.
7. The function safely handles null, undefined, and malformed permission objects.
8. The "Invite Candidate" button uses `canInviteCandidates()` for visibility control.
9. The POST `/api/candidate/invitations` endpoint uses `canInviteCandidates()` for authorization.
10. The API returns 403 with appropriate message when permission is denied.
11. Unit tests exist for all permission scenarios in the `canInviteCandidates()` function.
12. The function has JSDoc documentation explaining its purpose and return value.
13. The permission follows the existing pattern of granular permissions like `customers.edit`.
14. Customer users with the permission can only create invitations for their own customer.
15. The permission can be set through the existing permission management systems.

## Open Questions

None — all decisions have been made based on the clear requirements and existing patterns in the system.