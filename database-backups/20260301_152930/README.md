# GlobalRx Database Backups

**Created:** Sun Mar  1 15:30:32 EST 2026

## Restore Instructions

### From uncompressed backup:
```bash
psql $DATABASE_URL < environment_full_backup.sql
```

### From compressed backup:
```bash
gunzip -c environment_full_backup.sql.gz | psql $DATABASE_URL
```

## Important Notes
- These backups include ALL data and schema
- Always test restore on a non-production database first
- Keep these backups secure - they contain sensitive data
