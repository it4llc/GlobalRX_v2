// /GlobalRX_v2/src/types/candidate-portal.ts

/**
 * Types for the candidate portal feature
 */

export interface CandidateInvitationInfo {
  firstName: string;
  lastName: string;
  status: string;
  expiresAt: Date;
  companyName: string;
}

export interface CandidatePortalSection {
  id: string;
  title: string;
  type: 'workflow_section' | 'service_section' | 'personal_info';
  placement: 'before_services' | 'services' | 'after_services';
  status: 'not_started' | 'in_progress' | 'complete';
  order: number;
  functionalityType: string | null;
  serviceIds?: string[]; // For service sections, the IDs of services in this section
}

export interface CandidatePortalStructureResponse {
  invitation: CandidateInvitationInfo;
  sections: CandidatePortalSection[];
}

// Types for field metadata stored in DSXRequirement.fieldData JSON column
export interface FieldMetadata {
  dataType?: string;
  validationRules?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    [key: string]: unknown;
  };
  displayOptions?: {
    placeholder?: string;
    helpText?: string;
    options?: Array<{ label: string; value: string }>;
    [key: string]: unknown;
  };
  collectionTab?: string;
  isLocked?: boolean;
  preFilledValue?: unknown;
  [key: string]: unknown;
}

// Types for individual saved fields
export interface SavedFieldData {
  requirementId: string;
  value: unknown;
  savedAt: string;
}

// Types for form data stored in CandidateInvitation.formData JSON column
export interface FormSectionData {
  type?: string;
  fields?: SavedFieldData[];
  entries?: Array<{
    entryId: string;
    countryId: string | null;
    entryOrder: number;
    fields: SavedFieldData[];
  }>;
  [key: string]: unknown;
}

export interface CandidateFormData {
  sections?: Record<string, FormSectionData>;
  [key: string]: unknown;
}

// Type for document-related metadata stored in DSXRequirement.documentData
export interface DocumentMetadata {
  documentType?: string;
  acceptedFormats?: string[];
  maxSizeInMB?: number;
  isRequired?: boolean;
  instructions?: string;
  [key: string]: unknown;
}

// Type for field values in forms
export type FieldValue = string | number | boolean | Date | string[] | null;