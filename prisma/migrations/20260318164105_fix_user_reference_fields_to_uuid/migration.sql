-- Fix user reference fields to use UUID instead of integer userId
-- This migration changes three fields that incorrectly referenced User.userId (integer)
-- to properly reference User.id (UUID string)

-- Step 1: Drop the existing foreign key constraints
ALTER TABLE "services_fulfillment" DROP CONSTRAINT IF EXISTS "services_fulfillment_resultsAddedBy_fkey";
ALTER TABLE "services_fulfillment" DROP CONSTRAINT IF EXISTS "services_fulfillment_resultsLastModifiedBy_fkey";
ALTER TABLE "service_attachments" DROP CONSTRAINT IF EXISTS "service_attachments_uploadedBy_fkey";

-- Step 2: Change column types from Int to String (VARCHAR)
-- For ServicesFulfillment.resultsAddedBy
ALTER TABLE "services_fulfillment"
  ALTER COLUMN "resultsAddedBy" TYPE VARCHAR(255) USING "resultsAddedBy"::VARCHAR(255);

-- For ServicesFulfillment.resultsLastModifiedBy
ALTER TABLE "services_fulfillment"
  ALTER COLUMN "resultsLastModifiedBy" TYPE VARCHAR(255) USING "resultsLastModifiedBy"::VARCHAR(255);

-- For ServiceAttachment.uploadedBy
ALTER TABLE "service_attachments"
  ALTER COLUMN "uploadedBy" TYPE VARCHAR(255) USING "uploadedBy"::VARCHAR(255);

-- Step 3: Migrate existing data from integer userId to UUID id
-- Update resultsAddedBy to use User.id instead of User.userId
UPDATE "services_fulfillment" sf
SET "resultsAddedBy" = u.id
FROM users u
WHERE sf."resultsAddedBy" IS NOT NULL
  AND u."userId" = sf."resultsAddedBy"::INTEGER;

-- Update resultsLastModifiedBy to use User.id instead of User.userId
UPDATE "services_fulfillment" sf
SET "resultsLastModifiedBy" = u.id
FROM users u
WHERE sf."resultsLastModifiedBy" IS NOT NULL
  AND u."userId" = sf."resultsLastModifiedBy"::INTEGER;

-- Update uploadedBy to use User.id instead of User.userId
UPDATE "service_attachments" sa
SET "uploadedBy" = u.id
FROM users u
WHERE sa."uploadedBy" IS NOT NULL
  AND u."userId" = sa."uploadedBy"::INTEGER;

-- Step 4: Add new foreign key constraints referencing User.id
ALTER TABLE "services_fulfillment"
  ADD CONSTRAINT "services_fulfillment_resultsAddedBy_fkey"
  FOREIGN KEY ("resultsAddedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "services_fulfillment"
  ADD CONSTRAINT "services_fulfillment_resultsLastModifiedBy_fkey"
  FOREIGN KEY ("resultsLastModifiedBy") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_attachments"
  ADD CONSTRAINT "service_attachments_uploadedBy_fkey"
  FOREIGN KEY ("uploadedBy") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;