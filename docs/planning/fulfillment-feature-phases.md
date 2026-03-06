# Fulfillment Comments and Search Results - Implementation Plan

**Created:** March 2, 2026
**Feature Owner:** Andy Hellman
**Total Phases:** 6
**Status:** Phase 1 Complete ✅

## Implementation Progress
- ✅ **Phase 1 Complete** (March 2, 2026): Comment Templates Foundation implemented and deployed
- ✅ **Phase 2a Complete** (March 4, 2026): Order Fulfillment Details Page with full translation support

## Executive Summary

This document outlines the phased implementation plan for adding fulfillment capabilities to GlobalRx orders. The feature will evolve from basic comment templates to a sophisticated system with search results tracking, visibility controls, and automated customer notifications.

## Key Requirements

### Comments System
- **Immutable after save** - Comments cannot be edited once saved (audit trail)
- **Template-based** - Predefined templates with customizable placeholders
- **Visibility controls** - Internal-only vs customer-visible flags
- **Character limit** - 1000 characters initially
- **Free-form option** - One template allows completely custom text

### Search Results
- **Records searches** - Free-text results block
- **Verification searches** - Structured fields from Data Rx configuration
- **Source values** - Capture what the source reported vs what was expected

### Notifications
- **Customer-configurable** - Email settings at customer level
- **Information requests** - Triggered when documents/info needed
- **Flexible recipients** - Can email customer, candidate, or both

### Status Management
- **Bidirectional flow** - Orders can move forward OR backward in status
- **Any transition** - Comments can trigger any available status change

---

## Phase 1: Comment Templates Foundation

### Objective
Create the template management system that all future comment functionality will use.

### Scope
- Database table for comment templates
  - Template text with placeholders (e.g., `[missing info here]`)
  - Category field for organization
  - Active/inactive flag
  - 1000 character limit
- CRUD API endpoints for template management
- Admin UI for managing templates
- Special "Free form comment" template

### Command to Run
```bash
/build-feature Create comment template management system for fulfillment - database table with template text (1000 chars) including placeholders like [], category field, and active flag. Admin UI to add/edit/disable templates. Include "Free form comment" as special template.
```

### Success Criteria
- [ ] Admin can create new templates with placeholders
- [ ] Templates can be categorized
- [ ] Templates can be deactivated without deletion
- [ ] "Free form comment" exists as default template

### Open Questions for Phase 1
- What categories should templates have initially?
- Should there be a limit on number of active templates?
- Who has permission to manage templates (admin only)?
- What placeholder syntax to use? `[]` or `{{}}` or other?

---

## Phase 2: Order Comments System (Expanded - March 4, 2026)

### Critical Gap Identified
The current implementation only has a small modal for viewing orders (317 lines, read-only). A proper fulfillment view is required before implementing comments. Phase 2 has been broken into 4 sub-phases to address this.

### Design Decisions (Confirmed by Andy)
- **Status changes:** No restrictions initially (will learn workflow first)
- **Page layout:** Single column with sidebar for actions
- **Navigation:** Orders open in new tab from list
- **Visibility default:** Comments default to "internal only" for safety
- **Required comments:** Not required for status changes initially

---

### Phase 2a: Order Fulfillment Details Page

#### Objective
Create a dedicated page where fulfillers can properly work with orders (replaces the modal).

#### Scope
- New route: `/fulfillment/orders/[id]` page
- Full order details display (all fields from modal plus more)
- Order items with service details
- Subject information in organized sections
- Status display with change dropdown
- Navigation from fulfillment list (table rows link to page, open in new tab)
- Breadcrumb navigation back to fulfillment list
- Single column layout with sidebar for actions

#### Command to Run
```bash
/build-feature Create order fulfillment details page at /fulfillment/orders/[id] showing full order info, items, subject details, status with change dropdown. Single column layout with sidebar. Replace modal with new tab navigation from fulfillment list.
```

#### Success Criteria
- [x] Dedicated page exists at `/fulfillment/orders/[id]`
- [x] All order details visible (more than modal showed)
- [x] Status can be changed via dropdown
- [x] Links from list open in new tab
- [x] Sidebar contains action buttons

**✅ COMPLETED March 4, 2026**

#### Final Implementation Notes
- **Translation system**: Complete internationalization using TranslationContext with `t()` function
- **File path standardization**: All files properly prefixed with `/GlobalRX_v2/` for project clarity
- **Logging architecture**: Client-side errors use client-logger, server operations use Winston
- **Translation keys**: 60+ new translation keys added covering all fulfillment UI text
- **Multi-language support**: Full support for English (US/GB), Spanish (ES/Mexico), and Japanese
- **Code documentation**: All components include comprehensive inline comments explaining business logic
- **Responsive design**: Single column layout with sidebar that stacks on mobile devices

