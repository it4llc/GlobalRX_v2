// /GlobalRX_v2/src/app/portal/candidate/[token]/page.tsx

import { CandidateLandingContent } from '@/components/candidate/CandidateLandingContent';

/**
 * Candidate landing page
 * Server component that renders the client-side landing content
 */
export default async function CandidateLandingPage({
  params
}: {
  params: Promise<{ token: string }>
}) {
  // Next.js 15: params is a Promise that must be awaited
  const { token } = await params;

  return <CandidateLandingContent token={token} />;
}