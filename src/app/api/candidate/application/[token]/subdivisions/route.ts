// /GlobalRX_v2/src/app/api/candidate/application/[token]/subdivisions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';

// Zod schema for query parameters. The Stage 3 spec requires parentId to be a
// UUID — this guarantees the same shape used by the inline contract test in
// src/schemas/__tests__/address-history-stage3.test.ts.
const subdivisionsQuerySchema = z.object({
  parentId: z.string().uuid()
});

/**
 * GET /api/candidate/application/[token]/subdivisions
 *
 * Lightweight geographic-subdivision lookup endpoint. Returns the immediate
 * children of a parent location row in the `countries` table — used by the
 * AddressBlockInput component to populate the state, county, and city
 * dropdowns as the candidate fills in an address.
 *
 * The "dual-call" pattern documented in the Stage 3 spec keeps these calls
 * lightweight: they only return id/name/code2 for each child row. The single
 * heavyweight DSX-availability + requirement-merge call goes to /fields with
 * the most-specific subregion id once the candidate has finished selecting.
 *
 * Required authentication: Valid candidate_session cookie with matching token
 *
 * Query parameters:
 *   - parentId (required, UUID): the `countries.id` whose children to return.
 *     For populating the state dropdown, pass the country id. For county,
 *     pass the state id. For city, pass the county id.
 *
 * Response shape (200):
 *   Array<{ id: string; name: string; code2: string | null }>
 *   Sorted alphabetically by name. May be empty (e.g., a country with no
 *   states in the database) — empty array is a successful response, not 404.
 *
 * Errors:
 *   - 401: No session or invalid session
 *   - 403: Session token doesn't match URL token
 *   - 400: Missing or non-UUID parentId
 *   - 404: Invitation not found
 *   - 410: Invitation expired or already completed
 *   - 500: Unexpected server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    // Next.js 15: params is a Promise that must be awaited
    const { token } = await params;

    // Step 1: Check for candidate session.
    // Dynamic import mirrors the existing candidate endpoints (see
    // countries/route.ts, scope/route.ts) so unit tests can mock the
    // session service without pulling in NextAuth at module-load time.
    const { CandidateSessionService } = await import('@/lib/services/candidateSession.service');
    const sessionData = await CandidateSessionService.getSession();

    if (!sessionData) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Verify token matches session
    if (sessionData.token !== token) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 3: Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const parentId = searchParams.get('parentId');

    const validation = subdivisionsQuerySchema.safeParse({ parentId });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid parentId parameter' },
        { status: 400 }
      );
    }

    const { parentId: validatedParentId } = validation.data;

    // Step 4: Load invitation to validate it's still valid
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

    // Step 5: Fetch immediate children of the parent location.
    // Mirror the disabled-row filter from countries/route.ts: rows with
    // disabled IS NULL OR disabled = false are returned. Newly-disabled
    // rows still resolve at hydration time (see order-data-resolvers.ts),
    // but they are not offered for new selections here.
    const subdivisions = await prisma.country.findMany({
      where: {
        parentId: validatedParentId,
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

    return NextResponse.json(subdivisions);

  } catch (error) {
    logger.error('Failed to retrieve subdivisions for candidate', {
      event: 'candidate_subdivisions_error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Failed to retrieve subdivisions' },
      { status: 500 }
    );
  }
}
