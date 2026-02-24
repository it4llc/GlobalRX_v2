# Observability Architecture
**Created:** February 23, 2026
**Status:** Design Complete - Implementation Required

## Current Observability Score: 2/10 ❌

### Critical Gaps Identified
- **No error tracking** - Application errors invisible in production
- **No performance monitoring** - Cannot detect performance regressions
- **No health monitoring** - Cannot detect service failures
- **No structured logging** - Debugging incidents extremely difficult
- **Security vulnerability** - Sensitive data exposed in console logs

## Target Observability Architecture

### The Three Pillars

#### 1. Metrics (Application Performance)
**What:** Quantitative measures of system performance and health

**Implementation:**
```typescript
// Custom metrics collection
interface ApplicationMetrics {
  http_requests_total: Counter;
  http_request_duration: Histogram;
  database_query_duration: Histogram;
  active_sessions: Gauge;
  error_rate: Gauge;
}

// Example usage in API routes
const startTime = Date.now();
try {
  const result = await businessLogic();
  metrics.http_requests_total.inc({ method: 'GET', status: '200' });
  return result;
} catch (error) {
  metrics.http_requests_total.inc({ method: 'GET', status: '500' });
  throw error;
} finally {
  const duration = Date.now() - startTime;
  metrics.http_request_duration.observe(duration);
}
```

#### 2. Logs (Events and Context)
**What:** Structured event data for debugging and auditing

**Current State:** 625 unstructured console statements
**Target State:** Structured JSON logs with proper context

```typescript
// Structured logging pattern
logger.info('Business event occurred', {
  event: 'customer_package_assigned',
  customerId: 'cust_123',
  packageId: 'pkg_456',
  assignedBy: 'user_789',
  duration: 150,
  success: true
});
```

#### 3. Traces (Request Flow)
**What:** End-to-end request tracking across services

**Implementation:**
```typescript
// Distributed tracing with OpenTelemetry
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('globalrx-api');

export async function createCustomer(data: CustomerData) {
  const span = tracer.startSpan('createCustomer');
  span.setAttributes({
    'customer.type': data.type,
    'operation': 'create'
  });

  try {
    const customer = await customerService.create(data);
    span.setStatus({ code: SpanStatusCode.OK });
    return customer;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message
    });
    throw error;
  } finally {
    span.end();
  }
}
```

## Monitoring Stack Architecture

### Recommended Technology Stack

#### Error Tracking: Sentry
```typescript
// sentry.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Filter out sensitive data
    if (event.user?.email) {
      delete event.user.email;
    }
    return event;
  }
});
```

#### Application Performance Monitoring: DataDog
```typescript
// dd-trace configuration
import tracer from 'dd-trace';

tracer.init({
  service: 'globalrx-api',
  version: process.env.APP_VERSION,
  env: process.env.NODE_ENV,
  profiling: true,
  runtimeMetrics: true
});
```

#### Structured Logging: Winston + ELK Stack
```typescript
// Winston configuration for ELK ingestion
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(info => {
      return JSON.stringify({
        '@timestamp': info.timestamp,
        level: info.level,
        message: info.message,
        service: 'globalrx',
        environment: process.env.NODE_ENV,
        ...info
      });
    })
  )
});
```

### Health Check Strategy

#### Multi-Level Health Checks

**Level 1: Liveness Check** (`/api/health`)
```typescript
// Basic service responsiveness
export async function GET() {
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
}
```

**Level 2: Readiness Check** (`/api/ready`)
```typescript
// Service ready to handle traffic
export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabase(),
    checkEnvironmentVariables(),
    checkExternalDependencies()
  ]);

  const allHealthy = checks.every(
    check => check.status === 'fulfilled'
  );

  return NextResponse.json(
    {
      status: allHealthy ? 'ready' : 'not-ready',
      checks: formatHealthChecks(checks),
      timestamp: new Date().toISOString()
    },
    { status: allHealthy ? 200 : 503 }
  );
}
```

**Level 3: Deep Health Check** (`/api/health/deep`)
```typescript
// Comprehensive system health
export async function GET() {
  const checks = await Promise.allSettled([
    checkDatabasePerformance(),
    checkMemoryUsage(),
    checkDiskSpace(),
    checkCacheHealth(),
    checkExternalAPIHealth()
  ]);

  return NextResponse.json({
    status: determineOverallHealth(checks),
    details: formatDetailedChecks(checks),
    metrics: await getSystemMetrics(),
    timestamp: new Date().toISOString()
  });
}
```

## Alert Strategy

### Alert Severity Levels

#### P0 - Critical (Immediate Response)
- API error rate > 10%
- Database connection failures
- Service completely down
- Security incidents

#### P1 - High (Response within 30 minutes)
- API error rate > 5%
- Response time > 5 seconds (p95)
- Memory usage > 90%
- Disk usage > 95%

#### P2 - Medium (Response within 2 hours)
- API error rate > 2%
- Response time > 2 seconds (p95)
- Memory usage > 80%
- Disk usage > 85%

