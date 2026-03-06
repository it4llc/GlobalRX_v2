# Service Comments Migration Guide

## Overview
This guide covers the database migration and deployment steps for the Service Comments feature (Phase 2b).

## Migration Date
March 6, 2026

## Database Migration

### Migration File
`prisma/migrations/20260305221507_add_service_comments/migration.sql`

### Schema Changes
The migration adds a new `ServiceComment` table with the following structure:

```sql
CREATE TABLE "ServiceComment" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "serviceId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "finalText" VARCHAR(1000) NOT NULL,
    "isInternalOnly" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updatedBy" UUID,
    "updatedAt" TIMESTAMPTZ
);
```

### Indexes Added
- Primary key on `id`
- Index on `serviceId` for query performance
- Index on `templateId` for template usage tracking
- Composite index on `(serviceId, createdAt)` for chronological queries

### Foreign Key Constraints
- `serviceId` → `ServicesFulfillment.id` (CASCADE delete)
- `templateId` → `CommentTemplate.id` (RESTRICT delete)
- `createdBy` → `User.id` (RESTRICT delete)
- `updatedBy` → `User.id` (SET NULL on delete)

## Migration Steps

### 1. Pre-Migration Checklist
- [ ] Backup database
- [ ] Notify users of potential brief downtime
- [ ] Ensure Comment Templates are configured
- [ ] Verify all tests pass: `pnpm test`

### 2. Run Migration

#### Development Environment
```bash
pnpm prisma migrate dev
```

#### Production Environment
```bash
pnpm prisma migrate deploy
```

### 3. Post-Migration Verification
```sql
-- Verify table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'ServiceComment';

-- Verify indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'ServiceComment';

-- Verify foreign key constraints
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'ServiceComment'
AND tc.constraint_type = 'FOREIGN KEY';
```

## Rollback Procedure

If issues arise, rollback using:

```bash
# Check migration history
pnpm prisma migrate status

# Rollback to previous migration
pnpm prisma migrate resolve --rolled-back 20260305221507_add_service_comments
```

**Warning**: Rollback will DELETE all service comments data.

## API Deployment

### New Endpoints
After migration, the following endpoints become available:
- POST `/api/services/{id}/comments`
- GET `/api/services/{id}/comments`
- PUT `/api/services/{id}/comments/{commentId}`
- GET `/api/orders/{id}/services/comments`

### Environment Variables
No new environment variables required for this feature.

### Permission Requirements
Users need `fulfillment` permission to use comment features.

## Testing Post-Migration

### 1. API Health Check
```bash
curl -X GET http://localhost:3000/api/health
```

### 2. Test Comment Creation
```bash
curl -X POST http://localhost:3000/api/services/{serviceId}/comments \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token={token}" \
  -d '{
    "templateId": "{template-uuid}",
    "finalText": "Test comment",
    "isInternalOnly": false
  }'
```

### 3. Run Integration Tests
```bash
pnpm test src/__tests__/integration/services/comments/
```

## Data Migration
No data migration required - this is a new feature with no existing data to migrate.

## Performance Considerations

### Expected Load
- Average: 10-50 comments per service
- Peak: 100-200 comments per service
- Query frequency: Moderate (loaded with service details)

### Monitoring
Monitor the following post-deployment:
- Comment creation rate
- Query performance on service comment retrieval
- Database table size growth

### Optimization Tips
If performance issues arise:
1. Add pagination to comment retrieval (not in Phase 2b)
2. Consider archiving old comments (> 1 year)
3. Add caching layer for frequently accessed comments

## Security Notes

1. **Text Sanitization**: All comment text is sanitized before storage
2. **Access Control**: Strict role-based access implemented
3. **Audit Trail**: All edits tracked with user and timestamp
4. **No Bulk Delete**: Comments cannot be deleted, only edited

## Known Limitations (Phase 2b)

1. No pagination for large comment lists
2. No comment deletion capability
3. No file attachments on comments
4. No threading/replies to comments
5. Frontend UI not yet implemented

## Support

For issues or questions:
- Check logs: `pnpm logs:prod`
- Review test output: `pnpm test`
- Database queries: Use read replica for debugging

## Phase 3 Preview

The next phase will add:
- Frontend UI components
- Real-time comment updates
- Comment notifications
- Export functionality
- Advanced filtering options