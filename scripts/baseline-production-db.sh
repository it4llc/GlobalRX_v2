#!/bin/bash

# Script to baseline production database with Prisma migrations
# This marks the current database schema as if it were created by all existing migrations

set -e

echo "================================================"
echo "Prisma Production Database Baseline Script"
echo "================================================"
echo ""
echo "This script will baseline your production database with Prisma."
echo "It marks all existing migrations as already applied without actually running them."
echo ""
echo "⚠️  WARNING: Only run this on a production database that already has the correct schema!"
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set your production DATABASE_URL:"
    echo "export DATABASE_URL='postgresql://user:password@host:port/database'"
    exit 1
fi

echo "📊 Database URL detected: ${DATABASE_URL:0:30}..."
echo ""
echo "Do you want to proceed with baselining? (yes/no)"
read -r response

if [[ "$response" != "yes" ]]; then
    echo "Baseline cancelled."
    exit 0
fi

echo ""
echo "Step 1: Creating backup of _prisma_migrations table (if exists)..."
npx prisma db execute --url "$DATABASE_URL" --stdin <<EOF
CREATE TABLE IF NOT EXISTS _prisma_migrations_backup AS
SELECT * FROM _prisma_migrations
WHERE 1=1;
EOF 2>/dev/null || echo "No existing migrations table to backup"

echo ""
echo "Step 2: Marking all migrations as applied..."

# Get all migration directories
MIGRATION_DIRS=$(ls -d prisma/migrations/*/ 2>/dev/null | grep -v migration_lock.toml || true)

if [ -z "$MIGRATION_DIRS" ]; then
    echo "❌ No migration directories found in prisma/migrations/"
    exit 1
fi

# Initialize counter
COUNT=0

# Mark each migration as applied
for dir in $MIGRATION_DIRS; do
    MIGRATION_NAME=$(basename "$dir")

    # Skip if not a proper migration directory (should start with a date)
    if [[ ! "$MIGRATION_NAME" =~ ^[0-9] ]]; then
        continue
    fi

    echo "  ✓ Marking migration as applied: $MIGRATION_NAME"

    # Insert migration record into _prisma_migrations table
    npx prisma db execute --url "$DATABASE_URL" --stdin <<EOF
INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    '$(uuidgen || cat /proc/sys/kernel/random/uuid)',
    '$(sha256sum "$dir/migration.sql" 2>/dev/null | cut -d' ' -f1 || echo "baseline")',
    NOW(),
    '$MIGRATION_NAME',
    NULL,
    NULL,
    NOW(),
    1
)
ON CONFLICT (migration_name) DO NOTHING;
EOF

    COUNT=$((COUNT + 1))
done

echo ""
echo "✅ Successfully baselined $COUNT migrations!"
echo ""
echo "Step 3: Verifying baseline..."

# Test that migrations are now considered up to date
npx prisma migrate status || true

echo ""
echo "================================================"
echo "✅ Baseline Complete!"
echo "================================================"
echo ""
echo "Your production database is now baselined with Prisma."
echo "You can now:"
echo "1. Re-enable 'npx prisma migrate deploy' in railway.toml"
echo "2. Future migrations will be tracked and applied normally"
echo ""
echo "To rollback this baseline (if needed):"
echo "1. Delete all records from _prisma_migrations table"
echo "2. Restore from _prisma_migrations_backup if it exists"