-- Add translations for workflow section types and configuration options
-- Default language: English (en-US)

-- Section Type labels
INSERT INTO translations (id, "labelKey", language, value)
VALUES 
  (gen_random_uuid(), 'module.candidateWorkflow.sectionType', 'en-US', 'Section Type'),
  (gen_random_uuid(), 'module.candidateWorkflow.selectSectionType', 'en-US', 'Select a section type'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypeDescription', 'en-US', 'The type of content and functionality this section will provide');

-- Section Types
INSERT INTO translations (id, "labelKey", language, value)
VALUES 
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.form', 'en-US', 'Form/Notice'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.idInfo', 'en-US', 'ID Information'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.personalInfo', 'en-US', 'Personal Information'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.employment', 'en-US', 'Employment'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.education', 'en-US', 'Education'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.other', 'en-US', 'Other'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.documents', 'en-US', 'Document Collection'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.summary', 'en-US', 'Summary of Information'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionTypes.consent', 'en-US', 'Review/Consent');

-- Form Configuration Options
INSERT INTO translations (id, "labelKey", language, value)
VALUES 
  (gen_random_uuid(), 'module.candidateWorkflow.textContent', 'en-US', 'Form Content'),
  (gen_random_uuid(), 'module.candidateWorkflow.textContentPlaceholder', 'en-US', 'Enter the text content for this form or notice'),
  (gen_random_uuid(), 'module.candidateWorkflow.textContentDescription', 'en-US', 'The text content to display in this form or notice section'),
  (gen_random_uuid(), 'module.candidateWorkflow.requireSignature', 'en-US', 'Require Signature'),
  (gen_random_uuid(), 'module.candidateWorkflow.requireSignatureDescription', 'en-US', 'If enabled, the user must provide a signature'),
  (gen_random_uuid(), 'module.candidateWorkflow.requireCheckbox', 'en-US', 'Require Checkbox'),
  (gen_random_uuid(), 'module.candidateWorkflow.requireCheckboxDescription', 'en-US', 'If enabled, the user must check a box to acknowledge'),
  (gen_random_uuid(), 'module.candidateWorkflow.showIpAddress', 'en-US', 'Show IP Address'),
  (gen_random_uuid(), 'module.candidateWorkflow.showIpAddressDescription', 'en-US', 'If enabled, display and capture the user''s IP address');

-- Error and validation messages
INSERT INTO translations (id, "labelKey", language, value)
VALUES 
  (gen_random_uuid(), 'module.candidateWorkflow.errors.sectionTypeRequired', 'en-US', 'Section type is required'),
  (gen_random_uuid(), 'module.candidateWorkflow.errors.invalidSectionType', 'en-US', 'Invalid section type selected'),
  (gen_random_uuid(), 'module.candidateWorkflow.errors.orderingRule', 'en-US', 'This section type cannot be placed here due to ordering rules');

-- On successful record
INSERT INTO translations (id, "labelKey", language, value)
VALUES 
  (gen_random_uuid(), 'module.candidateWorkflow.sectionCreated', 'en-US', 'Section created successfully'),
  (gen_random_uuid(), 'module.candidateWorkflow.sectionUpdated', 'en-US', 'Section updated successfully');