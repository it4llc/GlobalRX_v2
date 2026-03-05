-- Seed data for services table
-- This safely adds services without affecting Prisma migrations
-- Uses INSERT ... ON CONFLICT to avoid duplicates

-- Insert services using ON CONFLICT DO NOTHING to safely handle existing records
INSERT INTO public.services (id, name, category, description, disabled, "createdAt", "updatedAt", "createdById", "updatedById", "functionalityType") VALUES
('383f3f2f-3194-4396-9a63-297f80e151f9', 'County Criminal', 'US Criminal', NULL, false, NOW(), NOW(), '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'record'),
('8388bb60-48e4-4781-a867-7c86b51be776', 'ID Verification', 'IDV', 'Review of ID doc', false, NOW(), NOW(), '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'other'),
('935f2544-5727-47a9-a758-bd24afea5994', 'Education Verification', 'Verifications', NULL, false, NOW(), NOW(), '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'verification-edu'),
('4b9d6a10-6861-426a-ad7f-60eb94312d0d', 'Employment Verification', 'Verifications', NULL, false, NOW(), NOW(), '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'verification-emp'),
('be37003d-1016-463a-b536-c00cf9f3234b', 'Global Criminal', 'Records', 'Standard global criminal offering', false, NOW(), NOW(), '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'record'),
('a49223f8-3cdd-4415-9038-4454680b6c75', 'Bankruptcy Check', 'Records', NULL, false, NOW(), NOW(), '0c81952d-f51e-469f-a9ad-074be12b18e4', '0c81952d-f51e-469f-a9ad-074be12b18e4', 'record')
ON CONFLICT (id) DO NOTHING;

-- Verify the insert
SELECT COUNT(*) as service_count FROM services;