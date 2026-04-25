// /GlobalRX_v2/src/lib/services/__tests__/order-core-includeviews-parameter.test.ts

/* SOURCE FILES READ LOG (Pass 2):
 * - prisma/schema.prisma (lines 640-672) - confirmed OrderView and OrderItemView models with relations
 * - src/lib/services/order-core.service.ts (lines 723-833) - read entire getCustomerOrders method
 * - src/test/setup.ts - confirmed global Prisma mock pattern via createMockPrisma()
 * - src/lib/services/__tests__/service-fulfillment.service.test.ts - reference pattern for vi.mocked usage
 */

/* PATTERN MATCH BLOCK:
 * Existing tests read:
 * 1. src/lib/services/__tests__/service-fulfillment.service.test.ts
 * 2. src/test/setup.ts (global mock setup)
 *
 * Patterns copied:
 * - Import style: import { prisma } from '@/lib/prisma' (uses global mock from setup.ts)
 * - Mock setup: Uses vi.mocked(prisma.order.findMany) to control return values
 * - Test data setup: Creates mock data matching Prisma return shapes
 * - Assertion style: Asserts on method call arguments, not function call counts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderCoreService } from '../order-core.service';
import { prisma } from '@/lib/prisma';

// Note: Global Prisma mock is already set up in src/test/setup.ts
// We use vi.mocked() to control behavior per test

describe('OrderCoreService - includeViews parameter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCustomerOrders includeViews parameter', () => {
    it('when includeViews is true and userId is provided: should include orderViews and per-item orderItemViews filtered by userId', async () => {
      const customerId = 'customer-123';
      const userId = 'user-456';
      const includeViews = true;

      const mockOrders = [
        {
          id: 'order-1',
          customerId,
          orderViews: [{ lastViewedAt: new Date('2024-01-15T10:00:00Z') }],
          items: [
            {
              id: 'item-1',
              orderItemViews: [{ lastViewedAt: new Date('2024-01-14T10:00:00Z') }]
            }
          ]
        }
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      await OrderCoreService.getCustomerOrders(customerId, {}, includeViews, userId);

      // Assert that the Prisma query includes view relations with correct userId filter
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { customerId },
        include: {
          items: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
              location: {
                select: {
                  id: true,
                  name: true,
                  code2: true,
                },
              },
              orderItemViews: {
                where: { userId },
                select: { lastViewedAt: true },
                take: 1
              }
            },
            orderBy: [
              { service: { name: 'asc' } },
              { createdAt: 'asc' }
            ],
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          candidateInvitations: {
            select: {
              id: true,
              status: true,
            },
            take: 1,
          },
          orderViews: {
            where: { userId },
            select: { lastViewedAt: true },
            take: 1
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('when includeViews is false: should NOT include orderViews or orderItemViews', async () => {
      const customerId = 'customer-123';
      const userId = 'user-456';
      const includeViews = false;

      const mockOrders = [
        {
          id: 'order-1',
          customerId,
          items: [{ id: 'item-1' }]
        }
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      await OrderCoreService.getCustomerOrders(customerId, {}, includeViews, userId);

      // Assert that the Prisma query does NOT include view relations
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { customerId },
        include: {
          items: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
              location: {
                select: {
                  id: true,
                  name: true,
                  code2: true,
                },
              },
              // NO orderItemViews property
            },
            orderBy: [
              { service: { name: 'asc' } },
              { createdAt: 'asc' }
            ],
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          candidateInvitations: {
            select: {
              id: true,
              status: true,
            },
            take: 1,
          },
          // NO orderViews property
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('when includeViews is omitted (undefined): should behave same as includeViews false', async () => {
      const customerId = 'customer-123';
      const userId = 'user-456';
      // includeViews is undefined - not passed

      const mockOrders = [
        {
          id: 'order-1',
          customerId,
          items: [{ id: 'item-1' }]
        }
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      await OrderCoreService.getCustomerOrders(customerId, {}, undefined, userId);

      // Assert that the Prisma query does NOT include view relations (same as false)
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { customerId },
        include: {
          items: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
              location: {
                select: {
                  id: true,
                  name: true,
                  code2: true,
                },
              },
              // NO orderItemViews property
            },
            orderBy: [
              { service: { name: 'asc' } },
              { createdAt: 'asc' }
            ],
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          candidateInvitations: {
            select: {
              id: true,
              status: true,
            },
            take: 1,
          },
          // NO orderViews property
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('when includeViews is true but no userId provided: should NOT include view relations', async () => {
      const customerId = 'customer-123';
      const includeViews = true;
      // userId is undefined - not passed

      const mockOrders = [
        {
          id: 'order-1',
          customerId,
          items: [{ id: 'item-1' }]
        }
      ];

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      await OrderCoreService.getCustomerOrders(customerId, {}, includeViews, undefined);

      // Assert that the Prisma query does NOT include view relations
      // because userId is required for the WHERE clause
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        where: { customerId },
        include: {
          items: {
            include: {
              service: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                },
              },
              location: {
                select: {
                  id: true,
                  name: true,
                  code2: true,
                },
              },
              // NO orderItemViews property - userId required for WHERE clause
            },
            orderBy: [
              { service: { name: 'asc' } },
              { createdAt: 'asc' }
            ],
          },
          statusHistory: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          candidateInvitations: {
            select: {
              id: true,
              status: true,
            },
            take: 1,
          },
          // NO orderViews property - userId required for WHERE clause
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });
});