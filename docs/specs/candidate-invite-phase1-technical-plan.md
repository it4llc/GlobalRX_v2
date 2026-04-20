# Technical Plan for Candidate Invite Phase 1 — Database Infrastructure

## Database Changes

### Schema Changes to `prisma/schema.prisma`:

1. **Package model** - Add new field:
   - Add `workflowId String?` field
   - Add relation to Workflow: `workflow Workflow? @relation(fields: [workflowId], references: [id], onDelete: Restrict)`
   - Remove the existing `workflows Workflow[]` relation (it's backwards)

2. **Workflow model** - Remove old field:
   - Remove `packageId String` field
   - Remove `package Package @relation(fields: [packageId], references: [id])` relation
   - Add new relation: `packages Package[]` (the reverse relation)

### Migration SQL (manual method per Andy's requirements):

```sql
-- /GlobalRX_v2/prisma/migrations/YYYYMMDDHHMMSS_add_workflow_to_packages/migration.sql
--
-- Business requirement: Phase 1 of Candidate Invite - restructure package/workflow relationship
-- Changes the relationship from workflow->package (one-to-one) to package->workflow (many-to-one)
-- This allows multiple packages to share the same workflow
-- Safe to run multiple times (idempotent)

-- Start logging
DO $$
BEGIN
  RAISE NOTICE 'Starting workflow-package relationship migration...';
END $$;

-- Step 1: Add workflowId column to packages table if it doesn't exist
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS "workflowId" TEXT;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'packages_workflowId_fkey'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_workflowId_fkey
    FOREIGN KEY ("workflowId")
    REFERENCES workflows(id)
    ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 2: Migrate existing relationships from workflows.packageId to packages.workflowId
-- If multiple workflows point to the same package (shouldn't happen but handle it),
-- use the most recently updated workflow
UPDATE packages p
SET "workflowId" = (
  SELECT w.id
  FROM workflows w
  WHERE w."packageId" = p.id
  ORDER BY w."updatedAt" DESC NULLS LAST, w."createdAt" DESC
  LIMIT 1
)
WHERE p."workflowId" IS NULL
  AND EXISTS (
    SELECT 1 FROM workflows w2 WHERE w2."packageId" = p.id
  );

-- Log migration progress
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM packages WHERE "workflowId" IS NOT NULL;
  RAISE NOTICE 'Migrated % package-workflow relationships', migrated_count;
END $$;

-- Step 3: Verify migration completeness
DO $$
DECLARE
  old_relationships INTEGER;
  new_relationships INTEGER;
  orphaned_count INTEGER;
BEGIN
  -- Count old relationships
  SELECT COUNT(*) INTO old_relationships
  FROM workflows WHERE "packageId" IS NOT NULL;

  -- Count new relationships
  SELECT COUNT(*) INTO new_relationships
  FROM packages WHERE "workflowId" IS NOT NULL;

  -- Check for orphaned workflow references
  SELECT COUNT(*) INTO orphaned_count
  FROM workflows w
  LEFT JOIN packages p ON w."packageId" = p.id
  WHERE w."packageId" IS NOT NULL AND p.id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned workflow->package references (package no longer exists)', orphaned_count;
  END IF;

  RAISE NOTICE 'Verification: % old relationships, % new relationships migrated', old_relationships, new_relationships;
END $$;

-- Step 4: Drop the old packageId column from workflows table
ALTER TABLE workflows
DROP COLUMN IF EXISTS "packageId";

-- Step 5: Add index on packages.workflowId for query performance
CREATE INDEX IF NOT EXISTS idx_packages_workflowId ON packages("workflowId");

-- Final summary
DO $$
BEGIN
  RAISE NOTICE 'workflow-package relationship migration completed successfully';
END $$;
```

## Existing Files to Modify

### 1. **`/Users/andyhellman/Projects/GlobalRx_v2/prisma/schema.prisma`**
- **Current:** Package has `workflows Workflow[]` relation, Workflow has `packageId String` and belongs to Package
- **Change:** Add `workflowId String?` to Package, add workflow relation, remove packageId from Workflow, fix relations

### 2. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/packages/[id]/route.ts`**
- **Current:** Does not handle workflowId, has permission bug (checks view-only incorrectly)
- **Changes needed:**
  - GET: Include workflow in the response
  - PUT: Accept workflowId in request body, validate workflow exists, update workflowId
  - PUT: Fix 403 bug - check for edit permission properly (lines 125-136)
  - DELETE: Fix 403 bug - check for edit permission properly (lines 293-301)

**Current 403 Bug in PUT Handler (lines 125-136):**
```typescript
// Check permissions
// BUG FIX: Changed from 'customers' to 'customer_config' to match User Admin permission key
const hasCustomerConfigPermission =
  session.user.permissions?.customer_config ||
  session.user.permissions?.customer_config?.edit ||
  session.user.permissions?.customer_config?.view ||  // BUG: This allows view-only users to edit!
  session.user.permissions?.customer_config?.['*'] ||
  (Array.isArray(session.user.permissions?.customer_config) && session.user.permissions.customer_config.includes('*'));

if (!hasCustomerConfigPermission && !session.user.permissions?.admin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```
**Problem:** Line 130 includes `.view` permission, which allows view-only users to edit packages. Should only check for `.edit` permission.

**Current 403 Bug in DELETE Handler (lines 293-301):**
```typescript
// Check permissions
// BUG FIX: Changed from 'customers' to 'customer_config' to match User Admin permission key
const hasCustomerConfigPermission =
  session.user.permissions?.customer_config ||
  session.user.permissions?.customer_config?.edit ||
  session.user.permissions?.customer_config?.view ||  // BUG: This allows view-only users to delete!
  session.user.permissions?.customer_config?.['*'] ||
  (Array.isArray(session.user.permissions?.customer_config) && session.user.permissions.customer_config.includes('*'));

if (!hasCustomerConfigPermission && !session.user.permissions?.admin) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```
**Problem:** Line 296 includes `.view` permission, which allows view-only users to delete packages. Should only check for `.edit` permission.

### 3. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/customers/[id]/packages/route.ts`**
- **Current:** Creates packages for a customer
- **Changes needed:** Accept optional workflowId in POST request, include workflow in GET response

### 4. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/workflows/[id]/route.ts`**
- **Current:** Accepts packageIds, updates packageId on workflow
- **Changes needed:**
  - GET: Remove packageId/packageIds from response, optionally include count of packages using this workflow
  - PUT: Remove packageIds handling (lines 152-172)
  - DELETE: Check for packages using this workflow before deletion, return error if any exist

### 5. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/workflows/route.ts`**
- **Current:** Creates new workflows with packageId
- **Changes needed:** Remove packageId from creation, remove packageIds validation

### 6. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/modules/customer/package-dialog.tsx`** (verified path - NOT package-dialog-new.tsx)
- **Current:** No workflow selector
- **Changes needed:** Add workflow dropdown selector, fetch available workflows, include workflowId in save

### 7. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/modules/workflows/workflow-dialog.tsx`**
- **Current:** Has package radio button selector (lines 540-555 approximately)
- **Changes needed:** Remove entire FormField for packageIds, remove packageIds from schema, remove package fetching logic

### 8. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/modules/global-config/services/service-form.tsx`**
- **Current:** functionalityType dropdown options hardcoded as `['record', 'verification-edu', 'verification-emp', 'other']`
- **Changes needed:** Add 'idv' to the functionalityTypeOptions array

### 9. **`/Users/andyhellman/Projects/GlobalRx_v2/src/components/modules/global-config/tabs/services-tab.tsx`**
- **Current:** functionalityTypes state initialized with `['record', 'verification-edu', 'verification-emp', 'other']` (line 283)
- **Changes needed:** Add 'idv' to the array

### 10. **`/Users/andyhellman/Projects/GlobalRx_v2/src/types/workflow.ts`** (verified path exists)
- **Current:** Contains workflowUpdateSchema with packageIds
- **Changes needed:** Remove packageIds from the Zod schema

### 11. **`/Users/andyhellman/Projects/GlobalRx_v2/docs/DATA_DICTIONARY.md`**
- **Current:** Shows Package with `workflows` relation and Workflow with `packageId`
- **Changes needed:** Update to reflect new structure - Package has `workflowId`, Workflow no longer has `packageId`

## New Files to Create

None required for this phase - all changes are modifications to existing files.

## Zod Schema Changes

### File: `/Users/andyhellman/Projects/GlobalRx_v2/src/types/workflow.ts`
**Current schemas that need modification:**
- **Line 20-22:** `workflowCreateSchema` has `packageIds: z.array(z.string().uuid()).optional()`
- **Line 24-26:** `workflowUpdateSchema` has `packageIds: z.array(z.string().uuid()).optional()`
- **Line 28-30:** `workflowPackageSchema` with `packageId: z.string().uuid()` - this entire schema may need removal
**Changes needed:** Remove `packageIds` from both schemas, potentially remove `workflowPackageSchema` entirely

### File: `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/packages/[id]/route.ts`
**Current schema (lines 10-17):**
```typescript
const packageUpdateSchema = z.object({
  name: z.string().min(1, "Package name is required").optional(),
  description: z.string().optional().nullable(),
  services: z.array(z.object({
    serviceId: z.string().uuid(),
    scope: z.any()
  })).optional()
});
```
**Changes needed:** Add `workflowId: z.string().uuid().optional().nullable()`

### File: `/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/customers/[id]/packages/route.ts`
**Current schema (lines 12-19):**
```typescript
const packageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  description: z.string().optional().nullable(),
  services: z.array(z.object({
    serviceId: z.string().uuid(),
    scope: z.any()
  }))
});
```
**Changes needed:** Add `workflowId: z.string().uuid().optional().nullable()`

## Test Files That Will Need Updates

1. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/packages/[id]/__tests__/route.test.ts`** - Will need updates for workflowId handling in GET/PUT
2. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/packages/[id]/__tests__/permission-bug.test.ts`** - Already testing the 403 bug fix
3. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/customers/[id]/packages/__tests__/route.test.ts`** - Will need updates for workflowId in POST
4. **`/Users/andyhellman/Projects/GlobalRx_v2/src/app/api/workflows/__tests__/permission-bug.test.ts`** - May need updates if it tests packageId

## API Route Changes

### `/api/packages/[id]` (GET)
- **Permission:** customer_config.view or admin
- **Input:** id param
- **Success Response:** Include workflow object if workflowId is set
- **Errors:** 401, 403, 404, 500

### `/api/packages/[id]` (PUT)
- **Permission:** customer_config.edit or admin (NOT view)
- **Input:** name, description, services, workflowId (all optional)
- **Validation:** If workflowId provided, verify workflow exists
- **Success Response:** Updated package with workflow
- **Errors:** 401, 403 (for view-only users), 404, 400 (invalid workflowId), 500

### `/api/packages/[id]` (DELETE)
- **Permission:** customer_config.edit or admin (NOT view)
- **Success Response:** { success: true }
- **Errors:** 401, 403 (for view-only users), 404, 500

### `/api/workflows/[id]` (DELETE)
- **Permission:** customer_config.edit/delete or admin
- **Additional Check:** Count packages with this workflowId, block if > 0
- **Error Response for assigned workflow:** 400 with message "This workflow cannot be deleted because it is assigned to X package(s). Please reassign or remove the workflow from those packages first."

## Order of Implementation

1. **Database schema changes** (prisma/schema.prisma)
2. **Migration SQL** (create directory and migration.sql)
3. **Apply migration** (`pnpm prisma migrate deploy` then `pnpm prisma generate`)
4. **Fix package API 403 bugs** (src/app/api/packages/[id]/route.ts - PUT and DELETE)
5. **Update package API for workflowId** (src/app/api/packages/[id]/route.ts - all methods)
6. **Update workflow API** (remove packageId handling from all workflow routes)
7. **Add workflow deletion check** (src/app/api/workflows/[id]/route.ts - DELETE)
8. **Remove package selector from workflow dialog** (workflow-dialog.tsx)
9. **Add workflow selector to package dialog** (package-dialog.tsx)
10. **Add "idv" functionality type** (service-form.tsx and services-tab.tsx)
11. **Update DATA_DICTIONARY.md**

## Plan Completeness Check

✅ Every file the implementer will touch is listed:
- prisma/schema.prisma
- prisma/migrations/[new]/migration.sql
- src/app/api/packages/[id]/route.ts
- src/app/api/customers/[id]/packages/route.ts
- src/app/api/workflows/[id]/route.ts
- src/app/api/workflows/route.ts
- src/components/modules/customer/package-dialog.tsx (verified path)
- src/components/modules/workflows/workflow-dialog.tsx
- src/components/modules/global-config/services/service-form.tsx
- src/components/modules/global-config/tabs/services-tab.tsx
- src/types/workflow.ts (verified exists)
- docs/DATA_DICTIONARY.md

The implementer is forbidden from touching any files not listed in this plan.