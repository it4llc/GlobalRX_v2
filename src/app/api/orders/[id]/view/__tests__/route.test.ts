// /GlobalRX_v2/src/app/api/orders/[id]/view/__tests__/route.test.ts
// API route tests for POST /api/orders/[id]/view endpoint
// Phase 1: Records when a customer user views an order

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '../route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findUnique: vi.fn(),
    },
    orderView: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('POST /api/orders/[id]/view', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Authentication', () => {
    it('should return 401 when user is not authenticated', async () => {
      // Arrange
      (getServerSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(prisma.order.findUnique).not.toHaveBeenCalled();
      expect(prisma.orderView.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Customer-only filtering', () => {
    it('should return 200 with { skipped: true } for admin users with existing order', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'admin-123',
          email: 'admin@globalrx.com',
          userType: 'admin',
          // No customerId for admin users
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-123',
        customerId: 'acme-corp-id',
        orderNumber: '20240310-ABC-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ skipped: true });
      expect(prisma.orderView.upsert).not.toHaveBeenCalled();
    });

    it('should return 200 with { skipped: true } for vendor users with existing order', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'vendor-123',
          email: 'vendor@backgroundchecks.com',
          userType: 'vendor',
          vendorId: 'vendor-org-123',
          // No customerId for vendor users
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-123',
        customerId: 'acme-corp-id',
        orderNumber: '20240310-ABC-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ skipped: true });
      expect(prisma.orderView.upsert).not.toHaveBeenCalled();
    });

    it('should return 200 with { skipped: true } for admin users even when orderId does not exist', async () => {
      // Arrange - Admin user, order lookup not even performed
      const mockSession = {
        user: {
          id: 'admin-123',
          email: 'admin@globalrx.com',
          userType: 'admin',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/orders/nonexistent-order/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'nonexistent-order' } });

      // Assert - Skip happens BEFORE database lookup
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ skipped: true });
      expect(prisma.order.findUnique).not.toHaveBeenCalled(); // Never checks if order exists
      expect(prisma.orderView.upsert).not.toHaveBeenCalled();
    });

    it('should return 200 with { skipped: true } for vendor users even when orderId does not exist', async () => {
      // Arrange - Vendor user, order lookup not even performed
      const mockSession = {
        user: {
          id: 'vendor-123',
          email: 'vendor@backgroundchecks.com',
          userType: 'vendor',
          vendorId: 'vendor-org-123',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/orders/nonexistent-order/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'nonexistent-order' } });

      // Assert - Skip happens BEFORE database lookup
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ skipped: true });
      expect(prisma.order.findUnique).not.toHaveBeenCalled(); // Never checks if order exists
      expect(prisma.orderView.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Order existence checks', () => {
    it('should return 404 when customer user posts to a nonexistent orderId', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'customer-123',
          email: 'customer@acmecorp.com',
          userType: 'customer',
          customerId: 'acme-corp-id',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      (prisma.order.findUnique as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/orders/nonexistent-order/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'nonexistent-order' } });

      // Assert
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Order not found');
      expect(prisma.orderView.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Cross-customer authorization', () => {
    it('should return 403 when customer user posts to an order belonging to a different customer', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'customer-123',
          email: 'customer@companya.com',
          userType: 'customer',
          customerId: 'company-a-id',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      // Order belongs to Company B
      const mockOrder = {
        id: 'order-123',
        customerId: 'company-b-id',
        orderNumber: '20240310-XYZ-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
      expect(prisma.orderView.upsert).not.toHaveBeenCalled();
    });
  });

  describe('Successful view recording', () => {
    it('should return 200 with the created OrderView record on first successful POST', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'customer-123',
          email: 'customer@acmecorp.com',
          userType: 'customer',
          customerId: 'acme-corp-id',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-123',
        customerId: 'acme-corp-id',
        orderNumber: '20240310-ABC-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const now = new Date('2026-04-08T10:00:00.000Z');
      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      (prisma.orderView.upsert as any).mockResolvedValue(mockOrderView);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();

      // Compare using objectContaining with string matchers for dates
      expect(data).toEqual(expect.objectContaining({
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: '2026-04-08T10:00:00.000Z',
        createdAt: '2026-04-08T10:00:00.000Z',
        updatedAt: '2026-04-08T10:00:00.000Z',
      }));
    });
  });

  describe('Upsert behavior', () => {
    it('should call Prisma upsert with correct composite-key arguments when endpoint called twice for same userId and orderId', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'customer-123',
          email: 'customer@acmecorp.com',
          userType: 'customer',
          customerId: 'acme-corp-id',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-123',
        customerId: 'acme-corp-id',
        orderNumber: '20240310-ABC-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const firstView = new Date('2026-04-08T10:00:00.000Z');
      const secondView = new Date('2026-04-08T11:30:00.000Z');

      // First call creates
      const firstMockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: firstView,
        createdAt: firstView,
        updatedAt: firstView,
      };

      // Second call updates
      const secondMockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: secondView,
        createdAt: firstView,
        updatedAt: secondView,
      };

      (prisma.orderView.upsert as any)
        .mockResolvedValueOnce(firstMockOrderView)
        .mockResolvedValueOnce(secondMockOrderView);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act - First call
      await POST(request, { params: { id: 'order-123' } });

      // Act - Second call
      await POST(request, { params: { id: 'order-123' } });

      // Assert - Verify upsert was called with correct composite key
      expect(prisma.orderView.upsert).toHaveBeenCalledTimes(2);

      // Check the first call
      expect(prisma.orderView.upsert).toHaveBeenNthCalledWith(1, {
        where: {
          userId_orderId: {
            userId: 'customer-123',
            orderId: 'order-123',
          },
        },
        create: expect.objectContaining({
          userId: 'customer-123',
          orderId: 'order-123',
          lastViewedAt: expect.any(Date),
        }),
        update: expect.objectContaining({
          lastViewedAt: expect.any(Date),
        }),
      });

      // Check the second call has same structure
      expect(prisma.orderView.upsert).toHaveBeenNthCalledWith(2, {
        where: {
          userId_orderId: {
            userId: 'customer-123',
            orderId: 'order-123',
          },
        },
        create: expect.objectContaining({
          userId: 'customer-123',
          orderId: 'order-123',
          lastViewedAt: expect.any(Date),
        }),
        update: expect.objectContaining({
          lastViewedAt: expect.any(Date),
        }),
      });
    });
  });

  describe('Response shape', () => {
    it('should return all OrderView fields in the response', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'customer-123',
          email: 'customer@acmecorp.com',
          userType: 'customer',
          customerId: 'acme-corp-id',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-123',
        customerId: 'acme-corp-id',
        orderNumber: '20240310-ABC-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const viewDate = new Date('2026-04-08T10:00:00.000Z');
      const createDate = new Date('2026-04-01T08:00:00.000Z');
      const updateDate = new Date('2026-04-08T10:00:00.000Z');

      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: viewDate,
        createdAt: createDate,
        updatedAt: updateDate,
      };
      (prisma.orderView.upsert as any).mockResolvedValue(mockOrderView);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify all fields are present
      expect(data).toHaveProperty('id');
      expect(data).toHaveProperty('userId');
      expect(data).toHaveProperty('orderId');
      expect(data).toHaveProperty('lastViewedAt');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('updatedAt');

      // Verify values (dates as ISO strings)
      expect(data.id).toBe('view-456');
      expect(data.userId).toBe('customer-123');
      expect(data.orderId).toBe('order-123');
      expect(data.lastViewedAt).toBe('2026-04-08T10:00:00.000Z');
      expect(data.createdAt).toBe('2026-04-01T08:00:00.000Z');
      expect(data.updatedAt).toBe('2026-04-08T10:00:00.000Z');
    });
  });

  describe('Date serialization', () => {
    it('should return dates as ISO strings in the JSON response', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'customer-123',
          email: 'customer@acmecorp.com',
          userType: 'customer',
          customerId: 'acme-corp-id',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-123',
        customerId: 'acme-corp-id',
        orderNumber: '20240310-ABC-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const testDate = new Date('2026-04-08T15:30:45.123Z');
      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: testDate,
        createdAt: testDate,
        updatedAt: testDate,
      };
      (prisma.orderView.upsert as any).mockResolvedValue(mockOrderView);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();

      // Dates should be ISO strings, not Date objects
      expect(typeof data.lastViewedAt).toBe('string');
      expect(typeof data.createdAt).toBe('string');
      expect(typeof data.updatedAt).toBe('string');

      // Should match ISO format
      expect(data.lastViewedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Should have correct values
      expect(data.lastViewedAt).toBe('2026-04-08T15:30:45.123Z');
      expect(data.createdAt).toBe('2026-04-08T15:30:45.123Z');
      expect(data.updatedAt).toBe('2026-04-08T15:30:45.123Z');
    });
  });

  describe('Error handling', () => {
    it('should return 500 when database operation fails', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'customer-123',
          email: 'customer@acmecorp.com',
          userType: 'customer',
          customerId: 'acme-corp-id',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-123',
        customerId: 'acme-corp-id',
        orderNumber: '20240310-ABC-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      (prisma.orderView.upsert as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to record order view');
    });

    it('should handle missing order ID parameter', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'customer-123',
          email: 'customer@acmecorp.com',
          userType: 'customer',
          customerId: 'acme-corp-id',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/orders//view', {
        method: 'POST',
      });

      // Act
      const response = await POST(request, { params: { id: '' } });

      // Assert
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Order ID is required');
    });
  });
});