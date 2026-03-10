// /GlobalRX_v2/src/app/api/fulfillment/services/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import { serviceQuerySchema } from '@/lib/schemas/service-fulfillment.schemas';
import logger from '@/lib/logger';

/**
 * GET /api/fulfillment/services
 *
 * List services based on permissions
 *
 * Required permissions: fulfillment.view or vendor with vendorId
 *
 * Query params:
 *   - orderId?: string (UUID)
 *   - status?: 'pending' | 'submitted' | 'processing' | 'completed' | 'cancelled'
 *   - vendorId?: string (UUID)
 *   - limit?: number (1-100, default: 50)
 *   - offset?: number (min: 0, default: 0)
 *
 * Returns: { services: ServiceFulfillmentWithRelations[], total: number, limit: number, offset: number }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   400: Invalid query parameters
 */
export async function GET(request: Request) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check
  const userType = session.user.userType;

  // BUG FIX (March 9, 2026): Allow customers to view services for their own orders
  // as part of unified dashboard implementation
  const isCustomer = userType === 'customer';

  // Internal users need fulfillment permission
  if (userType === 'internal') {
    const hasFulfillmentPermission =
      session.user.permissions?.admin === true ||
      session.user.permissions?.fulfillment === true ||
      session.user.permissions?.fulfillment === '*' ||
      (typeof session.user.permissions?.fulfillment === 'object' &&
       session.user.permissions.fulfillment?.view === true) ||
      (Array.isArray(session.user.permissions?.fulfillment) &&
       session.user.permissions.fulfillment.includes('*'));

    if (!hasFulfillmentPermission) {
      return NextResponse.json({ error: 'Insufficient permissions to view services' }, { status: 403 });
    }
  }

  // Vendors can see their assigned services (checked in service layer)

  // Step 3: Validate query parameters
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const queryParams = {
    orderId: searchParams.get('orderId') || undefined,
    status: searchParams.get('status') || undefined,
    vendorId: searchParams.get('vendorId') || undefined,
    limit: searchParams.get('limit') || undefined,
    offset: searchParams.get('offset') || undefined,
  };

  const validation = serviceQuerySchema.safeParse(queryParams);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 4: Fetch services
  try {
    const { services, total, limit, offset } = await ServiceFulfillmentService.getServices(
      {
        userType,
        vendorId: session.user.vendorId || undefined,
        customerId: session.user.customerId || undefined,
        permissions: session.user.permissions
      },
      validation.data
    );

    // Add no-cache headers for sensitive data
    const response = NextResponse.json({
      services,
      total,
      limit,
      offset
    }, { status: 200 });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    logger.error('Error fetching services', {
      error: errorMessage,
      userId: session.user.id
    });

    return NextResponse.json(
      { error: 'Failed to fetch services' },
      { status: 500 }
    );
  }
}