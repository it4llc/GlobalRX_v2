'use client';

import React from 'react';
import { InvitationAction, InvitationActionButtonProps } from '@/types/invitation-management';
import { useTranslation } from '@/contexts/TranslationContext';
import { ClockIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

export function InvitationActionButton({
  action,
  invitationId,
  disabled = false,
  onSuccess
}: InvitationActionButtonProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleClick = async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/candidate/invitations/${invitationId}/${action}`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${action} invitation`);
      }

      onSuccess?.();
    } catch (error) {
      console.error(`Error ${action}ing invitation:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonContent = () => {
    if (isLoading) {
      if (action === InvitationAction.EXTEND) {
        return (
          <>
            <ClockIcon className="h-4 w-4 animate-spin" />
            {t('invitation.action.extending')}
          </>
        );
      } else {
        return (
          <>
            <EnvelopeIcon className="h-4 w-4 animate-spin" />
            {t('invitation.action.resending')}
          </>
        );
      }
    }

    if (action === InvitationAction.EXTEND) {
      return (
        <>
          <ClockIcon className="h-4 w-4" />
          {t('invitation.action.extend')}
        </>
      );
    } else {
      return (
        <>
          <EnvelopeIcon className="h-4 w-4" />
          {t('invitation.action.resend')}
        </>
      );
    }
  };

  const testId = action === InvitationAction.EXTEND
    ? 'extend-invitation-button'
    : 'resend-invitation-button';

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      data-testid={testId}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
        disabled || isLoading
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-blue-600 text-white hover:bg-blue-700'
      }`}
    >
      {getButtonContent()}
    </button>
  );
}