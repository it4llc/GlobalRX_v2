// Integration tests for retrieving service comments
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceCommentService } from '@/services/service-comment-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    servicesFulfillment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn()
    },
    orderItem: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    serviceComment: {
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

describe('ServiceCommentService.getServiceComments', () => {
  let service: ServiceCommentService;
  const mockUserId = 'user-123';
  const mockServiceId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockCustomerId = 'customer-123';
  const mockVendorId = 'vendor-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('visibility filtering by user role', () => {
    const mockInternalComment = {
      id: 'comment-1',
      serviceId: mockServiceId,
      finalText: 'Internal only comment',
      isInternalOnly: true,
      createdAt: new Date('2024-03-03T10:00:00Z'),
      template: { shortName: 'INTERNAL', longName: 'Internal Note' },
      createdByUser: { name: 'Admin User', email: 'admin@example.com' },
      updatedByUser: null
    };

    const mockExternalComment = {
      id: 'comment-2',
      serviceId: mockServiceId,
      finalText: 'External comment',
      isInternalOnly: false,
      createdAt: new Date('2024-03-02T10:00:00Z'),
      template: { shortName: 'EXTERNAL', longName: 'Customer Note' },
      createdByUser: { name: 'Support User', email: 'support@example.com' },
      updatedByUser: null
    };

    it('should return all comments for internal users', async () => {
      const allComments = [mockInternalComment, mockExternalComment];
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue(allComments as any);

      const result = await service.getServiceComments(
        mockServiceId,
        'internal',
        mockUserId
      );

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(expect.objectContaining({ id: 'comment-1' }));
      expect(result).toContainEqual(expect.objectContaining({ id: 'comment-2' }));

      // Verify query didn't filter by isInternalOnly
      expect(prisma.serviceComment.findMany).toHaveBeenCalledWith({
        where: { serviceId: mockServiceId },
        orderBy: { createdAt: 'desc' },
        include: {
          template: true,
          createdByUser: true,
          updatedByUser: true
        }
      });
    });

    it('should return all comments for vendor users', async () => {
      const allComments = [mockInternalComment, mockExternalComment];
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue(allComments as any);

      const result = await service.getServiceComments(
        mockServiceId,
        'vendor',
        mockUserId
      );

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(expect.objectContaining({ id: 'comment-1' }));
      expect(result).toContainEqual(expect.objectContaining({ id: 'comment-2' }));

      // Verify query didn't filter by isInternalOnly
      expect(prisma.serviceComment.findMany).toHaveBeenCalledWith({
        where: { serviceId: mockServiceId },
        orderBy: { createdAt: 'desc' },
        include: {
          template: true,
          createdByUser: true,
          updatedByUser: true
        }
      });
    });

    it('should filter internal comments for customer users', async () => {
      const externalOnly = [mockExternalComment];
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue(externalOnly as any);

      const result = await service.getServiceComments(
        mockServiceId,
        'customer',
        mockUserId
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('comment-2');
      expect(result[0].isInternalOnly).toBe(false);

      // Verify query filtered by isInternalOnly
      expect(prisma.serviceComment.findMany).toHaveBeenCalledWith({
        where: {
          serviceId: mockServiceId,
          isInternalOnly: false
        },
        orderBy: { createdAt: 'desc' },
        include: {
          template: true,
          createdByUser: true,
          updatedByUser: true
        }
      });
    });

    it('should return empty array when no comments exist', async () => {
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue([]);

      const result = await service.getServiceComments(
        mockServiceId,
        'internal',
        mockUserId
      );

      expect(result).toEqual([]);
    });

    it('should return empty array for customer when only internal comments exist', async () => {
      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue([]);

      const result = await service.getServiceComments(
        mockServiceId,
        'customer',
        mockUserId
      );

      expect(result).toEqual([]);

      // Verify it queried with the filter
      expect(prisma.serviceComment.findMany).toHaveBeenCalledWith({
        where: {
          serviceId: mockServiceId,
          isInternalOnly: false
        },
        orderBy: { createdAt: 'desc' },
        include: {
          template: true,
          createdByUser: true,
          updatedByUser: true
        }
      });
    });
  });

  describe('sorting and ordering', () => {
    it('should return comments sorted by createdAt descending', async () => {
      const comments = [
        { id: 'comment-3', createdAt: new Date('2024-03-03T10:00:00Z'), finalText: 'Newest' },
        { id: 'comment-2', createdAt: new Date('2024-03-02T10:00:00Z'), finalText: 'Middle' },
        { id: 'comment-1', createdAt: new Date('2024-03-01T10:00:00Z'), finalText: 'Oldest' }
      ];

      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue(comments as any);

      const result = await service.getServiceComments(
        mockServiceId,
        'internal',
        mockUserId
      );

      expect(result[0].id).toBe('comment-3');
      expect(result[1].id).toBe('comment-2');
      expect(result[2].id).toBe('comment-1');

      // Verify the orderBy clause
      expect(prisma.serviceComment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' }
        })
      );
    });
  });

  describe('included relations', () => {
    it('should include template information', async () => {
      const mockComment = {
        id: 'comment-1',
        serviceId: mockServiceId,
        template: {
          id: 'template-1',
          shortName: 'DOC_REQ',
          longName: 'Document Required',
          templateText: 'Please provide [document]'
        },
        createdByUser: { name: 'User', email: 'user@example.com' },
        updatedByUser: null
      };

      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue([mockComment] as any);

      const result = await service.getServiceComments(
        mockServiceId,
        'internal',
        mockUserId
      );

      expect(result[0].template).toBeDefined();
      expect(result[0].template.shortName).toBe('DOC_REQ');
      expect(result[0].template.longName).toBe('Document Required');
    });

    it('should include created by user information', async () => {
      const mockComment = {
        id: 'comment-1',
        serviceId: mockServiceId,
        template: { shortName: 'TEST', longName: 'Test' },
        createdByUser: {
          id: 'user-1',
          name: 'John Doe',
          email: 'john@example.com'
        },
        updatedByUser: null
      };

      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue([mockComment] as any);

      const result = await service.getServiceComments(
        mockServiceId,
        'internal',
        mockUserId
      );

      expect(result[0].createdByUser).toBeDefined();
      expect(result[0].createdByUser.name).toBe('John Doe');
      expect(result[0].createdByUser.email).toBe('john@example.com');
    });

    it('should include updated by user information when present', async () => {
      const mockComment = {
        id: 'comment-1',
        serviceId: mockServiceId,
        template: { shortName: 'TEST', longName: 'Test' },
        createdByUser: { name: 'John Doe', email: 'john@example.com' },
        updatedByUser: {
          id: 'user-2',
          name: 'Jane Smith',
          email: 'jane@example.com'
        },
        updatedAt: new Date('2024-03-04T15:00:00Z')
      };

      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue([mockComment] as any);

      const result = await service.getServiceComments(
        mockServiceId,
        'internal',
        mockUserId
      );

      expect(result[0].updatedByUser).toBeDefined();
      expect(result[0].updatedByUser.name).toBe('Jane Smith');
      expect(result[0].updatedByUser.email).toBe('jane@example.com');
    });

    it('should have null updatedByUser when comment not edited', async () => {
      const mockComment = {
        id: 'comment-1',
        serviceId: mockServiceId,
        template: { shortName: 'TEST', longName: 'Test' },
        createdByUser: { name: 'John Doe', email: 'john@example.com' },
        updatedByUser: null,
        updatedBy: null,
        updatedAt: null
      };

      vi.mocked(prisma.serviceComment.findMany).mockResolvedValue([mockComment] as any);

      const result = await service.getServiceComments(
        mockServiceId,
        'internal',
        mockUserId
      );

      expect(result[0].updatedByUser).toBeNull();
      expect(result[0].updatedBy).toBeNull();
      expect(result[0].updatedAt).toBeNull();
    });
  });
});

