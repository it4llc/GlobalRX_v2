# Customer Portal Implementation Plan

## Architecture Recommendation
**Single Application with Role-Based Access** - Extend the current Next.js application rather than creating a separate one. This approach offers:
- Shared authentication/session management
- Reusable components and utilities
- Single database and API layer
- Easier maintenance and deployment
- Consistent branding and UI patterns

## Security Implementation Phases

### Phase 1: Implement Now (Foundation)
These changes set up the structure without slowing development:

#### Database Schema Changes (Implement Now)
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

#### Basic Security Features (Implement Now)
1. **Role-based access control** - Simple userType check (admin vs customer)
2. **Customer data isolation** - Customers can only see their own data
3. **Basic password requirements** - 8+ characters minimum
4. **Session management** - Using NextAuth existing functionality
5. **HTTPS only** - Already in place
6. **Input validation** - Using Zod for API validation
7. **SQL injection prevention** - Prisma handles this
8. **XSS prevention** - React handles this by default
9. **Basic audit logging** - Track who does what
10. **Secure file storage** - Store uploads outside public directory

### Phase 2: Pre-MVP (Add Before Testing with Real Data)
Add these once core functionality works but before any real data:

1. **Enhanced authentication**:
   - Increase password complexity requirements (12+ chars, complexity rules)
   - Add account lockout after 5 failed attempts
   - Implement password history (prevent reuse of last 10)

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

### 1. Authentication & User Management
- Extend existing User model with `userType` field (admin/customer)
- Add `customerId` foreign key for customer users
- Create customer registration flow
- Implement role-based route protection
- Add customer-specific permission checks

### 2. Customer Portal Routes (/portal)
- `/portal/dashboard` - Overview of orders and account info
- `/portal/orders/new` - Create new order
- `/portal/orders/[id]` - View order details/status
- `/portal/orders` - List all orders with filtering
- `/portal/reports` - Download completed reports
- `/portal/account` - View/edit account settings

### 3. Order Creation Flow
1. **Subject Information**: Name and basic details
2. **Service Selection**: Choose services from customer's available list
3. **Location & Requirements**:
   - Select location per service
   - Dynamic form generation based on DSX requirements
   - Document upload with validation
4. **Review & Submit**: Summary with pricing (structure only)
5. **Save as Draft**: Allow incomplete orders to be saved

### 4. Dynamic Requirement Collection
- Query DSX requirements by service + location
- Generate forms dynamically from field definitions
- Handle document requirements with upload UI
- Validate file types/sizes (PDF, JPG, PNG - 5MB max)
- Show/hide locations based on service availability
- Grey out unavailable locations with tooltip explanations

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

### 7. API Structure
- RESTful endpoints under `/api/portal/`
- Separate middleware for customer authentication
- Basic rate limiting for customer endpoints
- Audit logging for all actions

#### API Endpoints
- `POST /api/portal/orders` - Create new order
- `GET /api/portal/orders` - List customer's orders
- `GET /api/portal/orders/[id]` - Get order details
- `PUT /api/portal/orders/[id]` - Update draft order
- `POST /api/portal/orders/[id]/submit` - Submit order
- `DELETE /api/portal/orders/[id]` - Delete draft order
- `POST /api/portal/documents/upload` - Upload document
- `GET /api/portal/requirements` - Get dynamic requirements
- `GET /api/portal/services/availability` - Check service availability

### 8. UI/UX Components
- Responsive design for mobile/tablet
- Progress indicator for multi-step forms
- Real-time validation feedback
- Loading states and error handling
- Accessible form controls

## Implementation Steps

### Immediate Actions (Week 1-2)
1. Create database migrations for new models
2. Set up OrderStatus configuration with initial statuses
3. Build basic customer user authentication
4. Create portal layout and navigation
5. Implement basic audit logging

### Core Features (Week 3-4)
6. Build order creation flow with dynamic forms
7. Implement service/location selection logic
8. Add document upload functionality
9. Create order listing and filtering
10. Implement draft saving

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