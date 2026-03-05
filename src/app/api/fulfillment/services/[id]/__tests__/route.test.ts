// /GlobalRX_v2/src/app/api/fulfillment/services/[id]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PATCH } from '../route';
import { getServerSession } from 'next-auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/services/service-fulfillment.service', () => ({
  ServiceFulfillmentService: {
    getServiceById: vi.fn(),
    updateService: vi.fn()
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn()
  }
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    vendorOrganization: {
      findUnique: vi.fn()
    }
  }
}));

describe('GET /api/fulfillment/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123');
      const params = { params: { id: 'service-123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('authorization', () => {
    it('should allow internal users with fulfillment permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      const mockService = {
        id: 'service-123',
        orderId: 'order-456',
        status: 'processing',
        assignedVendorId: 'vendor-789'
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123');
      const params = { params: { id: 'service-123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(mockService);
    });

    it('should allow vendor users to see their assigned services', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockService = {
        id: 'service-123',
        assignedVendorId: 'vendor-123',
        status: 'submitted'
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123');
      const params = { params: { id: 'service-123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(mockService);
    });

    it('should return 403 when vendor tries to access unassigned service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      vi.mocked(ServiceFulfillmentService.getServiceById).mockRejectedValueOnce(
        new Error('Access denied')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-456');
      const params = { params: { id: 'service-456' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Access denied');
    });

    it('should return 403 for customer users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123');
      const params = { params: { id: 'service-123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions');
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });
    });

    it('should return 404 when service does not exist', async () => {
      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/services/non-existent');
      const params = { params: { id: 'non-existent' } };

      const response = await GET(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service not found');
    });

    it('should return 400 when service ID is not provided', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/');
      const params = { params: { id: '' } };

      const response = await GET(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service ID is required');
    });

    it('should return full service details including relations', async () => {
      const fullServiceDetails = {
        id: 'service-123',
        orderId: 'order-456',
        orderItemId: 'item-789',
        serviceId: 'service-type-1',
        locationId: 'location-1',
        status: 'processing',
        assignedVendorId: 'vendor-123',
        vendorNotes: 'Working on verification',
        internalNotes: 'Rush order',
        assignedAt: '2024-03-01T10:00:00.000Z',
        assignedBy: 'user-456',
        completedAt: null,
        createdAt: '2024-03-01T09:00:00.000Z',
        updatedAt: '2024-03-01T11:00:00.000Z',
        order: {
          orderNumber: '20240301-ABC-0001',
          customer: { name: 'ACME Corp' }
        },
        service: { name: 'Criminal Background Check' },
        location: { name: 'National' },
        assignedVendor: { name: 'Background Vendor Inc' }
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(fullServiceDetails);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123');
      const params = { params: { id: 'service-123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(fullServiceDetails);
      expect(data).toHaveProperty('order');
      expect(data).toHaveProperty('service');
      expect(data).toHaveProperty('location');
      expect(data).toHaveProperty('assignedVendor');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });
    });

    it('should return 500 when service throws an unexpected error', async () => {
      vi.mocked(ServiceFulfillmentService.getServiceById).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123');
      const params = { params: { id: 'service-123' } };

      const response = await GET(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to fetch service');
    });
  });
});

describe('PATCH /api/fulfillment/services/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing' })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('authorization', () => {
    it('should allow internal users with fulfillment permission to update status', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      const updatedService = {
        id: 'service-123',
        status: 'processing'
      };

      vi.mocked(ServiceFulfillmentService.updateService).mockResolvedValueOnce(updatedService);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({ status: 'processing' })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(updatedService);

      expect(ServiceFulfillmentService.updateService).toHaveBeenCalledWith(
        'service-123',
        { status: 'processing' },
        expect.objectContaining({
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }),
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser'
        })
      );
    });

    it('should allow vendor users to update their assigned services', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const updatedService = {
        id: 'service-123',
        assignedVendorId: 'vendor-123',
        status: 'processing',
        vendorNotes: 'Updated notes'
      };

      vi.mocked(ServiceFulfillmentService.updateService).mockResolvedValueOnce(updatedService);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'processing',
          vendorNotes: 'Updated notes'
        })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(updatedService);
    });

    it('should require fulfillment.manage permission for vendor assignment', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { view: true } } // Has view but not manage
        }
      });

      // No need to mock updateService - the route should return 403 before calling it

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedVendorId: 'a1234567-89ab-cdef-0123-456789abcdef' })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions to assign vendors');
    });

    it('should prevent vendors from updating internal notes', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      vi.mocked(ServiceFulfillmentService.updateService).mockRejectedValueOnce(
        new Error('Vendors cannot update internal notes')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ internalNotes: 'Should not be allowed' })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Vendors cannot update internal notes');
    });

    it('should return 403 for customer users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing' })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions');
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });
    });

    it('should return 400 for invalid status value', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'invalid-status' })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
      expect(data).toHaveProperty('details');
    });

    it('should return 400 for non-UUID vendor ID', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedVendorId: 'not-a-uuid' })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should return 400 for notes exceeding maximum length', async () => {
      const tooLongNote = 'A'.repeat(5001);
      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorNotes: tooLongNote })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should return 400 when service ID is not provided', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing' })
      });
      const params = { params: { id: '' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service ID is required');
    });

    it('should return 400 for empty update body', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Request body cannot be empty');
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });
    });

    it('should return 404 when service does not exist', async () => {
      vi.mocked(ServiceFulfillmentService.updateService).mockRejectedValueOnce(
        new Error('Service with ID non-existent not found')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/non-existent', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing' })
      });
      const params = { params: { id: 'non-existent' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service not found');
    });

    it('should prevent assignment to deactivated vendor', async () => {
      // Mock session with manage permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { manage: true } }
        }
      });

      // Mock vendor as deactivated
      const vendorId = 'b1234567-89ab-cdef-0123-456789abcdef';
      vi.mocked(prisma.vendorOrganization.findUnique).mockResolvedValueOnce({
        id: vendorId,
        name: 'Deactivated Vendor',
        deactivated: true
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedVendorId: vendorId })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Cannot assign to deactivated vendor');
    });

    it('should allow multiple field updates in single request', async () => {
      const updatedService = {
        id: 'service-123',
        status: 'completed',
        vendorNotes: 'All checks passed',
        internalNotes: 'Approved for hire',
        completedAt: new Date().toISOString()
      };

      vi.mocked(ServiceFulfillmentService.updateService).mockResolvedValueOnce(updatedService);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'completed',
          vendorNotes: 'All checks passed',
          internalNotes: 'Approved for hire'
        })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(updatedService);
      expect(data.status).toBe('completed');
      expect(data.completedAt).toBeDefined();
    });

    it('should allow unassigning vendor by setting to null', async () => {
      // Mock session for internal user with manage permission
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { manage: true } }
        }
      });

      const updatedService = {
        id: 'service-123',
        assignedVendorId: null,
        assignedAt: null,
        assignedBy: null
      };

      vi.mocked(ServiceFulfillmentService.updateService).mockResolvedValueOnce(updatedService);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedVendorId: null })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.assignedVendorId).toBeNull();
    });
  });

  describe('audit context', () => {
    it('should pass IP address and user agent to service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.updateService).mockResolvedValueOnce({
        id: 'service-123',
        status: 'processing'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '10.0.0.1, 192.168.1.1',
          'x-real-ip': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        body: JSON.stringify({ status: 'processing' })
      });
      const params = { params: { id: 'service-123' } };

      await PATCH(request, params);

      expect(ServiceFulfillmentService.updateService).toHaveBeenCalledWith(
        'service-123',
        { status: 'processing' },
        expect.any(Object),
        expect.objectContaining({
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        })
      );
    });
  });

  describe('error handling', () => {
    it('should return 500 when service throws an unexpected error', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.updateService).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'processing' })
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to update service');
    });

    it('should handle malformed JSON body', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {'
      });
      const params = { params: { id: 'service-123' } };

      const response = await PATCH(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid JSON body');
    });
  });
});