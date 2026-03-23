// Integration tests for bulk retrieval of order service comments
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceCommentService } from '@/services/service-comment-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma client - add orderItem which is required
vi.mock('@/lib/prisma', () => ({
  prisma: {
    servicesFulfillment: {
      findMany: vi.fn()
    },
    orderItem: {
      findUnique: vi.fn(),
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

describe('ServiceCommentService.getOrderServiceComments', () => {
  let service: ServiceCommentService;
  const mockUserId = 'user-123';
  const mockOrderId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCustomerId = 'customer-123';
  const mockVendorId = 'vendor-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('multiple services with comments', () => {
    it('should return all comments for all services for internal users', async () => {
      const mockOrderItems = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Processing',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          serviceFulfillment: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [
            {
              id: 'comment-1-1',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Internal comment for service 1',
              isInternalOnly: true,
              createdAt: new Date('2024-03-03T10:00:00Z'),
              template: { shortName: 'INT', longName: 'Internal Note' },
              createdByUser: { name: 'Admin', email: 'admin@example.com' },
              updatedByUser: null
            },
            {
              id: 'comment-1-2',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'External comment for service 1',
              isInternalOnly: false,
              createdAt: new Date('2024-03-02T10:00:00Z'),
              template: { shortName: 'EXT', longName: 'External Note' },
              createdByUser: { name: 'Support', email: 'support@example.com' },
              updatedByUser: null
            }
          ]
        },
        {
          id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Completed',
          service: { id: 'def-2', name: 'Drug Test', code: 'DRUGTEST' },
          serviceFulfillment: { id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [
            {
              id: 'comment-2-1',
              serviceId: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Comment for service 2',
              isInternalOnly: false,
              createdAt: new Date('2024-03-01T10:00:00Z'),
              template: { shortName: 'COMP', longName: 'Completed' },
              createdByUser: { name: 'Tech', email: 'tech@example.com' },
              updatedByUser: null
            }
          ]
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479']).toBeDefined();
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].serviceName).toBe('Background Check');
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].serviceStatus).toBe('Processing');
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments).toHaveLength(2);
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(2);

      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479']).toBeDefined();
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].serviceName).toBe('Drug Test');
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].serviceStatus).toBe('Completed');
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].comments).toHaveLength(1);
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(1);
    });

    it('should filter internal comments for customer users', async () => {
      const mockOrderItems = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Processing',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          serviceFulfillment: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [
            // Only external comment should be included for customers
            {
              id: 'comment-1-2',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'External comment',
              isInternalOnly: false,
              createdAt: new Date('2024-03-02T10:00:00Z'),
              template: { shortName: 'EXT', longName: 'External Note' },
              createdByUser: { name: 'Support', email: 'support@example.com' },
              updatedByUser: null
            }
          ]
        },
        {
          id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Processing',
          service: { id: 'def-2', name: 'Drug Test', code: 'DRUGTEST' },
          serviceFulfillment: { id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [] // No external comments
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'customer',
        mockUserId
      );

      // Service 1 should have 1 external comment
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments).toHaveLength(1);
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments[0].isInternalOnly).toBe(false);
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(1);

      // Service 2 should have no comments
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].comments).toHaveLength(0);
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(0);

      // Verify the query filtered by isInternalOnly
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: mockOrderId },
        include: {
          service: true,
          serviceFulfillment: true,
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
      });
    });

    it('should return all comments for vendor users', async () => {
      const mockOrderItems = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Processing',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          serviceFulfillment: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [
            {
              id: 'comment-1-1',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Internal comment',
              isInternalOnly: true,
              createdAt: new Date('2024-03-03T10:00:00Z'),
              template: { shortName: 'INT', longName: 'Internal Note' },
              createdByUser: { name: 'Admin', email: 'admin@example.com' },
              updatedByUser: null
            },
            {
              id: 'comment-1-2',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'External comment',
              isInternalOnly: false,
              createdAt: new Date('2024-03-02T10:00:00Z'),
              template: { shortName: 'EXT', longName: 'External Note' },
              createdByUser: { name: 'Support', email: 'support@example.com' },
              updatedByUser: null
            }
          ]
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'vendor',
        mockUserId
      );

      // Vendors see all comments (both internal and external)
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments).toHaveLength(2);
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(2);

      // Verify the query didn't filter by isInternalOnly
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith({
        where: { orderId: mockOrderId },
        include: {
          service: true,
          serviceFulfillment: true,
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
      });
    });
  });

  describe('empty and edge cases', () => {
    it('should return empty object when order has no services', async () => {
      vi.mocked(prisma.orderItem.findMany).mockResolvedValue([]);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      expect(result).toEqual({});
    });

    it('should handle services with no comments', async () => {
      const mockOrderItems = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Draft',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          serviceFulfillment: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: []
        },
        {
          id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Draft',
          service: { id: 'def-2', name: 'Drug Test', code: 'DRUGTEST' },
          serviceFulfillment: { id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: []
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments).toEqual([]);
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(0);
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].comments).toEqual([]);
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(0);
    });

    it('should handle mixed scenario - some services with comments, some without', async () => {
      const mockOrderItems = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Processing',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          serviceFulfillment: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [
            {
              id: 'comment-1',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Has comment',
              isInternalOnly: false,
              createdAt: new Date(),
              template: { shortName: 'NOTE', longName: 'Note' },
              createdByUser: { name: 'User', email: 'user@example.com' },
              updatedByUser: null
            }
          ]
        },
        {
          id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Draft',
          service: { id: 'def-2', name: 'Drug Test', code: 'DRUGTEST' },
          serviceFulfillment: { id: 'a47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: []
        },
        {
          id: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Completed',
          service: { id: 'def-3', name: 'Education Verification', code: 'EDUVER' },
          serviceFulfillment: { id: 'b47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [
            {
              id: 'comment-3-1',
              serviceId: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Completed successfully',
              isInternalOnly: false,
              createdAt: new Date(),
              template: { shortName: 'COMP', longName: 'Completed' },
              createdByUser: { name: 'Verifier', email: 'verifier@example.com' },
              updatedByUser: null
            },
            {
              id: 'comment-3-2',
              serviceId: 'b47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Internal review note',
              isInternalOnly: true,
              createdAt: new Date(),
              template: { shortName: 'REV', longName: 'Review' },
              createdByUser: { name: 'Reviewer', email: 'reviewer@example.com' },
              updatedByUser: null
            }
          ]
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      expect(Object.keys(result)).toHaveLength(3);
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(1);
      expect(result['a47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(0);
      expect(result['b47ac10b-58cc-4372-a567-0e02b2c3d479'].total).toBe(2);
    });
  });

  describe('comment sorting', () => {
    it('should sort comments newest first within each service', async () => {
      const mockOrderItems = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Processing',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          serviceFulfillment: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [
            {
              id: 'comment-newest',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Newest',
              isInternalOnly: false,
              createdAt: new Date('2024-03-03T10:00:00Z'),
              template: { shortName: 'NEW', longName: 'New' },
              createdByUser: { name: 'User', email: 'user@example.com' },
              updatedByUser: null
            },
            {
              id: 'comment-middle',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Middle',
              isInternalOnly: false,
              createdAt: new Date('2024-03-02T10:00:00Z'),
              template: { shortName: 'MID', longName: 'Middle' },
              createdByUser: { name: 'User', email: 'user@example.com' },
              updatedByUser: null
            },
            {
              id: 'comment-oldest',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Oldest',
              isInternalOnly: false,
              createdAt: new Date('2024-03-01T10:00:00Z'),
              template: { shortName: 'OLD', longName: 'Old' },
              createdByUser: { name: 'User', email: 'user@example.com' },
              updatedByUser: null
            }
          ]
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      const comments = result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments;
      expect(comments[0].id).toBe('comment-newest');
      expect(comments[1].id).toBe('comment-middle');
      expect(comments[2].id).toBe('comment-oldest');

      // Verify orderBy was included in query
      expect(prisma.orderItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            comments: expect.objectContaining({
              orderBy: { createdAt: 'desc' }
            })
          })
        })
      );
    });
  });

  describe('response structure', () => {
    it('should include service details in response', async () => {
      const mockOrderItems = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Processing',
          service: {
            id: 'def-1',
            name: 'Background Check',
            code: 'BGCHECK',
            description: 'Criminal background verification'
          },
          serviceFulfillment: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: []
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].serviceName).toBe('Background Check');
      expect(result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].serviceStatus).toBe('Processing');
    });

    it('should include comment details with template and user info', async () => {
      const mockOrderItems = [
        {
          id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
          orderId: mockOrderId,
          status: 'Processing',
          service: { id: 'def-1', name: 'Background Check', code: 'BGCHECK' },
          serviceFulfillment: { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' },
          comments: [
            {
              id: 'comment-1',
              serviceId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
              finalText: 'Test comment with details',
              isInternalOnly: false,
              createdAt: new Date('2024-03-01T10:00:00Z'),
              createdBy: 'user-1',
              updatedBy: 'user-2',
              updatedAt: new Date('2024-03-02T15:00:00Z'),
              template: {
                id: 'template-1',
                shortName: 'DOC_REQ',
                longName: 'Document Required'
              },
              createdByUser: {
                id: 'user-1',
                name: 'John Doe',
                email: 'john@example.com'
              },
              updatedByUser: {
                id: 'user-2',
                name: 'Jane Smith',
                email: 'jane@example.com'
              }
            }
          ]
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      const comment = result['f47ac10b-58cc-4372-a567-0e02b2c3d479'].comments[0];
      expect(comment.finalText).toBe('Test comment with details');
      expect(comment.template.shortName).toBe('DOC_REQ');
      expect(comment.template.longName).toBe('Document Required');
      expect(comment.createdByUser.name).toBe('John Doe');
      expect(comment.updatedByUser.name).toBe('Jane Smith');
    });

    it('should use service ID as key in result object', async () => {
      const mockOrderItems = [
        {
          id: 'unique-service-id-123',
          orderId: mockOrderId,
          status: 'Draft',
          service: { id: 'def-1', name: 'Test Service', code: 'TEST' },
          serviceFulfillment: { id: 'unique-service-id-123' },
          comments: []
        },
        {
          id: 'another-service-id-456',
          orderId: mockOrderId,
          status: 'Draft',
          service: { id: 'def-2', name: 'Another Service', code: 'ANOTHER' },
          serviceFulfillment: { id: 'another-service-id-456' },
          comments: []
        }
      ];

      vi.mocked(prisma.orderItem.findMany).mockResolvedValue(mockOrderItems as any);

      const result = await service.getOrderServiceComments(
        mockOrderId,
        'internal',
        mockUserId
      );

      expect(result['unique-service-id-123']).toBeDefined();
      expect(result['another-service-id-456']).toBeDefined();
      expect(Object.keys(result)).toEqual(['unique-service-id-123', 'another-service-id-456']);
    });
  });
});