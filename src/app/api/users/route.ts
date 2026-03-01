// /GlobalRX_v2/src/app/api/users/route.ts
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
      perms.user_admin?.view === true ||
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
      return NextResponse.json({
        message: 'Forbidden: Admin or user management permission required',
        debug: { permissions: perms }
      }, { status: 403 });
    }

    // Fetch all users (internal, customer, vendor)
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        userType: true,
        vendorId: true,
        customerId: true,
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
      perms.user_admin?.create === true ||
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
      return NextResponse.json({
        message: 'Forbidden: Admin or user management permission required'
      }, { status: 403 });
    }

    const body = await request.json();
    logger.info('Received user creation request', { hasEmail: !!body.email, hasPassword: !!body.password });

    const { email, password, firstName, lastName, permissions, userType, vendorId, customerId } = body;

    // Validate required fields
    if (!email || !password) {
      logger.warn('Missing required fields for user creation');
      return NextResponse.json({ message: 'Email and password are required' }, { status: 400 });
    }

    // Validate userType enum
    const validUserTypes = ['internal', 'vendor', 'customer'];
    if (userType && !validUserTypes.includes(userType)) {
      logger.warn('Invalid user type provided', { userType });
      return NextResponse.json({ message: 'Invalid user type. Must be: internal, vendor, or customer' }, { status: 400 });
    }

    // Enforce vendor user permission restrictions
    if (userType === 'vendor' && permissions) {
      const vendorPermissions = Object.keys(permissions).filter(key => permissions[key] && key !== 'fulfillment');
      if (vendorPermissions.length > 0) {
        logger.warn('Vendor user created with invalid permissions', { vendorPermissions });
        return NextResponse.json({ message: 'Vendor users can only have fulfillment permission' }, { status: 400 });
      }
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

    // Create new user with specified type
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        permissions: permissions || {},
        userType: userType || 'internal', // Default to internal if not specified
        vendorId: userType === 'vendor' ? vendorId : null,
        customerId: userType === 'customer' ? customerId : null,
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
        vendorId: true,
        customerId: true,
      },
    });

    logger.info('User created successfully', { userId: newUser.id });
    return NextResponse.json(newUser, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error creating user', { error: error.message, stack: error.stack });
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}