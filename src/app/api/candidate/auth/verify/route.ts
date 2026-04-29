// POST /api/candidate/auth/verify
// Verify a returning candidate's password and create a session
// Completely independent from NextAuth

import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { candidateVerifySchema } from '@/lib/schemas/candidateAuthSchemas';
import { CandidateSessionService } from '@/lib/services/candidateSession.service';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import logger from '@/lib/logger';

/**
 * POST /api/candidate/auth/verify
 *
 * Verifies a candidate's password and creates a session.
 * Implements rate limiting (5 attempts per 15 minutes) for security.
 *
 * @body {string} token - The invitation token
 * @body {string} password - The candidate's password
 * @requires No authentication (public endpoint)
 * @returns {200} Success response with session created
 * @returns {400} Invalid request body or validation error
 * @returns {401} Invalid credentials, expired invitation, or wrong status
 * @returns {429} Too many failed attempts (rate limited)
 * @returns {500} Internal server error
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Parse and validate request body
    const body = await request.json();
    const validation = candidateVerifySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Token and password are required' },
        { status: 400 }
      );
    }

    const { token, password } = validation.data;

    // Step 2: Check rate limiting
    // We need to look up the invitation first to get the ID for rate limiting
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token }
    });

    if (!invitation) {
      // Don't reveal that the token doesn't exist
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const rateLimit = CandidateSessionService.checkRateLimit(invitation.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many attempts. Please try again later.',
          retryAfterMinutes: rateLimit.remainingMinutes || 15
        },
        { status: 429 }
      );
    }

    // Step 3: Check invitation status
    if (invitation.status !== INVITATION_STATUSES.ACCESSED) {
      if (invitation.status === INVITATION_STATUSES.COMPLETED) {
        return NextResponse.json(
          { error: 'This invitation has already been completed' },
          { status: 401 }
        );
      }
      // For other statuses (draft, sent, expired), use generic error
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Step 4: Check if invitation has expired
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 401 }
      );
    }

    // Step 5: Check if password has been set
    if (!invitation.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Step 6: Verify password
    const passwordValid = await bcrypt.compare(password, invitation.passwordHash);

    if (!passwordValid) {
      // Record failed attempt
      CandidateSessionService.recordFailedAttempt(invitation.id);

      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Step 7: Success - clear rate limit and update lastAccessedAt
    CandidateSessionService.clearRateLimit(invitation.id);

    await prisma.candidateInvitation.update({
      where: { id: invitation.id },
      data: { lastAccessedAt: new Date() }
    });

    // Step 8: Create session
    await CandidateSessionService.createSession({
      invitationId: invitation.id,
      token: invitation.token,
      firstName: invitation.firstName,
      status: invitation.status,
      expiresAt: CandidateSessionService.getNewExpirationTime()
    });

    // Step 9: Return success response
    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        firstName: invitation.firstName,
        status: invitation.status,
        token: invitation.token
      }
    });

  } catch (error) {
    logger.error('Error in candidate verify API:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}