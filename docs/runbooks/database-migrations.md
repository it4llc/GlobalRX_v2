# Database Migration Management
**Created:** February 23, 2026
**Status:** Production Ready

## Current Migration State

### Migration Analysis Summary
- **Total migration lines**: 1,241 lines across 5 files
- **Initial schema**: 378 lines (20250125_initial)
- **Largest migration**: 206 lines (customer portal models)
- **Recent migrations**: Display order additions (2-4 lines each)
- **Migration lock**: PostgreSQL provider confirmed

### Migration File Breakdown
```
├── 20250125_initial/migration.sql                    (378 lines)
├── 20260126014942_add_customer_portal_models/        (206 lines)
├── 20260129011632_add_address_block_models/          (68 lines)
├── 20260222_move_display_order/                      (4 lines)
├── 20260222011200_add_display_order_to_dsx_mappings/ (2 lines)
└── initial_schema.sql                                (583 lines - reference)
```

### Migration Quality Assessment ✅
- **Proper versioning**: Timestamp-based sequential naming
- **Non-destructive**: Mostly ADD operations, no DROP statements
- **Indexed appropriately**: Foreign keys and constraints included
- **Atomic**: Each migration is self-contained

## Migration Best Practices

### 1. Safe Migration Patterns

#### ✅ Safe Operations (Can be run in production)
```sql
-- Adding new columns with defaults
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMPTZ;

-- Adding new tables
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP
);

-- Adding indexes (use CONCURRENTLY in production)
CREATE INDEX CONCURRENTLY "idx_users_last_login" ON "users" ("lastLoginAt");

-- Adding new constraints (if data already valid)
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE ("email");
```

#### ⚠️ Potentially Unsafe Operations
```sql
-- Dropping columns (data loss risk)
ALTER TABLE "users" DROP COLUMN "deprecated_field";

-- Changing column types (may fail with existing data)
ALTER TABLE "orders" ALTER COLUMN "amount" SET DATA TYPE NUMERIC(10,2);

-- Adding NOT NULL constraints to existing columns
ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;
```

#### ❌ Dangerous Operations (Never in production without maintenance window)
```sql
-- Table renames (breaks application)
ALTER TABLE "old_table" RENAME TO "new_table";

-- Dropping tables (data loss)
DROP TABLE "deprecated_table";

-- Major schema restructuring
-- (Multiple dependent changes)
```

### 2. Migration Development Workflow

#### Create New Migration
```bash
# Generate new migration
pnpm prisma migrate dev --name add_new_feature

# Example: Adding user preferences
pnpm prisma migrate dev --name add_user_preferences
```

#### Review Migration Before Deploy
```bash
# Check generated SQL
cat prisma/migrations/[timestamp]_[name]/migration.sql

# Validate against current schema
pnpm prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource
```

### 3. Production Deployment Process

#### Pre-deployment Checklist
- [ ] Migration tested on staging with production data copy
- [ ] Rollback plan prepared and tested
- [ ] Database backup completed
- [ ] Application can handle both old and new schema temporarily
- [ ] Migration estimated runtime < 5 minutes (or scheduled maintenance)

#### Deployment Steps
```bash
# 1. Create database backup
pg_dump $DATABASE_URL > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# 2. Apply migration
pnpm prisma migrate deploy

# 3. Verify migration success
pnpm prisma migrate status

# 4. Test critical application paths
curl -f https://app.globalrx.com/api/health/deep
```

## Rollback Procedures

### Current Issue: No Rollback Strategy ❌

The current migration setup lacks rollback capabilities. Here's how to implement them:

#### 1. Create Rollback Scripts

For each migration, create a corresponding rollback:

**Example: 20260126014942_add_customer_portal_models**
```sql
-- File: prisma/migrations/20260126014942_add_customer_portal_models/rollback.sql
-- Rollback script for customer portal models migration

-- Remove foreign key constraints first
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_customerId_fkey";

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS "order_requirements";
DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "portal_sessions";

-- Remove indexes
DROP INDEX IF EXISTS "orders_customerId_idx";
DROP INDEX IF EXISTS "orders_status_idx";
```

