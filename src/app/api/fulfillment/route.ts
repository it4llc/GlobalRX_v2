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

    // Step 2: Permission check - user must have fulfillment permission OR be a customer
    const permissions = session.user.permissions || {};
    const userType = session.user.userType;
    const hasFulfillmentPermission =
      permissions.fulfillment === true ||
      permissions.fulfillment === '*' ||
      (Array.isArray(permissions.fulfillment) && permissions.fulfillment.includes('*'));

    // Allow customer users to access their own orders
    const isCustomerUser = userType === 'customer' && session.user.customerId;

    if (!hasFulfillmentPermission && !isCustomerUser) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Step 3: Build query based on user type
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    interface OrderWhereClause {
      assignedVendorId?: string | { not: null };
      customerId?: string;
      statusCode?: string;
      OR?: Array<{
        orderNumber?: { contains: string; mode: 'insensitive' };
        subject?: { path: string[]; string_contains: string };
      }>;
    }

    let whereClause: OrderWhereClause = {};

    // Filter by customer for customer users
    if (userType === 'customer' && session.user.customerId) {
      whereClause.customerId = session.user.customerId;

      logger.info('Customer user fetching fulfillment orders', {
        userId: session.user.id,
        customerId: session.user.customerId
      });
    // Filter by vendor for vendor users
    } else if (userType === 'vendor' && session.user.vendorId) {
      whereClause.assignedVendorId = session.user.vendorId;

      logger.info('Vendor user fetching fulfillment orders', {
        userId: session.user.id,
        vendorId: session.user.vendorId
      });
    } else if (userType === 'internal' || userType === 'admin') {
      // Internal users can see all orders (both assigned and unassigned)
      //
      // BUG FIX DOCUMENTATION (March 9, 2026):
      // Original problem: Internal/admin users were incorrectly filtered to only see
      // orders with `assignedVendorId: { not: null }`, which excluded unassigned orders.
      //
      // Business Impact: Internal users could NOT see unassigned orders in the fulfillment
      // dashboard, preventing them from assigning orders to vendors - a critical workflow failure.
      //
      // Root Cause: Line filtering logic assumed internal users should only see assigned orders,
      // but this breaks the fulfillment workflow where internal users MUST see unassigned
      // orders to manage vendor assignments.
      //
      // Solution: Removed the vendor filter entirely for internal/admin users. They now see
      // ALL orders (assigned and unassigned) which is the correct business requirement.
      // Only vendor users should have their orders filtered by vendor assignment.
      //
      // Technical Details: Previously had `whereClause.assignedVendorId = { not: null }`
      // which was logically incorrect for internal users who manage ALL fulfillment.

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
            // CRITICAL: Always order by service name then creation time to prevent
            // services from changing display order when their status is updated.
            // Without explicit ordering, Prisma returns results in undefined order
            // which caused UI instability when services moved around after status updates.
            orderBy: [
              { service: { name: 'asc' } },
              { createdAt: 'asc' }
            ],
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

    // Calculate the 3 required dashboard stats
    // BUG FIX: Dashboard stats now correctly reflect user-appropriate data
    //
    // Previous Issue: Dashboard showed wrong number of cards (5 for internal/vendor, 4 for customers)
    // and inconsistent statistics across different user types.
    //
    // Business Requirement: ALL user types should see exactly 3 cards:
    // 1. Total Orders - count of orders the user can see
    // 2. Total Services - count of all order items across those orders
    // 3. In Progress - orders not in terminal states (draft/completed/cancelled)
    //
    // We need to fetch ALL orders (without pagination) for accurate stats
    const allOrders = await prisma.order.findMany({
      where: whereClause,
      include: {
        items: true,
      },
    });

    // 1. Total Orders - count of all orders visible to this user type
    const totalOrders = allOrders.length;

    // 2. Total Services - count of all OrderItems across all visible orders
    const totalServices = allOrders.reduce((sum, order) => sum + order.items.length, 0);

    // 3. In Progress - orders NOT in terminal states (Draft, Completed, or Cancelled)
    // This matches the frontend filter logic for consistent user experience
    const inProgress = allOrders.filter(
      order => order.statusCode !== 'draft' &&
               order.statusCode !== 'completed' &&
               order.statusCode !== 'cancelled'
    ).length;

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
      stats: {
        totalOrders,
        totalServices,
        inProgress,
      },
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