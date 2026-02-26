# Railway Deployment Guide for GlobalRx

This guide walks you through deploying the GlobalRx platform to Railway for both staging and production environments.

## Prerequisites

1. **Railway Account**: Ensure you have a Railway account at [railway.app](https://railway.app)
2. **Railway CLI**: Install and authenticate the Railway CLI
3. **Environment Setup**: Complete local development setup

## Authentication Setup

First, authenticate with Railway:

```bash
railway login
```

This will open your browser for authentication.

## Staging Environment Setup

### 1. Create Staging Project

```bash
# Create new Railway project for staging
railway new --name globalrx-staging

# Link to the staging project
railway link --project globalrx-staging
```

### 2. Add PostgreSQL Database

```bash
# Add PostgreSQL service to staging
railway add postgresql
```

### 3. Configure Staging Environment Variables

Set the following environment variables in the Railway dashboard or via CLI:

```bash
# Required variables
railway variables set NEXTAUTH_SECRET="your-super-secure-secret-for-staging"
railway variables set NEXTAUTH_URL="https://globalrx-staging.up.railway.app"
railway variables set NODE_ENV="production"
railway variables set NEXT_TELEMETRY_DISABLED="1"
railway variables set NEXT_PUBLIC_APP_VERSION="1.0.0-staging"

# Optional: Sentry configuration
railway variables set NEXT_PUBLIC_SENTRY_DSN="your-staging-sentry-dsn"
railway variables set SENTRY_DSN="your-staging-sentry-dsn"
railway variables set SENTRY_ORG="your-org"
railway variables set SENTRY_PROJECT="globalrx-staging"
railway variables set SENTRY_AUTH_TOKEN="your-sentry-auth-token"

# Optional: Seeding for staging
railway variables set SEED_DATABASE="true"
```

### 4. Deploy to Staging

```bash
# Deploy staging environment
pnpm run railway:staging
```

## Production Environment Setup

### 1. Create Production Project

```bash
# Create new Railway project for production
railway new --name globalrx-production

# Link to the production project
railway link --project globalrx-production
```

### 2. Add PostgreSQL Database

```bash
# Add PostgreSQL service to production
railway add postgresql
```

### 3. Configure Production Environment Variables

⚠️ **Important**: Use strong, unique secrets for production!

```bash
# Required variables
railway variables set NEXTAUTH_SECRET="your-extremely-secure-production-secret"
railway variables set NEXTAUTH_URL="https://your-production-domain.com"
railway variables set NODE_ENV="production"
railway variables set NEXT_TELEMETRY_DISABLED="1"
railway variables set NEXT_PUBLIC_APP_VERSION="1.0.0"

# Production Sentry configuration
railway variables set NEXT_PUBLIC_SENTRY_DSN="your-production-sentry-dsn"
railway variables set SENTRY_DSN="your-production-sentry-dsn"
railway variables set SENTRY_ORG="your-org"
railway variables set SENTRY_PROJECT="globalrx-production"
railway variables set SENTRY_AUTH_TOKEN="your-sentry-auth-token"

# Production alerting (optional)
railway variables set SLACK_WEBHOOK_URL="your-slack-webhook"
railway variables set ALERT_EMAIL_HOST="smtp.yourprovider.com"
railway variables set ALERT_EMAIL_PORT="587"
railway variables set ALERT_EMAIL_USER="alerts@yourdomain.com"
railway variables set ALERT_EMAIL_PASS="your-email-password"
railway variables set ALERT_EMAIL_FROM="alerts@yourdomain.com"
railway variables set ALERT_EMAIL_TO="admin@yourdomain.com"
railway variables set PAGERDUTY_ROUTING_KEY="your-pagerduty-key"
```

### 4. Deploy to Production

```bash
# Deploy production environment
pnpm run railway:production
```

## Domain Configuration

### Staging Domain

Railway provides a default domain like `globalrx-staging.up.railway.app`. Update the `NEXTAUTH_URL` variable to match.

### Production Domain

1. **Add Custom Domain** in Railway dashboard:
   - Go to your production project
   - Navigate to Settings > Domains
   - Add your custom domain (e.g., `app.yourdomain.com`)

2. **Update DNS**: Point your domain to Railway using the provided CNAME

3. **Update Environment Variable**:
   ```bash
   railway variables set NEXTAUTH_URL="https://app.yourdomain.com"
   ```

## Database Management

### Running Migrations

Migrations run automatically during deployment via the `deploy.sh` script. To run manually:

```bash
# For staging
railway run --project globalrx-staging npx prisma migrate deploy

# For production
railway run --project globalrx-production npx prisma migrate deploy
```

### Database Seeding

Staging can be seeded automatically if `SEED_DATABASE=true` is set. For manual seeding:

```bash
# For staging only (never seed production)
railway run --project globalrx-staging npx prisma db seed
```

## Monitoring and Health Checks

### Health Check Endpoint

Railway will monitor the application using the `/api/health` endpoint. This checks:
- Database connectivity
- Environment variables
- Sentry integration
- Application uptime

### Logs

View application logs:

```bash
# Staging logs
railway logs --project globalrx-staging

# Production logs
railway logs --project globalrx-production
```

### Metrics

Access Railway's built-in metrics for:
- CPU usage
- Memory consumption
- Request volume
- Response times

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check that all environment variables are set
   - Verify TypeScript compilation passes locally
   - Ensure all dependencies are in `dependencies` (not `devDependencies`)

2. **Database Connection Issues**
   - Verify PostgreSQL service is running
   - Check DATABASE_URL is properly set by Railway
   - Run health check endpoint: `/api/health`

3. **Authentication Issues**
   - Ensure NEXTAUTH_URL matches your deployed URL
   - Verify NEXTAUTH_SECRET is set and secure
   - Check domain configuration for production

4. **Environment Variable Issues**
   - Use `railway variables` to list all variables
   - Compare with `.env.example` for required variables
   - Check for typos in variable names

### Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Railway Community: [discord.gg/railway](https://discord.gg/railway)
- GlobalRx Issues: Create an issue in your repository

## Security Notes

🔒 **Security Best Practices**:

1. Use strong, unique `NEXTAUTH_SECRET` for each environment
2. Never commit secrets to version control
3. Regularly rotate API keys and secrets
4. Monitor application logs for security issues
5. Use Railway's environment variable encryption
6. Set up proper alerting for production issues

## Deployment Checklist

### Pre-deployment

- [ ] All environment variables configured
- [ ] Database service added and running
- [ ] Health check endpoint accessible
- [ ] Sentry configuration verified
- [ ] Domain configuration complete (production)

### Post-deployment

- [ ] Application loads successfully
- [ ] Authentication works correctly
- [ ] Database connectivity verified
- [ ] Monitoring alerts configured
- [ ] Performance metrics reviewed
- [ ] Security scan completed

### Rollback Plan

If deployment issues occur:

1. **Staging**: Redeploy previous working commit
2. **Production**:
   - Use Railway's rollback feature
   - Monitor application health
   - Verify database integrity
   - Communicate with stakeholders

---

## Quick Reference Commands

```bash
# Switch between projects
railway link --project globalrx-staging
railway link --project globalrx-production

# View current environment variables
railway variables

# View logs
railway logs --tail

# Run one-off commands
railway run <command>

# Deploy current branch
railway up
```