describe('ServiceCommentService.validateUserAccess', () => {
  let service: ServiceCommentService;
  const mockUserId = 'user-123';
  const mockServiceId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockOrderId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCustomerId = 'customer-123';
  const mockVendorId = 'vendor-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('service access validation', () => {
    it('should grant access to internal users for any service', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        orderId: mockOrderId,
        assignedVendorId: 'other-vendor',
        order: { customerId: 'other-customer' }
      } as any);

      const hasAccess = await service.validateUserAccess(
        mockServiceId,
        mockUserId,
        'internal'
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny access when service does not exist', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(null);

      const hasAccess = await service.validateUserAccess(
        mockServiceId,
        mockUserId,
        'internal'
      );

      expect(hasAccess).toBe(false);
    });

    it('should grant vendor access to assigned services', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        orderId: mockOrderId,
        assignedVendorId: mockVendorId,
        order: { customerId: mockCustomerId }
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        vendorId: mockVendorId
      } as any);

      const hasAccess = await service.validateUserAccess(
        mockServiceId,
        mockUserId,
        'vendor'
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny vendor access to non-assigned services', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        orderId: mockOrderId,
        assignedVendorId: 'other-vendor-123',
        order: { customerId: mockCustomerId }
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        vendorId: mockVendorId
      } as any);

      const hasAccess = await service.validateUserAccess(
        mockServiceId,
        mockUserId,
        'vendor'
      );

      expect(hasAccess).toBe(false);
    });

    it('should grant customer access to their own order services', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        orderId: mockOrderId,
        assignedVendorId: mockVendorId,
        order: { customerId: mockCustomerId }
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        customerId: mockCustomerId
      } as any);

      const hasAccess = await service.validateUserAccess(
        mockServiceId,
        mockUserId,
        'customer'
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny customer access to other customer services', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        orderId: mockOrderId,
        assignedVendorId: mockVendorId,
        order: { customerId: 'other-customer-123' }
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        customerId: mockCustomerId
      } as any);

      const hasAccess = await service.validateUserAccess(
        mockServiceId,
        mockUserId,
        'customer'
      );

      expect(hasAccess).toBe(false);
    });

    it('should return false for unknown user types', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        orderId: mockOrderId,
        order: {}
      } as any);

      const hasAccess = await service.validateUserAccess(
        mockServiceId,
        mockUserId,
        'unknown' as any
      );

      expect(hasAccess).toBe(false);
    });

    it('should return false when user does not exist', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        orderId: mockOrderId,
        assignedVendorId: mockVendorId,
        order: { customerId: mockCustomerId }
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const hasAccess = await service.validateUserAccess(
        mockServiceId,
        mockUserId,
        'vendor'
      );

      expect(hasAccess).toBe(false);
    });
  });
});

