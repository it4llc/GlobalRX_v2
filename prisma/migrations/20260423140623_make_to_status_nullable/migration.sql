-- Make toStatus nullable in order_status_history table
-- This allows non-status-change events (like invitation events) to have NULL toStatus

ALTER TABLE order_status_history ALTER COLUMN "toStatus" DROP NOT NULL;