# Service Comments System - Technical Documentation

**Feature:** Service Comments Database and API (Phase 2b)
**Date:** March 6, 2026
**Status:** ✅ Complete - Backend Implementation
**Frontend Status:** ⬜ Pending (Phase 3)

---

## Overview

The Service Comments system enables users to add standardized comments to individual services within orders using pre-configured comment templates. Comments are attached at the SERVICE level to support service-specific fulfillment workflows. The system includes complete CRUD operations, role-based visibility filtering, and comprehensive audit trails.

## Key Features

### ✅ Implemented (Phase 2b)
- **Template-based commenting** - All comments must use predefined templates
- **Service-level attachment** - Comments belong to individual services, not orders
- **Role-based visibility** - Internal/External comment filtering based on user type
- **Edit capability** - Internal users can edit comments with full audit trail
- **Access control** - Vendor/customer/internal user access validation
- **Text sanitization** - XSS and injection protection for comment content
- **Bulk retrieval** - Efficient API for loading all order service comments
- **Database schema** - ServiceComment table with proper indexes and relations

### ⬜ Pending (Phase 3)
- **Frontend UI** - Service tabs, comment forms, and comment display
- **Real-time updates** - Live comment updates across user sessions
- **Notification system** - Email/push notifications for new comments

---

## Database Schema

### ServiceComment Table

```sql
model ServiceComment {
  id              String               @id @default(uuid())
  serviceId       String               -- References ServicesFulfillment.id
  templateId      String               -- References CommentTemplate.id
  finalText       String               @db.Text
  isInternalOnly  Boolean              @default(true)
  createdBy       String               -- References User.id
  createdAt       DateTime             @default(now())
  updatedBy       String?              -- References User.id (nullable)
  updatedAt       DateTime?            -- Set when comment is edited

  -- Relations
  service         ServicesFulfillment  @relation(fields: [serviceId], references: [id])
  template        CommentTemplate      @relation(fields: [templateId], references: [id])
  createdByUser   User                 @relation("ServiceCommentCreatedBy")
  updatedByUser   User?                @relation("ServiceCommentUpdatedBy")

  -- Indexes for performance
  @@index([serviceId])
  @@index([createdBy])
  @@index([createdAt])
  @@index([serviceId, createdAt])
}
```

### Key Database Design Decisions

1. **Service-level attachment** - Comments belong to `ServicesFulfillment` records, not `Order` records, enabling service-specific communication
2. **Template requirement** - All comments must reference a valid `CommentTemplate` to ensure standardization
3. **Audit trail** - Full tracking of creation and modification with user references
4. **Security default** - `isInternalOnly` defaults to `true` to prevent accidental exposure of sensitive information
5. **Soft relationships** - Uses proper foreign keys with cascade behavior for data integrity

---

## API Endpoints

### POST /api/services/[id]/comments

Creates a new comment for a specific service.

**Required Permission:** `fulfillment`

**Request Body:**
```typescript
{
  templateId: string;        // UUID of comment template
  finalText: string;         // Comment text (1-1000 characters)
  isInternalOnly?: boolean;  // Defaults to true
}
```

**Business Logic:**
- Validates template exists and is active
- Checks template availability for service type and status
- Marks template as "used" for analytics
- Enforces character limits and text sanitization
- Creates audit trail with user information

### GET /api/services/[id]/comments

Retrieves comments for a service with role-based visibility filtering.

**Access Control:**
- **Internal users:** See all comments
- **Vendor users:** See all comments (for operational transparency)
- **Customer users:** See only external comments (isInternalOnly = false)

**Response:**
```typescript
{
  comments: ServiceCommentResponse[];
  total: number;
}
```

### PUT /api/services/[id]/comments/[commentId]

Updates an existing comment (internal users only).

**Restriction:** Only internal users can edit comments

**Request Body:**
```typescript
{
  finalText?: string;        // Updated comment text
  isInternalOnly?: boolean;  // Updated visibility flag
}
```

**Business Logic:**
- Validates user is internal (not vendor or customer)
- Updates audit trail with editor information
- Preserves original creation data

### GET /api/orders/[id]/services/comments

Bulk endpoint to retrieve all comments for all services in an order.

**Purpose:** Efficient loading for order details pages with multiple service tabs

**Response:**
```typescript
{
  serviceComments: {
    [serviceId: string]: {
      serviceName: string;
      serviceStatus: string;
      comments: ServiceCommentResponse[];
      total: number;
    }
  }
}
```

---

## Security Implementation

### Text Sanitization

The system implements multi-layered text security:

1. **Input validation** - Zod schema validation with character limits
2. **Safety checking** - Pre-validation to reject malicious patterns
3. **Content sanitization** - HTML/script tag removal and SQL keyword filtering
4. **Null byte protection** - Removal of null bytes and control characters

**Implementation:** `src/lib/utils/text-sanitization.ts`

### Access Control

**Service-level access validation:**
- Internal users: Full access to all services
- Vendor users: Access only to services assigned to their vendor
- Customer users: Access only to services in their orders

**Comment visibility filtering:**
- Internal/Vendor users: See all comments (internal and external)
- Customer users: See only external comments (isInternalOnly = false)

### Permission Requirements

- **Creating comments:** Requires `fulfillment` permission
- **Editing comments:** Internal users only (vendors cannot edit)
- **Viewing comments:** Must have access to the parent service

---

## Business Rules

### Template Usage
1. Comments must reference an active CommentTemplate
2. Template must be available for the service type and current status
3. Template usage is tracked for analytics (hasBeenUsed flag)

### Visibility Control
1. Comments default to internal-only (isInternalOnly = true)
2. External visibility must be explicitly set
3. Customers never see internal comments
4. Vendors see all comments for operational context

