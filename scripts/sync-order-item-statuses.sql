-- Script to sync order_items statuses with their parent Order statuses
-- This updates all order items (services) to match their order's current status

-- First, let's see what we're going to update (preview)
SELECT
    oi.id,
    oi.status AS current_item_status,
    o."statusCode" AS order_status,
    o."orderNumber",
    s.name AS service_name
FROM order_items oi
INNER JOIN orders o ON oi."orderId" = o.id
INNER JOIN services s ON oi."serviceId" = s.id
WHERE oi.status != o."statusCode"
LIMIT 20;

-- Count how many items need updating
SELECT
    o."statusCode" AS order_status,
    COUNT(*) AS items_to_update
FROM order_items oi
INNER JOIN orders o ON oi."orderId" = o.id
WHERE oi.status != o."statusCode"
GROUP BY o."statusCode";

-- Update order_items statuses to match their parent Order status
UPDATE order_items oi
SET
    status = o."statusCode"
FROM orders o
WHERE oi."orderId" = o.id
AND oi.status != o."statusCode";

-- Verify the update
SELECT
    DISTINCT oi.status AS item_status,
    COUNT(*)
FROM order_items oi
GROUP BY oi.status
ORDER BY oi.status;