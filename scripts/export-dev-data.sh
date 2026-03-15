#!/bin/bash

# Export data from development database
# This script exports specific tables that contain configuration and test data

# Use PostgreSQL 17 tools
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

echo "🔄 Exporting data from development database..."
echo "   Using pg_dump version: $(pg_dump --version | head -1)"

# Load environment variables
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
elif [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "❌ No .env file found. Please ensure DATABASE_URL is set."
  exit 1
fi

if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL is not set"
  exit 1
fi

# Remove query parameters from DATABASE_URL (PostgreSQL 17 doesn't like them)
DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/\?.*//')

# Create export directory in consolidated backup location
EXPORT_DIR="db-backups/exports/$(date +%Y%m%d_%H%M%S)"
mkdir -p $EXPORT_DIR

echo "📁 Export directory: $EXPORT_DIR"

# Tables to export (in dependency order)
TABLES=(
  "users"                    # User accounts with updated permissions
  "vendor_organizations"     # Vendor organizations
  "customers"               # Customer organizations
  "orders"                  # Orders with vendor assignments
  "order_status_history"    # Order status history
  "locations"              # Global locations
  "services"               # Global services
  "dsx_field_mappings"     # DSX field mappings
  "customer_locations"     # Customer-specific locations
  "customer_services"      # Customer-specific services
  "customer_packages"      # Customer packages
)

# Export each table
for TABLE in "${TABLES[@]}"; do
  echo "  📤 Exporting $TABLE..."
  pg_dump "$DATABASE_URL" \
    --table="$TABLE" \
    --data-only \
    --no-owner \
    --no-privileges \
    --no-tablespaces \
    --no-security-labels \
    --no-comments \
    --inserts \
    --column-inserts \
    | grep -v '^\\restrict' \
    | grep -v '^\\unrestrict' \
    > "$EXPORT_DIR/$TABLE.sql"

  if [ $? -eq 0 ]; then
    echo "     ✅ $TABLE exported successfully"
  else
    echo "     ⚠️  $TABLE might be empty or doesn't exist"
  fi
done

# Create a combined export file
echo "📦 Creating combined export file..."
cat > "$EXPORT_DIR/combined-export.sql" << EOF
-- GlobalRx Development Data Export
-- Generated: $(date)
--
-- This file contains data from the development environment
-- Import this into staging or production after migrations are complete

BEGIN;

-- Disable foreign key checks during import
SET session_replication_role = 'replica';

EOF

# Add each table's data to the combined file
for TABLE in "${TABLES[@]}"; do
  if [ -f "$EXPORT_DIR/$TABLE.sql" ] && [ -s "$EXPORT_DIR/$TABLE.sql" ]; then
    echo "" >> "$EXPORT_DIR/combined-export.sql"
    echo "-- Table: $TABLE" >> "$EXPORT_DIR/combined-export.sql"
    echo "TRUNCATE TABLE $TABLE CASCADE;" >> "$EXPORT_DIR/combined-export.sql"
    cat "$EXPORT_DIR/$TABLE.sql" >> "$EXPORT_DIR/combined-export.sql"
  fi
done

cat >> "$EXPORT_DIR/combined-export.sql" << EOF

-- Re-enable foreign key checks
SET session_replication_role = 'origin';

COMMIT;

-- Update sequences to max values
EOF

# Add sequence updates
for TABLE in "${TABLES[@]}"; do
  echo "SELECT setval(pg_get_serial_sequence('$TABLE', 'id'), COALESCE(MAX(id), 1)) FROM $TABLE;" >> "$EXPORT_DIR/combined-export.sql" 2>/dev/null
done

echo "✅ Export complete!"
echo ""
echo "📋 Export summary:"
echo "   - Location: $EXPORT_DIR"
echo "   - Combined file: $EXPORT_DIR/combined-export.sql"
echo "   - Individual tables: $EXPORT_DIR/*.sql"
echo ""
echo "🚀 To import into staging:"
echo "   1. Ensure migrations are up to date: pnpm prisma migrate deploy"
echo "   2. Run: psql \$STAGING_DATABASE_URL < $EXPORT_DIR/combined-export.sql"
echo ""
echo "⚠️  Warning: This will REPLACE all data in the target database!"