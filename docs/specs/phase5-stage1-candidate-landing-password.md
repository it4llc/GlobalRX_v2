# Feature Specification: Phase 5, Stage 1 — Candidate Landing Page & Password Creation

**Spec file:** `docs/specs/phase5-stage1-candidate-landing-password.md`
**Date:** April 28, 2026
**Requested by:** Andy
**Status:** Confirmed

---

## Summary

When a candidate receives an invitation email, it contains a link. This stage builds the page that the candidate sees when they click that link for the very first time. The page checks whether the link is valid, shows the candidate who invited them and what the application is for, and lets the candidate create a password. After creating a password, the candidate sees a confirmation message. This is the candidate's first interaction with the system, and it must work well on mobile phones since most candidates will open the link from a text message or email on their phone.

This stage does NOT include returning candidate login (Stage 2) or the portal shell (Stage 3). It focuses entirely on the landing page, token validation, and first-time password creation.

---

## Who Uses This

**Candidate (first-time visitor):** Clicks the link from their invitation email/text. Sees the landing page. Creates a password. Sees a confirmation that their password was saved.

No other user types interact with this stage. Customers and internal users are not involved — they already created the invitation in Phase 4.

---

## What Gets Built

### 1. Candidate Landing Page

**URL:** `/portal/candidate/[token]`

This is the page candidates see when they click the link in their email. It is a standalone page that does NOT use the existing portal layout (no sidebar, no navigation bar, no header from the admin/customer portal). It has its own clean, simple layout.

**When the page loads, it must:**

1. Look up the invitation using the token in the URL (using the existing Phase 3 API: `GET /api/candidate/invitations/[token]`)
2. Check if the invitation is valid — specifically:
   - Does the token exist? If not → show "invalid link" error
   - Has the invitation expired? If yes → show "link expired" error
   - Has the invitation already been completed (candidate already submitted their application)? If yes → show "application already submitted" message
3. If the invitation is valid, check whether the candidate has already created a password:
   - **No password yet (first visit):** Show the welcome message and password creation form — this is the main focus of Stage 1
   - **Password already exists (returning visit):** Show a simple "Please come back later — login will be available soon" placeholder message. The real login form will be built in Stage 2.

**Welcome message displayed to the candidate (first visit):**

The page should show:
- The customer's company name (who sent the invitation)
- The candidate's first name (personalized greeting)
- A brief explanation that they need to create a password to begin their application

Example layout:
```
[Company Logo Placeholder]

Welcome, Sarah!

Acme Corp has invited you to complete a background check application.

To get started, please create a password that you'll use to access 
your application.

[Password Creation Form]
```

### 2. Password Creation Form

A simple form with:

- **Password field** — with a show/hide toggle button (the eye icon) so the candidate can see what they're typing. This is especially important on mobile where typos are common.
- **Confirm password field** — also with a show/hide toggle
- **"Create Password" button** — submits the form

**Password rules (keep it simple for v1):**
- Minimum 8 characters
- At least one letter and one number
- Both fields must match
- Show clear error messages below each field if rules aren't met
- Validate as the candidate types (or when they move to the next field), not only when they click the button

**After successful password creation:**
- Show a confirmation message: "Your password has been created! You can return to this link at any time to continue your application."
- Update the invitation status from "sent" to "accessed"
- Record the current time as the "last accessed" timestamp on the invitation

### 3. Error State Pages

Each error state gets its own clean, clear display (not a popup — a full page message):

**Invalid link (token not found):**
- Message: "This link is not valid. Please check your email for the correct link, or contact the company that sent you the invitation."
- No form, no actions — just the message.

**Expired link:**
- Message: "This invitation link has expired. Please contact [Customer Company Name] to request a new link."
- Show the company name so the candidate knows who to contact.

**Already completed:**
- Message: "Your application has already been submitted. No further action is needed."

**Something went wrong (server/network error):**
- Message: "Something went wrong. Please try again in a few minutes. If the problem continues, contact the company that sent you the invitation."
- Include a "Try Again" button that reloads the page.

### 4. New API Endpoint: Create Password

**Endpoint:** `POST /api/candidate/auth/create-password`

**What it does:** Takes the candidate's token and new password, validates everything, saves the hashed password, and updates the invitation record.

**What gets sent to it:**
- `token` — the invitation token (from the URL)
- `password` — the candidate's chosen password

**What it checks (in order):**
1. Are token and password both provided? If not → 400 error
2. Does the token match a real invitation? If not → 404 error
3. Has the invitation expired? If yes → 400 error with message "invitation expired"
4. Does the invitation already have a password? If yes → 400 error with message "password already created"
5. Does the password meet the minimum rules (8+ characters, at least one letter and one number)? If not → 400 error with details

**What it does on success:**
1. Hash the password securely (using bcrypt, same library the existing user system uses)
2. Save the hashed password to the invitation's `passwordHash` field
3. Update the invitation status from `sent` to `accessed`
4. Update the `lastAccessedAt` timestamp to the current time
5. Return a success response (200) with the invitation ID and new status

**What it returns:**
- Success: `{ success: true, status: "accessed" }`
- Error: `{ error: "description of what went wrong" }` with appropriate status code

