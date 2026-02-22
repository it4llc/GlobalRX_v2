-- Add displayOrder to service_requirements table
ALTER TABLE "service_requirements" ADD COLUMN "displayOrder" INTEGER DEFAULT 999 NOT NULL;

-- Drop displayOrder from dsx_mappings table (it was just added, no data to preserve)
ALTER TABLE "dsx_mappings" DROP COLUMN "displayOrder";