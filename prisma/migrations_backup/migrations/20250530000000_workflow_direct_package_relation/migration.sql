-- This migration updates the workflow-package relationship
-- First, check if packageId already exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'workflows' AND column_name = 'packageId') THEN
        -- Add the packageId column to workflows
        ALTER TABLE "workflows" ADD COLUMN "packageId" TEXT;
        
        -- Set a default package ID (first package found) if needed
        UPDATE "workflows" w
        SET "packageId" = (SELECT "id" FROM "packages" LIMIT 1);
        
        -- Make packageId non-nullable
        ALTER TABLE "workflows" ALTER COLUMN "packageId" SET NOT NULL;
        
        -- Add foreign key constraint
        ALTER TABLE "workflows"
        ADD CONSTRAINT "workflows_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        
        -- Create index on packageId
        CREATE INDEX "workflows_packageId_idx" ON "workflows"("packageId");
    END IF;
END $$;