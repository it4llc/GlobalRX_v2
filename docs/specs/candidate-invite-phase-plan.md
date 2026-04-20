# Candidate Invite Feature — Phase Plan

**Created:** April 18, 2026
**Status:** Ready for Review

---

## Overview

The Candidate Invite feature will be built in **8 phases** over approximately 12-14 weeks. Each phase is independently deployable and delivers working functionality. The phases are designed to minimize risk, establish infrastructure first, and progressively build toward the complete feature.

**Critical Requirement:** All candidate-facing UI (Phases 5, 6, and 7) must be built mobile-first. This is not optional — candidates will frequently access invite links via SMS on their phones.

### Phase Summary

1. **Phase 1: Database Infrastructure** — Reverse workflow-package relationship, add IDV functionality type
2. **Phase 2: Workflow Configuration** — Before/after service sections, email templates, gap tolerance
3. **Phase 3: Candidate Invitation Foundation** — Database table, core APIs, token generation
4. **Phase 4: Customer-Side Invite Creation** — UI to create and manage invites
5. **Phase 5: Candidate Access & Authentication (Mobile-First)** — Landing page, password creation, secure access
6. **Phase 6: Dynamic Application Engine (Mobile-First)** — Form assembly, DSX integration, auto-save, document uploads
7. **Phase 7: Validation & Submission (Mobile-First)** — Scope enforcement, gap detection, order item generation
8. **Phase 8: Polish & Edge Cases** — Accessibility, performance optimization, print view, edge case handling

---

## Phase 1: Database Infrastructure

**Status:** ✅ Complete (April 20, 2026)

**Goal:** Establish the correct data model foundation for workflows, packages, and new functionality types

**Prerequisites:** None

**Scope:**
- Reverse the workflow-to-package relationship (one-to-many)
- Add "idv" functionality type to the system
- Fix pre-existing package API permission bugs (PUT/DELETE returning incorrect status codes)
- Update all existing code to work with the new relationship

**Database changes:**
- Remove `packageId` from `workflows` table
- Add `workflowId` (nullable initially) to `packages` table
- Update functionality type enum to include "idv"
- Migration to handle existing data relationships

**New API endpoints:** None

**Modified API endpoints:**
- `/api/customer/packages` — update to handle workflowId
- `/api/workflows` — remove package relationship handling

**New UI components:** None

**What's testable at the end:**
- Existing package and workflow UIs continue to work
- Can assign a workflow to a package
- Multiple packages can share the same workflow
- Package API properly returns 403 for view-only permissions

**Estimated complexity:** Medium

**Key risks:**
- Data migration complexity if existing relationships are inconsistent
- Breaking changes to existing package/workflow code

---

## Phase 2: Workflow Configuration

**Goal:** Enable configuration of workflow sections, email templates, and validation rules

**Prerequisites:** Phase 1 complete

**Scope:**
- Add section placement field (before_services/after_services) to WorkflowSection
- Add email template fields to Workflow model
- Add gap tolerance and expiration settings to Workflow model
- Build UI for managing workflow sections with placement designation
- Build UI for email template configuration (basic text editor)

**Database changes:**
- Add `placement` field to `workflow_sections` table
- Add `emailSubject`, `emailBody` fields to `workflows` table
- Add `expirationDays`, `gapToleranceDays` fields to `workflows` table

**New API endpoints:**
- `/api/workflows/[id]/sections` — CRUD for workflow sections

**Modified API endpoints:**
- `/api/workflows` — handle new template and settings fields

**New UI components:**
- Enhanced workflow dialog with email template tab
- Workflow section management with before/after placement
- Gap tolerance and expiration settings UI

**What's testable at the end:**
- Can create workflow sections marked as "before services" or "after services"
- Can configure email templates with variables
- Can set expiration and gap tolerance on workflows
- Sections display in correct order within their placement group

**Estimated complexity:** Medium

**Key risks:**
- Email template variable parsing complexity
- Section ordering logic edge cases

---

## Phase 3: Candidate Invitation Foundation

**Goal:** Establish the core invitation system with database tracking and secure token generation

**Prerequisites:** Phase 2 complete

**Scope:**
- Create CandidateInvitation table and model
- Build invitation creation API with token generation
- Build invitation lookup and validation API
- Implement expiration checking
- Create order in draft status when invitation is created
- Log invitation events in order comment history

**Database changes:**
- Create `candidate_invitations` table with all fields from design
- Add indexes for token lookup and status queries

**New API endpoints:**
- `/api/candidate/invitations` — POST to create invitation
- `/api/candidate/invitations/[token]` — GET invitation details
- `/api/candidate/invitations/[id]/extend` — POST to extend expiration
- `/api/candidate/invitations/[id]/resend` — POST to resend email

**New UI components:** None (APIs only in this phase)

**What's testable at the end:**
- Can create invitation via API with unique token
- Invitation creates draft order
- Can look up invitation by token
- Expiration is properly enforced
- Events are logged to order comments

**Estimated complexity:** Low

**Key risks:**
- Token collision handling
- Email delivery reliability

---

## Phase 4: Customer-Side Invite Creation