---

### Phase 2b: Order Comments Database and API

#### Objective
Backend infrastructure for storing and retrieving order comments.

#### Scope
- Database table for OrderComment:
  - orderId (link to order)
  - templateId (reference to template used)
  - finalText (customized text, 1000 chars)
  - isInternalOnly (boolean, defaults to true)
  - createdBy (user ID)
  - createdAt (timestamp)
- API endpoint POST /api/orders/[id]/comments
- API endpoint GET /api/orders/[id]/comments with visibility filtering
- Immutable design (no edit/delete after save)
- Proper permission checks (fulfillment role required)

#### Command to Run
```bash
/build-feature Add order comments database table and API - OrderComment with orderId, templateId, finalText (1000 chars), isInternalOnly flag defaulting to true, createdBy, createdAt. Immutable after save. POST and GET endpoints with visibility filtering.
```

#### Success Criteria
- [ ] OrderComment table created with proper fields
- [ ] Comments can be saved via API
- [ ] Comments retrieved with visibility filtering
- [ ] No edit/delete operations allowed
- [ ] Audit fields populated automatically

#### Dependencies
- Phase 2a must be complete (need the page to display comments on)

---

### Phase 2c: Order Comments UI Components

#### Objective
User interface for selecting templates, customizing text, and viewing comment history.

#### Scope
- Comment form in sidebar of fulfillment details page:
  - Template selector dropdown (filtered by service/status)
  - Text area showing template text with placeholders
  - Placeholder customization (highlight [] sections)
  - Internal/Customer visibility toggle (defaulted to internal)
  - Save button
- Comment history section on main page:
  - Chronological list of comments
  - Show author, timestamp, visibility status
  - Visual distinction for internal vs customer-visible
  - No edit/delete buttons (immutable)

#### Command to Run
```bash
/build-feature Add order comments UI to fulfillment details page - template selector in sidebar, placeholder text editor, internal/customer toggle defaulting to internal, comment history in main area with authors and timestamps.
```

#### Success Criteria
- [ ] Template selector shows available templates
- [ ] Placeholders can be filled before saving
- [ ] Visibility toggle defaults to internal
- [ ] Comment history displays all comments
- [ ] Internal comments visually distinct

#### Dependencies
- Phase 2b must be complete (needs the API to save/load comments)

---

### Phase 2d: Status Change with Comments

#### Objective
Link comment creation to order status changes.

#### Scope
- Add status change dropdown to comment form
- Update comment API to optionally change order status
- No restrictions on status transitions initially
- Audit trail of status changes with comments
- Status change is optional (can add comment without changing status)

#### Command to Run
```bash
/build-feature Add status change capability to order comments - optional dropdown in comment form to change status, no transition restrictions, update order status when comment saved, audit trail.
```

#### Success Criteria
- [ ] Status dropdown appears in comment form
- [ ] All statuses available (no restrictions)
- [ ] Status changes when comment saved
- [ ] Status change is optional
- [ ] Audit trail shows status changes with comments

#### Dependencies
- Phase 2c must be complete (builds on comment UI)

---

### What Is OUT of Scope for Phase 2
- Email notifications (Phase 5-6)
- Search results tracking (Phase 3-4)
- Bulk operations or batch commenting
- Comment templates management (Phase 1 - complete)
- Customer portal view of comments (future)
- Status transition restrictions (will add after learning workflow)

---

## Phase 3: Records Search Results Tracking

### Objective
Allow fulfillers to record text-based results from records searches.

### Scope
- Database table for search results
  - Order item ID reference
  - Search type identifier
  - Results as text block
  - Created/updated timestamps
- API endpoints for saving/updating results
- UI text area in fulfillment view
- Display saved results

### Command to Run
```bash
/build-feature Add records search results tracking - database table linking to order items with searchType and resultText fields. API to save search results. UI text area in fulfillment view for entering records found during search.
```

### Success Criteria
- [ ] Results can be entered as free text
- [ ] Results are associated with specific order items
- [ ] Results persist and display on return visits
- [ ] Clear indication when results are present

### Dependencies
- Phase 2 should be complete (shares UI context)

---

## Phase 4: Verification Search Results System

### Objective
Structured capture of verification results based on Data Rx configuration.

### Scope
- Extend results table for structured JSON storage
- Fetch verifiable fields from Data Rx config
- Dynamic UI based on service configuration
- Store field-by-field verification results
- Show expected vs source-reported values

### Command to Run
```bash
/build-feature Add verification search results with Data Rx integration - fetch verifiable fields from service config, display as form fields for source-reported values, save as structured JSON. Show configured fields dynamically based on service.
```

