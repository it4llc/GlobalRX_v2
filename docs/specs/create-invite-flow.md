# Feature Specification: Create Invite Flow (Phase 4 Stage 1)

**Spec file:** `docs/specs/create-invite-flow.md`
**Date:** April 23, 2026
**Requested by:** Andy
**Status:** Confirmed
**Phase:** 4 Stage 1 (of 8 total phases)
**Prerequisites:** Phase 3 (Candidate Invitation Foundation) — Complete

---

## Summary

Build the customer-facing UI for creating candidate invitations through the application. This stage adds an "Invite Candidate" button to the customer dashboard, a multi-step dialog for selecting a package and entering candidate details, and success feedback with a copyable invitation link. When a customer creates an invitation, the system calls the Phase 3 APIs to generate a unique token, create a draft order, and prepare the invitation for sending.

---

## Who Uses This

- **Customer users** — create invitations for candidates through the UI. This is the primary and only audience for this feature.
- **Internal admin users** — do not use this feature. They continue to use existing order creation mechanisms.

---

## Business Rules

1. The "Invite Candidate" button only appears if the user has the `candidates.invite` permission.
2. The button is placed in the main dashboard action area where other primary actions are located.
3. Only packages with an active workflow assigned can be selected for invitations. Packages without workflows are filtered out of the selection list.
4. The package selection displays both the package name and description to help users choose the right one.
5. Candidate information is collected in a multi-step flow within the same dialog for better user experience.
6. Email address is required and must be valid. Phone number is optional.
7. Phone numbers require a country code selection if provided.
8. The invitation is created immediately when the user completes the form — there is no draft or review state.
9. After successful creation, the invitation link is displayed with a copy button for easy sharing.
10. The success message shows the candidate's name, email, and expiration date.
11. All form validation happens inline as the user types, with clear error messages below each field.
12. Network errors are displayed as toast notifications, not inline errors.
13. The dialog closes after the user acknowledges the success message.
14. The newly created invitation/order appears immediately in relevant lists without requiring a page refresh.

---

## User Flow

**Step 1: Initiate invitation**
The customer user is on their dashboard and sees the "Invite Candidate" button in the main action area. They click the button.

**Step 2: Select package**
A dialog opens showing Step 1 of 2: "Select Package". The user sees a list of their available packages that have workflows assigned. Each package shows its name and description. Packages without workflows are not shown. The user selects one package and clicks "Next".

**Step 3: Enter candidate details**
The dialog transitions to Step 2 of 2: "Candidate Information". The user sees form fields for:
- First Name (required)
- Last Name (required)
- Email Address (required)
- Phone Country Code (optional dropdown, defaults to +1)
- Phone Number (optional)

The user fills in at least the required fields. If they enter an invalid email format, they see an inline error message "Please enter a valid email address" below the email field. They correct any errors and click "Create Invitation".

**Step 4: Processing**
The submit button shows a loading spinner and becomes disabled. The form fields become read-only while the request processes.

**Step 5a: Success**
If successful, the dialog content changes to show:
- A success icon
- "Invitation Created Successfully"
- "Invitation sent to [First Name] [Last Name] at [email]"
- "This invitation expires on [date]"
- The invitation link in a copyable field with a "Copy Link" button
- A "Done" button

The user clicks "Copy Link" and sees a toast notification "Link copied to clipboard". They click "Done" and the dialog closes. The dashboard updates to show the new invitation/order in any relevant lists.

**Step 5b: Error**
If there's an error (network failure, API error), the user sees a red toast notification with the error message. The form remains open and becomes editable again so they can retry. Common errors:
- "Unable to create invitation. Please check your connection and try again."
- "This package does not have a workflow configured. Please contact your administrator."
- "You don't have permission to create invitations."

---

## Data Requirements

### Invite Candidate Dialog — Package Selection Step

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Package | packageId | dropdown | Required | Must be a package belonging to the customer with an active workflow | — |

Note: The dropdown displays package name and description, but stores only the ID.

### Invite Candidate Dialog — Candidate Information Step

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| First Name | firstName | text | Required | Max 100 characters | — |
| Last Name | lastName | text | Required | Max 100 characters | — |
| Email Address | email | text | Required | Valid email format, max 254 characters | — |
| Phone Country Code | phoneCountryCode | dropdown | Optional | Valid country code from list (e.g., +1, +44, +86) | +1 |
| Phone Number | phoneNumber | text | Optional | Max 20 characters, numeric with optional formatting | — |

### API Request Structure

The dialog sends a POST request to `/api/candidate/invitations` with:

