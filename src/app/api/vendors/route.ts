/**
 * API Route: /api/vendors
 *
 * Manages vendor organizations for order fulfillment outsourcing.
 *
 * Access Control:
 * - GET: All authenticated users (filtered by user type)
 * - POST: Internal users with vendor management permissions only
 *
 * User Access Patterns:
 * - Internal users: See all vendors
 * - Vendor users: See only their assigned vendor organization
 * - Customer users: No vendor access (empty list)
 *
 * Required Permissions:
 * - GET: Any authenticated user
 * - POST: vendors.create, vendors.manage, user_admin, global_config, or customers.* permissions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createVendorOrganizationSchema } from '@/lib/schemas/vendorSchemas';
import { canUserManageVendors } from '@/lib/vendorUtils';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const activeFilter = searchParams.get('active');
    const primaryFilter = searchParams.get('primary');

    // Build where clause based on user type and query parameters
    interface VendorWhereClause {
      isActive?: boolean;
      isPrimary?: boolean;
      id?: string;
    }

    const whereClause: VendorWhereClause = {};

    if (activeFilter !== null) {
      whereClause.isActive = activeFilter === 'true';
    }

    if (primaryFilter !== null) {
      whereClause.isPrimary = primaryFilter === 'true';
    }

    let vendors;

    // Data access control based on user type - enforces vendor data isolation
    // This implements the business rule that vendor users can only see their own
    // organization's data, while internal users manage all vendors
    const userType = session.user.type || (session.user as Record<string, any>).userType;

    if (userType === 'internal' || userType === 'admin') {
      // Internal/admin users can see all vendors for management purposes
      // Results are sorted to show primary vendors first, then active vendors
      vendors = await prisma.vendorOrganization.findMany({
        where: whereClause,
        orderBy: [
          { isPrimary: 'desc' },  // Primary vendor appears first for easy identification
          { isActive: 'desc' },   // Active vendors prioritized over inactive
          { name: 'asc' }         // Alphabetical for consistency
        ]
      });
    } else if (userType === 'vendor' && session.user.vendorId) {
      // Vendor users are restricted to their own organization only
      // This enforces data isolation between vendor organizations
      const vendor = await prisma.vendorOrganization.findUnique({
        where: {
          id: session.user.vendorId,
          ...whereClause
        }
      });
      vendors = vendor ? [vendor] : [];
    } else {
      // Customer users have no access to vendor information
      // This maintains separation between customer and vendor data
      vendors = [];
    }

    return NextResponse.json(vendors, { status: 200 });

  } catch (error) {
    logger.error('Error fetching vendors', {
      event: 'vendors_fetch_error',
      userId: session.user.id,
      userType: session.user.type,
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Step 1: Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Step 2: Permission check - only internal users with admin permissions can create vendors
  logger.info('Checking vendor management permissions', {
    userId: session.user.id,
    userEmail: session.user.email,
    userType: session.user.type || session.user.userType || 'not-set',
    permissions: session.user.permissions
  });

  if (!canUserManageVendors(session.user)) {
    logger.warn('User lacks vendor management permissions', {
      userId: session.user.id,
      userType: session.user.type || session.user.userType,
      permissions: session.user.permissions
    });
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  try {
    // Step 3: Input validation
    const body = await request.json();
    const validation = createVendorOrganizationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    // Step 4: Business logic
    const vendorData = validation.data;

    // Primary vendor business rule: Only one vendor can be primary at a time
    // Primary vendors automatically receive new order assignments for fulfillment
    if (vendorData.isPrimary) {
      // Use database transaction to ensure atomicity and prevent race conditions
      // This prevents two vendors from becoming primary simultaneously
      const result = await prisma.$transaction(async (tx) => {
        // Check for existing primary within the transaction for consistency
        const existingPrimary = await tx.vendorOrganization.findFirst({
          where: { isPrimary: true }
        });

        // Business rule enforcement: Unset current primary before setting new one
        // This maintains the constraint of exactly one primary vendor
        if (existingPrimary) {
          await tx.vendorOrganization.updateMany({
            where: { isPrimary: true },
            data: { isPrimary: false }
          });
        }

        // Create the new primary vendor - it will now receive auto-assigned orders
        return tx.vendorOrganization.create({
          data: vendorData
        });
      });

      logger.info('Created new primary vendor', {
        event: 'vendor_created',
        vendorId: result.id,
        vendorName: result.name,
        isPrimary: true,
        userId: session.user.id
      });

      return NextResponse.json(result, { status: 201 });
    }

    // Create vendor normally (non-primary)
    const vendor = await prisma.vendorOrganization.create({
      data: vendorData
    });

    logger.info('Created new vendor', {
      event: 'vendor_created',
      vendorId: vendor.id,
      vendorName: vendor.name,
      isPrimary: vendor.isPrimary,
      userId: session.user.id
    });

    return NextResponse.json(vendor, { status: 201 });

  } catch (error: unknown) {
    // Handle unique constraint violations
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A vendor with this name already exists' },
        { status: 409 }
      );
    }

    logger.error('Error creating vendor', {
      event: 'vendor_create_error',
      userId: session.user.id,
      error: error instanceof Error ? error.message : 'Unknown error',
      errorCode: (error && typeof error === 'object' && 'code' in error) ? error.code : 'unknown'
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}