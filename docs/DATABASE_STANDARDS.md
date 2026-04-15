# /GlobalRX_v2/docs/DATABASE_STANDARDS.md
# GlobalRx Platform — Database, Schema & Migration Standards

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the rules that MUST be followed when working with the database in the GlobalRx platform. It covers business logic that is expressed in the database, schema invariants, Prisma migrations, migration safety, status value handling, and validation. These standards are not suggestions — they are requirements.

For general coding rules, see `CODING_STANDARDS.md`.
For API-level data handling (normalization at request boundaries, query patterns), see `API_STANDARDS.md`.

---

## SECTION 1: Business Logic Expressed in the Database

### 1.1 Order ID Format

Background check orders use this ID format:

```
YYYYMMDD-[CustomerCode]-NNNN
```

Example: `20250223-XK7-0003`

| Part | Format | Description |
|------|--------|-------------|
| Date | 8 digits, no dashes (YYYYMMDD) | Date the order was placed |
| Customer Code | 3–4 alphanumeric characters | Short code representing the customer |
| Sequence | 4 digits, zero-padded | That customer's order count for the day |

**Rules:**
- Sequence resets to 0001 each day, per customer
- Maximum 9,999 orders per customer per day (4-digit sequence)
- Customer codes are short alphanumeric identifiers — never the customer's full name
- The ID must be human-readable and suitable for reading aloud over the phone

### 1.2 Customer Codes

- 3–4 characters, alphanumeric
- Assigned when a customer account is created
- Must be unique across all customers
- Should not be the customer's full company name

---

## SECTION 2: Schema Invariants

These are absolute rules about how the database schema works in practice. The Prisma schema file may not enforce all of them directly — some are business invariants that depend on application code to maintain. Violating any of them has caused real production bugs. **Never violate these rules, regardless of what the schema file appears to allow.**

### 2.1 `DSXRequirement.fieldKey` Is Immutable After Creation

The `DSXRequirement` model (table `dsx_requirements`) has two name-like fields that serve different purposes:

- **`name`** — the human-readable label shown in the UI. This is editable and changes freely.
- **`fieldKey`** — the stable, camelCase storage key used in JSON data stored on orders. This has a `@unique` constraint in the Prisma schema. **It must never change after the requirement is created.**

**Why this matters:**
When a user fills out a background check order, the subject data (names, dates, addresses, etc.) is stored as JSON on the order record. Each field in that JSON is keyed by its `fieldKey`, not by its display label. If a user renames a requirement in Global Configurations, the label changes — but every existing order that used the old `fieldKey` would become unreadable if the `fieldKey` also changed. The data would still be there, but the application would no longer know how to find it.

**Rules:**
1. **`fieldKey` is set exactly once**, when the `DSXRequirement` is created
2. **`fieldKey` must never be updated**, by migration, by API, by seed, or by direct SQL
3. **Renaming a requirement changes `name` only** — never `fieldKey`
4. **New requirements must use camelCase `fieldKey`** (e.g., `schoolName`, `dateOfBirth`), not kebab-case or snake_case
5. **When checking for an existing requirement**, match on `fieldKey` (not `name`) — `fieldKey` is the stable identity
6. **Migrations that modify `dsx_requirements`** must not touch the `fieldKey` column of any existing row

**The `name` field can change at any time** — relabeling a field in the UI is a purely cosmetic change and should work without affecting any stored order data.

### 2.2 Every `OrderItem` Must Have a Matching `ServicesFulfillment` Record

Every row in `order_items` must have exactly one matching row in `services_fulfillment`, created in the same database transaction. This is a strict 1:1 relationship.

**Note on the Prisma schema:** the `OrderItem` model declares the relation as `serviceFulfillment ServicesFulfillment?` with a question mark. The question mark is a Prisma quirk — Prisma requires one side of every 1:1 relation to be marked optional in the schema file. **Do not let this mislead you. The business invariant is that the relationship is mandatory.** An `OrderItem` without a `ServicesFulfillment` is a broken record.

