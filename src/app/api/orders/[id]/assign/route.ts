// /GlobalRX_v2/src/app/api/orders/[id]/assign/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assignOrderToVendorSchema } from '@/lib/schemas/vendorSchemas';
import logger from '@/lib/logger';

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const { id } = params;

  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check - only internal users can assign orders
  if (session.user.type !== 'internal') {
    return NextResponse.json(
      { error: 'Only internal users can assign orders' },
      { status: 403 }
    );
  }

  try {
    const orderId = id;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Step 3: Input validation
    const body = await request.json();
    const validation = assignOrderToVendorSchema.safeParse({
      ...body,
      orderId
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { vendorId, assignmentNotes } = validation.data;

    // Step 4: Business logic
    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        statusCode: true,
        assignedVendorId: true
      }
    });

    if (!existingOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Check if order can be reassigned
    if (existingOrder.statusCode === 'completed') {
      return NextResponse.json(
        { error: 'Cannot reassign completed order' },
        { status: 409 }
      );
    }

    // If assigning to a vendor, validate the vendor
    if (vendorId) {
      const vendor = await prisma.vendorOrganization.findUnique({
        where: { id: vendorId },
        select: {
          id: true,
          name: true,
          isActive: true
        }
      });

      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }

      if (!vendor.isActive) {
        return NextResponse.json(
          { error: 'Cannot assign to inactive vendor' },
          { status: 400 }
        );
      }
    }

    // Perform the assignment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update the order assignment
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          assignedVendorId: vendorId,
          updatedAt: new Date()
        },
        include: {
          assignedVendor: {
            select: {
              id: true,
              name: true,
              code: true
            }
          }
        }
      });

      // Create status history entry
      let statusNotes = assignmentNotes || '';

      if (existingOrder.assignedVendorId && vendorId) {
        // Reassignment from one vendor to another
        statusNotes = `Reassigned from ${existingOrder.assignedVendorId} to ${vendorId}. ${statusNotes}`.trim();
      } else if (existingOrder.assignedVendorId && !vendorId) {
        // Reassignment from vendor to internal
        statusNotes = `Reassigned from vendor to internal team. ${statusNotes}`.trim();
      } else if (!existingOrder.assignedVendorId && vendorId) {
        // Assignment from internal to vendor
        statusNotes = `Assigned to vendor ${vendorId}. ${statusNotes}`.trim();
      } else {
        // No actual change in assignment
        statusNotes = `Assignment updated. ${statusNotes}`.trim();
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: existingOrder.statusCode,
          toStatus: existingOrder.statusCode,
          changedBy: session.user.id,
          reason: statusNotes,
          createdAt: new Date()
        }
      });

      return updatedOrder;
    });

    logger.info('Order assignment updated', {
      event: 'order_assignment_updated',
      orderId,
      fromVendorId: existingOrder.assignedVendorId,
      toVendorId: vendorId,
      assignedBy: session.user.id,
      hasNotes: !!assignmentNotes
    });

    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    logger.error('Error updating order assignment', {
      event: 'order_assignment_error',
      orderId: id,
      userId: session.user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // For debugging: return the actual error in test environment
    if (process.env.NODE_ENV === 'test') {
      return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}