**Important security note:** This endpoint does NOT require a logged-in session (no NextAuth session check). The candidate is not a user in the system — the token itself is the proof that this person was invited. However, the token must be validated against the database.

---

## Mobile-First Design Requirements

This is the first candidate-facing page in the system. It must be built mobile-first because candidates will typically open the link from their phone.

**Layout rules:**
- Design for 320px screen width first, then make it look good on larger screens
- Maximum content width of about 480px, centered on larger screens
- Generous padding on the sides (at least 16px) so nothing touches the screen edges
- All text must be readable without zooming

**Touch targets:**
- All buttons must be at least 44px tall (Apple's minimum recommendation for touch)
- The password show/hide toggle must be easy to tap without accidentally tapping the input field
- Adequate spacing between the password field and confirm password field so they're easy to tap individually

**Form behavior on mobile:**
- Password fields should not trigger autocomplete/autofill from the phone's password manager (this is a new password, not a saved one)
- The "Create Password" button should be visible above the keyboard when the candidate is typing in the password field (or at least easily scrollable to)
- The form should not jump around or resize unexpectedly when the mobile keyboard appears

**Typography:**
- Welcome heading: large, bold, easy to read
- Body text: comfortable reading size (at least 16px to prevent iOS auto-zoom)
- Error messages: clearly visible, in a distinct color (red or similar), positioned right below the field they relate to

---

## What This Stage Does NOT Include

To keep scope manageable, these items are explicitly deferred to later stages:

- **Returning candidate password entry (login):** That's Stage 2. For now, if a candidate who already has a password visits the link, they see a placeholder message.
- **Session management:** That's Stage 2. After creating a password in Stage 1, the candidate is NOT logged in — they just see a confirmation.
- **The candidate portal shell / navigation:** That's Stage 3.
- **The actual application form:** That's Phase 6.
- **Password reset flow:** Deferred. If a candidate forgets their password, the customer can resend the invite link — but a formal "forgot password" flow is not built in this stage.

---

## Database Changes

**None.** All the fields we need already exist on the `CandidateInvitation` table from Phase 3:
- `passwordHash` — currently null, will be populated when the candidate creates their password
- `status` — will change from "sent" to "accessed"
- `lastAccessedAt` — will be updated with the current timestamp

---

## Existing APIs Used

- `GET /api/candidate/invitations/[token]` — built in Phase 3. Used to look up the invitation when the candidate visits the link. Returns the invitation details including status, expiration, whether a password has been set, and the customer/company name.

---

## Edge Cases and Error Scenarios

| Scenario | What Should Happen |
|---|---|
| Token in URL doesn't match any invitation | Show "invalid link" error page |
| Invitation has expired (past expiresAt date) | Show "expired" error page with company name |
| Candidate already submitted the application (status = completed) | Show "already submitted" message |
| Candidate already created a password but hasn't submitted yet | Show placeholder message (login form comes in Stage 2) |
| Candidate submits password that's too short | Show error below password field: "Password must be at least 8 characters" |
| Candidate submits password without a number | Show error: "Password must include at least one number" |
| Candidate submits password without a letter | Show error: "Password must include at least one letter" |
| Password and confirm password don't match | Show error below confirm field: "Passwords do not match" |
| Network error when creating password | Show error message with "Try Again" option |
| Someone tries to create a password on an invitation that already has one (e.g., replaying the request) | API returns 400 "password already created" |
| Browser back button after successful password creation | Should still show the success confirmation, not the form again |

---

## Impact on Other Modules

- **No impact on existing modules.** This is an entirely new page at a new URL that doesn't interfere with the admin portal, customer portal, or any existing functionality.
- The page uses the existing Phase 3 invitation lookup API but does not modify it.
- The new create-password API endpoint is completely new and doesn't touch any existing endpoints.

---

## Definition of Done

1. Candidate can visit `/portal/candidate/[token]` and see the landing page
2. Invalid tokens show a clear "invalid link" error page
3. Expired invitations show a clear "expired" error page with company name
4. Completed invitations show an "already submitted" message
5. First-time visitors see a welcome message with the company name and their first name
6. Password creation form validates: minimum 8 characters, at least one letter, one number, both fields match
7. Password show/hide toggle works on both password fields
8. Validation errors appear below the relevant field as the candidate types
9. Successful password creation saves a hashed password to the invitation record
10. Invitation status changes from "sent" to "accessed" after password creation
11. The `lastAccessedAt` timestamp is updated after password creation
12. Success confirmation message is displayed after password creation
13. All pages and forms work correctly on mobile at 320px width
14. All buttons and interactive elements are at least 44px tall for touch
15. Text is at least 16px to prevent iOS auto-zoom
16. The create-password API properly rejects: missing fields (400), invalid tokens (404), expired invitations (400), duplicate password creation (400), weak passwords (400)
17. The page does NOT use the existing portal layout — it has its own standalone layout
18. Returning candidates who already have a password see a placeholder message (not the password creation form)

---

## Open Questions

None — all decisions are covered by the existing design document and phase plan. If anything comes up during implementation, we'll address it then.