**Why this matters:**
Comments, audit logs, attachments, badges, and results all attach to the `ServicesFulfillment` record, not the `OrderItem`. If an `OrderItem` is ever created without a matching `ServicesFulfillment`, every downstream feature that reads through the fulfillment record fails silently — comments have nowhere to go, attachments get orphaned, audit logs lose their parent, and status transitions behave unpredictably.

**Rules:**
1. **Never create an `OrderItem` outside a transaction** that also creates the matching `ServicesFulfillment`
2. **The matching `ServicesFulfillment` is always created with `assignedVendorId: null`** — vendor assignment happens later, explicitly, based on service requirements and vendor availability
3. **The canonical function for creating an `OrderItem`** is `OrderCoreService.addOrderItem` in `src/lib/services/order-core.service.ts`. It wraps both records in `prisma.$transaction()`. **Use this function.** Do not write new code that creates `OrderItem` records directly via `prisma.orderItem.create()` — you will forget the `ServicesFulfillment` and the bug will not surface until production.
4. **`createCompleteOrder` (same file) also uses `addOrderItem`** in a loop when creating multiple items. If you are creating multiple order items at once, use `createCompleteOrder` or call `addOrderItem` inside a transaction yourself.
5. **Tests that mock `prisma.orderItem.create()` must also mock the `ServicesFulfillment` creation** — otherwise the test passes but the production code path is not exercised

**Known tech debt:** `order-core.service.ts` is a large file that is tracked as tech debt (see the file size guidance in `CODING_STANDARDS.md`). This does not change the rule — the transactional creation pattern inside that file is correct, even if the file itself eventually needs to be split. When the file is split, the transactional pattern must be preserved.

### 2.3 `VendorOrganization` Has `contactEmail`, Not `email`

The `VendorOrganization` model does not have an `email` field. The correct field name is `contactEmail`.

**Wrong:**
```typescript
assignedVendor: { select: { email: true } }
```

**Correct:**
```typescript
assignedVendor: { select: { contactEmail: true } }
```

**This mistake will not be caught by tests** because Prisma mocks return whatever you tell them to return. The error only appears at runtime when a real database query executes against the real schema. Always check the schema file when selecting fields from `VendorOrganization`.

---

## SECTION 3: Prisma Migration Process

### 3.1 This Project Does Not Use `prisma migrate dev`

**IMPORTANT:** This project runs in a non-interactive environment (Claude Code), so the standard `pnpm prisma migrate dev` will NOT work. Attempting to use `migrate dev` will fail or produce unexpected results.

### 3.2 The Required Migration Process

```bash
# 1. Update the schema
#    Edit prisma/schema.prisma with your changes

# 2. Create a migration directory with a timestamp
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_feature_name

# 3. Write the SQL migration file
#    Create migration.sql in the new directory with your SQL changes

# 4. Apply the migration
pnpm prisma migrate deploy

# 5. Regenerate the Prisma client so TypeScript types match
pnpm prisma generate
```

### 3.3 Migration File Requirements

- **Use descriptive names** — `add_service_comments`, not `update_db`
- **Include indexes** for foreign keys and commonly queried fields
- **Add appropriate CASCADE rules** for foreign key relationships
- **Use correct PostgreSQL data types** (`TEXT` for UUIDs, `VARCHAR` for bounded strings)

### 3.4 Schema Best Practices

- Always add `@@map("table_name")` so Prisma uses snake_case in the database while keeping PascalCase models in code
- Include audit fields: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- Use `@default(now())` for timestamps
- Define both sides of relations properly

---

## SECTION 4: Migration Safety Patterns

Every database migration must follow the safety patterns in this section. These exist to make migrations idempotent, verifiable, and safe to run in production.

### 4.1 The Five Requirements

