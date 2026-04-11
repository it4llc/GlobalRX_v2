// /GlobalRX_v2/src/app/api/services/[id]/comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceCommentService } from '@/services/service-comment-service';
import { createServiceCommentSchema } from '@/lib/validations/service-comment';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * POST /api/services/[id]/comments
 *
 * Creates a new comment for an ordered service (OrderItem)
 *
 * IMPORTANT: Despite the path name, the [id] parameter is an OrderItem ID, not a Service ID.
 * Comments are attached to specific instances of ordered services (OrderItems), not to the
 * service catalog definitions. The path uses "services" to align with user mental models -
 * users think of commenting on "services" not "order items".
 *
 * Database Context:
 * - Service: Catalog definition (e.g., "Background Check")
 * - OrderItem: Specific instance of that service in an order (e.g., "Background Check for John Doe")
 * - ServiceComment: Comments attached to the OrderItem, tracking fulfillment communication
 * - The [id] refers to OrderItem.id
 *
 * Required permissions: fulfillment
 *
 * Body: { templateId: string, finalText: string, isInternalOnly?: boolean }
 * Returns: ServiceComment object with relations
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions or no access to service
 *   400: Invalid input or business logic error
 *   404: Service not found
 *   500: Server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderItemId } = await params;

  try {
    // Step 1: Authentication check - ALWAYS first
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Check fulfillment permission
    const userPermissions = session.user.permissions || {};
    const hasFulfillmentPermission =
      userPermissions.fulfillment === true ||
      (Array.isArray(userPermissions.fulfillment) && userPermissions.fulfillment.includes('*')) ||
      (userPermissions.fulfillment && typeof userPermissions.fulfillment === 'object');

    if (!hasFulfillmentPermission) {
      return NextResponse.json({ error: 'You do not have permission to add comments' }, { status: 403 });
    }

    // Step 3: Validate user has access to the service
    const service = new ServiceCommentService();
    // User type must be explicitly set - do not default
    if (!session.user.userType) {
      logger.error('User type not set for user', { userId: session.user.id });
      return NextResponse.json({ error: 'User type not configured. Please contact support.' }, { status: 403 });
    }

    // Verify ServicesFulfillment exists for this OrderItem
    // FULFILLMENT ID STANDARDIZATION: params.id is now consistently an OrderItem ID
    // We validate that ServicesFulfillment exists for this OrderItem because:
    // 1. Comments are stored against OrderItem but fulfillment tracking requires ServicesFulfillment
    // 2. We do NOT auto-create missing ServicesFulfillment records to avoid masking data integrity issues
    // 3. This ensures only services with proper fulfillment setup can receive comments
    const serviceFulfillment = await prisma.servicesFulfillment.findUnique({
      where: { orderItemId: orderItemId },
      select: { orderItemId: true }
    });

    if (!serviceFulfillment) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const hasAccess = await service.validateUserAccess(
      orderItemId,
      session.user.id,
      session.user.userType
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this service' }, { status: 403 });
    }

    // Step 4: Validate input - supports full text editing (no bracket validation)
    const body = await request.json();
    const validation = createServiceCommentSchema.safeParse(body);

    if (!validation.success) {
      logger.error('Comment validation failed', {
        body,
        errors: validation.error.errors,
        serviceId: orderItemId
      });
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      const field = validation.error.errors[0]?.path[0];

      // Return specific error messages for known validation issues
      // Note: No bracket validation errors because brackets are treated as regular text
      if (field === 'templateId' && errorMessage.includes('Invalid')) {
        return NextResponse.json({ error: 'Invalid template ID format' }, { status: 400 });
      }
      if (field === 'finalText' && errorMessage.includes('empty')) {
        return NextResponse.json({ error: 'Comment text cannot be empty' }, { status: 400 });
      }
      if (field === 'finalText' && errorMessage.includes('1000')) {
        return NextResponse.json({ error: 'Comment text cannot exceed 1000 characters' }, { status: 400 });
      }

      return NextResponse.json({
        error: field ? `${field}: ${errorMessage}` : errorMessage,
        details: validation.error.errors
      }, { status: 400 });
    }

    // Step 5: Create the comment using the OrderItem ID
    const userType = (session.user.userType || 'internal') as 'customer' | 'internal' | 'vendor';
    const comment = await service.createComment(
      orderItemId,
      validation.data,
      session.user.id,
      userType
    );

    // Transform the response to match expected format
    const response = {
      id: comment.id,
      orderItemId: comment.orderItemId,
      templateId: comment.templateId,
      finalText: comment.finalText,
      isInternalOnly: comment.isInternalOnly,
      createdBy: comment.createdBy,
      createdAt: comment.createdAt.toISOString(),
      updatedBy: comment.updatedBy,
      updatedAt: comment.updatedAt ? comment.updatedAt.toISOString() : null,
      template: {
        shortName: comment.template.shortName,
        longName: comment.template.longName
      },
      createdByUser: {
        name: `${comment.createdByUser.firstName || ''} ${comment.createdByUser.lastName || ''}`.trim() || comment.createdByUser.email,
        email: comment.createdByUser.email
      }
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message === 'Service not found') {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      if (error.message === 'Invalid template ID') {
        return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
      }
      if (error.message === 'Selected template is no longer active') {
        return NextResponse.json({ error: 'Selected template is no longer active' }, { status: 400 });
      }
      if (error.message === 'Template not available for this service type and status') {
        return NextResponse.json({ error: 'Template not available for this service type and status' }, { status: 400 });
      }
      if (error.message.includes('Comment text')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    logger.error('Error creating service comment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      serviceId: orderItemId
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
