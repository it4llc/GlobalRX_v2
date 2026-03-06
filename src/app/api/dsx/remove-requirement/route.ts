// /GlobalRX_v2/src/app/api/dsx/remove-requirement/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger, { logDatabaseError } from '@/lib/logger';
import { canAccessDataRx } from '@/lib/auth-utils';

/**
 * DELETE /api/dsx/remove-requirement
 * Removes a requirement from a service and cleans up all related DSX mappings
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY FIX: Added missing permission check for DSX requirement removal
    // This endpoint previously had NO permission checking, allowing any authenticated
    // user to delete requirements from services. This was a critical security vulnerability.
    //
    // Fix: Use centralized canAccessDataRx() function which checks for 'global_config'
    // permission instead of legacy 'dsx' permission to ensure consistent authorization.
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
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

    logger.info('Removing requirement from service', { requirementId, serviceId });

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

      logger.info('Removed service requirements and mappings', {
        serviceRequirements: deletedServiceRequirement.count,
        dsxMappings: deletedMappings.count
      });

      return {
        serviceRequirements: deletedServiceRequirement.count,
        dsxMappings: deletedMappings.count
      };
    });

    return NextResponse.json({
      success: true,
      deleted: result
    });
  } catch (error: unknown) {
    logDatabaseError('remove_requirement', error as Error, session?.user?.id);
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
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY FIX: Added missing permission check for bulk requirement removal
    // This endpoint previously had NO permission checking, allowing any authenticated
    // user to bulk delete requirements from services. This was a critical security vulnerability.
    //
    // Fix: Use centralized canAccessDataRx() function which checks for 'global_config'
    // permission instead of legacy 'dsx' permission to ensure consistent authorization.
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { serviceId, requirementIds } = body;

    if (!serviceId || !requirementIds || !Array.isArray(requirementIds)) {
      return NextResponse.json(
        { error: 'Missing required parameters: serviceId and requirementIds array' },
        { status: 400 }
      );
    }

    logger.info('Bulk removing requirements from service', { requirementCount: requirementIds.length, serviceId });

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

      logger.info('Bulk removed service requirements and mappings', {
        serviceRequirements: deletedServiceRequirements.count,
        dsxMappings: deletedMappings.count
      });

      return {
        serviceRequirements: deletedServiceRequirements.count,
        dsxMappings: deletedMappings.count
      };
    });

    return NextResponse.json({
      success: true,
      deleted: result
    });
  } catch (error: unknown) {
    logDatabaseError('bulk_remove_requirements', error as Error, session?.user?.id);
    return NextResponse.json(
      { error: 'Failed to remove requirements' },
      { status: 500 }
    );
  }
}