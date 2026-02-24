// src/app/api/dsx/available-requirements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger, { logDatabaseError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * API route to fetch all available requirements that can be associated with a service
 * This bridges the gap between Data Rx tab and DSX tab
 */
export async function GET(request: NextRequest) {
  // Always check authentication
  const session = await getServerSession(authOptions);

  try {
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions
    if (!session.user?.permissions?.dsx?.view) {
      return NextResponse.json({ error: 'Forbidden - DSX view permission required' }, { status: 403 });
    }

    // Get service ID if provided for filtering already associated requirements
    const searchParams = new URL(request.url).searchParams;
    const serviceId = searchParams.get('serviceId');
    
    // Fetch data fields
    logger.debug('Fetching data fields from database');
    const dataFields = await prisma.dataField.findMany({
      select: {
        id: true,
        fieldLabel: true,
        shortName: true,
        dataType: true,
        instructions: true,
        retentionHandling: true,
        disabled: true
      }
    });
    
    // Fetch documents
    logger.debug('Fetching documents from database');
    const documents = await prisma.document.findMany({
      select: {
        id: true,
        name: true,
        instructions: true,
        type: true,
        retentionHandling: true,
        disabled: true
      }
    });
    
    // If serviceId is provided, fetch already associated requirements
    let associatedRequirementIds: string[] = [];
    if (serviceId) {
      logger.debug('Fetching existing DSX requirements for service', { serviceId });
      const existingRequirements = await prisma.serviceRequirement.findMany({
        where: { serviceId },
        select: { requirementId: true }
      });

      // Extract requirement IDs
      associatedRequirementIds = existingRequirements.map((req: any) => req.requirementId);
      
      logger.debug('Found already associated requirements', { associatedCount: associatedRequirementIds.length });
    }
    
    // Transform data fields to requirements format
    const dataFieldRequirements = dataFields.map((field: any) => ({
      id: field.id,
      name: field.fieldLabel,
      shortName: field.shortName,
      type: 'data-field',
      dataType: field.dataType,
      instructions: field.instructions,
      retention: field.retentionHandling,
      disabled: field.disabled,
      isAssociated: associatedRequirementIds.includes(field.id)
    }));
    
    // Transform documents to requirements format
    const documentRequirements = documents.map((doc: any) => ({
      id: doc.id,
      name: doc.name,
      type: 'document',
      documentType: doc.type,
      instructions: doc.instructions,
      retention: doc.retentionHandling,
      disabled: doc.disabled,
      isAssociated: associatedRequirementIds.includes(doc.id)
    }));
    
    // Combine all requirements
    const allRequirements = [...dataFieldRequirements, ...documentRequirements];
    
    logger.info('Retrieved available requirements', {
      totalRequirements: allRequirements.length,
      dataFields: dataFieldRequirements.length,
      documents: documentRequirements.length
    });
    
    // Return combined requirements
    return NextResponse.json({
      requirements: allRequirements,
      associatedCount: associatedRequirementIds.length
    });
  } catch (error: unknown) {
    logDatabaseError('fetch_available_requirements', error as Error, session?.user?.id);
    return NextResponse.json(
      { error: 'Failed to fetch available requirements' },
      { status: 500 }
    );
  }
}