**Goal:** Enable customers to create and manage candidate invitations through the UI

**Prerequisites:** Phase 3 complete

**Scope:**
- Build "Create Candidate Invite" button and flow
- Package selection dialog
- Candidate information form (name, email, phone)
- Invitation management UI in order details panel
- Display invitation status and actions (extend, resend)
- Send invitation emails using workflow templates

**Database changes:** None

**New API endpoints:** None (using Phase 3 APIs)

**New UI components:**
- Create Candidate Invite button on dashboard
- Package selection dialog for invitations
- Candidate information form
- Invitation status panel in order details
- Invitation management actions (extend, resend)

**What's testable at the end:**
- Customer can create invitation from dashboard
- Email is sent to candidate with correct template
- Customer can see invitation status in order
- Customer can extend expiration or resend link
- Order shows as "draft" with invitation pending

**Estimated complexity:** Medium

**Key risks:**
- Email template variable substitution
- UI/UX for invitation status display

---

## Phase 5: Candidate Access & Authentication (Mobile-First)

**Goal:** Enable candidates to access their application securely without becoming system users

**Prerequisites:** Phase 4 complete

**Mobile-First Requirements:**
- All screens must be fully functional on mobile devices (320px minimum width)
- Touch-optimized input fields and buttons (minimum 44px touch targets)
- Mobile-appropriate password fields with visibility toggle
- Responsive layouts using Tailwind's mobile-first approach
- Test on actual mobile devices, not just browser DevTools

**Scope:**
- Build candidate landing page at `/portal/candidate/[token]` (mobile-first)
- Implement password creation flow for first visit (mobile-optimized forms)
- Implement password verification for returning candidates
- Create candidate session management (separate from user sessions)
- Build restricted candidate portal shell (mobile-first navigation)
- Track last accessed timestamp
- Handle mobile browser quirks (keyboard behavior, viewport issues)

**Database changes:** None (using existing CandidateInvitation fields)

**New API endpoints:**
- `/api/candidate/auth/create-password` — POST to set initial password
- `/api/candidate/auth/verify` — POST to verify returning candidate
- `/api/candidate/auth/session` — GET current candidate session

**New UI components:**
- Mobile-first candidate landing page
- Mobile-optimized password creation form
- Mobile-optimized password entry form for returning
- Mobile-first candidate portal layout (hamburger menu or bottom navigation)
- Session timeout handling with mobile-appropriate messaging

**What's testable at the end:**
- Candidate can access application via emailed link on mobile
- Password creation works smoothly on mobile devices
- Return visit password entry works on mobile
- Candidate session is isolated from user sessions
- Candidate cannot access other portal areas
- All UI elements are properly sized for touch interaction

**Estimated complexity:** High

**Key risks:**
- Session security and isolation
- Password reset flow complexity
- Mobile browser session handling
- iOS Safari private browsing limitations

---

## Phase 6: Dynamic Application Engine with Document Uploads (Mobile-First)

**Goal:** Build the core form engine that assembles and displays the candidate application, including document uploads

**Prerequisites:** Phase 5 complete

**Mobile-First Requirements:**
- Form fields optimized for mobile input (proper input types, autocomplete attributes)
- Mobile-friendly file upload (camera access for documents)
- Collapsible sections for better mobile navigation
- Auto-save indicator visible on mobile without obscuring content
- Smooth scrolling between sections
- Virtual keyboard handling (no fields hidden behind keyboard)

**Scope:**
- Build form assembly engine (workflow sections + package services)
- Implement service section generation based on functionality type
- Integrate DSX field requirements per service/country
- Build auto-save system (on field blur)
- Create dynamic field rendering based on DSX requirements
- **Implement document upload using draft-documents pattern**
- **Mobile-optimized file upload with camera support**
- Store in-progress data in order_data table
- Implement section navigation and progress tracking (mobile-friendly)

**Database changes:** None (using existing order_data structure)

**New API endpoints:**
- `/api/candidate/application/[token]` — GET assembled application structure
- `/api/candidate/application/[token]/save` — POST auto-save data
- `/api/candidate/application/[token]/fields` — GET DSX fields for service/country
- `/api/candidate/application/[token]/upload` — POST document upload

**New UI components:**
- Mobile-first application form shell with collapsible navigation
- Touch-optimized dynamic field renderer for DSX fields
- Mobile-first section components for each functionality type:
  - IDV section (single entry, mobile-optimized)
  - Address history section (date pickers work on mobile)
  - Education section (add/remove entries mobile-friendly)
  - Employment section (add/remove entries mobile-friendly)
- Workflow section renderer (mobile-readable documents)
- **Mobile-optimized document upload component**
  - Camera capture option on mobile
  - Progress indicators for uploads
  - File preview on mobile
- Mobile-visible progress indicator
- Non-intrusive auto-save indicator

**What's testable at the end:**
- Application displays correctly on mobile screens
- DSX fields work properly with mobile keyboards
- Auto-save works reliably on mobile connections
- Document upload works via camera on mobile devices
- File uploads handle mobile network interruptions
- Progress is preserved between mobile sessions
- Section navigation is smooth on touch devices
- Virtual keyboard doesn't obscure active fields

