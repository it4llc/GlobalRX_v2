# Logging Standards
**Created:** February 23, 2026
**Status:** Must Implement

## Current State: Security Risk

### Critical Issues Found
- **625 total console statements** across 140 files
- **118 console.log statements** in TypeScript files
- **146 console.error/warn statements** in TypeScript files
- **361 console statements** in React components
- **Sensitive data logged** in 32+ locations

### Files Requiring Immediate Attention

#### Critical Security Issues (Passwords/Credentials)
- `src/lib/auth.ts:25` - "Missing email or password"
- `src/lib/auth.ts:40` - User email logged on authentication failure
- `src/lib/auth.ts:46` - User email logged for locked accounts
- `src/lib/auth.ts:53` - User email logged for invalid passwords
- `src/app/api/users/route.ts:81` - "Email already in use" logging

#### Permission Data Exposure
- `src/middleware/api-auth.ts:50` - Permission denied with user email
- `src/app/api/customers/[id]/packages/route.ts:46` - User email logged
- `src/app/customer-configs/workflows/page.tsx:44` - Permission check details

## New Logging Standards

### 1. Structured Logging Format

#### Use Winston Logger
```typescript
import logger from '@/lib/logger';

// Good: Structured with context
logger.info('User authentication attempt', {
  event: 'auth_attempt',
  ip: req.ip,
  userAgent: req.headers['user-agent'],
  // NEVER log email, password, or tokens
});
```

#### Log Levels
- **ERROR**: System failures, exceptions, critical issues
- **WARN**: Recoverable errors, deprecated features
- **INFO**: Normal business events, user actions
- **DEBUG**: Detailed flow information (development only)

### 2. Security Requirements

#### Never Log These Items
```typescript
// ❌ FORBIDDEN - Security violations
console.log(`User ${email} failed login`);
console.log(`Password: ${password}`);
console.log(`Session: ${session}`);
console.log(`API Key: ${apiKey}`);
logger.info('User data', { user: fullUserObject });
```

#### Safe Logging Patterns
```typescript
// ✅ SAFE - Event-based logging
logger.warn('Authentication failed', {
  event: 'auth_failure',
  reason: 'invalid_credentials',
  ip: req.ip,
  timestamp: Date.now()
});

logger.info('User action completed', {
  event: 'customer_created',
  userId: user.id, // ID only, not email
  action: 'create',
  resource: 'customer'
});
```

### 3. Event-Based Logging Categories

#### Authentication Events
```typescript
// Login attempts
logger.info('User login attempt', {
  event: 'login_attempt',
  ip: request.ip,
  userAgent: request.headers['user-agent']
});

// Login success
logger.info('User authenticated', {
  event: 'login_success',
  userId: user.id,
  sessionId: hashSessionId(sessionId)
});

// Login failure
logger.warn('Authentication failed', {
  event: 'login_failure',
  reason: 'invalid_credentials',
  ip: request.ip
});
```

#### API Access Events
```typescript
// Permission checks
logger.warn('Access denied', {
  event: 'permission_denied',
  userId: session.user.id,
  resource: 'customers',
  action: 'edit',
  endpoint: req.url
});

// Successful operations
logger.info('Resource accessed', {
  event: 'resource_access',
  userId: session.user.id,
  resource: 'customer',
  action: 'view',
  resourceId: customerId
});
```

#### Business Logic Events
```typescript
// Customer operations
logger.info('Customer created', {
  event: 'customer_created',
  customerId: customer.id,
  createdBy: session.user.id,
  customerType: customer.type
});

// Order processing
logger.info('Order processed', {
  event: 'order_processed',
  orderId: order.id,
  customerId: order.customerId,
  status: order.status,
  processingTime: endTime - startTime
});
```

#### Error Events
```typescript
// Database errors
logger.error('Database operation failed', {
  event: 'database_error',
  operation: 'customer_create',
  error: error.message,
  stack: error.stack,
  userId: session?.user?.id
});

// External API errors
logger.error('External service error', {
  event: 'external_api_error',
  service: 'background_check_api',
  statusCode: response.status,
  orderId: order.id
});
```