#### P3 - Low (Response within 24 hours)
- Response time > 1 second (p95)
- Memory usage > 70%
- Warning-level errors increasing

### Alert Configurations

#### Sentry Alerts
```yaml
# .sentry/alerts.yml
rules:
  - name: "High Error Rate"
    conditions:
      - "event.type equals error"
      - "event count in 5 minutes > 10"
    actions:
      - "send email to oncall@company.com"
      - "send slack to #incidents"

  - name: "Performance Degradation"
    conditions:
      - "transaction duration p95 > 2000ms"
      - "over 10 minutes"
    actions:
      - "send slack to #performance"
```

#### DataDog Monitors
```yaml
# datadog-monitors.yml
monitors:
  - name: "API Response Time"
    type: "metric alert"
    query: "avg(last_10m):avg:globalrx.api.duration{*} > 2000"
    message: "API response time is elevated @oncall"

  - name: "Database Connection Pool"
    type: "metric alert"
    query: "avg(last_5m):avg:globalrx.db.connections{*} / avg:globalrx.db.max_connections{*} > 0.8"
    message: "Database connection pool is near capacity"
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Install and configure Sentry
- [ ] Create basic health check endpoints
- [ ] Set up Winston structured logging
- [ ] Remove sensitive data from console logs

### Phase 2: Metrics and Monitoring (Week 3-4)
- [ ] Install DataDog APM
- [ ] Instrument API routes with custom metrics
- [ ] Set up database performance monitoring
- [ ] Configure basic alerting rules

### Phase 3: Advanced Observability (Week 5-6)
- [ ] Implement distributed tracing
- [ ] Set up log aggregation and search
- [ ] Create monitoring dashboards
- [ ] Implement SLA monitoring

### Phase 4: Optimization (Week 7-8)
- [ ] Fine-tune alert thresholds
- [ ] Implement automated remediation
- [ ] Set up capacity planning metrics
- [ ] Create runbooks for common incidents

## Dashboard Design

### Executive Dashboard
**Audience:** Leadership, Product Managers
**Metrics:**
- Overall system health status
- User satisfaction metrics (Apdex score)
- Business metrics (orders processed, customers active)
- Incident count and resolution time

### Operations Dashboard
**Audience:** DevOps, Site Reliability Engineers
**Metrics:**
- Service uptime and availability
- Error rates by service and endpoint
- Response time percentiles (p50, p95, p99)
- Infrastructure metrics (CPU, memory, disk)

### Development Dashboard
**Audience:** Engineering Teams
**Metrics:**
- Deployment frequency and success rate
- Code coverage trends
- Performance regression detection
- Feature flag usage and error rates

## Security and Compliance

### Data Privacy in Observability
```typescript
// PII sanitization for logs and metrics
function sanitizeForLogging(data: any): any {
  const sensitiveFields = [
    'password', 'email', 'ssn', 'phone',
    'address', 'creditCard', 'token'
  ];

  return Object.keys(data).reduce((sanitized, key) => {
    if (sensitiveFields.includes(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof data[key] === 'object') {
      sanitized[key] = sanitizeForLogging(data[key]);
    } else {
      sanitized[key] = data[key];
    }
    return sanitized;
  }, {} as any);
}
```

### Audit Requirements
- All authentication attempts (success/failure)
- Permission changes and access grants
- Data modifications (create, update, delete)
- Administrative actions
- System configuration changes

### Retention Policies
- **Metrics**: 13 months (quarterly reporting)
- **Logs**: 90 days (compliance requirement)
- **Traces**: 7 days (debugging recent issues)
- **Alerts**: 2 years (trend analysis)

## Success Metrics

### Observability Maturity Goals

#### Month 1 Targets
- 100% error visibility (all errors captured)
- < 5 minute mean time to detection
- Health check coverage for all critical paths
- Zero sensitive data in logs

#### Month 3 Targets
- < 15 minute mean time to recovery
- Automated alerting with <5% false positives
- Performance regression detection
- Full request tracing implementation

#### Month 6 Targets
- < 10 minute mean time to recovery
- Predictive alerting for capacity issues
- Automated runbook execution
- Complete compliance audit trail

### ROI Measurement
- Reduced incident resolution time
- Decreased manual monitoring effort
- Improved customer satisfaction (uptime)
- Compliance audit readiness

## Cost Estimation

### Monthly Tool Costs (estimated)
- **Sentry**: $26/month (Team plan)
- **DataDog**: $15/host/month ($45 for 3 hosts)
- **Log aggregation**: $50/month (ELK on cloud)
- **Alert management**: $0 (built-in)
- **Total**: ~$121/month

### Implementation Cost
- **Engineering time**: 4 engineers × 2 weeks = 8 weeks
- **Opportunity cost**: Delayed features during implementation
- **Training**: Team education on new tools and processes

### Break-even Analysis
- **Cost to fix major incident without observability**: 40+ hours
- **Cost to fix with proper observability**: 4-8 hours
- **Break-even**: After 2-3 major incidents (typically 3-6 months)