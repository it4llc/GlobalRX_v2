// src/app/api/dsx/associate-requirements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger, { logDatabaseError } from '@/lib/logger';

/**
 * API route to associate requirements with a service
 * This creates entries in the DSX requirements table
 */
export async function POST(request: NextRequest) {
  try {
    // Always check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Always check permissions
    if (!session.user.permissions.dsx.manage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { serviceId, requirements } = body;
    
    if (!serviceId) {
      return NextResponse.json(
        { error: 'Service ID is required' },
        { status: 400 }
      );
    }
    
    if (!requirements || !Array.isArray(requirements) || requirements.length === 0) {
      return NextResponse.json(
        { error: 'Requirements array is required' },
        { status: 400 }
      );
    }
    
    logger.info('Associating requirements with service', { requirementCount: requirements.length, serviceId });

    // First, get the list of existing requirements WITH their display order to preserve it
    const existingRequirements = await prisma.serviceRequirement.findMany({
      where: { serviceId },
      select: {
        requirementId: true,
        displayOrder: true
      }
    });

    // Create a map of existing display orders to preserve them
    const displayOrderMap = new Map<string, number>();
    existingRequirements.forEach(req => {
      displayOrderMap.set(req.requirementId, req.displayOrder);
    });
    logger.debug('Preserving display orders for existing requirements', { preservedCount: displayOrderMap.size });

    const removedRequirementIds = existingRequirements
      .map(r => r.requirementId)
      .filter(id => !requirements.some(req => req.id === id));

    // Remove DSX mappings for requirements that are being removed
    if (removedRequirementIds.length > 0) {
      logger.info('Removing DSX mappings for requirements', { removedCount: removedRequirementIds.length });
      await prisma.dSXMapping.deleteMany({
        where: {
          serviceId,
          requirementId: {
            in: removedRequirementIds
          }
        }
      });
    }

    // Now remove existing ServiceRequirement entries
    logger.debug('Removing existing ServiceRequirement entries for service', { serviceId });
    await prisma.serviceRequirement.deleteMany({
      where: { serviceId }
    });
    
    // Get the maximum display order for completely new requirements
    const maxDisplayOrder = Math.max(...Array.from(displayOrderMap.values()), 0);
    let nextDisplayOrder = maxDisplayOrder + 10;

    // Create new associations
    logger.debug('Creating new requirement associations');
    const createdRequirements = [];

    for (let i = 0; i < requirements.length; i++) {
      const req = requirements[i];
      try {
        // Check if it's a data field or document
        const isDataField = req.type === 'data-field' || req.type === 'field';

        // Use preserved display order if it exists, otherwise assign new one at the end
        let displayOrder = displayOrderMap.get(req.id);
        if (displayOrder === undefined) {
          displayOrder = nextDisplayOrder;
          nextDisplayOrder += 10;
          logger.debug('Assigning new displayOrder to requirement', { displayOrder, requirementId: req.id });
        } else {
          logger.debug('Preserving displayOrder for existing requirement', { displayOrder, requirementId: req.id });
        }

        // Create the service requirement association with display order
        const serviceRequirement = await prisma.serviceRequirement.create({
          data: {
            serviceId,
            requirementId: req.id,
            displayOrder
          }
        });

        createdRequirements.push(serviceRequirement);
      } catch (error) {
        logger.error('Error creating requirement', {
          requirementId: req.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    logger.info('Successfully associated requirements with service', { associatedCount: createdRequirements.length, serviceId });
    
    return NextResponse.json({
      success: true,
      count: createdRequirements.length,
      requirements: createdRequirements
    });
  } catch (error) {
    logDatabaseError('associate_requirements', error as Error, session?.user?.id);
    return NextResponse.json(
      { error: 'Failed to associate requirements with service' },
      { status: 500 }
    );
  }
}