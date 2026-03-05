// /GlobalRX_v2/src/app/api/fulfillment/services/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/services/service-fulfillment.service', () => ({
  ServiceFulfillmentService: {
    getServices: vi.fn()
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

describe('GET /api/fulfillment/services', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 when session exists but user is undefined', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        expires: '2024-12-31'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(401);
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

      const mockServices = {
        services: [
          { id: 'service-1', status: 'pending' },
          { id: 'service-2', status: 'processing' }
        ],
        total: 2,
        limit: 50,
        offset: 0
      };

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce(mockServices);

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(mockServices);
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

      const vendorServices = {
        services: [
          { id: 'service-1', assignedVendorId: 'vendor-123', status: 'submitted' }
        ],
        total: 1,
        limit: 50,
        offset: 0
      };

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce(vendorServices);

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(vendorServices);

      // Verify service was called with vendor user context
      expect(ServiceFulfillmentService.getServices).toHaveBeenCalledWith(
        expect.objectContaining({
          userType: 'vendor',
          vendorId: 'vendor-123'
        }),
        expect.any(Object)
      );
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

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions to view services');
    });

    it('should return 403 for internal users without fulfillment permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'internal',
          permissions: { customers: true } // Has other permissions but not fulfillment
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions to view services');
    });
  });

  describe('query parameters', () => {
    beforeEach(() => {
      // Setup valid internal user for query tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });
    });

    it('should pass orderId filter to service', async () => {
      const orderId = 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d';
      const request = new Request(`http://localhost:3000/api/fulfillment/services?orderId=${orderId}`);

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce({
        services: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await GET(request);

      expect(ServiceFulfillmentService.getServices).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          orderId
        })
      );
    });

    it('should pass status filter to service', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services?status=completed');

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce({
        services: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await GET(request);

      expect(ServiceFulfillmentService.getServices).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          status: 'completed'
        })
      );
    });

    it('should pass vendorId filter to service', async () => {
      const vendorId = 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d';
      const request = new Request(`http://localhost:3000/api/fulfillment/services?vendorId=${vendorId}`);

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce({
        services: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      await GET(request);

      expect(ServiceFulfillmentService.getServices).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          vendorId
        })
      );
    });

    it('should pass pagination parameters to service', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services?limit=25&offset=50');

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce({
        services: [],
        total: 100,
        limit: 25,
        offset: 50
      });

      await GET(request);

      expect(ServiceFulfillmentService.getServices).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          limit: 25,
          offset: 50
        })
      );
    });

    it('should handle multiple filters together', async () => {
      const request = new Request(
        'http://localhost:3000/api/fulfillment/services?orderId=c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d&status=processing&limit=10'
      );

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce({
        services: [],
        total: 5,
        limit: 10,
        offset: 0
      });

      await GET(request);

      expect(ServiceFulfillmentService.getServices).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          orderId: 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
          status: 'processing',
          limit: 10,
          offset: 0
        })
      );
    });

    it('should return 400 for invalid query parameters', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services?status=invalid-status');

      const response = await GET(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid query parameters');
      expect(data).toHaveProperty('details');
    });

    it('should return 400 for invalid UUID in orderId', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services?orderId=not-a-uuid');

      const response = await GET(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid query parameters');
    });

    it('should return 400 for limit exceeding maximum', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services?limit=101');

      const response = await GET(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid query parameters');
    });

    it('should return 400 for negative offset', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services?offset=-1');

      const response = await GET(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid query parameters');
    });
  });

  describe('response format', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });
    });

    it('should return services with full details for internal users', async () => {
      const fullServices = {
        services: [
          {
            id: 'service-1',
            orderId: 'order-1',
            orderItemId: 'item-1',
            serviceId: 'service-type-1',
            locationId: 'location-1',
            status: 'processing',
            assignedVendorId: 'vendor-123',
            vendorNotes: 'In progress',
            internalNotes: 'Priority customer',
            assignedAt: new Date('2024-03-01T10:00:00Z'),
            assignedBy: 'user-456',
            completedAt: null,
            createdAt: new Date('2024-03-01T09:00:00Z'),
            updatedAt: new Date('2024-03-01T11:00:00Z'),
            order: {
              orderNumber: '20240301-ABC-0001',
              customer: { name: 'ACME Corp' }
            },
            service: { name: 'Criminal Background Check' },
            location: { name: 'National' },
            assignedVendor: { name: 'Background Vendor Inc' }
          }
        ],
        total: 1,
        limit: 50,
        offset: 0
      };

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce(fullServices);

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(fullServices);
      expect(data.services[0]).toHaveProperty('order');
      expect(data.services[0]).toHaveProperty('service');
      expect(data.services[0]).toHaveProperty('location');
      expect(data.services[0]).toHaveProperty('assignedVendor');
    });

    it('should return limited details for vendor users', async () => {
      vi.clearAllMocks(); // Clear previous setup
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const vendorServices = {
        services: [
          {
            id: 'service-1',
            status: 'submitted',
            assignedVendorId: 'vendor-123',
            vendorNotes: 'Working on it',
            order: { orderNumber: '20240301-ABC-0001' }, // Only order number, no customer details
            service: { name: 'Criminal Background Check' },
            location: { name: 'National' }
            // No internal notes, customer info, etc.
          }
        ],
        total: 1,
        limit: 50,
        offset: 0
      };

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce(vendorServices);

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.services[0].order).toHaveProperty('orderNumber');
      expect(data.services[0].order).not.toHaveProperty('customer');
    });

    it('should include pagination metadata in response', async () => {
      const paginatedServices = {
        services: [],
        total: 150,
        limit: 25,
        offset: 50
      };

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce(paginatedServices);

      const request = new Request('http://localhost:3000/api/fulfillment/services?limit=25&offset=50');

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('total', 150);
      expect(data).toHaveProperty('limit', 25);
      expect(data).toHaveProperty('offset', 50);
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

    it('should return 500 when service throws an error', async () => {
      vi.mocked(ServiceFulfillmentService.getServices).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to fetch services');

      // In non-production, details are included
      if (process.env.NODE_ENV !== 'production') {
        expect(data).toHaveProperty('details', 'Database connection failed');
      }
    });

    it('should handle timeout errors gracefully', async () => {
      vi.mocked(ServiceFulfillmentService.getServices).mockImplementationOnce(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), 100)
        )
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to fetch services');
    });
  });

  describe('vendor filtering', () => {
    it('should only return services assigned to the vendor user', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user-1',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const vendorSpecificServices = {
        services: [
          { id: 'service-1', assignedVendorId: 'vendor-123', status: 'submitted' },
          { id: 'service-2', assignedVendorId: 'vendor-123', status: 'processing' }
          // Services assigned to other vendors are NOT included
        ],
        total: 2,
        limit: 50,
        offset: 0
      };

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce(vendorSpecificServices);

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      const data = await response.json();

      expect(data.services).toHaveLength(2);
      expect(data.services.every(s => s.assignedVendorId === 'vendor-123')).toBe(true);
    });

    it('should include terminal status services for vendors', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user-1',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const servicesWithTerminalStatus = {
        services: [
          { id: 'service-1', assignedVendorId: 'vendor-123', status: 'completed' },
          { id: 'service-2', assignedVendorId: 'vendor-123', status: 'cancelled' },
          { id: 'service-3', assignedVendorId: 'vendor-123', status: 'processing' }
        ],
        total: 3,
        limit: 50,
        offset: 0
      };

      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce(servicesWithTerminalStatus);

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);
      const data = await response.json();

      expect(data.services).toHaveLength(3);
      expect(data.services.some(s => s.status === 'completed')).toBe(true);
      expect(data.services.some(s => s.status === 'cancelled')).toBe(true);
    });
  });

  describe('caching headers', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });
    });

    it('should set no-cache headers for sensitive data', async () => {
      vi.mocked(ServiceFulfillmentService.getServices).mockResolvedValueOnce({
        services: [],
        total: 0,
        limit: 50,
        offset: 0
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services');

      const response = await GET(request);

      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });
  });
});