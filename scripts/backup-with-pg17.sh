#!/bin/bash

# Backup databases using PostgreSQL 17 tools
# Uses the newly installed pg_dump from postgresql@17

echo "🔐 GlobalRx Database Backup (PostgreSQL 17)"
echo "==========================================="
echo ""

# Use PostgreSQL 17 tools
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

echo "✅ Using pg_dump version: $(pg_dump --version | head -1)"
echo ""

# Create backup directory with timestamp
BACKUP_DIR="database-backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo "📁 Backup directory: $BACKUP_DIR"
echo ""

# Function to backup a database
backup_database() {
  local ENV_NAME=$1
  local DB_URL=$2
  local BACKUP_FILE="$BACKUP_DIR/${ENV_NAME}_full_backup.sql"

  echo "🔄 Backing up $ENV_NAME database..."
  echo "   Target: ${DB_URL:0:50}..."

  # Create full backup with schema and data
  pg_dump "$DB_URL" \
    --no-owner \
    --no-privileges \
    --no-tablespaces \
    --no-security-labels \
    --file="$BACKUP_FILE"

  if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    local SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "   ✅ Success! Backup size: $SIZE"
    echo "   📄 File: $BACKUP_FILE"

    # Compress the backup
    echo "   📦 Compressing backup..."
    gzip -k "$BACKUP_FILE"
    local COMPRESSED_SIZE=$(du -h "$BACKUP_FILE.gz" | cut -f1)
    echo "   ✅ Compressed size: $COMPRESSED_SIZE"
    return 0
  else
    echo "   ❌ Backup failed for $ENV_NAME"
    return 1
  fi
}

# Staging Database
echo "1️⃣  Staging Database (Railway)"
echo "   You provided earlier:"
echo "   postgresql://postgres:nejxpddaeAeCvSjLrZnUpJInzZkSjTIX@turntable.proxy.rlwy.net:37481/railway"
read -p "   Use this URL? (Y/n): " USE_STAGING

if [ "$USE_STAGING" != "n" ] && [ "$USE_STAGING" != "N" ]; then
  STAGING_URL="postgresql://postgres:nejxpddaeAeCvSjLrZnUpJInzZkSjTIX@turntable.proxy.rlwy.net:37481/railway"
  backup_database "staging" "$STAGING_URL"
else
  read -p "   Enter different URL: " STAGING_URL
  if [ -n "$STAGING_URL" ]; then
    backup_database "staging" "$STAGING_URL"
  fi
fi
echo ""

# Production Database
echo "2️⃣  Production Database (Railway)"
read -p "   Do you want to backup PRODUCTION? (y/N): " BACKUP_PROD

if [ "$BACKUP_PROD" = "y" ] || [ "$BACKUP_PROD" = "Y" ]; then
  echo "   You provided earlier:"
  echo "   postgresql://postgres:YclSibhdowXmvLlWxXrtqaWeuOtSfwZV@shortline.proxy.rlwy.net:24128/railway"
  read -p "   Use this URL? (Y/n): " USE_PROD

  if [ "$USE_PROD" != "n" ] && [ "$USE_PROD" != "N" ]; then
    PROD_URL="postgresql://postgres:YclSibhdowXmvLlWxXrtqaWeuOtSfwZV@shortline.proxy.rlwy.net:24128/railway"
    backup_database "production" "$PROD_URL"
  else
    read -p "   Enter different URL: " PROD_URL
    if [ -n "$PROD_URL" ]; then
      backup_database "production" "$PROD_URL"
    fi
  fi
else
  echo "   ⏭️  Skipping production backup"
fi
echo ""

# Create README
cat > "$BACKUP_DIR/README.md" << EOF
# GlobalRx Database Backups

**Created:** $(date)
**Tool Version:** $(pg_dump --version | head -1)

## Backup Contents

- Development: Already backed up separately
- Staging: Railway staging environment
- Production: Railway production environment (if requested)

## Restore Instructions

### From uncompressed backup:
\`\`\`bash
psql \$DATABASE_URL < environment_full_backup.sql
\`\`\`

### From compressed backup:
\`\`\`bash
gunzip -c environment_full_backup.sql.gz | psql \$DATABASE_URL
\`\`\`

## Important Notes
- These backups include ALL data and schema
- Always test restore on a non-production database first
- Keep these backups secure - they contain sensitive data
EOF

# Summary
echo "📊 Backup Summary"
echo "================="
echo "✅ Backup directory: $BACKUP_DIR"
echo ""
echo "📋 Available backups:"
ls -lah "$BACKUP_DIR"/*.sql* 2>/dev/null || echo "   No backups created"

echo ""
echo "💡 You now have backups of:"
echo "   - Development (from earlier backup)"
echo "   - Staging (if successful)"
echo "   - Production (if requested and successful)"
echo ""
echo "🚀 Ready to proceed with data export and import!"