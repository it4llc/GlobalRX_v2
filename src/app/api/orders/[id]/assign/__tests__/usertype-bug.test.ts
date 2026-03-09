// /GlobalRX_v2/src/app/api/orders/[id]/assign/__tests__/usertype-bug.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    vendorOrganization: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

/**
 * BUG PROOF TEST SUITE
 *
 * These tests prove that /api/orders/[id]/assign incorrectly uses `session.user.type`
 * on line 21 instead of the correct `session.user.userType` property.
 *
 * EXPECTED BEHAVIOR: These tests should FAIL with the current buggy implementation
 * and PASS after the fix is applied.
 *
 * The route should only allow internal users to assign orders to vendors.
 */
describe('UserType Bug - Order Assignment Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOrder = {
    id: 'order-123',
    orderNumber: 'ORD-2024-001',
    customerId: 'customer-456',
    vendorId: null,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockVendor = {
    id: 'vendor-789',
    name: 'Test Vendor',
    isActive: true,
    isPrimary: false,
    contactEmail: 'vendor@example.com',
    contactPhone: '555-0000'
  };

  describe('PUT /api/orders/[id]/assign - userType bug', () => {
    it('should allow internal users with userType to assign orders', async () => {
      // Internal user with ONLY userType set (not type)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // CORRECT property
          // Note: NO 'type' property - this proves the bug
          permissions: { orders: { assign: true } }
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);
      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(mockVendor);
      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        ...mockOrder,
        vendorId: 'vendor-789'
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-789'
        })
      });

      const response = await PUT(request, { params: { id: 'order-123' } });

      // Internal users should be allowed to assign orders
      // This will FAIL if the code checks session.user.type instead of userType
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.order.vendorId).toBe('vendor-789');
    });

    it('should block vendor users with userType from assigning orders', async () => {
      // Vendor user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          userType: 'vendor',  // CORRECT property
          // Note: NO 'type' property
          vendorId: 'vendor-456',
          permissions: { orders: { assign: true } }  // Even with permission
        }
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-789'
        })
      });

      const response = await PUT(request, { params: { id: 'order-123' } });

      // Vendor users should NOT be allowed to assign orders
      // This will FAIL if the code doesn't properly check userType
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only internal users can assign orders');
    });

    it('should block customer users with userType from assigning orders', async () => {
      // Customer user with ONLY userType set
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '3',
          userType: 'customer',  // CORRECT property
          // Note: NO 'type' property
          customerId: 'customer-123',
          permissions: { orders: { assign: true } }  // Even with permission
        }
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-789'
        })
      });

      const response = await PUT(request, { params: { id: 'order-123' } });

      // Customer users should NOT be allowed to assign orders
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only internal users can assign orders');
    });

    it('should handle undefined userType gracefully', async () => {
      // Session without any type property (edge case)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '4',
          // No type or userType property at all
          permissions: { orders: { assign: true } }
        }
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-789'
        })
      });

      const response = await PUT(request, { params: { id: 'order-123' } });

      // Should be blocked since userType is not 'internal'
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Only internal users can assign orders');
    });

    it('should use userType when both type and userType exist but differ', async () => {
      // Edge case: both properties exist but with different values
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',  // Correct property says internal
          type: 'vendor' as any,  // Wrong property says vendor
          permissions: { orders: { assign: true } }
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);
      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(mockVendor);
      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        ...mockOrder,
        vendorId: 'vendor-789'
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-789'
        })
      });

      const response = await PUT(request, { params: { id: 'order-123' } });

      // Should respect userType (internal) and allow, not type (vendor) which would block
      // This will FAIL if code uses type instead of userType
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.order.vendorId).toBe('vendor-789');
    });
  });

  describe('Business logic validation', () => {
    it('should validate vendor exists before assignment', async () => {
      // Internal user with correct userType
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { orders: { assign: true } }
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);
      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(null); // Vendor doesn't exist

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'nonexistent-vendor'
        })
      });

      const response = await PUT(request, { params: { id: 'order-123' } });

      // Should fail if vendor doesn't exist
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Vendor not found');
    });

    it('should validate order exists before assignment', async () => {
      // Internal user with correct userType
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { orders: { assign: true } }
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null); // Order doesn't exist

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-789'
        })
      });

      const response = await PUT(request, { params: { id: 'order-123' } });

      // Should fail if order doesn't exist
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Order not found');
    });
  });
});