# Architecture Cleanup Plan - Updated
**Last Updated:** March 11, 2026
**Status:** ALL PHASES COMPLETE ✅

## Architecture Shift Context

The system shifted from order-based fulfillment to service-based fulfillment:
- OLD: Orders were fulfilled as a whole unit
- NEW: Each service within an order is fulfilled independently
- This created duplicate endpoints and data fields

---

## 🗑️ CLEANUP TASKS

### ✅ PHASE 1: COMPLETED (Branch: cleanup/service-order-architecture-phase2)

#### 1. Status Field Duplication - COMPLETED ✅
**Issue:** Both OrderItem.status and ServicesFulfillment.status existed
**Resolution:**
- ✅ Removed ServicesFulfillment.status field via Prisma migration
- ✅ Updated all API queries to not reference the removed field
- ✅ Fixed 500 error in /api/fulfillment/orders/[id]/route.ts
- ✅ Added migration documentation with rollback plan
- ✅ Updated service layer with clear comments about status management

**Files Modified:**
- prisma/schema.prisma
- prisma/migrations/20260311082827_remove_servicefulfillment_status/
- src/app/api/fulfillment/orders/[id]/route.ts
- src/lib/services/service-fulfillment.service.ts
- src/lib/services/order-core.service.ts
- src/constants/service-status.ts
- docs/migrations/remove-servicefulfillment-status.md

---

### ✅ PHASE 2: COMPLETED (Branch: refactor/toggle-status-to-toggle-available)

#### 2. Confusing API Endpoints

**a. RENAME: /api/services/[id]/toggle-status → /api/services/[id]/toggle-available**
- Purpose: Toggles Service.disabled field (controls customer availability)
- Problem: Name "toggle-status" suggests it changes fulfillment status
- Solution: "toggle-available" clearly indicates it controls availability to customers
- Status: **COMPLETED ✅**
- Files updated:
  - ✅ src/app/api/services/[id]/toggle-available/
  - ✅ src/app/api/customers/[id]/toggle-available/
  - ✅ src/app/api/locations/[id]/toggle-available/
  - ✅ src/app/api/data-rx/documents/[id]/toggle-available/
  - ✅ src/app/api/data-rx/fields/[id]/toggle-available/
  - ✅ All frontend references updated

**b. INVESTIGATE: /api/services/[id]/status**
- **New Finding:** This endpoint updates OrderItem.status (correct behavior)
- **Issue:** Confusing path - looks like it updates Service catalog status
- **Options:**
  1. Keep but add clear documentation
  2. Create alias at /api/order-items/[id]/status
  3. Deprecate in favor of /api/fulfillment/services/[id]
- **Recommendation:** Keep for now, add JSDoc clarification

---

### ✅ PHASE 3: API DOCUMENTATION (No Breaking Changes)

#### 3. API Endpoint Clarification - COMPLETED ✅

**DECISION: Keep existing paths, add comprehensive documentation**
- Rationale: Users understand "Services" terminology in the UI
- Risk Level: Zero - no code changes, no runtime risk
- Solution: Added detailed JSDoc comments explaining OrderItem relationship

**Documentation added to:**
- ✅ `/api/services/[id]/status` - Clarified [id] is OrderItem ID
- ✅ `/api/services/[id]/comments` - Clarified comments are on OrderItems
- ✅ `/api/services/[id]/comments/[commentId]` - Updated PUT and DELETE endpoints

**Key Documentation Points:**
- Explained Service vs OrderItem distinction
- Clarified why path uses "services" (user mental model)
- Added database context to understand relationships
- No changes to frontend or API behavior

---

### ✅ PREVIOUSLY VERIFIED - NO ACTION NEEDED

#### 4. Portal Services Endpoint
**KEEP: /api/portal/services**
- Purpose: Returns customer-specific available services
- Different from: /api/services (admin catalog)
- Status: **VERIFIED** - Needed for customer order creation

#### 5. Deleted Orphan Files (Already Removed)
- ✅ src/app/config/global/page.tsx - Old redirect
- ✅ src/app/test-monitoring/page.tsx - Unused test page

---

## 📋 Next Steps

### Immediate (Low Risk):
1. Create new branch for toggle-status → toggle-available rename
2. Simple find/replace operation
3. Test catalog availability toggle functionality

### Short Term (Medium Risk):
1. Add comprehensive JSDoc to /api/services/[id]/status
2. Document that it updates OrderItem status, not Service catalog
3. Consider creating more intuitive alias

### Long Term (High Risk):
1. Plan frontend refactoring for comment endpoint rename
2. Create migration guide for API consumers
3. Consider versioned API approach

---

## 📊 Progress Summary

**Completed:**
- ✅ Phase 1: Database cleanup (ServicesFulfillment.status removed)
- ✅ Phase 1: API fixes (order details 500 error resolved)
- ✅ Phase 1: Documentation (migration guide created)
- ✅ Phase 2: API endpoint renames (toggle-status → toggle-available)
- ✅ Phase 3: API documentation (clarified OrderItem relationships)

**Remaining:**
- ⏳ Architecture decision record (optional)

**Risk Assessment:**
- Phase 1 (COMPLETE): Low risk, backward compatible
- Phase 2 (COMPLETE): Low risk, simple renames
- Phase 3 (COMPLETE): Zero risk, documentation only

---

## 🔄 Rollback Plans

### Phase 1 Rollback (if needed):
```sql
-- Restore ServicesFulfillment.status
ALTER TABLE "services_fulfillment"
ADD COLUMN "status" TEXT DEFAULT 'pending';

CREATE INDEX "services_fulfillment_status_idx"
ON "services_fulfillment"("status");
```
Then revert code changes from branch `cleanup/service-order-architecture-phase2`

### Phase 2 Rollback:
Simple git revert of rename commits

### Phase 3 Rollback:
Restore original endpoint paths, update frontend references