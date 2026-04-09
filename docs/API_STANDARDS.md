# /GlobalRX_v2/docs/API_STANDARDS.md
# GlobalRx Platform — API Standards & Conventions

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the API-specific rules and standards that MUST be followed when writing,
editing, or reviewing any API routes in the GlobalRx platform. These standards are not
suggestions — they are requirements.

---

## SECTION 1: API Route Standards

Every API route must follow this structure without exception.

### 1.1 Required Elements for Every Route

1. **Authentication check** — must be the very first thing in every route handler
2. **Input validation** — validate all incoming data with Zod before using it
3. **Try/catch error handling** — all database calls and business logic must be wrapped
4. **Consistent response format** — use the same shape for all success and error responses

### 1.2 Standard Route Pattern

```typescript
// /GlobalRX_v2/src/app/api/[resource]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// Define the validation schema for incoming data
const createResourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export async function POST(request: NextRequest) {
  // Step 1: Always check authentication first
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Validate the incoming request body
  const body = await request.json();
  const validation = createResourceSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 3: Perform database operation inside try/catch
  try {
    const result = await prisma.resource.create({
      data: validation.data,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error('Error creating resource:', { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// For routes with dynamic parameters (Next.js 15 Migration)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // CRITICAL: Next.js 15 requires params to be awaited before use
  const { id } = await params;

  // Step 1: Always check authentication first
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Continue with regular route logic...
}
```

### 1.3 HTTP Status Codes

Always return the correct status code:

| Situation | Status Code |
|-----------|------------|
| Success (read) | 200 |
| Success (created) | 201 |
| Bad input from user | 400 |
| Not logged in | 401 |
| Logged in but not allowed | 403 |
| Record not found | 404 |
| Server/database error | 500 |

### 1.4 Never Return More Data Than Needed

When returning records, only include the fields the frontend actually needs.
Do not return full database objects if only a few fields are required.
Never return password hashes, tokens, or internal system fields.

---

## SECTION 2: User Type Specific API Endpoints

Different user types must use the appropriate API endpoints. **Never try to make
a single endpoint serve all user types** as this leads to permission confusion
and security vulnerabilities.

**User Type Routing Rules:**
- **Customer users** → use `/api/portal/*` endpoints (require customerId validation)
- **Internal users** → use `/api/fulfillment/*` or `/api/admin/*` endpoints (require internal permissions)
- **Vendor users** → use `/api/vendor/*` endpoints (require vendorId validation)

**Example of the correct pattern:**
```typescript
// In a component that serves different user types
const endpoint = user.type === 'customer'
  ? `/api/portal/orders/${orderId}`
  : `/api/fulfillment/orders/${orderId}`;
```

**Common mistake that causes 401 errors:**
```typescript
// Wrong - all users hitting the same endpoint
const endpoint = `/api/portal/orders/${orderId}`; // Only works for customer users!
```

This pattern prevents the bug where internal users with fulfillment permissions
receive 401 errors when trying to access customer-only endpoints.

---

## SECTION 3: Centralized Permission Functions

All permission checking must use the centralized functions in `auth-utils.ts`.
This ensures consistent permission logic across the entire application.

**Data Rx Access Pattern:**
```typescript
import { canAccessDataRx } from '@/lib/auth-utils';

// Always use centralized permission checking
if (!canAccessDataRx(session.user)) {
  return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
}
```

**Why centralized permission checking matters:**
- Consistent permission logic across all endpoints
- Single source of truth for permission changes
- Easier security auditing and testing
- Prevents permission bypass vulnerabilities

