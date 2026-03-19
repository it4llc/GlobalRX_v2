// /GlobalRX_v2/src/lib/services/__tests__/order-core-service-fulfillment.test.ts

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OrderCoreService } from '../order-core.service';
import { prisma } from '@/lib/prisma';
import type { Prisma, PrismaClient } from '@prisma/client';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    servicesFulfillment: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    customer: {
      findUnique: vi.fn(),
    },
    location: {
      findMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    subjectData: {
      create: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }
}));

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'test-user-id', email: 'test@example.com' }
  })
}));

describe('OrderCoreService - ServiceFulfillment Auto-Creation', () => {
  let orderCoreService: OrderCoreService;

  beforeEach(() => {
    orderCoreService = new OrderCoreService();
    vi.clearAllMocks();
  });

  describe('createCompleteOrder()', () => {
    const mockOrderData = {
      customerId: 'customer-123',
      subjectData: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        ssn: '123-45-6789',
      },
      services: [
        { serviceId: 'service-1', locationId: 'location-1' },
        { serviceId: 'service-2', locationId: 'location-2' },
      ],
      notes: 'Test order',
    };

    it('should create ServiceFulfillment record for each OrderItem', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const mockOrder = { id: 'order-123', orderNumber: 'ORD-123', ...mockOrderData };
      const mockOrderItems = [
        { id: 'item-1', orderId: 'order-123', serviceId: 'service-1', locationId: 'location-1' },
        { id: 'item-2', orderId: 'order-123', serviceId: 'service-2', locationId: 'location-2' },
      ];

      // Mock transaction to simulate database operations
      const mockTx = {
        order: { create: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: { create: vi.fn().mockResolvedValueOnce(mockOrderItems[0]).mockResolvedValueOnce(mockOrderItems[1]) },
        servicesFulfillment: { create: vi.fn() },
        subjectData: { create: vi.fn().mockResolvedValue({ id: 'subject-1' }) },
        orderStatusHistory: { create: vi.fn() },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await orderCoreService.createCompleteOrder(mockOrderData, 'user-123');

      // Verify ServiceFulfillment.create was called for each OrderItem
      expect(mockTx.servicesFulfillment.create).toHaveBeenCalledTimes(2);

      // Verify first ServiceFulfillment creation with correct data
      expect(mockTx.servicesFulfillment.create).toHaveBeenNthCalledWith(1, {
        data: {
          orderId: 'order-123',
          orderItemId: 'item-1',
          serviceId: 'service-1',
          locationId: 'location-1',
          assignedVendorId: null, // Explicitly null, not inherited
        },
      });

      // Verify second ServiceFulfillment creation with correct data
      expect(mockTx.servicesFulfillment.create).toHaveBeenNthCalledWith(2, {
        data: {
          orderId: 'order-123',
          orderItemId: 'item-2',
          serviceId: 'service-2',
          locationId: 'location-2',
          assignedVendorId: null, // Explicitly null, not inherited
        },
      });
    });

    it('should rollback entire transaction if ServiceFulfillment creation fails', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const mockOrder = { id: 'order-123', orderNumber: 'ORD-123', ...mockOrderData };
      const mockOrderItem = { id: 'item-1', orderId: 'order-123', serviceId: 'service-1', locationId: 'location-1' };

      const mockTx = {
        order: { create: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: { create: vi.fn().mockResolvedValue(mockOrderItem) },
        servicesFulfillment: {
          create: vi.fn().mockRejectedValue(new Error('Database constraint violation'))
        },
        subjectData: { create: vi.fn().mockResolvedValue({ id: 'subject-1' }) },
        orderStatusHistory: { create: vi.fn() },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        try {
          return await callback(mockTx);
        } catch (error) {
          throw error; // Transaction should rollback
        }
      });

      // Expect the entire operation to fail
      await expect(orderCoreService.createCompleteOrder(mockOrderData, 'user-123')).rejects.toThrow();

      // Verify ServiceFulfillment creation was attempted
      expect(mockTx.servicesFulfillment.create).toHaveBeenCalled();
    });

    it('should create ServiceFulfillment with only required fields populated', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const mockOrder = { id: 'order-123', orderNumber: 'ORD-123', ...mockOrderData };
      const mockOrderItem = { id: 'item-1', orderId: 'order-123', serviceId: 'service-1', locationId: 'location-1' };

      const mockTx = {
        order: { create: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: { create: vi.fn().mockResolvedValue(mockOrderItem) },
        servicesFulfillment: { create: vi.fn().mockResolvedValue({
          id: 'fulfillment-1',
          orderId: 'order-123',
          orderItemId: 'item-1',
          serviceId: 'service-1',
          locationId: 'location-1',
          assignedVendorId: null,
          vendorNotes: null,
          internalNotes: null,
          assignedAt: null,
          assignedBy: null,
          completedAt: null,
          results: null,
          resultsAddedBy: null,
          resultsAddedAt: null,
          resultsLastModifiedBy: null,
          resultsLastModifiedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }) },
        subjectData: { create: vi.fn().mockResolvedValue({ id: 'subject-1' }) },
        orderStatusHistory: { create: vi.fn() },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await orderCoreService.createCompleteOrder({
        ...mockOrderData,
        services: [{ serviceId: 'service-1', locationId: 'location-1' }],
      }, 'user-123');

      // Verify only required fields are set, optional fields are null
      const createCall = mockTx.servicesFulfillment.create.mock.calls[0][0];
      expect(createCall.data).toMatchObject({
        orderId: 'order-123',
        orderItemId: 'item-1',
        serviceId: 'service-1',
        locationId: 'location-1',
        assignedVendorId: null,
      });

      // Verify no optional fields are set
      expect(createCall.data.vendorNotes).toBeUndefined();
      expect(createCall.data.internalNotes).toBeUndefined();
      expect(createCall.data.assignedAt).toBeUndefined();
      expect(createCall.data.assignedBy).toBeUndefined();
      expect(createCall.data.completedAt).toBeUndefined();
    });
  });

  describe('addOrderItem()', () => {
    const mockOrderId = 'order-123';
    const mockServiceId = 'service-1';
    const mockLocationId = 'location-1';

    it('should create ServiceFulfillment when adding an OrderItem', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const mockOrder = {
        id: mockOrderId,
        status: 'draft',
        customerId: 'customer-123',
      };
      const mockOrderItem = {
        id: 'item-1',
        orderId: mockOrderId,
        serviceId: mockServiceId,
        locationId: mockLocationId,
      };

      const mockTx = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: {
          create: vi.fn().mockResolvedValue(mockOrderItem),
          findMany: vi.fn().mockResolvedValue([]),
        },
        servicesFulfillment: { create: vi.fn() },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await orderCoreService.addOrderItem(mockOrderId, mockServiceId, mockLocationId, 'user-123');

      // Verify ServiceFulfillment was created
      expect(mockTx.servicesFulfillment.create).toHaveBeenCalledWith({
        data: {
          orderId: mockOrderId,
          orderItemId: 'item-1',
          serviceId: mockServiceId,
          locationId: mockLocationId,
          assignedVendorId: null,
        },
      });
    });

    it('should rollback if ServiceFulfillment creation fails when adding OrderItem', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const mockOrder = {
        id: mockOrderId,
        status: 'draft',
        customerId: 'customer-123',
      };
      const mockOrderItem = {
        id: 'item-1',
        orderId: mockOrderId,
        serviceId: mockServiceId,
        locationId: mockLocationId,
      };

      const mockTx = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: {
          create: vi.fn().mockResolvedValue(mockOrderItem),
          findMany: vi.fn().mockResolvedValue([]),
        },
        servicesFulfillment: {
          create: vi.fn().mockRejectedValue(new Error('Unique constraint violation')),
        },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        try {
          return await callback(mockTx);
        } catch (error) {
          throw error; // Transaction should rollback
        }
      });

      // Expect the operation to fail
      await expect(orderCoreService.addOrderItem(mockOrderId, mockServiceId, mockLocationId, 'user-123'))
        .rejects.toThrow();

      // Verify ServiceFulfillment creation was attempted
      expect(mockTx.servicesFulfillment.create).toHaveBeenCalled();
    });

    it('should not create duplicate ServiceFulfillment for same OrderItem', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const mockOrder = {
        id: mockOrderId,
        status: 'draft',
        customerId: 'customer-123',
      };
      const mockOrderItem = {
        id: 'item-1',
        orderId: mockOrderId,
        serviceId: mockServiceId,
        locationId: mockLocationId,
      };

      const mockTx = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: {
          create: vi.fn().mockResolvedValue(mockOrderItem),
          findMany: vi.fn().mockResolvedValue([]),
        },
        servicesFulfillment: {
          create: vi.fn()
            .mockRejectedValueOnce(new Error('Unique constraint failed on orderItemId'))
            .mockResolvedValueOnce({ id: 'fulfillment-1' }),
        },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        try {
          return await callback(mockTx);
        } catch (error: any) {
          if (error.message.includes('Unique constraint')) {
            throw error;
          }
          throw error;
        }
      });

      // First attempt should fail due to unique constraint
      await expect(orderCoreService.addOrderItem(mockOrderId, mockServiceId, mockLocationId, 'user-123'))
        .rejects.toThrow('Unique constraint');
    });

    it('should not create ServiceFulfillment if order is not in draft status', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const mockOrder = {
        id: mockOrderId,
        status: 'submitted', // Not draft
        customerId: 'customer-123',
      };

      const mockTx = {
        order: { findUnique: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: { create: vi.fn(), findMany: vi.fn() },
        servicesFulfillment: { create: vi.fn() },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      // Should throw error before attempting to create OrderItem or ServiceFulfillment
      await expect(orderCoreService.addOrderItem(mockOrderId, mockServiceId, mockLocationId, 'user-123'))
        .rejects.toThrow();

      // Verify neither OrderItem nor ServiceFulfillment were created
      expect(mockTx.orderItem.create).not.toHaveBeenCalled();
      expect(mockTx.servicesFulfillment.create).not.toHaveBeenCalled();
    });
  });

  describe('Logging', () => {
    it('should log ServiceFulfillment creation at INFO level', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const logger = await import('@/lib/logger');
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-123',
        customerId: 'customer-123'
      };
      const mockOrderItem = {
        id: 'item-1',
        orderId: 'order-123',
        serviceId: 'service-1',
        locationId: 'location-1',
      };

      const mockTx = {
        order: { create: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: { create: vi.fn().mockResolvedValue(mockOrderItem) },
        servicesFulfillment: { create: vi.fn().mockResolvedValue({
          id: 'fulfillment-1',
          orderItemId: 'item-1',
        }) },
        subjectData: { create: vi.fn().mockResolvedValue({ id: 'subject-1' }) },
        orderStatusHistory: { create: vi.fn() },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await orderCoreService.createCompleteOrder({
        customerId: 'customer-123',
        subjectData: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01',
          ssn: '123-45-6789',
        },
        services: [{ serviceId: 'service-1', locationId: 'location-1' }],
        notes: 'Test',
      }, 'user-123');

      // Verify logging occurred
      expect(logger.default.info).toHaveBeenCalledWith(
        expect.stringContaining('ServiceFulfillment'),
        expect.objectContaining({
          orderId: 'order-123',
          orderItemId: 'item-1',
          serviceId: 'service-1',
          locationId: 'location-1',
        })
      );
    });

    it('should not log PII in ServiceFulfillment creation logs', async () => {
      // This test will fail initially as the implementation doesn't exist yet
      const logger = await import('@/lib/logger');
      const sensitiveData = {
        firstName: 'John',
        lastName: 'Doe',
        ssn: '123-45-6789',
        email: 'john@example.com',
      };

      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-123',
        customerId: 'customer-123'
      };
      const mockOrderItem = {
        id: 'item-1',
        orderId: 'order-123',
        serviceId: 'service-1',
        locationId: 'location-1',
      };

      const mockTx = {
        order: { create: vi.fn().mockResolvedValue(mockOrder) },
        orderItem: { create: vi.fn().mockResolvedValue(mockOrderItem) },
        servicesFulfillment: { create: vi.fn() },
        subjectData: { create: vi.fn().mockResolvedValue({ id: 'subject-1' }) },
        orderStatusHistory: { create: vi.fn() },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await orderCoreService.createCompleteOrder({
        customerId: 'customer-123',
        subjectData: {
          ...sensitiveData,
          dateOfBirth: '1990-01-01',
        },
        services: [{ serviceId: 'service-1', locationId: 'location-1' }],
        notes: 'Test',
      }, 'user-123');

      // Verify logger was called
      expect(logger.default.info).toHaveBeenCalled();

      // Verify PII was not logged
      const logCalls = (logger.default.info as any).mock.calls;
      logCalls.forEach((call: any[]) => {
        const logMessage = JSON.stringify(call);
        expect(logMessage).not.toContain(sensitiveData.firstName);
        expect(logMessage).not.toContain(sensitiveData.lastName);
        expect(logMessage).not.toContain(sensitiveData.ssn);
        expect(logMessage).not.toContain(sensitiveData.email);
      });
    });
  });
});