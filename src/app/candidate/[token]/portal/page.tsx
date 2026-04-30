// /GlobalRX_v2/src/app/candidate/[token]/portal/page.tsx
// Candidate portal shell - Phase 5 Stage 3

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/contexts/TranslationContext';
import PortalLayout from '@/components/candidate/portal-layout';
import PortalExpired from '@/components/candidate/portal-expired';
import PortalCompleted from '@/components/candidate/portal-completed';
import type { CandidatePortalStructureResponse } from '@/types/candidate-portal';

interface SessionData {
  authenticated: boolean;
  invitation?: {
    id: string;
    firstName: string;
    status: string;
    token: string;
  };
}

export default function CandidatePortalPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const { t } = useTranslation();
  const [session, setSession] = useState<SessionData | null>(null);
  const [structure, setStructure] = useState<CandidatePortalStructureResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkSessionAndLoadStructure();
  }, [token]);

  const checkSessionAndLoadStructure = async () => {
    try {
      // Check session first
      const sessionResponse = await fetch('/api/candidate/auth/session');
      const sessionData: SessionData = await sessionResponse.json();

      if (!sessionData.authenticated) {
        // No valid session - redirect to login
        router.push(`/candidate/${token}`);
        return;
      }

      setSession(sessionData);

      // Load application structure
      const structureResponse = await fetch(`/api/candidate/application/${token}/structure`);

      if (!structureResponse.ok) {
        if (structureResponse.status === 401) {
          // Session invalid - redirect to login
          router.push(`/candidate/${token}`);
          return;
        }
        throw new Error('Failed to load application structure');
      }

      const structureData: CandidatePortalStructureResponse = await structureResponse.json();
      setStructure(structureData);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/candidate/auth/signout', {
        method: 'POST'
      });
    } finally {
      // Always redirect to landing page
      router.push(`/candidate/${token}`);
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    checkSessionAndLoadStructure();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md mx-auto p-6 md:p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">{t('candidate.portal.loading')}</p>
          </div>
        </Card>
      </div>
    );
  }

  // Not authenticated
  if (!session?.authenticated) {
    return null; // Will redirect
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md mx-auto p-6 md:p-8">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              {t('candidate.portal.errorLoading')}
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-2">
              <Button onClick={handleRetry} className="w-full">
                {t('candidate.portal.tryAgain')}
              </Button>
              <Button onClick={handleSignOut} variant="outline" className="w-full">
                {t('candidate.portal.signOut')}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // No structure loaded
  if (!structure) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md mx-auto p-6 md:p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">{t('candidate.portal.errorLoading')}</p>
            <Button onClick={handleRetry} className="mt-4">
              {t('candidate.portal.tryAgain')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Check if invitation is expired
  const isExpired = new Date(structure.invitation.expiresAt) < new Date();
  if (isExpired) {
    return (
      <>
        <PortalExpired companyName={structure.invitation.companyName} />
        <div className="text-center mt-4">
          <Button onClick={handleSignOut} variant="outline">
            {t('candidate.portal.signOut')}
          </Button>
        </div>
      </>
    );
  }

  // Check if application is completed
  if (structure.invitation.status === 'completed') {
    return (
      <>
        <PortalCompleted
          firstName={structure.invitation.firstName}
          companyName={structure.invitation.companyName}
        />
        <div className="text-center mt-4">
          <Button onClick={handleSignOut} variant="outline">
            {t('candidate.portal.signOut')}
          </Button>
        </div>
      </>
    );
  }

  // Render portal layout
  return (
    <PortalLayout
      invitation={structure.invitation}
      sections={structure.sections}
      token={token}
    />
  );
}