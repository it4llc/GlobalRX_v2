// /GlobalRX_v2/src/app/api/fulfillment/orders/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderService } from '@/lib/services/order.service';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * GET /api/fulfillment/orders/[id]
 *
 * Retrieves full order details for internal users with fulfillment or candidate_workflow permissions
 *
 * BUG FIX: This endpoint was created to fix a 401 error where internal users with fulfillment
 * permission couldn't view order details from the fulfillment page. The root cause was that
 * the fulfillment page incorrectly used /api/portal/orders/[id] which only allows customer
 * users. This endpoint allows internal users to access full order details including customer
 * information that portal users cannot see.
 *
 * Required permissions: internal user type AND (fulfillment OR candidate_workflow OR admin)
 *
 * Returns: Full order details including customer information
 *
 * Errors:
 *   - 400: Order ID is required
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions (not internal user or lacks required permissions)
 *   - 404: Order not found
 *   - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Step 1: Authentication check - ALWAYS first
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Validate order ID parameter
    const orderId = params.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Step 3: Check user type - must be internal
    const userType = session.user.userType;
    if (userType !== 'internal') {
      logger.warn('Non-internal user attempted to access fulfillment order endpoint', {
        userId: session.user.id,
        userType,
        orderId,
        actualUserType: userType,
        sessionUser: JSON.stringify(session.user)
      });
      return NextResponse.json(
        { error: 'This endpoint is for internal users only' },
        { status: 403 }
      );
    }

    // Step 4: Check permissions - must have fulfillment, candidate_workflow, or admin
    const permissions = session.user.permissions || {};

    logger.info('Checking fulfillment order access', {
      userId: session.user.id,
      userType,
      permissions,
      orderId
    });

    // Check for required permissions using different permission formats
    const hasFulfillmentPermission =
      permissions.fulfillment === true ||
      permissions.fulfillment === '*' ||  // Handle wildcard permission
      permissions.fulfillment?.view === true ||
      (typeof permissions.fulfillment === 'object' && permissions.fulfillment !== null) ||
      (Array.isArray(permissions) && permissions.includes('fulfillment')) ||
      (Array.isArray(permissions.fulfillment) && permissions.fulfillment.includes('*')) ||
      (typeof permissions === 'string' && permissions === 'fulfillment');

    const hasCandidateWorkflowPermission =
      permissions.candidate_workflow === true ||
      permissions.candidate_workflow === '*' ||  // Handle wildcard permission
      permissions.candidate_workflow?.view === true ||
      (typeof permissions.candidate_workflow === 'object' && permissions.candidate_workflow !== null) ||
      (Array.isArray(permissions) && permissions.includes('candidate_workflow')) ||
      (Array.isArray(permissions.candidate_workflow) && permissions.candidate_workflow.includes('*')) ||
      (typeof permissions === 'string' && permissions === 'candidate_workflow');

    const hasAdminPermission =
      permissions.admin === true ||
      session.user.role === 'superadmin';

    if (!hasFulfillmentPermission && !hasCandidateWorkflowPermission && !hasAdminPermission) {
      logger.warn('Internal user lacks required permissions for fulfillment order access', {
        userId: session.user.id,
        permissions,
        orderId
      });
      return NextResponse.json(
        { error: 'Insufficient permissions to view order details' },
        { status: 403 }
      );
    }

    // Step 5: Fetch order details
    logger.info('Attempting to fetch order details', { orderId, userId: session.user.id });

    // Use direct Prisma query instead of OrderService for now
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            disabled: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedVendor: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            service: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
              },
            },
            location: {
              select: {
                id: true,
                name: true,
                code2: true,
              },
            },
            data: true,
            documents: true,
          },
        },
        statusHistory: {
          include: {
            user: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      logger.warn('Order not found', { orderId, userId: session.user.id });
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    logger.info('Successfully fetched order', { orderId, userId: session.user.id });

    // Step 6: Return order with cache prevention headers for sensitive data
    const response = NextResponse.json(order, { status: 200 });

    // Set cache prevention headers for sensitive data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;

  } catch (error) {
    const errorDetails = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      orderId: params.id,
      userId: (await getServerSession(authOptions))?.user?.id
    };

    logger.error('Error fetching order for fulfillment', errorDetails);

    // Return more detailed error in development
    const isDevelopment = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      {
        error: 'Failed to fetch order',
        ...(isDevelopment && { details: errorDetails.message })
      },
      { status: 500 }
    );
  }
}