-- Add section_type field to workflow_sections table
ALTER TABLE "workflow_sections" ADD COLUMN "section_type" TEXT NOT NULL DEFAULT 'form';

-- Add configuration field (JSON) to workflow_sections table
ALTER TABLE "workflow_sections" ADD COLUMN "configuration" JSONB;

-- Add comment explaining section types
COMMENT ON COLUMN "workflow_sections"."section_type" IS 'Type of section: form, idInfo, personalInfo, employment, education, other, documents, summary, consent';

-- Create index on section_type for faster queries
CREATE INDEX "workflow_sections_section_type_idx" ON "workflow_sections"("section_type");