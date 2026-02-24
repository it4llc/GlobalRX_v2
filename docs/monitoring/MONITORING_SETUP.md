# Monitoring and Alerting Setup

## Overview

The GlobalRx application now includes comprehensive monitoring and alerting capabilities to ensure system reliability and quick incident response.

## Components

### 1. Error Tracking (Sentry)

Sentry has been integrated for automatic error tracking and performance monitoring.

**Configuration:**
- Set `NEXT_PUBLIC_SENTRY_DSN` in your environment variables
- Optionally set `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` for source map uploads
- Errors are automatically captured and sent to Sentry
- PII is automatically scrubbed from error reports

**Files:**
- `sentry.client.config.ts` - Client-side Sentry configuration
- `sentry.server.config.ts` - Server-side Sentry configuration
- `sentry.edge.config.ts` - Edge runtime Sentry configuration
- `src/app/global-error.tsx` - Global error boundary with Sentry integration

### 2. Health Check Endpoints

Three health check endpoints are available for monitoring:

#### `/api/health`
- **Purpose:** Basic health check for load balancers and uptime monitoring
- **Returns:** 200 if healthy, 503 if critical services are down
- **Checks:** Database connectivity, Sentry status
- **Use case:** Kubernetes liveness probe, uptime monitoring

#### `/api/ready`
- **Purpose:** Readiness check for container orchestration
- **Returns:** 200 if ready to serve traffic, 503 if not ready
- **Checks:** Database migrations, required environment variables
- **Use case:** Kubernetes readiness probe

#### `/api/status`
- **Purpose:** Detailed status information for debugging
- **Authentication:** Required (admin for full details)
- **Returns:** Comprehensive system status including memory, uptime, service health
- **Use case:** Admin dashboard, detailed troubleshooting

### 3. Alert System

A flexible alerting system that can send notifications through multiple channels:

**Alert Severities:**
- `critical` - System failures requiring immediate attention
- `warning` - Degraded performance or non-critical issues
- `info` - Important events for awareness

**Alert Channels:**
- **Sentry** - All alerts are sent to Sentry with appropriate severity
- **Winston Logs** - All alerts are logged for audit trail
- **Slack** - Critical alerts sent to Slack (if configured)
- **Email** - Critical alerts sent via email (if configured)
- **PagerDuty** - Critical alerts create incidents (if configured)

**Usage:**
```typescript
import { alertManager } from "@/lib/monitoring";

// Send a critical alert
await alertManager.criticalAlert(
  "Database Connection Lost",
  "Unable to connect to primary database",
  error,
  { database: "primary", timestamp: new Date() }
);

// Send a warning alert
await alertManager.warningAlert(
  "High Memory Usage",
  "Memory usage exceeded 90%",
  { usage: "92%", threshold: "90%" }
);
```

### 4. Monitoring Middleware

Automatic monitoring for all requests with:
- Response time tracking
- Error rate monitoring
- Slow request detection
- Automatic alerting on high error rates

**Features:**
- Tracks metrics in 1-minute windows
- Alerts on >10% error rate
- Alerts on requests >5 seconds
- Automatic server error alerting

## Configuration

### Required Environment Variables

```env
# Sentry (Required for error tracking)
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_DSN=your-sentry-dsn

# Optional Sentry Configuration
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
SENTRY_AUTH_TOKEN=your-auth-token
```

### Optional Alert Channels

```env
# Slack Integration
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Email Alerts
ALERT_EMAIL=alerts@yourcompany.com

# PagerDuty Integration
PAGERDUTY_ROUTING_KEY=your-routing-key

# Application Version
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## Setting Up Sentry

1. Create a Sentry account at https://sentry.io
2. Create a new project (select Next.js)
3. Copy the DSN from the project settings
4. Add the DSN to your environment variables
5. (Optional) Set up source maps upload for better error context

## Setting Up Slack Alerts

1. Go to your Slack workspace settings
2. Create a new webhook app or use existing
3. Select the channel for alerts
4. Copy the webhook URL
5. Add `SLACK_WEBHOOK_URL` to your environment

## Setting Up PagerDuty

1. Create a PagerDuty service
2. Add an Events API v2 integration
3. Copy the routing key
4. Add `PAGERDUTY_ROUTING_KEY` to your environment

## Monitoring Best Practices

### 1. Use Appropriate Alert Levels
- **Critical:** Database down, authentication failure, payment processing errors
- **Warning:** High memory usage, slow queries, degraded performance
- **Info:** New deployments, configuration changes, successful migrations

### 2. Include Context in Alerts
Always include relevant context to help with troubleshooting:
```typescript
await alertManager.criticalAlert(
  "Order Processing Failed",
  "Failed to process order due to payment gateway error",
  error,
  {
    orderId: order.id,
    customerId: customer.id,
    amount: order.total,
    gateway: "stripe",
    errorCode: error.code
  }
);
```

### 3. Monitor Critical Business Operations
Wrap critical operations with monitoring:
```typescript
import { monitorCriticalOperation } from "@/lib/monitoring";

const result = await monitorCriticalOperation(
  "ProcessPayment",
  async () => await stripeClient.charges.create(chargeData),
  { orderId, amount, currency }
);
```

### 4. Regular Health Checks
The system automatically performs health checks every 5 minutes. Monitor these in your logging system.

## Testing Monitoring

### Test Health Endpoints
```bash
# Test health check
curl http://localhost:3000/api/health

# Test readiness
curl http://localhost:3000/api/ready

# Test status (requires authentication)
curl http://localhost:3000/api/status -H "Cookie: your-session-cookie"
```

### Test Sentry Integration
```javascript
// Add to any API route to test
throw new Error("Test Sentry integration");
```

### Test Alerts
```typescript
// Add to any API route
import { alertManager } from "@/lib/monitoring";

await alertManager.criticalAlert(
  "Test Alert",
  "This is a test of the alert system",
  new Error("Test error"),
  { test: true, timestamp: new Date() }
);
```

## Troubleshooting

### Sentry Not Receiving Errors
1. Check `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Verify Sentry is enabled in development: `SENTRY_ENABLED=true`
3. Check browser console for Sentry initialization errors
4. Verify network connectivity to Sentry

### Health Checks Failing
1. Check database connectivity
2. Verify all required environment variables are set
3. Check migrations have been run
4. Review logs for specific error messages

### Alerts Not Being Sent
1. Verify webhook URLs are correct
2. Check network connectivity to external services
3. Review Winston logs for alert errors
4. Test webhooks manually with curl

## Next Steps

1. **Set up dashboards** in your monitoring service (DataDog, New Relic, etc.)
2. **Configure alert rules** based on your SLAs
3. **Set up log aggregation** (ELK stack, CloudWatch, etc.)
4. **Implement custom metrics** for business KPIs
5. **Create runbooks** for common alert scenarios