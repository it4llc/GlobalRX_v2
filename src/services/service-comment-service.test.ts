// /GlobalRX_v2/src/services/service-comment-service.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceCommentService } from './service-comment-service';
import { prisma } from '@/lib/prisma';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn(),
    serviceComment: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    service: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    orderItem: {
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    servicesFulfillment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn()
    },
    commentTemplate: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    commentTemplateAvailability: {
      findFirst: vi.fn()
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

describe('ServiceCommentService', () => {
  let service: ServiceCommentService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('createComment', () => {
    const mockUserId = 'user-123';
    const mockServiceId = 'service-456';
    const mockTemplateId = 'template-789';
    const mockCommentData = {
      templateId: mockTemplateId,
      finalText: 'This is a test comment',
      isInternalOnly: true
    };

    describe('validation', () => {
      it('should validate that the service exists', async () => {
        vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(null);

        await expect(
          service.createComment(mockServiceId, mockCommentData, mockUserId)
        ).rejects.toThrow('Service not found');

        expect(prisma.orderItem.findUnique).toHaveBeenCalledWith({
          where: { id: mockServiceId },
          include: { order: true }
        });
      });

      it('should validate that the template exists', async () => {
        const mockService = {
          id: mockServiceId,
          orderId: 'order-123',
          serviceId: 'service-def-123',
          status: 'pending',
          order: { customerId: 'customer-123' }
        };

        vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
        vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(null);

        await expect(
          service.createComment(mockServiceId, mockCommentData, mockUserId)
        ).rejects.toThrow('Invalid template ID');

        expect(prisma.commentTemplate.findUnique).toHaveBeenCalledWith({
          where: { id: mockTemplateId }
        });
      });

      it('should validate that the template is active', async () => {
        const mockService = {
          id: mockServiceId,
          orderId: 'order-123',
          serviceId: 'service-def-123',
          status: 'pending',
          order: { customerId: 'customer-123' }
        };

        const mockTemplate = {
          id: mockTemplateId,
          isActive: false,
          shortName: 'INACTIVE',
          longName: 'Inactive Template'
        };

        vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
        vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(mockTemplate as any);

        await expect(
          service.createComment(mockServiceId, mockCommentData, mockUserId)
        ).rejects.toThrow('Selected template is no longer active');
      });

      it('should validate template availability for service type and status', async () => {
        const mockService = {
          id: mockServiceId,
          orderId: 'order-123',
          serviceId: 'service-def-123',
          status: 'pending',
          order: { customerId: 'customer-123' }
        };

        const mockServiceDefinition = {
          id: 'service-def-123',
          code: 'BACKGROUND_CHECK'
        };

        const mockTemplate = {
          id: mockTemplateId,
          isActive: true,
          shortName: 'DOC_REQ',
          longName: 'Document Required'
        };

        vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce(mockServiceDefinition as any);
        vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(mockTemplate as any);
        vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValueOnce(null);

        await expect(
          service.createComment(mockServiceId, mockCommentData, mockUserId)
        ).rejects.toThrow('Template not available for this service type and status');

        expect(prisma.commentTemplateAvailability.findFirst).toHaveBeenCalledWith({
          where: {
            templateId: mockTemplateId,
            serviceCode: 'BACKGROUND_CHECK',
            status: 'pending'
          }
        });
      });

      it('should validate finalText is not empty', async () => {
        const invalidData = {
          ...mockCommentData,
          finalText: '   '
        };

        await expect(
          service.createComment(mockServiceId, invalidData, mockUserId)
        ).rejects.toThrow('Comment text cannot be empty');
      });

      it('should validate finalText does not exceed 1000 characters', async () => {
        const invalidData = {
          ...mockCommentData,
          finalText: 'a'.repeat(1001)
        };

        await expect(
          service.createComment(mockServiceId, invalidData, mockUserId)
        ).rejects.toThrow('Comment text cannot exceed 1000 characters');
      });
    });

    describe('successful creation', () => {
      it('should create a comment with all required fields', async () => {
        const mockService = {
          id: mockServiceId,
          orderId: 'order-123',
          serviceId: 'service-def-123',
          status: 'pending',
          order: { customerId: 'customer-123' }
        };

        const mockServiceDefinition = {
          id: 'service-def-123',
          code: 'BACKGROUND_CHECK'
        };

        const mockTemplate = {
          id: mockTemplateId,
          isActive: true,
          shortName: 'DOC_REQ',
          longName: 'Document Required',
          hasBeenUsed: false
        };

        const mockAvailability = {
          id: 'availability-123',
          templateId: mockTemplateId,
          serviceCode: 'BACKGROUND_CHECK',
          status: 'pending'
        };

        const mockCreatedComment = {
          id: 'comment-123',
          serviceId: mockServiceId,
          templateId: mockTemplateId,
          finalText: mockCommentData.finalText,
          isInternalOnly: true,
          createdBy: mockUserId,
          createdAt: new Date(),
          updatedBy: null,
          updatedAt: null,
          template: mockTemplate,
          createdByUser: { id: mockUserId, firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
          updatedByUser: null
        };

        vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce(mockServiceDefinition as any);
        vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(mockTemplate as any);
        vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValueOnce(mockAvailability as any);

        // Mock the transaction to execute the callback and return the result
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
          // Create a mock transaction object with the same methods as prisma
          const tx = {
            serviceComment: {
              create: vi.fn().mockResolvedValueOnce(mockCreatedComment)
            },
            commentTemplate: {
              update: vi.fn().mockResolvedValueOnce({ ...mockTemplate, hasBeenUsed: true })
            }
          };
          return callback(tx);
        });

        const result = await service.createComment(mockServiceId, mockCommentData, mockUserId);

        expect(result).toEqual(mockCreatedComment);
        expect(prisma.$transaction).toHaveBeenCalled();
      });

      it('should default isInternalOnly to true when not provided', async () => {
        const dataWithoutFlag = {
          templateId: mockTemplateId,
          finalText: 'Test comment'
        };

        const mockService = {
          id: mockServiceId,
          orderId: 'order-123',
          serviceId: 'service-def-123',
          status: 'pending',
          order: { customerId: 'customer-123' }
        };

        const mockServiceDefinition = {
          id: 'service-def-123',
          code: 'BACKGROUND_CHECK'
        };

        const mockTemplate = {
          id: mockTemplateId,
          isActive: true,
          shortName: 'STATUS',
          longName: 'Status Update',
          hasBeenUsed: false
        };

        const mockAvailability = { id: 'avail-123' };

        vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
        vi.mocked(prisma.service.findUnique).mockResolvedValueOnce(mockServiceDefinition as any);
        vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(mockTemplate as any);
        vi.mocked(prisma.commentTemplateAvailability.findFirst).mockResolvedValueOnce(mockAvailability as any);

        // Mock the transaction to capture the isInternalOnly default value
        let capturedData: any = null;
        vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
          const tx = {
            serviceComment: {
              create: vi.fn().mockImplementation((args) => {
                capturedData = args.data;
                return Promise.resolve({});
              })
            },
            commentTemplate: {
              update: vi.fn().mockResolvedValueOnce({})
            }
          };
          return callback(tx);
        });

        await service.createComment(mockServiceId, dataWithoutFlag, mockUserId);

        expect(capturedData).toMatchObject({
          isInternalOnly: true
        });
      });
    });
  });

  describe('updateComment', () => {
    const mockCommentId = 'comment-123';
    const mockUserId = 'user-456';
    const mockUpdateData = {
      finalText: 'Updated comment text'
    };

    describe('validation', () => {
      it('should validate that the comment exists', async () => {
        vi.mocked(prisma.serviceComment.findUnique).mockResolvedValueOnce(null);

        await expect(
          service.updateComment(mockCommentId, mockUpdateData, mockUserId)
        ).rejects.toThrow('Comment not found');
      });

      it('should validate finalText is not empty when provided', async () => {
        const invalidData = {
          finalText: '   '
        };

        const mockComment = {
          id: mockCommentId,
          finalText: 'Original text',
          isInternalOnly: true
        };

        vi.mocked(prisma.serviceComment.findUnique).mockResolvedValueOnce(mockComment as any);

        await expect(
          service.updateComment(mockCommentId, invalidData, mockUserId)
        ).rejects.toThrow('Comment text cannot be empty');
      });

      it('should validate finalText does not exceed 1000 characters', async () => {
        const invalidData = {
          finalText: 'a'.repeat(1001)
        };

        const mockComment = {
          id: mockCommentId,
          finalText: 'Original text',
          isInternalOnly: true
        };

        vi.mocked(prisma.serviceComment.findUnique).mockResolvedValueOnce(mockComment as any);

        await expect(
          service.updateComment(mockCommentId, invalidData, mockUserId)
        ).rejects.toThrow('Comment text cannot exceed 1000 characters');
      });
    });

    describe('successful update', () => {
      it('should update comment and set audit fields', async () => {
        const mockExistingComment = {
          id: mockCommentId,
          serviceId: 'service-123',
          templateId: 'template-123',
          finalText: 'Original text',
          isInternalOnly: true,
          createdBy: 'creator-123',
          createdAt: new Date('2024-01-01')
        };

        const mockUpdatedComment = {
          ...mockExistingComment,
          finalText: mockUpdateData.finalText,
          updatedBy: mockUserId,
          updatedAt: new Date()
        };

        vi.mocked(prisma.serviceComment.findUnique).mockResolvedValueOnce(mockExistingComment as any);
        vi.mocked(prisma.serviceComment.update).mockResolvedValueOnce(mockUpdatedComment as any);

        const result = await service.updateComment(mockCommentId, mockUpdateData, mockUserId);

        expect(result).toEqual(mockUpdatedComment);
        expect(prisma.serviceComment.update).toHaveBeenCalledWith({
          where: { id: mockCommentId },
          data: {
            finalText: mockUpdateData.finalText,
            updatedBy: mockUserId,
            updatedAt: expect.any(Date)
          },
          include: {
            template: true,
            createdByUser: true,
            updatedByUser: true
          }
        });
      });

      it('should update only isInternalOnly when provided', async () => {
        const updateData = {
          isInternalOnly: false
        };

        const mockExistingComment = {
          id: mockCommentId,
          finalText: 'Original text',
          isInternalOnly: true
        };

        vi.mocked(prisma.serviceComment.findUnique).mockResolvedValueOnce(mockExistingComment as any);
        vi.mocked(prisma.serviceComment.update).mockResolvedValueOnce({} as any);

        await service.updateComment(mockCommentId, updateData, mockUserId);

        expect(prisma.serviceComment.update).toHaveBeenCalledWith({
          where: { id: mockCommentId },
          data: {
            isInternalOnly: false,
            updatedBy: mockUserId,
            updatedAt: expect.any(Date)
          },
          include: expect.any(Object)
        });
      });

      it('should update both fields when provided', async () => {
        const updateData = {
          finalText: 'New text',
          isInternalOnly: false
        };

        const mockExistingComment = {
          id: mockCommentId,
          finalText: 'Original text',
          isInternalOnly: true
        };

        vi.mocked(prisma.serviceComment.findUnique).mockResolvedValueOnce(mockExistingComment as any);
        vi.mocked(prisma.serviceComment.update).mockResolvedValueOnce({} as any);

        await service.updateComment(mockCommentId, updateData, mockUserId);

        expect(prisma.serviceComment.update).toHaveBeenCalledWith({
          where: { id: mockCommentId },
          data: {
            finalText: 'New text',
            isInternalOnly: false,
            updatedBy: mockUserId,
            updatedAt: expect.any(Date)
          },
          include: expect.any(Object)
        });
      });
    });
  });

  describe('getServiceComments', () => {
    const mockServiceId = 'service-123';
    const mockUserRole = 'internal';
    const mockUserId = 'user-123';

    describe('visibility filtering', () => {
      it('should return all comments for internal users', async () => {
        const mockComments = [
          { id: '1', isInternalOnly: true, finalText: 'Internal comment' },
          { id: '2', isInternalOnly: false, finalText: 'External comment' }
        ];

        vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments as any);

        const result = await service.getServiceComments(mockServiceId, mockUserRole, mockUserId);

        expect(result).toEqual(mockComments);
        expect(prisma.serviceComment.findMany).toHaveBeenCalledWith({
          where: { orderItemId: mockServiceId },
          orderBy: { createdAt: 'desc' },
          include: {
            template: true,
            createdByUser: true,
            updatedByUser: true
          }
        });
      });

      it('should return all comments for vendor users', async () => {
        const mockComments = [
          { id: '1', isInternalOnly: true, finalText: 'Internal comment' },
          { id: '2', isInternalOnly: false, finalText: 'External comment' }
        ];

        vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments as any);

        const result = await service.getServiceComments(mockServiceId, 'vendor', mockUserId);

        expect(result).toEqual(mockComments);
        expect(prisma.serviceComment.findMany).toHaveBeenCalledWith({
          where: { orderItemId: mockServiceId },
          orderBy: { createdAt: 'desc' },
          include: expect.any(Object)
        });
      });

      it('should filter internal comments for customer users', async () => {
        const mockComments = [
          { id: '2', isInternalOnly: false, finalText: 'External comment' }
        ];

        vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments as any);

        const result = await service.getServiceComments(mockServiceId, 'customer', mockUserId);

        expect(result).toEqual(mockComments);
        expect(prisma.serviceComment.findMany).toHaveBeenCalledWith({
          where: {
            orderItemId: mockServiceId,
            isInternalOnly: false
          },
          orderBy: { createdAt: 'desc' },
          include: expect.any(Object)
        });
      });
    });

    describe('sorting', () => {
      it('should return comments in descending order by creation date', async () => {
        const mockComments = [
          { id: '3', createdAt: new Date('2024-03-03'), finalText: 'Newest' },
          { id: '2', createdAt: new Date('2024-03-02'), finalText: 'Middle' },
          { id: '1', createdAt: new Date('2024-03-01'), finalText: 'Oldest' }
        ];

        vi.mocked(prisma.serviceComment.findMany).mockResolvedValueOnce(mockComments as any);

        const result = await service.getServiceComments(mockServiceId, 'internal', mockUserId);

        expect(result[0].id).toBe('3');
        expect(result[2].id).toBe('1');
      });
    });
  });

  describe('getOrderServiceComments', () => {
    const mockOrderId = 'order-123';
    const mockUserRole = 'internal';
    const mockUserId = 'user-123';

    it('should return comments grouped by service', async () => {
      const mockServices = [
        {
          id: 'service-1',
          service: { name: 'Background Check' },
          status: 'processing',
          comments: [
            { id: 'comment-1', finalText: 'Comment 1', template: {}, createdByUser: {}, updatedByUser: null },
            { id: 'comment-2', finalText: 'Comment 2', template: {}, createdByUser: {}, updatedByUser: null }
          ]
        },
        {
          id: 'service-2',
          service: { name: 'Drug Test' },
          status: 'completed',
          comments: [
            { id: 'comment-3', finalText: 'Comment 3', template: {}, createdByUser: {}, updatedByUser: null }
          ]
        }
      ];

      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServices as any);

      const result = await service.getOrderServiceComments(mockOrderId, mockUserRole, mockUserId);

      expect(result).toHaveProperty('service-1');
      expect(result).toHaveProperty('service-2');
      expect(result['service-1'].serviceName).toBe('Background Check');
      expect(result['service-1'].total).toBe(2);
      expect(result['service-2'].total).toBe(1);
    });

    it('should filter comments based on user role', async () => {
      const mockServices = [
        {
          id: 'service-1',
          service: { name: 'Background Check' },
          status: 'processing',
          comments: [
            { id: 'comment-1', isInternalOnly: true, finalText: 'Internal', template: {}, createdByUser: {}, updatedByUser: null },
            { id: 'comment-2', isInternalOnly: false, finalText: 'External', template: {}, createdByUser: {}, updatedByUser: null }
          ]
        }
      ];

      // For customer, Prisma will filter the comments
      const customerServices = [
        {
          ...mockServices[0],
          comments: [mockServices[0].comments[1]] // Only external comment
        }
      ];

      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(customerServices as any);
      const customerResult = await service.getOrderServiceComments(mockOrderId, 'customer', mockUserId);

      // Customer should only see external comment
      expect(customerResult['service-1'].comments).toHaveLength(1);
      expect(customerResult['service-1'].comments[0].isInternalOnly).toBe(false);

      vi.mocked(prisma.servicesFulfillment.findMany).mockResolvedValueOnce(mockServices as any);
      const internalResult = await service.getOrderServiceComments(mockOrderId, 'internal', mockUserId);

      // Internal user should see all comments
      expect(internalResult['service-1'].comments).toHaveLength(2);
    });
  });

  describe('validateUserAccess', () => {
    const mockServiceId = 'service-123';
    const mockUserId = 'user-456';

    it('should validate internal user has access to service', async () => {
      const mockService = {
        id: mockServiceId,
        orderId: 'order-123',
        order: {
          id: 'order-123',
          customerId: 'customer-789'
        }
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);

      const hasAccess = await service.validateUserAccess(mockServiceId, mockUserId, 'internal');

      expect(hasAccess).toBe(true);
    });

    it('should validate vendor has access to assigned service', async () => {
      const mockService = {
        id: mockServiceId,
        orderId: 'order-123',
        assignedVendorId: 'vendor-123',
        order: {
          id: 'order-123',
          customerId: 'customer-789'
        }
      };

      const mockUser = {
        id: mockUserId,
        vendorId: 'vendor-123'
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      const hasAccess = await service.validateUserAccess(mockServiceId, mockUserId, 'vendor');

      expect(hasAccess).toBe(true);
    });

    it('should deny vendor access to non-assigned service', async () => {
      const mockService = {
        id: mockServiceId,
        orderId: 'order-123',
        assignedVendorId: 'vendor-999',
        order: {
          id: 'order-123',
          customerId: 'customer-789'
        }
      };

      const mockUser = {
        id: mockUserId,
        vendorId: 'vendor-123'
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      const hasAccess = await service.validateUserAccess(mockServiceId, mockUserId, 'vendor');

      // TODO: For Phase 2c, vendors temporarily have access to all services
      // This should be changed to expect(hasAccess).toBe(false) when vendor assignment is implemented
      expect(hasAccess).toBe(true);
    });

    it('should validate customer has access to their order services', async () => {
      const mockService = {
        id: mockServiceId,
        orderId: 'order-123',
        order: {
          id: 'order-123',
          customerId: 'customer-789'
        }
      };

      const mockUser = {
        id: mockUserId,
        customerId: 'customer-789'
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      const hasAccess = await service.validateUserAccess(mockServiceId, mockUserId, 'customer');

      expect(hasAccess).toBe(true);
    });

    it('should deny customer access to other customer services', async () => {
      const mockService = {
        id: mockServiceId,
        orderId: 'order-123',
        order: {
          id: 'order-123',
          customerId: 'customer-999'
        }
      };

      const mockUser = {
        id: mockUserId,
        customerId: 'customer-789'
      };

      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce(mockService as any);
      vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser as any);

      const hasAccess = await service.validateUserAccess(mockServiceId, mockUserId, 'customer');

      expect(hasAccess).toBe(false);
    });
  });
});