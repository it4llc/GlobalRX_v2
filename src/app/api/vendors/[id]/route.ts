// /GlobalRX_v2/src/app/api/vendors/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateVendorOrganizationSchema } from '@/lib/schemas/vendorSchemas';
import { canUserManageVendors } from '@/lib/vendorUtils';
import logger from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const vendorId = params.id;

    const vendor = await prisma.vendorOrganization.findUnique({
      where: { id: vendorId }
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Check access permissions
    if (session.user.type === 'vendor') {
      // Vendor users can only access their own vendor
      if (session.user.vendorId !== vendorId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (session.user.type === 'customer') {
      // Customer users cannot access vendor details
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // Internal users can access all vendors

    return NextResponse.json(vendor, { status: 200 });

  } catch (error) {
    logger.error('Error fetching vendor', {
      event: 'vendor_fetch_error',
      vendorId: params.id,
      userId: session.user.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check
  if (!canUserManageVendors(session.user)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const vendorId = params.id;

    // Check if vendor exists
    const existingVendor = await prisma.vendorOrganization.findUnique({
      where: { id: vendorId }
    });

    if (!existingVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Step 3: Input validation
    const body = await request.json();
    const validation = updateVendorOrganizationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Step 4: Business logic
    const updateData = validation.data;

    // If setting as primary, we need to unset other primary vendors
    if (updateData.isPrimary === true) {
      const result = await prisma.$transaction(async (tx) => {
        // Unset all other primary vendors
        await tx.vendorOrganization.updateMany({
          where: {
            isPrimary: true,
            id: { not: vendorId }
          },
          data: { isPrimary: false }
        });

        // Update this vendor
        return tx.vendorOrganization.update({
          where: { id: vendorId },
          data: updateData
        });
      });

      logger.info('Updated vendor as primary', {
        event: 'vendor_updated',
        vendorId,
        isPrimary: true,
        userId: session.user.id
      });

      return NextResponse.json(result, { status: 200 });
    }

    // Update vendor normally
    const vendor = await prisma.vendorOrganization.update({
      where: { id: vendorId },
      data: updateData
    });

    logger.info('Updated vendor', {
      event: 'vendor_updated',
      vendorId,
      updatedFields: Object.keys(updateData),
      userId: session.user.id
    });

    return NextResponse.json(vendor, { status: 200 });

  } catch (error) {
    logger.error('Error updating vendor', {
      event: 'vendor_update_error',
      vendorId: params.id,
      userId: session.user.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check
  if (!canUserManageVendors(session.user)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    const vendorId = params.id;

    // Check if vendor exists
    const existingVendor = await prisma.vendorOrganization.findUnique({
      where: { id: vendorId }
    });

    if (!existingVendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    // Check if vendor has assigned orders
    const assignedOrdersCount = await prisma.order.count({
      where: { assignedVendorId: vendorId }
    });

    if (assignedOrdersCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete vendor with assigned orders' },
        { status: 409 }
      );
    }

    // Check if vendor has associated users
    const vendorUsersCount = await prisma.user.count({
      where: { vendorId }
    });

    if (vendorUsersCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete vendor with associated users' },
        { status: 409 }
      );
    }

    // Delete vendor
    await prisma.vendorOrganization.delete({
      where: { id: vendorId }
    });

    logger.info('Deleted vendor', {
      event: 'vendor_deleted',
      vendorId,
      vendorName: existingVendor.name,
      userId: session.user.id
    });

    return NextResponse.json(
      { message: 'Vendor deleted successfully' },
      { status: 200 }
    );

  } catch (error) {
    logger.error('Error deleting vendor', {
      event: 'vendor_delete_error',
      vendorId: params.id,
      userId: session.user.id,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}