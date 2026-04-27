'use client';

import React from 'react';
import {
  InvitationStatusSectionProps,
  InvitationAction
} from '@/types/invitation-management';
import { InvitationActionButton } from './InvitationActionButton';
import { InvitationConfirmDialog } from './InvitationConfirmDialog';
import { useTranslation } from '@/contexts/TranslationContext';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/useToast';

export function InvitationStatusSection({
  invitation,
  canManageInvitations,
  onActionSuccess
}: InvitationStatusSectionProps) {
  const { t } = useTranslation();
  const { toastSuccess, toastError } = useToast();
  const [confirmAction, setConfirmAction] = React.useState<InvitationAction | null>(null);
  const [isActionLoading, setIsActionLoading] = React.useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-yellow-100 text-yellow-800';
      case 'opened':
        return 'bg-orange-100 text-orange-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const canExtend = ['sent', 'opened', 'in_progress', 'expired'].includes(invitation.status);
  const canResend = ['sent', 'opened'].includes(invitation.status);

  const handleAction = async (action: InvitationAction) => {
    setIsActionLoading(true);
    try {
      const response = await fetch(`/api/candidate/invitations/${invitation.id}/${action}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} invitation`);
      }

      toastSuccess(
        action === InvitationAction.EXTEND
          ? t('invitation.action.extendSuccess')
          : t('invitation.action.resendSuccess')
      );

      onActionSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      toastError(
        action === InvitationAction.EXTEND
          ? t('invitation.action.extendError')
          : t('invitation.action.resendError')
      );
    } finally {
      setIsActionLoading(false);
      setConfirmAction(null); // Close dialog regardless of success or failure
    }
  };

  const formatPhone = () => {
    if (!invitation.phoneCountryCode || !invitation.phoneNumber) return null;
    return `+${invitation.phoneCountryCode} ${invitation.phoneNumber}`;
  };

  const formatDate = (date: Date | string) => {
    return format(new Date(date), 'MMM dd, yyyy h:mm a');
  };

  const isExpired = invitation.status === 'expired';
  const expiresAt = new Date(invitation.expiresAt);

  return (
    <>
      <div className="border-b border-gray-200 pb-4" data-testid="invitation-status-section">
        <h3 className="font-semibold text-gray-900 mb-3">
          {t('invitation.status.title')}
        </h3>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">{t('invitation.status.candidateName')}:</span>
            <span className="text-gray-900">{invitation.firstName} {invitation.lastName}</span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">{t('invitation.status.email')}:</span>
            <span className="text-gray-900">{invitation.email}</span>
          </div>

          {formatPhone() && (
            <div className="flex justify-between">
              <span className="text-gray-600">{t('invitation.status.phone')}:</span>
              <span className="text-gray-900">{formatPhone()}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-gray-600">{t('invitation.status.status')}:</span>
            <Badge
              className={getStatusColor(invitation.status)}
              data-testid="invitation-status-badge"
            >
              {t(`invitation.status.${invitation.status.replace('_', '')}`)}
            </Badge>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">{t('invitation.status.expires')}:</span>
            <span className={isExpired ? 'text-red-600 font-medium' : 'text-gray-900'}>
              {formatDate(expiresAt)}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-gray-600">{t('invitation.status.lastAccessed')}:</span>
            <span className="text-gray-900">
              {invitation.lastAccessedAt
                ? formatDate(invitation.lastAccessedAt)
                : t('invitation.status.notYetAccessed')}
            </span>
          </div>
        </div>

        {canManageInvitations && (
          <div className="mt-4 flex gap-2">
            {canExtend && (
              <button
                onClick={() => setConfirmAction(InvitationAction.EXTEND)}
                disabled={isActionLoading}
                data-testid="extend-invitation-button"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {t('invitation.action.extend')}
              </button>
            )}
            {canResend && (
              <button
                onClick={() => setConfirmAction(InvitationAction.RESEND)}
                disabled={isActionLoading}
                data-testid="resend-invitation-button"
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {t('invitation.action.resend')}
              </button>
            )}
          </div>
        )}
      </div>

      {confirmAction && (
        <InvitationConfirmDialog
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => handleAction(confirmAction)}
          action={confirmAction}
          isLoading={isActionLoading}
        />
      )}
    </>
  );
}