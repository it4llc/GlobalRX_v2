// /GlobalRX_v2/src/lib/services/service-audit.service.ts

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import type { ServiceAuditLog, ServiceAuditLogWithUser } from '@/types/service-fulfillment';

export class ServiceAuditService {
  /**
   * Log a change to a service fulfillment record
   */
  static async logChange(
    params: {
      serviceFulfillmentId: string;
      orderId: string;
      userId: string;
      changeType: 'status_change' | 'vendor_assignment' | 'note_update';
      fieldName?: string | null;
      oldValue?: any;
      newValue?: any;
      notes?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    } | string,
    orderId?: string,
    userId?: string,
    changeType?: 'status_change' | 'vendor_assignment' | 'note_update',
    fieldName?: string | null,
    oldValue?: any,
    newValue?: any,
    notes?: string | null,
    ipAddress?: string | null,
    userAgent?: string | null
  ): Promise<ServiceAuditLog> {
    try {
      // Handle both object and individual parameters for backward compatibility
      let data: any;

      if (typeof params === 'object') {
        // New object-based API
        data = {
          serviceFulfillmentId: params.serviceFulfillmentId,
          orderId: params.orderId,
          userId: params.userId,
          changeType: params.changeType
        };

        // Only add optional fields if they are explicitly provided
        if ('fieldName' in params) data.fieldName = params.fieldName;
        if ('oldValue' in params) data.oldValue = params.oldValue !== null && params.oldValue !== undefined ? String(params.oldValue) : null;
        if ('newValue' in params) data.newValue = params.newValue !== null && params.newValue !== undefined ? String(params.newValue) : null;
        if ('notes' in params) data.notes = params.notes;
        if ('ipAddress' in params) data.ipAddress = params.ipAddress;
        if ('userAgent' in params) data.userAgent = params.userAgent;
      } else {
        // Legacy parameter-based API
        data = {
          serviceFulfillmentId: params,
          orderId: orderId!,
          userId: userId!,
          changeType: changeType!,
          fieldName: fieldName || null,
          oldValue: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
          newValue: newValue !== null && newValue !== undefined ? String(newValue) : null,
          notes: notes || null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null
        };
      }

      const auditLog = await prisma.serviceAuditLog.create({
        data
      });

      logger.info('Service audit log created', {
        serviceFulfillmentId: data.serviceFulfillmentId,
        changeType: data.changeType,
        userId: data.userId
      });

      return auditLog as ServiceAuditLog;
    } catch (error) {
      logger.error('Error creating service audit log', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceFulfillmentId: typeof params === 'object' ? params.serviceFulfillmentId : params,
        changeType: typeof params === 'object' ? params.changeType : changeType,
        userId: typeof params === 'object' ? params.userId : userId
      });
      throw error;
    }
  }

  /**
   * Log a bulk change operation
   */
  static async logBulkChange(
    serviceFulfillmentIds: string[],
    userId: string,
    changeType: 'bulk_assignment',
    newValue: string,
    ipAddress: string | null = null,
    userAgent: string | null = null
  ): Promise<void> {
    try {
      // Get order IDs for the services
      const services = await prisma.servicesFulfillment.findMany({
        where: { id: { in: serviceFulfillmentIds } },
        select: { id: true, orderId: true, assignedVendorId: true }
      });

      // Create audit logs for each service
      const auditLogs = services.map(service => ({
        serviceFulfillmentId: service.id,
        orderId: service.orderId,
        userId,
        changeType,
        fieldName: 'assignedVendorId',
        oldValue: service.assignedVendorId,
        newValue,
        notes: `Bulk assignment of ${serviceFulfillmentIds.length} services`,
        ipAddress,
        userAgent
      }));

      await prisma.serviceAuditLog.createMany({
        data: auditLogs
      });

      logger.info('Bulk service audit logs created', {
        count: auditLogs.length,
        changeType,
        userId
      });
    } catch (error) {
      logger.error('Error creating bulk service audit logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: serviceFulfillmentIds.length,
        userId
      });
      throw error;
    }
  }

  /**
   * Get audit history for a service
   */
  static async getHistory(
    serviceFulfillmentId: string,
    limit: number = 50
  ): Promise<ServiceAuditLogWithUser[]> {
    try {
      const history = await prisma.serviceAuditLog.findMany({
        where: { serviceFulfillmentId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return history as ServiceAuditLogWithUser[];
    } catch (error) {
      logger.error('Error fetching service audit history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        serviceFulfillmentId
      });
      throw error;
    }
  }

  /**
   * Get audit history for multiple services
   */
  static async getBulkHistory(
    serviceFulfillmentIds: string[],
    limit: number = 100
  ): Promise<ServiceAuditLogWithUser[]> {
    try {
      const history = await prisma.serviceAuditLog.findMany({
        where: { serviceFulfillmentId: { in: serviceFulfillmentIds } },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return history as ServiceAuditLogWithUser[];
    } catch (error) {
      logger.error('Error fetching bulk service audit history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: serviceFulfillmentIds.length
      });
      throw error;
    }
  }

  /**
   * Get audit history for an order
   */
  static async getOrderHistory(
    orderId: string,
    limit: number = 100
  ): Promise<ServiceAuditLogWithUser[]> {
    try {
      const history = await prisma.serviceAuditLog.findMany({
        where: { orderId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });

      return history as ServiceAuditLogWithUser[];
    } catch (error) {
      logger.error('Error fetching order service audit history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId
      });
      throw error;
    }
  }
}