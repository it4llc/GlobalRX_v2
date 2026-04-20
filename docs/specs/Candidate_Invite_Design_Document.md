# Candidate Invite Feature — Design Document

**Last Updated:** April 18, 2026
**Status:** Planning Complete — Ready for Phase Planning

---

## Overview

The Candidate Invite feature allows customers to send a link to a candidate so the candidate can enter their own background check information directly into the system. The customer selects a package of services, enters the candidate's basic contact info, and the system generates a link. The candidate clicks the link, creates a password, and completes the application. When done, the order goes straight to "submitted" status.

---

## Core Architectural Decisions

### Package-Workflow Relationship

- A **package** defines the services and their scope (e.g., "Employment Verification — all in past 3 years")
- A **workflow** defines the surrounding application steps — compliance documents, consent forms, notices, instructions, email template, expiration settings, reminder cadence, and gap tolerance
- **One workflow can serve many packages** (e.g., an "EU Workflow" can be used by both "EU Basic" and "EU Premium" packages)
- **A package can only have one workflow**
- The `workflowId` should be stored on the package table (not `packageId` on the workflow table, which is the current one-to-one structure that needs to change)

### Candidate Access

- Candidates do **NOT** become users in the User Admin system — they are completely separate
- A dedicated `CandidateInvitation` table stores the invite link, candidate contact info, hashed password, expiration, and status
- The candidate accesses the application via the original invite link
- First visit: candidate creates a password
- Return visits: candidate enters their password on the same link
- The link works throughout the expiration window — it takes the candidate to either password creation (first time) or password entry (returning)
- If the candidate loses the email, the customer can resend the link

### Link Expiration

- Links expire after a configurable number of days
- The expiration period will be configured in the workflow (for now, a system-wide default like 7 or 14 days)
- The customer can reset or extend the expiration from within the order details page
- Once workflows are fully implemented, reminder cadence is also configured in the workflow

### Country Specification

- In the current order flow, the **customer** specifies the country for each service
- In the candidate invite flow, the **candidate** specifies the country when filling in their entries
- This drives DSX field requirements dynamically — as the candidate adds entries and specifies countries, the fields they see may change based on that country's requirements for that service

### Order Behavior

- **One candidate per order** — each invite creates exactly one order for one candidate
- When the candidate completes and submits their application, the order goes straight to **"submitted"** status
- **All-or-nothing submission** — the candidate must complete all required sections before submitting; partial submission is not supported
- Events are logged in the order's comment history (similar to status changes): "Candidate link generated," "Candidate created account," "Candidate submitted application"
- Notifications to the customer come later — not part of the initial build

### Order Item Creation

- Order items are **NOT** created as the candidate fills in entries
- Order items are created **all at once when the candidate submits** the application
- The candidate's in-progress data lives in auto-saved form data, separate from the order items table
- At submission time, the system creates all order items, service fulfillment records, and sets the order to "submitted" status in one operation

### Auto-Save

- The system auto-saves candidate progress **on field blur** (when the candidate clicks or tabs out of a field)
- The candidate can close the browser and return later without losing work

### Document Uploads

- Candidates may need to upload documents (e.g., diploma scan for education verification)
- For v1, document uploads **reuse the existing new order flow pattern** — files are stored in `uploads/draft-documents/` and tracked in the form data, the same way the customer-facing new order flow handles document uploads
- At submission time, the uploaded files are linked to the appropriate order items and fulfillment records
- Future enhancement: improved upload UX (progress indicators, drag-and-drop, virus scanning)

### Mobile Experience

- The candidate application **must be mobile-optimized from the start** — candidates will frequently receive invite links via SMS and open them on their phones
- Use standard responsive Tailwind patterns and mobile-first design

---

## Candidate Application Structure

The candidate's application is assembled from three sources and displayed in three zones:

### Zone 1: Before-Service Sections (from Workflow)

- Manually added and ordered by the internal team in the workflow configuration
- Examples: Notice of Processing (EU), Instructions, Disclosure forms
- These are compliance documents, forms, and informational content **not tied to a specific service**
- The internal team designates each manual section as "before services" or "after services" and can reorder within their group

### Zone 2: Service Sections (auto-generated from Package)

- Automatically generated based on the services in the package
- The candidate sees friendly section headings (e.g., "Employment History"), **not service names**
- **Multiple services of the same functionality type are combined into one section** (e.g., two "Verification-edu" services share one "Education History" section)
- Displayed in a fixed order based on functionality type:

