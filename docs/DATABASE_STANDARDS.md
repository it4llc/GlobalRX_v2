# /GlobalRX_v2/docs/DATABASE_STANDARDS.md
# GlobalRx Platform — Database & Migration Standards

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the database, Prisma, and migration standards that MUST be followed
when working with the database in the GlobalRx platform. These standards are not
suggestions — they are requirements.

---

## SECTION 1: Business Logic Standards

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

## SECTION 2: Database Changes and Prisma Migrations

### 2.1 Prisma Migration Process

**IMPORTANT:** This project runs in a non-interactive environment (Claude Code), so the standard `pnpm prisma migrate dev` will NOT work.

#### For Development (Non-Interactive) (local terminal):
```bash
# 1. Update the schema
# Edit prisma/schema.prisma with your changes

# 2. Create migration directory with timestamp
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_feature_name

# 3. Write SQL migration file
# Create migration.sql in the new directory with your SQL changes

# 4. Apply the migration
pnpm prisma migrate deploy

# 5. Regenerate Prisma client for TypeScript types
pnpm prisma generate
```

#### For Interactive Development:
```bash
# Standard Prisma workflow works here
pnpm prisma migrate dev --name add_feature_name
```

### 2.2 Migration File Requirements

- Use descriptive names: `add_service_comments`, not `update_db`
- Include indexes for foreign keys and commonly queried fields
- Add appropriate CASCADE rules for foreign keys
- Use correct PostgreSQL data types (TEXT for UUIDs, VARCHAR for limited strings)

### 2.3 Schema Best Practices

- Always add `@@map("table_name")` to use snake_case in database
- Include audit fields: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
- Use `@default(now())` for timestamps
- Define both sides of relations properly

---

## SECTION 3: Migration Safety Patterns

All database migrations must follow these safety patterns to ensure production reliability and data integrity.

### 3.1 CRITICAL REQUIREMENTS

1. **Every migration must be idempotent** - safe to run multiple times
2. **Include comprehensive logging** for monitoring and debugging
3. **Implement verification logic** to confirm migration success
4. **Document business requirements** in SQL comments
5. **Use atomic operations** within transactions where possible

### 3.2 Migration File Structure

**GOOD Migration Template:**
```sql
-- /GlobalRX_v2/prisma/migrations/YYYYMMDD_descriptive_name/migration.sql

-- Business requirement explanation: Why this migration is needed
-- Data integrity improvement: What data consistency issue this solves
-- Safe to run multiple times (idempotent)

-- Start logging
DO $$
BEGIN
  RAISE NOTICE 'Starting migration_name migration...';
END $$;

-- Main migration operation with idempotency protection
INSERT INTO target_table (
  id,
  required_field,
  optional_field
)
SELECT
  gen_random_uuid(),
  source.required_value,
  NULL  -- Comment explaining why this defaults to NULL
FROM source_table source
LEFT JOIN target_table target ON target.foreign_key = source.id
WHERE target.id IS NULL  -- Only insert if record doesn't exist
ON CONFLICT (unique_constraint) DO NOTHING;

-- Log results
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Migration affected % records', affected_count;
END $$;

-- Verification: Ensure migration achieved its goal
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
  RAISE NOTICE 'Migration_name completed successfully';
END $$;
```

### 3.3 Migration Documentation Requirements

**In SQL Comments:**
- Explain business requirement driving the migration
- Document why specific default values are chosen
- Explain any complex WHERE clauses or JOINs
- Note any potential performance considerations

**Business Logic Comments:**
```sql
-- Business rule: ServicesFulfillment records start unassigned (assignedVendorId = NULL)
-- to allow manual vendor assignment based on service requirements and vendor availability.
-- This prevents automatic assignments that might not match business requirements.
assignedVendorId: NULL,
```

### 3.4 Idempotency Patterns

**For INSERT operations:**
```sql
-- Use ON CONFLICT to prevent duplicate insertions
INSERT INTO table_name (unique_field, other_field)
SELECT value1, value2
FROM source_table
ON CONFLICT (unique_field) DO NOTHING;
```

**For UPDATE operations:**
```sql
-- Use WHERE clauses to only update records that need updating
UPDATE table_name
SET field = new_value
WHERE field != new_value  -- Only update if different
  AND condition_for_migration;
```

**For UPSERT operations:**
```sql
-- Use ON CONFLICT with DO UPDATE for complex upserts
INSERT INTO table_name (key, field1, field2)
VALUES (value1, value2, value3)
ON CONFLICT (key) DO UPDATE SET
  field2 = EXCLUDED.field2
WHERE table_name.field2 != EXCLUDED.field2;  -- Only update if different
```

### 3.5 Verification Requirements

Every migration must include verification logic:

**Count Verification:**
```sql
-- Verify expected vs actual record counts
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

**Data Integrity Verification:**
```sql
-- Verify no orphaned records exist
DECLARE
  orphaned_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM child_table c
  LEFT JOIN parent_table p ON p.id = c.parent_id
  WHERE p.id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned records', orphaned_count;
  ELSE
    RAISE NOTICE 'No orphaned records found';
  END IF;
