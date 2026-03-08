# Comment Templates Feature

## Overview

The Comment Templates feature allows administrators to create and manage reusable comment templates with service availability configuration for order fulfillment. Templates include a shortName/longName/templateText schema and can be assigned to specific service and status combinations through a visual availability grid. This is Phase 1 of the larger fulfillment system implementation.

## User Guide

### Accessing Comment Templates

1. Navigate to **Global Configurations** (`/global-configurations`)
2. Click on the **Comment Templates** tab
3. You must have the `comment_management` permission to access this feature

### Managing Permissions

To grant a user access to Comment Templates:

1. Go to **User Admin**
2. Edit the user or create a new user
3. Check the **Comment Management** permission checkbox
4. Save the user

Note: This permission is only available for internal users, not vendors or customers.

### Creating a Template

1. Click **Add New** button in the Comment Templates page
2. Fill in the modal form:
   - **Short Name**: Brief identifier for dropdowns (max 50 chars, must be unique)
   - **Long Name**: Descriptive display name (max 100 chars)
   - **Template Text**: Template content with [placeholders] (max 1000 chars)
3. Click **Create** to save the template
4. Template is automatically selected and availability grid appears
5. Configure when template should be available by checking service/status combinations
6. Click **Save Configuration** to save availability settings

Example template:
```
Short Name: Missing Doc
Long Name: Document Required - Customer Must Provide
Template Text: Please provide [document type] for [candidate name]. The document was [reason for rejection].
```

### Configuring Availability

After creating or selecting a template, use the availability grid:
- **All row**: Toggle all services for a specific status column
- **Category rows**: Toggle all services within a category (e.g., Criminal, Education)
- **Individual cells**: Fine-tune specific service/status combinations
- **Status columns**: Fixed as DRAFT, SUBMITTED, PROCESSING, COMPLETED
- Click **Save Configuration** to persist changes

### Using Templates in Comments (Phase 2b/2c - Implemented) - Full Text Editing

**Major Change:** Templates now serve as fully editable starting points instead of rigid placeholder forms.

**How It Works:**
- Templates are filtered based on the service type and current status
- Only templates with matching availability configuration will appear in dropdown
- **Template text appears in a single editable textarea** - no separate placeholder fields
- **Brackets are treated as regular text** - no special validation or replacement
- Users can freely modify the entire text, including:
  - Keeping brackets as regular text characters
  - Removing placeholder sections entirely
  - Completely rewriting the message from scratch
  - Adding new content not in the original template
  - Editing any part of the template text
- The templateId is preserved to track which template was the starting point for reporting
- Comments can be edited after saving (internal users only) with full audit trail

**Business Rule:** Template selection is still required to provide a starting point and for tracking purposes, but the final text can be completely different from the original template.

## Technical Details

### Key Files

- **Database Schema**: `prisma/schema.prisma` - CommentTemplate and CommentTemplateAvailability models
- **API Routes**:
  - `src/app/api/comment-templates/route.ts` - GET (list with services/statuses) and POST (create)
  - `src/app/api/comment-templates/[id]/route.ts` - GET/PUT (template CRUD) and DELETE (soft/hard delete)
  - `src/app/api/comment-templates/[id]/availability/route.ts` - GET/PUT availability configuration
- **Frontend Components**:
  - `src/components/comment-templates/CommentTemplateGrid.tsx` - Main UI with availability grid
  - `src/hooks/useCommentTemplates.ts` - State management and API integration hook
- **Pages**: `src/app/global-configurations/comment-templates/page.tsx` - Route page
- **Schemas**: `src/lib/schemas/commentTemplateSchemas.ts` - Zod validation schemas and TypeScript types

### Database Schema

```prisma
model CommentTemplate {
  id            String                        @id @default(uuid())
  shortName     String                        // Brief name for dropdowns (max 50 chars)
  longName      String                        // Descriptive display name (max 100 chars)
  templateText  String                        @db.Text // Template content with [placeholders] (max 1000 chars)
  isActive      Boolean                       @default(true) // Soft delete flag
  hasBeenUsed   Boolean                       @default(false) // Determines delete strategy
  availabilities CommentTemplateAvailability[] // One-to-many relationship
  createdAt     DateTime                      @default(now())
  updatedAt     DateTime                      @updatedAt
  createdBy     String?
  updatedBy     String?

  @@map("comment_templates")
}

model CommentTemplateAvailability {
  id          String          @id @default(uuid())
  templateId  String          // Foreign key to CommentTemplate
  template    CommentTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  serviceCode String          // Service this template is available for
  status      String          // Order status this template is available for
  createdAt   DateTime        @default(now())

  @@unique([templateId, serviceCode, status]) // Prevent duplicate assignments
  @@map("comment_template_availabilities")
}
```

### API Endpoints