| Order | Functionality Type | Section Heading Example | Candidate Experience |
|-------|-------------------|------------------------|---------------------|
| 1 | IDV | Identity Verification | Simple, single entry — candidate enters ID information |
| 2 | Record | Address History | Candidate enters residential addresses for the scope period. System creates order items behind the scenes for each applicable jurisdiction. One section covers ALL record-type services (criminal, civil, bankruptcy, etc.) |
| 3 | Verification-edu | Education History | Candidate enters education entries based on scope |
| 4 | Verification-emp | Employment History | Candidate enters employment entries based on scope |

### Zone 3: After-Service Sections (from Workflow)

- Manually added and ordered by the internal team in the workflow configuration
- Examples: General Consent Form (Australia), Authorization to Run Background Check
- Same configuration approach as before-service sections

---

## Service Section Details

### IDV (Identity Verification)

- Simple single-entry section
- Candidate enters their identity document information
- Initial build: treated as a simple data collection section
- Future enhancement: third-party vendor integration, gating logic (if IDV fails, remaining checks go on hold)

### Records (Address-Driven Searches)

This is the most complex section type:

1. Candidate enters residential address history with **start and end dates** for the scope period defined in the package
2. For each address, the system determines the country
3. The system checks **DSX availability** for each record-type service in the package for that country to find what jurisdiction level applies (country, state, county, etc.)
4. At submission time, the system automatically creates order items at the correct jurisdiction level
5. A single country can generate **multiple order items** — e.g., in the US, records are searched at the county level, so one US address creates a county-level search for that specific county
6. The candidate never sees individual search names — they just enter where they've lived
7. All record-type services in the package (criminal, civil, bankruptcy, etc.) are handled from this one address entry section

### Verification — Education

- Candidate enters education entries
- Number of entries driven by package scope:
  - "Most recent" = exactly 1 entry
  - "Most recent 2" = exactly 2 entries
  - "All in past X years" = candidate keeps adding entries until the time period is covered
- Each entry requires the candidate to specify the country, which drives DSX field requirements
- System validates that the scope requirement is met before allowing submission

### Verification — Employment

- Same pattern as education
- Candidate enters employment entries with **start and end dates**
- Scope drives how many entries are needed
- For time-based scopes, the system validates that entries cover the required period
- Gaps are handled differently than address history (see Gap Tolerance below)

---

## Scope Validation

The package defines the scope for each service, and the system enforces it:

| Scope Type | Example | Validation |
|-----------|---------|------------|
| Count — exact | "Most recent" | Exactly 1 entry required |
| Count — specific | "Most recent 2" | Exactly 2 entries required |
| Time-based | "All in past 3 years" | Entries must cover the full time period (date ranges validated) |
| All | "All" | At least 1 entry required, no upper limit |

---

## Gap Tolerance

- Configurable per workflow (e.g., "no gaps greater than 30 days")
- When the system detects a gap between entries that exceeds the tolerance, the candidate must fill it
- **Employment gaps:** Candidate adds an employment "item" for the gap period (e.g., "Unemployed" from June 2024 to September 2024)
- **Address history gaps:** Candidate must provide an actual address, because the address data is needed to determine which searches to create

---

## Email Template

- The email template is part of the workflow configuration
- For the initial build, a default template per workflow that includes:
  - Customer's company name
  - Candidate's first name
  - The invite link
  - Expiration information
- Future enhancement: customizable email templates per workflow with full template editor and variable insertion

---

## Candidate Invite UI (Customer Side)

### Creating an Invite

- Customer clicks "Create Candidate Invite" from the dashboard/fulfillment page
- Customer selects a package (which determines services, scope, and workflow)
- Customer enters candidate's basic info: first name, last name, email, mobile number
- System generates the invite link and sends the email
- An order is created in draft status tied to the invite

### Managing an Invite

- Customer can view invite status from within the order details (left-side order details panel)
- Status indicators: pending, in progress, expired, completed
- Actions available: extend expiration, resend link
- Events logged in order comment history

---

## Database Changes Required

### Schema Changes

1. **Reverse the workflow-to-package relationship:**
   - Remove `packageId` from the `workflows` table
   - Add `workflowId` to the `customer_packages` table
   - This enables one workflow → many packages

