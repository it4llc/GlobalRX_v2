// src/lib/services/document-download.service.ts
import path from 'path';
import fs from 'fs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';

/**
 * Validates that a file path does not contain path traversal attempts
 * @param filePath The file path to validate
 * @returns True if path is safe, false otherwise
 */
export function validateFilePath(filePath: string): boolean {
  // Reject any path containing ".." or absolute paths
  if (filePath.includes('..') || path.isAbsolute(filePath)) {
    logger.warn('Potential path traversal attempt detected', { filePath });
    return false;
  }

  // Ensure path doesn't escape uploads directory
  const normalizedPath = path.normalize(filePath);
  if (normalizedPath.startsWith('..') || normalizedPath.startsWith('/')) {
    logger.warn('Path normalization detected escape attempt', { filePath, normalizedPath });
    return false;
  }

  return true;
}

/**
 * Fetches document metadata from an order_data record
 * @param orderDataId The UUID of the order_data record
 * @returns Document metadata or null if not found/invalid
 */
export async function getDocumentFromOrderData(orderDataId: string) {
  try {
    const orderData = await prisma.orderData.findUnique({
      where: { id: orderDataId },
      select: {
        id: true,
        fieldValue: true,
        orderItemId: true,
        orderItem: {
          select: {
            orderId: true,
            order: {
              select: {
                customerId: true
              }
            },
            serviceFulfillment: {
              select: {
                assignedVendorId: true
              }
            }
          }
        }
      }
    });

    if (!orderData) {
      return null;
    }

    // Parse the fieldValue JSON to get document metadata
    let documentMetadata;
    try {
      documentMetadata = typeof orderData.fieldValue === 'string'
        ? JSON.parse(orderData.fieldValue)
        : orderData.fieldValue;
    } catch (error) {
      logger.error('Failed to parse document metadata', {
        orderDataId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }

    // Validate required fields
    if (!documentMetadata?.storagePath || !documentMetadata?.originalName) {
      logger.warn('Document metadata missing required fields', {
        orderDataId,
        hasStoragePath: !!documentMetadata?.storagePath,
        hasOriginalName: !!documentMetadata?.originalName
      });
      return null;
    }

    return {
      ...documentMetadata,
      orderDataId,
      orderId: orderData.orderItem?.orderId,
      customerId: orderData.orderItem?.order?.customerId,
      vendorId: orderData.orderItem?.serviceFulfillment?.assignedVendorId
    };
  } catch (error) {
    logger.error('Error fetching document from order_data', {
      orderDataId,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return null;
  }
}

/**
 * Creates a NextResponse that streams a file to the client
 * @param filePath The path to the file (relative to uploads directory)
 * @param filename The original filename to send to the client
 * @param mimeType The MIME type of the file
 * @returns NextResponse with file stream
 */
export async function streamFile(
  filePath: string,
  filename: string,
  mimeType: string
): Promise<NextResponse> {
  try {
    // Validate the file path to prevent path traversal
    if (!validateFilePath(filePath)) {
      logger.error('Invalid file path detected', { filePath });
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Construct full path to file
    const uploadsDir = process.env.UPLOADS_DIR || process.cwd();
    const fullPath = path.join(uploadsDir, filePath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      logger.warn('Document file not found on disk', { filePath: fullPath });
      return NextResponse.json(
        { error: 'Document not available' },
        { status: 404 }
      );
    }

    // Read the file
    const fileBuffer = fs.readFileSync(fullPath);

    // Determine content disposition based on mime type
    // For PDFs and images, use inline to display in browser
    // For other types, force download
    const isViewable = mimeType.startsWith('image/') || mimeType === 'application/pdf';
    const contentDisposition = isViewable
      ? `inline; filename="${encodeURIComponent(filename)}"`
      : `attachment; filename="${encodeURIComponent(filename)}"`;

    // Create response with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': contentDisposition,
        'Content-Length': fileBuffer.length.toString(),
        // Security headers
        'X-Content-Type-Options': 'nosniff',
        // Cache for 1 hour since documents are immutable
        'Cache-Control': 'private, max-age=3600'
      }
    });
  } catch (error) {
    logger.error('Error streaming file', {
      filePath,
      filename,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}

/**
 * Logs document access for audit trail
 * @param userId The ID of the user accessing the document
 * @param documentId The ID of the document being accessed
 * @param success Whether the access was successful
 */
export function logDocumentAccess(
  userId: string,
  documentId: string,
  success: boolean
): void {
  logger.info('Document access', {
    userId,
    documentId,
    success,
    timestamp: new Date().toISOString()
  });
}