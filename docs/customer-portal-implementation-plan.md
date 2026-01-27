# Customer Portal Implementation Plan

## Current Status (As of Jan 26, 2025)

### ✅ Completed
- Customer authentication system with role-based access
- Portal layout and navigation structure
- Database schema for all portal models
- Middleware for customer/admin separation
- Account security (lockout, failed attempts tracking)
- Complete Order API system with professional order numbering
- Dashboard with real order statistics and recent orders
- Order service layer with CRUD operations
- Test scripts and data validation

### 🎉 Recently Completed (Jan 26, 2025)
**Order Management System Foundation:**
- **Professional Order Numbering**: Format `YYYYMMDD-ABC-0001` with consistent customer codes
- **Complete Order API**: All CRUD operations, status management, statistics
- **OrderService Layer**: Comprehensive business logic with validation
- **Real Dashboard Data**: Live statistics and recent orders from database
- **Test Infrastructure**: Scripts for creating sample data and validation

**Key Technical Achievement**:
Order numbers now follow enterprise format (e.g., `20260126-CLM-0001`) where:
- `20260126` = Date (YYYY-MM-DD format)
- `CLM` = Consistent 3-char customer code (same customer always gets same code)
- `0001` = Daily sequence counter per customer (resets each day)

### 🚧 In Progress - NEW 4-STEP ORDER WORKFLOW
- **Redesigning order creation to properly integrate DSX Requirements**
- Adding `collectionTab` field to data fields (subject vs search level)
- Building dynamic form generation based on field configurations

### 📋 Next Priority - UPDATED IMPLEMENTATION PLAN
1. **Phase 1: Database & UI Updates**
   - Add `collectionTab` field to DSXRequirement.fieldData JSON
   - Update Data & Documents UI to include collection tab selection
   - Modify API endpoints to save/retrieve this field

2. **Phase 2: Refactor Order Form (4 Steps)**
   - Step 1: Service & Location (Country only) - Shopping cart pattern
   - Step 2: Subject Information - Order-level fields
   - Step 3: Search Details - Subregion selection + service-specific fields
   - Step 4: Documents - Location-specific requirements

3. **Phase 3: Dynamic Features**
   - Tab status indicators (Green/Red)
   - Dynamic requirement updates based on subregion selection
   - Non-blocking navigation with save draft at any point

## Architecture Recommendation
**Single Application with Role-Based Access** - Extend the current Next.js application rather than creating a separate one. This approach offers:
- Shared authentication/session management
- Reusable components and utilities
- Single database and API layer
- Easier maintenance and deployment
- Consistent branding and UI patterns

## Security Implementation Phases

### Phase 1: Implement Now (Foundation) ✅ COMPLETED
These changes set up the structure without slowing development:

