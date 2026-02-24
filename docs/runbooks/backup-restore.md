# Backup and Restore Procedures
**Created:** February 23, 2026
**Status:** Manual Process - Automation Required

## Current Backup State Analysis

### Existing Backup Files (Manual Process)
Located in `/backups/` directory:

| File | Size | Date | Type | Purpose |
|------|------|------|------|---------|
| `globalrx_backup_20260214_102608.sql` | 443KB | Feb 14 | SQL dump | Latest full backup |
| `globalrx_backup_20260214_102700_compressed.sql.gz` | 108KB | Feb 14 | Compressed SQL | Space-optimized backup |
| `globalrx_backup_20260214_custom.dump` | 171KB | Feb 14 | Custom format | Fast restore backup |
| `backup_before_portal_migration_20260125_203800.sql` | 113KB | Jan 25 | Pre-migration | Safety backup |
| `full_backup_before_migration_reset_20260125_204459.sql` | 113KB | Jan 25 | Migration safety | Complete schema |

### Backup Quality Assessment
✅ **Strengths:**
- Multiple backup formats (SQL, compressed, custom)
- Consistent naming convention with timestamps
- Pre-migration safety backups
- Good size progression showing data growth

❌ **Critical Gaps:**
- No automated backup process
- No backup verification testing
- No backup retention policy
- No remote storage (single point of failure)
- No monitoring for backup success/failure

## Automated Backup Implementation

### 1. Daily Backup Automation

#### Create Backup Script
```bash
#!/bin/bash
# scripts/backup-database.sh

set -e  # Exit on error
set -u  # Exit on undefined variable

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_URL="${DATABASE_URL}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup at $(date)"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to send alerts (implement based on your alerting system)
send_alert() {
    local message="$1"
    local severity="$2"

    # Example: Slack webhook
    # curl -X POST -H 'Content-type: application/json' \
    #     --data "{\"text\":\"[GlobalRx] $severity: $message\"}" \
    #     "$SLACK_WEBHOOK_URL"

    echo "ALERT [$severity]: $message"
}

# Create multiple backup formats
create_backups() {
    local prefix="globalrx_backup_${TIMESTAMP}"

    log "Creating SQL dump backup..."
    if pg_dump "$DB_URL" > "$BACKUP_DIR/${prefix}.sql"; then
        log "SQL dump completed: ${prefix}.sql"
    else
        send_alert "SQL dump failed" "CRITICAL"
        exit 1
    fi

    log "Creating compressed backup..."
    if pg_dump "$DB_URL" | gzip > "$BACKUP_DIR/${prefix}_compressed.sql.gz"; then
        log "Compressed backup completed: ${prefix}_compressed.sql.gz"
    else
        send_alert "Compressed backup failed" "CRITICAL"
        exit 1
    fi

    log "Creating custom format backup..."
    if pg_dump -Fc "$DB_URL" > "$BACKUP_DIR/${prefix}_custom.dump"; then
        log "Custom format backup completed: ${prefix}_custom.dump"
    else
        send_alert "Custom format backup failed" "CRITICAL"
        exit 1
    fi
}

# Verify backup integrity
verify_backups() {
    local prefix="globalrx_backup_${TIMESTAMP}"

    log "Verifying backup integrity..."

    # Check file sizes (should be > 0)
    for format in "sql" "compressed.sql.gz" "custom.dump"; do
        file="$BACKUP_DIR/${prefix}"
        if [ "$format" = "compressed.sql.gz" ]; then
            file="${file}_compressed.sql.gz"
        elif [ "$format" = "custom.dump" ]; then
            file="${file}_custom.dump"
        else
            file="${file}.sql"
        fi

        if [ ! -s "$file" ]; then
            send_alert "Backup file is empty: $file" "CRITICAL"
            exit 1
        fi

        size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo "0")
        log "Backup file $file: ${size} bytes"
    done

    # Test custom format backup (fastest to verify)
    log "Testing backup restoration (dry run)..."
    if pg_restore --list "$BACKUP_DIR/${prefix}_custom.dump" >/dev/null 2>&1; then
        log "Backup verification successful"
    else
        send_alert "Backup verification failed" "CRITICAL"
        exit 1
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."

    find "$BACKUP_DIR" -name "globalrx_backup_*" -type f -mtime +$RETENTION_DAYS -delete

    remaining=$(find "$BACKUP_DIR" -name "globalrx_backup_*" -type f | wc -l)
    log "Cleanup completed. Remaining backup files: $remaining"
}

# Upload to remote storage (implement based on your cloud provider)
upload_to_remote() {
    local prefix="globalrx_backup_${TIMESTAMP}"

    # Example for AWS S3
    # aws s3 cp "$BACKUP_DIR/${prefix}_custom.dump" \
    #     "s3://globalrx-backups/database/${prefix}_custom.dump"

    # Example for Google Cloud Storage
    # gsutil cp "$BACKUP_DIR/${prefix}_custom.dump" \
    #     "gs://globalrx-backups/database/${prefix}_custom.dump"

    log "Remote upload placeholder - implement based on cloud provider"
}

# Generate backup metrics
generate_metrics() {
    local prefix="globalrx_backup_${TIMESTAMP}"
    local sql_size=$(stat -f%z "$BACKUP_DIR/${prefix}.sql" 2>/dev/null || stat -c%s "$BACKUP_DIR/${prefix}.sql")
    local duration=$(($(date +%s) - start_time))

    # Send metrics to monitoring system
    cat > "$BACKUP_DIR/backup_metrics_${TIMESTAMP}.json" << EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_size_bytes": $sql_size,
    "duration_seconds": $duration,
    "status": "success",
    "files_created": 3,
    "retention_days": $RETENTION_DAYS
}
EOF

    log "Backup metrics saved"
}

# Main execution
main() {
    local start_time=$(date +%s)

    log "=== Database Backup Started ==="

    create_backups
    verify_backups
    cleanup_old_backups
    upload_to_remote
    generate_metrics

    local duration=$(($(date +%s) - start_time))
    log "=== Backup Completed Successfully in ${duration}s ==="

    send_alert "Database backup completed successfully" "INFO"
}

# Execute if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
```

