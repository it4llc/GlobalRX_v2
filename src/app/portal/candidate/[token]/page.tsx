// /GlobalRX_v2/src/app/portal/candidate/[token]/page.tsx

import { CandidateLandingContent } from '@/components/candidate/CandidateLandingContent';

/**
 * Candidate landing page - Phase 5 Stage 1
 *
 * This is the page candidates see when they click the invitation link for the first time.
 * It handles token validation, shows appropriate content based on invitation status,
 * and allows first-time password creation. Uses a standalone layout without admin portal chrome.
 *
 * URL pattern: /portal/candidate/[token]
 * Authentication: None required (token-based access)
 * Mobile-first design: Optimized for mobile devices per specification
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