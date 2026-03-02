#!/bin/bash

# Comprehensive import script for staging and production
# Handles all data cleaning and import issues

echo "🚀 GlobalRx Data Import Tool"
echo "============================"
echo ""

# Use PostgreSQL 17 tools
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
echo "Using pg tools: $(psql --version | head -1)"
echo ""

# Get export directory
if [ -z "$1" ]; then
  echo "❌ Usage: ./scripts/import-to-environment.sh <export-directory>"
  echo "   Example: ./scripts/import-to-environment.sh database-exports/20260301_153951"
  exit 1
fi

EXPORT_DIR="$1"

if [ ! -d "$EXPORT_DIR" ]; then
  echo "❌ Export directory not found: $EXPORT_DIR"
  exit 1
fi

# Choose environment
echo "Select target environment:"
echo "1) Staging (Railway)"
echo "2) Production (Railway)"
echo "3) Custom URL"
read -p "Enter choice (1-3): " ENV_CHOICE

case $ENV_CHOICE in
  1)
    TARGET_ENV="staging"
    DATABASE_URL="postgresql://postgres:nejxpddaeAeCvSjLrZnUpJInzZkSjTIX@turntable.proxy.rlwy.net:37481/railway"
    ;;
  2)
    TARGET_ENV="production"
    read -p "⚠️  Are you SURE you want to import to PRODUCTION? Type 'yes': " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
      echo "❌ Cancelled"
      exit 1
    fi
    DATABASE_URL="postgresql://postgres:YclSibhdowXmvLlWxXrtqaWeuOtSfwZV@shortline.proxy.rlwy.net:24128/railway"
    ;;
  3)
    TARGET_ENV="custom"
    read -p "Enter DATABASE_URL: " DATABASE_URL
    ;;
  *)
    echo "❌ Invalid choice"
    exit 1
    ;;
esac

echo ""
echo "📋 Import Configuration:"
echo "   - Source: $EXPORT_DIR"
echo "   - Target: $TARGET_ENV"
echo ""

# Clean export files first
echo "🧹 Cleaning export files..."
mkdir -p /tmp/globalrx_import

# Tables to import in dependency order
TABLES=(
  "users"
  "vendor_organizations"
  "customers"
  "orders"
  "order_status_history"
  "services"
  "customer_services"
)

# Clean each SQL file
for TABLE in "${TABLES[@]}"; do
  if [ -f "$EXPORT_DIR/$TABLE.sql" ]; then
    # Remove problematic \restrict lines and clean the file
    grep -v '^\\restrict' "$EXPORT_DIR/$TABLE.sql" > "/tmp/globalrx_import/${TABLE}_clean.sql"
    echo "   ✅ Cleaned $TABLE.sql"
  fi
done

echo ""
echo "📥 Importing data..."
echo ""

# Track success/failure
FAILED_TABLES=()
SUCCESS_TABLES=()

# Import each table
for TABLE in "${TABLES[@]}"; do
  if [ -f "/tmp/globalrx_import/${TABLE}_clean.sql" ]; then
    echo "📤 Processing $TABLE..."

    # First, truncate the table (with CASCADE to handle foreign keys)
    psql "$DATABASE_URL" -c "TRUNCATE TABLE $TABLE CASCADE;" >/dev/null 2>&1

    # Import the cleaned data
    if psql "$DATABASE_URL" < "/tmp/globalrx_import/${TABLE}_clean.sql" >/dev/null 2>&1; then
      # Count rows to verify
      ROW_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM $TABLE" 2>/dev/null | xargs)

      if [ -n "$ROW_COUNT" ] && [ "$ROW_COUNT" -gt 0 ]; then
        echo "   ✅ Successfully imported $ROW_COUNT rows"
        SUCCESS_TABLES+=("$TABLE ($ROW_COUNT rows)")
      else
        echo "   ⚠️  Table imported but appears empty"
        FAILED_TABLES+=("$TABLE")
      fi
    else
      echo "   ❌ Failed to import (table might not exist or data incompatible)"
      FAILED_TABLES+=("$TABLE")
    fi
  else
    echo "⏭️  Skipping $TABLE (no data)"
  fi
done

# Clean up temp files
rm -rf /tmp/globalrx_import

echo ""
echo "📊 Import Summary"
echo "================"
echo ""

if [ ${#SUCCESS_TABLES[@]} -gt 0 ]; then
  echo "✅ Successfully imported:"
  for TABLE in "${SUCCESS_TABLES[@]}"; do
    echo "   - $TABLE"
  done
fi

if [ ${#FAILED_TABLES[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  Failed or empty:"
  for TABLE in "${FAILED_TABLES[@]}"; do
    echo "   - $TABLE"
  done
fi

echo ""
echo "🔍 Verifying critical data..."
echo ""

# Check for admin users with new permissions
echo "Admin users with module permissions:"
psql "$DATABASE_URL" -c "
  SELECT email, \"userType\",
    CASE
      WHEN permissions::text LIKE '%user_admin%' OR
           permissions::text LIKE '%global_config%' OR
           permissions::text LIKE '%vendor%'
      THEN 'Has module permissions ✅'
      ELSE 'Old permission format ⚠️'
    END as permission_status
  FROM users
  WHERE \"userType\" IN ('admin', 'internal')
     OR email LIKE '%@%'
  LIMIT 5;
" 2>/dev/null

echo ""
echo "Vendor organizations:"
psql "$DATABASE_URL" -c "
  SELECT name, \"isPrimary\", \"isActive\"
  FROM vendor_organizations;
" 2>/dev/null || echo "   No vendor organizations found"

echo ""
echo "==============================================="
echo "✅ Import process complete!"
echo ""
echo "🎯 Next steps for $TARGET_ENV:"
echo "   1. Log in with andythellman@gmail.com"
echo "   2. Verify config cards are visible on homepage"
echo "   3. Check vendor management module access"
echo ""
echo "⚠️  If config cards still don't show:"
echo "   - User might need userType set to 'admin' or 'internal'"
echo "   - Permissions need module format: {\"user_admin\": \"*\", \"global_config\": \"*\"}"
echo ""