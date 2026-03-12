-- Add userId field to users table if it doesn't exist
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "userId" SERIAL UNIQUE;

-- Add results fields to services_fulfillment table
ALTER TABLE "services_fulfillment"
  ADD COLUMN IF NOT EXISTS "results" TEXT,
  ADD COLUMN IF NOT EXISTS "resultsAddedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "resultsAddedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resultsLastModifiedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "resultsLastModifiedAt" TIMESTAMP(3);

-- Create service_attachments table
CREATE TABLE IF NOT EXISTS "service_attachments" (
  "id" SERIAL PRIMARY KEY,
  "serviceFulfillmentId" TEXT NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "filePath" VARCHAR(500) NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "uploadedBy" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_attachments_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "service_attachments_serviceFulfillmentId_fkey" FOREIGN KEY ("serviceFulfillmentId") REFERENCES "services_fulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Add indexes for service_attachments
CREATE INDEX IF NOT EXISTS "service_attachments_serviceFulfillmentId_idx" ON "service_attachments"("serviceFulfillmentId");
CREATE INDEX IF NOT EXISTS "service_attachments_uploadedAt_idx" ON "service_attachments"("uploadedAt");

-- Add foreign key constraints for results fields
ALTER TABLE "services_fulfillment"
  ADD CONSTRAINT "services_fulfillment_resultsAddedBy_fkey" FOREIGN KEY ("resultsAddedBy") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "services_fulfillment_resultsLastModifiedBy_fkey" FOREIGN KEY ("resultsLastModifiedBy") REFERENCES "users"("userId") ON DELETE SET NULL ON UPDATE CASCADE;