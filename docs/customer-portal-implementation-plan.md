# Customer Portal Implementation Plan

## Current Status (As of Feb 14, 2026)

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

### 🎉 Recently Completed (Feb 14, 2026)
**Complete Orders Listing & Enhanced Order Creation:**
- ✅ **Full Orders Listing Page**: Complete implementation with search, filtering, pagination, and responsive design
- ✅ **Subject Name Display Fix**: Orders now properly show subject names (First Name Last Name) in listing
- ✅ **Field Priority Ordering**: Logical field arrangement (Company Name before Company Address) with extensible regex-based system
- ✅ **Enhanced Order Submission**: Complete dynamic field support with proper UUID-to-field-name conversion
- ✅ **Service Display Enhancement**: Better UX showing "Service Type: Country" format with improved visibility
- ✅ **Country Dropdown Fix**: Restricted to show only countries, not subregions in order creation
- ✅ **Order Status Handling**: Proper distinction between draft and submitted orders
- ✅ **Data Flow Debugging**: Comprehensive debugging system implemented and removed after successful fixes
- ✅ **Branch Synchronization**: All enhancements properly merged into main and dev branches

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

### ✅ Completed (Jan 28, 2025) - NEW 4-STEP ORDER WORKFLOW
**Successfully Redesigned Order Creation with DSX Requirements Integration:**
- ✅ **Added `collectionTab` field** to DSXRequirement.fieldData JSON (subject vs search level)
- ✅ **Updated Data & Documents UI** with collection tab selection dropdown
- ✅ **Modified API endpoints** to save/retrieve collectionTab field
- ✅ **Built 4-Step Order Form** with shopping cart pattern:
  - Step 1: Service & Location (Country only) - Shopping cart implemented
  - Step 2: Subject Information - Order-level fields from DSXRequirements
  - Step 3: Search Details - Subregion selection + service-specific fields
  - Step 4: Documents - Location-specific requirements
- ✅ **Dynamic Form Generation** for all field types (text, number, date, email, phone, select, checkbox, radio)
- ✅ **Step Status Indicators** with proper color progression (gray→red→green)
- ✅ **Requirements API** (`/api/portal/orders/requirements`) fetches and groups fields by collectionTab
- ✅ **Fixed Database Issues** - Corrected Country model usage (no separate Region model)

### 📋 Next Priority - Location Management
- Improve location management interface
- Add better subregion selection UI
- Optimize location hierarchy queries

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

### 2. Customer Portal Routes (/portal) ✅ MOSTLY COMPLETE
- ✅ `/portal/dashboard` - Overview page with real order statistics
- ✅ `/portal/orders/new` - Fully functional 4-step order creation with field priority ordering
- ✅ `/portal/orders` - Complete listing with search, filtering, pagination, and subject name display
- 📋 `/portal/orders/[id]` - **NEXT PRIORITY** - View order details/status (View links currently broken)
- 📋 `/portal/orders/[id]/edit` - **HIGH PRIORITY** - Edit draft orders (Edit links currently broken)
- ✅ `/portal/profile` - Basic profile page (view only)
- 📋 `/portal/reports` - Download completed reports

### 3. Order Creation Flow - 4-STEP WORKFLOW ✅ COMPLETED
**Successfully implemented 4-step workflow with full DSX Requirements integration**

#### Step 1: Service & Location Selection (Country Level) ✅
- ✅ Shopping cart pattern implemented
- ✅ Service selection from customer's available services
- ✅ Country-level location selection
- ✅ Add to cart functionality
- ✅ Multiple instances of same service allowed

#### Step 2: Subject Information (Order Level) ✅
- ✅ Dynamic fields based on DSXRequirement where `collectionTab: "subject"`
- ✅ Fields collected once for entire order
- ✅ May update if Step 3 subregion adds requirements (tab turns red)
- ✅ Standard subject fields (name, DOB, etc.)

#### Step 3: Search Details (Per Service Instance) ✅
- ✅ For each service+country combination:
  - Subregion drill-down (region → city → district)
  - Service-specific fields where `collectionTab: "search"`
  - Different data for each service instance
- ✅ Can trigger new subject requirements

#### Step 4: Documents (Location-Specific) ✅
- ✅ Based on final service+location combinations
- ✅ Documents can be mapped at country or subregion levels
- 📋 Upload validation (PDF, JPG, PNG - 5MB max) - UI ready, needs backend
- ✅ Document scope already exists (per case/per search type/per search)

