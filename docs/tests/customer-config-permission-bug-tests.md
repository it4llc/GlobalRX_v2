# Customer Config Permission Bug - Test Suite

## Overview

These tests prove that there is a permission consistency bug in the Customer Config features. The User Admin UI saves permissions with the key `customer_config`, but the code currently checks for wrong keys like `workflows` or `customers`.

## Test Files Created

1. **API Route Tests**
   - `src/app/api/workflows/__tests__/permission-bug.test.ts` - Tests for workflow API endpoints
   - `src/app/api/packages/[id]/__tests__/permission-bug.test.ts` - Tests for package API endpoints

2. **Component Tests**
   - `src/app/customer-configs/workflows/__tests__/permission-bug.test.tsx` - Tests for workflows page
   - `src/app/customer-configs/packages/__tests__/permission-bug.test.tsx` - Tests for packages page

## Key Regression Tests

Each test file contains regression tests marked with `// REGRESSION TEST` that:
- **Currently FAIL** - proving the bug exists
- **Will PASS** after the fix is applied
- **Must never be deleted** - their permanent job is to prevent this bug from coming back

### Workflow API Regression Tests
- `REGRESSION: should accept user with customer_config permission (currently fails)` - Tests GET endpoint
- `REGRESSION: should accept user with customer_config permission for create (currently fails)` - Tests POST endpoint

### Package API Regression Tests
- `REGRESSION: should accept user with customer_config permission for view (currently fails)` - Tests GET endpoint
- `REGRESSION: should accept user with customer_config permission for edit (currently fails)` - Tests PUT endpoint
- `REGRESSION: should accept user with customer_config permission for delete (currently fails)` - Tests DELETE endpoint

### Component Regression Tests
- Workflows page: `REGRESSION: should show workflows when user has customer_config permission (currently fails)`
- Packages page: `REGRESSION: should show packages when user has customer_config permission (currently fails)`

## Test Coverage

### Permission Formats Tested
All tests verify that `customer_config` permission works with various formats:
- Wildcard: `{ customer_config: '*' }`
- Boolean: `{ customer_config: true }`
- Object: `{ customer_config: { view: true, edit: true } }`
- Array: `{ customer_config: ['view', 'edit'] }`

### Authentication Tests
- All endpoints return 401 when not authenticated
- All endpoints return 403 when user lacks required permissions

### Current Wrong Behavior Tests
Tests also document what currently (incorrectly) works:
- API routes accept `workflows` permission (wrong)
- API routes accept `customers` permission (wrong)
- Pages check for `workflows` or `customers` instead of `customer_config`

## Running the Tests

To run all permission bug tests:
```bash
pnpm test permission-bug.test
```

To run individual test files:
```bash
# API tests
pnpm test src/app/api/workflows/__tests__/permission-bug.test.ts
pnpm test src/app/api/packages/[id]/__tests__/permission-bug.test.ts

# Component tests
pnpm test src/app/customer-configs/workflows/__tests__/permission-bug.test.tsx
pnpm test src/app/customer-configs/packages/__tests__/permission-bug.test.tsx
```

## Expected Test Results

### Before Fix
- Regression tests marked with "REGRESSION" will FAIL
- Tests showing current wrong behavior will PASS
- This proves the bug exists

### After Fix
- All regression tests will PASS
- Tests for wrong permission keys should FAIL (they should no longer work)
- This proves the bug is fixed

## Fix Implementation Guide

To fix this bug, the following changes need to be made:

1. **API Routes** - Update permission checks:
   - `/api/workflows/route.ts`: Change from checking `workflows` or `customers` to `customer_config`
   - `/api/packages/[id]/route.ts`: Change from checking `customers` to `customer_config`

2. **Page Components** - Update permission checks:
   - `/customer-configs/workflows/page.tsx`: Change from checking `workflows` to `customer_config`
   - `/customer-configs/packages/page.tsx`: Change from checking `customers` to `customer_config`

3. **Use hasPermission utility** - Ensure all checks use the `hasPermission` utility from `@/lib/permission-utils` which handles different permission formats correctly.

## Why This Matters

This bug prevents users who have been granted Customer Config permissions through the User Admin UI from accessing the features they should have access to. The inconsistency between what the UI saves (`customer_config`) and what the code checks for (`workflows` or `customers`) creates a confusing user experience where permissions appear to be granted but don't actually work.