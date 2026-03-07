# Feature Specification: Service Comments Frontend UI (Phase 2c)

**Date:** March 6, 2026
**Requested by:** Andy
**Status:** In Development
**Phase:** 2c of 6 (Fulfillment System)

## Summary

The Service Comments Frontend UI enables users to view and manage comments on individual services within orders through a React-based interface. Building on the Phase 2b backend APIs, this phase creates the user interface for comment display, creation with templates, editing capabilities (including visibility changes), and role-based visibility controls. Comments are integrated into the existing fulfillment workflow using expandable table rows.

## Who Uses This

- **Internal GlobalRx Users** - Full CRUD operations on comments, including editing text and visibility
- **Vendor Users** - Create and view comments, but cannot edit or delete
- **Customers** - View only external comments (isInternalOnly = false)
- **System Administrators** - Full access with audit capabilities

## Business Rules

1. **Internal users can edit everything** - Internal users can edit both comment text AND the isInternalOnly visibility flag
2. **Vendors cannot edit** - Vendors can create and view but not edit or delete comments
3. **Template selection required** - Users must select a template before entering comment text
4. **Placeholder replacement mandatory** - All [placeholders] must be replaced before saving
5. **Character limit enforced** - Comments limited to 1000 characters after placeholder replacement
6. **Internal-only by default** - New comments default to isInternalOnly = true for safety
7. **Visibility warning on change** - Show confirmation when changing from internal to external
8. **Visual distinction required** - Internal comments must be visually distinct (gray background/lock icon)
9. **Expandable row display** - Comments shown in expandable rows beneath each service
10. **Modal for creation/editing** - Use ModalDialog component for consistency
11. **Live preview required** - Show final text as user replaces placeholders
12. **Edit history visible** - Show "Edited by [name] on [date]" for modified comments
13. **No anonymous access** - User must be authenticated to view any comments
14. **Permission check** - Users need 'fulfillment' permission to create/edit
15. **Service context maintained** - Comments always shown within service context
16. **Chronological order** - Comments displayed newest first
17. **Delete requires confirmation** - Two-step confirmation for comment deletion

## User Interface Design

### Service Table Enhancement

The existing ServiceFulfillmentTable component will be enhanced:

1. **Expandable Rows** - Click service row to expand and show comments below
2. **Comment Count Badge** - Show number of comments (e.g., "3 comments") in table cell
3. **Visual Indicators**:
   - Lock icon for services with internal comments
   - Comment bubble icon with count
   - Different color for rows with comments

### Comment Display Section (Expanded Row)

When a service row is expanded:
- **Header Bar**: "Comments (3)" with "Add Comment" button
- **Comment List**: Each comment shows:
  - Comment text (finalText)
  - Template name in small text
  - Author and timestamp
  - "Internal" or "External" badge
  - Edit/Delete buttons (for authorized users)
  - "Edited by [name] on [date]" if modified
- **Empty State**: "No comments yet. Add the first comment."

### Comment Creation Modal

Modal dialog with:
- **Title**: "Add Comment to [Service Name]"
- **Template Dropdown**: Filter templates by service type/status
- **Template Text Display**: Show template with [placeholders] highlighted
- **Placeholder Fields**: Dynamic form fields for each placeholder
- **Live Preview**: Update as user types in fields
- **Visibility Toggle**: Checkbox for "Internal Only" (checked by default)
- **Character Count**: "423/1000 characters"
- **Action Buttons**: Cancel / Add Comment

### Comment Edit Modal

Similar to creation but:
- **Title**: "Edit Comment"
- **Pre-filled Values**: Current comment text and visibility setting
- **Visibility Change Warning**: If changing internal to external, show:
  "Warning: This will make the comment visible to customers. Continue?"
- **Action Buttons**: Cancel / Save Changes

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Template | templateId | string | Yes | Must exist and be active | None |
| Comment Text | finalText | string | Yes | Max 1000 chars, no [placeholders] | Template text |
| Internal Only | isInternalOnly | boolean | Yes | Boolean | true |
| Service ID | serviceId | string | Yes | Must exist | Current service |
| Created By | createdBy | string | Auto | Current user ID | Current user |
| Created At | createdAt | timestamp | Auto | ISO timestamp | Now |
| Updated By | updatedBy | string | Auto | Set on edit | null |
| Updated At | updatedAt | timestamp | Auto | Set on edit | null |

## User Flows

### Viewing Comments

