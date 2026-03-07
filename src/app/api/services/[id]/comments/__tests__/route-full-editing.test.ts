// /GlobalRX_v2/src/app/api/services/[id]/comments/__tests__/route-full-editing.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '../route';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

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

describe('POST /api/services/[id]/comments - Full Text Editing', () => {
  const mockServiceId = 'service-123';
  const mockUserId = 'user-456';
  const mockSession = {
    user: {
      id: mockUserId,
      email: 'user@example.com',
      permissions: { fulfillment: true }
    }
  };

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
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('validation with brackets allowed', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
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

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-new',
        serviceId: mockServiceId,
        ...commentData,
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('Text with [ bracket');
      expect(prisma.serviceComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            finalText: 'Text with [ bracket'
          })
        })
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

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-new',
        serviceId: mockServiceId,
        ...commentData,
        createdBy: mockUserId,
        createdAt: new Date()
      });

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
        finalText: 'Please provide [document type] by [date] for verification',
        isInternalOnly: true
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Document Request'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-new',
        serviceId: mockServiceId,
        ...commentData,
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('Please provide [document type] by [date] for verification');
    });

    it('should accept text completely different from template', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'This text has nothing to do with the original template',
        isInternalOnly: true
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Original Template'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-new',
        serviceId: mockServiceId,
        templateId: commentData.templateId, // Original template ID is preserved
        finalText: commentData.finalText,
        isInternalOnly: true,
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('This text has nothing to do with the original template');
      expect(data.templateId).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should accept text with nested and complex brackets', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Complex: [[nested]] array[0] dict["key"] [[[deep]]]',
        isInternalOnly: false
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Test Template'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-new',
        serviceId: mockServiceId,
        ...commentData,
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toBe('Complex: [[nested]] array[0] dict["key"] [[[deep]]]');
    });

    it('should accept exactly 1000 characters with brackets', async () => {
      const longText = '[' + 'a'.repeat(998) + ']'; // Exactly 1000 chars
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: longText,
        isInternalOnly: true
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Test Template'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-new',
        serviceId: mockServiceId,
        ...commentData,
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.finalText).toHaveLength(1000);
    });
  });

  describe('standard validation still applies', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
    });

    it('should return 400 when templateId is missing', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          finalText: 'Text with [brackets]',
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
      expect(data.error).toContain('Comment text is required');
    });

    it('should return 400 when finalText is only whitespace', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '   \n\t   ',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Comment text is required');
    });

    it('should return 400 when finalText exceeds 1000 characters', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify({
          templateId: '123e4567-e89b-12d3-a456-426614174000',
          finalText: '[' + 'a'.repeat(1000) + ']', // 1002 chars
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('cannot exceed 1000 characters');
    });

    it('should default isInternalOnly to true when not provided', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Text with [brackets]'
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Test Template'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-new',
        serviceId: mockServiceId,
        ...commentData,
        isInternalOnly: true,
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      expect(prisma.serviceComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            isInternalOnly: true
          })
        })
      );
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
    });

    it('should return 404 when template does not exist', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Text with [brackets]',
        isInternalOnly: true
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue(null);

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Template not found');
    });

    it('should handle database errors gracefully', async () => {
      const commentData = {
        templateId: '123e4567-e89b-12d3-a456-426614174000',
        finalText: 'Text with [brackets]',
        isInternalOnly: true
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: commentData.templateId,
        name: 'Test Template'
      });

      (prisma.serviceComment.create as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to create comment');
    });

    it('should track template ID even when text is completely different', async () => {
      const commentData = {
        templateId: 'original-template-id',
        finalText: 'Completely new text that has nothing to do with the template',
        isInternalOnly: false
      };

      (prisma.commentTemplate.findUnique as any).mockResolvedValue({
        id: 'original-template-id',
        name: 'Original Template',
        templateText: 'Original template text with [placeholder]'
      });

      (prisma.serviceComment.create as any).mockResolvedValue({
        id: 'comment-new',
        serviceId: mockServiceId,
        templateId: 'original-template-id',
        finalText: commentData.finalText,
        isInternalOnly: false,
        createdBy: mockUserId,
        createdAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments', {
        method: 'POST',
        body: JSON.stringify(commentData)
      });

      const response = await POST(request, { params: { id: mockServiceId } });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.templateId).toBe('original-template-id');
      expect(data.finalText).toBe('Completely new text that has nothing to do with the template');

      // Verify the create call preserves the template ID
      expect(prisma.serviceComment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            templateId: 'original-template-id',
            finalText: 'Completely new text that has nothing to do with the template'
          })
        })
      );
    });
  });
});