// /GlobalRX_v2/src/app/api/services/[id]/comments/__tests__/route-null-serviceId-bug.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, PUT, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findUnique: vi.fn()
    },
    comment: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn()
    },
    commentTemplate: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

describe('Service Comments API - null serviceId bug', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for authenticated user
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: 'user-123',
        userType: 'internal',
        permissions: { fulfillment: true }
      }
    } as any);
  });

  describe('Bug scenario: Receiving null as serviceId', () => {
    /**
     * These tests verify that the API properly handles the case where
     * 'null' is passed as the serviceId in the URL path
     */
    it('should return 400 when serviceId is literally "null" string', async () => {
      const request = new NextRequest('http://localhost/api/services/null/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: 'null' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid service ID');
    });

    it('should return 400 for undefined serviceId', async () => {
      const request = new NextRequest('http://localhost/api/services/undefined/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment'
        })
      });

      const response = await POST(request, { params: { id: 'undefined' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Invalid service ID');
    });

    it('should return 400 for empty serviceId', async () => {
      const request = new NextRequest('http://localhost/api/services//comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment'
        })
      });

      const response = await POST(request, { params: { id: '' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Service ID is required');
    });
  });

  describe('Correct behavior with valid serviceId', () => {
    const validServiceId = '123e4567-e89b-12d3-a456-426614174000';

    it('should create comment with valid serviceId', async () => {
      // Mock service exists
      vi.mocked(prisma.orderItem.findUnique).mockResolvedValueOnce({
        id: validServiceId,
        orderId: '550e8400-e29b-41d4-a716-446655440001',
        serviceType: 'BACKGROUND_CHECK'
      } as any);

      // Mock template exists
      vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce({
        id: 'template-123',
        name: 'Document Request',
        text: 'Please provide documents'
      } as any);

      // Mock comment creation
      vi.mocked(prisma.comment.create).mockResolvedValueOnce({
        id: 'comment-456',
        orderItemId: validServiceId,
        templateId: 'template-123',
        templateName: 'Document Request',
        finalText: 'Test comment',
        isInternalOnly: true,
        createdBy: 'user-123',
        createdAt: new Date()
      } as any);

      const request = new NextRequest(`http://localhost/api/services/${validServiceId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Test comment',
          isInternalOnly: true
        })
      });

      const response = await POST(request, { params: { id: validServiceId } });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.comment).toMatchObject({
        id: 'comment-456',
        orderItemId: validServiceId,
        finalText: 'Test comment'
      });

      // Verify correct service was looked up
      expect(prisma.orderItem.findUnique).toHaveBeenCalledWith({
        where: { id: validServiceId }
      });
    });

    it('should update comment with valid serviceId', async () => {
      const commentId = 'comment-789';

      // Mock comment exists and belongs to the service
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({
        id: commentId,
        orderItemId: validServiceId,
        createdBy: 'user-123'
      } as any);

      // Mock update
      vi.mocked(prisma.comment.update).mockResolvedValueOnce({
        id: commentId,
        orderItemId: validServiceId,
        finalText: 'Updated text',
        isInternalOnly: false,
        updatedBy: 'user-123',
        updatedAt: new Date()
      } as any);

      const request = new NextRequest(
        `http://localhost/api/services/${validServiceId}/comments/${commentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            finalText: 'Updated text',
            isInternalOnly: false
          })
        }
      );

      const response = await PUT(request, {
        params: {
          id: validServiceId,
          commentId: commentId
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.comment.finalText).toBe('Updated text');

      // Verify comment was looked up with correct serviceId
      expect(prisma.comment.findUnique).toHaveBeenCalledWith({
        where: {
          id: commentId,
          orderItemId: validServiceId // Must match the serviceId
        }
      });
    });

    it('should delete comment with valid serviceId', async () => {
      const commentId = 'comment-delete';

      // Mock comment exists and belongs to the service
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({
        id: commentId,
        orderItemId: validServiceId,
        createdBy: 'user-123'
      } as any);

      // Mock delete
      vi.mocked(prisma.comment.delete).mockResolvedValueOnce({
        id: commentId
      } as any);

      const request = new NextRequest(
        `http://localhost/api/services/${validServiceId}/comments/${commentId}`,
        {
          method: 'DELETE'
        }
      );

      const response = await DELETE(request, {
        params: {
          id: validServiceId,
          commentId: commentId
        }
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify correct comment was deleted
      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: {
          id: commentId,
          orderItemId: validServiceId
        }
      });
    });
  });

  describe('Security: Preventing cross-service comment manipulation', () => {
    it('should not allow updating comment from different service', async () => {
      const serviceId1 = '123e4567-e89b-12d3-a456-426614174001';
      const serviceId2 = '123e4567-e89b-12d3-a456-426614174002';
      const commentId = 'comment-123';

      // Mock comment belongs to serviceId1, not serviceId2
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({
        id: commentId,
        orderItemId: serviceId1 // Different service!
      } as any);

      const request = new NextRequest(
        `http://localhost/api/services/${serviceId2}/comments/${commentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            finalText: 'Attempted update'
          })
        }
      );

      const response = await PUT(request, {
        params: {
          id: serviceId2,
          commentId: commentId
        }
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Comment not found');
    });

    it('should not allow deleting comment from different service', async () => {
      const serviceId1 = '123e4567-e89b-12d3-a456-426614174001';
      const serviceId2 = '123e4567-e89b-12d3-a456-426614174002';
      const commentId = 'comment-456';

      // Mock comment belongs to serviceId1
      vi.mocked(prisma.comment.findUnique).mockResolvedValueOnce({
        id: commentId,
        orderItemId: serviceId1
      } as any);

      const request = new NextRequest(
        `http://localhost/api/services/${serviceId2}/comments/${commentId}`,
        {
          method: 'DELETE'
        }
      );

      const response = await DELETE(request, {
        params: {
          id: serviceId2,
          commentId: commentId
        }
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toContain('Comment not found');
    });
  });

  describe('Permission checks', () => {
    it('should not allow customers to create comments', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'customer-123',
          userType: 'customer'
        }
      } as any);

      const validServiceId = '123e4567-e89b-12d3-a456-426614174000';

      const request = new NextRequest(`http://localhost/api/services/${validServiceId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: 'template-123',
          finalText: 'Customer comment attempt'
        })
      });

      const response = await POST(request, { params: { id: validServiceId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Customers cannot create comments');
    });

    it('should not allow vendors to edit comments', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: 'vendor-123',
          userType: 'vendor',
          vendorId: 'vendor-org-123'
        }
      } as any);

      const validServiceId = '123e4567-e89b-12d3-a456-426614174000';
      const commentId = 'comment-123';

      const request = new NextRequest(
        `http://localhost/api/services/${validServiceId}/comments/${commentId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            finalText: 'Vendor edit attempt'
          })
        }
      );

      const response = await PUT(request, {
        params: {
          id: validServiceId,
          commentId: commentId
        }
      });

      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Vendors cannot edit comments');
    });
  });
});