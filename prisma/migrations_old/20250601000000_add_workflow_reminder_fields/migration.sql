-- AlterTable: Add reminder fields to workflows table
ALTER TABLE "workflows" 
ADD COLUMN IF NOT EXISTS "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "reminderFrequency" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN IF NOT EXISTS "maxReminders" INTEGER NOT NULL DEFAULT 3;

-- Update default expiration days
ALTER TABLE "workflows" 
ALTER COLUMN "expirationDays" SET DEFAULT 15;