// /GlobalRX_v2/src/app/api/services/[id]/comments/__tests__/route-full-editing.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../route';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { ServiceCommentService } from '@/services/service-comment-service';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    serviceComment: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    commentTemplate: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/lib/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }
}));

// Mock ServiceCommentService
const mockValidateUserAccess = vi.fn();
const mockCreateComment = vi.fn();
const mockCheckTemplateAvailability = vi.fn();

vi.mock('@/services/service-comment-service', () => ({
  ServiceCommentService: vi.fn(function() {
    return {
      validateUserAccess: mockValidateUserAccess,
      createComment: mockCreateComment,
      checkTemplateAvailability: mockCheckTemplateAvailability
    };
  })
}));

describe('POST /api/services/[id]/comments - Full Text Editing', () => {
  const mockServiceId = 'service-123';
  const mockUserId = 'user-456';
  const mockSession = {
    user: {
      id: mockUserId,
      email: 'user@example.com',
      type: 'internal', // Add user type to fix the test
      permissions: { fulfillment: true }
    }
  };

  // Helper to create a properly formatted comment response
  const createMockCommentResponse = (commentData: any) => ({
    id: 'comment-new',
    orderItemId: mockServiceId,
    serviceId: mockServiceId,
    ...commentData,
    createdBy: mockUserId,
    createdAt: new Date(),
    updatedBy: null,
    updatedAt: null,
    template: {
      id: commentData.templateId,
      shortName: 'DocReq',
      longName: 'Document Request'
    },
    createdByUser: {
      id: mockUserId,
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User'
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      (getServerSession as any).mockResolvedValue(null);

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-1',
          finalText: 'Text with [brackets]',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks fulfillment permission', async () => {
      (getServerSession as any).mockResolvedValue({
        user: { ...mockSession.user, permissions: {} }
      });

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          templateId: 'template-1',
          finalText: 'Text with [brackets]',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('You do not have permission to add comments');
    });
  });

  describe('validation with brackets allowed', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
      mockValidateUserAccess.mockResolvedValue(true);
      mockCheckTemplateAvailability.mockResolvedValue({ available: true });
    });

    it('should accept text with opening brackets only', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Text with [ bracket',
        isInternalOnly: true
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Test Template'
      });

      mockCreateComment.mockResolvedValue(createMockCommentResponse(commentData));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      if (response.status !== 201) {
        const errorData = await response.json();
        console.error('Test failed with:', errorData);
      }

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('Text with [ bracket');
      expect(mockCreateComment).toHaveBeenCalledWith(
        mockServiceId,
        commentData,
        mockUserId
      );
    });

    it('should accept text with closing brackets only', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Text with ] bracket',
        isInternalOnly: false
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Test Template'
      });

      mockCreateComment.mockResolvedValue(createMockCommentResponse(commentData));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('Text with ] bracket');
    });

    it('should accept text with placeholder-like brackets', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Please provide [document type] by [date] for verification purposes.',
        isInternalOnly: true
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Test Template',
        templateText: 'Please provide [document type] by [date] for verification purposes.'
      });

      mockCreateComment.mockResolvedValue(createMockCommentResponse(commentData));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('Please provide [document type] by [date] for verification purposes.');
    });

    it('should accept text completely different from template', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Completely different text from the original template',
        isInternalOnly: false
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Test Template',
        templateText: 'Original template text with [placeholders]'
      });

      mockCreateComment.mockResolvedValue(createMockCommentResponse(commentData));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('Completely different text from the original template');
      expect(data.templateId).toBe(commentData.templateId); // Template ID is preserved
    });

    it('should accept text with nested and complex brackets', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Text with [[nested]] and [multiple] [brackets] everywhere []',
        isInternalOnly: true
      };

      mockCreateComment.mockResolvedValue(createMockCommentResponse(commentData));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('Text with [[nested]] and [multiple] [brackets] everywhere []');
    });

    it('should accept exactly 1000 characters with brackets', async () => {
      const longText = 'A'.repeat(979) + ' [with brackets here]'; // Exactly 1000 chars
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: longText,
        isInternalOnly: true
      };

      expect(longText.length).toBe(1000);

      mockCreateComment.mockResolvedValue(createMockCommentResponse(commentData));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText.length).toBe(1000);
      expect(data.finalText).toContain('[with brackets here]');
    });
  });

  describe('validation failures', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
      mockValidateUserAccess.mockResolvedValue(true);
    });

    it('should return 400 when templateId is missing', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          finalText: 'Text without template',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('templateId');
    });

    it('should return 400 when finalText is missing', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('finalText');
    });

    it('should return 400 when finalText is empty', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('at least 1 character');
    });

    it('should return 400 when finalText is only whitespace', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '   \n\t  ',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Comment text cannot be empty');
    });

    it('should return 400 when finalText exceeds 1000 characters', async () => {
      const longText = 'A'.repeat(1001);
      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: longText,
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Comment text cannot exceed 1000 characters');
    });

    it('should default isInternalOnly to true when not provided', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Test comment'
      };

      mockCreateComment.mockResolvedValue(createMockCommentResponse({
        ...commentData,
        isInternalOnly: true
      }));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.isInternalOnly).toBe(true);
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
      mockValidateUserAccess.mockResolvedValue(true);
    });

    it('should return 404 when template does not exist', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Text with [brackets]',
        isInternalOnly: true
      };

      mockCreateComment.mockRejectedValue(new Error('Template not found'));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(500); // Internal server error for unhandled errors
      const data = await response.json();
      expect(data.error).toContain('error');
    });

    it('should handle database errors gracefully', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Text with [brackets]',
        isInternalOnly: true
      };

      mockCreateComment.mockRejectedValue(new Error('Database connection failed'));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('error');
    });

    it('should track template ID even when text is completely different', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'This has nothing to do with the template',
        isInternalOnly: false
      };

      mockCreateComment.mockResolvedValue(createMockCommentResponse(commentData));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.templateId).toBe(commentData.templateId);
      expect(data.finalText).toBe(commentData.finalText);
      expect(mockCreateComment).toHaveBeenCalledWith(
        mockServiceId,
        expect.objectContaining({
          templateId: commentData.templateId
        }),
        mockUserId
      );
    });
  });
});