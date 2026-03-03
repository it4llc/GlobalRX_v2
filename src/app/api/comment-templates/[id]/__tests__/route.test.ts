// /GlobalRX_v2/src/app/api/comment-templates/[id]/__tests__/route.test.ts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PUT, DELETE } from '../route';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    commentTemplate: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    commentTemplateAvailability: {
      deleteMany: vi.fn()
    },
    $transaction: vi.fn()
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

describe('GET /api/comment-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123');
    const response = await GET(request, { params: { id: '123' } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when user lacks permission', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: {}
      }
    });

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123');
    const response = await GET(request, { params: { id: '123' } });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Insufficient permissions');
  });

  it('should return 404 when template not found', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123');
    const response = await GET(request, { params: { id: '123' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Template not found');
  });

  it('should return template when found', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    const mockTemplate = {
      id: '123',
      shortName: 'Test',
      longName: 'Test Template',
      templateText: 'Test text',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
      updatedBy: '1',
      availabilities: []
    };

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(mockTemplate);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123');
    const response = await GET(request, { params: { id: '123' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe('123');
    expect(data.shortName).toBe('Test');
  });
});

describe('PUT /api/comment-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'PUT',
      body: JSON.stringify({ shortName: 'Updated' })
    });

    const response = await PUT(request, { params: { id: '123' } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when user lacks permission', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: {}
      }
    });

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'PUT',
      body: JSON.stringify({ shortName: 'Updated' })
    });

    const response = await PUT(request, { params: { id: '123' } });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Insufficient permissions');
  });

  it('should return 404 when template not found', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'PUT',
      body: JSON.stringify({ shortName: 'Updated' })
    });

    const response = await PUT(request, { params: { id: '123' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Template not found');
  });

  it('should return 400 for invalid input', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    const existing = {
      id: '123',
      shortName: 'Test',
      longName: 'Test Template',
      templateText: 'Test text',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
      updatedBy: '1'
    };

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(existing);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'PUT',
      body: JSON.stringify({ shortName: 'a'.repeat(51) }) // Too long
    });

    const response = await PUT(request, { params: { id: '123' } });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid input');
  });

  it('should return 400 for duplicate shortName', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    const existing = {
      id: '123',
      shortName: 'Test',
      longName: 'Test Template',
      templateText: 'Test text',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
      updatedBy: '1'
    };

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(existing);

    vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce({
      id: 'other',
      shortName: 'Duplicate',
      longName: 'Other Template',
      templateText: 'Other text',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
      updatedBy: '1'
    });

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'PUT',
      body: JSON.stringify({ shortName: 'Duplicate' })
    });

    const response = await PUT(request, { params: { id: '123' } });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('A template with this short name already exists');
  });

  it('should update template successfully', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    const existing = {
      id: '123',
      shortName: 'Test',
      longName: 'Test Template',
      templateText: 'Test text',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
      updatedBy: '1'
    };

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(existing);
    vi.mocked(prisma.commentTemplate.findFirst).mockResolvedValueOnce(null);

    const updated = {
      ...existing,
      shortName: 'Updated',
      availabilities: []
    };

    vi.mocked(prisma.commentTemplate.update).mockResolvedValueOnce(updated);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'PUT',
      body: JSON.stringify({ shortName: 'Updated' })
    });

    const response = await PUT(request, { params: { id: '123' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.shortName).toBe('Updated');

    expect(prisma.commentTemplate.update).toHaveBeenCalledWith({
      where: { id: '123' },
      data: {
        shortName: 'Updated',
        updatedBy: '1'
      },
      include: {
        availabilities: true
      }
    });
  });
});

describe('DELETE /api/comment-templates/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'DELETE'
    });

    const response = await DELETE(request, { params: { id: '123' } });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 403 when user lacks permission', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: {}
      }
    });

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'DELETE'
    });

    const response = await DELETE(request, { params: { id: '123' } });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Insufficient permissions');
  });

  it('should return 404 when template not found', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(null);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'DELETE'
    });

    const response = await DELETE(request, { params: { id: '123' } });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('Template not found');
  });

  it('should soft delete when hasBeenUsed is true', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    const template = {
      id: '123',
      shortName: 'Test',
      longName: 'Test Template',
      templateText: 'Test text',
      isActive: true,
      hasBeenUsed: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
      updatedBy: '1'
    };

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(template);

    const updated = { ...template, isActive: false };
    vi.mocked(prisma.commentTemplate.update).mockResolvedValueOnce(updated);

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'DELETE'
    });

    const response = await DELETE(request, { params: { id: '123' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Template deactivated (has been used)');

    expect(prisma.commentTemplate.update).toHaveBeenCalledWith({
      where: { id: '123' },
      data: {
        isActive: false,
        updatedBy: '1'
      }
    });

    expect(prisma.commentTemplate.delete).not.toHaveBeenCalled();
  });

  it('should hard delete when hasBeenUsed is false', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({
      user: {
        id: '1',
        permissions: { comment_management: true }
      }
    });

    const template = {
      id: '123',
      shortName: 'Test',
      longName: 'Test Template',
      templateText: 'Test text',
      isActive: true,
      hasBeenUsed: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: '1',
      updatedBy: '1'
    };

    vi.mocked(prisma.commentTemplate.findUnique).mockResolvedValueOnce(template);

    // Mock the transaction to execute the callback with a transactional client
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback) => {
      const tx = {
        commentTemplateAvailability: {
          deleteMany: vi.fn().mockResolvedValueOnce({ count: 0 })
        },
        commentTemplate: {
          delete: vi.fn().mockResolvedValueOnce(template)
        }
      };
      return callback(tx);
    });

    const request = new NextRequest('http://localhost:3000/api/comment-templates/123', {
      method: 'DELETE'
    });

    const response = await DELETE(request, { params: { id: '123' } });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Template permanently deleted');

    // Verify transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(prisma.commentTemplate.update).not.toHaveBeenCalled();
  });
});