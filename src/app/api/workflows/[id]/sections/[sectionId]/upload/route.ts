// src/app/api/workflows/[id]/sections/[sectionId]/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import fsPromises from 'fs/promises';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { hasPermission } from '@/lib/permission-utils';
import { ALLOWED_FILE_EXTENSIONS, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/types/workflow-section';

/**
 * POST /api/workflows/[id]/sections/[sectionId]/upload
 *
 * Uploads a document for a workflow section of type 'document'.
 * Only accepts PDF and Word documents (.pdf, .docx, .doc) up to 10MB.
 *
 * Required permissions: customer_config.edit or admin
 *
 * Path params:
 *   - id: UUID of the workflow
 *   - sectionId: UUID of the section
 *
 * Body: FormData with 'file' field containing the document
 *
 * Returns: Updated section with fileUrl and fileName
 *
 * Errors:
 *   - 400: No file provided, invalid file type/size, or section is not type 'document'
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions
 *   - 404: Workflow or section not found
 *   - 409: Workflow has active orders
 *   - 500: File save error or database error
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    // Get params safely
    const params = await context.params;
    const { id: workflowId, sectionId } = params;

    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Permission check
    if (!hasPermission(session.user, 'customer_config', 'edit') &&
        !hasPermission(session.user, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse form data early to validate file
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file extension
    const fileName = file.name.toLowerCase();
    const fileExtension = path.extname(fileName);
    if (!ALLOWED_FILE_EXTENSIONS.includes(fileExtension)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `Only PDF and Word documents are allowed (.pdf, .docx, .doc). You provided: ${fileExtension}`
        },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: 'Invalid file type',
          message: `File type ${file.type} is not allowed. Only PDF and Word documents are accepted.`
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: 'File too large',
          message: `File size must not exceed ${MAX_FILE_SIZE / (1024 * 1024)}MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB.`
        },
        { status: 400 }
      );
    }

    // Check if workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Check if section exists and belongs to the workflow
    const section = await prisma.workflowSection.findFirst({
      where: {
        id: sectionId,
        workflowId,
      },
    });

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Validate section type is 'document'
    if (section.type !== 'document') {
      return NextResponse.json(
        {
          error: 'Invalid section type',
          message: 'Files can only be uploaded to sections of type "document"'
        },
        { status: 400 }
      );
    }

    // Business rule: Check if workflow has active orders
    const activeOrdersCount = await prisma.order.count({
      where: {
        statusCode: { in: ['draft', 'processing'] },
        customer: {
          packages: {
            some: {
              workflowId: workflowId
            }
          }
        }
      }
    });

    if (activeOrdersCount > 0) {
      return NextResponse.json(
        {
          error: 'Cannot modify workflow with active orders',
          message: 'This workflow has orders in draft or processing status. Complete or cancel these orders before making changes.'
        },
        { status: 409 }
      );
    }

    // Create directory structure: uploads/workflow-documents/[workflowId]/[sectionId]/
    const uploadDir = path.join(
      process.cwd(),
      'uploads',
      'workflow-documents',
      workflowId,
      sectionId
    );

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      await fsPromises.mkdir(uploadDir, { recursive: true });
    }

    // If section already has a file, delete the old one
    if (section.fileUrl) {
      const oldFilePath = path.join(process.cwd(), section.fileUrl);
      try {
        if (fs.existsSync(oldFilePath)) {
          await fsPromises.unlink(oldFilePath);
        }
      } catch (error) {
        logger.warn('Failed to delete old file:', { error, oldFilePath });
        // Continue anyway - old file may have been manually deleted
      }
    }

    // Generate unique filename to prevent collisions
    const uniqueId = randomUUID().slice(0, 8);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFileName = `${uniqueId}_${sanitizedFileName}`;
    const filePath = path.join(uploadDir, storedFileName);
    const relativePath = path.join('uploads', 'workflow-documents', workflowId, sectionId, storedFileName);

    // Save file to disk
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await fsPromises.writeFile(filePath, buffer);
    } catch (error) {
      logger.error('Failed to save file:', { error, fileName: storedFileName });
      return NextResponse.json({ error: 'Failed to save file' }, { status: 500 });
    }

    // Update section with file information
    const updatedSection = await prisma.workflowSection.update({
      where: { id: sectionId },
      data: {
        fileUrl: relativePath,
        fileName: file.name, // Store original filename for display
      },
    });

    logger.info('Document uploaded for workflow section:', {
      workflowId,
      sectionId,
      fileName: file.name,
      fileSize: file.size,
      uploadedBy: session.user.id
    });

    return NextResponse.json(updatedSection, { status: 201 });

  } catch (error) {
    logger.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}