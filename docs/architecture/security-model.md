# GlobalRx Security Architecture
**Created:** February 23, 2026
**Status:** Current State Documentation

## Authentication System

### Current Implementation
- **Framework:** NextAuth.js v4.24.6
- **Session Storage:** JWT-based sessions
- **Password Hashing:** bcryptjs
- **MFA Support:** Database fields exist but not implemented

### Authentication Flow

#### User Authentication
```
1. User submits credentials to /api/auth/signin
2. NextAuth validates against database
3. JWT session created with user permissions
4. Session validated on each request via getServerSession()
```

#### Candidate Authentication (Phase 5 Stage 1)
```
1. Candidate receives invitation email with secure token
2. Candidate visits /portal/candidate/[token] landing page
3. Token is validated against CandidateInvitation table
4. Candidate creates password via /api/candidate/auth/create-password
5. Password is hashed using bcryptjs (same as user passwords)
6. Invitation status updated to "accessed", lastAccessedAt timestamp set
```

**Security Properties of Candidate Authentication:**
- Token-based access: No session required for initial access
- Token validation: Checks expiration and invitation status
- Password requirements: Minimum 8 characters, 1 letter, 1 number
- One-time password creation: Cannot overwrite existing password
- Automatic expiration handling: Invalid tokens rejected
- Event logging: All password creation events are logged

## Authorization Model

### Permission Structure
The system supports three permission formats:

#### 1. Array-Based Permissions
```json
{
  "customers": ["*"],
  "services": ["view", "edit"]
}
```

#### 2. Object-Based Permissions
```json
{
  "customers": {
    "view": true,
    "edit": true,
    "delete": false
  }
}
```

#### 3. Boolean Flags
```json
{
  "admin": true
}
```

### Permission Checking
- Centralized utility: `src/lib/permission-utils.ts`
- Helper function: `hasPermission(user, resource, action)`
- Handles all three permission formats

## Current Security Gaps

### Critical Issues
1. **Missing Authentication:**
   - `/api/dsx/route.ts` GET endpoint - No auth check
   - `/api/debug-session/route.ts` - Debug endpoint exposed

2. **Intentionally Unauthenticated Endpoints (by design):**
   - `/api/candidate/invitations/enhanced/[token]` - Token-based access for candidates
   - `/api/candidate/auth/create-password` - Token-based password creation

   *Note: These endpoints are secure because they use token validation instead of session authentication*

3. **Development Mode Bypasses:**
   - Multiple routes skip auth when NODE_ENV=development
   - Risk if environment misconfigured in production

4. **No Rate Limiting:**
   - No rate limiting on any endpoints
   - Vulnerable to brute force attacks
   - No DDoS protection

### Medium Priority Issues
1. **Inconsistent Permission Checks:**
   - Some routes use direct object notation
   - Others use utility functions
   - Risk of implementation errors

2. **Data Exposure:**
   - Console.log statements with sensitive data
   - Debug endpoints expose internal structure
   - Over-fetching in some API responses

3. **Input Validation Gaps:**
   - Not all routes validate input
   - Some routes missing Zod schemas
   - SQL injection risk through unvalidated queries

## Security Controls by Module

### User Admin Module
- ✅ Password hashing
- ✅ Permission-based access
- ⚠️ Weak permission validation
- ❌ No password complexity requirements
- ❌ No account lockout policy

### Customer Configurations
- ✅ Authentication required
- ✅ Input validation with Zod
- ⚠️ Overly permissive deduplication endpoint
- ❌ No audit logging

### Portal/Orders
- ✅ Strong authentication
- ✅ Comprehensive validation
- ✅ Status transition controls
- ❌ No rate limiting on submissions

### Global Configurations
- ✅ Admin-only access
- ⚠️ Development mode bypasses
- ❌ Missing auth on some DSX endpoints

## Environment Security

### Environment Variables
```
DATABASE_URL      - PostgreSQL connection string
NEXTAUTH_SECRET   - Session encryption key
NEXTAUTH_URL      - Application URL
NODE_ENV          - Environment mode
```

### Current Status
- ✅ .env files properly gitignored
- ⚠️ No .env.example file for documentation
- ❌ No secret rotation policy
- ❌ No encrypted secret storage

## Data Protection

### At Rest
- Database: PostgreSQL (encryption depends on hosting)
- Files: No file upload encryption mentioned
- Backups: No backup encryption strategy

### In Transit
- HTTPS enforced (assumed, needs verification)
- API communication: JWT tokens in headers
- No additional transport encryption

### PII Handling
- Background check data stored
- No data classification system
- No field-level encryption
- Data retention: Configurable per customer

## Security Headers

### Currently Missing
- Content Security Policy (CSP)
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
- X-XSS-Protection

## Audit and Compliance

### Current State
- ❌ No audit logging system
- ❌ No security event monitoring
- ❌ No compliance tracking (GDPR, etc.)
- ❌ No security testing in CI/CD

### Required for Enterprise
1. Comprehensive audit logging
2. Security event monitoring
3. Regular security assessments
4. Compliance reporting
5. Incident response procedures

## Recommended Security Architecture

### Phase 1: Immediate Fixes (Week 1)
1. Fix missing authentication on DSX endpoint
2. Remove/secure debug endpoints
3. Standardize permission checking
4. Remove sensitive console.logs

### Phase 2: Core Security (Weeks 2-3)
1. Implement rate limiting
2. Add security headers
3. Set up audit logging
4. Add input validation to all routes

### Phase 3: Enterprise Security (Month 2)
1. Implement MFA
2. Add API versioning
3. Set up security monitoring
4. Implement secret rotation

### Phase 4: Compliance (Month 3)
1. Data classification system
2. Field-level encryption for PII
3. Compliance reporting
4. Security testing automation

## Security Testing Requirements

### Unit Tests Needed
- Permission utility functions
- Authentication flows
- Input validation schemas

### Integration Tests Needed
- Authentication endpoints
- Authorization checks
- Session management

### Security Tests Needed
- SQL injection attempts
- XSS prevention
- CSRF protection
- Rate limiting effectiveness

## Risk Assessment

### Current Risk Level: **HIGH**

**Critical Risks:**
1. Unauthenticated endpoint exposure
2. No rate limiting
3. Debug information leakage
4. No audit trail

**Business Impact:**
- Data breach potential
- Compliance violations
- Reputation damage
- Legal liability

**Recommended Priority:**
Fix critical authentication gaps immediately before any other development work.