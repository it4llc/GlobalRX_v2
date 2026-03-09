// /GlobalRX_v2/src/app/api/fulfillment/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * GET /api/fulfillment
 * Get orders for fulfillment based on user type
 *
 * For vendor users: Returns only orders assigned to their vendor
 * For internal users with fulfillment permission: Returns all orders that need fulfillment
 */
export async function GET(request: NextRequest) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Permission check - user must have fulfillment permission
    const permissions = session.user.permissions || {};
    const hasFulfillmentPermission =
      permissions.fulfillment === true ||
      permissions.fulfillment === '*' ||
      (Array.isArray(permissions.fulfillment) && permissions.fulfillment.includes('*'));

    if (!hasFulfillmentPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Step 3: Build query based on user type
    const userType = session.user.userType;
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    interface OrderWhereClause {
      assignedVendorId?: string | { not: null };
      statusCode?: string;
      OR?: Array<{
        orderNumber?: { contains: string; mode: 'insensitive' };
        subject?: { path: string[]; string_contains: string };
      }>;
    }

    let whereClause: OrderWhereClause = {};

    // Filter by vendor for vendor users
    if (userType === 'vendor' && session.user.vendorId) {
      whereClause.assignedVendorId = session.user.vendorId;

      logger.info('Vendor user fetching fulfillment orders', {
        userId: session.user.id,
        vendorId: session.user.vendorId
      });
    } else if (userType === 'internal' || userType === 'admin') {
      // Internal users can see all orders (both assigned and unassigned)
      // Previously this incorrectly filtered with assignedVendorId: { not: null }
      // which excluded unassigned orders that internal users need to manage.
      // Bug Fix (March 9, 2026): Removed vendor filter so internal/admin users
      // can see ALL orders including unassigned ones for proper fulfillment management.
      // No vendor filter needed - they manage all fulfillment

      logger.info('Internal user fetching fulfillment orders', {
        userId: session.user.id
      });
    } else {
      // Other user types shouldn't have fulfillment permission, but just in case
      return NextResponse.json({ error: 'Invalid user type for fulfillment' }, { status: 403 });
    }

    // Add status filter if provided
    if (status) {
      whereClause.statusCode = status;
    }

    // Add search filter if provided
    if (search) {
      whereClause.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { subject: { path: ['firstName'], string_contains: search } },
        { subject: { path: ['lastName'], string_contains: search } },
      ];
    }

    // Fetch orders with pagination
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
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
              service: true,
              location: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
    });

  } catch (error) {
    logger.error('Error fetching fulfillment orders', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/fulfillment
 * Update order status for fulfillment
 * Vendor users can only update orders assigned to their vendor
 */
export async function PUT(request: NextRequest) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user || !session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Permission check
    const permissions = session.user.permissions || {};
    const hasFulfillmentPermission =
      permissions.fulfillment === true ||
      permissions.fulfillment === '*' ||
      (Array.isArray(permissions.fulfillment) && permissions.fulfillment.includes('*'));

    if (!hasFulfillmentPermission) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { orderId, statusCode, notes } = body;

    if (!orderId || !statusCode) {
      return NextResponse.json(
        { error: 'Order ID and status are required' },
        { status: 400 }
      );
    }

    // Step 3: Check if order exists and user has access
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        assignedVendorId: true,
        statusCode: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Step 4: Check vendor access
    const userType = session.user.userType;
    if (userType === 'vendor' && session.user.vendorId) {
      if (order.assignedVendorId !== session.user.vendorId) {
        return NextResponse.json(
          { error: 'You can only update orders assigned to your vendor' },
          { status: 403 }
        );
      }
    }

    // Step 5: Update the order
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        statusCode,
        notes: notes || undefined,
      },
      include: {
        customer: true,
        assignedVendor: true,
      },
    });

    logger.info('Order status updated for fulfillment', {
      orderId,
      newStatus: statusCode,
      userId: session.user.id,
      vendorId: session.user.vendorId || null,
    });

    return NextResponse.json(updatedOrder);

  } catch (error) {
    logger.error('Error updating order for fulfillment', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}