# GlobalRx Database Backups

**Created:** Sun Mar  1 15:27:03 EST 2026

## Backup Contents

This directory contains full database backups (schema + data) for:
- Development environment (if available)
- Staging environment (Railway)
- Production environment (if requested)

## File Formats

- `.sql` - Plain SQL dump (human-readable)
- `.sql.gz` - Compressed SQL dump (smaller size)

## Restore Instructions

### Restore from uncompressed backup:
```bash
psql $DATABASE_URL < environment_full_backup.sql
```

### Restore from compressed backup:
```bash
gunzip -c environment_full_backup.sql.gz | psql $DATABASE_URL
```

### Restore to Railway:
```bash
# For staging
railway run -e staging psql $DATABASE_URL < staging_full_backup.sql

# For production
railway run -e production psql $DATABASE_URL < production_full_backup.sql
```

## Important Notes

- These backups include ALL data and schema
- Always test restore on a non-production database first
- Keep these backups secure - they contain sensitive data
