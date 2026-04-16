// /GlobalRX_v2/src/app/api/fulfillment/services/[id]/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import { ServiceAuditService } from '@/lib/services/service-audit.service';
import { ServiceOrderDataService } from '@/lib/services/service-order-data.service';
import { updateServiceFulfillmentSchema } from '@/lib/schemas/service-fulfillment.schemas';
import { getServerTranslations } from '@/lib/i18n/server-translations';
import logger from '@/lib/logger';
import type { UpdateServiceFulfillmentRequest } from '@/types/service-fulfillment';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/fulfillment/services/[id]
 *
 * Get single service detail with history and order data
 *
 * Required permissions: fulfillment.view or assigned vendor
 *
 * Returns: ServiceFulfillmentWithRelations with orderData field containing
 *          all form fields collected during order submission (excludes subject
 *          information fields that duplicate order.subject)
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   404: Service not found
 */
export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  // Get translation function
  const t = await getServerTranslations(request);

  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: t('api.errors.unauthorized') }, { status: 401 });
  }

  // Step 2: Check if service ID is provided
  if (!id) {
    return NextResponse.json({ error: t('api.errors.serviceIdRequired') }, { status: 400 });
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
      return NextResponse.json({ error: t('api.errors.forbidden') }, { status: 403 });
    }
  }

  // Vendors can only see their assigned services (checked in service layer)

  // Step 4: Fetch service
  try {
    const service = await ServiceFulfillmentService.getServiceById(
      id,
      {
        userType: userType!, // Non-null assertion: session.user validated at line 43
        vendorId: session.user.vendorId || undefined,
        customerId: session.user.customerId || undefined
      }
    );

    if (!service) {
      return NextResponse.json({ error: t('api.errors.serviceNotFound') }, { status: 404 });
    }

    // Security check: If user is a customer, verify they own this order
    if (isCustomer && session.user.customerId) {
      // The service should have been filtered by ServiceFulfillmentService
      // but we'll double-check here for security
      const order = service.order || { customerId: undefined };
      if (order.customerId && order.customerId !== session.user.customerId) {
        logger.warn('Customer attempted to access service from another customer', {
          customerId: session.user.customerId,
          orderCustomerId: order.customerId!,
          serviceId: id
        });
        return NextResponse.json({ error: t('api.errors.serviceNotFound') }, { status: 404 });
      }
    }

    // Step 5: Fetch order data for the service
    // Business Rule 1: Order data must be included for ALL service types
    // Business Rule 6: All users who can view a service can see all its order data fields
    let orderData = {};
    try {
      // Need to get the order subject for duplicate detection
      // Check if it's already included in the service response
      let orderSubject = null;

      if (service.order?.subject) {
        // Subject is already included in the service response
        orderSubject = service.order.subject;
      } else if (service.order?.id) {
        // Subject not included, need to fetch it separately
        //
        // WHY WE NEED ORDER SUBJECT:
        // The ServiceOrderDataService needs order.subject to filter out duplicate fields
        // For example: if OrderData contains "firstName" field but order.subject also has firstName,
        // we don't want to show the same information twice in the UI
        // This extra query is only needed when the service response doesn't include order.subject
        const { prisma } = await import('@/lib/prisma');
        const order = await prisma.order.findUnique({
          where: { id: service.order.id },
          select: { subject: true }
        });
        orderSubject = order?.subject;
      }

      // Business Rule 7: Order data returned as part of existing service response
      // WHY WE INCLUDE ORDER DATA:
      // - Fulfillment teams need to see exactly what information was collected for each service
      // - Different services require different data (education needs school info, employment needs employer info)
      // - This data helps vendors complete the verification process accurately
      // - Customers can see what information they provided when checking order status
      const fetchedData = await ServiceOrderDataService.getOrderDataForService(
        service.orderItemId,
        orderSubject
      );
      // Handle null return from service
      orderData = fetchedData || {};
    } catch (error) {
      // Edge Case 4: Database query fails - log error but continue with empty orderData
      //
      // WHY WE CONTINUE ON ERROR:
      // Service details page is still useful without order data
      // Users can still see service status, vendor assignment, comments, and other key information
      // Order data is supplementary - its absence shouldn't break the entire fulfillment workflow
      logger.error('Error fetching order data for service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceId: id,
        orderItemId: service.orderItemId
      });
      // Business Rule 8: If no order data exists, orderData should be empty object
      orderData = {};
    }

    // Include orderData in the response
    const responseData = {
      ...service,
      orderData
    };

    return NextResponse.json(responseData, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle vendor access denied
    if (errorMessage.includes('Access denied')) {
      return NextResponse.json({ error: t('api.errors.accessDenied') }, { status: 403 });
    }

    logger.error('Error fetching service', {
      error: errorMessage,
      serviceId: id,
      userId: session.user.id
    });
    return NextResponse.json(
      { error: t('api.errors.failedToFetchService') },
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
  const { id } = await params;

  // Get translation function
  const t = await getServerTranslations(request);

  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: t('api.errors.unauthorized') }, { status: 401 });
  }

  // Step 2: Check if service ID is provided
  if (!id) {
    return NextResponse.json({ error: t('api.errors.serviceIdRequired') }, { status: 400 });
  }

  // Step 3: Permission check
  const userType = session.user.userType;

  // Customer users cannot update fulfillment services
  if (userType === 'customer') {
    return NextResponse.json({ error: t('api.errors.insufficientPermissions') }, { status: 403 });
  }

  // Step 4: Parse and validate input
  let body;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json(
      { error: t('api.errors.invalidJsonBody') },
      { status: 400 }
    );
  }

  // Check for empty body
  if (!body || Object.keys(body).length === 0) {
    return NextResponse.json(
      { error: t('api.errors.requestBodyEmpty') },
      { status: 400 }
    );
  }
  const validation = updateServiceFulfillmentSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: t('api.errors.invalidInput'), details: validation.error.errors },
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
        { error: t('api.errors.vendorsCannotUpdateInternalNotes') },
        { status: 403 }
      );
    }
    delete updates.internalNotes;

    // Check if vendor assignment requires manage permission
    if ('assignedVendorId' in body) {
      return NextResponse.json(
        { error: t('api.errors.insufficientPermissionsToAssignVendors') },
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
        { error: t('api.errors.insufficientPermissionsToAssignVendors') },
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
        select: { id: true, name: true, isActive: true }
      });

      if (!vendor) {
        return NextResponse.json(
          { error: t('api.errors.vendorNotFound') },
          { status: 404 }
        );
      }

      if (!vendor.isActive) {
        return NextResponse.json(
          { error: t('api.errors.cannotAssignToDeactivatedVendor') },
          { status: 400 }
        );
      }
    } catch (error) {
      logger.error('Error checking vendor', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vendorId: updates.assignedVendorId
      });
      return NextResponse.json(
        { error: t('api.errors.failedToValidateVendor') },
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
      id,
      updates as UpdateServiceFulfillmentRequest,
      {
        id: session.user.id!,
        userType: userType!,
        vendorId: session.user.vendorId || undefined,
        permissions: session.user.permissions
      },
      { ipAddress: ipAddress || undefined, userAgent: userAgent || undefined }
    );

    return NextResponse.json(updatedService, { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: t('api.errors.serviceNotFound') }, { status: 404 });
    }

    if (errorMessage.includes('Forbidden')) {
      return NextResponse.json({ error: t('api.errors.forbidden') }, { status: 403 });
    }

    logger.error('Error updating service', {
      error: errorMessage,
      serviceId: id,
      userId: session.user.id
    });

    return NextResponse.json(
      { error: t('api.errors.internalServerError') },
      { status: 500 }
    );
  }
}