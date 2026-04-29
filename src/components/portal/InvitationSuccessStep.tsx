// /GlobalRX_v2/src/components/portal/InvitationSuccessStep.tsx

'use client';

import React from 'react';
import { CheckCircle, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/useToast';
import { InvitationResponse } from '@/types/inviteCandidate';
import { useTranslation } from '@/contexts/TranslationContext';

interface InvitationSuccessStepProps {
  invitation: InvitationResponse;
  onClose: () => void;
}

export function InvitationSuccessStep({ invitation, onClose }: InvitationSuccessStepProps) {
  const { t } = useTranslation();
  const { toastSuccess, toastError } = useToast();

  // Build the invitation link
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const invitationLink = `${baseUrl}/candidate/${invitation.token}`;

  // Format expiration date
  const expirationDate = new Date(invitation.expiresAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationLink);
      toastSuccess(t('portal.inviteCandidate.linkCopied'));
    } catch (error) {
      toastError('Failed to copy link to clipboard');
    }
  };

  return (
    <div className="flex flex-col items-center text-center space-y-6 py-6">
      {/* Success icon */}
      <CheckCircle className="h-16 w-16 text-green-600" />

      {/* Success title */}
      <h2 className="text-2xl font-semibold text-gray-900">
        {t('portal.inviteCandidate.successTitle')}
      </h2>

      {/* Success message with candidate details */}
      <p className="text-gray-600">
        {t('portal.inviteCandidate.successMessage')
          .replace('{firstName}', invitation.firstName)
          .replace('{lastName}', invitation.lastName)
          .replace('{email}', invitation.email)}
      </p>

      {/* Expiration message */}
      <p className="text-gray-600">
        {t('portal.inviteCandidate.expirationMessage').replace('{date}', expirationDate)}
      </p>

      {/* Invitation link field */}
      <div className="w-full max-w-md space-y-2">
        <label className="block text-sm font-medium text-gray-700 text-left">
          {t('portal.inviteCandidate.invitationLinkLabel')}
        </label>
        <div className="flex gap-2">
          <Input
            value={invitationLink}
            readOnly
            className="flex-1"
            data-testid="invitation-link"
          />
          <Button
            onClick={handleCopyLink}
            variant="outline"
            className="gap-2"
            data-testid="copy-link-button"
          >
            <Copy className="h-4 w-4" />
            {t('portal.inviteCandidate.copyLinkButton')}
          </Button>
        </div>
      </div>

      {/* Done button */}
      <Button onClick={onClose} className="w-32">
        {t('portal.inviteCandidate.doneButton')}
      </Button>
    </div>
  );
}