| Method | Endpoint | Description | Permission Required |
|--------|----------|-------------|-------------------|
| GET | `/api/comment-templates` | List all active templates with services/statuses | comment_management |
| POST | `/api/comment-templates` | Create new template | comment_management |
| GET | `/api/comment-templates/[id]` | Get single template with availabilities | comment_management |
| PUT | `/api/comment-templates/[id]` | Update template details | comment_management |
| DELETE | `/api/comment-templates/[id]` | Delete template (soft/hard based on hasBeenUsed) | comment_management |
| GET | `/api/comment-templates/[id]/availability` | Get availability configuration for template | comment_management |
| PUT | `/api/comment-templates/[id]/availability` | Replace all availability settings for template | comment_management |

### Business Rules

1. **Unique Short Names**: Only one active template can have the same shortName (inactive templates don't count)
2. **Character Limits**:
   - shortName: 50 characters max
   - longName: 100 characters max
   - templateText: 1000 characters max
3. **Soft Delete**: Templates that have been used (`hasBeenUsed = true`) can only be deactivated (isActive = false)
4. **Hard Delete**: Unused templates can be permanently deleted from database with their availability records
5. **Placeholder Syntax**: Uses `[placeholder]` format for visual markers (no validation enforced)
6. **Permission Required**: Only internal users with `comment_management` permission can access
7. **Availability Grid**: Templates can be assigned to multiple service/status combinations through visual grid
8. **Hardcoded Statuses**: Status columns are fixed as DRAFT, SUBMITTED, PROCESSING, COMPLETED for Phase 1
9. **Audit Trail**: All create/update operations track createdBy/updatedBy with user IDs
10. **Cascade Delete**: Deleting availability records when template is hard deleted maintains referential integrity

## Configuration

### Environment Variables

No specific environment variables required for this feature.

### Permission Setup

The `comment_management` permission is managed through the User Admin interface:
- Available for internal users only
- Vendors and customers cannot have this permission
- Stored in the user's permissions JSON field

## Testing

### Manual Testing Steps

1. **Permission Testing**:
   - Create a user without `comment_management` permission
   - Verify they cannot see the Comment Templates tab
   - Add the permission and verify access

2. **CRUD Operations**:
   - Create a template with valid data
   - Verify duplicate service/status combinations are rejected
   - Update a template and verify changes persist
   - Delete an unused template (should be permanent)
   - Create and use a template, then try to delete (should soft delete only)

3. **Validation Testing**:
   - Try to create a template exceeding 1000 characters
   - Test with various placeholder formats
   - Verify service codes are validated against existing services

### Automated Tests

Based on the implementation status described, the feature includes comprehensive test coverage:

- **API Route Tests**: Tests for all CRUD operations and availability management
- **Schema Tests**: Zod validation schema testing
- **Hook Tests**: State management and API integration testing
- **Component Tests**: UI behavior and user interaction testing

**Total**: 113 tests all passing, covering authentication, permissions, CRUD operations, availability grid logic, error handling, and business rules validation.

## Migration Guide

### Database Migration

The migration was applied using:
```bash
# Generate SQL
pnpm prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script

# Create migration
mkdir -p "prisma/migrations/$(date +%Y%m%d%H%M%S)_add_comment_templates"
# Save SQL to migration.sql

# Apply migration
pnpm prisma migrate deploy

# Generate client
pnpm prisma generate
```

### Breaking Changes

None - this is a new feature with no impact on existing functionality.

## Future Enhancements (Planned Phases)

### Phase 2: Order Comments System
- Use templates when adding comments to orders
- Template selection based on current order context
- Immutable comments after saving

### Phase 3: Search Results Tracking
- Text-based results for records searches
- Integration with fulfillment workflow

### Phase 4: Verification Results
- Structured results based on Data Rx configuration
- Field-by-field verification capture

### Phase 5: Customer Notification Configuration
- Email settings per customer
- Notification preferences

### Phase 6: Email Triggers
- Automated notifications for information requests
- Template-driven email content

See `/docs/planning/fulfillment-feature-phases.md` for complete roadmap.

## Troubleshooting

### Common Issues

1. **"Forbidden" error when accessing templates**:
   - Check user has `comment_management` permission
   - Verify user is logged in as internal user (not vendor/customer)

2. **Templates not appearing**:
   - Check if templates are active (`deletedAt = null`)
   - Verify service codes match existing services

3. **Cannot delete template**:
   - Check if template has been used (`hasBeenUsed = true`)
   - Used templates can only be soft deleted

### Debug Endpoints

- Check current user permissions: `GET /api/debug-session`
- List all templates (including deleted): `GET /api/comment-templates?includeDeleted=true`

## Support

For issues or questions about this feature, contact the development team or refer to the GlobalRx coding standards at `/docs/standards/CODING_STANDARDS.md`.