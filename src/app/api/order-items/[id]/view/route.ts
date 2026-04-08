// /GlobalRX_v2/src/app/api/order-items/[id]/view/route.ts
// API route for POST /api/order-items/[id]/view
// Phase 2A: Records when customer users view order items

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * POST /api/order-items/[id]/view
 *
 * Records a view event when a customer user views an order item.
 * Only customer users have their views tracked. Admin and vendor users
 * receive a { skipped: true } response without any database operation.
 *
 * Required permissions: None - but only customer users have views recorded
 *
 * Body: None required
 * Returns: The created/updated OrderItemView record, or { skipped: true } for non-customers
 *
 * Errors:
 *   401: Not authenticated
 *   400: Order item ID is required
 *   404: Order item not found or parent order not found
 *   403: Customer cannot view items from other companies' orders
 *   500: Failed to record order item view
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderItemId = params.id;

  try {
    // Step 1: Authentication check - ALWAYS first
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Check if user is a customer - skip tracking for non-customers
    // This must happen BEFORE any database queries per the spec
    if (session.user.userType !== 'customer') {
      // Admin and vendor users don't have their views tracked
      return NextResponse.json({ skipped: true }, { status: 200 });
    }

    // Step 3: Validate order item ID parameter
    if (!orderItemId) {
      return NextResponse.json({ error: 'Order item ID is required' }, { status: 400 });
    }

    // Step 4: Verify customer has customerId configured
    if (!session.user.customerId) {
      logger.warn('Customer user without customerId attempted to record order item view', {
        userId: session.user.id,
        orderItemId
      });
      return NextResponse.json(
        { error: 'Customer account not properly configured' },
        { status: 403 }
      );
    }

    // Step 5: Fetch the order item to verify it exists and get parent order
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: {
        id: true,
        orderId: true,
      },
    });

    // Step 6: Check if order item exists
    if (!orderItem) {
      return NextResponse.json({ error: 'Order item not found' }, { status: 404 });
    }

    // Step 7: Fetch the parent order to check ownership
    const order = await prisma.order.findUnique({
      where: { id: orderItem.orderId },
      select: {
        id: true,
        customerId: true,
      },
    });

    // Step 8: Check if parent order exists
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Step 9: Check if customer can view this order item (customer-scoping)
    if (order.customerId !== session.user.customerId) {
      logger.warn('Customer attempted to record view for item from different customer order', {
        userId: session.user.id,
        userCustomerId: session.user.customerId,
        orderCustomerId: order.customerId,
        orderItemId,
        orderId: order.id
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 10: Create or update the order item view record using upsert
    const now = new Date();
    const orderItemView = await prisma.orderItemView.upsert({
      where: {
        userId_orderItemId: {
          userId: session.user.id,
          orderItemId: orderItemId,
        },
      },
      update: {
        lastViewedAt: now,
      },
      create: {
        userId: session.user.id,
        orderItemId: orderItemId,
        lastViewedAt: now,
      },
    });

    logger.info('Order item view recorded successfully', {
      userId: session.user.id,
      orderItemId,
      orderId: order.id,
      viewId: orderItemView.id,
      isUpdate: orderItemView.createdAt.getTime() !== orderItemView.updatedAt.getTime()
    });

    // Return the order item view record with timestamps in ISO format
    return NextResponse.json(orderItemView, { status: 200 });

  } catch (error) {
    logger.error('Failed to record order item view', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderItemId
    });
    return NextResponse.json(
      { error: 'Failed to record order item view' },
      { status: 500 }
    );
  }
}