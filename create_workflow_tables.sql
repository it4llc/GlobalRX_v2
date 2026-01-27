-- Create workflows table if it doesn't exist
CREATE TABLE IF NOT EXISTS "workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'en-US',
    "expirationDays" INTEGER NOT NULL DEFAULT 15,
    "autoCloseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "extensionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "extensionDays" INTEGER,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packageId" TEXT,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- Create workflow_sections table if it doesn't exist
CREATE TABLE IF NOT EXISTS "workflow_sections" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "dependsOnSection" TEXT,
    "dependencyLogic" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_sections_pkey" PRIMARY KEY ("id")
);

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS "workflows_createdById_idx" ON "workflows"("createdById");
CREATE INDEX IF NOT EXISTS "workflows_updatedById_idx" ON "workflows"("updatedById");
CREATE INDEX IF NOT EXISTS "workflows_packageId_idx" ON "workflows"("packageId");
CREATE INDEX IF NOT EXISTS "workflow_sections_workflowId_idx" ON "workflow_sections"("workflowId");

-- Add foreign key constraints if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'workflows_createdById_fkey') THEN
        ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdById_fkey"
        FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'workflows_updatedById_fkey') THEN
        ALTER TABLE "workflows" ADD CONSTRAINT "workflows_updatedById_fkey"
        FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'workflows_packageId_fkey') THEN
        ALTER TABLE "workflows" ADD CONSTRAINT "workflows_packageId_fkey"
        FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'workflow_sections_workflowId_fkey') THEN
        ALTER TABLE "workflow_sections" ADD CONSTRAINT "workflow_sections_workflowId_fkey"
        FOREIGN KEY ("workflowId") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;