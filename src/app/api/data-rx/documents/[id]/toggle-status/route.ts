// src/app/api/data-rx/documents/[id]/toggle-status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessDataRx } from '@/lib/auth-utils';

/**
 * PATCH /api/data-rx/documents/[id]/toggle-status
 *
 * Toggles the disabled status of a document requirement
 *
 * Required permissions: global_config (internal users only)
 *
 * Path params:
 *   - id: string - Document requirement ID
 *
 * Returns: { success: true, isDisabled: boolean }
 *
 * Business logic: This endpoint toggles the disabled state stored in
 * the documentData.disabled field, allowing documents to be temporarily
 * disabled without losing configuration.
 *
 * Security improvement: Removed development mode bypasses.
 * All users must have proper permissions regardless of environment.
 *
 * Breaking change: Legacy 'dsx' permission is no longer supported.
 * Users must have 'global_config' permission to access this endpoint.
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions (requires global_config)
 *   - 404: Document not found
 *   - 400: Missing document ID
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
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
    } catch (dbError: unknown) {
      logger.error('Database error in PATCH /api/data-rx/documents/[id]/toggle-status:', dbError);
      return NextResponse.json(
        { error: "Database error while toggling document status", details: dbError instanceof Error ? dbError.message : String(dbError) },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    logger.error('Error in PATCH /api/data-rx/documents/[id]/toggle-status:', error);
    return NextResponse.json(
      { error: "An error occurred while processing your request", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}