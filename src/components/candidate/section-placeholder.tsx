// /GlobalRX_v2/src/components/candidate/section-placeholder.tsx

import React from 'react';
import { useTranslation } from '@/contexts/TranslationContext';

interface SectionPlaceholderProps {
  title: string;
}

export default function SectionPlaceholder({ title }: SectionPlaceholderProps) {
  const { t } = useTranslation();

  return (
    <div className="p-8">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        {t(title)}
      </h2>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 text-center">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-600 text-lg">
          {t('candidate.portal.sectionPlaceholder')}
        </p>
      </div>
    </div>
  );
}