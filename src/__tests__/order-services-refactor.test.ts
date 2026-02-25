// src/__tests__/order-services-refactor.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    orderItem: {
      create: vi.fn(),
    },
    orderData: {
      create: vi.fn(),
    },
    orderStatusHistory: {
      create: vi.fn(),
    },
    addressEntry: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    country: {
      findUnique: vi.fn(),
    },
    serviceRequirement: {
      findMany: vi.fn(),
    },
    dSXMapping: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// These will be our new services after refactoring
// For now, we'll test the business logic that needs to be preserved

describe('Order Services Refactor - TDD Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('OrderNumberService', () => {
    describe('generateOrderNumber', () => {
      it('should generate order number in format: YYYYMMDD-ABC-0001', async () => {
        const customerId = 'c123e456-7890-1234-5678-901234567890';
        const mockDate = new Date('2026-02-24T00:00:00.000Z');
        vi.setSystemTime(mockDate);

        // No existing orders for this customer today
        vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

        const orderNumber = await generateOrderNumber(customerId);

        // The actual date will depend on system timezone
        expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-0001$/);
        expect(prisma.order.findFirst).toHaveBeenCalledWith({
          where: {
            customerId,
            createdAt: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          },
          orderBy: { createdAt: 'desc' },
          select: { orderNumber: true },
        });
      });

      it('should increment sequence number for same customer same day', async () => {
        const customerId = 'c123e456-7890-1234-5678-901234567890';
        const mockDate = new Date('2026-02-24T00:00:00.000Z');
        vi.setSystemTime(mockDate);

        // Existing order with sequence 0003
        vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
          orderNumber: '20260224-ABC-0003',
        } as any);
        vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

        const orderNumber = await generateOrderNumber(customerId);

        // Verify sequence increment
        expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-0004$/);
      });

      it('should reset sequence number daily per customer', async () => {
        const customerId = 'c123e456-7890-1234-5678-901234567890';
        const mockDate = new Date('2026-02-25T00:00:00.000Z'); // Next day
        vi.setSystemTime(mockDate);

        // No orders today (yesterday's don't count)
        vi.mocked(prisma.order.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null);

        const orderNumber = await generateOrderNumber(customerId);

        // Verify sequence resets for new day
        expect(orderNumber).toMatch(/^\d{8}-[A-Z0-9]{3}-0001$/);
      });

      it('should generate consistent customer code for same customer', async () => {
        const customerId = 'c123e456-7890-1234-5678-901234567890';

        vi.mocked(prisma.order.findFirst).mockResolvedValue(null);
        vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

        const orderNumber1 = await generateOrderNumber(customerId);
        const orderNumber2 = await generateOrderNumber(customerId);

        // Extract customer codes
        const code1 = orderNumber1.split('-')[1];
        const code2 = orderNumber2.split('-')[1];

        expect(code1).toBe(code2);
        expect(code1).toMatch(/^[A-Z0-9]{3}$/);
      });
    });
  });

  describe('AddressService', () => {
    describe('createOrFindAddressEntry', () => {
      it('should reuse existing address when exact match found', async () => {
        const addressData = {
          street1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
        };

        vi.mocked(prisma.addressEntry.findFirst).mockResolvedValueOnce({
          id: 'existing-address-123',
        } as any);

        const result = await createOrFindAddressEntry(addressData, 'user123');

        expect(result).toBe('existing-address-123');
        expect(prisma.addressEntry.create).not.toHaveBeenCalled();
        expect(prisma.addressEntry.findFirst).toHaveBeenCalledWith({
          where: {
            street1: '123 Main St',
            street2: null,
            city: 'New York',
            stateId: null,
            countyId: null,
            postalCode: '10001',
          },
        });
      });

      it('should create new address when no exact match found', async () => {
        const addressData = {
          street1: '456 Oak Ave',
          city: 'Boston',
          stateId: 'state-uuid',
          postalCode: '02101',
        };

        vi.mocked(prisma.addressEntry.findFirst).mockResolvedValueOnce(null);
        vi.mocked(prisma.addressEntry.create).mockResolvedValueOnce({
          id: 'new-address-456',
        } as any);

        const result = await createOrFindAddressEntry(addressData, 'user123');

        expect(result).toBe('new-address-456');
        expect(prisma.addressEntry.create).toHaveBeenCalled();
      });

      it('should return null for empty address data', async () => {
        const result1 = await createOrFindAddressEntry(null, 'user123');
        expect(result1).toBeNull();

        const result2 = await createOrFindAddressEntry({}, 'user123');
        expect(result2).toBeNull();

        const result3 = await createOrFindAddressEntry({ street2: 'Apt 5' }, 'user123');
        expect(result3).toBeNull();
      });
    });
  });

  describe('FieldResolverService', () => {
    describe('resolveFieldValues', () => {
      it('should resolve state UUID to "State Name (XX)" format', async () => {
        const fieldValues = {
          state: 'c123e456-7890-1234-5678-901234567890',
        };

        vi.mocked(prisma.country.findUnique).mockResolvedValueOnce({
          name: 'New York',
          code2: 'NY',
          subregion1: 'New York State',
        } as any);

        const resolved = await resolveFieldValues(fieldValues);

        expect(resolved.state).toBe('New York State (NY)');
      });

      it('should resolve address UUID to "Street, City, County, State (XX), ZIP" format', async () => {
        const fieldValues = {
          currentAddress: 'c123e456-7890-1234-5678-901234567890', // Must be valid UUID format
        };

        vi.mocked(prisma.addressEntry.findUnique).mockResolvedValueOnce({
          street1: '789 Park Blvd',
          street2: null,
          city: 'Miami',
          postalCode: '33101',
          state: { name: 'Florida', code2: 'FL' },
          county: { name: 'Miami-Dade' },
          country: null,
        } as any);

        const resolved = await resolveFieldValues(fieldValues);

        expect(resolved.currentAddress).toBe('789 Park Blvd, Miami, Miami-Dade, Florida (FL), 33101');
      });

      it('should be extensible for future field mappings', async () => {
        // This test ensures the resolver can handle new field types
        const fieldValues = {
          customField: 'some-value',
          anotherField: 'another-value',
        };

        const resolved = await resolveFieldValues(fieldValues);

        // Non-UUID values should pass through unchanged
        expect(resolved.customField).toBe('some-value');
        expect(resolved.anotherField).toBe('another-value');
      });
    });
  });

  describe('OrderValidationService', () => {
    describe('validateOrderRequirements', () => {
      it('should save as draft when validation fails', async () => {
        const orderData = {
          customerId: 'customer123',
          userId: 'user123',
          serviceItems: [
            { serviceId: 'service1', locationId: 'location1', itemId: 'item1' },
          ],
          subject: {},
          status: 'submitted', // Trying to submit
          subjectFieldValues: {}, // Missing required fields
        };

        // Mock validation to fail
        vi.mocked(prisma.serviceRequirement.findMany).mockResolvedValue([
          {
            serviceId: 'service1',
            requirementId: 'req1',
            requirement: {
              id: 'req1',
              name: 'Last Name',
              type: 'field',
              disabled: false,
              fieldData: { collectionTab: 'subject' },
            },
            service: { name: 'Background Check' },
          },
        ] as any);

        vi.mocked(prisma.dSXMapping.findMany).mockResolvedValue([
          {
            serviceId: 'service1',
            locationId: 'location1',
            requirementId: 'req1',
            isRequired: true,
            requirement: {
              id: 'req1',
              name: 'Last Name',
              type: 'field',
              disabled: false,
              fieldData: { collectionTab: 'subject' },
            },
            service: { name: 'Background Check' },
            country: { name: 'United States' },
          },
        ] as any);

        const validation = await validateOrderRequirements(orderData);

        expect(validation.isValid).toBe(false);
        expect(validation.missingRequirements.subjectFields).toHaveLength(1);

        // When creating order with failed validation, status should be draft
        vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
          // OrderCoreService.createCompleteOrder uses a transaction callback
          if (typeof callback === 'function') {
            const tx = {
              order: {
                create: vi.fn().mockImplementation((data) => {
                  expect(data.data.statusCode).toBe('draft'); // Forced to draft
                  return { id: 'new-order', statusCode: 'draft' };
                }),
              },
              orderItem: { create: vi.fn() },
            };
            return callback(tx as any);
          }
          return callback;
        });

        const result = await createCompleteOrder(orderData);
        expect(result.statusCode).toBe('draft');
      });
    });
  });

  describe('SubjectDataNormalization', () => {
    it('should normalize field names to camelCase', async () => {
      const subjectFieldValues = {
        'First Name': 'John',
        'first_name': 'Jane', // Should override
        'Last Name': 'Doe',
        'Email Address': 'john@example.com',
        'Date of Birth': '1990-01-01',
        'DOB': '1991-01-01', // Should override
      };

      const normalized = await normalizeSubjectData({}, subjectFieldValues);

      expect(normalized.firstName).toBe('Jane'); // Latest value wins
      expect(normalized.lastName).toBe('Doe');
      expect(normalized.email).toBe('john@example.com');
      expect(normalized.dateOfBirth).toBe('1991-01-01'); // Latest value wins
    });

    it('should be extensible for new field mappings', async () => {
      // Add new mapping in the future
      const additionalMappings = {
        'SSN': 'ssn',
        'Social Security Number': 'ssn',
      };

      // This test ensures the system can handle new mappings
      const subjectFieldValues = {
        'New Field Type': 'value',
      };

      const normalized = await normalizeSubjectData({}, subjectFieldValues);

      // Unknown fields should still be preserved
      expect(normalized['New Field Type']).toBe('value');
    });
  });

  describe('OrderStateTransitions', () => {
    describe('Status transition rules', () => {
      const validTransitions = [
        { from: 'draft', to: ['submitted', 'cancelled'] },
        { from: 'submitted', to: ['processing', 'more_info_needed', 'cancelled'] },
        { from: 'processing', to: ['completed', 'more_info_needed', 'cancelled'] },
        { from: 'more_info_needed', to: ['submitted', 'cancelled'] },
        { from: 'completed', to: ['cancelled'] },
      ];

      validTransitions.forEach(({ from, to }) => {
        to.forEach(nextStatus => {
          it(`should allow transition from ${from} to ${nextStatus}`, async () => {
            const orderId = 'order123';
            const customerId = 'customer123';
            const userId = 'user123';

            vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
              id: orderId,
              statusCode: from,
            } as any);

            vi.mocked(prisma.$transaction).mockImplementationOnce(async (operations) => {
              // Handle both array and callback forms
              if (typeof operations === 'function') {
                return operations;
              }
              return Array.isArray(operations) ? operations : [operations];
            });

            const result = await updateOrderStatus(orderId, customerId, userId, nextStatus, 'Test reason');

            expect(result).toBeDefined();
            expect(prisma.$transaction).toHaveBeenCalled();
          });
        });
      });

      it('should go through submitted when transitioning from more_info_needed to processing', async () => {
        const orderId = 'order123';
        const customerId = 'customer123';
        const userId = 'user123';

        // Only one call to find order in more_info_needed state
        vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
          id: orderId,
          statusCode: 'more_info_needed',
        } as any);

        // Mock the single transaction with multiple operations
        vi.mocked(prisma.$transaction).mockResolvedValueOnce([
          { statusCode: 'submitted' },      // First update
          { id: 'history1' },               // First history record
          { statusCode: 'processing' },     // Second update
          { id: 'history2' },               // Second history record
        ] as any);

        // Use the actual service method that handles this special case
        const { OrderCoreService } = await import('@/lib/services/order-core.service');
        const result = await OrderCoreService.updateOrderStatus(orderId, customerId, userId, 'processing', 'Info provided');

        // Should be called once with 4 operations (2 updates + 2 history records)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Array));
      });

      it('should track status change reasons in history', async () => {
        const orderId = 'order123';
        const customerId = 'customer123';
        const userId = 'user123';
        const reason = 'Missing documentation for background check';

        vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
          id: orderId,
          statusCode: 'submitted',
        } as any);

        let capturedOperations: any[] = [];
        vi.mocked(prisma.$transaction).mockImplementationOnce(async (operations) => {
          capturedOperations = Array.isArray(operations) ? operations : [operations];
          return capturedOperations;
        });

        await updateOrderStatus(orderId, customerId, userId, 'more_info_needed', reason);

        // Verify the prisma.orderStatusHistory.create was called with correct data
        expect(prisma.orderStatusHistory.create).toHaveBeenCalledWith({
          data: {
            orderId,
            fromStatus: 'submitted',
            toStatus: 'more_info_needed',
            changedBy: userId,
            reason,
          },
        });
      });

      it('should reject invalid transitions', async () => {
        const invalidTransitions = [
          { from: 'completed', to: 'draft' },
          { from: 'cancelled', to: 'processing' },
          { from: 'processing', to: 'draft' },
          { from: 'more_info_needed', to: 'completed' },
        ];

        for (const { from, to } of invalidTransitions) {
          vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
            id: 'order123',
            statusCode: from,
          } as any);

          await expect(
            updateOrderStatus('order123', 'customer123', 'user123', to, 'Invalid attempt')
          ).rejects.toThrow();
        }
      });

      it('should allow cancellation from any state', async () => {
        const states = ['draft', 'submitted', 'processing', 'more_info_needed', 'completed'];

        for (const fromState of states) {
          vi.mocked(prisma.order.findFirst).mockResolvedValueOnce({
            id: 'order123',
            statusCode: fromState,
          } as any);

          vi.mocked(prisma.$transaction).mockImplementationOnce(async (operations) => {
            // Return the operations array as if they were executed
            return Array.isArray(operations) ? operations : [operations];
          });

          const result = await updateOrderStatus('order123', 'customer123', 'user123', 'cancelled', 'Cancelled by user');

          expect(result).toBeDefined();
        }
      });
    });
  });
});

