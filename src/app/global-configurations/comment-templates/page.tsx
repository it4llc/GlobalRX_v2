// /GlobalRX_v2/src/app/global-configurations/comment-templates/page.tsx
'use client';

import React from 'react';
import { CommentTemplateGrid } from '@/components/comment-templates/CommentTemplateGrid';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from '@/contexts/TranslationContext';

export default function CommentTemplatesPage() {
  const { user, isLoading, checkPermission } = useAuth();
  const { t } = useTranslation();

  // Show loading state while user is being fetched
  if (isLoading) {
    return (
      <div className="p-4">
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  // Comment management is restricted to internal users with specific permission
  // This prevents customer/vendor users from modifying system-wide templates
  // that affect order processing workflow across all organizations
  if (!user || !checkPermission('comment_management')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">
          {t('common.noPermission')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow">
        <CommentTemplateGrid />
      </div>
    </div>
  );
}