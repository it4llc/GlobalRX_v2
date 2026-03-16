// /GlobalRX_v2/src/app/api/services/[id]/comments/[commentId]/__tests__/route-full-editing.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PUT, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  default: {
    serviceComment: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
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

describe('PUT /api/services/[id]/comments/[commentId] - Full Text Editing', () => {
  const mockServiceId = 'c47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockCommentId = 'comment-456';
  const mockUserId = 'user-789';
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

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify({
          finalText: 'Updated text with [brackets]'
        })
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user lacks fulfillment permission', async () => {
      (getServerSession as any).mockResolvedValue({
        user: { ...mockSession.user, permissions: {} }
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify({
          finalText: 'Updated text with [brackets]'
        })
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('validation with brackets allowed', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
    });

    it('should accept updated text with brackets', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Original text without brackets',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        finalText: 'Updated text with [brackets] added'
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        ...updateData,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.finalText).toBe('Updated text with [brackets] added');
    });

    it('should accept text with placeholder-like brackets', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Original text',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        finalText: 'Please provide [document type] by [date]'
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        ...updateData,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.finalText).toBe('Please provide [document type] by [date]');
    });

    it('should accept text completely different from original', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Original template-based text',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        finalText: 'Completely new text with [my own brackets] that has nothing to do with original'
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        ...updateData,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.finalText).toBe('Completely new text with [my own brackets] that has nothing to do with original');
      // Template ID should remain unchanged
      expect(data.templateId).toBe('template-1');
    });

    it('should accept only brackets as updated text', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Normal text',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        finalText: '[[[]]]][[['
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        ...updateData,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.finalText).toBe('[[[]]]]][[[');
    });

    it('should accept complex bracket patterns', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Simple text',
        isInternalOnly: false,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        finalText: 'JSON: {"array": ["item1", "item2"], "dict": {"key": "[value]"}}',
        isInternalOnly: true
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        ...updateData,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.finalText).toContain('["item1", "item2"]');
      expect(data.finalText).toContain('[value]');
      expect(data.isInternalOnly).toBe(true);
    });
  });

  describe('partial updates', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
    });

    it('should update only isInternalOnly when finalText not provided', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Text with [brackets] stays the same',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        isInternalOnly: false
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        isInternalOnly: false,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.isInternalOnly).toBe(false);
      expect(data.finalText).toBe('Text with [brackets] stays the same');
    });

    it('should update both finalText and isInternalOnly', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Old text',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        finalText: 'New text with [brackets]',
        isInternalOnly: false
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        ...updateData,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.finalText).toBe('New text with [brackets]');
      expect(data.isInternalOnly).toBe(false);
    });

    it('should ignore attempts to update templateId', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'original-template',
        finalText: 'Text',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        finalText: 'Updated text with [brackets]',
        templateId: 'different-template' // Should be ignored
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        finalText: updateData.finalText,
        templateId: 'original-template', // Unchanged
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.templateId).toBe('original-template');

      // Verify update was called without templateId
      expect(prisma.serviceComment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            templateId: expect.anything()
          })
        })
      );
    });
  });

  describe('standard validation still applies', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);

      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Original text',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);
    });

    it('should return 400 when finalText is empty string', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify({
          finalText: ''
        })
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Comment text is required');
    });

    it('should return 400 when finalText is only whitespace', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify({
          finalText: '   \n\t   '
        })
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Comment text is required');
    });

    it('should return 400 when finalText exceeds 1000 characters', async () => {
      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify({
          finalText: '[start]' + 'x'.repeat(994) + '[end]' // 1007 chars
        })
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('cannot exceed 1000 characters');
    });

    it('should accept exactly 1000 characters with brackets', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Short',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const exactText = '[' + 'a'.repeat(998) + ']'; // Exactly 1000
      const updateData = {
        finalText: exactText
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        ...updateData,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.finalText).toHaveLength(1000);
    });
  });

  describe('business logic', () => {
    beforeEach(() => {
      (getServerSession as any).mockResolvedValue(mockSession);
    });

    it('should return 404 when comment does not exist', async () => {
      (prisma.serviceComment.findUnique as any).mockResolvedValue(null);

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify({
          finalText: 'Updated text with [brackets]'
        })
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Comment not found');
    });

    it('should handle database errors gracefully', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'template-1',
        finalText: 'Original',
        isInternalOnly: true,
        createdBy: mockUserId
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);
      (prisma.serviceComment.update as any).mockRejectedValue(new Error('Database connection failed'));

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify({
          finalText: 'Updated text with [brackets]'
        })
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to update comment');
    });

    it('should preserve original templateId through updates', async () => {
      const existingComment = {
        id: mockCommentId,
        serviceId: mockServiceId,
        templateId: 'original-template-id',
        finalText: 'Template text with [placeholder]',
        isInternalOnly: true,
        createdBy: mockUserId,
        template: {
          name: 'Original Template',
          templateText: 'Original template text with [placeholder]'
        }
      };

      (prisma.serviceComment.findUnique as any).mockResolvedValue(existingComment);

      const updateData = {
        finalText: 'Completely different text unrelated to template'
      };

      (prisma.serviceComment.update as any).mockResolvedValue({
        ...existingComment,
        finalText: updateData.finalText,
        updatedBy: mockUserId,
        updatedAt: new Date()
      });

      const request = new Request('http://localhost/api/services/service-123/comments/comment-456', {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      const response = await PUT(request, {
        params: { id: mockServiceId, commentId: mockCommentId }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.templateId).toBe('original-template-id');
      expect(data.finalText).toBe('Completely different text unrelated to template');
    });
  });
});