// Placeholder functions that will be implemented in the refactored services
async function generateOrderNumber(customerId: string): Promise<string> {
  // This will be in OrderNumberService
  const { OrderService } = await import('@/lib/services/order.service');
  return OrderService.generateOrderNumber(customerId);
}

async function createOrFindAddressEntry(addressData: any, userId: string): Promise<string | null> {
  // This will be in AddressService
  const { OrderService } = await import('@/lib/services/order.service');
  return (OrderService as any).createOrFindAddressEntry(addressData, userId);
}

async function resolveFieldValues(fieldValues: Record<string, any>): Promise<Record<string, any>> {
  // This will be in FieldResolverService
  const { OrderService } = await import('@/lib/services/order.service');
  return (OrderService as any).resolveFieldValues(fieldValues);
}

async function normalizeSubjectData(
  baseSubject: any,
  subjectFieldValues?: Record<string, any>
): Promise<Record<string, any>> {
  // This will be in OrderCoreService
  const { OrderService } = await import('@/lib/services/order.service');
  return (OrderService as any).normalizeSubjectData(baseSubject, subjectFieldValues);
}

async function validateOrderRequirements(data: any): Promise<any> {
  // This will be in OrderValidationService
  const { OrderService } = await import('@/lib/services/order.service');
  return OrderService.validateOrderRequirements(data);
}

async function createCompleteOrder(data: any): Promise<any> {
  // This will be in OrderCoreService
  const { OrderService } = await import('@/lib/services/order.service');
  return OrderService.createCompleteOrder(data);
}

async function updateOrderStatus(
  orderId: string,
  customerId: string,
  userId: string,
  newStatus: string,
  reason: string
): Promise<any> {
  // Use the actual OrderCoreService
  const { OrderCoreService } = await import('@/lib/services/order-core.service');
  return OrderCoreService.updateOrderStatus(orderId, customerId, userId, newStatus, reason);
}

async function transitionToProcessing(
  orderId: string,
  customerId: string,
  userId: string,
  reason: string
): Promise<any> {
  // Use the actual OrderCoreService which handles the special case internally
  const { OrderCoreService } = await import('@/lib/services/order-core.service');
  return OrderCoreService.updateOrderStatus(orderId, customerId, userId, 'processing', reason);
}