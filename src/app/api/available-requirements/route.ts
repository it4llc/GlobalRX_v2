// src/app/api/dsx/available-requirements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * API route to fetch all available requirements that can be associated with a service
 * This bridges the gap between Data Rx tab and DSX tab
 */
export async function GET(request: NextRequest) {
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
      if (!session.user.permissions.dsx.view) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Get service ID if provided for filtering already associated requirements
    const searchParams = new URL(request.url).searchParams;
    const serviceId = searchParams.get('serviceId');
    
    // Fetch data fields
    console.log('Fetching data fields from database...');
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
    console.log('Fetching documents from database...');
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
      console.log(`Fetching existing DSX requirements for service ${serviceId}...`);
      const existingRequirements = await prisma.dsxRequirement.findMany({
        where: { serviceId },
        select: { id: true, fieldId: true, documentId: true }
      });
      
      // Extract field and document IDs
      associatedRequirementIds = existingRequirements.flatMap(req => [
        req.fieldId, 
        req.documentId
      ]).filter(Boolean) as string[];
      
      console.log('Already associated requirement IDs:', associatedRequirementIds);
    }
    
    // Transform data fields to requirements format
    const dataFieldRequirements = dataFields.map(field => ({
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
    const documentRequirements = documents.map(doc => ({
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
    
    console.log(`Found ${allRequirements.length} total requirements (${dataFieldRequirements.length} data fields, ${documentRequirements.length} documents)`);
    
    // Return combined requirements
    return NextResponse.json({
      requirements: allRequirements,
      associatedCount: associatedRequirementIds.length
    });
  } catch (error) {
    console.error('Error fetching available requirements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available requirements' },
      { status: 500 }
    );
  }
}