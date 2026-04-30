// /GlobalRX_v2/src/components/candidate/portal-expired.tsx

import React from 'react';
import { Card } from '@/components/ui/card';
import { useTranslation } from '@/contexts/TranslationContext';

interface PortalExpiredProps {
  companyName: string;
}

export default function PortalExpired({ companyName }: PortalExpiredProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md mx-auto p-6 md:p-8">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-amber-100 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {t('candidate.portal.expired')}
          </h1>
          <p className="text-gray-600">
            {t('candidate.portal.expiredMessage', { companyName })}
          </p>
        </div>
      </Card>
    </div>
  );
}