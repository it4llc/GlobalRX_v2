// /GlobalRX_v2/src/app/api/fulfillment/services/bulk-assign/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';
import { getServerSession } from 'next-auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/services/service-fulfillment.service', () => ({
  ServiceFulfillmentService: {
    bulkAssignServices: vi.fn()
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

describe('POST /api/fulfillment/services/bulk-assign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['service-1'],
          vendorId: 'vendor-123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 when session exists but user is undefined', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        expires: '2024-12-31'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['service-1'],
          vendorId: 'vendor-123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });
  });

  describe('authorization', () => {
    it('should allow internal users with fulfillment.manage permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { manage: true } }
        }
      });

      const mockResult = {
        updated: 3,
        message: '3 services assigned to vendor'
      };

      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockResolvedValueOnce(mockResult);

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '192.168.1.1',
          'user-agent': 'Test Browser'
        },
        body: JSON.stringify({
          serviceFulfillmentIds: ['service-1', 'service-2', 'service-3'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual(mockResult);

      expect(ServiceFulfillmentService.bulkAssignServices).toHaveBeenCalledWith(
        ['service-1', 'service-2', 'service-3'],
        'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d',
        expect.objectContaining({
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { manage: true } }
        }),
        expect.objectContaining({
          ipAddress: '192.168.1.1',
          userAgent: 'Test Browser'
        })
      );
    });

    it('should return 403 for internal users with only fulfillment permission (not manage)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'internal',
          permissions: { fulfillment: true } // Has fulfillment but not manage
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['service-1'],
          vendorId: 'vendor-123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions - requires fulfillment.manage');
    });

    it('should return 403 for vendor users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['service-1'],
          vendorId: 'vendor-123' // Even assigning to themselves
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions - requires fulfillment.manage');
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

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['service-1'],
          vendorId: 'vendor-123'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions - requires fulfillment.manage');
    });

    it('should allow admin users even without explicit fulfillment.manage', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          userType: 'internal',
          permissions: { admin: true }
        }
      });

      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockResolvedValueOnce({
        updated: 1,
        message: '1 service assigned to vendor'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });
  });

  describe('validation', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { manage: true } }
        }
      });
    });

    it('should return 400 for empty service IDs array', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: [],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
      expect(data.details[0].message).toContain('at least');
    });

    it('should return 400 for more than 100 service IDs', async () => {
      const tooManyIds = Array.from({ length: 101 }, (_, i) =>
        `${i.toString().padStart(8, '0')}-4e3f-4a8b-9c6d-1e2f3a4b5c6d`
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: tooManyIds,
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
      expect(data.details[0].message).toContain('100');
    });

    it('should return 400 for non-UUID service IDs', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['not-a-uuid', 'also-not-uuid'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should return 400 for non-UUID vendor ID', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'not-a-uuid'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should return 400 for missing vendorId', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d']
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should return 400 for missing serviceFulfillmentIds', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should return 400 for non-array serviceFulfillmentIds', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: 'c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d', // String instead of array
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should handle malformed JSON body', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json {'
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid JSON body');
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { manage: true } }
        }
      });
    });

    it('should handle successful bulk assignment', async () => {
      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockResolvedValueOnce({
        updated: 5,
        message: '5 services assigned to vendor'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['s1', 's2', 's3', 's4', 's5'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        updated: 5,
        message: '5 services assigned to vendor'
      });
    });

    it('should handle partial assignment (some services already assigned)', async () => {
      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockResolvedValueOnce({
        updated: 2,
        message: '2 services assigned to vendor (3 were already assigned)'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['s1', 's2', 's3', 's4', 's5'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.updated).toBe(2);
    });

    it('should return 404 when vendor not found', async () => {
      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockRejectedValueOnce(
        new Error('Vendor not found')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'non-existent-vendor'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Vendor not found');
    });

    it('should return 400 when vendor is deactivated', async () => {
      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockRejectedValueOnce(
        new Error('Cannot assign services to deactivated vendor')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'deactivated-vendor-id'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Cannot assign services to deactivated vendor');
    });

    it('should handle reassignment (changing vendor)', async () => {
      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockResolvedValueOnce({
        updated: 3,
        message: '3 services reassigned to new vendor'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['service-1', 'service-2', 'service-3'],
          vendorId: 'new-vendor-id'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.message).toContain('reassigned');
    });
  });

  describe('audit context', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { manage: true } }
        }
      });
    });

    it('should pass IP address and user agent to service', async () => {
      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockResolvedValueOnce({
        updated: 1,
        message: '1 service assigned to vendor'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '10.0.0.1, 192.168.1.1',
          'x-real-ip': '192.168.1.1',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        },
        body: JSON.stringify({
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      await POST(request);

      expect(ServiceFulfillmentService.bulkAssignServices).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
        })
      );
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { manage: true } }
        }
      });
    });

    it('should return 500 when service throws an unexpected error', async () => {
      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to assign services');

      if (process.env.NODE_ENV !== 'production') {
        expect(data).toHaveProperty('details', 'Database connection failed');
      }
    });

    it('should handle timeout errors gracefully', async () => {
      vi.mocked(ServiceFulfillmentService.bulkAssignServices).mockImplementationOnce(
        () => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), 100)
        )
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceFulfillmentIds: ['c47d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'],
          vendorId: 'a12d9b2a-4e3f-4a8b-9c6d-1e2f3a4b5c6d'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to assign services');
    });
  });
});