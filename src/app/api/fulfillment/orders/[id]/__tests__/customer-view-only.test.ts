// /GlobalRX_v2/src/app/api/fulfillment/orders/[id]/__tests__/customer-view-only.test.ts
// API route tests for customer order view-only access

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      findUnique: vi.fn()
    },
    servicesFulfillment: {
      findMany: vi.fn()
    },
    orderItem: {
      findMany: vi.fn()
    },
    serviceComment: {
      findMany: vi.fn()
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

describe('GET /api/fulfillment/orders/[id] - Customer View-Only Access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockOrderData = {
    id: 'order-123',
    orderNumber: '20240310-ABC-0001',
    statusCode: 'processing',
    customerId: 'cust-456',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-03-10'),
    subject: {
      firstName: 'John',
      lastName: 'Doe',
      ssn: '***-**-6789',
      dateOfBirth: '1990-01-01',
      email: 'john@example.com',
      phone: '555-0100'
    },
    customer: {
      id: 'cust-456',
      name: 'ACME Corp',
      code: 'ABC'
    },
    user: {
      id: 'user-789',
      email: 'orderer@example.com',
      firstName: 'Order',
      lastName: 'Creator'
    },
    assignedVendor: {
      id: 'vendor-111',
      name: 'Background Checks Inc',
      email: 'vendor@example.com'
    },
    vendorNotes: 'Vendor internal communication',
    internalNotes: 'Internal staff notes'
  };

  const mockServiceFulfillments = [
    {
      id: 'fulfillment-1',
      orderId: 'order-123',
      serviceId: 'service-1',
      status: 'processing',
      assignedVendorId: 'vendor-111',
      vendorNotes: 'Vendor notes here',
      internalNotes: 'Internal notes here',
      service: {
        name: 'Criminal Background Check',
        category: 'Background'
      },
      location: {
        name: 'National',
        code2: 'US'
      },
      assignedVendor: {
        name: 'Vendor Co',
        email: 'vendor@vendorco.com'
      }
    }
  ];

  const mockComments = [
    {
      id: 'comment-1',
      serviceId: 'service-1',
      finalText: 'External comment visible to all',
      isInternalOnly: false,
      createdBy: 'user-111',
      createdByName: 'Jane Doe',
      createdAt: new Date('2024-03-10T10:00:00Z')
    },
    {
      id: 'comment-2',
      serviceId: 'service-1',
      finalText: 'Internal comment for staff only',
      isInternalOnly: true,
      createdBy: 'user-222',
      createdByName: 'Bob Admin',
      createdAt: new Date('2024-03-10T11:00:00Z')
    },
    {
      id: 'comment-3',
      serviceId: 'service-1',
      finalText: 'Another external comment',
      isInternalOnly: false,
      createdBy: 'user-333',
      createdByName: 'Alice Manager',
      createdAt: new Date('2024-03-10T12:00:00Z')
    }
  ];

  describe('Authentication and Authorization', () => {
    it('should return 401 when no session exists', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when customer tries to access another customers order', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-999',
          userType: 'customer',
          customerId: 'cust-999' // Different customer
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('You do not have permission to view this order');
    });

    it('should return 404 when order does not exist', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/nonexistent');
      const response = await GET(request, { params: { id: 'nonexistent' } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Order not found');
    });
  });

  describe('Customer Data Filtering', () => {
    it('should allow customer to view their own order with filtered data', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456' // Same customer as order
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce([{ id: 'item-1' }]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should include basic order info
      expect(data.orderNumber).toBe('20240310-ABC-0001');
      expect(data.statusCode).toBe('processing');
      expect(data.customer.name).toBe('ACME Corp');
      expect(data.subject.firstName).toBe('John');

      // Should NOT include vendor information
      expect(data.assignedVendor).toBeUndefined();
      expect(data.vendorNotes).toBeUndefined();
      expect(data.internalNotes).toBeUndefined();

      // Should NOT include user identity information
      expect(data.user).toBeUndefined();
    });

    it('should filter vendor information from service fulfillments for customers', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce([{ id: 'item-1' }]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Check service fulfillments
      expect(data.serviceFulfillments).toBeDefined();
      expect(data.serviceFulfillments.length).toBe(1);

      const service = data.serviceFulfillments[0];
      expect(service.service.name).toBe('Criminal Background Check');
      expect(service.status).toBe('processing');

      // Should NOT include vendor details
      expect(service.assignedVendor).toBeUndefined();
      expect(service.assignedVendorId).toBeUndefined();
      expect(service.vendorNotes).toBeUndefined();
      expect(service.internalNotes).toBeUndefined();
    });

    it('should filter internal comments for customer users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce([{ id: 'item-1' }]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should only include external comments
      expect(data.comments).toBeDefined();
      expect(data.comments.length).toBe(2); // Only 2 external comments

      // Verify only external comments are included
      const commentTexts = data.comments.map((c: any) => c.finalText);
      expect(commentTexts).toContain('External comment visible to all');
      expect(commentTexts).toContain('Another external comment');
      expect(commentTexts).not.toContain('Internal comment for staff only');
    });

    it('should anonymize user information in comments for customers', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce([{ id: 'item-1' }]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Comments should not have user identity information
      data.comments.forEach((comment: any) => {
        expect(comment.createdBy).toBeUndefined();
        expect(comment.createdByName).toBeUndefined();
        expect(comment.createdAt).toBeDefined(); // Timestamp should remain
      });
    });

    it('should show correct comment count for customers (external only)', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce([{ id: 'item-1' }]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Comment count should only include external comments
      expect(data.commentCount).toBe(2); // 2 external comments, not 3 total
    });
  });

  describe('Internal User Access', () => {
    it('should show all data for internal users including sensitive information', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-internal',
          userType: 'internal',
          permissions: { fulfillment: '*' }
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce([{ id: 'item-1' }]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Should include vendor information
      expect(data.assignedVendor).toBeDefined();
      expect(data.assignedVendor.name).toBe('Background Checks Inc');
      expect(data.vendorNotes).toBe('Vendor internal communication');
      expect(data.internalNotes).toBe('Internal staff notes');

      // Should include user information
      expect(data.user).toBeDefined();
      expect(data.user.email).toBe('orderer@example.com');

      // Should include all comments (internal and external)
      expect(data.comments.length).toBe(3);
      expect(data.commentCount).toBe(3);

      // Should include user identity in comments
      const internalComment = data.comments.find((c: any) => c.isInternalOnly);
      expect(internalComment).toBeDefined();
      expect(internalComment.createdByName).toBe('Bob Admin');
    });

    it('should allow admin users to see all order data', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-admin',
          userType: 'admin'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce([{ id: 'item-1' }]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Admin should see everything
      expect(data.assignedVendor).toBeDefined();
      expect(data.vendorNotes).toBeDefined();
      expect(data.internalNotes).toBeDefined();
      expect(data.user).toBeDefined();
      expect(data.comments.length).toBe(3);
    });
  });

  describe('Vendor User Access', () => {
    it('should filter internal comments but show vendor information for vendor users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-vendor',
          userType: 'vendor',
          vendorId: 'vendor-111'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.orderItem.findMany).mockResolvedValueOnce([{ id: 'item-1' }]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      // Vendor should see vendor assignment info
      expect(data.assignedVendor).toBeDefined();
      expect(data.assignedVendor.id).toBe('vendor-111');

      // Should NOT see internal-only comments
      expect(data.comments.length).toBe(2); // Only external comments
      expect(data.commentCount).toBe(2);

      // Should NOT see internal notes
      expect(data.internalNotes).toBeUndefined();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456'
        }
      });

      vi.mocked(prisma.order.findUnique).mockRejectedValueOnce(new Error('Database connection failed'));

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to load order details');
    });

    it('should handle missing customerId for customer users', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-bad',
          userType: 'customer',
          customerId: null // Customer without customerId
        }
      });

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Customer account not properly configured');
    });

    it('should handle orders with no services', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.serviceFulfillments).toEqual([]);
      expect(data.comments).toEqual([]);
      expect(data.commentCount).toBe(0);
    });

    it('should handle orders with no comments', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'user-456',
          userType: 'customer',
          customerId: 'cust-456'
        }
      });

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(mockOrderData);
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServiceFulfillments);
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce([]);

      const request = new Request('http://localhost:3000/api/fulfillment/orders/order-123');
      const response = await GET(request, { params: { id: 'order-123' } });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.comments).toEqual([]);
      expect(data.commentCount).toBe(0);
    });
  });
});