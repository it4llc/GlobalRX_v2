# Feature Specification: Candidate Portal Shell

**Spec file:** `docs/specs/phase5-stage3-candidate-portal-shell.md`
**Date:** April 29, 2026
**Requested by:** Andy
**Status:** Confirmed

---

## Summary

This stage replaces the temporary "Your application portal is coming soon" placeholder at `/candidate/[token]/portal` with a real portal shell — the outer frame that the candidate sees when they log in. The shell includes a header with the candidate's name and a sign-out button, a sidebar listing the sections they'll need to complete (pulled from the package and workflow), and a main content area. On mobile, the sidebar collapses into a hamburger menu. No actual form fields or data entry happen in this stage — that comes in Phase 6. This stage just builds the container that Phase 6 will fill.

---

## Who Uses This

**Candidates** — people who received a background check invitation link via email or SMS. They are NOT system users. They access the portal through their invitation link and their own password, using the separate candidate session system built in Stages 1 and 2.

---

## What Already Exists (from Stages 1 and 2)

These are things that were already built and deployed. This stage builds on top of them:

- The candidate landing page lives at `/candidate/[token]` (NOT `/portal/candidate/`)
- Candidates log in with their invitation token + password — they are NOT system users
- The candidate session uses a cookie called `candidate_session`, completely separate from the main user login system
- The session-checking endpoint is at `GET /api/candidate/auth/session`
- The sign-out endpoint is at `POST /api/candidate/auth/signout`
- After login, candidates are currently sent to `/candidate/[token]/portal` which shows the temporary placeholder
- The main site's login-redirect logic in `src/middleware.ts` skips `/candidate` paths
- The main site's auth guard in `src/components/auth/auth-interceptor.tsx` lists `/candidate` as a public path

---

## Business Rules

1. The portal shell must check the candidate's session on every page load by calling `GET /api/candidate/auth/session`. If the session is missing or expired, redirect the candidate back to the login page at `/candidate/[token]`.

2. The portal shell must check whether the invitation has expired. If it has, show a friendly "invitation expired" message instead of the portal, and do not allow any further interaction. The candidate should see who to contact (the company name from the invitation).

3. The portal shell must fetch the application structure — the list of sections the candidate will need to complete — from a new endpoint (see below). This list is assembled from two sources: the workflow's manually-created sections (like consent forms and disclosures) and the package's services (which generate sections like "Address History" and "Employment History").

4. The sections must appear in three groups, always in this order:
   - **Before-service sections** — from the workflow, in the order set by the internal team (e.g., "Notice of Processing", "Instructions")
   - **Service sections** — generated from the package's services, in this fixed order: Identity Verification → Address History → Education History → Employment History
   - **After-service sections** — from the workflow, in the order set by the internal team (e.g., "Consent Form", "Authorization")

5. If the package has multiple services of the same type (e.g., two education verification services), they are combined into one section. The candidate sees "Education History" once, not twice.

6. Service sections use friendly headings, not internal service names:
   - IDV services → "Identity Verification"
   - Record services → "Address History"
   - Verification-edu services → "Education History"
   - Verification-emp services → "Employment History"

7. The portal shell must include a header showing the candidate's first name (e.g., "Welcome, Sarah") and a sign-out button. Tapping sign-out calls `POST /api/candidate/auth/signout` and redirects to the landing page.

8. The portal shell must include a sidebar (desktop) or hamburger menu (mobile) listing all sections. Each section shows its name and a status indicator (not started / in progress / complete). In this stage, all sections will show "not started" since there's no form engine yet — but the status display must be built so Phase 6 can update it.

9. Clicking a section in the sidebar/menu navigates to that section's content area. In this stage, each section's content area shows a placeholder message like "This section will be available soon" since the actual forms come in Phase 6.

10. The portal must be fully usable on mobile phones (minimum 320px wide). Candidates will often open their invitation link on their phone from an SMS. All buttons and touch targets must be at least 44px tall.

11. The candidate portal must be completely isolated from the rest of the application. Candidates must not be able to navigate to any other part of the system (no admin pages, no customer pages, nothing).

12. When the invitation status is "completed" (the candidate already submitted their application), the portal should show a "thank you" / confirmation message instead of the section list. No further editing is allowed after submission.

---

## User Flow

### Desktop Experience

1. The candidate clicks their invitation link and logs in (this already works from Stages 1-2).
2. After login, they land on `/candidate/[token]/portal`.
3. They see a clean layout with:
   - A header bar at the top with "Welcome, [First Name]" on the left and a "Sign Out" button on the right.
   - A sidebar on the left listing all sections they need to complete, each with a status dot (grey = not started).
   - A main content area on the right. By default it shows a welcome/overview message: the company name, a brief explanation of what the candidate needs to do, and how many sections there are.
