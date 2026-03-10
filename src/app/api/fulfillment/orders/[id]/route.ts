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
 * Retrieves full order details for all user types with appropriate filtering
 *
 * BUG FIX (March 9, 2026): Extended to support customer and vendor users as part of
 * unified dashboard implementation. All user types now use /fulfillment page and this
 * endpoint with appropriate security filtering.
 *
 * Access control:
 *   - Internal users: Need fulfillment, candidate_workflow, or admin permissions - can view any order
 *   - Customer users: Can only view their own orders (filtered by customerId)
 *   - Vendor users: Can only view orders assigned to them (filtered by assignedVendorId)
 *
 * Returns: Full order details with appropriate filtering based on user type
 *
 * Errors:
 *   - 400: Order ID is required
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Order not found or access denied
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

    // Step 3: Check user type - allow internal, vendor, and customer users
    const userType = session.user.userType;
    const isCustomer = userType === 'customer';
    const isVendor = userType === 'vendor';
    const isInternal = userType === 'internal';

    // Customers and vendors can access this endpoint (with appropriate filtering later)
    if (!isInternal && !isCustomer && !isVendor) {
      logger.warn('Invalid user type attempted to access fulfillment order endpoint', {
        userId: session.user.id,
        userType,
        orderId,
        actualUserType: userType
      });
      return NextResponse.json(
        { error: 'Invalid user type for this endpoint' },
        { status: 403 }
      );
    }

    // Step 4: Check permissions
    // Customers can always view their own orders (will be filtered below)
    // Vendors and internal users need specific permissions
    const permissions = session.user.permissions || {};

    logger.info('Checking fulfillment order access', {
      userId: session.user.id,
      userType,
      permissions,
      orderId
    });

    if (!isCustomer) {
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
        logger.warn('User lacks required permissions for fulfillment order access', {
          userId: session.user.id,
          userType,
          permissions,
          orderId
        });
        return NextResponse.json(
          { error: 'Insufficient permissions to view order details' },
          { status: 403 }
        );
      }
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
            serviceFulfillment: {
              select: {
                id: true,
                status: true,
                assignedVendorId: true,
                vendorNotes: true,
                internalNotes: true,
                assignedAt: true,
                assignedBy: true,
                completedAt: true,
              },
            },
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

    // Step 6: Security check - customers can only view their own orders
    if (isCustomer) {
      if (order.customerId !== session.user.customerId) {
        logger.warn('Customer attempted to view order from different customer', {
          userId: session.user.id,
          customerId: session.user.customerId,
          orderCustomerId: order.customerId,
          orderId
        });
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
    }

    // Vendors can only view orders assigned to them
    if (isVendor) {
      if (order.assignedVendorId !== session.user.vendorId) {
        logger.warn('Vendor attempted to view unassigned order', {
          userId: session.user.id,
          vendorId: session.user.vendorId,
          orderVendorId: order.assignedVendorId,
          orderId
        });
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }
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