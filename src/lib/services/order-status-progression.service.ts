// /GlobalRX_v2/src/lib/services/order-status-progression.service.ts

import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { ActivityTrackingService } from './activity-tracking.service';

interface ProgressionResult {
  statusChanged: boolean;
  oldStatus: string;
  newStatus: string;
  reason: string;
}

interface OrderItem {
  id: string;
  statusCode: string;
  serviceType?: string;
}

export class OrderStatusProgressionService {
  /**
   * Check if order status should be automatically progressed and update if needed
   *
   * Business Rule Implementation: When ALL services in an order reach "submitted" status,
   * the order automatically progresses from "draft" to "submitted". This ensures consistent
   * workflow progression while maintaining data integrity through database transactions.
   *
   * This is a critical business logic service that prevents orders from remaining in draft
   * when all their component services are ready for processing. The automation reduces
   * manual overhead while ensuring no submitted services are left in draft orders.
   */
  async checkAndProgressOrderStatus(
    orderId: string,
    actorUserId?: string,
    actorUserType?: 'customer' | 'internal' | 'vendor'
  ): Promise<ProgressionResult> {
    // First check if the order exists
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        statusCode: true,
        customerId: true,
        orderNumber: true
      }
    });

    if (!order) {
      throw new Error('Order not found');
    }

    // Get all order items (services) for this order
    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
      select: {
        id: true,
        statusCode: true,
        serviceType: true
      }
    });

    // Check if we should progress the order
    if (!this.shouldProgressOrder(orderItems, order.statusCode)) {
      // Determine the reason for not progressing
      let reason = 'Not all services are submitted';
      if (orderItems.length === 0) {
        reason = 'Order has no services';
      } else if (order.statusCode !== 'draft') {
        reason = 'Order is not in draft status';
      }

      return {
        statusChanged: false,
        oldStatus: order.statusCode,
        newStatus: order.statusCode,
        reason
      };
    }

    // Progress the order status in a transaction
    // Critical: Use transaction to ensure data consistency when multiple users
    // might be updating service statuses simultaneously. This prevents race
    // conditions where order status could be incorrectly set.
    try {
      await prisma.$transaction(async (tx) => {
        // Re-check services within transaction to handle concurrent updates
        // Business justification: Another user might have deleted a service or
        // changed service status between our initial check and this transaction
        const currentServices = await tx.orderItem.findMany({
          where: { orderId },
          select: {
            id: true,
            statusCode: true,
            serviceType: true
          }
        });

        // Verify we should still progress with the current set of services
        // This handles cases where services might be deleted but remaining ones are still all submitted
        if (!this.shouldProgressOrder(currentServices, order.statusCode)) {
          // Only throw if the current services would prevent progression
          // (not all submitted, or order not in draft, or no services left)
          throw new Error('Concurrent update detected');
        }

        // Update order status
        await tx.order.update({
          where: { id: orderId },
          data: { statusCode: 'submitted' }
        });

        // Create history entry
        await tx.orderStatusHistory.create({
          data: {
            orderId,
            fromStatus: order.statusCode,
            toStatus: 'submitted',
            changedBy: 'system',
            isAutomatic: true,
            notes: 'Automatically updated - all services submitted'
          }
        });

        // Phase 2B-2: Update activity tracking if actor info is provided
        // Auto-progression is triggered by the user who changed the last service to submitted
        if (actorUserId && actorUserType) {
          await ActivityTrackingService.updateOrderActivity(
            tx,
            orderId,
            actorUserId,
            actorUserType,
            true // isCustomerVisible - order status changes are customer-visible
          );
        }
      });

      logger.info('Order status automatically progressed', {
        orderId,
        orderNumber: order.orderNumber,
        fromStatus: order.statusCode,
        toStatus: 'submitted'
      });

      return {
        statusChanged: true,
        oldStatus: order.statusCode,
        newStatus: 'submitted',
        reason: 'Automatically updated - all services submitted'
      };
    } catch (error) {
      logger.error('Failed to progress order status', {
        orderId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Determine if an order should be automatically progressed
   * Business rule: Progress from draft to submitted when ALL services are submitted
   */
  shouldProgressOrder(services: OrderItem[], currentOrderStatus: string): boolean {
    // Must have at least one service
    if (services.length === 0) {
      return false;
    }

    // Order must be in draft status
    if (currentOrderStatus !== 'draft') {
      return false;
    }

    // All services must be submitted
    return services.every(service => service.statusCode === 'submitted');
  }
}