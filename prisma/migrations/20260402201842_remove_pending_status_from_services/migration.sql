-- Remove 'pending' status from services - migrate to 'submitted'
-- This migration updates all service-related tables that have a 'pending' status
-- to use 'submitted' instead, matching the order status system

-- Update order_items table (service status)
UPDATE order_items
SET status = 'submitted',
    "updatedAt" = CURRENT_TIMESTAMP
WHERE status = 'pending';

-- Handle comment_template_availability table
-- First delete pending entries where submitted already exists (to avoid unique constraint violations)
DELETE FROM comment_template_availability
WHERE status = 'pending'
  AND EXISTS (
    SELECT 1
    FROM comment_template_availability cta2
    WHERE cta2."templateId" = comment_template_availability."templateId"
      AND cta2."serviceCode" = comment_template_availability."serviceCode"
      AND cta2.status = 'submitted'
  );

-- Then update remaining pending entries to submitted
UPDATE comment_template_availability
SET status = 'submitted'
WHERE status = 'pending';

-- Note: services_fulfillment table doesn't have a status column - status is tracked in order_items
-- Note: order table uses statusCode field with different values, not affected by this change