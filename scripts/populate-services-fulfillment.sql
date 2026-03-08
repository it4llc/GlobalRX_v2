-- Script to populate services_fulfillment table from order_items
-- This creates fulfillment records for existing order items

-- First check what we'll be creating
SELECT
    COUNT(*) as items_to_migrate,
    COUNT(DISTINCT oi."orderId") as unique_orders
FROM order_items oi
LEFT JOIN services_fulfillment sf ON sf."orderItemId" = oi.id
WHERE sf.id IS NULL;

-- Insert services_fulfillment records for all order_items that don't have them
INSERT INTO services_fulfillment (
    id,
    "orderId",
    "orderItemId",
    "serviceId",
    "locationId",
    status,
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid(),
    oi."orderId",
    oi.id,
    oi."serviceId",
    oi."locationId",
    oi.status,
    oi."createdAt",
    CURRENT_TIMESTAMP
FROM order_items oi
LEFT JOIN services_fulfillment sf ON sf."orderItemId" = oi.id
WHERE sf.id IS NULL;

-- Verify the migration
SELECT
    COUNT(*) as total_order_items,
    (SELECT COUNT(*) FROM services_fulfillment) as total_fulfillment_records,
    COUNT(DISTINCT oi.status) as unique_statuses
FROM order_items oi;

-- Show status distribution
SELECT
    sf.status,
    COUNT(*) as count
FROM services_fulfillment sf
GROUP BY sf.status
ORDER BY sf.status;