#### Make Script Executable
```bash
chmod +x scripts/backup-database.sh
```

### 2. Automated Scheduling

#### Using Cron (Linux/macOS)
```bash
# Add to crontab: crontab -e
# Run daily at 2 AM
0 2 * * * /path/to/globalrx/scripts/backup-database.sh >> /var/log/globalrx-backup.log 2>&1

# Run every 6 hours for more frequent backups
0 */6 * * * /path/to/globalrx/scripts/backup-database.sh
```

#### Using GitHub Actions (CI/CD)
```yaml
# .github/workflows/backup.yml
name: Database Backup

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  backup:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v3

    - name: Setup PostgreSQL client
      run: |
        sudo apt-get update
        sudo apt-get install -y postgresql-client

    - name: Run backup
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
        SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
      run: |
        ./scripts/backup-database.sh

    - name: Upload backup to S3
      env:
        AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
        AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      run: |
        aws s3 sync ./backups s3://globalrx-backups/$(date +%Y/%m/%d)/
```

### 3. Container-based Backup (Docker/Kubernetes)

#### Dockerfile for backup container
```dockerfile
# backup.Dockerfile
FROM postgres:15-alpine

RUN apk add --no-cache \
    aws-cli \
    curl \
    bash

COPY scripts/backup-database.sh /usr/local/bin/backup
RUN chmod +x /usr/local/bin/backup

CMD ["/usr/local/bin/backup"]
```

#### Kubernetes CronJob
```yaml
# k8s/backup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: globalrx/backup:latest
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-secret
                  key: url
            - name: AWS_ACCESS_KEY_ID
              valueFrom:
                secretKeyRef:
                  name: backup-secret
                  key: access-key-id
            volumeMounts:
            - name: backup-storage
              mountPath: /backups
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
```

## Restore Procedures

### 1. Full Database Restore

#### Emergency Restore Script
```bash
#!/bin/bash
# scripts/restore-database.sh

set -e

BACKUP_FILE="$1"
DB_URL="${DATABASE_URL}"
RESTORE_CONFIRMATION="$2"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file> [CONFIRM]"
    echo ""
    echo "Available backups:"
    ls -la backups/globalrx_backup_* | head -10
    exit 1
fi

if [ "$RESTORE_CONFIRMATION" != "CONFIRM" ]; then
    echo "⚠️  WARNING: This will completely replace the current database!"
    echo "⚠️  All current data will be lost!"
    echo ""
    echo "To proceed, run: $0 $BACKUP_FILE CONFIRM"
    exit 1
fi

echo "🔄 Starting database restore from: $BACKUP_FILE"
echo "🕐 Started at: $(date)"

# Create a safety backup of current state
echo "📦 Creating safety backup of current database..."
SAFETY_BACKUP="backups/safety_backup_before_restore_$(date +%Y%m%d_%H%M%S).sql"
pg_dump "$DB_URL" > "$SAFETY_BACKUP"
echo "✅ Safety backup created: $SAFETY_BACKUP"

# Determine backup format and restore accordingly
if [[ "$BACKUP_FILE" == *.sql.gz ]]; then
    echo "📥 Restoring from compressed SQL dump..."
    gunzip -c "$BACKUP_FILE" | psql "$DB_URL"
elif [[ "$BACKUP_FILE" == *.dump ]]; then
    echo "📥 Restoring from custom format dump..."
    pg_restore -d "$DB_URL" --clean --if-exists "$BACKUP_FILE"
elif [[ "$BACKUP_FILE" == *.sql ]]; then
    echo "📥 Restoring from SQL dump..."
    psql "$DB_URL" < "$BACKUP_FILE"
else
    echo "❌ Unknown backup format: $BACKUP_FILE"
    exit 1
fi

echo "✅ Database restore completed at: $(date)"

# Verify restore
echo "🔍 Verifying restored database..."
RECORD_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
echo "✅ Users table contains $RECORD_COUNT records"

echo "🎉 Restore completed successfully!"
```