**Estimated complexity:** High

**Key risks:**
- DSX integration complexity
- Form state management on mobile browsers
- Auto-save with intermittent mobile connectivity
- File upload size limits and network timeouts
- Camera API compatibility across devices
- Dynamic field validation on mobile

---

## Phase 7: Validation & Submission (Mobile-First)

**Goal:** Implement all validation logic and the final submission process with mobile-first UX

**Prerequisites:** Phase 6 complete

**Mobile-First Requirements:**
- Validation errors clearly visible on small screens
- Touch-friendly error navigation (tap to scroll to error)
- Mobile-optimized submission flow with clear progress
- Network resilience for submission on mobile connections
- Clear success messaging on mobile

**Scope:**
- Implement scope validation (count and time-based)
- Implement gap tolerance detection and enforcement
- Build address-to-jurisdiction mapping for record services
- Implement submission validation (all required fields)
- Create batch order item generation at submission
- Set order to "submitted" status
- Log submission event in comment history
- Send confirmation to candidate and notification to customer
- Mobile-optimized validation error display
- Mobile-friendly submission confirmation

**Database changes:** None

**New API endpoints:**
- `/api/candidate/application/[token]/validate` — POST validation check
- `/api/candidate/application/[token]/submit` — POST final submission

**Modified API endpoints:**
- `/api/portal/orders/[id]/submit` — adapt for candidate submissions

**New UI components:**
- Mobile-optimized validation error display
- Touch-friendly gap detection UI with prompts
- Mobile submission confirmation dialog
- Mobile-first success page after submission
- Network retry UI for failed submissions on mobile

**What's testable at the end:**
- Validation errors display clearly on mobile
- Users can navigate to errors by tapping on mobile
- Scope requirements work correctly on mobile forms
- Gap detection UI is usable on small screens
- Submission works reliably on mobile networks
- Success confirmation is clear on mobile
- All order items are created correctly
- Order status changes to "submitted"
- Events are logged in comment history

**Estimated complexity:** High

**Key risks:**
- Complex jurisdiction mapping logic
- Transaction rollback on partial failure
- Edge cases in gap calculation
- Mobile network timeout handling
- Time zone handling for mobile users

---

## Phase 8: Polish & Edge Cases

**Goal:** Complete the feature with accessibility improvements, performance optimization, print view, and edge case handling

**Prerequisites:** Phase 7 complete

**Scope:**
- Comprehensive accessibility audit and improvements
- Performance optimization for large applications
- Print-friendly view of completed application
- Handle edge cases:
  - Browser back button behavior
  - Multiple tabs open simultaneously
  - Session timeout recovery
  - Network interruption recovery
  - Browser auto-fill conflicts
- Loading state improvements
- Error boundary implementation
- Expiration warning system
- Cross-browser testing and fixes
- Performance monitoring setup

**Database changes:** None

**New API endpoints:** None

**New UI components:**
- Loading skeletons for all async operations
- Error boundary components with recovery options
- Expiration warning banner
- Print stylesheet and print preview
- Session recovery UI

**What's testable at the end:**
- Application meets WCAG 2.1 AA standards
- Keyboard navigation works throughout
- Screen readers can navigate the application
- Print view shows complete application clearly
- Edge cases are handled gracefully
- Performance meets targets (< 2s load, < 500ms auto-save)
- Application handles 50+ entries without degradation
- Works correctly in all major browsers

**Estimated complexity:** Medium

**Key risks:**
- Accessibility remediation complexity
- Cross-browser compatibility issues
- Performance optimization trade-offs
- Print layout complexity for dynamic content

---

## Implementation Notes

### Mobile-First Development (Phases 5-7)
- Start with mobile viewport (320px) and enhance upward
- Test on real devices, not just browser emulation
- Consider mobile network conditions (3G/4G latency)
- Account for mobile-specific constraints (battery, memory)
- Use progressive enhancement for advanced features

### Testing Strategy
- Each phase must include comprehensive tests
- Mobile testing on real devices starting from Phase 5
- E2E tests for critical paths starting from Phase 4
- Load testing before Phase 8 completion
- Accessibility testing in Phase 8

### Rollback Plan
- Each phase must be independently revertible
- Database migrations must include rollback scripts
- Feature flags for gradual rollout starting from Phase 4

### Security Considerations
- Phase 3: Token generation must be cryptographically secure
- Phase 5: Candidate sessions must be completely isolated
- Phase 6: Auto-save must not expose data to other candidates
- Phase 6: Document uploads must be virus-scanned

### Performance Targets
- Application load: < 2 seconds (desktop), < 3 seconds (mobile 4G)
- Auto-save response: < 500ms
- Document upload: reasonable progress indication
- Submission processing: < 5 seconds
- Support for applications with 50+ entries

---

## Next Steps

1. Review and approve this phase plan
2. Create detailed technical specifications for Phase 1
3. Begin implementation of Phase 1 database changes
4. Set up device testing lab for Phases 5-7

Each phase will be implemented using the standard TDD pipeline, with test-writing preceding implementation for all new functionality.