### 4. Context Enrichment

#### Standard Context Fields
Every log entry should include:
```typescript
{
  timestamp: string,    // ISO 8601 format
  level: string,        // ERROR, WARN, INFO, DEBUG
  service: 'globalrx',  // Service name
  version: string,      // App version
  environment: string,  // dev, staging, production
  userId?: string,      // If authenticated
  sessionId?: string,   // Hashed session ID
  requestId?: string,   // Unique request identifier
  ip?: string,          // Client IP
  userAgent?: string    // Client user agent
}
```

#### Request Middleware
```typescript
// Add to API middleware
export function withLogging(handler: NextApiHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // Add request context
    req.requestId = requestId;

    logger.info('API request started', {
      event: 'api_request_start',
      requestId,
      method: req.method,
      url: req.url,
      ip: req.ip
    });

    try {
      await handler(req, res);
    } catch (error) {
      logger.error('API request failed', {
        event: 'api_request_error',
        requestId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    } finally {
      logger.info('API request completed', {
        event: 'api_request_complete',
        requestId,
        duration: Date.now() - startTime,
        statusCode: res.statusCode
      });
    }
  };
}
```

## Migration Plan

### Week 1: Critical Security Fixes
Replace all sensitive data logging:

#### File: `src/lib/auth.ts`
```typescript
// Before (lines 25, 40, 46, 53)
console.log('Missing email or password');
console.log(`No user found with email: ${credentials.email}`);
console.log(`Account locked for user: ${credentials.email}`);
console.log(`Invalid password for user: ${credentials.email}`);

// After
logger.warn('Authentication validation failed', {
  event: 'auth_validation_error',
  reason: 'missing_credentials'
});
logger.warn('Authentication failed', {
  event: 'auth_failure',
  reason: 'user_not_found'
});
logger.warn('Authentication blocked', {
  event: 'auth_blocked',
  reason: 'account_locked'
});
logger.warn('Authentication failed', {
  event: 'auth_failure',
  reason: 'invalid_password'
});
```

### Week 2: Permission Logging
#### File: `src/middleware/api-auth.ts`
```typescript
// Before (line 50)
console.log(`Permission denied: ${resource}.${action} for user ${session.user.email}`);

// After
logger.warn('Permission denied', {
  event: 'permission_denied',
  userId: session.user.id,
  resource,
  action,
  endpoint: req.url
});
```

### Week 3: Frontend Console Cleanup
Remove debugging console statements from React components:
- 56 files with console statements
- Replace with proper error boundaries
- Use React DevTools for development debugging

### Week 4: API Route Standardization
Implement consistent logging across all 75+ API routes:
- Request/response logging
- Error handling with proper context
- Performance timing

## Monitoring and Compliance

### Log Retention Policy
- **Production**: 30 days
- **Staging**: 7 days
- **Development**: 24 hours

### Security Audit Trail
Required events to log:
- Authentication attempts (success/failure)
- Permission changes
- Data access (customer records, orders)
- Administrative actions
- Configuration changes
- Failed authorization attempts

### GDPR Compliance
- No PII in logs (emails, names, addresses)
- Use hashed identifiers where possible
- Automatic log purging after retention period
- Right to erasure compliance

## Tools and Configuration

### Winston Configuration
```typescript
// Production config
const productionConfig = {
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
};
```

### Development Configuration
```typescript
// Development config
const developmentConfig = {
  level: 'debug',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level}]: ${message} ${
        Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
      }`;
    })
  ),
  transports: [
    new winston.transports.Console()
  ]
};
```

## Success Criteria

### Completion Checklist
- [ ] All 625 console statements reviewed
- [ ] Zero sensitive data in logs
- [ ] Winston logger implemented
- [ ] All API routes use structured logging
- [ ] Log rotation configured
- [ ] Retention policies implemented
- [ ] Security audit trail complete

### Performance Targets
- Log processing overhead < 5ms per request
- Log file rotation without service interruption
- Searchable structured logs in monitoring system