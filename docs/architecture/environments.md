# Environment Management Architecture
**Created:** February 23, 2026
**Status:** Documentation and Strategy

## Current Environment State

### Environment Files Analysis
Located in project root:

| File | Purpose | Status |
|------|---------|---------|
| `.env` | Primary environment config | ✅ Active |
| `.env.local` | Local development overrides | ✅ Active |
| `.env.txt` | Environment template/reference | ⚠️ May contain examples |

### Environment Variable Categories

#### Database Configuration
```bash
# Primary database connection
DATABASE_URL="postgresql://user:password@localhost:5432/globalrx"

# Connection pooling
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=20
DATABASE_TIMEOUT=30000
```

#### Authentication & Security
```bash
# NextAuth configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-here"

# Session configuration
SESSION_TIMEOUT=3600
CSRF_SECRET="another-secret"
```

#### External Service Integration
```bash
# Background check APIs
BACKGROUND_CHECK_API_URL="https://api.backgroundcheck.com"
BACKGROUND_CHECK_API_KEY="your-api-key"

# Email service
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="noreply@globalrx.com"
SMTP_PASS="app-password"
```

#### Application Configuration
```bash
# Environment identifier
NODE_ENV="development"
APP_ENV="local"
APP_VERSION="1.0.0"

# Feature flags
ENABLE_DEBUG_ENDPOINTS="true"
ENABLE_AUDIT_LOGGING="true"
MAINTENANCE_MODE="false"
```

## Multi-Environment Strategy

### Environment Hierarchy

```
Production
├── Staging (production-like)
├── UAT (user acceptance testing)
├── Development (shared dev environment)
└── Local (individual developer machines)
```

### Environment-Specific Configurations

#### Production Environment
```bash
# .env.production
NODE_ENV=production
APP_ENV=production

# High-performance database settings
DATABASE_POOL_MIN=10
DATABASE_POOL_MAX=100
DATABASE_STATEMENT_TIMEOUT=60000

# Security settings
NEXTAUTH_URL=https://globalrx.com
NEXTAUTH_SECRET=${NEXTAUTH_SECRET_PROD}

# Monitoring and logging
ENABLE_DEBUG_ENDPOINTS=false
LOG_LEVEL=info
SENTRY_DSN=${SENTRY_DSN_PROD}

# Performance settings
REDIS_URL=${REDIS_URL_PROD}
CDN_URL=https://cdn.globalrx.com
```

#### Staging Environment
```bash
# .env.staging
NODE_ENV=production
APP_ENV=staging

# Production-like database with test data
DATABASE_URL=${DATABASE_URL_STAGING}
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=30

# Staging-specific auth
NEXTAUTH_URL=https://staging.globalrx.com
NEXTAUTH_SECRET=${NEXTAUTH_SECRET_STAGING}

# Debug features enabled for testing
ENABLE_DEBUG_ENDPOINTS=true
LOG_LEVEL=debug

# Test external services
BACKGROUND_CHECK_API_URL=https://sandbox.backgroundcheck.com
```

#### Development Environment
```bash
# .env.development
NODE_ENV=development
APP_ENV=development

# Shared development database
DATABASE_URL=${DATABASE_URL_DEV}
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Local auth settings
NEXTAUTH_URL=https://dev.globalrx.com
NEXTAUTH_SECRET=dev-secret-key

# Development features
ENABLE_DEBUG_ENDPOINTS=true
ENABLE_HOT_RELOAD=true
LOG_LEVEL=debug

# Mock external services
USE_MOCK_APIS=true
```

#### Local Development
```bash
# .env.local
NODE_ENV=development
APP_ENV=local

# Local database
DATABASE_URL=postgresql://localhost:5432/globalrx_local
DATABASE_POOL_MIN=1
DATABASE_POOL_MAX=5

# Local auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-development-secret

# Development features
ENABLE_DEBUG_ENDPOINTS=true
ENABLE_DATABASE_LOGGING=true
LOG_LEVEL=debug

# Local services
REDIS_URL=redis://localhost:6379
```

## Environment-Specific Database Management

### Database Naming Convention
```bash
# Production
globalrx_production

# Staging
globalrx_staging

# Development
globalrx_development

# Local development
globalrx_local_${DEVELOPER_NAME}
globalrx_test_${FEATURE_BRANCH}
```

### Migration Strategies by Environment

#### Production Migrations
```bash
#!/bin/bash
# scripts/migrate-production.sh

set -e

echo "🚀 Starting production migration..."

# 1. Create pre-migration backup
pg_dump $DATABASE_URL_PROD > "backups/pre_migration_$(date +%Y%m%d_%H%M%S).sql"

# 2. Run migration with safety checks
pnpm prisma migrate deploy --schema=prisma/schema.prisma

# 3. Verify migration success
pnpm prisma migrate status

# 4. Run post-migration health checks
curl -f https://globalrx.com/api/health/deep

echo "✅ Production migration completed successfully"
```