#### 2. Rollback Execution Script
Create `scripts/rollback-migration.js`:
```javascript
#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function rollbackMigration(migrationName) {
  const rollbackPath = path.join(
    'prisma/migrations',
    migrationName,
    'rollback.sql'
  );

  if (!fs.existsSync(rollbackPath)) {
    throw new Error(`Rollback script not found: ${rollbackPath}`);
  }

  console.log(`Rolling back migration: ${migrationName}`);

  // Create backup before rollback
  const backupScript = `pg_dump ${process.env.DATABASE_URL} > backup_before_rollback_${Date.now()}.sql`;
  await execAsync(backupScript);

  // Execute rollback
  const rollbackSql = fs.readFileSync(rollbackPath, 'utf8');
  await prisma.$executeRawUnsafe(rollbackSql);

  console.log('Rollback completed successfully');
}

// Usage: node scripts/rollback-migration.js 20260126014942_add_customer_portal_models
if (require.main === module) {
  const migrationName = process.argv[2];
  if (!migrationName) {
    console.error('Usage: node scripts/rollback-migration.js <migration_name>');
    process.exit(1);
  }

  rollbackMigration(migrationName)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
```

### 3. Testing Rollbacks

#### Rollback Testing Script
```bash
#!/bin/bash
# scripts/test-rollback.sh

MIGRATION_NAME=$1
if [ -z "$MIGRATION_NAME" ]; then
    echo "Usage: ./scripts/test-rollback.sh <migration_name>"
    exit 1
fi

echo "Testing rollback for migration: $MIGRATION_NAME"

# 1. Create test database
createdb globalrx_rollback_test

# 2. Apply all migrations up to target
DATABASE_URL="postgresql://user:pass@localhost/globalrx_rollback_test" pnpm prisma migrate deploy

# 3. Test rollback
node scripts/rollback-migration.js $MIGRATION_NAME

# 4. Verify schema state
DATABASE_URL="postgresql://user:pass@localhost/globalrx_rollback_test" pnpm prisma db pull

# 5. Cleanup
dropdb globalrx_rollback_test

echo "Rollback test completed"
```

## Zero-Downtime Migration Strategies

### 1. Additive Changes Only
```sql
-- Phase 1: Add new column with default
ALTER TABLE "users" ADD COLUMN "new_email" TEXT;

-- Phase 2: Migrate data in application code
-- UPDATE users SET new_email = email WHERE new_email IS NULL;

-- Phase 3: Add NOT NULL constraint
ALTER TABLE "users" ALTER COLUMN "new_email" SET NOT NULL;

-- Phase 4: Drop old column (after application updated)
ALTER TABLE "users" DROP COLUMN "email";
```

### 2. Shadow Table Pattern
```sql
-- Phase 1: Create new table structure
CREATE TABLE "users_new" (
    -- Updated schema
);

-- Phase 2: Dual write to both tables
-- (Application change)

-- Phase 3: Migrate existing data
INSERT INTO "users_new" (...)
SELECT ... FROM "users";

-- Phase 4: Atomic swap
BEGIN;
ALTER TABLE "users" RENAME TO "users_old";
ALTER TABLE "users_new" RENAME TO "users";
COMMIT;

-- Phase 5: Drop old table (after verification)
DROP TABLE "users_old";
```

### 3. Feature Flag Pattern
```typescript
// Use feature flags for schema-dependent features
if (featureFlags.useNewUserTable) {
    return await prisma.users_new.findMany();
} else {
    return await prisma.users.findMany();
}
```

## Data Migration Utilities

