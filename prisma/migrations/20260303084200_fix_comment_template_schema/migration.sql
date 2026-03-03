-- Fix comment_templates table to match specification
-- Since no data needs to be preserved, we'll drop and recreate

-- Drop existing table and indexes
DROP TABLE IF EXISTS "comment_templates" CASCADE;

-- Create table with correct schema
CREATE TABLE "comment_templates" (
    "id" TEXT NOT NULL,
    "shortName" VARCHAR(50) NOT NULL,
    "longName" VARCHAR(100) NOT NULL,
    "templateText" VARCHAR(1000) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hasBeenUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "comment_templates_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "comment_templates_isActive_idx" ON "comment_templates"("isActive");
CREATE INDEX "comment_templates_hasBeenUsed_idx" ON "comment_templates"("hasBeenUsed");
CREATE UNIQUE INDEX "comment_templates_shortName_isActive_key" ON "comment_templates"("shortName", "isActive");

-- Create availability table
CREATE TABLE "comment_template_availability" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "serviceCode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_template_availability_pkey" PRIMARY KEY ("id")
);

-- Create indexes for availability table
CREATE INDEX "comment_template_availability_serviceCode_idx" ON "comment_template_availability"("serviceCode");
CREATE INDEX "comment_template_availability_status_idx" ON "comment_template_availability"("status");
CREATE INDEX "comment_template_availability_templateId_idx" ON "comment_template_availability"("templateId");
CREATE UNIQUE INDEX "comment_template_availability_templateId_serviceCode_status_key" ON "comment_template_availability"("templateId", "serviceCode", "status");

-- Add foreign key
ALTER TABLE "comment_template_availability" ADD CONSTRAINT "comment_template_availability_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "comment_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;