// /GlobalRX_v2/src/app/api/portal/documents/[id]/download-template/route.ts
// API route for downloading PDF templates for customer orders

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import * as fs from 'fs/promises';
import * as path from 'path';
import logger from '@/lib/logger';
// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Maximum file size (50MB) to prevent DoS attacks
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Type for parsed document data from database
interface ParsedDocumentData {
  pdfPath?: string;
  pdfFilename?: string;
  filename?: string;
  [key: string]: unknown;
}

/**
 * GET /api/portal/documents/[id]/download-template
 *
 * Downloads a PDF template file for a specific document requirement
 *
 * Required permissions: Must be authenticated as a customer user
 *
 * Returns: PDF file stream with appropriate headers
 *
 * Errors:
 *   401: Not authenticated
 *   403: Access denied (not a customer user)
 *   404: Document not found or template not available
 *   500: Internal server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Step 1: Always check authentication first
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Check if user is a customer user
    if (session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Step 3: Validate document ID format
    if (!UUID_REGEX.test(params.id)) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Step 4: Fetch document from database
    const document = await prisma.dSXRequirement.findUnique({
      where: { id: params.id }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Step 5: Check if document is disabled
    if (document.disabled) {
      return NextResponse.json(
        { error: 'This document template is no longer available' },
        { status: 404 }
      );
    }

    // Step 6: Parse documentData to get PDF path
    let documentData: ParsedDocumentData = {};
    try {
      documentData = document.documentData ? JSON.parse(document.documentData as string) as ParsedDocumentData : {};
    } catch {
      // If JSON parsing fails, treat as no template
      return NextResponse.json(
        { error: 'No template available for this document' },
        { status: 404 }
      );
    }

    // Step 7: Check if PDF template exists
    if (!documentData.pdfPath || documentData.pdfPath.trim() === '') {
      return NextResponse.json(
        { error: 'No template available for this document' },
        { status: 404 }
      );
    }

    // Step 8: Validate and construct safe file path
    // Reject paths containing directory traversal patterns
    if (documentData.pdfPath.includes('..') || documentData.pdfPath.includes('~')) {
      logger.warn('Potential path traversal attempt', {
        documentId: params.id,
        pdfPath: documentData.pdfPath,
        userId: session.user?.id
      });
      return NextResponse.json(
        { error: 'Invalid template path' },
        { status: 400 }
      );
    }

    // Ensure file has .pdf extension
    if (!documentData.pdfPath.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Template must be a PDF file' },
        { status: 400 }
      );
    }

    // Remove leading slash if present for path.join to work correctly
    const cleanPdfPath = documentData.pdfPath.startsWith('/')
      ? documentData.pdfPath.substring(1)
      : documentData.pdfPath;

    // Construct and validate full file path
    const filePath = path.join(process.cwd(), cleanPdfPath);
    const resolvedPath = path.resolve(filePath);
    const baseDir = path.resolve(process.cwd());

    // Ensure resolved path is within the application directory
    if (!resolvedPath.startsWith(baseDir)) {
      logger.warn('Path traversal prevented', {
        documentId: params.id,
        resolvedPath,
        baseDir,
        userId: session.user?.id
      });
      return NextResponse.json(
        { error: 'Template file not found. Please contact support.' },
        { status: 404 }
      );
    }

    // Step 9: Check if file exists and get stats
    let stats: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stats = await fs.stat(resolvedPath);
    } catch (statError) {
      // File doesn't exist
      logger.warn('Template file not found', {
        documentId: params.id,
        resolvedPath,
        error: statError instanceof Error ? statError.message : String(statError)
      });
      return NextResponse.json(
        { error: 'Template file not found. Please contact support.' },
        { status: 404 }
      );
    }

    // Check file size to prevent DoS attacks
    if (stats.size > MAX_FILE_SIZE) {
      logger.warn('Template file too large', {
        documentId: params.id,
        fileSize: stats.size,
        maxSize: MAX_FILE_SIZE
      });
      return NextResponse.json(
        { error: 'Template file is too large' },
        { status: 413 }
      );
    }

    // Step 10: Read the PDF file
    try {
      const fileBuffer = await fs.readFile(resolvedPath);

      // Step 11: Determine filename for download
      const downloadFilename = documentData.pdfFilename || documentData.filename || 'document.pdf';

      // Step 12: Return the PDF with appropriate headers
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${downloadFilename}"`,
          'Content-Length': stats.size.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      });
    } catch (readError) {
      // File exists but can't be read
      return NextResponse.json(
        { error: 'Error reading template file' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('Error downloading template', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      documentId: params.id
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}