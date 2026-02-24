// src/app/api/data-rx/documents/[id]/upload-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import logger from '@/lib/logger';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

// Define the maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

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

    // Check if the document exists
    const document = await prisma.document.findUnique({
      where: { id: params.id },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
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
    const filename = `${params.id}_${Date.now()}.pdf`;
    const filePath = join(uploadDir, filename);
    
    // Save the file
    await writeFile(filePath, Buffer.from(fileBuffer));
    
    // Update the document record with file information
    await prisma.document.update({
      where: { id: params.id },
      data: {
        pdfPath: filePath,
        hasFile: true,
        updatedAt: new Date(),
        updatedBy: session.user.email || 'unknown',
      },
    });

    // Create a version record
    await prisma.documentVersion.create({
      data: {
        documentId: params.id,
        changes: {
          pdfFile: { 
            from: document.hasFile ? 'existing-file' : null, 
            to: 'updated-file'
          }
        },
        timestamp: new Date(),
        modifiedBy: session.user.email || 'unknown',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error uploading PDF file:', error);
    return NextResponse.json(
      { error: 'Failed to upload PDF file' },
      { status: 500 }
    );
  }
}