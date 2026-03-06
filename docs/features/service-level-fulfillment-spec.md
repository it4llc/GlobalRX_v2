# Service-Level Vendor Assignment and Status Tracking
**Feature Specification & Technical Plan**
**Date:** March 4, 2026
**Status:** Approved

## Business Specification

### Summary
This feature extends the GlobalRx platform to enable independent vendor assignment and status tracking at the individual service level (OrderItem), rather than only at the order level. Different vendors can handle different services within the same order.

### Key Business Rules
1. **Service Status Values**: pending, submitted, processing, completed, cancelled
2. **No status transition restrictions initially** (learning workflow patterns)
3. **Each service can be assigned to a different vendor**
4. **Services can be reassigned between vendors anytime**
5. **Deactivated vendor's services remain assigned but flagged**
6. **Terminal statuses (completed, cancelled) remain visible to vendors**
7. **Order closure**: Once all services reach terminal status, internal users can manually close the order with comments
8. **Every change creates audit trail** with userId, timestamp, old/new values
9. **Vendors only see orderNumber**, no customer details
10. **Services created when order submitted** (one per OrderItem)

### Confirmed Decisions
- No notifications for now (vendors check for Submitted status)
- All fulfillment done at service level
- No SLA tracking initially
- No vendor capacity display
- Future: vendors assigned to service/location pairs (not now)
- Order closure requires manual action after all services complete

## Technical Plan

### Database Schema

#### New Tables

**services_fulfillment**
```prisma
model ServicesFulfillment {
  id               String              @id @default(uuid())
  orderId          String
  orderItemId      String              @unique
  serviceId        String
  locationId       String
  assignedVendorId String?
  status           String              @default("pending")
  vendorNotes      String?             @db.Text
  internalNotes    String?             @db.Text
  assignedAt       DateTime?
  assignedBy       String?
  completedAt      DateTime?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  order            Order               @relation(fields: [orderId], references: [id])
  orderItem        OrderItem           @relation(fields: [orderItemId], references: [id])
  service          Service             @relation(fields: [serviceId], references: [id])
  location         Country             @relation(fields: [locationId], references: [id])
  assignedVendor   VendorOrganization? @relation(fields: [assignedVendorId], references: [id])
  assignedByUser   User?               @relation("ServiceAssignedBy", fields: [assignedBy], references: [id])
  auditLogs        ServiceAuditLog[]

  @@index([orderId])
  @@index([orderItemId])
  @@index([assignedVendorId])
  @@index([status])
  @@map("services_fulfillment")
}
```

**service_audit_log**
```prisma
model ServiceAuditLog {
  id                   String              @id @default(uuid())
  serviceFulfillmentId String
  orderId              String
  userId               String
  changeType           String              // status_change, vendor_assignment, note_update
  fieldName            String?
  oldValue             String?             @db.Text
  newValue             String?             @db.Text
  notes                String?             @db.Text
  ipAddress            String?
  userAgent            String?
  createdAt            DateTime            @default(now())

  serviceFulfillment   ServicesFulfillment @relation(fields: [serviceFulfillmentId], references: [id])
  user                 User                @relation(fields: [userId], references: [id])

  @@index([serviceFulfillmentId])
  @@index([orderId])
  @@index([userId])
  @@index([createdAt])
  @@map("service_audit_log")
}
```

### API Endpoints

1. **GET /api/fulfillment/services**
   - List services based on permissions
   - Filters: orderId, status, vendorId, limit, offset
   - Vendors only see assigned services

2. **GET /api/fulfillment/services/[id]**
   - Get single service detail with history
   - Must be assigned vendor or admin

3. **PATCH /api/fulfillment/services/[id]**
   - Update: status, assignedVendorId, vendorNotes, internalNotes
   - Creates audit log entry
   - Permission checks per field

4. **GET /api/fulfillment/services/[id]/history**
   - Complete audit trail for the service
   - Includes user details, timestamps

5. **POST /api/fulfillment/services/bulk-assign**
   - Assign multiple services to a vendor
   - Body: { serviceFulfillmentIds: [], vendorId: string }
   - Requires fulfillment.manage permission

### New Files to Create

#### API Routes
- `/src/app/api/fulfillment/services/route.ts`
- `/src/app/api/fulfillment/services/[id]/route.ts`
- `/src/app/api/fulfillment/services/[id]/history/route.ts`
- `/src/app/api/fulfillment/services/bulk-assign/route.ts`

