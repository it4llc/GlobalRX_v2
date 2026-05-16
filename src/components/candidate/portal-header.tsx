// /GlobalRX_v2/src/components/candidate/portal-header.tsx

'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import { MOBILE_SIDEBAR_ID } from '@/lib/candidate/a11y-constants';
import type { CandidateInvitationInfo } from '@/types/candidate-portal';

interface PortalHeaderProps {
  invitation: CandidateInvitationInfo;
  token: string;
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
  // Task 9.2 — drawer-open state forwarded by portal-layout so the
  // hamburger's aria-expanded reflects the actual drawer state. Optional
  // for backwards compatibility with any caller that doesn't yet manage
  // the drawer state explicitly.
  isMenuOpen?: boolean;
}

export default function PortalHeader({
  invitation,
  token,
  onMenuToggle,
  showMenuButton = false,
  isMenuOpen = false,
}: PortalHeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      // Phase 5 Stage 3 renamed logout to signout for semantic clarity
      await fetch('/api/candidate/auth/signout', {
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
              type="button"
              onClick={onMenuToggle}
              className="md:hidden mr-4 p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              aria-label={t('candidate.portal.menu')}
              data-testid="hamburger-menu"
              // Task 9.2 — aria-expanded tracks the drawer's open state so
              // assistive tech can announce "expanded" / "collapsed" when
              // the user toggles it. aria-controls points at the drawer's
              // id so screen readers can jump to the element being toggled.
              aria-expanded={isMenuOpen ? 'true' : 'false'}
              aria-controls={MOBILE_SIDEBAR_ID}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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