### 2. Point-in-Time Recovery

#### Using WAL-E or similar tools
```bash
#!/bin/bash
# scripts/point-in-time-restore.sh

TARGET_TIME="$1"  # Format: 2026-02-23 14:30:00

if [ -z "$TARGET_TIME" ]; then
    echo "Usage: $0 'YYYY-MM-DD HH:MM:SS'"
    exit 1
fi

echo "🕐 Performing point-in-time recovery to: $TARGET_TIME"

# This requires WAL archiving to be set up
# See PostgreSQL documentation for WAL-E setup

pg_restore -d "$DB_URL" \
    --clean \
    --if-exists \
    --target-time="$TARGET_TIME" \
    path/to/base/backup
```

### 3. Selective Data Restore

#### Restore specific tables
```bash
#!/bin/bash
# scripts/restore-table.sh

BACKUP_FILE="$1"
TABLE_NAME="$2"
TEMP_DB="globalrx_temp_restore"

if [ -z "$BACKUP_FILE" ] || [ -z "$TABLE_NAME" ]; then
    echo "Usage: $0 <backup_file> <table_name>"
    exit 1
fi

echo "🔄 Restoring table '$TABLE_NAME' from $BACKUP_FILE"

# Create temporary database
createdb "$TEMP_DB"

# Restore backup to temp database
if [[ "$BACKUP_FILE" == *.dump ]]; then
    pg_restore -d "$TEMP_DB" "$BACKUP_FILE"
else
    psql "$TEMP_DB" < "$BACKUP_FILE"
fi

# Dump specific table and restore to main database
pg_dump "$TEMP_DB" --table="$TABLE_NAME" | psql "$DATABASE_URL"

# Cleanup
dropdb "$TEMP_DB"

echo "✅ Table '$TABLE_NAME' restored successfully"
```

## Backup Testing and Validation

### 1. Automated Restore Testing

#### Weekly Restore Test Script
```bash
#!/bin/bash
# scripts/test-backup-restore.sh

set -e

LATEST_BACKUP=$(ls -t backups/globalrx_backup_*_custom.dump | head -1)
TEST_DB="globalrx_restore_test_$(date +%s)"

echo "🧪 Testing restore of: $LATEST_BACKUP"

# Create test database
createdb "$TEST_DB"

# Restore backup
pg_restore -d "$TEST_DB" "$LATEST_BACKUP"

# Run validation queries
echo "🔍 Running validation tests..."

# Test 1: Check table count
EXPECTED_TABLES=26  # Update based on your schema
ACTUAL_TABLES=$(psql "$TEST_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" | tr -d ' ')

if [ "$ACTUAL_TABLES" -ne "$EXPECTED_TABLES" ]; then
    echo "❌ Table count mismatch: expected $EXPECTED_TABLES, got $ACTUAL_TABLES"
    dropdb "$TEST_DB"
    exit 1
fi

# Test 2: Check data integrity
USERS_COUNT=$(psql "$TEST_DB" -t -c "SELECT COUNT(*) FROM users;" | tr -d ' ')
CUSTOMERS_COUNT=$(psql "$TEST_DB" -t -c "SELECT COUNT(*) FROM customers;" | tr -d ' ')

echo "✅ Users: $USERS_COUNT records"
echo "✅ Customers: $CUSTOMERS_COUNT records"

# Test 3: Check constraints and indexes
CONSTRAINT_ERRORS=$(psql "$TEST_DB" -t -c "
    SELECT COUNT(*) FROM (
        SELECT conname FROM pg_constraint
        WHERE confrelid IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM pg_constraint c2
            WHERE c2.conname = pg_constraint.conname
            AND c2.conrelid = pg_constraint.conrelid
        )
    ) AS broken_constraints;
" | tr -d ' ')

if [ "$CONSTRAINT_ERRORS" -gt 0 ]; then
    echo "❌ Found $CONSTRAINT_ERRORS constraint errors"
    dropdb "$TEST_DB"
    exit 1
fi

# Cleanup
dropdb "$TEST_DB"

echo "✅ Backup restore test passed!"

# Log success
cat >> logs/backup-test.log << EOF
$(date): Backup restore test PASSED
- Backup file: $LATEST_BACKUP
- Tables validated: $ACTUAL_TABLES
- Users: $USERS_COUNT
- Customers: $CUSTOMERS_COUNT
EOF
```

