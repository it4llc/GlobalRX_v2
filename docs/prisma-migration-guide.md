# Prisma Migration Guide for GlobalRX

## Migration Workflow

Follow these steps when making database schema changes:

1. **Always backup the database before migrations**
   ```bash
   pg_dump postgresql://andyhellman@localhost:5432/globalrx > backups/backup_before_migration_$(date +%Y%m%d).sql
   ```

2. **Update your schema.prisma file** with the required changes

3. **Generate a migration using pnpm**
   ```bash
   pnpm prisma migrate dev --name descriptive_name_of_changes
   ```
   This will:
   - Create a new migration directory with timestamped name
   - Generate the migration.sql file
   - Create the migration.toml tracking file
   - Apply the migration to your development database

4. **Test the changes** thoroughly

5. **Commit all generated files together**
   - schema.prisma
   - The entire new migration directory

## Common Issues and Fixes

### Duplicate Migrations

If you end up with duplicate migrations (multiple files trying to make the same changes):

1. Backup your database
2. Backup your prisma/migrations directory
3. Remove the duplicate migrations, keeping only the latest version
4. Run `pnpm prisma migrate resolve` to mark the removed migrations as applied

### Manual Migration Editing

Avoid manually editing migration files. If you must:

1. Only edit migrations that haven't been applied to production
2. Document all manual changes thoroughly
3. Test the migration process completely

### Schema/Database Out of Sync

If your Prisma schema and database get out of sync:

1. Backup your database
2. Run `pnpm prisma db pull` to update your schema.prisma
3. Create a new migration for any additional changes

## Database Reset (Local Development Only)

If your local database needs a complete reset:

1. Backup any important data
2. Drop and recreate the database
   ```bash
   dropdb globalrx && createdb globalrx
   ```
3. Apply all migrations from scratch
   ```bash
   pnpm prisma migrate deploy
   ```

## Migration Naming Conventions

Use clear, descriptive names for migrations:
- `add_user_profile_fields`
- `create_workflow_tables`
- `update_customer_relations`
- `fix_index_performance`

## Deployment to Production

For production environments:
```bash
pnpm prisma migrate deploy
```

This applies pending migrations without generating new ones.

## GlobalRX Migration History

The project's migration history has been cleaned up to remove duplicates. The current migrations are:

1. `20240318_update_service_model` - Initial service model update
2. `20250530000000_workflow_direct_package_relation` - Add direct package relation to workflow
3. `20250530194500_add_workflow_user_tracking` - Add user tracking to workflows
4. `20250601000000_add_workflow_reminder_fields` - Add reminder functionality to workflows
5. `20260319000000_backfill_services_fulfillment` - **ServicesFulfillment Data Integrity Migration**

Previous duplicate migrations have been backed up in `prisma/migrations_old` for reference.

## ServicesFulfillment Backfill Migration (March 19, 2026)

### Purpose
The `20260319000000_backfill_services_fulfillment` migration ensures every OrderItem has a corresponding ServicesFulfillment record, establishing the required 1:1 relationship for data integrity.

### Business Context
- **Before Migration:** 36 OrderItems with only 27 ServicesFulfillment records (9 orphaned OrderItems)
- **After Migration:** 36 OrderItems with 36 ServicesFulfillment records (100% data consistency)
- **Bug Resolution:** Eliminates service comment display bugs and fulfillment view inconsistencies

### Migration Features
- **Idempotent:** Safe to run multiple times using `ON CONFLICT DO NOTHING`
- **Comprehensive Logging:** Detailed progress and verification messages
- **Multi-Step Verification:** Ensures both count matching and zero orphaned records
- **Transaction Safety:** All operations within a single atomic transaction

### Execution Results
- **Records Created:** 9 new ServicesFulfillment records for previously orphaned OrderItems
- **Execution Time:** < 1 second
- **Verification Status:** PASSED - All validation checks confirmed success
- **System Impact:** Fulfillment and comment systems now function correctly for all historical orders

### Integration with Auto-Creation Feature
This migration works in conjunction with the auto-creation feature implemented on March 19, 2026:
- **Phase 1:** Auto-creation prevents future orphaned OrderItems
- **Phase 2:** This migration eliminated existing orphaned OrderItems
- **Combined Result:** 100% data integrity coverage for all orders (historical and new)

### Migration Pattern Established
This migration established best practices for future data integrity migrations:
- Comprehensive documentation in SQL comments
- Idempotent operations for production safety
- Multi-step verification with meaningful logging
- Business requirement documentation within migration file

## Common Commands

```bash
# Check migration status
pnpm prisma migrate status

# Generate client after schema changes
pnpm prisma generate

# Pull database schema changes (if made outside of Prisma)
pnpm prisma db pull

# Create an empty migration (for manual SQL)
pnpm prisma migrate dev --create-only --name manual_changes
```