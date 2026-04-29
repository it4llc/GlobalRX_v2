// GET /api/candidate/auth/session
// Check whether the candidate has a valid session and return their information
// Completely independent from NextAuth

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CandidateSessionService } from '@/lib/services/candidateSession.service';
import logger from '@/lib/logger';

/**
 * GET /api/candidate/auth/session
 *
 * Checks if the candidate has a valid session and returns their information.
 * Validates session data against the database and refreshes expiration.
 *
 * @requires Authenticated candidate session (via cookie)
 * @returns {200} Authenticated response with invitation data
 * @returns {401} No session, invalid session, or expired invitation
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Get session data from cookie
    const sessionData = await CandidateSessionService.getSession();

    // Step 2: If no session, return unauthenticated
    if (!sessionData) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Step 3: Verify the invitation still exists and is in a valid state
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { id: sessionData.invitationId }
    });

    if (!invitation) {
      // Invitation deleted - clear session
      await CandidateSessionService.clearSession();
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Step 4: Check if invitation status is still 'accessed'
    if (invitation.status !== 'accessed') {
      // Status changed (completed, expired, etc.) - clear session
      await CandidateSessionService.clearSession();
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Step 5: Check if invitation has expired since login
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      // Invitation expired - clear session
      await CandidateSessionService.clearSession();
      return NextResponse.json(
        { authenticated: false },
        { status: 401 }
      );
    }

    // Step 6: Refresh the session (extend expiration)
    await CandidateSessionService.refreshSession(sessionData);

    // Step 7: Return authenticated response with invitation data
    return NextResponse.json({
      authenticated: true,
      invitation: {
        id: invitation.id,
        firstName: invitation.firstName,
        status: invitation.status,
        token: invitation.token
      }
    });

  } catch (error) {
    logger.error('Error in candidate session API:', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Clear potentially corrupt session
    await CandidateSessionService.clearSession();

    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  }
}