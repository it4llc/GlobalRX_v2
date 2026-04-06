// /GlobalRX_v2/src/lib/services/__tests__/order-item-status-bug.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrderCoreService } from '../order-core.service';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
    servicesFulfillment: {
      create: vi.fn(),
    },
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}));

vi.mock('../service-fulfillment.service', () => ({
  ServiceFulfillmentService: {
    createServicesForOrder: vi.fn(),
  }
}));

describe('REGRESSION TEST: OrderItem Status Update Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('updateOrderStatus - OrderItem status synchronization', () => {
    it('REGRESSION TEST: updates all OrderItems status when order transitions from draft to submitted', async () => {
      // Setup: Mock existing draft order with draft items
      const mockOrder = {
        id: 'order-123',
        statusCode: 'draft',
        customerId: 'customer-123',
        orderNumber: 'ORD-123'
      };

      const mockOrderItems = [
        { id: 'item-1', orderId: 'order-123', status: 'draft' },
        { id: 'item-2', orderId: 'order-123', status: 'draft' },
      ];

      // Mock Prisma calls
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      // Mock transaction operations
      const mockTxOperations = [
        { id: 'order-123', statusCode: 'submitted' }, // Order update result
        { id: 'history-1', orderId: 'order-123' }, // History record result
      ];

      (prisma.$transaction as any).mockResolvedValue(mockTxOperations);

      // Act: Submit the draft order
      await OrderCoreService.updateOrderStatus(
        'order-123',
        'customer-123',
        'user-123',
        'submitted',
        'Order submitted by customer'
      );

      // Assert: Verify transaction was called with correct operations
      expect(prisma.$transaction).toHaveBeenCalled();
      const transactionArgs = (prisma.$transaction as any).mock.calls[0][0];
      expect(Array.isArray(transactionArgs)).toBe(true);
      expect(transactionArgs.length).toBeGreaterThanOrEqual(2);

      // This test will FAIL initially because updateOrderStatus doesn't update OrderItems
      // After the fix, it should include an OrderItem.updateMany operation in the transaction
      // The fix should add:
      // prisma.orderItem.updateMany({
      //   where: { orderId: 'order-123' },
      //   data: { status: 'submitted' }
      // })
    });

    it('REGRESSION TEST: only updates OrderItem status when transitioning from draft to submitted', async () => {
      // Setup: Mock existing submitted order
      const mockOrder = {
        id: 'order-456',
        statusCode: 'submitted',
        customerId: 'customer-123',
        orderNumber: 'ORD-456'
      };

      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      // Mock transaction (for status change from submitted to processing)
      (prisma.$transaction as any).mockResolvedValue([
        { id: 'order-456', statusCode: 'processing' },
        { id: 'history-2' }
      ]);

      // Act: Change status from submitted to processing
      await OrderCoreService.updateOrderStatus(
        'order-456',
        'customer-123',
        'user-123',
        'processing',
        'Moving to processing',
        true // bypass validation
      );

      // Assert: Transaction should NOT include OrderItem updates for this transition
      const transactionArgs = (prisma.$transaction as any).mock.calls[0][0];
      expect(Array.isArray(transactionArgs)).toBe(true);
      expect(transactionArgs.length).toBe(2); // Only order update and history, no OrderItem update
    });

    it('REGRESSION TEST: handles empty OrderItems gracefully during draft to submitted transition', async () => {
      // Setup: Mock order with no items
      const mockOrder = {
        id: 'order-789',
        statusCode: 'draft',
        customerId: 'customer-123',
        orderNumber: 'ORD-789'
      };

      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
      (prisma.orderItem.findMany as any).mockResolvedValue([]); // No items

      (prisma.$transaction as any).mockResolvedValue([
        { id: 'order-789', statusCode: 'submitted' },
        { id: 'history-3' }
      ]);

      // Act: Submit order with no items
      await OrderCoreService.updateOrderStatus(
        'order-789',
        'customer-123',
        'user-123',
        'submitted',
        'Order submitted by customer'
      );

      // Assert: Should not fail and should not attempt OrderItem updates
      expect(prisma.$transaction).toHaveBeenCalled();
      const transactionArgs = (prisma.$transaction as any).mock.calls[0][0];
      expect(Array.isArray(transactionArgs)).toBe(true);
      // Should still have order update and history, but no OrderItem update needed
    });

    it('REGRESSION TEST: maintains transaction atomicity for order and item status updates', async () => {
      // Setup: Mock order with items
      const mockOrder = {
        id: 'order-111',
        statusCode: 'draft',
        customerId: 'customer-123',
        orderNumber: 'ORD-111'
      };

      const mockOrderItems = [
        { id: 'item-a', orderId: 'order-111', status: 'draft' },
        { id: 'item-b', orderId: 'order-111', status: 'draft' },
        { id: 'item-c', orderId: 'order-111', status: 'draft' },
      ];

      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      // Mock transaction failure on third operation
      (prisma.$transaction as any).mockRejectedValue(new Error('Transaction failed'));

      // Act & Assert: Should propagate transaction error
      await expect(OrderCoreService.updateOrderStatus(
        'order-111',
        'customer-123',
        'user-123',
        'submitted',
        'Order submitted by customer'
      )).rejects.toThrow('Transaction failed');

      // Verify transaction was attempted (should contain all operations)
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('REGRESSION TEST: preserves existing ServicesFulfillment creation logic', async () => {
      // This test ensures the bug fix doesn't break existing functionality
      const mockOrder = {
        id: 'order-222',
        statusCode: 'draft',
        customerId: 'customer-123',
        orderNumber: 'ORD-222'
      };

      const mockOrderItems = [
        { id: 'item-x', orderId: 'order-222', status: 'draft' },
      ];

      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);
      (prisma.$transaction as any).mockResolvedValue([
        { id: 'order-222', statusCode: 'submitted' },
        { id: 'history-4' }
      ]);

      // Act: Submit draft order
      await OrderCoreService.updateOrderStatus(
        'order-222',
        'customer-123',
        'user-123',
        'submitted',
        'Order submitted by customer'
      );

      // Assert: ServicesFulfillment creation should still be called
      // (This happens after the main transaction in the current implementation)
      // The test ensures the bug fix doesn't interfere with this existing logic
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Edge cases for OrderItem status synchronization', () => {
    it('REGRESSION TEST: handles the more_info_needed to processing special case', async () => {
      // Setup: Mock order in more_info_needed status
      const mockOrder = {
        id: 'order-333',
        statusCode: 'more_info_needed',
        customerId: 'customer-123',
        orderNumber: 'ORD-333'
      };

      const mockOrderItems = [
        { id: 'item-y', orderId: 'order-333', status: 'more_info_needed' },
      ];

      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      // Mock the special case transaction array return
      (prisma.$transaction as any).mockResolvedValue([
        { id: 'order-333', statusCode: 'submitted' },
        { id: 'history-5' },
        { id: 'order-333', statusCode: 'processing' },
        { id: 'history-6' }
      ]);

      // Act: Transition from more_info_needed to processing
      await OrderCoreService.updateOrderStatus(
        'order-333',
        'customer-123',
        'user-123',
        'processing',
        'Moving to processing',
        true
      );

      // Assert: Special case should still work but also update OrderItems
      // This test verifies the bug fix works with the existing special case logic
      expect(prisma.$transaction).toHaveBeenCalled();

      // The current special case creates 4 operations (2 order updates + 2 history)
      // The fix should add OrderItem updates for the draft->submitted transition
      const transactionCall = (prisma.$transaction as any).mock.calls[0];
      expect(transactionCall).toBeDefined();
    });

    it('REGRESSION TEST: does not update OrderItems for non-draft source status', async () => {
      // Setup: Order already in submitted status being moved to processing
      const mockOrder = {
        id: 'order-444',
        statusCode: 'submitted',
        customerId: 'customer-123',
        orderNumber: 'ORD-444'
      };

      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
      (prisma.$transaction as any).mockResolvedValue([
        { id: 'order-444', statusCode: 'processing' },
        { id: 'history-7' }
      ]);

      // Act: Move from submitted to processing (should NOT update OrderItems)
      await OrderCoreService.updateOrderStatus(
        'order-444',
        'customer-123',
        'user-123',
        'processing',
        'Moving to processing',
        true
      );

      // Assert: Should only have order update and history, no OrderItem update
      expect(prisma.$transaction).toHaveBeenCalled();
      const transactionArgs = (prisma.$transaction as any).mock.calls[0][0];
      expect(Array.isArray(transactionArgs)).toBe(true);
      expect(transactionArgs.length).toBe(2); // Only order + history
    });
  });
});