1. **Every migration must be idempotent** — safe to run multiple times without duplicating data
2. **Include comprehensive logging** so progress can be tracked and failures diagnosed
3. **Implement verification logic** to confirm the migration achieved its goal
4. **Document business requirements** in SQL comments — explain *why*, not just *what*
5. **Use atomic operations** within transactions where possible

### 4.2 Migration Template

Use this as the template for every new migration:

```sql
-- /GlobalRX_v2/prisma/migrations/YYYYMMDD_descriptive_name/migration.sql
--
-- Business requirement: Why this migration is needed
-- Data integrity goal: What consistency issue this solves
-- Safe to run multiple times (idempotent)

-- Start logging
DO $$
BEGIN
  RAISE NOTICE 'Starting migration_name...';
END $$;

-- Main operation with idempotency protection
INSERT INTO target_table (id, required_field, optional_field)
SELECT
  gen_random_uuid(),
  source.required_value,
  NULL  -- Explanation: why this defaults to NULL
FROM source_table source
LEFT JOIN target_table target ON target.foreign_key = source.id
WHERE target.id IS NULL  -- Only insert if record doesn't exist
ON CONFLICT (unique_constraint) DO NOTHING;

-- Log how many rows were affected
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Migration affected % records', affected_count;
END $$;

-- Verification: did the migration achieve its goal?
DO $$
DECLARE
  expected_count INTEGER;
  actual_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO expected_count FROM source_table;
  SELECT COUNT(*) INTO actual_count FROM target_table;

  IF expected_count != actual_count THEN
    RAISE WARNING 'Verification failed: Expected %, got %', expected_count, actual_count;
  ELSE
    RAISE NOTICE 'Verification passed: % records confirmed', actual_count;
  END IF;
END $$;

-- Final summary
DO $$
BEGIN
  RAISE NOTICE 'migration_name completed successfully';
END $$;
```

### 4.3 Idempotency Patterns

**For INSERT operations** — use `ON CONFLICT` to prevent duplicates:
```sql
INSERT INTO table_name (unique_field, other_field)
SELECT value1, value2 FROM source_table
ON CONFLICT (unique_field) DO NOTHING;
```

**For UPDATE operations** — use `WHERE` clauses to only update rows that actually need it:
```sql
UPDATE table_name
SET field = new_value
WHERE field != new_value
  AND condition_for_migration;
```

**For UPSERT operations** — use `ON CONFLICT DO UPDATE` for complex cases:
```sql
INSERT INTO table_name (key, field1, field2)
VALUES (value1, value2, value3)
ON CONFLICT (key) DO UPDATE SET
  field2 = EXCLUDED.field2
WHERE table_name.field2 != EXCLUDED.field2;
```

### 4.4 Verification Requirements

Every migration must include verification logic. At minimum, count verification:

```sql
DECLARE
  source_count INTEGER;
  target_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO source_count FROM source_table WHERE condition;
  SELECT COUNT(*) INTO target_count FROM target_table WHERE condition;

  IF source_count != target_count THEN
    RAISE WARNING 'Count mismatch: Source %, Target %', source_count, target_count;
  END IF;
END
```

For migrations that create or modify relationships, also verify no orphaned records exist:

```sql
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM child_table c
  LEFT JOIN parent_table p ON p.id = c.parent_id
  WHERE p.id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned records', orphaned_count;
  END IF;
END
```

### 4.5 Logging Standards

**Required messages:**
- Migration start: `'Starting migration_name...'`
- Progress: `'Processed % records'` or `'Created % new records'`
- Verification result: `'Verification passed: % records confirmed'` or a `WARNING` on failure
- Migration completion: `'migration_name completed successfully'`

**Warning conditions:** always use `RAISE WARNING` for verification failures, count mismatches, and data inconsistencies. Do not silently continue.

### 4.6 Large Data Migrations

For tables with more than 10,000 records, consider batch processing to avoid long-running transactions:

