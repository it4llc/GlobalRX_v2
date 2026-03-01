// /GlobalRX_v2/src/app/api/orders/[id]/assign/__tests__/route.test.ts

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
    },
    orderStatusHistory: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

describe('PUT /api/orders/[id]/assign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456',
          assignmentNotes: 'Reassigning to vendor'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(401);
    });

    it('should return 403 when customer user tries to assign order', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          type: 'customer',
          customerId: 'customer-123',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toBe('Only internal users can assign orders');
    });

    it('should return 403 when vendor user tries to assign order', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '2',
          type: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(403);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          type: 'internal',
          permissions: { candidate_workflow: true }
        }
      });
    });

    it('should return 400 when orderId is missing', async () => {
      const request = new Request('http://localhost:3000/api/orders//assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456'
        })
      });
      const params = { params: { id: '' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(400);
    });

    it('should accept null vendorId for internal assignment', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-123',
        assignedVendorId: 'vendor-456',
        status: 'pending'
      });

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        return fn(prisma);
      });

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'order-123',
        assignedVendorId: null
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: null,
          assignmentNotes: 'Reassigning to internal team'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(200);
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          type: 'internal',
          permissions: { candidate_workflow: true }
        }
      });
    });

    it('should return 404 when order does not exist', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/orders/non-existent/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456'
        })
      });
      const params = { params: { id: 'non-existent' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Order not found');
    });

    it('should return 404 when vendor does not exist', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-123',
        status: 'pending'
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'non-existent'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data.error).toBe('Vendor not found');
    });

    it('should return 400 when vendor is inactive', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-123',
        status: 'pending'
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce({
        id: 'vendor-456',
        name: 'Inactive Vendor',
        isActive: false
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.error).toBe('Cannot assign to inactive vendor');
    });

    it('should return 409 when order is already completed', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-123',
        statusCode: 'completed',
        assignedVendorId: null
      });

      // Mock vendor lookup (should not reach this point, but needed for safety)
      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce({
        id: 'vendor-456',
        name: 'Test Vendor',
        isActive: true
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data.error).toBe('Cannot reassign completed order');
    });

    it('should successfully assign order to vendor', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-123',
        status: 'pending',
        assignedVendorId: null
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce({
        id: 'vendor-456',
        name: 'Active Vendor',
        isActive: true
      });

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        return fn(prisma);
      });

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'order-123',
        assignedVendorId: 'vendor-456',
        assignedAt: new Date()
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456',
          assignmentNotes: 'Urgent processing needed'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.assignedVendorId).toBe('vendor-456');
      expect(data.assignedAt).toBeDefined();
    });

    it('should create status history entry on assignment', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-123',
        statusCode: 'processing',
        assignedVendorId: null
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce({
        id: 'vendor-456',
        name: 'Active Vendor',
        isActive: true
      });

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        return fn(prisma);
      });

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'order-123',
        assignedVendorId: 'vendor-456'
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456'
        })
      });
      const params = { params: { id: 'order-123' } };

      await PUT(request, params);

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            orderId: 'order-123',
            fromStatus: 'processing',
            toStatus: 'processing',
            reason: expect.any(String),
            changedBy: expect.any(String)
          })
        })
      );
    });

    it('should handle reassignment from one vendor to another', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-123',
        statusCode: 'processing',
        assignedVendorId: 'vendor-111'
      });

      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce({
        id: 'vendor-456',
        name: 'New Vendor',
        isActive: true
      });

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (fn) => {
        return fn(prisma);
      });

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'order-123',
        assignedVendorId: 'vendor-456'
      });

      const request = new Request('http://localhost:3000/api/orders/order-123/assign', {
        method: 'PUT',
        body: JSON.stringify({
          vendorId: 'vendor-456',
          assignmentNotes: 'Vendor change requested by customer'
        })
      });
      const params = { params: { id: 'order-123' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(200);

      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reason: expect.stringContaining('Reassigned from vendor-111 to vendor-456')
          })
        })
      );
    });
  });
});