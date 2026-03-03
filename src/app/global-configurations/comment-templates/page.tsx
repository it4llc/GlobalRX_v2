// src/app/global-configurations/comment-templates/page.tsx
'use client';

import React from 'react';
import { CommentTemplateGrid } from '@/components/comment-templates/CommentTemplateGrid';
import { useAuth } from '@/contexts/AuthContext';
import { hasPermission } from '@/lib/permission-utils';

export default function CommentTemplatesPage() {
  const { user, loading } = useAuth();

  // Show loading state while user is being fetched
  if (loading) {
    return (
      <div className="p-4">
        <p>Loading...</p>
      </div>
    );
  }

  // Check for comment_management permission
  if (!user || !hasPermission(user, 'comment_management')) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">
          You do not have permission to access comment templates.
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