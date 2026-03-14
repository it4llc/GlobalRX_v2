#!/bin/bash

# GlobalRx Database Sync Script
# Safely copies dev database to staging and/or production
# ALWAYS backs up target databases first

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TEMP_DIR="/tmp/globalrx_db_sync_${TIMESTAMP}"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo -e "${GREEN}=== GlobalRx Database Sync ===${NC}"
echo -e "${RED}⚠️  WARNING: This will REPLACE the target database(s)${NC}"
echo ""

# Parse command line arguments
TARGET=""
SKIP_BACKUP=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --staging)
            TARGET="staging"
            shift
            ;;
        --prod|--production)
            TARGET="prod"
            shift
            ;;
        --all)
            TARGET="all"
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--staging|--prod|--all] [--skip-backup] [--force]"
            echo ""
            echo "Options:"
            echo "  --staging       Sync dev to staging only"
            echo "  --prod          Sync dev to production only"
            echo "  --all           Sync dev to both staging and production"
            echo "  --skip-backup   Skip backup step (NOT RECOMMENDED)"
            echo "  --force         Skip confirmation prompts"
            echo ""
            echo "Examples:"
            echo "  $0 --staging              # Sync dev → staging"
            echo "  $0 --prod                 # Sync dev → production"
            echo "  $0 --all                  # Sync dev → staging and production"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Validate target
if [ -z "$TARGET" ]; then
    echo -e "${RED}Error: No target specified${NC}"
    echo "Use --staging, --prod, or --all"
    echo "Run '$0 --help' for usage information"
    exit 1
fi

# Check if pg_dump and pg_restore are installed
if ! command -v pg_dump &> /dev/null || ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: PostgreSQL client tools not installed${NC}"
    echo "Please install PostgreSQL client tools:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Create temp directory
mkdir -p "$TEMP_DIR"
mkdir -p "$BACKUP_DIR"

# Function to extract database connection info
parse_database_url() {
    local DB_URL=$1
    if [[ $DB_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        echo "${BASH_REMATCH[1]}|${BASH_REMATCH[2]}|${BASH_REMATCH[3]}|${BASH_REMATCH[4]}|${BASH_REMATCH[5]}"
    else
        return 1
    fi
}

# Function to backup a database
backup_database() {
    local DB_NAME=$1
    local DB_URL=$2
    local BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_pre_sync_${TIMESTAMP}.sql.gz"

    echo -e "${YELLOW}Backing up ${DB_NAME} database...${NC}"

    IFS='|' read -r DB_USER DB_PASS DB_HOST DB_PORT DB_DATABASE <<< $(parse_database_url "$DB_URL")

    PGPASSWORD="$DB_PASS" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_DATABASE" \
        --no-owner \
        --no-privileges \
        --verbose \
        | gzip > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Backup saved: ${BACKUP_FILE}${NC}"
        echo -e "  Size: $(ls -lh ${BACKUP_FILE} | awk '{print $5}')"
    else
        echo -e "${RED}✗ Backup failed for ${DB_NAME}${NC}"
        return 1
    fi
}

# Function to sync databases
sync_database() {
    local TARGET_NAME=$1
    local TARGET_URL=$2
    local SOURCE_DUMP="${TEMP_DIR}/dev_database.sql"

    echo ""
    echo -e "${BLUE}=== Syncing to ${TARGET_NAME} ===${NC}"

    # Backup target database first (unless skipped)
    if [ "$SKIP_BACKUP" = false ]; then
        backup_database "$TARGET_NAME" "$TARGET_URL"
    else
        echo -e "${YELLOW}⚠️  Skipping backup (--skip-backup flag used)${NC}"
    fi

    # Parse target database connection
    IFS='|' read -r TARGET_USER TARGET_PASS TARGET_HOST TARGET_PORT TARGET_DATABASE <<< $(parse_database_url "$TARGET_URL")

    echo -e "${YELLOW}Dropping and recreating ${TARGET_NAME} database...${NC}"

    # Drop all tables in target database (safer than DROP DATABASE on managed services)
    PGPASSWORD="$TARGET_PASS" psql \
        -h "$TARGET_HOST" \
        -p "$TARGET_PORT" \
        -U "$TARGET_USER" \
        -d "$TARGET_DATABASE" \
        -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

    echo -e "${YELLOW}Restoring dev database to ${TARGET_NAME}...${NC}"

    # Restore the dump to target
    PGPASSWORD="$TARGET_PASS" psql \
        -h "$TARGET_HOST" \
        -p "$TARGET_PORT" \
        -U "$TARGET_USER" \
        -d "$TARGET_DATABASE" \
        < "$SOURCE_DUMP"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Successfully synced dev → ${TARGET_NAME}${NC}"
    else
        echo -e "${RED}✗ Sync failed for ${TARGET_NAME}${NC}"
        return 1
    fi
}

# Check source database
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}Error: Dev database URL (DATABASE_URL) not found${NC}"
    exit 1
fi

# Display sync plan
echo -e "${BLUE}Sync Plan:${NC}"
echo "  Source: dev database"
echo -n "  Targets: "
case $TARGET in
    staging)
        echo "staging"
        if [ -z "$DATABASE_URL_STAGING" ]; then
            echo -e "${RED}Error: Staging database URL (DATABASE_URL_STAGING) not found${NC}"
            exit 1
        fi
        ;;
    prod)
        echo "production"
        if [ -z "$DATABASE_URL_PROD" ]; then
            echo -e "${RED}Error: Production database URL (DATABASE_URL_PROD) not found${NC}"
            exit 1
        fi
        ;;
    all)
        echo "staging and production"
        if [ -z "$DATABASE_URL_STAGING" ] || [ -z "$DATABASE_URL_PROD" ]; then
            echo -e "${RED}Error: One or more target database URLs not found${NC}"
            exit 1
        fi
        ;;
