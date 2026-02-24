// src/app/api/customers/[id]/users/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth.server';
import { z } from 'zod';

// Validation schema for updating a customer user
const customerUserUpdateSchema = z.object({
  email: z.string().email("Invalid email address").optional(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  permissions: z.object({
    orders: z.object({
      view: z.boolean().optional(),
      create: z.boolean().optional(),
      edit: z.boolean().optional(),
    }).optional(),
    users: z.object({
      manage: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

/**
 * Check if a user has permission for a specific resource and action
 */
function hasPermission(user: any, resource: string, action?: string): boolean {
  if (!user?.permissions) return false;

  // Admin users have full access
  if (user.permissions.admin === true) return true;

  // Check array-based permissions
  if (Array.isArray(user.permissions[resource])) {
    return user.permissions[resource].includes('*');
  }

  // Check object-based permissions
  if (typeof user.permissions[resource] === 'object' && action) {
    return !!user.permissions[resource][action];
  }

  return !!user.permissions[resource];
}

/**
 * @route PUT /api/customers/[id]/users/[userId]
 * @desc Update a customer user
 * @access Private - Requires customers.edit permission or being a customer user with user management permission
 */
export async function PUT(
  request: NextRequest,
  context: { params: { id: string; userId: string } }
) {
  try {
    // Get params safely
    const params = await context.params;
    const { id: customerId, userId } = params;

    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const isAdmin = session.user.userType === 'admin';
    const isCustomerWithUserManagement =
      session.user.userType === 'customer' &&
      session.user.customerId === customerId &&
      session.user.permissions?.users?.manage === true;

    if (isAdmin && !hasPermission(session.user, 'customers', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isAdmin && !isCustomerWithUserManagement) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify the user exists and belongs to this customer
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        customerId: true,
        userType: true,
        email: true
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existingUser.userType !== 'customer' || existingUser.customerId !== customerId) {
      return NextResponse.json({ error: 'User does not belong to this customer' }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = customerUserUpdateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { email, firstName, lastName, password, permissions } = validationResult.data;

    // Check if email is being changed and if it's already in use
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email },
      });

      if (emailInUse) {
        return NextResponse.json(
          { error: 'Email is already in use' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: any = {};

    if (email !== undefined) updateData.email = email;
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (permissions !== undefined) updateData.permissions = permissions;

    // Hash password if provided
    if (password) {
      updateData.password = await hashPassword(password);
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        createdAt: true,
        userType: true,
        lastLoginAt: true,
        mfaEnabled: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: unknown) {
    logger.error(`Error in PUT /api/customers/${params.id}/users/${params.userId}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while updating the user' },
      { status: 500 }
    );
  }
}

/**
 * @route DELETE /api/customers/[id]/users/[userId]
 * @desc Delete a customer user
 * @access Private - Requires customers.edit permission or being a customer user with user management permission
 */
export async function DELETE(
  request: NextRequest,
  context: { params: { id: string; userId: string } }
) {
  try {
    // Get params safely
    const params = await context.params;
    const { id: customerId, userId } = params;

    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    const isAdmin = session.user.userType === 'admin';
    const isCustomerWithUserManagement =
      session.user.userType === 'customer' &&
      session.user.customerId === customerId &&
      session.user.permissions?.users?.manage === true;

    if (isAdmin && !hasPermission(session.user, 'customers', 'edit')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isAdmin && !isCustomerWithUserManagement) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Prevent users from deleting themselves
    if (session.user.id === userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
    }

    // Verify the user exists and belongs to this customer
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        customerId: true,
        userType: true
      },
    });

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (existingUser.userType !== 'customer' || existingUser.customerId !== customerId) {
      return NextResponse.json({ error: 'User does not belong to this customer' }, { status: 403 });
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: unknown) {
    logger.error(`Error in DELETE /api/customers/${params.id}/users/${params.userId}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while deleting the user' },
      { status: 500 }
    );
  }
}