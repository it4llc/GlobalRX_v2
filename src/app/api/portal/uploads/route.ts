// /GlobalRX_v2/src/app/api/portal/uploads/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import logger from '@/lib/logger';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

// Allowed file types for document uploads
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * POST /api/portal/uploads - Upload document for draft orders
 *
 * BUG FIX: Created to solve document persistence issue in draft orders.
 * PROBLEM: File objects cannot be JSON serialized - when order forms called
 * JSON.stringify() on form data containing uploadedDocuments with File objects,
 * they became empty objects {}, causing document loss on save.
 * SOLUTION: Immediate upload pattern - files are uploaded to disk immediately
 * when selected, returning JSON-serializable metadata instead of File objects.
 * This prevents data loss and allows documents to persist in draft orders.
 *
 * Accepts FormData with a file and immediately saves it to disk,
 * returning metadata that can be JSON serialized (not a File object).
 *
 * Required authentication: Customer portal user
 *
 * Body: FormData with:
 *   - file: The document file
 *   - documentId: Requirement/field ID this document is for
 *   - previousFile: (optional) Path to old file if replacing
 *
 * Returns: { success: true, metadata: { ... } }
 *
 * Errors:
 *   401: Not authenticated
 *   400: Invalid file or missing required fields
 *   500: Upload failure
 */
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse FormData
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      logger.error('Failed to parse FormData:', error);
      return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
    }

    // Get the file from FormData
    const file = formData.get('file') as File | null;
    const documentId = formData.get('documentId') as string | null;
    const previousFile = formData.get('previousFile') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Validate file type
    const fileExtension = path.extname(file.name).toLowerCase();
    if (!ALLOWED_MIME_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json({
        error: `File type not allowed. Allowed types: PDF, PNG, JPG, JPEG, DOC, DOCX`
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File size exceeds limit of 10MB`
      }, { status: 400 });
    }

    // Sanitize filename - remove special characters but preserve extension
    const originalName = file.name;
    const baseName = path.basename(originalName, fileExtension);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 100);
    const sanitizedFilename = `${sanitizedBaseName}${fileExtension}`;

    // Create directory structure: uploads/draft-documents/[userId]/[documentId]/
    const userId = session.user.id;
    const uploadDir = path.join(
      process.cwd(),
      'uploads',
      'draft-documents',
      userId,
      documentId
    );

    // Create directory if it doesn't exist
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (mkdirError) {
      logger.error('Failed to create upload directory:', {
        error: mkdirError,
        uploadDir
      });
      // Continue anyway, writeFileSync will fail if directory creation failed
    }

    // If replacing a file, delete the old one
    if (previousFile) {
      const oldFilePath = path.join(process.cwd(), previousFile);
      if (fs.existsSync(oldFilePath)) {
        try {
          fs.unlinkSync(oldFilePath);
          logger.info('Deleted previous file:', {
            userId,
            documentId,
            previousFile
          });
        } catch (error) {
          logger.warn('Failed to delete previous file:', {
            error,
            previousFile
          });
        }
      }
    }

    // Generate unique filename to avoid collisions
    const uniqueId = randomUUID().slice(0, 8);
    const finalFilename = `${uniqueId}_${sanitizedFilename}`;
    const filePath = path.join(uploadDir, finalFilename);
    const relativePath = path.join('uploads', 'draft-documents', userId, documentId, finalFilename);

    // Save file to disk
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      fs.writeFileSync(filePath, buffer);
    } catch (error) {
      logger.error('Failed to save file:', { error, filename: finalFilename });
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Prepare metadata response (serializable, not a File object)
    const metadata = {
      documentId,
      filename: sanitizedFilename,
      originalName,
      storagePath: relativePath,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId,
    };

    logger.info('Document uploaded successfully:', {
      userId,
      documentId,
      filename: finalFilename,
      size: file.size,
    });

    return NextResponse.json({
      success: true,
      metadata
    }, { status: 200 });

  } catch (error) {
    logger.error('Unexpected error in document upload:', error);
    return NextResponse.json({
      error: 'Failed to upload file'
    }, { status: 500 });
  }
}