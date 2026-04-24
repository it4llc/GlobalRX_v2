// /GlobalRX_v2/src/lib/services/candidate-invitation.service.ts

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { INVITATION_STATUSES } from '@/constants/invitation-status';
import { ORDER_EVENT_TYPES } from '@/constants/order-event-type';
import type { CreateInvitationInput, InvitationResponse } from '@/types/candidateInvitation';
import type { CandidateInvitation, Workflow } from '@prisma/client';

/**
 * Service for handling all candidate invitation business logic
 * Keeping API routes thin by centralizing logic here
 */

/**
 * Generates a cryptographically secure random token for invitations
 * Returns a URL-safe base64 string
 */
export function generateSecureToken(): string {
  // Generate 32 bytes of random data for sufficient entropy
  const bytes = crypto.randomBytes(32);
  // Convert to URL-safe base64 (replacing + with -, / with _, removing =)
  return bytes.toString('base64url');
}

/**
 * Creates a new candidate invitation with order and logs the event
 * Handles all business rules including package validation, workflow checks, and token generation
 */
export async function createInvitation(
  input: CreateInvitationInput,
  customerId: string,
  userId: string
): Promise<CandidateInvitation> {
  // Step 1: Look up the package and verify it belongs to the customer
  const pkg = await prisma.package.findFirst({
    where: {
      id: input.packageId,
      customerId
    },
    include: {
      workflow: true
    }
  });

  if (!pkg) {
    throw new Error('Package not found or does not belong to this customer');
  }

  // Step 2: Verify the package has an active workflow
  if (!pkg.workflow) {
    throw new Error('This package does not have a workflow assigned. A workflow with email template and expiration settings is required to create an invitation.');
  }

  if (pkg.workflow.status !== 'active') {
    throw new Error('The workflow assigned to this package is not active.');
  }

  // Step 3: Get the workflow's expiration days (default to 14 if not set)
  const expirationDays = pkg.workflow.expirationDays || 14;
  if (!pkg.workflow.expirationDays) {
    logger.warn('Workflow has no expirationDays set, using default', {
      workflowId: pkg.workflow.id,
      defaultDays: 14
    });
  }

  // Step 4: Generate a unique token with collision checking (retry up to 3 times)
  let token: string = '';
  let retries = 0;
  const maxRetries = 3;

  while (retries < maxRetries) {
    const candidateToken = generateSecureToken();

    // Check for collision
    const existing = await prisma.candidateInvitation.findUnique({
      where: { token: candidateToken }
    });

    if (!existing) {
      token = candidateToken;
      break;
    }

    retries++;
    logger.warn('Token collision detected, regenerating', {
      attempt: retries,
      maxAttempts: maxRetries
    });
  }

  if (!token) {
    logger.error('Failed to generate unique token after maximum retries', {
      maxRetries
    });
    throw new Error('Failed to generate unique invitation token. Please try again.');
  }

  // Step 5: Calculate expiration date
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expirationDays);

  // Step 6: Generate order number in format YYYYMMDD-CODE-NNNN
  // First, get the customer code for the order number
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true }
  });

  const customerCode = customer?.name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3) || 'XXX';

  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // Get the count of orders for this customer today for the sequence number
  const ordersToday = await prisma.order.count({
    where: {
      customerId,
      createdAt: {
        gte: new Date(today.setHours(0, 0, 0, 0)),
        lt: new Date(today.setHours(23, 59, 59, 999))
      }
    }
  });

  const sequence = (ordersToday + 1).toString().padStart(4, '0');
  const orderNumber = `${dateStr}-${customerCode}-${sequence}`;

  // Step 7: Create everything in a transaction
  const result = await prisma.$transaction(async (tx) => {
    // Create the order in draft status
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        userId,
        statusCode: 'draft',
        subject: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email.toLowerCase()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Create the candidate invitation
    const invitation = await tx.candidateInvitation.create({
      data: {
        orderId: order.id,
        customerId,
        token,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(), // Normalize email to lowercase
        phoneCountryCode: input.phoneCountryCode || null,
        phoneNumber: input.phoneNumber || null,
        status: INVITATION_STATUSES.SENT,
        expiresAt,
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    // Log the invitation created event
    await tx.orderStatusHistory.create({
      data: {
        order: { connect: { id: order.id } },
        fromStatus: null, // Not a status change
        toStatus: 'draft', // Order was created in draft status
        user: { connect: { id: userId } },
        eventType: ORDER_EVENT_TYPES.INVITATION_CREATED,
        message: `Candidate invitation created for ${input.firstName} ${input.lastName} (${input.email.toLowerCase()})`,
        isAutomatic: false,
        createdAt: new Date()
      }
    });

    return invitation;
  });

  logger.info('Candidate invitation created', {
    invitationId: result.id,
    orderId: result.orderId,
    customerId,
    email: result.email
  });

  return result;
}

/**
 * Looks up an invitation by token, checks expiration, and updates status if expired
 */
export async function lookupByToken(token: string): Promise<InvitationResponse | null> {
  // Find the invitation by token
  const invitation = await prisma.candidateInvitation.findUnique({
    where: { token }
  });

  if (!invitation) {
    return null;
  }

  // Check if the invitation has expired
  const now = new Date();
  if (invitation.expiresAt < now && invitation.status !== INVITATION_STATUSES.EXPIRED) {
    // Update status to expired, saving the previous status
    await prisma.$transaction(async (tx) => {
      await tx.candidateInvitation.update({
        where: { id: invitation.id },
        data: {
          previousStatus: invitation.status,
          status: INVITATION_STATUSES.EXPIRED,
          updatedAt: new Date()
        }
      });

      // Log the expiration event
      await tx.orderStatusHistory.create({
        data: {
          order: { connect: { id: invitation.orderId } },
          fromStatus: null,
          toStatus: null,
          user: { connect: { id: invitation.createdBy } }, // System action, use creator as the actor
          eventType: ORDER_EVENT_TYPES.INVITATION_EXPIRED,
          message: 'Invitation has expired',
          isAutomatic: true,
          createdAt: new Date()
        }
      });
    });

    // Update the invitation object to reflect the change
    invitation.status = INVITATION_STATUSES.EXPIRED;
  }

  // Return invitation data without sensitive fields
  const response: InvitationResponse = {
    id: invitation.id,
    orderId: invitation.orderId,
    customerId: invitation.customerId,
    firstName: invitation.firstName,
    lastName: invitation.lastName,
    email: invitation.email,
    phoneCountryCode: invitation.phoneCountryCode,
    phoneNumber: invitation.phoneNumber,
    status: invitation.status,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt,
    createdBy: invitation.createdBy,
    completedAt: invitation.completedAt,
    lastAccessedAt: invitation.lastAccessedAt
  };

  return response;
}

/**
 * Extends an invitation's expiration date
 */
export async function extendInvitation(
  invitationId: string,
  customerId: string,
  userId: string,
  days?: number
): Promise<CandidateInvitation> {
  // Step 1: Find the invitation and verify ownership
  const invitation = await prisma.candidateInvitation.findFirst({
    where: {
      id: invitationId,
      customerId
    },
    include: {
      order: {
        include: {
          customer: {
            include: {
              packages: {
                where: {
                  workflowId: {
                    not: null
                  }
                },
                include: {
                  workflow: true
                },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  if (!invitation) {
    throw new Error('Invitation not found or does not belong to this customer');
  }

  // Step 2: Check if invitation is completed (cannot extend completed invitations)
  if (invitation.status === INVITATION_STATUSES.COMPLETED) {
    throw new Error('Cannot extend a completed invitation');
  }

  // Step 3: Determine extension days
  let extensionDays = days;
  if (!extensionDays) {
    // Look up workflow default, cap at 15
    const workflow = invitation.order.customer.packages[0]?.workflow;
    extensionDays = workflow?.expirationDays || 14;
    if (extensionDays > 15) {
      extensionDays = 15;
    }
  }

  // Step 4: Calculate new expiration date from today
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + extensionDays);

  // Step 5: Update the invitation
  const updatedInvitation = await prisma.$transaction(async (tx) => {
    // Determine the new status
    let newStatus = invitation.status;
    if (invitation.status === INVITATION_STATUSES.EXPIRED && invitation.previousStatus) {
      // Restore previous status if extending from expired
      newStatus = invitation.previousStatus;
    }

    const updated = await tx.candidateInvitation.update({
      where: { id: invitationId },
      data: {
        expiresAt: newExpiresAt,
        status: newStatus,
        previousStatus: invitation.status === INVITATION_STATUSES.EXPIRED ? invitation.previousStatus : null,
        updatedAt: new Date()
      }
    });

    // Log the extension event
    await tx.orderStatusHistory.create({
      data: {
        order: { connect: { id: invitation.orderId } },
        fromStatus: null,
        toStatus: null,
        user: { connect: { id: userId } },
        eventType: ORDER_EVENT_TYPES.INVITATION_EXTENDED,
        message: `Invitation extended by ${extensionDays} days`,
        isAutomatic: false,
        createdAt: new Date()
      }
    });

    return updated;
  });

  logger.info('Invitation extended', {
    invitationId,
    extensionDays,
    newExpiresAt
  });

  return updatedInvitation;
}

/**
 * Resends an invitation email (logs the event, actual email sending is future phase)
 */
export async function resendInvitation(
  invitationId: string,
  customerId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  // Step 1: Find the invitation and verify ownership
  const invitation = await prisma.candidateInvitation.findFirst({
    where: {
      id: invitationId,
      customerId
    }
  });

  if (!invitation) {
    throw new Error('Invitation not found or does not belong to this customer');
  }

  // Step 2: Verify status is sent or opened
  if (invitation.status !== INVITATION_STATUSES.SENT && invitation.status !== INVITATION_STATUSES.OPENED) {
    if (invitation.status === INVITATION_STATUSES.EXPIRED) {
      throw new Error('Cannot resend an expired invitation. Please extend it first.');
    }
    throw new Error('Invitation cannot be resent in its current status');
  }

  // Step 3: Log the resend event
  await prisma.orderStatusHistory.create({
    data: {
      order: { connect: { id: invitation.orderId } },
      fromStatus: null,
      toStatus: null,
      user: { connect: { id: userId } },
      eventType: ORDER_EVENT_TYPES.INVITATION_RESENT,
      message: `Invitation resent to ${invitation.email}`,
      isAutomatic: false,
      createdAt: new Date()
    }
  });

  logger.info('Invitation resent', {
    invitationId,
    email: invitation.email
  });

  // Note: Actual email sending will be implemented in a future phase
  return {
    success: true,
    message: 'Invitation has been resent'
  };
}

/**
 * Helper function to log order events
 * Used by other service functions to maintain consistent event logging
 */
export async function logOrderEvent(
  orderId: string,
  eventType: string,
  message: string,
  userId: string,
  isAutomatic: boolean = false
): Promise<void> {
  await prisma.orderStatusHistory.create({
    data: {
      order: { connect: { id: orderId } },
      fromStatus: null,
      toStatus: null,
      user: { connect: { id: userId } },
      eventType,
      message,
      isAutomatic,
      createdAt: new Date()
    }
  });
}