**Customer Management Access Pattern:**
```typescript
import { canManageCustomers } from '@/lib/auth-utils';

// Always use centralized permission checking for customer operations
if (!canManageCustomers(session.user)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Breaking changes to permissions:**
When permission requirements change (like the Data Rx 'dsx' → 'global_config' migration),
centralized functions make it easy to:
- Update permission logic in one place
- Ensure all endpoints use the new requirements
- Create comprehensive test coverage
- Generate clear migration documentation

**Bug Prevention:**
The permission system migration revealed a common bug pattern:
- API routes had inline permission checking for legacy permission format
- Users were migrated to new module-based permissions
- API routes returned 403 Forbidden because they only checked for old format
- Frontend worked because it checked both formats
- Solution: Replace all inline permission checking with centralized functions

**Critical Security Bug Fixed (March 5, 2026):**
The DSX API permission migration revealed a critical security vulnerability:
- `/api/dsx/remove-requirement` had NO permission checking at all
- Any authenticated user could delete service requirements
- This violated the "Authentication on Every API Route" rule
- Other DSX endpoints checked for deprecated 'dsx' permission instead of 'global_config'

**Mandatory Security Verification:**
1. **NEVER ship an API endpoint without permission checking**
2. **Always use centralized permission functions** (never inline permission checks)
3. **Test API endpoints with different user permission levels** during development
4. **Review ALL endpoints** when changing permission requirements
5. **Document security-critical changes** with clear code comments explaining the fix

---

## SECTION 4: User Type Property Standard

**CRITICAL:** Always use `session.user.userType` for user type checking. **Never use `session.user.type`.**

**Correct Pattern:**
```typescript
const userType = session.user.userType;
if (userType === 'internal' || userType === 'admin') {
  // Allow access
}
```

**Incorrect Pattern (Bug-prone):**
```typescript
// ❌ WRONG - 'type' property doesn't exist
const userType = session.user.type;
// ❌ WRONG - Fallback patterns hide the real issue
const userType = session.user.type || session.user.userType;
// ❌ WRONG - TypeScript workarounds mask the problem
const userType = (session.user as any).userType;
```

**Why this matters:**
- The session user object from NextAuth uses `userType`, not `type`
- This is defined in `/src/types/next-auth.d.ts`
- Using the wrong property causes authorization failures
- Fallback patterns hide bugs and make debugging difficult

**Bug Prevention:**
- Search for `session.user.type` in code reviews
- Use TypeScript strict mode to catch property access errors
- Never use `as any` casts to bypass type checking
- Verify user type access patterns when debugging authorization issues

---

## SECTION 5: Data Format Consistency Standard

**CRITICAL:** Ensure consistent data formats across database storage, API responses, and frontend display.

**Common Format Mismatch Bug:**
Service status values are stored as title case in database ("Submitted", "Missing Information") but may be received from frontend or external systems as uppercase ("SUBMITTED", "MISSING INFORMATION"). This causes database query failures when case doesn't match.

**Solution Pattern:**
```typescript
// Always normalize data before database queries
const normalizedStatus = serviceStatus
  .split(' ')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  .join(' ');

// Use normalized value in database query
await prisma.commentTemplateAvailability.findMany({
  where: {
    status: normalizedStatus  // Use normalized, not original
  }
});
```

**Prevention Guidelines:**
- Document expected data formats in API documentation
- Normalize data at system boundaries (API route entry points)
- Use database constraints to enforce format consistency
- Add validation to catch format mismatches early
- Test with different case formats to ensure normalization works
- Never assume incoming data format matches storage format

**Common Areas Requiring Normalization:**
- Status values (order status, service status, application status)
- Email addresses (always lowercase before storage/lookup)
- Customer codes (consistent case format)
- Service types (consistent naming convention)

---

## SECTION 6: Database Query Filter Logic Standard

**CRITICAL:** Always verify that database query filters match business requirements, especially when filtering by presence/absence of related data.

**Common Query Logic Bug:**
When building dynamic query filters based on user type, be careful with inclusion/exclusion filters. A filter that excludes records (e.g., `assignedVendorId: { not: null }`) may unintentionally hide data that users need to see.

**Bug Pattern Example:**
```typescript
// ❌ WRONG - This excludes unassigned orders that internal users need to manage
if (userType === 'internal') {
  whereClause.assignedVendorId = { not: null }; // Only shows assigned orders
}

// ✅ CORRECT - Internal users should see ALL orders
if (userType === 'vendor') {
  whereClause.assignedVendorId = session.user.vendorId; // Vendor sees only their orders
}
// Internal users: no filter = see all orders (assigned and unassigned)
```

**Prevention Guidelines:**
- Write explicit tests for different user types and their expected data visibility
- Document the business logic for who should see what data
- Be especially careful with "not null" and "not equals" filters
- Consider unassigned/null state records in your query logic
- Use positive filters (include what should be seen) rather than negative filters (exclude what shouldn't be seen) when possible
- Always test with edge cases like unassigned or empty state records

**Common Query Filter Mistakes:**
- Using `{ not: null }` when users need to see unassigned records
- Forgetting to handle null/undefined foreign key relationships
- Over-filtering data that users with broader permissions should see
- Not considering the "unassigned" workflow state in business logic
- **Returning all records when no filter matches** - When filtering by conditional criteria and no matches are found, ensure you return an empty result set rather than all records

---

## SECTION 7: API Filter Empty Results Standard

**CRITICAL:** When implementing conditional filtering (e.g., filtering by service type and status), always handle the "no matches" case explicitly to prevent unintended data exposure.

**Common Bug Pattern:**
API endpoints that filter data based on user-provided criteria often fail to handle the case where no records match the filter. Without explicit handling, the query returns ALL records instead of an empty set.

**Real-World Bug Example (Fixed March 20, 2026):**
The comment templates API filtered templates by service type and status. When no template availabilities matched the criteria, the filter was skipped entirely, causing ALL active templates to be returned instead of the expected empty array.

**Bug Pattern Example:**
```typescript
// ❌ WRONG - Returns all records when no matches found
const templateWhere: TemplateWhereClause = { isActive: true };

