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
 * IMPORTANT: This endpoint addresses the ServiceFulfillment ID vs OrderItem ID mismatch:
 * - Comments are stored with orderItemId (ServiceComment.orderItemId → OrderItem.id)
 * - UI components work with serviceFulfillmentId (ServicesFulfillment.id)
 * - This endpoint bridges that gap by querying through the proper relationship chain
 *
 * Required permissions: Must have access to view the order
 *
 * Returns: { commentsByService: { [serviceFulfillmentId]: { serviceName, serviceStatus, comments, total } } }
 *
 * Visibility Filtering:
 * - Internal users: See all comments
 * - Vendor users: See all comments for their assigned services
 * - Customers: See only comments where isInternalOnly = false
 *
 * Security: Email addresses are stripped from response for data protection
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
    // Step 1: Authentication check - ALWAYS required
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      logger.warn('Unauthorized access attempt to order comments', {
        hasSession: !!session,
        hasUser: !!(session?.user),
        orderId: params.id
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Verify user has access to the order
    const service = new ServiceCommentService();
    const userType = session.user.userType || 'internal';

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

    // Type-safe access to service comments data
    type ServiceCommentsData = {
      serviceName: string;
      serviceStatus: string;
      comments: ServiceCommentResponse[];
      total: number;
    };

    logger.info('Retrieved service comments for order', {
      orderId: params.id,
      userType,
      serviceCount: Object.keys(serviceComments).length,
      services: Object.entries(serviceComments).map(([id, data]) => {
        const typedData = data as ServiceCommentsData;
        return {
          id,
          commentCount: typedData.comments?.length || 0
        };
      })
    });

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
          isStatusChange: comment.isStatusChange,
          statusChangedFrom: comment.statusChangedFrom,
          statusChangedTo: comment.statusChangedTo,
          createdBy: comment.createdBy,
          createdAt: comment.createdAt.toISOString(),
          updatedBy: comment.updatedBy,
          updatedAt: comment.updatedAt ? comment.updatedAt.toISOString() : null,
          template: {
            shortName: comment.template.shortName,
            longName: comment.template.longName,
            name: comment.template.longName
          },
          createdByUser: {
            // Only return name, not email for security
            name: `${comment.createdByUser.firstName || ''} ${comment.createdByUser.lastName || ''}`.trim() || 'User'
          },
          createdByName: `${comment.createdByUser.firstName || ''} ${comment.createdByUser.lastName || ''}`.trim() || 'User',
          ...(comment.updatedByUser && {
            updatedByUser: {
              // Only return name, not email for security
              name: `${comment.updatedByUser.firstName || ''} ${comment.updatedByUser.lastName || ''}`.trim() || 'User'
            },
            updatedByName: `${comment.updatedByUser.firstName || ''} ${comment.updatedByUser.lastName || ''}`.trim() || 'User'
          })
        })),
        total: data.total
      };
    }

    logger.info('Sending transformed response', {
      orderId: params.id,
      serviceCount: Object.keys(transformedResponse).length,
      services: Object.entries(transformedResponse).map(([id, data]) => ({
        id,
        commentCount: data.comments?.length || 0,
        serviceName: data.serviceName
      }))
    });

    return NextResponse.json({
      commentsByService: transformedResponse
    }, { status: 200 });
  } catch (error) {
    logger.error('Error retrieving order service comments', {
      error: error instanceof Error ? error.message : 'Unknown error',
      orderId: params.id
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}