```sql
DO $$
DECLARE
  batch_size INTEGER := 1000;
  processed INTEGER := 0;
  batch_count INTEGER;
BEGIN
  LOOP
    INSERT INTO target_table (...)
    SELECT ... FROM source_table
    WHERE id > processed
    ORDER BY id
    LIMIT batch_size;

    GET DIAGNOSTICS batch_count = ROW_COUNT;
    processed := processed + batch_count;
    RAISE NOTICE 'Processed % records (batch of %)', processed, batch_count;

    EXIT WHEN batch_count < batch_size;
  END LOOP;
END $$;
```

### 4.7 Anti-Patterns

**Never do:**
- Bare inserts with no idempotency protection (`INSERT INTO table_name VALUES (...)`)
- Migrations with no verification
- Migrations with no logging
- Destructive operations (`DELETE`, `DROP`, `TRUNCATE`) without safeguards and explicit human approval

**Always do:**
- Idempotent operations
- Verification logic
- Detailed logging
- Business-requirement comments at the top of the file

---

## SECTION 5: Status Value Consistency

**All status values in the database must be lowercase.** This applies to order status, service status, application status, and any other status-type field. Mixed casing caused real production bugs in March 2026 where "SUBMITTED", "Submitted", and "submitted" existed as three separate values in the same column, breaking comment filtering, terminal-status checks, and UI state.

### 5.1 The Single Source of Truth

Status values live in a constants file, not in schemas, not in components, not in Zod enums as string literals. Every other file references the constants file.

```typescript
// src/constants/service-status.ts
export const SERVICE_STATUSES = {
  DRAFT: 'draft',           // All lowercase — database format
  SUBMITTED: 'submitted',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const SERVICE_STATUS_VALUES = Object.values(SERVICE_STATUSES);
```

### 5.2 Never Hardcode Status Values

Anywhere you write a status value, it must come from the constants file — never a string literal.

```typescript
// ❌ WRONG — hardcoded string literal
const orderItem = await tx.orderItem.create({
  data: { orderId, serviceId, status: 'pending' },
});

// ❌ WRONG — Title Case literal, won't match lowercase DB values
await createService({ status: 'Submitted' });

// ✅ CORRECT — reference the constant
import { SERVICE_STATUSES } from '@/constants/service-status';

await createService({ status: SERVICE_STATUSES.SUBMITTED });
```

**Why this matters beyond casing:** In commit `3706b39`, the `pending` status was removed from `SERVICE_STATUSES`, but multiple locations in the codebase still hardcoded `status: 'pending'`, creating order items with invalid status values that didn't exist in the system. Referencing the constant would have caused a TypeScript error and caught the bug at build time.

### 5.3 Zod Schemas Reference the Constants

```typescript
// ❌ WRONG — hardcoded enum values drift from the constants
export const serviceStatusSchema = z.enum(['Completed', 'Cancelled', 'Submitted']);

// ✅ CORRECT — enum built from the constants
import { SERVICE_STATUS_VALUES } from '@/constants/service-status';
export const serviceStatusSchema = z.enum(SERVICE_STATUS_VALUES);
```

### 5.4 Normalize Incoming Status Values at API Boundaries

When a status value arrives from a request body, query parameter, or external system, normalize it to lowercase before using it in any database query. Never trust that the caller sent lowercase.

```typescript
// ✅ CORRECT — normalize before touching the database
const normalizedStatus = inputStatus.toLowerCase();
await prisma.service.updateMany({
  where: { id: serviceId },
  data: { status: normalizedStatus },
});
```

### 5.5 Inherit Status From Parent Entities When Appropriate

When creating child records, inherit the status from the parent rather than defaulting it:

```typescript
// ✅ CORRECT — inherit from the parent order
const orderItem = await tx.orderItem.create({
  data: {
    orderId,
    serviceId,
    status: order.statusCode, // Inherit from parent
  },
});
```

### 5.6 Display Code Must Not Hardcode Formatted Status Strings

