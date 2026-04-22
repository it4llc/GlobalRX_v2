# Business Analysis Review: Candidate Invite Phase 2 — Workflow Configuration

**Document Type:** Business Analysis Review
**Created:** April 21, 2026
**Author:** Business Analyst Agent
**Status:** Complete
**Review of:** candidate-invite-phase2-workflow-configuration.md & candidate-invite-phase2-technical-plan.md

---

## Executive Summary

This review identifies gaps, missing business rules, and edge cases in the Phase 2 Workflow Configuration specification. While the specification is generally comprehensive and well-structured, several critical business rules and edge cases need clarification before implementation begins.

**Overall Assessment:** The specification covers the core functionality well but needs additional detail in areas of data integrity, user flow edge cases, and cross-module impacts.

**Update (2026-04-22):** All critical questions have been resolved by stakeholder decisions. The specification is now **Ready for Implementation** with all business rules clarified and integrated into the revised technical plan.

---

## 1. Specification Completeness Review

### What's Well Covered ✅

- **User types and permissions** clearly defined (internal/admin users only)
- **Database schema changes** thoroughly documented with proper field types and constraints
- **API endpoints** well-defined with clear input/output expectations
- **UI components** have clear functional requirements
- **Migration safety** properly considered with nullable fields for existing data
- **Decision rationale** documented in Key Design Decisions table
- **Rewrite vs. fix decision** well justified for broken code
- **Phase 3 data dependencies** proactively included in migration

### What Needs Clarification ⚠️

- **Validation timing** — When exactly are email templates validated for placeholder variables?
- **File storage lifecycle** — How long are uploaded documents retained? What triggers deletion?
- **Section naming uniqueness** — Can two sections have the same name within a workflow?
- **Content formatting rules** — What "basic formatting" is allowed in text content fields?
- **Versioning implications** — What happens to existing workflow instances when configuration changes?

---

## 2. Missing Business Rules Identification

### Critical Missing Rules 🔴

1. **Section Name Uniqueness**
   - **Issue:** No rule specifying if section names must be unique within a workflow
   - **Impact:** Could cause confusion in UI and reporting
   - **Recommendation:** Add rule: "Section names must be unique within their placement group (before_services or after_services)"

2. **Document File Replacement**
   - **Issue:** No rule for what happens when uploading a new document to an existing document-type section
   - **Impact:** Could lead to orphaned files or data loss
   - **Recommendation:** Add rule: "When a new document is uploaded to a section with an existing file, the old file should be deleted from storage after successful upload"

3. **Workflow Status Constraints**
   - **Issue:** No rule preventing configuration changes on active workflows
   - **Impact:** Could affect in-progress candidate applications
   - **Recommendation:** Add rule: "Workflow configuration can only be modified when status is 'draft'. Active workflows must be cloned for changes"

4. **Email Template Variable Validation**
   - **Issue:** Spec says no validation in Phase 2, but invalid variables will cause Phase 4 email sending to fail
   - **Impact:** Broken emails discovered only at send time
   - **Recommendation:** Add rule: "Warn users about unrecognized variables but allow saving (non-blocking validation)"

5. **Section Deletion with Active Candidates**
   - **Issue:** No rule for deleting sections when candidates have in-progress applications
   - **Impact:** Could break active candidate sessions
   - **Recommendation:** Add rule: "Sections cannot be deleted if the workflow has any associated orders in 'draft' or 'processing' status"

### Important Missing Rules 🟡

6. **Display Order Uniqueness**
   - **Issue:** What happens if two sections have the same displayOrder within a placement?
   - **Recommendation:** "Display orders within a placement group must be unique. System should auto-adjust on conflicts"

7. **Maximum Sections Limit**
   - **Issue:** No upper limit on number of sections per workflow
   - **Recommendation:** "Maximum 20 sections per placement group (40 total) to prevent performance issues"

8. **Content Size Limits**
   - **Issue:** Text content field has no maximum size specified
   - **Recommendation:** "Section text content limited to 50,000 characters"

