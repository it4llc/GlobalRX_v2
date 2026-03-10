// /GlobalRX_v2/src/services/service-comment-service.ts

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import {
  CreateServiceCommentInput,
  UpdateServiceCommentInput,
  ServiceCommentWithRelations
} from '@/types/service-comment';

export class ServiceCommentService {
  /**
   * Create a new comment for a service (order item)
   */
  async createComment(
    orderItemId: string,
    data: CreateServiceCommentInput,
    userId: string
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
   */
  async getOrderServiceComments(
    orderId: string,
    userRole: string,
    userId: string
  ) {
    // Get all services for the order with their comments
    // This query follows: ServicesFulfillment → OrderItem → ServiceComment[]
    const services = await prisma.servicesFulfillment.findMany({
      where: { orderId: orderId },
      include: {
        service: true,
        orderItem: {
          include: {
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
        }
      }
    });

    // Transform into the expected response format
    // IMPORTANT: Key by ServicesFulfillment ID since that's what the UI components use
    // This mapping is critical - UI passes serviceFulfillmentId, not orderItemId
    const result: Record<string, {
      serviceName: string;
      serviceStatus: string;
      comments: ServiceCommentWithRelations[];
      total: number;
    }> = {};

    for (const service of services) {
      const comments = service.orderItem?.comments || [];
      // Key by ServicesFulfillment ID (service.id) not OrderItem ID
      // This ensures UI can find comments using the ID it has available
      result[service.id] = {
        serviceName: service.service.name,
        serviceStatus: service.status,
        comments: comments,
        total: comments.length
      };
    }

    return result;
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
    if (userType === 'internal') {
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
    if (userType === 'internal') {
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