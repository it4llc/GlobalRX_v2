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