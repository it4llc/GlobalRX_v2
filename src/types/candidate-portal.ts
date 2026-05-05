// /GlobalRX_v2/src/types/candidate-portal.ts

/**
 * Types for the candidate portal feature
 */

import type { WorkflowSectionPayload } from './candidate-stage4';

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
  type: 'workflow_section' | 'service_section' | 'personal_info' | 'address_history';
  placement: 'before_services' | 'services' | 'after_services';
  // Status union narrowed in Phase 6 Stage 4 (BR 22) — `in_progress` was
  // replaced by `incomplete` so the value space matches the project-wide
  // lowercase status casing rule and the Stage 4 SectionStatus type.
  status: 'not_started' | 'incomplete' | 'complete';
  order: number;
  functionalityType: string | null;
  serviceIds?: string[]; // For service sections, the IDs of services in this section
  // Populated by the structure endpoint when `type === 'workflow_section'`.
  // Carries the full workflow section payload (content, fileUrl, etc.) so the
  // shell can render WorkflowSectionRenderer without a second fetch.
  workflowSection?: WorkflowSectionPayload;
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

// Type for field values in forms.
// The object case was added in Phase 6 Stage 3 to support address_block fields,
// whose value is a JSON object (street/city/state/postalCode plus optional
// dates) rather than a primitive. The object's values are restricted to JSON
// primitives — one level deep, matching the widened RepeatableFieldValue and
// the Zod schemas in /save/route.ts.
export type FieldValue =
  | string
  | number
  | boolean
  | Date
  | string[]
  | null
  | { [k: string]: string | number | boolean | null | undefined };