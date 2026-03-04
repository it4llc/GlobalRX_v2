-- Populate service codes with generated values based on service names
-- This ensures all services have a non-null code value

-- First, update any existing services with null codes
UPDATE "services"
SET "code" = CASE
    -- Common service mappings
    WHEN "name" LIKE '%Motor Vehicle Record%' THEN 'MVR'
    WHEN "name" LIKE '%Criminal Background%' THEN 'CRIMINAL'
    WHEN "name" LIKE '%Drug Testing%' THEN 'DRUG'
    WHEN "name" LIKE '%Drug Screening%' THEN 'DRUG'
    WHEN "name" LIKE '%Employment Verification%' THEN 'EMPLOYMENT'
    WHEN "name" LIKE '%Education Verification%' THEN 'EDUCATION'
    WHEN "name" LIKE '%Reference Check%' THEN 'REFERENCE'
    WHEN "name" LIKE '%Credit Check%' THEN 'CREDIT'
    WHEN "name" LIKE '%Social Security Trace%' THEN 'SSN'
    WHEN "name" LIKE '%Identity Verification%' THEN 'IDENTITY'
    -- Default: Generate code from name (uppercase, remove non-alphanumeric, take first 10 chars)
    ELSE UPPER(LEFT(REGEXP_REPLACE("name", '[^A-Za-z0-9]', '', 'g'), 10))
END
WHERE "code" IS NULL;

-- For any services that still have null codes (e.g., if name is null), use a sequential code
UPDATE "services"
SET "code" = 'SERVICE' || "id"
WHERE "code" IS NULL;

-- Now make the code column required
ALTER TABLE "services" ALTER COLUMN "code" SET NOT NULL;