### 1. Large Data Migration Script
```javascript
// scripts/migrate-large-dataset.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function migrateLargeDataset() {
    const batchSize = 1000;
    let offset = 0;
    let processed = 0;

    console.log('Starting large dataset migration...');

    while (true) {
        const batch = await prisma.oldTable.findMany({
            skip: offset,
            take: batchSize,
        });

        if (batch.length === 0) break;

        // Transform and migrate batch
        const transformedData = batch.map(transformRecord);

        await prisma.newTable.createMany({
            data: transformedData,
            skipDuplicates: true,
        });

        processed += batch.length;
        offset += batchSize;

        console.log(`Migrated ${processed} records...`);

        // Prevent overwhelming database
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Migration completed. Total records: ${processed}`);
}
```

### 2. Data Validation Script
```javascript
// scripts/validate-migration.js
async function validateMigration() {
    // Compare record counts
    const oldCount = await prisma.oldTable.count();
    const newCount = await prisma.newTable.count();

    if (oldCount !== newCount) {
        throw new Error(`Record count mismatch: ${oldCount} vs ${newCount}`);
    }

    // Sample data integrity checks
    const sampleData = await prisma.oldTable.findMany({ take: 100 });

    for (const record of sampleData) {
        const migratedRecord = await prisma.newTable.findUnique({
            where: { legacyId: record.id }
        });

        if (!migratedRecord) {
            throw new Error(`Missing migrated record: ${record.id}`);
        }

        // Validate specific fields
        if (record.email !== migratedRecord.email) {
            throw new Error(`Email mismatch for record ${record.id}`);
        }
    }

    console.log('Migration validation passed!');
}
```

## Emergency Procedures

### 1. Failed Migration Recovery
```bash
#!/bin/bash
# scripts/emergency-migration-recovery.sh

echo "EMERGENCY: Migration failed, starting recovery..."

# 1. Stop application (prevent further damage)
kubectl scale deployment globalrx-api --replicas=0

# 2. Assess damage
pnpm prisma migrate status

# 3. Restore from backup
psql $DATABASE_URL < backup_before_migration_*.sql

# 4. Verify restoration
pnpm prisma migrate status

# 5. Restart application
kubectl scale deployment globalrx-api --replicas=3

echo "Emergency recovery completed"
```

### 2. Partial Migration Fix
```bash
# If migration partially applied and failed
# 1. Mark migration as resolved in Prisma
pnpm prisma migrate resolve --applied 20260126014942_add_customer_portal_models

# 2. Or mark as rolled back
pnpm prisma migrate resolve --rolled-back 20260126014942_add_customer_portal_models
```

## Monitoring and Alerting

### Migration Performance Metrics
```typescript
// Monitor migration performance
import { performance } from 'perf_hooks';

async function timedMigration(migrationFunction: Function) {
    const start = performance.now();

    try {
        await migrationFunction();
        const duration = performance.now() - start;

        logger.info('Migration completed', {
            event: 'migration_success',
            duration,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        const duration = performance.now() - start;

        logger.error('Migration failed', {
            event: 'migration_failure',
            duration,
            error: error.message,
            stack: error.stack
        });

        throw error;
    }
}
```

### Alert Conditions
- Migration runtime > 5 minutes
- Migration failure
- Rollback executed
- Database backup failure before migration

## Documentation Requirements

### For Each Migration
- [ ] Purpose and business justification
- [ ] Expected impact and downtime
- [ ] Rollback procedure tested
- [ ] Performance impact assessment
- [ ] Staging environment validation completed

### Migration Log Template
```markdown
# Migration: [timestamp]_[name]

## Purpose
Brief description of why this migration is needed.

## Changes
- Table: users
  - Added column: lastLoginAt (TIMESTAMPTZ)
  - Added index: idx_users_last_login

## Rollback Plan
Detailed steps to reverse this migration if needed.

## Testing
- [ ] Staging environment tested with production data copy
- [ ] Performance impact measured
- [ ] Rollback procedure validated

## Deployment
- Estimated time: < 30 seconds
- Downtime required: No
- Best deployment window: Any time

## Verification
- [ ] Migration status confirmed
- [ ] Application functionality tested
- [ ] Performance metrics normal
```