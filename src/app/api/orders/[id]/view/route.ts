// /GlobalRX_v2/src/app/api/orders/[id]/view/route.ts
// API route for POST /api/orders/[id]/view
// Phase 2A: Records when customer users view orders

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * POST /api/orders/[id]/view
 *
 * Records a view event when a customer user views an order.
 * Only customer users have their views tracked. Admin and vendor users
 * receive a { skipped: true } response without any database operation.
 *
 * Required permissions: None - but only customer users have views recorded
 *
 * Body: None required
 * Returns: The created/updated OrderView record, or { skipped: true } for non-customers
 *
 * Errors:
 *   401: Not authenticated
 *   400: Order ID is required
 *   404: Order not found
 *   403: Customer cannot view orders from other companies
 *   500: Failed to record order view
 */
export async function POST(
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

    // Step 2: Check if user is a customer - skip tracking for non-customers
    // This must happen BEFORE any database queries per the spec
    if (session.user.userType !== 'customer') {
      // Admin and vendor users don't have their views tracked
      return NextResponse.json({ skipped: true }, { status: 200 });
    }

    // Step 3: Validate order ID parameter
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    // Step 4: Verify customer has customerId configured
    if (!session.user.customerId) {
      logger.warn('Customer user without customerId attempted to record order view', {
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

    // Step 7: Check if customer can view this order (customer-scoping)
    if (order.customerId !== session.user.customerId) {
      logger.warn('Customer attempted to record view for order from different customer', {
        userId: session.user.id,
        userCustomerId: session.user.customerId,
        orderCustomerId: order.customerId,
        orderId
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Step 8: Create or update the order view record using upsert
    const now = new Date();
    const orderView = await prisma.orderView.upsert({
      where: {
        userId_orderId: {
          userId: session.user.id,
          orderId: orderId,
        },
      },
      update: {
        lastViewedAt: now,
      },
      create: {
        userId: session.user.id,
        orderId: orderId,
        lastViewedAt: now,
      },
    });

    logger.info('Order view recorded successfully', {
      userId: session.user.id,
      orderId,
      viewId: orderView.id,
      isUpdate: orderView.createdAt.getTime() !== orderView.updatedAt.getTime()
    });

    // Return the order view record with timestamps in ISO format
    return NextResponse.json(orderView, { status: 200 });

  } catch (error) {
    logger.error('Failed to record order view', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId
    });
    return NextResponse.json(
      { error: 'Failed to record order view' },
      { status: 500 }
    );
  }
}