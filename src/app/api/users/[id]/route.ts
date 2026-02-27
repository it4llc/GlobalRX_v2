// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth.server';
import logger from '@/lib/logger';

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

    // Check permissions - require admin, users.manage permission, or all wildcard permissions for user management
    const hasAdminPermission = session.user?.permissions?.admin === true;
    const hasUserManagePermission = session.user?.permissions?.users?.manage === true;

    // Check if user has all wildcard permissions (super admin)
    const hasAllWildcards = session.user?.permissions?.countries?.includes('*') &&
                            session.user?.permissions?.services?.includes('*') &&
                            session.user?.permissions?.dsx?.includes('*') &&
                            session.user?.permissions?.customers?.includes('*');

    if (!hasAdminPermission && !hasUserManagePermission && !hasAllWildcards) {
      return NextResponse.json({ message: 'Forbidden: Admin or users.manage permission required for user management' }, { status: 403 });
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

    // Check permissions - require admin, users.manage permission, or all wildcard permissions for user management
    const hasAdminPermission = session.user?.permissions?.admin === true;
    const hasUserManagePermission = session.user?.permissions?.users?.manage === true;

    // Check if user has all wildcard permissions (super admin)
    const hasAllWildcards = session.user?.permissions?.countries?.includes('*') &&
                            session.user?.permissions?.services?.includes('*') &&
                            session.user?.permissions?.dsx?.includes('*') &&
                            session.user?.permissions?.customers?.includes('*');

    if (!hasAdminPermission && !hasUserManagePermission && !hasAllWildcards) {
      return NextResponse.json({ message: 'Forbidden: Admin or users.manage permission required for user management' }, { status: 403 });
    }

    const { id } = params;
    const { email, password, firstName, lastName, permissions } = await request.json();

    // Validate required fields
    if (!email) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
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
    const updateData: any = {
      email,
      firstName: firstName || null,
      lastName: lastName || null,
      permissions: permissions || {},
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

    // Check permissions - require admin, users.manage permission, or all wildcard permissions for user management
    const hasAdminPermission = session.user?.permissions?.admin === true;
    const hasUserManagePermission = session.user?.permissions?.users?.manage === true;

    // Check if user has all wildcard permissions (super admin)
    const hasAllWildcards = session.user?.permissions?.countries?.includes('*') &&
                            session.user?.permissions?.services?.includes('*') &&
                            session.user?.permissions?.dsx?.includes('*') &&
                            session.user?.permissions?.customers?.includes('*');

    if (!hasAdminPermission && !hasUserManagePermission && !hasAllWildcards) {
      return NextResponse.json({ message: 'Forbidden: Admin or users.manage permission required for user management' }, { status: 403 });
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