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
  subjectFieldValues: z.record(z.string()).optional(),
  searchFieldValues: z.record(z.record(z.string())).optional(),
  uploadedDocuments: z.record(z.object({
    fileName: z.string(),
    filePath: z.string(),
    fileSize: z.number(),
  })).optional(),
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
 *
 * Updates a draft order with service items, subject information, and field values.
 * Handles both search-level and subject-level address block persistence.
 *
 * Required permissions: Must be authenticated customer user with order ownership
 *
 * Body: {
 *   serviceItems?: Array<{serviceId, serviceName, locationId, locationName, itemId}>,
 *   subject?: SubjectInfo,
 *   subjectFieldValues?: Record<string, any>,
 *   searchFieldValues?: Record<string, Record<string, any>>,
 *   notes?: string,
 *   status?: 'draft' | 'submitted'
 * }
 *
 * Returns: Updated order object
 *
 * Business Logic:
 * - Only draft orders can be edited (enforced at database level)
 * - Address block fields are stored as JSON strings and parsed on retrieval
 * - Subject fields are stored in order_data table with fieldType: 'subject'
 * - Search fields are stored per order item with fieldType: 'search'
 * - Empty values (null, '') are preserved for optional address blocks
 *
 * Errors:
 *   401: Not authenticated or wrong user type
 *   404: Customer not found or order not found/not owned/not draft
 *   400: Invalid request data
 *   500: Server error during update
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
        const updateData: Record<string, unknown> = {};
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
                // Address Block Persistence Fix: Save all field values except undefined
                //
                // CRITICAL BUG FIX: Previously this code used:
                // if (fieldValue !== undefined && fieldValue !== null && fieldValue !== '')
                //
                // This caused optional address blocks to be lost when editing draft orders because:
                // 1. User fills out optional address block in new order
                // 2. Order saved as draft with empty/null address block fields stored
                // 3. User edits draft order - empty fields filtered out by old condition
                // 4. Address block data not restored, user loses their work
                //
                // NEW LOGIC: Only filter out undefined (field doesn't exist in form)
                // Allow null and empty strings to be saved for optional address block fields
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

          // 5. Save document metadata in order_data
          if (validatedData.uploadedDocuments) {
            // Get the first order item to associate documents with
            // Documents are typically per-case, so we associate with the first item
            const firstOrderItem = await tx.orderItem.findFirst({
              where: { orderId: params.id },
              select: { id: true }
            });

            if (firstOrderItem) {
              for (const [documentId, documentMetadata] of Object.entries(validatedData.uploadedDocuments)) {
                if (documentMetadata && typeof documentMetadata === 'object') {
                  // BUG FIX: Save document metadata as order_data with fieldType='document'
                  // CONTEXT: Documents are now uploaded immediately when selected (not when order saves)
                  // The upload endpoint returns JSON-serializable metadata, not File objects
                  // This metadata is stored in order_data to persist with draft orders
                  await tx.orderData.create({
                    data: {
                      orderItemId: firstOrderItem.id,
                      fieldName: documentId, // Use document requirement ID as field name
                      fieldValue: JSON.stringify(documentMetadata), // Store metadata as JSON
                      fieldType: 'document', // Distinguishes from regular search field data
          // Subject-Level Address Block Support:
          // Save subject field values to order_data table to preserve structured data
          //
          // FEATURE: Subject fields (like "Residence Address") must be stored separately from
          // search fields because they apply to the entire order, not individual services.
          // Address blocks are stored as JSON strings to preserve their structure (street1,
          // city, postalCode as separate properties) instead of being flattened.
          //
          // We associate these with the first order item for database design compatibility.
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