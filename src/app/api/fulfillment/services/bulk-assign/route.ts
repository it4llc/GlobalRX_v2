// /GlobalRX_v2/src/app/api/fulfillment/services/bulk-assign/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import { bulkAssignSchema } from '@/lib/schemas/service-fulfillment.schemas';
import logger from '@/lib/logger';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/fulfillment/services/bulk-assign
 *
 * Assign multiple services to a vendor
 *
 * Required permissions: fulfillment.manage
 *
 * Body: {
 *   serviceFulfillmentIds: string[],
 *   vendorId: string
 * }
 *
 * Returns: { updated: number }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   400: Invalid input or deactivated vendor
 *   404: Vendor not found
 */
export async function POST(request: Request) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check
  const userType = session.user.userType;

  // Customer and vendor users cannot bulk assign
  if (userType === 'customer') {
    return NextResponse.json({ error: 'Insufficient permissions - requires fulfillment.manage' }, { status: 403 });
  }

  if (userType === 'vendor') {
    return NextResponse.json({ error: 'Insufficient permissions - requires fulfillment.manage' }, { status: 403 });
  }

  // Internal users need fulfillment.manage permission
  if (userType === 'internal') {
    const hasManagePermission =
      session.user.permissions?.admin === true ||
      (typeof session.user.permissions?.fulfillment === 'object' &&
       session.user.permissions.fulfillment?.manage === true) ||
      (Array.isArray(session.user.permissions?.fulfillment) &&
       session.user.permissions.fulfillment.includes('*'));

    if (!hasManagePermission) {
      // Check if they have basic fulfillment permission but not manage
      const hasFulfillment =
        session.user.permissions?.fulfillment === true ||
        session.user.permissions?.fulfillment === '*' ||
        (typeof session.user.permissions?.fulfillment === 'object' &&
         session.user.permissions.fulfillment?.view === true);

      // They need manage permission specifically
      return NextResponse.json({ error: 'Insufficient permissions - requires fulfillment.manage' }, { status: 403 });
    }
  }

  // Admin users are allowed (already passed userType check)

  // Step 3: Parse and validate input
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const validation = bulkAssignSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 4: Perform bulk assignment (service layer handles vendor validation)
  try {
    // Get IP and user agent for audit logging
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = xForwardedFor ? xForwardedFor.split(',')[0].trim() :
                      request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const result = await ServiceFulfillmentService.bulkAssignServices(
      validation.data.serviceFulfillmentIds,
      validation.data.vendorId,
      {
        id: session.user.id,
        userType,
        permissions: session.user.permissions
      },
      { ipAddress: ipAddress || undefined, userAgent: userAgent || undefined }
    );

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle vendor not found
    if (errorMessage === 'Vendor not found' || errorMessage.includes('Vendor not found')) {
      return NextResponse.json(
        { error: 'Vendor not found' },
        { status: 404 }
      );
    }

    // Handle deactivated vendor
    if (errorMessage.includes('deactivated vendor')) {
      return NextResponse.json(
        { error: 'Cannot assign services to deactivated vendor' },
        { status: 400 }
      );
    }

    // Handle timeout errors
    if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      return NextResponse.json(
        { error: 'Request timeout' },
        { status: 504 }
      );
    }

    logger.error('Error in bulk service assignment', {
      error: errorMessage,
      vendorId: validation.data.vendorId,
      count: validation.data.serviceFulfillmentIds.length,
      userId: session.user.id
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}