### 2. Backup Monitoring

#### Monitoring Script
```bash
#!/bin/bash
# scripts/monitor-backups.sh

BACKUP_DIR="./backups"
EXPECTED_DAILY_BACKUPS=1
ALERT_IF_OLDER_THAN_HOURS=25

# Check if recent backup exists
LATEST_BACKUP=$(find "$BACKUP_DIR" -name "globalrx_backup_*" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ CRITICAL: No backups found!"
    exit 1
fi

# Check backup age
BACKUP_AGE_HOURS=$(( ($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")) / 3600 ))

if [ "$BACKUP_AGE_HOURS" -gt "$ALERT_IF_OLDER_THAN_HOURS" ]; then
    echo "⚠️ WARNING: Latest backup is $BACKUP_AGE_HOURS hours old"
    echo "Latest backup: $LATEST_BACKUP"
    exit 1
fi

# Check backup count
RECENT_BACKUPS=$(find "$BACKUP_DIR" -name "globalrx_backup_*" -type f -newermt "1 day ago" | wc -l)

if [ "$RECENT_BACKUPS" -lt "$EXPECTED_DAILY_BACKUPS" ]; then
    echo "⚠️ WARNING: Only $RECENT_BACKUPS backups in last 24 hours (expected $EXPECTED_DAILY_BACKUPS)"
    exit 1
fi

echo "✅ Backup monitoring passed"
echo "✅ Latest backup: $(basename "$LATEST_BACKUP") ($BACKUP_AGE_HOURS hours ago)"
echo "✅ Recent backups: $RECENT_BACKUPS"
```

## Disaster Recovery Plan

### 1. Recovery Time Objectives (RTO)
- **Critical systems**: 15 minutes
- **Standard operations**: 1 hour
- **Full functionality**: 4 hours

### 2. Recovery Point Objectives (RPO)
- **Transaction data**: 15 minutes (with WAL archiving)
- **Daily operations**: 1 hour
- **Analytics data**: 24 hours

### 3. Disaster Scenarios

#### Scenario 1: Database Corruption
```bash
# 1. Stop application
kubectl scale deployment globalrx-api --replicas=0

# 2. Assess corruption extent
pg_dump --schema-only $DATABASE_URL > schema_check.sql

# 3. Restore from latest backup
./scripts/restore-database.sh backups/latest_backup.dump CONFIRM

# 4. Verify and restart
./scripts/test-backup-restore.sh
kubectl scale deployment globalrx-api --replicas=3
```

#### Scenario 2: Complete Data Center Loss
```bash
# 1. Provision new infrastructure
# 2. Download backups from remote storage
aws s3 sync s3://globalrx-backups/latest/ ./backups/

# 3. Create new database instance
# 4. Restore from backup
./scripts/restore-database.sh backups/latest_backup.dump CONFIRM

# 5. Update DNS and deploy application
```

## Security Considerations

### 1. Backup Encryption
```bash
# Encrypt backups before storage
pg_dump $DATABASE_URL | gpg --cipher-algo AES256 --compress-algo 1 --symmetric > backup_encrypted.sql.gpg

# Decrypt for restore
gpg --decrypt backup_encrypted.sql.gpg | psql $DATABASE_URL
```

### 2. Access Control
- Limit backup script execution to specific users
- Use IAM roles for cloud storage access
- Encrypt backups in transit and at rest
- Audit backup access logs

### 3. Retention Policies
- **Daily backups**: 30 days
- **Weekly backups**: 12 weeks
- **Monthly backups**: 12 months
- **Yearly backups**: 7 years (compliance)

## Implementation Timeline

### Week 1: Basic Automation
- [ ] Create backup script
- [ ] Set up daily cron job
- [ ] Implement basic monitoring

### Week 2: Validation and Testing
- [ ] Add backup verification
- [ ] Create restore procedures
- [ ] Test restore process

### Week 3: Remote Storage
- [ ] Set up cloud storage
- [ ] Implement upload automation
- [ ] Test disaster recovery

### Week 4: Monitoring and Alerting
- [ ] Add comprehensive monitoring
- [ ] Set up alert notifications
- [ ] Document all procedures

### Estimated Costs
- **Development time**: 2 weeks
- **Cloud storage**: $20-50/month
- **Monitoring tools**: $0 (use existing)
- **Total monthly**: $20-50