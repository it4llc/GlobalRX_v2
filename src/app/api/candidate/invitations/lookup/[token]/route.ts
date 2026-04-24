// /GlobalRX_v2/src/app/api/candidate/invitations/[token]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { lookupByToken } from '@/lib/services/candidate-invitation.service';
import logger from '@/lib/logger';

/**
 * GET /api/candidate/invitations/lookup/[token]
 *
 * Looks up a candidate invitation by its unique token.
 *
 * Required permissions: NONE - Authentication is intentionally NOT required.
 * This endpoint is accessed by candidates via the link in their invitation email
 * before they have logged in or created an account.
 *
 * Path params:
 *   - token: string - The unique invitation token from the email link
 *
 * Returns: {
 *   id: string,
 *   orderId: string,
 *   customerId: string,
 *   firstName: string,
 *   lastName: string,
 *   email: string,
 *   phoneCountryCode: string | null,
 *   phoneNumber: string | null,
 *   status: string,
 *   expiresAt: Date,
 *   createdAt: Date,
 *   createdBy: string,
 *   completedAt: Date | null,
 *   lastAccessedAt: Date | null
 * }
 *
 * Errors:
 *   - 400: Token parameter is missing
 *   - 404: No invitation found for this token
 *   - 500: Database error
 *
 * Note: If the invitation has expired but status hasn't been updated yet,
 * this endpoint will automatically update the status to 'expired' and save
 * the previous status before returning the expired state.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  // Next.js 15: params is a Promise that must be awaited before destructuring
  const { token } = await params;

  // No authentication check - this is intentionally public for candidates

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }

  try {
    const invitation = await lookupByToken(token);

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invitation not found' },
        { status: 404 }
      );
    }

    // Return invitation data (sensitive fields already excluded by the service)
    return NextResponse.json(invitation, { status: 200 });

  } catch (error) {
    logger.error('Failed to look up invitation', {
      event: 'invitation_lookup_failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenLength: token?.length // Log token length but not the token itself
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}