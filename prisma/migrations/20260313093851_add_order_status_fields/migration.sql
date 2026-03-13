-- Add notes and isAutomatic fields to order_status_history table
ALTER TABLE "order_status_history"
ADD COLUMN "notes" TEXT,
ADD COLUMN "isAutomatic" BOOLEAN NOT NULL DEFAULT false;