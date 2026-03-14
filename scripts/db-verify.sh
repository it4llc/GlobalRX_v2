#!/bin/bash

# GlobalRx Database Verification Script
# Verifies database connections and compares table structures

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo -e "${GREEN}=== GlobalRx Database Verification ===${NC}"
echo ""

# Function to extract database connection info
parse_database_url() {
    local DB_URL=$1
    if [[ $DB_URL =~ postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        echo "${BASH_REMATCH[1]}|${BASH_REMATCH[2]}|${BASH_REMATCH[3]}|${BASH_REMATCH[4]}|${BASH_REMATCH[5]}"
    else
        return 1
    fi
}

# Function to check database connection and get stats
check_database() {
    local ENV_NAME=$1
    local DB_URL=$2

    if [ -z "$DB_URL" ]; then
        echo -e "${YELLOW}⚠️  ${ENV_NAME}: Database URL not configured${NC}"
        return
    fi

    echo -e "${BLUE}Checking ${ENV_NAME} database...${NC}"

    IFS='|' read -r DB_USER DB_PASS DB_HOST DB_PORT DB_DATABASE <<< $(parse_database_url "$DB_URL")

    # Test connection
    if PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" -c '\q' 2>/dev/null; then
        echo -e "${GREEN}✓ Connection successful${NC}"

        # Get database size
        SIZE=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_DATABASE'));" | tr -d ' ')
        echo "  Database size: $SIZE"

        # Get table count
        TABLE_COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')
        echo "  Tables: $TABLE_COUNT"

        # Get row counts for main tables
        echo "  Row counts:"
        for table in users customers orders products services package_recipients; do
            COUNT=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ' || echo "N/A")
            printf "    %-20s %s\n" "$table:" "$COUNT"
        done

        # Check for active connections
        ACTIVE_CONNS=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" -t -c "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '$DB_DATABASE' AND state = 'active';" | tr -d ' ')
        echo "  Active connections: $ACTIVE_CONNS"

        # Get last migration
        LAST_MIGRATION=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_DATABASE" -t -c "SELECT migration_name FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1;" 2>/dev/null | tr -d ' ' || echo "Unknown")
        echo "  Last migration: $LAST_MIGRATION"

    else
        echo -e "${RED}✗ Connection failed${NC}"
    fi
    echo ""
}

# Function to compare two databases
compare_databases() {
    local ENV1_NAME=$1
    local ENV1_URL=$2
    local ENV2_NAME=$3
    local ENV2_URL=$4

    echo -e "${BLUE}Comparing ${ENV1_NAME} vs ${ENV2_NAME}...${NC}"

    if [ -z "$ENV1_URL" ] || [ -z "$ENV2_URL" ]; then
        echo -e "${YELLOW}Cannot compare - one or both database URLs missing${NC}"
        return
    fi

    IFS='|' read -r DB1_USER DB1_PASS DB1_HOST DB1_PORT DB1_DATABASE <<< $(parse_database_url "$ENV1_URL")
    IFS='|' read -r DB2_USER DB2_PASS DB2_HOST DB2_PORT DB2_DATABASE <<< $(parse_database_url "$ENV2_URL")

    # Compare table lists
    TABLES1=$(PGPASSWORD="$DB1_PASS" psql -h "$DB1_HOST" -p "$DB1_PORT" -U "$DB1_USER" -d "$DB1_DATABASE" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" | tr -d ' ')
    TABLES2=$(PGPASSWORD="$DB2_PASS" psql -h "$DB2_HOST" -p "$DB2_PORT" -U "$DB2_USER" -d "$DB2_DATABASE" -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" | tr -d ' ')

    if [ "$TABLES1" = "$TABLES2" ]; then
        echo -e "${GREEN}✓ Table structures match${NC}"
    else
        echo -e "${YELLOW}⚠️  Table structures differ${NC}"
        echo "  Tables in ${ENV1_NAME} only:"
        comm -23 <(echo "$TABLES1" | sort) <(echo "$TABLES2" | sort) | sed 's/^/    /'
        echo "  Tables in ${ENV2_NAME} only:"
        comm -13 <(echo "$TABLES1" | sort) <(echo "$TABLES2" | sort) | sed 's/^/    /'
    fi

    # Compare migration counts
    MIGRATIONS1=$(PGPASSWORD="$DB1_PASS" psql -h "$DB1_HOST" -p "$DB1_PORT" -U "$DB1_USER" -d "$DB1_DATABASE" -t -c "SELECT COUNT(*) FROM _prisma_migrations;" 2>/dev/null | tr -d ' ')
    MIGRATIONS2=$(PGPASSWORD="$DB2_PASS" psql -h "$DB2_HOST" -p "$DB2_PORT" -U "$DB2_USER" -d "$DB2_DATABASE" -t -c "SELECT COUNT(*) FROM _prisma_migrations;" 2>/dev/null | tr -d ' ')

    if [ "$MIGRATIONS1" = "$MIGRATIONS2" ]; then
        echo -e "${GREEN}✓ Migration counts match ($MIGRATIONS1)${NC}"
    else
        echo -e "${YELLOW}⚠️  Migration counts differ: ${ENV1_NAME}=$MIGRATIONS1, ${ENV2_NAME}=$MIGRATIONS2${NC}"
    fi
    echo ""
}

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql is not installed${NC}"
    echo "Please install PostgreSQL client tools:"
    echo "  macOS: brew install postgresql"
    echo "  Ubuntu: sudo apt-get install postgresql-client"
    exit 1
fi

# Check all databases
echo -e "${GREEN}Database Connection Status:${NC}"
echo ""
check_database "Development" "$DATABASE_URL"
check_database "Staging" "$DATABASE_URL_STAGING"
check_database "Production" "$DATABASE_URL_PROD"

# Compare database structures
echo -e "${GREEN}Database Structure Comparison:${NC}"
echo ""
compare_databases "Dev" "$DATABASE_URL" "Staging" "$DATABASE_URL_STAGING"
compare_databases "Dev" "$DATABASE_URL" "Production" "$DATABASE_URL_PROD"
compare_databases "Staging" "$DATABASE_URL_STAGING" "Production" "$DATABASE_URL_PROD"

# Check for backup directory
echo -e "${GREEN}Backup Status:${NC}"
if [ -d "./db-backups" ]; then
    BACKUP_COUNT=$(ls -1 ./db-backups/*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
    if [ "$BACKUP_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Found $BACKUP_COUNT backup file(s)${NC}"
        echo "  Latest backups:"
        ls -lt ./db-backups/*.sql.gz 2>/dev/null | head -5 | awk '{print "    " $9 " (" $5 ")"}'
    else
        echo -e "${YELLOW}No backup files found${NC}"
    fi
else
    echo -e "${YELLOW}Backup directory does not exist${NC}"
fi
echo ""

# Safety reminders
echo -e "${YELLOW}=== Safety Reminders ===${NC}"
echo "• Always backup before syncing databases"
echo "• Ensure code is synchronized across environments before DB sync"
echo "• Test thoroughly after any database sync"
echo "• Keep backups for at least 30 days"
echo ""

echo -e "${GREEN}Verification complete!${NC}"