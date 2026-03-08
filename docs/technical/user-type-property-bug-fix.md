# User Type Property Bug Fix

**Date:** March 8, 2026
**Issue:** Authorization failures in vendor and fulfillment API endpoints
**Root Cause:** Incorrect property usage in session.user object

## Problem Description

Multiple API routes were incorrectly accessing the user type via `session.user.type` instead of the correct `session.user.userType` property. This caused authorization failures because:

1. The `session.user` object from NextAuth only has a `userType` property
2. The `type` property doesn't exist on the user object
3. This resulted in `undefined` values being used for user type checks
4. Authorization logic failed, causing 401/403 errors for valid users

## Files Affected

The following API routes were fixed:

1. **`/src/app/api/vendors/route.ts`** - Fixed 4 occurrences
   - Line 64: `session.user.userType` for access control logic
   - Line 99: `session.user.userType` in error logging
   - Line 121: `session.user.userType` in permission logging
   - Line 128: `session.user.userType` in warning logging

2. **`/src/app/api/vendors/[id]/route.ts`** - Fixed 2 occurrences
   - User type checking in GET and PUT handlers

3. **`/src/app/api/orders/[id]/assign/route.ts`** - Fixed 1 occurrence
   - User type checking in assignment logic

4. **`/src/app/api/fulfillment/route.ts`** - Fixed 2 occurrences
   - User type validation for fulfillment access

5. **`/src/app/api/fulfillment/orders/[id]/route.ts`** - Fixed 1 occurrence
   - User type checking in order access logic

6. **`/src/app/api/comment-templates/route.ts`** - Fixed 2 occurrences
   - Permission validation logic

7. **`/src/lib/vendorUtils.ts`** - Fixed 9 occurrences and updated interface
   - Updated User interface definition to use `userType` instead of `type`
   - Removed workaround TypeScript casts that were masking the bug

## Technical Details

### Before (Incorrect)
```typescript
// Wrong - 'type' property doesn't exist
const userType = session.user.type || session.user.userType;

// Workaround patterns that hid the bug
const userType = (session.user as Record<string, any>).userType;
const userType = session.user.type || (session.user as any).userType;
```

### After (Correct)
```typescript
// Correct - use the actual property name
const userType = session.user.userType;
```

### Interface Fix
```typescript
// Before: Mismatched interface
interface User {
  id: string;
  type: string;  // Wrong property name
  // ...
}

// After: Correct interface
interface User {
  id: string;
  userType: string;  // Matches actual session object
  // ...
}
```

## Root Cause Analysis

1. **Source of Truth**: The user object structure is defined in `/src/types/next-auth.d.ts` and populated in `/src/lib/auth.ts`
2. **Database Schema**: The Prisma schema uses `userType` field in the User model
3. **Interface Mismatch**: Local interfaces in `vendorUtils.ts` incorrectly used `type` instead of `userType`
4. **TypeScript Bypasses**: Workaround casts prevented TypeScript from catching this error

## Impact

- **Before Fix**: Vendor and fulfillment users experienced authorization failures
- **After Fix**: All user types can properly access appropriate endpoints
- **Security**: No security vulnerability (authorization was failing closed, not open)

## Prevention Measures

1. **Updated Coding Standards**: Added Section 9.8 "User Type Property Standard"
2. **Code Comments**: Added explanatory comments near the fixes
3. **Interface Alignment**: Ensured all User interfaces use consistent property names
4. **TypeScript Hygiene**: Removed `as any` casts that masked type errors

## Testing

This bug fix should be verified by:
1. Testing vendor user login and vendor management access
2. Testing internal user access to fulfillment endpoints
3. Testing comment template access with different user types
4. Verifying no regression in customer user restrictions

## Related Issues

- This bug was discovered during full comment editing feature implementation
- Similar issues may exist in other user-type dependent endpoints
- TypeScript strict mode would have prevented this bug by catching property access errors

## Prevention Guidelines

- Always use `session.user.userType` for user type checking
- Never use fallback patterns like `type || userType`
- Avoid `as any` casts that bypass TypeScript type checking
- Keep interface definitions synchronized with actual data structures
- Use TypeScript strict mode to catch property access errors early