esac
echo ""

# Confirmation prompt (unless --force is used)
if [ "$FORCE" = false ]; then
    echo -e "${YELLOW}⚠️  This will PERMANENTLY REPLACE the target database(s) with dev data${NC}"
    echo -e "${YELLOW}   Make sure all code is synchronized across environments first!${NC}"
    echo ""
    read -p "Are you sure you want to continue? Type 'yes' to proceed: " -r
    echo
    if [[ ! $REPLY == "yes" ]]; then
        echo "Sync cancelled"
        exit 0
    fi
fi

# Create dump of dev database
echo -e "${YELLOW}Creating dump of dev database...${NC}"
IFS='|' read -r DEV_USER DEV_PASS DEV_HOST DEV_PORT DEV_DATABASE <<< $(parse_database_url "$DATABASE_URL")

PGPASSWORD="$DEV_PASS" pg_dump \
    -h "$DEV_HOST" \
    -p "$DEV_PORT" \
    -U "$DEV_USER" \
    -d "$DEV_DATABASE" \
    --no-owner \
    --no-privileges \
    --verbose \
    > "${TEMP_DIR}/dev_database.sql"

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to dump dev database${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Dev database dump created${NC}"
echo -e "  Size: $(ls -lh ${TEMP_DIR}/dev_database.sql | awk '{print $5}')"

# Perform sync based on target
case $TARGET in
    staging)
        sync_database "staging" "$DATABASE_URL_STAGING"
        ;;
    prod)
        sync_database "production" "$DATABASE_URL_PROD"
        ;;
    all)
        sync_database "staging" "$DATABASE_URL_STAGING"
        sync_database "production" "$DATABASE_URL_PROD"
        ;;
esac

# Cleanup
echo ""
echo -e "${YELLOW}Cleaning up temporary files...${NC}"
rm -rf "$TEMP_DIR"

# Summary
echo ""
echo -e "${GREEN}=== Sync Complete ===${NC}"
echo "Timestamp: ${TIMESTAMP}"
echo ""
if [ "$SKIP_BACKUP" = false ]; then
    echo "Backups saved in: ${BACKUP_DIR}"
    ls -lh "${BACKUP_DIR}"/*_pre_sync_${TIMESTAMP}.sql.gz 2>/dev/null
fi
echo ""
echo -e "${GREEN}✓ Database sync completed successfully!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the synced environment(s) thoroughly"
echo "2. Monitor for any issues"
echo "3. Keep the backups for at least 30 days"