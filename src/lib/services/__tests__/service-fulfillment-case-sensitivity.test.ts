// /GlobalRX_v2/src/lib/services/__tests__/service-fulfillment-case-sensitivity.test.ts
// Test for case sensitivity fix in ServiceFulfillmentService.checkAllServicesSubmitted
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceFulfillmentService } from '../service-fulfillment.service';
import { prisma } from '@/lib/prisma';

// Type for the partial OrderItem returned by the select query
type PartialOrderItem = {
  status: string | null;
};

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn()
  }
}));

describe('ServiceFulfillmentService - Case Sensitivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAllServicesSubmitted', () => {
    it('should handle mixed case status values correctly', async () => {
      // Mock order items with mixed case statuses (as they come from the database)
      const mockItems: PartialOrderItem[] = [
        { status: 'Submitted' }, // Title case
        { status: 'SUBMITTED' }, // Upper case
        { status: 'submitted' }  // Lower case
      ];
      // @ts-expect-error - Mocking partial Prisma return type for testing
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce(mockItems);

      const result = await ServiceFulfillmentService.checkAllServicesSubmitted('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toBe(true);
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: '550e8400-e29b-41d4-a716-446655440001' },
        select: { status: true }
      });
    });

    it('should return false when one service has different case non-submitted status', async () => {
      const mockItems: PartialOrderItem[] = [
        { status: 'Submitted' },
        { status: 'Processing' }, // Title case Processing
        { status: 'submitted' }
      ];
      // @ts-expect-error - Mocking partial Prisma return type for testing
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce(mockItems);

      const result = await ServiceFulfillmentService.checkAllServicesSubmitted('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toBe(false);
    });

    it('should handle null status values safely', async () => {
      const mockItems: PartialOrderItem[] = [
        { status: 'Submitted' },
        { status: null }, // Null status
        { status: 'submitted' }
      ];
      // @ts-expect-error - Mocking partial Prisma return type for testing
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce(mockItems);

      const result = await ServiceFulfillmentService.checkAllServicesSubmitted('550e8400-e29b-41d4-a716-446655440001');

      expect(result).toBe(false);
    });

    it('should return true when all services are submitted regardless of case', async () => {
      const testCases = [
        ['submitted', 'submitted', 'submitted'],
        ['Submitted', 'Submitted', 'Submitted'],
        ['SUBMITTED', 'SUBMITTED', 'SUBMITTED'],
        ['submitted', 'Submitted', 'SUBMITTED'], // Mixed cases
      ];

      for (const statuses of testCases) {
        const mockItems: PartialOrderItem[] = statuses.map(status => ({ status }));
        // @ts-expect-error - Mocking partial Prisma return type for testing
        vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce(mockItems);

        const result = await ServiceFulfillmentService.checkAllServicesSubmitted('550e8400-e29b-41d4-a716-446655440001');
        expect(result).toBe(true);
      }
    });
  });
});