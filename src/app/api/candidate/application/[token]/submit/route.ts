// /GlobalRX_v2/src/app/api/candidate/application/[token]/submit/route.ts
//
// Phase 7 Stage 2 — POST /api/candidate/application/[token]/submit
//
// Spec:           docs/specs/phase7-stage2-submission-order-generation.md
// Technical plan: docs/specs/phase7-stage2-submission-order-generation-technical-plan.md §11
//
// Order of checks (mirrors the established /validate route):
//   1. Auth — candidate session.
//   2. Token match.
//   3. Load invitation. 404 if missing.
//   4. Expired? 403 with the expired response shape.
//   5. status === completed? 200 idempotent already-submitted.
//   6. order.statusCode !== 'draft'? 200 idempotent already-submitted.
//   7. runValidation(invitation.id). If !allComplete → 400 with full result.
//   8. prisma.$transaction(submitApplication). Returns 200 success.
//
// Logger event prefix: candidate_submit_*. No PII is ever logged.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { ORDER_STATUSES } from '@/constants/order-status';
import { runValidation } from '@/lib/candidate/validation/validationEngine';
import {
  AlreadySubmittedError,
  submitApplication,
} from '@/lib/candidate/submission/submitApplication';
import type {
  SubmitAlreadySubmittedResponse,
  SubmitErrorResponse,
  SubmitExpiredResponse,
  SubmitSuccessResponse,
  SubmitValidationFailureResponse,
} from '@/types/candidate-submission';

/**
 * POST /api/candidate/application/[token]/submit
 *
 * Runs the candidate submission pipeline: validates, creates order items,
 * populates OrderData, flips the order to "submitted," writes
 * OrderStatusHistory + ServiceComment, and marks the invitation completed.
 *
 * Required authentication: Valid candidate_session cookie with matching token.
 *
 * Request body: none. The token identifies the invitation; everything else
 * is read from the database.
 *
 * Responses:
 *   - 200 success — `{ success: true, message, redirectTo }` (Spec line 124).
 *   - 200 already submitted — `{ success: true, message, redirectTo }`
 *     (Spec line 144). Returned when invitation.status === 'completed' OR
 *     order.statusCode !== 'draft'. Idempotent.
 *   - 400 validation failure — `{ success: false, error: 'Validation failed',
 *     validationResult }` (Spec line 132).
 *   - 401 — no session cookie.
 *   - 403 token mismatch — `{ error: 'Forbidden' }`.
 *   - 403 expired — `{ success: false, error: 'This invitation has expired' }`
 *     (Spec line 149).
 *   - 404 — invitation not found.
 *   - 500 — unexpected exception (logged via Winston with
 *     `event: 'candidate_submit_error'`; never logs PII).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // Capture "today" once at the top so the same Date threads through every
  // helper (validation engine reads its own `today`; we use this one for
  // submittedAt / completedAt). Per Plan §11.3 step 1.
  const today = new Date();

  // Step 1: await params (Next.js 15 — params is a Promise).
  const { token } = await params;

  // Step 2: Auth — candidate session.
  const { CandidateSessionService } = await import(
    '@/lib/services/candidateSession.service'
  );
  const sessionData = await CandidateSessionService.getSession();
  if (!sessionData) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  // Step 3: Token match.
  if (sessionData.token !== token) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Step 4: Load invitation + linked order.
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token },
      include: { order: true },
    });
    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 },
      );
    }

    // Step 5: Expired guard.
    if (new Date(invitation.expiresAt) < today) {
      const body: SubmitExpiredResponse = {
        success: false,
        error: 'This invitation has expired',
      };
      return NextResponse.json(body, { status: 403 });
    }

    // Step 6: Already submitted? (Idempotent — Spec Rule 18 / Plan §11.4)
    const successRedirect = buildRedirectTo(token);
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
      const body: SubmitAlreadySubmittedResponse = {
        success: true,
        message: 'Application has already been submitted',
        redirectTo: successRedirect,
      };
      return NextResponse.json(body, { status: 200 });
    }

    // Step 7: Draft-only guard (Spec Rule 20 — corrupted state where
    // invitation.status hasn't flipped but the order has.)
    if (invitation.order.statusCode !== ORDER_STATUSES.DRAFT) {
      const body: SubmitAlreadySubmittedResponse = {
        success: true,
        message: 'Application has already been submitted',
        redirectTo: successRedirect,
      };
      return NextResponse.json(body, { status: 200 });
    }

    // Step 8: Server-side validation (Spec Rule 2). Must pass before any
    // database writes.
    const validationResult = await runValidation(invitation.id);
    if (!validationResult.summary.allComplete) {
      const body: SubmitValidationFailureResponse = {
        success: false,
        error: 'Validation failed',
        validationResult,
      };
      logger.info('Candidate submit blocked by validation', {
        event: 'candidate_submit_validation_failed',
        invitationId: invitation.id,
        // Number, not the errors themselves — the errors include field
        // names which can leak PII context. The frontend displays them;
        // they should not be in server logs.
        totalErrors: validationResult.summary.totalErrors,
      });
      return NextResponse.json(body, { status: 400 });
    }

    // Step 9: Run the transactional submission. Plan §11.2 step 9 sets the
    // explicit timeout to 30s — generous for the worst-case (many
    // addresses × many record services) but bounded so a runaway
    // submission can't hold the connection forever.
    try {
      await prisma.$transaction(
        async (tx) => {
          await submitApplication(tx, invitation.id, today);
        },
        { timeout: 30_000 },
      );
    } catch (txError) {
      // AlreadySubmittedError is the sentinel we throw from inside
      // submitApplication when state shifted between Step 7 and the
      // re-read inside the transaction. Translate to the idempotent 200
      // response rather than 500. The transaction rolled back so nothing
      // was written.
      if (txError instanceof AlreadySubmittedError) {
        const body: SubmitAlreadySubmittedResponse = {
          success: true,
          message: 'Application has already been submitted',
          redirectTo: successRedirect,
        };
        return NextResponse.json(body, { status: 200 });
      }
      throw txError;
    }

    // Step 10: Success.
    const body: SubmitSuccessResponse = {
      success: true,
      message: 'Application submitted successfully',
      redirectTo: successRedirect,
    };
    logger.info('Candidate submit completed', {
      event: 'candidate_submit_completed',
      invitationId: invitation.id,
    });
    return NextResponse.json(body, { status: 200 });
  } catch (error) {
    logger.error('Candidate submit failed', {
      event: 'candidate_submit_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    const body: SubmitErrorResponse = {
      success: false,
      error: 'Internal server error',
    };
    return NextResponse.json(body, { status: 500 });
  }
}

/**
 * Build the `redirectTo` URL for the success page. Centralized here so
 * every response shape uses the same path.
 */
function buildRedirectTo(token: string): string {
  return `/candidate/${encodeURIComponent(token)}/portal/submitted`;
}
