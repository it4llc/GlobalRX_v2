# GlobalRx MVP Implementation Plan
**Created:** March 10, 2026
**Purpose:** Define and execute remaining work to achieve MVP

## Context
This plan was created to:
1. Review implementation progress and determine what's left for MVP
2. Add two main features: results blocks for services and order status changes for internal users
3. Update documentation to clearly define MVP boundaries and prevent scope creep

## Key Decisions Made
- **Order status changes** are different from service status changes (service status already implemented in Phase 2d)
- **Results blocks** will be free text with ability to attach files (mainly PDFs)
- **No existing MVP definition** exists - creating one is the priority to avoid scope creep
- **Timeline:** No specific deadline mentioned, focus on clarity and completeness

## Phased Implementation Plan

### Phase 1: MVP Documentation Audit & Definition 📊
**Priority:** MUST DO FIRST
**Size:** Small
**Purpose:** Create single source of truth for MVP requirements to prevent scope creep

**Scope:**
- Review all existing documentation files
- Extract all MVP-related requirements and features
- Create consolidated MVP status report showing:
  - ✅ Completed features
  - 🔄 Remaining work for MVP
  - ⏳ Deferred post-MVP items
- Identify gaps between documented plans and actual needs

**Command to run:**
```bash
/build-feature Create comprehensive MVP status audit by reviewing all documentation, consolidating requirements into single MVP document showing completed features, remaining work, and deferred items
```

### Phase 2: Service Results Block with Attachments 📝
**Size:** Medium
**Depends on:** Phase 1 completion to confirm this is required for MVP

**Scope:**
- Add results field to ServicesFulfillment table (free text)
- Add file attachment capability for PDFs at service level
- Create API endpoints for:
  - Saving/updating results text
  - Uploading/downloading PDF attachments
  - Retrieving results with attachments
- Add UI components in service fulfillment view:
  - Textarea for entering search results
  - File upload for PDFs
  - Display of attached files

**Command to run:**
```bash
/build-feature Add results block to services - free text field for results, PDF attachment capability, API endpoints to save/retrieve results and files, UI textarea and file upload in service fulfillment view
```

### Phase 3: Order-Level Status Management for Internal Users 🔄
**Size:** Small (may be partially complete)
**Depends on:** Phase 1 to confirm exact requirements

**Scope:**
- Add order status change API endpoint (separate from service status)
- Add status dropdown to order details page (internal users only)
- Implement audit trail for order status changes
- No complex transition rules initially (can add post-MVP if needed)

**Command to run:**
```bash
/build-feature Add order status change capability for internal users - status dropdown on order details page with audit trail, separate from service status, no transition restrictions initially
```

### Phase 4: Documentation Update and MVP Roadmap 📚
**Size:** Small
**Depends on:** Phases 2-3 complete

**Scope:**
- Update IMPLEMENTATION_PROGRESS.md with completed items
- Create MVP_ROADMAP.md with any remaining tasks
- Update feature documentation to mark completed/deferred items
- Archive outdated planning documents
- Create clear "MVP Complete" milestone documentation

**Command to run:**
```bash
/build-feature Update all project documentation to reflect MVP status - mark completed features in IMPLEMENTATION_PROGRESS, create MVP_ROADMAP with remaining tasks, archive outdated docs
```

## Items Explicitly Deferred Post-MVP

Based on documentation review, these are NOT required for MVP:
- Email notifications (Phase 5-6 in fulfillment plan)
- Vendor portal improvements (current functionality sufficient)
- Order closure workflow (orders can remain open after services complete)
- Service reassignment and escalation features
- Automated backup system (important but not blocking)
- Additional monitoring/APM setup (current monitoring sufficient)

## Progress Tracking

### Phase Status
- [ ] Phase 1: MVP Documentation Audit - **NOT STARTED**
- [ ] Phase 2: Service Results Block - **PENDING** (awaiting Phase 1)
- [ ] Phase 3: Order Status Management - **PENDING** (awaiting Phase 1)
- [ ] Phase 4: Documentation Update - **PENDING** (awaiting Phases 2-3)

### Notes
- Each phase should be run as a separate `/build-feature` command
- Wait for each phase to complete and be verified before starting the next
- Update this document after each phase completes

## Questions Resolved
1. **Q:** Is order status change different from service status?
   **A:** Yes, they are separate. Service status is already implemented.

2. **Q:** What type of results are needed?
   **A:** Free text with ability to attach files (mainly PDFs).

3. **Q:** Is there an existing MVP requirements list?
   **A:** No, creating one is the priority (Phase 1).

4. **Q:** Timeline constraints?
   **A:** None specified, focus on clarity and completeness.

## Next Steps
1. Run Phase 1 command to create MVP definition
2. Review and approve the MVP definition
3. Proceed with Phase 2-4 in sequence
4. Update this document after each phase

---
*This document should be updated after each phase completes to track progress*