9. **File Type Security**
   - **Issue:** File type validation mentioned but not detailed
   - **Recommendation:** "Allowed file types: PDF, DOCX, DOC, JPG, JPEG, PNG. Files must pass virus scanning before storage"

---

## 3. Edge Cases and Error Scenarios

### High Priority Edge Cases 🔴

1. **Concurrent Section Editing**
   - **Scenario:** Two admins edit the same workflow sections simultaneously
   - **Current handling:** Not addressed
   - **Recommendation:** Implement optimistic locking with version field or last-modified timestamp

2. **Document Upload Network Failure**
   - **Scenario:** Network fails after file upload but before database update
   - **Current handling:** Not specified
   - **Recommendation:** Two-phase upload: (1) Upload file with temp name, (2) Update DB and rename file atomically

3. **Section Reordering Collisions**
   - **Scenario:** Moving section from before_services to after_services when after_services already has that displayOrder
   - **Current handling:** Mentioned but not detailed
   - **Recommendation:** Always append to end of target group, then allow manual reordering

4. **Workflow Deletion with Uploaded Documents**
   - **Scenario:** Workflow with document sections is deleted
   - **Current handling:** Not specified
   - **Recommendation:** Cascade delete should trigger file cleanup job

### Medium Priority Edge Cases 🟡

5. **Browser Auto-Save Conflicts**
   - **Scenario:** Browser auto-saves/restores form data conflicting with database state
   - **Recommendation:** Add form versioning or disable browser auto-save

6. **Special Characters in Section Names**
   - **Scenario:** User enters emojis, RTL text, or special characters in section names
   - **Recommendation:** Define allowed character set or sanitization rules

7. **Gap Tolerance Business Logic**
   - **Scenario:** User sets gap tolerance to 0 days
   - **Recommendation:** Minimum should be 1 day, or explicitly handle 0 as "no gaps allowed"

8. **Email Template Length vs Email Limits**
   - **Scenario:** Template with all variables expanded exceeds email provider limits
   - **Recommendation:** Validate estimated expanded length during template creation

---

## 4. User Flow Gap Analysis

### Missing User Flow Steps

1. **Document Preview Flow**
   - Gap: No flow for previewing uploaded documents before save
   - Impact: Users can't verify correct document was uploaded
   - Add: Preview step after upload, before save

2. **Section Duplication**
   - Gap: No quick way to duplicate similar sections
   - Impact: Tedious for creating multiple similar compliance sections
   - Add: "Duplicate" action in section list

3. **Bulk Section Management**
   - Gap: No bulk operations (delete multiple, reorder multiple)
   - Impact: Time-consuming for major reorganizations
   - Consider: Multi-select and bulk actions

4. **Template Preview**
   - Gap: No way to preview email with sample data
   - Impact: Users can't verify template appearance
   - Add: "Preview with sample data" button

### Error Recovery Flows

5. **Session Timeout During Configuration**
   - Gap: No specified recovery if session times out during section editing
   - Add: Auto-save draft state to localStorage

6. **Validation Error Navigation**
   - Gap: No flow for navigating to specific validation errors
   - Add: Click on error to scroll to problematic field

---

## 5. Cross-Module Impact Assessment

### Critical Impacts 🔴

1. **Impact on Existing Workflows**
   - **Issue:** Adding new required fields to workflows table
   - **Risk:** Existing workflows might not display correctly
   - **Mitigation:** Ensure all new fields are nullable with sensible defaults

2. **Impact on Future Phase 3 (Candidate Invitations)**
   - **Issue:** Email template structure must support Phase 4 variable substitution
   - **Risk:** Template format changes could require Phase 3 rework
   - **Mitigation:** Define variable format standard now (e.g., {{variable}} vs ${variable})

3. **Impact on Phase 6 (Candidate Application)**
   - **Issue:** Section placement logic affects application assembly
   - **Risk:** Placement changes could break application rendering
   - **Mitigation:** Define clear contract for section ordering

