// /GlobalRX_v2/src/app/api/candidate/invitations/[id]/extend/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { extendInvitationSchema } from '@/lib/validations/candidateInvitation';
import { extendInvitation } from '@/lib/services/candidate-invitation.service';
import { canManageCandidateInvitations, isCustomerUser } from '@/lib/auth-utils';
import logger from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/candidate/invitations/[id]/extend
 *
 * Extends the expiration date of a candidate invitation.
 *
 * Required permissions:
 * - Customer users: candidate_workflow permission (own customer's invitations only)
 * - Internal/admin users: customer_config permission
 *
 * Path params:
 *   - id: The invitation ID (UUID)
 *
 * Request body:
 *   - days?: number - optional, 1-15, defaults to workflow's expirationDays (capped at 15)
 *
 * Returns: { updated invitation object } (status 200)
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 400: Invalid input (days not between 1 and 15)
 *   - 403: Insufficient permissions or invitation doesn't belong to customer
 *   - 404: Invitation not found
 *   - 422: Invitation is completed (cannot extend completed invitations)
 *   - 500: Database error
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

  // Step 3: Parse and validate input
  let body;
  try {
    body = await request.json();
  } catch (error) {
    // Empty body is valid (days is optional)
    body = {};
  }

  const validation = extendInvitationSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 4: Determine customer ID and verify ownership
  let customerId: string;

  if (isCustomerUser(session.user)) {
    // Customer users can only extend invitations for their own customer
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
    // Internal/admin users can extend any invitation
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

  // Step 5: Business logic inside try/catch
  try {
    const updatedInvitation = await extendInvitation(
      id,
      customerId,
      session.user.id,
      validation.data.days
    );

    return NextResponse.json(updatedInvitation, { status: 200 });

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

    if (errorMessage.includes('Cannot extend a completed invitation')) {
      return NextResponse.json(
        { error: 'Cannot extend a completed invitation' },
        { status: 422 }
      );
    }

    logger.error('Failed to extend invitation', {
      event: 'invitation_extend_failure',
      error: errorMessage,
      invitationId: id,
      days: validation.data.days
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}