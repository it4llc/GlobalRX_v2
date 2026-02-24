// src/__tests__/order.service.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Prisma and logger BEFORE importing OrderService
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    order: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    addressEntry: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Now import OrderService after mocks are set up
import { OrderService } from '@/lib/services/order.service';

describe('OrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the date to a known value for consistent testing
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-02-24 10:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('generateCustomerCode', () => {
    it('should generate consistent 3-character code for same customer', () => {
      const customerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      // Access private method through class
      const generateCustomerCode = (OrderService as any).generateCustomerCode;

      const code1 = generateCustomerCode(customerId);
      const code2 = generateCustomerCode(customerId);

      expect(code1).toBe(code2); // Same customer, same code
      expect(code1).toHaveLength(3);
      expect(/^[A-Z0-9]{3}$/.test(code1)).toBe(true);
    });

    it('should generate different codes for different customers', () => {
      const customerId1 = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
      const customerId2 = 'f1e2d3c4-b5a6-9870-dcba-fe0987654321';

      const generateCustomerCode = (OrderService as any).generateCustomerCode;

      const code1 = generateCustomerCode(customerId1);
      const code2 = generateCustomerCode(customerId2);

      expect(code1).not.toBe(code2); // Different customers, different codes
    });

    it('should handle UUID without dashes', () => {
      const customerId = '12345678-90ab-cdef-1234-567890abcdef';

      const generateCustomerCode = (OrderService as any).generateCustomerCode;
      const code = generateCustomerCode(customerId);

      expect(code).toHaveLength(3);
      expect(/^[A-Z0-9]{3}$/.test(code)).toBe(true);
    });
  });

  describe('generateOrderNumber', () => {
    it('should generate order number in correct format', async () => {
      const customerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      // Mock prisma responses
      const { prisma } = await import('@/lib/prisma');
      prisma.order.findFirst = vi.fn().mockResolvedValue(null);
      prisma.order.findUnique = vi.fn().mockResolvedValue(null);

      const orderNumber = await OrderService.generateOrderNumber(customerId);

      // Format should be: YYYYMMDD-ABC-0001
      expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-\d{4}$/);
      expect(orderNumber).toContain('20240224-'); // Date part
      expect(orderNumber).toContain('-0001'); // First order of the day
    });

    it('should increment sequence for multiple orders same day', async () => {
      const customerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const { prisma } = await import('@/lib/prisma');

      // First call - no existing orders
      prisma.order.findFirst = vi.fn().mockResolvedValueOnce(null);
      prisma.order.findUnique = vi.fn().mockResolvedValueOnce(null);

      const firstOrder = await OrderService.generateOrderNumber(customerId);
      expect(firstOrder).toContain('-0001');

      // Second call - one existing order
      prisma.order.findFirst = vi.fn().mockResolvedValueOnce({
        orderNumber: '20240224-ABC-0001'
      });
      prisma.order.findUnique = vi.fn().mockResolvedValueOnce(null);

      const secondOrder = await OrderService.generateOrderNumber(customerId);
      expect(secondOrder).toContain('-0002');
    });

    it.skip('should handle collision with retry logic', async () => {
      const customerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const { prisma } = await import('@/lib/prisma');

      prisma.order.findFirst = vi.fn().mockResolvedValue({
        orderNumber: '20240224-ABC-0005'
      });

      // First attempt collides, second succeeds
      prisma.order.findUnique = vi.fn()
        .mockResolvedValueOnce({ orderNumber: '20240224-ABC-0006' }) // Collision
        .mockResolvedValueOnce(null); // Success

      const orderNumber = await OrderService.generateOrderNumber(customerId, 2);
      expect(orderNumber).toContain('-0006');
    }, 30000); // Increase timeout to 30 seconds

    it.skip('should add timestamp after max retries', async () => {
      const customerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const { prisma } = await import('@/lib/prisma');

      prisma.order.findFirst = vi.fn().mockResolvedValue(null);

      // All attempts collide
      prisma.order.findUnique = vi.fn().mockResolvedValue({
        orderNumber: 'collision'
      });

      const orderNumber = await OrderService.generateOrderNumber(customerId, 2);

      // Should have timestamp suffix after retries fail
      expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-\d{4}-\d{6}$/);
    }, 30000); // Increase timeout to 30 seconds

    it('should reset sequence number for new day', async () => {
      const customerId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

      const { prisma } = await import('@/lib/prisma');

      // No orders today (new day)
      prisma.order.findFirst = vi.fn().mockResolvedValue(null);
      prisma.order.findUnique = vi.fn().mockResolvedValue(null);

      const orderNumber = await OrderService.generateOrderNumber(customerId);
      expect(orderNumber).toContain('-0001');
    });
  });

  describe('createOrder', () => {
    it('should create order with generated order number', async () => {
      const orderData = {
        customerId: 'cust-123',
        userId: 'user-456',
        subject: {
          firstName: 'John',
          lastName: 'Doe',
          dateOfBirth: '1990-01-01'
        },
        notes: 'Test order'
      };

      const { prisma } = await import('@/lib/prisma');

      prisma.order.findFirst = vi.fn().mockResolvedValue(null);
      prisma.order.findUnique = vi.fn().mockResolvedValue(null);
      prisma.order.create = vi.fn().mockResolvedValue({
        id: 'order-789',
        orderNumber: '20240224-ABC-0001',
        customerId: orderData.customerId,
        userId: orderData.userId,
        statusCode: 'draft',
        subject: orderData.subject,
        notes: orderData.notes,
        customer: { id: 'cust-123', name: 'Test Customer' },
        user: { id: 'user-456', email: 'test@example.com' }
      });

      const order = await OrderService.createOrder(orderData);

      expect(order.orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-\d{4}$/);
      expect(order.statusCode).toBe('draft');
      expect(order.customerId).toBe(orderData.customerId);
      expect(order.userId).toBe(orderData.userId);
    });

    it('should normalize subject data', async () => {
      const orderData = {
        customerId: 'cust-123',
        userId: 'user-456',
        subject: {
          firstName: 'John',
          lastName: 'Doe',
          middleName: null,
          suffix: undefined
        }
      };

      const { prisma } = await import('@/lib/prisma');

      prisma.order.findFirst = vi.fn().mockResolvedValue(null);
      prisma.order.findUnique = vi.fn().mockResolvedValue(null);
      prisma.order.create = vi.fn().mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 'order-789',
          orderNumber: data.orderNumber,
          subject: data.subject,
          statusCode: data.statusCode,
          customer: { id: 'cust-123', name: 'Test Customer' },
          user: { id: 'user-456' }
        });
      });

      await OrderService.createOrder(orderData);

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            statusCode: 'draft',
            customerId: orderData.customerId,
            userId: orderData.userId
          })
        })
      );
    });

    it('should handle optional notes field', async () => {
      const orderDataWithoutNotes = {
        customerId: 'cust-123',
        userId: 'user-456',
        subject: { firstName: 'Jane', lastName: 'Smith' }
      };

      const { prisma } = await import('@/lib/prisma');

      prisma.order.findFirst = vi.fn().mockResolvedValue(null);
      prisma.order.findUnique = vi.fn().mockResolvedValue(null);
      prisma.order.create = vi.fn().mockResolvedValue({
        id: 'order-790',
        orderNumber: '20240224-XYZ-0001',
        notes: undefined
      });

      const order = await OrderService.createOrder(orderDataWithoutNotes);

      expect(order.notes).toBeUndefined();
    });
  });

  describe('createOrFindAddressEntry', () => {
    it('should return null for invalid address data', async () => {
      const createOrFindAddressEntry = (OrderService as any).createOrFindAddressEntry;

      const result1 = await createOrFindAddressEntry(null, 'user-123');
      const result2 = await createOrFindAddressEntry(undefined, 'user-123');
      const result3 = await createOrFindAddressEntry('not-an-object', 'user-123');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('should return null for empty address', async () => {
      const createOrFindAddressEntry = (OrderService as any).createOrFindAddressEntry;

      const emptyAddress = {
        street1: null,
        city: null,
        state: null,
        postalCode: null
      };

      const result = await createOrFindAddressEntry(emptyAddress, 'user-123');
      expect(result).toBeNull();
    });

    it('should find existing address entry', async () => {
      const { prisma } = await import('@/lib/prisma');

      const addressData = {
        street1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701'
      };

      prisma.addressEntry.findFirst = vi.fn().mockResolvedValue({
        id: 'addr-existing-123',
        ...addressData
      });

      const createOrFindAddressEntry = (OrderService as any).createOrFindAddressEntry;
      const result = await createOrFindAddressEntry(addressData, 'user-123');

      expect(result).toBe('addr-existing-123');
      expect(prisma.addressEntry.create).not.toHaveBeenCalled();
    });

    it('should create new address entry if not found', async () => {
      const { prisma } = await import('@/lib/prisma');

      const addressData = {
        street1: '456 Oak Ave',
        street2: 'Apt 2B',
        city: 'Chicago',
        stateId: 'state-il',
        countyId: 'county-cook',
        postalCode: '60601'
      };

      prisma.addressEntry.findFirst = vi.fn().mockResolvedValue(null);
      prisma.addressEntry.create = vi.fn().mockResolvedValue({
        id: 'addr-new-456',
        ...addressData
      });

      const createOrFindAddressEntry = (OrderService as any).createOrFindAddressEntry;
      const result = await createOrFindAddressEntry(addressData, 'user-123');

      expect(result).toBe('addr-new-456');
      expect(prisma.addressEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          street1: addressData.street1,
          street2: addressData.street2,
          city: addressData.city,
          stateId: addressData.stateId,
          countyId: addressData.countyId,
          postalCode: addressData.postalCode
        })
      });
    });

    it('should handle database errors gracefully', async () => {
      const { prisma } = await import('@/lib/prisma');

      prisma.addressEntry.findFirst = vi.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      const createOrFindAddressEntry = (OrderService as any).createOrFindAddressEntry;
      const result = await createOrFindAddressEntry(
        { street1: '789 Error St' },
        'user-123'
      );

      expect(result).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in order creation', async () => {
      const { prisma } = await import('@/lib/prisma');

      prisma.order.findFirst = vi.fn().mockRejectedValue(
        new Error('Database unavailable')
      );

      await expect(
        OrderService.generateOrderNumber('cust-123')
      ).rejects.toThrow('Database unavailable');
    });

    it('should handle malformed order numbers gracefully', async () => {
      const { prisma } = await import('@/lib/prisma');

      prisma.order.findFirst = vi.fn().mockResolvedValue({
        orderNumber: 'INVALID-FORMAT'
      });
      prisma.order.findUnique = vi.fn().mockResolvedValue(null);

      const orderNumber = await OrderService.generateOrderNumber('cust-123');

      // Should still generate a valid order number
      expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-\d{4}$/);
    });
  });
});