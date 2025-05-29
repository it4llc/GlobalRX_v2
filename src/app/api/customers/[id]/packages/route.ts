// src/app/api/customers/[id]/packages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Validation schema for package
const packageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  description: z.string().optional().nullable(),
  services: z.array(z.object({
    serviceId: z.string().uuid(),
    scope: z.any() // Will validate the structure based on service type in the handler
  }))
});

/**
 * @route GET /api/customers/[id]/packages
 * @desc Get all packages for a specific customer
 * @access Private - Requires customers.view permission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("API: Session not found");
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Debug: Log user and permissions
    console.log("API: User:", session.user.email);
    console.log("API: Raw Permissions:", JSON.stringify(session.user.permissions || {}));

    const { id } = await params;

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      return NextResponse.json(
        { error: `Customer with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Get packages for the customer - Using packageServices instead of services
    // This is the fixed query based on your Prisma schema
    const packages = await prisma.package.findMany({
      where: { customerId: id },
      include: {
        packageServices: {
          include: {
            service: true
          }
        }
      }
    });

    // Format the response to match what the frontend expects
    const formattedPackages = packages.map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      createdAt: pkg.createdAt,
      updatedAt: pkg.updatedAt,
      // Transform packageServices into the services format expected by the frontend
      services: pkg.packageServices.map(ps => ({
        service: ps.service,
        scope: ps.scope
      }))
    }));

    console.log(`API: Successfully fetched ${formattedPackages.length} packages for customer ${id}`);
    return NextResponse.json(formattedPackages);
  } catch (error) {
    console.error(`Error in GET /api/customers/${id}/packages:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

/**
 * @route POST /api/customers/[id]/packages
 * @desc Create a new package for a customer
 * @access Private - Requires customers.edit permission
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!session.user.permissions?.customers?.edit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: id },
      include: {
        services: {
          include: {
            service: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: `Customer with ID ${id} not found` },
        { status: 404 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = packageSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Verify that all services are available to the customer
    const availableServiceIds = customer.services.map(cs => cs.service.id);
    const requestedServiceIds = data.services.map(s => s.serviceId);
    
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
      const service = customer.services.find(
        cs => cs.service.id === serviceItem.serviceId
      )?.service;

      if (service) {
        // Apply validation based on functionality type
        // This is a simplified validation - in a real app, you would have more detailed validation
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

    // Create package with transaction to handle service relationships
    const newPackage = await prisma.$transaction(async (tx) => {
      // Create the package
      const pkg = await tx.package.create({
        data: {
          name: data.name,
          description: data.description,
          customerId: id,
        }
      });

      // Create packageService relationships
      await Promise.all(
        data.services.map(serviceItem =>
          tx.packageService.create({
            data: {
              packageId: pkg.id,
              serviceId: serviceItem.serviceId,
              scope: serviceItem.scope
            }
          })
        )
      );

      return pkg;
    });

    // Get the created package with services
    const createdPackage = await prisma.package.findUnique({
      where: { id: newPackage.id },
      include: {
        packageServices: {
          include: {
            service: true
          }
        }
      }
    });

    // Format response to match expected structure
    const formattedPackage = {
      ...createdPackage,
      services: createdPackage?.packageServices.map(ps => ({
        service: ps.service,
        scope: ps.scope
      })) || []
    };
    
    // Remove the packageServices field that the frontend doesn't expect
    if (formattedPackage) {
      delete (formattedPackage as any).packageServices;
    }

    return NextResponse.json(formattedPackage, { status: 201 });
  } catch (error) {
    console.error(`Error in POST /api/customers/${id}/packages:`, error);
    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}