if (availableTemplateIds.length > 0) {
  templateWhere.id = { in: availableTemplateIds.map(a => a.templateId) };
  // Bug: If no IDs match, no filter is applied = all active templates returned
}
```

**Correct Empty Results Pattern:**
```typescript
// ✅ CORRECT - Explicitly handle empty results
const templateWhere: TemplateWhereClause = { isActive: true };

if (availableTemplateIds.length > 0) {
  templateWhere.id = { in: availableTemplateIds.map(a => a.templateId) };
} else {
  // CRITICAL: Force empty result set when no matches found
  // This ensures the API contract is honored: filtering should only return
  // records that match the criteria, not all records when none match.
  templateWhere.id = { in: [] };
}
```

**Prevention Guidelines:**
- Always test filtering endpoints with criteria that match zero records
- Document the expected behavior when no results match the filter
- Use explicit empty array filters (`{ in: [] }`) rather than skipping filter entirely
- Consider whether "no matches" should return empty array or throw an error
- Test the complete user flow: what should users see when no data matches their filter?

**Standard Patterns:**
```typescript
// For ID-based filtering
if (matchingIds.length > 0) {
  where.id = { in: matchingIds };
} else {
  where.id = { in: [] }; // Force empty results
}

// For existence-based filtering
if (hasMatchingCriteria) {
  where.foreignKey = { not: null };
} else {
  // Be explicit about what should happen
  where.id = { in: [] }; // Or throw error if no matches is invalid
}
```

---

## SECTION 8: API Response Format Handling Standard

**CRITICAL:** Always handle API responses defensively to prevent crashes when response format changes from arrays to paginated responses.

**Common API Response Bug:**
Frontend code assumes APIs return plain arrays, but APIs can be updated to return paginated responses with `{ data: [...], meta: {...} }` format. This causes "map is not a function" errors when the array methods are called on the paginated object.

**Bug Pattern Example:**
```typescript
// ❌ WRONG - Assumes API always returns an array
fetch('/api/customers')
  .then(res => res.json())
  .then(data => setCustomers(data)) // Breaks if API returns {data: [...], meta: {...}}
  .then(() => customers.map(...))  // "customers.map is not a function" error
```

**Correct Defensive Pattern:**
```typescript
// ✅ CORRECT - Handles both array and paginated response formats
fetch('/api/customers')
  .then(res => res.json())
  .then(data => {
    // Defensive handling: Support both formats
    const customersArray = Array.isArray(data) ? data : data?.data || [];
    setCustomers(customersArray);
  })
```

**Prevention Guidelines:**
- Always use defensive handling when consuming API responses
- Extract arrays from paginated responses using `data?.data || []` fallback
- Test with both response formats when possible
- Comment the defensive handling to explain why it's necessary
- Consider standardizing API response formats to prevent inconsistency

**Common Locations Requiring Defensive Handling:**
- Customer lists in forms and dropdowns
- Vendor lists in assignment components
- Service lists in configuration pages
- Order lists in fulfillment dashboards
- Any API endpoint that could be paginated in the future

**Standard Defensive Pattern:**
```typescript
// Standard pattern for API array responses
const handleApiResponse = (data: unknown) => {
  if (Array.isArray(data)) {
    return data;
  }
  if (data && typeof data === 'object' && 'data' in data) {
    return Array.isArray(data.data) ? data.data : [];
  }
  return [];
};

// Usage in components
fetch('/api/endpoint')
  .then(res => res.json())
  .then(data => setItems(handleApiResponse(data)))
