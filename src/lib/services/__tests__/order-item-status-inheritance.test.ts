// /GlobalRX_v2/src/lib/services/__tests__/order-item-status-inheritance.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrderCoreService } from '../order-core.service';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    order: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    orderItem: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    servicesFulfillment: {
      create: vi.fn(),
    },
    subjectData: {
      create: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
    vendorOrganization: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../order-number.service', () => ({
  OrderNumberService: {
    generateOrderNumber: vi.fn().mockResolvedValue('TEST-ORDER-123'),
  },
}));

vi.mock('../field-resolver.service', () => ({
  FieldResolverService: {
    resolveFieldValues: vi.fn((values) => Promise.resolve(values)),
  },
}));

describe('OrderItem Status Inheritance', () => {
  let orderCoreService: OrderCoreService;

  beforeEach(() => {
    orderCoreService = new OrderCoreService();
    vi.clearAllMocks();
  });

  describe('Bug Fix: Order Items Should Inherit Status from Parent Order', () => {

    // REGRESSION TEST: proves bug fix for order items showing pending status
    it('REGRESSION TEST: order items created for draft orders should have status="draft" not "pending"', async () => {
      // This test MUST FAIL before the fix is applied (expects 'draft' but gets 'pending')
      // and PASS after the fix is applied
      // Never delete this test - it prevents the bug from coming back

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
        notes: 'Test draft order',
      };

      const mockOrder = {
        id: 'order-123',
        orderNumber: 'TEST-ORDER-123',
        customerId: 'customer-123',
        statusCode: 'draft', // Order is created as draft
        userId: 'user-123',
        subject: mockOrderData.subjectData,
        notes: mockOrderData.notes,
      };

      const mockTx = {
        order: {
          create: vi.fn().mockResolvedValue(mockOrder),
        },
        orderItem: {
          create: vi.fn()
            .mockResolvedValueOnce({
              id: 'item-1',
              orderId: 'order-123',
              serviceId: 'service-1',
              locationId: 'location-1',
              status: 'draft', // We expect this to be 'draft' when order is draft
            })
            .mockResolvedValueOnce({
              id: 'item-2',
              orderId: 'order-123',
              serviceId: 'service-2',
              locationId: 'location-2',
              status: 'draft', // We expect this to be 'draft' when order is draft
            }),
        },
        servicesFulfillment: {
          create: vi.fn(),
        },
        subjectData: {
          create: vi.fn().mockResolvedValue({ id: 'subject-1' }),
        },
        orderStatusHistory: {
          create: vi.fn(),
        },
      };

      (prisma.$transaction as any).mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await orderCoreService.createCompleteOrder(mockOrderData, 'user-123');

      // CRITICAL ASSERTION: Order items for draft orders MUST have status='draft'
      // This assertion will FAIL before the fix (because code hardcodes 'pending')
      // and will PASS after the fix (when code uses order.statusCode)
      expect(mockTx.orderItem.create).toHaveBeenNthCalledWith(1, {
        data: {
          orderId: 'order-123',
          serviceId: 'service-1',
          locationId: 'location-1',
          status: 'draft', // NOT 'pending'
        },
      });

      expect(mockTx.orderItem.create).toHaveBeenNthCalledWith(2, {
        data: {
          orderId: 'order-123',
          serviceId: 'service-2',
          locationId: 'location-2',
          status: 'draft', // NOT 'pending'
        },
      });
    });

    describe('createCompleteOrder() instance method', () => {
      it('should create order items with status="draft" when creating a draft order', async () => {
        const mockOrderData = {
          customerId: 'customer-123',
          subjectData: {
            firstName: 'Jane',
            lastName: 'Smith',
            dateOfBirth: '1985-05-15',
            ssn: '987-65-4321',
          },
          services: [
            { serviceId: 'service-3', locationId: 'location-3' },
          ],
          notes: 'Draft order test',
        };

        const mockOrder = {
          id: 'order-456',
          orderNumber: 'TEST-ORDER-456',
          customerId: 'customer-123',
          statusCode: 'draft',
          userId: 'user-456',
          subject: mockOrderData.subjectData,
          notes: mockOrderData.notes,
        };

        const mockTx = {
          order: {
            create: vi.fn().mockResolvedValue(mockOrder),
          },
          orderItem: {
            create: vi.fn().mockResolvedValue({
              id: 'item-3',
              orderId: 'order-456',
              serviceId: 'service-3',
              locationId: 'location-3',
              status: 'draft',
            }),
          },
          servicesFulfillment: {
            create: vi.fn(),
          },
          subjectData: {
            create: vi.fn().mockResolvedValue({ id: 'subject-2' }),
          },
          orderStatusHistory: {
            create: vi.fn(),
          },
        };

        (prisma.$transaction as any).mockImplementation(async (callback: any) => {
          return callback(mockTx);
        });

        await orderCoreService.createCompleteOrder(mockOrderData, 'user-456');

        // Verify order item was created with draft status
        expect(mockTx.orderItem.create).toHaveBeenCalledWith({
          data: {
            orderId: 'order-456',
            serviceId: 'service-3',
            locationId: 'location-3',
            status: 'draft',
          },
        });
      });

      it('should create order items with status="submitted" when order is submitted', async () => {
        // Assuming a future scenario where an order might be created directly as submitted
        // For now this tests that the status should match the order status
        const mockOrderData = {
          customerId: 'customer-789',
          subjectData: {
            firstName: 'Bob',
            lastName: 'Johnson',
            dateOfBirth: '1975-03-20',
            ssn: '555-55-5555',
          },
          services: [
            { serviceId: 'service-4', locationId: 'location-4' },
          ],
          notes: 'Submitted order test',
        };

        const mockOrder = {
          id: 'order-789',
          orderNumber: 'TEST-ORDER-789',
          customerId: 'customer-789',
          statusCode: 'submitted', // Order is created as submitted
          userId: 'user-789',
          subject: mockOrderData.subjectData,
          notes: mockOrderData.notes,
        };

        const mockTx = {
          order: {
            create: vi.fn().mockResolvedValue(mockOrder),
          },
          orderItem: {
            create: vi.fn().mockResolvedValue({
              id: 'item-4',
              orderId: 'order-789',
              serviceId: 'service-4',
              locationId: 'location-4',
              status: 'submitted',
            }),
          },
          servicesFulfillment: {
            create: vi.fn(),
          },
          subjectData: {
            create: vi.fn().mockResolvedValue({ id: 'subject-3' }),
          },
          orderStatusHistory: {
            create: vi.fn(),
          },
        };

        (prisma.$transaction as any).mockImplementation(async (callback: any) => {
          return callback(mockTx);
        });

        // Mock the order to be created as submitted (override default draft status)
        mockTx.order.create.mockResolvedValue({
          ...mockOrder,
          statusCode: 'submitted',
        });

        await orderCoreService.createCompleteOrder(mockOrderData, 'user-789');

        // Verify order item should have been created with submitted status (not pending)
        expect(mockTx.orderItem.create).toHaveBeenCalledWith({
          data: {
            orderId: 'order-789',
            serviceId: 'service-4',
            locationId: 'location-4',
            status: 'submitted',
          },
        });
      });
    });

    describe('addOrderItem() instance method', () => {
      it('should add order items with status="draft" when order is in draft status', async () => {
        const mockOrderId = 'order-draft-123';
        const mockServiceId = 'service-add-1';
        const mockLocationId = 'location-add-1';

        const mockOrder = {
          id: mockOrderId,
          statusCode: 'draft', // Order is in draft status
          customerId: 'customer-123',
        };

        const mockTx = {
          order: {
            findUnique: vi.fn().mockResolvedValue(mockOrder),
          },
          orderItem: {
            create: vi.fn().mockResolvedValue({
              id: 'item-added-1',
              orderId: mockOrderId,
              serviceId: mockServiceId,
              locationId: mockLocationId,
              status: 'draft',
            }),
            findMany: vi.fn().mockResolvedValue([]), // No existing items
          },
          servicesFulfillment: {
            create: vi.fn(),
          },
        };

        (prisma.$transaction as any).mockImplementation(async (callback: any) => {
          return callback(mockTx);
        });

        await orderCoreService.addOrderItem(mockOrderId, mockServiceId, mockLocationId, 'user-123');

        // Verify order item was created with draft status (matching the order)
        expect(mockTx.orderItem.create).toHaveBeenCalledWith({
          data: {
            orderId: mockOrderId,
            serviceId: mockServiceId,
            locationId: mockLocationId,
            status: 'draft', // NOT 'pending'
          },
        });
      });

      it('should not allow adding items to non-draft orders', async () => {
        const mockOrderId = 'order-submitted-123';
        const mockServiceId = 'service-no-add';
        const mockLocationId = 'location-no-add';

        const mockOrder = {
          id: mockOrderId,
          statusCode: 'submitted', // Order is already submitted
          customerId: 'customer-123',
        };

        const mockTx = {
          order: {
            findUnique: vi.fn().mockResolvedValue(mockOrder),
          },
          orderItem: {
            create: vi.fn(),
            findMany: vi.fn(),
          },
          servicesFulfillment: {
            create: vi.fn(),
          },
        };

        (prisma.$transaction as any).mockImplementation(async (callback: any) => {
          return callback(mockTx);
        });

        // Should throw error for non-draft order
        await expect(
          orderCoreService.addOrderItem(mockOrderId, mockServiceId, mockLocationId, 'user-123')
        ).rejects.toThrow('Order not found or cannot be edited');

        // Verify no order item was created
        expect(mockTx.orderItem.create).not.toHaveBeenCalled();
      });
    });

    describe('createCompleteOrder() static method', () => {
      it('should create order items with status="draft" for draft orders', async () => {
        const mockData = {
          customerId: 'customer-static-1',
          userId: 'user-static-1',
          serviceItems: [
            {
              serviceId: 'service-static-1',
              serviceName: 'Service 1',
              locationId: 'location-static-1',
              locationName: 'Location 1',
              itemId: 'item-static-1',
            },
            {
              serviceId: 'service-static-2',
              serviceName: 'Service 2',
              locationId: 'location-static-2',
              locationName: 'Location 2',
              itemId: 'item-static-2',
            },
          ],
          subject: {
            firstName: 'Alice',
            lastName: 'Brown',
            dateOfBirth: '1992-07-10',
          },
          notes: 'Static method draft order',
          status: 'draft' as const,
        };

        const mockOrder = {
          id: 'order-static-1',
          orderNumber: 'TEST-ORDER-STATIC-1',
          customerId: mockData.customerId,
          userId: mockData.userId,
          statusCode: 'draft',
          subject: mockData.subject,
          notes: mockData.notes,
          assignedVendorId: null,
        };

        const mockTx = {
          order: {
            create: vi.fn().mockResolvedValue({
              ...mockOrder,
              customer: { id: 'customer-static-1', name: 'Test Customer' },
              user: { id: 'user-static-1', email: 'test@example.com', firstName: 'Test', lastName: 'User' },
            }),
          },
          orderItem: {
            create: vi.fn()
              .mockResolvedValueOnce({
                id: 'item-static-1',
                orderId: 'order-static-1',
                serviceId: 'service-static-1',
                locationId: 'location-static-1',
                status: 'draft',
              })
              .mockResolvedValueOnce({
                id: 'item-static-2',
                orderId: 'order-static-1',
                serviceId: 'service-static-2',
                locationId: 'location-static-2',
                status: 'draft',
              }),
          },
          servicesFulfillment: {
            create: vi.fn(),
          },
          orderData: {
            create: vi.fn(),
          },
        };

        (prisma.$transaction as any).mockImplementation(async (callback: any) => {
          return callback(mockTx);
        });

        (prisma.vendorOrganization.findFirst as any).mockResolvedValue(null);

        await OrderCoreService.createCompleteOrder(mockData);

        // Verify both order items were created with draft status
        expect(mockTx.orderItem.create).toHaveBeenNthCalledWith(1, {
          data: {
            orderId: 'order-static-1',
            serviceId: 'service-static-1',
            locationId: 'location-static-1',
            status: 'draft', // NOT 'pending'
          },
        });

        expect(mockTx.orderItem.create).toHaveBeenNthCalledWith(2, {
          data: {
            orderId: 'order-static-1',
            serviceId: 'service-static-2',
            locationId: 'location-static-2',
            status: 'draft', // NOT 'pending'
          },
        });
      });

      it('should create order items with status="submitted" when order is submitted', async () => {
        const mockData = {
          customerId: 'customer-static-2',
          userId: 'user-static-2',
          serviceItems: [
            {
              serviceId: 'service-static-3',
              serviceName: 'Service 3',
              locationId: 'location-static-3',
              locationName: 'Location 3',
              itemId: 'item-static-3',
            },
          ],
          subject: {
            firstName: 'Charlie',
            lastName: 'Davis',
            dateOfBirth: '1988-11-22',
          },
          notes: 'Static method submitted order',
          status: 'submitted' as const,
        };

        const mockOrder = {
          id: 'order-static-2',
          orderNumber: 'TEST-ORDER-STATIC-2',
          customerId: mockData.customerId,
          userId: mockData.userId,
          statusCode: 'submitted',
          subject: mockData.subject,
          notes: mockData.notes,
          assignedVendorId: null,
        };

        const mockTx = {
          order: {
            create: vi.fn().mockResolvedValue({
              ...mockOrder,
              customer: { id: 'customer-static-2', name: 'Test Customer 2' },
              user: { id: 'user-static-2', email: 'test2@example.com', firstName: 'Test2', lastName: 'User2' },
            }),
          },
          orderItem: {
            create: vi.fn().mockResolvedValue({
              id: 'item-static-3',
              orderId: 'order-static-2',
              serviceId: 'service-static-3',
              locationId: 'location-static-3',
              status: 'submitted',
            }),
          },
          servicesFulfillment: {
            create: vi.fn(),
          },
          orderData: {
            create: vi.fn(),
          },
        };

        (prisma.$transaction as any).mockImplementation(async (callback: any) => {
          return callback(mockTx);
        });

        (prisma.vendorOrganization.findFirst as any).mockResolvedValue(null);

        // Mock validation to pass
        const OrderValidationService = await import('../order-validation.service');
        vi.spyOn(OrderValidationService.OrderValidationService, 'validateOrderRequirements').mockResolvedValue({
          isValid: true,
          missingRequirements: [],
        });

        await OrderCoreService.createCompleteOrder(mockData);

        // Verify order item was created with submitted status
        expect(mockTx.orderItem.create).toHaveBeenCalledWith({
          data: {
            orderId: 'order-static-2',
            serviceId: 'service-static-3',
            locationId: 'location-static-3',
            status: 'submitted', // NOT 'pending'
          },
        });
      });
    });

    describe('addOrderItem() static method', () => {
      it('should add order items with status="draft" to draft orders', async () => {
        const mockOrderId = 'order-static-add-1';
        const mockCustomerId = 'customer-static-add-1';
        const mockUserId = 'user-static-add-1';
        const mockItem = {
          serviceId: 'service-static-add-1',
          locationId: 'location-static-add-1',
          price: 100,
        };

        const mockOrder = {
          id: mockOrderId,
          customerId: mockCustomerId,
          statusCode: 'draft',
        };

        const mockTx = {
          order: {
            findFirst: vi.fn().mockResolvedValue(mockOrder),
          },
          orderItem: {
            create: vi.fn().mockResolvedValue({
              id: 'item-static-added-1',
              orderId: mockOrderId,
              serviceId: mockItem.serviceId,
              locationId: mockItem.locationId,
              status: 'draft',
              price: mockItem.price,
              service: { id: mockItem.serviceId, name: 'Test Service' },
              location: { id: mockItem.locationId, name: 'Test Location' },
            }),
          },
          servicesFulfillment: {
            create: vi.fn(),
          },
        };

        (prisma.$transaction as any).mockImplementation(async (callback: any) => {
          return callback(mockTx);
        });

        await OrderCoreService.addOrderItem(mockOrderId, mockCustomerId, mockItem, mockUserId);

        // Verify order item was created with draft status
        expect(mockTx.orderItem.create).toHaveBeenCalledWith({
          data: {
            orderId: mockOrderId,
            serviceId: mockItem.serviceId,
            locationId: mockItem.locationId,
            status: 'draft', // NOT 'pending'
            price: mockItem.price,
          },
          include: {
            service: true,
            location: true,
          },
        });
      });
    });
  });
});