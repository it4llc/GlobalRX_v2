// src/app/api/portal/orders/draft/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderService } from '@/lib/services/order.service';

// Force dynamic route
export const dynamic = 'force-dynamic';

/**
 * POST /api/portal/orders/draft
 * Save an order as draft
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

    // Validate required fields for draft
    if (!body.items || body.items.length === 0) {
      return NextResponse.json(
        { error: 'At least one item is required' },
        { status: 400 }
      );
    }

    // Validate that we have subject information
    if (!body.subject || !body.subject.firstName || !body.subject.lastName) {
      return NextResponse.json(
        { error: 'Subject information (first name and last name) is required' },
        { status: 400 }
      );
    }

    // Create the order with draft status
    const order = await OrderService.createOrder({
      customerId,
      userId: session.user.id,
      subject: body.subject,
      notes: body.notes || 'Draft order',
    });

    return NextResponse.json(order);
  } catch (error) {
    console.error('Error saving draft order:', error);
    return NextResponse.json(
      { error: 'Failed to save draft order' },
      { status: 500 }
    );
  }
}