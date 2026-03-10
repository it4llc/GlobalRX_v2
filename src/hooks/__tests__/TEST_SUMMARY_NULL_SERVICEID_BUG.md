# Test Summary: Service Comments Null ServiceId Bug Fix

## Bug Description
When viewing order details and attempting to add a comment to a service, the application makes an API call to `/api/services/null/comments` which fails with a 404 error.

**Root Cause:** The `useServiceComments` hook has a design flaw where serviceId becomes null in order mode, breaking all CRUD operations that need to construct API paths.

## Files Created
- `/src/hooks/__tests__/useServiceComments-null-serviceId-bug.test.ts` - Hook unit tests
- `/src/components/services/__tests__/ServiceCommentSection-null-serviceId-bug.test.tsx` - Component integration tests
- `/src/app/api/services/[id]/comments/__tests__/route-null-serviceId-bug.test.ts` - API route tests

## Test Count
- Unit tests: 14
- Component integration tests: 9
- API route tests: 11
- **Total: 34 tests**

## Test Categories

### 1. Tests That Prove The Bug Exists (Will FAIL before fix)
These tests demonstrate the current broken behavior:

- `should FAIL: createComment calls API with null serviceId in order mode (CURRENT BUG)`
  - Proves that creating a comment in order mode results in `/api/services/null/comments` call

- `should FAIL: updateComment calls API with null serviceId in order mode (CURRENT BUG)`
  - Proves that updating a comment in order mode results in `/api/services/null/comments/{id}` call

- `should FAIL: deleteComment calls API with null serviceId in order mode (CURRENT BUG)`
  - Proves that deleting a comment in order mode results in `/api/services/null/comments/{id}` call

### 2. Tests for Expected Behavior After Fix (Will PASS after fix)
These tests define what success looks like:

- `should PASS: createComment accepts serviceId parameter for order mode (AFTER FIX)`
  - Shows that CRUD operations should accept serviceId as a parameter

- `should PASS: updateComment accepts serviceId parameter for order mode (AFTER FIX)`
  - Validates the new signature for update operations

- `should PASS: deleteComment accepts serviceId parameter for order mode (AFTER FIX)`
  - Validates the new signature for delete operations

### 3. Regression Tests
Ensure the fix doesn't break existing functionality:

- `should work correctly when serviceId is provided (single service mode)`
  - Verifies single service mode continues to work

- `should correctly filter comments by service in order mode`
  - Ensures comment filtering still works properly

- `should filter internal comments for customer users`
  - Security check that customer visibility rules remain intact

### 4. API Route Tests
Server-side validation and security:

- `should return 400 when serviceId is literally "null" string`
  - API properly rejects invalid serviceId values

- `should not allow updating comment from different service`
  - Security: prevents cross-service comment manipulation

- `should not allow customers to create comments`
  - Permission enforcement remains intact

## Coverage

### Business Rules Covered:
✅ Customers cannot create, edit, or delete comments
✅ Vendors can create comments but cannot edit or delete
✅ Internal users have full CRUD permissions on comments
✅ Comments are filtered by service in order mode
✅ Internal comments are hidden from customers
✅ Template selection is required for new comments
✅ Comment text cannot be empty or exceed 1000 characters
✅ Comments cannot be manipulated across different services

### Business Rules NOT Yet Covered:
- Audit trail creation for comment operations
- Email notifications when comments are added
- Batch comment operations
- Comment attachment handling (if applicable)

## Notes for the Implementer

### Proposed Fix Approach
The fix requires modifying the CRUD functions in `useServiceComments` to accept serviceId as a parameter:

**Current signatures:**
```typescript
createComment(data: CreateServiceCommentInput): Promise<void>
updateComment(commentId: string, data: UpdateServiceCommentInput): Promise<void>
deleteComment(commentId: string): Promise<void>
```

**Proposed signatures (Option 1 - Add serviceId to data):**
```typescript
createComment(data: CreateServiceCommentInput & { serviceId?: string }): Promise<void>
updateComment(commentId: string, data: UpdateServiceCommentInput & { serviceId?: string }): Promise<void>
deleteComment(commentId: string, serviceId?: string): Promise<void>
```

**Proposed signatures (Option 2 - Separate parameter):**
```typescript
createComment(serviceId: string, data: CreateServiceCommentInput): Promise<void>
updateComment(serviceId: string, commentId: string, data: UpdateServiceCommentInput): Promise<void>
deleteComment(serviceId: string, commentId: string): Promise<void>
```

### Implementation Checklist for Developer:
1. [ ] Modify CRUD function signatures in `useServiceComments` hook
2. [ ] Update the functions to use the provided serviceId instead of the hook's serviceId
3. [ ] Fall back to hook's serviceId when not provided (for backward compatibility)
4. [ ] Update `ServiceCommentSection` to pass actualServiceId to CRUD operations
5. [ ] Run all tests to ensure they pass
6. [ ] Test manually in both single service and order mode contexts
7. [ ] Verify no regression in permission checks

### Testing Instructions:
1. Run tests before implementing: `pnpm test useServiceComments-null-serviceId-bug`
   - Expect 3 tests to FAIL (proving the bug exists)
   - Other tests may fail due to missing implementation

2. Implement the fix

3. Run tests after implementing:
   - All tests should PASS
   - No regression in existing tests

4. Manual testing:
   - Open an order details page
   - Add a comment to a service
   - Verify the comment appears immediately
   - Refresh and verify the comment persists
   - Edit the comment
   - Delete the comment

### Key Files to Modify:
- `/src/hooks/useServiceComments.ts` - Main fix location
- `/src/components/services/ServiceCommentSection.tsx` - Update to pass serviceId
- `/src/components/services/CommentCreateModal.tsx` - May need to accept serviceId
- `/src/components/services/CommentEditModal.tsx` - May need to accept serviceId

## Success Criteria
✅ No more calls to `/api/services/null/comments`
✅ Comments can be created, edited, and deleted in order mode
✅ Single service mode continues to work
✅ All permission checks remain enforced
✅ All 34 tests pass