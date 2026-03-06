// /GlobalRX_v2/src/app/api/orders/[id]/services/comments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceCommentService } from '@/services/service-comment-service';
import { ServiceCommentResponse } from '@/types/service-comment';
import logger from '@/lib/logger';

/**
 * GET /api/orders/[id]/services/comments
 *
 * Retrieves all comments for all services in an order (for initial page load efficiency)
 *
 * Required permissions: Must have access to view the order
 *
 * Returns: { serviceComments: { [serviceId]: { serviceName, serviceStatus, comments, total } } }
 *
 * Visibility Filtering:
 * - Internal users: See all comments
 * - Vendor users: See all comments for their assigned services
 * - Customers: See only comments where isInternalOnly = false
 *
 * Errors:
 *   401: Not authenticated
 *   403: No access to order
 *   404: Order not found
 *   500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Verify user has access to the order
    const service = new ServiceCommentService();
    const userType = session.user.type || 'internal';

    const hasAccess = await service.validateOrderAccess(
      params.id,
      session.user.id,
      userType
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to view this order' }, { status: 403 });
    }

    // Step 3: Get all service comments for the order
    const serviceComments = await service.getOrderServiceComments(
      params.id,
      userType,
      session.user.id
    );

    // Transform the response to match expected format
    const transformedResponse: Record<string, {
      serviceName: string;
      serviceStatus: string;
      comments: ServiceCommentResponse[];
      total: number;
    }> = {};

    for (const [serviceId, serviceData] of Object.entries(serviceComments)) {
      const data = serviceData as {
        serviceName: string;
        serviceStatus: string;
        comments: ServiceCommentResponse[];
        total: number;
      };
      transformedResponse[serviceId] = {
        serviceName: data.serviceName,
        serviceStatus: data.serviceStatus,
        comments: data.comments.map((comment) => ({
          id: comment.id,
          serviceId: comment.serviceId,
          templateId: comment.templateId,
          finalText: comment.finalText,
          isInternalOnly: comment.isInternalOnly,
          createdBy: comment.createdBy,
          createdAt: comment.createdAt.toISOString(),
          updatedBy: comment.updatedBy,
          updatedAt: comment.updatedAt ? comment.updatedAt.toISOString() : null,
          template: {
            shortName: comment.template.shortName,
            longName: comment.template.longName
          },
          createdByUser: {
            name: `${comment.createdByUser.firstName || ''} ${comment.createdByUser.lastName || ''}`.trim() || comment.createdByUser.email,
            email: comment.createdByUser.email
          },
          ...(comment.updatedByUser && {
            updatedByUser: {
              name: `${comment.updatedByUser.firstName || ''} ${comment.updatedByUser.lastName || ''}`.trim() || comment.updatedByUser.email,
              email: comment.updatedByUser.email
            }
          })
        })),
        total: data.total
      };
    }

    return NextResponse.json({
      serviceComments: transformedResponse
    }, { status: 200 });
  } catch (error) {
    logger.error('Error retrieving order service comments', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: params.id
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}