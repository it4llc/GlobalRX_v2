// /GlobalRX_v2/src/components/candidate/form-engine/AutoSaveIndicator.tsx

'use client';

import React from 'react';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  errorMessage?: string;
}

/**
 * Auto-Save Indicator
 *
 * A small, non-intrusive indicator that shows the save status:
 * - Saving... — briefly shown while the save request is in progress
 * - Saved — shown for a few seconds after a successful save
 * - Save failed — retrying — shown if a save request fails
 */
export function AutoSaveIndicator({ status, errorMessage }: AutoSaveIndicatorProps) {
  if (status === 'idle') {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {status === 'saving' && (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Saving...</span>
        </>
      )}

      {status === 'saved' && (
        <>
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-green-600">Saved</span>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle className="h-4 w-4 text-red-600" />
          <span className="text-red-600">
            {errorMessage || 'Save failed — retrying'}
          </span>
        </>
      )}
    </div>
  );
}