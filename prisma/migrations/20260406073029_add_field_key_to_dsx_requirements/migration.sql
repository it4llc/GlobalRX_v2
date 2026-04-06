-- Add fieldKey column as nullable first
ALTER TABLE "dsx_requirements" ADD COLUMN IF NOT EXISTS "fieldKey" TEXT;

-- Step 1: Map known field variations to stable keys (subject fields only)
UPDATE "dsx_requirements"
SET "fieldKey" = CASE
  WHEN "name" IN ('First Name', 'First Name or Given Name', 'First Name/Given Name', 'Given Name', 'First name') THEN 'firstName'
  WHEN "name" IN ('Last Name', 'Surname/Last Name', 'Surname', 'Last Name or Surname', 'Family Name', 'Last name') THEN 'lastName'
  WHEN "name" IN ('Middle Name', 'Middle Initial', 'Middle Name/Initial', 'Second Name', 'Middle name', 'Middle Name/Other Given Name') THEN 'middleName'
  WHEN "name" IN ('Date of Birth', 'DOB', 'Birth Date', 'Birthdate', 'D.O.B.', 'Date of birth') THEN 'dateOfBirth'
  WHEN "name" IN ('SSN', 'Social Security Number', 'Social Security', 'TIN', 'Tax ID', 'Social security number') THEN 'ssn'
  WHEN "name" IN ('Email', 'Email Address', 'E-mail', 'E-mail Address', 'Email address') THEN 'email'
  WHEN "name" IN ('Phone', 'Phone Number', 'Telephone', 'Contact Number', 'Mobile Number', 'Cell Phone', 'Phone number') THEN 'phone'
  WHEN "name" IN ('Gender', 'Sex', 'Biological Sex') THEN 'gender'
  WHEN "name" IN ('Age', 'Current Age') THEN 'age'
  WHEN "name" IN ('Address', 'Street Address', 'Address Line 1', 'Street 1', 'Current Address', 'Current address') THEN 'address'
  WHEN "name" IN ('City', 'Town', 'Municipality') THEN 'city'
  WHEN "name" IN ('State', 'Province', 'State/Province', 'Region') THEN 'state'
  WHEN "name" IN ('Postal Code', 'Zip Code', 'ZIP', 'Postcode', 'Post Code', 'Zip code') THEN 'postalCode'
  WHEN "name" IN ('Country', 'Nation') THEN 'country'
  WHEN "name" IN ('Mother''s Maiden Name', 'Mothers Maiden Name', 'Mother Maiden Name') THEN 'mothersMaidenName'
  WHEN "name" IN ('Residence Address') THEN 'residenceAddress'
  ELSE NULL
END
WHERE "type" = 'field' AND "fieldKey" IS NULL;

-- Step 2: For any remaining records still without a fieldKey (unmapped fields AND non-field types),
-- use a UUID-based fallback to guarantee uniqueness and satisfy NOT NULL
UPDATE "dsx_requirements"
SET "fieldKey" = SUBSTRING(REPLACE(id::text, '-', ''), 1, 16)
WHERE "fieldKey" IS NULL;

-- Step 3: Make fieldKey required and unique
ALTER TABLE "dsx_requirements" ALTER COLUMN "fieldKey" SET NOT NULL;
ALTER TABLE "dsx_requirements" ADD CONSTRAINT "dsx_requirements_fieldKey_key" UNIQUE ("fieldKey");