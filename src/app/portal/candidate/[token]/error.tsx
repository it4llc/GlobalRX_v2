// /GlobalRX_v2/src/app/portal/candidate/[token]/error.tsx

'use client';

import { useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/**
 * Error boundary for candidate pages
 * Shows a clean error message when something goes wrong
 */
export default function CandidateError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Exception to no-console rule: Client-side error boundaries cannot use Winston
    // because it requires Node.js modules (fs) that aren't available in the browser.
    // This is the only way to log errors in client-side error boundaries.
    console.error('Candidate page error:', {
      message: error.message,
      digest: error.digest,
      stack: error.stack
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-6 md:p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Something went wrong
        </h2>
        <p className="text-gray-600 mb-6">
          We're sorry, but something unexpected happened. Please try again,
          or contact the company that sent you the invitation if the problem continues.
        </p>
        <Button onClick={reset} className="h-11">
          Try Again
        </Button>
      </Card>
    </div>
  );
}