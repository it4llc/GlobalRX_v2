// /GlobalRX_v2/src/app/api/fulfillment/services/[id]/history/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceAuditService } from '@/lib/services/service-audit.service';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import logger from '@/lib/logger';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/fulfillment/services/[id]/history
 *
 * Get complete audit trail for a service
 *
 * Required permissions: fulfillment.view or assigned vendor
 *
 * Query params:
 *   - limit?: number (1-100, default: 50)
 *
 * Returns: ServiceAuditLogWithUser[]
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   404: Service not found
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Check if service ID is provided
  if (!id) {
    return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
  }

  // Step 3: Permission check
  const userType = session.user.userType;

  // Customer users cannot access service history
  if (userType === 'customer') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

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
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
  }

  // Step 4: Verify service exists and vendor has access
  try {
    // Check if service exists
    const service = await ServiceFulfillmentService.getServiceById(
      id,
      {
        userType,
        vendorId: session.user.vendorId || undefined
      }
    );

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // For vendors, the service layer already checked access
    // If we got here and userType is vendor, they have access

    // Step 5: Get limit from query params
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const limitParam = searchParams.get('limit');
    let limit = 50;

    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (!isNaN(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100) {
        limit = parsedLimit;
      }
    }

    // Step 6: Fetch history
    const history = await ServiceAuditService.getHistory(id, limit);

    // Add no-cache headers for sensitive audit data
    const response = NextResponse.json(
      {
        serviceId: id,
        history,
        totalEntries: history.length
      },
      { status: 200 }
    );
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle vendor access denied
    if (errorMessage.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Handle timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    logger.error('Error fetching service history', {
      error: errorMessage,
      serviceId: id,
      userId: session.user.id
    });
    return NextResponse.json(
      { error: 'Failed to fetch service history' },
      { status: 500 }
    );
  }
}