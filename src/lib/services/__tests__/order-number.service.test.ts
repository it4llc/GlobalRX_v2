// /GlobalRX_v2/src/lib/services/__tests__/order-number.service.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrderNumberService } from '@/lib/services/order-number.service';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

describe('OrderNumberService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date to ensure consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-04-28T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateOrderNumber', () => {
    it('should generate order number with correct format when no existing orders', async () => {
      const customerId = '12345678-1234-5678-1234-567812345678';

      // Mock no existing orders today
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null);
      // Mock no collision
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

      const orderNumber = await OrderNumberService.generateOrderNumber(customerId);

      // Format should be YYYYMMDD-XXX-0001
      expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-\d{4}$/);
      expect(orderNumber).toContain('20240428');
      expect(orderNumber).toContain('-0001');

      // Verify Prisma calls
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: {
          customerId,
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date)
          }
        },
        orderBy: { createdAt: 'desc' },
        select: { orderNumber: true }
      });

      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { orderNumber }
      });
    });

    it('should increment sequence number when existing orders found', async () => {
      const customerId = '12345678-1234-5678-1234-567812345678';

      // Mock existing order with sequence 0003
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
        orderNumber: '20240428-ABC-0003'
      });
      // Mock no collision
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

      const orderNumber = await OrderNumberService.generateOrderNumber(customerId);

      // Should increment to 0004
      expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-0004$/);
    });

    it('should handle collision detection and retry logic', async () => {
      const customerId = '12345678-1234-5678-1234-567812345678';

      // Mock timer to avoid actual delays
      vi.useFakeTimers();

      // Mock sequence of calls for retry logic
      // First attempt: finds last order as 0001
      vi.mocked(prisma.order.findFirst)
        .mockResolvedValueOnce({ orderNumber: '20240428-ABC-0001' });

      // First check: collision detected (order 0002 exists)
      vi.mocked(prisma.order.findUnique)
        .mockResolvedValueOnce({ orderNumber: '20240428-ABC-0002' }); // Collision on 0002

      // After delay, retry: finds last order as 0002 now
      vi.mocked(prisma.order.findFirst)
        .mockResolvedValueOnce({ orderNumber: '20240428-ABC-0002' });

      // Second check: no collision on 0003
      vi.mocked(prisma.order.findUnique)
        .mockResolvedValueOnce(null); // No collision on 0003

      const orderNumberPromise = OrderNumberService.generateOrderNumber(customerId);

      // Advance timers to handle the setTimeout in retry logic
      await vi.runAllTimersAsync();

      const orderNumber = await orderNumberPromise;

      // Should have retried and generated sequence 0003
      expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-0003$/);

      // Verify it tried twice
      expect(prisma.order.findFirst).toHaveBeenCalledTimes(2);
      expect(prisma.order.findUnique).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it('should generate consistent customer code for same customerId', async () => {
      const customerId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

      vi.mocked(prisma.order.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

      const orderNumber1 = await OrderNumberService.generateOrderNumber(customerId);
      const orderNumber2 = await OrderNumberService.generateOrderNumber(customerId);

      // Extract customer codes
      const code1 = orderNumber1.split('-')[1];
      const code2 = orderNumber2.split('-')[1];

      // Should be the same for the same customer
      expect(code1).toBe(code2);
      expect(code1).toMatch(/^[A-Z0-9]{3}$/);
    });

    it('should handle invalid order number format gracefully', async () => {
      const customerId = '12345678-1234-5678-1234-567812345678';

      // Mock existing order with invalid format
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
        orderNumber: 'INVALID-FORMAT'
      });
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

      const orderNumber = await OrderNumberService.generateOrderNumber(customerId);

      // Should default to sequence 0001
      expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-0001$/);
    });

    it('should handle orders from different days correctly', async () => {
      const customerId = '12345678-1234-5678-1234-567812345678';

      // Mock existing order from yesterday (should be ignored)
      vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null); // No orders today
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

      const orderNumber = await OrderNumberService.generateOrderNumber(customerId);

      // Should start at 0001 for today
      expect(orderNumber).toContain('-0001');
      expect(orderNumber).toContain('20240428');
    });

  });
});