# Feature Specification: ServicesFulfillment Backfill Migration
**Spec file:** `docs/specs/servicefulfillment-backfill-migration.md`
**Date:** 2026-03-19
**Requested by:** Andy
**Status:** Confirmed

## Summary
A one-time database migration that creates missing ServicesFulfillment records for all existing OrderItems that were created before the auto-creation feature was implemented. This migration ensures data consistency by establishing the required 1:1 relationship between every OrderItem and ServicesFulfillment record in the database.

## Who Uses This
- **System** - Automatically runs the migration when deployed
- **Database Administrator** - Can monitor migration progress through logs
- **Internal Admin Users** - Will see ServicesFulfillment records for all historical OrderItems after migration completes
- **Fulfillment Users** - Can assign vendors and track fulfillment for all historical OrderItems after migration

## Business Rules
1. Every OrderItem in the database must have exactly one corresponding ServicesFulfillment record
2. The migration must be idempotent — safe to run multiple times without creating duplicates
3. ServicesFulfillment records created by the migration start with `assignedVendorId: null` (no auto-assignment)
4. All optional fields in backfilled ServicesFulfillment records start as null
5. The migration must preserve existing ServicesFulfillment records without modification
6. The migration runs automatically during deployment as a standard Prisma migration
7. The entire migration must complete successfully or roll back completely (no partial state)
8. The migration must log the count of records backfilled for audit purposes

## User Flow
### Automatic Execution During Deployment
1. DevOps runs the standard deployment process
2. Prisma detects the new migration file in `prisma/migrations/20260319_backfill_services_fulfillment/`
3. The migration automatically executes:
   - Identifies all OrderItems without a ServicesFulfillment record
   - Creates ServicesFulfillment records for each identified OrderItem
   - All operations occur within a single transaction
4. Migration completes and logs: "Backfilled X ServicesFulfillment records"
5. Deployment continues with remaining steps
6. Admin users can immediately see ServicesFulfillment records for all OrderItems in the system

### Manual Verification (Post-Migration)
1. Database administrator connects to the database
2. Runs verification query to confirm all OrderItems have ServicesFulfillment records
3. Confirms counts match: `SELECT COUNT(*) FROM order_items` equals `SELECT COUNT(DISTINCT "orderItemId") FROM "ServicesFulfillment"`
4. Reviews migration logs for completion message

## Data Requirements

| UI Label | Field Name | Type | Required | Validation | Default |
|---|---|---|---|---|---|
| ID | id | text (UUID) | Required | Must be unique UUID | gen_random_uuid() |
| Order ID | orderId | text | Required | Must match OrderItem's orderId | From OrderItem |
| Order Item ID | orderItemId | text | Required | Must be unique, matches OrderItem.id | From OrderItem |
| Service ID | serviceId | text | Required | Must match OrderItem's serviceId | From OrderItem |
| Location ID | locationId | text | Required | Must match OrderItem's locationId | From OrderItem |
| Assigned Vendor | assignedVendorId | text | Optional | Must be null for backfill | null |
| Vendor Notes | vendorNotes | text | Optional | Must be null for backfill | null |
| Internal Notes | internalNotes | text | Optional | Must be null for backfill | null |
| Assigned At | assignedAt | datetime | Optional | Must be null for backfill | null |
| Assigned By | assignedBy | text | Optional | Must be null for backfill | null |
| Completed At | completedAt | datetime | Optional | Must be null for backfill | null |
| Created At | createdAt | datetime | Required | Set to current timestamp | NOW() |
| Updated At | updatedAt | datetime | Required | Set to current timestamp | NOW() |
| Results | results | text | Optional | Must be null for backfill | null |
| Results Added By | resultsAddedBy | text | Optional | Must be null for backfill | null |
| Results Added At | resultsAddedAt | datetime | Optional | Must be null for backfill | null |
| Results Last Modified By | resultsLastModifiedBy | text | Optional | Must be null for backfill | null |
| Results Last Modified At | resultsLastModifiedAt | datetime | Optional | Must be null for backfill | null |

## Edge Cases and Error Scenarios
1. **OrderItem with existing ServicesFulfillment record**
   - Migration uses `ON CONFLICT ("orderItemId") DO NOTHING` clause
   - Existing record is preserved unchanged
   - No duplicate is created

