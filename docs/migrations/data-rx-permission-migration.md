# Data Rx Permission Migration Guide

## Date: March 2, 2026

## Overview

This migration guide addresses the **breaking change** in Data Rx access permissions. Legacy 'dsx' permission support has been intentionally removed to consolidate access control under the centralized permission system.

## What Changed

### Before (Legacy System)
```json
{
  "permissions": {
    "dsx": true  // ❌ No longer supported
  }
}
```

### After (New System)
```json
{
  "permissions": {
    "global_config": true  // ✅ Required for Data Rx access
  }
}
```

## Impact

**All users with 'dsx' permission will lose access to Data Rx endpoints** including:
- `/api/data-rx/documents/*` (all methods)
- `/api/data-rx/fields/*` (all methods)
- `/api/data-rx/locations/*` (all methods)
- `/api/data-rx/templates/*` (all methods)

## Why This Change Was Made

1. **Security Consolidation**: Data Rx configuration affects global system settings across all customers
2. **Permission Simplification**: Reduces permission sprawl by using existing `global_config` permission
3. **Access Control Clarity**: Makes it explicit that Data Rx requires global configuration privileges
4. **Migration Identification**: Forces identification of users who need permission updates

## Migration Steps

### 1. Identify Affected Users

Run this query to find users with legacy 'dsx' permission:

```sql
-- Find users with 'dsx' permission
SELECT id, email, permissions
FROM "User"
WHERE permissions::text LIKE '%dsx%';
```

### 2. Update User Permissions

For each affected user, update their permissions:

```sql
-- Example: Update user permissions (replace with actual user ID)
UPDATE "User"
SET permissions = jsonb_set(
  permissions - 'dsx',  -- Remove old permission
  '{global_config}',
  'true'                -- Add new permission
)
WHERE id = 'user-id-here';
```

### 3. Verify Migration

After updating permissions, test that users can access Data Rx endpoints:

```bash
# Test API access with updated user session
curl -H "Authorization: Bearer <session-token>" \
  http://localhost:3000/api/data-rx/documents
```

Expected: `200 OK` response
Previously: `403 Forbidden` response

## Testing the Migration

### Unit Tests

The comprehensive test suite verifies the permission changes:
- **122 tests** across 4 test files
- Tests confirm `global_config` grants access
- Tests verify `dsx` permission is denied
- No backward compatibility is maintained (intentional)

### Test Files
- `/src/app/api/data-rx/documents/__tests__/route.test.ts`
- `/src/app/api/data-rx/documents/[id]/__tests__/route.test.ts`
- Additional Data Rx endpoint tests

### Manual Testing

1. **Create test user with 'dsx' permission only**:
   ```json
   {
     "type": "internal",
     "permissions": { "dsx": true }
   }
   ```

2. **Verify access is denied**:
   - Visit Data Rx section in admin panel
   - Should see "Insufficient permissions" error
   - API calls should return 403 status

3. **Update to 'global_config' permission**:
   ```json
   {
     "type": "internal",
     "permissions": { "global_config": true }
   }
   ```

4. **Verify access is granted**:
   - Data Rx section should be accessible
   - API calls should return data successfully

## Security Improvements

This migration includes several security enhancements:

### 1. Added Missing Permission Check
- **Fixed**: `/api/data-rx/documents/[id]/upload-pdf/route.ts` was missing permission validation
- **Impact**: Previously allowed unauthorized file uploads

### 2. Removed Development Bypasses
- **Fixed**: Toggle-status routes no longer bypass permissions in development mode
- **Impact**: Consistent permission enforcement across all environments

### 3. Centralized Permission Checking
- **Fixed**: All Data Rx routes now use the centralized `canAccessDataRx()` function
- **Impact**: Consistent permission logic, easier to maintain and audit

### 4. Generic Error Messages
- **Fixed**: All error messages now use generic "Insufficient permissions"
- **Impact**: Prevents information disclosure about permission system structure

## Rollback Plan

If rollback is necessary, revert these changes:

1. **Restore legacy permission support** in `auth-utils.ts`:
   ```typescript
   export function canAccessDataRx(user: User | null | undefined): boolean {
     if (!isInternalUser(user)) return false;

     // Restore legacy dsx permission check
     return hasModulePermission(user, 'global_config') ||
            hasModulePermission(user, 'dsx');
   }
   ```

2. **Update user permissions back to 'dsx'** if needed

3. **Remove JSDoc comments** mentioning the breaking change

**Warning**: Rollback reduces security as it reintroduces the inconsistent permission system.

## Support

If you encounter issues with this migration:

1. **Check user permissions**: Ensure `global_config` is set correctly
2. **Verify user type**: Only internal users can access Data Rx
3. **Test API endpoints**: Use `/api/debug-session` to verify current permissions
4. **Review error logs**: Check for authentication or authorization failures

## Affected Files

- `src/lib/auth-utils.ts` - Core permission logic updated
- `src/app/api/data-rx/documents/route.ts` - Permission checks enforced
- `src/app/api/data-rx/documents/[id]/upload-pdf/route.ts` - Security vulnerability fixed
- `src/app/api/data-rx/documents/[id]/toggle-status/route.ts` - Development bypasses removed
- `src/app/api/data-rx/fields/[id]/route.ts` - Centralized permission checking
- `src/app/api/data-rx/fields/[id]/toggle-status/route.ts` - Development bypasses removed

All files now include comprehensive JSDoc documentation explaining the permission requirements and breaking changes.