| Field Name | Type | Source | Required |
|---|---|---|---|
| packageId | string | From package selection step | Required |
| firstName | string | From candidate form | Required |
| lastName | string | From candidate form | Required |
| email | string | From candidate form, normalized to lowercase | Required |
| phoneCountryCode | string | From country code dropdown | Optional |
| phoneNumber | string | From phone field | Optional |

### API Response Structure

The successful response includes:

| Field Name | Type | Used For |
|---|---|---|
| id | string | Internal tracking |
| token | string | Building the invitation link |
| firstName | string | Success message display |
| lastName | string | Success message display |
| email | string | Success message display |
| expiresAt | datetime | Displaying expiration date |
| orderId | string | Updating order lists |

### Invitation Link Format

The invitation link follows the pattern:
`{baseUrl}/invite/{token}`

Where:
- `baseUrl` is the application's base URL (e.g., `https://app.globalrx.com`)
- `token` is the unique invitation token from the API response

---

## Edge Cases and Error Scenarios

- **What if the user has no packages?** The package selection step shows an empty state message: "No packages available. Please contact your administrator to set up packages with workflows."

- **What if none of the user's packages have workflows?** Same as above — packages without workflows are filtered out, so if none have workflows, it shows the empty state.

- **What if the user lacks the `candidates.invite` permission?** The "Invite Candidate" button is not displayed at all. If they somehow access the dialog directly, the API returns 403 and shows "You don't have permission to create invitations."

- **What if the email is already in use?** Phase 3 allows duplicate emails, so this succeeds. Duplicate prevention is a future enhancement.

- **What if the phone country code is selected but no number is entered?** The API accepts this — both fields are optional. If phoneNumber is provided, phoneCountryCode is required by the UI validation.

- **What if the network fails during submission?** A toast shows "Unable to create invitation. Please check your connection and try again." The form becomes editable again for retry.

- **What if the API returns a 422 (package has no workflow)?** Show toast: "This package does not have a workflow configured. Please contact your administrator."

- **What if the user closes the dialog during submission?** The browser's default behavior applies — the request may complete or be cancelled. No special handling needed.

- **What if special characters are in the name?** Allowed — names can contain any Unicode characters up to 100 characters.

- **What if the email contains uppercase letters?** The UI sends it as-entered, the API normalizes to lowercase before storage.

- **What if the user rapidly clicks "Create Invitation" multiple times?** The button becomes disabled on first click, preventing duplicate submissions.

---

## Impact on Other Modules

- **Customer Dashboard** — gains the "Invite Candidate" button in the main action area.
- **Order Lists** — may need to refresh or react to the new order created by the invitation. Implementation should follow existing patterns for list updates.
- **Permissions System** — uses the existing `candidates.invite` permission check (added in Phase 1).
- **No impact on admin modules** — this is a customer-only feature.

---

## Definition of Done

1. An "Invite Candidate" button appears on the customer dashboard in the main action area.
2. The button only appears for users with the `candidates.invite` permission.
3. Clicking the button opens a multi-step dialog.
4. Step 1 shows a list of packages that have active workflows assigned.
5. Packages without workflows are filtered out and not shown.
6. Each package in the list shows its name and description.
7. Selecting a package and clicking "Next" advances to step 2.
8. Step 2 shows form fields for candidate first name, last name, email, phone country code, and phone number.
9. First name, last name, and email are marked as required fields.
10. Email field validates format and shows inline error for invalid emails.
11. Phone country code dropdown defaults to +1.
12. Phone number field accepts numeric input with optional formatting characters.
13. Clicking "Create Invitation" disables the button and shows a loading state.
14. Successful creation shows a success screen with candidate details and expiration date.
15. The success screen displays the full invitation link in a copyable field.
16. The "Copy Link" button copies the invitation URL to clipboard and shows a toast confirmation.
17. API errors show as toast notifications with appropriate messages.
18. Form validation errors show inline below the relevant fields.
19. The dialog can be closed with "Done" after success or cancelled at any step.
20. Network errors allow retry without losing entered data.
21. The invitation link format is `{baseUrl}/invite/{token}`.
22. Email addresses are sent to the API exactly as entered (API handles normalization).
23. Phone fields are both sent if phone number is provided, both omitted if not.
24. The UI properly handles loading, success, and error states.
25. No console errors or warnings during normal operation.

---

## Open Questions

None — all questions were resolved in pre-spec discussion:
- Button placement: Main dashboard action area (confirmed)
- Package display: Show name and description (confirmed)
- Multi-step vs single form: Multi-step in same dialog (confirmed)
- Error handling: Toast for network/API errors, inline for validation (confirmed)
- Permission handling: Hide button if no permission (confirmed)
- Success feedback: Show details with copy link button (confirmed)