END
```

### 3.6 Logging Standards

**Required log messages:**
- Migration start: `'Starting migration_name migration...'`
- Progress updates: `'Processed % records'` or `'Created % new records'`
- Verification results: `'Verification passed: % records confirmed'`
- Migration completion: `'Migration_name completed successfully'`

**Warning conditions:**
- Verification failures: `RAISE WARNING 'Verification failed: ...'`
- Unexpected counts: `RAISE WARNING 'Count mismatch: Expected %, got %'`
- Data inconsistencies: `RAISE WARNING 'Found % inconsistent records'`

### 3.7 Performance Considerations

**For large data migrations:**
- Consider batch processing for tables with > 10,000 records
- Use efficient indexes for JOIN and WHERE operations
- Monitor transaction log size during migration
- Plan for maintenance window if migration affects production performance

**Example batch processing:**
```sql
-- Process in batches to avoid long-running transactions
DO $$
DECLARE
  batch_size INTEGER := 1000;
  processed INTEGER := 0;
  batch_count INTEGER;
BEGIN
  LOOP
    -- Process one batch
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

### 3.8 Common Migration Anti-Patterns to Avoid

**❌ NEVER DO:**
```sql
-- No verification
INSERT INTO table_name SELECT * FROM source_table;

-- No idempotency protection
INSERT INTO table_name VALUES (...);

-- No logging
ALTER TABLE table_name ADD COLUMN new_field TEXT;

-- Destructive operations without safeguards
DELETE FROM table_name WHERE condition;
```

**✅ ALWAYS DO:**
```sql
-- Comprehensive migration with all safety patterns
-- Include business requirement comments
-- Use idempotent operations
-- Add verification logic
-- Include detailed logging
-- Document the "why" not just the "what"
```

---

## SECTION 4: Checkbox/Toggle UI Logic Standard

**CRITICAL:** When building checkbox or toggle interfaces that control database records, ensure that "unchecked" means "optional" or "disabled", NOT "deleted".

### 4.1 Common Checkbox Logic Bug

Many developers implement checkbox UIs by creating database records when checked and deleting records when unchecked. This causes data to disappear entirely rather than becoming optional, which breaks user expectations and can cause data loss.

**Real-World Bug Example (Fixed March 15, 2026):**
DSX matrix checkboxes were deleting DSXMapping records when unchecked, causing requirement fields to disappear entirely instead of becoming optional. Users expected unchecked fields to remain visible but optional.

### 4.2 Bug Pattern Example

```typescript
// ❌ WRONG - Deletes records when unchecked, fields disappear
if (isChecked) {
  await prisma.mapping.create({ /* data */ });
} else {
  await prisma.mapping.delete({ /* where */ }); // Field disappears!
}
```

### 4.3 Correct Checkbox Pattern

```typescript
// ✅ CORRECT - Updates boolean flag, preserves records
await prisma.mapping.upsert({
  where: { /* unique key */ },
  create: {
    /* data */,
    isRequired: isChecked
  },
  update: {
    isRequired: isChecked  // Checked = required, unchecked = optional
  }
});
```

### 4.4 Prevention Guidelines

- Use boolean flags (`isRequired`, `isEnabled`, `isActive`) instead of presence/absence of records
- Preserve database records even when checkboxes are unchecked
- "Unchecked" should mean "disabled/optional", not "deleted/non-existent"
- Test the complete user flow: check → uncheck → check again
- Verify that unchecked items remain in the UI as optional/disabled
- Document the expected behavior clearly in code comments

### 4.5 User Expectation Rules

- **Checked checkbox** = "This field is required/enabled"
- **Unchecked checkbox** = "This field is optional/disabled"
- **Missing checkbox** = "This field doesn't exist" (avoid this pattern)

**Files Fixed (March 15, 2026):**
- `/src/app/api/dsx/route.ts` (lines 291-305) - DSX matrix checkbox logic
- `/src/app/api/dsx/__tests__/dsx-required-fields.test.ts` - Tests verifying correct behavior

---

## SECTION 5: VendorOrganization Field Names

The VendorOrganization model does not have an email field. The correct field name is contactEmail.

**Wrong:**
```typescript
assignedVendor: { select: { email: true } }
```

**Correct:**
```typescript
assignedVendor: { select: { contactEmail: true } }
```

This mistake will not be caught by tests because Prisma mocks return whatever you tell them to — the error only appears at runtime when a real database query executes.

---

## SECTION 6: Migration Documentation

For database migrations or breaking changes:

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

### Migration Safety:
- [ ] Migration is idempotent (safe to run multiple times)
- [ ] Includes comprehensive logging
- [ ] Has verification logic to confirm success
- [ ] Business requirements documented in SQL comments
- [ ] Uses atomic operations where possible
- [ ] Includes ON CONFLICT for inserts
- [ ] WHERE clauses prevent redundant updates
- [ ] Batch processing for large datasets (>10K records)

### Prisma/Schema:
- [ ] Descriptive migration names used
- [ ] Indexes on foreign keys and commonly queried fields
- [ ] CASCADE rules defined for foreign keys
- [ ] Using `@@map()` for snake_case table names
- [ ] Audit fields included (createdAt, updatedAt)
- [ ] Relations defined on both sides

### Database Logic:
- [ ] Order IDs follow YYYYMMDD-CODE-NNNN format
- [ ] Customer codes are 3-4 alphanumeric characters
- [ ] Checkbox logic uses boolean flags, not record deletion
- [ ] Using correct VendorOrganization field names
- [ ] Migration documentation created for changes