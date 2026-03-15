// src/app/api/data-rx/documents/[id]/upload-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canAccessDataRx } from '@/lib/auth-utils';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

// Define the maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * POST /api/data-rx/documents/[id]/upload-pdf
 *
 * Uploads a PDF file for a specific document requirement
 *
 * Required permissions: global_config (internal users only)
 *
 * Path params:
 *   - id: string - Document requirement ID
 *
 * Form data:
 *   - pdfFile: File - PDF file to upload (max 5MB, PDF format only)
 *
 * Returns: { success: true }
 *
 * Security improvement: Now includes proper permission checking.
 * Previously this endpoint was missing authorization checks.
 *
 * Breaking change: Legacy 'dsx' permission is no longer supported.
 * Users must have 'global_config' permission to access this endpoint.
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions (requires global_config)
 *   - 404: Document not found
 *   - 400: Invalid file (not PDF, too large, or missing)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check permissions - must have Data Rx access
    if (!canAccessDataRx(session.user)) {
      logger.warn('User attempted to upload PDF without Data Rx permission', {
        userId: session.user.id,
        documentId: params.id
      });
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      );
    }

    // Check if the document requirement exists
    const document = await prisma.dSXRequirement.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        type: true,
        documentData: true,
        disabled: true
      }
    });

    if (!document || document.type !== 'document') {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.disabled) {
      return NextResponse.json(
        { error: 'Document is disabled' },
        { status: 400 }
      );
    }

    // Get the form data from the request
    const formData = await request.formData();
    const pdfFile = formData.get('pdfFile') as File;

    if (!pdfFile) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Check file type
    if (pdfFile.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    // Check file size
    if (pdfFile.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds the 5MB limit' },
        { status: 400 }
      );
    }

    // Convert the file to an ArrayBuffer
    const fileBuffer = await pdfFile.arrayBuffer();
    
    // Create directory for PDFs if it doesn't exist
    const uploadDir = join(process.cwd(), 'uploads', 'documents');
    await mkdir(uploadDir, { recursive: true });
    
    // Generate a unique filename
    const timestamp = Date.now();
    const filename = `${params.id}_${timestamp}.pdf`;
    const filePath = join(uploadDir, filename);

    // Save the file
    await writeFile(filePath, Buffer.from(fileBuffer));

    // Parse existing documentData
    let documentData: any = {};
    try {
      if (document.documentData) {
        documentData = typeof document.documentData === 'string'
          ? JSON.parse(document.documentData)
          : document.documentData;
      }
    } catch (e) {
      logger.warn('Failed to parse existing documentData', { documentId: params.id });
    }
    
    // Update documentData with PDF metadata
    const updatedDocumentData = {
      ...documentData,
      pdfPath: `/uploads/documents/${filename}`, // Store relative path
      pdfFilename: pdfFile.name,
      pdfFileSize: pdfFile.size
    };

    // Update the DSXRequirement record with PDF information in documentData
    await prisma.dSXRequirement.update({
      where: { id: params.id },
      data: {
        documentData: JSON.stringify(updatedDocumentData),
        updatedAt: new Date(),
      },
    });

    logger.info('PDF template uploaded successfully', {
      documentId: params.id,
      filename: filename,
      fileSize: pdfFile.size,
      originalName: pdfFile.name,
      userId: session.user.id
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error uploading PDF file:', error);

    // Return more detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && 'cause' in error ? error.cause : undefined;

    return NextResponse.json(
      {
        error: 'Failed to upload PDF file',
        message: errorMessage,
        details: errorDetails
      },
      { status: 500 }
    );
  }
}