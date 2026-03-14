#!/bin/bash

# GlobalRx Database Backup Script
# Creates timestamped backups of all three databases (dev, staging, prod)

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./db-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

echo -e "${GREEN}=== GlobalRx Database Backup ===${NC}"
echo -e "Timestamp: ${TIMESTAMP}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Function to backup a database
backup_database() {
    local DB_NAME=$1
    local DB_URL=$2
    local BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql"

    echo -e "${YELLOW}Backing up ${DB_NAME} database...${NC}"

    if [ -z "$DB_URL" ]; then
        echo -e "${RED}Error: Database URL for ${DB_NAME} not found${NC}"
        return 1
    fi

    # Remove query parameters from DATABASE_URL if present
    DB_URL_CLEAN=$(echo "$DB_URL" | sed 's/?.*$//')

    # Create backup using pg_dump with the full URL
    pg_dump "$DB_URL_CLEAN" \
        --no-owner \
        --no-privileges \
        --verbose \
        > "$BACKUP_FILE"

    if [ $? -eq 0 ]; then
        # Compress the backup
        gzip "$BACKUP_FILE"
        echo -e "${GREEN}✓ Backup saved: ${BACKUP_FILE}.gz${NC}"
        echo -e "  Size: $(ls -lh ${BACKUP_FILE}.gz | awk '{print $5}')"
    else
        echo -e "${RED}✗ Backup failed for ${DB_NAME}${NC}"
        return 1
    fi
}

# Check if pg_dump is installed
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}Error: pg_dump is not installed${NC}"
    echo "Please install PostgreSQL client tools:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Backup all databases
echo -e "${GREEN}Starting backup process...${NC}"
echo ""

# Development database
if [ ! -z "$DATABASE_URL" ]; then
    backup_database "dev" "$DATABASE_URL"
else
    echo -e "${YELLOW}Skipping dev database (DATABASE_URL not set)${NC}"
fi

echo ""

# Staging database
if [ ! -z "$DATABASE_URL_STAGING" ]; then
    backup_database "staging" "$DATABASE_URL_STAGING"
else
    echo -e "${YELLOW}Skipping staging database (DATABASE_URL_STAGING not set)${NC}"
fi

echo ""

# Production database
if [ ! -z "$DATABASE_URL_PROD" ]; then
    backup_database "prod" "$DATABASE_URL_PROD"
else
    echo -e "${YELLOW}Skipping production database (DATABASE_URL_PROD not set)${NC}"
fi

echo ""
echo -e "${GREEN}=== Backup Summary ===${NC}"
echo "Backup directory: ${BACKUP_DIR}"
echo "Timestamp: ${TIMESTAMP}"
echo ""
echo "Backups created:"
ls -lh "${BACKUP_DIR}"/*_${TIMESTAMP}.sql.gz 2>/dev/null || echo "No backups created"
echo ""
echo -e "${GREEN}Backup process complete!${NC}"