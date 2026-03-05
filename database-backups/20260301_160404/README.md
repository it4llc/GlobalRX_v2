# GlobalRx Database Backups

**Created:** Sun Mar  1 16:04:05 EST 2026
**Tool Version:** pg_dump (PostgreSQL) 17.9 (Homebrew)

## Backup Contents

- Development: Already backed up separately
- Staging: Railway staging environment
- Production: Railway production environment (if requested)

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
