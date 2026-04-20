// src/app/api/packages/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import logger from '@/lib/logger';

// Validation schema
const packageUpdateSchema = z.object({
  name: z.string().min(1, "Package name is required").optional(),
  description: z.string().optional().nullable(),
  services: z.array(z.object({
    serviceId: z.string().uuid(),
    scope: z.any() // Will validate the structure based on service type in the handler
  })).optional(),
  workflowId: z.string().uuid().optional().nullable()
});

/**
 * GET /api/packages/[id]
 *
 * Retrieves a specific package by ID with its services and workflow.
 *
 * Required permissions: customer_config.view, customer_config.edit, customer_config.*, or admin
 *
 * Path params:
 *   - id: UUID of the package
 *
 * Returns: Package object with services and workflow
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Package not found
 *   - 500: Internal server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15 Migration: params is now a Promise that must be awaited
  // before accessing its properties. This prevents runtime errors
  // when destructuring { id } from the params object.
  const { id } = await params;

  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    // BUG FIX: Changed from 'customers' to 'customer_config' to match User Admin permission key
    const hasCustomerConfigPermission =
      session.user.permissions?.customer_config ||
      session.user.permissions?.customer_config?.edit ||
      session.user.permissions?.customer_config?.view ||
      session.user.permissions?.customer_config?.['*'] ||
      (Array.isArray(session.user.permissions?.customer_config) && session.user.permissions.customer_config.includes('*'));

    if (!hasCustomerConfigPermission && !session.user.permissions?.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get package with related data
    const pkg = await prisma.package.findUnique({
      where: { id },
      include: {
        customer: true,
        workflow: true,
        packageServices: {
          include: {
            service: true
          }
        }
      }
    });

    if (!pkg) {
      return NextResponse.json(
        { error: `Package with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Format the response to match the expected format in the form
    const formattedPackage = {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      customerId: pkg.customerId,
      customerName: pkg.customer.name,
      workflowId: pkg.workflowId,
      workflow: pkg.workflow,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
      // Transform packageServices to match the expected format in the form
      services: pkg.packageServices.map((ps: any) => ({
        serviceId: ps.serviceId,
        scope: ps.scope
      }))
    };

    return NextResponse.json(formattedPackage);
  } catch (error: unknown) {
    logger.error(`Error in GET /api/packages/${id}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/packages/[id]
 *
 * Updates a package's name, description, services, and/or workflow assignment.
 *
 * Required permissions: customer_config.edit, customer_config.*, or admin
 *
 * Path params:
 *   - id: UUID of the package
 *
 * Request body:
 *   - name?: string (min 1 character)
 *   - description?: string | null
 *   - services?: Array<{ serviceId: string (UUID), scope: any }>
 *   - workflowId?: string (UUID) | null
 *
 * Returns: Updated package object with services and workflow
 *
 * Errors:
 *   - 400: Validation failed or services not available to customer
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Package not found
 *   - 500: Internal server error
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15 Migration: await params before accessing properties
  const { id } = await params;

  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    // BUG FIX: Changed from 'customers' to 'customer_config' to match User Admin permission key
    // BUG FIX: Remove .view from permission check - only edit/admin should be allowed to update
    const hasCustomerConfigPermission =
      session.user.permissions?.customer_config === true ||
      session.user.permissions?.customer_config === '*' ||
      session.user.permissions?.customer_config?.edit ||
      session.user.permissions?.customer_config?.['*'] ||
      (Array.isArray(session.user.permissions?.customer_config) && session.user.permissions.customer_config.includes('*'));

    if (!hasCustomerConfigPermission && !session.user.permissions?.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if package exists
    const existingPackage = await prisma.package.findUnique({
      where: { id },
      include: {
        customer: {
          include: {
            services: {
              include: {
                service: true
              }
            }
          }
        }
      }
    });

    if (!existingPackage) {
      return NextResponse.json(
        { error: `Package with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = packageUpdateSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // If services are provided, verify they are available to the customer
    if (data.services && data.services.length > 0) {
      const availableServiceIds = existingPackage.customer.services.map((cs: any) => cs.service.id);
      const requestedServiceIds = data.services.map((s: any) => s.serviceId);
      
      const unavailableServices = requestedServiceIds.filter(
        id => !availableServiceIds.includes(id)
      );

      if (unavailableServices.length > 0) {
        return NextResponse.json(
          {
            error: 'Package contains services not available to the customer',
            unavailableServices
          },
          { status: 400 }
        );
      }

      // Validate service scope based on service type
      for (const serviceItem of data.services) {
        const service = existingPackage.customer.services.find(
          cs => cs.service.id === serviceItem.serviceId
        )?.service;

        if (service) {
          // Apply validation based on functionality type
          if (service.functionalityType === 'verification' && !serviceItem.scope?.type) {
            return NextResponse.json(
              {
                error: `Service "${service.name}" requires scope configuration`,
                serviceId: service.id
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // If workflowId is provided, validate that the workflow exists
    if (data.workflowId !== undefined && data.workflowId !== null) {
      const workflowExists = await prisma.workflow.findUnique({
        where: { id: data.workflowId }
      });

      if (!workflowExists) {
        return NextResponse.json(
          { error: 'Workflow not found', workflowId: data.workflowId },
          { status: 400 }
        );
      }
    }

    // Update package with transaction to handle service relationships
    const updatedPackage = await prisma.$transaction(async (tx) => {
      // Update the package
      const pkg = await tx.package.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          workflowId: data.workflowId
        }
      });

      // Update service relationships if provided
      if (data.services) {
        // Delete existing relationships
        await tx.packageService.deleteMany({
          where: { packageId: id }
        });

        // Create new relationships
        await Promise.all(
          data.services.map((serviceItem: any) =>
            tx.packageService.create({
              data: {
                packageId: id,
                serviceId: serviceItem.serviceId,
                scope: serviceItem.scope
              }
            })
          )
        );
      }

      return pkg;
    });

    // Get the updated package with packageServices and workflow
    const packageWithServices = await prisma.package.findUnique({
      where: { id },
      include: {
        workflow: true,
        packageServices: {
          include: {
            service: true
          }
        }
      }
    });

    return NextResponse.json(packageWithServices);
  } catch (error: unknown) {
    logger.error(`Error in PUT /api/packages/${id}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/packages/[id]
 *
 * Deletes a package and its associated package services (cascade delete).
 *
 * Required permissions: customer_config.edit, customer_config.*, or admin
 *
 * Path params:
 *   - id: UUID of the package
 *
 * Returns: { success: true }
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Package not found
 *   - 500: Internal server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Next.js 15 Migration: await params before accessing properties
  const { id } = await params;
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    // BUG FIX: Changed from 'customers' to 'customer_config' to match User Admin permission key
    // BUG FIX: Remove .view from permission check - only edit/admin should be allowed to delete
    const hasCustomerConfigPermission =
      session.user.permissions?.customer_config === true ||
      session.user.permissions?.customer_config === '*' ||
      session.user.permissions?.customer_config?.edit ||
      session.user.permissions?.customer_config?.['*'] ||
      (Array.isArray(session.user.permissions?.customer_config) && session.user.permissions.customer_config.includes('*'));

    if (!hasCustomerConfigPermission && !session.user.permissions?.admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if package exists
    const packageExists = await prisma.package.findUnique({
      where: { id }
    });

    if (!packageExists) {
      return NextResponse.json(
        { error: `Package with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Delete package - cascade will handle service relationships
    await prisma.package.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error(`Error in DELETE /api/packages/${id}:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}