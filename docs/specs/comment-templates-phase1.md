# Feature Specification: Comment Template Management System

**Date:** March 2, 2026
**Requested by:** Andy
**Status:** Approved
**Phase:** 1 of 6 (Fulfillment System)

## Summary

The Comment Template Management System enables administrators to create and manage reusable comment templates for order fulfillment. These templates include placeholder text (marked with single brackets like `[placeholder]`) that fulfillers can customize when adding comments to orders. This is Phase 1 of the fulfillment system, providing the foundation for all future comment functionality.

## Who Uses This

- **System Administrators** - Create, edit, and manage comment templates through the admin interface
- **Users with comment_management permission** - Manage templates for their organization
- **Fulfillers (future)** - Will select and use these templates when adding comments to orders (Phase 2)

## Business Rules

1. **Template names must be unique** - No two active templates can have the same short_name
2. **Both name fields are required** - Every template must have both a short_name (for dropdowns) and long_name (for display)
3. **Template text serves as the description** - No separate description field; the template text itself shows what the template does
4. **Placeholders use single brackets** - Text like `[missing document type]` serves as a visual indicator for fulfillers to replace with actual values
5. **No placeholder validation** - System does not parse or validate placeholder syntax; they are purely visual markers
6. **No categories in Phase 1** - Category field removed from initial implementation
7. **Soft delete for used templates** - Templates that have been used (hasBeenUsed = true) can only be marked inactive, never permanently deleted
8. **Hard delete for unused templates** - Templates that have never been used can be permanently removed from the database
9. **Character limits**:
   - short_name: 50 characters
   - long_name: 100 characters
   - template_text: 1000 characters
10. **Audit trail required** - Track created_by, created_at, updated_by, updated_at for all templates
11. **Permission-based access** - Only users with the `comment_management` permission module can manage templates
12. **Active templates only in dropdowns** - When templates are eventually used (Phase 2), only active templates appear in selection lists
13. **Template edits allowed** - Templates can be edited even after use, but changes only affect future usage
14. **Grid-based availability** - Templates are assigned to service/status combinations using a visual grid interface (like DSX tab)
15. **Usage tracking** - Boolean flag `hasBeenUsed` set to true the first time a template is used (more efficient than counter)

## User Flow

### Creating a Template

1. **Navigate to template management** - From Global Configurations, user selects "Comment Templates" tab
2. **Click Add New Template** - User clicks the "Add New Template" button
3. **Fill template form** - Modal opens with user entering:
   - Short name (e.g., "Missing Doc")
   - Long name (e.g., "Document Required - Customer Must Provide")
   - Template text with placeholders (e.g., "Please provide the following document to continue processing: [document type]. The document submitted was [reason for rejection].")
4. **Save template** - User clicks Create button, system validates uniqueness of short_name
5. **Configure availability** - After saving, template is automatically selected and availability grid appears on main page:
   - "All" row at top to select/deselect all services for a status
   - Category rows to toggle all services in that category
   - Individual service rows for granular control
   - Status columns in workflow order: DRAFT, SUBMITTED, PROCESSING, COMPLETED
   - Click "Save Configuration" to save availability settings
6. **Success feedback** - System saves configuration, grid remains visible for further adjustments

### Editing a Template

1. **Select template from dropdown** - User chooses template to edit from dropdown list
2. **Grid appears on main page** - Availability grid immediately appears below showing current configuration
3. **Click Edit Selected** - Opens modal with current values for short_name, long_name, template_text
4. **Make changes** - User modifies fields as needed in modal
5. **Save changes** - Click "Save Changes" in modal, returns to main page with grid
6. **Update availability** - User adjusts grid selections directly on main page
7. **Save configuration** - Click "Save Configuration" button to save grid changes

### Grid Interface Layout

```
                    Draft  Submitted  Processing  Completed
All                   □        ✓          □           □
Criminal              □        ✓          ✓           □
  └─ Background       □        ✓          □           □
  └─ Court Search     □        ✓          ✓           □
Education             ✓        ✓          ✓           ✓
  └─ High School      ✓        ✓          ✓           □
  └─ College          ✓        ✓          ✓           ✓
```

- "All" row (highlighted in blue) toggles all services for that status column
- Clicking category checkbox (e.g., "Criminal") toggles all child services in that category
- Individual service cells can be toggled independently
- Visual hierarchy shows parent/child relationships with └─ prefix
- Status columns hardcoded in workflow order (DRAFT, SUBMITTED, PROCESSING, COMPLETED)
- Service column is sticky for horizontal scrolling
- Grid appears on main page when template is selected (not in modal)

## Data Requirements

### CommentTemplate Table

- **id** - UUID, primary key, auto-generated
- **shortName** - String, required, max 50 characters, must be unique among active templates, used in dropdowns
- **longName** - String, required, max 100 characters, descriptive name for display
- **templateText** - Text, required, max 1000 characters, the actual template content with [placeholders]
- **isActive** - Boolean, required, default true, determines if template appears in selection lists
- **hasBeenUsed** - Boolean, required, default false, set to true first time template is used
- **createdBy** - UUID, nullable, references User table, who created the template
- **createdAt** - Timestamp, required, auto-generated, when template was created
- **updatedBy** - UUID, nullable, references User table, who last modified the template
- **updatedAt** - Timestamp, required, auto-updated, when template was last modified

