// /GlobalRx_v2/src/app/api/portal/orders/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderService } from '@/lib/services/order.service';
import { OrderCoreService } from '@/lib/services/order-core.service';
import { SubjectInfo } from '@/components/portal/orders/types';
import { z } from 'zod';
import logger from '@/lib/logger'; // BUG FIX: Added missing logger import - was causing runtime errors when error logging attempted

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
  } catch (error: unknown) {
    logger.error('Error fetching order:', error);
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
      // Use a transaction to update the order in place
      const { prisma } = await import('@/lib/prisma');

      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 1. Verify order exists, belongs to customer, and is a draft
        const existingOrder = await tx.order.findUnique({
          where: { id: params.id },
          include: { items: { select: { id: true } } }
        });

        if (!existingOrder || existingOrder.customerId !== customerId || existingOrder.statusCode !== 'draft') {
          throw new Error('Order not found or cannot be edited');
        }

        // 2. Delete old order data and items (but NOT the order itself)
        if (existingOrder.items.length > 0) {
          // Delete order data entries for existing items
          await tx.orderData.deleteMany({
            where: {
              orderItemId: { in: existingOrder.items.map((item: { id: string }) => item.id) }
            }
          });

          // Delete services fulfillment records for existing items
          await tx.servicesFulfillment.deleteMany({
            where: {
              orderItemId: { in: existingOrder.items.map((item: { id: string }) => item.id) }
            }
          });

          // Delete existing order items
          await tx.orderItem.deleteMany({
            where: { orderId: params.id }
          });
        }

        // 3. Update the order record itself (subject, notes, status)
        const updateData: Record<string, any> = {};
        if (validatedData.subject || validatedData.subjectFieldValues) {
          // Merge basic subject with dynamic fields from DSX requirements
          // This resolves ID-based values to actual names and normalizes field names
          const normalizedSubject = await OrderCoreService.normalizeSubjectData(
            validatedData.subject || (existingOrder.subject as SubjectInfo),
            validatedData.subjectFieldValues,
            session.user.id
          );
          updateData.subject = normalizedSubject;
        }
        if (validatedData.notes !== undefined) {
          updateData.notes = validatedData.notes;
        }
        if (validatedData.status) {
          updateData.statusCode = validatedData.status;
        }

        const updatedOrder = await tx.order.update({
          where: { id: params.id },
          data: updateData,
          include: {
            customer: { select: { id: true, name: true } },
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          }
        });

        // 4. Create new order items with fulfillment records
        if (validatedData.serviceItems && validatedData.serviceItems.length > 0) {
          for (const serviceItem of validatedData.serviceItems) {
            const orderItem = await tx.orderItem.create({
              data: {
                orderId: params.id,
                serviceId: serviceItem.serviceId,
                locationId: serviceItem.locationId,
                status: 'pending',
              },
            });

            // Create ServicesFulfillment record (required 1:1 with OrderItem)
            await tx.servicesFulfillment.create({
              data: {
                orderId: params.id,
                orderItemId: orderItem.id,
                serviceId: serviceItem.serviceId,
                locationId: serviceItem.locationId,
                assignedVendorId: null,
              },
            });

            // Create order data entries for search fields
            const searchFields = validatedData.searchFieldValues?.[serviceItem.itemId];
            if (searchFields) {
              for (const [fieldName, fieldValue] of Object.entries(searchFields)) {
                // Save all field values except undefined (which means the field doesn't exist)
                // This ensures optional empty fields are saved and can be restored when editing
                // Bug fix: Previously filtered out null and empty values, causing optional address blocks to not restore
                if (fieldValue !== undefined) {
                  await tx.orderData.create({
                    data: {
                      orderItemId: orderItem.id,
                      fieldName,
                      fieldValue: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
                      fieldType: 'search',
                    },
                  });
                }
              }
            }
          }

          // Save subject field values to order_data table to preserve structured data (like address blocks)
          // This ensures address blocks aren't flattened and can be properly restored when editing
          // We store these with the first order item since subject fields apply to the entire order
          if (validatedData.subjectFieldValues && validatedData.serviceItems.length > 0) {
            // Get the first order item we just created to associate subject fields with
            const firstOrderItem = await tx.orderItem.findFirst({
              where: { orderId: params.id },
              orderBy: { createdAt: 'asc' }
            });

            if (firstOrderItem) {
              for (const [fieldId, fieldValue] of Object.entries(validatedData.subjectFieldValues)) {
                // Save all field values except undefined
                if (fieldValue !== undefined) {
                  await tx.orderData.create({
                    data: {
                      orderItemId: firstOrderItem.id,
                      fieldName: fieldId, // Store the field UUID directly
                      fieldValue: typeof fieldValue === 'string' ? fieldValue : JSON.stringify(fieldValue),
                      fieldType: 'subject', // Mark as subject field for proper restoration
                    },
                  });
                }
              }
            }
          }
        }

        return updatedOrder;
      });

      return NextResponse.json(updatedOrder);
    } else {
      // For simple updates, use the existing update method
      const order = await OrderService.updateOrder(
        params.id,
        customerId,
        validatedData
      );

      return NextResponse.json({ order });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === 'Order not found or cannot be edited') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    logger.error('Error updating order:', error);
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
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Order not found or cannot be deleted') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    logger.error('Error deleting order:', error);
    return NextResponse.json(
      { error: 'Failed to delete order' },
      { status: 500 }
    );
  }
}