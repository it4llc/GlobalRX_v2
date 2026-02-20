// src/app/api/customers/[id]/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth.server';
import { z } from 'zod';

// Validation schema for creating a customer user
const customerUserCreateSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
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
 * @route GET /api/customers/[id]/users
 * @desc Get all users associated with a specific customer
 * @access Private - Requires customers.view permission or being a customer user for that customer
 */
export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get params safely
    const params = await context.params;
    const { id: customerId } = params;

    // Check authentication
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - admin users need customers.view, customer users can only see their own
    const isAdmin = session.user.userType === 'admin';
    const isOwnCustomer = session.user.userType === 'customer' && session.user.customerId === customerId;

    if (isAdmin && !hasPermission(session.user, 'customers', 'view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!isAdmin && !isOwnCustomer) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all users for this customer (userType === 'customer' AND customerId matches)
    const users = await prisma.user.findMany({
      where: {
        userType: 'customer',
        customerId: customerId,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        createdAt: true,
        lastLoginAt: true,
        mfaEnabled: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Also get admin users who have access to this customer
    const adminUsersWithAccess = await prisma.user.findMany({
      where: {
        userType: 'admin',
        OR: [
          {
            permissions: {
              path: ['admin'],
              equals: true,
            },
          },
          {
            permissions: {
              path: ['customers'],
              array_contains: ['*'],
            },
          },
          {
            permissions: {
              path: ['customers'],
              array_contains: [customerId],
            },
          },
        ],
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        createdAt: true,
        lastLoginAt: true,
        userType: true,
      },
      orderBy: {
        email: 'asc',
      },
    });

    // Combine the results with userType indication
    const allUsers = [
      ...users.map(user => ({ ...user, userType: 'customer' })),
      ...adminUsersWithAccess,
    ];

    return NextResponse.json(allUsers);
  } catch (error) {
    console.error(`Error in GET /api/customers/${params.id}/users:`, error);
    return NextResponse.json(
      { error: 'An error occurred while fetching users' },
      { status: 500 }
    );
  }
}

/**
 * @route POST /api/customers/[id]/users
 * @desc Create a new user for a specific customer
 * @access Private - Requires customers.edit permission or being a customer user with user management permission
 */
export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    // Get params safely
    const params = await context.params;
    const { id: customerId } = params;

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

    // Validate that the customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, name: true },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = customerUserCreateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { email, password, firstName, lastName, permissions } = validationResult.data;

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Hash the password
    const hashedPassword = await hashPassword(password);

    // Create the customer user
    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName: firstName || null,
        lastName: lastName || null,
        userType: 'customer',
        customerId: customerId,
        permissions: permissions || {
          orders: { view: true, create: true },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        permissions: true,
        createdAt: true,
        userType: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error(`Error in POST /api/customers/${params.id}/users:`, error);
    return NextResponse.json(
      { error: 'An error occurred while creating the user' },
      { status: 500 }
    );
  }
}