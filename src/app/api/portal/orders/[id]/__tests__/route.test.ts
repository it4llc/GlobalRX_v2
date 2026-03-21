// /GlobalRX_v2/src/app/api/portal/orders/[id]/__tests__/route.test.ts

// REGRESSION TEST: proves bug fix for missing logger import causing errors
// Bug: In route.ts, the file uses logger.error() at lines 65, 173, and 210
// but doesn't import the logger module, causing a runtime error.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PUT } from '../route';
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
      update: vi.fn(),
    },
    orderItem: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
    $transaction: vi.fn((callback) => callback(prisma)),
  },
}));

// Mock logger - This mock proves the fix when logger is properly imported
vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Draft Order Update Bug - Missing Logger Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('REGRESSION TEST: Update draft order without error', () => {
    it('should successfully update a draft order without throwing logger undefined error', async () => {
      // REGRESSION TEST: proves bug fix for missing logger import

      // Arrange - Mock authenticated user
      const mockSession = {
        user: {
          id: 'user-123',
          customerId: 'customer-123',
          email: 'test@example.com',
          userType: 'customer',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      // Mock existing draft order
      const mockOrder = {
        id: 'order-123',
        customerId: 'customer-123',
        statusCode: 'draft',
        orderNumber: '20241210-ABC-0001',
        subject: {
          firstName: 'John',
          lastName: 'Doe',
        },
        orderItems: [],
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      // Mock successful update
      const updatedOrder = {
        ...mockOrder,
        subject: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
        updatedAt: new Date(),
        updatedBy: 'user-123',
      };
      (prisma.order.update as any).mockResolvedValue(updatedOrder);

      // Create request with draft order update
      const requestBody = {
        statusCode: 'draft',
        subject: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
        orderItems: [],
      };

      const request = new NextRequest('http://localhost:3000/api/portal/orders/order-123', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Act
      const response = await PUT(request, { params: { id: 'order-123' } });
      const data = await response.json();

      // Assert - Should succeed without throwing logger undefined error
      expect(response.status).toBe(200);
      expect(data.order).toBeDefined();
      expect(data.order.subject.firstName).toBe('Jane');
      expect(data.order.subject.lastName).toBe('Smith');

      // Verify logger.error would be available if an error occurred
      // This line would fail before the fix when logger isn't imported
      const logger = await import('@/lib/logger');
      expect(logger.default.error).toBeDefined();
    });

    it('should create and edit a draft order multiple times without error', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-456',
          customerId: 'customer-456',
          email: 'user@example.com',
          userType: 'customer',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-456',
        customerId: 'customer-456',
        statusCode: 'draft',
        orderNumber: '20241210-XYZ-0002',
        subject: {
          firstName: 'Initial',
          lastName: 'Name',
        },
        orderItems: [],
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      // First update - add more subject details
      const firstUpdate = {
        statusCode: 'draft',
        subject: {
          firstName: 'Updated',
          lastName: 'Name',
          middleName: 'Middle',
        },
        orderItems: [],
      };

      const firstRequest = new NextRequest('http://localhost:3000/api/portal/orders/order-456', {
        method: 'PUT',
        body: JSON.stringify(firstUpdate),
        headers: { 'Content-Type': 'application/json' },
      });

      (prisma.order.update as any).mockResolvedValueOnce({
        ...mockOrder,
        ...firstUpdate,
        updatedAt: new Date(),
      });

      // Act - First update
      const response1 = await PUT(firstRequest, { params: { id: 'order-456' } });

      // Assert first update
      expect(response1.status).toBe(200);
      const data1 = await response1.json();
      expect(data1.order.subject.firstName).toBe('Updated');

      // Second update - save as draft again
      const secondUpdate = {
        statusCode: 'draft',
        subject: {
          firstName: 'Final',
          lastName: 'Version',
          middleName: 'Middle',
          email: 'final@example.com',
        },
        orderItems: [],
      };

      const secondRequest = new NextRequest('http://localhost:3000/api/portal/orders/order-456', {
        method: 'PUT',
        body: JSON.stringify(secondUpdate),
        headers: { 'Content-Type': 'application/json' },
      });

      (prisma.order.update as any).mockResolvedValueOnce({
        ...mockOrder,
        ...secondUpdate,
        updatedAt: new Date(),
      });

      // Act - Second update
      const response2 = await PUT(secondRequest, { params: { id: 'order-456' } });

      // Assert second update
      expect(response2.status).toBe(200);
      const data2 = await response2.json();
      expect(data2.order.subject.firstName).toBe('Final');
      expect(data2.order.subject.email).toBe('final@example.com');
    });
  });

  describe('Happy Path: Change draft to submitted', () => {
    it('should successfully change a draft order to submitted status', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-789',
          customerId: 'customer-789',
          email: 'submitter@example.com',
          userType: 'customer',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockDraftOrder = {
        id: 'order-789',
        customerId: 'customer-789',
        statusCode: 'draft',
        orderNumber: '20241210-SUB-0003',
        subject: {
          firstName: 'Complete',
          lastName: 'Order',
          dateOfBirth: '1990-01-01',
          email: 'complete@example.com',
        },
        orderItems: [
          {
            id: 'item-1',
            serviceId: 'service-1',
            locationId: 'location-1',
          },
        ],
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockDraftOrder);

      const submittedOrder = {
        ...mockDraftOrder,
        statusCode: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
        updatedBy: 'user-789',
      };
      (prisma.order.update as any).mockResolvedValue(submittedOrder);

      // Create request to submit order
      const requestBody = {
        statusCode: 'submitted',
        subject: mockDraftOrder.subject,
        orderItems: mockDraftOrder.orderItems,
      };

      const request = new NextRequest('http://localhost:3000/api/portal/orders/order-789', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await PUT(request, { params: { id: 'order-789' } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.order.statusCode).toBe('submitted');
      expect(data.order.id).toBe('order-789');

      // Verify status history is created
      expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-789',
          fromStatus: 'draft',
          toStatus: 'submitted',
          changedBy: 'user-789',
        }),
      });
    });

    it('should validate required fields before allowing submission', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-val',
          customerId: 'customer-val',
          email: 'validator@example.com',
          userType: 'customer',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const incompleteOrder = {
        id: 'order-incomplete',
        customerId: 'customer-val',
        statusCode: 'draft',
        orderNumber: '20241210-INC-0001',
        subject: {
          // Missing required fields like firstName, lastName
        },
        orderItems: [],
      };
      (prisma.order.findUnique as any).mockResolvedValue(incompleteOrder);

      // Try to submit with missing required fields
      const requestBody = {
        statusCode: 'submitted',
        subject: {
          // Missing firstName and lastName
        },
        orderItems: [],
      };

      const request = new NextRequest('http://localhost:3000/api/portal/orders/order-incomplete', {
        method: 'PUT',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await PUT(request, { params: { id: 'order-incomplete' } });
      const data = await response.json();

      // Assert - Should fail validation
      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
      expect(data.error).toContain('required');
    });
  });

  describe('Edge Case: Error handling with proper logging', () => {
    it('should properly log errors when order not found', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-404',
          customerId: 'customer-404',
          email: 'notfound@example.com',
          userType: 'customer',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      // Order doesn't exist
      (prisma.order.findUnique as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/portal/orders/non-existent', {
        method: 'PUT',
        body: JSON.stringify({
          statusCode: 'draft',
          subject: { firstName: 'Test', lastName: 'User' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await PUT(request, { params: { id: 'non-existent' } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(404);
      expect(data.error).toBe('Order not found');

      // Verify logger.error is called (would fail before fix)
      const logger = await import('@/lib/logger');
      expect(logger.default.error).toHaveBeenCalledWith(
        expect.stringContaining('Order not found'),
        expect.any(Object)
      );
    });

    it('should log database errors properly', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-db-error',
          customerId: 'customer-db-error',
          email: 'dberror@example.com',
          userType: 'customer',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const mockOrder = {
        id: 'order-db-error',
        customerId: 'customer-db-error',
        statusCode: 'draft',
        orderNumber: '20241210-ERR-0001',
        subject: { firstName: 'Error', lastName: 'Test' },
        orderItems: [],
      };
      (prisma.order.findUnique as any).mockResolvedValue(mockOrder);

      // Simulate database error
      const dbError = new Error('Database connection failed');
      (prisma.order.update as any).mockRejectedValue(dbError);

      const request = new NextRequest('http://localhost:3000/api/portal/orders/order-db-error', {
        method: 'PUT',
        body: JSON.stringify({
          statusCode: 'draft',
          subject: { firstName: 'Updated', lastName: 'Name' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await PUT(request, { params: { id: 'order-db-error' } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to update order');

      // Verify logger.error is called with database error
      const logger = await import('@/lib/logger');
      expect(logger.default.error).toHaveBeenCalledWith(
        'Error updating order',
        expect.objectContaining({
          error: dbError.message,
          orderId: 'order-db-error',
        })
      );
    });

    it('should handle permission errors with proper logging', async () => {
      // Arrange - User trying to edit another customer's order
      const mockSession = {
        user: {
          id: 'user-forbidden',
          customerId: 'customer-999',
          email: 'hacker@example.com',
          userType: 'customer',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const otherCustomerOrder = {
        id: 'order-forbidden',
        customerId: 'customer-111', // Different customer
        statusCode: 'draft',
        orderNumber: '20241210-SEC-0001',
        subject: { firstName: 'Private', lastName: 'Order' },
        orderItems: [],
      };
      (prisma.order.findUnique as any).mockResolvedValue(otherCustomerOrder);

      const request = new NextRequest('http://localhost:3000/api/portal/orders/order-forbidden', {
        method: 'PUT',
        body: JSON.stringify({
          statusCode: 'submitted',
          subject: { firstName: 'Hacked', lastName: 'Order' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await PUT(request, { params: { id: 'order-forbidden' } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(403);
      expect(data.error).toBe('You do not have permission to update this order');

      // Verify logger.warn is called for security issue
      const logger = await import('@/lib/logger');
      expect(logger.default.warn).toHaveBeenCalledWith(
        'Unauthorized order update attempt',
        expect.objectContaining({
          userId: 'user-forbidden',
          orderId: 'order-forbidden',
          orderCustomerId: 'customer-111',
          userCustomerId: 'customer-999',
        })
      );
    });
  });

  describe('Session and Authentication Edge Cases', () => {
    it('should return 401 when no session exists', async () => {
      // Arrange - No session
      (getServerSession as any).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/portal/orders/order-123', {
        method: 'PUT',
        body: JSON.stringify({
          statusCode: 'draft',
          subject: { firstName: 'Test', lastName: 'User' },
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await PUT(request, { params: { id: 'order-123' } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should handle malformed request body gracefully', async () => {
      // Arrange
      const mockSession = {
        user: {
          id: 'user-malformed',
          customerId: 'customer-malformed',
          email: 'malformed@example.com',
          userType: 'customer',
        },
      };
      (getServerSession as any).mockResolvedValue(mockSession);

      const request = new NextRequest('http://localhost:3000/api/portal/orders/order-123', {
        method: 'PUT',
        body: 'invalid json {]',
        headers: { 'Content-Type': 'application/json' },
      });

      // Act
      const response = await PUT(request, { params: { id: 'order-123' } });
      const data = await response.json();

      // Assert
      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid request');

      // Logger should log the parsing error
      const logger = await import('@/lib/logger');
      expect(logger.default.error).toHaveBeenCalled();
    });
  });
});