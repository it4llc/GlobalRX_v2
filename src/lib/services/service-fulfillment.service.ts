// /GlobalRX_v2/src/lib/services/service-fulfillment.service.ts

import { prisma } from '@/lib/prisma';
import { ServiceAuditService } from './service-audit.service';
import logger from '@/lib/logger';
import type {
  ServiceFulfillment,
  ServiceFulfillmentWithRelations,
  ServiceQueryParams,
  UpdateServiceFulfillmentRequest,
  ServiceStatus,
  ServiceUser,
  ServiceUserWithoutId,
  ServiceWhereClause,
  ServiceUpdateData,
  AuditChange
} from '@/types/service-fulfillment';

export class ServiceFulfillmentService {
  /**
   * Create service fulfillment records for all order items
   */
  static async createServicesForOrder(orderId: string, userId: string): Promise<{ created: number; message?: string }> {
    try {
      // Check if services already exist for this order
      const existingServices = await prisma.servicesFulfillment.count({
        where: { orderId }
      });

      if (existingServices > 0) {
        return { created: 0, message: 'Services already exist for this order' };
      }

      const orderItems = await prisma.orderItem.findMany({
        where: { orderId }
      });

      if (orderItems.length === 0) {
        logger.warn('No order items found for service fulfillment creation', { orderId });
        return { created: 0 };
      }

      // Create service fulfillment records
      const serviceFulfillmentData = orderItems.map(item => ({
        orderId,
        orderItemId: item.id,
        serviceId: item.serviceId,
        locationId: item.locationId,
        createdAt: new Date()
      }));

      const result = await prisma.servicesFulfillment.createMany({
        data: serviceFulfillmentData,
        skipDuplicates: true
      });

      logger.info('Service fulfillment records created', {
        orderId,
        count: result.count,
        userId
      });

      return { created: result.count };
    } catch (error) {
      logger.error('Error creating service fulfillment records', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get services based on query parameters and user permissions
   */
  static async getServices(
    user: ServiceUserWithoutId,
    params: ServiceQueryParams
  ): Promise<{ services: ServiceFulfillmentWithRelations[]; total: number; limit: number; offset: number }> {
    try {
      // Build where clause with proper type
      interface ServiceWhereClause {
        orderId?: string;
        assignedVendorId?: string;
        orderItem?: {
          status: string;
        };
        order?: {
          customerId: string;
        };
      }
      let where: ServiceWhereClause = {};

      if (params.orderId) where.orderId = params.orderId;
      // Status now comes from OrderItem, not ServicesFulfillment
      if (params.status) {
        where.orderItem = {
          status: params.status
        };
      }

      // Vendors only see their assigned services
      if (user.userType === 'vendor' && user.vendorId) {
        where.assignedVendorId = user.vendorId;
      } else if (params.vendorId) {
        where.assignedVendorId = params.vendorId;
      }

      // BUG FIX (March 9, 2026): Customers only see services for their orders
      if (user.userType === 'customer' && user.customerId) {
        where.order = {
          customerId: user.customerId
        };
      }

      const [services, total] = await prisma.$transaction([
        prisma.servicesFulfillment.findMany({
          where,
          include: {
            service: true,
            location: true,
            assignedVendor: true,
            order: {
              include: {
                customer: true,
                subject: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          take: params.limit || 50,
          skip: params.offset || 0
        }),
        prisma.servicesFulfillment.count({ where })
      ]);

      // Remove sensitive customer and subject details for vendor users
      // Vendors should only see order numbers for communication purposes,
      // but never customer names, addresses, or any personally identifiable information
      if (user.userType === 'vendor') {
        services.forEach((service) => {
          if (service.order) {
            // Remove all customer and subject PII to protect privacy
            // and comply with data access restrictions for third-party vendors
            delete service.order.customer;
            delete service.order.subject;
            delete service.order.customerId;
            // Keep only essential order info for vendors - order number for reference,
            // status for workflow context, and creation date for service prioritization
            service.order = {
              id: service.order.id,
              orderNumber: service.order.orderNumber,
              status: service.order.status,
              createdAt: service.order.createdAt
            };
          }
        });
      }

      return {
        services: services as ServiceFulfillmentWithRelations[],
        total,
        limit: params.limit || 50,
        offset: params.offset || 0
      };
    } catch (error) {
      logger.error('Error fetching services', {
        error: error instanceof Error ? error.message : 'Unknown error',
        params
      });
      throw error;
    }
  }

  /**
   * Get a single service by ID
   */
  static async getServiceById(
    id: string,
    user: ServiceUserWithoutId
  ): Promise<ServiceFulfillmentWithRelations | null> {
    try {
      const service = await prisma.servicesFulfillment.findUnique({
        where: { id },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              customerId: true
            }
          },
          orderItem: true,
          service: true,
          location: true,
          assignedVendor: true,
          assignedByUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      });

      if (!service) return null;

      // Check vendor access - critical security control
      // Vendors can ONLY access services specifically assigned to them.
      // This prevents data leakage between vendors and ensures strict data isolation.
      if (user.userType === 'vendor' && user.vendorId && service.assignedVendorId !== user.vendorId) {
        logger.warn('Vendor attempted to access unassigned service', {
          serviceId: id,
          vendorId: user.vendorId,
          assignedVendorId: service.assignedVendorId
        });
        throw new Error('Access denied');
      }

      // BUG FIX (March 9, 2026): Check customer access - customers can only see their own orders
      if (user.userType === 'customer' && user.customerId && service.order?.customerId !== user.customerId) {
        logger.warn('Customer attempted to access service from different customer', {
          serviceId: id,
          customerId: user.customerId,
          orderCustomerId: service.order?.customerId
        });
        throw new Error('Access denied');
      }

      // Remove sensitive customer details for vendor users
      if (user.userType === 'vendor' && service.order) {
        // Keep only essential order info for vendors, remove PII
        // Create a new object with filtered order data to maintain type safety
        const sanitizedService: ServiceFulfillmentWithRelations = {
          ...service,
          order: {
            id: service.order.id,
            orderNumber: service.order.orderNumber,
            customerId: '' // Empty string to satisfy type but not expose real customerId
          }
        };
        return sanitizedService;
      }

      return service as ServiceFulfillmentWithRelations;
    } catch (error) {
      logger.error('Error fetching service by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        id
      });
      throw error;
    }
  }

  /**
   * Update a service fulfillment record
   */
  static async updateService(
    id: string,
    updates: UpdateServiceFulfillmentRequest,
    user: ServiceUser,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<ServiceFulfillment> {
    try {
      // Get current service
      const currentService = await prisma.servicesFulfillment.findUnique({
        where: { id }
      });

      if (!currentService) {
        throw new Error('Service not found');
      }

      // Check vendor access
      if (user.userType === 'vendor' && user.vendorId && currentService.assignedVendorId !== user.vendorId) {
        throw new Error('Forbidden: Service not assigned to vendor');
      }

      // Check permission for vendor assignment
      if (updates.assignedVendorId !== undefined && updates.assignedVendorId !== currentService.assignedVendorId) {
        const hasManagePermission = user.permissions?.fulfillment?.manage === true ||
                                   user.permissions?.admin === true;
        if (!hasManagePermission) {
          throw new Error('Forbidden: Insufficient permissions for vendor assignment');
        }

        // Validate vendor if assigning
        if (updates.assignedVendorId) {
          const vendor = await prisma.vendorOrganization.findUnique({
            where: { id: updates.assignedVendorId }
          });

          if (!vendor) {
            throw new Error('Vendor not found');
          }

          if (!vendor.isActive) {
            throw new Error('Cannot assign deactivated vendor');
          }
        }
      }

      // Prevent vendor from updating internal notes
      if (user.userType === 'vendor' && updates.internalNotes !== undefined) {
        throw new Error('Forbidden: Vendors cannot update internal notes');
      }

      // Prepare update data
      const updateData: ServiceUpdateData = {};
      const auditChanges: AuditChange[] = [];

      // Note: Status changes are now handled on OrderItem via /api/services/[id]/status
      // ServicesFulfillment no longer maintains its own status field
      if (updates.status) {
        logger.warn('Status update attempted on ServicesFulfillment - should use OrderItem', {
          serviceId: id,
          attemptedStatus: updates.status
        });
        // Ignore status updates here - they should go through OrderItem
      }

      // Track vendor assignment changes (already validated above)
      if (updates.assignedVendorId !== undefined && updates.assignedVendorId !== currentService.assignedVendorId) {
        updateData.assignedVendorId = updates.assignedVendorId;
        // Record assignment timestamp for SLA tracking and audit purposes
        // null when unassigning (returning to internal team)
        updateData.assignedAt = updates.assignedVendorId ? new Date() : null;
        // Track who made the assignment for accountability
        updateData.assignedBy = updates.assignedVendorId ? user.id : null;

        auditChanges.push({
          changeType: 'vendor_assignment',
          fieldName: 'assignedVendorId',
          oldValue: currentService.assignedVendorId,
          newValue: updates.assignedVendorId
        });
      }

      // Track vendor notes changes (vendors can only edit vendor notes)
      if (updates.vendorNotes !== undefined && updates.vendorNotes !== currentService.vendorNotes) {
        updateData.vendorNotes = updates.vendorNotes;
        auditChanges.push({
          changeType: 'note_update',
          fieldName: 'vendorNotes',
          oldValue: currentService.vendorNotes,
          newValue: updates.vendorNotes
        });
      }

      // Track internal notes changes (only internal users can edit)
      if (user.userType !== 'vendor' && updates.internalNotes !== undefined && updates.internalNotes !== currentService.internalNotes) {
        updateData.internalNotes = updates.internalNotes;
        auditChanges.push({
          changeType: 'note_update',
          fieldName: 'internalNotes',
          oldValue: currentService.internalNotes,
          newValue: updates.internalNotes
        });
      }

      // Perform update in transaction with audit logging
      const updatedService = await prisma.$transaction(async (tx) => {
        // Update the service
        const service = await tx.servicesFulfillment.update({
          where: { id },
          data: updateData,
          include: {
            order: true,
            orderItem: true,
            service: true,
            location: true,
            assignedVendor: true
          }
        });

        // Log each change
        for (const change of auditChanges) {
          await ServiceAuditService.logChange({
            serviceFulfillmentId: id,
            orderId: currentService.orderId,
            userId: user.id,
            changeType: change.changeType,
            fieldName: change.fieldName,
            oldValue: change.oldValue,
            newValue: change.newValue,
            notes: null,
            ipAddress: context?.ipAddress || null,
            userAgent: context?.userAgent || null
          });
        }

        return service;
      });

      logger.info('Service fulfillment updated', {
        serviceId: id,
        userId: user.id,
        changes: auditChanges.length
      });

      return updatedService as ServiceFulfillment;
    } catch (error) {
      logger.error('Error updating service fulfillment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceId: id,
        userId: user.id
      });
      throw error;
    }
  }

  /**
   * Bulk assign services to a vendor
   */
  static async bulkAssignServices(
    serviceFulfillmentIds: string[],
    vendorId: string,
    user: ServiceUser,
    context?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ updated: number }> {
    try {
      // Check permissions
      const hasManagePermission = user.permissions?.fulfillment?.manage === true ||
                                 user.permissions?.admin === true;
      if (!hasManagePermission) {
        throw new Error('Forbidden: Insufficient permissions for bulk assignment');
      }

      // Handle empty list
      if (serviceFulfillmentIds.length === 0) {
        return { updated: 0 };
      }

      // Validate max 100 services
      if (serviceFulfillmentIds.length > 100) {
        throw new Error('Cannot assign more than 100 services at once');
      }
      // Verify vendor exists and is active
      const vendor = await prisma.vendorOrganization.findUnique({
        where: { id: vendorId }
      });

      if (!vendor) {
        throw new Error('Vendor not found');
      }

      if (!vendor.isActive) {
        throw new Error('Vendor is deactivated');
      }

      // Get current services with updatedAt for optimistic locking
      const currentServices = await prisma.servicesFulfillment.findMany({
        where: { id: { in: serviceFulfillmentIds } },
        select: { id: true, updatedAt: true }
      });

      if (currentServices.length === 0) {
        return { updated: 0 };
      }

      // Create a map of service IDs to their last update times
      const serviceVersions = new Map(
        currentServices.map(s => [s.id, s.updatedAt])
      );

      // Perform bulk update in transaction with optimistic locking
      const result = await prisma.$transaction(async (tx) => {
        // First, verify none of the services have been modified
        const latestServices = await tx.servicesFulfillment.findMany({
          where: { id: { in: serviceFulfillmentIds } },
          select: { id: true, updatedAt: true }
        });

        // Check for concurrent modifications
        for (const service of latestServices) {
          const originalUpdateTime = serviceVersions.get(service.id);
          if (!originalUpdateTime || service.updatedAt.getTime() !== originalUpdateTime.getTime()) {
            throw new Error('Services have been modified by another user. Please refresh and try again.');
          }
        }

        // Update all services
        const updateResult = await tx.servicesFulfillment.updateMany({
          where: { id: { in: serviceFulfillmentIds } },
          data: {
            assignedVendorId: vendorId,
            assignedAt: new Date(),
            assignedBy: user.id
          }
        });

        // Log bulk assignment
        await ServiceAuditService.logBulkChange(
          serviceFulfillmentIds,
          user.id,
          'bulk_assignment',
          vendorId,
          context?.ipAddress || null,
          context?.userAgent || null
        );

        return updateResult;
      });

      logger.info('Bulk service assignment completed', {
        vendorId,
        userId: user.id,
        count: result.count
      });

      return { updated: result.count };
    } catch (error) {
      logger.error('Error in bulk service assignment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vendorId,
        userId: user.id,
        count: serviceFulfillmentIds.length
      });
      throw error;
    }
  }

  /**
   * Check if all services for an order are in terminal status
   * (Alias for areAllServicesTerminal for test compatibility)
   */
  static async checkOrderCompletion(orderId: string): Promise<boolean> {
    return this.areAllServicesTerminal(orderId);
  }

  /**
   * Check if all services for an order are in terminal status
   */
  static async areAllServicesTerminal(orderId: string): Promise<boolean> {
    try {
      const services = await prisma.servicesFulfillment.findMany({
        where: { orderId },
        select: { id: true, status: true }
      });

      // If no services, consider as all terminal (empty order)
      if (services.length === 0) {
        return true;
      }

      // Check if all services are in terminal status
      return services.every(service =>
        service.status === 'completed' || service.status === 'cancelled'
      );
    } catch (error) {
      logger.error('Error checking if all services are terminal', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId
      });
      throw error;
    }
  }

  /**
   * Get service history (delegates to ServiceAuditService)
   */
  static async getServiceHistory(serviceFulfillmentId: string, limit?: number) {
    return ServiceAuditService.getHistory(serviceFulfillmentId, limit);
  }

  /**
   * Get service fulfillment summary for an order
   */
  static async getOrderServiceSummary(orderId: string): Promise<{
    total: number;
    pending: number;
    submitted: number;
    processing: number;
    completed: number;
    cancelled: number;
  }> {
    try {
      const services = await prisma.servicesFulfillment.findMany({
        where: { orderId },
        select: { status: true }
      });

      const summary = {
        total: services.length,
        pending: 0,
        submitted: 0,
        processing: 0,
        completed: 0,
        cancelled: 0
      };

      services.forEach(service => {
        const status = service.status as ServiceStatus;
        if (status in summary) {
          summary[status]++;
        }
      });

      return summary;
    } catch (error) {
      logger.error('Error getting order service summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId
      });
      throw error;
    }
  }

  /**
   * Check if all services (OrderItems) in an order have "submitted" status
   * Used for automatic order status progression from "draft" to "submitted"
   */
  static async checkAllServicesSubmitted(orderId: string): Promise<boolean> {
    try {
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId },
        select: { status: true }
      });

      // If no order items, return false (can't progress empty order)
      if (orderItems.length === 0) {
        return false;
      }

      // Check if all items have "Submitted" status
      // Normalize to lowercase for comparison to handle case differences
      return orderItems.every(item => item.status?.toLowerCase() === 'submitted');
    } catch (error) {
      logger.error('Error checking if all services are submitted', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId
      });
      return false; // Safe default - don't auto-progress on error
    }
  }

}