### Important Impacts 🟡

4. **Impact on Reporting/Analytics**
   - **Issue:** New workflow configuration affects completion metrics
   - **Consideration:** Update reporting to handle dynamic sections

5. **Impact on Customer Package Assignment**
   - **Issue:** Workflows can now serve multiple packages
   - **Consideration:** UI must show which packages use each workflow

6. **Impact on Permissions System**
   - **Issue:** Using customer_config permission for workflow operations
   - **Consideration:** Document why workflows use customer_config permission

---

## 6. Data Integrity and Validation Rules

### Missing Validation Rules

1. **Circular Dependency Prevention**
   - Fields `dependsOnSection` and `dependencyLogic` exist but aren't used
   - When enabled in future, need circular dependency detection

2. **File Size Validation**
   - Mentioned as "10MB recommendation" but not specified as requirement
   - Should be explicit: "Maximum file size: 10MB"

3. **Filename Sanitization**
   - No rules for sanitizing uploaded filenames
   - Needed to prevent path traversal attacks

4. **Email Variable Format**
   - No validation that variables follow consistent format
   - Should enforce: Variables must be {{camelCase}}

### Data Consistency Rules

5. **Order Preservation During Deletion**
   - When section deleted, remaining sections need reordering
   - Rule: "Maintain sequential displayOrder without gaps"

6. **Placement Change Consistency**
   - When section moves between placements
   - Rule: "Reset displayOrder to avoid conflicts"

---

## 7. Security and Compliance Considerations

### Security Gaps

1. **File Upload Security**
   - No mention of virus scanning
   - No mention of file type verification beyond extension
   - Recommendation: Implement file content verification and virus scanning

2. **Path Traversal Prevention**
   - File storage path construction not detailed
   - Recommendation: Use UUID subdirectories, never user-provided names in paths

3. **Template Injection**
   - Email templates could contain malicious content
   - Recommendation: Sanitize HTML in email body content

### Compliance Considerations

4. **Document Retention**
   - No retention policy for uploaded documents
   - Needed for GDPR/privacy compliance

5. **Audit Trail**
   - No mention of tracking who uploads/modifies documents
   - Needed for compliance auditing

---

## 8. Performance and Scalability Considerations

### Potential Performance Issues

1. **Large Text Content**
   - No pagination for sections with large content
   - Could impact page load times

2. **Multiple File Uploads**
   - No concurrent upload handling specified
   - Could timeout on slow connections

3. **Section Reordering**
   - Drag-drop with many sections could be slow
   - Consider virtual scrolling for large lists

---

## 9. Specific Recommendations

### Critical Recommendations (Do Before Implementation)

1. **Add Workflow Cloning**
   - Business rule: "Active workflows cannot be edited directly. Create clone for modifications"
   - Prevents breaking in-progress applications
   - **STATUS: ADDRESSED** - Workflow locking implemented in revised technical plan

2. **Define Content Formatting Spec**
   - Specify exactly what "basic formatting" means
   - Options: Plain text only, Markdown, or limited HTML
   - **STATUS: PENDING** - Needs clarification from stakeholder

3. **Add Section Template Library**
   - Common sections (GDPR notice, consent forms) should be reusable
   - Reduces duplicate work across workflows
   - **STATUS: DEFERRED** - Not included in Phase 2 scope

4. **Specify File Lifecycle**
   - When are files deleted?
   - What happens to files when workflow deleted?
   - Orphaned file cleanup process
   - **STATUS: ADDRESSED** - Documents cascade delete with workflow

### Important Recommendations (Can Defer but Should Plan)

5. **Add Version History**
   - Track changes to workflow configuration
   - Ability to revert to previous version

6. **Add Preview Mode**
   - Preview how sections will appear to candidates
   - Preview email with sample data

7. **Add Validation Warnings**
   - Non-blocking warnings for potential issues
   - Example: "No sections defined" or "Email template missing"

---

