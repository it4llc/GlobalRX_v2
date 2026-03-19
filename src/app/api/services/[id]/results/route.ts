// /GlobalRX_v2/src/app/api/services/[id]/results/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { updateResultsSchema, isTerminalStatus } from '@/types/service-results';
import type { ServiceUser } from '@/types/service-results';

// Interface for service results update data
interface ServiceResultsUpdateData {
  results: string | null;
  resultsLastModifiedBy: string;
  resultsLastModifiedAt: Date;
  resultsAddedBy?: string;
  resultsAddedAt?: Date;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const orderItemId = params.id;
  const user = session.user as ServiceUser;

  logger.info('Fetching service results:', {
    orderItemId,
    userId: user.id,
    userType: user.userType
  });

  try {
    // Fetch the service fulfillment with results
    const serviceFulfillment = await prisma.servicesFulfillment.findFirst({
      where: { orderItemId },
      include: {
        orderItem: {
          include: {
            order: {
              select: { customerId: true }
            }
          }
        },
        resultsAddedByUser: {
          select: { email: true, firstName: true, lastName: true }
        },
        resultsModifiedByUser: {
          select: { email: true, firstName: true, lastName: true }
        }
      }
    });

    if (!serviceFulfillment) {
      logger.info('No service fulfillment found for orderItemId:', { orderItemId });
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    logger.info('Service fulfillment found:', {
      orderItemId,
      hasResults: !!serviceFulfillment.results,
      resultsLength: serviceFulfillment.results?.length,
      resultsPreview: serviceFulfillment.results?.substring(0, 50),
      resultsAddedBy: serviceFulfillment.resultsAddedBy,
      resultsAddedByUser: serviceFulfillment.resultsAddedByUser
    });

    // Check permissions
    const isCustomer = user.userType === 'customer';
    const isVendor = user.userType === 'vendor';

    // Use the hasPermission utility to check for view OR edit permission
    const { hasPermission } = await import('@/lib/permission-utils');
    const hasFulfillmentView = hasPermission(user, 'fulfillment', 'view');
    const hasFulfillmentEdit = hasPermission(user, 'fulfillment', 'edit');
    const hasFulfillmentAccess = hasFulfillmentView || hasFulfillmentEdit;

    const isOwner = serviceFulfillment.orderItem.order.customerId === user.customerId;
    const isAssignedVendor = isVendor && serviceFulfillment.assignedVendorId === user.vendorId;

    logger.info('GET results permission check:', {
      userId: user.id,
      userType: user.userType,
      hasFulfillmentView,
      hasFulfillmentEdit,
      hasFulfillmentAccess,
      isOwner,
      isAssignedVendor,
      permissions: user.permissions
    });

    // Permission check - allow if user has view OR edit permission
    if (!hasFulfillmentAccess && !isOwner && !isAssignedVendor) {
      logger.warn('Access denied to service results', {
        userId: user.id,
        orderItemId,
        reason: 'No fulfillment access, not owner, not assigned vendor'
      });
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prepare response data
    // Prepare response data with user details for client consumption
    // This includes audit trail information (who added/modified results) for business compliance
    const responseData = {
      results: serviceFulfillment.results,
      resultsAddedBy: serviceFulfillment.resultsAddedByUser,
      resultsAddedAt: serviceFulfillment.resultsAddedAt,
      resultsLastModifiedBy: serviceFulfillment.resultsModifiedByUser,
      resultsLastModifiedAt: serviceFulfillment.resultsLastModifiedAt,
      assignedVendorId: serviceFulfillment.assignedVendorId,
      // Status is on OrderItem, not ServiceFulfillment (architectural decision from Phase 1)
      // This allows order items to have individual statuses while sharing fulfillment data
      status: serviceFulfillment.orderItem.status
    };

    logger.info('Returning results data:', {
      orderItemId,
      hasResults: !!responseData.results,
      resultsLength: responseData.results?.length
    });

    // Return the results data
    return NextResponse.json(responseData);
  } catch (error) {
    logger.error('Error fetching service results:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Step 1: Authentication check - ALWAYS first
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as ServiceUser;
  const { id: orderItemId } = params;

  try {
    // Parse request body
    let body;
    try {
      body = await request.json();
      logger.info('Received results update request:', { orderItemId, body });
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Step 2: Input validation
    const validation = updateResultsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Step 3: Fetch the service with fulfillment info
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        serviceFulfillment: true
      }
    });

    if (!orderItem || !orderItem.serviceFulfillment) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const fulfillment = orderItem.serviceFulfillment;

    // Step 4: Authorization check based on user type
    logger.info('Checking permissions for results update:', {
      userId: user.id,
      userType: user.userType,
      permissions: user.permissions,
      vendorId: user.vendorId,
      assignedVendorId: fulfillment.assignedVendorId
    });

    if (user.userType === 'customer') {
      // Customers cannot update results
      return NextResponse.json({ error: 'Customers cannot update results' }, { status: 403 });
    } else if (user.userType === 'vendor') {
      // Vendors can only update their assigned services
      if (fulfillment.assignedVendorId !== user.vendorId) {
        return NextResponse.json(
          { error: 'You can only update services assigned to your vendor organization' },
          { status: 403 }
        );
      }
    } else {
      // All non-customer, non-vendor users need fulfillment.edit permission
      const { hasPermission } = await import('@/lib/permission-utils');
      const hasFulfillmentEdit = hasPermission(user, 'fulfillment', 'edit');

      logger.info('Permission check result:', {
        hasFulfillmentEdit,
        userType: user.userType,
        permissions: user.permissions
      });

      if (!hasFulfillmentEdit) {
        return NextResponse.json({ error: 'Insufficient permissions - fulfillment.edit required' }, { status: 403 });
      }
    }

    // Step 5: Check if service is in terminal status
    // Get the current status from the order item
    const currentStatus = orderItem.status;
    if (isTerminalStatus(currentStatus)) {
      return NextResponse.json(
        { error: 'Cannot update results for service in terminal status' },
        { status: 409 }
      );
    }

    // Step 6: Update the results in a transaction
    const updatedFulfillment = await prisma.$transaction(async (tx) => {
      const now = new Date();

      // Prepare update data with audit trail tracking
      // We track both the initial creator and last modifier for business compliance
      const updateData: ServiceResultsUpdateData = {
        results: validation.data.results,
        resultsLastModifiedBy: user.id, // Now uses UUID directly
        resultsLastModifiedAt: now
      };

      // If this is the first time adding results, capture the original author
      // This business rule ensures we maintain an audit trail of who first entered results
      if (!fulfillment.resultsAddedBy && validation.data.results) {
        updateData.resultsAddedBy = user.id; // Now uses UUID directly
        updateData.resultsAddedAt = now;
      }

      // Update the fulfillment
      const updated = await tx.servicesFulfillment.update({
        where: { id: fulfillment.id },
        data: updateData
      });

      // Create audit log entry
      const action = !fulfillment.results && validation.data.results ? 'create' : 'update';
      await tx.auditLog.create({
        data: {
          entityType: 'service_results',
          entityId: fulfillment.id,
          action,
          userId: user.id
        }
      });

      return updated;
    });

    // Fetch the updated fulfillment with user relations for the response
    const updatedWithRelations = await prisma.servicesFulfillment.findUnique({
      where: { id: updatedFulfillment.id },
      include: {
        resultsAddedByUser: {
          select: { email: true, firstName: true, lastName: true }
        },
        resultsModifiedByUser: {
          select: { email: true, firstName: true, lastName: true }
        }
      }
    });

    // Return the updated fulfillment with user details
    return NextResponse.json({
      results: updatedWithRelations?.results,
      resultsAddedBy: updatedWithRelations?.resultsAddedByUser,
      resultsAddedAt: updatedWithRelations?.resultsAddedAt,
      resultsLastModifiedBy: updatedWithRelations?.resultsModifiedByUser,
      resultsLastModifiedAt: updatedWithRelations?.resultsLastModifiedAt
    }, { status: 200 });

  } catch (error) {
    logger.error('Error updating service results:', { error, orderItemId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}