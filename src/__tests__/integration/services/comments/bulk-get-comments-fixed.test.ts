// Integration tests for bulk retrieval of order service comments
// Updated after fix for comment display issues (March 2024)
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceCommentService } from '@/services/service-comment-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    servicesFulfillment: {
      findMany: vi.fn()
    },
    order: {
      findUnique: vi.fn()
    },
    user: {
      findUnique: vi.fn()
    }
  }
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('ServiceCommentService.getOrderServiceComments - Fixed Structure', () => {
  let service: ServiceCommentService;
  const mockUserId = 'user-123';
  const mockOrderId = 'order-123';
  const mockCustomerId = 'customer-123';
  const mockVendorId = 'vendor-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('fetching through orderItem relationship', () => {
    it('should fetch comments through orderItem.comments relationship', async () => {
      const mockServices = [
        {
          id: 'service-fulfillment-1', // ServiceFulfillment ID
          orderId: mockOrderId,
          orderItemId: 'order-item-1', // OrderItem ID
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          status: 'Processing',
          orderItem: {
            id: 'order-item-1',
            comments: [
              {
                id: 'comment-1-1',
                orderItemId: 'order-item-1',
                finalText: 'Internal comment for service 1',
                isInternalOnly: true,
                isStatusChange: false,
                statusChangedFrom: null,
                statusChangedTo: null,
                createdAt: new Date('2024-03-03T10:00:00Z'),
                template: { shortName: 'INT', longName: 'Internal Note' },
                createdByUser: {
                  firstName: 'John',
                  lastName: 'Admin',
                  email: 'admin@example.com'
                },
                updatedByUser: null
              },
              {
                id: 'comment-1-2',
                orderItemId: 'order-item-1',
                finalText: 'External comment for service 1',
                isInternalOnly: false,
                isStatusChange: false,
                statusChangedFrom: null,
                statusChangedTo: null,
                createdAt: new Date('2024-03-02T10:00:00Z'),
                template: { shortName: 'EXT', longName: 'External Note' },
                createdByUser: {
                  firstName: 'Support',
                  lastName: 'User',
                  email: 'support@example.com'
                },
                updatedByUser: null
              }
            ]
          }
        },
        {
          id: 'service-fulfillment-2', // ServiceFulfillment ID
          orderId: mockOrderId,
          orderItemId: 'order-item-2', // OrderItem ID
          service: { id: 'def-2', name: 'Drug Test', code: 'DRUGTEST' },
          status: 'Completed',
          orderItem: {
            id: 'order-item-2',
            comments: [
              {
                id: 'comment-2-1',
                orderItemId: 'order-item-2',
                finalText: 'Status changed to Completed',
                isInternalOnly: false,
                isStatusChange: true,
                statusChangedFrom: 'Processing',
                statusChangedTo: 'Completed',
                createdAt: new Date('2024-03-01T10:00:00Z'),
                template: { shortName: 'COMP', longName: 'Completed' },
                createdByUser: {
                  firstName: 'Tech',
                  lastName: 'Staff',
                  email: 'tech@example.com'
                },
                updatedByUser: null
              }
            ]
          }
        }
      ];

      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValue(mockServices as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      // Results should be keyed by ServiceFulfillment ID
      expect(result['service-fulfillment-1']).toBeDefined();
      expect(result['service-fulfillment-1'].serviceName).toBe('Background Check');
      expect(result['service-fulfillment-1'].serviceStatus).toBe('Processing');
      expect(result['service-fulfillment-1'].comments).toHaveLength(2);
      expect(result['service-fulfillment-1'].total).toBe(2);

      expect(result['service-fulfillment-2']).toBeDefined();
      expect(result['service-fulfillment-2'].serviceName).toBe('Drug Test');
      expect(result['service-fulfillment-2'].serviceStatus).toBe('Completed');
      expect(result['service-fulfillment-2'].comments).toHaveLength(1);
      expect(result['service-fulfillment-2'].total).toBe(1);

      // Verify Prisma query structure
      expect(prisma.servicesFulfillment.findMany).toHaveBeenCalledWith({
        where: { orderId: mockOrderId },
        include: {
          service: true,
          orderItem: {
            include: {
              comments: {
                where: {},
                orderBy: { createdAt: 'desc' },
                include: {
                  template: true,
                  createdByUser: true,
                  updatedByUser: true
                }
              }
            }
          }
        }
      });
    });

    it('should include status change fields in comments', async () => {
      const mockServices = [
        {
          id: 'service-fulfillment-1',
          orderId: mockOrderId,
          orderItemId: 'order-item-1',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          status: 'Completed',
          orderItem: {
            id: 'order-item-1',
            comments: [
              {
                id: 'comment-status',
                orderItemId: 'order-item-1',
                finalText: 'Service completed successfully',
                isInternalOnly: false,
                isStatusChange: true,
                statusChangedFrom: 'Processing',
                statusChangedTo: 'Completed',
                createdAt: new Date('2024-03-01T10:00:00Z'),
                template: {
                  shortName: 'STATUS',
                  longName: 'Status Change'
                },
                createdByUser: {
                  firstName: 'System',
                  lastName: '',
                  email: 'system@example.com'
                },
                updatedByUser: null
              }
            ]
          }
        }
      ];

      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValue(mockServices as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      const comment = result['service-fulfillment-1'].comments[0];
      expect(comment.isStatusChange).toBe(true);
      expect(comment.statusChangedFrom).toBe('Processing');
      expect(comment.statusChangedTo).toBe('Completed');
    });

    it('should filter internal comments for customer users with new structure', async () => {
      const mockServices = [
        {
          id: 'service-fulfillment-1',
          orderId: mockOrderId,
          orderItemId: 'order-item-1',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          status: 'Processing',
          orderItem: {
            id: 'order-item-1',
            comments: [
              // Only external comment should be included for customers
              {
                id: 'comment-external',
                orderItemId: 'order-item-1',
                finalText: 'External comment visible to customer',
                isInternalOnly: false,
                isStatusChange: false,
                statusChangedFrom: null,
                statusChangedTo: null,
                createdAt: new Date('2024-03-02T10:00:00Z'),
                template: { shortName: 'EXT', longName: 'External Note' },
                createdByUser: {
                  firstName: 'Support',
                  lastName: 'Team',
                  email: 'support@example.com'
                },
                updatedByUser: null
              }
            ]
          }
        }
      ];

      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValue(mockServices as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'customer',
        mockUserId
      );

      // Service should have 1 external comment
      expect(result['service-fulfillment-1'].comments).toHaveLength(1);
      expect(result['service-fulfillment-1'].comments[0].isInternalOnly).toBe(false);
      expect(result['service-fulfillment-1'].total).toBe(1);

      // Verify the query filtered by isInternalOnly
      expect(prisma.servicesFulfillment.findMany).toHaveBeenCalledWith({
        where: { orderId: mockOrderId },
        include: {
          service: true,
          orderItem: {
            include: {
              comments: {
                where: { isInternalOnly: false },
                orderBy: { createdAt: 'desc' },
                include: {
                  template: true,
                  createdByUser: true,
                  updatedByUser: true
                }
              }
            }
          }
        }
      });
    });

    it('should handle services without orderItem gracefully', async () => {
      const mockServices = [
        {
          id: 'service-fulfillment-1',
          orderId: mockOrderId,
          orderItemId: 'order-item-1',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          status: 'Processing',
          orderItem: null // No orderItem linked
        },
        {
          id: 'service-fulfillment-2',
          orderId: mockOrderId,
          orderItemId: 'order-item-2',
          service: { id: 'def-2', name: 'Drug Test', code: 'DRUGTEST' },
          status: 'Processing',
          orderItem: {
            id: 'order-item-2',
            comments: undefined // No comments array
          }
        }
      ];

      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValue(mockServices as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      // Both services should have empty comment arrays
      expect(result['service-fulfillment-1'].comments).toEqual([]);
      expect(result['service-fulfillment-1'].total).toBe(0);
      expect(result['service-fulfillment-2'].comments).toEqual([]);
      expect(result['service-fulfillment-2'].total).toBe(0);
    });
  });

  describe('API response transformation', () => {
    it('should transform comment data for API response with all required fields', async () => {
      const mockServices = [
        {
          id: 'service-fulfillment-1',
          orderId: mockOrderId,
          orderItemId: 'order-item-1',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          status: 'Processing',
          orderItem: {
            id: 'order-item-1',
            comments: [
              {
                id: 'comment-1',
                orderItemId: 'order-item-1',
                templateId: 'template-1',
                finalText: 'Test comment',
                isInternalOnly: true,
                isStatusChange: false,
                statusChangedFrom: null,
                statusChangedTo: null,
                createdBy: 'user-1',
                createdAt: new Date('2024-03-01T10:00:00Z'),
                updatedBy: 'user-2',
                updatedAt: new Date('2024-03-02T10:00:00Z'),
                template: {
                  id: 'template-1',
                  shortName: 'TEST',
                  longName: 'Test Template'
                },
                createdByUser: {
                  id: 'user-1',
                  firstName: 'John',
                  lastName: 'Doe',
                  email: 'john@example.com'
                },
                updatedByUser: {
                  id: 'user-2',
                  firstName: 'Jane',
                  lastName: 'Smith',
                  email: 'jane@example.com'
                }
              }
            ]
          }
        }
      ];

      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValue(mockServices as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      const comment = result['service-fulfillment-1'].comments[0];

      // Verify all required fields are present
      expect(comment).toMatchObject({
        id: 'comment-1',
        orderItemId: 'order-item-1',
        templateId: 'template-1',
        finalText: 'Test comment',
        isInternalOnly: true,
        isStatusChange: false,
        statusChangedFrom: null,
        statusChangedTo: null,
        createdBy: 'user-1',
        updatedBy: 'user-2',
        template: {
          shortName: 'TEST',
          longName: 'Test Template'
        },
        createdByUser: expect.any(Object),
        updatedByUser: expect.any(Object)
      });
    });
  });
});