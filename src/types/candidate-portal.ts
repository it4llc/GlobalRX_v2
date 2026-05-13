// /GlobalRX_v2/src/types/candidate-portal.ts

/**
 * Types for the candidate portal feature
 */

import type { WorkflowSectionPayload } from './candidate-stage4';

export interface CandidateInvitationInfo {
  firstName: string;
  lastName: string;
  // Task 8.1 (template variable system) — the structure endpoint now
  // surfaces email + phone so the candidate shell can build the values
  // object passed into replaceTemplateVariables. `email` is always present
  // (non-nullable column on candidate_invitations); `phone` is the joined
  // phoneCountryCode + phoneNumber display string, nullable when the
  // invite did not collect phone.
  email: string;
  phone: string | null;
  status: string;
  expiresAt: Date;
  companyName: string;
}

// Phase 7 Stage 1: scope info attached to scoped sections (Address History,
// Education, Employment) so the frontend can show the scope description
// without a second fetch. Exposes translation keys (not English) so the new
// in-section banners can localize cleanly. The legacy /scope endpoint still
// returns English strings for backward compatibility — see plan §11.8.
export interface CandidatePortalSectionScope {
  scopeType:
    | 'count_exact'
    | 'count_specific'
    | 'time_based'
    | 'highest_degree'
    | 'highest_degree_inc_hs'
    | 'all_degrees'
    | 'all';
  scopeValue: number | null;
  scopeDescriptionKey: string;
  scopeDescriptionPlaceholders?: Record<string, string | number>;
}

export interface CandidatePortalSection {
  id: string;
  title: string;
  // Phase 7 Stage 1 added 'review_submit' for the synthetic Review & Submit
  // entry the structure endpoint appends after all after_services workflow
  // sections.
  type:
    | 'workflow_section'
    | 'service_section'
    | 'personal_info'
    | 'address_history'
    | 'review_submit';
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
  // Phase 7 Stage 1: present on Address History, Education, and Employment
  // sections. The structure endpoint resolves the most demanding scope from
  // the package's services per Rule 19.
  scope?: CandidatePortalSectionScope;
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

// Personal Info field definition. Lifted out of PersonalInfoSection.tsx in the
// TD-059 fix so portal-layout.tsx (the shell) can hold the same shape in
// state and feed it to computePersonalInfoStatus when the cross-section
// registry changes — even when the section isn't mounted.
export interface PersonalInfoField {
  requirementId: string;
  name: string;
  fieldKey: string;
  dataType: string;
  isRequired: boolean;
  instructions?: string | null;
  fieldData?: FieldMetadata | null;
  displayOrder: number;
  locked: boolean;
  prefilledValue?: string | null;
}