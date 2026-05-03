// /GlobalRX_v2/src/components/candidate/form-engine/ScopeDisplay.tsx

'use client';

import React from 'react';
import type { ScopeInfo } from '@/types/candidate-repeatable-form';

interface ScopeDisplayProps {
  scope: ScopeInfo;
  sectionType: 'education' | 'employment';
}

/**
 * Scope Display Component
 *
 * Shows scope requirements to the candidate.
 * Displays the scope description directly from the API.
 */
export function ScopeDisplay({ scope, sectionType }: ScopeDisplayProps) {
  return (
    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
      <p className="text-sm text-blue-800">
        {scope.scopeDescription}
      </p>
    </div>
  );
}