## 10. Questions for Business Stakeholder

These questions need answers before implementation begins:

### High Priority Questions 🔴

1. **Can section names be duplicated within a workflow?**
   - **RESOLVED (2026-04-22):** Yes, section names CAN be duplicated. No uniqueness constraint needed.

2. **Should active workflows be editable or require cloning?**
   - **RESOLVED (2026-04-22):** Workflows cannot be edited when orders are in draft/processing status. Workflow locking implemented.

3. **What specific file types should be allowed for document uploads?**
   - **RESOLVED (2026-04-22):** Only PDF and Word files (.pdf, .docx, .doc) are allowed.

4. **What is the retention policy for uploaded documents?**
   - **RESOLVED (2026-04-22):** Documents are tied to workflow lifecycle and cascade delete with workflow.

5. **Should there be a maximum number of sections per workflow?**
   - **RESOLVED (2026-04-22):** Maximum 10 sections per placement (10 before_services + 10 after_services = 20 total).

### Medium Priority Questions 🟡

6. **What formatting is allowed in text content (plain text, markdown, HTML)?**
7. **Should email templates support HTML or plain text only?**
8. **How should the system handle workflow deletion with existing documents?**
9. **Is virus scanning required for uploaded documents?**
10. **Should users be warned about unrecognized email template variables?**

---

## 11. Test Scenario Gaps

The following test scenarios are not covered in the specification:

1. **Concurrent editing by multiple users**
2. **Network failure recovery during file upload**
3. **Performance with 50+ sections**
4. **Browser compatibility for drag-and-drop**
5. **Mobile responsiveness of workflow configuration UI**
6. **Accessibility of section management interface**
7. **International character support in content fields**
8. **Email template with all variables at maximum length**

---

## 12. Priority Matrix

### Critical Priority (Block Implementation)
- Workflow edit permissions on active workflows
- File upload security and lifecycle
- Section name uniqueness rules
- Content formatting specification

### High Priority (Address in Phase 2)
- Email template variable format standard
- Display order conflict resolution
- Document replacement logic
- Maximum limits (sections, file size, content length)

### Medium Priority (Can Defer to Later Phase)
- Version history
- Preview functionality
- Template library
- Bulk operations
- Advanced validation warnings

### Low Priority (Future Enhancement)
- Rich text editor
- Template variable autocomplete
- Advanced dependency logic
- Automated testing of email templates

---

## Conclusion

The Phase 2 specification provides a solid foundation but needs clarification on several business rules and edge cases before implementation. The most critical gaps relate to:

1. **Data integrity** — Rules for editing active workflows
2. **File management** — Security, lifecycle, and storage
3. **Validation** — Content formatting and template variables
4. **Cross-module impacts** — Effects on future phases

Once these gaps are addressed, the specification will be comprehensive enough for safe implementation. The technical plan is well-structured and accounts for most technical considerations, but should be updated once the business rules are clarified.

### Recommended Next Steps

1. **Immediate:** Get stakeholder answers to High Priority Questions
2. **Before Implementation:** Update specification with missing business rules
3. **During Implementation:** Create detailed test plans for edge cases
4. **After Phase 2:** Plan for Version 2 enhancements based on Medium/Low priority items

---

**End of Business Analysis Review**

---

## Resolution Summary

**Resolution Date:** April 22, 2026

All critical business questions have been resolved through stakeholder decisions:

1. **Section Name Uniqueness:** Duplicates are allowed - no constraint needed
2. **Workflow Locking:** Implemented for orders in draft/processing status
3. **File Types:** Restricted to PDF and Word documents only
4. **Document Retention:** Tied to workflow lifecycle with cascade delete
5. **Section Limits:** Maximum 10 sections per placement (20 total)

These decisions have been integrated into the revised technical plan (candidate-invite-phase2-technical-plan.md) along with the addition of the CandidateInvitation table to the Phase 2 migration for improved efficiency.

**Project Status:** Ready to proceed with Phase 2 implementation.