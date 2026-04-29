# /GlobalRX_v2/docs/API_STANDARDS.md
# GlobalRx Platform — API Standards & Conventions

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the rules that MUST be followed when writing, editing, or reviewing API routes in the GlobalRx platform. It covers route structure, authentication, permissions, validation order, data normalization, query patterns, and the JSDoc documentation block every endpoint must carry. These standards are not suggestions — they are requirements.

For general coding rules (TypeScript, file naming, logging), see `CODING_STANDARDS.md`.
For database schema invariants and Prisma rules, see `DATABASE_STANDARDS.md`.
For component-side patterns including file uploads, see `COMPONENT_STANDARDS.md`.

---

## SECTION 1: API Route Structure

Every API route must follow the structure in this section without exception.

### 1.1 The Four Required Elements

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
import logger from '@/lib/logger';

// Zod schema defines the validation contract for incoming data
const createResourceSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export async function POST(request: NextRequest) {
  // Step 1: Authentication — always first
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Validate the incoming request body with Zod
  const body = await request.json();
  const validation = createResourceSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 3: Database operation inside try/catch
  try {
    const result = await prisma.resource.create({
      data: validation.data,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logger.error('Failed to create resource', { event: 'resource_create_failure' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Routes with dynamic params (Next.js 15 — params is a Promise)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15: params must be awaited before use
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ... rest of handler
}
```

### 1.3 HTTP Status Codes

| Situation | Status Code |
|---|---|
| Success (read) | 200 |
| Success (created) | 201 |
| Bad input from user | 400 |
| Not logged in | 401 |
| Logged in but not allowed | 403 |
| Record not found | 404 |
| Server/database error | 500 |

### 1.4 Never Return More Data Than Needed

When returning records, only include the fields the frontend actually needs. Do not return full database objects when a few fields will do. Never return password hashes, tokens, internal flags, or other sensitive system fields.

---

## SECTION 2: Validation Check Order

API route handlers must perform validation checks in a consistent order so that the right HTTP status code is returned for each failure mode and so that information is not leaked to unauthorized callers.

### 2.1 The Required Sequence

1. **401 Unauthorized** — authentication check (session exists)
2. **User type skip (200)** — early exit for non-applicable user types where appropriate
3. **400 Bad Request** — input validation (required parameters, format)
4. **404 Not Found** — resource existence checks
5. **403 Forbidden** — authorization checks (customer scoping, permissions)
6. **200 Success** — business logic execution

### 2.2 Why This Order Matters

- **Authentication first** prevents any data leakage to unauthenticated callers
- **User type skip early** prevents inappropriate 404s for admin/vendor users on customer-only endpoints (a stale URL should produce a graceful skip, not a confusing 404)
- **Input validation before DB queries** fails fast on malformed requests
- **Existence before authorization** keeps the distinction between "not found" and "not allowed" clear
- **Authorization last** means we only check permissions after confirming the resource exists and could potentially be accessed

### 2.3 Reference Implementation

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Step 1: Authentication — always first
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: User type skip — non-customer users get a graceful skip on
  // customer-only endpoints, not a 404 that suggests the resource is missing
  if (session.user.userType !== 'customer') {
    return NextResponse.json({ skipped: true }, { status: 200 });
  }

  // Step 3: Input validation
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: 'Resource ID is required' }, { status: 400 });
  }

  // Step 4: Resource existence
  const resource = await prisma.resource.findUnique({ where: { id } });
  if (!resource) {
    return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
  }

  // Step 5: Authorization (customer scoping)
  if (resource.customerId !== session.user.customerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Step 6: Business logic
  // ... perform the operation
}
```

### 2.4 Common Anti-Patterns to Avoid

- Checking authorization before existence (returns 403 when it should be 404)
- Checking existence before authentication (information leakage)
- Skipping the user type check (admin users get confusing 404s on customer endpoints)

---

## SECTION 3: Permissions

### 3.1 Server-Side Only

Never rely on the frontend hiding a button or page to protect a feature. Role and permission checks must happen in the API route, on the server. A hidden button is a UX choice; an unprotected endpoint is a security vulnerability.

### 3.2 Use Centralized Permission Functions, Always

All permission checking must use the centralized functions in `auth-utils.ts`. Never write inline permission checks inside route handlers.

```typescript
// ✅ CORRECT — centralized permission function
import { canAccessDataRx, canManageCustomers } from '@/lib/auth-utils';

if (!canAccessDataRx(session.user)) {
  return NextResponse.json(
    { error: 'Forbidden — insufficient permissions' },
    { status: 403 }
  );
}

if (!canManageCustomers(session.user)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

```typescript
// ❌ WRONG — inline permission check
if (session.user.permissions?.dsx === true) { /* ... */ }

// ❌ WRONG — checking the deprecated permission shape directly
if (session.user.role === 'admin' || session.user.permissions?.dsx) { /* ... */ }
```

**Why this rule is absolute:**

When the permission system was migrated from the legacy `dsx` permission to the new module-based `global_config` permission, the central functions were updated in one place. But routes that had inline permission checks continued to look for the old `dsx` flag and returned 403 to users who legitimately had the new permission. The frontend (which checked both formats) worked; the backend (which checked only the old format) didn't. The bug was invisible to QA because it only affected users in a specific migration cohort.

A worse instance: the `/api/dsx/remove-requirement` endpoint had no permission check at all. Any authenticated user could delete service requirements. Centralized functions would have made this impossible to ship — the function call would have been the obvious thing to add.

### 3.3 Mandatory Security Verification

1. **Never ship an API endpoint without an authentication check** (Section 1) **and a permission check** (this section, when the endpoint requires anything beyond "logged in")
2. **Always use centralized permission functions** — never inline permission checks
3. **Test endpoints with different user permission levels** during development
4. **Review all related endpoints** when changing any permission requirement
5. **Document security-critical changes** with code comments explaining the fix

---

## SECTION 4: User Type Routing

Different user types must use different API endpoints. Never try to make a single endpoint serve all user types — that pattern leads to permission confusion and security vulnerabilities.

### 4.1 Routing Rules

- **Customer users** → `/api/portal/*` endpoints (require `customerId` validation)
- **Internal users** → `/api/fulfillment/*` or `/api/admin/*` endpoints (require internal permissions)
- **Vendor users** → `/api/vendor/*` endpoints (require `vendorId` validation)

### 4.2 Correct Pattern

```typescript
// In a component that serves different user types:
const endpoint = user.type === 'customer'
  ? `/api/portal/orders/${orderId}`
  : `/api/fulfillment/orders/${orderId}`;
```

### 4.3 Common Mistake That Causes 401 Errors

```typescript
// ❌ WRONG — all users hitting the customer endpoint
const endpoint = `/api/portal/orders/${orderId}`;
// Internal users with fulfillment permissions get 401 here
```

This pattern is the cause of the recurring "internal user gets 401 when viewing an order" bug class.

---

## SECTION 5: User Type Property Standard

**Always use `session.user.userType`. Never use `session.user.type`.**

The session user object from NextAuth defines `userType`, not `type`. The `type` property does not exist. Code that reads `session.user.type` will get `undefined` and the conditional will always go down the "wrong" branch.

```typescript
// ✅ CORRECT
const userType = session.user.userType;
if (userType === 'internal' || userType === 'admin') {
  // Allow access
}

// ❌ WRONG — property doesn't exist, returns undefined
const userType = session.user.type;

// ❌ WRONG — fallback patterns hide the real bug
const userType = session.user.type || session.user.userType;

// ❌ WRONG — type cast bypasses the type system that would have caught this
const userType = (session.user as any).userType;
```

**The type definition lives in `/src/types/next-auth.d.ts`.** When reviewing code, search for `session.user.type` (no surrounding word) — every match is a bug.

---

## SECTION 6: Data Normalization at Boundaries

### 6.1 Normalize at Entry, Not Inside

When data enters the API from a request body, query parameter, or external system, normalize it to the storage format before using it in any database operation. The normalization happens once, at the boundary — not scattered through downstream code.

The most common case is status values, which the database stores in lowercase but which can arrive from external systems in any casing. **The full status casing rule and the constants reference live in `DATABASE_STANDARDS.md` Section 5.** This section covers normalization patterns that apply at the API boundary.

### 6.2 Common Areas Requiring Normalization

| Field type | Storage format | Normalize on receipt |
|---|---|---|
| Status values | lowercase | `inputStatus.toLowerCase()` |
| Email addresses | lowercase | `email.toLowerCase()` |
| Customer codes | uppercase, alphanumeric | strip whitespace, uppercase |
| Service types | per the constants file | reference the constant |

### 6.3 The Pattern

```typescript
// ✅ CORRECT — normalize once, at the API boundary
export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { status, email } = await request.json();

  // Normalize at the boundary
  const normalizedStatus = status?.toLowerCase();
  const normalizedEmail = email?.toLowerCase();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { status: normalizedStatus, email: normalizedEmail },
  });
}
```

### 6.4 Document the Format

When you write or update an API endpoint, document the expected and stored format of any field that needs normalization. Add a comment to the Zod schema and to the JSDoc block (Section 11). A future developer should not have to guess.

---

## SECTION 7: Query Filter Logic

### 7.1 Be Careful With Negative Filters

Filters that exclude records (`{ not: null }`, `{ not: equals }`) are easy to get wrong. A filter intended to scope down a query can accidentally hide data that the user is supposed to see.

```typescript
// ❌ WRONG — excludes unassigned orders that internal users need to manage
if (userType === 'internal') {
  whereClause.assignedVendorId = { not: null };
}

// ✅ CORRECT — internal users see ALL orders (assigned and unassigned)
if (userType === 'vendor') {
  whereClause.assignedVendorId = session.user.vendorId;
}
// Internal users: no filter on assignedVendorId
```

**Rule:** prefer positive filters (include what should be seen) over negative filters (exclude what shouldn't be seen). When you must use a negative filter, write a test that exercises the "absent" case — unassigned records, null foreign keys, empty collections.

### 7.2 Always Handle the Empty-Match Case

When filtering by IDs from a subquery or computed list, the case where the list is empty needs explicit handling. Without it, the filter is silently skipped and all records are returned.

```typescript
// ❌ WRONG — when availableTemplateIds is empty, the filter is skipped
//           and ALL active templates are returned
const templateWhere: TemplateWhereClause = { isActive: true };
if (availableTemplateIds.length > 0) {
  templateWhere.id = { in: availableTemplateIds.map(a => a.templateId) };
}

// ✅ CORRECT — explicit empty-set filter when no IDs match
const templateWhere: TemplateWhereClause = { isActive: true };
if (availableTemplateIds.length > 0) {
  templateWhere.id = { in: availableTemplateIds.map(a => a.templateId) };
} else {
  // Force empty result: filter explicitly says "match nothing"
  templateWhere.id = { in: [] };
}
```

**Real bug this prevents:** the comment templates API filtered templates by service type and status. When no template availabilities matched the criteria, the filter was skipped entirely, causing ALL active templates to be returned instead of the expected empty array. Customers saw templates they shouldn't have had access to.

### 7.3 Distinguish Data Presence From Data Usability

When filtering by related entities, ensure the filter represents the business intent, not just data structure. A filter for "usable workflows" should check both existence AND usability status.

```typescript
// ❌ WRONG — returns packages with any workflow (including draft, disabled)
if (hasWorkflowFilter) {
  whereClause.workflowId = { not: null };
}

// ✅ CORRECT — use application-level filtering for business logic
const packages = await prisma.package.findMany({ where: baseWhere, include: { workflow: true }});
const filteredPackages = hasWorkflowFilter
  ? packages.filter(pkg => {
      if (!pkg.workflow) return false;
      return pkg.workflow.status === 'active' && pkg.workflow.disabled === false;
    })
  : packages;
```

**Rule:** When a filter parameter implies business usability (e.g., `hasWorkflow`, `isActive`, `isAvailable`), verify that the filter checks all conditions that make the entity usable, not just that it exists.

**Real bug this prevents:** The packages API returned packages with draft, archived, and disabled workflows when `hasWorkflow=true` was requested. Customers saw packages they couldn't actually use to create orders, causing confusion in the UI.

### 7.4 Always Include `orderBy` on Multi-Record Queries

Prisma queries without an explicit `orderBy` return records in undefined order. The order is consistent enough to fool you in development and inconsistent enough to break the UI in production.

```typescript
// ❌ WRONG — services jump around in the UI when their status updates
const items = await prisma.orderItem.findMany({
  where: { orderId },
  include: { service: true, location: true },
});

// ✅ CORRECT — explicit, multi-level ordering
const items = await prisma.orderItem.findMany({
  where: { orderId },
  include: { service: true, location: true },
  orderBy: [
    { service: { name: 'asc' } },
    { createdAt: 'asc' },
  ],
});
```

**Standard ordering choices by data type:**

| Data | Default order |
|---|---|
| User-facing lists (customers, vendors, services) | Alphabetical by name |
| Order items | By service name, then creation time |
| Audit trails / history | Chronological, newest first (`createdAt: 'desc'`) |
| User lists | Last name then first name |
| Document lists | Upload date, newest first |

```typescript
// User-facing list — alphabetical
orderBy: { name: 'asc' }

// Audit trail — newest first
orderBy: { createdAt: 'desc' }

// Multi-level
orderBy: [
  { service: { name: 'asc' } },
  { createdAt: 'asc' },
]
```

---

## SECTION 8: Defensive Response Handling

When consuming an API response in client or service code, never assume the response shape will not change. APIs that return arrays today may be paginated tomorrow, returning `{ data: [...], meta: {...} }` instead.

### 8.1 The Bug Pattern

```typescript
// ❌ WRONG — assumes a plain array
fetch('/api/customers')
  .then(res => res.json())
  .then(data => setCustomers(data))    // Breaks if API now returns { data: [...] }
  .then(() => customers.map(...));      // "customers.map is not a function"
```

### 8.2 The Defensive Pattern

```typescript
// ✅ CORRECT — handles both array and paginated formats
fetch('/api/customers')
  .then(res => res.json())
  .then(data => {
    const customersArray = Array.isArray(data) ? data : (data?.data ?? []);
    setCustomers(customersArray);
  });
```

### 8.3 The Reusable Helper

For any code that consumes API responses regularly, use a single helper:

```typescript
const handleApiResponse = (data: unknown): unknown[] => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && 'data' in data) {
    return Array.isArray(data.data) ? data.data : [];
  }
  return [];
};

// Usage
fetch('/api/endpoint')
  .then(res => res.json())
  .then(data => setItems(handleApiResponse(data)));
```

**Common locations that need this defensive pattern:** customer lists in forms and dropdowns, vendor lists in assignment components, service lists in configuration pages, order lists in fulfillment dashboards. Any endpoint that *could* be paginated in the future *should* be consumed defensively today.

---

## SECTION 9: Environment Variables

### 9.1 No Secrets in Code

Database URLs, API keys, passwords, and other secrets must only exist in environment variables (`.env.local`). Never hardcode secrets in any file that is committed to GitHub.

### 9.2 Document Every Variable

Every environment variable used in the project must be listed in `.env.example` with a short description of what it is. The example file should never contain real values — placeholder values only.

---

## SECTION 10: Next.js 15 Dynamic Route Parameters

Next.js 15 changed the type of `params` in route handlers from a synchronous object to a `Promise`. This is a breaking change from Next.js 14 and must be handled in every dynamic route (`[id]`, `[slug]`, etc.) in the codebase.

### 10.1 The Required Pattern

```typescript
// ✅ CORRECT — Next.js 15 requires awaiting params
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ... rest of handler
}
```

```typescript
// ❌ WRONG — Next.js 14 pattern, will throw at runtime in Next.js 15
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;  // TypeError: cannot destructure property 'id' of undefined
  // ... rest of handler
}
```

### 10.2 What to Update

For any route with dynamic segments:

1. **Update the TypeScript interface** to declare `params` as `Promise<{ ... }>`
2. **Add `await`** before destructuring `params`
3. **Add a brief comment** noting the Next.js 15 requirement so a future developer doesn't try to "simplify" the await away
4. **Verify with a regression test** that the handler doesn't throw when called

### 10.3 Standard Comment

```typescript
// Next.js 15: params is a Promise that must be awaited before destructuring
const { id } = await params;
```

---

## SECTION 11: API Documentation (JSDoc)

Every API endpoint must have a JSDoc block describing its contract. This is the single source of truth for how the endpoint behaves — what it requires, what it returns, and what can go wrong.

### 11.1 The Required Format

```typescript
/**
 * GET /api/customers/[id]/packages
 *
 * Retrieves all packages for a specific customer.
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

### 11.2 What Every Block Must Cover

- **Method and path** — exactly as Next.js routes it
- **One-sentence description** of what the endpoint does
- **Required permissions** — name the centralized function or permission key
- **Query params and request body** — including types, defaults, and which are required
- **Response shape** — what the success case returns
- **Error cases** — every status code the handler can return, and what triggers it

### 11.3 When to Update

Update the JSDoc block any time you change the endpoint's behavior — adding a new query param, changing the response shape, adding a new error case, modifying permissions. A stale JSDoc block is worse than no JSDoc block, because it tells the next developer the wrong thing with confidence.

---

## SECTION 12: Document Download API Endpoints

### 12.1 Uploaded Document Access

The platform provides two endpoints for downloading documents that were uploaded to order items:

```typescript
/**
 * GET /api/portal/documents/[id]
 *
 * Downloads a document uploaded to an order item (customer access).
 * Customers can only download documents from their own orders.
 *
 * Required permissions: Must be a customer user
 * Path params: id - The order_data record ID containing the document metadata
 *
 * Returns: File stream with appropriate Content-Type header
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Not a customer user or attempting to access another customer's document
 *   - 404: Document record not found or file missing on disk
 */
```

```typescript
/**
 * GET /api/fulfillment/documents/[id]
 *
 * Downloads a document uploaded to an order item (internal/admin/vendor access).
 * - Internal/admin users can download any document
 * - Vendor users can only download documents from orders assigned to them
 *
 * Required permissions: Must be internal, admin, or vendor user
 * Path params: id - The order_data record ID containing the document metadata
 *
 * Returns: File stream with appropriate Content-Type header
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Vendor attempting to access unassigned order's document
 *   - 404: Document record not found or file missing on disk
 */
```

Both endpoints use the shared `document-download.service.ts` utility which provides:
- `validateFilePath(path)` — ensures the path doesn't escape the uploads directory
- `getDocumentFromOrderData(id, session)` — retrieves and validates document access
- `streamFile(filePath, mimeType)` — streams the file with proper headers

---

## API STANDARDS CHECKLIST

### Route structure:
- [ ] Authentication check is the first thing in the handler
- [ ] Input validated with Zod before being used
- [ ] All database calls inside try/catch
- [ ] Correct HTTP status code returned for each case
- [ ] Only necessary fields returned (no password hashes, tokens, internal flags)

### Validation order:
- [ ] Checks run in order: 401 → user-type skip → 400 → 404 → 403 → 200
- [ ] No 403 returned where the resource doesn't exist (should be 404)
- [ ] No 404 returned for admin/vendor users on customer-only endpoints (should be skip-200)

### Permissions:
- [ ] Permission check uses a centralized function from `auth-utils.ts`
- [ ] No inline permission checks (`session.user.permissions?.x === true`)
- [ ] Endpoint cannot be called without authentication AND (where applicable) permission

### User type and routing:
- [ ] Uses `session.user.userType`, never `session.user.type`
- [ ] Customer endpoints under `/api/portal/*`, internal under `/api/fulfillment/*` or `/api/admin/*`, vendor under `/api/vendor/*`
- [ ] Endpoint not shared across user types in a way that requires per-type branching for permissions

### Data and queries:
- [ ] Status, email, and code values normalized at the API boundary before DB operations
- [ ] Negative filters (`{ not: null }`) reviewed for false-exclusion bugs
- [ ] Empty-match case handled explicitly (`{ in: [] }`) where filtering by a computed ID list
- [ ] Business logic filters check usability, not just data presence (e.g., `hasWorkflow` filters for active, enabled workflows)
- [ ] Explicit `orderBy` on every multi-record query
- [ ] API responses consumed defensively (handles both array and `{ data: [...] }` shapes)

### Environment and Next.js 15:
- [ ] No hardcoded secrets — all values via environment variables
- [ ] Every environment variable documented in `.env.example`
- [ ] Dynamic route params typed as `Promise<{ ... }>` and awaited before destructuring

### Documentation:
- [ ] JSDoc block present on every endpoint
- [ ] JSDoc covers method, path, permissions, params, response shape, and all error cases
- [ ] JSDoc updated when endpoint behavior changes