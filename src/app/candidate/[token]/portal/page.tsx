// Temporary candidate portal success page - Phase 5 Stage 2
// This will be replaced with the actual portal shell in Stage 3

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/TranslationContext';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const response = await fetch('/api/candidate/auth/session');
      const data: SessionData = await response.json();

      if (!data.authenticated) {
        // No valid session - redirect to login
        router.push(`/candidate/${token}`);
        return;
      }

      setSession(data);
    } catch (error) {
      // Error checking session - redirect to login
      router.push(`/candidate/${token}`);
    } finally {
      setIsLoading(false);
    }
  };

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

  if (!session?.authenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md mx-auto p-6 md:p-8">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t('candidate.portal.loggedInTitle')}
          </h1>
          <p className="text-gray-600 mb-2">
            {t('candidate.portal.welcomeMessage', { name: session.invitation?.firstName })}
          </p>
          <p className="text-gray-600 mb-8">
            {t('candidate.portal.comingSoon')}
          </p>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleSignOut();
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            {t('candidate.portal.signOut')}
          </a>
        </div>
      </Card>
    </div>
  );
}