#### Staging Migrations
```bash
#!/bin/bash
# scripts/migrate-staging.sh

set -e

echo "🧪 Starting staging migration..."

# Copy production data for testing (weekly refresh)
if [ "$(date +%u)" -eq 1 ]; then  # Monday
    echo "📥 Refreshing staging data from production..."
    pg_dump $DATABASE_URL_PROD | psql $DATABASE_URL_STAGING
fi

# Run migration
pnpm prisma migrate deploy

# Run comprehensive tests
npm run test:integration

echo "✅ Staging migration and testing completed"
```

#### Development Environment Reset
```bash
#!/bin/bash
# scripts/reset-dev-environment.sh

echo "🔄 Resetting development environment..."

# 1. Reset database
pnpm prisma migrate reset --force

# 2. Seed with fresh data
pnpm prisma db seed

# 3. Clear cache
redis-cli FLUSHALL

echo "✅ Development environment reset completed"
```

## Configuration Management

### Environment Variable Validation

```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  // Environment identification
  NODE_ENV: z.enum(['development', 'production', 'test']),
  APP_ENV: z.enum(['local', 'development', 'staging', 'production']),

  // Database
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MIN: z.coerce.number().min(1).default(2),
  DATABASE_POOL_MAX: z.coerce.number().min(5).default(20),

  // Authentication
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),

  // Optional features
  ENABLE_DEBUG_ENDPOINTS: z.coerce.boolean().default(false),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // External services
  SENTRY_DSN: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
});

export type Environment = z.infer<typeof envSchema>;

export function validateEnvironment(): Environment {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    console.error('❌ Environment validation failed:');
    if (error instanceof z.ZodError) {
      error.errors.forEach(err => {
        console.error(`  ${err.path.join('.')}: ${err.message}`);
      });
    }
    process.exit(1);
  }
}

// Use throughout application
export const env = validateEnvironment();
```

### Feature Flag Management

```typescript
// lib/feature-flags.ts
export interface FeatureFlags {
  enableNewUserInterface: boolean;
  enableAdvancedReporting: boolean;
  enableExperimentalFeatures: boolean;
  enableMaintenanceMode: boolean;
}

export function getFeatureFlags(environment: string): FeatureFlags {
  switch (environment) {
    case 'production':
      return {
        enableNewUserInterface: true,
        enableAdvancedReporting: true,
        enableExperimentalFeatures: false,
        enableMaintenanceMode: false,
      };

    case 'staging':
      return {
        enableNewUserInterface: true,
        enableAdvancedReporting: true,
        enableExperimentalFeatures: true,
        enableMaintenanceMode: false,
      };

    case 'development':
      return {
        enableNewUserInterface: true,
        enableAdvancedReporting: true,
        enableExperimentalFeatures: true,
        enableMaintenanceMode: false,
      };

    case 'local':
      return {
        enableNewUserInterface: true,
        enableAdvancedReporting: true,
        enableExperimentalFeatures: true,
        enableMaintenanceMode: false,
      };

    default:
      throw new Error(`Unknown environment: ${environment}`);
  }
}

// Usage in components
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags(env.APP_ENV);
  return flags[flag];
}
```

## Security and Secrets Management

### Secret Categories

#### High Security (Production Only)
- Database credentials
- API keys for external services
- JWT signing secrets
- Encryption keys

#### Medium Security (Staging + Production)
- Email service credentials
- Third-party integration keys
- SSL certificates

#### Low Security (All Environments)
- Feature flags
- Non-sensitive configuration
- Public API endpoints

### Secrets Management Strategy

#### Option 1: Environment Variables (Current)
```bash
# Good for development, limited for production
export DATABASE_URL="postgresql://..."
export NEXTAUTH_SECRET="..."
```

#### Option 2: Docker Secrets
```yaml
# docker-compose.yml
services:
  app:
    image: globalrx:latest
    secrets:
      - database_url
      - nextauth_secret
    environment:
      - DATABASE_URL_FILE=/run/secrets/database_url

secrets:
  database_url:
    file: ./secrets/database_url.txt
  nextauth_secret:
    file: ./secrets/nextauth_secret.txt
```

#### Option 3: Cloud Provider Secrets (Recommended)
```typescript
// For AWS Secrets Manager
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretsManagerClient({ region: 'us-west-2' });

  try {
    const response = await client.send(new GetSecretValueCommand({
      SecretId: secretName,
    }));

    return response.SecretString!;
  } catch (error) {
    throw new Error(`Failed to retrieve secret ${secretName}: ${error}`);
  }
}

// Usage
const databaseUrl = await getSecret('globalrx/database-url');
```

## Environment-Specific Deployment

### Docker Configuration

#### Multi-stage Dockerfile
```dockerfile
# Dockerfile
FROM node:18-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS build
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM base AS production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY package*.json ./

EXPOSE 3000
CMD ["npm", "start"]
```

