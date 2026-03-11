# Migration: Remove ServicesFulfillment Status Field

**Date:** March 11, 2026
**Migration:** `20260311082827_remove_servicefulfillment_status`
**Branch:** `feature/customer-order-view-only`

## Summary

Removed the duplicate `status` field from the `ServicesFulfillment` table to consolidate all status tracking in the `OrderItem.status` field, establishing a single source of truth for service status management.

## Problem

The system had two status fields tracking the same information:
1. `OrderItem.status` - The authoritative status being actively updated
2. `ServicesFulfillment.status` - Legacy field that was never updated (always remained 'pending')

This duplication created:
- Data inconsistency risks
- Confusion about which status to reference
- Maintenance overhead

## Solution

### Database Changes
- Removed `ServicesFulfillment.status` column
- Removed `services_fulfillment_status_idx` index
- Migration preserves all data except the unused status values

### Code Changes

#### API Routes
- `/api/fulfillment/orders/[id]/route.ts` - Removed status from ServicesFulfillment select query

#### Service Layer
- `service-fulfillment.service.ts`:
  - `createServicesForOrder()` - No longer sets status field
  - `updateService()` - Logs warning if status update attempted
  - Added clear comments about status management

#### Frontend
- `OrderDetailsView.tsx` - Already had fallback logic: `item.serviceFulfillment?.status || item.status`
- No changes needed due to optional chaining

## Status Management Going Forward

All service status updates should use:
- **Endpoint:** `/api/services/[id]/status`
- **Field:** `OrderItem.status`
- **Valid Values:** As defined in `/src/constants/service-status.ts`

## Testing Checklist

- [x] Migration runs successfully
- [x] Order details page loads without errors
- [x] Service status updates work correctly
- [x] No references to ServicesFulfillment.status remain in codebase

## Rollback Plan

If issues are discovered:
1. Revert the code changes
2. Run a reverse migration to restore the status column:
   ```sql
   ALTER TABLE "services_fulfillment"
   ADD COLUMN "status" TEXT DEFAULT 'pending';

   CREATE INDEX "services_fulfillment_status_idx"
   ON "services_fulfillment"("status");
   ```

## Related Documentation
- [Service Status Constants](/src/constants/service-status.ts)
- [Coding Standards](/docs/CODING_STANDARDS.md)