#### Database Schema Changes ✅ COMPLETED
```prisma
// Add to existing User model
model User {
  // ... existing fields ...
  userType            String   @default("admin") // "admin" or "customer"
  customerId          String?  // For customer users
  failedLoginAttempts Int      @default(0)
  lockedUntil         DateTime?
  lastPasswordChange  DateTime @default(now())
  mfaEnabled          Boolean  @default(false)
  mfaSecret          String?  // Will use later
  lastLoginAt         DateTime?
  lastLoginIp         String?

  // Relations
  customer            Customer? @relation(fields: [customerId], references: [id])
}

// Customer user association
model CustomerUser {
  id         String   @id @default(uuid())
  userId     String   @unique
  customerId String
  role       String   @default("user")
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  user       User     @relation(fields: [userId], references: [id])
  customer   Customer @relation(fields: [customerId], references: [id])

  @@index([customerId])
  @@map("customer_users")
}

// Order and related models for portal
model OrderStatus {
  id              String   @id @default(uuid())
  code            String   @unique
  name            String
  description     String?
  color           String?
  sequence        Int
  isActive        Boolean  @default(true)
  allowedNextStatuses Json?
  createdAt       DateTime @default(now())

  @@map("order_statuses")
}

model Order {
  id             String         @id @default(uuid())
  orderNumber    String         @unique
  customerId     String
  userId         String
  statusCode     String
  subject        Json
  totalPrice     Decimal?       @db.Decimal(10, 2)
  notes          String?
  submittedAt    DateTime?
  completedAt    DateTime?
  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  items          OrderItem[]
  statusHistory  OrderStatusHistory[]
  customer       Customer       @relation(fields: [customerId], references: [id])
  user           User          @relation(fields: [userId], references: [id])

  @@index([customerId])
  @@index([statusCode])
  @@index([orderNumber])
  @@map("orders")
}

model OrderStatusHistory {
  id         String   @id @default(uuid())
  orderId    String
  fromStatus String?
  toStatus   String
  changedBy  String
  reason     String?
  createdAt  DateTime @default(now())

  order      Order    @relation(fields: [orderId], references: [id])
  user       User     @relation(fields: [changedBy], references: [id])

  @@index([orderId])
  @@map("order_status_history")
}

model OrderItem {
  id         String          @id @default(uuid())
  orderId    String
  serviceId  String
  locationId String
  status     String
  price      Decimal?        @db.Decimal(10, 2)
  createdAt  DateTime        @default(now())

  order      Order           @relation(fields: [orderId], references: [id])
  service    Service         @relation(fields: [serviceId], references: [id])
  location   Country         @relation(fields: [locationId], references: [id])
  data       OrderData[]
  documents  OrderDocument[]

  @@index([orderId])
  @@map("order_items")
}

model OrderData {
  id          String   @id @default(uuid())
  orderItemId String
  fieldName   String
  fieldValue  String   // Will encrypt sensitive fields later
  fieldType   String   // To identify PII level
  createdAt   DateTime @default(now())

  orderItem   OrderItem @relation(fields: [orderItemId], references: [id])

  @@index([orderItemId])
  @@map("order_data")
}

model OrderDocument {
  id          String   @id @default(uuid())
  orderItemId String
  documentType String
  fileName    String
  filePath    String   // Store in secure location
  fileSize    Int
  mimeType    String
  uploadedAt  DateTime @default(now())

  orderItem   OrderItem @relation(fields: [orderItemId], references: [id])

  @@index([orderItemId])
  @@map("order_documents")
}

// Basic audit logging (simple version for now)
model AuditLog {
  id          String   @id @default(uuid())
  userId      String
  action      String
  entityType  String
  entityId    String
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

#### Basic Security Features ✅ MOSTLY COMPLETED
1. ✅ **Role-based access control** - Simple userType check (admin vs customer)
2. ✅ **Customer data isolation** - Customers can only see their own data via middleware
3. ✅ **Basic password requirements** - 8+ characters minimum
4. ✅ **Session management** - Using NextAuth with customer support
5. ✅ **HTTPS only** - Already in place
6. ✅ **Input validation** - Using Zod for API validation
7. ✅ **SQL injection prevention** - Prisma handles this
8. ✅ **XSS prevention** - React handles this by default
9. 🔧 **Basic audit logging** - Model created, implementation pending
10. 📋 **Secure file storage** - Not yet implemented

### Phase 2: Pre-MVP (Add Before Testing with Real Data) 🚧 PARTIALLY COMPLETE
Add these once core functionality works but before any real data:

1. **Enhanced authentication**:
   - 📋 Increase password complexity requirements (12+ chars, complexity rules)
   - ✅ Add account lockout after 5 failed attempts (COMPLETED)
   - 📋 Implement password history (prevent reuse of last 10)

2. **File upload security**:
   - File type validation (magic number checking)
   - File size limits (5MB)
   - Basic virus scanning (ClamAV)

3. **Rate limiting**:
   - Login attempts: 5 per 15 minutes
   - API calls: 100 per minute
   - File uploads: 10 per hour

4. **Enhanced audit logging**:
   - Add old/new values tracking
   - Data access logging for PII fields

5. **Security headers**:
   ```javascript
   // next.config.js
   headers: {
     'X-Frame-Options': 'DENY',
     'X-Content-Type-Options': 'nosniff',
     'X-XSS-Protection': '1; mode=block',
     'Referrer-Policy': 'strict-origin-when-cross-origin',
     'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
   }
   ```

6. **Environment separation**:
   - Different credentials for dev/staging/prod
   - No production data in development
   - Data masking in non-production

### Phase 3: Pre-Production (Before Go-Live)
Implement these before handling real customer data:

1. **Advanced authentication**:
   - Multi-factor authentication (MFA) - TOTP/SMS
   - Device fingerprinting
   - IP allowlisting option for enterprise
   - Session timeout (15 min idle)
   - Concurrent session limits

2. **Encryption**:
   - Database encryption at rest (PostgreSQL TDE)
   - Field-level encryption for SSN, DOB (Level 4 PII)
   - Encrypted backups with separate keys
   - Document encryption in storage

3. **Advanced monitoring**:
   - Security event monitoring dashboard
   - Anomaly detection in access patterns
   - Failed login alerting
   - Data export tracking
   - After-hours access monitoring

4. **Infrastructure security**:
   - Web Application Firewall (WAF)
   - DDoS protection
   - Network segmentation (VPCs)
   - Secret management (AWS KMS/HashiCorp Vault)
   - Container vulnerability scanning

5. **Compliance & testing**:
   - Penetration testing
   - Security audit
   - OWASP Top 10 review
   - Load testing
   - Disaster recovery testing

## MVP Implementation Features

### 1. Authentication & User Management ✅ COMPLETED
- ✅ Extend existing User model with `userType` field (admin/customer)
- ✅ Add `customerId` foreign key for customer users
- ✅ Create test customer user script
- ✅ Implement role-based route protection via middleware
- ✅ Add customer-specific permission checks
- ✅ Account locking after failed attempts
- ✅ Last login tracking with IP

### 2. Customer Portal Routes (/portal) 🚧 PARTIALLY COMPLETE
- ✅ `/portal/dashboard` - Overview page created (placeholder data)
- ✅ `/portal/orders/new` - UI created (not functional)
- 📋 `/portal/orders/[id]` - View order details/status
- ✅ `/portal/orders` - List page created (placeholder)
- 📋 `/portal/reports` - Download completed reports
- ✅ `/portal/profile` - Basic profile page (view only)

### 3. Order Creation Flow - NEW 4-STEP WORKFLOW 🚧 REDESIGNING
**Major Change**: Moving from 3-step to 4-step workflow to properly integrate DSX Requirements

#### Step 1: Service & Location Selection (Country Level)
- ✅ Shopping cart pattern implemented
- ✅ Service selection from customer's available services
- ✅ Country-level location selection
- ✅ Add to cart functionality
- Multiple instances of same service allowed

#### Step 2: Subject Information (Order Level)
- 📋 Dynamic fields based on DSXRequirement where `collectionTab: "subject"`
- 📋 Fields collected once for entire order
- 📋 May update if Step 3 subregion adds requirements (tab turns red)
- Standard subject fields (name, DOB, etc.)

#### Step 3: Search Details (Per Service Instance)
- 📋 For each service+country combination:
  - Subregion drill-down (region → city → district)
  - Service-specific fields where `collectionTab: "search"`
  - Different data for each service instance
- 📋 Can trigger new subject requirements

#### Step 4: Documents (Location-Specific)
- 📋 Based on final service+location combinations
- 📋 Documents can be mapped at country or subregion levels
- 📋 Upload validation (PDF, JPG, PNG - 5MB max)
- Document scope already exists (per case/per search type/per search)

#### Key Features:
- **Tab Status Indicators**: Green (complete) / Red (incomplete)
- **Non-blocking Navigation**: Move between tabs freely
- **Dynamic Requirements**: Subregion selection can add subject fields
- **Save Draft**: Available at any point, even with incomplete tabs

### 4. Dynamic Requirement Collection 🚧 IMPLEMENTING
**Technical Implementation Details**:

#### Database Schema Updates Needed:
```javascript
// Add to DSXRequirement.fieldData JSON:
{
  dataType: "text",
  shortName: "dob",
  instructions: "Enter date of birth",
  retentionHandling: "no_delete",
  collectionTab: "subject" | "search"  // NEW FIELD
}
```

#### API Endpoints Required:
- `GET /api/portal/orders/requirements` - Fetch all requirements for service+location combinations
  - Query ServiceRequirement for service-level requirements
  - Query DSXMapping for location-specific overrides
  - Group by collectionTab (subject vs search)
  - Return deduplicated field list

#### Dynamic Form Generation:
- Build forms based on `dataType`: text, number, date, email, phone, select, checkbox, radio
- Handle options for select/radio/checkbox fields
- Apply validation based on dataType
- Show instructions and help text
- Track which fields come from which requirement source

#### Requirement Resolution Logic:
1. Get base requirements from ServiceRequirement
2. Check DSXMapping for country-level overrides
3. When subregions selected, check DSXMapping for subregion overrides
4. Deduplicate fields (same field required by multiple sources = collect once)
5. Group by collectionTab for proper placement in workflow

### 5. Data Retention Integration
Use existing field-level retention configuration:
```javascript
// When fetching order data
const getOrderData = async (orderId) => {
  const data = await prisma.orderData.findMany({
    where: {
      orderId,
      // Check retention based on field configuration
      createdAt: {
        gte: getRetentionDate(fieldConfig.retentionDays)
      }
    }
  });
};
```

### 6. Order Management

#### Status Workflow (Configurable)
Initial statuses (can be extended via database):
- **Draft**: Order saved but not submitted
- **Submitted**: Order submitted by customer
- **Processing**: Order being processed
- **In Review**: Order under review
- **Pending Information**: Additional information needed
- **Complete**: Order processing complete
- **Cancelled**: Order cancelled

Additional statuses can be added via the OrderStatus configuration table.

#### Order Features
- Order history with search/filter capabilities
- Download reports as PDF
- View order details and submitted data
- Status change history/audit trail
- Save drafts and return later

### 7. API Structure ✅ LARGELY COMPLETE
- ✅ RESTful endpoints under `/api/portal/orders/`
- ✅ Separate middleware for customer authentication
- 📋 Basic rate limiting for customer endpoints
- 📋 Audit logging for all actions

#### API Endpoints ✅ CORE ENDPOINTS COMPLETE
- ✅ `POST /api/portal/orders` - Create new order
- ✅ `GET /api/portal/orders` - List customer's orders
- ✅ `GET /api/portal/orders/[id]` - Get order details
- ✅ `PUT /api/portal/orders/[id]` - Update draft order
- ✅ `POST /api/portal/orders/[id]/submit` - Submit order
- ✅ `DELETE /api/portal/orders/[id]` - Delete draft order
- ✅ `GET /api/portal/orders/stats` - Order statistics
- 📋 `POST /api/portal/documents/upload` - Upload document
- 📋 `GET /api/portal/requirements` - Get dynamic requirements
- 📋 `GET /api/portal/services/availability` - Check service availability

### 8. UI/UX Components 🚧 PARTIALLY COMPLETE
- ✅ Responsive design for mobile/tablet
- ✅ Progress indicator for multi-step forms (UI only)
- 📋 Real-time validation feedback
- ✅ Loading states and error handling patterns
- ✅ Accessible form controls

## Implementation Steps

### Immediate Actions (Week 1-2) ✅ COMPLETED
1. ✅ Create database migrations for new models
2. ✅ Set up OrderStatus configuration with initial statuses (in schema)
3. ✅ Build basic customer user authentication
4. ✅ Create portal layout and navigation
5. 🔧 Implement basic audit logging (model created, implementation pending)

### Core Features (Week 3-4) 🚧 IN PROGRESS
6. 🚧 Build order creation flow with dynamic forms (API complete, form needs wiring)
7. 📋 Implement service/location selection logic
8. 📋 Add document upload functionality
9. 🚧 Create order listing and filtering (basic API complete, UI needs connection)
10. ✅ Implement draft saving (API complete)

### Integration & Polish (Week 5-6)
11. Integrate with existing DSX requirements
12. Add order status management
13. Create report download functionality
14. Build customer dashboard
15. Add basic testing

### Pre-MVP Security (Week 7)
16. Add enhanced password rules
17. Implement rate limiting
18. Add security headers
19. Set up environment separation
20. Basic penetration testing

## Development Guidelines
- Use TypeScript for type safety
- Implement comprehensive error handling
- Follow existing code patterns and conventions
- Document all API endpoints
- Use React Query for data fetching
- Implement proper loading and error states
- Add basic unit tests for critical paths

## Success Metrics
- Order submission success rate
- Average time to complete order
- Error rates by endpoint
- Document upload success rate
- System uptime

## Future Enhancements (Post-MVP)
- Email notifications for status changes
- API integration for programmatic ordering
- Bulk upload via CSV/Excel
- Advanced permission levels within customer organization
- Invoice generation and payment integration
- WebHooks for status updates
- Multi-language support
- Mobile app (React Native)
- Real-time order tracking
- Customer analytics dashboard

This plan provides a pragmatic approach that prioritizes getting to MVP quickly while ensuring the security foundation is solid and can be progressively enhanced as we approach production. The flexible status system and retention integration ensure business requirements are met while maintaining development velocity.