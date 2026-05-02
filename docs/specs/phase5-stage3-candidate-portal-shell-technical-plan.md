# Technical Plan: Candidate Portal Shell
**Based on specification:** phase5-stage3-candidate-portal-shell.md
**Date:** April 29, 2026

## Database Changes
No database changes are needed. The existing schema already has all required models:
- `CandidateInvitation` - stores invitation data and links to order
- `Order` - contains the subject information and links to customer
- `Package` - linked through order creation process (based on services)
- `Workflow` - linked to package
- `WorkflowSection` - stores the workflow sections with placement field
- `PackageService` - links packages to services
- `Service` - contains functionalityType field for service categorization

## New Files to Create

### API Route
- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/candidate/application/[token]/structure/route.ts`
  - Purpose: Returns the list of sections the candidate needs to complete
  - What it will contain: GET endpoint that assembles sections from workflow and package services

### UI Components
- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-layout.tsx`
  - Purpose: Main portal shell layout with header, sidebar/hamburger menu, and content area
  - What it will contain: Layout wrapper component managing responsive layout

- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-header.tsx`
  - Purpose: Portal header with welcome message and sign-out button
  - What it will contain: Header component with candidate name and sign-out functionality

- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-sidebar.tsx`
  - Purpose: Section list sidebar (desktop) and hamburger menu (mobile)
  - What it will contain: Responsive navigation with section list and status indicators

- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-welcome.tsx`
  - Purpose: Welcome/overview default view when no section selected
  - What it will contain: Welcome message with company name and instructions

- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/section-placeholder.tsx`
  - Purpose: Temporary placeholder for section content
  - What it will contain: Simple placeholder message for each section

- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-expired.tsx`
  - Purpose: View shown when invitation has expired
  - What it will contain: Expired message with company contact information

- `/Users/andyhellman/Projects/GlobalRx_v2/src/components/candidate/portal-completed.tsx`
  - Purpose: View shown when application is already completed
  - What it will contain: Confirmation message for completed applications

### Type Definitions
- `/Users/andyhellman/Projects/GlobalRx_v2/src/types/candidate-portal.ts`
  - Purpose: TypeScript types for candidate portal data structures
  - What it will contain: Types for invitation, sections, and API responses

## Existing Files to Modify

- `/Users/andyhellman/Projects/GlobalRx_v2/src/app/candidate/[token]/portal/page.tsx`
  - What currently exists: Temporary placeholder page showing "coming soon" message
  - What needs to change: Replace entirely with real portal shell that renders the portal layout
  - **Confirmation:** File was read - currently shows a simple card with coming soon message

## API Routes

### GET /api/candidate/application/[token]/structure
- Full path: `/api/candidate/application/[token]/structure`
- HTTP methods: GET
- Authentication: Must have valid `candidate_session` cookie, session token must match URL token
- Input data: Token in URL path
- Validation: 
  - Check session exists and is valid
  - Verify token matches session
  - Check invitation exists and status is valid
- Returns on success:
  ```typescript
  {
    invitation: {
      firstName: string,
      lastName: string,
      status: string,
      expiresAt: Date,
      companyName: string
    },
    sections: Array<{
      id: string,
      title: string,
      type: 'workflow_section' | 'service_section',
      placement: 'before_services' | 'services' | 'after_services',
      status: 'not_started' | 'in_progress' | 'complete',
      order: number,
      functionalityType: string | null
    }>
  }
  ```
- Errors:
  - 401: No session or invalid session
  - 403: Session token doesn't match URL token
  - 404: Invitation not found

## Zod Validation Schemas

### candidatePortalStructureSchema
- Located in API route file
- Fields:
  - No request body (GET endpoint)
  - URL params validation:
    - `token`: z.string().min(1)

## TypeScript Types

### CandidateInvitationInfo
- Located in `/src/types/candidate-portal.ts`
- Fields:
  - `firstName`: string
  - `lastName`: string
  - `status`: string
  - `expiresAt`: Date
  - `companyName`: string

### CandidatePortalSection
- Located in `/src/types/candidate-portal.ts`
- Fields:
  - `id`: string
  - `title`: string
  - `type`: 'workflow_section' | 'service_section'
  - `placement`: 'before_services' | 'services' | 'after_services'
  - `status`: 'not_started' | 'in_progress' | 'complete'
  - `order`: number
  - `functionalityType`: string | null

### CandidatePortalStructureResponse
- Located in `/src/types/candidate-portal.ts`
- Fields:
  - `invitation`: CandidateInvitationInfo
  - `sections`: CandidatePortalSection[]

## UI Components

### /src/app/candidate/[token]/portal/page.tsx
- Client component (`"use client"`)
- Renders: Portal layout or status-specific views
- Uses: `portal-layout`, `portal-expired`, `portal-completed` components
- API calls: `/api/candidate/auth/session`, `/api/candidate/application/[token]/structure`

### /src/components/candidate/portal-layout.tsx
- Client component (`"use client"`)
- Renders: Main layout with header, sidebar/menu, content area
- Uses: `portal-header`, `portal-sidebar`, UI components from `/src/components/ui/`
- Manages: Responsive layout, mobile menu state

### /src/components/candidate/portal-header.tsx
- Client component (`"use client"`)
- Renders: Header bar with welcome message and sign-out
- API calls: `POST /api/candidate/auth/logout` for sign-out

### /src/components/candidate/portal-sidebar.tsx
- Client component (`"use client"`)
- Renders: Section list with status indicators, hamburger menu on mobile
- Props: sections array, active section, onSectionClick handler

### /src/components/candidate/portal-welcome.tsx
- Server component
- Renders: Welcome message with company name and instructions
- Props: invitation info, section count

### /src/components/candidate/section-placeholder.tsx
- Server component
- Renders: Placeholder message for section content
- Props: section title

### /src/components/candidate/portal-expired.tsx
- Server component
- Renders: Expired invitation message
- Props: company name

### /src/components/candidate/portal-completed.tsx
- Server component
- Renders: Application submitted confirmation
- Props: candidate first name, company name

## Translation Keys

- `candidate.portal.loading` - "Loading..."
- `candidate.portal.welcome` - "Welcome, {firstName}"
- `candidate.portal.signOut` - "Sign Out"
- `candidate.portal.welcomeTitle` - "Welcome, {firstName}"
- `candidate.portal.companyContext` - "You've been invited by {companyName} to complete a background check application."
- `candidate.portal.sectionCount` - "Your application has {count} sections to complete."
- `candidate.portal.getStarted` - "Select a section from the menu to get started."
- `candidate.portal.sectionPlaceholder` - "This section will be available soon."
- `candidate.portal.expired` - "Your invitation has expired"
- `candidate.portal.expiredMessage` - "Please contact {companyName} if you need a new invitation."
- `candidate.portal.completed` - "Your application has been submitted"
- `candidate.portal.completedMessage` - "Thank you, {firstName}. {companyName} will be in touch with next steps."
- `candidate.portal.menu` - "Menu"
- `candidate.portal.sections.notStarted` - "Not Started"
- `candidate.portal.sections.inProgress` - "In Progress"
- `candidate.portal.sections.complete` - "Complete"
- `candidate.portal.sections.identityVerification` - "Identity Verification"
- `candidate.portal.sections.addressHistory` - "Address History"
- `candidate.portal.sections.educationHistory` - "Education History"
- `candidate.portal.sections.employmentHistory` - "Employment History"
- `candidate.portal.errorLoading` - "Error loading application"
- `candidate.portal.tryAgain` - "Try Again"

## Order of Implementation

1. TypeScript types (`/src/types/candidate-portal.ts`)
2. API route (`/src/app/api/candidate/application/[token]/structure/route.ts`)
3. Portal status components (expired, completed, welcome, placeholder)
4. Portal layout components (header, sidebar)
5. Main portal layout component
6. Update portal page to use new components
7. Translation keys in `/src/translations/en.json` and `/src/translations/es.json`

## Risks and Considerations

1. **Package Discovery**: The specification assumes orders are linked to packages, but in the current schema, orders don't directly reference packages. The package is determined through the services that were ordered. The API will need to derive the package from the order's service items.

2. **Workflow Association**: Similarly, workflows are linked to packages, not directly to orders. The API needs to traverse: Order → OrderItems → Services → Package → Workflow.

3. **Service Deduplication**: When multiple services of the same functionality type exist in a package, they must be combined into a single section. The implementation needs to group services by functionalityType.

4. **Mobile Responsiveness**: The hamburger menu pattern doesn't exist elsewhere in the codebase. We'll need to implement this from scratch using Tailwind's responsive utilities and React state management.

5. **Session Validation**: The portal must validate the session on every page load. Network failures during session check should be handled gracefully with appropriate error messages.

6. **Status Mapping**: The invitation status values in the database need to be checked - the spec mentions "completed" but the existing code checks for "accessed". Need to verify the correct status values.

## Plan Completeness Check

- [x] Every file the implementer will need to touch is listed above
- [x] No file outside this plan will need to be modified
- [x] All Zod schemas, types, and translation keys are listed
- [x] The plan is consistent with the spec's Data Requirements table (field names match)
