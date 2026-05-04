// /GlobalRX_v2/src/app/api/candidate/application/[token]/countries/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

/**
 * GET /api/candidate/application/[token]/countries
 *
 * Returns a list of available countries for the candidate to select from.
 * Only returns top-level countries (parentId is null) that are not disabled.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Response shape:
 * [
 *   {
 *     id: string,
 *     name: string,
 *     code2: string
 *   }
 * ]
 *
 * Errors:
 *   - 401: No session or invalid session
 *   - 403: Session token doesn't match URL token
 *   - 404: Invitation not found
 *   - 410: Invitation expired or already completed
 *   - 500: Database error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Next.js 15: params is a Promise that must be awaited
    const { token } = await params;

    // Step 1: Check for candidate session
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    const sessionData = await CandidateSessionService.getSession();

    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Verify token matches session
    if (sessionData.token !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 3: Load invitation to validate it's still valid
    const invitation = await prisma.candidateInvitation.findUnique({
      where: { token }
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Check if invitation is expired
    if (new Date(invitation.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invitation expired' }, { status: 410 });
    }

    // Check if invitation is already completed
    if (invitation.status === INVITATION_STATUSES.COMPLETED) {
      return NextResponse.json({ error: 'Invitation already completed' }, { status: 410 });
    }

    // Step 4: Fetch countries from database
    const countries = await prisma.country.findMany({
      where: {
        parentId: null,
        OR: [
          { disabled: null },
          { disabled: false }
        ]
      },
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        code2: true
      }
    });

    logger.info('Countries retrieved for candidate', {
      event: 'candidate_countries_retrieved',
      // CandidateInvitation has no candidateId field; use invitation.id as the stable identifier.
      invitationId: invitation.id,
      countriesCount: countries.length
    });

    // Step 5: Return formatted countries list
    return NextResponse.json(countries);

  } catch (error) {
    logger.error('Failed to retrieve countries for candidate', {
      event: 'candidate_countries_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: 'Failed to retrieve countries' },
      { status: 500 }
    );
  }
}