Display code (React components) must never hardcode Title Case or ALL CAPS status values to compare against database values. If you need to display a status in Title Case, use the `formatStatus()` helper — do not compare against the formatted string.

```typescript
// ❌ WRONG — won't match lowercase DB value
if (service.status === 'Completed') { ... }

// ✅ CORRECT — compare against the constant (lowercase)
if (service.status === SERVICE_STATUSES.COMPLETED) { ... }

// ✅ CORRECT — for display only, use the helper
<span>{formatStatus(service.status)}</span>
```

### 5.7 Testing Requirement

Any API endpoint that accepts a status value must have a test that exercises mixed-case input and verifies the value is lowercased before reaching the database:

```typescript
it('normalizes mixed-case status input to lowercase', async () => {
  const testCases = ['COMPLETED', 'Completed', 'completed'];

  for (const statusInput of testCases) {
    const response = await request(app)
      .put(`/api/services/${serviceId}/status`)
      .send({ status: statusInput });

    expect(response.status).toBe(200);
    const service = await prisma.orderItem.findUnique({ where: { id: serviceId } });
    expect(service.status).toBe(statusInput.toLowerCase());
  }
});
```

---

## SECTION 6: Checkbox and Toggle UI Logic

**When a checkbox controls a database record, "unchecked" means "optional" or "disabled" — it must never mean "deleted".**

### 6.1 The Bug Pattern

A common implementation mistake is to create a database record when a checkbox is checked and delete the record when it's unchecked. This causes data to disappear entirely rather than becoming optional, breaking user expectations and sometimes causing data loss.

**Real-world example (fixed March 15, 2026):** DSX matrix checkboxes were deleting `DSXMapping` records when unchecked, causing requirement fields to disappear entirely instead of becoming optional. Users expected unchecked fields to remain visible but optional.

### 6.2 Wrong vs. Correct

```typescript
// ❌ WRONG — deleting on uncheck, fields disappear
if (isChecked) {
  await prisma.mapping.create({ /* data */ });
} else {
  await prisma.mapping.delete({ /* where */ });
}

// ✅ CORRECT — upsert with a boolean flag, records preserved
await prisma.mapping.upsert({
  where: { /* unique key */ },
  create: { /* data */, isRequired: isChecked },
  update: { isRequired: isChecked },
});
```

### 6.3 Rules

- Use boolean flags (`isRequired`, `isEnabled`, `isActive`) rather than presence/absence of records
- Preserve database records even when the checkbox is unchecked
- "Unchecked" means "disabled/optional", not "deleted/non-existent"
- Test the complete flow: check → uncheck → check again. Values must be preserved across the round trip.
- Document expected behavior clearly in code comments

### 6.4 User Expectation Model

| Checkbox state | What it means |
|---|---|
| Checked | This field is required/enabled |
| Unchecked | This field is optional/disabled |
| Missing | This field doesn't exist — avoid this case |

---

## SECTION 7: Required Field Validation

When an API endpoint creates a database record, every required field in the Prisma schema must be either (a) provided in the request body and validated, (b) auto-generated by the API, or (c) derived from authentication context. Missing required fields cause 500 errors at runtime that should have been caught as 400s.

### 7.1 The Three Categories of Required Fields

**User-provided required fields** — validated in the request body, return 400 if missing.
Examples: `name`, `email`, `category`, `description`.

**Auto-generated required fields** — generated by the API, not provided by the user.
Examples: `code`, `slug`, unique identifiers derived from other fields. Must include uniqueness-conflict handling.

**System-assigned required fields** — derived from authentication or request context, never in the request body.
Examples: `createdById`, `updatedById`, `tenantId`.

### 7.2 Correct Pattern