#### Service Layer
- `/src/lib/services/service-fulfillment.service.ts`
- `/src/lib/services/service-audit.service.ts`

#### Types & Schemas
- `/src/types/service-fulfillment.ts`
- `/src/lib/schemas/service-fulfillment.schemas.ts`

#### UI Components
- `/src/components/fulfillment/ServiceAssignmentDialog.tsx`
- `/src/components/fulfillment/ServiceStatusDropdown.tsx`
- `/src/components/fulfillment/ServiceFulfillmentTable.tsx`
- `/src/components/fulfillment/ServiceAuditHistory.tsx`

### Files to Modify

1. **`/src/lib/services/order-core.service.ts`**
   - Create ServicesFulfillment records when order submitted

2. **`/src/app/api/fulfillment/orders/[id]/status/route.ts`**
   - Add order closure logic when all services terminal
   - Add comments field for closure

3. **`/src/app/fulfillment/orders/[orderId]/page.tsx`**
   - Add service-level fulfillment table and controls
   - Add order closure UI with comments

4. **Translation files** (all languages)
   - Add service fulfillment translation keys

### TypeScript Types

```typescript
interface ServiceFulfillment {
  id: string;
  orderId: string;
  orderItemId: string;
  serviceId: string;
  locationId: string;
  assignedVendorId: string | null;
  status: ServiceStatus;
  vendorNotes: string | null;
  internalNotes: string | null;
  assignedAt: Date | null;
  assignedBy: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type ServiceStatus = 'pending' | 'submitted' | 'processing' | 'completed' | 'cancelled';

interface ServiceAuditLog {
  id: string;
  serviceFulfillmentId: string;
  orderId: string;
  userId: string;
  changeType: 'status_change' | 'vendor_assignment' | 'note_update';
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  notes: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}
```

### Validation Schemas

```typescript
const updateServiceFulfillmentSchema = z.object({
  status: z.enum(['pending', 'submitted', 'processing', 'completed', 'cancelled']).optional(),
  assignedVendorId: z.string().uuid().nullable().optional(),
  vendorNotes: z.string().max(5000).optional(),
  internalNotes: z.string().max(5000).optional(),
});

const bulkAssignSchema = z.object({
  serviceFulfillmentIds: z.array(z.string().uuid()).min(1).max(100),
  vendorId: z.string().uuid(),
});

const serviceQuerySchema = z.object({
  orderId: z.string().uuid().optional(),
  status: z.enum(['pending', 'submitted', 'processing', 'completed', 'cancelled']).optional(),
  vendorId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
```

### Implementation Order

1. Database schema changes
2. Prisma migration
3. TypeScript types
4. Zod schemas
5. Service layer
6. API routes
7. Data migration script
8. UI components
9. Translation keys
10. Integration with order pages
11. Testing

### Migration Strategy

1. Create ServicesFulfillment record for each existing OrderItem
2. Copy order-level vendor assignment to all services
3. Set initial service status to match parent order
4. No breaking changes to existing functionality

### Performance Considerations

- Indexes on frequently queried fields (orderId, vendorId, status)
- Pagination for large service lists
- Efficient aggregation queries for order status

### Security & Permissions

- Vendors only see services assigned to them
- Vendor assignment requires fulfillment.manage permission
- Status updates require fulfillment permission
- Audit trail tracks all changes with user context

### Testing Strategy

1. Unit tests for service layer business logic
2. API route tests with permission scenarios
3. Integration tests for vendor isolation
4. Migration script tests
5. UI component tests
6. E2E tests for complete workflows

### Rollback Plan

1. Keep backup of database before migration
2. API versioning if needed during transition
3. Feature flag to toggle service-level vs order-level
4. Migration script is reversible

## Definition of Done

✅ All existing OrderItems have ServicesFulfillment records
✅ API endpoints working with proper permissions
✅ Vendor users see only their assigned services
✅ Admin users can assign/reassign vendors
✅ All changes create audit log entries
✅ Order closure available when all services terminal
✅ Order closure includes comments field
✅ UI displays service-level information
✅ All tests passing with >80% coverage
✅ Documentation updated
✅ Performance targets met (<500ms response times)

## Next Steps

1. Write comprehensive tests (Stage 3)
2. Implement code to make tests pass (Stage 4)
3. Code review (Stage 5)
4. Standards check (Stage 6)
5. Documentation update (Stage 7)