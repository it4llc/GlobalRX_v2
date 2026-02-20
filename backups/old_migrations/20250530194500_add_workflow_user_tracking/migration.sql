-- AlterTable: Add createdById and updatedById fields to workflows table
ALTER TABLE "workflows" ADD COLUMN "createdById" TEXT;
ALTER TABLE "workflows" ADD COLUMN "updatedById" TEXT;

-- CreateIndex: Add indexes for the new columns
CREATE INDEX "workflows_createdById_idx" ON "workflows"("createdById");
CREATE INDEX "workflows_updatedById_idx" ON "workflows"("updatedById");

-- AddForeignKey: Add foreign key constraints
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "workflows" ADD CONSTRAINT "workflows_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;