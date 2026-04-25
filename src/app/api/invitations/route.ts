// /GlobalRX_v2/src/app/api/invitations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canInviteCandidates } from '@/lib/auth-utils';
import { createInvitationSchema } from '@/lib/validations/candidateInvitation';
import logger from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/invitations
 *
 * Creates a new candidate invitation and associated order.
 *
 * Required permissions: candidates.invite or admin role
 *
 * Request body:
 *   - packageId: string (UUID)
 *   - firstName: string
 *   - lastName: string
 *   - email: string
 *   - phoneCountryCode?: string
 *   - phoneNumber?: string
 *   - customerId?: string (UUID - only for admin users)
 *
 * Returns: InvitationResponse object with invitation details
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 400: Invalid input or package has no workflow
 *   - 404: Package not found
 *   - 500: Internal server error
 */
export async function POST(request: NextRequest) {
  // Step 1: Authentication check - always first
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check using centralized function
  if (!canInviteCandidates(session.user)) {
    return NextResponse.json(
      { error: 'Forbidden - insufficient permissions' },
      { status: 403 }
    );
  }

  // Step 3: Input validation
  const body = await request.json();
  const validation = createInvitationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Determine customer ID based on user type
  let customerId: string;
  if (session.user.userType === 'customer') {
    // Customer users can only create invitations for their own customer
    if (!session.user.customerId) {
      return NextResponse.json(
        { error: 'Customer ID not found for user' },
        { status: 403 }
      );
    }
    customerId = session.user.customerId;

    // If they try to specify a different customerId, reject it
    if (data.customerId && data.customerId !== customerId) {
      return NextResponse.json(
        { error: 'Cannot create invitations for other customers' },
        { status: 403 }
      );
    }
  } else {
    // Admin/internal users must specify customerId
    if (!data.customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required for admin users' },
        { status: 400 }
      );
    }
    customerId = data.customerId;
  }

  try {
    // Step 4: Check if the package exists and has a workflow
    const packageData = await prisma.package.findUnique({
      where: { id: data.packageId },
      include: {
        workflow: true
      }
    });

    if (!packageData) {
      return NextResponse.json(
        { error: 'Package not found' },
        { status: 404 }
      );
    }

    // Check if package has a workflow and it's active
    if (!packageData.workflow) {
      return NextResponse.json(
        { error: 'The selected package does not have a workflow' },
        { status: 400 }
      );
    }

    if (packageData.workflow.status !== 'active') {
      return NextResponse.json(
        { error: 'The selected package workflow is not active' },
        { status: 400 }
      );
    }

    // Generate invitation token
    const invitationToken = uuidv4();

    // Calculate expiration (using workflow's expirationDays or default 30 days)
    const expirationDays = packageData.workflow.expirationDays || 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expirationDays);

    // Create the invitation and order in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the order with draft status
      const order = await tx.order.create({
        data: {
          customerId: customerId,
          userId: session.user.id, // Add the current user as the creator
          statusCode: 'draft',
          subject: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email.toLowerCase(),
            phoneCountryCode: data.phoneCountryCode,
            phoneNumber: data.phoneNumber
          },
          orderNumber: `INV-${Date.now()}`, // Temporary order number
          notes: 'Created via candidate invitation'
        }
      });

      // Create the candidate invitation record
      const invitation = await tx.candidateInvitation.create({
        data: {
          token: invitationToken,
          orderId: order.id,
          customerId: customerId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email.toLowerCase(),
          phoneCountryCode: data.phoneCountryCode,
          phoneNumber: data.phoneNumber,
          status: 'sent',
          expiresAt: expiresAt,
          createdBy: session.user.id
        }
      });

      // Per design: OrderItems and ServicesFulfillment records are NOT created at invitation time.
      // They will be created when the candidate submits their completed application.
      // The draft order exists only to link the invitation to a future order.

      return { invitation, order };
    });

    logger.info('Candidate invitation created', {
      event: 'invitation_created',
      invitationId: result.invitation.id,
      orderId: result.order.id,
      customerId: customerId,
      createdBy: session.user.id
    });

    // Return the invitation response
    return NextResponse.json({
      id: result.invitation.id,
      token: result.invitation.token,
      firstName: result.invitation.firstName,
      lastName: result.invitation.lastName,
      email: result.invitation.email,
      expiresAt: result.invitation.expiresAt.toISOString(),
      orderId: result.order.id
    }, { status: 201 });

  } catch (error) {
    logger.error('Failed to create candidate invitation', {
      event: 'invitation_create_failure',
      error: error instanceof Error ? error.message : 'Unknown error',
      packageId: data.packageId,
      customerId: customerId
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}