1. User opens order details page
2. Sees ServiceFulfillmentTable with services
3. Notices comment count badge on service row
4. Clicks row to expand
5. Comments section slides open below row
6. Sees filtered comments based on role:
   - Internal users: All comments
   - Vendors: All comments
   - Customers: Only external comments
7. Can identify internal vs external by visual indicator

### Creating a Comment

1. User expands service row
2. Clicks "Add Comment" button
3. Modal opens with template dropdown
4. Selects appropriate template
5. Template text appears with [placeholders] highlighted
6. Fills in placeholder values in form fields
7. Sees live preview update
8. Verifies "Internal Only" checkbox (defaults to checked)
9. Clicks "Add Comment"
10. Modal closes, new comment appears in list

### Editing a Comment (Internal Users Only)

1. User expands service row with existing comments
2. Clicks "Edit" button on a comment
3. Modal opens with current values
4. Can edit:
   - Comment text directly
   - Internal/External visibility toggle
5. If changing to external, sees warning dialog
6. Confirms or cancels visibility change
7. Clicks "Save Changes"
8. Modal closes, updated comment shows "Edited by" label

### Deleting a Comment (Internal Users Only)

1. User clicks "Delete" button on comment
2. Confirmation dialog appears
3. User confirms deletion
4. Comment removed from list
5. Success toast notification

## Component Structure

```
ServiceFulfillmentTable (enhanced)
├── ServiceRow (enhanced with expand/collapse)
│   ├── CommentCountBadge
│   └── ExpandIcon
├── CommentSection (new, shown when expanded)
│   ├── CommentHeader
│   │   └── AddCommentButton
│   ├── CommentList
│   │   └── CommentCard
│   │       ├── CommentText
│   │       ├── CommentMetadata
│   │       ├── VisibilityBadge
│   │       └── CommentActions (Edit/Delete)
│   └── EmptyState
├── CommentCreateModal (new)
│   ├── TemplateSelector
│   ├── PlaceholderForm
│   ├── LivePreview
│   └── VisibilityToggle
└── CommentEditModal (new)
    ├── CommentTextEditor
    ├── VisibilityToggle
    └── VisibilityChangeWarning
```

## API Integration

All frontend components will integrate with Phase 2b APIs:

- `GET /api/services/{id}/comments` - Fetch comments for a service
- `POST /api/services/{id}/comments` - Create new comment
- `PUT /api/services/{id}/comments/{commentId}` - Edit comment (including visibility)
- `DELETE /api/services/{id}/comments/{commentId}` - Delete comment
- `GET /api/comment-templates` - Fetch available templates

## Edge Cases

1. **Unsaved placeholder changes** - Warn user if closing modal with unsaved changes
2. **Network failure** - Show error toast, keep form data for retry
3. **Concurrent edits** - Last write wins, show refresh prompt
4. **Template becomes inactive** - Still show in existing comments, not in dropdown
5. **Long comments** - Show "Read more" for comments over 200 chars
6. **No templates available** - Disable Add Comment, show informative message
7. **Permission revoked mid-session** - Handle 403 gracefully
8. **Deleted service** - Comments remain viewable but read-only
9. **Maximum comments** - No limit in Phase 2c
10. **Special characters** - Properly escape/sanitize all text

## Impact on Other Modules

- **ServiceFulfillmentTable** - Add expand/collapse and comment integration
- **Order Details Page** - Include comment components
- **ModalDialog** - Reuse existing component
- **Permission Utils** - Use for authorization checks
- **Toast Notifications** - Use for success/error feedback

## Definition of Done

- [ ] ServiceFulfillmentTable shows comment count badges
- [ ] Rows expand/collapse to show comments
- [ ] Comments display with proper visibility filtering
- [ ] Internal comments visually distinct
- [ ] Add Comment button opens modal
- [ ] Template dropdown filters by service type/status
- [ ] Placeholders highlighted in template text
- [ ] Form fields for each placeholder
- [ ] Live preview updates as typing
- [ ] Internal Only defaults to checked
- [ ] Character count displayed
- [ ] Comments save successfully
- [ ] Edit button shown for internal users only
- [ ] Edit modal allows changing both text and visibility
- [ ] Warning shown when changing to external
- [ ] Delete requires confirmation
- [ ] Proper error handling
- [ ] Loading states implemented
- [ ] Mobile responsive
- [ ] All text translatable
- [ ] Tests written and passing

## Open Questions

1. Should we add comment filtering (by date, author, visibility)?
2. Do we need comment search functionality?
3. Should we support rich text formatting?
4. Do we need comment export functionality?
5. Should we add @mentions for notifications?
6. Do we need a comment activity log?