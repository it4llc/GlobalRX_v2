// /GlobalRX_v2/src/components/candidate/portal-welcome.tsx

import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';
import type { CandidateInvitationInfo } from '@/types/candidate-portal';

interface PortalWelcomeProps {
  invitation: CandidateInvitationInfo;
  sectionCount: number;
}

export default function PortalWelcome({ invitation, sectionCount }: PortalWelcomeProps) {
  const { t } = useTranslation();

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">
        {t('candidate.portal.welcomeTitle', { firstName: invitation.firstName })}
      </h1>
      <p className="text-lg text-gray-700 mb-4">
        {t('candidate.portal.companyContext', { companyName: invitation.companyName })}
      </p>
      <p className="text-gray-600 mb-4">
        {t('candidate.portal.sectionCount', { count: sectionCount })}
      </p>
      <p className="text-gray-600">
        {t('candidate.portal.getStarted')}
      </p>
    </div>
  );
}