### Success Criteria
- [ ] Verifiable fields load from Data Rx config
- [ ] Each field can capture source-reported value
- [ ] Results saved as structured data
- [ ] UI adapts to different services

### Dependencies
- Phase 3 must be complete (builds on results infrastructure)
- Data Rx configuration must be accessible

---

## Phase 5: Customer Notification Configuration

### Objective
Configure email notification preferences at the customer level.

### Scope
- Extend Customer table with notification settings
  - Email addresses (array)
  - Enabled/disabled flag
  - Recipient types (customer/candidate/both)
- API for managing notification preferences
- Admin UI in customer configuration

### Command to Run
```bash
/build-feature Add customer email notification configuration - extend Customer table with notificationEmails (JSON array), recipientTypes, and notificationEnabled flag. Admin UI to configure which customers get notified for information requests.
```

### Success Criteria
- [ ] Email addresses can be configured per customer
- [ ] Can specify customer, candidate, or both
- [ ] Notifications can be enabled/disabled
- [ ] Settings persist and are editable

### Dependencies
- Can run in parallel with other phases

---

## Phase 6: Information Request Email Triggers

### Objective
Actually send notification emails when information is requested.

### Scope
- Detect status changes requiring information
- Email service integration
- Use customer configuration from Phase 5
- Track sent notifications
- Prevent duplicate sends

### Command to Run
```bash
/build-feature Implement information request email notifications - detect status changes requiring customer action, send emails using customer config, track sent notifications. Only trigger for configured statuses indicating information needed.
```

### Success Criteria
- [ ] Emails sent when info requested
- [ ] Correct recipients based on config
- [ ] No duplicate notifications
- [ ] Email includes relevant details
- [ ] Sent notifications are logged

### Dependencies
- Phase 5 must be complete (needs configuration)
- Email service must be configured

---

## Technical Considerations

### Database Design Notes
- Comments table must support future enhancements without migration
- Consider indexes on order_id and visibility flags
- Results table should handle both text and JSON gracefully

### Security Considerations
- Validate user has fulfillment permission
- Enforce visibility rules at API level
- Sanitize template placeholders before save
- Audit trail for all modifications

### Performance Considerations
- Pagination for comment history
- Lazy load verification fields
- Cache template list (changes infrequently)

---

## Risk Mitigation

### Identified Risks
1. **Data model changes** - Design Phase 1 to support all future phases
2. **Data Rx integration** - Verify access to config before Phase 4
3. **Email service** - Confirm email infrastructure before Phase 6
4. **Permission complexity** - Clear rules for internal vs customer visibility

### Mitigation Strategies
- Review data model with architect before Phase 1
- Test Data Rx access early
- Verify email service credentials/setup
- Document permission rules clearly

---

## Rollout Strategy

### Phase Groupings
- **Core Functionality** (Phases 1-2): Basic commenting system
- **Results Tracking** (Phases 3-4): Search results capture
- **Notifications** (Phases 5-6): Customer communications

### Testing Approach
- Each phase gets full test coverage
- Integration tests after each phase group
- User acceptance testing before notifications go live

---

## Success Metrics

### Phase 1-2 Success
- Fulfillers can add contextual comments
- Comments improve order communication
- Audit trail established

### Phase 3-4 Success
- Search results captured consistently
- Verification accuracy improved
- Results accessible for review

### Phase 5-6 Success
- Response time to info requests decreased
- Customer satisfaction improved
- Fewer manual follow-ups needed

---

## Next Steps

1. **Review this plan** - Ensure all requirements are captured correctly
2. **Start Phase 1** - Run the build-feature command for templates
3. **Track progress** - Update this document as phases complete
4. **Gather feedback** - After each phase, note learnings for next phase

---

## Appendix: Example Comment Templates

### Information Request Category
- "Please provide the following information to complete your search: []"
- "The document provided is illegible. Please submit a clear copy of: []"
- "Additional verification needed for: []"

### Status Update Category
- "Search initiated with provider: []"
- "Waiting for response from: []"
- "Search completed, results being reviewed"

### Issue Report Category
- "Unable to verify due to: []"
- "Discrepancy found in: []"
- "Provider reporting error: []"

### Free Form
- "Free form comment" (allows any text up to 1000 chars)

---

## Phase 7: Service-Centric Fulfillment Restructuring

### Critical Issue Identified (March 4, 2026)
The current fulfillment system has a fundamental structural issue: it treats orders as the primary unit of fulfillment, but in reality, each service within an order is fulfilled independently. This phase completely restructures the fulfillment approach to be service-centric.

