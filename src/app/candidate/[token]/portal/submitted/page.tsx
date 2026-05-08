// /GlobalRX_v2/src/app/candidate/[token]/portal/submitted/page.tsx
//
// Phase 7 Stage 2 — candidate-side success page route. Server component
// that gates access to the success UI: only candidates whose invitation
// is `completed` may see it. Anyone else is redirected back to the portal
// (or to the landing page if their session is missing).
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md (Rule 17, Edge 8)
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §18

import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { CandidateSessionService } from '@/lib/services/candidateSession.service';
import { SubmissionSuccessPage } from '@/components/candidate/review-submit/SubmissionSuccessPage';

interface SubmittedPageProps {
  params: Promise<{ token: string }>;
}

/**
 * GET /candidate/[token]/portal/submitted
 *
 * Server component. The candidate session is validated via the same
 * CandidateSessionService used by the rest of the portal; if the session
 * is missing or its token doesn't match the URL token, the candidate is
 * redirected to the auth start (`/candidate/[token]`).
 *
 * Then we look up the invitation by token. If the invitation does not
 * exist, redirect back to the portal (the route layer would already have
 * authenticated, so a missing invitation is a corruption case — sending
 * the candidate to the portal is the safest fallback). If the invitation
 * exists but is NOT in the `completed` state, redirect to the application
 * form (Edge 8 — direct-URL access without submitting must not show the
 * success page).
 *
 * Only when the invitation is genuinely completed does this page render
 * the SubmissionSuccessPage component.
 */
export default async function SubmittedPage({ params }: SubmittedPageProps) {
  const { token } = await params;

  // Step 1: candidate session — same auth scaffold as the portal page.
  const sessionData = await CandidateSessionService.getSession();
  if (!sessionData || sessionData.token !== token) {
    redirect(`/candidate/${encodeURIComponent(token)}`);
  }

  // Step 2: invitation lookup. We only need the status field — the success
  // page is intentionally information-poor (Spec Rule 17 — no order number,
  // no summary, no edit affordances).
  const invitation = await prisma.candidateInvitation.findUnique({
    where: { token },
    select: { status: true },
  });

  if (!invitation) {
    redirect(`/candidate/${encodeURIComponent(token)}/portal`);
  }

  if (invitation.status !== INVITATION_STATUSES.COMPLETED) {
    // Edge 8 — candidate landed on /submitted directly without finishing
    // the submission. Send them back to the application form.
    redirect(`/candidate/${encodeURIComponent(token)}/portal`);
  }

  return <SubmissionSuccessPage />;
}
