// src/app/api/portal/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderService } from '@/lib/services/order.service';
import { z } from 'zod';

// Force dynamic route
export const dynamic = 'force-dynamic';

// Schema for creating an order with full order data
const createOrderSchema = z.object({
  serviceItems: z.array(z.object({
    serviceId: z.string(),
    serviceName: z.string(),
    locationId: z.string(),
    locationName: z.string(),
    itemId: z.string(),
  })),
  subject: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    middleName: z.string().optional(),
    dateOfBirth: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
  subjectFieldValues: z.record(z.any()).optional(),
  searchFieldValues: z.record(z.record(z.any())).optional(),
  uploadedDocuments: z.record(z.any()).optional(),
  notes: z.string().optional(),
  status: z.enum(['draft', 'submitted']).optional(),
});

/**
 * GET /api/portal/orders
 * Get all orders for the authenticated customer
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = session.user.customerId;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || undefined;
    const search = searchParams.get('search') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : 0;

    const { orders, total } = await OrderService.getCustomerOrders(customerId, {
      status,
      search,
      limit,
      offset,
    });

    return NextResponse.json({
      orders,
      total,
      limit,
      offset,
    });
  } catch (error) {
    logger.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/portal/orders
 * Create a new order for the authenticated customer
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const customerId = session.user.customerId;
    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const body = await request.json();

    // Validate request body
    const validatedData = createOrderSchema.parse(body);

    // Create the complete order with all data
    const orderResult = await OrderService.createCompleteOrder({
      customerId,
      userId: session.user.id,
      serviceItems: validatedData.serviceItems,
      subject: validatedData.subject,
      subjectFieldValues: validatedData.subjectFieldValues,
      searchFieldValues: validatedData.searchFieldValues,
      uploadedDocuments: validatedData.uploadedDocuments,
      notes: validatedData.notes,
      status: validatedData.status,
    });

    // Extract validation result if present
    const { validationResult, ...order } = orderResult;

    // If validation failed, include warning in response
    if (validationResult && !validationResult.isValid) {
      return NextResponse.json({
        order,
        warning: 'Order saved as draft due to missing requirements',
        missingRequirements: validationResult.missingRequirements,
        statusOverride: 'draft'
      }, { status: 201 });
    }

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}