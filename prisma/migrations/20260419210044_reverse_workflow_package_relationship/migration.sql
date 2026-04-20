-- /GlobalRX_v2/prisma/migrations/20260419210044_reverse_workflow_package_relationship/migration.sql
--
-- Business requirement: Phase 1 of Candidate Invite - restructure package/workflow relationship
-- Changes the relationship from workflow->package (one-to-one) to package->workflow (many-to-one)
-- This allows multiple packages to share the same workflow
-- Safe to run multiple times (idempotent)

-- Start logging
DO $$
BEGIN
  RAISE NOTICE 'Starting reverse_workflow_package_relationship migration...';
END $$;

-- Step 1: Add workflowId column to packages table if it doesn't exist
ALTER TABLE packages
ADD COLUMN IF NOT EXISTS "workflowId" TEXT;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'packages_workflowId_fkey'
  ) THEN
    ALTER TABLE packages
    ADD CONSTRAINT packages_workflowId_fkey
    FOREIGN KEY ("workflowId")
    REFERENCES workflows(id)
    ON DELETE RESTRICT;
  END IF;
END $$;

-- Step 2: Migrate existing relationships from workflows.packageId to packages.workflowId
-- If multiple workflows point to the same package (shouldn't happen but handle it),
-- use the most recently updated workflow
UPDATE packages p
SET "workflowId" = (
  SELECT w.id
  FROM workflows w
  WHERE w."packageId" = p.id
  ORDER BY w."updatedAt" DESC NULLS LAST, w."createdAt" DESC
  LIMIT 1
)
WHERE p."workflowId" IS NULL
  AND EXISTS (
    SELECT 1 FROM workflows w2 WHERE w2."packageId" = p.id
  );

-- Log migration progress
DO $$
DECLARE
  migrated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM packages WHERE "workflowId" IS NOT NULL;
  RAISE NOTICE 'Migrated % package-workflow relationships', migrated_count;
END $$;

-- Step 3: Verify migration completeness
DO $$
DECLARE
  old_relationships INTEGER;
  new_relationships INTEGER;
  orphaned_count INTEGER;
BEGIN
  -- Count old relationships
  SELECT COUNT(*) INTO old_relationships
  FROM workflows WHERE "packageId" IS NOT NULL;

  -- Count new relationships
  SELECT COUNT(*) INTO new_relationships
  FROM packages WHERE "workflowId" IS NOT NULL;

  -- Check for orphaned workflow references (workflow points to non-existent package)
  SELECT COUNT(*) INTO orphaned_count
  FROM workflows w
  LEFT JOIN packages p ON w."packageId" = p.id
  WHERE w."packageId" IS NOT NULL AND p.id IS NULL;

  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % orphaned workflow->package references (package no longer exists)', orphaned_count;
  END IF;

  RAISE NOTICE 'Verification: % old relationships, % new relationships migrated', old_relationships, new_relationships;
END $$;

-- Step 4: Drop the old packageId column from workflows table
ALTER TABLE workflows
DROP COLUMN IF EXISTS "packageId";

-- Step 5: Add index on packages.workflowId for query performance
CREATE INDEX IF NOT EXISTS idx_packages_workflowId ON packages("workflowId");

-- Final summary
DO $$
BEGIN
  RAISE NOTICE 'reverse_workflow_package_relationship migration completed successfully';
END $$;