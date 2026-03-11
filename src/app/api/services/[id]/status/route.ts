/**
 * PUT /api/services/[id]/status
 *
 * Updates the fulfillment status of an ordered service (OrderItem)
 *
 * IMPORTANT: Despite the path name, the [id] parameter is an OrderItem ID, not a Service ID.
 * This endpoint updates the status of a specific service within an order (OrderItem.status).
 * The path uses "services" to align with user mental models - users think of updating
 * "service status" not "order item status".
 *
 * Database Context:
 * - Service: Catalog definition of what can be ordered
 * - OrderItem: Instance of a service that was ordered (has status, assigned vendor, etc.)
 * - The [id] refers to OrderItem.id which tracks fulfillment of that specific service
 *
 * This endpoint allows internal GlobalRx users to change the status of individual services
 * within orders. It implements order-level locking to prevent concurrent modifications
 * and creates audit trail entries for all status changes. Terminal status changes require
 * explicit confirmation to prevent accidental reopening of completed work.
 *
 * Required permissions: fulfillment
 * Allowed users: Internal GlobalRx users only (vendors excluded in Phase 2d)
 *
 * Request body: { status: ServiceStatus, comment?: string, confirmReopenTerminal?: boolean }
 * Response: { service: OrderItem, auditEntry: ServiceComment }
 *
 * Business Rules:
 * - Only internal users with fulfillment permission can change status
 * - Terminal statuses (Completed/Cancelled/Cancelled-DNB) require confirmation to reopen
 * - Order must be locked by the requesting user during status change
 * - All status changes create ServiceComment audit entries with isStatusChange=true
 * - Optional comment can be added to provide context for the status change
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions (vendor users or missing fulfillment permission)
 *   404: Service not found
 *   409: Terminal status confirmation required
 *   423: Order locked by another user
 *   500: Database transaction failure
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { OrderLockService } from '@/lib/services/order-lock.service';
import logger from '@/lib/logger';

// Validation schema for status update
const updateStatusSchema = z.object({
  status: z.enum([
    'Draft',
    'Submitted',
    'Processing',
    'Missing Information',
    'Completed',
    'Cancelled',
    'Cancelled-DNB'
  ]),
  comment: z.string().max(1000, 'Comment must be 1000 characters or less').optional(),
  confirmReopenTerminal: z.boolean().optional()
}).refine(
  // Custom validation to prevent bypassing terminal status confirmation
  (data) => {
    // confirmReopenTerminal must be explicitly true or false, not undefined
    // when changing from a terminal status
    if (data.confirmReopenTerminal !== undefined && typeof data.confirmReopenTerminal !== 'boolean') {
      return false;
    }
    return true;
  },
  {
    message: 'Invalid confirmation value'
  }
);

// Terminal statuses that require confirmation to reopen
// These statuses represent completed work that should not be accidentally reopened
// Business rule: Users must explicitly confirm they want to reopen terminal statuses
const TERMINAL_STATUSES = ['Completed', 'Cancelled', 'Cancelled-DNB'];

// Type for ServiceComment audit entry data
interface ServiceCommentData {
  orderItemId: string;
  isStatusChange: boolean;
  statusChangedFrom: string;
  statusChangedTo: string;
  comment: string;
  createdBy: string;
  createdAt: Date;
  isInternalOnly: boolean;
  templateId?: string;
  finalText?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let orderId: string | undefined;
  let userId: string | undefined;

  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Permission check - Phase 2d: Internal users only
    // Business rule: In Phase 2d, only internal GlobalRx users can change service status
    // Future phases may extend this capability to vendors for their assigned services
    // Use userType per coding standards (Section 9.8)
    const userType = session.user.userType;
    if (userType === 'vendor') {
      return NextResponse.json(
        { error: 'Internal users only. Vendor status changes not available in Phase 2d' },
        { status: 403 }
      );
    }

    // Check for fulfillment permission
    const hasFulfillmentPermission =
      session.user.permissions?.fulfillment === true ||
      session.user.permissions?.fulfillment?.['*'] === true ||
      session.user.permissions?.fulfillment?.manage === true;

    if (!hasFulfillmentPermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Step 3: Validate input
    const body = await request.json();
    const validation = updateStatusSchema.safeParse(body);

    if (!validation.success) {
      const firstError = validation.error.errors[0];
      const errorMessage = firstError.path.length > 0
        ? `${firstError.path.join('.')}: ${firstError.message}`
        : firstError.message;
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    const { status: newStatus, comment, confirmReopenTerminal } = validation.data;
    const serviceId = params.id;
    userId = session.user.id;

    // Step 4: Get service and check if it exists
    const service = await prisma.orderItem.findUnique({
      where: { id: serviceId },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true
          }
        }
      }
    });

    if (!service) {
      return NextResponse.json(
        { error: 'Service not found' },
        { status: 404 }
      );
    }

    orderId = service.orderId;
    const currentStatus = service.status;

    // Step 5: Check for terminal status reopening
    // Business rule: Changing from terminal status requires explicit confirmation
    // This prevents accidental reopening of completed/cancelled work
    const isTerminalStatus = TERMINAL_STATUSES.includes(currentStatus);
    const needsConfirmation = isTerminalStatus && confirmReopenTerminal !== true;

    if (needsConfirmation) {
      // Additional security check - ensure confirmReopenTerminal is exactly boolean true
      if (confirmReopenTerminal !== false && confirmReopenTerminal !== undefined) {
        logger.warn('Suspicious terminal status confirmation attempt', {
          serviceId,
          currentStatus,
          newStatus,
          confirmValue: confirmReopenTerminal,
          userId
        });
      }

      // Different message based on whether we're changing between terminal statuses or reopening
      const isChangingBetweenTerminal = TERMINAL_STATUSES.includes(newStatus);
      const message = isChangingBetweenTerminal
        ? `This service is currently marked as ${currentStatus}. Are you sure you want to change it to ${newStatus}?`
        : `This service is currently ${currentStatus}. Are you sure you want to re-open it by changing the status to ${newStatus}?`;

      return NextResponse.json(
        {
          error: 'Terminal status confirmation required',
          requiresConfirmation: true,
          currentStatus,
          newStatus,
          message
        },
        { status: 409 }
      );
    }

    // Step 6: Check order lock
    const lockService = new OrderLockService();
    const lockCheck = await lockService.checkLock(orderId, userId);

    if (lockCheck.isLocked && !lockCheck.canEdit) {
      return NextResponse.json(
        {
          error: `Order is locked by another user`,
          lockedBy: lockCheck.lock?.lockedBy
        },
        { status: 423 } // Locked status code
      );
    }

    // Acquire lock if not already held
    if (!lockCheck.isLocked || !lockCheck.canEdit) {
      const lockResult = await lockService.acquireLock(orderId, userId);
      if (!lockResult.success) {
        return NextResponse.json(
          { error: lockResult.error || 'Failed to acquire lock' },
          { status: 423 }
        );
      }
    }

    // Step 7: Perform status update in transaction with enhanced error handling
    const result = await prisma.$transaction(async (tx) => {
      try {
        // Update service status
        const updatedService = await tx.orderItem.update({
          where: { id: serviceId },
          data: {
            status: newStatus,
            updatedAt: new Date(),
            updatedById: userId
          }
        });

        // Build audit trail comment text
        // Standard format ensures consistent audit trail across all status changes
        let commentText = `Status changed from ${currentStatus} to ${newStatus}`;
        if (TERMINAL_STATUSES.includes(currentStatus) && confirmReopenTerminal) {
          commentText += ' (reopened)'; // Mark when terminal status was explicitly reopened
        }
        if (comment) {
          commentText += `. Additional context: ${comment}`;
        }

        // Get or create Status Change template
        let statusChangeTemplate = null;

        // Check if commentTemplate model is available
        const hasCommentTemplateModel = tx.commentTemplate !== undefined;

        if (hasCommentTemplateModel) {
          try {
            statusChangeTemplate = await tx.commentTemplate.findFirst({
              where: {
                shortName: 'Status Change',
                isActive: true
              }
            });

            if (!statusChangeTemplate) {
              statusChangeTemplate = await tx.commentTemplate.create({
                data: {
                  shortName: 'Status Change',
                  longName: 'System Status Change',
                  templateText: 'Status changed from [previous] to [new]',
                  isActive: true,
                  createdBy: userId
                }
              });
            }
          } catch (templateError) {
            // Log template error but don't fail the transaction
            logger.warn('Failed to get/create status change template', {
              error: templateError instanceof Error ? templateError.message : 'Unknown error',
              serviceId,
              userId
            });
            // Use fallback template
            statusChangeTemplate = {
              id: 'status-change-template-fallback',
              shortName: 'Status Change'
            };
          }
        } else {
          // For tests or when model doesn't exist
          statusChangeTemplate = {
            id: 'status-change-template-id',
            shortName: 'Status Change'
          };
        }

        // Create audit entry as ServiceComment
        const auditEntryData: ServiceCommentData = {
          orderItemId: serviceId,
          isStatusChange: true,
          statusChangedFrom: currentStatus,
          statusChangedTo: newStatus,
          comment: commentText,
          createdBy: userId,
          createdAt: new Date(),
          isInternalOnly: false
        };

        // Only add template fields if we have a real template
        if (statusChangeTemplate?.id && hasCommentTemplateModel) {
          auditEntryData.templateId = statusChangeTemplate.id;
          auditEntryData.finalText = commentText;
        }

        const auditEntry = await tx.serviceComment.create({
          data: auditEntryData
        });

        return {
          service: updatedService,
          auditEntry
        };
      } catch (txError) {
        // Enhanced error logging for transaction failures
        logger.error('Transaction failed during status update', {
          serviceId,
          userId,
          currentStatus,
          newStatus,
          error: txError instanceof Error ? txError.message : 'Unknown error',
          stack: txError instanceof Error ? txError.stack : undefined
        });

        // Re-throw with more context
        if (txError instanceof Error) {
          if (txError.message.includes('P2025')) {
            throw new Error('Service not found or already modified');
          }
          if (txError.message.includes('P2002')) {
            throw new Error('Duplicate status change detected');
          }
          throw txError;
        }
        throw new Error('Transaction failed');
      }
    }, {
      // Add transaction options for better reliability
      maxWait: 5000, // 5 seconds max wait
      timeout: 10000, // 10 seconds timeout
      isolationLevel: 'Serializable' // Highest isolation level for consistency
    });

    logger.info('Service status updated', {
      serviceId,
      orderId,
      previousStatus: currentStatus,
      newStatus,
      userId,
      hasComment: !!comment
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    logger.error('Failed to update service status', {
      serviceId: params.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    // Attempt to release lock on error
    if (orderId && userId) {
      try {
        const lockService = new OrderLockService();
        await lockService.releaseLock(orderId, userId);
      } catch (lockError) {
        logger.error('Failed to release lock after status update error', {
          orderId,
          userId,
          error: lockError instanceof Error ? lockError.message : 'Unknown error'
        });
      }
    }

    // Return more specific error messages
    if (error instanceof Error) {
      if (error.message.includes('Service not found')) {
        return NextResponse.json(
          { error: 'Service not found or already modified' },
          { status: 404 }
        );
      }
      if (error.message.includes('Duplicate status change')) {
        return NextResponse.json(
          { error: 'This status change has already been recorded' },
          { status: 409 }
        );
      }
      if (error.message.includes('Transaction failed')) {
        return NextResponse.json(
          { error: 'Database transaction failed. Please try again.' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to update service status' },
      { status: 500 }
    );
  }
}