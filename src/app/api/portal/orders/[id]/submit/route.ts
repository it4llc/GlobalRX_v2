// src/app/api/portal/orders/[id]/submit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { OrderService } from '@/lib/services/order.service';

// Force dynamic route
export const dynamic = 'force-dynamic';

/**
 * POST /api/portal/orders/[id]/submit
 * Submit a draft order
 */
export async function POST(
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

    const [updatedOrder] = await OrderService.submitOrder(
      params.id,
      customerId,
      session.user.id
    );

    return NextResponse.json({
      message: 'Order submitted successfully',
      order: updatedOrder,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Order not found or already submitted') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    logger.error('Error submitting order:', error);
    return NextResponse.json(
      { error: 'Failed to submit order' },
      { status: 500 }
    );
  }
}