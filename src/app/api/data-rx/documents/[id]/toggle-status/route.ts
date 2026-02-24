// src/app/api/data-rx/documents/[id]/toggle-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Helper function to check permissions
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

// PATCH handler to toggle document disabled status
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always allow access in development
    if (process.env.NODE_ENV === 'development') {
      logger.info("Development mode - bypassing permission check");
    }
    // Otherwise check permissions
    else if (!hasPermission(session.user.permissions, 'dsx')) {
      return NextResponse.json({ error: "Forbidden - Missing required permission" }, { status: 403 });
    }

    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    try {
      // Get the current requirement
      const requirement = await prisma.dSXRequirement.findUnique({
        where: { id }
      });

      if (!requirement) {
        return NextResponse.json({ error: "Document not found" }, { status: 404 });
      }

      // Get the current document data
      const documentData = requirement.documentData as any || {};
      
      // Toggle the disabled state
      const isDisabled = documentData.disabled === true;
      
      // Update the document data with the new disabled state
      const updatedDocumentData = {
        ...documentData,
        disabled: !isDisabled
      };
      
      // Update the requirement
      const updatedRequirement = await prisma.dSXRequirement.update({
        where: { id },
        data: {
          documentData: updatedDocumentData
        }
      });

      return NextResponse.json({ 
        success: true, 
        isDisabled: !isDisabled
      });
    } catch (dbError) {
      logger.error('Database error in PATCH /api/data-rx/documents/[id]/toggle-status:', dbError);
      return NextResponse.json(
        { error: "Database error while toggling document status", details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error in PATCH /api/data-rx/documents/[id]/toggle-status:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request", details: error.message },
      { status: 500 }
    );
  }
}