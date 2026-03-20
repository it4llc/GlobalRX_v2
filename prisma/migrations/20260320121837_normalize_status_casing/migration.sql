-- Run this as a single transaction to fix all status casing issues
BEGIN;

-- Step 1: Save the desired final state into a temp table
-- For each (templateId, serviceCode, normalized_status) combo, keep one row
-- Prefer lowercase rows when duplicates exist
CREATE TEMP TABLE cta_clean AS
SELECT DISTINCT ON ("templateId", "serviceCode", normalized)
  id, "templateId", "serviceCode",
  CASE
    WHEN UPPER(status) = 'DRAFT' THEN 'draft'
    WHEN UPPER(status) = 'PENDING' THEN 'pending'
    WHEN UPPER(status) = 'SUBMITTED' THEN 'submitted'
    WHEN UPPER(status) = 'PROCESSING' THEN 'processing'
    WHEN UPPER(REPLACE(status, ' ', '_')) = 'MISSING_INFORMATION' OR status = 'Missing Information' THEN 'missing_info'
    WHEN UPPER(status) = 'COMPLETED' THEN 'completed'
    WHEN UPPER(status) = 'CANCELLED' THEN 'cancelled'
    WHEN UPPER(REPLACE(status, '-', '_')) = 'CANCELLED_DNB' OR status = 'Cancelled-DNB' THEN 'cancelled_dnb'
    ELSE LOWER(status)
  END as normalized,
  "createdAt"
FROM comment_template_availability
ORDER BY "templateId", "serviceCode", normalized,
  CASE WHEN status = LOWER(status) THEN 0 ELSE 1 END;

-- Step 2: Clear the real table
DELETE FROM comment_template_availability;

-- Step 3: Insert the clean data back
INSERT INTO comment_template_availability (id, "templateId", "serviceCode", status, "createdAt")
SELECT id, "templateId", "serviceCode", normalized, "createdAt"
FROM cta_clean;

-- Step 4: Clean up
DROP TABLE cta_clean;

-- Step 5: Normalize orders table statusCode column
UPDATE orders
SET "statusCode" = CASE
  WHEN UPPER("statusCode") = 'DRAFT' THEN 'draft'
  WHEN UPPER("statusCode") = 'PENDING' THEN 'pending'
  WHEN UPPER("statusCode") = 'SUBMITTED' THEN 'submitted'
  WHEN UPPER("statusCode") = 'PROCESSING' THEN 'processing'
  WHEN UPPER(REPLACE("statusCode", ' ', '_')) = 'MISSING_INFORMATION' OR "statusCode" = 'Missing Information' THEN 'missing_info'
  WHEN UPPER("statusCode") = 'COMPLETED' THEN 'completed'
  WHEN UPPER("statusCode") = 'CANCELLED' THEN 'cancelled'
  WHEN UPPER(REPLACE("statusCode", '-', '_')) = 'CANCELLED_DNB' OR "statusCode" = 'Cancelled-DNB' THEN 'cancelled_dnb'
  ELSE LOWER("statusCode")
END
WHERE "statusCode" != LOWER("statusCode")
   OR "statusCode" IN ('Missing Information', 'MISSING INFORMATION', 'Cancelled-DNB', 'CANCELLED-DNB');

-- Step 6: Normalize order_items table status column
UPDATE order_items
SET status = CASE
  WHEN UPPER(status) = 'DRAFT' THEN 'draft'
  WHEN UPPER(status) = 'PENDING' THEN 'pending'
  WHEN UPPER(status) = 'SUBMITTED' THEN 'submitted'
  WHEN UPPER(status) = 'PROCESSING' THEN 'processing'
  WHEN UPPER(REPLACE(status, ' ', '_')) = 'MISSING_INFORMATION' OR status = 'Missing Information' THEN 'missing_info'
  WHEN UPPER(status) = 'COMPLETED' THEN 'completed'
  WHEN UPPER(status) = 'CANCELLED' THEN 'cancelled'
  WHEN UPPER(REPLACE(status, '-', '_')) = 'CANCELLED_DNB' OR status = 'Cancelled-DNB' THEN 'cancelled_dnb'
  ELSE LOWER(status)
END
WHERE status != LOWER(status)
   OR status IN ('Missing Information', 'MISSING INFORMATION', 'Cancelled-DNB', 'CANCELLED-DNB');

COMMIT;