// /GlobalRX_v2/src/app/api/fulfillment/orders/[id]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { getServerSession } from 'next-auth';
import { OrderService } from '@/lib/services/order.service';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/services/order.service', () => ({
  OrderService: {
    getOrderById: vi.fn(),
    getFullOrderDetails: vi.fn()
  }
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn()
    }
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

describe('GET /api/fulfillment/orders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Bug Proof Test - MOST CRITICAL', () => {
    it('should allow internal users with fulfillment permission to access order details', async () => {
      // THIS TEST PROVES THE BUG EXISTS
      // It will FAIL now because the endpoint doesn't exist yet
      // It will PASS after the fix is implemented

      // Setup: Internal user with fulfillment permission (using wildcard format like actual user)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: {
            fulfillment: '*',  // Using wildcard format as in real scenario
            candidate_workflow: '*'
          }
        }
      });

      // Mock order exists and is accessible
      const mockOrder = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        orderNumber: '20240301-ABC-0001',
        statusCode: 'processing',
        customerId: 'customer-456',
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date('2024-03-01'),
        subject: {
          firstName: 'John',
          lastName: 'Doe'
        },
        customer: {
          id: 'customer-456',
          name: 'ACME Corp',
          disabled: false
        },
        user: {
          id: 'user-456',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User'
        },
        assignedVendor: null,
        items: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            service: {
              id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              name: 'Criminal Background Check',
              category: 'Background'
            },
            location: {
              id: 'location-1',
              name: 'National',
              code2: 'US'
            },
            data: null,
            documents: []
          }
        ],
        statusHistory: []
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);

      // Assert: Should return 200 with order data
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id', '550e8400-e29b-41d4-a716-446655440001');
      expect(data).toHaveProperty('orderNumber', '20240301-ABC-0001');
      expect(data.customer).toHaveProperty('name', 'ACME Corp');

      // Verify correct Prisma method was called
      expect(prisma.order.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: '550e8400-e29b-41d4-a716-446655440001' },
          include: expect.any(Object)
        })
      );
    });

    it('should also allow internal users with candidate_workflow permission to access order details', async () => {
      // Setup: Internal user with candidate_workflow permission (no fulfillment permission)
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'internal',
          permissions: {
            candidate_workflow: true
            // Note: No fulfillment permission
          }
        }
      });

      const mockOrder = {
        id: '550e8400-e29b-41d4-a716-446655440003',
        orderNumber: '20240301-XYZ-0002',
        status: 'pending'
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440003');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440003' } };

      const response = await GET(request, params);

      // Should also return 200 for candidate_workflow permission
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('id', '550e8400-e29b-41d4-a716-446655440003');
    });
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Unauthorized');
    });

    it('should return 401 when session exists but user is undefined', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        // Session exists but no user object
        expires: '2024-12-31'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);
      expect(response.status).toBe(401);
    });
  });

  describe('authorization', () => {
    it('should return 403 when internal user lacks both fulfillment and candidate_workflow permissions', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-789',
          userType: 'internal',
          permissions: {
            // Has other permissions but not fulfillment or candidate_workflow
            customers: true,
            admin: false
          }
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Insufficient permissions to view order details');
    });

    it('should return 403 when customer user tries to access this endpoint', async () => {
      // Customer users should use /api/portal/orders/[id] instead
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-user-1',
          type: 'customer',
          userType: 'customer',
          customerId: 'customer-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data.error).toContain('This endpoint is for internal users only');
    });

    it('should return 403 when vendor user tries to access this endpoint', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-user-1',
          type: 'vendor',
          userType: 'vendor',
          vendorId: 'vendor-123',
          permissions: {}
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);
      expect(response.status).toBe(403);

      const data = await response.json();
      expect(data.error).toContain('This endpoint is for internal users only');
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      // Setup valid internal user for all business logic tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: {
            fulfillment: true
          }
        }
      });
    });

    it('should return 404 when order does not exist', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/non-existent');
      const params = { params: { id: 'non-existent' } };

      const response = await GET(request, params);
      expect(response.status).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Order not found');
    });

    it('should return 400 when order ID is not provided', async () => {
      const request = new Request('http://localhost:3000/api/fulfillment/orders/');
      const params = { params: { id: '' } };

      const response = await GET(request, params);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Order ID is required');
    });

    it('should return full order details including customer information', async () => {
      const fullOrderDetails = {
        id: '550e8400-e29b-41d4-a716-446655440001',
        orderNumber: '20240301-ABC-0001',
        status: 'processing',
        customerId: 'customer-456',
        createdAt: new Date('2024-03-01'),
        updatedAt: new Date('2024-03-01'),
        subject: {
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          phone: '555-0123'
        },
        customer: {
          id: 'customer-456',
          name: 'Tech Solutions Inc',
          code: 'TSI',
          isActive: true
        },
        assignedVendor: {
          id: 'vendor-789',
          name: 'Background Check Vendor'
        },
        orderItems: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            serviceName: 'Criminal Background Check',
            locationName: 'National',
            status: 'pending'
          },
          {
            id: '660e8400-e29b-41d4-a716-446655440002',
            serviceName: 'Employment Verification',
            locationName: 'Previous Employer',
            status: 'completed'
          }
        ],
        notes: 'Urgent processing required',
        createdBy: {
          id: 'user-999',
          name: 'Admin User'
        }
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(fullOrderDetails);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();

      // Verify all important fields are returned
      expect(data).toHaveProperty('id', '550e8400-e29b-41d4-a716-446655440001');
      expect(data).toHaveProperty('orderNumber', '20240301-ABC-0001');
      expect(data).toHaveProperty('status', 'processing');
      expect(data).toHaveProperty('customer');
      expect(data.customer).toHaveProperty('name', 'Tech Solutions Inc');
      expect(data).toHaveProperty('subject');
      expect(data.subject).toHaveProperty('firstName', 'Jane');
      expect(data).toHaveProperty('orderItems');
      expect(data.orderItems).toHaveLength(2);
      expect(data).toHaveProperty('assignedVendor');
      expect(data).toHaveProperty('notes', 'Urgent processing required');
    });

    it('should handle orders without assigned vendors', async () => {
      const orderWithoutVendor = {
        id: '550e8400-e29b-41d4-a716-446655440002',
        orderNumber: '20240301-DEF-0002',
        status: 'pending',
        customerId: 'customer-789',
        assignedVendor: null,
        customer: {
          name: 'Another Company'
        },
        orderItems: []
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(orderWithoutVendor);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440002');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440002' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('assignedVendor', null);
    });

    it('should handle orders with deleted/soft-deleted status', async () => {
      const deletedOrder = {
        id: 'order-deleted',
        orderNumber: '20240301-ZZZ-9999',
        status: 'deleted',
        deletedAt: new Date('2024-03-15'),
        customer: {
          name: 'Former Client'
        }
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(deletedOrder);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-deleted');
      const params = { params: { id: 'order-deleted' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('status', 'deleted');
      expect(data).toHaveProperty('deletedAt');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      // Setup valid internal user for error handling tests
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: {
            fulfillment: true
          }
        }
      });
    });

    it('should return 500 when database error occurs', async () => {
      vi.mocked(prisma.order.findUnique).mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to fetch order');

      // In development, details are included; in production they're not
      // Since NODE_ENV is likely 'test' which isn't 'production', details will be included
      if (process.env.NODE_ENV === 'production') {
        expect(data).not.toHaveProperty('details');
        expect(JSON.stringify(data)).not.toContain('Database connection');
      } else {
        // In development/test, details ARE included
        expect(data).toHaveProperty('details', 'Database connection failed');
      }
    });

    it('should handle timeout errors gracefully', async () => {
      vi.mocked(prisma.order.findUnique).mockRejectedValueOnce(
        new Error('Query timeout')
      );

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data).toHaveProperty('error', 'Failed to fetch order');
    });

    it('should handle malformed order data gracefully', async () => {
      // Return invalid data structure
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        // Missing required fields like id
        someInvalidField: 'value'
      });

      const request = new Request('http://localhost:3000/api/fulfillment/orders/550e8400-e29b-41d4-a716-446655440001');
      const params = { params: { id: '550e8400-e29b-41d4-a716-446655440001' } };

      const response = await GET(request, params);

      // Should still return the data, even if malformed
      // The API should be resilient and return what it gets
      expect(response.status).toBe(200);
    });
  });

  describe('permission edge cases', () => {
    it('should handle permission object in different formats', async () => {
      // Array-based permission format
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-1',
          userType: 'internal',
          permissions: ['fulfillment', 'candidate_workflow']
        }
      });

      const mockOrder = { id: 'order-1', orderNumber: 'TEST-001' };
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request1 = new Request('http://localhost:3000/api/fulfillment/orders/order-1');
      const params1 = { params: { id: 'order-1' } };

      const response1 = await GET(request1, params1);
      expect(response1.status).toBe(200);

      // String-based permission format
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-2',
          userType: 'internal',
          permissions: 'fulfillment'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request2 = new Request('http://localhost:3000/api/fulfillment/orders/order-1');
      const params2 = { params: { id: 'order-1' } };

      const response2 = await GET(request2, params2);
      expect(response2.status).toBe(200);

      // Nested object permission format
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-3',
          userType: 'internal',
          permissions: {
            fulfillment: { view: true, edit: true },
            candidate_workflow: false
          }
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request3 = new Request('http://localhost:3000/api/fulfillment/orders/order-1');
      const params3 = { params: { id: 'order-1' } };

      const response3 = await GET(request3, params3);
      expect(response3.status).toBe(200);
    });

    it('should handle admin users with no explicit fulfillment permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'admin-user',
          userType: 'internal',
          permissions: {
            admin: true
            // Admin should have access even without explicit fulfillment permission
          }
        }
      });

      const mockOrder = { id: 'order-admin', orderNumber: 'ADMIN-001' };
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-admin');
      const params = { params: { id: 'order-admin' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);
    });

    it('should handle superadmin role', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'superadmin',
          userType: 'internal',
          role: 'superadmin',
          permissions: {}
        }
      });

      const mockOrder = { id: 'order-super', orderNumber: 'SUPER-001' };
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-super');
      const params = { params: { id: 'order-super' } };

      const response = await GET(request, params);
      expect(response.status).toBe(200);
    });
  });

  describe('caching and performance', () => {
    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-123',
          userType: 'internal',
          permissions: { fulfillment: true }
        }
      });
    });

    it('should not cache sensitive order data', async () => {
      const mockOrder = {
        id: 'order-cache',
        orderNumber: 'CACHE-001',
        sensitive: true
      };

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrder);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-cache');
      const params = { params: { id: 'order-cache' } };

      const response = await GET(request, params);

      // Verify no-cache headers are set for sensitive data
      expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');
    });
  });
});