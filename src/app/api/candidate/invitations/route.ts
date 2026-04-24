// /GlobalRX_v2/src/app/api/candidate/invitations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { createInvitationSchema } from '@/lib/validations/candidateInvitation';
import { createInvitation } from '@/lib/services/candidate-invitation.service';
import { canManageCandidateInvitations, isCustomerUser } from '@/lib/auth-utils';
import logger from '@/lib/logger';

/**
 * POST /api/candidate/invitations
 *
 * Creates a new candidate invitation with an associated draft order.
 *
 * Required permissions:
 * - Customer users: candidate_workflow permission
 * - Internal/admin users: customer_config permission
 *
 * Request body:
 *   - packageId: string (UUID) - required
 *   - firstName: string - required, max 100 chars
 *   - lastName: string - required, max 100 chars
 *   - email: string - required, valid email format
 *   - phoneCountryCode?: string - optional, max 5 chars
 *   - phoneNumber?: string - optional, max 20 chars
 *   - customerId?: string (UUID) - required for admin users only
 *
 * Returns: { invitation object with token } (status 201)
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 400: Invalid input (validation failed)
 *   - 403: Insufficient permissions or package doesn't belong to customer
 *   - 404: Package not found
 *   - 422: Package has no active workflow assigned
 *   - 500: Token generation failed or database error
 */
export async function POST(request: NextRequest) {
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

  // Step 3: Parse and validate input
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON in request body' },
      { status: 400 }
    );
  }

  const validation = createInvitationSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 4: Determine customerId based on user type
  let customerId: string;

  if (isCustomerUser(session.user)) {
    // Customer users can only create invitations for their own customer
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

    // If customer user provided customerId, it must match their own
    if (validation.data.customerId && validation.data.customerId !== customerId) {
      return NextResponse.json(
        { error: 'Forbidden - cannot create invitation for another customer' },
        { status: 403 }
      );
    }
  } else {
    // Internal/admin users must provide customerId
    if (!validation.data.customerId) {
      return NextResponse.json(
        { error: 'customerId is required for admin users' },
        { status: 400 }
      );
    }
    customerId = validation.data.customerId;
  }

  // Step 5: Business logic inside try/catch
  try {
    const invitation = await createInvitation(
      validation.data,
      customerId,
      session.user.id
    );

    // Strip out passwordHash before sending response
    const { passwordHash, ...safeInvitation } = invitation;

    // Return the created invitation with status 201
    return NextResponse.json(safeInvitation, { status: 201 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error cases
    if (errorMessage.includes('Package not found')) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }

    if (errorMessage.includes('does not belong to this customer')) {
      return NextResponse.json(
        { error: 'Forbidden - package does not belong to this customer' },
        { status: 403 }
      );
    }

    if (errorMessage.includes('workflow')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 422 }
      );
    }

    if (errorMessage.includes('Failed to generate unique invitation token')) {
      return NextResponse.json(
        { error: 'Failed to generate unique token. Please try again.' },
        { status: 500 }
      );
    }

    logger.error('Failed to create candidate invitation', {
      event: 'invitation_create_failure',
      error: errorMessage,
      customerId,
      packageId: validation.data.packageId
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}