4. The candidate clicks a section name in the sidebar.
5. The main content area updates to show that section. In this stage, it shows a placeholder: "This section will be available soon."
6. The active section is highlighted in the sidebar.
7. The candidate clicks "Sign Out" and is returned to the landing page.

### Mobile Experience

1. Same login flow.
2. After login, the candidate sees:
   - A header bar with a hamburger menu icon on the left, "Welcome, [First Name]" in the center, and a "Sign Out" button on the right.
   - The main content area showing the welcome/overview message.
3. The candidate taps the hamburger menu icon.
4. A slide-out panel appears from the left showing all sections with their status indicators.
5. The candidate taps a section name.
6. The panel closes and the main content area shows that section's placeholder.
7. The candidate can tap the hamburger icon again to switch sections.

### Expired Invitation

1. A candidate with an expired invitation logs in (login still works — expiration is checked in the portal, not at login).
2. Instead of the portal layout, they see a centered message: "Your invitation has expired. Please contact [Company Name] for assistance."
3. No sidebar, no sections, no navigation — just the message and a sign-out button.

### Completed Application

1. A candidate who has already submitted their application logs in.
2. Instead of the portal layout, they see a confirmation message: "Your application has been submitted. Thank you!"
3. No sidebar, no sections, no navigation — just the confirmation and a sign-out button.

---

## Data Requirements

### New Endpoint: GET /api/candidate/application/[token]/structure

This endpoint returns the list of sections the candidate needs to complete. It reads from the invitation's package and workflow to assemble the section list.

**Request:** No body needed. The token in the URL identifies the invitation.

**Authentication:** Must have a valid `candidate_session` cookie. The session's token must match the URL token.

**Response shape:**

| Field | Type | Description |
|---|---|---|
| invitation | object | Basic invitation info (see below) |
| sections | array | Ordered list of sections (see below) |

**Invitation object fields:**

| Field | Type | Description |
|---|---|---|
| firstName | text | Candidate's first name |
| lastName | text | Candidate's last name |
| status | text | One of: pending, in_progress, completed, expired |
| expiresAt | date | When the invitation expires |
| companyName | text | Name of the customer who sent the invitation |

**Section object fields:**

| Field | Type | Description |
|---|---|---|
| id | text | Unique identifier for this section (used in navigation) |
| title | text | Display name shown to the candidate (e.g., "Education History") |
| type | text | One of: workflow_section, service_section |
| placement | text | One of: before_services, services, after_services |
| status | text | One of: not_started, in_progress, complete |
| order | number | Sort position within its placement group |
| functionalityType | text or null | For service sections: idv, record, verification-edu, verification-emp. Null for workflow sections. |

**Error responses:**

| Situation | Response |
|---|---|
| No session cookie or invalid session | 401 — redirect to login |
| Token in session doesn't match URL token | 403 — access denied |
| Invitation not found | 404 — not found |

**How the section list is assembled (server-side logic):**

1. Look up the invitation by token
2. Find the order linked to this invitation
3. Find the package linked to this order
4. Find the workflow linked to this package
5. Get the workflow's sections — split into before_services and after_services groups, keeping their configured order
6. Get the package's services — group by functionality type, deduplicate (multiple services of the same type = one section), and order them: IDV → Record → Verification-edu → Verification-emp
7. Combine: before_services sections + service sections + after_services sections
8. For each section, set status to "not_started" (Phase 6 will update this based on saved data)

### Modified Endpoint: GET /api/candidate/auth/session

This endpoint already exists from Stage 2. No changes to the endpoint itself, but the portal shell will call it on every page load to verify the session is still valid.

---

## Screen-by-Screen Details

### Portal Layout (the shell)

- **Header:** Full-width bar at the top. Contains welcome message with candidate's first name, and a sign-out button. On mobile, also contains a hamburger menu button.
- **Sidebar (desktop only):** Fixed-width panel on the left side, approximately 280px wide. Lists all sections with their status indicators. The currently active section is highlighted.
- **Hamburger menu (mobile only):** Triggered by the menu icon in the header. Slides out from the left over the content. Contains the same section list as the desktop sidebar. Tapping outside the menu or tapping a section closes it.
- **Main content area:** Takes up the remaining space. Shows either the welcome overview, a section placeholder, or a status message (expired/completed).

### Welcome Overview (default view)

Shown when the candidate first arrives or when no section is selected:
- Greeting: "Welcome, [First Name]"
- Company context: "You've been invited by [Company Name] to complete a background check application."
- Section count: "Your application has [N] sections to complete."
- Instruction: "Select a section from the menu to get started."

### Section Placeholder (temporary for this stage)

Shown when a section is selected:
- Section title at the top
- Message: "This section will be available soon."
- This placeholder will be replaced by actual form content in Phase 6.

### Expired Invitation View

