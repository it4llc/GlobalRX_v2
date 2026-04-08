// /GlobalRX_v2/src/app/api/orders/[id]/views/__tests__/route.test.ts
// API route tests for GET /api/orders/[id]/views endpoint
// Phase 2A: Returns view tracking data for the current user

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';
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
      findUnique: vi.fn(),
    },
    orderItemView: {
      findMany: vi.fn(),
    },
    orderItem: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

describe('GET /api/orders/[id]/views', () => {
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

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(prisma.orderView.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Customer-only filtering', () => {
    it('should return { skipped: true } for admin users', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ skipped: true });
      expect(prisma.orderView.findUnique).not.toHaveBeenCalled();
    });

    it('should return { skipped: true } for vendor users', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ skipped: true });
      expect(prisma.orderView.findUnique).not.toHaveBeenCalled();
    });

    it('should return view data for customer users', async () => {
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

      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: new Date('2026-04-08T10:00:00Z'),
        createdAt: new Date('2026-04-01T10:00:00Z'),
        updatedAt: new Date('2026-04-08T10:00:00Z'),
      };
      (prisma.orderView.findUnique as any).mockResolvedValue(mockOrderView);

      const mockOrderItems = [
        { id: 'item-1', orderId: 'order-123' },
        { id: 'item-2', orderId: 'order-123' },
      ];
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      const mockItemViews = [
        {
          id: 'item-view-1',
          userId: 'customer-123',
          orderItemId: 'item-1',
          lastViewedAt: new Date('2026-04-07T14:30:00Z'),
          createdAt: new Date('2026-04-01T10:00:00Z'),
          updatedAt: new Date('2026-04-07T14:30:00Z'),
        },
        {
          id: 'item-view-2',
          userId: 'customer-123',
          orderItemId: 'item-2',
          lastViewedAt: new Date('2026-04-08T09:15:00Z'),
          createdAt: new Date('2026-04-02T11:00:00Z'),
          updatedAt: new Date('2026-04-08T09:15:00Z'),
        },
      ];
      (prisma.orderItemView.findMany as any).mockResolvedValue(mockItemViews);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        orderView: mockOrderView,
        itemViews: mockItemViews,
      });
    });
  });

  describe('Cross-customer authorization', () => {
    it('should return 403 when customer tries to view tracking data for another company order', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Forbidden');
      expect(prisma.orderView.findUnique).not.toHaveBeenCalled();
      expect(prisma.orderItemView.findMany).not.toHaveBeenCalled();
    });

    it('should allow customer to view tracking data for their own company order', async () => {
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

      // Order belongs to same company
      const mockOrder = {
        id: 'order-123',
        customerId: 'acme-corp-id',
        orderNumber: '20240310-ABC-0001',
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: new Date('2026-04-08T10:00:00Z'),
        createdAt: new Date('2026-04-01T10:00:00Z'),
        updatedAt: new Date('2026-04-08T10:00:00Z'),
      };
      (prisma.orderView.findUnique as any).mockResolvedValue(mockOrderView);

      const mockOrderItems = [
        { id: 'item-1', orderId: 'order-123' },
      ];
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      const mockItemViews = [];
      (prisma.orderItemView.findMany as any).mockResolvedValue(mockItemViews);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        orderView: mockOrderView,
        itemViews: mockItemViews,
      });
    });
  });

  describe('Order existence checks', () => {
    it('should return 404 when order does not exist', async () => {
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

      const request = new NextRequest('http://localhost:3000/api/orders/nonexistent-order/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'nonexistent-order' } });

      // Assert
      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Order not found');
      expect(prisma.orderView.findUnique).not.toHaveBeenCalled();
      expect(prisma.orderItemView.findMany).not.toHaveBeenCalled();
    });
  });

  describe('Response shape', () => {
    it('should return null orderView when user has never viewed the order', async () => {
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
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      // User has never viewed this order
      (prisma.orderView.findUnique as any).mockResolvedValue(null);

      const mockOrderItems = [
        { id: 'item-1', orderId: 'order-123' },
      ];
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      // No item views either
      (prisma.orderItemView.findMany as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        orderView: null,
        itemViews: [],
      });
    });

    it('should return empty itemViews array when no items have been viewed', async () => {
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
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: new Date('2026-04-08T10:00:00Z'),
        createdAt: new Date('2026-04-01T10:00:00Z'),
        updatedAt: new Date('2026-04-08T10:00:00Z'),
      };
      (prisma.orderView.findUnique as any).mockResolvedValue(mockOrderView);

      const mockOrderItems = [
        { id: 'item-1', orderId: 'order-123' },
        { id: 'item-2', orderId: 'order-123' },
      ];
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      // No items have been viewed
      (prisma.orderItemView.findMany as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        orderView: mockOrderView,
        itemViews: [],
      });
    });

    it('should only return view records for the current user', async () => {
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
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: new Date('2026-04-08T10:00:00Z'),
      };
      (prisma.orderView.findUnique as any).mockResolvedValue(mockOrderView);

      const mockOrderItems = [
        { id: 'item-1', orderId: 'order-123' },
      ];
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      const mockItemViews = [
        {
          id: 'item-view-1',
          userId: 'customer-123',
          orderItemId: 'item-1',
          lastViewedAt: new Date('2026-04-07T14:30:00Z'),
        },
      ];
      (prisma.orderItemView.findMany as any).mockResolvedValue(mockItemViews);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);

      // Verify that queries filtered by current user ID
      expect(prisma.orderView.findUnique).toHaveBeenCalledWith({
        where: {
          userId_orderId: {
            userId: 'customer-123',
            orderId: 'order-123',
          },
        },
      });

      expect(prisma.orderItemView.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'customer-123',
          orderItemId: {
            in: ['item-1'],
          },
        },
      });
    });

    it('should handle order with no items', async () => {
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
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: new Date('2026-04-08T10:00:00Z'),
      };
      (prisma.orderView.findUnique as any).mockResolvedValue(mockOrderView);

      // Order has no items
      (prisma.orderItem.findMany as any).mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({
        orderView: mockOrderView,
        itemViews: [],
      });

      // Should not try to query item views when there are no items
      expect(prisma.orderItemView.findMany).not.toHaveBeenCalled();
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

      (prisma.order.findUnique as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch view tracking data');
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

      const request = new NextRequest('http://localhost:3000/api/orders//views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: '' } });

      // Assert
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Order ID is required');
    });

    it('should handle error when fetching order items', async () => {
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
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: new Date('2026-04-08T10:00:00Z'),
      };
      (prisma.orderView.findUnique as any).mockResolvedValue(mockOrderView);

      // Error when fetching order items
      (prisma.orderItem.findMany as any).mockRejectedValue(new Error('Query failed'));

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch view tracking data');
    });
  });

  describe('UTC timestamp handling', () => {
    it('should return timestamps in UTC format', async () => {
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
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      const utcDate = new Date('2026-04-08T10:00:00.000Z');
      const mockOrderView = {
        id: 'view-456',
        userId: 'customer-123',
        orderId: 'order-123',
        lastViewedAt: utcDate,
        createdAt: utcDate,
        updatedAt: utcDate,
      };
      (prisma.orderView.findUnique as any).mockResolvedValue(mockOrderView);

      const mockOrderItems = [
        { id: 'item-1', orderId: 'order-123' },
      ];
      (prisma.orderItem.findMany as any).mockResolvedValue(mockOrderItems);

      const itemUtcDate = new Date('2026-04-07T14:30:00.000Z');
      const mockItemViews = [
        {
          id: 'item-view-1',
          userId: 'customer-123',
          orderItemId: 'item-1',
          lastViewedAt: itemUtcDate,
          createdAt: itemUtcDate,
          updatedAt: itemUtcDate,
        },
      ];
      (prisma.orderItemView.findMany as any).mockResolvedValue(mockItemViews);

      const request = new NextRequest('http://localhost:3000/api/orders/order-123/views', {
        method: 'GET',
      });

      // Act
      const response = await GET(request, { params: { id: 'order-123' } });

      // Assert
      expect(response.status).toBe(200);
      const data = await response.json();

      // Verify timestamps are in UTC format
      expect(data.orderView.lastViewedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(data.itemViews[0].lastViewedAt).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});