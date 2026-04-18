// src/app/api/data-rx/documents/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessDataRx } from '@/lib/auth-utils';
import logger, { logDatabaseError } from '@/lib/logger';
import { generateFieldKey } from '@/lib/utils/field-key';

/**
 * GET /api/data-rx/documents
 *
 * Retrieves all Data Rx document requirements, optionally filtered by service
 *
 * Required permissions: global_config (internal users only)
 *
 * Query params:
 *   - includeDisabled?: boolean - Include disabled documents in results
 *   - serviceId?: string - Filter documents by specific service ID
 *   - includeServices?: boolean - Include associated services in response
 *
 * Returns: { documents: DocumentRequirement[] }
 *
 * Breaking change: Legacy 'dsx' permission is no longer supported.
 * Users must have 'global_config' permission to access this endpoint.
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions (requires global_config)
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always check permissions
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const includeDisabled = searchParams.get('includeDisabled') === 'true';
    const serviceId = searchParams.get('serviceId');
    const includeServices = searchParams.get('includeServices') === 'true';

    // Build the query
    const where: any = {
      type: 'document',
    };

    // Only include enabled documents unless specifically requested
    if (!includeDisabled) {
      where.disabled = false;
    }

    // Set up include for services if needed
    const include: any = {};
    if (includeServices) {
      include.serviceRequirements = {
        include: {
          service: true
        }
      };
    }

    // If serviceId is provided, filter by service
    if (serviceId) {
      // We need to filter documents that are associated with this service
      // through the ServiceRequirement relationship
      const documents = await prisma.dSXRequirement.findMany({
        where: {
          type: 'document',
          ...(includeDisabled ? {} : { disabled: false }),
          serviceRequirements: {
            some: {
              serviceId: serviceId
            }
          }
        },
        include,
      });
      
      // Process data for frontend if including services
      const processedDocuments = includeServices 
        ? documents.map((doc: any) => ({
            ...doc,
            documentName: doc.name, // Add alias for frontend compatibility
            services: doc.serviceRequirements.map((sr: any) => ({
              id: sr.service.id,
              name: sr.service.name
            }))
          }))
        : documents;
      
      // Return the documents
      return NextResponse.json({ documents: processedDocuments });
    }

    // Otherwise fetch all documents
    const documents = await prisma.dSXRequirement.findMany({
      where,
      include,
    });

    // Process data for frontend if including services
    const processedDocuments = includeServices 
      ? documents.map((doc: any) => ({
          ...doc,
          documentName: doc.name, // Add alias for frontend compatibility
          services: doc.serviceRequirements.map((sr: any) => ({
            id: sr.service.id,
            name: sr.service.name
          }))
        }))
      : documents.map((doc: any) => ({
          ...doc,
          documentName: doc.name, // Always add the alias for consistency
        }));

    return NextResponse.json({ documents: processedDocuments });
  } catch (error: unknown) {
    logger.error('Error in GET data-rx documents route', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data-rx/documents
 *
 * Creates a new document requirement or updates an existing one
 *
 * Required permissions: global_config (internal users only)
 *
 * Body: {
 *   id?: string - If provided, updates existing document
 *   name?: string - Document name (API usage)
 *   documentName?: string - Document name (frontend usage)
 *   instructions?: string - Instructions for the document
 *   scope?: string - Scope information
 *   retentionHandling?: string - Data retention policy (default: 'no_delete')
 *   disabled?: boolean - Whether document is disabled (default: false)
 * }
 *
 * Returns: DocumentRequirement with documentName alias
 *
 * Breaking change: Legacy 'dsx' permission is no longer supported.
 * Users must have 'global_config' permission to access this endpoint.
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions (requires global_config)
 *   - 400: Invalid request body or missing required fields
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always check permissions
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Extract fields from request body
    // Support both API naming (name) and frontend naming (documentName)
    const { 
      id,
      documentName, // From frontend
      name, // Direct API usage
      instructions,
      scope,
      retentionHandling,
      type = 'document',
      disabled = false
    } = body;

    // Use documentName if provided, otherwise fall back to name
    const documentNameToUse = documentName || name;

    // Validate required fields
    if (!documentNameToUse) {
      return NextResponse.json({ error: "Document name is required" }, { status: 400 });
    }

    logger.info('Creating document', { documentName: documentNameToUse });

    try {
      let document;
      let documentData;

      if (id) {
        // Fetch existing document to preserve PDF metadata
        const existingDocument = await prisma.dSXRequirement.findUnique({
          where: { id },
          select: { documentData: true }
        });

        // Parse existing documentData to preserve PDF fields
        let existingData: any = {};
        if (existingDocument?.documentData) {
          try {
            existingData = typeof existingDocument.documentData === 'string'
              ? JSON.parse(existingDocument.documentData)
              : existingDocument.documentData;
          } catch (e) {
            logger.warn('Failed to parse existing documentData', { documentId: id });
          }
        }

        // Merge new data while preserving PDF fields
        documentData = {
          ...existingData, // Preserve existing fields like pdfPath, pdfFilename, pdfFileSize
          instructions: instructions || "",
          scope: scope || "",
          retentionHandling: retentionHandling || "no_delete"
        };

        // Update existing document
        document = await prisma.dSXRequirement.update({
          where: { id },
          data: {
            name: documentNameToUse,
            type,
            documentData,
            disabled
          }
        });
        
        logger.info('Updated existing document', { documentId: document.id, documentName: documentNameToUse });
      } else {
        // For new documents, create documentData without PDF fields
        documentData = {
          instructions: instructions || "",
          scope: scope || "",
          retentionHandling: retentionHandling || "no_delete"
        };

        // Generate unique fieldKey for new document
        const fieldKey = await generateFieldKey(documentNameToUse, prisma);

        // Create new document
        document = await prisma.dSXRequirement.create({
          data: {
            name: documentNameToUse,
            type,
            fieldKey,
            documentData,
            disabled
          }
        });

        logger.info('Created new document', { documentId: document.id, documentName: documentNameToUse });
      }

      // Add documentName field for frontend compatibility
      const response = {
        ...document,
        documentName: document.name
      };

      return NextResponse.json(response);
    } catch (dbError: unknown) {
      logDatabaseError('create_document', dbError as Error, session?.user?.id);
      return NextResponse.json(
        { error: "Database error while creating document" },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    logger.error('Error in POST data-rx documents route', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data-rx/documents
 *
 * Soft-deletes a document requirement by marking it as disabled
 *
 * Required permissions: global_config (internal users only)
 *
 * Query params:
 *   - id: string (required) - Document ID to disable
 *
 * Returns: { success: true, message: string }
 *
 * Note: This is a soft delete - documents are disabled, not permanently deleted
 * to maintain data integrity and audit trails.
 *
 * Breaking change: Legacy 'dsx' permission is no longer supported.
 * Users must have 'global_config' permission to access this endpoint.
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions (requires global_config)
 *   - 400: Missing document ID
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Always check permissions
    if (!canAccessDataRx(session.user)) {
      return NextResponse.json({ error: "Forbidden - Insufficient permissions" }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 });
    }

    try {
      // Instead of deleting, we'll disable the document
      const document = await prisma.dSXRequirement.update({
        where: { id },
        data: { disabled: true }
      });
      
      logger.info('Disabled document', { documentId: document.id });

      return NextResponse.json({ success: true, message: "Document disabled successfully" });
    } catch (dbError: unknown) {
      logDatabaseError('disable_document', dbError as Error, session?.user?.id);
      return NextResponse.json(
        { error: "Database error while disabling document" },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    logger.error('Error in DELETE data-rx documents route', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: "An error occurred while processing your request" },
      { status: 500 }
    );
  }
}