```

---

## SECTION 9: Database Query Ordering Standard

**CRITICAL:** Always include explicit `orderBy` clauses in Prisma queries that return multiple records to ensure consistent display order across operations.

**Common Ordering Bug:**
Prisma queries without explicit `orderBy` clauses return records in undefined order. This causes UI instability when records appear to "jump around" or change positions after updates, even though the data itself is correct.

**Real-World Bug Example (Fixed March 14, 2026):**
Services within an order were changing display order when their status was updated because there was no explicit orderBy clause when fetching order items. This caused the database to return them in an undefined order, making services appear to "jump around" in the UI after status updates.

**Bug Pattern Example:**
```typescript
// ❌ WRONG - No orderBy specified, results returned in undefined order
const items = await prisma.orderItem.findMany({
  where: { orderId },
  include: {
    service: true,
    location: true
  }
  // Missing orderBy - order can change between queries
});
```

**Correct Ordering Pattern:**
```typescript
// ✅ CORRECT - Explicit ordering prevents UI instability
const items = await prisma.orderItem.findMany({
  where: { orderId },
  include: {
    service: true,
    location: true
  },
  // CRITICAL: Always order by service name then creation time to prevent
  // services from changing display order when their status is updated.
  // Without explicit ordering, Prisma returns results in undefined order
  // which caused UI instability when services moved around after status updates.
  orderBy: [
    { service: { name: 'asc' } },
    { createdAt: 'asc' }
  ]
});
```

**Prevention Guidelines:**
- Include explicit `orderBy` in every query that returns multiple records
- Use meaningful sort orders (alphabetical for user-facing lists, chronological for logs)
- Use multi-level sorting for consistent ordering when primary field has duplicates
- Document the ordering choice in comments if the business logic is not obvious
- Test UI stability by performing updates and verifying records don't move unexpectedly

**Common Ordering Requirements:**
- **Order items:** Sort by service name for consistent display
- **Service lists:** Sort by name for easy scanning
- **Status history:** Sort by date (newest first) for chronological order
- **User lists:** Sort by last name then first name
- **Document lists:** Sort by upload date or document type

**Standard Patterns:**
```typescript
// For user-facing lists - alphabetical
orderBy: { name: 'asc' }

// For audit trails - chronological (newest first)
orderBy: { createdAt: 'desc' }

