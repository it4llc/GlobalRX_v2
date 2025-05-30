-- This migration updates the workflow-package relationship from many-to-many to many-to-one
-- First, add the packageId column to workflows (nullable initially)
ALTER TABLE "workflows" ADD COLUMN "packageId" TEXT;

-- Copy data from the join table to the direct relationship
UPDATE "workflows"
SET "packageId" = wp."packageId"
FROM "workflow_packages" wp
WHERE "workflows"."id" = wp."workflowId";

-- Make packageId non-nullable after data migration
ALTER TABLE "workflows" ALTER COLUMN "packageId" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "workflows"
ADD CONSTRAINT "workflows_packageId_fkey"
FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Create index on packageId
CREATE INDEX "workflows_packageId_idx" ON "workflows"("packageId");

-- Drop the workflow_packages table
DROP TABLE "workflow_packages";