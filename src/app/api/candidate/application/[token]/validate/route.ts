// /GlobalRX_v2/src/app/api/candidate/application/[token]/validate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

import { runValidation } from '@/lib/candidate/validation/validationEngine';

/**
 * POST /api/candidate/application/[token]/validate
 *
 * Runs the full validation engine for the candidate identified by the
 * invitation token and returns the assembled FullValidationResult shape:
 * per-section status + error lists, plus a review-page summary.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Request body: none. The endpoint reads the candidate's saved data, the
 * package scope configuration, and the workflow's gapToleranceDays from the
 * database — there's nothing for the client to send (Spec line 256).
 *
 * Response (200):
 * {
 *   sections: [{
 *     sectionId: string
 *     status: 'not_started' | 'incomplete' | 'complete'
 *     fieldErrors: [{ fieldName, messageKey, placeholders? }]
 *     scopeErrors: [{ messageKey, placeholders }]
 *     gapErrors:   [{ messageKey, placeholders, gapStart, gapEnd, gapDays }]
 *     documentErrors: [{ requirementId, documentNameKey }]
 *   }],
 *   summary: {
 *     sections: [{ sectionId, sectionName, status, errors: ReviewError[] }],
 *     allComplete: boolean,
 *     totalErrors: number
 *   }
 * }
 *
 * Errors:
 *   - 401: No session
 *   - 403: Token mismatch
 *   - 404: Invitation not found
 *   - 410: Invitation expired or already completed
 *   - 500: Validation engine threw
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    // Step 1: Auth — candidate session
    const { CandidateSessionService } = await import(
      '@/lib/services/candidateSession.service'
    );
    const sessionData = await CandidateSessionService.getSession();
    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Token match
    if (sessionData.token !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 3: Load invitation to verify state. We delegate the actual
    // validation work to runValidation; this route is thin auth + dispatch.
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token },
    });
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
      return NextResponse.json(
        { error: 'Invitation already completed' },
        { status: 410 },
      );
    }

    // Step 4: Run validation. Spec Rule 35 — never cached.
    const result = await runValidation(invitation.id);
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Failed to run candidate validation', {
      event: 'candidate_validation_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
