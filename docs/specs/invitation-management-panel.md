# Feature Specification: Invitation Management Panel
**Spec file:** `docs/specs/invitation-management-panel.md`
**Date:** April 26, 2026
**Requested by:** Andy
**Status:** Confirmed

## Summary

Add an invitation management section to the order details panel so customers can see the status of a candidate invitation and take actions on it (extend expiration, resend the link). This is the second half of Phase 4 — Stage 1 built the creation flow, and this stage builds the post-creation management experience. All backend endpoints already exist from Phase 3.

## Who Uses This

- **Customer portal users** with access to orders — they can view invitation status and take actions (extend, resend) on invitations they created
- **Internal/fulfillment users** — they can view invitation status in the order details panel but should also be able to extend and resend

## Business Rules

1. The invitation management section only appears on orders that have a linked candidate invitation.
2. The invitation status is one of five values: `sent` (link emailed, candidate hasn't clicked it yet), `opened` (candidate clicked the link but hasn't entered any data yet), `in_progress` (candidate has started entering data), `completed` (candidate submitted the application), `expired` (the expiration date has passed).
3. The "Extend Expiration" action is available when the invitation status is `sent`, `opened`, `in_progress`, or `expired`. It is not available when the status is `completed`.
4. The "Resend Link" action is only available when the invitation status is `sent` or `opened`. It is not available when the status is `in_progress`, `completed`, or `expired`.
5. Extending the expiration adds the workflow's configured expiration days to the current date (not to the old expiration date). If the invitation was expired, its status reverts to whatever it was before it became expired (the system stores the previous status).
6. Resending the link sends a new email to the candidate's email address using the same invitation email template from the workflow. The email content is identical to the original invitation (same subject, same body with the candidate's name, link, and current expiration date). The link itself does not change.

> **Future enhancement:** Automated reminders will be added in a later phase with their own distinct template text (e.g., "This is your first reminder..."). The workflow will need a separate reminder template field for this. For now, resend simply re-sends the original invitation email.
7. The Phase 3 extend and resend endpoints already log events to the `order_status_history` table automatically (with event types like `invitation_created`, `invitation_extended`, `invitation_resent`). No additional logging code is needed in Stage 2 — the backend handles it.
8. The existing Order Status History section in the UI must display these invitation events alongside regular order status changes. Invitation events should be visually distinguishable from status changes (e.g., different icon or label) so the user can tell what kind of event it is.
9. The Invitation Status section is a separate, new section in the order details panel. It shows a live snapshot of the invitation's current state (candidate info, status, expiration) and provides the action buttons. It does NOT duplicate the event history — that stays in Order Status History.
10. The invitation section should display: candidate name, candidate email, invitation status, expiration date, and when the candidate last accessed the link (if they have).
11. If the invitation is expired, the expiration date should be visually highlighted to draw attention.
12. The invitation section should refresh its data after a successful extend or resend action without requiring a full page reload.
13. Extending an invitation that is `in_progress` preserves all candidate-entered data. The expiration is extended without affecting the application state.
14. For customer portal users, the `candidates.invite` permission controls whether action buttons (Extend, Resend) appear. For internal/fulfillment users, the action buttons are always available as part of their normal order management access — they do not need the `candidates.invite` permission.
15. The Invitation Status section appears between the existing order information and the Order Status History section in the order details panel.
16. Phone numbers are displayed with the country code prefix (e.g., "+1 5551234567"). If no phone number was provided, the field is omitted from the display.
17. If an invitation is expired and the customer wants to resend it, they must first extend the expiration (which reverts the status), and then the Resend button becomes available. This is intentional — sometimes the candidate just needs more time without receiving another email.

## User Flow

