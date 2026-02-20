// src/app/api/dsx/remove-requirement/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * DELETE /api/dsx/remove-requirement
 * Removes a requirement from a service and cleans up all related DSX mappings
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    // Skip authentication in development mode
    if (process.env.NODE_ENV !== 'development' && !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get parameters from query
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const requirementId = searchParams.get('requirementId');

    if (!serviceId || !requirementId) {
      return NextResponse.json(
        { error: 'Missing required parameters: serviceId and requirementId' },
        { status: 400 }
      );
    }

    console.log(`Removing requirement ${requirementId} from service ${serviceId}`);

    // Use a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Remove from service_requirements
      const deletedServiceRequirement = await tx.serviceRequirement.deleteMany({
        where: {
          serviceId,
          requirementId
        }
      });

      // Remove all DSX mappings for this requirement and service
      const deletedMappings = await tx.dSXMapping.deleteMany({
        where: {
          serviceId,
          requirementId
        }
      });

      console.log(`Deleted ${deletedServiceRequirement.count} service requirement(s)`);
      console.log(`Deleted ${deletedMappings.count} DSX mapping(s)`);

      return {
        serviceRequirements: deletedServiceRequirement.count,
        dsxMappings: deletedMappings.count
      };
    });

    return NextResponse.json({
      success: true,
      deleted: result
    });
  } catch (error) {
    console.error('Error removing requirement:', error);
    return NextResponse.json(
      { error: 'Failed to remove requirement' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dsx/remove-requirement
 * Bulk remove requirements from a service
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);

    // Skip authentication in development mode
    if (process.env.NODE_ENV !== 'development' && !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { serviceId, requirementIds } = body;

    if (!serviceId || !requirementIds || !Array.isArray(requirementIds)) {
      return NextResponse.json(
        { error: 'Missing required parameters: serviceId and requirementIds array' },
        { status: 400 }
      );
    }

    console.log(`Removing ${requirementIds.length} requirements from service ${serviceId}`);

    // Use a transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Remove from service_requirements
      const deletedServiceRequirements = await tx.serviceRequirement.deleteMany({
        where: {
          serviceId,
          requirementId: {
            in: requirementIds
          }
        }
      });

      // Remove all DSX mappings for these requirements and service
      const deletedMappings = await tx.dSXMapping.deleteMany({
        where: {
          serviceId,
          requirementId: {
            in: requirementIds
          }
        }
      });

      console.log(`Deleted ${deletedServiceRequirements.count} service requirement(s)`);
      console.log(`Deleted ${deletedMappings.count} DSX mapping(s)`);

      return {
        serviceRequirements: deletedServiceRequirements.count,
        dsxMappings: deletedMappings.count
      };
    });

    return NextResponse.json({
      success: true,
      deleted: result
    });
  } catch (error) {
    console.error('Error removing requirements:', error);
    return NextResponse.json(
      { error: 'Failed to remove requirements' },
      { status: 500 }
    );
  }
}