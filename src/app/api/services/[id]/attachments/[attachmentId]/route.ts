// /GlobalRX_v2/src/app/api/services/[id]/attachments/[attachmentId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { isTerminalStatus } from '@/types/service-results';
import type { ServiceUser } from '@/types/service-results';
import { hasPermission } from '@/lib/permission-utils';

// GET /api/services/[id]/attachments/[attachmentId] - Download attachment
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id: orderItemId, attachmentId } = await params;

  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as ServiceUser;

  try {
    // Fetch the service with fulfillment info
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

    // Authorization check based on user type
    if (user.userType === 'customer') {
      // Customers can download attachments for their own orders
      const order = await prisma.order.findUnique({
        where: { id: orderItem.orderId },
        select: { customerId: true }
      });

      if (!order || order.customerId !== user.customerId) {
        return NextResponse.json(
          { error: 'You can only download attachments for your own orders' },
          { status: 403 }
        );
      }
    } else if (user.userType === 'vendor') {
      // Vendors can only download attachments for their assigned services
      if (fulfillment.assignedVendorId !== user.vendorId) {
        return NextResponse.json(
          { error: 'You can only download attachments for services assigned to your vendor organization' },
          { status: 403 }
        );
      }
    } else if (user.userType === 'internal' || user.userType === 'admin') {
      // Internal users need fulfillment.view permission
      const hasFulfillmentView = hasPermission(user, 'fulfillment', 'view');

      if (!hasFulfillmentView) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Validate and parse attachment ID
    const attachmentIdNum = parseInt(attachmentId);
    if (isNaN(attachmentIdNum)) {
      return NextResponse.json({ error: 'Invalid attachment ID' }, { status: 400 });
    }

    // Fetch the attachment
    const attachment = await prisma.serviceAttachment.findUnique({
      where: { id: attachmentIdNum }
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Verify attachment belongs to this service
    if (attachment.serviceFulfillmentId !== fulfillment.id) {
      return NextResponse.json(
        { error: 'Attachment not found for this service' },
        { status: 404 }
      );
    }

    // Check if file exists on disk
    const filePath = path.join(process.cwd(), attachment.filePath);
    if (!existsSync(filePath)) {
      logger.warn('Attachment file not found on disk:', { filePath, attachmentId });
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file
    let fileContent: Buffer;
    try {
      fileContent = await readFile(filePath);
    } catch (error) {
      logger.error('Failed to read attachment file:', { error, filePath });
      return NextResponse.json({ error: 'Failed to read file' }, { status: 500 });
    }

    // Return file with appropriate headers
    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${attachment.fileName}"`,
        'Content-Length': attachment.fileSize.toString()
      }
    });

  } catch (error) {
    logger.error('Error downloading attachment:', { error, orderItemId, attachmentId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/services/[id]/attachments/[attachmentId] - Delete attachment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> }
) {
  const { id: orderItemId, attachmentId } = await params;

  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as ServiceUser;

  try {
    // Check authorization first
    if (user.userType === 'customer') {
      return NextResponse.json(
        { error: 'Customers cannot delete attachments' },
        { status: 403 }
      );
    }

    // Fetch the service with fulfillment info
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

    // Authorization check based on user type
    if (user.userType === 'vendor') {
      // Vendors can only delete attachments for their assigned services
      if (fulfillment.assignedVendorId !== user.vendorId) {
        return NextResponse.json(
          { error: 'You can only delete attachments for services assigned to your vendor organization' },
          { status: 403 }
        );
      }
    } else {
      // All non-vendor, non-customer users need fulfillment.edit permission
      const hasFulfillmentEdit = hasPermission(user, 'fulfillment', 'edit');

      if (!hasFulfillmentEdit) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }

    // Check if service is in terminal status
    const currentStatus = orderItem.status;
    if (isTerminalStatus(currentStatus)) {
      return NextResponse.json(
        { error: 'Cannot delete attachments for service in terminal status' },
        { status: 409 }
      );
    }

    // Validate and parse attachment ID
    const attachmentIdNum = parseInt(attachmentId);
    if (isNaN(attachmentIdNum)) {
      return NextResponse.json({ error: 'Invalid attachment ID' }, { status: 400 });
    }

    // Fetch the attachment
    const attachment = await prisma.serviceAttachment.findUnique({
      where: { id: attachmentIdNum }
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // Verify attachment belongs to this service
    if (attachment.serviceFulfillmentId !== fulfillment.id) {
      return NextResponse.json(
        { error: 'Attachment not found for this service' },
        { status: 404 }
      );
    }

    // Delete file from disk if it exists
    const filePath = path.join(process.cwd(), attachment.filePath);
    if (existsSync(filePath)) {
      try {
        await unlink(filePath);
      } catch (error) {
        // Log error but continue with database deletion
        logger.warn('Failed to delete attachment file from disk:', { error, filePath });
      }
    }

    // Delete attachment record in database transaction
    await prisma.$transaction(async (tx) => {
      // Delete attachment record
      await tx.serviceAttachment.delete({
        where: { id: parseInt(attachmentId) }
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          entityType: 'service_attachment',
          entityId: attachmentId,
          action: 'delete',
          userId: user.id // Use string UUID for audit log
        }
      });
    });

    return NextResponse.json(
      { success: true, message: 'Attachment deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    logger.error('Error deleting attachment:', { error, orderItemId, attachmentId });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}