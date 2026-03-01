// /GlobalRX_v2/src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth.server';
import logger from '@/lib/logger';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    // Check authentication
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - support both old and new permission formats
    const perms = session.user?.permissions || {};

    // Old format checks
    const hasAdminPermission = perms.admin === true;
    const hasUserManagePermission = perms.users?.manage === true;

    // Check if user has all wildcard permissions (super admin) in old format
    const hasAllWildcards = perms.countries?.includes?.('*') &&
                            perms.services?.includes?.('*') &&
                            perms.dsx?.includes?.('*') &&
                            perms.customers?.includes?.('*');

    // New format checks - check for user_admin module permissions
    const hasUserAdminModule =
      perms.user_admin === '*' ||
      perms.user_admin === true ||
      perms.user_admin?.manage === true ||
      (Array.isArray(perms.user_admin) && perms.user_admin.includes('*'));

    // Also check for global_config as it might grant user management
    const hasGlobalConfigModule =
      perms.global_config === '*' ||
      perms.global_config === true ||
      perms.global_config?.manage === true ||
      (Array.isArray(perms.global_config) && perms.global_config.includes('*'));

    if (!hasAdminPermission && !hasUserManagePermission && !hasAllWildcards &&
        !hasUserAdminModule && !hasGlobalConfigModule) {
      return NextResponse.json({ message: 'Forbidden: Admin or user management permission required' }, { status: 403 });
    }

    const { id } = params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        userType: true,
        vendorId: true,
        customerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error: unknown) {
    logger.error('Error fetching user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    // Check authentication
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - support both old and new permission formats
    const perms = session.user?.permissions || {};

    // Old format checks
    const hasAdminPermission = perms.admin === true;
    const hasUserManagePermission = perms.users?.manage === true;

    // Check if user has all wildcard permissions (super admin) in old format
    const hasAllWildcards = perms.countries?.includes?.('*') &&
                            perms.services?.includes?.('*') &&
                            perms.dsx?.includes?.('*') &&
                            perms.customers?.includes?.('*');

    // New format checks - check for user_admin module permissions
    const hasUserAdminModule =
      perms.user_admin === '*' ||
      perms.user_admin === true ||
      perms.user_admin?.manage === true ||
      (Array.isArray(perms.user_admin) && perms.user_admin.includes('*'));

    // Also check for global_config as it might grant user management
    const hasGlobalConfigModule =
      perms.global_config === '*' ||
      perms.global_config === true ||
      perms.global_config?.manage === true ||
      (Array.isArray(perms.global_config) && perms.global_config.includes('*'));

    if (!hasAdminPermission && !hasUserManagePermission && !hasAllWildcards &&
        !hasUserAdminModule && !hasGlobalConfigModule) {
      return NextResponse.json({ message: 'Forbidden: Admin or user management permission required' }, { status: 403 });
    }

    const { id } = params;
    const body = await request.json();

    // Define validation schema for user updates
    const userUpdateSchema = z.object({
      email: z.string({ required_error: 'Email is required' }).email('Invalid email format'),
      password: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      permissions: z.record(z.union([z.boolean(), z.string(), z.array(z.string())])).optional(),
      userType: z.enum(['internal', 'vendor', 'customer']).optional(),
      vendorId: z.string().nullable().optional(),
      customerId: z.string().nullable().optional()
    }).refine(data => {
      // Validate that vendor users have vendorId
      if (data.userType === 'vendor' && !data.vendorId) {
        return false;
      }
      // Validate that customer users have customerId
      if (data.userType === 'customer' && !data.customerId) {
        return false;
      }
      // Validate that internal users don't have vendorId or customerId
      if (data.userType === 'internal' && (data.vendorId || data.customerId)) {
        return false;
      }
      return true;
    }, {
      message: 'Invalid user type and organization ID combination'
    });

    // Validate input
    const validation = userUpdateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { message: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, permissions, userType, vendorId, customerId } = validation.data;

    // Enforce vendor user permission restrictions
    if (userType === 'vendor' && permissions) {
      const vendorPermissions = Object.keys(permissions).filter(key => permissions[key] && key !== 'fulfillment');
      if (vendorPermissions.length > 0) {
        return NextResponse.json({ message: 'Vendor users can only have fulfillment permission' }, { status: 400 });
      }
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Check if the email is already used by another user
    if (email !== existingUser.email) {
      const userWithEmail = await prisma.user.findUnique({
        where: { email },
      });

      if (userWithEmail && userWithEmail.id !== id) {
        return NextResponse.json({ message: 'Email is already in use by another user' }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: {
      email: string;
      firstName: string | null;
      lastName: string | null;
      permissions: Record<string, boolean | string | string[]>;
      userType: 'internal' | 'vendor' | 'customer';
      vendorId: string | null;
      customerId: string | null;
      password?: string;
    } = {
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      permissions: permissions || {},
      userType: userType || 'internal',
      vendorId: userType === 'vendor' ? vendorId : null,
      customerId: userType === 'customer' ? customerId : null,
    };

    // Only update password if provided
    if (password) {
      updateData.password = await hashPassword(password);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        userType: true,
        vendorId: true,
        customerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: unknown) {
    logger.error('Error updating user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    // Check authentication
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - support both old and new permission formats
    const perms = session.user?.permissions || {};

    // Old format checks
    const hasAdminPermission = perms.admin === true;
    const hasUserManagePermission = perms.users?.manage === true;

    // Check if user has all wildcard permissions (super admin) in old format
    const hasAllWildcards = perms.countries?.includes?.('*') &&
                            perms.services?.includes?.('*') &&
                            perms.dsx?.includes?.('*') &&
                            perms.customers?.includes?.('*');

    // New format checks - check for user_admin module permissions
    const hasUserAdminModule =
      perms.user_admin === '*' ||
      perms.user_admin === true ||
      perms.user_admin?.manage === true ||
      (Array.isArray(perms.user_admin) && perms.user_admin.includes('*'));

    // Also check for global_config as it might grant user management
    const hasGlobalConfigModule =
      perms.global_config === '*' ||
      perms.global_config === true ||
      perms.global_config?.manage === true ||
      (Array.isArray(perms.global_config) && perms.global_config.includes('*'));

    if (!hasAdminPermission && !hasUserManagePermission && !hasAllWildcards &&
        !hasUserAdminModule && !hasGlobalConfigModule) {
      return NextResponse.json({ message: 'Forbidden: Admin or user management permission required' }, { status: 403 });
    }

    const { id } = params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    // Delete user
    await prisma.user.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    logger.error('Error deleting user:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}