### Business Requirements
- **Services are primary**: Each service (OrderItem) is fulfilled independently by potentially different vendors
- **Vendor assignment at service level**: Different services in the same order can be assigned to different vendors
- **Manual order closure**: Orders require manual closure after all services reach terminal status
- **Order-level review**: Additional work may be performed at the order level (e.g., adverse information review)
- **Clean vendor view**: Vendors see a list of their assigned services, not orders (avoiding data suppression issues)
- **Tabbed UI for internal users**: Services displayed as tabs within the order for easy navigation

### Implementation Sub-Phases

#### Phase 7.1: Service-Level Infrastructure
**Objective**: Build database and API foundation for service-level fulfillment

**Scope**:
- Add fields to OrderItem table: `assignedVendorId`, `statusCode`, `completedAt`
- Create `ServiceStatusHistory` table for service-level audit trail
- Build service-level API endpoints for status and vendor assignment
- Migrate existing order-level vendor assignments to services
- Implement service-level permission checks

**Command to Run**:
```bash
/build-feature Add vendor assignment and status tracking at the service level (OrderItem) with new API endpoints for managing service-level fulfillment including /api/fulfillment/services/[id]/status and /api/fulfillment/services/[id]/assign
```

#### Phase 7.2: Service-Centric Vendor Portal
**Objective**: Create vendor interface showing only assigned services

**Scope**:
- New vendor dashboard showing list of assigned services
- Service detail view with status update capability
- Service-level document upload functionality
- Service-specific notes and comments
- Data isolation ensuring vendors only see their services

**Command to Run**:
```bash
/build-feature Create vendor portal that shows list of assigned services (not orders) with ability to view service details and update status
```

#### Phase 7.3: Tabbed Service UI for Internal Users
**Objective**: Enable internal users to manage services efficiently within orders

**Scope**:
- Add tab navigation to order details page (one tab per service)
- Per-tab vendor assignment controls
- Per-tab status management
- Bulk operations (e.g., assign all services to one vendor)
- Visual progress indicators showing service completion

**Command to Run**:
```bash
/build-feature Add tabbed interface to order details page showing one tab per service with vendor assignment and status management
```

#### Phase 7.4: Order Closure Workflow
**Objective**: Implement manual order closure with review requirements

**Scope**:
- Auto-detect when all services reach terminal status
- Add "ready for closure" order status
- Manual closure workflow with review requirements
- Order-level adverse information flagging
- Closure audit trail with user and timestamp

**Command to Run**:
```bash
/build-feature Implement order closure logic that tracks when all services are complete and requires manual closure with review
```

#### Phase 7.5: Service Reassignment & Escalation
**Objective**: Add advanced service management capabilities

**Scope**:
- Service reassignment workflow between vendors
- Escalation paths for stuck or delayed services
- Vendor performance tracking at service level
- Complete reassignment history and audit trail

**Command to Run**:
```bash
/build-feature Add service reassignment capability with escalation workflows and vendor performance tracking
```

#### Phase 7.6: Migration & Cleanup
**Objective**: Complete transition to service-centric model

**Scope**:
- Full data migration from order-level to service-level assignments
- Remove deprecated order-level vendor assignment code
- Archive old API endpoints
- Update all documentation to reflect new model

**Command to Run**:
```bash
/build-feature Migrate existing vendor assignments from order to service level and remove deprecated order-level assignment code
```

### Key Architecture Changes
1. **Data Model**: OrderItem becomes primary fulfillment entity
2. **API Structure**: New `/api/fulfillment/services/` endpoints
3. **Permission Model**: Service-level access control for vendors
4. **UI Paradigm**: Service-centric views for both internal and vendor users
5. **Status Management**: Dual tracking (service status + order status)

### Migration Strategy
- Phase 7.1 adds new fields without breaking existing functionality
- Phases 7.2-7.3 introduce new UIs alongside existing ones
- Phase 7.4 adds order closure without changing service workflow
- Phase 7.5 enhances capabilities incrementally
- Phase 7.6 removes old code only after full validation

### Success Criteria
- [ ] Services can be assigned to different vendors within same order
- [ ] Vendors only see their assigned services (no data suppression)
- [ ] Order closure is separate from service completion
- [ ] Full audit trail at both service and order levels
- [ ] Performance maintained with high service counts

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-03-02 | Andy Hellman / Claude | Initial plan created |
| 2026-03-04 | Andy Hellman / Claude | Expanded Phase 2 into 4 sub-phases (2a-2d), added fulfillment details page requirement |
| 2026-03-04 | Andy Hellman / Claude | Added Phase 7: Service-Centric Fulfillment Restructuring with 6 sub-phases |
| | | |