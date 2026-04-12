// /GlobalRX_v2/src/services/service-comment-service.ts

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import {
  CreateServiceCommentInput,
  UpdateServiceCommentInput,
  ServiceCommentWithRelations
} from '@/types/service-comment';
import { ActivityTrackingService } from '@/lib/services/activity-tracking.service';

export class ServiceCommentService {
  /**
   * Create a new comment for a service (order item)
   */
  async createComment(
    orderItemId: string,
    data: CreateServiceCommentInput,
    userId: string,
    userType?: 'customer' | 'internal' | 'vendor'
  ) {
    // Validate finalText (these validations mirror Zod but provide service-level clarity)
    if (!data.finalText || data.finalText.trim().length === 0) {
      throw new Error('Comment text cannot be empty');
    }
    if (data.finalText.length > 1000) {
      throw new Error('Comment text cannot exceed 1000 characters');
    }

    // Verify order item exists and fetch order context for access validation
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: { order: true }
    });

    if (!orderItem) {
      throw new Error('Service not found');
    }

    // Verify template exists and is active
    const template = await prisma.commentTemplate.findUnique({
      where: { id: data.templateId }
    });

    if (!template) {
      throw new Error('Invalid template ID');
    }

    if (!template.isActive) {
      throw new Error('Selected template is no longer active');
    }

    // Business rule: Template must be configured for this service type and current status
    // This prevents using inappropriate templates (e.g., "Processing" templates on "Completed" services)
    // OrderItem.serviceId references the Service definition which has the service code
    const serviceDefinition = await prisma.service.findUnique({
      where: { id: orderItem.serviceId },
      select: { code: true }
    });

    if (!serviceDefinition) {
      throw new Error('Service definition not found');
    }

    // Check if the template is configured for this service type and status
    // This ensures users can only use templates appropriate for the current context
    const availability = await prisma.commentTemplateAvailability.findFirst({
      where: {
        templateId: data.templateId,
        serviceCode: serviceDefinition.code,
        status: orderItem.status
      }
    });

    if (!availability) {
      logger.warn('Template availability check failed', {
        templateId: data.templateId,
        serviceCode: serviceDefinition.code,
        status: orderItem.status
      });
      throw new Error('Template not available for this service type and status');
    }

    // Create the comment and mark template as used atomically to ensure data consistency
    // The transaction ensures that if marking the template fails, the comment isn't created
    const comment = await prisma.$transaction(async (tx) => {
      // isInternalOnly defaults to true for security - comments are internal by default
      // to prevent accidentally exposing sensitive information to customers
      const newComment = await tx.serviceComment.create({
        data: {
          orderItemId: orderItemId,
          templateId: data.templateId,
          finalText: data.finalText,
          isInternalOnly: data.isInternalOnly ?? true,
          createdBy: userId
        },
        include: {
          template: true,
          createdByUser: true,
          updatedByUser: true
        }
      });

      // Business rule: Track template usage for analytics and template lifecycle management
      await tx.commentTemplate.update({
        where: { id: data.templateId },
        data: { hasBeenUsed: true }
      });

      // Phase 2B-2: Update activity tracking if user type is provided
      // Determine if comment is customer-visible based on isInternalOnly flag
      if (userType) {
        await ActivityTrackingService.updateOrderItemActivity(
          tx,
          orderItemId,
          userId,
          userType,
          !newComment.isInternalOnly // isCustomerVisible = NOT internal-only
        );
      }

      return newComment;
    });

    logger.info('Service comment created', {
      commentId: comment.id,
      orderItemId: orderItemId,
      userId: userId
    });

    return comment;
  }

  /**
   * Update an existing comment
   */
  async updateComment(
    commentId: string,
    data: UpdateServiceCommentInput,
    userId: string
  ) {
    // Verify comment exists
    const existingComment = await prisma.serviceComment.findUnique({
      where: { id: commentId }
    });

    if (!existingComment) {
      throw new Error('Comment not found');
    }

    // Validate finalText if provided
    if (data.finalText !== undefined) {
      if (data.finalText.trim().length === 0) {
        throw new Error('Comment text cannot be empty');
      }
      if (data.finalText.length > 1000) {
        throw new Error('Comment text cannot exceed 1000 characters');
      }
    }

    // Update the comment
    const updatedComment = await prisma.serviceComment.update({
      where: { id: commentId },
      data: {
        ...(data.finalText !== undefined && { finalText: data.finalText }),
        ...(data.isInternalOnly !== undefined && { isInternalOnly: data.isInternalOnly }),
        updatedBy: userId,
        updatedAt: new Date()
      },
      include: {
        template: true,
        createdByUser: true,
        updatedByUser: true
      }
    });

    logger.info('Service comment updated', {
      commentId: commentId,
      userId: userId
    });

    return updatedComment;
  }

  /**
   * Get comments for a service with visibility filtering
   */
  async getServiceComments(
    orderItemId: string,
    userRole: string,
    userId: string
  ) {
    // Business rule: Visibility filtering based on user role and isInternalOnly flag
    // Customers see only external comments to protect sensitive internal communications
    // Internal and vendor users see all comments for full context when fulfilling services
    const whereClause: {
      orderItemId: string;
      isInternalOnly?: boolean;
    } = {
      orderItemId: orderItemId
    };

    // Only customers have filtered visibility - they cannot see internal-only comments
    if (userRole === 'customer') {
      whereClause.isInternalOnly = false;
    }
    // Internal and vendor users see all comments for operational transparency

    const comments = await prisma.serviceComment.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        template: true,
        createdByUser: true,
        updatedByUser: true
      }
    });

    return comments;
  }

  /**
   * Get all comments for all services in an order
   *
   * CRITICAL ID MAPPING EXPLANATION:
   * This method retrieves comments via a complex relationship:
   * 1. ServicesFulfillment (what UI displays) → OrderItem (where comments are stored)
   * 2. Comments are always stored/retrieved via OrderItem.id
   * 3. But UI components need results keyed by ServicesFulfillment.id
   * 4. This ID mismatch was the root cause of the comment display bug
   *
   * Database relationships:
   * - ServicesFulfillment.orderItemId → OrderItem.id (1:1)
   * - OrderItem.comments → ServiceComment[] (1:many via orderItemId)
   *
   * BUG FIX (March 19, 2026): Resolved critical comment display issue after "Fulfillment ID Standardization"
   * Root cause: Comments were not appearing in fulfillment UI due to ID mismatch between API and frontend
   * - Changed query from ServicesFulfillment to OrderItem table to ensure all items included
   * - Fixed status field access to use OrderItem.status (serviceFulfillment.status was removed)
   * - Updated ID keying strategy to handle both ServicesFulfillment and OrderItem IDs
   */
  async getOrderServiceComments(
    orderId: string,
    userRole: string,
    userId: string
  ) {
    // FIX: Query from OrderItem table to include ALL items, not just those with ServicesFulfillment
    // This ensures comments are returned for all OrderItems regardless of fulfillment status
    // Previously queried ServicesFulfillment which missed items without fulfillment records
    const items = await prisma.orderItem.findMany({
      where: { orderId: orderId },
      include: {
        service: true,
        serviceFulfillment: true,
        comments: {
          where: userRole === 'customer' ? { isInternalOnly: false } : {},
          orderBy: { createdAt: 'desc' },
          include: {
            template: true,
            createdByUser: true,
            updatedByUser: true
          }
        }
      }
    });

    // Transform into the expected response format
    // IMPORTANT: Key by ServicesFulfillment ID when it exists, otherwise by OrderItem ID
    // This hybrid approach ensures UI components can find comments regardless of fulfillment state
    const result: Record<string, {
      serviceName: string;
      serviceStatus: string;
      comments: any[]; // Using any[] to avoid type mismatch with ServiceCommentWithRelations
      total: number;
    }> = {};

    for (const item of items) {
      const comments = item.comments || [];
      // Use ServicesFulfillment ID as key when it exists (for backward compatibility)
      // Fall back to OrderItem ID when no ServicesFulfillment record exists
      const key = item.serviceFulfillment?.id || item.id;

      result[key] = {
        serviceName: item.service.name,
        // BUG FIX: Status lives on OrderItem, not ServicesFulfillment
        // serviceFulfillment.status field was removed in fulfillment ID standardization
        serviceStatus: item.status,
        comments: comments, // Remove type cast as the types don't match
        total: comments.length
      };
    }

    return result;
  }

  /**
   * Delete a comment from a service
   *
   * BUG FIX (TD-022): This method was missing from ServiceCommentService class.
   * The DELETE API route at /api/services/[id]/comments/[commentId]/route.ts line 203
   * was calling deleteComment() but no such method existed, causing runtime errors.
   * Added March 6, 2026 when the DELETE endpoint was created, but method was missing.
   *
   * This reveals a gap in TypeScript type checking - missing method calls are not
   * being caught at compile time, which is a significant type safety concern.
   */
  async deleteComment(
    commentId: string,
    userId: string
  ) {
    // Verify comment exists
    const existingComment = await prisma.serviceComment.findUnique({
      where: { id: commentId }
    });

    if (!existingComment) {
      throw new Error('Comment not found');
    }

    // Delete the comment
    const deletedComment = await prisma.serviceComment.delete({
      where: { id: commentId }
    });

    logger.info('Service comment deleted', {
      commentId: commentId,
      deletedBy: userId
    });

    return deletedComment;
  }

  /**
   * Validate if a user has access to a service (order item)
   *
   * Business rules for service access:
   * - Internal users: Full access to all services (for support and management)
   * - Vendor users: For now, access to all services (TODO: implement vendor assignment)
   * - Customer users: Access only to services within orders they own
   */
  async validateUserAccess(
    orderItemId: string,
    userId: string,
    userType: string
  ): Promise<boolean> {
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: true
      }
    });

    if (!orderItem) {
      return false;
    }

    // Internal users have access to all services for operational oversight
    // Admin users are also considered internal for service comment operations
    if (userType === 'internal' || userType === 'admin') {
      return true;
    }

    // Get user details to validate vendor/customer associations
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return false;
    }

    // Vendor users: For Phase 2c, allow access to all services
    // TODO: In the future, check ServicesFulfillment for vendor assignment
    if (userType === 'vendor') {
      return true; // Temporarily allow all vendor access
    }

    // Customer users can only access services for their orders
    // This maintains data privacy by preventing cross-customer access
    if (userType === 'customer') {
      return orderItem.order.customerId === user.customerId;
    }

    return false;
  }

  /**
   * Validate if a user has access to an order
   *
   * Business rules for order access:
   * - Internal users: Full access to all orders (for support and management)
   * - Vendor users: Access to orders that contain at least one service assigned to their vendor
   * - Customer users: Access only to their own orders (owned by their customer account)
   */
  async validateOrderAccess(
    orderId: string,
    userId: string,
    userType: string
  ): Promise<boolean> {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return false;
    }

    // Internal users have access to all orders for operational oversight
    // Admin users are also considered internal for service comment operations
    if (userType === 'internal' || userType === 'admin') {
      return true;
    }

    // Get user details to validate vendor/customer associations
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return false;
    }

    // Vendor users can access orders with services assigned to their vendor
    // This allows vendors to view all comments for orders they're working on,
    // even for services not directly assigned to them (for context and coordination)
    if (userType === 'vendor') {
      const hasAssignedService = await prisma.servicesFulfillment.findFirst({
        where: {
          orderId: orderId,
          assignedVendorId: user.vendorId
        }
      });
      return !!hasAssignedService;
    }

    // Customer users can only access their own orders to maintain data privacy
    if (userType === 'customer') {
      return order.customerId === user.customerId;
    }

    return false;
  }
}