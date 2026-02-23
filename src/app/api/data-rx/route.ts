// src/app/api/data-rx/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Helper function to check permissions (copied from dsx endpoint)
function hasPermission(permissions: any, module: string): boolean {
  if (!permissions) return false;
  
  // For super admin format (* string or array with *)
  if (permissions === '*') return true;
  if (Array.isArray(permissions) && permissions.includes('*')) return true;
  
  // Check granular permissions
  if (typeof permissions === 'object') {
    // Check object with properties
    if (permissions[module]) {
      // If it's a boolean value directly
      if (typeof permissions[module] === 'boolean') return permissions[module];
      
      // If it's an object with view property
      if (typeof permissions[module] === 'object' && permissions[module].view === true) {
        return true;
      }
      
      // If it's an array of actions
      if (Array.isArray(permissions[module]) && 
          (permissions[module].includes('*') || permissions[module].includes('view'))) {
        return true;
      }
    }
  }
  
  return false;
}

// GET handler to fetch all data-rx data (fields and documents)
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always check permissions
    if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission" }, { status: 403 });
    }

    try {
      // Extract request parameters
      const { searchParams } = new URL(request.url);
      const type = searchParams.get('type') || 'all';

      // For now, we'll extract data from DSXRequirement since that's where they're stored
      let whereClause = {};
      
      if (type === 'field') {
        whereClause = { type: 'field' };
      } else if (type === 'document') {
        whereClause = { type: 'document' };
      } else if (type === 'form') {
        whereClause = { type: 'form' };
      }
      
      const requirements = await prisma.dSXRequirement.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          type: true,
          fieldData: true,
          documentData: true,
          formData: true,
          service: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      // Transform the requirements to a more usable format
      const fields = requirements
        .filter(req => req.type === 'field')
        .map(req => {
          const fieldData = req.fieldData as any || {};
          
          return {
            id: req.id,
            fieldLabel: req.name,
            shortName: fieldData.shortName || req.name,
            dataType: fieldData.dataType || 'text',
            instructions: fieldData.instructions || '',
            retentionHandling: fieldData.retentionHandling || 'no_delete',
            options: fieldData.options || [],
            serviceId: req.service?.id,
            serviceName: req.service?.name || 'Unknown'
          };
        });
        
      const documents = requirements
        .filter(req => req.type === 'document')
        .map(req => {
          const documentData = req.documentData as any || {};
          
          return {
            id: req.id,
            documentName: req.name,
            instructions: documentData.instructions || '',
            scope: documentData.scope || 'per_case',
            retentionHandling: documentData.retentionHandling || 'no_delete',
            filePath: documentData.filePath,
            serviceId: req.service?.id,
            serviceName: req.service?.name || 'Unknown'
          };
        });
        
      const forms = requirements
        .filter(req => req.type === 'form')
        .map(req => {
          const formData = req.formData as any || {};
          
          return {
            id: req.id,
            formName: req.name,
            description: formData.description || '',
            fields: formData.fields || [],
            serviceId: req.service?.id,
            serviceName: req.service?.name || 'Unknown'
          };
        });

      // Return based on requested type
      if (type === 'field') {
        return NextResponse.json({ fields });
      } else if (type === 'document') {
        return NextResponse.json({ documents });
      } else if (type === 'form') {
        return NextResponse.json({ forms });
      } else {
        return NextResponse.json({ fields, documents, forms });
      }
    } catch (dbError) {
      console.error('Database error in GET /api/data-rx:', dbError);
      return NextResponse.json(
        { error: "Database error while fetching Data Rx data", details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in GET /api/data-rx:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request", details: error.message },
      { status: 500 }
    );
  }
}