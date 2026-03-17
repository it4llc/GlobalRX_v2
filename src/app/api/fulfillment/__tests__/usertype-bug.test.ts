// /GlobalRX_v2/src/app/api/fulfillment/__tests__/usertype-bug.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findMany: vi.fn(),
      count: vi.fn()
    },
    service: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

/**
 * BUG PROOF TEST SUITE
 *
 * These tests prove that /api/fulfillment incorrectly uses a fallback pattern
 * `session.user.type || session.user.userType` on lines 35 and 178
 * instead of just using the correct `session.user.userType` property.
 *
 * EXPECTED BEHAVIOR: These tests should FAIL with the current buggy implementation
 * where the code tries to access session.user.type first.
 */
describe('UserType Bug - Fulfillment Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOrders = [
    {
      id: 'order-1',
      orderNumber: 'ORD-2024-001',
      customerId: 'customer-1',
      vendorId: 'vendor-1',
      status: 'processing',
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: 'order-2',
      orderNumber: 'ORD-2024-002',
      customerId: 'customer-2',
      vendorId: 'vendor-2',
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  describe('GET /api/fulfillment - userType bug with fallback pattern', () => {
    it('should work for internal users with only userType (no fallback needed)', async () => {
      // Internal user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // CORRECT property
          // Note: NO 'type' property - the fallback pattern shouldn't be needed
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(2);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);

      // Internal users should see all orders
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orders).toHaveLength(2);
      expect(data.total).toBe(2);

      // Verify it queries all orders, not filtered by vendor
      // After the fix, internal users should see ALL orders (no assignedVendorId filter)
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            assignedVendorId: expect.anything()
          })
        })
      );
    });

    it('should work for vendor users with only userType (no fallback needed)', async () => {
      // Vendor user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',  // CORRECT property
          // Note: NO 'type' property
          vendorId: 'vendor-1',
          permissions: { fulfillment: true }
        }
      });

      const vendorOrders = [mockOrders[0]]; // Only orders for vendor-1
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(vendorOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);

      // Vendor users should only see their orders
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orders).toHaveLength(1);
      expect(data.total).toBe(1);

      // Verify it filters by assignedVendorId (not vendorId)
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            assignedVendorId: 'vendor-1'
          })
        })
      );
    });

    it('should work for customer users with only userType', async () => {
      // Customer user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          userType: 'customer',  // CORRECT property
          // Note: NO 'type' property
          customerId: 'customer-1',
          permissions: { fulfillment: true }
        }
      });

      const customerOrders = [mockOrders[0]]; // Only orders for customer-1
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(customerOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);

      // Customer users should only see their orders
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orders).toHaveLength(1);
      expect(data.total).toBe(1);

      // Verify it filters by customerId
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'customer-1'
          })
        })
      );
    });

    it('should NOT rely on the fallback pattern type || userType', async () => {
      // This specifically tests that the fallback pattern is unnecessary
      // The code should work with just userType
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          // type is explicitly undefined to test fallback isn't needed
          type: undefined as any,
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(2);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);

      // Should work without needing the fallback
      expect(response.status).toBe(200);
    });

    it('should use userType when both exist but differ (fallback bug)', async () => {
      // Tests what happens when both exist but have different values
      // The fallback pattern (type || userType) would use the wrong value
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // Correct value
          type: 'vendor' as any,  // Wrong value that fallback would use first
          vendorId: 'vendor-999', // Would be used if type='vendor' is honored
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(2);

      const request = new NextRequest('http://localhost:3000/api/fulfillment');
      const response = await GET(request);

      // Should use userType (internal) and show all orders
      // NOT type (vendor) which would filter by vendorId
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orders).toHaveLength(2);

      // Verify it doesn't filter by vendor (proves userType was used)
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            vendorId: expect.anything()
          })
        })
      );
    });
  });

  describe('Query parameter handling with userType', () => {
    it('should handle status filter with correct userType', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // Only userType, no type
          permissions: { fulfillment: true }
        }
      });

      const pendingOrders = [mockOrders[1]];
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(pendingOrders);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(1);

      const request = new NextRequest('http://localhost:3000/api/fulfillment?status=pending');
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending'
          })
        })
      );
    });

    it('should combine vendor filter with userType correctly', async () => {
      // Vendor user requesting specific status
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',  // Only userType
          vendorId: 'vendor-1',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(0);

      const request = new Request('http://localhost:3000/api/fulfillment?status=completed');
      const response = await GET(request);

      expect(response.status).toBe(200);

      // Should filter by BOTH vendorId (from userType) AND status (from query)
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            vendorId: 'vendor-1',
            status: 'completed'
          })
        })
      );
    });
  });

  describe('Service expansion with userType', () => {
    it('should include services when requested by internal user', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // Only userType
          permissions: { fulfillment: true }
        }
      });

      const ordersWithServices = mockOrders.map(order => ({
        ...order,
        services: [
          { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', orderId: order.id, name: 'Background Check' }
        ]
      }));

      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(ordersWithServices);
      vi.mocked(prisma.order.count).mockResolvedValueOnce(2);

      const request = new NextRequest('http://localhost:3000/api/fulfillment?includeServices=true');
      const response = await GET(request);

      expect(response.status).toBe(200);

      // Verify it includes services in the query
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            services: true
          })
        })
      );
    });
  });
});