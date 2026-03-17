// /GlobalRX_v2/src/app/api/comment-templates/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commentTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn()
    },
    service: {
      findMany: vi.fn()
    },
    order: {
      findMany: vi.fn()
    }
  }
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {}
}));

vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('GET /api/comment-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions', () => {
    it('should return 403 when user is vendor', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'vendor',
          permissions: {}
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return 403 when user is customer', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'customer',
          permissions: {}
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return 403 when internal user lacks comment_management permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('successful retrieval', () => {
    it('should return templates, services, and statuses when user has permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { comment_management: true }
        }
      });

      const mockTemplates = [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          shortName: 'Missing Doc',
          longName: 'Document Required - Customer Must Provide',
          templateText: 'Please provide [document type] for [candidate name]',
          isActive: true,
          hasBeenUsed: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdBy: '550e8400-e29b-41d4-a716-446655440002',
          updatedBy: '550e8400-e29b-41d4-a716-446655440002',
          availabilities: []
        }
      ];

      const mockServices = [
        {
          code: 'MVR',
          name: 'Motor Vehicle Record',
          category: 'Driving',
          disabled: false
        },
        {
          code: 'CRIMINAL',
          name: 'Criminal Background',
          category: 'Background',
          disabled: false
        }
      ];

      const mockOrders = [
        { statusCode: 'draft' },
        { statusCode: 'submitted' },
        { statusCode: 'processing' },
        { statusCode: 'completed' }
      ];

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce(mockTemplates);
      vi.mocked(prisma.service.findMany).mockResolvedValueOnce(mockServices);
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce(mockOrders);

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.templates).toHaveLength(1);
      expect(data.templates[0].shortName).toBe('Missing Doc');
      expect(data.services).toHaveLength(2);
      expect(data.statuses).toEqual(['Draft', 'Submitted', 'Processing', 'Missing Information', 'Completed', 'Cancelled', 'Cancelled-DNB']);
    });

    it('should return empty arrays when no data exists', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { comment_management: true }
        }
      });

      vi.mocked(prisma.commentTemplate.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.service.findMany).mockResolvedValueOnce([]);
      vi.mocked(prisma.order.findMany).mockResolvedValueOnce([]);

      const request = new NextRequest('http://localhost:3000/api/comment-templates');
      const response = await GET(request);

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.templates).toEqual([]);
      expect(data.services).toEqual([]);
      expect(data.statuses).toEqual(['Draft', 'Submitted', 'Processing', 'Missing Information', 'Completed', 'Cancelled', 'Cancelled-DNB']); // Always returns hardcoded statuses now
    });
  });
});

describe('POST /api/comment-templates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authentication', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  describe('permissions', () => {
    it('should return 403 when user is vendor', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'vendor',
          permissions: {}
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });

    it('should return 403 when internal user lacks comment_management permission', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { candidate_workflow: true }
        }
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toBe('Insufficient permissions');
    });
  });

  describe('validation', () => {
    const mockSession = {
      user: {
        id: '1',
        type: 'internal',
        permissions: { comment_management: true }
      }
    };

    beforeEach(() => {
      vi.mocked(getServerSession).mockResolvedValueOnce(mockSession);
    });

    it('should return 400 when shortName is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when longName is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when templateText is missing', async () => {
      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when shortName exceeds 50 characters', async () => {
      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'a'.repeat(51),
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid input');
    });

    it('should return 400 when duplicate shortName exists', async () => {
      vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce({
        id: '550e8400-e29b-41d4-a716-446655440003',
        shortName: 'Test',
        longName: 'Existing Template',
        templateText: 'Existing text',
        isActive: true,
        hasBeenUsed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '1',
        updatedBy: '1'
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'Test',
          longName: 'Test Template',
          templateText: 'Test text'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('A template with this short name already exists');
    });
  });

  describe('successful creation', () => {
    it('should create template successfully with valid data', async () => {
      vi.mocked(getServerSession).mockResolvedValueOnce({
        user: {
          id: '1',
          userType: 'internal',
          permissions: { comment_management: true }
        }
      });

      vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce(null);

      const newTemplate = {
        id: '550e8400-e29b-41d4-a716-446655440004',
        shortName: 'New Template',
        longName: 'New Template Long Name',
        templateText: 'Template text with [placeholder]',
        isActive: true,
        hasBeenUsed: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: '1',
        updatedBy: '1'
      };

      vi.mocked(prisma.commentTemplate.create).mockResolvedValueOnce({
        ...newTemplate,
        availabilities: []
      });

      const request = new NextRequest('http://localhost:3000/api/comment-templates', {
        method: 'POST',
        body: JSON.stringify({
          shortName: 'New Template',
          longName: 'New Template Long Name',
          templateText: 'Template text with [placeholder]'
        })
      });

      const response = await POST(request);

      expect(response.status).toBe(201);

      const data = await response.json();
      expect(data.shortName).toBe('New Template');
      expect(data.longName).toBe('New Template Long Name');
      expect(data.templateText).toBe('Template text with [placeholder]');

      expect(prisma.commentTemplate.create).toHaveBeenCalledWith({
        data: {
          shortName: 'New Template',
          longName: 'New Template Long Name',
          templateText: 'Template text with [placeholder]',
          createdBy: '1',
          updatedBy: '1'
        },
        include: {
          availabilities: true
        }
      });
    });
  });
});