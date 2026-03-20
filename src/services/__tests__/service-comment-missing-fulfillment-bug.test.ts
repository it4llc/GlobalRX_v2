// REGRESSION TEST: proves bug fix for missing comments when ServicesFulfillment doesn't exist
// This test MUST fail against current broken code and pass after the fix
// Bug: getOrderServiceComments() queries from ServicesFulfillment table, missing OrderItems without fulfillment records
// Fix: Should query from OrderItem table and include all items regardless of ServicesFulfillment existence

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceCommentService } from '../service-comment-service';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    servicesFulfillment: {
      findMany: vi.fn()
    },
    orderItem: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    serviceComment: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    },
    commentTemplate: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    commentTemplateAvailability: {
      findFirst: vi.fn()
    },
    service: {
      findUnique: vi.fn()
    },
    order: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('ServiceCommentService - Missing Fulfillment Bug Tests', () => {
  let service: ServiceCommentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('REGRESSION TEST: Missing Comments Bug', () => {
    it('should return comments for OrderItems WITHOUT ServicesFulfillment records', async () => {
      // REGRESSION TEST: This test currently FAILS because the bug exists
      // After the fix is applied, this test should PASS
      // The test expects comments to be returned for ALL OrderItems, even those without ServicesFulfillment

      const mockOrderId = 'order-123';

      // Setup: Order has OrderItems with comments but NO ServicesFulfillment records
      // The current buggy code queries ServicesFulfillment.findMany which returns empty
      // The fixed code should query OrderItem.findMany and return the comments

      // Current behavior: ServicesFulfillment.findMany returns empty array
      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValue([]);

      // After fix: Should query OrderItem.findMany instead
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
        {
          id: 'oi-1',
          orderId: mockOrderId,
          serviceId: 'svc-1',
          locationId: 'loc-1',
          status: 'Processing',
          price: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedById: null,
          // This OrderItem has comments but no ServicesFulfillment
          comments: [
            {
              id: 'comment-1',
              orderItemId: 'oi-1',
              templateId: 'tpl-1',
              finalText: 'Important comment on education verification',
              isInternalOnly: false,
              isStatusChange: false,
              statusChangedFrom: null,
              statusChangedTo: null,
              comment: 'Important comment on education verification',
              createdBy: 'user-1',
              createdAt: new Date(),
              updatedBy: null,
              updatedAt: null,
              template: {
                id: 'tpl-1',
                name: 'General Comment',
                description: 'General comment template',
                templateText: '{comment}',
                allowUserEdit: true,
                isInternalOnly: false,
                isActive: true,
                createdBy: 'admin',
                createdAt: new Date(),
                updatedBy: null,
                updatedAt: null
              },
              createdByUser: {
                id: 'user-1',
                email: 'user@example.com',
                name: 'Test User',
                phone: null,
                locationId: null,
                isVendorUser: false,
                vendorId: null,
                customerId: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              updatedByUser: null
            }
          ],
          service: {
            id: 'svc-1',
            name: 'Education Verification',
            description: 'Verify educational credentials',
            turnaroundTime: 48,
            price: 50.00,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'admin',
            updatedBy: null,
            updatedById: null
          },
          serviceFulfillment: null // NO ServicesFulfillment record!
        },
        {
          id: 'oi-2',
          orderId: mockOrderId,
          serviceId: 'svc-2',
          locationId: 'loc-1',
          status: 'Completed',
          price: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedById: null,
          comments: [
            {
              id: 'comment-2',
              orderItemId: 'oi-2',
              templateId: 'tpl-1',
              finalText: 'Criminal check completed',
              isInternalOnly: false,
              isStatusChange: false,
              statusChangedFrom: null,
              statusChangedTo: null,
              comment: 'Criminal check completed',
              createdBy: 'user-1',
              createdAt: new Date(),
              updatedBy: null,
              updatedAt: null,
              template: {
                id: 'tpl-1',
                name: 'General Comment',
                description: 'General comment template',
                templateText: '{comment}',
                allowUserEdit: true,
                isInternalOnly: false,
                isActive: true,
                createdBy: 'admin',
                createdAt: new Date(),
                updatedBy: null,
                updatedAt: null
              },
              createdByUser: {
                id: 'user-1',
                email: 'user@example.com',
                name: 'Test User',
                phone: null,
                locationId: null,
                isVendorUser: false,
                vendorId: null,
                customerId: null,
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
              },
              updatedByUser: null
            }
          ],
          service: {
            id: 'svc-2',
            name: 'Criminal Background Check',
            description: 'Criminal history verification',
            turnaroundTime: 72,
            price: 75.00,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'admin',
            updatedBy: null,
            updatedById: null
          },
          serviceFulfillment: null // NO ServicesFulfillment record!
        }
      ] as any);

      // Call the method
      const result = await service.getOrderServiceComments(mockOrderId, 'internal', 'user-123');

      // EXPECTATION: Comments should be returned for both OrderItems
      // This will FAIL with current broken code (returns empty object)
      // This will PASS after the fix (returns comments keyed by OrderItem ID)

      expect(result).not.toEqual({}); // Should NOT be empty

      // Should have entries for both OrderItems
      expect(Object.keys(result)).toHaveLength(2);

      // Should include the comments from OrderItem oi-1
      expect(result['oi-1']).toBeDefined();
      expect(result['oi-1'].serviceName).toBe('Education Verification');
      expect(result['oi-1'].serviceStatus).toBe('Processing');
      expect(result['oi-1'].comments).toHaveLength(1);
      expect(result['oi-1'].comments[0].finalText).toBe('Important comment on education verification');

      // Should include the comments from OrderItem oi-2
      expect(result['oi-2']).toBeDefined();
      expect(result['oi-2'].serviceName).toBe('Criminal Background Check');
      expect(result['oi-2'].serviceStatus).toBe('Completed');
      expect(result['oi-2'].comments).toHaveLength(1);
      expect(result['oi-2'].comments[0].finalText).toBe('Criminal check completed');
    });

    it('should handle mixed scenario - some OrderItems with ServicesFulfillment, some without', async () => {
      // This test ensures that after the fix, BOTH types of OrderItems are included
      const mockOrderId = 'order-456';

      // Setup mixed data after the fix is applied
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
        {
          id: 'oi-with-sf',
          orderId: mockOrderId,
          serviceId: 'svc-1',
          locationId: 'loc-1',
          status: 'Processing',
          price: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedById: null,
          comments: [
            {
              id: 'comment-sf',
              orderItemId: 'oi-with-sf',
              templateId: 'tpl-1',
              finalText: 'Has fulfillment record',
              isInternalOnly: false,
              isStatusChange: false,
              statusChangedFrom: null,
              statusChangedTo: null,
              comment: 'Has fulfillment record',
              createdBy: 'user-1',
              createdAt: new Date(),
              updatedBy: null,
              updatedAt: null,
              template: { id: 'tpl-1', name: 'General' },
              createdByUser: { id: 'user-1', email: 'user@example.com' },
              updatedByUser: null
            }
          ],
          service: {
            id: 'svc-1',
            name: 'Service With Fulfillment',
            description: 'Has SF record',
            turnaroundTime: 48,
            price: 50.00,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'admin',
            updatedBy: null,
            updatedById: null
          },
          serviceFulfillment: {
            id: 'sf-1',
            orderId: mockOrderId,
            orderItemId: 'oi-with-sf',
            serviceId: 'svc-1',
            vendorId: 'vendor-1',
            status: 'assigned',
            createdAt: new Date(),
            updatedAt: new Date()
          }
        },
        {
          id: 'oi-without-sf',
          orderId: mockOrderId,
          serviceId: 'svc-2',
          locationId: 'loc-1',
          status: 'Pending',
          price: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedById: null,
          comments: [
            {
              id: 'comment-no-sf',
              orderItemId: 'oi-without-sf',
              templateId: 'tpl-1',
              finalText: 'No fulfillment record',
              isInternalOnly: false,
              isStatusChange: false,
              statusChangedFrom: null,
              statusChangedTo: null,
              comment: 'No fulfillment record',
              createdBy: 'user-1',
              createdAt: new Date(),
              updatedBy: null,
              updatedAt: null,
              template: { id: 'tpl-1', name: 'General' },
              createdByUser: { id: 'user-1', email: 'user@example.com' },
              updatedByUser: null
            }
          ],
          service: {
            id: 'svc-2',
            name: 'Service Without Fulfillment',
            description: 'No SF record',
            turnaroundTime: 72,
            price: 75.00,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'admin',
            updatedBy: null,
            updatedById: null
          },
          serviceFulfillment: null // NO ServicesFulfillment record
        }
      ] as any);

      const result = await service.getOrderServiceComments(mockOrderId, 'internal', 'user-123');

      // After fix: Both OrderItems should be included
      expect(Object.keys(result)).toHaveLength(2);
      expect(result['sf-1']).toBeDefined(); // Keyed by SF ID when it exists
      expect(result['oi-without-sf']).toBeDefined(); // Keyed by OrderItem ID when no SF
    });

    it('should filter internal comments for customer users', async () => {
      // This test verifies customer visibility filtering works after the fix
      const mockOrderId = 'order-789';

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
        {
          id: 'oi-1',
          orderId: mockOrderId,
          serviceId: 'svc-1',
          locationId: 'loc-1',
          status: 'Processing',
          price: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedById: null,
          comments: [
            {
              id: 'comment-public',
              orderItemId: 'oi-1',
              templateId: 'tpl-1',
              finalText: 'Public comment',
              isInternalOnly: false,
              isStatusChange: false,
              statusChangedFrom: null,
              statusChangedTo: null,
              comment: 'Public comment',
              createdBy: 'user-1',
              createdAt: new Date(),
              updatedBy: null,
              updatedAt: null,
              template: { id: 'tpl-1', name: 'General' },
              createdByUser: { id: 'user-1', email: 'user@example.com' },
              updatedByUser: null
            },
            {
              id: 'comment-internal',
              orderItemId: 'oi-1',
              templateId: 'tpl-2',
              finalText: 'Internal note - should be hidden from customers',
              isInternalOnly: true,
              isStatusChange: false,
              statusChangedFrom: null,
              statusChangedTo: null,
              comment: 'Internal note',
              createdBy: 'user-1',
              createdAt: new Date(),
              updatedBy: null,
              updatedAt: null,
              template: { id: 'tpl-2', name: 'Internal' },
              createdByUser: { id: 'user-1', email: 'user@example.com' },
              updatedByUser: null
            }
          ],
          service: {
            id: 'svc-1',
            name: 'Test Service',
            description: 'Test',
            turnaroundTime: 48,
            price: 50.00,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'admin',
            updatedBy: null,
            updatedById: null
          },
          serviceFulfillment: null
        }
      ] as any);

      // Mock filtering for customer - only return public comments
      vi.mocked(prisma.orderItem.findMany).mockImplementation(async (args: any) => {
        const baseResult = [{
          id: 'oi-1',
          orderId: mockOrderId,
          serviceId: 'svc-1',
          locationId: 'loc-1',
          status: 'Processing',
          price: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedById: null,
          comments: args?.include?.comments?.where?.isInternalOnly === false
            ? [{
                id: 'comment-public',
                orderItemId: 'oi-1',
                templateId: 'tpl-1',
                finalText: 'Public comment',
                isInternalOnly: false,
                isStatusChange: false,
                statusChangedFrom: null,
                statusChangedTo: null,
                comment: 'Public comment',
                createdBy: 'user-1',
                createdAt: new Date(),
                updatedBy: null,
                updatedAt: null,
                template: { id: 'tpl-1', name: 'General' },
                createdByUser: { id: 'user-1', email: 'user@example.com' },
                updatedByUser: null
              }]
            : [{
                id: 'comment-public',
                orderItemId: 'oi-1',
                templateId: 'tpl-1',
                finalText: 'Public comment',
                isInternalOnly: false,
                isStatusChange: false,
                statusChangedFrom: null,
                statusChangedTo: null,
                comment: 'Public comment',
                createdBy: 'user-1',
                createdAt: new Date(),
                updatedBy: null,
                updatedAt: null,
                template: { id: 'tpl-1', name: 'General' },
                createdByUser: { id: 'user-1', email: 'user@example.com' },
                updatedByUser: null
              }, {
                id: 'comment-internal',
                orderItemId: 'oi-1',
                templateId: 'tpl-2',
                finalText: 'Internal note - should be hidden from customers',
                isInternalOnly: true,
                isStatusChange: false,
                statusChangedFrom: null,
                statusChangedTo: null,
                comment: 'Internal note',
                createdBy: 'user-1',
                createdAt: new Date(),
                updatedBy: null,
                updatedAt: null,
                template: { id: 'tpl-2', name: 'Internal' },
                createdByUser: { id: 'user-1', email: 'user@example.com' },
                updatedByUser: null
              }],
          service: {
            id: 'svc-1',
            name: 'Test Service',
            description: 'Test',
            turnaroundTime: 48,
            price: 50.00,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'admin',
            updatedBy: null,
            updatedById: null
          },
          serviceFulfillment: null
        }];
        return baseResult as any;
      });

      // Customer should only see public comments
      const customerResult = await service.getOrderServiceComments(mockOrderId, 'customer', 'customer-123');
      expect(customerResult['oi-1'].comments).toHaveLength(1);
      expect(customerResult['oi-1'].comments[0].isInternalOnly).toBe(false);

      // Internal user should see all comments
      const internalResult = await service.getOrderServiceComments(mockOrderId, 'internal', 'internal-123');
      expect(internalResult['oi-1'].comments).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle order with no OrderItems', async () => {
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([]);

      const result = await service.getOrderServiceComments('order-empty', 'internal', 'user-123');

      expect(result).toEqual({});
    });

    it('should handle OrderItems with no comments', async () => {
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([
        {
          id: 'oi-no-comments',
          orderId: 'order-123',
          serviceId: 'svc-1',
          locationId: 'loc-1',
          status: 'Pending',
          price: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          updatedById: null,
          comments: [],
          service: {
            id: 'svc-1',
            name: 'Test Service',
            description: 'Test',
            turnaroundTime: 48,
            price: 50.00,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: 'admin',
            updatedBy: null,
            updatedById: null
          },
          serviceFulfillment: null
        }
      ] as any);

      const result = await service.getOrderServiceComments('order-123', 'internal', 'user-123');

      expect(result['oi-no-comments']).toBeDefined();
      expect(result['oi-no-comments'].comments).toEqual([]);
      expect(result['oi-no-comments'].total).toBe(0);
    });
  });
});