// /GlobalRX_v2/src/app/api/orders/[id]/views/route.ts
// API route for GET /api/orders/[id]/views
// Phase 2A: Returns view tracking data for the current user

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';

/**
 * GET /api/orders/[id]/views
 *
 * Retrieves view tracking data for an order and its items for the current user.
 * Only customer users can retrieve view data. Admin and vendor users
 * receive a { skipped: true } response.
 *
 * Required permissions: None - but only customer users can retrieve view data
 *
 * Returns: { orderView: OrderView | null, itemViews: OrderItemView[] }
 *          or { skipped: true } for non-customers
 *
 * Errors:
 *   401: Not authenticated
 *   400: Order ID is required
 *   404: Order not found
 *   403: Customer cannot view tracking data for other companies' orders
 *   500: Failed to fetch view tracking data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const orderId = params.id;

  try {
    // Step 1: Authentication check - ALWAYS first
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Check if user is a customer - skip for non-customers
    // This must happen BEFORE any database queries per the spec
    // WHY: Admin/vendor users on stale URLs shouldn't get 404s when the order
    // exists but belongs to a different customer - they should get graceful skips
    if (session.user.userType !== 'customer') {
      // Admin and vendor users don't have view tracking
      return NextResponse.json({ skipped: true }, { status: 200 });
    }

    // Step 3: Validate order ID parameter
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Step 4: Verify customer has customerId configured
    if (!session.user.customerId) {
      logger.warn('Customer user without customerId attempted to fetch view tracking', {
        userId: session.user.id,
        orderId
      });
      return NextResponse.json(
        { error: 'Customer account not properly configured' },
        { status: 403 }
      );
    }

    // Step 5: Fetch the order to verify it exists and check ownership
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        customerId: true,
      },
    });

    // Step 6: Check if order exists
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Step 7: Check if customer can view this order's tracking data (customer-scoping)
    if (order.customerId !== session.user.customerId) {
      logger.warn('Customer attempted to fetch view tracking for order from different customer', {
        userId: session.user.id,
        userCustomerId: session.user.customerId,
        orderCustomerId: order.customerId,
        orderId
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 8: Fetch the order view record for this user and order
    const orderView = await prisma.orderView.findUnique({
      where: {
        userId_orderId: {
          userId: session.user.id,
          orderId: orderId,
        },
      },
    });

    // Step 9: Fetch all order items for this order to get their IDs
    // WHY: We need the item IDs to query for view tracking data for those specific items
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId: orderId },
      select: { id: true },
    });

    // Step 10: Fetch item view records only if there are items
    // WHY: Frontend needs both order and item view data in a single response to
    // populate all 'new' indicators without N+1 queries during page load
    let itemViews: Prisma.OrderItemViewGetPayload<{}>[] = [];
    if (orderItems.length > 0) {
      const orderItemIds = orderItems.map(item => item.id);
      itemViews = await prisma.orderItemView.findMany({
        where: {
          userId: session.user.id,
          orderItemId: {
            in: orderItemIds,
          },
        },
      });
    }

    logger.info('View tracking data fetched successfully', {
      userId: session.user.id,
      orderId,
      hasOrderView: !!orderView,
      itemViewCount: itemViews.length
    });

    // Return the view tracking data
    // orderView can be null if user has never viewed the order
    // itemViews is an array (can be empty)
    return NextResponse.json({
      orderView: orderView,
      itemViews: itemViews,
    }, { status: 200 });

  } catch (error) {
    logger.error('Failed to fetch view tracking data', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId
    });
    return NextResponse.json(
      { error: 'Failed to fetch view tracking data' },
      { status: 500 }
    );
  }
}