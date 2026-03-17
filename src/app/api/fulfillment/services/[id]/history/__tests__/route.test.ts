// /GlobalRX_v2/src/app/api/fulfillment/services/[id]/history/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { ServiceFulfillmentService } from '@/lib/services/service-fulfillment.service';
import { ServiceAuditService } from '@/lib/services/service-audit.service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/services/service-fulfillment.service', () => ({
  ServiceFulfillmentService: {
    getServiceById: vi.fn()
  }
}));

vi.mock('@/lib/services/service-audit.service', () => ({
  ServiceAuditService: {
    getHistory: vi.fn(),
    logChange: vi.fn(),
    getBulkHistory: vi.fn()
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

describe('GET /api/fulfillment/services/[id]/history', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 when session exists but user is undefined', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        expires: '2024-12-31'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
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

      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing'
      };

      const mockHistory = [
        {
          id: 'log-1',
          serviceFulfillmentId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          changeType: 'status_change',
          fieldName: 'status',
          oldValue: 'pending',
          newValue: 'submitted',
          createdAt: '2024-03-01T10:00:00.000Z',
          user: {
            id: 'user-1',
            email: 'admin@example.com',
            firstName: 'Admin',
            lastName: 'User'
          }
        },
        {
          id: 'log-2',
          serviceFulfillmentId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
          changeType: 'vendor_assignment',
          fieldName: 'assignedVendorId',
          oldValue: null,
          newValue: 'vendor-123',
          createdAt: '2024-03-01T11:00:00.000Z',
          user: {
            id: 'user-2',
            email: 'manager@example.com',
            firstName: 'Manager',
            lastName: 'User'
          }
        }
      ];

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockResolvedValueOnce(mockHistory);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        serviceId: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        history: mockHistory,
        totalEntries: 2
      });
    });

    it('should allow vendor users to see history of their assigned services', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        assignedVendorId: 'vendor-123',
        status: 'processing'
      };

      const mockHistory = [
        {
          id: 'log-1',
          changeType: 'status_change',
          fieldName: 'status',
          oldValue: 'submitted',
          newValue: 'processing',
          createdAt: '2024-03-01T12:00:00.000Z'
        }
      ];

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockResolvedValueOnce(mockHistory);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.history).toEqual(mockHistory);
    });

    it('should return 403 when vendor tries to access unassigned service history', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      // When vendor tries to access unassigned service, getServiceById throws
      vi.mocked(ServiceFulfillmentService.getServiceById).mockRejectedValueOnce(
        new Error('Access denied: Vendor can only access assigned services')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-456/history');
      const params = { params: { id: 'd47ac10b-58cc-4372-a567-0e02b2c3d479' } };

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

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions');
    });

    it('should return 403 for internal users without fulfillment permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'internal',
          permissions: { customers: true } // Has other permissions but not fulfillment
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

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

      const request = new Request('http://localhost:3000/api/fulfillment/services/non-existent/history');
      const params = { params: { id: 'non-existent' } };

      const response = await GET(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service not found');
    });

    it('should return 400 when service ID is not provided', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/services//history');
      const params = { params: { id: '' } };

      const response = await GET(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service ID is required');
    });

    it('should return empty history for service with no changes', async () => {
      const mockService = {
        id: 'service-new',
        status: 'pending'
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-new/history');
      const params = { params: { id: 'service-new' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({
        serviceId: 'service-new',
        history: [],
        totalEntries: 0
      });
    });

    it('should return complete audit history in chronological order', async () => {
      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        status: 'completed'
      };

      const mockHistory = [
        {
          id: 'log-1',
          changeType: 'status_change',
          fieldName: 'status',
          oldValue: 'pending',
          newValue: 'submitted',
          createdAt: '2024-03-01T10:00:00.000Z',
          user: { email: 'user1@example.com' }
        },
        {
          id: 'log-2',
          changeType: 'vendor_assignment',
          fieldName: 'assignedVendorId',
          oldValue: null,
          newValue: 'vendor-123',
          notes: 'Assigned to preferred vendor',
          createdAt: '2024-03-01T11:00:00.000Z',
          user: { email: 'admin@example.com' }
        },
        {
          id: 'log-3',
          changeType: 'status_change',
          fieldName: 'status',
          oldValue: 'submitted',
          newValue: 'processing',
          createdAt: '2024-03-01T12:00:00.000Z',
          user: { email: 'vendor@example.com' }
        },
        {
          id: 'log-4',
          changeType: 'note_update',
          fieldName: 'vendorNotes',
          oldValue: null,
          newValue: 'Background check in progress',
          createdAt: '2024-03-01T13:00:00.000Z',
          user: { email: 'vendor@example.com' }
        },
        {
          id: 'log-5',
          changeType: 'status_change',
          fieldName: 'status',
          oldValue: 'processing',
          newValue: 'completed',
          createdAt: '2024-03-01T14:00:00.000Z',
          user: { email: 'vendor@example.com' }
        }
      ];

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockResolvedValueOnce(mockHistory);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.history).toHaveLength(5);
      expect(data.totalEntries).toBe(5);
      expect(data.history[0].id).toBe('log-1');
      expect(data.history[4].id).toBe('log-5');
    });

    it('should include all change types in history', async () => {
      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
      };

      const mockHistory = [
        { id: 'log-1', changeType: 'status_change', createdAt: new Date() },
        { id: 'log-2', changeType: 'vendor_assignment', createdAt: new Date() },
        { id: 'log-3', changeType: 'note_update', fieldName: 'vendorNotes', createdAt: new Date() },
        { id: 'log-4', changeType: 'note_update', fieldName: 'internalNotes', createdAt: new Date() }
      ];

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockResolvedValueOnce(mockHistory);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      const data = await response.json();

      const changeTypes = data.history.map(log => log.changeType);
      expect(changeTypes).toContain('status_change');
      expect(changeTypes).toContain('vendor_assignment');
      expect(changeTypes).toContain('note_update');
    });

    it('should include user details in history entries', async () => {
      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
      };

      const mockHistory = [
        {
          id: 'log-1',
          changeType: 'status_change',
          userId: 'user-1',
          user: {
            id: 'user-1',
            email: 'john.doe@example.com',
            firstName: 'John',
            lastName: 'Doe'
          },
          createdAt: new Date()
        }
      ];

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockResolvedValueOnce(mockHistory);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(data.history[0].user).toHaveProperty('email', 'john.doe@example.com');
      expect(data.history[0].user).toHaveProperty('firstName', 'John');
      expect(data.history[0].user).toHaveProperty('lastName', 'Doe');
    });

    it('should include IP address and user agent when available', async () => {
      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
      };

      const mockHistory = [
        {
          id: 'log-1',
          changeType: 'status_change',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          createdAt: new Date()
        },
        {
          id: 'log-2',
          changeType: 'vendor_assignment',
          ipAddress: null,
          userAgent: null,
          createdAt: new Date()
        }
      ];

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockResolvedValueOnce(mockHistory);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      const data = await response.json();

      expect(data.history[0]).toHaveProperty('ipAddress', '192.168.1.100');
      expect(data.history[0]).toHaveProperty('userAgent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      expect(data.history[1].ipAddress).toBeNull();
      expect(data.history[1].userAgent).toBeNull();
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
      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to fetch service history');
    });

    it('should handle timeout errors gracefully', async () => {
      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockRejectedValueOnce(
        new Error('Query timeout')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);
      expect(response.status).toBe(504);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Request timeout');
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

    it('should set no-cache headers for audit data', async () => {
      const mockService = {
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479'
      };

      vi.mocked(ServiceFulfillmentService.getServiceById).mockResolvedValueOnce(mockService);
      vi.mocked(ServiceAuditService.getHistory).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/fulfillment/services/service-123/history');
      const params = { params: { id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479' } };

      const response = await GET(request, params);

      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });
  });
});