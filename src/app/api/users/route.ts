// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth.server';
import logger from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // Check authentication
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - require admin, users.manage permission, or all wildcard permissions for user management
    // This is a critical security check per our audit report
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

    // Fetch only admin users (not customer users)
    const users = await prisma.user.findMany({
      where: {
        userType: 'admin',
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        userType: true,
      },
      orderBy: {
        email: 'asc',
      },
    });

    return NextResponse.json(users);
  } catch (error: unknown) {
    logger.error('Error fetching users', { error: error.message, stack: error.stack });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    logger.info('Received user creation request', { hasEmail: !!body.email, hasPassword: !!body.password });

    const { email, password, firstName, lastName, permissions } = body;

    // Validate required fields
    if (!email || !password) {
      logger.warn('Missing required fields for user creation');
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    // Check if user with email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      logger.warn('User creation failed: email already in use');
      return NextResponse.json({ message: 'Email is already in use' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create new admin user (always set userType to 'admin')
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        permissions: permissions || {},
        userType: 'admin', // Always create admin users from User Admin
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        userType: true,
      },
    });

    logger.info('User created successfully', { userId: newUser.id });
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating user', { error: error.message, stack: error.stack });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}