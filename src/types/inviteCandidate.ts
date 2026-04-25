// /GlobalRX_v2/src/types/inviteCandidate.ts

import { z } from 'zod';
import { createInvitationSchema } from '@/lib/validations/candidateInvitation';

// Form data type derived from the existing validation schema
export type InviteFormData = z.infer<typeof createInvitationSchema>;

// Enum for dialog steps
export enum DialogStep {
  PackageSelection = 'package-selection',
  CandidateInfo = 'candidate-info',
  Success = 'success'
}

// Workflow details for a package
export interface WorkflowDetails {
  name: string;
  description: string | null;
  expirationDays: number;
  reminderEnabled: boolean;
}

// Package option type for dropdown
export interface PackageOption {
  id: string;
  name: string;
  description: string | null;
  hasWorkflow: boolean;
  workflow: WorkflowDetails | null;
}

// API response type for successful invitation creation
export interface InvitationResponse {
  id: string;
  token: string;
  firstName: string;
  lastName: string;
  email: string;
  expiresAt: string;
  orderId: string;
}

// Dialog state management interface
export interface DialogState {
  currentStep: DialogStep;
  isLoading: boolean;
  error: string | null;
  formData: Partial<InviteFormData>;
  packages: PackageOption[];
  invitationResult: InvitationResponse | null;
}