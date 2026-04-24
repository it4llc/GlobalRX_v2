// /GlobalRX_v2/src/app/api/candidate/invitations/[id]/resend/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resendInvitation } from '@/lib/services/candidate-invitation.service';
import { canManageCandidateInvitations, isCustomerUser } from '@/lib/auth-utils';
import logger from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/candidate/invitations/[id]/resend
 *
 * Resends an invitation email to the candidate.
 * The same token is used - only the email is sent again.
 *
 * Required permissions:
 * - Customer users: candidate_workflow permission (own customer's invitations only)
 * - Internal/admin users: customer_config permission
 *
 * Path params:
 *   - id: The invitation ID (UUID)
 *
 * Returns: { success: true, message: string } (status 200)
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions or invitation doesn't belong to customer
 *   - 404: Invitation not found
 *   - 422: Invitation is in a status that doesn't allow resending (expired, in_progress, completed)
 *   - 500: Database error
 *
 * Note: Actual email sending will be implemented in a future phase.
 * For now, this just logs the event.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Step 1: Authentication check - must be first
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check
  if (!canManageCandidateInvitations(session.user)) {
    return NextResponse.json(
      { error: 'Forbidden - insufficient permissions' },
      { status: 403 }
    );
  }

  // Next.js 15: params is a Promise that must be awaited before destructuring
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Invitation ID is required' },
      { status: 400 }
    );
  }

  // Step 3: Determine customer ID and verify ownership
  let customerId: string;

  if (isCustomerUser(session.user)) {
    // Customer users can only resend invitations for their own customer
    if (!session.user.customerId) {
      logger.error('Customer user has no customerId', {
        userId: session.user.id
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
    customerId = session.user.customerId;

    // Check if the invitation belongs to this customer
    const invitation = await prisma.candidateInvitation.findFirst({
      where: {
        id,
        customerId
      }
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }
  } else {
    // Internal/admin users can resend any invitation
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { id }
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    customerId = invitation.customerId;
  }

  // Step 4: Business logic inside try/catch
  try {
    const result = await resendInvitation(
      id,
      customerId,
      session.user.id
    );

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error cases
    if (errorMessage.includes('not found')) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    if (errorMessage.includes('does not belong to this customer')) {
      return NextResponse.json(
        { error: 'Forbidden - invitation does not belong to this customer' },
        { status: 403 }
      );
    }

    if (errorMessage.includes('expired')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 422 }
      );
    }

    if (errorMessage.includes('cannot be resent')) {
      return NextResponse.json(
        { error: 'Invitation cannot be resent in its current status' },
        { status: 422 }
      );
    }

    logger.error('Failed to resend invitation', {
      event: 'invitation_resend_failure',
      error: errorMessage,
      invitationId: id
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}