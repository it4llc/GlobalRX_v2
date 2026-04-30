// /GlobalRX_v2/src/components/candidate/portal-completed.tsx

import React from 'react';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/TranslationContext';

interface PortalCompletedProps {
  firstName: string;
  companyName: string;
}

export default function PortalCompleted({ firstName, companyName }: PortalCompletedProps) {
  const { t } = useTranslation();

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
            {t('candidate.portal.completed')}
          </h1>
          <p className="text-gray-600">
            {t('candidate.portal.completedMessage', { firstName, companyName })}
          </p>
        </div>
      </Card>
    </div>
  );
}