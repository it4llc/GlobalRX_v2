// /GlobalRX_v2/src/lib/services/__tests__/activity-tracking.service.test.ts
// Tests for ActivityTrackingService - Phase 2B-2
// Test-writer Pass 1: Tests written BEFORE implementation exists

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityTrackingService } from '../activity-tracking.service';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      update: vi.fn(),
    },
    orderItem: {
      update: vi.fn(),
    },
    orderView: {
      upsert: vi.fn(),
    },
    orderItemView: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ActivityTrackingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateOrderActivity', () => {
    describe('Rule 1: Customer actions never update activity timestamps', () => {
      it('should NOT update Order activity fields when actor is a customer (customer-visible event)', async () => {
        const mockTx = {
          order: { update: vi.fn() },
          orderView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderId = 'order-123';
        const actorUserId = 'user-456';
        const actorUserType = 'customer';
        const isCustomerVisible = true;

        await ActivityTrackingService.updateOrderActivity(
          mockTx,
          orderId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // Order activity fields should NOT be updated for customer actors
        expect(mockTx.order.update).not.toHaveBeenCalled();

        // But the actor's view should still be updated (Rule 3)
        expect(mockTx.orderView.upsert).toHaveBeenCalledWith({
          where: { userId_orderId: { userId: actorUserId, orderId } },
          create: {
            userId: actorUserId,
            orderId,
            lastViewedAt: expect.any(Date)
          },
          update: { lastViewedAt: expect.any(Date) }
        });
      });

      it('should NOT update Order activity fields when actor is a customer (internal-only event)', async () => {
        const mockTx = {
          order: { update: vi.fn() },
          orderView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderId = 'order-789';
        const actorUserId = 'customer-001';
        const actorUserType = 'customer';
        const isCustomerVisible = false;

        await ActivityTrackingService.updateOrderActivity(
          mockTx,
          orderId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // Order should not be updated for customer actors
        expect(mockTx.order.update).not.toHaveBeenCalled();

        // View should still be updated
        expect(mockTx.orderView.upsert).toHaveBeenCalled();
      });
    });

    describe('Non-customer actors updating activity', () => {
      it('should update both lastActivityAt and lastInternalActivityAt for customer-visible events by internal users', async () => {
        const mockTx = {
          order: { update: vi.fn() },
          orderView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderId = 'order-001';
        const actorUserId = 'internal-user-001';
        const actorUserType = 'internal';
        const isCustomerVisible = true;

        await ActivityTrackingService.updateOrderActivity(
          mockTx,
          orderId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // Should update both activity fields for customer-visible events
        expect(mockTx.order.update).toHaveBeenCalledWith({
          where: { id: orderId },
          data: {
            lastActivityAt: expect.any(Date),
            lastInternalActivityAt: expect.any(Date)
          }
        });

        // Actor's view should also be updated
        expect(mockTx.orderView.upsert).toHaveBeenCalledWith({
          where: { userId_orderId: { userId: actorUserId, orderId } },
          create: {
            userId: actorUserId,
            orderId,
            lastViewedAt: expect.any(Date)
          },
          update: { lastViewedAt: expect.any(Date) }
        });
      });

      it('should update only lastInternalActivityAt for internal-only events by internal users', async () => {
        const mockTx = {
          order: { update: vi.fn() },
          orderView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderId = 'order-002';
        const actorUserId = 'internal-user-002';
        const actorUserType = 'internal';
        const isCustomerVisible = false; // e.g., vendor assignment

        await ActivityTrackingService.updateOrderActivity(
          mockTx,
          orderId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // Should update only lastInternalActivityAt for internal-only events
        expect(mockTx.order.update).toHaveBeenCalledWith({
          where: { id: orderId },
          data: {
            lastInternalActivityAt: expect.any(Date)
            // lastActivityAt should NOT be included
          }
        });

        // Verify lastActivityAt was NOT updated
        const updateCall = mockTx.order.update as any;
        expect(updateCall.mock.calls[0][0].data.lastActivityAt).toBeUndefined();
      });

      it('should update both activity fields for vendor actors on customer-visible events', async () => {
        const mockTx = {
          order: { update: vi.fn() },
          orderView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderId = 'order-003';
        const actorUserId = 'vendor-user-001';
        const actorUserType = 'vendor';
        const isCustomerVisible = true;

        await ActivityTrackingService.updateOrderActivity(
          mockTx,
          orderId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // Vendor is non-customer, so activity should be updated
        expect(mockTx.order.update).toHaveBeenCalledWith({
          where: { id: orderId },
          data: {
            lastActivityAt: expect.any(Date),
            lastInternalActivityAt: expect.any(Date)
          }
        });

        // View should be updated
        expect(mockTx.orderView.upsert).toHaveBeenCalled();
      });

      it('should update only lastInternalActivityAt for vendor actors on internal-only events', async () => {
        const mockTx = {
          order: { update: vi.fn() },
          orderView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderId = 'order-004';
        const actorUserId = 'vendor-user-002';
        const actorUserType = 'vendor';
        const isCustomerVisible = false;

        await ActivityTrackingService.updateOrderActivity(
          mockTx,
          orderId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // Should update only internal field
        expect(mockTx.order.update).toHaveBeenCalledWith({
          where: { id: orderId },
          data: {
            lastInternalActivityAt: expect.any(Date)
          }
        });

        const updateCall = mockTx.order.update as any;
        expect(updateCall.mock.calls[0][0].data.lastActivityAt).toBeUndefined();
      });
    });

    describe('Rule 3: Actor view timestamp is always updated', () => {
      it('should create OrderView record if it does not exist (upsert create path)', async () => {
        const mockTx = {
          order: { update: vi.fn() },
          orderView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderId = 'order-new-view';
        const actorUserId = 'vendor-first-time';
        const actorUserType = 'vendor';
        const isCustomerVisible = true;

        await ActivityTrackingService.updateOrderActivity(
          mockTx,
          orderId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // Verify upsert was called with create and update blocks
        expect(mockTx.orderView.upsert).toHaveBeenCalledWith({
          where: { userId_orderId: { userId: actorUserId, orderId } },
          create: {
            userId: actorUserId,
            orderId,
            lastViewedAt: expect.any(Date)
          },
          update: {
            lastViewedAt: expect.any(Date)
          }
        });
      });

      it('should update existing OrderView record (upsert update path)', async () => {
        const mockTx = {
          order: { update: vi.fn() },
          orderView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderId = 'order-existing-view';
        const actorUserId = 'internal-return-user';
        const actorUserType = 'internal';
        const isCustomerVisible = false;

        await ActivityTrackingService.updateOrderActivity(
          mockTx,
          orderId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // Same upsert call works for both create and update scenarios
        expect(mockTx.orderView.upsert).toHaveBeenCalledWith({
          where: { userId_orderId: { userId: actorUserId, orderId } },
          create: {
            userId: actorUserId,
            orderId,
            lastViewedAt: expect.any(Date)
          },
          update: {
            lastViewedAt: expect.any(Date)
          }
        });
      });
    });
  });

  describe('updateOrderItemActivity', () => {
    describe('Rule 1: Customer actions never update activity timestamps', () => {
      it('should NOT update OrderItem activity fields when actor is a customer', async () => {
        const mockTx = {
          orderItem: { update: vi.fn() },
          orderItemView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderItemId = 'item-456';
        const actorUserId = 'customer-789';
        const actorUserType = 'customer';
        const isCustomerVisible = true;

        await ActivityTrackingService.updateOrderItemActivity(
          mockTx,
          orderItemId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // OrderItem activity should NOT be updated for customer actors
        expect(mockTx.orderItem.update).not.toHaveBeenCalled();

        // But the actor's item view should still be updated
        expect(mockTx.orderItemView.upsert).toHaveBeenCalledWith({
          where: { userId_orderItemId: { userId: actorUserId, orderItemId } },
          create: {
            userId: actorUserId,
            orderItemId,
            lastViewedAt: expect.any(Date)
          },
          update: { lastViewedAt: expect.any(Date) }
        });
      });
    });

    describe('Non-customer actors updating item activity', () => {
      it('should update both item activity fields for customer-visible events by internal users', async () => {
        const mockTx = {
          orderItem: { update: vi.fn() },
          orderItemView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderItemId = 'item-001';
        const actorUserId = 'internal-item-user';
        const actorUserType = 'internal';
        const isCustomerVisible = true; // e.g., status change, document upload

        await ActivityTrackingService.updateOrderItemActivity(
          mockTx,
          orderItemId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        expect(mockTx.orderItem.update).toHaveBeenCalledWith({
          where: { id: orderItemId },
          data: {
            lastActivityAt: expect.any(Date),
            lastInternalActivityAt: expect.any(Date)
          }
        });
      });

      it('should update only lastInternalActivityAt for internal-only item events', async () => {
        const mockTx = {
          orderItem: { update: vi.fn() },
          orderItemView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderItemId = 'item-002';
        const actorUserId = 'internal-comment-user';
        const actorUserType = 'internal';
        const isCustomerVisible = false; // e.g., internal-only comment

        await ActivityTrackingService.updateOrderItemActivity(
          mockTx,
          orderItemId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        expect(mockTx.orderItem.update).toHaveBeenCalledWith({
          where: { id: orderItemId },
          data: {
            lastInternalActivityAt: expect.any(Date)
          }
        });

        // Verify lastActivityAt was NOT included
        const updateCall = mockTx.orderItem.update as any;
        expect(updateCall.mock.calls[0][0].data.lastActivityAt).toBeUndefined();
      });

      it('should update both item activity fields for vendor actors on customer-visible events', async () => {
        const mockTx = {
          orderItem: { update: vi.fn() },
          orderItemView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderItemId = 'item-003';
        const actorUserId = 'vendor-upload-user';
        const actorUserType = 'vendor';
        const isCustomerVisible = true; // e.g., document upload

        await ActivityTrackingService.updateOrderItemActivity(
          mockTx,
          orderItemId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        expect(mockTx.orderItem.update).toHaveBeenCalledWith({
          where: { id: orderItemId },
          data: {
            lastActivityAt: expect.any(Date),
            lastInternalActivityAt: expect.any(Date)
          }
        });
      });
    });

    describe('Rule 2: No cascading between order and items', () => {
      it('should NOT touch parent Order when updating OrderItem activity', async () => {
        const mockTx = {
          orderItem: { update: vi.fn() },
          orderItemView: { upsert: vi.fn() },
          order: { update: vi.fn() } // Should never be called
        } as unknown as Prisma.TransactionClient;

        const orderItemId = 'item-no-cascade';
        const actorUserId = 'internal-user';
        const actorUserType = 'internal';
        const isCustomerVisible = true;

        await ActivityTrackingService.updateOrderItemActivity(
          mockTx,
          orderItemId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        // OrderItem should be updated
        expect(mockTx.orderItem.update).toHaveBeenCalled();

        // Parent Order should NOT be touched (Rule 2)
        expect(mockTx.order.update).not.toHaveBeenCalled();
      });
    });

    describe('Rule 3: Actor view timestamp is always updated for items', () => {
      it('should create OrderItemView record if it does not exist', async () => {
        const mockTx = {
          orderItem: { update: vi.fn() },
          orderItemView: { upsert: vi.fn() }
        } as unknown as Prisma.TransactionClient;

        const orderItemId = 'item-new-view';
        const actorUserId = 'vendor-first-item-view';
        const actorUserType = 'vendor';
        const isCustomerVisible = true;

        await ActivityTrackingService.updateOrderItemActivity(
          mockTx,
          orderItemId,
          actorUserId,
          actorUserType,
          isCustomerVisible
        );

        expect(mockTx.orderItemView.upsert).toHaveBeenCalledWith({
          where: { userId_orderItemId: { userId: actorUserId, orderItemId } },
          create: {
            userId: actorUserId,
            orderItemId,
            lastViewedAt: expect.any(Date)
          },
          update: {
            lastViewedAt: expect.any(Date)
          }
        });
      });
    });
  });

  describe('Rule 4: Transaction participation', () => {
    it('should accept and use the provided transaction client', async () => {
      // This test verifies the service uses the tx parameter, not global prisma
      const mockTx = {
        order: { update: vi.fn() },
        orderView: { upsert: vi.fn() }
      } as unknown as Prisma.TransactionClient;

      await ActivityTrackingService.updateOrderActivity(
        mockTx,
        'order-tx-test',
        'internal-user',
        'internal',
        true
      );

      // Should use the tx client, not the global prisma
      expect(mockTx.order.update).toHaveBeenCalled();
      expect(prisma.order.update).not.toHaveBeenCalled();
    });
  });

  describe('Rule 5: Comment visibility handling', () => {
    it('should handle customer-visible comments (isInternalOnly=false) as customer-visible events', async () => {
      const mockTx = {
        orderItem: { update: vi.fn() },
        orderItemView: { upsert: vi.fn() }
      } as unknown as Prisma.TransactionClient;

      const orderItemId = 'item-customer-comment';
      const actorUserId = 'internal-commenter';
      const actorUserType = 'internal';
      const isCustomerVisible = true; // Comment with isInternalOnly=false

      await ActivityTrackingService.updateOrderItemActivity(
        mockTx,
        orderItemId,
        actorUserId,
        actorUserType,
        isCustomerVisible
      );

      // Should update both fields for customer-visible comments
      expect(mockTx.orderItem.update).toHaveBeenCalledWith({
        where: { id: orderItemId },
        data: {
          lastActivityAt: expect.any(Date),
          lastInternalActivityAt: expect.any(Date)
        }
      });
    });

    it('should handle internal-only comments (isInternalOnly=true) as internal-only events', async () => {
      const mockTx = {
        orderItem: { update: vi.fn() },
        orderItemView: { upsert: vi.fn() }
      } as unknown as Prisma.TransactionClient;

      const orderItemId = 'item-internal-comment';
      const actorUserId = 'internal-commenter';
      const actorUserType = 'internal';
      const isCustomerVisible = false; // Comment with isInternalOnly=true

      await ActivityTrackingService.updateOrderItemActivity(
        mockTx,
        orderItemId,
        actorUserId,
        actorUserType,
        isCustomerVisible
      );

      // Should update only internal field for internal-only comments
      expect(mockTx.orderItem.update).toHaveBeenCalledWith({
        where: { id: orderItemId },
        data: {
          lastInternalActivityAt: expect.any(Date)
          // lastActivityAt should NOT be included
        }
      });
    });
  });
});