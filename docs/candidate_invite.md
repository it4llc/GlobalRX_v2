# Candidate Invite Feature — Design Document

**Last Updated:** April 16, 2026
**Status:** Investigation Complete — Ready for Implementation Planning

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

### Package Content Rule

- A package should not contain two services of the same functionality type (e.g., no two employment verification services in the same package)
- For the initial build, this is **user-driven compliance** — the person configuring the package is responsible for following this rule
- System enforcement may be added later if needed

### Candidate Access

- Candidates do **NOT** become users in the User Admin system — they are completely separate
- A dedicated `CandidateInvitation` table stores the invite link, candidate contact info, hashed password, expiration, and status
- **One candidate per order** — each order has exactly one CandidateInvitation record
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

- When the candidate completes and submits their application, the order goes straight to **"submitted"** status
- Events are logged in the order's comment history (similar to status changes): "Candidate link generated," "Candidate created account," "Candidate submitted application"
- Notifications to the customer come later — not part of the initial build

### Auto-Save

- The system auto-saves candidate progress as they fill in fields
- The candidate can close the browser and return later without losing work

### Email Provider

- **SendGrid** for the first instance of the platform
- Email provider may vary per platform instance — should be configurable via environment variables rather than hardcoded
- Email service module should be abstract enough to swap providers (Resend, AWS SES, etc.) without rewriting application code

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
- One section per functionality type present in the package (with the rule that packages don't contain duplicate functionality types)
- The Records section is a special case — it covers ALL record-type services (criminal, civil, bankruptcy, etc.) even when the package contains multiple record-type services. The candidate enters address history once, and the system creates order items for each record-type service behind the scenes.
- Displayed in a fixed order based on functionality type:

| Order | Functionality Type | Section Heading Example | Candidate Experience |
|-------|-------------------|------------------------|---------------------|
| 1 | IDV | Identity Verification | Simple, single entry — candidate enters ID information |
| 2 | Record | Address History | Candidate enters residential addresses for the scope period. System creates order items behind the scenes for each applicable jurisdiction. One section covers ALL record-type services (criminal, civil, bankruptcy, etc.) |
| 3 | Verification-edu | Education History | Candidate enters education entries based on scope |
| 4 | Verification-emp | Employment History | Candidate enters employment entries based on scope |
| 5 | Other | (varies) | TBD — needs further definition |

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
4. The system automatically creates order items at the correct jurisdiction level
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

### Other

- Behavior needs further definition based on what services fall into this category
- Open question for future planning

---

## Scope Validation

The package defines the scope for each service, and the system enforces it:

| Scope Type | Example | Validation |
|-----------|---------|------------|
| Count — exact | "Most recent" | Exactly 1 entry required |
| Count — specific | "Most recent 2" | Exactly 2 entries required |
| Time-based | "All in past 3 years" | Entries must cover the full time period (date ranges validated) |
| All | "All" | At least 1 entry required, no upper limit |

**Existing scope types already supported in the codebase:**
- Education: highest-degree, highest-degree-inc-highschool, all-degrees
- Employment: most-recent, most-recent-x, past-x-years, all-employers
- Records: current-address, all-addresses, past-x-years

The scope selector UI component already exists at `/src/components/modules/customer/scope-selector.tsx` and stores scope as a JSON object on the `PackageService` junction table with a structure like `{ "type": "past-x-years", "quantity": 3, "years": 7 }`.

**No changes needed to the scope system.**

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
- Future enhancement: full template editor with variable insertion

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
   - Add `workflowId` (optional, nullable) to the `customer_packages` table
   - This enables one workflow → many packages
   - **Current state:** `packageId` exists on the Workflow model as a required field with a relation to Package. This is a one-to-one relationship that needs to become one-to-many going the other direction.
   - **Impact:** High — requires migration, API route updates, and UI component updates for both workflow and package management

2. **Add `position` and `sectionType` fields to WorkflowSection:**
   - Add `position` field (string: 'before_services' or 'after_services')
   - Add `sectionType` field to database (currently only defined in UI code as: form, idInfo, personalInfo, employment, education, other, documents, summary, consent)
   - **Current state:** WorkflowSection has `displayOrder` (integer) for ordering and `isRequired` (boolean), but no position or type fields in the database. The UI has section types defined in code but they aren't persisted.
   - **Impact:** Medium — database migration plus API/UI updates

3. **Add workflow-level settings:**
   - Add `gapToleranceDays` field to Workflow model (integer, nullable)
   - Add `emailSubject` field to Workflow model (string, nullable)
   - Add `emailBody` field to Workflow model (text, nullable)
   - **Current state:** Workflow model already has `expirationDays`, `reminderEnabled`, `reminderFrequency`, `maxReminders`. Gap tolerance and email template fields do not exist.
   - **Impact:** Low — straightforward column additions

4. **Add `jurisdictionLevel` to DSX:**
   - Add `jurisdictionLevel` field to `DSXAvailability` or a related model to track whether searches happen at country, state, or county level
   - **Current state:** The DSX system has `DSXRequirement`, `ServiceRequirement`, `DSXMapping`, and `DSXAvailability` models. The relationship chain is Service → ServiceRequirement → DSXRequirement, with DSXMapping for location-specific overrides. There is NO jurisdiction level field.
   - **Impact:** Medium — new field and logic for hierarchical requirement resolution. Critical for the address-driven records section. **A dedicated design conversation is needed before implementation.**

5. **Add "idv" functionality type:**
   - Update the hardcoded array in `src/components/modules/global-config/tabs/services-tab.tsx` (line 51)
   - Add display mapping for "idv" → "Identity Verification"
   - **Current state:** Functionality types are hardcoded strings in the component, not a database enum. The `functionalityType` field on the Service table accepts any string value.
   - **Impact:** Low — simple code change in 2-3 files, no database migration needed

6. **New `CandidateInvitation` table:**
   - `id` — UUID primary key
   - `orderId` — links to the order (**UNIQUE constraint** — one candidate per order)
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
   - **Current state:** No candidate-related models exist in the database.
   - **Impact:** High — entirely new table and full API/UI to build

### Existing Tables — No Changes Needed

- `package_services` — services in a package with scope configuration (**scope system is fully implemented and sufficient**)
- `orders` — created when invite is generated
- `order_items` — created when candidate submits
- `services_fulfillment` — auto-created with each order item

### Existing Tables — Minor Changes

- `customer_packages` — add `workflowId` column
- `workflows` — remove `packageId`, add `gapToleranceDays`, `emailSubject`, `emailBody`
- `workflow_sections` — add `position`, `sectionType`
- DSX availability table — add `jurisdictionLevel`

---

## Current Codebase State (from April 15, 2026 Investigation)

### What Already Works — No Changes Needed

- **Scope system:** Fully implemented. Scope selector UI, JSON storage on PackageService, supports all required scope types (count-based, time-based, all). Located at `/src/components/modules/customer/scope-selector.tsx`.
- **Package CRUD:** Full create/edit/delete with service selection and scope configuration. UI at `/src/components/modules/customer/customers-packages-fixed.tsx`.
- **Workflow CRUD:** Full create/edit/delete with section management, status management (draft/active/archived), expiration and reminder settings. Components in `/src/components/modules/workflows/`.
- **Workflow Section CRUD:** Full UI for managing sections with display ordering, required flag, and dependency configuration.
- **DSX Requirements:** Core relationship chain works (Service → ServiceRequirement → DSXRequirement, with DSXMapping for location-specific overrides).

### What Needs Modification

- **Workflow-Package relationship:** Reverse direction (currently `packageId` on Workflow, needs to be `workflowId` on Package)
- **WorkflowSection model:** Add `position` (before/after services) and `sectionType` fields to database
- **DSX:** Add `jurisdictionLevel` field for address-driven searches
- **Workflow model:** Add `gapToleranceDays`, `emailSubject`, `emailBody` fields
- **Functionality types:** Add "idv" to the hardcoded list (simple change)

### What Needs to Be Built from Scratch

- **Email infrastructure:** No email library installed, no templates, no SMTP configuration. Entire email system needs to be set up. **First instance will use SendGrid; should be configurable per instance.**
- **CandidateInvitation table and API:** No candidate-related database models exist
- **Candidate portal:** No public-facing candidate pages or authentication exist
- **Dynamic form engine:** No code connects workflow sections to DSX data entry fields
- **Candidate auto-save system**
- **Address-to-order-item generation logic**
- **Scope validation engine**
- **Gap tolerance validation**
- **Submission flow**

---

## What Needs To Be Built

### Infrastructure Fixes (Completed)

- ✅ Permission key standardization to `customer_config`
- ✅ ModalDialog declarative `open` prop support
- ✅ Package and workflow creation UI functional
- ✅ Package creation bug fix (await params in Next.js routes)
- ✅ Next.js 15 dynamic route migration (26 routes)

### Infrastructure Changes (Remaining)

- [ ] Reverse workflow-to-package relationship (one-to-many) — **HIGH PRIORITY, foundation for everything**
- [ ] Add `position` and `sectionType` to WorkflowSection model
- [ ] Add `gapToleranceDays`, `emailSubject`, `emailBody` to Workflow model
- [ ] Add `jurisdictionLevel` to DSX availability
- [ ] Add "idv" functionality type (simple code change)
- [ ] Fix pre-existing package API bugs (PUT returns 500 for view-only, DELETE returns 200 for view-only)

### New Features To Build

1. **Email infrastructure** — install email library, create email service module with SendGrid for first instance, configure via environment variables
2. **Workflow section configuration** — update UI to support before/after service positioning
3. **Email template configuration** — add template editor to workflow management
4. **Gap tolerance setting** — add to workflow configuration UI
5. **CandidateInvitation table and API** — create, manage, extend invitations
6. **Candidate invite creation flow** — customer UI to select package, enter candidate info, generate link
7. **Candidate login/access** — landing page, password creation, password entry for returning candidates
8. **Candidate application shell** — restricted view with no access to other portal functionality
9. **Dynamic form engine** — assembles the application from workflow sections + package services, loads DSX fields per service per country
10. **Scope validation** — enforces count and time-based scope requirements
11. **Gap tolerance validation** — detects gaps, requires candidate to fill them
12. **Address-to-order-item generation** — for record-type services, creates order items per jurisdiction based on DSX availability
13. **Auto-save** — saves candidate progress on field changes
14. **Submission flow** — validates completeness, creates remaining order items, sets order to submitted, logs events in comment history

---

## Recommended Implementation Order

### Phase 1: Database & Schema Changes
1. Reverse workflow-to-package relationship
2. Add WorkflowSection fields (position, sectionType)
3. Add Workflow fields (gapToleranceDays, emailSubject, emailBody)
4. Add jurisdictionLevel to DSX (**requires dedicated design conversation first**)
5. Create CandidateInvitation table (with unique constraint on orderId)
6. Add "idv" functionality type

### Phase 2: Workflow Configuration Enhancements
1. Update workflow UI for new fields (gap tolerance, email template)
2. Update workflow section UI for position (before/after services)
3. Update package UI for workflow selection (now that relationship is reversed)

### Phase 3: Email Infrastructure
1. Install SendGrid (or configurable alternative)
2. Create email service module with provider abstraction
3. Build invitation email templates

### Phase 4: Candidate Invite Creation (Customer Side)
1. "Create Candidate Invite" button and flow on dashboard
2. Package selection, candidate info entry
3. Invitation generation and email sending
4. Order creation tied to invitation

### Phase 5: Candidate Portal
1. Public landing page for invite links
2. Password creation and authentication
3. Candidate application shell (restricted view)
4. Dynamic form engine (workflow sections + package services + DSX fields)

### Phase 6: Candidate Data Entry & Validation
1. Auto-save system
2. Scope validation
3. Gap tolerance validation
4. Address-to-order-item generation for records

### Phase 7: Submission & Integration
1. Submission flow (validate completeness, create order items, update status)
2. Event logging in order comment history
3. Invite status management (customer side — extend, resend)

---

## Answered Decisions

- ✅ **Multiple candidates per order:** One candidate per order. `orderId` on CandidateInvitation has a unique constraint.
- ✅ **Email service provider:** SendGrid for the first platform instance. The email module should be abstracted so providers can be swapped via environment configuration.
- ✅ **Multiple services of the same functionality type:** A package should not contain duplicate functionality types. For the initial build, this is user-driven compliance — the person configuring the package is responsible for following this rule. The one exception is the Records section, which handles multiple record-type services (criminal, civil, bankruptcy, etc.) because they all share the same address-based data entry.

---

## Open Questions (To Be Answered at Relevant Phase)

1. **"Other" functionality type:** What services fall into this category and what should the candidate experience look like for them? (Phase 5/6)

2. **Address history and education/employment overlap:** If both Records and Employment have time-based scopes, the candidate enters dates for both. Should the system cross-reference these (e.g., suggest addresses based on employment locations)? (Phase 6)

3. **IDV gating (future):** When IDV fails, should all other sections be hidden from the candidate, or shown but locked with a message explaining the hold? (Future enhancement — not initial build)

4. **Template variables for email:** What variables should be supported beyond candidate name, company name, link, and expiration date? (Phase 3)

5. **Mobile experience:** Should the candidate application be optimized for mobile since candidates may receive the link via SMS and open it on their phone? (Phase 5)

6. **Document uploads:** Some services may require the candidate to upload documents (e.g., diploma scan for education verification). How should this be handled in the candidate application? (Phase 5/6)

7. **Auto-save frequency:** Should auto-save trigger on every field change, on section navigation, or on a timed interval? (Phase 6)

8. **Partial submission:** If a candidate fills in employment but not education, can the completed portions be submitted while the rest remains in progress? Or is it all-or-nothing? (Phase 7)

9. **Order items for non-address-driven services:** For verification services (education, employment), when are the order items created? When the candidate adds each entry, or all at once when they submit? (Phase 6)

10. **Jurisdiction level data population:** When the jurisdictionLevel field is added to DSX, how will existing records be populated? Manual entry, bulk import, or default to country-level? (Phase 1 — part of the dedicated design conversation)