#### Key Features:
- **Tab Status Indicators**: Green (complete) / Red (incomplete)
- **Non-blocking Navigation**: Move between tabs freely
- **Dynamic Requirements**: Subregion selection can add subject fields
- **Save Draft**: Available at any point, even with incomplete tabs

### 4. Dynamic Requirement Collection ✅ COMPLETED
**Technical Implementation Details**:

#### Database Schema Updates ✅:
```javascript
// Added to DSXRequirement.fieldData JSON:
{
  dataType: "text",
  shortName: "dob",
  instructions: "Enter date of birth",
  retentionHandling: "no_delete",
  collectionTab: "subject" | "search"  // ✅ FIELD ADDED
}
```

#### API Endpoints ✅:
- ✅ `GET /api/portal/orders/requirements` - Fully implemented
  - Queries ServiceRequirement for service-level requirements
  - Queries DSXMapping for location-specific overrides
  - Groups by collectionTab (subject vs search)
  - Returns deduplicated field list

#### Dynamic Form Generation ✅:
- ✅ Forms built based on all dataTypes: text, number, date, email, phone, select, checkbox, radio
- ✅ Handles options for select/radio/checkbox fields
- ✅ Applies validation based on dataType
- ✅ Shows instructions and help text
- ✅ Tracks which fields come from which requirement source

#### Requirement Resolution Logic ✅:
1. ✅ Gets base requirements from ServiceRequirement
2. ✅ Checks DSXMapping for country-level overrides
3. ✅ When subregions selected, checks DSXMapping for subregion overrides
4. ✅ Deduplicates fields (same field required by multiple sources = collect once)
5. ✅ Groups by collectionTab for proper placement in workflow

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

#### API Endpoints ✅ MOSTLY COMPLETE
- ✅ `POST /api/portal/orders` - Create new order
- ✅ `GET /api/portal/orders` - List customer's orders
- ✅ `GET /api/portal/orders/[id]` - Get order details
- ✅ `PUT /api/portal/orders/[id]` - Update draft order
- ✅ `POST /api/portal/orders/[id]/submit` - Submit order
- ✅ `DELETE /api/portal/orders/[id]` - Delete draft order
- ✅ `GET /api/portal/orders/stats` - Order statistics
- ✅ `GET /api/portal/orders/requirements` - Get dynamic requirements (COMPLETED Jan 28)
- 📋 `POST /api/portal/documents/upload` - Upload document
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

### Core Features (Week 3-4) ✅ MOSTLY COMPLETE
6. ✅ Build order creation flow with dynamic forms (COMPLETED Jan 28)
7. ✅ Implement service/location selection logic (COMPLETED Jan 28)
8. 📋 Add document upload functionality (UI ready, backend needed)
9. ✅ Create order listing and filtering (COMPLETED)
10. ✅ Implement draft saving (COMPLETED)

### Integration & Polish (Week 5-6) ✅ MOSTLY COMPLETE
11. ✅ Integrate with existing DSX requirements (COMPLETED Jan 28)
12. ✅ Orders listing with status management (COMPLETED Feb 14)
13. ✅ Field priority ordering system (COMPLETED Feb 14)
14. ✅ Build customer dashboard (basic version with real data)
15. ✅ Subject name display and data flow fixes (COMPLETED Feb 14)

### Next Phase - Order Details & Management 📋 UPCOMING
16. **Order Details Page** (`/portal/orders/[id]`) - **IMMEDIATE PRIORITY**
    - Complete order information and status display
    - Subject details and all collected field data
    - Service items with search parameters
    - Status history and timeline
    - Document attachments (when implemented)

17. **Order Edit Functionality** (`/portal/orders/[id]/edit`) - **HIGH PRIORITY**
    - Pre-populate order form with existing data
    - Allow modifications to draft orders before submission
    - Integrate with existing 4-step workflow

18. **Document Upload System** - **MEDIUM PRIORITY**
    - Complete the TODO in `order.service.ts` for document handling
    - Implement file upload UI in the order form
    - Store and retrieve documents for orders
    - Display documents in order details

19. **Enhanced Order Management** - **LOWER PRIORITY**
    - Order cancellation for draft orders
    - Advanced search and filtering
    - Bulk operations
    - Status change notifications

### Pre-MVP Security (Week 7)
20. Add enhanced password rules
21. Implement rate limiting
22. Add security headers
23. Set up environment separation
24. Basic penetration testing

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