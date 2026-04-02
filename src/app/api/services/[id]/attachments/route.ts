// /GlobalRX_v2/src/app/api/services/[id]/attachments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { isTerminalStatus } from '@/types/service-results';
import type { ServiceUser } from '@/types/service-results';

/**
 * GET /api/services/[id]/attachments - List attachments for a service
 *
 * FULFILLMENT ID STANDARDIZATION: The [id] parameter is an OrderItem ID, not a Service ID.
 * This endpoint lists attachments for a specific service instance within an order.
 * The path uses "services" to align with user mental models but operates on OrderItems.
 *
 * Required permissions: fulfillment.view for internal users, or ownership for customers/vendors
 *
 * Returns: { attachments: ServiceAttachment[] }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions or no access to service
 *   404: Service not found or ServicesFulfillment not found
 *   500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderItemId } = await params;

  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as ServiceUser;

  try {
    // Fetch the service with fulfillment info
    // FULFILLMENT ID STANDARDIZATION: We lookup OrderItem by ID, then validate ServicesFulfillment exists
    // This ensures we only process attachments for services with proper fulfillment tracking
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        serviceFulfillment: true
      }
    });

    if (!orderItem) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    // FULFILLMENT ID STANDARDIZATION: We do NOT auto-create ServicesFulfillment records
    // This prevents masking data integrity issues - if fulfillment doesn't exist, something is wrong
    if (!orderItem.serviceFulfillment) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const fulfillment = orderItem.serviceFulfillment;

    // Authorization check based on user type
    if (user.userType === 'customer') {
      // Customers can view attachments for their own orders
      const order = await prisma.order.findUnique({
        where: { id: orderItem.orderId },
        select: { customerId: true }
      });

      logger.info('Customer attachment access check:', {
        userId: user.id,
        userCustomerId: user.customerId,
        orderCustomerId: order?.customerId,
        orderId: orderItem.orderId
      });

      if (!order || order.customerId !== user.customerId) {
        return NextResponse.json(
          { error: 'You can only view attachments for your own orders' },
          { status: 403 }
        );
      }
    } else if (user.userType === 'vendor') {
      // Vendors can only view attachments for their assigned services
      if (fulfillment.assignedVendorId !== user.vendorId) {
        return NextResponse.json(
          { error: 'You can only view attachments for services assigned to your vendor organization' },
          { status: 403 }
        );
      }
    } else {
      // All non-customer, non-vendor users need fulfillment.view permission
      const { hasPermission } = await import('@/lib/permission-utils');
      const hasFulfillmentView = hasPermission(user, 'fulfillment', 'view');

      if (!hasFulfillmentView) {
        logger.info('User lacks fulfillment.view permission for attachments', {
          userId: user.id,
          userType: user.userType,
          permissions: user.permissions
        });
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Fetch attachments
    const attachments = await prisma.serviceAttachment.findMany({
      where: { serviceFulfillmentId: fulfillment.id },
      orderBy: { uploadedAt: 'desc' }
    });

    // Return in the format expected by the UI
    return NextResponse.json({ attachments }, { status: 200 });

  } catch (error) {
    logger.error('Error fetching attachments:', { error, orderItemId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/services/[id]/attachments - Upload attachment for a service
 *
 * FULFILLMENT ID STANDARDIZATION: The [id] parameter is an OrderItem ID, not a Service ID.
 * This endpoint uploads attachments for a specific service instance within an order.
 *
 * Business Rules:
 * - Only PDF files allowed (max 5MB)
 * - Customers cannot upload attachments (view only)
 * - Vendors can only upload to their assigned services
 * - Internal users with fulfillment.edit can upload to any service
 * - Cannot upload to services in terminal status (completed/cancelled)
 *
 * Required permissions: fulfillment.edit for internal users, or vendor assignment for vendors
 *
 * Body: FormData with 'file' field containing PDF
 * Returns: ServiceAttachment object
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions or customers attempting upload
 *   404: Service not found or ServicesFulfillment not found
 *   400: Invalid file type or size
 *   409: Service in terminal status
 *   500: File save error or database error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderItemId } = await params;

  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as ServiceUser;

  try {
    // Check authorization first before processing file
    if (user.userType === 'customer') {
      return NextResponse.json(
        { error: 'Customers cannot upload attachments' },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type (must be PDF)
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size cannot exceed 5MB' }, { status: 400 });
    }

    // Fetch the service with fulfillment info
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        serviceFulfillment: true
      }
    });

    if (!orderItem) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    if (!orderItem.serviceFulfillment) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    const fulfillment = orderItem.serviceFulfillment;

    // Authorization check based on user type
    if (user.userType === 'vendor') {
      // Vendors can only upload to their assigned services
      if (fulfillment.assignedVendorId !== user.vendorId) {
        return NextResponse.json(
          { error: 'You can only upload attachments for services assigned to your vendor organization' },
          { status: 403 }
        );
      }
    } else {
      // All non-vendor, non-customer users need fulfillment.edit permission
      // Check using the hasPermission utility from permission-utils
      const { hasPermission } = await import('@/lib/permission-utils');
      const hasFulfillmentEdit = hasPermission(user, 'fulfillment', 'edit');

      if (!hasFulfillmentEdit) {
        logger.info('User lacks fulfillment.edit permission', {
          userId: user.id,
          userType: user.userType,
          permissions: user.permissions
        });
        return NextResponse.json({ error: 'Insufficient permissions - fulfillment.edit required' }, { status: 403 });
      }
    }

    // Check if service is in terminal status
    const currentStatus = orderItem.status;
    if (isTerminalStatus(currentStatus)) {
      return NextResponse.json(
        { error: 'Cannot upload attachments for service in terminal status' },
        { status: 409 }
      );
    }

    // Create directory structure: uploads/service-results/[order-id]/[service-id]/
    const uploadDir = path.join(
      process.cwd(),
      'uploads',
      'service-results',
      orderItem.orderId,
      orderItemId
    );

    if (!fs.existsSync(uploadDir)) {
      await fsPromises.mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename with original name preserved
    const uniqueId = randomUUID().slice(0, 8);
    const fileName = `${uniqueId}_${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    const relativePath = path.join('uploads', 'service-results', orderItem.orderId, orderItemId, fileName);

    // Save file to disk
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fsPromises.writeFile(filePath, buffer);
    } catch (error) {
      logger.error('Failed to save file:', { error, fileName });
      return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
    }

    // Save attachment record in database transaction
    const attachment = await prisma.$transaction(async (tx) => {
      // Create attachment record using UUID directly
      const newAttachment = await tx.serviceAttachment.create({
        data: {
          serviceFulfillmentId: fulfillment.id,
          fileName: file.name,
          filePath: relativePath,
          fileSize: file.size,
          uploadedBy: user.id // Now uses UUID directly
        }
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          entityType: 'service_attachment',
          entityId: newAttachment.id.toString(),
          action: 'upload',
          userId: user.id
        }
      });

      return newAttachment;
    });

    return NextResponse.json(attachment, { status: 201 });

  } catch (error) {
    logger.error('Error uploading attachment:', { error, orderItemId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}