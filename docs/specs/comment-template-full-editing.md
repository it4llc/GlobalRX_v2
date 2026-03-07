# Feature Specification: Comment Template Full Text Editing
**Date:** March 7, 2026
**Requested by:** Andy
**Status:** Approved

## Summary
This feature removes bracket validation from service comments and updates the CommentCreateModal to display the entire template text in an editable textarea, allowing users to modify any part of the template content directly after selection. Templates become starting points rather than rigid structures, giving users complete flexibility while still tracking which template was originally chosen for reporting purposes.

## Who Uses This
- **Users with Fulfillment Permissions** - Any user (internal or external) with fulfillment permissions can select templates and edit the entire text freely before saving comments

## Business Rules
1. **No bracket validation** - Brackets `[` and `]` are treated as regular text characters with no special meaning or validation
2. **Template is a starting point** - When a template is selected, its full text becomes the initial value that users can modify completely
3. **Any text modification allowed** - Users can change any part of the template text, not just placeholder values
4. **Template ID still tracked** - The system continues to record which template was originally selected, even if the final text is completely different
5. **Character limit remains** - Comments are still limited to 1000 characters maximum
6. **Text cannot be empty** - Comment text must contain at least one non-whitespace character
7. **Internal-only by default** - New comments still default to isInternalOnly = true
8. **No placeholder field generation** - System does not parse text for placeholders or generate input fields
9. **Single textarea interface** - Template text is shown in one editable textarea, not a preview with separate fields
10. **Template selection still required** - Users must select a template before entering text (provides starting point)
11. **Template availability filtering** - Template dropdown only shows templates configured as available for the specific service type and order status

## User Flow
1. **User opens comment modal** - Clicks "Add Comment" button on a service
2. **Selects a template** - Chooses from dropdown of available templates (filtered to only show templates configured for the current service type and order status)
3. **Template text appears in editable textarea** - Full template text (including any brackets) is placed in an editable textarea field
4. **User modifies text freely** - Can edit any part of the text: add, remove, or change anything including removing/keeping brackets
5. **Character count updates live** - Shows current character count as user types (e.g., "523/1000 characters")
6. **Sets visibility** - Confirms or changes the "Internal Only" checkbox
7. **Saves comment** - Clicks "Add Comment" to save with the edited text
8. **System saves** - Records the templateId (for tracking), finalText (whatever user entered), and isInternalOnly flag

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|----------|------------|------|----------|------------|---------|
| Template | templateId | string | Yes | Must be valid UUID | None |
| Comment Text | finalText | string | Yes | 1-1000 chars, not empty/whitespace | Template's text |
| Internal Only | isInternalOnly | boolean | Yes | Boolean value | true |
| Service ID | serviceId | string | Yes (auto) | Valid service ID | Current service |
| Service Type | serviceType | string | Yes (auto) | Valid service type code | From service |
| Service Status | serviceStatus | string | Yes (auto) | Valid order item status | From order item |
| Created By | createdBy | string | Yes (auto) | Valid user ID | Current user |
| Created At | createdAt | timestamp | Yes (auto) | ISO timestamp | Now |

## Edge Cases and Error Scenarios
1. **Empty text submission** - Error: "Comment text cannot be empty"
2. **Only whitespace entered** - Error: "Comment text cannot be empty"
3. **Text exceeds 1000 characters** - Error: "Comment cannot exceed 1000 characters"
4. **No template selected** - "Add Comment" button disabled, cannot proceed
5. **Template has brackets in text** - Brackets appear as normal text in the textarea, user can keep or remove them
6. **User deletes all template text** - Textarea becomes empty, submission blocked with "Comment text cannot be empty" error
7. **User replaces entire template** - Allowed, system still tracks original templateId for reporting
8. **Network failure during save** - Error: "Failed to create comment. Please try again."
9. **Session timeout** - Error: "Your session has expired. Please log in again."
10. **Invalid template ID** - Error: "Invalid template selected"
11. **No templates available for service/status** - Message: "No comment templates are available for this service type and status"

## Impact on Other Modules
- **Comment Templates Module** - API needs to filter templates by service type and status when parameters are provided
- **Service Comments API** - Validation schemas need update to remove bracket checking
- **Comment Display** - No changes, displays finalText as saved
- **Reporting/Audit** - Still tracks templateId to know which template was originally selected
- **Comment Editing** - Edit modal would follow same pattern (full text editing)

## Definition of Done
1. Bracket validation removed from `createServiceCommentSchema` in both `/src/lib/schemas/serviceCommentSchemas.ts` and `/src/lib/validations/service-comment.ts`
2. Bracket validation removed from `updateServiceCommentSchema` in both files
3. `CommentCreateModal` updated to show template text in editable `<Textarea>` instead of read-only preview
4. Placeholder parsing and field generation code removed from `CommentCreateModal`
5. Template text becomes the initial value of the editable textarea when template is selected
6. Character counter remains functional with editable textarea
7. "Add Comment" button enabled only when template selected and text is not empty
8. Tests updated to remove bracket validation checks
9. Tests added for full text editing scenarios
10. No console.log statements or debugging code remains
11. Component follows existing UI patterns and uses established components

## Open Questions
None - all requirements have been clarified by Andy.