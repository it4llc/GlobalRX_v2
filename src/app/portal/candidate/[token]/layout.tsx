// /GlobalRX_v2/src/app/portal/candidate/[token]/layout.tsx

import { ReactNode } from 'react';

/**
 * Standalone layout for candidate pages
 * Does not include admin portal navigation or header
 * Mobile-first design with minimum 320px width support
 */
export default function CandidateLayout({
  children
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8">
        <div className="w-full">
          {children}
        </div>
      </main>
    </div>
  );
}