### Viewing invitation status
The customer opens an order that was created through the candidate invite flow. In the left-side order details panel, between the existing order information and the Order Status History, they see an "Invitation Status" section. This section shows the candidate's name, their email address, the current status (shown as a colored badge — similar to how order status badges work), the expiration date, and when the candidate last opened the link (or "Not yet accessed" if they haven't). The five possible statuses are: sent (waiting for candidate to click), opened (candidate clicked but hasn't entered data), in progress (candidate is filling in data), completed (candidate submitted), and expired (link expired).

### Extending expiration
The customer sees the expiration date is approaching or has passed. They click the "Extend" button. A confirmation prompt appears asking them to confirm they want to extend the expiration. They confirm, the system calls the existing extend endpoint, the expiration date updates on screen, a success message appears briefly, and the event automatically appears in the Order Status History section (logged by the backend).

### Resending the link
The customer wants to remind the candidate. They click "Resend" button. A confirmation prompt appears. They confirm, the system calls the existing resend endpoint, a success message appears confirming the email was sent, and the event automatically appears in the Order Status History section (logged by the backend).

## Data Requirements

No new database fields are needed. This feature reads from the existing `CandidateInvitation` model and calls existing API endpoints.

**Data displayed (read from existing CandidateInvitation record):**

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| Candidate Name | firstName, lastName | text | Required | — | — |
| Email | email | text | Required | — | — |
| Phone | phoneCountryCode, phoneNumber | text | Optional | Displayed as "+{code} {number}" | — |
| Status | status | dropdown | Required | sent, opened, in_progress, completed, expired | — |
| Expires | expiresAt | date | Required | — | — |
| Last Accessed | lastAccessedAt | date | Optional | — | — |
| Created | createdAt | date | Required | — | — |

**API endpoints used (all existing from Phase 3):**

| Action | Method | Endpoint | What It Does |
|---|---|---|---|
| Get invitation details | GET | `/api/candidate/invitations/[id]` or fetched with the order | Returns invitation data |
| Extend expiration | POST | `/api/candidate/invitations/[id]/extend` | Resets expiration date |
| Resend link | POST | `/api/candidate/invitations/[id]/resend` | Sends email again |

## Edge Cases and Error Scenarios

1. **Order has no invitation** — The invitation section simply does not render. No error, no empty state message.
2. **Extend fails (network error)** — Show an error message. The UI stays as-is so the customer can try again.
3. **Resend fails (network error)** — Show an error message. The UI stays as-is so the customer can try again.
4. **Invitation is completed** — Extend and Resend buttons are hidden or disabled. The section shows final status with the completion date.
5. **Invitation is expired** — Extend button remains available. Resend is not available when expired. The expiration date is visually highlighted (e.g., red text or a warning color). Extending reverts the status to whatever it was before it expired.
6. **Customer user lacks permission** — If a customer portal user doesn't have the `candidates.invite` permission, the action buttons (extend, resend) should not appear, but the status information should still be visible (read-only view). Internal/fulfillment users always see the action buttons.
7. **Candidate has never accessed the link** — The "Last Accessed" field shows "Not yet accessed" or similar placeholder text.
8. **Multiple rapid clicks** — Buttons should be disabled while an action is in progress to prevent duplicate calls.
9. **Expired invitation needs resending** — The customer must first click Extend (which reverts the status and pushes the expiration forward), and then the Resend button becomes available. This two-step flow is intentional to avoid sending unnecessary emails when the candidate only needs more time.

## Impact on Other Modules

- **Order details panel** — Needs to be modified to include the new Invitation Status section between the existing order information and the Order Status History, when a candidate invitation exists for the order.
- **Order data fetching** — Both order fetch endpoints need to include the `candidateInvitation` relation in their Prisma queries: `/api/portal/orders/[id]` (customer portal) and `/api/fulfillment/orders/[id]` (fulfillment). The architect should check which endpoint is used by the order details panel and add the appropriate Prisma `include`.
- **Order Status History component** — The existing Order Status History UI currently only displays status changes using the `fromStatus` → `toStatus` format. It does NOT currently handle the invitation event types (`invitation_created`, `invitation_extended`, `invitation_resent`) that Phase 3 logs to `order_status_history` using `eventType` and `message` fields. The component needs to be updated to check for `eventType` and display the `message` field for invitation events instead of the status-change format.

## Definition of Done

**Invitation Status Section (new section in order details panel):**
1. Orders created through the candidate invite flow show an "Invitation Status" section in the order details panel.
2. The section displays: candidate name, email, status badge, expiration date, and last accessed date.
3. The status badge uses appropriate colors for each status (e.g., yellow for sent, orange for opened, blue for in progress, green for completed, red for expired).
4. The "Extend" button is visible and functional when the status is sent, opened, in_progress, or expired (hidden for completed).
5. The "Resend" button is visible and functional when the status is sent or opened (hidden for in_progress, completed, and expired).
6. Both buttons show a confirmation prompt before executing.
7. Both buttons are disabled while the action is processing (loading state).
8. After a successful action, the invitation data refreshes without a full page reload.
9. After a successful action, a brief success message appears.
10. The section does not appear on orders without a candidate invitation.
11. Customer portal users without `candidates.invite` permission see the status information but not the action buttons. Internal/fulfillment users always see action buttons.

**Order Status History (existing section — display invitation events):**
12. Invitation events (created, extended, resent) appear in the Order Status History alongside regular order status changes.
13. Invitation events are visually distinguishable from regular status changes (e.g., different icon, label, or styling).

**General:**
14. All user-facing text uses translation keys, including: section title, all five status labels, button labels (Extend, Resend), field labels, placeholder text ("Not yet accessed"), confirmation prompt text, success messages, and error messages.

## Open Questions

1. **Should the invitation section show the actual invite link?** Stage 1's success screen shows a copyable link, but it's unclear whether the management panel should also display it (useful if the customer wants to copy and send it manually outside of email).