#### Environment-specific Docker Compose
```yaml
# docker-compose.production.yml
version: '3.8'
services:
  app:
    image: globalrx:production
    environment:
      - NODE_ENV=production
      - APP_ENV=production
    env_file:
      - .env.production
    deploy:
      replicas: 3
      restart_policy:
        condition: on-failure
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    deploy:
      replicas: 1
      restart_policy:
        condition: on-failure

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
```

### Kubernetes Deployment

#### Environment-specific configurations
```yaml
# k8s/production/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: globalrx-config
  namespace: production
data:
  NODE_ENV: production
  APP_ENV: production
  LOG_LEVEL: info
  ENABLE_DEBUG_ENDPOINTS: "false"

---
# k8s/production/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: globalrx-secrets
  namespace: production
type: Opaque
data:
  database-url: <base64-encoded-value>
  nextauth-secret: <base64-encoded-value>
  sentry-dsn: <base64-encoded-value>

---
# k8s/production/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: globalrx-app
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: globalrx
  template:
    metadata:
      labels:
        app: globalrx
    spec:
      containers:
      - name: app
        image: globalrx:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: globalrx-secrets
              key: database-url
        envFrom:
        - configMapRef:
            name: globalrx-config
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

## Environment Promotion Pipeline

### CI/CD Pipeline Structure
```yaml
# .github/workflows/deploy.yml
name: Deploy to Environment

on:
  push:
    branches: [main, staging, development]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test
      - run: npm run build

  deploy-development:
    needs: test
    if: github.ref == 'refs/heads/development'
    runs-on: ubuntu-latest
    environment: development
    steps:
      - name: Deploy to Development
        run: |
          kubectl apply -f k8s/development/
          kubectl rollout status deployment/globalrx-app -n development

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to Staging
        run: |
          kubectl apply -f k8s/staging/
          kubectl rollout status deployment/globalrx-app -n staging
      - name: Run Integration Tests
        run: npm run test:integration

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Production
        run: |
          kubectl apply -f k8s/production/
          kubectl rollout status deployment/globalrx-app -n production
      - name: Run Smoke Tests
        run: npm run test:smoke
```

## Monitoring and Observability by Environment

### Environment-specific Monitoring
```typescript
// lib/monitoring.ts
export function getMonitoringConfig(env: string) {
  switch (env) {
    case 'production':
      return {
        errorTracking: true,
        performanceMonitoring: true,
        logLevel: 'info',
        sampleRate: 0.1,
        alerting: {
          email: 'ops@globalrx.com',
          slack: '#alerts-production'
        }
      };

    case 'staging':
      return {
        errorTracking: true,
        performanceMonitoring: true,
        logLevel: 'debug',
        sampleRate: 0.5,
        alerting: {
          slack: '#alerts-staging'
        }
      };

    default:
      return {
        errorTracking: false,
        performanceMonitoring: false,
        logLevel: 'debug',
        sampleRate: 1.0,
        alerting: {}
      };
  }
}
```

## Best Practices and Guidelines

### Environment Configuration Checklist
- [ ] All environments have unique database instances
- [ ] Secrets are properly isolated between environments
- [ ] Feature flags are appropriately configured
- [ ] Monitoring and logging are environment-appropriate
- [ ] Backup strategies are defined for each environment
- [ ] Network security is properly configured
- [ ] Resource limits are set appropriately

### Security Guidelines
- **Never commit secrets** to version control
- **Use environment-specific secrets** - don't share between environments
- **Rotate secrets regularly** - especially for production
- **Audit secret access** - know who has access to what
- **Use least privilege principle** - only grant necessary permissions

### Troubleshooting Guide

#### Common Issues

**Problem**: Environment variables not loading
```bash
# Check if .env file exists and is readable
ls -la .env*

# Verify environment variable syntax
grep -n "^[^#]" .env | head -10

# Test specific variable
echo $DATABASE_URL
```

**Problem**: Database connection fails in specific environment
```bash
# Test database connectivity
pg_isready -h hostname -p port -d database

# Check connection string format
node -e "console.log(process.env.DATABASE_URL)"
```

**Problem**: Feature flags not working as expected
```typescript
// Debug feature flag resolution
console.log('Environment:', process.env.APP_ENV);
console.log('Feature flags:', getFeatureFlags(process.env.APP_ENV));
```

### Implementation Timeline

#### Week 1: Environment Standardization
- [ ] Create environment-specific configuration files
- [ ] Implement environment validation
- [ ] Set up development and staging databases

#### Week 2: Security and Secrets
- [ ] Migrate to secure secrets management
- [ ] Implement environment-specific security policies
- [ ] Set up monitoring and alerting

#### Week 3: CI/CD Pipeline
- [ ] Configure automated deployment pipeline
- [ ] Implement environment promotion process
- [ ] Set up automated testing

#### Week 4: Documentation and Training
- [ ] Complete environment documentation
- [ ] Train team on new processes
- [ ] Create troubleshooting guides