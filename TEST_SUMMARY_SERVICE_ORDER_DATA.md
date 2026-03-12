# Test Summary: Include Order Data in Service Details API

## Files Created
- `/src/lib/schemas/__tests__/service-order-data.schemas.test.ts` - Schema validation tests
- `/src/lib/services/__tests__/service-order-data.service.test.ts` - Service layer unit tests
- `/src/app/api/fulfillment/services/[id]/__tests__/route-order-data.test.ts` - API route tests
- `/tests/e2e/service-order-data.spec.ts` - End-to-end user flow tests

## Test Count
- Unit tests: 34
  - Schema validation: 10 tests
  - Service layer: 24 tests
- API route tests: 18
- End-to-end tests: 17
- **Total: 69 tests**

## Coverage

### Business Rules Covered:
1. ✅ **Order data for ALL service types** - Tests verify education, employment, criminal checks all include orderData
2. ✅ **Flat key-value pairs** - Tests verify orderData is returned as simple object with string keys and values
3. ✅ **Subject field exclusion** - Tests verify firstName, lastName, email, ssn etc. are NOT included
4. ✅ **All OrderData fields included** - Tests verify complete data retrieval from OrderData table
5. ✅ **Workflow configuration labels** - Tests verify proper label resolution from workflow config
6. ✅ **All user types can view** - Tests verify internal, vendor, and customer users can access orderData
7. ✅ **Part of existing response** - Tests verify orderData is included in service details response
8. ✅ **Empty object when no data** - Tests verify {} returned, not null/undefined
9. ✅ **Values returned as stored** - Tests verify dates/numbers remain as strings
10. ✅ **Workflow deletion fallback** - Tests verify raw fieldName used when workflow missing

### Edge Cases Covered:
1. ✅ **No order data exists** - Returns empty object
2. ✅ **Workflow has been deleted** - Uses raw fieldName with underscores to spaces
3. ✅ **OrderItem not found** - Logs warning, returns empty object
4. ✅ **Database query fails** - Logs error, returns empty object (service still loads)
5. ✅ **Field label null/empty** - Uses fieldName as fallback
6. ✅ **Very long field values** - Returns full value (up to 5000 chars)
7. ✅ **Special characters** - Returns exactly as stored without escaping
8. ✅ **User lacks permission** - Returns 403 (existing behavior maintained)
9. ✅ **Duplicate detection fails** - Includes all fields rather than risk data loss
10. ✅ **Corrupted workflow config** - Uses fieldName fallback for all fields

### Business Rules NOT Yet Covered:
None - all requirements from the specification are covered by tests.

## Notes for the Implementer

### 1. Required Files to Create
You'll need to create these production files to make the tests pass:

**Schema file:**
- `/src/lib/schemas/service-order-data.schemas.ts`
  - Export `serviceDetailsWithOrderDataSchema` that validates service response with orderData field

**Service file:**
- `/src/lib/services/service-order-data.service.ts`
  - Export class `ServiceOrderDataService` with methods:
    - `getOrderDataForService(orderItemId, orderSubject)` - Main method to fetch and format order data
    - `formatFieldName(fieldName)` - Helper to convert raw field names to display format
    - `isSubjectField(fieldName)` - Helper to identify fields that should be excluded

**API route modification:**
- Modify `/src/app/api/fulfillment/services/[id]/route.ts`
  - Import and call `ServiceOrderDataService.getOrderDataForService()`
  - Add `orderData` field to response

### 2. Key Implementation Points

**Database Queries:**
- Fetch from `OrderData` table using `orderItemId`
- Attempt to fetch `WorkflowSection` for field labels
- Handle missing workflow gracefully

**Field Label Resolution:**
1. Try to get label from workflow configuration
2. If workflow missing or label empty, use fieldName
3. Convert underscores to spaces in fieldName

**Subject Field Filtering:**
- Check each field against the exclusion list (both camelCase and title case versions)
- Must check: firstName/First Name, lastName/Last Name, email/Email, etc.
- When in doubt (detection fails), include the field

**Error Handling:**
- All errors should return empty object {}, never null
- Log errors but don't fail the entire service details request
- Service details should load even if order data fails

### 3. Type Definitions Needed
```typescript
interface OrderData {
  fieldName: string;
  fieldValue: string | null;
  fieldType: string;
}

interface OrderDataResponse {
  [fieldLabel: string]: string | number | boolean | null;
}
```

### 4. Testing Your Implementation
Run tests in this order:
1. `pnpm test src/lib/schemas/__tests__/service-order-data.schemas.test.ts` - Schema validation
2. `pnpm test src/lib/services/__tests__/service-order-data.service.test.ts` - Service logic
3. `pnpm test src/app/api/fulfillment/services/[id]/__tests__/route-order-data.test.ts` - API integration
4. `pnpm test:e2e tests/e2e/service-order-data.spec.ts` - Full user flows

### 5. Performance Requirement
The service details API with order data must respond in under 500ms for typical queries. Consider:
- Efficient database queries (use proper indexes)
- Fetch order data in parallel with other service details if possible
- Cache workflow configuration if frequently accessed

### 6. Security Notes
- Never expose raw database IDs or internal field names to frontend
- Subject information filtering is critical for privacy
- Maintain existing permission checks - don't bypass them

## Ready to Implement
All tests are written and will fail initially (as expected in TDD). The implementer can now write the production code to make these tests pass. Follow the test failures as a guide for what needs to be implemented.