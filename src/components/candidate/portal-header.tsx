// /GlobalRX_v2/src/components/candidate/portal-header.tsx

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import type { CandidateInvitationInfo } from '@/types/candidate-portal';

interface PortalHeaderProps {
  invitation: CandidateInvitationInfo;
  token: string;
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
}

export default function PortalHeader({
  invitation,
  token,
  onMenuToggle,
  showMenuButton = false
}: PortalHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await fetch('/api/candidate/auth/logout', {
        method: 'POST'
      });
    } finally {
      // Always redirect to landing page
      router.push(`/candidate/${token}`);
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between h-16">
        <div className="flex items-center">
          {showMenuButton && (
            <button
              onClick={onMenuToggle}
              className="md:hidden mr-4 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              aria-label={t('candidate.portal.menu')}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-medium text-gray-900">
            {t('candidate.portal.welcome', { firstName: invitation.firstName })}
          </h1>
        </div>
        <Button
          onClick={handleSignOut}
          variant="outline"
          size="sm"
        >
          {t('candidate.portal.signOut')}
        </Button>
      </div>
    </header>
  );
}