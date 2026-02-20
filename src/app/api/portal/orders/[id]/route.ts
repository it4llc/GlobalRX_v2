// src/app/api/portal/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderService } from '@/lib/services/order.service';
import { z } from 'zod';

// Force dynamic route
export const dynamic = 'force-dynamic';

// Schema for updating an order - now supports full order updates
const updateOrderSchema = z.object({
  serviceItems: z.array(z.object({
    serviceId: z.string(),
    serviceName: z.string(),
    locationId: z.string(),
    locationName: z.string(),
    itemId: z.string(),
  })).optional(),
  subject: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    middleName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }).optional(),
  subjectFieldValues: z.record(z.any()).optional(),
  searchFieldValues: z.record(z.record(z.any())).optional(),
  uploadedDocuments: z.record(z.any()).optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'submitted']).optional(),
});

/**
 * GET /api/portal/orders/[id]
 * Get a specific order by ID
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = session.user.customerId;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const order = await OrderService.getOrderById(params.id, customerId);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/portal/orders/[id]
 * Update a draft order
 */
export async function PUT(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = session.user.customerId;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = updateOrderSchema.parse(body);

    // For full order updates (with service items), use the comprehensive update method
    if (validatedData.serviceItems || validatedData.subjectFieldValues || validatedData.searchFieldValues) {
      // First get the existing order to preserve the order number
      const existingOrder = await OrderService.getOrderById(params.id, customerId);
      if (!existingOrder) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      }

      // Use a transaction to delete the old order and create the updated one
      const { prisma } = await import('@/lib/prisma');

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // First get all order items for this order
        const orderItems = await tx.orderItem.findMany({
          where: { orderId: params.id },
          select: { id: true }
        });

        // Delete related order data entries for each order item
        if (orderItems.length > 0) {
          await tx.orderData.deleteMany({
            where: {
              orderItemId: {
                in: orderItems.map(item => item.id)
              }
            }
          });
        }

        // Delete related order items
        await tx.orderItem.deleteMany({
          where: { orderId: params.id }
        });

        // Delete the old order
        await tx.order.delete({
          where: { id: params.id }
        });

        // Create the updated order with the same order number
        return OrderService.createCompleteOrder({
          customerId,
          userId: session.user.id,
          serviceItems: validatedData.serviceItems || [],
          subject: validatedData.subject || {},
          subjectFieldValues: validatedData.subjectFieldValues,
          searchFieldValues: validatedData.searchFieldValues,
          uploadedDocuments: validatedData.uploadedDocuments,
          notes: validatedData.notes,
          status: validatedData.status,
        });
      });

      return NextResponse.json(updatedOrder);
    } else {
      // For simple updates, use the existing update method
      const order = await OrderService.updateOrder(
        params.id,
        customerId,
        validatedData
      );

      return NextResponse.json(order);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Order not found or cannot be edited') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/portal/orders/[id]
 * Delete a draft order
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const params = await context.params;
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = session.user.customerId;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    await OrderService.deleteOrder(params.id, customerId);

    return NextResponse.json({ message: 'Order deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found or cannot be deleted') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}