2. **Database constraint violation during migration**
   - Entire transaction rolls back
   - No partial records are created
   - Error is logged with details
   - Deployment fails and requires investigation

3. **Network/database failure during migration**
   - Transaction automatically rolls back
   - No records are created
   - Migration can be retried on next deployment

4. **Migration run multiple times**
   - Second and subsequent runs find no OrderItems to backfill
   - Migration completes successfully with "Backfilled 0 ServicesFulfillment records"
   - No errors occur, no duplicates created

5. **OrderItem with invalid foreign keys (orphaned records)**
   - Migration skips these records (they shouldn't exist due to FK constraints)
   - Count of skipped records is logged if any exist
   - Migration continues for valid OrderItems

## Impact on Other Modules
- **Fulfillment Module** - All historical OrderItems become immediately available for vendor assignment
- **Order Details Page** - Historical orders now show complete fulfillment tracking capabilities
- **Reporting Module** - Historical data now included in fulfillment reports and metrics
- **Vendor Assignment** - Can retroactively assign vendors to historical OrderItems
- **Service Comments** - Existing comments remain linked through OrderItem relationship

## Definition of Done
1. Migration file created at `prisma/migrations/20260319_backfill_services_fulfillment/migration.sql`
2. Migration uses single transaction for data consistency
3. Migration includes idempotency protection (ON CONFLICT clause)
4. Migration logs count of backfilled records
5. Verification query confirms all OrderItems have ServicesFulfillment records
6. Migration can be run multiple times without errors
7. No existing ServicesFulfillment records are modified
8. All backfilled records have `assignedVendorId: null`
9. Performance impact on production database is acceptable (completes within 5 minutes for typical data volumes)
10. Migration includes comments explaining the purpose and logic

## Open Questions
None - all requirements have been clarified and confirmed.

## Technical Implementation Details

### Migration File Structure
```sql
-- One-time backfill migration: Create missing ServicesFulfillment records for existing OrderItems
-- This ensures every OrderItem has a corresponding ServicesFulfillment record
-- Safe to run multiple times (idempotent)

-- Create ServicesFulfillment records for OrderItems that don't have one
INSERT INTO "ServicesFulfillment" (
  "id",
  "orderId",
  "orderItemId",
  "serviceId",
  "locationId",
  "assignedVendorId",
  "vendorNotes",
  "internalNotes",
  "assignedAt",
  "assignedBy",
  "completedAt",
  "results",
  "resultsAddedBy",
  "resultsAddedAt",
  "resultsLastModifiedBy",
  "resultsLastModifiedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid(),
  oi."orderId",
  oi."id",
  oi."serviceId",
  oi."locationId",
  NULL, -- assignedVendorId
  NULL, -- vendorNotes
  NULL, -- internalNotes
  NULL, -- assignedAt
  NULL, -- assignedBy
  NULL, -- completedAt
  NULL, -- results
  NULL, -- resultsAddedBy
  NULL, -- resultsAddedAt
  NULL, -- resultsLastModifiedBy
  NULL, -- resultsLastModifiedAt
  NOW(),
  NOW()
FROM "order_items" oi
LEFT JOIN "ServicesFulfillment" sf ON sf."orderItemId" = oi."id"
WHERE sf."id" IS NULL
ON CONFLICT ("orderItemId") DO NOTHING;

-- Log the number of records backfilled (this will appear in migration output)
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  -- Count records just created (those without assignedVendorId and created in last minute)
  SELECT COUNT(*) INTO backfilled_count
  FROM "ServicesFulfillment"
  WHERE "assignedVendorId" IS NULL
    AND "createdAt" >= NOW() - INTERVAL '1 minute';

  RAISE NOTICE 'Backfilled % ServicesFulfillment records', backfilled_count;
END $$;

-- Verification: Ensure every OrderItem now has a ServicesFulfillment record
DO $$
DECLARE
  order_items_count INTEGER;
  fulfillments_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO order_items_count FROM "order_items";
  SELECT COUNT(DISTINCT "orderItemId") INTO fulfillments_count FROM "ServicesFulfillment";

  IF order_items_count != fulfillments_count THEN
    RAISE WARNING 'Mismatch: % OrderItems but % ServicesFulfillment records', order_items_count, fulfillments_count;
  ELSE
    RAISE NOTICE 'Verification passed: All % OrderItems have ServicesFulfillment records', order_items_count;
  END IF;
END $$;
```