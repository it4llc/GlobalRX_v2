// /GlobalRX_v2/src/app/api/services/[id]/comments/[commentId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ServiceCommentService } from '@/services/service-comment-service';
import { updateServiceCommentSchema } from '@/lib/validations/service-comment';
import logger from '@/lib/logger';

/**
 * PUT /api/services/[id]/comments/[commentId]
 *
 * Updates an existing comment (internal users only)
 *
 * Required permissions: Must be an internal user with access to the service
 *
 * Body: { finalText?: string, isInternalOnly?: boolean }
 * Returns: Updated ServiceComment object with relations
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions (vendor users cannot edit)
 *   400: Invalid input
 *   404: Comment not found
 *   500: Server error
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Check if user is internal (vendors and customers cannot edit comments)
    const userType = session.user.userType || 'internal';
    if (userType === 'vendor' || userType === 'customer') {
      return NextResponse.json({ error: 'Only internal users can edit comments' }, { status: 403 });
    }

    // Step 3: Validate user has access to the service
    const service = new ServiceCommentService();
    const hasAccess = await service.validateUserAccess(
      params.id,
      session.user.id,
      userType
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this service' }, { status: 403 });
    }

    // Step 4: Validate input
    const body = await request.json();

    // Check if at least one field is provided
    if (!body.finalText && body.isInternalOnly === undefined) {
      return NextResponse.json({ error: 'At least one field must be provided for update' }, { status: 400 });
    }

    const validation = updateServiceCommentSchema.safeParse(body);

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || 'Invalid input';
      const field = validation.error.errors[0]?.path[0];

      // Return specific error messages for known validation issues
      if (field === 'finalText' && errorMessage.includes('empty')) {
        return NextResponse.json({ error: 'Comment text cannot be empty' }, { status: 400 });
      }
      if (field === 'finalText' && errorMessage.includes('1000')) {
        return NextResponse.json({ error: 'Comment text cannot exceed 1000 characters' }, { status: 400 });
      }

      return NextResponse.json({
        error: errorMessage,
        details: validation.error.errors
      }, { status: 400 });
    }

    // Step 5: Update the comment
    const updatedComment = await service.updateComment(
      params.commentId,
      validation.data,
      session.user.id
    );

    // Transform the response to match expected format
    const response = {
      id: updatedComment.id,
      serviceId: updatedComment.serviceId,
      templateId: updatedComment.templateId,
      finalText: updatedComment.finalText,
      isInternalOnly: updatedComment.isInternalOnly,
      createdBy: updatedComment.createdBy,
      createdAt: updatedComment.createdAt.toISOString(),
      updatedBy: updatedComment.updatedBy,
      updatedAt: updatedComment.updatedAt ? updatedComment.updatedAt.toISOString() : null,
      template: {
        shortName: updatedComment.template.shortName,
        longName: updatedComment.template.longName
      },
      createdByUser: {
        name: `${updatedComment.createdByUser.firstName || ''} ${updatedComment.createdByUser.lastName || ''}`.trim() || updatedComment.createdByUser.email,
        email: updatedComment.createdByUser.email
      },
      ...(updatedComment.updatedByUser && {
        updatedByUser: {
          name: `${updatedComment.updatedByUser.firstName || ''} ${updatedComment.updatedByUser.lastName || ''}`.trim() || updatedComment.updatedByUser.email,
          email: updatedComment.updatedByUser.email
        }
      })
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message === 'Comment not found') {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      }
      if (error.message.includes('Comment text')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    logger.error('Error updating service comment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      commentId: params.commentId
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/services/[id]/comments/[commentId]
 *
 * Deletes an existing comment (internal users only)
 *
 * Required permissions: Must be an internal user with access to the service
 *
 * Returns: Success confirmation
 *
 * Errors:
 *   401: Not authenticated
 *   403: Insufficient permissions (vendor users cannot delete)
 *   404: Comment not found
 *   500: Server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    // Step 1: Authentication check
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Step 2: Check if user is internal (vendors and customers cannot delete comments)
    const userType = session.user.userType || 'internal';
    if (userType === 'vendor' || userType === 'customer') {
      return NextResponse.json({ error: 'Only internal users can delete comments' }, { status: 403 });
    }

    // Step 3: Validate user has access to the service
    const service = new ServiceCommentService();
    const hasAccess = await service.validateUserAccess(
      params.id,
      session.user.id,
      userType
    );

    if (!hasAccess) {
      return NextResponse.json({ error: 'You do not have access to this service' }, { status: 403 });
    }

    // Step 4: Delete the comment
    await service.deleteComment(params.commentId, session.user.id);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    // Handle specific business logic errors
    if (error instanceof Error) {
      if (error.message === 'Comment not found') {
        return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      }
    }

    logger.error('Error deleting service comment', {
      error: error instanceof Error ? error.message : 'Unknown error',
      commentId: params.commentId
    });

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}