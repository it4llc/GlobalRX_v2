# GlobalRx Error Handling Standards
**Created:** February 23, 2026
**Status:** Current Assessment & Standards

## Current State Assessment

### API Routes Error Handling
- **Total API routes:** 51
- **Routes with try/catch:** ~50 (98% coverage)
- **Console.log/error statements:** 90 instances across 20 files
- **Error boundaries:** 0 (none found)
- **Global error handler:** Not implemented

### Error Handling Rating: ⭐⭐⭐☆☆ (3/5) - Needs Improvement

## Current Issues

### 1. Inconsistent Error Responses
- Some routes return `{ error: "message" }`
- Others return `{ message: "error" }`
- Status codes inconsistently applied
- No standard error format

### 2. Console Logging Issues
- 90+ console.log statements in production code
- Sensitive data potentially logged
- No structured logging system
- No log levels (debug, info, warn, error)

### 3. Missing Frontend Error Handling
- No error.tsx files found
- No global error boundaries
- Silent failures possible
- Poor user feedback on errors

### 4. Database Error Handling
- Most Prisma calls in try/catch ✅
- But generic error responses
- No specific handling for common Prisma errors
- Missing retry logic for transient failures

## Required Error Handling Pattern

### Standard API Error Response
```typescript
interface ApiErrorResponse {
  error: {
    code: string;           // Machine-readable error code
    message: string;        // User-friendly message
    details?: unknown;      // Additional error details (dev mode only)
    timestamp: string;      // ISO timestamp
    requestId?: string;     // For tracking
  };
}
```

### Standard Error Handler
```typescript
// lib/errors/api-error-handler.ts
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function handleApiError(error: unknown): NextResponse {
  // Log error for monitoring
  console.error('[API Error]', error);

  // Zod validation errors
  if (error instanceof ZodError) {
    return NextResponse.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: process.env.NODE_ENV === 'development' ? error.errors : undefined,
        timestamp: new Date().toISOString()
      }
    }, { status: 400 });
  }

  // Custom API errors
  if (error instanceof ApiError) {
    return NextResponse.json({
      error: {
        code: error.code,
        message: error.message,
        details: process.env.NODE_ENV === 'development' ? error.details : undefined,
        timestamp: new Date().toISOString()
      }
    }, { status: error.statusCode });
  }

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json({
        error: {
          code: 'DUPLICATE_ENTRY',
          message: 'A record with this value already exists',
          timestamp: new Date().toISOString()
        }
      }, { status: 409 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({
        error: {
          code: 'NOT_FOUND',
          message: 'Record not found',
          timestamp: new Date().toISOString()
        }
      }, { status: 404 });
    }
  }

  // Default error
  return NextResponse.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  }, { status: 500 });
}
```

### Frontend Error Boundary
```typescript
// app/error.tsx
'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to monitoring service
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Something went wrong!</h2>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Try again
      </button>
    </div>
  );
}
```

## Logging Strategy

### Replace Console.log with Logger
```typescript
// lib/logger.ts
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel = LogLevel.INFO;

  debug(message: string, data?: unknown) {
    if (this.level <= LogLevel.DEBUG) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }

  info(message: string, data?: unknown) {
    if (this.level <= LogLevel.INFO) {
      console.log(`[INFO] ${message}`, data);
    }
  }

  warn(message: string, data?: unknown) {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[WARN] ${message}`, data);
    }
  }

  error(message: string, error?: unknown) {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[ERROR] ${message}`, error);
    }
  }
}

export const logger = new Logger();
```

## Error Recovery Patterns

### Retry Logic for Transient Failures
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}
```

### Circuit Breaker Pattern
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailTime?: number;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime! > 60000) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await fn();
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED';
        this.failures = 0;
      }
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailTime = Date.now();
      if (this.failures >= 5) {
        this.state = 'OPEN';
      }
      throw error;
    }
  }
}
```

## Implementation Priority

### Phase 1: Immediate (Week 1)
1. Create standard error handler utility
2. Remove sensitive console.logs
3. Add error.tsx to main routes
4. Standardize API error responses

### Phase 2: Short Term (Week 2-3)
1. Replace console.log with logger
2. Add monitoring integration
3. Implement retry logic for critical operations
4. Add request ID tracking

### Phase 3: Long Term (Month 2)
1. Circuit breaker for external services
2. Error analytics dashboard
3. Automated error alerting
4. Performance monitoring

## Error Monitoring Integration

### Recommended Services
1. **Sentry** - Error tracking and performance
2. **DataDog** - APM and logging
3. **New Relic** - Full stack observability
4. **LogRocket** - Session replay with errors

### Sentry Integration Example
```typescript
// lib/monitoring.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  beforeSend(event, hint) {
    // Filter sensitive data
    return event;
  }
});

export function captureException(error: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(error, {
    extra: context
  });
}
```

## Testing Error Scenarios

### Required Test Cases
- Network failures
- Database connection errors
- Validation errors
- Permission denied
- Rate limiting
- Timeout scenarios
- Concurrent update conflicts

### Example Error Test
```typescript
describe('Error Handling', () => {
  it('should handle validation errors correctly', async () => {
    const response = await fetch('/api/customers', {
      method: 'POST',
      body: JSON.stringify({ invalid: 'data' })
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
```

## Current Action Items

### Critical
1. Remove 90+ console.log statements
2. Create standard error handler
3. Add error boundaries

### High Priority
1. Implement structured logging
2. Standardize error responses
3. Add Prisma error handling

### Medium Priority
1. Add monitoring service
2. Implement retry logic
3. Add request tracking