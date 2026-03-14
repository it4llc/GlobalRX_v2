# GlobalRx Database Sync Guide

## Overview

This guide provides instructions for safely syncing database content from development to staging and/or production environments. This process should only be performed after ensuring code is synchronized across all environments.

## Prerequisites

### 1. Install PostgreSQL Client Tools

The scripts require PostgreSQL client tools (`pg_dump`, `psql`):

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# CentOS/RHEL
sudo yum install postgresql
```

### 2. Configure Environment Variables

Ensure your `.env` file contains the database URLs:

```bash
DATABASE_URL=postgresql://...          # Development database
DATABASE_URL_STAGING=postgresql://...  # Staging database
DATABASE_URL_PROD=postgresql://...     # Production database
```

### 3. Make Scripts Executable

```bash
chmod +x scripts/db-backup.sh
chmod +x scripts/db-sync.sh
chmod +x scripts/db-verify.sh
```

## Scripts Overview

### 1. `db-backup.sh` - Backup All Databases

Creates timestamped backups of all configured databases.

```bash
./scripts/db-backup.sh
```

**Features:**
- Backs up dev, staging, and production databases
- Creates compressed `.sql.gz` files
- Timestamps all backups
- Stores in `./db-backups/` directory

### 2. `db-verify.sh` - Verify Database Status

Checks connections and compares database structures.

```bash
./scripts/db-verify.sh
```

**Shows:**
- Connection status for each environment
- Database sizes and table counts
- Row counts for main tables
- Migration status
- Structure comparison between environments
- Existing backup files

### 3. `db-sync.sh` - Sync Databases

Copies dev database content to staging and/or production.

```bash
# Show help
./scripts/db-sync.sh --help

# Sync dev → staging
./scripts/db-sync.sh --staging

# Sync dev → production
./scripts/db-sync.sh --prod

# Sync dev → both staging and production
./scripts/db-sync.sh --all

# Skip confirmation prompt (use with caution)
./scripts/db-sync.sh --staging --force

# Skip backup (NOT RECOMMENDED)
./scripts/db-sync.sh --staging --skip-backup
```

## Recommended Sync Process

### Step 1: Ensure Code is Synchronized

Before syncing databases, make sure all environments are running the same code version:

```bash
# Check current branch and status
git status

# Ensure all changes are committed and pushed
git push

# Deploy to staging/production as needed
```

### Step 2: Create Full Backups

Always create backups before any sync operation:

```bash
./scripts/db-backup.sh
```

Verify backups were created:
```bash
ls -la db-backups/
```

### Step 3: Verify Current State

Check the current state of all databases:

```bash
./scripts/db-verify.sh
```

Review the output to ensure:
- All databases are accessible
- Table structures match (or differences are expected)
- You understand what data exists in each environment

### Step 4: Perform the Sync

#### Option A: Sync to Staging First (Recommended)

```bash
# Sync dev → staging
./scripts/db-sync.sh --staging

# Test staging thoroughly
# If everything works, proceed to production
./scripts/db-sync.sh --prod
```

#### Option B: Sync to Both Environments

```bash
# Sync dev → staging and production
./scripts/db-sync.sh --all
```

### Step 5: Verify the Sync

After syncing, verify the results:

```bash
./scripts/db-verify.sh
```

Check that:
- Row counts match expectations
- Table structures are identical
- No errors in the output

### Step 6: Test the Application

1. Test staging environment thoroughly:
   - Login with different user types
   - Create/edit/delete test records
   - Verify all features work as expected

2. Monitor production (if synced):
   - Check application logs
   - Monitor for any errors
   - Be ready to restore from backup if needed

## Backup Management

### Backup File Naming

Backups are named with timestamps:
```
dev_20240315_143022.sql.gz       # Regular backup
staging_pre_sync_20240315_143022.sql.gz  # Pre-sync backup
```

### Restoring from Backup

If you need to restore a database from backup:

```bash
# Decompress the backup
gunzip db-backups/prod_20240315_143022.sql.gz

# Restore to database
PGPASSWORD=yourpassword psql \
  -h your-host \
  -U your-user \
  -d your-database \
  < db-backups/prod_20240315_143022.sql
```

### Backup Retention

Recommended retention policy:
- Keep daily backups for 7 days
- Keep weekly backups for 4 weeks
- Keep monthly backups for 6 months
- Keep pre-sync backups for at least 30 days

## Safety Considerations

### Before Syncing

- [ ] Ensure all code is deployed and tested
- [ ] Create fresh backups of all databases
- [ ] Notify team members of planned sync
- [ ] Schedule during low-traffic period
- [ ] Have rollback plan ready

### After Syncing

- [ ] Verify data integrity
- [ ] Test critical user flows
- [ ] Monitor error logs
- [ ] Keep backups for at least 30 days
- [ ] Document the sync in change log

## Troubleshooting

### Connection Refused

If you get connection errors:
1. Check database URLs in `.env`
2. Verify network connectivity
3. Check firewall rules
4. Ensure database is accepting connections

### Permission Denied

If you get permission errors:
1. Verify database user has necessary privileges
2. Check if database requires SSL
3. Verify password is correct

### Sync Fails Mid-Process

If sync fails:
1. The target database may be partially updated
2. Restore from the pre-sync backup immediately
3. Investigate the error before retrying
4. Check disk space on both source and target

### Different Table Structures

If verification shows different structures:
1. Run pending migrations on target environment
2. Ensure Prisma schema is synchronized
3. Check for environment-specific migrations

## Emergency Rollback

If you need to quickly rollback a sync:

```bash
# 1. Find the pre-sync backup
ls -la db-backups/*pre_sync*

# 2. Restore the backup (example for production)
gunzip db-backups/prod_pre_sync_20240315_143022.sql.gz
PGPASSWORD=$PROD_DB_PASS psql -h $PROD_HOST -U $PROD_USER -d $PROD_DB < db-backups/prod_pre_sync_20240315_143022.sql

# 3. Verify the restore
./scripts/db-verify.sh
```

## Best Practices

1. **Always backup first** - Never skip the backup step
2. **Test in staging** - Always sync to staging before production
3. **Off-peak hours** - Perform syncs during low-traffic periods
4. **Monitor closely** - Watch logs and metrics after sync
5. **Document changes** - Log all sync operations
6. **Keep backups** - Retain backups for at least 30 days
7. **Coordinate with team** - Notify all stakeholders before syncing
8. **Verify twice** - Double-check everything before and after sync