### CommentTemplateAvailability Table

- **id** - UUID, primary key, auto-generated
- **templateId** - UUID, required, references CommentTemplate table
- **serviceCode** - String, required, service this template is available for
- **status** - String, required, order status this template is available for
- **createdAt** - Timestamp, required, auto-generated

Unique constraint on (templateId, serviceCode, status) combination

## Edge Cases and Error Scenarios

1. **Duplicate short_name** - Error: "A template with this short name already exists"
2. **Template text too long** - Error: "Template text cannot exceed 1000 characters"
3. **Missing required fields** - Highlight field and show: "[Field name] is required"
4. **Deleting used template** - Error: "This template has been used and cannot be deleted. You can deactivate it instead."
5. **No permission** - Return 403 Forbidden with message: "You do not have permission to access comment templates"
6. **Database connection failure** - Show: "Unable to save template. Please try again."
7. **Concurrent edits** - Last save wins (no locking in Phase 1)
8. **Special characters in placeholders** - All text allowed
9. **Empty placeholder brackets** - Allowed; `[]` is valid
10. **Nested brackets** - Allowed; `[[nested]]` treated as literal text
11. **No services configured** - Show message: "No services available. Please configure services first."
12. **No statuses configured** - Show message: "No order statuses found. Please contact support."

## API Endpoints

- `GET /api/comment-templates` - List all templates with their availability
- `GET /api/comment-templates/[id]` - Get single template with availability grid
- `POST /api/comment-templates` - Create new template
- `PUT /api/comment-templates/[id]` - Update existing template
- `DELETE /api/comment-templates/[id]` - Delete unused template or deactivate used template
- `GET /api/comment-templates/[id]/availability` - Get availability grid for template
- `PUT /api/comment-templates/[id]/availability` - Update availability grid

All endpoints require `comment_management` permission.

## Definition of Done

1. ✅ Database migration created for CommentTemplate and CommentTemplateAvailability tables
2. ✅ API endpoints implemented with permission checks
3. ✅ Admin UI at `/global-configurations/comment-templates` with:
   - ✅ Dropdown to select existing templates for editing
   - ✅ "Add New Template" button
   - ✅ "Edit Selected" button when template is selected
   - ✅ Template form with shortName, longName, templateText fields
   - ✅ Grid interface for availability configuration on main page
   - ✅ "All" row for bulk selection per status
   - ✅ Category rows with child service grouping
   - ✅ Status columns in workflow order (DRAFT, SUBMITTED, PROCESSING, COMPLETED)
   - ✅ "Save Configuration" button for grid changes
4. ✅ Client-side validation matches server-side rules
5. ✅ Success and error messages display appropriately
6. ⚠️ Unit tests cover all business rules and edge cases (partial - needs updating)
7. ⚠️ Integration tests verify API endpoints with various permission scenarios (not implemented)
8. ✅ UI components are accessible (ARIA labels, keyboard navigation)
9. ✅ Loading states shown during API calls
10. ✅ Proper error handling for network failures
11. ✅ Grid selection logic similar to DSX tab patterns
12. ✅ Audit fields properly populated on create/update

## Technical Implementation Notes

### Files to Reference/Reuse

- `/src/components/modules/global-config/tabs/dsx-tab.tsx` - Grid selection logic
- `/src/components/modules/global-config/tables/RequirementsDataTable.tsx` - Parent/child checkbox behavior
- `/src/lib/permission-utils.ts` - Permission checking utilities

### Key Decisions Made

1. **Standalone permission** - `comment_management` is its own permission module
2. **No categories** - Category field removed completely from Phase 1
3. **No naming conventions** - No enforced patterns for short_name
4. **No versioning** - Template edits don't create versions
5. **Grid over rules** - Visual grid interface instead of JSON rule configuration
6. **Services as rows** - Matches DSX tab layout for code reuse
7. **Boolean flag over counter** - Use `hasBeenUsed` boolean instead of `usageCount` for efficiency

## Future Phases

This is Phase 1 of 6 in the fulfillment system:
- **Phase 2:** Order Comments System - Use templates in actual orders
- **Phase 3:** Records Search Results Tracking
- **Phase 4:** Verification Search Results with Data Rx integration
- **Phase 5:** Customer Notification Configuration
- **Phase 6:** Information Request Email Triggers

See `/docs/planning/fulfillment-feature-phases.md` for complete roadmap.

---

## Approval History

- **March 2, 2026** - Initial specification created by business-analyst agent
- **March 2, 2026** - Approved by Andy with modifications:
  - Changed to standalone permission
  - Removed categories
  - Changed to grid interface
  - Services as rows, statuses as columns
  - 1000 character limit
  - `[placeholder]` syntax
  - Permission named `comment_management`
  - Use boolean `hasBeenUsed` flag instead of usage counter