2. **Add "idv" functionality type:**
   - Update the functionality type options to include IDV alongside Record, Verification-edu, Verification-emp, and Other

3. **New `CandidateInvitation` table:**
   - `id` — UUID primary key
   - `orderId` — links to the order
   - `customerId` — the customer who created the invite
   - `token` — unique random string for the URL (not the order ID)
   - `firstName` — candidate's first name
   - `lastName` — candidate's last name
   - `email` — candidate's email
   - `phone` — candidate's mobile number
   - `passwordHash` — hashed password (null until candidate creates one)
   - `status` — pending, in_progress, completed, expired
   - `expiresAt` — when the link expires
   - `createdAt` — creation timestamp
   - `createdBy` — user who created the invite
   - `completedAt` — when the candidate submitted
   - `lastAccessedAt` — when the candidate last opened the application

4. **Email template fields on workflows table:**
   - `emailSubject` — email subject line template
   - `emailBody` — email body template
   - Template variables support (candidate name, company name, link, expiration)

### Existing Tables Used

- `customer_packages` — package with services and scope
- `package_services` — services in a package with scope configuration
- `workflows` — workflow configuration (expiration, reminders, gap tolerance)
- `workflow_sections` — before/after service sections
- DSX tables — field requirements per service per country per jurisdiction level
- `orders` — created when invite is generated
- `order_items` — created when candidate submits (all at once, not incrementally)
- `services_fulfillment` — auto-created with each order item
- `order_data` — stores candidate's in-progress form data and document upload references

---

## What Needs To Be Built

### Infrastructure Fixes (Completed)

- ✅ Permission key standardization to `customer_config`
- ✅ ModalDialog declarative `open` prop support
- ✅ Package and workflow creation UI functional

### Infrastructure Fixes (Remaining)

- [ ] Reverse workflow-to-package relationship (one-to-many)
- [ ] Add "idv" functionality type
- [ ] Fix pre-existing package API bugs (PUT returns 500 for view-only, DELETE returns 200 for view-only)

### New Features To Build

1. **Workflow section configuration** — before/after service sections with ordering
2. **Email template configuration** — on the workflow
3. **Gap tolerance setting** — on the workflow
4. **CandidateInvitation table and API** — create, manage, extend invitations
5. **Candidate invite creation flow** — customer UI to select package, enter candidate info, generate link
6. **Candidate login/access** — landing page, password creation, password entry for returning candidates
7. **Candidate application shell** — restricted view with no access to other portal functionality, mobile-optimized
8. **Dynamic form engine** — assembles the application from workflow sections + package services, loads DSX fields per service per country
9. **Scope validation** — enforces count and time-based scope requirements
10. **Gap tolerance validation** — detects gaps, requires candidate to fill them
11. **Address-to-order-item generation** — at submission time, for record-type services, creates order items per jurisdiction based on DSX availability
12. **Document uploads** — reuses existing new order flow draft document pattern
13. **Auto-save** — saves candidate progress on field blur
14. **Submission flow** — validates completeness, creates all order items in one batch, sets order to submitted, logs events in comment history

---

## Resolved Design Decisions

The following questions were resolved on April 18, 2026:

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | "Other" functionality type | **Deferred to future** | Needs further definition of what services fall into this category |
| 2 | Multiple services of same type | **Combined into one section** | E.g., two edu verification services share one "Education History" section |
| 3 | Address/employment cross-referencing | **Deferred to future** | Not needed for v1; adds complexity without critical value |
| 4 | IDV gating | **Deferred to future** | Requires third-party vendor integration |
| 5 | Multiple candidates per order | **One candidate per order** | Keeps data model clean and simple |
| 6 | Email template variables | **Basic set for v1** | Candidate name, company name, link, expiration. Custom templates per workflow in a future phase |
| 7 | Mobile experience | **Mobile-optimized from the start** | Candidates will frequently open links on phones via SMS |
| 8 | Document uploads | **Reuse existing new order flow pattern** | Files stored in `uploads/draft-documents/`, tracked in form data. Enhanced upload UX in a future phase |
| 9 | Auto-save frequency | **On field blur** | Triggers when candidate clicks or tabs out of a field, not on every keystroke |
| 10 | Partial submission | **All-or-nothing** | Candidate must complete all sections before submitting |
| 11 | Order item creation timing | **At submission time (batch)** | All order items created when candidate submits, not incrementally as entries are added. In-progress data stored separately in auto-save |