describe('ServiceCommentService.validateOrderAccess', () => {
  let service: ServiceCommentService;
  const mockUserId = 'user-123';
  const mockOrderId = '550e8400-e29b-41d4-a716-446655440001';
  const mockCustomerId = 'customer-123';
  const mockVendorId = 'vendor-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('order access validation', () => {
    it('should grant access to internal users for any order', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: mockOrderId,
        customerId: 'other-customer'
      } as any);

      const hasAccess = await service.validateOrderAccess(
        mockOrderId,
        mockUserId,
        'internal'
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny access when order does not exist', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue(null);

      const hasAccess = await service.validateOrderAccess(
        mockOrderId,
        mockUserId,
        'internal'
      );

      expect(hasAccess).toBe(false);
    });

    it('should grant vendor access to orders with assigned services', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: mockOrderId,
        customerId: mockCustomerId
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        vendorId: mockVendorId
      } as any);

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue({
        id: 'c47ac10b-58cc-4372-a567-0e02b2c3d479',
        orderId: mockOrderId,
        assignedVendorId: mockVendorId
      } as any);

      const hasAccess = await service.validateOrderAccess(
        mockOrderId,
        mockUserId,
        'vendor'
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny vendor access to orders without assigned services', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: mockOrderId,
        customerId: mockCustomerId
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        vendorId: mockVendorId
      } as any);

      vi.mocked(prisma.servicesFulfillment.findFirst).mockResolvedValue(null);

      const hasAccess = await service.validateOrderAccess(
        mockOrderId,
        mockUserId,
        'vendor'
      );

      expect(hasAccess).toBe(false);
    });

    it('should grant customer access to their own orders', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: mockOrderId,
        customerId: mockCustomerId
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        customerId: mockCustomerId
      } as any);

      const hasAccess = await service.validateOrderAccess(
        mockOrderId,
        mockUserId,
        'customer'
      );

      expect(hasAccess).toBe(true);
    });

    it('should deny customer access to other customer orders', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: mockOrderId,
        customerId: 'other-customer-123'
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: mockUserId,
        customerId: mockCustomerId
      } as any);

      const hasAccess = await service.validateOrderAccess(
        mockOrderId,
        mockUserId,
        'customer'
      );

      expect(hasAccess).toBe(false);
    });

    it('should return false when user does not exist', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: mockOrderId,
        customerId: mockCustomerId
      } as any);

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      const hasAccess = await service.validateOrderAccess(
        mockOrderId,
        mockUserId,
        'vendor'
      );

      expect(hasAccess).toBe(false);
    });

    it('should return false for unknown user types', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValue({
        id: mockOrderId
      } as any);

      const hasAccess = await service.validateOrderAccess(
        mockOrderId,
        mockUserId,
        'unknown' as any
      );

      expect(hasAccess).toBe(false);
    });
  });
});