// For complex relationships - multi-level sorting
orderBy: [
  { service: { name: 'asc' } },
  { createdAt: 'asc' }
]
```

**Files Fixed (March 14, 2026):**
- `/src/lib/services/order-core.service.ts` (lines 505-508, 567-570)
- `/src/app/api/fulfillment/route.ts` (lines 143-146)
- `/src/app/api/fulfillment/orders/[id]/route.ts` (lines 220-223)

---

## SECTION 10: API Error Check Sequence Standard

**CRITICAL:** API route handlers must follow a consistent order of validation checks to ensure appropriate error responses and prevent unintended data exposure.

**Standard Check Sequence:**
When implementing API route handlers, perform validation checks in this exact order:

1. **401 Unauthorized** - Authentication check (session exists)
2. **Customer type skip** - Early exit for non-applicable user types (return success skip status)
3. **400 Bad Request** - Input validation (required parameters, format validation)
4. **404 Not Found** - Resource existence checks (order exists, item exists)
5. **403 Forbidden** - Authorization checks (customer scoping, permissions)
6. **200 Success** - Business logic execution

**Example Implementation:**
```typescript
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  // Step 1: Authentication check - ALWAYS first
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: User type check - skip for non-applicable users
  // WHY: Admin/vendor users on stale URLs shouldn't get 404s when the resource
  // exists but belongs to a different customer - they should get graceful skips
  if (session.user.userType !== 'customer') {
    return NextResponse.json({ skipped: true }, { status: 200 });
  }

  // Step 3: Input validation
  if (!params.id) {
    return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
  }

  // Step 4: Resource existence check
  const resource = await prisma.resource.findUnique({ where: { id: params.id } });
  if (!resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  // Step 5: Authorization check (customer scoping)
  if (resource.customerId !== session.user.customerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Step 6: Business logic execution
  // ... perform the requested operation
}
```

**Why This Sequence Matters:**
- **Authentication first** - Prevents any data leakage to unauthenticated users
- **Type check early** - Prevents inappropriate 404s for admin/vendor users on customer-only endpoints
- **Input validation before DB queries** - Fails fast on malformed requests
- **Existence before authorization** - Clear distinction between "not found" and "not allowed"
- **Authorization last** - Only after confirming resource exists and user should potentially access it

**Common Anti-patterns:**
- Checking authorization before existence (returns 403 when should return 404)
- Checking existence before authentication (potential information leakage)
- Missing user type skip checks (admin users get confusing 404s)

**Pattern Established:** April 8, 2026 - Order View Tracking Phase 2A implementation

---

## SECTION 11: Environment Variables

### 11.1 No Secrets in Code

Database URLs, API keys, passwords, and other secrets must only exist in
environment variables (`.env.local`). Never hardcode secrets in any file
that is committed to GitHub.

### 11.2 Environment Variables Must Be Documented

Every environment variable used in the project must be listed in `.env.example`
with a description of what it is (but not its real value).

---

## SECTION 12: Next.js 15 Migration Requirements

**CRITICAL:** Next.js 15 introduced breaking changes to API route parameter handling that must be addressed in all dynamic route handlers.

### 12.1 Dynamic Route Parameters are Now Promises

In Next.js 15, the `params` object passed to API route handlers is now a Promise that must be awaited before accessing its properties. This is a breaking change from Next.js 14.

**Next.js 14 (Old Pattern):**
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }  // Synchronous object
) {
  const { id } = params; // Direct access worked in Next.js 14
  // ...rest of handler
}
```

**Next.js 15 (Required Pattern):**
```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }  // Now a Promise
) {
  const { id } = await params; // MUST await before accessing properties
  // ...rest of handler
}
```

### 12.2 Migration Impact

**Files Fixed (March 27, 2026):**
- `/src/app/api/packages/[id]/route.ts` - Fixed GET, PUT, DELETE handlers
- `/src/app/api/customers/[id]/packages/route.ts` - Fixed GET, POST handlers

**Runtime Error Before Fix:**
Attempting to destructure properties from `params` without awaiting would cause runtime errors:
```
TypeError: Cannot destructure property 'id' of 'params' as it is undefined
```

### 12.3 Required Changes for All Dynamic Routes

For any API route with dynamic segments (`[id]`, `[slug]`, etc.):

1. **Update the TypeScript interface** to indicate params is a Promise
2. **Add await before destructuring** params properties
3. **Add explanatory comments** about the Next.js 15 requirement
4. **Test the route handlers** to ensure they work correctly

**Standard Comment Pattern:**
```typescript
// Next.js 15 Migration: params is now a Promise that must be awaited
// before accessing its properties. This prevents runtime errors
// when destructuring { id } from the params object.
const { id } = await params;
```

### 12.4 Regression Test Requirements

When fixing Next.js 15 params issues, comprehensive regression tests must be written to prevent future breakage:

- Test that all handlers correctly extract parameters from awaited params
- Test that handlers don't crash with runtime errors
- Test business logic continues to work correctly after the fix
- Add tests that would fail if someone accidentally removes the `await` keyword

---

## SECTION 13: API Documentation

Every API endpoint must have:

```typescript
/**
 * GET /api/customers/[id]/packages
 *
 * Retrieves all packages for a specific customer
 *
 * Required permissions: customers.view
 *
 * Query params:
 *   - status?: 'active' | 'inactive' | 'all'
 *   - limit?: number (default: 25)
 *   - offset?: number (default: 0)
 *
 * Returns: { packages: Package[], total: number }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Customer not found
 */
```

---

## API STANDARDS CHECKLIST

### API Route Verification:
- [ ] Authentication check is first thing in route handler
- [ ] Input validation with Zod before using data
- [ ] Try/catch wraps all database calls
- [ ] Correct HTTP status codes returned
- [ ] Only necessary data returned (no sensitive fields)
- [ ] Using correct endpoint path for user type
- [ ] Centralized permission functions used (not inline checks)
- [ ] Using `session.user.userType` not `session.user.type`
- [ ] Data normalized at API boundaries
- [ ] Query filters handle empty results explicitly
- [ ] Defensive handling for API responses
- [ ] Explicit orderBy in all multi-record queries
- [ ] No hardcoded secrets (use environment variables)
- [ ] Environment variables documented in .env.example
- [ ] API endpoint has JSDoc documentation
- [ ] **Next.js 15 Migration:** Dynamic route params are awaited before use
- [ ] **Next.js 15 Migration:** TypeScript interface shows params as Promise
- [ ] **Next.js 15 Migration:** Regression tests verify params handling