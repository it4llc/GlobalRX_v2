-- Add customerId to workflows table
-- This allows workflows to be owned by a customer independently of package assignments

-- Step 1: Add the column as nullable first
ALTER TABLE workflows ADD COLUMN "customerId" TEXT;

-- Step 2: Backfill customerId from existing package relationships
DO $$
DECLARE
  updated_count INTEGER;
  null_count INTEGER;
  workflow_rec RECORD;
BEGIN
  RAISE NOTICE 'Starting backfill of customerId in workflows table...';

  -- Update workflows that have packages
  UPDATE workflows w
  SET "customerId" = p."customerId"
  FROM packages p
  WHERE p."workflowId" = w.id
  AND w."customerId" IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % workflows with customerId from their packages', updated_count;

  -- Count how many workflows still have NULL customerId
  SELECT COUNT(*) INTO null_count
  FROM workflows
  WHERE "customerId" IS NULL;

  IF null_count > 0 THEN
    RAISE NOTICE 'WARNING: % workflows have no packages and customerId is NULL', null_count;
    RAISE NOTICE 'These workflows need manual assignment:';

    FOR workflow_rec IN
      SELECT id, name
      FROM workflows
      WHERE "customerId" IS NULL
      ORDER BY name
    LOOP
      RAISE NOTICE '  - Workflow ID: %, Name: %', workflow_rec.id, workflow_rec.name;
    END LOOP;

    -- For now, we'll assign these orphan workflows to a default customer if one exists
    -- Check if we have any customers at all
    IF EXISTS (SELECT 1 FROM customers LIMIT 1) THEN
      -- Try to find a customer named 'GlobalRx' or similar as default
      UPDATE workflows
      SET "customerId" = (
        SELECT id FROM customers
        WHERE LOWER(name) LIKE '%global%'
        OR LOWER(name) LIKE '%default%'
        OR LOWER(name) LIKE '%test%'
        ORDER BY
          CASE
            WHEN LOWER(name) LIKE '%global%' THEN 1
            WHEN LOWER(name) LIKE '%default%' THEN 2
            ELSE 3
          END,
          "createdAt" ASC
        LIMIT 1
      )
      WHERE "customerId" IS NULL;

      -- If no matching customer, use the first customer
      UPDATE workflows
      SET "customerId" = (SELECT id FROM customers ORDER BY "createdAt" ASC LIMIT 1)
      WHERE "customerId" IS NULL;

      GET DIAGNOSTICS updated_count = ROW_COUNT;
      IF updated_count > 0 THEN
        RAISE NOTICE 'Assigned % orphan workflows to a default customer', updated_count;
      END IF;
    END IF;
  END IF;

  -- Final check
  SELECT COUNT(*) INTO null_count
  FROM workflows
  WHERE "customerId" IS NULL;

  IF null_count = 0 THEN
    RAISE NOTICE 'All workflows now have a customerId. Adding NOT NULL constraint...';
    -- Step 3: Add NOT NULL constraint since all rows have values
    ALTER TABLE workflows ALTER COLUMN "customerId" SET NOT NULL;
  ELSE
    RAISE WARNING 'Cannot add NOT NULL constraint: % workflows still have NULL customerId', null_count;
    RAISE WARNING 'Please manually assign these workflows to customers before adding NOT NULL constraint';
  END IF;
END $$;

-- Step 4: Add foreign key constraint
ALTER TABLE workflows
ADD CONSTRAINT "workflows_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 5: Add index for performance
CREATE INDEX "workflows_customerId_idx" ON workflows("customerId");

-- Verification
DO $$
DECLARE
  total_workflows INTEGER;
  workflows_with_customer INTEGER;
  constraint_exists BOOLEAN;
  index_exists BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO total_workflows FROM workflows;
  SELECT COUNT(*) INTO workflows_with_customer FROM workflows WHERE "customerId" IS NOT NULL;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'workflows_customerId_fkey'
    AND table_name = 'workflows'
  ) INTO constraint_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'workflows_customerId_idx'
  ) INTO index_exists;

  RAISE NOTICE '=== Migration Summary ===';
  RAISE NOTICE 'Total workflows: %', total_workflows;
  RAISE NOTICE 'Workflows with customerId: %', workflows_with_customer;
  RAISE NOTICE 'Foreign key constraint added: %', constraint_exists;
  RAISE NOTICE 'Index added: %', index_exists;
  RAISE NOTICE '========================';
END $$;