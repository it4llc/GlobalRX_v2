# GlobalRx Security Checklist
**Created:** February 23, 2026
**Purpose:** Security requirements for all API routes and features

## API Route Security Checklist

### For Every API Route

#### Authentication & Authorization
- [ ] Implement `getServerSession(authOptions)` check
- [ ] Return 401 if no session exists
- [ ] Check specific permissions using `hasPermission()` utility
- [ ] Return 403 for insufficient permissions
- [ ] Never bypass auth checks in production

#### Input Validation
- [ ] Define Zod schema for all request body parameters
- [ ] Validate request body before processing
- [ ] Sanitize string inputs to prevent injection
- [ ] Validate UUID formats for ID parameters
- [ ] Check array lengths and object sizes

#### Error Handling
- [ ] Wrap route logic in try/catch block
- [ ] Return appropriate HTTP status codes
- [ ] Don't expose internal error details
- [ ] Log errors for monitoring
- [ ] Handle Prisma-specific errors

#### Data Protection
- [ ] Never return password hashes
- [ ] Filter sensitive fields from responses
- [ ] Use selective Prisma includes/selects
- [ ] Implement field-level permissions where needed
- [ ] Remove console.log statements

#### Performance & Limits
- [ ] Implement pagination for list endpoints
- [ ] Add request size limits
- [ ] Consider caching for expensive queries
- [ ] Avoid N+1 database queries
- [ ] Set appropriate timeouts

### Example Secure Route Template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hasPermission } from '@/lib/permission-utils';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Define validation schema
const requestSchema = z.object({
  field1: z.string().min(1).max(255),
  field2: z.number().int().positive(),
  field3: z.string().uuid().optional()
});

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check authorization
    if (!hasPermission(session.user, 'resource', 'create')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // 3. Validate input
    const body = await request.json();
    const validatedData = requestSchema.parse(body);

    // 4. Process request with error handling
    const result = await prisma.$transaction(async (tx) => {
      // Your business logic here
      return await tx.model.create({
        data: validatedData,
        select: {
          // Only return necessary fields
          id: true,
          field1: true,
          field2: true,
          // Exclude sensitive fields
          // password: false,
        }
      });
    });

    // 5. Return sanitized response
    return NextResponse.json(result, { status: 201 });

  } catch (error) {
    // 6. Handle errors appropriately
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      );
    }

    // Log error for monitoring (not to client)
    console.error('API Error:', error);

    // Generic error response
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

## Frontend Security Checklist

### Component Security
- [ ] Validate user input on client side
- [ ] Sanitize HTML content to prevent XSS
- [ ] Use HTTPS for all API calls
- [ ] Store tokens securely (httpOnly cookies)
- [ ] Implement CSRF protection

### Permission-Based Rendering
- [ ] Check permissions before showing UI elements
- [ ] Disable buttons for unauthorized actions
- [ ] Hide navigation items based on role
- [ ] Never rely only on frontend checks
- [ ] Always validate on backend

## Database Security Checklist

### Query Security
- [ ] Use parameterized queries (Prisma does this)
- [ ] Avoid raw SQL unless absolutely necessary
- [ ] Validate all dynamic query parameters
- [ ] Limit query result sizes
- [ ] Use transactions for multi-step operations

### Data Access
- [ ] Implement row-level security where needed
- [ ] Use selective includes/selects
- [ ] Avoid fetching entire tables
- [ ] Index frequently queried fields
- [ ] Monitor slow queries

## Authentication Security Checklist

### Password Requirements
- [ ] Minimum 8 characters
- [ ] Require complexity (upper, lower, number, special)
- [ ] Check against common passwords
- [ ] Hash with bcrypt (cost factor 10+)
- [ ] Never store plain text passwords

### Session Management
- [ ] Set appropriate session timeout
- [ ] Regenerate session on privilege change
- [ ] Invalidate sessions on logout
- [ ] Secure session cookies (httpOnly, secure, sameSite)
- [ ] Monitor concurrent sessions

### Account Security
- [ ] Implement account lockout after failed attempts
- [ ] Rate limit login attempts
- [ ] Email verification for new accounts
- [ ] Password reset with secure tokens
- [ ] Two-factor authentication option

## Deployment Security Checklist

### Environment Configuration
- [ ] Use environment variables for secrets
- [ ] Different secrets per environment
- [ ] Rotate secrets regularly
- [ ] Never commit secrets to repository
- [ ] Use secret management service

### Infrastructure Security
- [ ] Enable HTTPS everywhere
- [ ] Set security headers
- [ ] Configure CORS properly
- [ ] Implement rate limiting
- [ ] Set up monitoring/alerting

### Monitoring & Logging
- [ ] Log authentication events
- [ ] Log authorization failures
- [ ] Monitor API usage patterns
- [ ] Alert on suspicious activity
- [ ] Regular security audits

## Security Testing Checklist

### Manual Testing
- [ ] Test with different user roles
- [ ] Try accessing resources without auth
- [ ] Attempt SQL injection
- [ ] Test XSS vulnerabilities
- [ ] Check for information disclosure

### Automated Testing
- [ ] Unit tests for auth functions
- [ ] Integration tests for permissions
- [ ] API security test suite
- [ ] Dependency vulnerability scanning
- [ ] Static code analysis

## Incident Response Checklist

### Preparation
- [ ] Incident response plan documented
- [ ] Security contacts identified
- [ ] Backup and recovery procedures
- [ ] Communication plan ready
- [ ] Legal/compliance requirements known

### During Incident
- [ ] Isolate affected systems
- [ ] Preserve evidence
- [ ] Notify stakeholders
- [ ] Document timeline
- [ ] Implement fixes

### Post-Incident
- [ ] Root cause analysis
- [ ] Update security measures
- [ ] Review and update procedures
- [ ] Security training if needed
- [ ] Compliance reporting

## Compliance Checklist

### Data Privacy (GDPR/CCPA)
- [ ] Privacy policy updated
- [ ] Data processing agreements
- [ ] Right to deletion implemented
- [ ] Data export functionality
- [ ] Consent management

### Industry Standards
- [ ] PCI DSS if handling payments
- [ ] HIPAA if health data
- [ ] SOC 2 compliance
- [ ] ISO 27001 alignment
- [ ] Regular audits

## Priority Actions for GlobalRx

### Immediate (This Week)
1. Fix unauthenticated DSX endpoint
2. Remove debug-session endpoint
3. Standardize permission checking
4. Remove sensitive console.logs

### Short Term (This Month)
1. Implement rate limiting
2. Add input validation to all routes
3. Set up audit logging
4. Add security headers

### Long Term (Quarter)
1. Implement MFA
2. Field-level encryption
3. Security monitoring system
4. Compliance automation
5. Regular penetration testing