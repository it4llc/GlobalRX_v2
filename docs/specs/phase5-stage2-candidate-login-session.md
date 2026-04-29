# Feature Specification: Phase 5 Stage 2 — Returning Candidate Login & Session Management

**Spec file:** `docs/specs/phase5-stage2-candidate-login-session.md`
**Date:** April 29, 2026
**Requested by:** Andy
**Status:** Confirmed

---

## Summary

When a candidate returns to their invitation link after already creating a password (in Stage 1), they currently see a placeholder message saying "come back later." This stage replaces that placeholder with a working login form and introduces a session system so the candidate stays logged in while working on their application. The session is completely separate from the regular user login system — candidates are not system users.

---

## Context from Stage 1 (Already Built)

Stage 1 established the following, which Stage 2 builds on directly:

- **Landing page URL:** `/candidate/[token]` (not `/portal/candidate/`)
- **Enhanced invitation lookup API:** `GET /api/candidate/invitations/enhanced/[token]` — returns invitation details including whether a password has been set (`hasPassword` field)
- **Password creation API:** `POST /api/candidate/auth/create-password` — accepts `token`, `password`, `confirmPassword`; hashes and stores the password; updates status from `sent` to `accessed`
- **Invitation statuses:** `draft`, `sent`, `accessed`, `completed`, `expired`
- **Key rule:** A candidate is NOT a system user. They authenticate via their invitation token + password, not via the normal NextAuth login.
- **Landing page behavior:** The page calls the enhanced lookup API with the token, checks `hasPassword`, and either shows the password creation form (first visit) or currently shows a placeholder (return visit)

---

## Who Uses This

**Returning candidate** — A person who previously received an invitation link and already created a password. They click the same link again (from their email or bookmarks) and need to log in to continue their application. They may be on a phone.

**System (background)** — The session system silently manages the candidate's login state: creating a session when they log in, checking it on each page load, and cleaning it up when it expires or the candidate finishes.

---

## What This Stage Delivers

1. **Login form for returning candidates** — Replaces the "come back later" placeholder on the landing page when the candidate already has a password
2. **Password verification API** — Checks the candidate's password against what's stored
3. **Session creation and management** — After successful login, creates a session so the candidate doesn't have to re-enter their password on every page
4. **Session checking API** — Allows future pages (Stage 3 portal shell, Phase 6 application forms) to verify the candidate is still logged in
5. **Last accessed tracking** — Updates the `lastAccessedAt` timestamp each time the candidate logs in

---

## Business Rules

