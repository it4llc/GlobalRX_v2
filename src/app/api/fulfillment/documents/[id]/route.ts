// src/app/api/fulfillment/documents/[id]/route.ts

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
 * GET /api/fulfillment/documents/[id]
 *
 * Download a document uploaded during order submission (internal/admin/vendor access)
 *
 * Required permissions:
 *   - Internal/Admin users: Need fulfillment.view, candidate_workflow.view, or admin permissions
 *   - Vendor users: Can only access documents for orders assigned to them
 *
 * Params:
 *   - id: UUID of the order_data record containing the document
 *
 * Returns: File stream with appropriate content-type headers
 *
 * Errors:
 *   - 401: Not authenticated
 *   - 403: Insufficient permissions or vendor not assigned to order
 *   - 404: Document not found or file missing on disk
 *   - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Step 1: Authentication check - ALWAYS first
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
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

    // Step 3: Check user type
    const userType = session.user.userType;
    const isInternal = userType === 'internal' || userType === 'admin';
    const isVendor = userType === 'vendor';
    const isAdmin = userType === 'admin';

    // Only internal, admin, and vendor users can use this endpoint
    if (!isInternal && !isVendor) {
      logger.warn('Invalid user type attempted to access fulfillment document', {
        userId: session.user.id,
        userType,
        documentId
      });
      return NextResponse.json(
        { error: 'Invalid user type for this endpoint' },
        { status: 403 }
      );
    }

    // Step 4: Check permissions for internal users (vendors checked later)
    if (isInternal && !isAdmin) {
      const permissions = session.user.permissions || {};

      // Check for required permissions using the same patterns as fulfillment/orders/[id]
      const hasFulfillmentPermission =
        permissions.fulfillment === true ||
        permissions.fulfillment === '*' ||
        permissions.fulfillment?.view === true ||
        (typeof permissions.fulfillment === 'object' && permissions.fulfillment !== null) ||
        (Array.isArray(permissions) && permissions.includes('fulfillment')) ||
        (Array.isArray(permissions.fulfillment) && permissions.fulfillment.includes('*')) ||
        (typeof permissions === 'string' && permissions === 'fulfillment');

      const hasCandidateWorkflowPermission =
        permissions.candidate_workflow === true ||
        permissions.candidate_workflow === '*' ||
        permissions.candidate_workflow?.view === true ||
        (typeof permissions.candidate_workflow === 'object' && permissions.candidate_workflow !== null) ||
        (Array.isArray(permissions) && permissions.includes('candidate_workflow')) ||
        (Array.isArray(permissions.candidate_workflow) && permissions.candidate_workflow.includes('*')) ||
        (typeof permissions === 'string' && permissions === 'candidate_workflow');

      const hasAdminPermission =
        permissions.admin === true ||
        session.user.role === 'superadmin';

      if (!hasFulfillmentPermission && !hasCandidateWorkflowPermission && !hasAdminPermission) {
        logger.warn('User lacks required permissions for document access', {
          userId: session.user.id,
          userType,
          permissions,
          documentId
        });
        return NextResponse.json(
          { error: 'Insufficient permissions to download document' },
          { status: 403 }
        );
      }
    }

    // Step 5: Fetch the document metadata from order_data
    const document = await getDocumentFromOrderData(documentId);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Step 6: Additional authorization for vendor users
    if (isVendor) {
      const vendorId = session.user.vendorId;
      if (!vendorId) {
        logger.error('Vendor user without vendorId', {
          userId: session.user.id,
          documentId
        });
        return NextResponse.json({ error: 'Vendor not found' }, { status: 401 });
      }

      // Check if the document's order is assigned to this vendor
      // getDocumentFromOrderData already fetched vendorId through servicesFulfillment
      if (document.vendorId !== vendorId) {
        logger.warn('Vendor attempted to access document from unassigned order', {
          userId: session.user.id,
          userVendorId: vendorId,
          documentVendorId: document.vendorId,
          documentId
        });
        return NextResponse.json(
          { error: 'Access denied - order not assigned to vendor' },
          { status: 403 }
        );
      }
    }

    // Step 7: Stream the file
    // streamFile handles path validation internally
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