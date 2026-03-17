// /GlobalRX_v2/src/app/api/services/[id]/results/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET, PUT } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('@/lib/permission-utils', () => ({
  hasPermission: vi.fn((user, resource, action) => {
    if (!user?.permissions) return false;
    if (typeof user.permissions[resource] === 'object' && action) {
      return !!user.permissions[resource][action];
    }
    return !!user.permissions[resource];
  })
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findUnique: vi.fn()
    },
    servicesFulfillment: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    auditLog: {
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

// Helper to set up successful update mocks
const setupSuccessfulUpdateMocks = (mockOrderItem: any, updatedFulfillment: any) => {
  vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'user-123', userId: 123 });
    return callback(prisma);
  });
  vi.mocked(prisma.servicesFulfillment.update).mockResolvedValueOnce(updatedFulfillment);

  // Mock the findUnique call that fetches updated fulfillment with relations
  vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValueOnce({
    ...updatedFulfillment,
    resultsAddedByUser: { email: 'john@example.com', firstName: 'John', lastName: 'Doe' },
    resultsModifiedByUser: { email: 'john@example.com', firstName: 'John', lastName: 'Doe' }
  });
};

describe('PUT /api/services/[id]/results', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test results' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });
  });

  describe('authorization - internal users', () => {
    it('should allow internal users with fulfillment.edit permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          results: null
        }
      };

      const updatedFulfillment = {
        id: 'sf-789',
        status: 'processing',
        results: 'Background check completed successfully',
        resultsAddedBy: 123,
        resultsAddedAt: new Date(),
        resultsLastModifiedBy: 123,
        resultsLastModifiedAt: new Date()
      };

      setupSuccessfulUpdateMocks(mockOrderItem, updatedFulfillment);

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Background check completed successfully' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.results).toBe('Background check completed successfully');
      expect(data.resultsAddedBy).toBeDefined();
    });

    it('should return 403 when internal user lacks fulfillment.edit permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { view: true } } // Only view, not edit
        }
      });

      // Mock the orderItem.findUnique to return a service
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce({
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          assignedVendorId: 'vendor-123',
          results: null
        }
      });

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions - fulfillment.edit required');
    });
  });

  describe('authorization - vendor users', () => {
    it('should allow vendor to update their assigned service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          assignedVendorId: 'vendor-123', // Matches user's vendorId
          results: null
        }
      };

      const updatedFulfillment = {
        id: 'sf-789',
        status: 'processing',
        assignedVendorId: 'vendor-123',
        results: 'Investigation complete',
        resultsAddedBy: 456,
        resultsAddedAt: new Date()
      };

      setupSuccessfulUpdateMocks(mockOrderItem, updatedFulfillment);

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Investigation complete' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.results).toBe('Investigation complete');
    });

    it('should return 403 when vendor tries to update non-assigned service', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          assignedVendorId: 'vendor-999', // Different vendor
          results: null
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'You can only update services assigned to your vendor organization');
    });
  });

  describe('authorization - customer users', () => {
    it('should return 403 when customer tries to update results', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      // Mock the orderItem.findUnique to return a service
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce({
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          assignedVendorId: 'vendor-123',
          results: null
        }
      });

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Customers cannot update results');
    });
  });

  describe('validation', () => {
    it('should return 400 when body is not valid JSON', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(400);
    });

    it('should return 400 when results is not a string', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 123 }) // Number instead of string
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Invalid input');
    });

    it('should accept null to clear results', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          results: 'Previous results'
        }
      };

      const updatedFulfillment = {
        id: 'sf-789',
        status: 'processing',
        results: null,
        resultsLastModifiedBy: 123,
        resultsLastModifiedAt: new Date()
      };

      setupSuccessfulUpdateMocks(mockOrderItem, updatedFulfillment);

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: null })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.results).toBe(null);
    });
  });

  describe('business logic', () => {
    it('should return 404 when service does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Service not found');
    });

    it('should return 409 when service is in terminal status (completed)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'completed', // Terminal status is checked on orderItem.status, not serviceFulfillment.status
        serviceFulfillment: {
          id: 'sf-789',
          status: 'completed',
          results: 'Old results'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'New results' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Cannot update results for service in terminal status');
    });

    it('should return 409 when service is in terminal status (cancelled)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'cancelled', // Terminal status is checked on orderItem.status, not serviceFulfillment.status
        serviceFulfillment: {
          id: 'sf-789',
          status: 'cancelled',
          results: null
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(409);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Cannot update results for service in terminal status');
    });

    it('should track first addition of results', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          results: null,
          resultsAddedBy: null,
          resultsAddedAt: null
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'user-123', userId: 123 });
        return callback(prisma);
      });

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'First results' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await PUT(request, params);

      // Verify that both resultsAddedBy and resultsLastModifiedBy are set
      expect(prisma.servicesFulfillment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            results: 'First results',
            resultsAddedBy: expect.any(Number),
            resultsAddedAt: expect.any(Date),
            resultsLastModifiedBy: expect.any(Number),
            resultsLastModifiedAt: expect.any(Date)
          })
        })
      );
    });

    it('should only update modification fields on subsequent edits', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const originalDate = new Date('2024-01-01');
      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          results: 'Original results',
          resultsAddedBy: 111,
          resultsAddedAt: originalDate,
          resultsLastModifiedBy: 111,
          resultsLastModifiedAt: originalDate
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'user-123', userId: 123 });
        return callback(prisma);
      });

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Updated results' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await PUT(request, params);

      // Verify that resultsAddedBy is NOT updated, but modification fields are
      expect(prisma.servicesFulfillment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            results: 'Updated results',
            resultsLastModifiedBy: expect.any(Number),
            resultsLastModifiedAt: expect.any(Date)
          })
        })
      );

      // Verify resultsAddedBy is NOT in the update data
      const updateCall = vi.mocked(prisma.servicesFulfillment.update).mock.calls[0][0];
      expect(updateCall.data).not.toHaveProperty('resultsAddedBy');
      expect(updateCall.data).not.toHaveProperty('resultsAddedAt');
    });
  });

  describe('audit logging', () => {
    it('should create audit log entry for results update', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          results: 'Old results'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'user-123', userId: 123 });
        return callback(prisma);
      });

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'New results' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await PUT(request, params);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'service_results',
            entityId: 'sf-789',
            action: 'update',
            userId: 'user-123'
          })
        })
      );
    });

    it('should log addition of new results', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      const mockOrderItem = {
        id: '660e8400-e29b-41d4-a716-446655440004',
        orderId: '550e8400-e29b-41d4-a716-446655440002',
        status: 'processing',
        serviceFulfillment: {
          id: 'sf-789',
          status: 'processing',
          results: null
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockOrderItem);
      vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
        vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ id: 'user-123', userId: 123 });
        return callback(prisma);
      });

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'First results' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      await PUT(request, params);

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'service_results',
            entityId: 'sf-789',
            action: 'create',
            userId: 'user-123'
          })
        })
      );
    });
  });

  describe('error handling', () => {
    it('should return 500 when database error occurs', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: { edit: true } }
        }
      });

      vi.mocked(prisma.orderItem.findUnique).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost:3000/api/services/item-123/results', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: 'Test' })
      });
      const params = { params: { id: '660e8400-e29b-41d4-a716-446655440004' } };

      const response = await PUT(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Internal server error');
    });
  });
});