1. The login form must only appear when the enhanced lookup API returns `hasPassword: true` for the invitation. If `hasPassword` is `false`, the password creation form from Stage 1 continues to appear instead.
2. Expired invitations must not allow login. If the invitation has passed its `expiresAt` date, the page shows the expiration message (already handled by Stage 1 landing page logic) and the verify API refuses the request.
3. Invitations with status `completed` must not allow login. The candidate has already submitted their application.
4. Only invitations with status `accessed` should allow login. (Status `accessed` means the candidate has created a password but hasn't submitted yet.)
5. The password verification API must compare the submitted password against the stored hash using bcrypt (the same library used by the existing user authentication system).
6. After 5 consecutive failed login attempts for the same invitation, the API must temporarily block further attempts for 15 minutes. This prevents automated password guessing.
7. On successful login, the API must update the invitation's `lastAccessedAt` field to the current time.
8. On successful login, the API must create a candidate session and return a session token to the browser.
9. The candidate session must be stored as a secure, HTTP-only cookie named `candidate_session`. It must NOT interfere with the regular user session cookie used by NextAuth.
10. Candidate sessions expire after 4 hours of inactivity. Each successful session check resets the 4-hour timer.
11. The session checking API must return the candidate's basic information (first name, invitation ID, token, invitation status) so that future stages can display personalized content without making additional API calls.
12. If a session check finds an expired session, it must clear the cookie and return a "not authenticated" response so the frontend can redirect back to the login form.
13. All candidate authentication APIs (`/api/candidate/auth/*`) must NOT use `getServerSession()` or NextAuth in any way. These are candidate-specific endpoints with their own authentication logic.
14. The login form must follow the same mobile-first design rules as Stage 1: minimum 320px width, 44px minimum touch targets, responsive layout, password visibility toggle.
15. After successful login, the landing page should redirect the candidate to `/candidate/[token]/portal` (this page will be built in Stage 3 — for now, show a success message: "You're logged in! Your application portal is coming soon.").
16. Failed login attempts must show a clear, non-specific error message: "The password you entered is incorrect. Please try again." — do not reveal whether the invitation exists or any other details.
17. When a lockout is active (rule 6), the error message should say: "Too many attempts. Please wait 15 minutes and try again."
18. The login form must include a "Forgot your password?" link. For now, this link shows a message: "Please contact the company that sent you this invitation to request a new link." (Full password reset is deferred to a future phase.)

---

## User Flow

### Returning Candidate Login

1. The candidate clicks their invitation link (e.g., `https://app.globalrx.com/candidate/abc123xyz`)
2. The landing page loads and calls `GET /api/candidate/invitations/enhanced/abc123xyz`
3. The API returns the invitation details with `hasPassword: true`
4. The landing page shows the **login form** instead of the password creation form
5. The candidate sees a greeting (e.g., "Welcome back, Sarah") and a password field
6. The candidate enters their password and taps "Sign In"
7. The frontend sends `POST /api/candidate/auth/verify` with the token and password
8. **If the password is correct:** The API creates a session, sets the session cookie, and returns success. The frontend redirects to `/candidate/[token]/portal`
9. **If the password is wrong:** The API returns an error. The form shows "The password you entered is incorrect. Please try again." The password field is cleared and re-focused.
10. **If the account is locked out:** The API returns a lockout error. The form shows the lockout message with the remaining wait time.
11. **If the invitation has expired:** The page shows the expiration message (handled by existing Stage 1 logic before the form even appears).

### Session Continuity (for future stages)

1. The candidate navigates to a page within the candidate portal
2. The page calls `GET /api/candidate/auth/session` to verify the session is still valid
3. **If the session is valid:** The API returns the candidate's information and refreshes the session timer. The page loads normally.
4. **If the session has expired or doesn't exist:** The API clears the cookie and returns a "not authenticated" response. The frontend redirects back to `/candidate/[token]` to log in again.

---

## Data Requirements

### No New Database Fields

This stage uses fields that already exist on the `candidate_invitations` table from Phase 3. No new columns or tables are needed.

### Existing Fields Used

| UI Label | Field Name | Type | Purpose in Stage 2 |
|---|---|---|---|
| — | passwordHash | text | Compared against the candidate's submitted password during login |
| — | lastAccessedAt | datetime | Updated to current time on each successful login |
| — | status | text | Checked to confirm the invitation is in `accessed` state |
| — | expiresAt | datetime | Checked to confirm the invitation hasn't expired |
| — | firstName | text | Displayed in the "Welcome back" greeting on the login form |
| — | token | text | Used to look up the invitation and included in the session data |
| — | id | uuid | Included in the session data for future API calls |

### Session Data Shape

The candidate session cookie will contain a signed token that encodes:

| Field | Type | Source |
|---|---|---|
| invitationId | uuid | From the `candidate_invitations` table |
| token | text | The invitation URL token |
| firstName | text | Candidate's first name for display |
| status | text | Current invitation status |
| expiresAt | datetime | When this session expires (4 hours from last activity) |

### Rate Limiting Data (In-Memory)

Failed login tracking does not need a database table. It should be stored in server memory (a simple lookup structure keyed by invitation ID) with automatic cleanup of entries older than 15 minutes. This is acceptable because:
- The data is temporary (15-minute window)
- A server restart simply clears all lockouts (acceptable trade-off)
- The volume is low (one entry per locked-out invitation)

| Field | Type | Purpose |
|---|---|---|
| invitationId | uuid | Which invitation is being tracked |
| failedAttempts | number | Count of consecutive failed attempts |
| lastFailedAt | datetime | When the most recent failure occurred |

---

## API Specifications

### POST /api/candidate/auth/verify

**Purpose:** Verify a returning candidate's password and create a session.

**Request body:**
| Field | Type | Required | Validation |
|---|---|---|---|
| token | text | Yes | Must not be empty |
| password | text | Yes | Must not be empty |

**Success response (200):**
```json
{
  "success": true,
  "invitation": {
    "id": "uuid",
    "firstName": "Sarah",
    "status": "accessed",
    "token": "abc123xyz"
  }
}
```
Also sets the `candidate_session` cookie.

**Error responses:**

| Situation | Status | Response |
|---|---|---|
| Missing token or password | 400 | `{ "error": "Token and password are required" }` |
| Token not found in database | 401 | `{ "error": "Invalid credentials" }` |
| Invitation expired | 401 | `{ "error": "This invitation has expired" }` |
| Invitation completed | 401 | `{ "error": "This invitation has already been completed" }` |
| Invitation has no password set | 401 | `{ "error": "Invalid credentials" }` |
| Wrong password | 401 | `{ "error": "Invalid credentials" }` |
| Too many failed attempts | 429 | `{ "error": "Too many attempts. Please try again later.", "retryAfterMinutes": 15 }` |

**Important security note:** The "token not found," "no password set," and "wrong password" cases all return the same generic "Invalid credentials" message. This prevents an attacker from learning which invitation tokens are valid.

**Processing steps (in order):**
1. Validate the request body (token and password present)
2. Check the rate limiter — if 5+ failures in the last 15 minutes for this token, return 429
3. Look up the invitation by token
4. If not found, return 401
5. If invitation status is not `accessed`, return the appropriate error
6. If expired (`expiresAt` < now), return 401
7. If `passwordHash` is null, return 401
8. Compare the submitted password against the stored hash using bcrypt
9. If password doesn't match, increment the failure counter and return 401
10. On success: clear the failure counter, update `lastAccessedAt`, create a session cookie, return the success response

---

### GET /api/candidate/auth/session

**Purpose:** Check whether the candidate has a valid session and return their information.

**Request:** No body. The `candidate_session` cookie is read automatically.

**Success response (200):**
```json
{
  "authenticated": true,
  "invitation": {
    "id": "uuid",
    "firstName": "Sarah",
    "status": "accessed",
    "token": "abc123xyz"
  }
}
```
Also refreshes the session cookie expiration (resets the 4-hour timer).

**Error responses:**

| Situation | Status | Response |
|---|---|---|
| No session cookie present | 401 | `{ "authenticated": false }` |
| Session cookie is invalid or tampered with | 401 | `{ "authenticated": false }` (also clears the cookie) |
| Session has expired | 401 | `{ "authenticated": false }` (also clears the cookie) |
| Invitation no longer in `accessed` status | 401 | `{ "authenticated": false }` (also clears the cookie) |
| Invitation has expired since login | 401 | `{ "authenticated": false }` (also clears the cookie) |

**Processing steps (in order):**
1. Read the `candidate_session` cookie
2. If missing, return 401
3. Verify the cookie's signature (to detect tampering)
4. Decode the session data
5. If the session's `expiresAt` has passed, clear the cookie, return 401
6. Look up the invitation by the ID in the session data to confirm it still exists and is in a valid state
7. If the invitation status has changed (e.g., expired or completed since login), clear the cookie, return 401
8. Refresh the session cookie with a new `expiresAt` (4 hours from now)
9. Return the invitation data

---

## UI Components

### Login Form (Replaces the "Come Back Later" Placeholder)

This form appears on the existing `/candidate/[token]` landing page when the invitation has `hasPassword: true`.

**Layout:**
- Same card-style container as the password creation form from Stage 1
- "Welcome back, {firstName}" heading
- Company name displayed below the heading (from the invitation data)
- Password input field with visibility toggle (show/hide password)
- "Sign In" button (full width, 44px minimum height)
- "Forgot your password?" link below the button
- Error message area above the button (hidden until an error occurs)

**States:**
- **Default:** Password field empty, Sign In button enabled
- **Loading:** After tapping Sign In, button shows a spinner and is disabled, password field is disabled
- **Error:** Error message appears in red above the button, password field is cleared and focused
- **Lockout:** Error message shows lockout text, Sign In button is disabled, a countdown timer shows remaining lockout time
- **Success:** Brief "Logging you in..." message, then redirect to `/candidate/[token]/portal`

**Mobile-first requirements (same as Stage 1):**
- Minimum viewport width: 320px
- All touch targets: minimum 44px height
- Password field: full width with visibility toggle button
- Sign In button: full width, prominent color
- Error messages: large enough to read on small screens (minimum 14px text)
- The form should not require scrolling on a standard phone screen

### Post-Login Success Screen (Temporary)

Since the candidate portal shell (Stage 3) doesn't exist yet, after successful login the candidate is redirected to `/candidate/[token]/portal` which shows:

- A simple centered card with a checkmark icon
- "You're logged in!" heading
- "Your application portal is coming soon." message
- The candidate's name displayed
- A "Sign Out" link that clears the session cookie and redirects back to the landing page

This page must also check the session using `GET /api/candidate/auth/session` on load, redirecting back to the login form if the session is invalid.

---

## Edge Cases and Error Scenarios

1. **What if the candidate's invitation expires while they are on the login page?** The verify API checks expiration at the time of the login attempt and returns an error. The frontend should show the expiration message.

2. **What if the candidate's invitation expires while they have an active session?** The session check API verifies the invitation is still valid. If it has expired, the session is cleared and the candidate is sent back to the landing page, which will show the expiration message.

3. **What if the candidate has the login page open in multiple tabs?** Each tab will work independently. Logging in on one tab creates a session cookie that the other tabs can use. No special handling is needed.

4. **What if the regular system login page and the candidate login exist in the same browser?** They use different cookies (`next-auth.session-token` for system users, `candidate_session` for candidates) so they do not interfere with each other.

5. **What if the server restarts and the rate-limit data is lost?** The lockout counters reset, which means a locked-out candidate could try again immediately. This is an acceptable trade-off for the simplicity of in-memory storage. If brute-force protection needs to be more robust in the future, the counters can be moved to the database.

6. **What if the candidate's invitation status changes to `completed` while they have a session?** The session check API looks up the invitation each time and will detect the status change, clearing the session.

7. **What if JavaScript is disabled or the page loads slowly on mobile?** The form should render in a usable state even before JavaScript loads (progressive enhancement). The Sign In button should work with a standard form submission as a fallback.

8. **What if the candidate types a wrong password and then immediately tries again?** The form clears the password field on error so the candidate starts fresh. There is no delay between individual attempts (only a lockout after 5 failures).

9. **What if the session cookie is manually deleted (e.g., the candidate clears their browser data)?** The next page load will fail the session check and redirect to the login form. The candidate simply logs in again.

10. **What if iOS Safari private browsing mode blocks cookies?** The login will succeed (the verify API returns success), but the session cookie may not persist. On the next navigation, the session check will fail and the candidate will need to log in again. This is a known limitation noted in the phase plan's risk section and will be addressed in Phase 8 (Polish & Edge Cases).

---

## Impact on Other Modules

**Stage 1 landing page** — The existing landing page component at `/candidate/[token]` needs to be modified to show the login form instead of the placeholder when `hasPassword` is `true`. The password creation form remains unchanged.

**Stage 3 (future — candidate portal shell)** — Will consume the session checking API to verify the candidate is logged in before showing the portal. The success screen built in this stage will be replaced by the actual portal shell.

**Phase 6 (future — application forms)** — Will use the session checking API to authenticate each auto-save and data-loading request. The session data (invitation ID, token) will be used to look up the correct application data.

**Existing system authentication** — No changes. The candidate authentication system is completely independent. The NextAuth session and the candidate session use different cookies and different API routes.

---

## Session Implementation Approach

The candidate session should use a signed cookie (using a JSON Web Token or a similar signed-token approach) rather than server-side session storage. This means:

- **No session table in the database** — The session data is encoded directly in the cookie
- **The cookie is signed** — Using a server-side secret key, so it cannot be tampered with
- **The cookie is HTTP-only** — JavaScript running in the browser cannot read it, preventing certain types of attacks
- **The cookie is secure** — Only sent over HTTPS connections
- **The cookie has SameSite=Lax** — Provides protection against cross-site request attacks while still allowing the candidate to follow their invitation link from email

The signing secret should be a separate environment variable (e.g., `CANDIDATE_SESSION_SECRET`) from the NextAuth secret, to maintain complete isolation between the two authentication systems.

---

## Definition of Done

1. Returning candidates (who already created a password) see a login form instead of the "come back later" placeholder
2. The login form shows "Welcome back, {firstName}" with the candidate's actual name
3. Entering the correct password logs the candidate in and redirects to `/candidate/[token]/portal`
4. Entering a wrong password shows an error message and clears the password field
5. After 5 wrong passwords, the form shows a lockout message and blocks further attempts for 15 minutes
6. The `lastAccessedAt` field is updated in the database on each successful login
7. A `candidate_session` cookie is set on successful login and does not interfere with the regular system login cookie
8. The `GET /api/candidate/auth/session` API correctly returns the candidate's information when a valid session exists
9. The session check API returns "not authenticated" when the session has expired (after 4 hours of inactivity)
10. The session check API refreshes the session timer on each successful check
11. The session check API detects when an invitation has expired or been completed since login and clears the session
12. The temporary success page at `/candidate/[token]/portal` shows the candidate's name and has a working sign-out link
13. The login form works correctly on mobile devices (320px minimum width, 44px touch targets)
14. The password field has a visibility toggle (show/hide)
15. The "Forgot your password?" link shows the contact-your-company message
16. Expired invitations cannot log in (the verify API rejects them)
17. Completed invitations cannot log in (the verify API rejects them)
18. The verify API does not reveal whether a token exists — all auth failures return the same generic error
19. All candidate auth APIs are independent of NextAuth — they do not call `getServerSession()`

---

## Open Questions

None — all design decisions for this stage are covered by the existing design document and phase plan decisions. If any questions arise during implementation, they should be raised before coding begins.