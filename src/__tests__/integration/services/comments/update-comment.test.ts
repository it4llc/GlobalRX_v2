// Integration tests for updating service comments
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ServiceCommentService } from '@/services/service-comment-service';
import { prisma } from '@/lib/prisma';

// The global mock from test/setup.ts handles Prisma and logger mocking
// No need for local mocks here

describe('ServiceCommentService.updateComment', () => {
  let service: ServiceCommentService;
  const mockUserId = 'user-123';
  const mockCommentId = 'comment-123';
  const mockServiceId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockTemplateId = 'template-123';

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceCommentService();
  });

  describe('comment existence validation', () => {
    it('should reject when comment does not exist', async () => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue(null);

      await expect(
        service.updateComment(
          mockCommentId,
          {
            finalText: 'Updated comment'
          },
          mockUserId
        )
      ).rejects.toThrow('Comment not found');
    });

    it('should proceed when comment exists', async () => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue({
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Original comment',
        isInternalOnly: true
      } as any);

      const updatedComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Updated comment',
        isInternalOnly: true,
        updatedBy: mockUserId,
        updatedAt: new Date(),
        template: {},
        createdByUser: {},
        updatedByUser: { id: mockUserId, name: 'Test User' }
      };

      vi.mocked(prisma.serviceComment.update).mockResolvedValue(updatedComment as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: 'Updated comment'
        },
        mockUserId
      );

      expect(result).toBeDefined();
      expect(result.finalText).toBe('Updated comment');
    });
  });

  describe('text validation', () => {
    beforeEach(() => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue({
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Original comment',
        isInternalOnly: true
      } as any);
    });

    it('should reject empty text', async () => {
      await expect(
        service.updateComment(
          mockCommentId,
          {
            finalText: ''
          },
          mockUserId
        )
      ).rejects.toThrow('Comment text cannot be empty');
    });

    it('should reject whitespace-only text', async () => {
      await expect(
        service.updateComment(
          mockCommentId,
          {
            finalText: '   \n\t   '
          },
          mockUserId
        )
      ).rejects.toThrow('Comment text cannot be empty');
    });

    it('should reject text exceeding 1000 characters', async () => {
      await expect(
        service.updateComment(
          mockCommentId,
          {
            finalText: 'a'.repeat(1001)
          },
          mockUserId
        )
      ).rejects.toThrow('Comment text cannot exceed 1000 characters');
    });

    it('should accept text of exactly 1000 characters', async () => {
      const longText = 'b'.repeat(1000);

      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: longText,
        updatedBy: mockUserId,
        updatedAt: new Date(),
        template: {},
        createdByUser: {},
        updatedByUser: {}
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: longText
        },
        mockUserId
      );

      expect(result.finalText).toBe(longText);
    });

    it('should not validate text when not provided', async () => {
      // Only updating isInternalOnly, not finalText
      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: 'Original comment',
        isInternalOnly: false,
        updatedBy: mockUserId,
        updatedAt: new Date(),
        template: {},
        createdByUser: {},
        updatedByUser: {}
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          isInternalOnly: false
          // finalText not provided
        },
        mockUserId
      );

      expect(result.isInternalOnly).toBe(false);
      expect(result.finalText).toBe('Original comment');
    });
  });

  describe('visibility updates', () => {
    beforeEach(() => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue({
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Original comment',
        isInternalOnly: true
      } as any);
    });

    it('should update isInternalOnly from true to false', async () => {
      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: 'Original comment',
        isInternalOnly: false,
        updatedBy: mockUserId,
        updatedAt: new Date(),
        template: {},
        createdByUser: {},
        updatedByUser: {}
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          isInternalOnly: false
        },
        mockUserId
      );

      expect(result.isInternalOnly).toBe(false);
    });

    it('should update isInternalOnly from false to true', async () => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue({
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Original comment',
        isInternalOnly: false
      } as any);

      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: 'Original comment',
        isInternalOnly: true,
        updatedBy: mockUserId,
        updatedAt: new Date(),
        template: {},
        createdByUser: {},
        updatedByUser: {}
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          isInternalOnly: true
        },
        mockUserId
      );

      expect(result.isInternalOnly).toBe(true);
    });

    it('should update both text and visibility together', async () => {
      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: 'New text',
        isInternalOnly: false,
        updatedBy: mockUserId,
        updatedAt: new Date(),
        template: {},
        createdByUser: {},
        updatedByUser: {}
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: 'New text',
          isInternalOnly: false
        },
        mockUserId
      );

      expect(result.finalText).toBe('New text');
      expect(result.isInternalOnly).toBe(false);
    });
  });

  describe('audit trail', () => {
    beforeEach(() => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue({
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Original comment',
        isInternalOnly: true,
        createdBy: 'creator-123',
        createdAt: new Date('2024-03-01T10:00:00Z')
      } as any);
    });

    it('should set updatedBy to current user', async () => {
      const now = new Date();

      vi.mocked(prisma.serviceComment.update).mockImplementation(async (args) => {
        expect(args.data.updatedBy).toBe(mockUserId);
        return {
          id: mockCommentId,
          finalText: 'Updated comment',
          updatedBy: mockUserId,
          updatedAt: args.data.updatedAt,
          template: {},
          createdByUser: { id: 'creator-123', name: 'Creator' },
          updatedByUser: { id: mockUserId, name: 'Updater' }
        } as any;
      });

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: 'Updated comment'
        },
        mockUserId
      );

      expect(result.updatedBy).toBe(mockUserId);
      expect(result.updatedByUser).toBeDefined();
    });

    it('should set updatedAt timestamp', async () => {
      const beforeUpdate = new Date();

      vi.mocked(prisma.serviceComment.update).mockImplementation(async (args) => {
        expect(args.data.updatedAt).toBeDefined();
        expect(args.data.updatedAt).toBeInstanceOf(Date);
        return {
          id: mockCommentId,
          finalText: 'Updated comment',
          updatedBy: mockUserId,
          updatedAt: args.data.updatedAt,
          template: {},
          createdByUser: {},
          updatedByUser: {}
        } as any;
      });

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: 'Updated comment'
        },
        mockUserId
      );

      const afterUpdate = new Date();

      expect(result.updatedAt).toBeDefined();
      expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(result.updatedAt.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });

    it('should preserve original createdBy information', async () => {
      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: 'Updated comment',
        createdBy: 'creator-123',
        createdAt: new Date('2024-03-01T10:00:00Z'),
        updatedBy: mockUserId,
        updatedAt: new Date(),
        template: {},
        createdByUser: {
          id: 'creator-123',
          name: 'Original Creator',
          email: 'creator@example.com'
        },
        updatedByUser: {
          id: mockUserId,
          name: 'Editor',
          email: 'editor@example.com'
        }
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: 'Updated comment'
        },
        mockUserId
      );

      expect(result.createdBy).toBe('creator-123');
      expect(result.createdByUser.name).toBe('Original Creator');
      expect(result.updatedBy).toBe(mockUserId);
      expect(result.updatedByUser.name).toBe('Editor');
    });

    it('should update updatedBy even when updating same user who created', async () => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue({
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Original comment',
        isInternalOnly: true,
        createdBy: mockUserId,
        createdAt: new Date('2024-03-01T10:00:00Z')
      } as any);

      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: 'Updated by same user',
        createdBy: mockUserId,
        createdAt: new Date('2024-03-01T10:00:00Z'),
        updatedBy: mockUserId,
        updatedAt: new Date('2024-03-02T15:00:00Z'),
        template: {},
        createdByUser: {
          id: mockUserId,
          name: 'Same User',
          email: 'user@example.com'
        },
        updatedByUser: {
          id: mockUserId,
          name: 'Same User',
          email: 'user@example.com'
        }
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: 'Updated by same user'
        },
        mockUserId
      );

      expect(result.createdBy).toBe(mockUserId);
      expect(result.updatedBy).toBe(mockUserId);
      expect(result.createdByUser.id).toBe(mockUserId);
      expect(result.updatedByUser.id).toBe(mockUserId);
    });
  });

  describe('response structure', () => {
    beforeEach(() => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue({
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Original comment',
        isInternalOnly: true
      } as any);
    });

    it('should include template information', async () => {
      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: 'Updated comment',
        templateId: mockTemplateId,
        template: {
          id: mockTemplateId,
          shortName: 'DOC_REQ',
          longName: 'Document Required'
        },
        createdByUser: {},
        updatedByUser: {}
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: 'Updated comment'
        },
        mockUserId
      );

      expect(result.template).toBeDefined();
      expect(result.template.shortName).toBe('DOC_REQ');
      expect(result.template.longName).toBe('Document Required');
    });

    it('should include both user details', async () => {
      vi.mocked(prisma.serviceComment.update).mockResolvedValue({
        id: mockCommentId,
        finalText: 'Updated comment',
        createdBy: 'creator-123',
        updatedBy: mockUserId,
        template: {},
        createdByUser: {
          id: 'creator-123',
          name: 'Creator User',
          email: 'creator@example.com'
        },
        updatedByUser: {
          id: mockUserId,
          name: 'Editor User',
          email: 'editor@example.com'
        }
      } as any);

      const result = await service.updateComment(
        mockCommentId,
        {
          finalText: 'Updated comment'
        },
        mockUserId
      );

      expect(result.createdByUser).toBeDefined();
      expect(result.createdByUser.name).toBe('Creator User');
      expect(result.updatedByUser).toBeDefined();
      expect(result.updatedByUser.name).toBe('Editor User');
    });
  });

  describe('partial updates', () => {
    beforeEach(() => {
      vi.mocked(prisma.serviceComment.findUnique).mockResolvedValue({
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: mockTemplateId,
        finalText: 'Original comment',
        isInternalOnly: true
      } as any);
    });

    it('should only update finalText when isInternalOnly not provided', async () => {
      vi.mocked(prisma.serviceComment.update).mockImplementation(async (args) => {
        // Verify only finalText is being updated
        expect(args.data.finalText).toBe('New text only');
        expect(args.data.isInternalOnly).toBeUndefined();
        return {
          id: mockCommentId,
          finalText: 'New text only',
          isInternalOnly: true, // Unchanged
          template: {},
          createdByUser: {},
          updatedByUser: {}
        } as any;
      });

      await service.updateComment(
        mockCommentId,
        {
          finalText: 'New text only'
        },
        mockUserId
      );

      expect(prisma.serviceComment.update).toHaveBeenCalled();
    });

    it('should only update isInternalOnly when finalText not provided', async () => {
      vi.mocked(prisma.serviceComment.update).mockImplementation(async (args) => {
        // Verify only isInternalOnly is being updated
        expect(args.data.isInternalOnly).toBe(false);
        expect(args.data.finalText).toBeUndefined();
        return {
          id: mockCommentId,
          finalText: 'Original comment', // Unchanged
          isInternalOnly: false,
          template: {},
          createdByUser: {},
          updatedByUser: {}
        } as any;
      });

      await service.updateComment(
        mockCommentId,
        {
          isInternalOnly: false
        },
        mockUserId
      );

      expect(prisma.serviceComment.update).toHaveBeenCalled();
    });
  });
});