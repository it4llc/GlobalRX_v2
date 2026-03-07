-- Script to sync services_fulfillment statuses with their parent Order statuses
-- This updates all services to match their order's current status

-- First, let's see what we're going to update (preview)
SELECT
    sf.id,
    sf.status AS current_service_status,
    o."statusCode" AS order_status,
    o."orderNumber"
FROM services_fulfillment sf
INNER JOIN orders o ON sf."orderId" = o.id
WHERE sf.status != o."statusCode"
LIMIT 20;

-- Update services_fulfillment statuses to match their parent Order status
UPDATE services_fulfillment sf
SET
    status = o."statusCode",
    "updatedAt" = CURRENT_TIMESTAMP
FROM orders o
WHERE sf."orderId" = o.id
AND sf.status != o."statusCode";

-- Create audit log entries for the status changes
-- Note: This uses a system user ID - you may need to adjust this
INSERT INTO service_audit_log (
    id,
    "serviceFulfillmentId",
    "orderId",
    "userId",
    "changeType",
    "fieldName",
    "oldValue",
    "newValue",
    notes,
    "createdAt"
)
SELECT
    gen_random_uuid(),
    sf.id,
    sf."orderId",
    '00000000-0000-0000-0000-000000000000', -- System user ID (adjust as needed)
    'status_change',
    'status',
    sf.status,
    o."statusCode",
    'Bulk update: Synced service status with parent order status',
    CURRENT_TIMESTAMP
FROM services_fulfillment sf
INNER JOIN orders o ON sf."orderId" = o.id
WHERE sf.status != o."statusCode";

-- Show the results
SELECT
    COUNT(*) AS services_updated
FROM services_fulfillment sf
INNER JOIN orders o ON sf."orderId" = o.id
WHERE sf.status = o."statusCode";