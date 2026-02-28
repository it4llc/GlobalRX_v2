# Production Database Baseline Guide

## Overview

When connecting Prisma to an existing production database that wasn't created through Prisma migrations, you need to "baseline" the database. This process tells Prisma that the current database schema matches your migration files without actually running those migrations.

## Why Baseline is Needed

### Current Situation
- **Staging**: Works fine because it started with an empty database where Prisma migrations ran normally
- **Production**: Fails with error `P3005: The database schema is not empty` because the database already has tables/data

### When You Need to Baseline
- Connecting to an existing production database
- After restoring a database from backup
- When tables were created manually or by another tool
- After importing data from another system

## Step-by-Step Baselining Process

### Prerequisites
1. Ensure your Prisma schema matches your production database structure
2. Have access to production database connection string
3. Backup your production database before proceeding

### Method 1: Using the Baseline Script (Recommended)

We've created a script to automate the baseline process:

```bash
# 1. Set your production DATABASE_URL
export DATABASE_URL="postgresql://user:password@host:port/database"

# 2. Run the baseline script
./scripts/baseline-production-db.sh
```

The script will:
- Create a backup of existing migration records
- Mark all migrations as "already applied"
- Verify the baseline was successful

### Method 2: Manual Baseline Process

If you prefer to do it manually or need more control:

```bash
# 1. Connect to production database
export DATABASE_URL="postgresql://user:password@host:port/database"

# 2. Create the migrations table if it doesn't exist
npx prisma migrate resolve --applied "20250125_initial"

# 3. Mark each migration as applied (without running them)
npx prisma migrate resolve --applied "20250125_initial"
npx prisma migrate resolve --applied "20260126014942_add_customer_portal_models"
npx prisma migrate resolve --applied "20260129011632_add_address_block_models"
npx prisma migrate resolve --applied "20260222_move_display_order"
npx prisma migrate resolve --applied "20260222011200_add_display_order_to_dsx_mappings"

# 4. Verify all migrations are marked as applied
npx prisma migrate status
```

### Method 3: Single Command Baseline

For a fresh baseline where you want to mark ALL migrations as applied at once:

```bash
# This creates a new migration that captures the current schema
# and marks all previous migrations as applied
npx prisma migrate resolve --applied "$(ls prisma/migrations | grep ^[0-9] | tail -1)"
```

## After Baselining

### 1. Update Railway Configuration

Once baselined, you can safely re-enable automatic migrations in `railway.toml`:

```toml
[deploy]
startCommand = "npx prisma migrate deploy && pnpm run start"
```

### 2. Test Migration Status

Verify that Prisma recognizes the database as up-to-date:

```bash
npx prisma migrate status
```

You should see:
```
Database schema is up to date!
```

### 3. Future Migrations

After baselining, new migrations will work normally:

```bash
# Create new migrations during development
npx prisma migrate dev --name add_new_feature

# Apply to production (will only run new migrations)
npx prisma migrate deploy
```

## Troubleshooting

### Issue: "Database schema is not empty" error persists

**Solution**: Ensure the _prisma_migrations table exists and contains records for all migrations.

```sql
-- Check if migrations table exists
SELECT * FROM _prisma_migrations;

-- If empty, re-run the baseline process
```

### Issue: Schema drift detected

**Solution**: Your Prisma schema doesn't match the database. Either:
1. Update your Prisma schema to match production
2. Create a migration to align them

```bash
# Pull current database schema into Prisma
npx prisma db pull

# Or create a migration to fix differences
npx prisma migrate dev --name fix_schema_drift
```

### Issue: Rollback needed

**Solution**: If baseline causes issues:

```sql
-- Remove baseline records
DELETE FROM _prisma_migrations;

-- Or restore from backup
DROP TABLE IF EXISTS _prisma_migrations;
ALTER TABLE _prisma_migrations_backup RENAME TO _prisma_migrations;
```

## Best Practices

1. **Always backup** before baselining production
2. **Test in staging** first if possible
3. **Verify schema match** between Prisma and database
4. **Document the baseline date** for future reference
5. **Monitor first deployment** after baselining

## Railway-Specific Notes

For Railway deployments:

1. **Temporary Fix** (currently in place):
   - Removed `prisma migrate deploy` from start command
   - Allows app to start without migrations

2. **Permanent Fix** (after baselining):
   - Baseline production database using this guide
   - Re-enable migrations in railway.toml
   - Deploy with confidence

## Command Reference

```bash
# Check migration status
npx prisma migrate status

# Mark specific migration as applied
npx prisma migrate resolve --applied "MIGRATION_NAME"

# Create new migration
npx prisma migrate dev --name description

# Deploy migrations to production
npx prisma migrate deploy

# Pull database schema into Prisma
npx prisma db pull

# Push Prisma schema to database (dangerous in production!)
npx prisma db push
```

## Support

If you encounter issues:
1. Check the Prisma documentation on [baselining](https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/baselining)
2. Review the error logs in Railway dashboard
3. Ensure database connection string is correct
4. Verify network connectivity to database