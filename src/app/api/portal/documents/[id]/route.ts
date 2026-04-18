// src/app/api/portal/documents/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { z } from 'zod';
import {
  getDocumentFromOrderData,
  streamFile
} from '@/lib/services/document-download.service';
import logger from '@/lib/logger';

/**
 * GET /api/portal/documents/[id]
 *
 * Download a document uploaded during order submission (customer portal access)
 *
 * Required permissions: Must be authenticated customer user with order ownership
 *
 * Params:
 *   - id: UUID of the order_data record containing the document
 *
 * Returns: File stream with appropriate content-type headers
 *
 * Errors:
 *   - 401: Not authenticated or not a customer user
 *   - 403: Customer does not own the order
 *   - 404: Document not found or file missing on disk
 *   - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Authentication check - must be a customer user
    const session = await getServerSession(authOptions);
    if (!session || session.user.userType !== 'customer') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Validate and parse the documentId parameter
    const { id: documentId } = await params;
    const validationResult = z.string().uuid('Invalid document ID format').safeParse(documentId);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid document ID format' },
        { status: 400 }
      );
    }

    // Step 3: Get customer ID from session (NOT session.user.id!)
    const customerId = session.user.customerId;
    if (!customerId) {
      logger.error('Customer user without customerId', {
        userId: session.user.id,
        documentId
      });
      return NextResponse.json({ error: 'Customer not found' }, { status: 401 });
    }

    // Step 4: Fetch the document metadata from order_data
    const document = await getDocumentFromOrderData(documentId);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Step 5: Verify customer ownership
    // getDocumentFromOrderData already fetched customerId through the relation chain
    if (document.customerId !== customerId) {
      logger.warn('Customer attempted to access document from different customer', {
        userId: session.user.id,
        userCustomerId: customerId,
        documentCustomerId: document.customerId,
        documentId
      });
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Step 6: Stream the file
    // streamFile handles path validation internally
    // Using originalName field which is what's stored in the document metadata
    return await streamFile(
      document.storagePath,
      document.originalName,
      document.mimeType
    );

  } catch (error) {
    logger.error('Error downloading document:', error);
    return NextResponse.json(
      { error: 'Failed to download document' },
      { status: 500 }
    );
  }
}