// /GlobalRX_v2/src/app/api/fulfillment/services/[id]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import { ServiceAuditService } from '@/lib/services/service-audit.service';
import { updateServiceFulfillmentSchema } from '@/lib/schemas/service-fulfillment.schemas';
import logger from '@/lib/logger';

interface RouteParams {
  params: {
    id: string;
  };
}

/**
 * GET /api/fulfillment/services/[id]
 *
 * Get single service detail with history
 *
 * Required permissions: fulfillment.view or assigned vendor
 *
 * Returns: ServiceFulfillmentWithRelations
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   404: Service not found
 */
export async function GET(request: Request, { params }: RouteParams) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Check if service ID is provided
  if (!params.id) {
    return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
  }

  // Step 3: Permission check
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  // Vendors can only see their assigned services (checked in service layer)

  // Step 4: Fetch service
  try {
    const service = await ServiceFulfillmentService.getServiceById(
      params.id,
      {
        userType,
        vendorId: session.user.vendorId || undefined,
        customerId: session.user.customerId || undefined
      }
    );

    if (!service) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json(service, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle vendor access denied
    if (errorMessage.includes('Access denied')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    logger.error('Error fetching service', {
      error: errorMessage,
      serviceId: params.id,
      userId: session.user.id
    });
    return NextResponse.json(
      { error: 'Failed to fetch service' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/fulfillment/services/[id]
 *
 * Update service fulfillment record
 *
 * Required permissions: fulfillment.manage or assigned vendor (limited fields)
 *
 * Body: {
 *   status?: 'pending' | 'submitted' | 'processing' | 'completed' | 'cancelled',
 *   assignedVendorId?: string | null,
 *   vendorNotes?: string,
 *   internalNotes?: string
 * }
 *
 * Returns: ServiceFulfillment
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   404: Service not found
 *   400: Invalid input
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Check if service ID is provided
  if (!params.id) {
    return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
  }

  // Step 3: Permission check
  const userType = session.user.userType;

  // Customer users cannot update fulfillment services
  if (userType === 'customer') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Step 4: Parse and validate input
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  // Check for empty body
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json(
      { error: 'Request body cannot be empty' },
      { status: 400 }
    );
  }
  const validation = updateServiceFulfillmentSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validation.error.errors },
      { status: 400 }
    );
  }

  // Step 5: Apply permission-based restrictions
  const updates = { ...validation.data };
  const isVendor = userType === 'vendor';

  // Check if vendor is trying to update restricted fields
  if (isVendor) {
    // Vendors cannot update internal notes
    if ('internalNotes' in body) {
      return NextResponse.json(
        { error: 'Vendors cannot update internal notes' },
        { status: 403 }
      );
    }
    delete updates.internalNotes;

    // Check if vendor assignment requires manage permission
    if ('assignedVendorId' in body) {
      return NextResponse.json(
        { error: 'Insufficient permissions to assign vendors' },
        { status: 403 }
      );
    }
    delete updates.assignedVendorId;
  }

  // Internal users need manage permission for vendor assignment
  if (userType === 'internal' && 'assignedVendorId' in body) {
    const hasManagePermission =
      session.user.permissions?.admin === true ||
      session.user.permissions?.fulfillment === true ||
      session.user.permissions?.fulfillment === '*' ||
      (typeof session.user.permissions?.fulfillment === 'object' &&
       (session.user.permissions.fulfillment?.manage === true ||
        session.user.permissions.fulfillment?.edit === true)) ||
      (Array.isArray(session.user.permissions?.fulfillment) &&
       session.user.permissions.fulfillment.includes('*'));

    if (!hasManagePermission) {
      return NextResponse.json(
        { error: 'Insufficient permissions to assign vendors' },
        { status: 403 }
      );
    }
  }

  // Step 6: Check vendor status if assigning
  if (updates.assignedVendorId) {
    try {
      const { prisma } = await import('@/lib/prisma');
      const vendor = await prisma.vendorOrganization.findUnique({
        where: { id: updates.assignedVendorId },
        select: { id: true, name: true, deactivated: true }
      });

      if (!vendor) {
        return NextResponse.json(
          { error: 'Vendor not found' },
          { status: 404 }
        );
      }

      if (vendor.deactivated) {
        return NextResponse.json(
          { error: 'Cannot assign to deactivated vendor' },
          { status: 400 }
        );
      }
    } catch (error) {
      logger.error('Error checking vendor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vendorId: updates.assignedVendorId
      });
      return NextResponse.json(
        { error: 'Failed to validate vendor' },
        { status: 500 }
      );
    }
  }

  // Step 7: Update service
  try {
    // Get IP and user agent for audit logging
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const ipAddress = xForwardedFor ? xForwardedFor.split(',')[0].trim() :
                      request.headers.get('x-real-ip') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const updatedService = await ServiceFulfillmentService.updateService(
      params.id,
      updates,
      {
        id: session.user.id,
        userType,
        vendorId: session.user.vendorId || undefined,
        permissions: session.user.permissions
      },
      { ipAddress: ipAddress || undefined, userAgent: userAgent || undefined }
    );

    return NextResponse.json(updatedService, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('not found')) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    if (errorMessage.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    logger.error('Error updating service', {
      error: errorMessage,
      serviceId: params.id,
      userId: session.user.id
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}