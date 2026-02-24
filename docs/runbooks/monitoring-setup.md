# Production Monitoring Setup Guide
**Created:** February 23, 2026
**Status:** Implementation Required

## Current State Assessment

### Critical Monitoring Gaps
- **No error tracking service** (Sentry, Rollbar, etc.)
- **No application performance monitoring** (APM)
- **No health check endpoints**
- **No structured logging system**
- **625 console statements** with sensitive data exposure

### Security Risks
- User emails logged in `/middleware/api-auth.ts:50`
- Passwords logged in `/lib/auth.ts:25,40,46,53`
- Permission details logged in 32+ locations
- Development bypasses logged to console

## Implementation Plan

### Phase 1: Error Tracking (Week 1)

#### Install Sentry
```bash
pnpm add @sentry/nextjs
```

#### Configure Sentry
1. Create `sentry.client.config.js`:
```javascript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

2. Create `sentry.server.config.js`:
```javascript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
});
```

#### Environment Variables
Add to `.env`:
```bash
SENTRY_DSN=your_sentry_dsn_here
SENTRY_ORG=your_org
SENTRY_PROJECT=globalrx
```

### Phase 2: Health Check Endpoints (Week 1)

#### Create Health Check API
Create `/src/app/api/health/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ];

    const missingVars = requiredEnvVars.filter(
      varName => !process.env[varName]
    );

    if (missingVars.length > 0) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          error: 'Missing environment variables',
          missing: missingVars
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        error: 'Database connection failed',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
```

#### Create Readiness Check
Create `/src/app/api/ready/route.ts`:
```typescript
import { NextResponse } from 'next/server';

export async function GET() {
  // Basic readiness check
  return NextResponse.json({
    status: 'ready',
    timestamp: new Date().toISOString()
  });
}
```

### Phase 3: Structured Logging (Week 2)

#### Install Winston
```bash
pnpm add winston winston-daily-rotate-file
```

#### Create Logger Utility
Create `/src/lib/logger.ts`:
```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'globalrx' },
  transports: [
    // Console for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // Rotating files for production
    new DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

export default logger;
```

### Phase 4: Replace Console Statements (Week 2-3)

#### Priority Files to Fix (32 files with sensitive data):
1. `/lib/auth.ts` - Remove password logging (lines 25,40,46,53)
2. `/middleware/api-auth.ts` - Remove permission logging (line 50)
3. `/app/api/customers/route.ts` - Remove email logging (lines 55,46)
4. `/app/api/users/route.ts` - Remove email collision logging (line 81)

#### Replacement Pattern:
```typescript
// Before (DANGEROUS)
console.log(`No user found with email: ${credentials.email}`);

// After (SAFE)
logger.warn('Authentication failed', {
  event: 'auth_failure',
  reason: 'user_not_found',
  // DO NOT LOG EMAIL
});
```

### Phase 5: Application Performance Monitoring (Week 3-4)

#### Option A: New Relic
```bash
pnpm add newrelic
```

#### Option B: DataDog (Recommended)
```bash
pnpm add dd-trace
```

## Monitoring Alerts

### Critical Alerts
- API response time > 5 seconds
- Error rate > 5%
- Database connection failures
- Health check failures

### Warning Alerts
- API response time > 2 seconds
- Memory usage > 80%
- CPU usage > 70%
- Disk usage > 85%

## Deployment Checklist

### Before Production Deploy
- [ ] All 625 console statements reviewed and sanitized
- [ ] Sentry configured and tested
- [ ] Health checks returning 200
- [ ] Log rotation configured
- [ ] Alerts configured in monitoring service
- [ ] Debug endpoint removed (`/api/debug-session`)

### Environment Variables Required
```bash
SENTRY_DSN=
SENTRY_ORG=
SENTRY_PROJECT=
LOG_LEVEL=info
NODE_ENV=production
```

## Security Considerations

### Data Sanitization
- Never log passwords, tokens, or session data
- Hash or redact PII before logging
- Use structured logging for searchability
- Set appropriate log retention policies

### Monitoring Access
- Restrict access to monitoring dashboards
- Use read-only API keys where possible
- Audit monitoring system access regularly

## Estimated Implementation Time
- **Phase 1-2**: 1 week (Error tracking + Health checks)
- **Phase 3-4**: 2 weeks (Structured logging + Console cleanup)
- **Phase 5**: 1 week (APM setup)
- **Total**: 4 weeks

## Success Metrics
- Zero sensitive data in logs
- 99.9% uptime monitoring coverage
- < 30 second mean time to detection
- All API routes instrumented with proper logging