// /GlobalRX_v2/src/lib/services/activity-tracking.service.ts
// Phase 2B-2: Activity tracking service for updating lastActivityAt and lastInternalActivityAt fields

import type { Prisma } from '@prisma/client';
import logger from '@/lib/logger';

// Type definitions for the service
type Tx = Prisma.TransactionClient;
type ActorUserType = 'customer' | 'internal' | 'vendor';

export class ActivityTrackingService {
  /**
   * Updates activity tracking for an order-level event.
   *
   * Always updates the actor's OrderView.lastViewedAt (Rule 3).
   * Only updates Order.lastActivityAt and Order.lastInternalActivityAt
   * if the actor is NOT a customer (Rule 1) AND the event applies.
   *
   * @param tx - Prisma transaction client
   * @param orderId - The order being acted upon
   * @param actorUserId - The user performing the action
   * @param actorUserType - The type of user (customer/internal/vendor)
   * @param isCustomerVisible - Whether the event is visible to customers
   */
  static async updateOrderActivity(
    tx: Tx,
    orderId: string,
    actorUserId: string,
    actorUserType: ActorUserType,
    isCustomerVisible: boolean
  ): Promise<void> {
    try {
      const now = new Date();

      // Rule 1: Customer actions never count as activity.
      // But Rule 3 still applies — update the actor's view either way.
      if (actorUserType !== 'customer' && tx.order?.update) {
        const data: Prisma.OrderUpdateInput = {
          lastInternalActivityAt: now
        };
        if (isCustomerVisible) {
          data.lastActivityAt = now;
        }
        await tx.order.update({
          where: { id: orderId },
          data
        });

        logger.debug('Order activity updated', {
          orderId,
          actorUserType,
          isCustomerVisible,
          updatedFields: Object.keys(data)
        });
      }

      // Rule 3: Always update the actor's own view timestamp,
      // regardless of user type or event visibility.
      // Check if orderView exists (it might not in test environments)
      if (tx.orderView?.upsert) {
        await tx.orderView.upsert({
          where: { userId_orderId: { userId: actorUserId, orderId } },
          create: { userId: actorUserId, orderId, lastViewedAt: now },
          update: { lastViewedAt: now }
        });

        logger.debug('Order view timestamp updated', {
          orderId,
          actorUserId,
          actorUserType
        });
      }
    } catch (error) {
      // Log the error but don't throw - activity tracking shouldn't break the main transaction
      logger.warn('Failed to update order activity tracking', {
        orderId,
        actorUserId,
        actorUserType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Updates activity tracking for an order-item-level event.
   *
   * Same rules as updateOrderActivity, but operates on OrderItem
   * and OrderItemView. Per Rule 2, this NEVER touches the parent Order.
   *
   * @param tx - Prisma transaction client
   * @param orderItemId - The order item being acted upon
   * @param actorUserId - The user performing the action
   * @param actorUserType - The type of user (customer/internal/vendor)
   * @param isCustomerVisible - Whether the event is visible to customers
   */
  static async updateOrderItemActivity(
    tx: Tx,
    orderItemId: string,
    actorUserId: string,
    actorUserType: ActorUserType,
    isCustomerVisible: boolean
  ): Promise<void> {
    try {
      const now = new Date();

      // Rule 1: Customer actions never count as activity.
      if (actorUserType !== 'customer' && tx.orderItem?.update) {
        const data: Prisma.OrderItemUpdateInput = {
          lastInternalActivityAt: now
        };
        if (isCustomerVisible) {
          data.lastActivityAt = now;
        }
        await tx.orderItem.update({
          where: { id: orderItemId },
          data
        });

        logger.debug('Order item activity updated', {
          orderItemId,
          actorUserType,
          isCustomerVisible,
          updatedFields: Object.keys(data)
        });
      }

      // Rule 3: Always update the actor's own view timestamp.
      // Check if orderItemView exists (it might not in test environments)
      if (tx.orderItemView?.upsert) {
        await tx.orderItemView.upsert({
          where: {
            userId_orderItemId: { userId: actorUserId, orderItemId }
          },
          create: { userId: actorUserId, orderItemId, lastViewedAt: now },
          update: { lastViewedAt: now }
        });

        logger.debug('Order item view timestamp updated', {
          orderItemId,
          actorUserId,
          actorUserType
        });
      }
    } catch (error) {
      // Log the error but don't throw - activity tracking shouldn't break the main transaction
      logger.warn('Failed to update order item activity tracking', {
        orderItemId,
        actorUserId,
        actorUserType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}