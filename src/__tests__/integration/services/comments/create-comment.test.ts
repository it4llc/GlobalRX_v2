// Integration tests for creating service comments
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceCommentService } from '@/services/service-comment-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    servicesFulfillment: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    service: {
      findUnique: vi.fn()
    },
    commentTemplate: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    commentTemplateAvailability: {
      findFirst: vi.fn()
    },
    serviceComment: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
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

describe('ServiceCommentService.createComment', () => {
  let service: ServiceCommentService;
  const mockUserId = 'user-123';
  const mockServiceId = 'service-123';
  const mockTemplateId = 'template-123';
  const mockOrderId = 'order-123';
  const mockCustomerId = 'customer-123';
  const mockVendorId = 'vendor-123';

  // Helper to setup transaction mock
  const setupTransactionMock = (mockComment: any) => {
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const tx = {
        serviceComment: {
          create: vi.fn().mockResolvedValue(mockComment)
        },
        commentTemplate: {
          update: vi.fn().mockResolvedValue({ hasBeenUsed: true })
        }
      };
      return callback(tx);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('validation', () => {
    it('should reject empty comment text', async () => {
      await expect(
        service.createComment(
          mockServiceId,
          {
            templateId: mockTemplateId,
            finalText: ''
          },
          mockUserId
        )
      ).rejects.toThrow('Comment text cannot be empty');
    });

    it('should reject whitespace-only comment text', async () => {
      await expect(
        service.createComment(
          mockServiceId,
          {
            templateId: mockTemplateId,
            finalText: '   \n\t   '
          },
          mockUserId
        )
      ).rejects.toThrow('Comment text cannot be empty');
    });

    it('should reject comment text exceeding 1000 characters', async () => {
      await expect(
        service.createComment(
          mockServiceId,
          {
            templateId: mockTemplateId,
            finalText: 'a'.repeat(1001)
          },
          mockUserId
        )
      ).rejects.toThrow('Comment text cannot exceed 1000 characters');
    });

    it('should accept comment text of exactly 1000 characters', async () => {
      const longText = 'a'.repeat(1000);

      // Setup mocks for successful creation
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        serviceId: 'service-def-123',
        orderId: mockOrderId,
        status: 'Processing',
        order: { id: mockOrderId }
      });

      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: true,
        shortName: 'TEST',
        longName: 'Test Template'
      });

      vi.mocked(prisma.service.findUnique).mockResolvedValue({
        id: 'service-def-123',
        code: 'BGCHECK'
      });

      vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValue({
        id: 'availability-123',
        templateId: mockTemplateId,
        serviceCode: 'BGCHECK',
        status: 'Processing'
      });

      const mockComment = {
        id: 'comment-123',
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: longText,
        isInternalOnly: true,
        createdBy: mockUserId,
        createdAt: new Date(),
        template: { shortName: 'TEST', longName: 'Test Template' },
        createdByUser: { name: 'Test User', email: 'test@example.com' },
        updatedByUser: null
      };

      // Setup transaction mock
      setupTransactionMock(mockComment);

      const result = await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: longText
        },
        mockUserId
      );

      expect(result.finalText).toBe(longText);
    });
  });

  describe('service validation', () => {
    it('should reject when service does not exist', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue(null);

      await expect(
        service.createComment(
          mockServiceId,
          {
            templateId: mockTemplateId,
            finalText: 'Valid comment'
          },
          mockUserId
        )
      ).rejects.toThrow('Service not found');
    });

    it('should accept when service exists', async () => {
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        serviceId: 'service-def-123',
        orderId: mockOrderId,
        status: 'Processing',
        order: { id: mockOrderId }
      });

      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: true
      });

      vi.mocked(prisma.service.findUnique).mockResolvedValue({
        id: 'service-def-123',
        code: 'BGCHECK'
      });

      vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValue({
        id: 'availability-123'
      });

      const mockComment = {
        id: 'comment-123',
        serviceId: mockServiceId,
        template: {},
        createdByUser: {},
        updatedByUser: null
      };

      // Setup transaction mock
      setupTransactionMock(mockComment);

      const result = await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Valid comment'
        },
        mockUserId
      );

      expect(result).toBeDefined();
    });
  });

  describe('template validation', () => {
    beforeEach(() => {
      // Setup service exists mock
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        serviceId: 'service-def-123',
        orderId: mockOrderId,
        status: 'Processing',
        order: { id: mockOrderId }
      });

      vi.mocked(prisma.service.findUnique).mockResolvedValue({
        id: 'service-def-123',
        code: 'BGCHECK'
      });
    });

    it('should reject when template does not exist', async () => {
      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue(null);

      await expect(
        service.createComment(
          mockServiceId,
          {
            templateId: mockTemplateId,
            finalText: 'Valid comment'
          },
          mockUserId
        )
      ).rejects.toThrow('Invalid template ID');
    });

    it('should reject when template is inactive', async () => {
      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: false
      });

      await expect(
        service.createComment(
          mockServiceId,
          {
            templateId: mockTemplateId,
            finalText: 'Valid comment'
          },
          mockUserId
        )
      ).rejects.toThrow('Selected template is no longer active');
    });

    it('should reject when template is not available for service type and status', async () => {
      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: true
      });

      vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValue(null);

      await expect(
        service.createComment(
          mockServiceId,
          {
            templateId: mockTemplateId,
            finalText: 'Valid comment'
          },
          mockUserId
        )
      ).rejects.toThrow('Template not available for this service type and status');
    });

    it('should accept when template is active and available', async () => {
      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: true
      });

      vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValue({
        id: 'availability-123',
        templateId: mockTemplateId,
        serviceCode: 'BGCHECK',
        status: 'Processing'
      });

      const mockComment = {
        id: 'comment-123',
        template: {},
        createdByUser: {},
        updatedByUser: null
      };

      // Setup transaction mock
      setupTransactionMock(mockComment);

      const result = await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Valid comment'
        },
        mockUserId
      );

      expect(result).toBeDefined();
    });

    it('should mark template as used after creating comment', async () => {
      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: true
      });

      vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValue({
        id: 'availability-123'
      });

      // Setup transaction mock
      setupTransactionMock({
        id: 'comment-123',
        template: {},
        createdByUser: {},
        updatedByUser: null
      });

      await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Valid comment'
        },
        mockUserId
      );

      // Verify the transaction was called (which includes marking template as used)
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('visibility defaults', () => {
    beforeEach(() => {
      // Setup all validations to pass
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        serviceId: 'service-def-123',
        orderId: mockOrderId,
        status: 'Processing',
        order: { id: mockOrderId }
      });

      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: true
      });

      vi.mocked(prisma.service.findUnique).mockResolvedValue({
        id: 'service-def-123',
        code: 'BGCHECK'
      });

      vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValue({
        id: 'availability-123'
      });
    });

    it('should default isInternalOnly to true when not provided', async () => {
      let capturedData: any = null;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          serviceComment: {
            create: vi.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve({
                id: 'comment-123',
                isInternalOnly: true,
                template: {},
                createdByUser: {},
                updatedByUser: null
              });
            })
          },
          commentTemplate: {
            update: vi.fn().mockResolvedValue({ hasBeenUsed: true })
          }
        };
        return callback(tx);
      });

      await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Test comment'
          // isInternalOnly not provided
        },
        mockUserId
      );

      expect(capturedData.isInternalOnly).toBe(true);
    });

        it('should use provided isInternalOnly value when false', async () => {
      let capturedData: any = null;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          serviceComment: {
            create: vi.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve({
                id: 'comment-123',
                isInternalOnly: false,
                template: {},
                createdByUser: {},
                updatedByUser: null
              });
            })
          },
          commentTemplate: {
            update: vi.fn().mockResolvedValue({ hasBeenUsed: true })
          }
        };
        return callback(tx);
      });

      await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Test comment',
          isInternalOnly: false
        },
        mockUserId
      );

      expect(capturedData.isInternalOnly).toBe(false);
    });

        it('should use provided isInternalOnly value when true', async () => {
      let capturedData: any = null;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          serviceComment: {
            create: vi.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve({
                id: 'comment-123',
                isInternalOnly: true,
                template: {},
                createdByUser: {},
                updatedByUser: null
              });
            })
          },
          commentTemplate: {
            update: vi.fn().mockResolvedValue({ hasBeenUsed: true })
          }
        };
        return callback(tx);
      });

      await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Test comment',
          isInternalOnly: true
        },
        mockUserId
      );

      expect(capturedData.isInternalOnly).toBe(true);
    });
  });

  describe('audit trail', () => {
    beforeEach(() => {
      // Setup all validations to pass
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        serviceId: 'service-def-123',
        orderId: mockOrderId,
        status: 'Processing',
        order: { id: mockOrderId }
      });

      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: true
      });

      vi.mocked(prisma.service.findUnique).mockResolvedValue({
        id: 'service-def-123',
        code: 'BGCHECK'
      });

      vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValue({
        id: 'availability-123'
      });
    });

    it('should set createdBy to the current user', async () => {
      let capturedData: any = null;
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const tx = {
          serviceComment: {
            create: vi.fn().mockImplementation((args) => {
              capturedData = args.data;
              return Promise.resolve({
                id: 'comment-123',
                createdBy: mockUserId,
                template: {},
                createdByUser: { id: mockUserId },
                updatedByUser: null
              });
            })
          },
          commentTemplate: {
            update: vi.fn().mockResolvedValue({ hasBeenUsed: true })
          }
        };
        return callback(tx);
      });

      await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Test comment'
        },
        mockUserId
      );

      expect(capturedData.createdBy).toBe(mockUserId);
    });

    it('should not set updatedBy or updatedAt on creation', async () => {
      const mockComment = {
        id: 'comment-123',
        createdBy: mockUserId,
        createdAt: new Date(),
        updatedBy: null,
        updatedAt: null,
        template: {},
        createdByUser: {},
        updatedByUser: null
      };

      // Setup transaction mock
      setupTransactionMock(mockComment);

      const result = await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Test comment'
        },
        mockUserId
      );

      expect(result.updatedBy).toBeNull();
      expect(result.updatedAt).toBeNull();
      expect(result.updatedByUser).toBeNull();
    });
  });

  describe('response structure', () => {
    beforeEach(() => {
      // Setup all validations to pass
      vi.mocked(prisma.servicesFulfillment.findUnique).mockResolvedValue({
        id: mockServiceId,
        serviceId: 'service-def-123',
        orderId: mockOrderId,
        status: 'Processing',
        order: { id: mockOrderId }
      });

      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValue({
        id: mockTemplateId,
        isActive: true
      });

      vi.mocked(prisma.service.findUnique).mockResolvedValue({
        id: 'service-def-123',
        code: 'BGCHECK'
      });

      vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValue({
        id: 'availability-123'
      });
    });

    it('should include template details in response', async () => {
      const mockComment = {
        id: 'comment-123',
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Test comment',
        isInternalOnly: true,
        createdBy: mockUserId,
        createdAt: new Date(),
        template: {
          id: mockTemplateId,
          shortName: 'DOC_REQ',
          longName: 'Document Required'
        },
        createdByUser: {
          id: mockUserId,
          name: 'Test User',
          email: 'test@example.com'
        },
        updatedByUser: null
      };

      // Setup transaction mock
      setupTransactionMock(mockComment);

      const result = await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Test comment'
        },
        mockUserId
      );

      expect(result.template).toBeDefined();
      expect(result.template.shortName).toBe('DOC_REQ');
      expect(result.template.longName).toBe('Document Required');
    });

    it('should include user details in response', async () => {
      const mockComment = {
        id: 'comment-123',
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Test comment',
        isInternalOnly: true,
        createdBy: mockUserId,
        createdAt: new Date(),
        template: {
          id: mockTemplateId,
          shortName: 'DOC_REQ',
          longName: 'Document Required'
        },
        createdByUser: {
          id: mockUserId,
          name: 'Test User',
          email: 'test@example.com'
        },
        updatedByUser: null
      };

      // Setup transaction mock
      setupTransactionMock(mockComment);

      const result = await service.createComment(
        mockServiceId,
        {
          templateId: mockTemplateId,
          finalText: 'Test comment'
        },
        mockUserId
      );

      expect(result.createdByUser).toBeDefined();
      expect(result.createdByUser.name).toBe('Test User');
      expect(result.createdByUser.email).toBe('test@example.com');
    });
  });
});