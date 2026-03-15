// /GlobalRX_v2/src/app/api/data-rx/documents/[id]/route.ts
// API route for fetching and updating individual document data

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessDataRx } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { z } from 'zod';

// Validation schema for document updates
const updateDocumentSchema = z.object({
  documentName: z.string().min(1, "Document name is required"),
  scope: z.enum(['per_search', 'per_case']).optional(),
  instructions: z.string().optional(),
  retentionHandling: z.string().optional()
});

/**
 * GET /api/data-rx/documents/[id]
 *
 * Fetches a single document's data for editing
 *
 * Required permissions: global_config (Data Rx access)
 *
 * Returns: { document: { ... } }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   404: Document not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - must have Data Rx access
    if (!canAccessDataRx(session.user)) {
      logger.warn('User attempted to fetch document without Data Rx permission', {
        userId: session.user.id,
        documentId: params.id
      });
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Fetch the document
    const document = await prisma.dSXRequirement.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        type: true,
        documentData: true,
        disabled: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!document || document.type !== 'document') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Parse documentData
    let parsedDocumentData: any = {};
    if (document.documentData) {
      try {
        parsedDocumentData = typeof document.documentData === 'string'
          ? JSON.parse(document.documentData)
          : document.documentData;
      } catch (e) {
        logger.warn('Failed to parse documentData', { documentId: params.id });
        parsedDocumentData = {};
      }
    }

    // Format response to match what EditDocumentModal expects
    const response = {
      document: {
        id: document.id,
        documentName: document.name, // EditDocumentModal expects 'documentName'
        instructions: parsedDocumentData.instructions || '',
        scope: parsedDocumentData.scope || 'per_case',
        retentionHandling: parsedDocumentData.retentionHandling || 'global_rule',
        hasExistingFile: !!(parsedDocumentData.pdfPath), // Check if PDF exists
        disabled: document.disabled,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
        versions: [] // Placeholder for version history if needed
      }
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Failed to fetch document' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/data-rx/documents/[id]
 *
 * Updates a document's data
 *
 * Required permissions: global_config (Data Rx access)
 *
 * Body: { documentName, scope, instructions, retentionHandling }
 *
 * Returns: { success: true }
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions
 *   404: Document not found
 *   400: Invalid input data
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check permissions - must have Data Rx access
    if (!canAccessDataRx(session.user)) {
      logger.warn('User attempted to update document without Data Rx permission', {
        userId: session.user.id,
        documentId: params.id
      });
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateDocumentSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input data', details: validation.error.flatten() },
        { status: 400 }
      );
    }

    const { documentName, scope, instructions, retentionHandling } = validation.data;

    // Fetch existing document to preserve PDF metadata
    const existingDocument = await prisma.dSXRequirement.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        type: true,
        documentData: true
      }
    });

    if (!existingDocument || existingDocument.type !== 'document') {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Parse existing documentData to preserve PDF fields
    let existingData: any = {};
    if (existingDocument.documentData) {
      try {
        existingData = typeof existingDocument.documentData === 'string'
          ? JSON.parse(existingDocument.documentData)
          : existingDocument.documentData;
      } catch (e) {
        logger.warn('Failed to parse existing documentData', { documentId: params.id });
      }
    }

    // Merge new data while preserving PDF fields
    const updatedDocumentData = {
      ...existingData, // Preserve pdfPath, pdfFilename, pdfFileSize
      instructions: instructions || '',
      scope: scope || 'per_case',
      retentionHandling: retentionHandling || 'global_rule'
    };

    // Update the document
    await prisma.dSXRequirement.update({
      where: { id: params.id },
      data: {
        name: documentName,
        documentData: JSON.stringify(updatedDocumentData),
        updatedAt: new Date()
      }
    });

    logger.info('Updated document', {
      documentId: params.id,
      documentName,
      userId: session.user.id
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error updating document:', error);
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    );
  }
}