```typescript
// ✅ CORRECT — all three categories handled
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, category } = await request.json();

  // User-provided fields: validate, return 400 if missing
  if (!name || !category) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Auto-generated field with uniqueness retry
  const code = generateServiceCode(name);

  try {
    const newService = await prisma.service.create({
      data: {
        name,
        category,
        code,                          // Auto-generated
        createdById: session.user.id,  // System-assigned
        updatedById: session.user.id,  // System-assigned
      },
    });
    return NextResponse.json(newService, { status: 201 });
  } catch (error) {
    // Handle unique-constraint violations gracefully
  }
}
```

### 7.3 Auto-Generation With Uniqueness Handling

When a field is auto-generated and has a unique constraint, implement retry logic for conflicts:

```typescript
let code = baseCode;
let suffix = 1;
for (let attempt = 0; attempt < maxAttempts; attempt++) {
  try {
    return await prisma.service.create({ data: { ...data, code } });
  } catch (error) {
    if (error.code === 'P2002') { // Prisma unique constraint violation
      code = baseCode + suffix++;
      continue;
    }
    throw error;
  }
}
```

### 7.4 Testing Requirement

Every create endpoint must have a test that sends an empty body and verifies a 400 response (not a 500), and a test that verifies auto-generated fields are actually generated.

---

## SECTION 8: Migration Documentation Template

For database migrations or breaking schema changes, create documentation in the format below:

```markdown
# Migration: [Description]

## Date: YYYY-MM-DD

## What Changed
- List of changes

## Migration Steps

### Development (Non-Interactive Environment like Claude Code)
1. Update `prisma/schema.prisma` with your changes
2. Create migration directory: `mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_descriptive_name`
3. Create `migration.sql` file in that directory with the SQL changes
4. Apply migration: `pnpm prisma migrate deploy`
5. Regenerate client: `pnpm prisma generate`

### Production Deployment
1. Backup database
2. Run migration: `pnpm prisma migrate deploy`
3. Update environment variables
4. Restart application

## Rollback Plan
Steps to revert if needed
```

---

## DATABASE STANDARDS CHECKLIST

### Schema invariants:
- [ ] `DSXRequirement.fieldKey` is never modified for an existing row
- [ ] New requirements use camelCase `fieldKey` (e.g., `schoolName`)
- [ ] Requirement lookups match on `fieldKey`, not `name`
- [ ] Every `OrderItem` creation goes through `OrderCoreService.addOrderItem` or another function that wraps both records in a transaction
- [ ] No direct `prisma.orderItem.create()` calls outside the order-core service
- [ ] `VendorOrganization` selects use `contactEmail`, not `email`

### Migration safety:
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Includes comprehensive logging
- [ ] Has verification logic that confirms success
- [ ] Business requirements documented in SQL comments
- [ ] Uses atomic operations where possible
- [ ] Includes `ON CONFLICT` for inserts
- [ ] `WHERE` clauses prevent redundant updates
- [ ] Batch processing for large datasets (>10K records)

### Prisma / schema:
- [ ] Descriptive migration names used
- [ ] Indexes on foreign keys and commonly queried fields
- [ ] `CASCADE` rules defined for foreign keys
- [ ] Using `@@map()` for snake_case table names
- [ ] Audit fields included (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`)
- [ ] Relations defined on both sides
- [ ] Used `pnpm prisma migrate deploy`, never `migrate dev`

### Database logic:
- [ ] Order IDs follow `YYYYMMDD-CODE-NNNN` format
- [ ] Customer codes are 3–4 alphanumeric characters
- [ ] Checkbox logic uses boolean flags, not record deletion
- [ ] Status values use constants from `/src/constants/`, never string literals
- [ ] Status values are lowercase in the database
- [ ] Zod schemas reference status constants, not hardcoded enums
- [ ] Status values normalized (lowercased) at API boundaries before DB operations
- [ ] Display code uses `formatStatus()` for Title Case, not hardcoded comparisons
- [ ] Required fields validated or auto-generated in every create endpoint
- [ ] Create endpoints return 400 (not 500) when required fields are missing