// src/app/api/dsx/associate-requirements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * API route to associate requirements with a service
 * This creates entries in the DSX requirements table
 */
export async function POST(request: NextRequest) {
  try {
    // Skip authentication in development mode
    if (process.env.NODE_ENV === 'development') {
      console.log('Development mode - bypassing permission check');
    } else {
      // Check authentication
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      // Check permissions
      if (!session.user.permissions.dsx.manage) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
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
    
    console.log(`Associating ${requirements.length} requirements with service ${serviceId}`);
    
    // First, get the list of existing requirements that will be removed
    const existingRequirements = await prisma.serviceRequirement.findMany({
      where: { serviceId },
      select: { requirementId: true }
    });

    const removedRequirementIds = existingRequirements
      .map(r => r.requirementId)
      .filter(id => !requirements.some(req => req.id === id));

    // Remove DSX mappings for requirements that are being removed
    if (removedRequirementIds.length > 0) {
      console.log(`Removing DSX mappings for ${removedRequirementIds.length} requirements...`);
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
    console.log('Removing existing ServiceRequirement entries for this service...');
    await prisma.serviceRequirement.deleteMany({
      where: { serviceId }
    });
    
    // Create new associations
    console.log('Creating new requirement associations...');
    const createdRequirements = [];
    
    for (const req of requirements) {
      try {
        // Check if it's a data field or document
        const isDataField = req.type === 'data-field' || req.type === 'field';
        
        // Create the service requirement association
        const serviceRequirement = await prisma.serviceRequirement.create({
          data: {
            serviceId,
            requirementId: req.id
          }
        });
        
        createdRequirements.push(serviceRequirement);
      } catch (error) {
        console.error('Error creating requirement:', error);
      }
    }
    
    console.log(`Successfully associated ${createdRequirements.length} requirements with service ${serviceId}`);
    
    return NextResponse.json({
      success: true,
      count: createdRequirements.length,
      requirements: createdRequirements
    });
  } catch (error) {
    console.error('Error associating requirements with service:', error);
    return NextResponse.json(
      { error: 'Failed to associate requirements with service' },
      { status: 500 }
    );
  }
}