// /GlobalRX_v2/src/app/api/candidate/auth/create-password/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { passwordCreationSchema } from '@/lib/validations/candidate-password';
import { hashPassword } from '@/lib/auth.server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

/**
 * @route POST /api/candidate/auth/create-password
 *
 * Creates a password for a candidate using their invitation token.
 * This is the first step for a candidate accessing their application.
 *
 * Required permissions: NONE - Authentication is intentionally NOT required.
 * The token itself serves as authentication for this one-time operation.
 *
 * Request body: {
 *   token: string - The invitation token from the URL
 *   password: string - The password to set (min 8 chars, 1 letter, 1 number)
 * }
 *
 * Returns: {
 *   success: true,
 *   status: string - The new invitation status ("accessed")
 * }
 *
 * Errors:
 *   - 400: Invalid input, invitation expired, password already created, weak password
 *   - 404: Token not found
 *   - 500: Database or hashing error
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input
    const validation = passwordCreationSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: validation.error.errors
        },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Look up the invitation
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token }
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    const now = new Date();
    if (invitation.expiresAt < now) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      );
    }

    // Check if password already exists
    if (invitation.passwordHash) {
      return NextResponse.json(
        { error: 'Unable to process request' },
        { status: 400 }
      );
    }

    // Check if invitation is already completed
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
      return NextResponse.json(
        { error: 'This application has already been completed' },
        { status: 400 }
      );
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Update the invitation with the password hash and status
    await prisma.$transaction(async (tx) => {
      // Update invitation
      await tx.candidateInvitation.update({
        where: { id: invitation.id },
        data: {
          passwordHash,
          status: INVITATION_STATUSES.ACCESSED,
          lastAccessedAt: now,
          updatedAt: now
        }
      });

      // Log the event
      await tx.orderStatusHistory.create({
        data: {
          order: { connect: { id: invitation.orderId } },
          fromStatus: invitation.status,
          toStatus: INVITATION_STATUSES.ACCESSED,
          user: { connect: { id: invitation.createdBy } }, // Use invitation creator as the actor
          eventType: 'CANDIDATE_PASSWORD_CREATED',
          message: `Candidate ${invitation.firstName} ${invitation.lastName} created a password`,
          isAutomatic: false,
          createdAt: now
        }
      });
    });

    logger.info('Candidate password created', {
      invitationId: invitation.id,
      email: invitation.email
    });

    return NextResponse.json(
      {
        success: true,
        status: INVITATION_STATUSES.ACCESSED
      },
      { status: 200 }
    );

  } catch (error) {
    logger.error('Failed to create candidate password', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}