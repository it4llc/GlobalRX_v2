// /GlobalRX_v2/src/types/invitation-management.ts

export interface InvitationStatusDisplay {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneCountryCode?: string | null;
  phoneNumber?: string | null;
  status: 'sent' | 'opened' | 'in_progress' | 'completed' | 'expired';
  expiresAt: Date | string;
  lastAccessedAt?: Date | string | null;
  createdAt: Date | string;
}

export enum InvitationAction {
  EXTEND = 'extend',
  RESEND = 'resend'
}

export interface InvitationStatusSectionProps {
  invitation: InvitationStatusDisplay;
  canManageInvitations: boolean;
  onActionSuccess?: () => void;
}

export interface InvitationActionButtonProps {
  action: InvitationAction;
  invitationId: string;
  disabled?: boolean;
  onSuccess?: () => void;
}

export interface OrderEventDisplay {
  id: string;
  eventType?: string;
  message?: string;
  fromStatus?: string;
  toStatus?: string;
  createdAt: Date | string;
  user?: {
    firstName?: string;
    lastName?: string;
    email: string;
  };
  notes?: string | null;
}