### Edit Permissions
1. Only internal users can edit comments
2. Vendors can create but not edit comments
3. Full audit trail maintained for all edits
4. Original creation data is preserved

### Character Limits
1. Comment text: 1-1000 characters
2. Empty or whitespace-only text rejected
3. Text sanitization preserves readability

---

## Service Layer

### ServiceCommentService Class

**File:** `src/services/service-comment-service.ts`

**Key Methods:**

- `createComment()` - Creates new comments with full validation
- `updateComment()` - Edits existing comments (internal users only)
- `getServiceComments()` - Retrieves comments with visibility filtering
- `getOrderServiceComments()` - Bulk retrieval for order pages
- `validateUserAccess()` - Service-level access control
- `validateOrderAccess()` - Order-level access control

**Business Logic Highlights:**
- Atomic transactions for comment creation and template marking
- Comprehensive access validation based on user type
- Role-based visibility filtering
- Security-first defaults (internal-only comments)

---

## Type Definitions

### Core Types

**File:** `src/types/service-comment.ts`

```typescript
// Input types
export type CreateServiceCommentInput = {
  templateId: string;
  finalText: string;
  isInternalOnly?: boolean;
};

export type UpdateServiceCommentInput = {
  finalText?: string;
  isInternalOnly?: boolean;
};

// Database model
export interface ServiceComment {
  id: string;
  serviceId: string;
  templateId: string;
  finalText: string;
  isInternalOnly: boolean;
  createdBy: string;
  createdAt: Date;
  updatedBy: string | null;
  updatedAt: Date | null;
}

// API response type
export interface ServiceCommentResponse {
  id: string;
  serviceId: string;
  templateId: string;
  finalText: string;
  isInternalOnly: boolean;
  createdBy: string;
  createdAt: string; // ISO string
  updatedBy: string | null;
  updatedAt: string | null; // ISO string
  template: {
    shortName: string;
    longName: string;
  };
  createdByUser: {
    name: string;
    email: string;
  };
  updatedByUser?: {
    name: string;
    email: string;
  } | null;
}
```

### Validation Schemas

**File:** `src/lib/validations/service-comment.ts`

- Zod schemas for request validation
- Text sanitization integration
- Security pattern checking
- Character limit enforcement

---

## Error Handling

### Validation Errors (400)
- Empty or excessive comment text
- Invalid template ID format
- Unsafe content patterns
- Missing required fields

### Authorization Errors (403)
- Insufficient permissions (no fulfillment permission)
- Service access denied
- Edit permission denied (vendors/customers)

### Not Found Errors (404)
- Service not found
- Comment not found
- Template not found

### Business Logic Errors (400)
- Template inactive
- Template not available for service type/status
- Template validation failure

---

## Testing Coverage

### Unit Tests
- **120+ tests** covering all service methods
- Permission validation scenarios
- Business rule enforcement
- Error condition handling
- Text sanitization validation

### API Integration Tests
- Full request/response cycle testing
- Authentication and authorization
- Error response validation
- Edge case scenarios

### Database Tests
- Transaction integrity
- Foreign key constraints
- Index performance
- Data consistency

---

## Performance Considerations

### Database Optimization
- Composite index on (serviceId, createdAt) for efficient comment retrieval
- Individual indexes on createdBy and createdAt for audit queries
- Proper foreign key relationships with cascade behavior

### API Optimization
- Bulk endpoint for order page loading
- Efficient joins for user and template data
- Role-based query optimization
- Response transformation for consistent formatting

### Caching Strategy (Future)
- Service comment counts for UI badges
- Template availability cache
- User permission caching

---

## Integration Points

### Dependencies
- **Comment Templates Phase 1** - Must be completed for template references
- **User Management** - For user type and permission validation
- **Services/Orders** - For service access validation
- **Authentication** - For session and permission management

### Data Relationships
- ServiceComment → ServicesFulfillment (service attachment)
- ServiceComment → CommentTemplate (template reference)
- ServiceComment → User (creator/editor references)
- ServicesFulfillment → Order → Customer (access hierarchy)

---

## Future Enhancements (Phase 3+)

### Frontend Implementation
- Service tab interface with comment sections
- Template selection dropdown with context filtering
- Comment editing forms for internal users
- Real-time comment updates

### Advanced Features
- Comment notifications (email/push)
- Comment search and filtering
- Bulk comment operations
- Comment templates per customer
- Rich text formatting
- File attachments

### Analytics
- Template usage statistics
- Comment activity reporting
- User engagement metrics
- Service communication patterns

---

## Migration and Deployment

### Database Migration
**File:** `prisma/migrations/20260305221507_add_service_comments/`

- Creates ServiceComment table with all indexes
- Establishes foreign key relationships
- Sets up proper constraints and defaults

### Deployment Checklist
✅ Database migration applied
✅ API endpoints deployed
✅ Service layer implemented
✅ Type definitions created
✅ Validation schemas deployed
✅ Security utilities implemented
✅ Unit tests passing (120+ tests)
✅ Integration tests passing
⬜ Frontend UI implementation (Phase 3)
⬜ User documentation
⬜ Training materials

---

## Audit and Compliance

### Data Audit Trail
- Complete creation tracking (user, timestamp)
- Edit history with updater and update timestamp
- Template usage tracking
- Service access logging

### Security Compliance
- Input sanitization for XSS prevention
- SQL injection protection via parameterized queries
- Role-based access controls
- Data visibility controls

### Privacy Controls
- Internal/external comment separation
- Customer data protection (no access to internal comments)
- Vendor data isolation (only assigned services)

---

This documentation covers the complete Service Comments Phase 2b implementation. The system provides a robust foundation for service-level communication with proper security, audit trails, and role-based access controls.