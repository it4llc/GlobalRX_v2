// /GlobalRX_v2/src/components/candidate/CandidateLandingContent.tsx

'use client';

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { PasswordCreationForm } from './PasswordCreationForm';
import { LoginForm } from './LoginForm';
import { useTranslation } from '@/contexts/TranslationContext';
import { Button } from '@/components/ui/button';
import type { InvitationLookupResponse } from '@/types/candidateInvitation';

interface CandidateLandingContentProps {
  token: string;
}

type ContentState =
  | 'loading'
  | 'invalid'
  | 'expired'
  | 'completed'
  | 'password-exists'
  | 'password-form'
  | 'password-success'
  | 'error';

export function CandidateLandingContent({ token }: CandidateLandingContentProps) {
  const { t } = useTranslation();
  const [state, setState] = React.useState<ContentState>('loading');
  const [invitation, setInvitation] = React.useState<InvitationLookupResponse | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetchInvitation();
  }, [token]);

  const fetchInvitation = async () => {
    setState('loading');
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/candidate/invitations/enhanced/${token}`);

      if (!response.ok) {
        if (response.status === 404) {
          setState('invalid');
        } else {
          setState('error');
          setErrorMessage('Unable to load invitation');
        }
        return;
      }

      const data: InvitationLookupResponse = await response.json();
      setInvitation(data);

      // Determine what to show based on invitation status
      if (data.status === 'expired') {
        setState('expired');
      } else if (data.status === 'completed') {
        setState('completed');
      } else if (data.hasPassword) {
        setState('password-exists');
      } else {
        setState('password-form');
      }
    } catch (error) {
      setState('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  const handlePasswordSuccess = () => {
    setState('password-success');
  };

  const handleTryAgain = () => {
    fetchInvitation();
  };

  // Render based on current state
  const renderContent = () => {
    switch (state) {
      case 'loading':
        return (
          <div className="text-center py-8">
            <p className="text-gray-600">{t('candidate.landing.loading')}</p>
          </div>
        );

      case 'invalid':
        return (
          <div className="text-center py-8" data-testid="invitation-error">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('candidate.landing.invalidLink')}
            </h2>
            <p className="text-gray-600">
              {t('candidate.landing.invalidLinkMessage')}
            </p>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center py-8" data-testid="invitation-expired">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('candidate.landing.expiredLink')}
            </h2>
            <p className="text-gray-600">
              {t('candidate.landing.expiredLinkMessage', {
                companyName: invitation?.customerName || 'the company'
              })}
            </p>
          </div>
        );

      case 'completed':
        return (
          <div className="text-center py-8" data-testid="invitation-completed">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('candidate.landing.alreadyCompleted')}
            </h2>
            <p className="text-gray-600">
              {t('candidate.landing.alreadyCompletedMessage')}
            </p>
          </div>
        );

      case 'password-exists':
        return invitation ? (
          <LoginForm
            token={token}
            firstName={invitation.firstName}
            companyName={invitation.customerName}
          />
        ) : null;

      case 'password-form':
        return invitation ? (
          <div>
            <div className="text-center mb-8">
              <div className="w-24 h-24 bg-gray-200 rounded-lg mx-auto mb-6 flex items-center justify-center">
                <span className="text-3xl text-gray-400">🏢</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {t('candidate.landing.welcome', {
                  firstName: invitation.firstName
                })}
              </h1>
              <p className="text-gray-600 mb-4">
                {t('candidate.landing.invitation', {
                  companyName: invitation.customerName
                })}
              </p>
              <p className="text-gray-600">
                {t('candidate.landing.getStarted')}
              </p>
            </div>
            <PasswordCreationForm
              token={token}
              onSuccess={handlePasswordSuccess}
            />
          </div>
        ) : null;

      case 'password-success':
        return (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('candidate.landing.success')}
            </h2>
            <p className="text-gray-600">
              {t('candidate.landing.successMessage')}
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {t('candidate.landing.error')}
            </h2>
            <p className="text-gray-600 mb-6">
              {errorMessage || t('candidate.landing.errorMessage')}
            </p>
            <Button onClick={handleTryAgain} className="h-11">
              {t('candidate.landing.tryAgain')}
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto p-6 md:p-8">
      {renderContent()}
    </Card>
  );
}