- Centered on the page, no sidebar/menu
- Icon or illustration suggesting time expired (optional)
- Message: "Your invitation has expired"
- Sub-message: "Please contact [Company Name] if you need a new invitation."
- Sign-out button

### Completed Application View

- Centered on the page, no sidebar/menu
- Icon or illustration suggesting success (optional)
- Message: "Your application has been submitted"
- Sub-message: "Thank you, [First Name]. [Company Name] will be in touch with next steps."
- Sign-out button

---

## Edge Cases and Error Scenarios

1. **Session expires while the candidate is using the portal:** The next time any data is fetched (e.g., clicking a section), the session check will fail and the candidate will be redirected to the login page. After re-entering their password, they should be sent back to the portal.

2. **Invitation expires while the candidate is using the portal:** The structure endpoint should re-check expiration on each call. If the invitation has expired since the portal loaded, show the expired view.

3. **Network error when loading the section list:** Show a friendly error message with a "Try Again" button that re-fetches the structure.

4. **Package has no services:** The section list will contain only workflow sections (before and after). No service sections will appear. This is a valid scenario — the portal should handle it gracefully.

5. **Workflow has no sections:** The section list will contain only service sections. No before/after workflow sections will appear. Also valid.

6. **Package has no services AND workflow has no sections:** Extremely unlikely but possible. Show the welcome overview with "Your application has 0 sections" and no navigation items.

7. **Candidate tries to manually navigate to a URL outside /candidate/[token]/:** The existing middleware and auth interceptor already block this. No new work needed.

8. **Candidate opens the portal in multiple browser tabs:** Each tab will independently check the session. This should work fine since we're only reading data in this stage, not writing.

9. **Browser back button:** Should work naturally with the section navigation. If the candidate uses the back button, they should return to the previous section or the welcome overview.

---

## Impact on Other Modules

**No impact on other modules.** The candidate portal is completely isolated from the admin portal and customer portal. It uses its own session system, its own URLs, and its own endpoints. Nothing in this stage changes any existing functionality.

The only "shared" data is read-only: the portal reads from the packages, workflows, and services tables but never writes to them.

---

## Definition of Done

1. The temporary "coming soon" placeholder at `/candidate/[token]/portal` is replaced with the real portal shell layout.
2. The portal shell checks the candidate session on load and redirects to the login page if the session is invalid.
3. The portal shows an "invitation expired" message (with company name) if the invitation has expired, with no section navigation visible.
4. The portal shows a "submitted" confirmation message if the application was already completed, with no section navigation visible.
5. The new `GET /api/candidate/application/[token]/structure` endpoint returns the correct section list assembled from the workflow and package.
6. Before-service workflow sections appear first, in their configured order.
7. Service sections appear in the middle, in the fixed order: IDV → Record → Education → Employment.
8. After-service workflow sections appear last, in their configured order.
9. Multiple services of the same functionality type are combined into one section (not duplicated).
10. Service sections use friendly headings ("Address History", not the internal service name).
11. The header shows "Welcome, [First Name]" and a working sign-out button.
12. On desktop, a sidebar lists all sections with status indicators.
13. On mobile (under 768px), the sidebar is replaced by a hamburger menu that slides out from the left.
14. Clicking/tapping a section highlights it in the sidebar/menu and shows its content in the main area.
15. In this stage, each section's content shows a placeholder message ("This section will be available soon").
16. Each section displays a status indicator (not started / in progress / complete). All show "not started" in this stage.
17. The portal is fully usable on mobile phones down to 320px width, with all touch targets at least 44px tall.
18. The portal does not expose any navigation to other parts of the system — it is completely isolated.
19. Network errors when loading the section list show a friendly error message with a retry option.
20. The browser back button works correctly with section navigation.

---

## Files to Create or Modify

### New files:
- `src/app/api/candidate/application/[token]/structure/route.ts` — the endpoint that assembles and returns the section list
- `src/app/candidate/[token]/portal/page.tsx` — replace the existing placeholder page with the real portal shell
- `src/components/candidate/portal-layout.tsx` — the shell layout component (header + sidebar + content area)
- `src/components/candidate/portal-sidebar.tsx` — the section list sidebar / mobile menu
- `src/components/candidate/portal-header.tsx` — the header bar with welcome message and sign-out
- `src/components/candidate/section-placeholder.tsx` — temporary placeholder shown when a section is selected
- `src/components/candidate/portal-welcome.tsx` — the welcome/overview default view
- `src/components/candidate/portal-expired.tsx` — the "invitation expired" view
- `src/components/candidate/portal-completed.tsx` — the "application submitted" view

### Modified files:
- `src/app/candidate/[token]/portal/page.tsx` — if this file already exists from Stage 2, it will be rewritten rather than created new

---

## Open Questions

None — all design decisions for the portal shell were resolved in the phase plan and design document. The shell is a straightforward layout stage that sets up the container for Phase 6's form engine.